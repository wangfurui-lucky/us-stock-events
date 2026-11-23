"""Shared helpers: load prices, align event dates to trading days, window stats."""
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "out"
OUT.mkdir(parents=True, exist_ok=True)

WINDOW = range(-5, 6)  # T-5 .. T+5 trading days


def load_px(ticker: str) -> pd.DataFrame:
    fn = RAW / f"px_{ticker.replace('^', 'IDX_')}.csv"
    df = pd.read_csv(fn, index_col=0, parse_dates=True)
    df = df[pd.to_numeric(df["Close"], errors="coerce").notna()]
    for c in ["Open", "High", "Low", "Close", "Adj Close", "Volume"]:
        if c in df:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
    df = df[~df.index.duplicated()].sort_index()
    return df


def align(dates, idx: pd.DatetimeIndex, after_close=None):
    """Map each event date to the index position of its 'reaction day' (T0).

    after_close: optional iterable of bools; if True the reaction day is the next
    trading day (e.g. earnings released after the close).
    """
    dates = pd.to_datetime(pd.Series(list(dates))).dt.normalize()
    pos = idx.searchsorted(dates.values, side="left")  # first trading day >= date
    out = []
    ac = list(after_close) if after_close is not None else [False] * len(dates)
    for d, p, a in zip(dates, pos, ac):
        if p >= len(idx):
            out.append(None)
            continue
        if a and idx[p] == d:
            p += 1
        out.append(p if p < len(idx) else None)
    return out


def event_paths(close: pd.Series, positions, labels=None):
    """Cumulative return path normalised to close at T-1 (0 = pre-event close)."""
    rows = []
    c = close.values
    n = len(c)
    for i, p in enumerate(positions):
        if p is None or p - 6 < 0 or p + 5 >= n:
            continue
        base = c[p - 1]
        r = {k: c[p + k] / base - 1 for k in WINDOW}
        r["T0_date"] = close.index[p]
        r["pre5"] = c[p - 1] / c[p - 6] - 1          # drift into the event
        r["day0"] = c[p] / c[p - 1] - 1              # reaction day
        r["post5"] = c[p + 5] / c[p] - 1             # drift after the event
        r["absday0"] = abs(r["day0"])
        if labels is not None:
            r["label"] = labels[i]
        rows.append(r)
    return pd.DataFrame(rows)


def baseline(close: pd.Series, start=None, end=None):
    """Unconditional stats over the same period for comparison."""
    c = close if start is None else close[(close.index >= start) & (close.index <= end)]
    r1 = c.pct_change().dropna()
    r5 = (c.shift(-5) / c - 1).dropna()
    return {
        "day_mean": r1.mean(), "day_win": (r1 > 0).mean(), "day_abs": r1.abs().mean(),
        "d5_mean": r5.mean(), "d5_win": (r5 > 0).mean(),
    }


def summarize(paths: pd.DataFrame, base: dict):
    if paths.empty:
        return {}
    s = {"n": len(paths)}
    for col in ["pre5", "day0", "post5"]:
        x = paths[col]
        s[f"{col}_mean"] = x.mean()
        s[f"{col}_median"] = x.median()
        s[f"{col}_win"] = (x > 0).mean()
        s[f"{col}_t"] = x.mean() / (x.std(ddof=1) / np.sqrt(len(x))) if len(x) > 2 else np.nan
    s["absday0_mean"] = paths["absday0"].mean()
    s["vol_ratio"] = paths["absday0"].mean() / base["day_abs"]  # >1: event day moves more
    s["base_day_mean"] = base["day_mean"]
    s["base_day_win"] = base["day_win"]
    s["base_d5_mean"] = base["d5_mean"]
    s["base_d5_win"] = base["d5_win"]
    return s


def pct(x, d=2):
    return "—" if x is None or (isinstance(x, float) and np.isnan(x)) else f"{x*100:+.{d}f}%"


def pct0(x):
    return "—" if x is None or (isinstance(x, float) and np.isnan(x)) else f"{x*100:.0f}%"
