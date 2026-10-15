"""Build a private gate index from the host worktree's tracked-file inventory.

No shared .git directory is mounted or edited. This is a working-file snapshot,
not a copy of commit history; native Git remains authoritative for commits.
"""

import os
import subprocess
from pathlib import Path, PurePosixPath


def main() -> None:
    worktree = Path("/workspace")
    git_dir = Path(os.environ["GIT_DIR"])
    if (
        git_dir != Path("/tmp/campusquest-r5-git/current")
        or git_dir.is_symlink()
        or git_dir.parent.is_symlink()
        or os.environ["GIT_WORK_TREE"] != str(worktree)
        or os.environ["GIT_INDEX_FILE"] != str(git_dir / "index")
    ):
        raise SystemExit("Refusing a Git metadata path outside the private R5 context")
    manifest = Path(os.environ["CQ_R5_GIT_MANIFEST"])
    manifest.relative_to(worktree / "infra/r5/.runtime/git-manifests")
    paths = manifest.read_bytes().split(b"\0")
    tracked = []
    for value in paths:
        if not value:
            continue
        path = PurePosixPath(os.fsdecode(value))
        if path.is_absolute() or ".." in path.parts or path.parts[0] == ".git":
            raise SystemExit("Refusing an unsafe tracked path")
        candidate = worktree / path
        if candidate.is_file() or candidate.is_symlink():
            tracked.append(value)
    if not tracked:
        raise SystemExit("Refusing an empty host tracked-file inventory")

    def git(*args: str, data: bytes | None = None) -> bytes:
        return subprocess.check_output(
            ["git", *args], cwd=worktree, input=data, stderr=subprocess.STDOUT
        )

    if not (git_dir / "HEAD").exists():
        git_dir.parent.mkdir(parents=True, exist_ok=True)
        init_env = {
            key: value
            for key, value in os.environ.items()
            if key not in {"GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE"}
        }
        subprocess.run(
            ["git", "init", "--bare", "--quiet", str(git_dir)],
            cwd=git_dir.parent,
            env=init_env,
            check=True,
        )
        git("config", "--local", "core.bare", "false")
        git("config", "--local", "core.worktree", str(worktree))
        git("config", "--local", "core.autocrlf", "false")
    stale = set(git("ls-files", "-z").split(b"\0")) - set(tracked) - {b""}
    if stale:
        git(
            "update-index",
            "--force-remove",
            "-z",
            "--stdin",
            data=b"\0".join(stale) + b"\0",
        )
    git(
        "--literal-pathspecs",
        "add",
        "--force",
        "--pathspec-from-file=-",
        "--pathspec-file-nul",
        data=b"\0".join(tracked) + b"\0",
    )
    print(f"R5_PRIVATE_GIT_INDEX=READY tracked={len(tracked)}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        if exc.output:
            print(exc.output.decode(errors="replace"), flush=True)
        raise
