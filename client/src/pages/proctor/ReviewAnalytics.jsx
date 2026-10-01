import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

const RANGE_OPTIONS = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All available data' },
];

const COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185'];
const safeLabel = (value) => String(value || 'UNKNOWN').replaceAll('_', ' ');

function formatBucket(value, unit) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  if (unit === 'hour') return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', timeZone: 'UTC' });
  if (unit === 'month') return date.toLocaleDateString([], { year: 'numeric', month: 'short', timeZone: 'UTC' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function Metric({ label, value, detail }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="num mt-2 text-2xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-400">{detail}</p> : null}
    </Card>
  );
}

function ChartEmpty({ text }) {
  return <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-700 px-5 text-center text-sm text-slate-400">{text}</div>;
}

function AnalyticsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-900 p-3 text-xs shadow-xl">
      <p className="mb-2 font-medium text-white">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

/** Aggregate-only review analytics; signal metadata is never charted or displayed. */
export default function ReviewAnalytics({ analytics, flags = [], range, onRangeChange }) {
  const breakdown = useMemo(() => {
    const byType = new Map();
    const byTool = new Map();
    let signalCount = 0;
    for (const row of analytics?.byTypeAndTool || []) {
      const typeKey = String(row.type || 'UNKNOWN');
      const toolKey = String(row.tool || typeKey);
      const type = byType.get(typeKey) || { key: typeKey, label: safeLabel(typeKey), count: 0, low: 0, medium: 0, high: 0 };
      type.count += Number(row.count) || 0;
      type.low += Number(row.low) || 0;
      type.medium += Number(row.medium) || 0;
      type.high += Number(row.high) || 0;
      byType.set(typeKey, type);

      const tool = byTool.get(toolKey) || { key: toolKey, label: safeLabel(toolKey), count: 0, low: 0, medium: 0, high: 0 };
      tool.count += Number(row.count) || 0;
      tool.low += Number(row.low) || 0;
      tool.medium += Number(row.medium) || 0;
      tool.high += Number(row.high) || 0;
      byTool.set(toolKey, tool);
      signalCount += Number(row.count) || 0;
    }
    const sortByCount = (left, right) => right.count - left.count || left.label.localeCompare(right.label);
    return {
      byType: [...byType.values()].sort(sortByCount),
      byTool: [...byTool.values()].sort(sortByCount),
      signalCount,
    };
  }, [analytics]);

  const trendRows = useMemo(() => {
    const rows = new Map();
    for (const point of analytics?.trend || []) {
      const key = new Date(point.bucket).toISOString();
      const row = rows.get(key) || { bucket: key, label: formatBucket(point.bucket, analytics?.trendUnit), total: 0 };
      const seriesKey = String(point.type || 'UNKNOWN');
      row[seriesKey] = Number(point.count) || 0;
      row.total += Number(point.count) || 0;
      rows.set(key, row);
    }
    return [...rows.values()].sort((left, right) => left.bucket.localeCompare(right.bucket));
  }, [analytics]);

  const topTypes = breakdown.byType.slice(0, 4);
  const finalizedFlags = flags.filter((flag) => flag.reviewed && ['CLEARED', 'SUSPICIOUS'].includes(flag.verdict));
  const clearedFlags = finalizedFlags.filter((flag) => flag.verdict === 'CLEARED').length;
  const reviewedFlags = flags.filter((flag) => flag.reviewed).length;
  const clearedShare = finalizedFlags.length ? Math.round((clearedFlags / finalizedFlags.length) * 100) : null;
  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label || 'All available data';

  const exportAnalyticsCsv = () => {
    const csvCell = (value) => {
      const text = String(value ?? '');
      const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const rows = [[
      'record_type', 'range', 'signal_type', 'tool_or_source', 'time_bucket_utc',
      'count', 'low', 'medium', 'high', 'reviewed_flags', 'finalized_verdicts',
      'cleared_verdicts', 'cleared_share_percent', 'interpretation',
    ]];
    for (const row of analytics?.byTypeAndTool || []) {
      rows.push(['signal_breakdown', range, row.type, row.tool, '', row.count, row.low, row.medium, row.high, '', '', '', '', 'Accepted persisted signals; not unique candidates']);
    }
    for (const row of analytics?.trend || []) {
      rows.push(['signal_trend', range, row.type, '', new Date(row.bucket).toISOString(), row.count, '', '', '', '', '', '', '', `UTC ${analytics?.trendUnit || 'day'} bucket`]);
    }
    rows.push([
      'review_verdict_summary', range, '', '', '', '', '', '', '', reviewedFlags,
      finalizedFlags.length, clearedFlags, clearedShare ?? '',
      'Descriptive cleared share only; not a measured false-positive rate',
    ]);
    const blob = new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `review-analytics-${range}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-4" aria-labelledby="review-analytics-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Review analytics</p>
          <h2 id="review-analytics-title" className="mt-1 text-2xl font-semibold text-white">Signals, trends & verdicts</h2>
          <p className="mt-1 text-sm text-slate-400">Counts use accepted, persisted detector signals for this exam.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-3 text-sm text-slate-300">
            <span>Time range</span>
            <select
              value={range}
              onChange={(event) => onRangeChange(event.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white focus:border-primary focus:outline-none"
            >
              {RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <Button variant="ghost" onClick={exportAnalyticsCsv}>Export analytics CSV</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Persisted signals" value={analytics?.total ?? breakdown.signalCount} detail={rangeLabel} />
        <Metric label="Signal types" value={breakdown.byType.length} detail="Distinct detector codes" />
        <Metric label="Tools / sources" value={breakdown.byTool.length} detail="Grouped from sanitized tool metadata" />
        <Metric label="Review coverage" value={`${reviewedFlags} / ${flags.length}`} detail="Flags marked reviewed" />
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Signal volume over time</h3>
            <p className="mt-1 text-sm text-slate-400">Buckets are UTC {analytics?.trendUnit || 'day'} intervals. Empty intervals are omitted.</p>
          </div>
          <Badge tone="LOW">{trendRows.length} active intervals</Badge>
        </div>
        {trendRows.length ? (
          <div className="h-80 w-full" role="img" aria-label={`Signal trend for ${rangeLabel}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendRows} margin={{ top: 8, right: 16, left: 0, bottom: 12 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="label" minTickGap={24} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                <Tooltip content={<AnalyticsTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="total" name="All signals" stroke="#f8fafc" strokeWidth={2.5} dot={false} />
                {topTypes.map((type, index) => (
                  <Line key={type.key} type="monotone" dataKey={type.key} name={type.label} stroke={COLORS[index % COLORS.length]} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <ChartEmpty text="No persisted signals in this range. Try another time range or check after a monitored session." />}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Counts by signal type</h3>
            <p className="mt-1 text-sm text-slate-400">Each accepted signal is counted once in its recorded severity.</p>
          </div>
          {breakdown.byType.length ? (
            <div className="h-80 w-full" role="img" aria-label="Signals grouped by detector type and severity">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdown.byType} layout="vertical" margin={{ top: 4, right: 20, left: 12, bottom: 4 }}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={145} tick={{ fill: '#cbd5e1', fontSize: 10 }} />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Legend />
                  <Bar dataKey="low" name="Low" stackId="severity" fill="#38bdf8" />
                  <Bar dataKey="medium" name="Medium" stackId="severity" fill="#fbbf24" />
                  <Bar dataKey="high" name="High" stackId="severity" fill="#fb7185" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <ChartEmpty text="No signals to group by type." />}
        </Card>

        <Card>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Counts by tool / source</h3>
            <p className="mt-1 text-sm text-slate-400">Missing tool labels are grouped under their signal code.</p>
          </div>
          {breakdown.byTool.length ? (
            <div className="h-80 w-full" role="img" aria-label="Signals grouped by tool or source">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={breakdown.byTool.slice(0, 12)} margin={{ top: 8, right: 16, left: 0, bottom: 28 }}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="label" angle={-18} textAnchor="end" interval={0} height={66} tick={{ fill: '#cbd5e1', fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <Tooltip content={<AnalyticsTooltip />} />
                  <Legend />
                  <Bar dataKey="low" name="Low" stackId="severity" fill="#38bdf8" />
                  <Bar dataKey="medium" name="Medium" stackId="severity" fill="#fbbf24" />
                  <Bar dataKey="high" name="High" stackId="severity" fill="#fb7185" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <ChartEmpty text="No tool/source labels in this range." />}
          {breakdown.byTool.length > 12 ? <p className="mt-2 text-xs text-slate-500">Chart shows the top 12 sources; the complete list is below.</p> : null}
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Cleared verdict share</h3>
            <p className="mt-1 text-sm text-slate-400">Share of finalized proctor verdicts in this report range.</p>
          </div>
          <p className="num text-2xl font-semibold text-white">{clearedShare === null ? '—' : `${clearedShare}%`}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Cleared" value={clearedFlags} detail="Final verdict = CLEARED" />
          <Metric label="Suspicious" value={finalizedFlags.length - clearedFlags} detail="Final verdict = SUSPICIOUS" />
          <Metric label="Reviewed, no verdict" value={reviewedFlags - finalizedFlags.length} detail="Excluded from share denominator" />
        </div>
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-5 text-amber-100/80">
          This is a descriptive cleared-verdict share, not a measured false-positive rate. It uses only flags marked reviewed with a CLEARED or SUSPICIOUS verdict; unreviewed flags and reviewed flags without a verdict are excluded. No independent ground-truth labeling or sampling method is available here.
        </p>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-700 p-4">
          <h3 className="text-lg font-semibold text-white">Complete type × tool counts</h3>
          <p className="mt-1 text-sm text-slate-400">Includes all grouped combinations, not only charted top sources.</p>
        </div>
        {analytics?.byTypeAndTool?.length ? (
          <div className="max-h-[28rem] overflow-auto">
            <table className="min-w-full divide-y divide-slate-700 text-left text-sm">
              <thead className="sticky top-0 bg-slate-900 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Signal type</th>
                  <th className="px-4 py-3 font-medium">Tool / source</th>
                  <th className="px-4 py-3 font-medium">Count</th>
                  <th className="px-4 py-3 font-medium">Low / Medium / High</th>
                  <th className="px-4 py-3 font-medium">First seen (UTC)</th>
                  <th className="px-4 py-3 font-medium">Last seen (UTC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 text-slate-200">
                {analytics.byTypeAndTool.map((row) => (
                  <tr key={`${row.type}:${row.tool}`}>
                    <td className="px-4 py-3 font-medium text-white">{safeLabel(row.type)}</td>
                    <td className="px-4 py-3">{safeLabel(row.tool)}</td>
                    <td className="num px-4 py-3">{row.count}</td>
                    <td className="num px-4 py-3">{row.low} / {row.medium} / {row.high}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{row.firstSeen ? new Date(row.firstSeen).toLocaleString([], { timeZone: 'UTC' }) : '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{row.lastSeen ? new Date(row.lastSeen).toLocaleString([], { timeZone: 'UTC' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="p-4 text-sm text-slate-400">No type × tool groups available for this range.</div>}
      </Card>
    </section>
  );
}
