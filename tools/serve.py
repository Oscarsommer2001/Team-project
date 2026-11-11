#!/usr/bin/env python3
"""Open the local app from any working directory, without dependencies."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent.parent / "dist"
URL = "http://localhost:8000/"
MARKER = "unfuck-your-day-local"

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("X-Local-App", MARKER)
        super().end_headers()

def main():
    if not (ROOT / "index.html").is_file():
        print("Cannot find dist/index.html. Download or pull the complete project first.")
        return 1
    try:
        server = ThreadingHTTPServer(("127.0.0.1", 8000), partial(Handler, directory=str(ROOT)))
    except OSError as error:
        try:
            with urllib.request.urlopen(URL, timeout=2) as response:
                same_app = response.headers.get("X-Local-App") == MARKER
        except Exception:
            same_app = False
        if same_app:
            webbrowser.open(URL)
            print("The website is already running. Opened it in your browser.")
            return 0
        print("Port 8000 is unavailable. Stop the old server with Ctrl+C in its Terminal window, then try again.")
        print(str(error))
        return 1
    print("Opening " + URL, flush=True)
    print("Keep this window open while using the app. Press Ctrl+C to stop.", flush=True)
    webbrowser.open(URL)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nWebsite stopped. Run Start Website.command to open it again.")
    finally:
        server.server_close()
    return 0

if __name__ == "__main__":
    sys.exit(main())
