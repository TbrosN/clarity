from __future__ import annotations

import json
import re
from dataclasses import dataclass
from urllib.parse import quote

import httpx

from models.logs import (
    Insight,
    InsightCitation,
    InsightStatsPayload,
    LLMInsightDraft,
    LLMInsightResponse,
)

CITATION_PATTERN = re.compile(r"\[\[cite:([a-zA-Z0-9_.-]+)\]\]")
NUMBER_PATTERN = re.compile(r"(?<![A-Za-z])[-+]?\d+(?:\.\d+)?%?")
SHAMING_TERMS = ("lazy", "bad", "failure", "weak", "you should have", "your fault")
MEDICAL_TERMS = ("diagnosis", "disorder", "disease", "clinical", "depression")


@dataclass
class ValidationResult:
    valid: bool
    errors: list[str]


def _normalize_numeric_token(token: str) -> str:
    return token.strip().replace("%", "")


def _allowed_numeric_tokens(stats: InsightStatsPayload) -> set[str]:
    tokens: set[str] = {
        str(stats.window_days),
        str(stats.logs_count),
        str(int(round(stats.completion_rate * 100))),
    }
    for fact in stats.fact_registry.values():
        if isinstance(fact.value, int | float):
            rounded = round(float(fact.value), 2)
            tokens.add(str(int(rounded)) if float(rounded).is_integer() else str(rounded))
            tokens.add(f"{rounded:.1f}")
    return tokens


def build_prompt_payload(stats: InsightStatsPayload, max_insights: int = 4) -> dict:
    fact_registry = {
        fact_id: fact.model_dump(mode="json")
        for fact_id, fact in stats.fact_registry.items()
    }
    candidates = [candidate.model_dump(mode="json") for candidate in stats.candidate_insights]
    return {
        "user_context": {
            "tracking_days_considered": stats.window_days,
            "logs_count": stats.logs_count,
            "completion_rate": stats.completion_rate,
            "date_start": stats.date_start,
            "date_end": stats.date_end,
        },
        "summary_fact_ids": stats.summary_fact_ids,
        "candidate_insights": candidates,
        "fact_registry": fact_registry,
        "output_contract": {
            "max_insights": max_insights,
            "required_citation_syntax": "[[cite:fact_id]]",
            "citation_rule": "Every sentence with a number must include at least one [[cite:fact_id]].",
            "constraints": [
                "Use only fact_ids from fact_registry.",
                "Do not invent numbers or percentages.",
                "No criticism, blame, or shaming language.",
                "Avoid medical diagnosis claims.",
                "Use supportive phrasing aligned with user goals.",
            ],
            "json_schema": {
                "insights": [
                    {
                        "type": "pattern|tip",
                        "message_with_citations": "string",
                        "action": "string_or_null",
                        "fact_ids_used": ["fact_id_1", "fact_id_2"],
                    }
                ]
            },
        },
    }


def build_system_prompt() -> str:
    return (
        "You are an empathetic sleep and energy insights assistant. "
        "Apply Dale Carnegie style principles: never criticize, highlight user agency, "
        "frame suggestions in terms of the user's goals, and be encouraging. "
        "You MUST output valid JSON only, with no markdown. "
        "Every number or claim you make must include a citation `[[cite:fact_id]]`. "
        "Use only fact_ids from the provided registry."
    )


def _extract_json_object(content: str) -> dict:
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
    start = content.find("{")
    end = content.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("LLM response did not contain a JSON object")
    return json.loads(content[start : end + 1])


class LLMInsightsClient:
    def __init__(self, *, api_key: str, model: str, base_url: str, timeout_seconds: float = 15.0):
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    async def generate(self, stats: InsightStatsPayload, max_insights: int = 4) -> LLMInsightResponse:
        payload = build_prompt_payload(stats=stats, max_insights=max_insights)
        user_content = json.dumps(payload, ensure_ascii=True)
        request_body = {
            "system": [{"text": build_system_prompt()}],
            "messages": [
                {
                    "role": "user",
                    "content": [{"text": user_content}],
                }
            ],
            "inferenceConfig": {
                "temperature": 0.3,
                "maxTokens": 1200,
            },
        }
        model_path = quote(self.model, safe="")
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                f"{self.base_url}/model/{model_path}/converse",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=request_body,
            )
            response.raise_for_status()
            data = response.json()
        content_blocks = data.get("output", {}).get("message", {}).get("content", [])
        content = "".join(
            block.get("text", "")
            for block in content_blocks
            if isinstance(block, dict) and isinstance(block.get("text"), str)
        )
        if not content.strip():
            raise ValueError("Bedrock response did not contain text content")
        parsed = _extract_json_object(content)
        return LLMInsightResponse.model_validate(parsed)


