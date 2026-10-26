const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            body = {};
        }
    }
    body = body || {};

    const quickCode = String(body.quick_code || '').trim();
    const botUrl = process.env.BOT_API_URL;

    // 1. Попытка перенаправить на бота, если BOT_API_URL доступен
    if (botUrl) {
        try {
            const loginUrl = botUrl.replace(/\/sync\/?$/, '/login');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);
            const botResp = await fetch(loginUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (botResp.ok) {
                const data = await botResp.json();
                return res.status(200).json(data);
            }
        } catch (e) {
            // bot unavailable, fallback to cache
        }
    }

    if (quickCode) {
        return res.status(400).json({
            success: false,
            error: 'Для входа по быстрому коду бот должен быть онлайн или используйте вход по логину и паролю.'
        });
    }

    const loginInput = String(body.username || '').trim().toLowerCase().replace(/^@/, '');
    const passwordInput = String(body.password || '').trim();

    if (!loginInput) {
        return res.status(400).json({ success: false, error: 'Введите Discord юзернейм' });
    }

    if (!passwordInput || passwordInput.length !== 4 || !/^\d{4}$/.test(passwordInput)) {
        return res.status(400).json({ success: false, error: 'Пароль GENY должен состоять ровно из 4 цифр' });
    }

    // 2. Проверка по локальному снимку базы данных
    let matchedUser = null;
    try {
        const cachePath = path.join(process.cwd(), 'data', 'cache_database.json');
        if (fs.existsSync(cachePath)) {
            const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            const users = cache.users || [];
            for (const u of users) {
                const uPass = String(u.gen_password || '').trim();
                const uName = String(u.username || '').toLowerCase().replace(/^@/, '');
                const uDisp = String(u.display_name || '').toLowerCase().replace(/^@/, '');
                const uDisc = String(u.discord_username || '').toLowerCase().replace(/^@/, '');
                const uSite = String(u.site_username || '').toLowerCase().replace(/^@/, '');
                const uId = String(u.user_id || '');

                if (uPass === passwordInput && (loginInput === uName || loginInput === uDisp || loginInput === uDisc || loginInput === uSite || loginInput === uId)) {
                    matchedUser = { ...u };
                    break;
                }
            }
        }
    } catch (e) {}

    if (!matchedUser) {
        return res.status(401).json({
            success: false,
            error: 'Неверный юзернейм или 4-значный пароль! Убедитесь, что вы создали пароль в Discord боте через команду /профиль -> GENY.'
        });
    }

    delete matchedUser.gen_password;
    const token = `kreit_${matchedUser.user_id}_${Math.floor(Date.now() / 1000)}`;

    return res.status(200).json({
        success: true,
        token: token,
        user: matchedUser
    });
};
