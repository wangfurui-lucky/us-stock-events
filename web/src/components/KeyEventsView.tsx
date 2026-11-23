import React, { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Info,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  EarningsItem,
  IndexKey,
  MacroEventsData,
  UpcomingData,
  WindowIndexBundle,
  WindowMetrics,
} from '../types';
import {
  daysUntil,
  decisionLabel,
  fmtPct,
  fmtRawPct,
  fmtShortDate,
  fmtWin,
} from '../utils';

interface Props {
  macro: MacroEventsData;
  earnings: EarningsItem[];
  upcoming: UpcomingData;
  selectedMacro: 'fomc' | 'nfp' | 'midterm';
  onSelectMacro: (k: 'fomc' | 'nfp' | 'midterm') => void;
  onOpenTicker: (ticker: string) => void;
}

const INDEX_LIST: IndexKey[] = ['^GSPC', '^NDX', '^SOX', '^VIX'];

export const KeyEventsView: React.FC<Props> = ({
  macro,
  earnings,
  upcoming,
  selectedMacro,
  onSelectMacro,
  onOpenTicker,
}) => {
  const [indexKey, setIndexKey] = useState<IndexKey>('^SOX');
  const [fomcPeriod, setFomcPeriod] = useState<'by_decision_2003' | 'recent_2022' | 'all_1994'>(
    'by_decision_2003'
  );
  const [fomcFocusGroup, setFomcFocusGroup] = useState<'all' | 'hold' | 'cut' | 'hike'>('hold');
  const [nfpPeriod, setNfpPeriod] = useState<'recent_2022' | 'all_1994'>('recent_2022');
  const [midtermMode, setMidtermMode] = useState<'long' | 'short'>('long');

  const effectiveIndex: IndexKey =
    selectedMacro === 'midterm' && indexKey === '^VIX' ? '^GSPC' : indexKey;

  const topCountdowns = useMemo(
    () => upcoming.events.filter((ev) => daysUntil(ev.date, upcoming.as_of) >= 0).slice(0, 4),
    [upcoming.events, upcoming.as_of]
  );

  // Select bundle for T-5..T+5 charts
  const currentBundle: WindowIndexBundle | undefined = useMemo(() => {
    if (selectedMacro === 'fomc') {
      return macro.fomc[fomcPeriod]?.[effectiveIndex];
    }
    if (selectedMacro === 'nfp') {
      return macro.nfp[nfpPeriod]?.[effectiveIndex];
    }
    return macro.midterm.short_1950?.[effectiveIndex];
  }, [macro, selectedMacro, fomcPeriod, nfpPeriod, effectiveIndex]);

  const isGroupedFomc = selectedMacro === 'fomc' && fomcPeriod !== 'all_1994';

  const windowChartData = useMemo(() => {
    if (!currentBundle) return [];
    const basePts = currentBundle.curves.all?.points || [];
    return basePts.map((pt, i) => {
      const row: Record<string, number | string> = {
        label: pt.label,
        day: pt.day,
        all: pt.mean,
      };
      if (isGroupedFomc) {
        if (currentBundle.curves.hold?.points[i]) row.hold = currentBundle.curves.hold.points[i].mean;
        if (currentBundle.curves.cut?.points[i]) row.cut = currentBundle.curves.cut.points[i].mean;
        if (currentBundle.curves.hike?.points[i]) row.hike = currentBundle.curves.hike.points[i].mean;
      }
      return row;
    });
  }, [currentBundle, isGroupedFomc]);

  const activeStats: WindowMetrics | undefined = useMemo(() => {
    if (!currentBundle) return undefined;
    if (isGroupedFomc && currentBundle.stats[fomcFocusGroup]) {
      return currentBundle.stats[fomcFocusGroup];
    }
    return currentBundle.stats.all;
  }, [currentBundle, isGroupedFomc, fomcFocusGroup]);

  const insightText = useMemo(() => {
    const idxName = macro.indices[effectiveIndex]?.name || effectiveIndex;
    if (selectedMacro === 'fomc') {
      if (isGroupedFomc) {
        if (fomcFocusGroup === 'hold') {
          return `按兵不动（n=${activeStats?.n ?? 0}）对风险资产最友好：${idxName}会议当天平均 ${fmtPct(activeStats?.day0_mean)}，上涨概率 ${fmtWin(activeStats?.day0_win)}（平时单日均值 ${fmtPct(activeStats?.base_day_mean)}）。`;
        }
        if (fomcFocusGroup === 'cut') {
          return `降息呈现典型「买预期、卖事实」：会前 5 天${idxName}平均 ${fmtPct(activeStats?.pre5_mean)}（上涨率 ${fmtWin(activeStats?.pre5_win)}），落地后 5 天反而平均 ${fmtPct(activeStats?.post5_mean)}，且当日波动放大至平时的 ${activeStats?.vol_ratio?.toFixed(2)} 倍。`;
        }
        if (fomcFocusGroup === 'hike') {
          return `加息周期整体承压：${idxName}会前 5 天均值 ${fmtPct(activeStats?.pre5_mean)}，会议当天中位数 ${fmtPct(activeStats?.day0_median)}（上涨率仅 ${fmtWin(activeStats?.day0_win)}），会后 5 天均值 ${fmtPct(activeStats?.post5_mean)}。注：2026 年 9 月美联储重启加息 25bp。`;
        }
      }
      return `1994 年至今例行 FOMC 会议落地后不确定性释放：${idxName}会议当天平均 ${fmtPct(activeStats?.day0_mean)}（上涨率 ${fmtWin(activeStats?.day0_win)}），而 VIX 当天有 68% 的概率回落。`;
    }
    if (selectedMacro === 'nfp') {
      if (nfpPeriod === 'recent_2022') {
        return `2022 年高利率周期以来，非农当天方向接近抛硬币（${idxName}当天均值 ${fmtPct(activeStats?.day0_mean)}），但当日波动是平时的 ${activeStats?.vol_ratio?.toFixed(2)} 倍；数据消化后 5 天反而显著走强（均值 ${fmtPct(activeStats?.post5_mean)}，上涨率 ${fmtWin(activeStats?.post5_win)}）。`;
      }
      return `1994 年至今 393 次非农发布：公布前 5 天市场常提前紧张（VIX 走高），落地当天 VIX 有 69% 概率回落，${idxName}当天均值 ${fmtPct(activeStats?.day0_mean)}。`;
    }
    if (midtermMode === 'long') {
      const n26 = macro.midterm.now_2026;
      return `1950–2022 年共 19 次中期选举后，标普 500 在 6 个月和 12 个月后 19/19 全部收涨（均值 +14.1% / +15.3%）。但 2026 年 11 月 3 日选后前 ${n26.trading_days_since} 个交易日已跌 ${fmtPct(n26.ret_2026)}（同期历史均值 ${fmtPct(n26.hist_mean_same_horizon)}），开局显著弱于历史，需结合今年 9 月重启加息的宏观背景谨慎判断。`;
    }
    return `1950 年至今中期选举前后短期窗口：${idxName}选前 5 天均值 ${fmtPct(activeStats?.pre5_mean)}，选举日当天均值 ${fmtPct(activeStats?.day0_mean)}（上涨率 ${fmtWin(activeStats?.day0_win)}），选后 5 天均值 ${fmtPct(activeStats?.post5_mean)}。`;
  }, [selectedMacro, effectiveIndex, isGroupedFomc, fomcFocusGroup, nfpPeriod, midtermMode, activeStats, macro]);

  const radarList = useMemo(() => earnings.slice(0, 7), [earnings]);

  return (
    <>
      {/* Top Countdown Strip */}
      <section className="countdown-grid" aria-label="近期关键时间节点倒计时">
        {topCountdowns.map((ev) => {
          const d = daysUntil(ev.date, upcoming.as_of);
          const badgeClass = d <= 3 ? 'urgent' : d <= 12 ? 'soon' : 'normal';
          const accentColor =
            ev.type === 'earnings'
              ? d <= 3
                ? 'var(--down)'
                : 'var(--accent)'
              : 'var(--up)';
          return (
            <button
              key={ev.id}
              className="countdown-card"
              style={{ ['--card-accent' as string]: accentColor }}
              onClick={() => {
                if (ev.type === 'earnings' && ev.ticker) {
                  onOpenTicker(ev.ticker);
                } else if (ev.macro_key) {
                  onSelectMacro(ev.macro_key);
                }
              }}
            >
              <div className={`days-badge num ${badgeClass}`}>
                <span>{d <= 0 ? '今天' : `${d}天后`}</span>
              </div>
              <div className="countdown-info">
                <div className="countdown-title">
                  {ev.title} · <span className="num muted" style={{ fontSize: 13 }}>{fmtShortDate(ev.date)}</span>
                </div>
                <div className="countdown-sub">{ev.subtitle}</div>
              </div>
            </button>
          );
        })}
      </section>

      {/* Main 2-Col Dashboard */}
      <section className="dashboard-grid">
        {/* Left: Interactive Macro Event Analyzer */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <TrendingUp size={18} color="var(--accent-text)" />
                <span>
                  {selectedMacro === 'fomc'
                    ? 'FOMC 议息会议前后走势'
                    : selectedMacro === 'nfp'
                    ? '非农就业（NFP）公布前后走势'
                    : midtermMode === 'long'
                    ? '中期选举后 12 个月标普 500 走势 vs 2026 当下'
                    : '中期选举前后短期走势（T-5 ~ T+5）'}
                </span>
              </div>
              <div className="card-subtitle">
                {selectedMacro === 'midterm' && midtermMode === 'long'
                  ? '以选举日前一日收盘为基准 0%，对比 1950–2022 历史 19 次轨迹与 2026 年实际走势'
                  : '以事件前一日（T-1）收盘为基准 0%，展示 T-5 至 T+5 交易日平均累计涨跌幅'}
              </div>
            </div>

            {/* Event Switcher */}
            <div className="segmented" role="tablist" aria-label="宏观事件切换">
              <button
                className={`seg-btn ${selectedMacro === 'fomc' ? 'active' : ''}`}
                onClick={() => onSelectMacro('fomc')}
              >
                FOMC 议息
              </button>
              <button
                className={`seg-btn ${selectedMacro === 'nfp' ? 'active' : ''}`}
                onClick={() => onSelectMacro('nfp')}
              >
                非农 NFP
              </button>
              <button
                className={`seg-btn ${selectedMacro === 'midterm' ? 'active' : ''}`}
                onClick={() => onSelectMacro('midterm')}
              >
                中期选举
              </button>
            </div>
          </div>

          {/* Sub-filters Row */}
          <div className="filter-row">
            {/* Period / Mode Switcher */}
            <div className="segmented">
              {selectedMacro === 'fomc' && (
                <>
                  <button
                    className={`seg-btn ${fomcPeriod === 'by_decision_2003' ? 'active' : ''}`}
                    onClick={() => setFomcPeriod('by_decision_2003')}
                  >
                    按决议分组 (2003+)
                  </button>
                  <button
                    className={`seg-btn ${fomcPeriod === 'recent_2022' ? 'active' : ''}`}
                    onClick={() => setFomcPeriod('recent_2022')}
                  >
                    近年 (2022+)
                  </button>
                  <button
                    className={`seg-btn ${fomcPeriod === 'all_1994' ? 'active' : ''}`}
                    onClick={() => setFomcPeriod('all_1994')}
                  >
                    全历史 (1994+)
                  </button>
                </>
              )}
              {selectedMacro === 'nfp' && (
                <>
                  <button
                    className={`seg-btn ${nfpPeriod === 'recent_2022' ? 'active' : ''}`}
                    onClick={() => setNfpPeriod('recent_2022')}
                  >
                    近年高利率期 (2022+, n=58)
                  </button>
                  <button
                    className={`seg-btn ${nfpPeriod === 'all_1994' ? 'active' : ''}`}
                    onClick={() => setNfpPeriod('all_1994')}
                  >
                    长期全样本 (1994+, n=393)
                  </button>
                </>
              )}
              {selectedMacro === 'midterm' && (
                <>
                  <button
                    className={`seg-btn ${midtermMode === 'long' ? 'active' : ''}`}
                    onClick={() => setMidtermMode('long')}
                  >
                    选后 12 个月 + 2026 对比
                  </button>
                  <button
                    className={`seg-btn ${midtermMode === 'short' ? 'active' : ''}`}
                    onClick={() => setMidtermMode('short')}
                  >
                    选举前后 T-5 ~ T+5
                  </button>
                </>
              )}
            </div>

            {/* Index Switcher */}
            {!(selectedMacro === 'midterm' && midtermMode === 'long') && (
              <div className="segmented">
                {INDEX_LIST.filter((k) => !(selectedMacro === 'midterm' && k === '^VIX')).map((k) => (
                  <button
                    key={k}
                    className={`seg-btn ${effectiveIndex === k ? 'active' : ''}`}
                    onClick={() => setIndexKey(k)}
                  >
                    {macro.indices[k].name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* FOMC Group Focus Selector (for KPI cards) */}
          {isGroupedFomc && currentBundle && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>查看下方指标分组：</span>
              {(['hold', 'cut', 'hike', 'all'] as const).map((g) => {
                const n = currentBundle.stats[g]?.n ?? 0;
                const dotColor =
                  g === 'hold'
                    ? 'var(--up)'
                    : g === 'cut'
                    ? 'var(--accent)'
                    : g === 'hike'
                    ? 'var(--down)'
                    : 'var(--text-2)';
                const active = fomcFocusGroup === g;
                return (
                  <button
                    key={g}
                    onClick={() => setFomcFocusGroup(g)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 999,
                      border: `1px solid ${active ? dotColor : 'var(--border)'}`,
                      background: active ? 'var(--surface-2)' : 'transparent',
                      color: active ? 'var(--text)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
                    {decisionLabel(g)} (n={n})
                  </button>
                );
              })}
            </div>
          )}

          {/* Chart Area */}
          <div className="chart-box">
            {selectedMacro === 'midterm' && midtermMode === 'long' ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={macro.midterm.long_series.points}
                  margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
                >
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="day"
                    stroke="var(--chart-axis)"
                    fontSize={11.5}
                    tickFormatter={(v) =>
                      v === 0
                        ? '选举日'
                        : v === 21
                        ? '1个月'
                        : v === 63
                        ? '3个月'
                        : v === 126
                        ? '6个月'
                        : v === 189
                        ? '9个月'
                        : v === 252
                        ? '12个月'
                        : `${v}日`
                    }
                    ticks={[0, 21, 63, 126, 189, 252]}
                  />
                  <YAxis
                    stroke="var(--chart-axis)"
                    fontSize={11.5}
                    tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
                  />
                  <ReferenceLine y={0} stroke="var(--border-strong)" />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="chart-tooltip">
                          <div className="tooltip-title">选后第 {label} 个交易日</div>
                          {payload
                            .filter((p) => p.value !== null && p.value !== undefined && p.dataKey !== 'p25' && p.dataKey !== 'p75')
                            .map((p) => (
                              <div className="tooltip-row" key={String(p.dataKey)}>
                                <span style={{ color: p.color }}>{p.name}</span>
                                <span className="num" style={{ fontWeight: 600 }}>
                                  {fmtRawPct(Number(p.value), 2)}
                                </span>
                              </div>
                            ))}
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="p75"
                    stroke="none"
                    fill="var(--accent)"
                    fillOpacity={0.09}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="y1974"
                    name="1974 (开局大跌后反弹)"
                    stroke="var(--text-muted)"
                    strokeWidth={1.3}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="y2022"
                    name="2022 走势"
                    stroke="var(--purple)"
                    strokeWidth={1.4}
                    strokeOpacity={0.7}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    name="历史均值 (1950-2022, n=19)"
                    stroke="var(--accent)"
                    strokeWidth={2.6}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="y2026"
                    name="2026 当下实际走势"
                    stroke="var(--down)"
                    strokeWidth={3.2}
                    dot={{ r: 2.5, fill: 'var(--down)' }}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={windowChartData} margin={{ top: 24, right: 16, left: -10, bottom: 4 }}>
                  <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--chart-axis)" fontSize={12} />
                  <YAxis
                    stroke="var(--chart-axis)"
                    fontSize={11.5}
                    tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
                  />
                  <ReferenceLine y={0} stroke="var(--border-strong)" />
                  <ReferenceLine
                    x="T0"
                    stroke="var(--text-muted)"
                    strokeDasharray="4 4"
                    label={{ value: '事件当天', position: 'top', fill: 'var(--text-2)', fontSize: 11 }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="chart-tooltip">
                          <div className="tooltip-title">
                            {label}（{label === 'T0' ? '事件当天' : '相对事件交易日'}）
                          </div>
                          {payload.map((p) => (
                            <div className="tooltip-row" key={String(p.dataKey)}>
                              <span style={{ color: p.color }}>{p.name}</span>
                              <span className="num" style={{ fontWeight: 600 }}>
                                {fmtRawPct(Number(p.value), 2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  {isGroupedFomc ? (
                    <>
                      <Line
                        type="monotone"
                        dataKey="hold"
                        name="按兵不动"
                        stroke="var(--up)"
                        strokeWidth={fomcFocusGroup === 'hold' ? 3 : 1.8}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="cut"
                        name="降息"
                        stroke="var(--accent)"
                        strokeWidth={fomcFocusGroup === 'cut' ? 3 : 1.8}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="hike"
                        name="加息"
                        stroke="var(--down)"
                        strokeWidth={fomcFocusGroup === 'hike' ? 3 : 1.8}
                        dot={{ r: 3 }}
                      />
                    </>
                  ) : (
                    <Line
                      type="monotone"
                      dataKey="all"
                      name={`${macro.indices[effectiveIndex].name} 平均走势`}
                      stroke="var(--accent)"
                      strokeWidth={2.8}
                      dot={{ r: 3.5, fill: 'var(--accent)' }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* KPI Strip */}
          {selectedMacro === 'midterm' && midtermMode === 'long' ? (
            <div className="kpi-grid">
              {(['1m', '3m', '6m', '12m'] as const).map((h) => {
                const s = macro.midterm.long_stats[h];
                const label =
                  h === '1m' ? '选后 1 个月' : h === '3m' ? '选后 3 个月' : h === '6m' ? '选后 6 个月' : '选后 12 个月';
                return (
                  <div className="kpi-box" key={h}>
                    <div className="kpi-label">{label}均值（n={s.n}）</div>
                    <div className="kpi-value num up">{fmtPct(s.mean, 1)}</div>
                    <div className="kpi-sub">
                      上涨率 <strong style={{ color: 'var(--text)' }}>{fmtWin(s.win)}</strong> · 基准 {fmtPct(s.base_mean, 1)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : activeStats ? (
            <div className="kpi-grid">
              <div className="kpi-box">
                <div className="kpi-label">事件前 5 天 (T-5~T-1)</div>
                <div className={`kpi-value num ${activeStats.pre5_mean >= 0 ? 'up' : 'down'}`}>
                  {fmtPct(activeStats.pre5_mean)}
                </div>
                <div className="kpi-sub">
                  上涨率 {fmtWin(activeStats.pre5_win)} · 平时 {fmtPct(activeStats.base_d5_mean)}
                </div>
              </div>
              <div className="kpi-box">
                <div className="kpi-label">事件当天平均 (T0)</div>
                <div className={`kpi-value num ${activeStats.day0_mean >= 0 ? 'up' : 'down'}`}>
                  {fmtPct(activeStats.day0_mean)}
                </div>
                <div className="kpi-sub">
                  中位 {fmtPct(activeStats.day0_median)} · 平时 {fmtPct(activeStats.base_day_mean)}
                </div>
              </div>
              <div className="kpi-box">
                <div className="kpi-label">当天上涨概率</div>
                <div className="kpi-value num">{fmtWin(activeStats.day0_win)}</div>
                <div className="kpi-sub">
                  样本 n={activeStats.n} · 平时 {fmtWin(activeStats.base_day_win)}
                </div>
              </div>
              <div className="kpi-box">
                <div className="kpi-label">事件后 5 天 / 当天波动</div>
                <div className={`kpi-value num ${activeStats.post5_mean >= 0 ? 'up' : 'down'}`}>
                  {fmtPct(activeStats.post5_mean)}
                </div>
                <div className="kpi-sub">
                  当日振幅 <strong style={{ color: 'var(--text)' }}>{activeStats.vol_ratio.toFixed(2)}x</strong> 平时
                </div>
              </div>
            </div>
          ) : null}

          {/* Insight Box */}
          <div className={`insight-box ${selectedMacro === 'midterm' && midtermMode === 'long' ? 'warn' : ''}`}>
            {selectedMacro === 'midterm' && midtermMode === 'long' ? (
              <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 2, color: 'var(--warn)' }} />
            ) : (
              <Info size={17} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent-text)' }} />
            )}
            <div>{insightText}</div>
          </div>
        </div>

        {/* Right Sidebar: Watchlist Earnings Radar + Recent FOMC */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header" style={{ marginBottom: 10 }}>
              <div>
                <div className="card-title">自选财报雷达</div>
                <div className="card-subtitle">按最近财报日期排序 · 点击看 8 季明细</div>
              </div>
              <button
                className="icon-btn"
                style={{ height: 28, fontSize: 12, padding: '0 9px' }}
                onClick={() => onOpenTicker(earnings[0]?.ticker || 'DELL')}
              >
                全部 11 家 <ChevronRight size={14} />
              </button>
            </div>

            <div className="radar-list">
              {radarList.map((e) => {
                const mult = e.stats.move_multiple;
                const badgeCls = mult >= 3.8 ? 'pill-down' : mult >= 3.0 ? 'pill-warn' : 'pill-blue';
                const barColor = mult >= 3.8 ? 'var(--down)' : mult >= 3.0 ? 'var(--warn)' : 'var(--accent)';
                const barPct = Math.min(100, Math.round((mult / 5) * 100));
                return (
                  <button
                    key={e.ticker}
                    className="radar-row"
                    onClick={() => onOpenTicker(e.ticker)}
                  >
                    <div>
                      <div className="ticker-code num">{e.ticker}</div>
                      <div className="ticker-cn">{e.name_cn}</div>
                    </div>
                    <div>
                      <div className="num" style={{ fontSize: 12.5, fontWeight: 600 }}>
                        {fmtShortDate(e.next_date)} {e.next_timing}
                      </div>
                      <div className="num muted" style={{ fontSize: 11.5 }}>
                        均振 ±{(e.stats.abs_day1_mean * 100).toFixed(1)}%
                      </div>
                    </div>
                    <span className={`pill num ${badgeCls}`}>{mult.toFixed(1)}x</span>
                    <div className="vol-bar-track" title={`平时单日波动的 ${mult.toFixed(1)} 倍`}>
                      <div className="vol-bar-fill" style={{ width: `${barPct}%`, background: barColor }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recent FOMC Decisions Mini Card */}
          <div className="card" style={{ padding: 16 }}>
            <div className="card-header" style={{ marginBottom: 10 }}>
              <div className="card-title" style={{ fontSize: 15 }}>
                <CalendarClock size={16} color="var(--accent-text)" />
                近期 FOMC 利率轨迹
              </div>
              <span className="pill pill-muted">下一次 12/09</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {macro.fomc.recent_meetings.slice(0, 5).map((m) => {
                const cls =
                  m.decision === 'hike' ? 'pill-down' : m.decision === 'cut' ? 'pill-up' : 'pill-muted';
                const bpStr =
                  m.change_bp && m.change_bp !== 0
                    ? `${m.change_bp > 0 ? '+' : ''}${m.change_bp}bp`
                    : '不变';
                return (
                  <div
                    key={m.date}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 12.5,
                      padding: '5px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span className="num muted">{m.date}</span>
                    <span className={`pill num ${cls}`}>
                      {decisionLabel(m.decision)} ({bpStr})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* One-off Major Catalysts */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h2 className="card-title" style={{ fontSize: 16 }}>
              <Sparkles size={16} color="var(--warn)" />
              重大一次性事件追踪（进度 + 历史类比）
            </h2>
            <p className="card-subtitle">
              IPO、产业领袖动态等无固定周期统计，采用事件时间线追踪并映射关联自选股
            </p>
          </div>
        </div>
        <div className="catalyst-grid">
          {upcoming.catalysts.map((c) => (
            <div className="catalyst-card" key={c.id}>
              <div className="catalyst-meta">
                <span className="pill pill-blue">{c.category}</span>
                <span className="pill pill-muted">{c.status}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{c.title}</div>
              <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55 }}>{c.analogy}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--text-2)' }}>
                {c.timeline.map((t, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 6 }}>
                    <span style={{ color: 'var(--accent-text)', fontWeight: 600, flexShrink: 0 }}>• {t.date}：</span>
                    <span>{t.note}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 'auto', paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>关联自选股（点击查看财报）：</div>
                <div className="ticker-chips">
                  {c.related_tickers.map((tk) => (
                    <button key={tk} className="ticker-chip" onClick={() => onOpenTicker(tk)}>
                      {tk}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
};
