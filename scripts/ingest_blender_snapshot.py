import argparse
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR / "apps" / "api"))

from app.db.seed import seed_reference_configuration  # noqa: E402
from app.db.seed_catalog import seed_curated_hardware_catalog  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.domains.ingestion.blender_adapter import ingest_blender_snapshot_file  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(
        description="SiliconSense by SpideyTech — Blender Open Data Snapshot Ingestor"
    )
    parser.add_argument(
        "--file",
        type=str,
        default=str(ROOT_DIR / "data" / "fixtures" / "blender_opendata_snapshot_v1.json"),
        help="Path to local Blender Open Data JSON snapshot",
    )
    args = parser.parse_args()
    snapshot_path = Path(args.file).resolve()

    with SessionLocal() as db:
        seed_reference_configuration(db)
        seed_curated_hardware_catalog(db)
        summary = ingest_blender_snapshot_file(db, snapshot_path)
        print(summary.model_dump_json(indent=2))


if __name__ == "__main__":
    main()