#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="$ROOT/validation/.venv/bin/python"

echo "[1/4] Downloading latest market & Fed data..."
"$PY" "$ROOT/validation/download.py"
echo "[2/4] Rebuilding macro event dates & statistics..."
"$PY" "$ROOT/validation/build_events.py"
"$PY" "$ROOT/validation/analyze_events.py" --no-plot >/dev/null
echo "[3/4] Rebuilding watchlist earnings reactions..."
"$PY" "$ROOT/validation/analyze_earnings.py" >/dev/null
echo "[4/4] Exporting JSON for web app..."
"$PY" "$ROOT/scripts/export_web_data.py"
echo "Done! Fresh data written to $ROOT/web/public/data/"
