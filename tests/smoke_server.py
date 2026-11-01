#!/usr/bin/env python3
"""Headless check that server.py serves the game."""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def fetch(port: int, path: str) -> bytes:
    with urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=2) as res:
        if res.status != 200:
            raise SystemExit(f"{path} returned {res.status}")
        return res.read()


def main() -> None:
    port = free_port()
    proc = subprocess.Popen(
        [sys.executable, os.path.join(ROOT, "server.py"), "--no-browser", "--port", str(port)],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        deadline = time.time() + 5
        page = None
        last_error = "timed out"
        while time.time() < deadline:
            if proc.poll() is not None:
                output = proc.stdout.read() if proc.stdout else ""
                raise SystemExit(f"server exited early:\n{output}")
            try:
                page = fetch(port, "/index.html")
                break
            except Exception as exc:  # server may still be binding
                last_error = str(exc)
                time.sleep(0.05)
        if page is None:
            raise SystemExit(f"index.html was not served: {last_error}")
        if b"<canvas" not in page or b"src/ui/main.js" not in page:
            raise SystemExit("index.html is missing the canvas or module script")
        if b"Light Cycle Quad" not in page:
            raise SystemExit("index.html is missing the game title")

        script = fetch(port, "/src/ui/main.js")
        if b"requestAnimationFrame" not in script:
            raise SystemExit("main.js was not served")
        manifest = fetch(port, "/arcade.json")
        if b"lightcyclequad" not in manifest:
            raise SystemExit("arcade.json was not served")
        print("smoke ok")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=3)


if __name__ == "__main__":
    main()
