"""Frontend coverage citations must be checked as strictly as backend ones."""

import runpy
from pathlib import Path

import pytest


@pytest.mark.parametrize("prefix", ["frontend", "tests/../../frontend"])
def test_frontend_citation_requires_existing_file(tmp_path: Path, prefix: str) -> None:
    tool = runpy.run_path(
        str(Path(__file__).parents[3] / "scripts/check_test_matrix.py")
    )
    check = tool["check_matrix"]
    check.__globals__["_BACKEND_ROOT"] = tmp_path / "backend"
    target = tmp_path / "frontend/e2e/recruitment.spec.ts"
    target.parent.mkdir(parents=True)
    target.write_text("// real test fixture", encoding="utf-8")
    matrix = tmp_path / "matrix.md"
    matrix.write_text(
        f"| R1 | spec | behavior | `{prefix}/e2e/recruitment.spec.ts` | covered |",
        encoding="utf-8",
    )
    assert check(matrix) == []
    target.unlink()
    assert "missing file" in check(matrix)[0]


def test_frontend_citation_cannot_escape_repository(tmp_path: Path) -> None:
    tool = runpy.run_path(
        str(Path(__file__).parents[3] / "scripts/check_test_matrix.py")
    )
    matrix = tmp_path / "matrix.md"
    matrix.write_text(
        "| R1 | spec | behavior | `frontend/e2e/../../../outside.ts` | covered |",
        encoding="utf-8",
    )
    assert tool["check_matrix"](matrix)


def test_integration_selfproof_citation_requires_existing_file(tmp_path: Path) -> None:
    tool = runpy.run_path(
        str(Path(__file__).parents[3] / "scripts/check_test_matrix.py")
    )
    check = tool["check_matrix"]
    check.__globals__["_BACKEND_ROOT"] = tmp_path / "backend"
    target = tmp_path / "infra/integration/test-isolation.mjs"
    target.parent.mkdir(parents=True)
    target.write_text("// executable contract fixture", encoding="utf-8")
    matrix = tmp_path / "matrix.md"
    matrix.write_text(
        "| I1 | plan | reject foreign resources | "
        "`infra/integration/test-isolation.mjs` | covered |",
        encoding="utf-8",
    )
    assert check(matrix) == []
    target.unlink()
    assert "missing file" in check(matrix)[0]


def test_integration_citation_cannot_escape_its_owned_directory(tmp_path: Path) -> None:
    tool = runpy.run_path(
        str(Path(__file__).parents[3] / "scripts/check_test_matrix.py")
    )
    check = tool["check_matrix"]
    check.__globals__["_BACKEND_ROOT"] = tmp_path / "backend"
    outside = tmp_path / "infra/outside.mjs"
    outside.parent.mkdir(parents=True)
    outside.write_text("// exists but is outside integration", encoding="utf-8")
    matrix = tmp_path / "matrix.md"
    matrix.write_text(
        "| I1 | plan | reject escaping citation | "
        "`infra/integration/../outside.mjs` | covered |",
        encoding="utf-8",
    )
    assert check(matrix)
