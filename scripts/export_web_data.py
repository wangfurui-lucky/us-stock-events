"""Export validated statistics and time series into clean JSON for the web app."""
import json
import math
from datetime import date, datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
VAL_RAW = ROOT / "validation" / "data" / "raw"
VAL_OUT = ROOT / "validation" / "data" / "out"
WEB_DATA = ROOT / "web" / "public" / "data"
WEB_DATA.mkdir(parents=True, exist_ok=True)

WINDOW = list(range(-5, 6))
INDICES = ["^GSPC", "^NDX", "^SOX", "^VIX"]
INDEX_META = {
    "^GSPC": {"name": "标普500", "short": "SPX"},
    "^NDX": {"name": "纳指100", "short": "NDX"},
    "^SOX": {"name": "费城半导体", "short": "SOX"},
    "^VIX": {"name": "恐慌指数 VIX", "short": "VIX"},
}

WATCHLIST_META = {
    "DELL": {"cn": "戴尔科技", "sector": "AI 服务器/存储", "tag": "AI 服务器龙头"},
    "MRVL": {"cn": "迈威尔科技", "sector": "AI 芯片", "tag": "定制 ASIC / 光互联"},
    "GLW": {"cn": "康宁", "sector": "光通信", "tag": "数据中心光纤"},
    "INTC": {"cn": "英特尔", "sector": "AI 芯片", "tag": "晶圆代工 / x86"},
    "AMD": {"cn": "AMD", "sector": "AI 芯片", "tag": "AI GPU / CPU"},
    "SMCI": {"cn": "超微电脑", "sector": "AI 服务器/存储", "tag": "液冷 AI 服务器"},
    "LITE": {"cn": "Lumentum", "sector": "光通信", "tag": "高速光模块 / 激光器"},
    "NBIS": {"cn": "Nebius", "sector": "AI 云", "tag": "欧洲 AI 云算力"},
    "SNDK": {"cn": "闪迪 Sandisk", "sector": "AI 服务器/存储", "tag": "NAND 闪存 (2025分拆)"},
    "CRCL": {"cn": "Circle", "sector": "稳定币/金融", "tag": "USDC 发行商 (2025上市)"},
    "CRWV": {"cn": "CoreWeave", "sector": "AI 云", "tag": "GPU 云算力 (2025上市)"},
}


def clean_num(v, ndigits=4):
    if v is None:
        return None
    if isinstance(v, (float, np.floating)):
        if math.isnan(v) or math.isinf(v):
            return None
        return round(float(v), ndigits)
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    return v


def load_px(ticker: str) -> pd.DataFrame:
    fn = VAL_RAW / f"px_{ticker.replace('^', 'IDX_')}.csv"
    df = pd.read_csv(fn, index_col=0, parse_dates=True)
    df = df[pd.to_numeric(df["Close"], errors="coerce").notna()]
    for c in ["Open", "High", "Low", "Close", "Volume"]:
        if c in df:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
    return df[~df.index.duplicated()].sort_index()


def build_curve(paths_csv: Path, group_col=False):
    df = pd.read_csv(paths_csv)
    curves = {}

    def avg_series(sub):
        pts = []
        for k in WINDOW:
            col = str(k)
            val = 0.0 if k == -1 else float(sub[col].mean() * 100)
            med = 0.0 if k == -1 else float(sub[col].median() * 100)
            pts.append({"day": k, "label": f"T{k:+d}" if k != 0 else "T0", "mean": round(val, 3), "median": round(med, 3)})
        return {"n": int(len(sub)), "points": pts}

    curves["all"] = avg_series(df)
    if group_col and "label" in df.columns:
        for g, sub in df.groupby("label"):
            curves[str(g)] = avg_series(sub)
    return curves


