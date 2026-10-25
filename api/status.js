const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(204).end();

    const botUrl = process.env.BOT_API_URL;
    let isOnline = false;
    let botName = 'GENY';

    if (botUrl) {
        try {
            const statusUrl = botUrl.replace(/\/sync\/?$/, '/status');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1800);
            const resp = await fetch(statusUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (resp.ok) {
                const st = await resp.json();
                isOnline = true;
                botName = st.bot || 'GENY';
            }
        } catch (e) {}
    }

    let usersCount = 0;
    try {
        const cachePath = path.join(process.cwd(), 'data', 'cache_database.json');
        if (fs.existsSync(cachePath)) {
            const c = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            usersCount = (c.users || []).length;
        }
    } catch (e) {}

    return res.status(200).json({
        bot_online: isOnline,
        bot_name: botName,
        users_count: usersCount,
        sync_interval_seconds: 5,
        server_time: Math.floor(Date.now() / 1000)
    });
};
