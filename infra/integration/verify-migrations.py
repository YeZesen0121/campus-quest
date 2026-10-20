"""CLI entry point; the same guarded probe works locally and in explicit CI."""
import asyncio
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from migration_probe import compare_downgrade_failures, main, validate_source  # noqa: E402,F401

if __name__ == "__main__":
    asyncio.run(main())
