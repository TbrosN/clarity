from __future__ import annotations

from models.logs import FactDefinition, InsightStatsPayload


def _raw_response_value(entry: dict) -> float | str | None:
    if "value" in entry and entry.get("value") is not None:
        value = entry.get("value")
        if isinstance(value, int | float | str):
            return value

    if "value_numeric" in entry and entry.get("value_numeric") is not None:
        value = entry.get("value_numeric")
        if isinstance(value, int | float):
            return float(value)

    if "value_text" in entry and entry.get("value_text") is not None:
        value = entry.get("value_text")
        if isinstance(value, str):
            return value

    return None


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
) -> str:
    registry[fact_id] = FactDefinition(
        fact_id=fact_id,
        label=label,
        value=value,
        unit=unit,
        window_days=window_days,
        sample_size=sample_size,
        method=method,
        provenance=provenance,
        source_metric_keys=source_metric_keys,
    )
    return fact_id


def build_recent_survey_payload(logs: list[dict], window_days: int = 14, max_surveys: int = 10) -> InsightStatsPayload:
    if not logs:
        return InsightStatsPayload(window_days=window_days, logs_count=0, completion_rate=0.0)

    recent_logs = logs[:max_surveys]
    dates = [log["date"] for log in recent_logs if log.get("date")]
    date_end = dates[0] if dates else None
    date_start = dates[-1] if dates else None
    facts: dict[str, FactDefinition] = {}
    summary_fact_ids: list[str] = []

    for idx, log in enumerate(recent_logs, start=1):
        survey_date = str(log.get("date")) if log.get("date") else "unknown_date"
        responses = log.get("responses", {})
        if not isinstance(responses, dict):
            continue
        for field, response_entry in responses.items():
            if not isinstance(response_entry, dict):
                continue
            raw_value = _raw_response_value(response_entry)
            if raw_value is None:
                continue
            fact_id = f"fact_survey_{idx}_{field}"
            summary_fact_ids.append(
                _add_fact(
                    facts,
                    fact_id=fact_id,
                    label=f"Survey {idx} ({survey_date}) response for {field}",
                    value=raw_value,
                    unit=None,
                    window_days=window_days,
                    sample_size=1,
                    method="raw_response",
                    provenance=f"survey_index={idx};survey_date={survey_date}",
                    source_metric_keys=[field],
                )
            )

    return InsightStatsPayload(
        window_days=window_days,
        logs_count=len(logs),
        date_start=date_start,
        date_end=date_end,
        summary_fact_ids=summary_fact_ids,
        fact_registry=facts,
    )
