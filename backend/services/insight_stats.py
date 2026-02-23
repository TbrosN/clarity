from __future__ import annotations

from datetime import date, datetime, time, timedelta

from models.logs import (
    CandidateInsightEvidence,
    FactDefinition,
    InsightStatsPayload,
)


def _get_numeric(responses: dict, key: str) -> float | None:
    entry = responses.get(key, {})
    val = entry.get("value_numeric")
    if isinstance(val, int | float):
        return float(val)
    val = entry.get("value")
    if isinstance(val, int | float):
        return float(val)
    return None


def _compute_sleep_hours(actual_sleep_value: object, wake_value: object) -> float | None:
    try:
        sleep_t = time.fromisoformat(str(actual_sleep_value))
        wake_t = time.fromisoformat(str(wake_value))
        sleep_dt = datetime.combine(date.today(), sleep_t)
        wake_dt = datetime.combine(date.today(), wake_t)
        if wake_dt <= sleep_dt:
            wake_dt += timedelta(days=1)
        hours = (wake_dt - sleep_dt).total_seconds() / 3600
        return hours if 1 <= hours <= 18 else None
    except (ValueError, TypeError):
        return None


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _add_fact(
    registry: dict[str, FactDefinition],
    *,
    fact_id: str,
    label: str,
    value: float | str,
    unit: str | None,
    window_days: int,
    method: str,
    provenance: str,
    source_metric_keys: list[str],
    sample_size: int | None = None,
    n_good: int | None = None,
    n_poor: int | None = None,
) -> str:
    registry[fact_id] = FactDefinition(
        fact_id=fact_id,
        label=label,
        value=value,
        unit=unit,
        window_days=window_days,
        sample_size=sample_size,
        n_good=n_good,
        n_poor=n_poor,
        method=method,
        provenance=provenance,
        source_metric_keys=source_metric_keys,
    )
    return fact_id


