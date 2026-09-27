from collections import defaultdict
from dataclasses import dataclass


@dataclass(frozen=True)
class WorkloadMetricRuleInput:
    metric_key: str
    display_name: str
    subsystem: str
    weight: float
    minimum_adequacy_score: float | None = None


@dataclass(frozen=True)
class ComponentMetricEvidenceInput:
    component_id: int
    component_name: str
    subsystem: str
    metric_key: str
    normalized_score_0_100: float
    percentile: float
    confidence_contribution: float


@dataclass(frozen=True)
class MetricContributionOutput:
    metric_key: str
    display_name: str
    subsystem: str
    component_id: int | None
    normalized_score_0_100: float | None
    weight_applied: float
    weighted_contribution: float
    is_missing_metric: bool


@dataclass(frozen=True)
class BottleneckDetectionOutput:
    limiting_component_type: str
    strongest_component_type: str
    spread_points: float
    severity_status: str
    explanation: str


@dataclass(frozen=True)
class UpgradeRecommendationOutput:
    priority_order: int
    component_type: str
    affected_metric_key: str
    reason: str
    target_score_min: float
    target_score_max: float


@dataclass(frozen=True)
class WorkloadAnalysisOutput:
    performance_score_0_100: float
    performance_tier: str
    balance_score_0_100: float
    balance_status: str
    confidence_score_0_100: float
    confidence_level: str
    coverage_ratio: float
    contributions: list[MetricContributionOutput]
    bottlenecks: list[BottleneckDetectionOutput]
    recommendations: list[UpgradeRecommendationOutput]
    warnings: list[str]


def classify_performance_tier(score: float) -> str:
    if score < 35.0:
        return "Weak"
    if score < 55.0:
        return "Basic"
    if score < 70.0:
        return "Mid-range"
    if score < 85.0:
        return "Strong"
    return "High-end"


def classify_balance_status(spread_points: float) -> str:
    if spread_points <= 12.0:
        return "Balanced"
    if spread_points <= 22.0:
        return "Mild bottleneck"
    if spread_points <= 35.0:
        return "Moderate bottleneck"
    return "Major bottleneck"


def classify_confidence_level(confidence_score: float, coverage_ratio: float) -> str:
    if confidence_score >= 80.0 and coverage_ratio >= 0.80:
        return "High"
    if confidence_score >= 55.0:
        return "Medium"
    return "Limited"