def build_midterm_long_series():
    ev = pd.read_csv(VAL_OUT / "events_midterm.csv", parse_dates=["date"])
    close = load_px("^GSPC")["Close"]
    idx = close.index
    c = close.values
    pos = idx.searchsorted(ev["date"].values, side="left")

    hist_mat = []
    hist_years = {}
    curve_2026 = []
    for d, p in zip(ev["date"], pos):
        if p >= len(c) or p < 1:
            continue
        seg = (c[p - 1 : min(p + 253, len(c))] / c[p - 1] - 1) * 100
        yr = int(d.year)
        if yr == 2026:
            curve_2026 = [round(float(x), 2) for x in seg]
        elif len(seg) == 254:
            hist_mat.append(seg)
            if yr in (1974, 2002, 2018, 2022):
                hist_years[str(yr)] = [round(float(x), 2) for x in seg]

    mat = np.array(hist_mat)  # (19, 254)
    # Sample every 2 trading days (plus exact landmarks 0..20 every day, 21, 63, 126, 252) to keep JSON light & crisp
    keep = sorted(set(list(range(0, 22)) + list(range(22, 254, 3)) + [63, 126, 189, 252, 253]))
    points = []
    for i in keep:
        row = {
            "day": int(i),
            "avg": round(float(mat[:, i].mean()), 2),
            "min": round(float(mat[:, i].min()), 2),
            "max": round(float(mat[:, i].max()), 2),
            "p25": round(float(np.percentile(mat[:, i], 25)), 2),
            "p75": round(float(np.percentile(mat[:, i], 75)), 2),
            "y1974": hist_years["1974"][i],
            "y2018": hist_years["2018"][i],
            "y2022": hist_years["2022"][i],
            "y2026": curve_2026[i] if i < len(curve_2026) else None,
        }
        points.append(row)

    long_df = pd.read_csv(VAL_OUT / "midterm_long.csv")
    yearly = []
    for _, r in long_df.iterrows():
        yearly.append({
            "year": int(r["year"]),
            "m1": clean_num(r["1m"]),
            "m3": clean_num(r["3m"]),
            "m6": clean_num(r["6m"]),
            "m12": clean_num(r["12m"]),
            "ytd_to_election": clean_num(r["ytd_to_election"]),
        })
    return {"n_completed": int(len(hist_mat)), "points": points, "yearly": yearly}


def export_macro():
    stats = json.loads((VAL_OUT / "event_stats.json").read_text())

    def pack_window(key, tickers, grouped=False):
        out = {}
        for t in tickers:
            t_clean = t.replace("^", "")
            csv_path = VAL_OUT / f"paths_{key}_{t_clean}.csv"
            if not csv_path.exists():
                continue
            s_raw = stats.get(key, {}).get(t, {})
            s_clean = {
                g: {k: clean_num(v) for k, v in metrics.items()}
                for g, metrics in s_raw.items()
            }
            out[t] = {
                "stats": s_clean,
                "curves": build_curve(csv_path, group_col=grouped),
            }
        return out

    today_str = str(date.today())
    fomc_df = pd.read_csv(VAL_OUT / "events_fomc.csv", parse_dates=["date"])
    recent_fomc = fomc_df[(~fomc_df["unscheduled"].astype(bool)) & (fomc_df["date"] <= today_str)].tail(8)
    recent_fomc_list = [
        {
            "date": str(r["date"].date()),
            "decision": r["decision"] if pd.notna(r["decision"]) else "hold",
            "change_bp": clean_num(r["change_bp"], 0),
        }
        for _, r in recent_fomc.iloc[::-1].iterrows()
    ]

    macro = {
        "indices": INDEX_META,
        "fomc": {
            "all_1994": pack_window("fomc", INDICES, grouped=False),
            "by_decision_2003": pack_window("fomc_by_decision", INDICES, grouped=True),
            "recent_2022": pack_window("fomc_2022plus", INDICES, grouped=True),
            "recent_meetings": recent_fomc_list,
        },
        "nfp": {
            "all_1994": pack_window("nfp", INDICES, grouped=False),
            "recent_2022": pack_window("nfp_2022plus", INDICES, grouped=False),
        },
        "midterm": {
            "short_1950": pack_window("midterm", ["^GSPC", "^NDX", "^SOX"], grouped=False),
            "long_stats": {
                k: {mk: clean_num(mv) for mk, mv in v.items()}
                for k, v in stats.get("midterm_long", {}).items()
            },
            "now_2026": {k: clean_num(v) if not isinstance(v, str) else v for k, v in stats.get("midterm_2026_now", {}).items()},
            "long_series": build_midterm_long_series(),
        },
    }
    (WEB_DATA / "macro_events.json").write_text(json.dumps(macro, ensure_ascii=False, indent=2))
    print("Wrote macro_events.json")


