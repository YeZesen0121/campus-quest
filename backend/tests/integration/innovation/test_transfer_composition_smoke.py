"""Real MinIO/ClamAV bytes survive only the selected handover scope."""

import asyncio
import os
from urllib.parse import unquote, urlsplit
from uuid import uuid4

import httpx
import pytest

from app.core.config import get_settings
from app.integrations.object_storage_s3 import S3ObjectStorage
from app.modules.identity.enums import Role
from app.modules.identity.events import Actor
from app.modules.innovation.collaboration_schemas import TargetResolveCommand
from app.modules.innovation.collaboration_service import CollaborationService
from app.modules.innovation.evidence_router import get_evidence_service
from app.modules.innovation.evidence_schemas import EvidenceIntentCreate
from app.modules.innovation.transfer_router import get_transfer_service
from app.modules.innovation.transfer_schemas import TransferCommand, TransferCreate
from tests.integration.innovation.recruitment_support import world as successor_world
from tests.integration.innovation.test_achievement_evidence import PDF, world
from tests.integration.innovation.test_achievement_evidence import clock as clock
from tests.integration.innovation.test_collaboration_races import CONTEXT

pytestmark = pytest.mark.integration

if (
    os.environ.get("CQ_S3_SMOKE") != "1"
    or os.environ.get("CQ_EVIDENCE_SCAN_SMOKE") != "1"
):
    pytest.skip(
        "real transfer requires S3 and scanner smoke flags", allow_module_level=True
    )


async def test_real_preview_and_selected_handover_bytes(db_session, clock):
    owner, project, achievement, _ = await world(db_session, clock)
    target, _, _, _ = await successor_world(db_session, clock)
    target.username = str(uuid4().int)[:12]
    username, project_id, achievement_id = target.username, project.id, achievement.id
    owner_actor, target_actor = (
        Actor(owner.id, Role.STUDENT),
        Actor(target.id, Role.STUDENT),
    )
    await db_session.commit()
    evidence_service = get_evidence_service(clock)
    signed, _ = await evidence_service.create_intent(
        db_session,
        actor=owner_actor,
        project_id=project_id,
        achievement_id=achievement_id,
        payload=EvidenceIntentCreate(
            request_id=uuid4(), content_type="application/pdf", size=len(PDF)
        ),
    )
    key = unquote(urlsplit(signed.upload_url).path).split("/", 2)[2]
    storage = S3ObjectStorage(get_settings(), clock=clock)
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            uploaded = await http.put(
                signed.upload_url, headers=signed.client_headers, content=PDF
            )
            assert uploaded.status_code == 200
        checked = await evidence_service.complete(
            db_session,
            actor=owner_actor,
            project_id=project_id,
            achievement_id=achievement_id,
            evidence_id=signed.evidence.id,
        )
        assert checked.state == "READY", checked.failure_code
        reference = await CollaborationService(clock=clock).resolve(
            db_session,
            actor=owner_actor,
            payload=TargetResolveCommand(account=username),
            context=CONTEXT,
        )
        transfers = get_transfer_service(clock)
        proposal = await transfers.request(
            db_session,
            actor=owner_actor,
            project_id=project_id,
            payload=TransferCreate(
                request_id=uuid4(),
                target_ref=reference.target_ref,
                evidence_ids=[checked.id],
                allow_preview=True,
            ),
            context=CONTEXT,
        )
        preview = await transfers.read_evidence(
            db_session,
            actor=target_actor,
            transfer_id=proposal.id,
            evidence_id=checked.id,
            version=proposal.version,
            context=CONTEXT,
        )
        assert preview.content == PDF
        accepted = await transfers.act(
            db_session,
            actor=target_actor,
            transfer_id=proposal.id,
            action="accept",
            payload=TransferCommand(
                request_id=uuid4(),
                version=proposal.version,
                confirmation_digest=proposal.confirmation_digest,
            ),
            context=CONTEXT,
        )
        assert accepted.status == "ACCEPTED"
        content = await evidence_service.read_content(
            db_session,
            actor=target_actor,
            project_id=project_id,
            achievement_id=achievement_id,
            evidence_id=checked.id,
        )
        assert content.content == PDF
    finally:
        await asyncio.to_thread(storage.delete_object, object_key=key)