def evaluate_build_for_workload(
    *,
    workload_name: str,
    rules: list[WorkloadMetricRuleInput],
    evidence: dict[str, ComponentMetricEvidenceInput],
    relevance_weight_threshold: float = 0.10,
) -> WorkloadAnalysisOutput:
    if not rules:
        raise ValueError("Workload rules cannot be empty.")

    total_rule_weight = sum(r.weight for r in rules)
    if abs(total_rule_weight - 1.0) > 1e-4:
        raise ValueError(f"Workload weights must sum to 1.00, got {total_rule_weight:.4f}")

    contributions: list[MetricContributionOutput] = []
    warnings: list[str] = []

    covered_weight = 0.0
    weighted_score_sum = 0.0
    weighted_confidence_sum = 0.0

    subsystem_total_weights: dict[str, float] = defaultdict(float)
    subsystem_covered_weights: dict[str, float] = defaultdict(float)
    subsystem_weighted_scores: dict[str, float] = defaultdict(float)

    for rule in rules:
        subsystem_total_weights[rule.subsystem] += rule.weight
        ev = evidence.get(rule.metric_key)

        if ev is None:
            contributions.append(
                MetricContributionOutput(
                    metric_key=rule.metric_key,
                    display_name=rule.display_name,
                    subsystem=rule.subsystem,
                    component_id=None,
                    normalized_score_0_100=None,
                    weight_applied=rule.weight,
                    weighted_contribution=0.0,
                    is_missing_metric=True,
                )
            )
            warnings.append(
                f"Missing benchmark evidence for '{rule.display_name}' ({rule.metric_key}); "
                f"excluded from score rather than substituting zero."
            )
        else:
            clamped = max(0.0, min(100.0, ev.normalized_score_0_100))
            contrib = round(clamped * rule.weight, 2)
            covered_weight += rule.weight
            weighted_score_sum += clamped * rule.weight
            weighted_confidence_sum += ev.confidence_contribution * rule.weight

            subsystem_covered_weights[rule.subsystem] += rule.weight
            subsystem_weighted_scores[rule.subsystem] += clamped * rule.weight

            contributions.append(
                MetricContributionOutput(
                    metric_key=rule.metric_key,
                    display_name=rule.display_name,
                    subsystem=rule.subsystem,
                    component_id=ev.component_id,
                    normalized_score_0_100=round(clamped, 2),
                    weight_applied=rule.weight,
                    weighted_contribution=contrib,
                    is_missing_metric=False,
                )
            )
            if ev.confidence_contribution < 0.70:
                warnings.append(
                    f"Low sample or stale data coverage on {ev.component_name} "
                    f"for '{rule.display_name}'."
                )

    if covered_weight <= 0.0:
        raise ValueError("Cannot calculate analysis: zero benchmark coverage for selected build.")

    coverage_ratio = round(covered_weight / total_rule_weight, 4)
    performance_score = round(weighted_score_sum / covered_weight, 2)
    performance_score = max(0.0, min(100.0, performance_score))
    performance_tier = classify_performance_tier(performance_score)

    avg_metric_confidence = weighted_confidence_sum / covered_weight
    confidence_score = round((0.55 * coverage_ratio + 0.45 * avg_metric_confidence) * 100.0, 2)
    confidence_score = max(0.0, min(100.0, confidence_score))
    confidence_level = classify_confidence_level(confidence_score, coverage_ratio)

    relevant_subsystem_scores: dict[str, float] = {}
    for subsys, total_w in subsystem_total_weights.items():
        cov_w = subsystem_covered_weights.get(subsys, 0.0)
        if total_w >= relevance_weight_threshold and cov_w > 0.0:
            relevant_subsystem_scores[subsys] = round(subsystem_weighted_scores[subsys] / cov_w, 2)

    bottlenecks: list[BottleneckDetectionOutput] = []
    if len(relevant_subsystem_scores) < 2:
        balance_score = 100.0
        balance_status = "Balanced"
        warnings.append(
            "Insufficient multi-subsystem benchmark coverage to evaluate component spread."
        )
        strongest_sub = next(iter(relevant_subsystem_scores.keys()), "N/A")
        strongest_score = relevant_subsystem_scores.get(strongest_sub, performance_score)
        weakest_sub = strongest_sub
        spread_pts = 0.0
    else:
        strongest_sub = max(relevant_subsystem_scores, key=lambda k: relevant_subsystem_scores[k])
        weakest_sub = min(relevant_subsystem_scores, key=lambda k: relevant_subsystem_scores[k])
        strongest_score = relevant_subsystem_scores[strongest_sub]
        weakest_score = relevant_subsystem_scores[weakest_sub]
        spread_pts = round(max(0.0, strongest_score - weakest_score), 2)
        balance_status = classify_balance_status(spread_pts)
        balance_score = round(max(0.0, min(100.0, 100.0 - spread_pts * 1.5)), 2)

        if spread_pts <= 12.0:
            explanation = (
                f"Well-balanced for {workload_name}: {strongest_sub} ({strongest_score:.1f}) and "
                f"{weakest_sub} ({weakest_score:.1f}) are within {spread_pts:.1f} points."
            )
        else:
            explanation = (
                f"In {workload_name}, {weakest_sub} capability ({weakest_score:.1f}) trails "
                f"{strongest_sub} ({strongest_score:.1f}) by {spread_pts:.1f} points "
                f"({balance_status})."
            )

        bottlenecks.append(
            BottleneckDetectionOutput(
                limiting_component_type=weakest_sub,
                strongest_component_type=strongest_sub,
                spread_points=spread_pts,
                severity_status=balance_status,
                explanation=explanation,
            )
        )

    raw_Upgrade_candidates: list[tuple[float, UpgradeRecommendationOutput]] = []
    for rule in rules:
        if rule.weight < relevance_weight_threshold:
            continue
        ev = evidence.get(rule.metric_key)
        if ev is None:
            continue

        score_val = ev.normalized_score_0_100
        min_adeq = rule.minimum_adequacy_score or 50.0
        below_adequacy = score_val < min_adeq
        is_bottleneck_part = (
            spread_pts > 12.0
            and rule.subsystem == weakest_sub
            and score_val < (strongest_score - 12.0)
        )

        if not (below_adequacy or is_bottleneck_part):
            continue

        reference_target = max(min_adeq, strongest_score if is_bottleneck_part else min_adeq)
        deficit = max(1.0, reference_target - score_val)
        impact_score = round(rule.weight * deficit, 4)

        target_min = round(min(95.0, max(min_adeq, strongest_score - 10.0)), 1)
        target_max = round(min(99.0, max(target_min + 8.0, strongest_score)), 1)

        if below_adequacy and is_bottleneck_part:
            reason = (
                f"{ev.component_name} scores {score_val:.1f} on '{rule.display_name}', which is "
                f"below the {workload_name} adequacy target ({min_adeq:.0f}) and limits "
                f"{strongest_sub} ({strongest_score:.1f})."
            )
        elif below_adequacy:
            reason = (
                f"{ev.component_name} scores {score_val:.1f} on '{rule.display_name}', below "
                f"the recommended {workload_name} adequacy threshold of {min_adeq:.0f}."
            )
        else:
            reason = (
                f"{ev.component_name} ({score_val:.1f}) is the primary limiting factor holding "
                f"back {strongest_sub} ({strongest_score:.1f}) in {workload_name}."
            )

        raw_Upgrade_candidates.append(
            (
                impact_score,
                UpgradeRecommendationOutput(
                    priority_order=0,
                    component_type=rule.subsystem,
                    affected_metric_key=rule.metric_key,
                    reason=reason,
                    target_score_min=target_min,
                    target_score_max=target_max,
                ),
            )
        )

    raw_Upgrade_candidates.sort(key=lambda item: item[0], reverse=True)
    recommendations: list[UpgradeRecommendationOutput] = [
        UpgradeRecommendationOutput(
            priority_order=idx + 1,
            component_type=rec.component_type,
            affected_metric_key=rec.affected_metric_key,
            reason=rec.reason,
            target_score_min=rec.target_score_min,
            target_score_max=rec.target_score_max,
        )
        for idx, (_, rec) in enumerate(raw_Upgrade_candidates)
    ]

    return WorkloadAnalysisOutput(
        performance_score_0_100=performance_score,
        performance_tier=performance_tier,
        balance_score_0_100=balance_score,
        balance_status=balance_status,
        confidence_score_0_100=confidence_score,
        confidence_level=confidence_level,
        coverage_ratio=coverage_ratio,
        contributions=contributions,
        bottlenecks=bottlenecks,
        recommendations=recommendations,
        warnings=warnings,
    )
