from datetime import date, datetime, time
from pydantic import BaseModel, ConfigDict, Field


class DailyLogUpsert(BaseModel):
    model_config = ConfigDict(extra="allow")

    date: date
    wakeTime: str | None = None  # Time string (HH:mm)
    stress: int | None = Field(default=None, ge=1, le=5)
    sleepQuality: int | None = Field(default=None, ge=1, le=5)

    # Before Bed Survey fields
    plannedSleepTime: str | None = None  # Time string (HH:mm)
    lastMeal: str | None = None  # "3+hours" | "2-3hours" | "1-2hours" | "<1hour" | "justAte"
    screensOff: str | None = None  # "2+hours" | "1-2hours" | "30-60min" | "<30min" | "stillUsing"
    caffeine: str | None = None  # "none" | "before12" | "12-2pm" | "2-6pm" | "after6pm"

    # After Wake Survey fields
    actualSleepTime: str | None = None  # Time string (HH:mm)
    snooze: str | None = None  # "noAlarm" | "no" | "1-2times" | "3+times"
    energy: int | None = Field(default=None, ge=1, le=5)  # 1 (None) - 5 (Very high)
    sleepiness: int | None = Field(default=None, ge=1, le=5)  # 1 (Extremely sleepy) - 5 (Very alert)


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


class CandidateInsightEvidence(BaseModel):
    insight_id: str
    type: str
    title: str
    behavior: str
    outcome: str
    direction: str
    magnitude: float
    summary: str
    fact_ids: list[str]
    score: float
    action_hint: str


class InsightStatsPayload(BaseModel):
    window_days: int
    logs_count: int
    date_start: str | None = None
    date_end: str | None = None
    completion_rate: float
    summary_fact_ids: list[str] = Field(default_factory=list)
    candidate_insights: list[CandidateInsightEvidence] = Field(default_factory=list)
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
    confidence: str
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
