import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Bot,
  Calendar,
  Search,
  Star,
} from 'lucide-react';
import { EarningsItem } from '../types';
import {
  daysUntil,
  fmtMcap,
  fmtPct,
  fmtRawPct,
  fmtShortDate,
  fmtWin,
} from '../utils';

interface Props {
  items: EarningsItem[];
  asOf: string;
  selectedTicker: string;
  onSelectTicker: (ticker: string) => void;
}

type SortKey = 'next_date' | 'abs_day1' | 'multiple' | 'beat_down';

export const EarningsView: React.FC<Props> = ({
  items,
  asOf,
  selectedTicker,
  onSelectTicker,
}) => {
  const [sector, setSector] = useState<string>('全部');
  const [sortBy, setSortBy] = useState<SortKey>('next_date');
  const [query, setQuery] = useState<string>('');
  const [starred, setStarred] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('us_events_starred');
      return saved ? JSON.parse(saved) : ['DELL', 'MRVL'];
    } catch {
      return ['DELL', 'MRVL'];
    }
  });

  const toggleStar = (ticker: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarred((prev) => {
      const next = prev.includes(ticker) ? prev.filter((x) => x !== ticker) : [...prev, ticker];
      try {
        localStorage.setItem('us_events_starred', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const sectors = useMemo(() => {
    const uniq = Array.from(new Set(items.map((x) => x.sector)));
    return ['全部', ...uniq];
  }, [items]);

  const mvllHint = query.trim().toUpperCase().includes('MVLL');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = items.filter((item) => {
      if (sector !== '全部' && item.sector !== sector) return false;
      if (!q) return true;
      if (q.includes('mvll') && item.ticker === 'MRVL') return true;
      return (
        item.ticker.toLowerCase().includes(q) ||
        item.name_cn.toLowerCase().includes(q) ||
        item.name_en.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q)
      );
    });
    arr = [...arr].sort((a, b) => {
      if (sortBy === 'abs_day1') return b.stats.abs_day1_mean - a.stats.abs_day1_mean;
      if (sortBy === 'multiple') return b.stats.move_multiple - a.stats.move_multiple;
      if (sortBy === 'beat_down') return b.stats.beat_but_down - a.stats.beat_but_down;
      return (a.next_date || '9999').localeCompare(b.next_date || '9999');
    });
    return arr;
  }, [items, sector, query, sortBy]);

  const activeItem = useMemo(
    () => items.find((i) => i.ticker === selectedTicker) || filtered[0] || items[0],
    [items, selectedTicker, filtered]
  );

  const recent8 = useMemo(() => {
    if (!activeItem) return [];
    return activeItem.quarters.slice(-8).map((q) => ({
      ...q,
      shortDate: q.date.slice(2, 7),
      day1Pct: q.day1 !== null ? Number((q.day1 * 100).toFixed(2)) : 0,
    }));
  }, [activeItem]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div className="filter-row" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="segmented">
              {sectors.map((s) => (
                <button
                  key={s}
                  className={`seg-btn ${sector === s ? 'active' : ''}`}
                  onClick={() => setSector(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="segmented">
              <button
                className={`seg-btn ${sortBy === 'next_date' ? 'active' : ''}`}
                onClick={() => setSortBy('next_date')}
              >
                按财报日
              </button>
              <button
                className={`seg-btn ${sortBy === 'abs_day1' ? 'active' : ''}`}
                onClick={() => setSortBy('abs_day1')}
              >
                按振幅
              </button>
              <button
                className={`seg-btn ${sortBy === 'multiple' ? 'active' : ''}`}
                onClick={() => setSortBy('multiple')}
              >
                按倍数
              </button>
              <button
                className={`seg-btn ${sortBy === 'beat_down' ? 'active' : ''}`}
                onClick={() => setSortBy('beat_down')}
              >
                超预期反跌
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                className="search-input"
                style={{ paddingLeft: 30 }}
                placeholder="搜代码 / 中文名（如 DELL）"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {mvllHint && (
          <div className="insight-box warn" style={{ marginTop: 12 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--warn)' }} />
            <div>
              提示：<strong>MVLL</strong> 是 GraniteShares 2 倍做多 Marvell 的杠杆 ETF，没有独立财报；已为你匹配正股{' '}
              <strong>MRVL（迈威尔科技）</strong>。
            </div>
          </div>
        )}
      </div>

      {/* Main Split View */}
      <div className="earnings-grid">
        {/* Left: Watchlist Table */}
        <div className="card" style={{ padding: '16px 14px' }}>
          <div className="card-header" style={{ padding: '0 6px', marginBottom: 10 }}>
            <div>
              <div className="card-title">自选企业财报总览（{filtered.length} 家）</div>
              <div className="card-subtitle">点击任意一行查看历史反应曲线与近 8 季明细</div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>公司</th>
                  <th>下次财报</th>
                  <th className="right">均振 |D1|</th>
                  <th className="right">波动倍数</th>
                  <th className="right">超预期/反跌</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const isSel = activeItem?.ticker === item.ticker;
                  const isStar = starred.includes(item.ticker);
                  const d = item.next_date ? daysUntil(item.next_date, asOf) : null;
                  const multCls =
                    item.stats.move_multiple >= 3.8
                      ? 'pill-down'
                      : item.stats.move_multiple >= 3.0
                      ? 'pill-warn'
                      : 'pill-blue';
                  return (
                    <tr
                      key={item.ticker}
                      className={`clickable ${isSel ? 'selected-row' : ''}`}
                      onClick={() => onSelectTicker(item.ticker)}
                    >
                      <td>
                        <button
                          onClick={(e) => toggleStar(item.ticker, e)}
                          title={isStar ? '取消星标' : '标星重点关注'}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: isStar ? 'var(--warn)' : 'var(--text-muted)',
                            padding: 2,
                            display: 'flex',
                          }}
                        >
                          <Star size={14} fill={isStar ? 'var(--warn)' : 'none'} />
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="ticker-code num">{item.ticker}</span>
                          {item.small_sample && (
                            <span className="pill pill-warn" style={{ padding: '1px 6px', fontSize: 10.5 }}>
                              n={item.stats.n}
                            </span>
                          )}
                        </div>
                        <div className="ticker-cn">
                          {item.name_cn} · {item.sector}
                        </div>
                      </td>
                      <td>
                        <div className="num" style={{ fontWeight: 600 }}>
                          {fmtShortDate(item.next_date)} <span className="muted" style={{ fontWeight: 400 }}>{item.next_timing}</span>
                        </div>
                        {d !== null && d >= 0 && d <= 14 && (
                          <span className="pill pill-down" style={{ marginTop: 2, fontSize: 10.5 }}>
                            {d === 0 ? '今天' : `${d}天后`}
                          </span>
                        )}
                      </td>
                      <td className="right num" style={{ fontWeight: 600 }}>
                        ±{(item.stats.abs_day1_mean * 100).toFixed(1)}%
                      </td>
                      <td className="right">
                        <span className={`pill num ${multCls}`}>{item.stats.move_multiple.toFixed(1)}x</span>
                      </td>
                      <td className="right num">
                        <span className="up">{fmtWin(item.stats.beat_rate)}</span>
                        <span className="muted"> / </span>
                        <span className="down">{item.stats.beat_but_down}次</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Active Company Detail */}
        {activeItem && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Company Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="num" style={{ fontSize: 22, fontWeight: 800 }}>
                    {activeItem.ticker}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 600 }}>{activeItem.name_cn}</span>
                  <span className="pill pill-blue">{activeItem.tag}</span>
                </div>
                <div className="card-subtitle" style={{ marginTop: 4 }}>
                  {activeItem.name_en} · 市值 <span className="num">{fmtMcap(activeItem.market_cap_b)}</span> · 最新收盘{' '}
                  <span className="num" style={{ color: 'var(--text)', fontWeight: 600 }}>
                    ${activeItem.last_close.toFixed(2)}
                  </span>{' '}
                  <span className={`num ${activeItem.last_chg >= 0 ? 'up' : 'down'}`}>
                    ({fmtPct(activeItem.last_chg)})
                  </span>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 14px',
                  textAlign: 'right',
                }}
              >
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  <Calendar size={12} /> 下次预计财报
                </div>
                <div className="num" style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
                  {activeItem.next_date || '待定'} {activeItem.next_timing}
                </div>
                <div className="num muted" style={{ fontSize: 11.5 }}>
                  EPS 预期：{activeItem.next_est !== null ? `$${activeItem.next_est.toFixed(2)}` : '—'}
                </div>
              </div>
            </div>

            {/* Small Sample Warning */}
            {activeItem.small_sample && (
              <div className="insight-box warn" style={{ marginTop: 0 }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--warn)' }} />
                <div>
                  <strong>样本偏少提示</strong>：{activeItem.ticker} 上市/重组时间较短，当前仅覆盖{' '}
                  <strong>{activeItem.stats.n} 次</strong>财报（{activeItem.stats.first} 至 {activeItem.stats.last}），统计规律仅供参考。
                </div>
              </div>
            )}

            {/* 4 KPI Cards */}
            <div className="kpi-grid" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
              <div className="kpi-box">
                <div className="kpi-label">次日平均振幅 |D1|</div>
                <div className="kpi-value num">±{(activeItem.stats.abs_day1_mean * 100).toFixed(1)}%</div>
                <div className="kpi-sub">
                  <strong style={{ color: 'var(--text)' }}>{activeItem.stats.move_multiple.toFixed(1)}x</strong> 平时 · 峰值{' '}
                  {(activeItem.stats.abs_day1_max * 100).toFixed(1)}%
                </div>
              </div>
              <div className="kpi-box">
                <div className="kpi-label">EPS 超预期率</div>
                <div className="kpi-value num up">{fmtWin(activeItem.stats.beat_rate)}</div>
                <div className="kpi-sub">历史共 {activeItem.stats.n} 次财报</div>
              </div>
              <div className="kpi-box">
                <div className="kpi-label">财报次日收涨率</div>
                <div className="kpi-value num">{fmtWin(activeItem.stats.day1_up)}</div>
                <div className="kpi-sub">
                  次日均值{' '}
                  <span className={activeItem.stats.day1_mean >= 0 ? 'up' : 'down'}>
                    {fmtPct(activeItem.stats.day1_mean)}
                  </span>
                </div>
              </div>
              <div className="kpi-box">
                <div className="kpi-label">超预期反跌次数</div>
                <div className="kpi-value num down">{activeItem.stats.beat_but_down} 次</div>
                <div className="kpi-sub">超预期涨率 {fmtWin(activeItem.stats.beat_day1_up)}</div>
              </div>
            </div>

            {/* Last 8 Quarters Bar Chart */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 650, fontSize: 14 }}>近 {recent8.length} 次财报次日涨跌幅（%）</div>
                <span className="muted" style={{ fontSize: 12 }}>绿涨红跌 · 悬停看 EPS 与跳空细节</span>
              </div>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={recent8} margin={{ top: 8, right: 8, left: -14, bottom: 2 }}>
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="shortDate" stroke="var(--chart-axis)" fontSize={11.5} />
                    <YAxis stroke="var(--chart-axis)" fontSize={11.5} tickFormatter={(v) => `${v}%`} />
                    <ReferenceLine y={0} stroke="var(--border-strong)" />
                    <Tooltip
                      cursor={{ fill: 'var(--surface-2)', opacity: 0.45 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const q = payload[0].payload as typeof recent8[number];
                        return (
                          <div className="chart-tooltip">
                            <div className="tooltip-title">
                              {q.date}（{q.timing}）
                            </div>
                            <div className="tooltip-row">
                              <span className="muted">EPS 预期 / 实际</span>
                              <span className="num">
                                {q.est ?? '—'} / {q.eps ?? '—'} ({q.beat ? '超预期' : q.beat === false ? '不及预期' : '—'})
                              </span>
                            </div>
                            <div className="tooltip-row">
                              <span className="muted">Surprise</span>
                              <span className="num">{fmtRawPct(q.surprise_pct, 1)}</span>
                            </div>
                            <div className="tooltip-row">
                              <span className="muted">次日开盘跳空</span>
                              <span className={`num ${(q.gap ?? 0) >= 0 ? 'up' : 'down'}`}>{fmtPct(q.gap)}</span>
                            </div>
                            <div className="tooltip-row">
                              <span className="muted">次日收盘 (D1)</span>
                              <span className={`num ${(q.day1 ?? 0) >= 0 ? 'up' : 'down'}`} style={{ fontWeight: 700 }}>
                                {fmtPct(q.day1)}
                              </span>
                            </div>
                            <div className="tooltip-row">
                              <span className="muted">5日累计 (D5)</span>
                              <span className={`num ${(q.day5 ?? 0) >= 0 ? 'up' : 'down'}`}>{fmtPct(q.day5)}</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="day1Pct" radius={[5, 5, 0, 0]} maxBarSize={38}>
                      {recent8.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={entry.day1Pct >= 0 ? 'var(--up)' : 'var(--down)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Recent Quarters Table */}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>财报日期</th>
                    <th className="right">EPS 预期</th>
                    <th className="right">EPS 实际</th>
                    <th className="right">Surprise</th>
                    <th className="right">次日收盘</th>
                    <th className="right">5日累计</th>
                  </tr>
                </thead>
                <tbody>
                  {[...recent8].reverse().map((q) => {
                    const beatButDown = q.beat === true && (q.day1 ?? 0) < 0;
                    return (
                      <tr key={q.date}>
                        <td className="num">
                          {q.date} <span className="muted">{q.timing}</span>
                        </td>
                        <td className="right num muted">{q.est !== null ? q.est.toFixed(2) : '—'}</td>
                        <td className="right num">{q.eps !== null ? q.eps.toFixed(2) : '—'}</td>
                        <td className={`right num ${(q.surprise_pct ?? 0) >= 0 ? 'up' : 'down'}`}>
                          {fmtRawPct(q.surprise_pct, 1)}
                        </td>
                        <td className={`right num ${(q.day1 ?? 0) >= 0 ? 'up' : 'down'}`} style={{ fontWeight: 650 }}>
                          {fmtPct(q.day1)}
                          {beatButDown && (
                            <span className="pill pill-warn" style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px' }}>
                              超预期反跌
                            </span>
                          )}
                        </td>
                        <td className={`right num ${(q.day5 ?? 0) >= 0 ? 'up' : 'down'}`}>
                          {fmtPct(q.day5)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phase 2 AI Guidance Placeholder */}
            <div
              style={{
                border: '1px dashed var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                background: 'var(--surface-2)',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <Bot size={18} color="var(--accent-text)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                <div style={{ fontWeight: 650, color: 'var(--text)', marginBottom: 4 }}>
                  AI 财报要点 & 业绩指引摘要（第 2 期接入位）
                </div>
                数据验证显示，{activeItem.ticker} 存在 <strong>{activeItem.stats.beat_but_down} 次</strong>「EPS 超预期但次日反跌」。后续接入大模型后，这里将在财报发布当晚自动提炼中文一页摘要：<strong>① 下季营收/毛利率指引对比预期 ② 管理层 AI 订单口径 ③ 电话会关键风险点</strong>。
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
