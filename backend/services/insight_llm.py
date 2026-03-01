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
    LLMInsightResponse,
)

CITATION_PATTERN = re.compile(r"\[\[cite:([a-zA-Z0-9_.-]+)\]\]")
NUMBER_PATTERN = re.compile(r"(?<![A-Za-z])[-+]?\d+(?:\.\d+)?%?")


@dataclass
class ValidationResult:
    valid: bool
    errors: list[str]


def build_prompt_payload(stats: InsightStatsPayload, max_insights: int = 4) -> dict:
    fact_registry = {
        fact_id: fact.model_dump(mode="json")
        for fact_id, fact in stats.fact_registry.items()
    }
    recent_survey_fact_ids = [
        fact_id for fact_id in stats.summary_fact_ids if fact_id.startswith("fact_survey_")
    ]
    return {
        "user_context": {
            "tracking_days_considered": stats.window_days,
            "logs_count": stats.logs_count,
            "date_start": stats.date_start,
            "date_end": stats.date_end,
        },
        "recent_survey_fact_ids": recent_survey_fact_ids,
        "fact_registry": fact_registry,
        "task": (
            "Generate actionable, convincing reminders grounded in the recent raw survey responses. "
            "Highlight where the user can improve and the likely impact, and also reinforce where the user is already doing well and seeing benefits."
        ),
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
                "Use the raw response values as-is; do not assume hidden normalization.",
                "Focus on impact-oriented reminders, not just neutral summaries.",
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
        "You are an empathetic sleep and alertness reminder assistant. "
        "Write impact-oriented reminders that are actionable and persuasive while staying supportive. "
        "Always connect behaviors to likely user outcomes (sleepiness/alertness and next-day functioning). "
        "Use both kinds of reminders: (1) improvement opportunities and (2) reinforcement of what is already working. "
        "Apply Dale Carnegie style principles: never criticize, highlight user agency, frame suggestions in terms of the user's goals, and be encouraging. "
        "Each insight should focus on ONE specific behavior and its impact."
        "Keep your insights concise and to the point."
        "You MUST output valid JSON only, with no markdown. "
        "Every number or quantitative claim must include a citation `[[cite:fact_id]]`. "
        "Use only fact_ids from the provided registry.\n\n"
        "Survey question definitions for interpreting raw values:\n"
        "- sleepTime: 'When did you start your wind-down before bed?' Options: '1hr' (1 hour+ before bed), '30mins' (30-60 mins), '<30mins' (<30 mins).\n"
        "- lastMeal: 'When was your last meal?' Options: '4' (4+ hours before bed), '3' (3-4 hours), '2' (2-3 hours), '1' (<1 hour).\n"
        "- screensOff: 'When did you turn off screens?' Options: '60' (1+ hours before bed), '30-60' (30-60 mins), '<30mins' (<30 mins).\n"
        "- caffeine: 'When did you last have caffeine?' Options: 'before12' (none or before 12 PM), '12-2pm', '2-6pm', 'after6pm'.\n"
        "- sleepiness: 'How sleepy do you feel right now?' Likert 1-5 where 1 is extremely sleepy and 5 is very alert.\n"
        "- morningLight: 'When did you get sunlight this morning?' Options: '0-30mins' (<30 mins after waking), '30-60mins', 'none'.\n"
        "We want to encourage the user to follow these health guidlines:"
        "- Last meal 4+ hours before bed"
        "- Screens off and start winding down 1+ hours before bed"
        "- Caffeine ends before 12 PM"
        "- Get morning light within 30 minutes of waking"
        "This should translate into feeling less tired in the morning and having more energy throughout the day."
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
            try:
                response = await client.post(
                    f"{self.base_url}/model/{model_path}/converse",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json=request_body,
                )
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                status_code = exc.response.status_code
                response_body = exc.response.text.strip()
                body_preview = response_body[:1000] if response_body else "<empty body>"
                raise RuntimeError(
                    f"Bedrock converse request failed with status {status_code}: {body_preview}"
                ) from exc
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

