"""Earnings reaction stats for the watchlist."""
import json

import numpy as np
import pandas as pd

from common import RAW, OUT, load_px

WATCH = ["SNDK", "DELL", "SMCI", "NBIS", "CRWV", "GLW", "AMD", "INTC", "LITE", "CRCL", "MRVL"]
NOW = pd.Timestamp.today().normalize()


def load_earn(t):
    df = pd.read_csv(RAW / f"earn_{t}.csv")
    df.columns = ["ts", "est", "eps", "surprise"]
    ts = df["ts"].astype(str)
    df["date"] = pd.to_datetime(ts.str[:10])
    df["hour"] = ts.str[11:13].astype(int)
    df = df.sort_values(["date", "eps"]).drop_duplicates("date", keep="first")
    return df.sort_values("date")


def analyze(t):
    e = load_earn(t)
    px = load_px(t)
    c, o = px["Close"], px["Open"]
    idx = px.index
    upcoming = e[(e["date"] >= NOW)]
    past = e[(e["date"] < NOW) & e["eps"].notna()]
    rows = []
    for _, r in past.iterrows():
        p = idx.searchsorted(r["date"])
        if p >= len(idx):
            continue
        after_close = r["hour"] >= 12
        if after_close and idx[p] == r["date"]:
            p += 1
        if p < 1 or p >= len(idx):
            continue
        prev = c.iloc[p - 1]
        row = {
            "date": r["date"].date(), "timing": "盘后" if after_close else "盘前",
            "est": r["est"], "eps": r["eps"], "surprise_pct": r["surprise"],
            "beat": r["eps"] > r["est"] if pd.notna(r["est"]) else np.nan,
            "gap": o.iloc[p] / prev - 1,
            "day1": c.iloc[p] / prev - 1,
            "day5": c.iloc[p + 4] / prev - 1 if p + 4 < len(idx) else np.nan,
            "pre5": prev / c.iloc[p - 6] - 1 if p >= 6 else np.nan,
        }
        rows.append(row)
    df = pd.DataFrame(rows)
    df.to_csv(OUT / f"earn_react_{t}.csv", index=False)
    if df.empty:
        return {"n": 0}
    d1 = df["day1"]
    daily_abs = c.pct_change().abs()
    daily_abs = daily_abs[daily_abs.index >= pd.Timestamp(df["date"].min())].mean()
    res = {
        "n": len(df),
        "first": str(df["date"].min()), "last": str(df["date"].max()),
        "beat_rate": float(df["beat"].dropna().mean()) if df["beat"].notna().any() else None,
        "day1_mean": d1.mean(), "day1_median": d1.median(), "day1_up": (d1 > 0).mean(),
        "abs_day1_mean": d1.abs().mean(), "abs_day1_max": d1.abs().max(),
        "normal_abs_day": daily_abs, "move_multiple": d1.abs().mean() / daily_abs,
        "day5_mean": df["day5"].mean(),
        "beat_day1_up": ((df["beat"] == True) & (d1 > 0)).sum() / max((df["beat"] == True).sum(), 1),
        "beat_but_down": int(((df["beat"] == True) & (d1 < 0)).sum()),
        "last4": df.tail(4)[["date", "timing", "surprise_pct", "day1"]].assign(
            date=lambda x: x["date"].astype(str)).to_dict("records"),
        "next": (str(upcoming["date"].min().date()) if len(upcoming) else None),
        "next_est": (float(upcoming.sort_values("date")["est"].iloc[0]) if len(upcoming) else None),
    }
    return res


if __name__ == "__main__":
    out = {t: analyze(t) for t in WATCH}
    (OUT / "earnings_stats.json").write_text(json.dumps(out, indent=1, default=float))
    for t, r in out.items():
        print(t, {k: (round(v, 4) if isinstance(v, float) else v) for k, v in r.items() if k != "last4"})
