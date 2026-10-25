import os
import json
import time
import asyncio
from pathlib import Path
import aiohttp
from aiohttp import web

BASE_DIR = Path(__file__).parent.resolve()
DATA_DIR = BASE_DIR / "data"
PUBLIC_DIR = BASE_DIR / "public"
CACHE_FILE = DATA_DIR / "cache_database.json"

BOT_API_URL = os.environ.get("BOT_API_URL", "http://127.0.0.1:5055/api/sync")
SYNC_INTERVAL = 5  # секунд (по ТЗ: сбор данных каждые 5 сек)
PORT = int(os.environ.get("PORT", 3000))

# Внутреннее состояние сайта
app_state = {
    "bot_online": False,
    "last_sync": 0,
    "live_data": None,
    "mode": "init",
}


def load_cached_data() -> dict:
    """Загружает сохраненную последнюю базу данных с диска."""
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                data["bot_online"] = False
                data["is_cached"] = True
                return data
        except Exception as e:
            print(f"[CACHE] Ошибка чтения кэша: {e}")

    # Пустая заготовка если кэша еще нет
    return {
        "bot_online": False,
        "is_cached": True,
        "timestamp": int(time.time()),
        "stats": {
            "total_users": 0,
            "total_coins": 0,
            "total_stars": 0.0,
            "total_voice_minutes": 0,
        },
        "users": [],
        "leaderboard": {
            "coins": [],
            "stars": [],
            "factor": [],
            "level": [],
            "voice": [],
        },
        "market": [],
    }


def save_cached_data(data: dict):
    """Сохраняет активную базу данных на диск для оффлайн-режима."""
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        # Атомарное сохранение через временный файл
        tmp_file = CACHE_FILE.with_suffix(".tmp")
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        tmp_file.replace(CACHE_FILE)
    except Exception as e:
        print(f"[CACHE] Ошибка записи кэша: {e}")


async def sync_worker():
    """Фоновый воркер: опрашивает бота каждые 5 секунд."""
    print(f"[SYNC_WORKER] Запущен мониторинг бота ({BOT_API_URL}) с интервалом {SYNC_INTERVAL} сек.")
    timeout = aiohttp.ClientTimeout(total=2.5)

    async with aiohttp.ClientSession(timeout=timeout) as session:
        while True:
            try:
                async with session.get(BOT_API_URL) as resp:
                    if resp.status == 200:
                        fresh_data = await resp.json()
                        fresh_data["bot_online"] = True
                        fresh_data["is_cached"] = False
                        fresh_data["last_sync"] = int(time.time())

                        # Бот подключен: старая база заменяется новой активной
                        app_state["live_data"] = fresh_data
                        app_state["bot_online"] = True
                        app_state["last_sync"] = int(time.time())
                        app_state["mode"] = "live"

                        # Сохраняем свежий срез на диск
                        save_cached_data(fresh_data)
                    else:
                        raise Exception(f"HTTP {resp.status}")
            except asyncio.CancelledError:
                break
            except Exception:
                # Бот выключен или недоступен: сохраняем последнюю сохраненную базу
                if app_state["bot_online"]:
                    print("[SYNC_WORKER] ⚠️ Бот отключен! Переход в автономный режим с последней сохраненной базой.")
                app_state["bot_online"] = False
                app_state["mode"] = "cached"

                # Если live_data еще не было, читаем сохраненную с диска
                if app_state["live_data"] is None:
                    app_state["live_data"] = load_cached_data()
                else:
                    app_state["live_data"]["bot_online"] = False
                    app_state["live_data"]["is_cached"] = True

            await asyncio.sleep(SYNC_INTERVAL)


# ===================== HTTP HANDLERS =====================

def cors_headers(response: web.Response) -> web.Response:
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


async def handle_options(request):
    return cors_headers(web.Response(status=204))


async def api_status(request):
    """Возвращает статус подключения бота и параметры синхронизации."""
    data = {
        "bot_online": app_state["bot_online"],
        "mode": app_state["mode"],
        "last_sync": app_state["last_sync"],
        "sync_interval_seconds": SYNC_INTERVAL,
        "users_count": len(app_state["live_data"].get("users", [])) if app_state["live_data"] else 0,
        "server_time": int(time.time()),
    }
    return cors_headers(web.json_response(data))


