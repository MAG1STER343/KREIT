const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    const botUrl = process.env.BOT_API_URL;
    let data = null;

    if (botUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const resp = await fetch(botUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (resp.ok) {
                data = await resp.json();
                data.bot_online = true;
                data.is_cached = false;
            }
        } catch (e) {
            // bot offline
        }
    }

    if (!data) {
        try {
            const cachePath = path.join(process.cwd(), 'data', 'cache_database.json');
            if (fs.existsSync(cachePath)) {
                data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
                data.bot_online = false;
                data.is_cached = true;
            }
        } catch (e) {
            // fallback
        }
    }

    if (!data) {
        data = { bot_online: false, is_cached: true, users: [], leaderboard: {}, stats: {} };
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');
    return res.status(200).json(data);
};
