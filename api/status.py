from http.server import BaseHTTPRequestHandler
import json
import time
import os
import urllib.request
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
CACHE_FILE = BASE_DIR / "data" / "cache_database.json"

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        bot_url = os.environ.get("BOT_API_URL", "http://127.0.0.1:5055/api/status")
        is_online = False
        bot_name = "GENY"

        if bot_url:
            try:
                req = urllib.request.Request(bot_url, headers={"User-Agent": "Vercel-KREIT"})
                with urllib.request.urlopen(req, timeout=1.8) as response:
                    if response.status == 200:
                        st = json.loads(response.read().decode("utf-8"))
                        is_online = True
                        bot_name = st.get("bot", "GENY")
            except Exception:
                pass

        users_count = 0
        if CACHE_FILE.exists():
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    c = json.load(f)
                    users_count = len(c.get("users", []))
            except Exception:
                pass

        res = {
            "bot_online": is_online,
            "bot_name": bot_name,
            "users_count": users_count,
            "sync_interval_seconds": 5,
            "server_time": int(time.time()),
        }

        body = json.dumps(res, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)
