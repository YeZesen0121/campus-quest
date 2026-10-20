"""Migration identity and source-preservation contracts; no app import or DB."""

import ast
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
VERSIONS = ROOT / "backend/alembic/versions"
TARGETS = ROOT / "infra/integration/migration-targets.json"


def ast_hash(tree):
    # Python3.12 adds an empty FunctionDef.type_params field. The source Git
    # contracts were captured with Python3.10; ignore only that absent semantic
    # field, never a nonempty type parameter or any operation/literal.
    for node in ast.walk(tree):
        if hasattr(node, "type_params") and node.type_params == []:
            delattr(node, "type_params")
    return hashlib.sha256(ast.dump(tree, include_attributes=False).encode()).hexdigest()


def migrations():
    result = []
    for path in sorted(VERSIONS.glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        fields = {}
        for node in tree.body:
            if isinstance(node, ast.Assign):
                targets = node.targets
            elif isinstance(node, ast.AnnAssign):
                targets = [node.target]
            else:
                continue
            for target in targets:
                if isinstance(target, ast.Name) and target.id in {
                    "revision",
                    "down_revision",
                }:
                    fields[target.id] = ast.literal_eval(node.value)
        if "revision" in fields:
            result.append((path, fields, tree))
    return result


def settings():
    return json.loads(TARGETS.read_text(encoding="utf-8"))


def test_revision_ids_unique():
    counts = Counter(item[1]["revision"] for item in migrations())
    assert {key: count for key, count in counts.items() if count > 1} == {}


def test_single_final_head():
    items = migrations()
    ids = {item[1]["revision"] for item in items}
    parents = set()
    for _, fields, _ in items:
        value = fields["down_revision"]
        parents.update(
            value if isinstance(value, tuple) else (() if value is None else (value,))
        )
    assert ids - parents == {"ie_0042"}
    assert parents <= ids


def test_innovation_parent_chain():
    expected = settings()
    items = {fields["revision"]: fields for _, fields, _ in migrations()}
    parent = expected["upstream_head"]
    for number in range(25, 43):
        revision = f"ie_{number:04}"
        assert revision in items, f"Missing namespaced migration {revision}"
        assert items[revision]["down_revision"] == parent
        parent = revision


def test_revision_map_covers_18_sources():
    mapping = settings()["revision_map"]
    assert set(mapping) == {f"{number:04}" for number in range(25, 43)}
    assert set(mapping.values()) == {f"ie_{number:04}" for number in range(25, 43)}
    for old, new in mapping.items():
        assert new == "ie_" + old
        assert len(list(VERSIONS.glob(new + "_*.py"))) == 1


def test_upstream_migration_files_unchanged():
    for item in settings()["upstream_files"]:
        path = ROOT / item["path"]
        assert path.is_file()
        raw = path.read_bytes().replace(b"\r\n", b"\n")
        assert hashlib.sha256(raw).hexdigest() == item["sha256_lf"], item["path"]


def test_innovation_migration_operation_bodies_preserved():
    expected = settings()["innovation_operations"]
    for item in expected.values():
        path = ROOT / item["target_path"]
        assert path.is_file(), f"Missing preserved operation body: {path.name}"
        tree = ast.parse(path.read_text(encoding="utf-8"))
        functions = {
            node.name: ast_hash(ast.Module(body=node.body, type_ignores=[]))
            for node in tree.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            and node.name in {"upgrade", "downgrade"}
        }
        assert functions == item["operations"], path.name
        nonmetadata = []
        for index, node in enumerate(tree.body):
            if (
                index == 0
                and isinstance(node, ast.Expr)
                and isinstance(node.value, ast.Constant)
                and isinstance(node.value.value, str)
            ):
                continue
            targets = (
                node.targets
                if isinstance(node, ast.Assign)
                else [node.target]
                if isinstance(node, ast.AnnAssign)
                else []
            )
            if any(
                isinstance(value, ast.Name)
                and value.id in {"revision", "down_revision"}
                for value in targets
            ):
                continue
            nonmetadata.append(node)
        module_hash = ast_hash(ast.Module(body=nonmetadata, type_ignores=[]))
        assert module_hash == item["module_contract_sha256"], path.name
