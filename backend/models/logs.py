from datetime import date, datetime, time
from pydantic import BaseModel, ConfigDict, Field


class DailyLogUpsert(BaseModel):
    model_config = ConfigDict(extra="allow")

    date: date
    # Before Bed survey fields
    sleepTime: str | None = None  # "1hr" | "30mins" | "<30mins"
    lastMeal: str | None = None  # "4" | "3" | "2" | "1"
    screensOff: str | None = None  # "60" | "30-60" | "<30mins"
    caffeine: str | None = None  # "before12" | "12-2pm" | "2-6pm" | "after6pm"

    # After Wake survey fields
    sleepiness: int | None = Field(default=None, ge=1, le=5)  # 1 (Extremely sleepy) - 5 (Very alert)
    morningLight: str | None = None  # "0-30mins" | "30-60mins" | "none"


class ResponseValueUpdate(BaseModel):
    value_numeric: float | None = None
    value_bool: bool | None = None
    value_text: str | None = None
    value_time: time | None = None
    value_timestamp: datetime | None = None


class Insight(BaseModel):
    type: str
    message: str
    confidence: str | None = None
    impact: str | None = None
    action: str | None = None
    citations: list["InsightCitation"] | None = None
    source_metric_keys: list[str] | None = None


class InsightCitation(BaseModel):
    fact_id: str
    label: str
    value: float | str
    unit: str | None = None
    window_days: int
    sample_size: int | None = None
    n_good: int | None = None
    n_poor: int | None = None
    method: str
    provenance: str
    source_metric_keys: list[str] = Field(default_factory=list)


class FactDefinition(BaseModel):
    fact_id: str
    label: str
    value: float | str
    unit: str | None = None
    window_days: int
    sample_size: int | None = None
    n_good: int | None = None
    n_poor: int | None = None
    method: str
    provenance: str
    source_metric_keys: list[str] = Field(default_factory=list)


class InsightStatsPayload(BaseModel):
    window_days: int
    logs_count: int
    date_start: str | None = None
    date_end: str | None = None
    summary_fact_ids: list[str] = Field(default_factory=list)
    fact_registry: dict[str, FactDefinition] = Field(default_factory=dict)


class LLMInsightDraft(BaseModel):
    type: str
    message_with_citations: str
    action: str | None = None
    fact_ids_used: list[str]


class LLMInsightResponse(BaseModel):
    insights: list[LLMInsightDraft]


class EnergyEfficiency(BaseModel):
    percentage: int
    color: str


class BaselineMetric(BaseModel):
    """Personal baseline for a specific metric"""
    metric: str
    baseline: float
    current_value: float | None = None
    deviation: float | None = None
    deviation_percentage: float | None = None
    unit: str
    interpretation: str | None = None


class BehaviorImpact(BaseModel):
    """Shows how a specific behavior impacts outcomes for this user"""
    behavior: str
    behavior_label: str
    outcome: str
    outcome_label: str
    when_good: float  # Average outcome when behavior is good
    when_poor: float  # Average outcome when behavior is poor
    your_impact: float  # Difference (when_good - when_poor)
    sample_size_good: int
    sample_size_poor: int
    confidence: str | None = None
    recommendation: str | None = None


class PersonalBaselinesResponse(BaseModel):
    """Complete personal baselines and deviations report"""
    baselines: list[BaselineMetric]
    behavior_impacts: list[BehaviorImpact]
    tracking_days: int
    last_updated: datetime


class InsightsDebug(BaseModel):
    """Debug information for insights generation"""
    logs_count: int
    message: str