def export_earnings():
    estats = json.loads((VAL_OUT / "earnings_stats.json").read_text())
    items = []
    for ticker, meta in WATCHLIST_META.items():
        s = estats.get(ticker, {})
        info_path = VAL_RAW / f"info_{ticker}.json"
        info = json.loads(info_path.read_text()) if info_path.exists() else {}
        px = load_px(ticker)
        last_close = float(px["Close"].iloc[-1])
        prev_close = float(px["Close"].iloc[-2]) if len(px) >= 2 else last_close
        last_chg = (last_close / prev_close - 1) if prev_close else 0.0
        last_date = str(px.index[-1].date())

        # Next timing from raw earn CSV
        raw_earn = pd.read_csv(VAL_RAW / f"earn_{ticker}.csv")
        raw_earn.columns = ["ts", "est", "eps", "surprise"]
        raw_earn["date"] = raw_earn["ts"].astype(str).str[:10]
        raw_earn["hour"] = raw_earn["ts"].astype(str).str[11:13].astype(int)
        next_date = s.get("next")
        next_timing = "待确认"
        if next_date:
            m = raw_earn[raw_earn["date"] == next_date]
            if len(m):
                next_timing = "盘后" if int(m["hour"].iloc[0]) >= 12 else "盘前"

        # Last 12 quarters full history
        react_df = pd.read_csv(VAL_OUT / f"earn_react_{ticker}.csv")
        quarters = []
        for _, r in react_df.tail(12).iterrows():
            quarters.append({
                "date": str(r["date"]),
                "timing": str(r["timing"]),
                "est": clean_num(r["est"], 2),
                "eps": clean_num(r["eps"], 2),
                "surprise_pct": clean_num(r["surprise_pct"], 2),
                "beat": None if pd.isna(r["beat"]) else bool(r["beat"]),
                "gap": clean_num(r["gap"]),
                "day1": clean_num(r["day1"]),
                "day5": clean_num(r["day5"]),
                "pre5": clean_num(r["pre5"]),
            })

        items.append({
            "ticker": ticker,
            "name_en": info.get("shortName") or ticker,
            "name_cn": meta["cn"],
            "sector": meta["sector"],
            "tag": meta["tag"],
            "market_cap_b": round((info.get("marketCap") or 0) / 1e9, 1) if info.get("marketCap") else None,
            "last_close": round(last_close, 2),
            "last_chg": round(last_chg, 4),
            "last_date": last_date,
            "next_date": next_date,
            "next_timing": next_timing,
            "next_est": clean_num(s.get("next_est"), 2),
            "small_sample": int(s.get("n", 0)) < 10,
            "stats": {
                "n": int(s.get("n", 0)),
                "first": s.get("first"),
                "last": s.get("last"),
                "beat_rate": clean_num(s.get("beat_rate")),
                "day1_mean": clean_num(s.get("day1_mean")),
                "day1_median": clean_num(s.get("day1_median")),
                "day1_up": clean_num(s.get("day1_up")),
                "abs_day1_mean": clean_num(s.get("abs_day1_mean")),
                "abs_day1_max": clean_num(s.get("abs_day1_max")),
                "normal_abs_day": clean_num(s.get("normal_abs_day")),
                "move_multiple": clean_num(s.get("move_multiple"), 2),
                "day5_mean": clean_num(s.get("day5_mean")),
                "beat_day1_up": clean_num(s.get("beat_day1_up")),
                "beat_but_down": int(s.get("beat_but_down", 0)),
            },
            "quarters": quarters,
        })

    items.sort(key=lambda x: x["next_date"] or "9999-12-31")
    (WEB_DATA / "earnings.json").write_text(json.dumps({"items": items}, ensure_ascii=False, indent=2))
    print("Wrote earnings.json", len(items))
    return items


def next_nfp_dates(after_date: date, count=4):
    """Next NFP release dates using BLS rule (3rd Fri after week containing 12th)."""
    out = []
    y, m = after_date.year, after_date.month - 1
    if m == 0:
        y, m = y - 1, 12
    while len(out) < count:
        d12 = date(y, m, 12)
        sat = d12 + timedelta(days=(5 - d12.weekday()) % 7)
        rel = sat + timedelta(days=20)
        if rel.month == 7 and rel.day == 4:
            rel = date(rel.year, 7, 3)
        elif rel.month == 7 and rel.day == 3:
            rel = date(rel.year, 7, 2)
        if rel >= after_date:
            out.append({"date": str(rel), "ref_month": f"{y}-{m:02d}"})
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