def build_insight_stats_payload(logs: list[dict], window_days: int = 14) -> InsightStatsPayload:
    if not logs:
        return InsightStatsPayload(window_days=window_days, logs_count=0, completion_rate=0.0)

    dates = [log["date"] for log in logs if log.get("date")]
    date_end = dates[0] if dates else None
    date_start = dates[-1] if dates else None
    provenance = f"responses in window {date_start}..{date_end}" if date_start and date_end else "responses in recent window"

    facts: dict[str, FactDefinition] = {}
    candidates: list[CandidateInsightEvidence] = []
    summary_fact_ids: list[str] = []

    completion_rate = round(len(logs) / float(window_days), 3) if window_days else 0.0
    completion_fact_id = _add_fact(
        facts,
        fact_id=f"fact_completion_rate_{window_days}d",
        label=f"Survey completion rate ({window_days}d)",
        value=round(completion_rate * 100, 1),
        unit="percent",
        window_days=window_days,
        sample_size=len(logs),
        method="observed_days / window_days",
        provenance=provenance,
        source_metric_keys=[],
    )
    summary_fact_ids.append(completion_fact_id)

    sleep_quality_values: list[float] = []
    energy_values: list[float] = []
    stress_values: list[float] = []
    sleep_durations: list[float] = []

    early_screen_sleep: list[float] = []
    late_screen_sleep: list[float] = []
    early_caffeine_sleep: list[float] = []
    late_caffeine_sleep: list[float] = []
    early_meal_sleep: list[float] = []
    late_meal_sleep: list[float] = []
    no_snooze_energy: list[float] = []
    snooze_energy: list[float] = []
    good_sleep_energy: list[float] = []
    poor_sleep_energy: list[float] = []
    long_sleep_energy: list[float] = []
    short_sleep_energy: list[float] = []

    for log in logs:
        responses = log.get("responses", {})
        sq = _get_numeric(responses, "sleepQuality")
        energy = _get_numeric(responses, "energy")
        stress = _get_numeric(responses, "stress")
        screens = _get_numeric(responses, "screensOff")
        caffeine = _get_numeric(responses, "caffeine")
        meal = _get_numeric(responses, "lastMeal")
        snooze = _get_numeric(responses, "snooze")

        if sq is not None:
            sleep_quality_values.append(sq)
        if energy is not None:
            energy_values.append(energy)
        if stress is not None:
            stress_values.append(stress)

        actual_sleep_val = responses.get("actualSleepTime", {}).get("value")
        wake_val = responses.get("wakeTime", {}).get("value")
        duration = _compute_sleep_hours(actual_sleep_val, wake_val)
        if duration is not None:
            sleep_durations.append(duration)

        if sq is not None and energy is not None:
            if sq >= 4:
                good_sleep_energy.append(energy)
            elif sq <= 2:
                poor_sleep_energy.append(energy)

        if screens is not None and sq is not None:
            if screens >= 4:
                early_screen_sleep.append(sq)
            elif screens <= 2:
                late_screen_sleep.append(sq)

        if caffeine is not None and sq is not None:
            if caffeine >= 4:
                early_caffeine_sleep.append(sq)
            elif caffeine <= 2:
                late_caffeine_sleep.append(sq)

        if meal is not None and sq is not None:
            if meal >= 4:
                early_meal_sleep.append(sq)
            elif meal <= 2:
                late_meal_sleep.append(sq)

        if snooze is not None and energy is not None:
            if snooze >= 3:
                no_snooze_energy.append(energy)
            elif snooze <= 2:
                snooze_energy.append(energy)

        if duration is not None and energy is not None:
            if duration >= 7:
                long_sleep_energy.append(energy)
            elif duration < 6:
                short_sleep_energy.append(energy)

    if sleep_quality_values:
        summary_fact_ids.append(
            _add_fact(
                facts,
                fact_id=f"fact_avg_sleep_quality_{window_days}d",
                label=f"Average sleep quality ({window_days}d)",
                value=round(_avg(sleep_quality_values), 2),
                unit="out of 5",
                window_days=window_days,
                sample_size=len(sleep_quality_values),
                method="mean",
                provenance=provenance,
                source_metric_keys=["sleepQuality"],
            )
        )
    if energy_values:
        summary_fact_ids.append(
            _add_fact(
                facts,
                fact_id=f"fact_avg_energy_{window_days}d",
                label=f"Average morning energy ({window_days}d)",
                value=round(_avg(energy_values), 2),
                unit="out of 5",
                window_days=window_days,
                sample_size=len(energy_values),
                method="mean",
                provenance=provenance,
                source_metric_keys=["energy"],
            )
        )
    if sleep_durations:
        summary_fact_ids.append(
            _add_fact(
                facts,
                fact_id=f"fact_avg_sleep_duration_{window_days}d",
                label=f"Average sleep duration ({window_days}d)",
                value=round(_avg(sleep_durations), 2),
                unit="hours",
                window_days=window_days,
                sample_size=len(sleep_durations),
                method="mean",
                provenance=provenance,
                source_metric_keys=["actualSleepTime", "wakeTime"],
            )
        )
    if stress_values:
        high_stress_rate = round(sum(1 for s in stress_values if s >= 4) / len(stress_values) * 100, 1)
        summary_fact_ids.append(
            _add_fact(
                facts,
                fact_id=f"fact_high_stress_rate_{window_days}d",
                label=f"High stress evening rate ({window_days}d)",
                value=high_stress_rate,
                unit="percent",
                window_days=window_days,
                sample_size=len(stress_values),
                method="ratio",
                provenance=provenance,
                source_metric_keys=["stress"],
            )
        )

    def add_comparison_candidate(
        *,
        insight_id: str,
        type_: str,
        title: str,
        behavior: str,
        outcome: str,
        good_values: list[float],
        poor_values: list[float],
        source_metric_keys: list[str],
        action_hint: str,
    ) -> None:
        min_samples_per_bucket = 1 if window_days <= 7 else 2
        if len(good_values) < min_samples_per_bucket or len(poor_values) < min_samples_per_bucket:
            return
        mean_good = round(_avg(good_values), 2)
        mean_poor = round(_avg(poor_values), 2)
        delta = round(mean_good - mean_poor, 2)
        if abs(delta) < 0.3:
            return

        prefix = f"fact_{insight_id}_{window_days}d"
        fact_good = _add_fact(
            facts,
            fact_id=f"{prefix}_mean_good",
            label=f"{title}: average {outcome} when {behavior} is favorable",
            value=mean_good,
            unit="out of 5",
            window_days=window_days,
            sample_size=len(good_values),
            method="mean",
            provenance=provenance,
            source_metric_keys=source_metric_keys,
        )
        fact_poor = _add_fact(
            facts,
            fact_id=f"{prefix}_mean_poor",
            label=f"{title}: average {outcome} when {behavior} is unfavorable",
            value=mean_poor,
            unit="out of 5",
            window_days=window_days,
            sample_size=len(poor_values),
            method="mean",
            provenance=provenance,
            source_metric_keys=source_metric_keys,
        )
        fact_delta = _add_fact(
            facts,
            fact_id=f"{prefix}_delta",
            label=f"{title}: difference in {outcome} between favorable and unfavorable behavior",
            value=delta,
            unit="points",
            window_days=window_days,
            n_good=len(good_values),
            n_poor=len(poor_values),
            method="mean_difference",
            provenance=provenance,
            source_metric_keys=source_metric_keys,
        )
        sample_weight = min(len(good_values), len(poor_values)) / 5.0
        score = round(abs(delta) * min(sample_weight, 1.0), 3)
        direction = "better" if delta > 0 else "worse"
        candidates.append(
            CandidateInsightEvidence(
                insight_id=insight_id,
                type=type_,
                title=title,
                behavior=behavior,
                outcome=outcome,
                direction=direction,
                magnitude=abs(delta),
                summary=f"{title}: {mean_good:.2f} vs {mean_poor:.2f} ({delta:+.2f}) over {window_days} days",
                fact_ids=[fact_good, fact_poor, fact_delta],
                score=score,
                action_hint=action_hint,
            )
        )

    add_comparison_candidate(
        insight_id="screens_sleep",
        type_="pattern",
        title="Screen timing and sleep quality",
        behavior="screensOff",
        outcome="sleepQuality",
        good_values=early_screen_sleep,
        poor_values=late_screen_sleep,
        source_metric_keys=["screensOff", "sleepQuality"],
        action_hint="Consider one earlier screen-off night to test tomorrow's sleep quality.",
    )
    add_comparison_candidate(
        insight_id="caffeine_sleep",
        type_="pattern",
        title="Caffeine timing and sleep quality",
        behavior="caffeine",
        outcome="sleepQuality",
        good_values=early_caffeine_sleep,
        poor_values=late_caffeine_sleep,
        source_metric_keys=["caffeine", "sleepQuality"],
        action_hint="Try moving caffeine earlier and notice the next morning.",
    )
    add_comparison_candidate(
        insight_id="meal_sleep",
        type_="pattern",
        title="Meal timing and sleep quality",
        behavior="lastMeal",
        outcome="sleepQuality",
        good_values=early_meal_sleep,
        poor_values=late_meal_sleep,
        source_metric_keys=["lastMeal", "sleepQuality"],
        action_hint="Test finishing dinner earlier on a couple of nights this week.",
    )
    add_comparison_candidate(
        insight_id="sleep_quality_energy",
        type_="pattern",
        title="Sleep quality and morning energy",
        behavior="sleepQuality",
        outcome="energy",
        good_values=good_sleep_energy,
        poor_values=poor_sleep_energy,
        source_metric_keys=["sleepQuality", "energy"],
        action_hint="Pick one bedtime routine step that helps your sleep quality tonight.",
    )
    add_comparison_candidate(
        insight_id="snooze_energy",
        type_="pattern",
        title="Snooze behavior and morning energy",
        behavior="snooze",
        outcome="energy",
        good_values=no_snooze_energy,
        poor_values=snooze_energy,
        source_metric_keys=["snooze", "energy"],
        action_hint="Try one no-snooze morning this week and compare how you feel.",
    )
    add_comparison_candidate(
        insight_id="duration_energy",
        type_="pattern",
        title="Sleep duration and morning energy",
        behavior="sleepDuration",
        outcome="energy",
        good_values=long_sleep_energy,
        poor_values=short_sleep_energy,
        source_metric_keys=["actualSleepTime", "wakeTime", "energy"],
        action_hint="Aim for a slightly longer sleep window on your next two nights.",
    )

    candidates.sort(key=lambda c: c.score, reverse=True)
    return InsightStatsPayload(
        window_days=window_days,
        logs_count=len(logs),
        date_start=date_start,
        date_end=date_end,
        completion_rate=completion_rate,
        summary_fact_ids=summary_fact_ids,
        candidate_insights=candidates[:8],
        fact_registry=facts,
    )
