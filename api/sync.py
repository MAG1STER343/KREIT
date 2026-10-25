from http.server import BaseHTTPRequestHandler
import json
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
        bot_url = os.environ.get("BOT_API_URL", "http://127.0.0.1:5055/api/sync")
        data = None

        # 1. Пробуем получить свежие данные с бота если задан BOT_API_URL
        if bot_url:
            try:
                req = urllib.request.Request(bot_url, headers={"User-Agent": "Vercel-KREIT"})
                with urllib.request.urlopen(req, timeout=2.0) as response:
                    if response.status == 200:
                        data = json.loads(response.read().decode("utf-8"))
                        data["bot_online"] = True
                        data["is_cached"] = False
            except Exception:
                pass

        # 2. Если бот недоступен, отдаем сохраненный кэш
        if not data:
            if CACHE_FILE.exists():
                try:
                    with open(CACHE_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        data["bot_online"] = False
                        data["is_cached"] = True
                except Exception:
                    pass

        if not data:
            data = {"bot_online": False, "is_cached": True, "users": [], "leaderboard": {}, "stats": {}}

        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "s-maxage=5, stale-while-revalidate")
        self.end_headers()
        self.wfile.write(body)
