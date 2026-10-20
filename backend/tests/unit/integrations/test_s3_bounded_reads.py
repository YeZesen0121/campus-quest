"""Bounded evidence reads close streams and preserve provider failure semantics."""

from io import BytesIO

import pytest
from botocore.exceptions import (
    ClientError,
    ConnectTimeoutError,
    NoCredentialsError,
    ReadTimeoutError,
)

from app.core.config import get_settings
from app.integrations.errors import (
    PermanentProviderError,
    TemporaryProviderError,
    UnknownOutcomeError,
)
from app.integrations.object_storage import StoredObjectTooLargeError
from app.integrations.object_storage_s3 import S3ObjectStorage


class TrackedBody(BytesIO):
    def __init__(self, value=b"safe", *, error=None):
        super().__init__(value)
        self.read_sizes = []
        self.error = error

    def read(self, size=-1):
        self.read_sizes.append(size)
        if self.error is not None:
            raise self.error
        return super().read(size)


def storage(monkeypatch, *, body=None, length=4, error=None):
    class Client:
        def get_object(self, **kwargs):
            assert kwargs == {"Bucket": get_settings().s3_bucket, "Key": "owned-proof"}
            if error is not None:
                raise error
            return {"Body": body, "ContentLength": length}

    monkeypatch.setattr(
        "app.integrations.object_storage_s3.boto3.client",
        lambda *args, **kwargs: Client(),
    )
    return S3ObjectStorage(get_settings())


def test_exact_limit_returns_content_and_closes_stream(monkeypatch):
    body = TrackedBody()
    result = storage(monkeypatch, body=body).read_bounded_object(
        object_key="owned-proof", max_bytes=4
    )
    assert result.content == b"safe"
    assert result.content_type == "application/octet-stream"
    assert body.closed
    assert body.read_sizes == [5]


@pytest.mark.parametrize("declared_length", [4, 5])
def test_oversize_metadata_or_body_never_returns_partial_content(
    monkeypatch, declared_length
):
    body = TrackedBody(b"large")
    with pytest.raises(StoredObjectTooLargeError):
        storage(monkeypatch, body=body, length=declared_length).read_bounded_object(
            object_key="owned-proof", max_bytes=4
        )
    assert body.closed
    assert body.read_sizes == ([5] if declared_length == 4 else [])


@pytest.mark.parametrize("limit", [0, -1])
def test_invalid_limit_is_rejected_before_provider_access(monkeypatch, limit):
    adapter = storage(monkeypatch, error=AssertionError("provider must stay unused"))
    with pytest.raises(ValueError, match="positive"):
        adapter.read_bounded_object(object_key="owned-proof", max_bytes=limit)


@pytest.mark.parametrize(
    ("error", "expected"),
    [
        (
            ClientError(
                {
                    "Error": {"Code": "NoSuchKey"},
                    "ResponseMetadata": {"HTTPStatusCode": 404},
                },
                "GetObject",
            ),
            FileNotFoundError,
        ),
        (
            ClientError(
                {
                    "Error": {"Code": "AccessDenied"},
                    "ResponseMetadata": {"HTTPStatusCode": 403},
                },
                "GetObject",
            ),
            PermanentProviderError,
        ),
        (
            ClientError(
                {
                    "Error": {"Code": "SlowDown"},
                    "ResponseMetadata": {"HTTPStatusCode": 503},
                },
                "GetObject",
            ),
            TemporaryProviderError,
        ),
        (ReadTimeoutError(endpoint_url="https://storage.invalid"), UnknownOutcomeError),
        (
            ConnectTimeoutError(endpoint_url="https://storage.invalid"),
            TemporaryProviderError,
        ),
        (NoCredentialsError(), PermanentProviderError),
    ],
)
def test_read_preserves_missing_retryable_unknown_and_permanent_failures(
    monkeypatch, error, expected
):
    with pytest.raises(expected):
        storage(monkeypatch, error=error).read_bounded_object(
            object_key="owned-proof", max_bytes=4
        )


@pytest.mark.parametrize(
    ("error", "expected"),
    [
        (ReadTimeoutError(endpoint_url="https://storage.invalid"), UnknownOutcomeError),
        (OSError("stream unavailable"), OSError),
    ],
)
def test_stream_read_failure_always_releases_the_response(monkeypatch, error, expected):
    body = TrackedBody(error=error)
    with pytest.raises(expected):
        storage(monkeypatch, body=body).read_bounded_object(
            object_key="owned-proof", max_bytes=4
        )
    assert body.closed
    assert body.read_sizes == [5]
