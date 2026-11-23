"""Parse raw downloads into clean event tables in data/out/events_*.csv."""
import re
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
from bs4 import BeautifulSoup

from common import RAW, OUT

MONTHS = {m: i for i, m in enumerate(
    ["january", "february", "march", "april", "may", "june", "july", "august",
     "september", "october", "november", "december"], 1)}


# ---------------------------------------------------------------- midterms
def midterms():
    rows = []
    for y in range(1950, date.today().year + 1):
        if y % 2 == 0 and y % 4 != 0:
            d = date(y, 11, 1)
            while d.weekday() != 0:  # first Monday
                d += timedelta(days=1)
            rows.append({"date": d + timedelta(days=1), "event": "midterm"})
    return pd.DataFrame(rows)


# ---------------------------------------------------------------- FOMC
def _parse_fomc_page(html: str, year_hint=None):
    """Return list of (date, is_unscheduled) for meetings on a Fed calendar page."""
    soup = BeautifulSoup(html, "lxml")
    out = []
    # Current calendar page: panels per year with month/date divs.
    for panel in soup.select("div.panel.panel-default"):
        h = panel.find(["h4", "h5"])
        m = re.search(r"(19|20)\d{2}", h.get_text() if h else "")
        if not m:
            continue
        year = int(m.group(0))
        for row in panel.select("div.fomc-meeting"):
            mon = row.select_one(".fomc-meeting__month")
            day = row.select_one(".fomc-meeting__date")
            if not (mon and day):
                continue
            out += _mk(year, mon.get_text(" ", strip=True), day.get_text(" ", strip=True),
                       row.get_text(" ", strip=True))
    if out:
        return out
    # Historical pages: headings like "January 31-February 1 Meeting - 2006"
    text = soup.get_text("\n")
    for m in re.finditer(
            r"([A-Z][a-z]+)\s+(\d{1,2})(?:\s*[-–]\s*(?:([A-Z][a-z]+)\s+)?(\d{1,2}))?"
            r"\s+(Meeting|\(unscheduled\)|Conference Call)[^\n]*?[-–]\s*((?:19|20)\d{2})",
            text):
        m1, d1, m2, d2, kind, yr = m.groups()
        if m1.lower() not in MONTHS:
            continue
        mon_end = (m2 or m1).lower()
        day_end = int(d2 or d1)
        if mon_end not in MONTHS:
            continue
        y = int(yr)
        try:
            dt = date(y, MONTHS[mon_end], day_end)
        except ValueError:
            continue
        unsched = "unscheduled" in m.group(0).lower() or kind == "Conference Call"
        out.append((dt, unsched))
    return out


def _mk(year, mon_txt, day_txt, full_txt):
    mons = [x for x in re.split(r"[/\s]+", mon_txt.lower()) if x]
    mons = [x for x in mons if x[:3] in [k[:3] for k in MONTHS]]
    days = re.findall(r"\d{1,2}", day_txt)
    if not mons or not days:
        return []
    mon = mons[-1]
    mnum = [v for k, v in MONTHS.items() if k[:3] == mon[:3]][0]
    try:
        dt = date(year, mnum, int(days[-1]))
    except ValueError:
        return []
    unsched = "unscheduled" in full_txt.lower() or "notation vote" in full_txt.lower()
    return [(dt, unsched)]


def fomc():
    meets = []
    seed_csv = RAW.parent / "seed" / "fomc_hist_1990_2020.csv"
    if seed_csv.exists():
        sd = pd.read_csv(seed_csv, parse_dates=["date"])
        meets += [(d.date(), bool(u)) for d, u in zip(sd["date"], sd["unscheduled"])]
    else:
        for f in sorted(RAW.glob("fomc_hist_*.html")):
            meets += _parse_fomc_page(f.read_text(errors="ignore"))
    cur = RAW / "fomc_current.html"
    if cur.exists():
        meets += _parse_fomc_page(cur.read_text(errors="ignore"))
    df = pd.DataFrame(meets, columns=["date", "unscheduled"]).drop_duplicates("date")
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")
    # Decisions from the Fed's open-market table (complete from 2003 onwards).
    ch = _openmarket_changes()
    df["change_bp"] = None
    for _, c in ch.iterrows():
        # table lists the *effective* date (usually the day after the announcement)
        m = df[(df["date"] <= c["eff"]) & (df["date"] >= c["eff"] - pd.Timedelta(days=3))]
        if len(m):
            df.loc[m.index[-1], "change_bp"] = c["bp"]
    today_ts = pd.Timestamp.today().normalize()
    known = (df["date"] >= "2003-01-01") & (df["date"] <= today_ts)
    df.loc[known & df["change_bp"].isna(), "change_bp"] = 0
    df["decision"] = df["change_bp"].map(
        lambda x: None if x is None or pd.isna(x) else ("hike" if x > 0 else ("cut" if x < 0 else "hold")))
    df["event"] = "fomc"
    return df


