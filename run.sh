#!/usr/bin/env bash
# The same app with the headers off, then on.
#
#   ./run.sh
#
# Needs Node 22 and Google Chrome. No Docker, no backend.
set -uo pipefail
cd "$(dirname "$0")"
echo ""
echo "  [1/2] THE APP AS IT IS SERVED BY DEFAULT"
echo ""
node run.mjs
echo "  [2/2] THE SAME APP, WITH THE HEADERS SET"
echo ""
HARDENED=true node run.mjs
