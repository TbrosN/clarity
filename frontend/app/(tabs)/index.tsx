import InsightMessageWithCitations from "@/components/InsightMessageWithCitations";
import {
  fetchPersonalBaselines,
  getMetricIcon,
  getMetricLabel,
  PersonalBaselinesResponse,
} from "@/services/BaselineService";
import { generateInsights, Insight } from "@/services/InsightService";
import {
  DailyLog,
  getDailyLog,
  getRecentLogs,
} from "@/services/StorageService";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

type BaselineHorizonKey = "3d" | "1w" | "1m" | "1y";

const BASELINE_HORIZONS: Array<{
  key: BaselineHorizonKey;
  label: string;
  days: number;
  meta: string;
}> = [
  { key: "3d", label: "3D", days: 3, meta: "Past 3 days" },
  { key: "1w", label: "1W", days: 7, meta: "Past 1 week" },
  { key: "1m", label: "1M", days: 30, meta: "Past 1 month" },
  { key: "1y", label: "1Y", days: 365, meta: "Past 1 year" },
];

export default function DashboardScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [recentLogs, setRecentLogs] = useState<DailyLog[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [baselines, setBaselines] = useState<PersonalBaselinesResponse | null>(
    null,
  );
  const [selectedBaselineHorizon, setSelectedBaselineHorizon] =
    useState<BaselineHorizonKey>("1w");
  const [refreshing, setRefreshing] = useState(false);
  const [beforeBedComplete, setBeforeBedComplete] = useState(false);
  const [afterWakeComplete, setAfterWakeComplete] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const formatDate = () =>
    new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

  const loadData = async () => {
    const log = await getDailyLog(today);
    setTodayLog(log);

    const beforeBedFields = [
      log?.plannedSleepTime,
      log?.lastMeal,
      log?.screensOff,
      log?.caffeine,
      log?.stress,
    ];
    setBeforeBedComplete(
      beforeBedFields.every((f) => f !== null && f !== undefined),
    );

    const afterWakeFields = [
      log?.actualSleepTime,
      log?.wakeTime,
      log?.snooze,
      log?.sleepQuality,
      log?.energy,
      log?.sleepiness,
    ];
    setAfterWakeComplete(
      afterWakeFields.every((f) => f !== null && f !== undefined),
    );

    const generated = await generateInsights();
    setInsights(Array.isArray(generated) ? generated : []);

    const baselinesData = await fetchPersonalBaselines();
    setBaselines(baselinesData);

    const logs = await getRecentLogs(365);
    setRecentLogs(logs);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const getDeviationColor = (
    deviationPct: number | null,
    metricType: string,
  ): string => {
    if (!deviationPct) return "#9CA3AF";
    const eff = metricType === "stress" ? -deviationPct : deviationPct;
    if (eff >= 10) return "#10B981";
    if (eff >= 5) return "#34D399";
    if (eff <= -10) return "#EF4444";
    if (eff <= -5) return "#F87171";
    return "#9CA3AF";
  };

  const getMetricValueFromLog = (
    log: DailyLog,
    metric: string,
  ): number | null => {
    switch (metric) {
      case "sleepQuality":
        return typeof log.sleepQuality === "number" ? log.sleepQuality : null;
      case "energy":
        return typeof log.energy === "number" ? log.energy : null;
      case "stress":
        return typeof log.stress === "number" ? log.stress : null;
      case "sleepiness":
        return typeof log.sleepiness === "number" ? log.sleepiness : null;
      case "sleepDuration": {
        const sleepStr = log.actualSleepTime as string | undefined;
        const wakeStr = log.wakeTime as string | undefined;
        if (!sleepStr || !wakeStr) return null;
        try {
          const [sh, sm] = sleepStr.split(":").map(Number);
          let wakeH: number, wakeM: number;
          if (wakeStr.includes("T") || wakeStr.includes("Z")) {
            const d = new Date(wakeStr);
            wakeH = d.getHours();
            wakeM = d.getMinutes();
          } else {
            [wakeH, wakeM] = wakeStr.split(":").map(Number);
          }
          let dur = wakeH + wakeM / 60 - (sh + sm / 60);
          if (dur < 0) dur += 24;
          return dur > 0 && dur < 16 ? dur : null;
        } catch {
          return null;
        }
      }
      default:
        return null;
    }
  };

  const surveysCompleted = [beforeBedComplete, afterWakeComplete].filter(
    Boolean,
  ).length;
  const topInsight =
    insights.find((i) => i.confidence === "high") || insights[0];
  const isTablet = width >= 768;
  const isDesktop = width >= 1080;
  const maxContentWidth = isDesktop ? 1120 : isTablet ? 920 : 720;
  const metricColumns = isDesktop ? 3 : 2;
  const surveyCardDirection = isTablet ? "row" : "column";

  const getInsightStyle = (insight: Insight) => {
    if (insight.impact === "positive")
      return {
        bg: "#EEF9F4",
        border: "#CAECDC",
        icon: "✨",
        badgeBg: "#D8F3E6",
        badgeText: "#25634A",
        numColor: "#2E8B67",
      };
    if (insight.impact === "negative")
      return {
        bg: "#FEF4F4",
        border: "#F6D3D3",
        icon: "⚠️",
        badgeBg: "#F9DFDF",
        badgeText: "#8F3A3A",
        numColor: "#C25252",
      };
    if (insight.type === "streak")
      return {
        bg: "#FFF8EF",
        border: "#F4DFC4",
        icon: "🔥",
        badgeBg: "#F5E4CE",
        badgeText: "#8B5A27",
        numColor: "#B5762D",
      };
    return {
      bg: "#EFF3FF",
      border: "#D5DFFB",
      icon: "💡",
      badgeBg: "#DCE4FC",
      badgeText: "#3B4A87",
      numColor: "#5163A8",
    };
  };

  const renderMetricsSection = () => {
    if (!baselines) return null;

    const activeHorizon =
      BASELINE_HORIZONS.find(
        (option) => option.key === selectedBaselineHorizon,
      ) ?? BASELINE_HORIZONS[1];
    const horizonLogs = recentLogs.slice(0, activeHorizon.days).reverse();
    const metrics = baselines.baselines;
    const rows: (typeof baselines.baselines)[] = [];
    for (let i = 0; i < metrics.length; i += metricColumns)
      rows.push(metrics.slice(i, i + metricColumns));

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Health snapshot</Text>
          <Text style={styles.sectionMeta}>{activeHorizon.meta}</Text>
        </View>
        <View style={styles.horizonToggleRow}>
          {BASELINE_HORIZONS.map((option) => {
            const isActive = option.key === selectedBaselineHorizon;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.horizonToggle,
                  isActive && styles.horizonToggleActive,
                ]}
                activeOpacity={0.82}
                onPress={() => setSelectedBaselineHorizon(option.key)}
              >
                <Text
                  style={[
                    styles.horizonToggleText,
                    isActive && styles.horizonToggleTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.metricGrid}>
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.kpiRow}>
              {row.map((baseline) => {
                const isStressMetric = baseline.metric === "stress";

                const sparkVals = horizonLogs.map((log) =>
                  getMetricValueFromLog(log, baseline.metric),
                );
                const validVals = sparkVals.filter(
                  (v) => v !== null,
                ) as number[];
                const recentAverage =
                  validVals.length > 0
                    ? validVals.reduce((sum, value) => sum + value, 0) /
                      validVals.length
                    : null;
                const deviationPct =
                  recentAverage !== null && baseline.baseline
                    ? ((recentAverage - baseline.baseline) /
                        baseline.baseline) *
                      100
                    : baseline.deviation_percentage;
                const devColor = getDeviationColor(
                  deviationPct,
                  baseline.metric,
                );
                const displayVal =
                  recentAverage ?? baseline.current_value ?? baseline.baseline;
                const dataMax =
                  validVals.length > 0
                    ? Math.max(...validVals, baseline.baseline) * 1.02
                    : baseline.baseline * 1.2;
                const dataMin =
                  validVals.length > 0
                    ? Math.min(...validVals, baseline.baseline) * 0.88
                    : baseline.baseline * 0.75;
                const range = Math.max(dataMax - dataMin, 0.01);
                const baselinePct = Math.round(
                  ((baseline.baseline - dataMin) / range) * 100,
                );

                const sparkBarColor = (val: number) =>
                  (
                    isStressMetric
                      ? val <= baseline.baseline
                      : val >= baseline.baseline
                  )
                    ? "#2E8B67"
                    : "#CD6C6C";

                const trendText =
                  deviationPct === null
                    ? null
                    : Math.abs(deviationPct) < 2
                      ? "On track"
                      : `${deviationPct > 0 ? "Up" : "Down"} ${Math.abs(deviationPct).toFixed(0)}%`;

                return (
                  <View key={baseline.metric} style={styles.kpiCard}>
                    <View style={styles.kpiHeader}>
                      <View
                        style={[
                          styles.kpiAccent,
                          { backgroundColor: `${devColor}24` },
                        ]}
                      >
                        <Text style={styles.kpiEmoji}>
                          {getMetricIcon(baseline.metric)}
                        </Text>
                      </View>
                      <Text style={styles.kpiName} numberOfLines={1}>
                        {getMetricLabel(baseline.metric)}
                      </Text>
                    </View>

                    <Text style={styles.kpiValue}>{displayVal.toFixed(1)}</Text>
                    <Text style={styles.kpiUnit}>{baseline.unit}</Text>

                    <View style={styles.kpiSparkRow}>
                      <View style={styles.kpiYAxis}>
                        <Text style={styles.kpiYLabel}>
                          {dataMax.toFixed(1)}
                        </Text>
                        <Text style={styles.kpiYLabel}>
                          {dataMin.toFixed(1)}
                        </Text>
                      </View>
                      <View style={styles.kpiChartArea}>
                        <View
                          style={[
                            styles.kpiBaseline,
                            { bottom: `${baselinePct}%` },
                          ]}
                        />
                        <View style={styles.kpiBars}>
                          {sparkVals.map((val, idx) => {
                            if (val === null) {
                              return (
                                <View key={idx} style={styles.kpiBarSlot}>
                                  <View style={styles.kpiBarEmpty} />
                                </View>
                              );
                            }
                            const hp = Math.max(
                              ((val - dataMin) / range) * 100,
                              4,
                            );
                            return (
                              <View key={idx} style={styles.kpiBarSlot}>
                                <View
                                  style={[
                                    styles.kpiBar,
                                    {
                                      height: `${Math.min(hp, 100)}%`,
                                      backgroundColor: sparkBarColor(val),
                                    },
                                  ]}
                                />
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </View>

                    {trendText && (
                      <View
                        style={[
                          styles.kpiTrend,
                          { backgroundColor: `${devColor}16` },
                        ]}
                      >
                        <Text
                          style={[styles.kpiTrendText, { color: devColor }]}
                        >
                          {trendText} vs baseline
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
              {row.length < metricColumns &&
                Array.from({ length: metricColumns - row.length }).map(
                  (_, idx) => (
                    <View key={`spacer-${idx}`} style={styles.kpiCardSpacer} />
                  ),
                )}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderSurveySection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Log today</Text>
        <Text style={styles.sectionMeta}>Two quick check-ins</Text>
      </View>
      <View style={[styles.sectionRow, { flexDirection: surveyCardDirection }]}>
        <TouchableOpacity
          style={styles.surveyCard}
          activeOpacity={0.86}
          onPress={() => router.push("/survey?type=beforeBed")}
        >
          <LinearGradient
            colors={
              beforeBedComplete
                ? ["#304E43", "#223C35"]
                : ["#20242C", "#171A21"]
            }
            style={styles.surveyCardInner}
          >
            <Text style={styles.surveyEmoji}></Text>
            <Text style={styles.surveyTitle}>Before Bed</Text>
            <Text
              style={[
                styles.surveySubtitle,
                { color: beforeBedComplete ? "#B7E6D4" : "#AAB0BB" },
              ]}
            >
              {beforeBedComplete ? "Completed" : "5 questions"}
            </Text>
            <View
              style={[
                styles.surveyBtn,
                { backgroundColor: beforeBedComplete ? "#4E8B73" : "#343944" },
              ]}
            >
              <Text style={styles.surveyBtnText}>
                {beforeBedComplete ? "Edit" : "Start"}
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.surveyCard}
          activeOpacity={0.86}
          onPress={() => router.push("/survey?type=afterWake")}
        >
          <LinearGradient
            colors={
              afterWakeComplete
                ? ["#4A6B5D", "#365347"]
                : ["#6A5039", "#573E2A"]
            }
            style={styles.surveyCardInner}
          >
            <Text style={styles.surveyEmoji}></Text>
            <Text style={styles.surveyTitle}>After Wake</Text>
            <Text
              style={[
                styles.surveySubtitle,
                { color: afterWakeComplete ? "#CBE8DA" : "#F1D6B6" },
              ]}
            >
              {afterWakeComplete ? "Completed" : "6 questions"}
            </Text>
            <View
              style={[
                styles.surveyBtn,
                { backgroundColor: afterWakeComplete ? "#5D967E" : "#8D6440" },
              ]}
            >
              <Text style={styles.surveyBtnText}>
                {afterWakeComplete ? "Edit" : "Start"}
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderInsightSection = () => {
    if (!topInsight) return null;
    const s = getInsightStyle(topInsight);
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top insight</Text>
          {insights.length > 1 && (
            <Link href="/history" asChild>
              <TouchableOpacity activeOpacity={0.75}>
                <Text style={styles.sectionLink}>
                  View all ({insights.length})
                </Text>
              </TouchableOpacity>
            </Link>
          )}
        </View>
        <View
          style={[
            styles.insightCard,
            { backgroundColor: s.bg, borderColor: s.border },
          ]}
        >
          <View style={styles.insightCardHeader}>
            <Text style={styles.insightIcon}>{s.icon}</Text>
            <View style={[styles.badge, { backgroundColor: s.badgeBg }]}>
              <Text style={[styles.badgeText, { color: s.badgeText }]}>
                {topInsight.confidence ?? "personalized"}
              </Text>
            </View>
          </View>
          <InsightMessageWithCitations
            message={topInsight.message}
            citations={topInsight.citations}
            numberColor={s.numColor}
          />
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#8F949D"
        />
      }
    >
      <View style={[styles.page, { maxWidth: maxContentWidth }]}>
        <LinearGradient
          colors={["#FFFFFF", "#F8F9FC"]}
          style={styles.headerCard}
        >
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.appTitle}>Clarity</Text>
              <Text style={styles.dateLabel}>{formatDate()}</Text>
            </View>
          </View>
        </LinearGradient>

        {isDesktop ? (
          <View style={styles.desktopGrid}>
            <View style={styles.desktopMainColumn}>
              {renderMetricsSection()}
            </View>
            <View style={styles.desktopSideColumn}>
              {renderSurveySection()}
              {renderInsightSection()}
            </View>
          </View>
        ) : (
          <View style={styles.body}>
            {renderMetricsSection()}
            {renderSurveySection()}
            {renderInsightSection()}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  screenContent: {
    paddingBottom: 56,
    paddingHorizontal: 14,
    paddingTop: 18,
    alignItems: "center",
  },
  page: {
    width: "100%",
  },

  // Header
  headerCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    paddingHorizontal: 24,
    paddingVertical: 22,
    shadowColor: "#0A0A0A",
    shadowOpacity: 0.06,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
    marginBottom: 20,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  greeting: {
    color: "#70757F",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  appTitle: {
    color: "#121418",
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 4,
    letterSpacing: -1.1,
  },
  dateLabel: {
    color: "#8A909A",
    fontSize: 14,
    fontWeight: "500",
  },
  progressRow: {
    marginTop: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8EAEE",
    backgroundColor: "#FBFBFC",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  progressLabel: {
    color: "#4C525D",
    fontSize: 13,
    flex: 1,
    fontWeight: "500",
  },
  progressMeta: {
    color: "#7D838F",
    fontSize: 12,
    fontWeight: "600",
  },
  dotRow: {
    flexDirection: "row",
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Body + desktop layout
  body: {
    gap: 18,
  },
  desktopGrid: {
    flexDirection: "row",
    gap: 18,
    alignItems: "flex-start",
  },
  desktopMainColumn: {
    flex: 1.45,
  },
  desktopSideColumn: {
    flex: 1,
    gap: 18,
  },

  // Sections
  section: {
    marginBottom: 2,
  },
  sectionRow: {
    gap: 12,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#17191E",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  sectionMeta: {
    color: "#8A909B",
    fontSize: 12,
    fontWeight: "600",
  },
  sectionLink: {
    color: "#4C649A",
    fontSize: 13,
    fontWeight: "600",
  },
  horizonToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  horizonToggle: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#E2E6ED",
    backgroundColor: "#F9FAFC",
  },
  horizonToggleActive: {
    borderColor: "#4E8B73",
    backgroundColor: "#EAF4F0",
  },
  horizonToggleText: {
    color: "#707784",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  horizonToggleTextActive: {
    color: "#2E6C57",
  },
  metricGrid: {
    gap: 12,
  },

  // Survey cards
  surveyCard: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    minHeight: 176,
    shadowColor: "#111111",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  surveyCardInner: {
    flex: 1,
    padding: 18,
    justifyContent: "space-between",
  },
  surveyEmoji: {
    color: "#F2F3F6",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  surveyTitle: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  surveySubtitle: {
    fontSize: 13,
    marginBottom: 14,
    fontWeight: "500",
  },
  surveyBtn: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  surveyBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },

  // Insight card
  insightCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  insightCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  insightIcon: {
    fontSize: 20,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  // KPI grid
  kpiRow: {
    flexDirection: "row",
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E7EAF0",
    shadowColor: "#0E0E0E",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  kpiCardSpacer: {
    flex: 1,
  },
  kpiHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  kpiAccent: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  kpiEmoji: {
    fontSize: 13,
  },
  kpiName: {
    color: "#69707C",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    letterSpacing: 0.1,
  },
  kpiValue: {
    color: "#15181E",
    fontSize: 29,
    fontWeight: "800",
    lineHeight: 34,
    letterSpacing: -0.8,
    marginBottom: 2,
  },
  kpiUnit: {
    color: "#8A919D",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 12,
  },
  kpiSparkRow: {
    flexDirection: "row",
    height: 50,
    marginBottom: 10,
  },
  kpiYAxis: {
    width: 24,
    height: "100%",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginRight: 5,
    paddingVertical: 1,
  },
  kpiYLabel: {
    color: "#D0D4DC",
    fontSize: 8,
    fontWeight: "500",
    lineHeight: 10,
  },
  kpiChartArea: {
    flex: 1,
    height: "100%",
    position: "relative",
  },
  kpiBaseline: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#E8EBF1",
  },
  kpiBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: "100%",
    gap: 3,
  },
  kpiBarSlot: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  kpiBar: {
    width: "100%",
    borderRadius: 3,
  },
  kpiBarEmpty: {
    width: "100%",
    height: 3,
    backgroundColor: "#F0F2F6",
    borderRadius: 3,
  },
  kpiTrend: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  kpiTrendText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
