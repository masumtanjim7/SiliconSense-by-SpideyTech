import argparse
import sys
from pathlib import Path

# Ensure apps/api is on python path
ROOT_DIR = Path(__file__).resolve().parents[1]
API_DIR = ROOT_DIR / "apps" / "api"
sys.path.insert(0, str(API_DIR))

from app.db.session import SessionLocal
from app.domains.ingestion.blender_adapter import ingest_blender_snapshot_file
from app.domains.normalization.service import recompute_normalized_metrics_for_dataset


def run_scheduled_refresh(
    dataset_version: str, snapshot_path_str: str, normalization_code: str = "norm-v1.0"
) -> None:
    print(
        f"[SiliconSense Scheduler] Starting automated ingestion refresh for dataset version: {dataset_version}"
    )
    snapshot_path = Path(snapshot_path_str)
    if not snapshot_path.is_file():
        print(f"[SiliconSense Scheduler] Error: Snapshot file not found at {snapshot_path}")
        sys.exit(1)

    db = SessionLocal()
    try:
        print("[SiliconSense Scheduler] Step 1: Running Blender Open Data ingestion adapter...")
        summary = ingest_blender_snapshot_file(db, snapshot_path)
        print(
            f"[SiliconSense Scheduler] Ingestion succeeded. Inserted: {summary.rows_inserted}, Quarantined: {summary.rows_quarantined}"
        )

        print("[SiliconSense Scheduler] Step 2: Recomputing Hazen normalized percentiles...")
        norm_summary = recompute_normalized_metrics_for_dataset(
            db, dataset_version, normalization_version_code=normalization_code
        )
        print(
            f"[SiliconSense Scheduler] Normalization complete. Upserted {norm_summary.normalized_rows_upserted} scores across {norm_summary.metrics_processed} metrics."
        )
        print("[SiliconSense Scheduler] Pipeline run completed successfully.")
    except Exception as exc:
        print(f"[SiliconSense Scheduler] Pipeline failed with error: {exc}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="SiliconSense automated dataset ingestion & normalization refresh runner."
    )
    parser.add_argument(
        "--dataset-version",
        default="ds-2026-09-r1",
        help="Target dataset version identifier.",
    )
    parser.add_argument(
        "--snapshot-path",
        default=str(ROOT_DIR / "data" / "fixtures" / "blender_opendata_snapshot_v1.json"),
        help="Path to raw JSON dataset snapshot.",
    )
    parser.add_argument(
        "--normalization-code",
        default="norm-v1.0",
        help="Active normalization version code.",
    )
    args = parser.parse_args()

    run_scheduled_refresh(
        dataset_version=args.dataset_version,
        snapshot_path_str=args.snapshot_path,
        normalization_code=args.normalization_code,
    )