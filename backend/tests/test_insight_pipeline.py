import pytest

from models.logs import LLMInsightResponse
from routers import logs as logs_router
from services.insight_llm import build_deterministic_fallback, validate_llm_response
from services.insight_stats import build_insight_stats_payload


def _sample_logs() -> list[dict]:
    logs: list[dict] = []
    for i in range(10):
        is_good = i % 2 == 0
        logs.append(
            {
                "date": f"2026-02-{20 - i:02d}",
                "responses": {
                    "sleepQuality": {"value": 4 if is_good else 2, "value_numeric": 4 if is_good else 2},
                    "energy": {"value": 4 if is_good else 2, "value_numeric": 4 if is_good else 2},
                    "screensOff": {"value": "2+hours" if is_good else "stillUsing", "value_numeric": 5 if is_good else 1},
                    "caffeine": {"value": "before12" if is_good else "after6pm", "value_numeric": 4 if is_good else 1},
                    "lastMeal": {"value": "3+hours" if is_good else "justAte", "value_numeric": 5 if is_good else 1},
                    "stress": {"value": 2 if is_good else 4, "value_numeric": 2 if is_good else 4},
                    "snooze": {"value": "no" if is_good else "3+times", "value_numeric": 3 if is_good else 1},
                    "actualSleepTime": {"value": "23:00", "value_numeric": None},
                    "wakeTime": {"value": "07:00", "value_numeric": None},
                },
            }
        )
    return logs


def test_build_stats_payload_contains_fact_registry_and_candidates():
    stats = build_insight_stats_payload(_sample_logs(), window_days=14)
    assert stats.logs_count == 10
    assert f"fact_completion_rate_{stats.window_days}d" in stats.fact_registry
    assert stats.candidate_insights
    assert all(candidate.fact_ids for candidate in stats.candidate_insights)


def test_validation_rejects_uncited_numeric_claim():
    stats = build_insight_stats_payload(_sample_logs(), window_days=14)
    response = LLMInsightResponse.model_validate(
        {
            "insights": [
                {
                    "type": "pattern",
                    "message_with_citations": "Your sleep improved by 1.2 points.",
                    "action": "Keep it up.",
                    "fact_ids_used": [],
                }
            ]
        }
    )
    validation = validate_llm_response(response, stats)
    assert not validation.valid
    assert any("uncited numeric sentence" in err for err in validation.errors)


def test_deterministic_fallback_includes_citations():
    stats = build_insight_stats_payload(_sample_logs(), window_days=14)
    fallback = build_deterministic_fallback(stats, max_insights=3)
    assert fallback
    assert all(insight.citations for insight in fallback)
    assert any("[[cite:" in insight.message for insight in fallback)


@pytest.mark.asyncio
async def test_insights_retries_and_succeeds_after_invalid_first_attempt(monkeypatch):
    sample_logs = _sample_logs()

    async def fake_history(days: int, user_id: str):  # noqa: ARG001
        return {"logs": sample_logs}

    class FakeClient:
        call_count = 0

        def __init__(self, **kwargs):  # noqa: ANN003
            pass

        async def generate(self, stats, max_insights=4):  # noqa: ANN001
            FakeClient.call_count += 1
            if FakeClient.call_count == 1:
                return LLMInsightResponse.model_validate(
                    {
                        "insights": [
                            {
                                "type": "pattern",
                                "message_with_citations": "Energy is up by 1.2 points.",
                                "action": "Keep going.",
                                "fact_ids_used": [],
                            }
                        ]
                    }
                )
            top = stats.candidate_insights[0]
            delta_fact = next(fid for fid in top.fact_ids if fid.endswith("_delta"))
            return LLMInsightResponse.model_validate(
                {
                    "insights": [
                        {
                            "type": top.type,
                            "message_with_citations": f"A meaningful pattern appeared [[cite:{delta_fact}]].",
                            "action": top.action_hint,
                            "fact_ids_used": [delta_fact],
                        }
                    ]
                }
            )

    monkeypatch.setattr(logs_router, "history", fake_history)
    monkeypatch.setattr(logs_router, "LLMInsightsClient", FakeClient)
    monkeypatch.setattr(logs_router.settings, "llm_insights_enabled", True)
    monkeypatch.setattr(logs_router.settings, "llm_api_key", "test-key")
    monkeypatch.setattr(logs_router.settings, "insights_window_days", 14)

    insights = await logs_router.insights(user_id="user_1")
    assert FakeClient.call_count == 2
    assert insights
    assert insights[0].citations


@pytest.mark.asyncio
async def test_insights_falls_back_when_llm_errors(monkeypatch):
    sample_logs = _sample_logs()

    async def fake_history(days: int, user_id: str):  # noqa: ARG001
        return {"logs": sample_logs}

    class RaisingClient:
        def __init__(self, **kwargs):  # noqa: ANN003
            pass

        async def generate(self, stats, max_insights=4):  # noqa: ANN001
            raise RuntimeError("provider unavailable")

    monkeypatch.setattr(logs_router, "history", fake_history)
    monkeypatch.setattr(logs_router, "LLMInsightsClient", RaisingClient)
    monkeypatch.setattr(logs_router.settings, "llm_insights_enabled", True)
    monkeypatch.setattr(logs_router.settings, "llm_api_key", "test-key")
    monkeypatch.setattr(logs_router.settings, "insights_window_days", 14)

    insights = await logs_router.insights(user_id="user_1")
    assert insights
    assert any("[[cite:" in insight.message for insight in insights)
