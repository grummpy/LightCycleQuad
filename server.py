#!/usr/bin/env python3
"""Serve Light Cycle Quad on localhost and open a browser.

Uses only the Python 3 standard library. The default port comes from
arcade.json (8806). If that port is taken, the next free port is used.
"""

from __future__ import annotations

import argparse
import mimetypes
import os
import socket
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PORT = 8806
MAX_TRIES = 20

mimetypes.add_type("text/javascript", ".js", strict=True)
mimetypes.add_type("application/json", ".json", strict=True)
mimetypes.add_type("image/jpeg", ".jpg", strict=True)


def port_is_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def pick_port(start: int) -> int:
    for offset in range(MAX_TRIES):
        port = start + offset
        if port > 65535:
            break
        if port_is_free(port):
            return port
    raise SystemExit(
        f"No free port found from {start} through {start + MAX_TRIES - 1}."
    )


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Serve Light Cycle Quad locally.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="port to try first")
    parser.add_argument("--no-browser", action="store_true", help="do not open a browser")
    args = parser.parse_args(argv)

    port = pick_port(args.port)
    if port != args.port:
        print(f"Port {args.port} is busy; using {port} instead.", flush=True)

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=ROOT, **kwargs)

        def end_headers(self):
            self.send_header("Cache-Control", "no-cache")
            super().end_headers()

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}/"
    print(f"Light Cycle Quad is running at {url}", flush=True)
    print("Press Ctrl+C to stop.", flush=True)
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