def export_upcoming(earnings_items):
    today = date.today()
    events = []

    # 1. Upcoming FOMC
    fomc_df = pd.read_csv(VAL_OUT / "events_fomc.csv", parse_dates=["date"])
    up_fomc = fomc_df[(~fomc_df["unscheduled"].astype(bool)) & (fomc_df["date"].dt.date >= today)].head(4)
    for _, r in up_fomc.iterrows():
        d = r["date"].date()
        events.append({
            "id": f"fomc-{d}",
            "type": "macro",
            "macro_key": "fomc",
            "title": "FOMC 议息",
            "date": str(d),
            "subtitle": "利率决议 · 按兵不动半导体 +0.65%",
            "importance": "high",
        })

    # 2. Upcoming NFP
    for item in next_nfp_dates(today, count=3):
        events.append({
            "id": f"nfp-{item['date']}",
            "type": "macro",
            "macro_key": "nfp",
            "title": "非农就业 NFP",
            "date": item["date"],
            "subtitle": f"{item['ref_month']} 数据 · 当天波动 1.3x",
            "importance": "high",
        })

    # 3. Upcoming Watchlist Earnings
    for e in earnings_items:
        if e["next_date"] and e["next_date"] >= str(today):
            amp = round((e["stats"]["abs_day1_mean"] or 0) * 100, 1)
            mult = e["stats"]["move_multiple"] or 0
            events.append({
                "id": f"earn-{e['ticker']}-{e['next_date']}",
                "type": "earnings",
                "ticker": e["ticker"],
                "title": f"{e['ticker']} 财报",
                "date": e["next_date"],
                "subtitle": f"{e['next_timing']} · 历史次日均振 {amp}% ({mult}x)",
                "importance": "high" if e["ticker"] in ("DELL", "MRVL", "AMD", "SMCI", "CRWV") else "medium",
            })

    events.sort(key=lambda x: x["date"])

    # Curated one-off catalysts (no fixed historical stats; event-tracking + analogy)
    catalysts = [
        {
            "id": "spacex-ipo",
            "title": "SpaceX / Starlink 上市进度追踪",
            "category": "超级科技 IPO",
            "status": "持续追踪",
            "analogy": "参考大型科技 IPO（Arm、Facebook、Snowflake）前后：上市前 1 个月同板块估值常被拉升，上市首周资金抽血效应明显。",
            "related_tickers": ["LITE", "GLW", "AMD", "CRWV"],
            "timeline": [
                {"date": "追踪项", "note": "关注 S-1 招股书递交、Starlink 分拆 vs 整体上市路径、估值锚定区间"},
                {"date": "板块映射", "note": "商业航天、卫星光通信、高算力地面站产业链"},
            ],
        },
        {
            "id": "anthropic-ipo",
            "title": "Anthropic（Claude）上市与融资动态",
            "category": "AI 独角兽 IPO",
            "status": "持续追踪",
            "analogy": "大模型龙头资本化直接验证 AI 基础设施 CapEx 持续性，对算力租赁、定制芯片与光模块情绪影响显著。",
            "related_tickers": ["CRWV", "NBIS", "MRVL", "DELL", "SMCI", "AMD"],
            "timeline": [
                {"date": "追踪项", "note": "关注 ARR 增速披露、云厂商算力大单（AWS / Google Cloud）及 IPO 时间表"},
                {"date": "板块映射", "note": "AI 云（CRWV / NBIS）、AI 服务器（DELL / SMCI）、定制芯片与光互联（MRVL / LITE / GLW）"},
            ],
        },
        {
            "id": "jensen-gtc",
            "title": "黄仁勋动态 & NVIDIA GTC 大会",
            "category": "产业领袖 / 发布会",
            "status": "年度重点（预计 2027年3月）",
            "analogy": "黄仁勋主题演讲与供应链点名往往直接触发 AI 硬件链（服务器、光模块、存储、液冷、AI 云）的短期重估。",
            "related_tickers": ["DELL", "SMCI", "CRWV", "NBIS", "SNDK", "GLW", "LITE", "MRVL"],
            "timeline": [
                {"date": "关注重点", "note": "下一代 GPU 架构节奏、CPO 共封装光学路线（影响 LITE/GLW/MRVL）、AI 存储与液冷方案"},
                {"date": "二期计划", "note": "接入新闻流与 AI 提炼，自动标记提及你自选股的演讲与采访"},
            ],
        },
    ]

    (WEB_DATA / "upcoming.json").write_text(json.dumps({
        "as_of": str(today),
        "events": events,
        "catalysts": catalysts,
    }, ensure_ascii=False, indent=2))
    print("Wrote upcoming.json", len(events))


def export_meta():
    px = load_px("^GSPC")
    meta = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "market_data_through": str(px.index[-1].date()),
        "sources": [
            {"name": "Yahoo Finance (yfinance)", "scope": "指数与 11 只自选股日线 + 财报", "status": "ok"},
            {"name": "美联储官网 (federalreserve.gov)", "scope": "1990-2027 FOMC 日期 + 利率决议", "status": "ok"},
            {"name": "BLS 官方日历规则", "scope": "1994-2026 非农发布日期", "status": "ok"},
            {"name": "CPI 宏观日历", "scope": "BLS 403 拦截，暂缓接入（后期补齐）", "status": "pending"},
            {"name": "AI 指引摘要 / X (@aleabitoreddit)", "scope": "第 2–3 期接入", "status": "planned"},
        ],
    }
    (WEB_DATA / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2))
    print("Wrote meta.json")


if __name__ == "__main__":
    export_macro()
    e_items = export_earnings()
    export_upcoming(e_items)
    export_meta()