def _openmarket_changes():
    soup = BeautifulSoup((RAW / "fed_openmarket.html").read_text(errors="ignore"), "lxml")
    rows = []
    for t in soup.find_all("table"):
        yr = int(t.find_previous(["h3", "h4", "h5", "strong", "caption", "p"]).get_text(strip=True)[:4])
        for tr in t.find_all("tr")[1:]:
            cells = [c.get_text(" ", strip=True) for c in tr.find_all(["td", "th"])]
            if len(cells) < 3:
                continue
            mon, day = cells[0].split()[0], re.findall(r"\d+", cells[0])[0]
            eff = pd.Timestamp(date(yr, MONTHS[mon.lower()], int(day)))
            def num(s):
                n = re.findall(r"\d+", s or "")
                return float(n[-1]) if n else 0.0
            inc, dec = num(cells[1]), num(cells[2])
            rows.append({"eff": eff, "bp": inc - dec, "level": cells[3] if len(cells) > 3 else None})
    return pd.DataFrame(rows).sort_values("eff")


def _target_rate():
    a = pd.read_csv(RAW / "fred_DFEDTAR.csv")
    b = pd.read_csv(RAW / "fred_DFEDTARU.csv")
    a.columns = ["date", "rate"]
    b.columns = ["date", "rate"]
    s = pd.concat([a, b])
    s["date"] = pd.to_datetime(s["date"])
    s["rate"] = pd.to_numeric(s["rate"], errors="coerce")
    return s.dropna().drop_duplicates("date", keep="last").set_index("date")["rate"].sort_index()


def _rate_at(s, d):
    s2 = s[s.index <= d]
    return s2.iloc[-1] if len(s2) else None


# ---------------------------------------------------------------- BLS release dates
def _bls_archive(fn, event):
    f = RAW / fn
    if not f.exists():
        return pd.DataFrame(columns=["date", "event"])
    html = f.read_text(errors="ignore")
    rows = []
    # archive entries look like: "... for October 2024  (HTML) (PDF)" + release date in link path
    # BLS archive links: /news.release/archives/empsit_11012024.htm  (MMDDYYYY)
    for m in re.finditer(r"archives/%s_(\d{2})(\d{2})(\d{4})\.(?:htm|pdf)" % (
            "empsit" if event == "nfp" else "cpi"), html):
        mm, dd, yy = map(int, m.groups())
        try:
            rows.append({"date": date(yy, mm, dd), "event": event})
        except ValueError:
            pass
    df = pd.DataFrame(rows).drop_duplicates()
    if len(df):
        df["date"] = pd.to_datetime(df["date"])
    return df.sort_values("date") if len(df) else df


def nfp_rule_dates(start=1994, end=None):
    """BLS rule: released on the 3rd Friday after the week (Sun-Sat) containing the 12th.

    Plus known exceptions (holidays, government shutdowns). Dates after today
    are dropped.
    """
    if end is None:
        end = date.today().year + 1
    overrides = {  # ref_month -> actual release date (None = no separate release)
        "2013-09": date(2013, 10, 22), "2013-10": date(2013, 11, 8),   # 2013 shutdown
        "2025-09": date(2025, 11, 20), "2025-10": None,                # 2025 shutdown
        "2025-11": date(2025, 12, 16),
    }
    rows = []
    for y in range(start, end + 1):
        for m in range(1, 13):
            d12 = date(y, m, 12)
            sat = d12 + timedelta(days=(5 - d12.weekday()) % 7)
            rel = sat + timedelta(days=20)
            if rel.month == 7 and rel.day == 4:      # Independence Day -> Thursday
                rel = date(rel.year, 7, 3)
            elif rel.month == 7 and rel.day == 3:    # July 4 on Saturday, observed Fri
                rel = date(rel.year, 7, 2)
            key = f"{y}-{m:02d}"
            if key in overrides:
                rel = overrides[key]
                if rel is None:
                    continue
            rows.append({"date": rel, "ref_month": key, "event": "nfp"})
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    return df[df["date"] <= pd.Timestamp.today().normalize()]


if __name__ == "__main__":
    mt = midterms()
    mt.to_csv(OUT / "events_midterm.csv", index=False)
    print("midterm", len(mt))

    fo = fomc()
    fo.to_csv(OUT / "events_fomc.csv", index=False)
    print("fomc", len(fo), fo["date"].min(), fo["date"].max())
    print(fo["decision"].value_counts())

    nfp = nfp_rule_dates()
    nfp.to_csv(OUT / "events_nfp.csv", index=False)
    print("nfp (rule-based)", len(nfp))
