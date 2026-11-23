export type IndexKey = '^GSPC' | '^NDX' | '^SOX' | '^VIX';

export interface WindowMetrics {
  n: number;
  pre5_mean: number;
  pre5_median: number;
  pre5_win: number;
  pre5_t: number | null;
  day0_mean: number;
  day0_median: number;
  day0_win: number;
  day0_t: number | null;
  post5_mean: number;
  post5_median: number;
  post5_win: number;
  post5_t: number | null;
  absday0_mean: number;
  vol_ratio: number;
  base_day_mean: number;
  base_day_win: number;
  base_d5_mean: number;
  base_d5_win: number;
}

export interface CurvePoint {
  day: number;
  label: string;
  mean: number;
  median: number;
}

export interface CurveGroup {
  n: number;
  points: CurvePoint[];
}

export interface WindowIndexBundle {
  stats: Record<string, WindowMetrics>;
  curves: Record<string, CurveGroup>;
}

export interface MidtermLongStat {
  n: number;
  mean: number;
  median: number;
  win: number;
  min: number;
  max: number;
  base_mean: number;
  base_win: number;
}

export interface MidtermLongPoint {
  day: number;
  avg: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
  y1974: number;
  y2018: number;
  y2022: number;
  y2026: number | null;
}

export interface MidtermYearRow {
  year: number;
  m1: number | null;
  m3: number | null;
  m6: number | null;
  m12: number | null;
  ytd_to_election: number | null;
}

export interface MacroEventsData {
  indices: Record<IndexKey, { name: string; short: string }>;
  fomc: {
    all_1994: Partial<Record<IndexKey, WindowIndexBundle>>;
    by_decision_2003: Partial<Record<IndexKey, WindowIndexBundle>>;
    recent_2022: Partial<Record<IndexKey, WindowIndexBundle>>;
    recent_meetings: { date: string; decision: string; change_bp: number | null }[];
  };
  nfp: {
    all_1994: Partial<Record<IndexKey, WindowIndexBundle>>;
    recent_2022: Partial<Record<IndexKey, WindowIndexBundle>>;
  };
  midterm: {
    short_1950: Partial<Record<IndexKey, WindowIndexBundle>>;
    long_stats: Record<'1m' | '3m' | '6m' | '12m', MidtermLongStat>;
    now_2026: {
      trading_days_since: number;
      ret_2026: number;
      hist_mean_same_horizon: number;
      hist_win_same_horizon: number;
      last_date: string;
    };
    long_series: {
      n_completed: number;
      points: MidtermLongPoint[];
      yearly: MidtermYearRow[];
    };
  };
}

export interface QuarterReaction {
  date: string;
  timing: string;
  est: number | null;
  eps: number | null;
  surprise_pct: number | null;
  beat: boolean | null;
  gap: number | null;
  day1: number | null;
  day5: number | null;
  pre5: number | null;
}

export interface EarningsItem {
  ticker: string;
  name_en: string;
  name_cn: string;
  sector: string;
  tag: string;
  market_cap_b: number | null;
  last_close: number;
  last_chg: number;
  last_date: string;
  next_date: string | null;
  next_timing: string;
  next_est: number | null;
  small_sample: boolean;
  stats: {
    n: number;
    first: string;
    last: string;
    beat_rate: number | null;
    day1_mean: number;
    day1_median: number;
    day1_up: number;
    abs_day1_mean: number;
    abs_day1_max: number;
    normal_abs_day: number;
    move_multiple: number;
    day5_mean: number;
    beat_day1_up: number;
    beat_but_down: number;
  };
  quarters: QuarterReaction[];
}

export interface UpcomingEvent {
  id: string;
  type: 'macro' | 'earnings';
  macro_key?: 'fomc' | 'nfp' | 'midterm';
  ticker?: string;
  title: string;
  date: string;
  subtitle: string;
  importance: 'high' | 'medium';
}

export interface CatalystItem {
  id: string;
  title: string;
  category: string;
  status: string;
  analogy: string;
  related_tickers: string[];
  timeline: { date: string; note: string }[];
}

export interface UpcomingData {
  as_of: string;
  events: UpcomingEvent[];
  catalysts: CatalystItem[];
}

export interface MetaData {
  generated_at: string;
  market_data_through: string;
  sources: { name: string; scope: string; status: 'ok' | 'pending' | 'planned' }[];
}
