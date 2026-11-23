"""Event-window statistics for FOMC / NFP / CPI / midterm elections."""
import json
import sys

import numpy as np
import pandas as pd

from common import OUT, WINDOW, load_px, align, event_paths, baseline, summarize

DO_PLOT = "--no-plot" not in sys.argv
if DO_PLOT:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        plt.rcParams["font.sans-serif"] = ["PingFang SC", "Heiti SC", "Arial Unicode MS", "DejaVu Sans"]
        plt.rcParams["axes.unicode_minus"] = False
    except ImportError:
        DO_PLOT = False

INDEX_NAMES = {"^GSPC": "标普500", "^NDX": "纳指100", "^SOX": "费城半导体", "^VIX": "VIX"}
results = {}


def run(name, ev: pd.DataFrame, tickers=("^GSPC", "^NDX", "^SOX", "^VIX"),
        group_col=None, start="1994-01-01", end=None, tag=""):
    ev = ev[ev["date"] >= start]
    if end:
        ev = ev[ev["date"] <= end]
    key = f"{name}{tag}"
    results[key] = {}
    paths_for_plot = {}
    for t in tickers:
        px = load_px(t)
        close = px["Close"]
        pos = align(ev["date"], close.index)
        labels = ev[group_col].tolist() if group_col else None
        paths = event_paths(close, pos, labels)
        if paths.empty:
            continue
        b = baseline(close, paths["T0_date"].min(), paths["T0_date"].max())
        res = {"all": summarize(paths, b)}
        if group_col:
            for g, sub in paths.groupby("label"):
                res[str(g)] = summarize(sub, b)
        results[key][t] = res
        paths_for_plot[t] = paths
        paths.to_csv(OUT / f"paths_{key}_{t.replace('^', '')}.csv", index=False)
    if DO_PLOT:
        plot(key, paths_for_plot, group_col)
    return paths_for_plot


def plot(key, paths_for_plot, group_col):
    ts = [t for t in paths_for_plot if t != "^VIX"]
    fig, axes = plt.subplots(1, len(ts), figsize=(5 * len(ts), 3.6), squeeze=False)
    for ax, t in zip(axes[0], ts):
        p = paths_for_plot[t]
        groups = [("全部", p)] + (list(p.groupby("label")) if group_col else [])
        for g, sub in groups:
            if len(sub) < 3:
                continue
            m = [0.0 if k == -1 else sub[k].mean() * 100 for k in WINDOW]
            ax.plot(list(WINDOW), m, marker="o", ms=3, label=f"{g} (n={len(sub)})",
                    lw=2.5 if g == "全部" else 1.2)
        ax.axvline(0, color="grey", ls="--", lw=0.8)
        ax.axhline(0, color="grey", lw=0.5)
        ax.set_title(INDEX_NAMES.get(t, t))
        ax.set_xlabel("相对事件的交易日（0 = 事件当天）")
        ax.set_ylabel("相对 T-1 收盘的平均涨跌 %")
        ax.legend(fontsize=7)
    fig.tight_layout()
    fig.savefig(OUT / f"chart_{key}.png", dpi=130)
    plt.close(fig)


