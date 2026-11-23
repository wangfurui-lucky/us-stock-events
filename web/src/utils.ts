export function fmtPct(v: number | null | undefined, digits = 2, signed = true): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const pct = v * 100;
  const sign = signed && pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(digits)}%`;
}

export function fmtRawPct(v: number | null | undefined, digits = 2, signed = true): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const sign = signed && v > 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}

export function fmtWin(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${Math.round(v * 100)}%`;
}

export function fmtMcap(b: number | null | undefined): string {
  if (!b) return '—';
  if (b >= 1000) return `$${(b / 1000).toFixed(2)}T`;
  return `$${b.toFixed(1)}B`;
}

export function effectiveAsOf(asOfDate: string): string {
  try {
    const localToday = new Date().toLocaleDateString('sv-SE');
    return localToday > asOfDate ? localToday : asOfDate;
  } catch {
    return asOfDate;
  }
}

export function daysUntil(targetDate: string, asOfDate: string): number {
  const ref = effectiveAsOf(asOfDate);
  const t = new Date(`${targetDate}T00:00:00Z`).getTime();
  const a = new Date(`${ref}T00:00:00Z`).getTime();
  return Math.round((t - a) / 86400000);
}

export function fmtShortDate(iso: string | null): string {
  if (!iso) return '待定';
  const [, m, d] = iso.split('-');
  return `${m}/${d}`;
}

export function decisionLabel(d: string): string {
  if (d === 'hold') return '按兵不动';
  if (d === 'cut') return '降息';
  if (d === 'hike') return '加息';
  return '全部';
}
