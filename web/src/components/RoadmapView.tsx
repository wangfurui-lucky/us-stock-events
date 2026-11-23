import React from 'react';
import {
  CheckCircle2,
  Clock,
  Database,
  MessageSquareQuote,
  Newspaper,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { MetaData } from '../types';

interface Props {
  meta: MetaData;
  onOpenTicker: (ticker: string) => void;
}

export const RoadmapView: React.FC<Props> = ({ meta, onOpenTicker }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Preview Cards for Phase 2 & 3 */}
      <div className="roadmap-grid">
        {/* Serenity / KOL Tracker Preview */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card-header" style={{ marginBottom: 0 }}>
            <div className="card-title">
              <MessageSquareQuote size={18} color="var(--accent-text)" />
              大 V 观点追踪（第 3 期）
            </div>
            <span className="pill pill-blue">待接入 X API</span>
          </div>
          <p className="card-subtitle">
            定向抓取指定 X 博主推文 → AI 自动翻译与提炼中文核心观点 → 自动关联到你的自选股与事件日历。
          </p>

          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>Serenity（白毛女）</div>
                <div className="num muted" style={{ fontSize: 12 }}>@aleabitoreddit · X (Twitter)</div>
              </div>
              <span className="pill pill-muted">按条计费 · 约 $5~10/月</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
              • <strong>自动监测范围</strong>：AI 算力链、光模块、存储周期、财报点评与宏观仓位观点。<br />
              • <strong>展示形式</strong>：保留原文链接 + 3 句中文 AI 摘要 + 提及标的标签（点击可直达财报页）。
            </div>
            <div className="ticker-chips">
              {['DELL', 'MRVL', 'SNDK', 'LITE', 'GLW', 'CRWV', 'NBIS'].map((tk) => (
                <button key={tk} className="ticker-chip" onClick={() => onOpenTicker(tk)}>
                  ${tk}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* News & AI Summary Preview */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card-header" style={{ marginBottom: 0 }}>
            <div className="card-title">
              <Newspaper size={18} color="var(--up)" />
              美股新闻聚合 & AI 摘要（第 2–3 期）
            </div>
            <span className="pill pill-warn">规划中</span>
          </div>
          <p className="card-subtitle">
            避免海量噪音：只聚合与宏观大事（FOMC / 非农 / CPI / SpaceX / Anthropic / 黄仁勋）及你 11 家自选股相关的新闻。
          </p>

          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: 12.5,
              color: 'var(--text-2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', fontWeight: 600 }}>
              <Sparkles size={14} color="var(--warn)" />
              下一步可选升级项
            </div>
            <div>1. <strong>免费公网部署（Vercel）</strong>：生成手机可直接打开的网址，小圈子共享。</div>
            <div>2. <strong>AI 财报摘要</strong>：每次财报后自动生成中文指引解读（约 $5/月）。</div>
            <div>3. <strong>CPI 日历补齐</strong>：GitHub Actions 美国节点拉 FRED 或接 FMP 宏观日历。</div>
            <div>4. <strong>事件前一日提醒</strong>：支持微信推送 / 浏览器通知 / 邮件提醒。</div>
          </div>
        </div>
      </div>

      {/* Pipeline & Data Source Status */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <Database size={18} color="var(--accent-text)" />
              本地数据流水线状态
            </div>
            <div className="card-subtitle">
              行情截止：<strong className="num" style={{ color: 'var(--text)' }}>{meta.market_data_through}</strong> ·
              最近导出：<span className="num">{meta.generated_at}</span>
            </div>
          </div>
          <span className="pill pill-up">Demo 流水线已跑通</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>数据源</th>
                <th>覆盖内容</th>
                <th className="right">当前状态</th>
              </tr>
            </thead>
            <tbody>
              {meta.sources.map((s) => (
                <tr key={s.name}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td className="muted">{s.scope}</td>
                  <td className="right">
                    {s.status === 'ok' ? (
                      <span className="pill pill-up">
                        <CheckCircle2 size={12} /> 已接入
                      </span>
                    ) : s.status === 'pending' ? (
                      <span className="pill pill-warn">
                        <Clock size={12} /> 暂缓
                      </span>
                    ) : (
                      <span className="pill pill-muted">后续接入</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12.5,
            color: 'var(--text-2)',
          }}
        >
          <Terminal size={15} color="var(--accent-text)" style={{ flexShrink: 0 }} />
          <div>
            手动一键刷新全部最新行情与财报数据：在项目根目录运行{' '}
            <code className="num" style={{ color: 'var(--text)', background: 'var(--surface)', padding: '2px 6px', borderRadius: 4 }}>
              ./scripts/refresh.sh
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};