def validate_llm_response(response: LLMInsightResponse, stats: InsightStatsPayload) -> ValidationResult:
    errors: list[str] = []
    allowed_fact_ids = set(stats.fact_registry.keys())
    allowed_numeric_tokens = _allowed_numeric_tokens(stats)

    for idx, insight in enumerate(response.insights):
        message = insight.message_with_citations
        cited_ids = set(CITATION_PATTERN.findall(message))

        if not cited_ids:
            errors.append(f"insights[{idx}] has no citations")

        unknown_ids = sorted(cited_ids - allowed_fact_ids)
        if unknown_ids:
            errors.append(f"insights[{idx}] uses unknown citations: {', '.join(unknown_ids)}")

        declared_ids = set(insight.fact_ids_used)
        if cited_ids - declared_ids:
            errors.append(f"insights[{idx}] cites fact ids not present in fact_ids_used")

        numbers = NUMBER_PATTERN.findall(message)
        if numbers and not cited_ids:
            errors.append(f"insights[{idx}] has numeric claims but no citations")

        # Require at least one citation token in every sentence containing a number.
        sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", message) if part.strip()]
        for sentence in sentences:
            if NUMBER_PATTERN.search(sentence) and not CITATION_PATTERN.search(sentence):
                errors.append(f"insights[{idx}] has uncited numeric sentence")
                continue

            if not NUMBER_PATTERN.search(sentence):
                continue

            sentence_tokens = [_normalize_numeric_token(token) for token in NUMBER_PATTERN.findall(sentence)]
            unknown_tokens = [
                token for token in sentence_tokens if token not in allowed_numeric_tokens
            ]
            if unknown_tokens:
                errors.append(
                    f"insights[{idx}] has numbers not grounded in allowed facts: {', '.join(unknown_tokens)}"
                )

        lowered = message.lower()
        if any(term in lowered for term in SHAMING_TERMS):
            errors.append(f"insights[{idx}] contains shaming language")
        if any(term in lowered for term in MEDICAL_TERMS):
            errors.append(f"insights[{idx}] contains medical diagnosis language")

    return ValidationResult(valid=not errors, errors=errors)


def map_to_api_insights(response: LLMInsightResponse, stats: InsightStatsPayload) -> list[Insight]:
    output: list[Insight] = []
    for draft in response.insights:
        citations: list[InsightCitation] = []
        for fact_id in draft.fact_ids_used:
            fact = stats.fact_registry.get(fact_id)
            if fact is None:
                continue
            citations.append(
                InsightCitation(
                    fact_id=fact.fact_id,
                    label=fact.label,
                    value=fact.value,
                    unit=fact.unit,
                    window_days=fact.window_days,
                    sample_size=fact.sample_size,
                    n_good=fact.n_good,
                    n_poor=fact.n_poor,
                    method=fact.method,
                    provenance=fact.provenance,
                    source_metric_keys=fact.source_metric_keys,
                )
            )

        output.append(
            Insight(
                type=draft.type,
                message=draft.message_with_citations,
                action=draft.action,
                citations=citations,
                source_metric_keys=sorted({key for c in citations for key in c.source_metric_keys}),
            )
        )
    return output


def build_deterministic_fallback(stats: InsightStatsPayload, max_insights: int = 4) -> list[Insight]:
    if not stats.candidate_insights:
        completion_fact_id = f"fact_completion_rate_{stats.window_days}d"
        completion_fact = stats.fact_registry.get(completion_fact_id)
        completion_citation = (
            InsightCitation(**completion_fact.model_dump(mode="json"))
            if completion_fact
            else InsightCitation(
                fact_id=completion_fact_id,
                label=f"Survey completion rate ({stats.window_days}d)",
                value=round(stats.completion_rate * 100, 1),
                unit="percent",
                window_days=stats.window_days,
                sample_size=stats.logs_count,
                method="observed_days / window_days",
                provenance=f"responses in recent window {stats.date_start}..{stats.date_end}",
                source_metric_keys=[],
            )
        )
        return [
            Insight(
                type="tip",
                message=(
                    "Keep completing your daily surveys to unlock personalized insights. "
                    f"Current completion in the last {stats.window_days} days is "
                    f"{round(stats.completion_rate * 100)}% [[cite:{completion_fact_id}]]."
                ),
                citations=[completion_citation],
            )
        ]

    insights: list[Insight] = []
    for candidate in stats.candidate_insights[:max_insights]:
        delta_fact_id = next((fid for fid in candidate.fact_ids if fid.endswith("_delta")), candidate.fact_ids[0])
        mean_good_id = next((fid for fid in candidate.fact_ids if fid.endswith("_mean_good")), candidate.fact_ids[0])
        mean_poor_id = next((fid for fid in candidate.fact_ids if fid.endswith("_mean_poor")), candidate.fact_ids[-1])
        fact_ids = [mean_good_id, mean_poor_id, delta_fact_id]

        message = (
            f"{candidate.title} shows a {candidate.direction} pattern over the last {stats.window_days} days: "
            f"{candidate.summary} [[cite:{delta_fact_id}]] "
            f"({{good}} vs {{poor}}) [[cite:{mean_good_id}]] [[cite:{mean_poor_id}]]."
        )
        good_val = stats.fact_registry[mean_good_id].value
        poor_val = stats.fact_registry[mean_poor_id].value
        message = message.replace("{good}", str(good_val)).replace("{poor}", str(poor_val))

        citations = [
            InsightCitation(**stats.fact_registry[fact_id].model_dump(mode="json"))
            for fact_id in fact_ids
            if fact_id in stats.fact_registry
        ]
        insights.append(
            Insight(
                type=candidate.type,
                message=message,
                action=candidate.action_hint,
                citations=citations,
                source_metric_keys=sorted({key for c in citations for key in c.source_metric_keys}),
            )
        )
    return insights

