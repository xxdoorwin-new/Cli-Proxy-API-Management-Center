import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/Button';
import {
  userAdminApi,
  userSessionApi,
  type TrafficGranularity,
  type TrafficMetric,
  type TrafficStatistics,
  type TrafficUserRanking,
} from '@/services/api';
import { useAuthStore } from '@/stores';
import { formatTokenCount } from '@/utils/format';
import styles from './TrafficStatisticsPage.module.scss';

const SERIES_COLORS = ['#2563eb', '#0f766e', '#c2410c', '#7c3aed', '#be123c', '#64748b'];

type ChartMode = 'day' | 'week' | 'month';

interface ChartRange {
  from: string;
  to: string;
  granularity: TrafficGranularity;
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function formatCredits(value: number): string {
  return new Intl.NumberFormat().format(value || 0);
}

function metricValue(point: { total_tokens: number; total_credits: number; requests: number }, metric: TrafficMetric) {
  if (metric === 'credits') return point.total_credits;
  if (metric === 'requests') return point.requests;
  return point.total_tokens;
}

function formatMetric(value: number, metric: TrafficMetric): string {
  return metric === 'tokens' ? formatTokenCount(value) : formatCredits(value);
}

function localDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function bucketLabel(value: string, granularity: string): string {
  if (granularity === 'hour') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return localDateLabel(value);
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

function chartRangeFor(mode: ChartMode, anchor: string): ChartRange {
  const date = parseDateKey(anchor);
  if (mode === 'day') {
    return { from: anchor, to: anchor, granularity: 'hour' };
  }
  if (mode === 'month') {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { from: toDateKey(first), to: toDateKey(last), granularity: 'day' };
  }
  const weekday = (date.getDay() + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - weekday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toDateKey(monday), to: toDateKey(sunday), granularity: 'day' };
}

function stepAnchor(mode: ChartMode, anchor: string, direction: 1 | -1): string {
  const date = parseDateKey(anchor);
  if (mode === 'day') {
    date.setDate(date.getDate() + direction);
  } else if (mode === 'week') {
    date.setDate(date.getDate() + direction * 7);
  } else {
    date.setMonth(date.getMonth() + direction);
  }
  return toDateKey(date);
}

function formatRangeLabel(mode: ChartMode, range: ChartRange): string {
  const from = parseDateKey(range.from);
  const to = parseDateKey(range.to);
  if (mode === 'day') {
    return from.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  if (mode === 'month') {
    return from.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
  }
  return `${from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${to.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function TrendChart({ data, metric, t }: { data: TrafficStatistics; metric: TrafficMetric; t: (key: string) => string }) {
  const seriesMaps = useMemo(
    () => data.series.map((series) => new Map(series.points.map((point) => [point.date, point]))),
    [data.series]
  );
  const rows = useMemo(
    () =>
      data.daily.map((point) => {
        const row: Record<string, string | number> = {
          date: point.date,
          label: bucketLabel(point.date, data.granularity),
        };
        data.series.forEach((series, index) => {
          const seriesPoint = seriesMaps[index].get(point.date);
          row[series.key] = seriesPoint ? metricValue(seriesPoint, metric) : 0;
        });
        return row;
      }),
    [data.daily, data.series, data.granularity, metric, seriesMaps]
  );
  const tickInterval = rows.length > 10 ? Math.ceil(rows.length / 8) : 0;

  return (
    <div className={styles.chartBlock}>
      <div className={styles.chartLegend} aria-label={t('trafficStatistics.chartLegend')}>
        {data.series.map((series, index) => (
          <span className={styles.legendItem} key={series.key}>
            <span className={styles.legendSwatch} style={{ backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] }} />
            {series.other ? t('trafficStatistics.other') : `${series.provider}${series.model ? ` / ${series.model}` : ''}`}
          </span>
        ))}
      </div>
      <div className={styles.chartCanvas} role="img" aria-label={t('trafficStatistics.chartLabel')}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e1ddd7)" />
            <XAxis dataKey="label" interval={tickInterval} tick={{ fontSize: 10, fill: 'var(--text-muted, #756e67)' }} />
            <YAxis
              tickFormatter={(value: number) => formatMetric(value, metric)}
              tick={{ fontSize: 10, fill: 'var(--text-muted, #756e67)' }}
              width={56}
            />
            <Tooltip
              formatter={(value, name) => {
                const numeric = typeof value === 'number' ? value : Number(value ?? 0);
                const key = String(name);
                const series = data.series.find((item) => item.key === key);
                const label = series
                  ? series.other
                    ? t('trafficStatistics.other')
                    : `${series.provider}${series.model ? ` / ${series.model}` : ''}`
                  : key;
                return [formatMetric(numeric, metric), label];
              }}
            />
            {data.series.map((series, index) => (
              <Bar key={series.key} dataKey={series.key} stackId="traffic" fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.chartFallback}>
        <table>
          <thead><tr><th>{t('trafficStatistics.date')}</th><th>{t(`trafficStatistics.metric.${metric}`)}</th></tr></thead>
          <tbody>
            {data.daily.map((point) => (
              <tr key={point.date}>
                <td>{bucketLabel(point.date, data.granularity)}</td>
                <td>{formatMetric(metricValue(point, metric), metric)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function rankingSeriesLabel(series: { other?: boolean; provider?: string; model?: string }, t: (key: string) => string): string {
  if (series.other) return t('trafficStatistics.other');
  return `${series.provider ?? ''}${series.model ? ` / ${series.model}` : ''}`;
}

function RankingChart({ data, t }: { data: TrafficUserRanking[]; t: (key: string) => string }) {
  const topUsers = useMemo(() => data.slice(0, 10), [data]);

  const seriesKeys = useMemo(() => {
    const totals = new Map<string, { total: number; other: boolean; provider?: string; model?: string }>();
    topUsers.forEach((user) => {
      (user.series ?? []).forEach((item) => {
        const existing = totals.get(item.key);
        if (existing) {
          existing.total += item.total_tokens;
        } else {
          totals.set(item.key, { total: item.total_tokens, other: Boolean(item.other), provider: item.provider, model: item.model });
        }
      });
    });
    return Array.from(totals.entries())
      .sort((a, b) => {
        if (a[1].other !== b[1].other) return a[1].other ? 1 : -1;
        return b[1].total - a[1].total;
      })
      .map(([key, meta]) => ({ key, ...meta }));
  }, [topUsers]);

  const rows = useMemo(
    () =>
      topUsers.map((user) => {
        const row: Record<string, string | number> = { label: user.display_name || user.username };
        (user.series ?? []).forEach((item) => {
          row[item.key] = item.total_tokens;
        });
        return row;
      }),
    [topUsers]
  );

  const height = Math.max(160, rows.length * 34);

  return (
    <div className={styles.chartBlock}>
      <div className={styles.chartLegend} aria-label={t('trafficStatistics.chartLegend')}>
        {seriesKeys.map((series, index) => (
          <span className={styles.legendItem} key={series.key}>
            <span className={styles.legendSwatch} style={{ backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] }} />
            {rankingSeriesLabel(series, t)}
          </span>
        ))}
      </div>
      <div className={styles.chartCanvas} role="img" aria-label={t('trafficStatistics.rankingChartLabel')} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e1ddd7)" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(value: number) => formatTokenCount(value)}
              tick={{ fontSize: 10, fill: 'var(--text-muted, #756e67)' }}
            />
            <YAxis type="category" dataKey="label" width={140} tick={{ fontSize: 11, fill: 'var(--text-primary, #24211e)' }} />
            <Tooltip
              formatter={(value, name) => {
                const numeric = typeof value === 'number' ? value : Number(value ?? 0);
                const key = String(name);
                const series = seriesKeys.find((item) => item.key === key);
                return [formatTokenCount(numeric), series ? rankingSeriesLabel(series, t) : key];
              }}
            />
            {seriesKeys.map((series, index) => (
              <Bar key={series.key} dataKey={series.key} stackId="users" fill={SERIES_COLORS[index % SERIES_COLORS.length]} radius={[0, 2, 2, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TrafficStatisticsPage() {
  const { t } = useTranslation();
  const authMode = useAuthStore((state) => state.authMode);
  const currentUser = useAuthStore((state) => state.currentUser);
  const isAdministrator = authMode === 'management' || currentUser?.role === 'admin';
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [provider, setProvider] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState('');
  const [groupBy, setGroupBy] = useState<'provider' | 'model'>('model');
  const [metric, setMetric] = useState<TrafficMetric>('tokens');
  const [data, setData] = useState<TrafficStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [chartMode, setChartMode] = useState<ChartMode>('week');
  const [anchor, setAnchor] = useState(() => toDateKey(new Date()));
  const [trendData, setTrendData] = useState<TrafficStatistics | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState('');

  const [rankingMode, setRankingMode] = useState<ChartMode>('month');
  const [rankingAnchor, setRankingAnchor] = useState(() => toDateKey(new Date()));
  const [rankingData, setRankingData] = useState<TrafficStatistics | null>(null);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [rankingError, setRankingError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { from: from || undefined, to: to || undefined, provider: provider || undefined, model: model || undefined, status: status || undefined, groupBy, timeZone: browserTimeZone() };
      const response = isAdministrator
        ? await userAdminApi.trafficStatistics(params)
        : await userSessionApi.trafficStatistics(params);
      setData(response.traffic);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('trafficStatistics.loadFailed'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, provider, model, status, groupBy, isAdministrator, t]);

  useEffect(() => { void load(); }, [load]);

  const chartRange = useMemo(() => chartRangeFor(chartMode, anchor), [chartMode, anchor]);

  const loadTrend = useCallback(async () => {
    setTrendLoading(true);
    setTrendError('');
    try {
      const params = {
        from: chartRange.from,
        to: chartRange.to,
        granularity: chartRange.granularity,
        provider: provider || undefined,
        model: model || undefined,
        status: status || undefined,
        groupBy,
        timeZone: browserTimeZone(),
      };
      const response = isAdministrator
        ? await userAdminApi.trafficStatistics(params)
        : await userSessionApi.trafficStatistics(params);
      setTrendData(response.traffic);
    } catch (err) {
      setTrendError(err instanceof Error ? err.message : t('trafficStatistics.loadFailed'));
      setTrendData(null);
    } finally {
      setTrendLoading(false);
    }
  }, [chartRange, provider, model, status, groupBy, isAdministrator, t]);

  useEffect(() => { void loadTrend(); }, [loadTrend]);

  const rankingRange = useMemo(() => chartRangeFor(rankingMode, rankingAnchor), [rankingMode, rankingAnchor]);

  const loadRanking = useCallback(async () => {
    if (!isAdministrator) {
      setRankingData(null);
      setRankingLoading(false);
      return;
    }
    setRankingLoading(true);
    setRankingError('');
    try {
      const params = {
        from: rankingRange.from,
        to: rankingRange.to,
        granularity: 'day' as const,
        provider: provider || undefined,
        model: model || undefined,
        status: status || undefined,
        groupBy,
        timeZone: browserTimeZone(),
      };
      const response = await userAdminApi.trafficStatistics(params);
      setRankingData(response.traffic);
    } catch (err) {
      setRankingError(err instanceof Error ? err.message : t('trafficStatistics.loadFailed'));
      setRankingData(null);
    } finally {
      setRankingLoading(false);
    }
  }, [rankingRange, provider, model, status, groupBy, isAdministrator, t]);

  useEffect(() => { void loadRanking(); }, [loadRanking]);

  const modelOptions = useMemo(() => data?.models ?? [], [data]);
  const titleKey = isAdministrator ? 'trafficStatistics.title' : 'trafficStatistics.selfTitle';

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t(titleKey)}</h1>
          <p className={styles.description}>{t('trafficStatistics.description')}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}>{t('trafficStatistics.refresh')}</Button>
      </div>

      <section className={styles.filters} aria-label={t('trafficStatistics.filters')}>
        <label><span>{t('trafficStatistics.from')}</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label><span>{t('trafficStatistics.to')}</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <label><span>{t('trafficStatistics.provider')}</span><select value={provider} onChange={(event) => { setProvider(event.target.value); setModel(''); }}><option value="">{t('trafficStatistics.allProviders')}</option>{(data?.providers ?? []).map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span>{t('trafficStatistics.model')}</span><select value={model} onChange={(event) => setModel(event.target.value)}><option value="">{t('trafficStatistics.allModels')}</option>{modelOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label><span>{t('trafficStatistics.status')}</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{t('trafficStatistics.allStatuses')}</option><option value="succeeded">{t('trafficStatistics.succeeded')}</option><option value="failed">{t('trafficStatistics.failed')}</option></select></label>
        <label><span>{t('trafficStatistics.groupBy')}</span><select value={groupBy} onChange={(event) => setGroupBy(event.target.value as 'provider' | 'model')}><option value="model">{t('trafficStatistics.byModel')}</option><option value="provider">{t('trafficStatistics.byProvider')}</option></select></label>
      </section>

      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {data ? <div className={styles.periodNote}>{t('trafficStatistics.period', { from: data.period_start, to: data.period_end, timeZone: data.time_zone })}</div> : null}
      {data?.has_estimated_total ? <div className={styles.notice}>{t('trafficStatistics.estimatedTotalNotice')}</div> : null}

      {loading && !data ? <div className={styles.state}>{t('trafficStatistics.loading')}</div> : null}
      {!loading && data && data.summary.requests === 0 ? <div className={styles.state}>{t('trafficStatistics.empty')}</div> : null}
      {data ? (
        <>
          <section className={styles.summaryGrid} aria-label={t('trafficStatistics.summary')}>
            <div className={styles.summaryItem}><span>{t('trafficStatistics.totalTokens')}</span><strong>{formatTokenCount(data.summary.total_tokens)}</strong></div>
            <div className={styles.summaryItem}><span>{t('trafficStatistics.totalCredits')}</span><strong>{formatCredits(data.summary.total_credits)}</strong></div>
            <div className={styles.summaryItem}><span>{t('trafficStatistics.requests')}</span><strong>{formatCredits(data.summary.requests)}</strong></div>
            <div className={styles.summaryItem}><span>{t('trafficStatistics.activeUsers')}</span><strong>{formatCredits(data.summary.active_users)}</strong></div>
            <div className={styles.summaryItem}><span>{t('trafficStatistics.failedRequests')}</span><strong>{formatCredits(data.summary.failed_requests)}</strong></div>
          </section>

          {isAdministrator ? (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>{t('trafficStatistics.rankingTitle')}</h2>
                  <span>{t('trafficStatistics.rankingHint')}</span>
                </div>
                <div className={styles.trendControls}>
                  <label className={styles.metricControl}>
                    <span>{t('trafficStatistics.chartMode')}</span>
                    <select value={rankingMode} onChange={(event) => setRankingMode(event.target.value as ChartMode)}>
                      <option value="day">{t('trafficStatistics.chartModeDay')}</option>
                      <option value="week">{t('trafficStatistics.chartModeWeek')}</option>
                      <option value="month">{t('trafficStatistics.chartModeMonth')}</option>
                    </select>
                  </label>
                  <div className={styles.chartNav}>
                    <Button variant="secondary" size="sm" onClick={() => setRankingAnchor((current) => stepAnchor(rankingMode, current, -1))}>
                      {t('trafficStatistics.prev')}
                    </Button>
                    <span className={styles.chartNavLabel}>{formatRangeLabel(rankingMode, rankingRange)}</span>
                    <Button variant="secondary" size="sm" onClick={() => setRankingAnchor((current) => stepAnchor(rankingMode, current, 1))}>
                      {t('trafficStatistics.next')}
                    </Button>
                  </div>
                </div>
              </div>
              {rankingError ? <div className={styles.error} role="alert">{rankingError}</div> : null}
              {rankingLoading && !rankingData ? (
                <div className={styles.state}>{t('trafficStatistics.loading')}</div>
              ) : rankingData && rankingData.ranking && rankingData.ranking.length > 0 ? (
                <>
                  {rankingData.ranking.length > 10 ? (
                    <div className={styles.chartNote}>
                      {t('trafficStatistics.rankingTopHint', { count: 10, total: rankingData.ranking.length })}
                    </div>
                  ) : null}
                  <RankingChart data={rankingData.ranking} t={t} />
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr><th>#</th><th>{t('trafficStatistics.user')}</th><th>{t('trafficStatistics.totalTokens')}</th><th>{t('trafficStatistics.totalCredits')}</th><th>{t('trafficStatistics.requests')}</th></tr></thead>
                      <tbody>
                        {rankingData.ranking.map((item, index) => (
                          <tr key={item.user_id}>
                            <td>{index + 1}</td>
                            <td><strong>{item.display_name || item.username}</strong><small>{item.username}</small></td>
                            <td>{formatTokenCount(item.total_tokens)}</td>
                            <td>{formatCredits(item.total_credits)}</td>
                            <td>{formatCredits(item.requests)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className={styles.state}>{t('trafficStatistics.empty')}</div>
              )}
            </section>
          ) : null}

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>{t('trafficStatistics.trendTitle')}</h2>
                <span>{t('trafficStatistics.trendHint')}</span>
              </div>
              <div className={styles.trendControls}>
                <label className={styles.metricControl}>
                  <span>{t('trafficStatistics.metricLabel')}</span>
                  <select value={metric} onChange={(event) => setMetric(event.target.value as TrafficMetric)}>
                    <option value="tokens">{t('trafficStatistics.metric.tokens')}</option>
                    <option value="credits">{t('trafficStatistics.metric.credits')}</option>
                    <option value="requests">{t('trafficStatistics.metric.requests')}</option>
                  </select>
                </label>
                <label className={styles.metricControl}>
                  <span>{t('trafficStatistics.chartMode')}</span>
                  <select value={chartMode} onChange={(event) => setChartMode(event.target.value as ChartMode)}>
                    <option value="day">{t('trafficStatistics.chartModeDay')}</option>
                    <option value="week">{t('trafficStatistics.chartModeWeek')}</option>
                    <option value="month">{t('trafficStatistics.chartModeMonth')}</option>
                  </select>
                </label>
                <div className={styles.chartNav}>
                  <Button variant="secondary" size="sm" onClick={() => setAnchor((current) => stepAnchor(chartMode, current, -1))}>
                    {t('trafficStatistics.prev')}
                  </Button>
                  <span className={styles.chartNavLabel}>{formatRangeLabel(chartMode, chartRange)}</span>
                  <Button variant="secondary" size="sm" onClick={() => setAnchor((current) => stepAnchor(chartMode, current, 1))}>
                    {t('trafficStatistics.next')}
                  </Button>
                </div>
              </div>
            </div>
            {trendError ? <div className={styles.error} role="alert">{trendError}</div> : null}
            {trendLoading && !trendData ? (
              <div className={styles.state}>{t('trafficStatistics.loading')}</div>
            ) : trendData && trendData.series.length > 0 ? (
              <TrendChart data={trendData} metric={metric} t={t} />
            ) : trendData ? (
              <div className={styles.state}>{t('trafficStatistics.noSeries')}</div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
