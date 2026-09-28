import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas import (
    AnalysisResultResponse,
    BottleneckSchema,
    CompareBuildsRequest,
    CompareBuildsResponse,
    ComponentSummaryItem,
    MetricComparisonDeltaSchema,
    MetricContributionSchema,
    UpgradeRecommendationSchema,
    VersionMetadataSchema,
)
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
from app.domains.catalog.service import (
    get_Active_dataset_version_string,
    serialize_component_summary,
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


def build_analysis_response_from_row(
    db: Session, analysis_row: AnalysisResult
) -> AnalysisResultResponse:
    pc_build = db.get(PCBuild, analysis_row.pc_build_id)
    profile = db.get(WorkloadProfile, analysis_row.workload_profile_id)
    norm_ver = db.get(NormalizationVersion, analysis_row.normalization_version_id)
    score_ver = db.get(ScoringVersion, analysis_row.scoring_version_id)

    if pc_build is None or profile is None or norm_ver is None or score_ver is None:
        raise ValueError("Corrupted analysis metadata relationships.")

    selected_map: dict[str, ComponentSummaryItem] = {}
    for part in pc_build.components:
        selected_map[part.slot_type] = serialize_component_summary(part.component)

    contributions_out: list[MetricContributionSchema] = []
    covered_w = 0.0
    total_w = 0.0
    for c in analysis_row.contributions:
        m_def = db.get(BenchmarkMetricDefinition, c.metric_definition_id)
        m_key = m_def.metric_key if m_def else "unknown"
        m_name = m_def.display_name if m_def else "Unknown Metric"
        m_sub = m_def.subsystem if m_def else "UNKNOWN"
        total_w += c.weight_applied
        if not c.is_missing_metric:
            covered_w += c.weight_applied
        contributions_out.append(
            MetricContributionSchema(
                metric_key=m_key,
                display_name=m_name,
                subsystem=m_sub,
                component_id=c.component_id,
                normalized_score_0_100=c.normalized_score_0_100,
                weight_applied=c.weight_applied,
                weighted_contribution=c.weighted_contribution,
                is_missing_metric=c.is_missing_metric,
            )
        )

    coverage_ratio = round(covered_w / total_w, 4) if total_w > 0 else 0.0

    bottlenecks_out = [
        BottleneckSchema(
            limiting_component_type=b.limiting_component_type,
            strongest_component_type=b.strongest_component_type,
            spread_points=b.spread_points,
            severity_status=b.severity_status,
            explanation=b.explanation,
        )
        for b in analysis_row.bottlenecks
    ]

    recs_out = [
        UpgradeRecommendationSchema(
            priority_order=r.priority_order,
            component_type=r.component_type,
            affected_metric_key=r.affected_metric_key,
            reason=r.reason,
            target_score_min=r.target_score_min,
            target_score_max=r.target_score_max,
        )
        for r in sorted(analysis_row.recommendations, key=lambda x: x.priority_order)
    ]

    return AnalysisResultResponse(
        analysis_id=analysis_row.id,
        share_uuid=analysis_row.share_uuid,
        build_name=pc_build.name,
        workload_slug=profile.slug,
        workload_name=profile.name,
        selected_components=selected_map,
        performance_score_0_100=analysis_row.performance_score_0_100,
        performance_tier=analysis_row.performance_tier,
        balance_score_0_100=analysis_row.balance_score_0_100,
        balance_status=analysis_row.balance_status,
        confidence_score_0_100=analysis_row.confidence_score_0_100,
        confidence_level=analysis_row.confidence_level,
        coverage_ratio=coverage_ratio,
        contributions=contributions_out,
        bottlenecks=bottlenecks_out,
        recommendations=recs_out,
        warnings=list(analysis_row.warnings_json or []),
        version_metadata=VersionMetadataSchema(
            dataset_version=analysis_row.dataset_version,
            normalization_version=norm_ver.version_code,
            scoring_version=score_ver.version_code,
            workload_profile_version=profile.version,
        ),
        analyzed_at=analysis_row.analyzed_at,
    )


def get_persisted_analysis_by_identifier(
    db: Session, identifier: str
) -> AnalysisResultResponse | None:
    row: AnalysisResult | None = None
    if identifier.isdigit():
        row = db.get(AnalysisResult, int(identifier))
    if row is None:
        row = db.scalar(select(AnalysisResult).where(AnalysisResult.share_uuid == identifier))
    if row is None:
        return None
    return build_analysis_response_from_row(db, row)


def compare_two_builds_for_workload(
    db: Session, req: CompareBuildsRequest
) -> CompareBuildsResponse:
    target_ds = req.dataset_version or get_Active_dataset_version_string(db)

    row_a, _ = run_and_persist_build_analysis(
        db,
        workload_slug=req.workload_slug,
        component_ids_by_slot=req.build_a_components.to_slot_dict(),
        dataset_version=target_ds,
        build_name=req.build_a_name,
    )
    row_b, _ = run_and_persist_build_analysis(
        db,
        workload_slug=req.workload_slug,
        component_ids_by_slot=req.build_b_components.to_slot_dict(),
        dataset_version=target_ds,
        build_name=req.build_b_name,
    )

    resp_a = build_analysis_response_from_row(db, row_a)
    resp_b = build_analysis_response_from_row(db, row_b)

    contrib_b_map = {c.metric_key: c for c in resp_b.contributions}
    metric_deltas: list[MetricComparisonDeltaSchema] = []
    where_a_stronger: list[str] = []
    where_b_stronger: list[str] = []

    for ca in resp_a.contributions:
        cb = contrib_b_map.get(ca.metric_key)
        score_a = ca.normalized_score_0_100
        score_b = cb.normalized_score_0_100 if cb else None

        if score_a is not None and score_b is not None:
            delta = round(score_a - score_b, 2)
            if delta > 1.0:
                summary = f"{req.build_a_name} leads on {ca.display_name} (+{delta:.1f} pts)"
                where_a_stronger.append(summary)
            elif delta < -1.0:
                summary = f"{req.build_b_name} leads on {ca.display_name} (+{abs(delta):.1f} pts)"
                where_b_stronger.append(summary)
            else:
                summary = f"Both builds perform similarly on {ca.display_name}"
        else:
            delta = None
            summary = f"Insufficient evidence to compare {ca.display_name}"

        metric_deltas.append(
            MetricComparisonDeltaSchema(
                metric_key=ca.metric_key,
                display_name=ca.display_name,
                subsystem=ca.subsystem,
                weight=ca.weight_applied,
                build_a_score=score_a,
                build_b_score=score_b,
                delta_a_minus_b=delta,
                advantage_summary=summary,
            )
        )

    perf_delta = round(resp_a.performance_score_0_100 - resp_b.performance_score_0_100, 2)
    bal_delta = round(resp_a.balance_score_0_100 - resp_b.balance_score_0_100, 2)

    if perf_delta > 1.0:
        context_msg = (
            f"For {resp_a.workload_name}, {req.build_a_name} achieves a higher workload score "
            f"({resp_a.performance_score_0_100:.1f} vs {resp_b.performance_score_0_100:.1f})."
        )
    elif perf_delta < -1.0:
        context_msg = (
            f"For {resp_a.workload_name}, {req.build_b_name} achieves a higher workload score "
            f"({resp_b.performance_score_0_100:.1f} vs {resp_a.performance_score_0_100:.1f})."
        )
    else:
        context_msg = (
            f"For {resp_a.workload_name}, both configurations deliver comparable overall "
            f"workload performance ({resp_a.performance_score_0_100:.1f} vs "
            f"{resp_b.performance_score_0_100:.1f})."
        )

    return CompareBuildsResponse(
        workload_slug=resp_a.workload_slug,
        workload_name=resp_a.workload_name,
        dataset_version=target_ds,
        is_directly_comparable=True,
        build_a=resp_a,
        build_b=resp_b,
        performance_score_delta=perf_delta,
        balance_score_delta=bal_delta,
        metric_deltas=metric_deltas,
        where_a_is_stronger=where_a_stronger,
        where_b_is_stronger=where_b_stronger,
        contextual_summary=context_msg,
    )