def midterm_long():
    """Long horizon: S&P from election day to +N trading days vs all-days baseline."""
    ev = pd.read_csv(OUT / "events_midterm.csv", parse_dates=["date"])
    close = load_px("^GSPC")["Close"]
    pos = align(ev["date"], close.index)
    rows = []
    c = close.values
    for d, p in zip(ev["date"], pos):
        if p is None:
            continue
        r = {"year": d.year}
        for h, lab in [(21, "1m"), (63, "3m"), (126, "6m"), (252, "12m")]:
            r[lab] = c[p + h] / c[p - 1] - 1 if p + h < len(c) else np.nan
        # midterm year: Sep 30 -> election (classic weakness into election?)
        pre = close[(close.index >= f"{d.year}-01-01") & (close.index < d)]
        r["ytd_to_election"] = c[p - 1] / pre.iloc[0] - 1
        r["low_to_election"] = c[p - 1] / pre.min() - 1
        rows.append(r)
    df = pd.DataFrame(rows)
    df.to_csv(OUT / "midterm_long.csv", index=False)
    base = {}
    sub = close[close.index >= "1950-01-01"]
    for h, lab in [(21, "1m"), (63, "3m"), (126, "6m"), (252, "12m")]:
        rr = (sub.shift(-h) / sub - 1).dropna()
        base[lab] = {"mean": rr.mean(), "win": (rr > 0).mean()}
    res = {}
    for lab in ["1m", "3m", "6m", "12m"]:
        x = df[lab].dropna()
        res[lab] = {"n": len(x), "mean": x.mean(), "median": x.median(), "win": (x > 0).mean(),
                    "min": x.min(), "max": x.max(),
                    "base_mean": base[lab]["mean"], "base_win": base[lab]["win"]}
    results["midterm_long"] = res

    # 2026: where are we vs the historical average path?
    p26 = pos[-1]
    if ev["date"].iloc[-1].year == 2026 and p26 is not None:
        n_days = min(len(c) - p26, 253)
        hist = []
        for d, p in zip(ev["date"][:-1], pos[:-1]):
            if p is not None and p + n_days < len(c):
                hist.append(c[p + n_days - 1] / c[p - 1] - 1)
        results["midterm_2026_now"] = {
            "trading_days_since": n_days,
            "ret_2026": c[min(p26 + n_days - 1, len(c) - 1)] / c[p26 - 1] - 1,
            "hist_mean_same_horizon": float(np.mean(hist)),
            "hist_win_same_horizon": float(np.mean(np.array(hist) > 0)),
            "last_date": str(close.index[-1].date()),
        }
    if not DO_PLOT:
        return
    # chart: average path 0..252 days after election
    fig, ax = plt.subplots(figsize=(8, 4))
    allp = []
    for d, p in zip(ev["date"], pos):
        if p is None:
            continue
        seg = c[p - 1: min(p + 253, len(c))] / c[p - 1] - 1
        if d.year == 2026:
            ax.plot(range(len(seg)), seg * 100, color="red", lw=2.5, label="2026（至今）")
        else:
            ax.plot(range(len(seg)), seg * 100, color="lightgrey", lw=0.8)
            if len(seg) == 254:
                allp.append(seg)
    ax.plot(range(254), np.mean(allp, axis=0) * 100, color="navy", lw=2.5,
            label=f"历史平均（1950-2022，n={len(allp)}）")
    ax.axhline(0, color="grey", lw=0.5)
    ax.set_title("中期选举后 12 个月标普500走势")
    ax.set_xlabel("选举日后的交易日")
    ax.set_ylabel("相对选举前一日收盘 %")
    ax.legend()
    fig.tight_layout()
    fig.savefig(OUT / "chart_midterm_long.png", dpi=130)
    plt.close(fig)


if __name__ == "__main__":
    fomc = pd.read_csv(OUT / "events_fomc.csv", parse_dates=["date"])
    fomc_s = fomc[~fomc["unscheduled"].astype(bool)]
    run("fomc", fomc_s)                                           # all scheduled, 1994+
    run("fomc", fomc_s[fomc_s["decision"].notna()], group_col="decision",
        start="2003-01-01", tag="_by_decision")                   # decision known 2003+
    run("fomc", fomc_s, group_col="decision", start="2022-01-01", tag="_2022plus")

    nfp = pd.read_csv(OUT / "events_nfp.csv", parse_dates=["date"])
    run("nfp", nfp)
    run("nfp", nfp, start="2022-01-01", tag="_2022plus")

    mt = pd.read_csv(OUT / "events_midterm.csv", parse_dates=["date"])
    run("midterm", mt, tickers=("^GSPC", "^NDX", "^SOX"), start="1950-01-01")
    midterm_long()

    (OUT / "event_stats.json").write_text(json.dumps(results, indent=1, default=float))
    print(json.dumps(results, indent=1, default=float)[:3000])
