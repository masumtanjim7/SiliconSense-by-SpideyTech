import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    AnalysisMetricContribution,
    AnalysisResult,
    BenchmarkMetricDefinition,
    BottleneckResult,
    HardwareComponent,
    NormalizationVersion,
    NormalizedMetric,
    PCBuild,
    PCBuildComponent,
    ScoringVersion,
    UpgradeRecommendation,
    WorkloadProfile,
)
from app.domains.scoring.engine import (
    ComponentMetricEvidenceInput,
    WorkloadAnalysisOutput,
    WorkloadMetricRuleInput,
    evaluate_build_for_workload,
)


def run_and_persist_build_analysis(
    db: Session,
    *,
    workload_slug: str,
    component_ids_by_slot: dict[str, int],
    dataset_version: str,
    build_name: str = "Custom Rig",
    normalization_version_code: str = "norm-v1.0",
    scoring_version_code: str = "score-v1.0",
    user_id: int | None = None,
) -> tuple[AnalysisResult, WorkloadAnalysisOutput]:
    profile = db.scalar(
        select(WorkloadProfile).where(
            WorkloadProfile.slug == workload_slug,
            WorkloadProfile.is_active.is_(True),
        )
    )
    if profile is None:
        raise ValueError(f"Active WorkloadProfile '{workload_slug}' not found.")

    norm_ver = db.scalar(
        select(NormalizationVersion).where(
            NormalizationVersion.version_code == normalization_version_code,
            NormalizationVersion.is_active.is_(True),
        )
    )
    if norm_ver is None:
        raise ValueError(f"Active NormalizationVersion '{normalization_version_code}' not found.")

    score_ver = db.scalar(
        select(ScoringVersion).where(
            ScoringVersion.version_code == scoring_version_code,
            ScoringVersion.is_active.is_(True),
        )
    )
    if score_ver is None:
        raise ValueError(f"Active ScoringVersion '{scoring_version_code}' not found.")

    selected_components: dict[str, HardwareComponent] = {}
    for slot_type, comp_id in component_ids_by_slot.items():
        comp = db.get(HardwareComponent, comp_id)
        if comp is None:
            raise ValueError(f"HardwareComponent id={comp_id} for slot '{slot_type}' not found.")
        if comp.component_type != slot_type:
            raise ValueError(
                f"Component '{comp.model_name}' has type '{comp.component_type}', "
                f"cannot be placed in '{slot_type}' slot."
            )
        selected_components[slot_type] = comp

    rules: list[WorkloadMetricRuleInput] = []
    metric_def_by_key: dict[str, BenchmarkMetricDefinition] = {}
    for w_row in profile.weights:
        m_def = w_row.metric_definition
        metric_def_by_key[m_def.metric_key] = m_def
        rules.append(
            WorkloadMetricRuleInput(
                metric_key=m_def.metric_key,
                display_name=m_def.display_name,
                subsystem=m_def.subsystem,
                weight=w_row.weight,
                minimum_adequacy_score=w_row.minimum_adequacy_score,
            )
        )

    evidence: dict[str, ComponentMetricEvidenceInput] = {}
    for rule in rules:
        comp_for_subsys = selected_components.get(rule.subsystem)
        if comp_for_subsys is None:
            continue
        m_def = metric_def_by_key[rule.metric_key]
        norm_metric = db.scalar(
            select(NormalizedMetric).where(
                NormalizedMetric.component_id == comp_for_subsys.id,
                NormalizedMetric.metric_definition_id == m_def.id,
                NormalizedMetric.normalization_version_id == norm_ver.id,
                NormalizedMetric.dataset_version == dataset_version,
            )
        )
        if norm_metric is not None:
            evidence[rule.metric_key] = ComponentMetricEvidenceInput(
                component_id=comp_for_subsys.id,
                component_name=f"{comp_for_subsys.brand} {comp_for_subsys.model_name}",
                subsystem=rule.subsystem,
                metric_key=rule.metric_key,
                normalized_score_0_100=norm_metric.normalized_score_0_100,
                percentile=norm_metric.percentile,
                confidence_contribution=norm_metric.confidence_contribution,
            )

    domain_output = evaluate_build_for_workload(
        workload_name=profile.name,
        rules=rules,
        evidence=evidence,
    )

    pc_build = PCBuild(
        user_id=user_id,
        name=build_name,
        workload_profile_id=profile.id,
        is_saved=user_id is not None,
    )
    db.add(pc_build)
    db.flush()

    for idx, (slot_type, comp) in enumerate(selected_components.items()):
        db.add(
            PCBuildComponent(
                pc_build_id=pc_build.id,
                component_id=comp.id,
                slot_type=slot_type,
                quantity=1,
                display_order=idx,
            )
        )

    analysis_row = AnalysisResult(
        share_uuid=str(uuid.uuid4()),
        pc_build_id=pc_build.id,
        workload_profile_id=profile.id,
        scoring_version_id=score_ver.id,
        normalization_version_id=norm_ver.id,
        dataset_version=dataset_version,
        performance_score_0_100=domain_output.performance_score_0_100,
        performance_tier=domain_output.performance_tier,
        balance_score_0_100=domain_output.balance_score_0_100,
        balance_status=domain_output.balance_status,
        confidence_score_0_100=domain_output.confidence_score_0_100,
        confidence_level=domain_output.confidence_level,
        warnings_json=domain_output.warnings,
    )
    db.add(analysis_row)
    db.flush()

    for c_item in domain_output.contributions:
        m_def = metric_def_by_key[c_item.metric_key]
        db.add(
            AnalysisMetricContribution(
                analysis_result_id=analysis_row.id,
                component_id=c_item.component_id,
                metric_definition_id=m_def.id,
                normalized_score_0_100=c_item.normalized_score_0_100,
                weight_applied=c_item.weight_applied,
                weighted_contribution=c_item.weighted_contribution,
                is_missing_metric=c_item.is_missing_metric,
            )
        )

    for b_item in domain_output.bottlenecks:
        db.add(
            BottleneckResult(
                analysis_result_id=analysis_row.id,
                limiting_component_type=b_item.limiting_component_type,
                strongest_component_type=b_item.strongest_component_type,
                spread_points=b_item.spread_points,
                severity_status=b_item.severity_status,
                explanation=b_item.explanation,
            )
        )

    for r_item in domain_output.recommendations:
        db.add(
            UpgradeRecommendation(
                analysis_result_id=analysis_row.id,
                priority_order=r_item.priority_order,
                component_type=r_item.component_type,
                affected_metric_key=r_item.affected_metric_key,
                reason=r_item.reason,
                target_score_min=r_item.target_score_min,
                target_score_max=r_item.target_score_max,
            )
        )

    db.commit()
    db.refresh(analysis_row)
    return analysis_row, domain_output
