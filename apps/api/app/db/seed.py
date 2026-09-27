from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    BenchmarkMetricDefinition,
    NormalizationVersion,
    ScoringVersion,
    WorkloadProfile,
    WorkloadWeight,
)

CORE_METRICS: list[dict[str, object]] = [
    {
        "metric_key": "cpu_single",
        "display_name": "CPU Single-Thread Responsiveness",
        "subsystem": "CPU",
        "unit": "pts",
        "direction": "higher_is_better",
        "min_sample_count": 3,
    },
    {
        "metric_key": "cpu_multi",
        "display_name": "CPU Multi-Core Throughput",
        "subsystem": "CPU",
        "unit": "samples_per_min",
        "direction": "higher_is_better",
        "min_sample_count": 3,
    },
    {
        "metric_key": "gpu_render_compute",
        "display_name": "GPU Render & Compute Throughput",
        "subsystem": "GPU",
        "unit": "samples_per_min",
        "direction": "higher_is_better",
        "min_sample_count": 3,
    },
    {
        "metric_key": "ram_bandwidth_capacity",
        "display_name": "System Memory Adequacy & Bandwidth",
        "subsystem": "RAM",
        "unit": "MB_per_sec",
        "direction": "higher_is_better",
        "min_sample_count": 2,
    },
    {
        "metric_key": "storage_throughput",
        "display_name": "Storage I/O & Sequential Throughput",
        "subsystem": "STORAGE",
        "unit": "MB_per_sec",
        "direction": "higher_is_better",
        "min_sample_count": 2,
    },
]

WORKLOAD_SEED_DATA: list[dict[str, object]] = [
    {
        "slug": "gaming",
        "name": "Gaming",
        "version": "1.0.0",
        "description": "Prioritizes GPU graphics/compute and CPU single-thread responsiveness.",
        "weights": {
            "gpu_render_compute": (0.50, 50.0),
            "cpu_single": (0.20, 45.0),
            "cpu_multi": (0.10, 35.0),
            "ram_bandwidth_capacity": (0.12, 40.0),
            "storage_throughput": (0.08, 30.0),
        },
    },
    {
        "slug": "web-development",
        "name": "Web Development",
        "version": "1.0.0",
        "description": "Prioritizes CPU multi-tasking, single-thread responsiveness, and RAM capacity.",
        "weights": {
            "cpu_multi": (0.35, 50.0),
            "cpu_single": (0.25, 50.0),
            "ram_bandwidth_capacity": (0.22, 50.0),
            "storage_throughput": (0.13, 40.0),
            "gpu_render_compute": (0.05, 15.0),
        },
    },
    {
        "slug": "video-3d",
        "name": "Video / 3D",
        "version": "1.0.0",
        "description": "Prioritizes GPU rendering, CPU multi-core throughput, and high memory/storage bandwidth.",
        "weights": {
            "gpu_render_compute": (0.42, 60.0),
            "cpu_multi": (0.28, 55.0),
            "ram_bandwidth_capacity": (0.18, 55.0),
            "storage_throughput": (0.12, 50.0),
        },
    },
    {
        "slug": "local-ai",
        "name": "Local AI",
        "version": "1.0.0",
        "description": "Heavily weights GPU compute & VRAM adequacy alongside system memory and storage.",
        "weights": {
            "gpu_render_compute": (0.55, 65.0),
            "ram_bandwidth_capacity": (0.20, 60.0),
            "cpu_multi": (0.15, 45.0),
            "storage_throughput": (0.10, 45.0),
        },
    },
    {
        "slug": "office-browsing",
        "name": "Office / Browsing",
        "version": "1.0.0",
        "description": "Focuses on snappy everyday CPU responsiveness, memory adequacy, and fast storage.",
        "weights": {
            "cpu_single": (0.40, 30.0),
            "ram_bandwidth_capacity": (0.25, 30.0),
            "storage_throughput": (0.20, 30.0),
            "cpu_multi": (0.10, 25.0),
            "gpu_render_compute": (0.05, 10.0),
        },
    },
]


def seed_reference_configuration(db: Session) -> None:
    metric_map: dict[str, BenchmarkMetricDefinition] = {}
    for item in CORE_METRICS:
        metric_key = str(item["metric_key"])
        existing_metric = db.scalar(
            select(BenchmarkMetricDefinition).where(
                BenchmarkMetricDefinition.metric_key == metric_key
            )
        )
        if existing_metric is None:
            existing_metric = BenchmarkMetricDefinition(
                metric_key=metric_key,
                display_name=str(item["display_name"]),
                subsystem=str(item["subsystem"]),
                unit=str(item["unit"]),
                direction=str(item["direction"]),
                min_sample_count=int(str(item["min_sample_count"])),
            )
            db.add(existing_metric)
            db.flush()
        metric_map[metric_key] = existing_metric

    norm_v1 = db.scalar(
        select(NormalizationVersion).where(NormalizationVersion.version_code == "norm-v1.0")
    )
    if norm_v1 is None:
        db.add(
            NormalizationVersion(
                version_code="norm-v1.0",
                method="percentile_rank",
                formula_notes="Percentile rank normalization within frozen dataset version.",
                is_active=True,
            )
        )

    score_v1 = db.scalar(
        select(ScoringVersion).where(ScoringVersion.version_code == "score-v1.0")
    )
    if score_v1 is None:
        db.add(
            ScoringVersion(
                version_code="score-v1.0",
                tier_thresholds_json={
                    "Weak": [0, 34],
                    "Basic": [35, 54],
                    "Mid-range": [55, 69],
                    "Strong": [70, 84],
                    "High-end": [85, 100],
                },
                balance_thresholds_json={
                    "Balanced": [0, 12],
                    "Mild bottleneck": [13, 22],
                    "Moderate bottleneck": [23, 35],
                    "Major bottleneck": [36, 100],
                },
                is_active=True,
            )
        )

    for wl in WORKLOAD_SEED_DATA:
        slug = str(wl["slug"])
        version = str(wl["version"])
        profile = db.scalar(
            select(WorkloadProfile).where(
                WorkloadProfile.slug == slug, WorkloadProfile.version == version
            )
        )
        if profile is None:
            profile = WorkloadProfile(
                slug=slug,
                name=str(wl["name"]),
                description=str(wl["description"]),
                version=version,
                is_active=True,
            )
            db.add(profile)
            db.flush()

            weights_dict: dict[str, tuple[float, float]] = wl["weights"]  # type: ignore[assignment]
            for m_key, (weight_val, min_score) in weights_dict.items():
                db.add(
                    WorkloadWeight(
                        workload_profile_id=profile.id,
                        metric_definition_id=metric_map[m_key].id,
                        weight=weight_val,
                        minimum_adequacy_score=min_score,
                    )
                )

    db.commit()