"""add performance indexes for catalog search and analysis lookups

Revision ID: 002_perf_idx
Revises: 
Create Date: 2026-09-28 17:30:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "002_perf_idx"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE INDEX IF NOT EXISTS idx_hardware_component_type_brand ON hardware_component (component_type, brand);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_hardware_component_model ON hardware_component (model_name);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_normalized_metric_dataset_version ON normalized_metric (dataset_version);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_benchmark_observation_quarantined ON benchmark_observation (is_quarantined);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_analysis_result_share_uuid ON analysis_result (share_uuid);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_analysis_result_share_uuid;")
    op.execute("DROP INDEX IF EXISTS idx_benchmark_observation_quarantined;")
    op.execute("DROP INDEX IF EXISTS idx_normalized_metric_dataset_version;")
    op.execute("DROP INDEX IF EXISTS idx_hardware_component_model;")
    op.execute("DROP INDEX IF EXISTS idx_hardware_component_type_brand;")
