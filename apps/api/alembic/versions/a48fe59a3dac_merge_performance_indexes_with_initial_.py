"""merge performance indexes with initial schema

Revision ID: a48fe59a3dac
Revises: 002_perf_idx, a9431de6a932
Create Date: 2026-09-28 21:52:11.042364

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a48fe59a3dac'
down_revision: Union[str, None] = ('002_perf_idx', 'a9431de6a932')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass