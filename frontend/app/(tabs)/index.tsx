import { generateInsights, Insight } from '@/services/InsightService';
import InsightMessageWithCitations from '@/components/InsightMessageWithCitations';
import { fetchPersonalBaselines, PersonalBaselinesResponse, getMetricIcon, getMetricLabel } from '@/services/BaselineService';
import { DailyLog, getDailyLog, getRecentLogs } from '@/services/StorageService';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function DashboardScreen() {
  const router = useRouter();
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [recentLogs, setRecentLogs] = useState<DailyLog[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [baselines, setBaselines] = useState<PersonalBaselinesResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [beforeBedComplete, setBeforeBedComplete] = useState(false);
  const [afterWakeComplete, setAfterWakeComplete] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const formatDate = () =>
    new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const loadData = async () => {
    const log = await getDailyLog(today);
    setTodayLog(log);

    const beforeBedFields = [log?.plannedSleepTime, log?.lastMeal, log?.screensOff, log?.caffeine, log?.stress];
    setBeforeBedComplete(beforeBedFields.every(f => f !== null && f !== undefined));

    const afterWakeFields = [log?.actualSleepTime, log?.wakeTime, log?.snooze, log?.sleepQuality, log?.energy, log?.sleepiness];
    setAfterWakeComplete(afterWakeFields.every(f => f !== null && f !== undefined));

    const generated = await generateInsights();
    setInsights(Array.isArray(generated) ? generated : []);

    const baselinesData = await fetchPersonalBaselines();
    setBaselines(baselinesData);

    const logs = await getRecentLogs(14);
    setRecentLogs(logs);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const getDeviationColor = (deviationPct: number | null, metricType: string): string => {
    if (!deviationPct) return '#9CA3AF';
    const eff = metricType === 'stress' ? -deviationPct : deviationPct;
    if (eff >= 10) return '#10B981';
    if (eff >= 5) return '#34D399';
    if (eff <= -10) return '#EF4444';
    if (eff <= -5) return '#F87171';
    return '#9CA3AF';
  };

  const getMetricValueFromLog = (log: DailyLog, metric: string): number | null => {
    switch (metric) {
      case 'sleepQuality': return typeof log.sleepQuality === 'number' ? log.sleepQuality : null;
      case 'energy':       return typeof log.energy === 'number' ? log.energy : null;
      case 'stress':       return typeof log.stress === 'number' ? log.stress : null;
      case 'sleepiness':   return typeof log.sleepiness === 'number' ? log.sleepiness : null;
      case 'sleepDuration': {
        const sleepStr = log.actualSleepTime as string | undefined;
        const wakeStr  = log.wakeTime as string | undefined;
        if (!sleepStr || !wakeStr) return null;
        try {
          const [sh, sm] = sleepStr.split(':').map(Number);
          let wakeH: number, wakeM: number;
          if (wakeStr.includes('T') || wakeStr.includes('Z')) {
            const d = new Date(wakeStr);
            wakeH = d.getHours(); wakeM = d.getMinutes();
          } else {
            [wakeH, wakeM] = wakeStr.split(':').map(Number);
          }
          let dur = (wakeH + wakeM / 60) - (sh + sm / 60);
          if (dur < 0) dur += 24;
          return dur > 0 && dur < 16 ? dur : null;
        } catch { return null; }
      }
      default: return null;
    }
  };

  const surveysCompleted = [beforeBedComplete, afterWakeComplete].filter(Boolean).length;
  const topInsight = insights.find(i => i.confidence === 'high') || insights[0];

  const getInsightStyle = (insight: Insight) => {
    if (insight.impact === 'positive') return {
      bg: '#ECFDF5', border: '#A7F3D0', icon: '✨',
      badgeBg: '#BBF7D0', badgeText: '#065F46', numColor: '#059669',
    };
    if (insight.impact === 'negative') return {
      bg: '#FEF2F2', border: '#FECACA', icon: '⚠️',
      badgeBg: '#FECACA', badgeText: '#991B1B', numColor: '#DC2626',
    };
    if (insight.type === 'streak') return {
      bg: '#FFF7ED', border: '#FED7AA', icon: '🔥',
      badgeBg: '#FED7AA', badgeText: '#92400E', numColor: '#D97706',
    };
    return {
      bg: '#EFF6FF', border: '#BFDBFE', icon: '💡',
      badgeBg: '#BFDBFE', badgeText: '#1E40AF', numColor: '#2563EB',
    };
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#94A3B8" />}
    >
      {/* ── Hero Header ── */}
      <LinearGradient colors={['#0F172A', '#1E293B', '#263548']} style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.appTitle}>Clarity</Text>
        <Text style={styles.dateLabel}>{formatDate()}</Text>

        {/* Survey completion progress */}
        <View style={styles.progressRow}>
          <View style={styles.dotRow}>
            {[0, 1].map(i => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: i < surveysCompleted ? '#10B981' : '#334155' }]}
              />
            ))}
          </View>
          <Text style={styles.progressText}>
            {surveysCompleted === 2 ? 'All surveys done today  🎉' : `${surveysCompleted} of 2 surveys complete`}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.body}>

        {/* ── Daily Surveys ── */}
        <View style={styles.sectionRow}>
          {/* Before Bed card */}
          <TouchableOpacity
            style={styles.surveyCard}
            activeOpacity={0.85}
            onPress={() => router.push('/survey?type=beforeBed')}
          >
            <LinearGradient
              colors={beforeBedComplete ? ['#064E3B', '#065F46'] : ['#1E293B', '#0F172A']}
              style={styles.surveyCardInner}
            >
              <Text style={styles.surveyEmoji}>🌙</Text>
              <Text style={styles.surveyTitle}>Before Bed</Text>
              <Text style={[styles.surveySubtitle, { color: beforeBedComplete ? '#6EE7B7' : '#64748B' }]}>
                {beforeBedComplete ? 'Completed ✓' : '5 questions'}
              </Text>
              <View style={[styles.surveyBtn, { backgroundColor: beforeBedComplete ? '#10B981' : '#334155' }]}>
                <Text style={styles.surveyBtnText}>{beforeBedComplete ? 'Edit' : 'Start →'}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* After Wake card */}
          <TouchableOpacity
            style={styles.surveyCard}
            activeOpacity={0.85}
            onPress={() => router.push('/survey?type=afterWake')}
          >
            <LinearGradient
              colors={afterWakeComplete ? ['#064E3B', '#065F46'] : ['#78350F', '#92400E']}
              style={styles.surveyCardInner}
            >
              <Text style={styles.surveyEmoji}>☀️</Text>
              <Text style={styles.surveyTitle}>After Wake</Text>
              <Text style={[styles.surveySubtitle, { color: afterWakeComplete ? '#6EE7B7' : '#FCD34D' }]}>
                {afterWakeComplete ? 'Completed ✓' : '6 questions'}
              </Text>
              <View style={[styles.surveyBtn, { backgroundColor: afterWakeComplete ? '#10B981' : '#D97706' }]}>
                <Text style={styles.surveyBtnText}>{afterWakeComplete ? 'Edit' : 'Start →'}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Top Insight ── */}
        {topInsight && (() => {
          const s = getInsightStyle(topInsight);
          return (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Top Insight</Text>
                {insights.length > 1 && (
                  <Link href="/modal" asChild>
                    <TouchableOpacity>
                      <Text style={styles.sectionLink}>View all ({insights.length}) →</Text>
                    </TouchableOpacity>
                  </Link>
                )}
              </View>

              <View style={[styles.insightCard, { backgroundColor: s.bg, borderColor: s.border }]}>
                <View style={styles.insightCardHeader}>
                  <Text style={styles.insightIcon}>{s.icon}</Text>
                  <View style={[styles.badge, { backgroundColor: s.badgeBg }]}>
                    <Text style={[styles.badgeText, { color: s.badgeText }]}>
                      {topInsight.confidence ?? 'personalized'}
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
        })()}

        {/* ── Your Metrics ── */}
        {baselines && baselines.tracking_days >= 5 && baselines.baselines.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Metrics</Text>
              <Link href="/baselines" asChild>
                <TouchableOpacity>
                  <Text style={styles.sectionLink}>View all →</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.metricsScroll}
            >
              {baselines.baselines.slice(0, 5).map((baseline) => {
                const devColor = getDeviationColor(baseline.deviation_percentage, baseline.metric);

                // Build 7-day sparkline data (oldest → newest)
                const last7 = recentLogs.slice(-7);
                const sparkVals = last7.map(log => getMetricValueFromLog(log, baseline.metric));
                const validVals = sparkVals.filter(v => v !== null) as number[];
                const isStressMetric = baseline.metric === 'stress';

                // Scale: anchor min slightly below the lowest value so bars are distinguishable
                const dataMax = validVals.length > 0 ? Math.max(...validVals, baseline.baseline) : baseline.baseline;
                const dataMin = validVals.length > 0
                  ? Math.min(...validVals, baseline.baseline) * 0.9
                  : baseline.baseline * 0.8;
                const range = Math.max(dataMax - dataMin, 0.01);

                const barColor = (val: number) => {
                  const aboveBase = isStressMetric ? val <= baseline.baseline : val >= baseline.baseline;
                  return aboveBase ? '#10B981' : '#F87171';
                };

                return (
                  <View key={baseline.metric} style={styles.metricCard}>
                    <Text style={styles.metricEmoji}>{getMetricIcon(baseline.metric)}</Text>
                    <Text style={styles.metricLabel} numberOfLines={1}>
                      {getMetricLabel(baseline.metric)}
                    </Text>

                    {/* 7-day sparkline */}
                    <View style={styles.sparklineRow}>
                      {/* Y-axis scale labels */}
                      <View style={styles.sparkYAxis}>
                        <Text style={styles.sparkYLabel}>{dataMax.toFixed(1)}</Text>
                        <Text style={styles.sparkYLabel}>
                          {baseline.baseline.toFixed(1)}
                        </Text>
                        <Text style={styles.sparkYLabel}>{dataMin.toFixed(1)}</Text>
                      </View>

                      {/* Chart area */}
                      <View style={styles.sparkChartArea}>
                        {/* Baseline reference line */}
                        <View
                          style={[
                            styles.sparkBaseline,
                            {
                              bottom: `${Math.round(((baseline.baseline - dataMin) / range) * 100)}%`,
                            },
                          ]}
                        />
                        {/* Bars */}
                        <View style={styles.sparkBars}>
                          {sparkVals.map((val, idx) => {
                            if (val === null) {
                              return (
                                <View key={idx} style={styles.sparkBarSlot}>
                                  <View style={styles.sparkBarEmpty} />
                                </View>
                              );
                            }
                            const heightPct = Math.max(((val - dataMin) / range) * 100, 4);
                            return (
                              <View key={idx} style={styles.sparkBarSlot}>
                                <View
                                  style={[
                                    styles.sparkBar,
                                    { height: `${Math.min(heightPct, 100)}%`, backgroundColor: barColor(val) },
                                  ]}
                                />
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </View>

                    <Text style={styles.sparkLabel}>7-day trend  ·  avg {baseline.baseline.toFixed(1)} {baseline.unit}</Text>

                    {/* Deviation pill */}
                    {baseline.deviation_percentage !== null && (
                      <View style={[styles.deviationPill, { backgroundColor: `${devColor}22` }]}>
                        <Text style={[styles.deviationText, { color: devColor }]}>
                          {baseline.deviation_percentage > 0 ? '↑' : '↓'}{' '}
                          {Math.abs(baseline.deviation_percentage).toFixed(0)}% vs avg
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* "Full Analysis" end card */}
              <Link href="/baselines" asChild>
                <TouchableOpacity style={styles.metricCardDark} activeOpacity={0.85}>
                  <Text style={styles.metricEmoji}>📊</Text>
                  <Text style={styles.metricCardDarkTitle}>Full Analysis</Text>
                  <Text style={styles.metricCardDarkSub}>Behavior impacts & trends</Text>
                </TouchableOpacity>
              </Link>
            </ScrollView>
          </View>
        ) : baselines && baselines.tracking_days > 0 && baselines.tracking_days < 5 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Metrics</Text>
            <View style={styles.progressCard}>
              <View style={styles.progressCardHeader}>
                <Text style={styles.progressCardEmoji}>📊</Text>
                <Text style={styles.progressCardTitle}>Building your baselines</Text>
              </View>
              <Text style={styles.progressCardSub}>
                {5 - baselines.tracking_days} more day{5 - baselines.tracking_days !== 1 ? 's' : ''} to unlock personalized insights
              </Text>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${(baselines.tracking_days / 5) * 100}%` }]} />
              </View>
              <Text style={styles.progressCardCount}>{baselines.tracking_days} of 5 days tracked</Text>
            </View>
          </View>
        ) : null}


      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },

  // Header
  header: {
    paddingTop: 68,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  greeting: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  appTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  dateLabel: {
    color: '#475569',
    fontSize: 13,
    marginBottom: 22,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    color: '#94A3B8',
    fontSize: 13,
  },

  // Body
  body: {
    padding: 20,
    paddingTop: 22,
  },

  // Section
  section: {
    marginBottom: 28,
  },
  sectionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionLink: {
    color: '#4F83EE',
    fontSize: 13,
    fontWeight: '600',
  },

  // Survey cards
  surveyCard: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  surveyCardInner: {
    padding: 18,
  },
  surveyEmoji: {
    fontSize: 30,
    marginBottom: 10,
  },
  surveyTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 3,
  },
  surveySubtitle: {
    fontSize: 12,
    marginBottom: 18,
  },
  surveyBtn: {
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
  surveyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // Insight card
  insightCard: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
  },
  insightCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  insightIcon: {
    fontSize: 22,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Metrics scroll
  metricsScroll: {
    paddingRight: 20,
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginRight: 12,
    width: 150,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  metricEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  metricLabel: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 11,
    marginBottom: 8,
  },

  // Sparkline
  sparklineRow: {
    flexDirection: 'row',
    height: 52,
    marginBottom: 4,
  },
  sparkYAxis: {
    width: 22,
    height: '100%',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingVertical: 0,
    marginRight: 4,
  },
  sparkYLabel: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '500',
    lineHeight: 10,
  },
  sparkChartArea: {
    flex: 1,
    height: '100%',
    position: 'relative',
  },
  sparkBaseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  sparkBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    gap: 2,
  },
  sparkBarSlot: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  sparkBar: {
    width: '100%',
    borderRadius: 2,
    minHeight: 3,
  },
  sparkBarEmpty: {
    width: '100%',
    height: 3,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
  },
  sparkLabel: {
    color: '#94A3B8',
    fontSize: 9,
    marginBottom: 8,
    letterSpacing: 0.2,
  },

  deviationPill: {
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 7,
    alignSelf: 'flex-start',
  },
  deviationText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metricCardDark: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 16,
    width: 150,
    justifyContent: 'center',
  },
  metricCardDarkTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
  },
  metricCardDarkSub: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
  },

  // Progress card (< 5 days)
  progressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  progressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  progressCardEmoji: {
    fontSize: 24,
  },
  progressCardTitle: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 16,
  },
  progressCardSub: {
    color: '#64748B',
    fontSize: 13,
    marginBottom: 14,
  },
  progressBarTrack: {
    backgroundColor: '#F1F5F9',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  progressCardCount: {
    color: '#94A3B8',
    fontSize: 11,
  },

  // History link
  historyLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  historyLinkText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
});
