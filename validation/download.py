"""Download fresh market, earnings, and Federal Reserve calendar data into data/raw/.

Designed to run both locally and daily inside GitHub Actions (takes ~20 seconds).
Historical 1990-2020 FOMC dates are immutable and loaded from data/seed/fomc_hist_1990_2020.csv.
"""
import json
import sys
import time
from pathlib import Path

import pandas as pd
import requests
import yfinance as yf

RAW = Path(__file__).parent / "data" / "raw"
RAW.mkdir(parents=True, exist_ok=True)

INDICES = ["^GSPC", "^IXIC", "^NDX", "^VIX", "^SOX"]
WATCHLIST = ["SNDK", "DELL", "SMCI", "NBIS", "CRWV", "GLW", "AMD", "INTC",
             "LITE", "CRCL", "MRVL"]
UA = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

log = {}


def save_text(name, url, headers=UA):
    try:
        r = requests.get(url, headers=headers, timeout=30)
        if r.status_code == 200 and len(r.text) > 500:
            (RAW / name).write_text(r.text)
            log[name] = f"{r.status_code} {len(r.text)}B"
        else:
            log[name] = f"SKIP status={r.status_code} len={len(r.text)}"
    except Exception as e:  # noqa
        log[name] = f"ERR {e}"
    print(name, log[name], flush=True)


# 1. Index & stock daily prices ----------------------------------------
for t in INDICES + WATCHLIST:
    fn = f"px_{t.replace('^', 'IDX_')}.csv"
    try:
        df = yf.download(t, period="max", interval="1d", auto_adjust=False,
                         progress=False, threads=False)
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        if len(df):
            df.to_csv(RAW / fn)
            log[fn] = f"{len(df)} rows {df.index.min()} -> {df.index.max()}"
        else:
            log[fn] = "EMPTY (kept previous if any)"
    except Exception as e:  # noqa
        log[fn] = f"ERR {e}"
    print(t, log[fn], flush=True)
    time.sleep(0.35)

# 2. Earnings dates + EPS surprise + basic info ------------------------
for t in WATCHLIST:
    fn = f"earn_{t}.csv"
    try:
        tk = yf.Ticker(t)
        ed = tk.get_earnings_dates(limit=40)
        if ed is not None and len(ed):
            ed.to_csv(RAW / fn)
            log[fn] = f"{len(ed)} rows"
        else:
            log[fn] = "EMPTY (kept previous if any)"
        try:
            info = tk.info
            if info and info.get("shortName"):
                (RAW / f"info_{t}.json").write_text(json.dumps(
                    {k: info.get(k) for k in ["shortName", "longName", "sector", "industry",
                                              "marketCap", "exchange", "quoteType"]}
                ))
        except Exception as e:  # noqa
            log[f"info_{t}"] = f"ERR {e}"
    except Exception as e:  # noqa
        log[fn] = f"ERR {e}"
    print(fn, log[fn], flush=True)
    time.sleep(0.6)

# 3. Federal Reserve FOMC calendar (2021+) & target-rate table (2003+) -
save_text("fomc_current.html", "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm")
save_text("fed_openmarket.html", "https://www.federalreserve.gov/monetarypolicy/openmarket.htm")

(RAW / "_download_log.json").write_text(json.dumps(log, indent=1, default=str))
print("DONE", file=sys.stderr)
