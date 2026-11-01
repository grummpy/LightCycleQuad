#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required to launch Light Cycle Quad, but it was not found."
  echo "Install Python 3 from https://www.python.org/downloads/ and try again."
  read -r -p "Press Enter to close..."
  exit 1
fi
python3 server.py
status=$?
if [ "$status" -ne 0 ]; then
  echo
  echo "Light Cycle Quad stopped (exit $status)."
  read -r -p "Press Enter to close..."
fi
exit "$status"
