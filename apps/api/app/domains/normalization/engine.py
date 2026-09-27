import math
from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass(frozen=True)
class RawComponentObservationInput:
    component_id: int
    raw_values: tuple[float, ...]
    total_sample_count: int
    latest_tested_at: datetime | None = None
    is_approved_source: bool = True


@dataclass(frozen=True)
class NormalizedComponentMetricOutput:
    component_id: int
    raw_aggregated_score: float
    normalized_score_0_100: float
    percentile: float
    sample_count: int
    confidence_contribution: float


@dataclass(frozen=True)
class NormalizationBatchResult:
    outputs: list[NormalizedComponentMetricOutput]
    excluded_missing_component_ids: list[int]
    population_size: int


def compute_median(values: tuple[float, ...]) -> float:
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    if n == 0:
        raise ValueError("Cannot compute median of empty sequence.")
    mid = n // 2
    if n % 2 == 1:
        return float(sorted_vals[mid])
    return float((sorted_vals[mid - 1] + sorted_vals[mid]) / 2.0)


def compute_confidence_contribution(
    *,
    sample_count: int,
    min_sample_count: int,
    population_size: int,
    latest_tested_at: datetime | None,
    reference_time: datetime,
    is_approved_source: bool = True,
) -> float:
    target_samples = max(1, min_sample_count * 3)
    raw_sample_ratio = min(1.0, sample_count / target_samples)
    sample_factor = (
        min(0.50, raw_sample_ratio) if sample_count < min_sample_count else raw_sample_ratio
    )

    population_factor = min(1.0, population_size / 4.0)

    if latest_tested_at is None:
        freshness_factor = 0.85
    else:
        tested_utc = (
            latest_tested_at.replace(tzinfo=UTC)
            if latest_tested_at.tzinfo is None
            else latest_tested_at.astimezone(UTC)
        )
        ref_utc = (
            reference_time.replace(tzinfo=UTC)
            if reference_time.tzinfo is None
            else reference_time.astimezone(UTC)
        )
        age_days = max(0, (ref_utc - tested_utc).days)
        if age_days <= 90:
            freshness_factor = 1.0
        elif age_days <= 180:
            freshness_factor = 0.85
        else:
            freshness_factor = 0.65

    source_factor = 1.0 if is_approved_source else 0.5

    confidence = (
        0.40 * sample_factor
        + 0.25 * population_factor
        + 0.20 * freshness_factor
        + 0.15 * source_factor
    )
    return round(max(0.0, min(1.0, confidence)), 4)


def normalize_metric_population(
    inputs: list[RawComponentObservationInput],
    *,
    direction: str = "higher_is_better",
    min_sample_count: int = 3,
    reference_time: datetime | None = None,
) -> NormalizationBatchResult:
    if direction not in ("higher_is_better", "lower_is_better"):
        raise ValueError(f"Unsupported metric direction: {direction}")

    ref_time = reference_time or datetime.now(UTC)

    valid_aggregated: list[tuple[RawComponentObservationInput, float]] = []
    excluded_ids: list[int] = []

    for item in inputs:
        clean_vals = tuple(
            v for v in item.raw_values if v is not None and not math.isnan(v) and v > 0.0
        )
        if not clean_vals or item.total_sample_count < 1:
            excluded_ids.append(item.component_id)
            continue
        median_score = round(compute_median(clean_vals), 4)
        valid_aggregated.append((item, median_score))

    n_pop = len(valid_aggregated)
    if n_pop == 0:
        return NormalizationBatchResult(
            outputs=[],
            excluded_missing_component_ids=excluded_ids,
            population_size=0,
        )

    outputs: list[NormalizedComponentMetricOutput] = []

    for item, score_i in valid_aggregated:
        worse_count = 0
        equal_count = 0

        for _, score_j in valid_aggregated:
            if math.isclose(score_i, score_j, rel_tol=1e-9, abs_tol=1e-9):
                equal_count += 1
            elif direction == "higher_is_better" and score_j < score_i:
                worse_count += 1
            elif direction == "lower_is_better" and score_j > score_i:
                worse_count += 1

        percentile = round(((worse_count + 0.5 * equal_count) / n_pop) * 100.0, 2)
        clamped_score = max(0.0, min(100.0, percentile))

        conf = compute_confidence_contribution(
            sample_count=item.total_sample_count,
            min_sample_count=min_sample_count,
            population_size=n_pop,
            latest_tested_at=item.latest_tested_at,
            reference_time=ref_time,
            is_approved_source=item.is_approved_source,
        )

        outputs.append(
            NormalizedComponentMetricOutput(
                component_id=item.component_id,
                raw_aggregated_score=round(score_i, 2),
                normalized_score_0_100=clamped_score,
                percentile=percentile,
                sample_count=item.total_sample_count,
                confidence_contribution=conf,
            )
        )

    outputs.sort(key=lambda x: x.component_id)
    return NormalizationBatchResult(
        outputs=outputs,
        excluded_missing_component_ids=excluded_ids,
        population_size=n_pop,
    )
