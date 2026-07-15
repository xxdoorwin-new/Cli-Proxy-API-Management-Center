import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { userAdminApi, userSessionApi, type TrafficMetric, type TrafficStatistics } from '@/services/api';
import { useAuthStore } from '@/stores';
import { formatTokenCount } from '@/utils/format';
import styles from './TrafficStatisticsPage.module.scss';

const SERIES_COLORS = ['#2563eb', '#0f766e', '#c2410c', '#7c3aed', '#be123c', '#64748b'];

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

function TrendChart({ data, metric, t }: { data: TrafficStatistics; metric: TrafficMetric; t: (key: string) => string }) {
  const width = 840;
  const height = 240;
  const padding = { top: 18, right: 18, bottom: 34, left: 46 };
  const max = Math.max(
    1,
    ...data.daily.map((point) => metricValue(point, metric)),
    ...data.series.flatMap((series) => series.points.map((point) => metricValue(point, metric)))
  );
  const dateCount = Math.max(1, data.daily.length - 1);
  const x = (index: number) => padding.left + (index / dateCount) * (width - padding.left - padding.right);
  const y = (value: number) => padding.top + (1 - value / max) * (height - padding.top - padding.bottom);
  const pointMap = new Map(data.daily.map((point, index) => [point.date, index]));

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
      <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('trafficStatistics.chartLabel')}>
        <line x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} className={styles.chartAxis} />
        <line x1={padding.left} x2={padding.left} y1={padding.top} y2={height - padding.bottom} className={styles.chartAxis} />
        {data.series.map((series, seriesIndex) => {
          const points = series.points
            .map((point) => {
              const index = pointMap.get(point.date);
              return index === undefined ? null : `${x(index)},${y(metricValue(point, metric))}`;
            })
            .filter((point): point is string => Boolean(point));
          if (points.length === 0) return null;
          return <polyline key={series.key} points={points.join(' ')} fill="none" stroke={SERIES_COLORS[seriesIndex % SERIES_COLORS.length]} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />;
        })}
        {data.daily.map((point, index) => (
          <text key={point.date} x={x(index)} y={height - 10} textAnchor="middle" className={styles.chartLabel}>
            {index === 0 || index === data.daily.length - 1 || data.daily.length < 8 ? localDateLabel(point.date) : ''}
          </text>
        ))}
        <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" className={styles.chartLabel}>{formatMetric(max, metric)}</text>
        <text x={padding.left - 8} y={height - padding.bottom + 4} textAnchor="end" className={styles.chartLabel}>0</text>
      </svg>
      <div className={styles.chartFallback}>
        <table>
          <thead><tr><th>{t('trafficStatistics.date')}</th><th>{t(`trafficStatistics.metric.${metric}`)}</th></tr></thead>
          <tbody>
            {data.daily.map((point) => <tr key={point.date}><td>{localDateLabel(point.date)}</td><td>{formatMetric(metricValue(point, metric), metric)}</td></tr>)}
          </tbody>
        </table>
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

          {isAdministrator && data.ranking ? (
            <section className={styles.section}>
              <div className={styles.sectionHeader}><h2>{t('trafficStatistics.rankingTitle')}</h2><span>{t('trafficStatistics.rankingHint')}</span></div>
              <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>#</th><th>{t('trafficStatistics.user')}</th><th>{t('trafficStatistics.totalTokens')}</th><th>{t('trafficStatistics.totalCredits')}</th><th>{t('trafficStatistics.requests')}</th></tr></thead><tbody>{data.ranking.map((item, index) => <tr key={item.user_id}><td>{index + 1}</td><td><strong>{item.display_name || item.username}</strong><small>{item.username}</small></td><td>{formatTokenCount(item.total_tokens)}</td><td>{formatCredits(item.total_credits)}</td><td>{formatCredits(item.requests)}</td></tr>)}</tbody></table></div>
            </section>
          ) : null}

          <section className={styles.section}>
            <div className={styles.sectionHeader}><div><h2>{t('trafficStatistics.trendTitle')}</h2><span>{t('trafficStatistics.trendHint')}</span></div><label className={styles.metricControl}><span>{t('trafficStatistics.metricLabel')}</span><select value={metric} onChange={(event) => setMetric(event.target.value as TrafficMetric)}><option value="tokens">{t('trafficStatistics.metric.tokens')}</option><option value="credits">{t('trafficStatistics.metric.credits')}</option><option value="requests">{t('trafficStatistics.metric.requests')}</option></select></label></div>
            {data.series.length > 0 ? <TrendChart data={data} metric={metric} t={t} /> : <div className={styles.state}>{t('trafficStatistics.noSeries')}</div>}
          </section>
        </>
      ) : null}
    </div>
  );
}