async def api_sync(request):
    """Возвращает полную активную (или сохраненную) базу данных для фронтенда."""
    data = app_state["live_data"] or load_cached_data()
    return cors_headers(web.json_response(data))


async def api_users(request):
    """Список пользователей с поиском и фильтрацией."""
    data = app_state["live_data"] or load_cached_data()
    users = list(data.get("users", []))

    query = request.query.get("q", "").strip().lower()
    color_filter = request.query.get("color", "").strip().lower()
    sort_by = request.query.get("sort", "coins")

    if query:
        users = [
            u for u in users
            if query in u.get("username", "").lower()
            or query in u.get("display_name", "").lower()
            or query in str(u.get("gen_number", "")).lower()
        ]

    if color_filter:
        users = [
            u for u in users
            if color_filter in str(u.get("gen_color", "")).lower()
        ]

    if sort_by == "stars":
        users.sort(key=lambda x: float(x.get("stars", 0.0) or 0.0), reverse=True)
    elif sort_by == "factor":
        users.sort(key=lambda x: float(x.get("factor", 60) or 60), reverse=True)
    elif sort_by == "level":
        users.sort(key=lambda x: (int(x.get("level", 1) or 1), int(x.get("experience", 0) or 0)), reverse=True)
    elif sort_by == "voice":
        users.sort(key=lambda x: int(x.get("voice_minutes", 0) or 0), reverse=True)
    else:  # default 'coins'
        users.sort(key=lambda x: int(x.get("coins", 0) or 0), reverse=True)

    return cors_headers(web.json_response({"total": len(users), "users": users}))


async def api_top(request):
    """Топ пользователей по категориям."""
    data = app_state["live_data"] or load_cached_data()
    leaderboards = data.get("leaderboard", {})
    return cors_headers(web.json_response(leaderboards))


async def api_user_detail(request):
    """Детальная информация об одном пользователе по ID."""
    uid_str = request.match_info.get("id", "0")
    try:
        target_id = int(uid_str)
        data = app_state["live_data"] or load_cached_data()
        user = next((u for u in data.get("users", []) if u.get("user_id") == target_id), None)
        if user:
            return cors_headers(web.json_response(user))
        return cors_headers(web.json_response({"error": "User not found"}, status=404))
    except Exception as e:
        return cors_headers(web.json_response({"error": str(e)}, status=500))


async def index_handler(request):
    """Отдает главную страницу сайта."""
    index_file = PUBLIC_DIR / "index.html"
    if index_file.exists():
        return web.FileResponse(index_file)
    return web.Response(text="<h1>KREIT · GENY NETWORK</h1><p>Frontend assets not found.</p>", content_type="text/html")


def init_app():
    # Загружаем сохраненный кэш при старте
    app_state["live_data"] = load_cached_data()
    app_state["last_sync"] = app_state["live_data"].get("timestamp", 0)

    app = web.Application()

    app.router.add_options("/{tail:.*}", handle_options)
    app.router.add_get("/", index_handler)

    # API
    app.router.add_get("/api/status", api_status)
    app.router.add_get("/api/sync", api_sync)
    app.router.add_get("/api/users", api_users)
    app.router.add_get("/api/top", api_top)
    app.router.add_get("/api/user/{id}", api_user_detail)

    # Статика
    if (PUBLIC_DIR / "css").exists():
        app.router.add_static("/css", PUBLIC_DIR / "css")
    if (PUBLIC_DIR / "js").exists():
        app.router.add_static("/js", PUBLIC_DIR / "js")
    if (PUBLIC_DIR / "assets").exists():
        app.router.add_static("/assets", PUBLIC_DIR / "assets")

    # Регистрируем фоновый опрос раз в 5 сек
    async def start_background_tasks(application):
        application["sync_task"] = asyncio.create_task(sync_worker())

    async def cleanup_background_tasks(application):
        application["sync_task"].cancel()
        try:
            await application["sync_task"]
        except asyncio.CancelledError:
            pass

    app.on_startup.append(start_background_tasks)
    app.on_cleanup.append(cleanup_background_tasks)

    return app


if __name__ == "__main__":
    print(f"🚀 Запуск веб-сервера KREIT на порту {PORT}...")
    web.run_app(init_app(), host="0.0.0.0", port=PORT)
