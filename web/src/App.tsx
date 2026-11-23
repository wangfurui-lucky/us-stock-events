import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarDays,
  Moon,
  Radio,
  Sun,
} from 'lucide-react';
import { EarningsItem, MacroEventsData, MetaData, UpcomingData } from './types';
import { KeyEventsView } from './components/KeyEventsView';
import { EarningsView } from './components/EarningsView';
import { RoadmapView } from './components/RoadmapView';

type TabKey = 'events' | 'earnings' | 'roadmap';
type ThemeMode = 'dark' | 'light';

export function App() {
  const [tab, setTab] = useState<TabKey>('events');
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('us_events_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore
    }
    return 'dark';
  });

  const [macro, setMacro] = useState<MacroEventsData | null>(null);
  const [earnings, setEarnings] = useState<EarningsItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingData | null>(null);
  const [meta, setMeta] = useState<MetaData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedMacro, setSelectedMacro] = useState<'fomc' | 'nfp' | 'midterm'>('fomc');
  const [selectedTicker, setSelectedTicker] = useState<string>('DELL');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#0B0F17' : '#F6F8FB');
    }
    try {
      localStorage.setItem('us_events_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    Promise.all([
      fetch('/data/macro_events.json').then((r) => r.json()),
      fetch('/data/earnings.json').then((r) => r.json()),
      fetch('/data/upcoming.json').then((r) => r.json()),
      fetch('/data/meta.json').then((r) => r.json()),
    ])
      .then(([m, e, u, mt]) => {
        setMacro(m);
        setEarnings(e.items || []);
        setUpcoming(u);
        setMeta(mt);
      })
      .catch((err) => {
        setError(String(err));
      });
  }, []);

  const handleOpenTicker = (ticker: string) => {
    setSelectedTicker(ticker);
    setTab('earnings');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      {/* Sticky Top Navbar */}
      <header className="topbar">
        <div className="topbar-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
            <div className="brand" style={{ cursor: 'pointer' }} onClick={() => setTab('events')}>
              <div className="brand-icon">
                <Activity size={18} />
              </div>
              <span>美股事件雷达</span>
            </div>

            <nav className="nav-tabs" aria-label="主导航">
              <button
                className={`nav-tab ${tab === 'events' ? 'active' : ''}`}
                onClick={() => setTab('events')}
              >
                <CalendarDays size={15} />
                关键节点
              </button>
              <button
                className={`nav-tab ${tab === 'earnings' ? 'active' : ''}`}
                onClick={() => setTab('earnings')}
              >
                <BarChart3 size={15} />
                自选财报
              </button>
              <button
                className={`nav-tab ${tab === 'roadmap' ? 'active' : ''}`}
                onClick={() => setTab('roadmap')}
              >
                <Radio size={15} />
                资讯 & 大V
              </button>
            </nav>
          </div>

          <div className="topbar-right">
            {meta && (
              <div className="status-pill">
                <span className="live-dot" />
                <span className="num">行情至 {meta.market_data_through}</span>
              </div>
            )}
            <button
              className="icon-btn"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              title="切换深色 / 浅色风格"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              <span>{theme === 'dark' ? '浅色风' : '深色风'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container">
        {error ? (
          <div className="card down">数据加载失败：{error}</div>
        ) : !macro || !upcoming || !meta ? (
          <div className="card muted" style={{ textAlign: 'center', padding: 48 }}>
            正在加载历史统计与自选财报数据…
          </div>
        ) : tab === 'events' ? (
          <KeyEventsView
            macro={macro}
            earnings={earnings}
            upcoming={upcoming}
            selectedMacro={selectedMacro}
            onSelectMacro={setSelectedMacro}
            onOpenTicker={handleOpenTicker}
          />
        ) : tab === 'earnings' ? (
          <EarningsView
            items={earnings}
            asOf={upcoming.as_of}
            selectedTicker={selectedTicker}
            onSelectTicker={setSelectedTicker}
          />
        ) : (
          <RoadmapView meta={meta} onOpenTicker={handleOpenTicker} />
        )}

        <footer
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '12px 0 24px',
            borderTop: '1px solid var(--border)',
          }}
        >
          美股事件雷达 Demo · 数据仅供个人与小圈子研究参考，不构成任何投资建议 · 行情来源 Yahoo Finance / 美联储官网
        </footer>
      </main>
    </div>
  );
}

export default App;
