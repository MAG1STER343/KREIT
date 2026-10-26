/**
 * KREIT · GENY NETWORK
 * Frontend Application & Real-Time 5-Second Bot Synchronization
 */

(function () {
    let globalData = null;
    let currentTab = "leaderboard";
    let currentLeaderFilter = "coins";
    let searchQuery = "";
    let selectedColor = "all";
    let sortBy = "coins";

    // Current authorized user (saved in localStorage)
    let currentUser = null;
    try {
        const savedAuth = localStorage.getItem("kreit_auth_user");
        if (savedAuth) {
            currentUser = JSON.parse(savedAuth);
        }
    } catch (e) {
        currentUser = null;
    }

    // Shield emoji mapper
    function getShieldPath(factor) {
        const f = parseFloat(factor || 60);
        if (f <= 30.0) return "/assets/emojis/shield_red.png";
        if (f < 50.0) return "/assets/emojis/shield_orange.png";
        return "/assets/emojis/shield_green.png";
    }

    function formatNumber(num) {
        if (num === null || num === undefined) return "0";
        return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }

    function formatStars(val) {
        const f = parseFloat(val || 0);
        return f % 1 !== 0 ? f.toFixed(1) : Math.floor(f).toString();
    }

    function getGenColorHex(val) {
        if (!val) return "#00d2ff";
        if (typeof val === "string" && val.startsWith("#")) return val;
        const intVal = parseInt(val, 10);
        if (isNaN(intVal)) return "#00d2ff";
        return "#" + intVal.toString(16).padStart(6, "0");
    }

    // ================== DATA FETCHING & CONTINUOUS CONNECTION ==================
    let isFetching = false;

    async function fetchSyncData() {
        if (isFetching) return;
        isFetching = true;

        let data = null;
        let isDirect = false;

        // 1. Попытка прямого соединения с ботом (http://127.0.0.1:5055/api/sync)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1200);
            const directResp = await fetch("http://127.0.0.1:5055/api/sync", { signal: controller.signal });
            clearTimeout(timeoutId);
            if (directResp.ok) {
                data = await directResp.json();
                data.bot_online = true;
                data.is_cached = false;
                isDirect = true;
            }
        } catch (e) {
            // direct failed
        }

        // 2. Обращение через сервер API
        if (!data) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                const resp = await fetch("/api/sync", { signal: controller.signal });
                clearTimeout(timeoutId);
                if (resp.ok) {
                    data = await resp.json();
                }
            } catch (e) {
                console.warn("[SYNC] Запрос к API не ответил:", e);
            }
        }

        if (data) {
            globalData = data;
            const online = Boolean(data.bot_online || isDirect);
            updateStatusBadge(online, data.last_sync, data.is_cached);
            updateStatsOverview(data.stats, data.users);
            syncCurrentUserData();
            renderActiveView();
        } else {
            updateStatusBadge(false, 0, true);
        }

        isFetching = false;
    }

    function syncCurrentUserData() {
        if (!currentUser || !globalData || !globalData.users) return;
        const fresh = globalData.users.find(u => String(u.user_id) === String(currentUser.user_id));
        if (fresh) {
            currentUser = { ...currentUser, ...fresh };
            try {
                localStorage.setItem("kreit_auth_user", JSON.stringify(currentUser));
            } catch (e) {}
            renderAuthHeroBanner();
        }
    }

    function renderAuthHeroBanner() {
        const hero = document.getElementById("auth-user-hero");
        const loginBtn = document.getElementById("btn-open-login");
        const loginLabel = document.getElementById("btn-login-label");
        if (!hero) return;

        if (!currentUser) {
            hero.style.display = "none";
            if (loginBtn) loginBtn.classList.remove("logged-in");
            if (loginLabel) loginLabel.innerText = "ВОЙТИ";
            return;
        }

        const hex = getGenColorHex(currentUser.gen_color_value);
        hero.style.display = "block";
        hero.style.setProperty("--user-hero-color", hex);

        if (loginBtn) loginBtn.classList.add("logged-in");
        if (loginLabel) loginLabel.innerText = currentUser.display_name || currentUser.username || "ПРОФИЛЬ";

        const genNum = currentUser.gen_number || "—";
        const genBig = document.getElementById("auth-hero-gen-big");
        if (genBig) {
            genBig.innerHTML = `GEN ${escapeHtml(genNum)}`;
            genBig.style.color = hex;
            genBig.style.textShadow = `0 0 25px ${hex}`;
        }

        const nameEl = document.getElementById("auth-hero-name");
        if (nameEl) nameEl.innerText = currentUser.display_name || currentUser.username || "Пользователь";

        const loginEl = document.getElementById("auth-hero-login");
        if (loginEl) loginEl.innerText = `@${currentUser.site_username || currentUser.discord_username || currentUser.username}`;

        const colorEl = document.getElementById("auth-hero-color");
        if (colorEl) {
            colorEl.innerText = currentUser.gen_color || "Цвет GEN";
            colorEl.style.color = hex;
        }

        const avatarEl = document.getElementById("auth-hero-avatar");
        if (avatarEl) {
            avatarEl.src = currentUser.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png";
            avatarEl.style.borderColor = hex;
            avatarEl.style.boxShadow = `0 0 20px ${hex}88`;
        }

        const coinsEl = document.getElementById("auth-hero-coins");
        if (coinsEl) coinsEl.innerText = `${formatNumber(currentUser.coins)} G.COIN`;

        const starsEl = document.getElementById("auth-hero-stars");
        if (starsEl) starsEl.innerText = `${formatStars(currentUser.stars)} ⭐`;

        const voiceEl = document.getElementById("auth-hero-voice");
        if (voiceEl) {
            const vMins = currentUser.voice_minutes || 0;
            const h = Math.floor(vMins / 60);
            const m = vMins % 60;
            voiceEl.innerText = `${h} ч ${m} мин`;
        }

        const factorEl = document.getElementById("auth-hero-factor-num");
        if (factorEl) factorEl.innerText = `${parseFloat(currentUser.factor || 60).toFixed(1)} / 120`;

        const shieldEl = document.getElementById("auth-hero-shield");
        if (shieldEl) shieldEl.src = getShieldPath(currentUser.factor);

        const lvlEl = document.getElementById("auth-hero-level");
        if (lvlEl) {
            const streak = currentUser.activity_streak_days || 0;
            lvlEl.innerText = `LVL ${currentUser.level || 1} • 🔥 ${streak} дн.`;
        }
    }

    // ================== CYBER TEXT SCRAMBLE ANIMATION (1 СЕКУНДА) ==================
    let isScrambling = false;
    function runTextScrambleAnimation(durationMs = 1000) {
        if (isScrambling) return;
        isScrambling = true;

        const glyphs = "01010101ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!<>-_\\/[]{}—=+*^?#%&@";
        const selectors = [
            ".brand-title", ".brand-sub", ".stat-label", ".stat-value",
            ".tab-btn", ".pill-filter", ".panel-header-title", ".tech-table th",
            ".podium-name", ".podium-rank-pill", ".podium-rank-label", ".podium-score-val",
            ".auth-hero-gen-big", ".hero-stat-label", ".hero-stat-val",
            ".table-user-name", ".table-user-sub", ".uwh-username", ".uwh-metric-val"
        ];

        const elements = document.querySelectorAll(selectors.join(", "));
        const targets = [];

        elements.forEach(el => {
            const txt = (el.innerText || "").trim();
            if (txt.length > 0 && el.children.length === 0) {
                targets.push({
                    el: el,
                    text: txt,
                    length: txt.length
                });
            }
        });

        if (targets.length === 0) {
            isScrambling = false;
            return;
        }

        const startTime = performance.now();

        function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / durationMs);

            targets.forEach(item => {
                const resolved = Math.floor(progress * item.length);
                let out = "";
                for (let i = 0; i < item.length; i++) {
                    const originalChar = item.text[i];
                    if (i < resolved || originalChar === " " || originalChar === "\n" || originalChar === "•" || originalChar === "⭐" || originalChar === "🔥" || originalChar === "🛡️" || originalChar === "🪙") {
                        out += originalChar;
                    } else {
                        out += glyphs[Math.floor(Math.random() * glyphs.length)];
                    }
                }
                item.el.innerText = out;
            });

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                targets.forEach(item => {
                    item.el.innerText = item.text;
                });
                isScrambling = false;
            }
        }

        requestAnimationFrame(step);
    }

    function updateStatusBadge(isOnline, lastSync, isCached) {
        const badge = document.getElementById("bot-status-badge");
        const statusText = document.getElementById("bot-status-text");
        const syncTimer = document.getElementById("sync-timer-text");

        if (isOnline) {
            badge.className = "status-pill online";
            statusText.innerText = "БОТ В СЕТИ";
            syncTimer.innerText = "• Непрерывное подключение (3с)";
        } else {
            badge.className = "status-pill offline";
            statusText.innerText = "ПОИСК СИГНАЛА БОТА...";
            syncTimer.innerText = "• Постоянное автоподключение (3с)";
        }
    }

    function updateStatsOverview(stats, users) {
        if (!stats) stats = {};
        const totalUsers = stats.total_users || (users ? users.length : 0);
        const totalCoins = stats.total_coins || 0;
        const totalStars = stats.total_stars || 0.0;
        const totalVoice = stats.total_voice_minutes || 0;

        document.getElementById("stat-users").innerText = formatNumber(totalUsers);
        document.getElementById("stat-coins").innerText = formatNumber(totalCoins);
        document.getElementById("stat-stars").innerText = formatStars(totalStars) + " ⭐";
        document.getElementById("stat-voice").innerText = Math.floor(totalVoice / 60) + " ч";
    }

    // ================== VIEWS ROUTER ==================
    function renderActiveView() {
        if (!globalData) return;

        if (currentTab === "leaderboard") {
            renderLeaderboard();
        } else if (currentTab === "users") {
            renderUsersCatalog();
        } else if (currentTab === "market") {
            renderMarket();
        }
    }

    // ================== LEADERBOARD ==================
    function renderLeaderboard() {
        const list = (globalData.leaderboard && globalData.leaderboard[currentLeaderFilter]) || [];
        const podiumContainer = document.getElementById("podium-section");
        const tableBody = document.getElementById("leaderboard-rows");

        if (list.length === 0) {
            podiumContainer.innerHTML = "";
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">Пока нет данных для отображения</td></tr>`;
            return;
        }

        // Top 3 Podium
        const top1 = list[0];
        const top2 = list[1];
        const top3 = list[2];

        function getScoreString(u) {
            if (!u) return "";
            if (currentLeaderFilter === "coins") return `${formatNumber(u.coins)} G.COIN`;
            if (currentLeaderFilter === "stars") return `${formatStars(u.stars)} STARS`;
            if (currentLeaderFilter === "factor") return `🛡️ ${parseFloat(u.factor || 60).toFixed(1)} / 120`;
            if (currentLeaderFilter === "level") return `LVL ${u.level || 1} (${u.experience || 0} XP)`;
            if (currentLeaderFilter === "voice") return `🎤 ${Math.floor((u.voice_minutes || 0) / 60)} ч ${u.voice_minutes % 60} мин`;
            return `${formatNumber(u.coins)} G.COIN`;
        }

        function buildPedestalColumn(user, rank) {
            if (!user) {
                return `<div class="podium-column empty"></div>`;
            }
            const hex = getGenColorHex(user.gen_color_value);
            const score = getScoreString(user);
            const name = user.display_name || user.username || "Пользователь";
            const genNum = user.gen_number || "—";
            const avatarUrl = user.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png";

            const isMe = Boolean(currentUser && String(currentUser.user_id) === String(user.user_id));
            const meBadge = isMe ? `<span class="current-user-badge">✨ ЭТО ВЫ</span>` : "";
            const meClass = isMe ? " is-current-user" : "";

            let rankClass = "second";
            let rankNum = "02";
            let rankPill = "🥈 2 МЕСТО";
            let rankLabel = "2ND PLACE";
            let crownIcon = "🥈";

            if (rank === 1) {
                rankClass = "first";
                rankNum = "01";
                rankPill = "👑 ЧЕМПИОН";
                rankLabel = "1ST PLACE";
                crownIcon = "🥇";
            } else if (rank === 3) {
                rankClass = "third";
                rankNum = "03";
                rankPill = "🥉 3 МЕСТО";
                rankLabel = "3RD PLACE";
                crownIcon = "🥉";
            }

            return `
                <div class="podium-column ${rankClass}${meClass}" onclick="window.KREIT.openUserModal(${user.user_id})">
                    <div class="podium-card">
                        <div class="podium-badge-wrapper">
                            <span class="podium-rank-pill">${rankPill}</span>
                        </div>
                        <div class="podium-avatar-wrapper">
                            <div class="avatar-cyber-ring" style="--ring-color: ${hex};">
                                <img src="${avatarUrl}" class="podium-avatar" style="border-color: ${hex};" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                            </div>
                            <div class="avatar-rank-disc">${crownIcon}</div>
                        </div>
                        <div class="podium-name" title="${escapeHtml(name)}">${escapeHtml(name)} ${meBadge}</div>
                        <div class="podium-gen-badge" style="color: ${hex}; border-color: ${hex}55; background: ${hex}18;">
                            <span class="gen-dot" style="background: ${hex};"></span>
                            GEN ${escapeHtml(genNum)}
                        </div>
                        <div class="podium-score-box">
                            <div class="podium-score-val">${score}</div>
                        </div>
                    </div>
                    <div class="pedestal-stand">
                        <div class="pedestal-top-plate"></div>
                        <div class="pedestal-pillar">
                            <div class="pedestal-cyber-grid"></div>
                            <div class="pedestal-watermark">${rankNum}</div>
                            <div class="pedestal-rank-label">${rankLabel}</div>
                            <div class="pedestal-light-bar"></div>
                        </div>
                    </div>
                </div>
            `;
        }

        let podiumHtml = "";
        podiumHtml += buildPedestalColumn(top2, 2);
        podiumHtml += buildPedestalColumn(top1, 1);
        podiumHtml += buildPedestalColumn(top3, 3);
        podiumContainer.innerHTML = podiumHtml;

        // Table for ranks 4+
        const remaining = list.slice(3);
        if (remaining.length === 0) {
            tableBody.innerHTML = "";
            return;
        }

        tableBody.innerHTML = remaining.map((u, idx) => {
            const rank = idx + 4;
            const hex = getGenColorHex(u.gen_color_value);
            const shieldImg = getShieldPath(u.factor);
            const isMe = Boolean(currentUser && String(currentUser.user_id) === String(u.user_id));
            const rowClass = isMe ? ' class="is-current-user"' : "";
            const meBadge = isMe ? `<span class="current-user-badge">✨ ВЫ</span>` : "";

            return `
                <tr${rowClass} onclick="window.KREIT.openUserModal(${u.user_id})">
                    <td class="mono-val" style="color: var(--text-muted); width: 60px;">#${rank}</td>
                    <td>
                        <div class="user-title-cell">
                            <img src="${u.avatar_url}" class="table-user-av" style="border-color: ${hex}">
                            <div>
                                <div class="table-user-name">${escapeHtml(u.display_name || u.username)} ${meBadge}</div>
                                <div class="table-user-sub">${escapeHtml(u.gen_color || "Цвет GEN")}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="badge-tag" style="border-color: ${hex}; color: ${hex};">GEN ${escapeHtml(u.gen_number || "—")}</span>
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <img src="${shieldImg}" style="width: 20px; height: 20px;">
                            <span class="mono-val">${parseFloat(u.factor || 60).toFixed(1)}</span>
                        </div>
                    </td>
                    <td class="right mono-val" style="color: #ffffff;">${formatNumber(u.coins)}</td>
                    <td class="right mono-val" style="font-weight: 700; color: var(--accent-gold);">${getScoreString(u)}</td>
                </tr>
            `;
        }).join("");
    }

    // ================== USERS CATALOG ==================
    function renderUsersCatalog() {
        const grid = document.getElementById("users-grid");
        let users = globalData.users ? [...globalData.users] : [];

        // Filter by search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            users = users.filter(u =>
                (u.username && u.username.toLowerCase().includes(q)) ||
                (u.display_name && u.display_name.toLowerCase().includes(q)) ||
                (u.gen_number && String(u.gen_number).toLowerCase().includes(q))
            );
        }

        // Filter by color
        if (selectedColor !== "all") {
            users = users.filter(u =>
                u.gen_color && u.gen_color.toLowerCase().includes(selectedColor)
            );
        }

        // Sort
        if (sortBy === "stars") {
            users.sort((a, b) => (parseFloat(b.stars) || 0) - (parseFloat(a.stars) || 0));
        } else if (sortBy === "factor") {
            users.sort((a, b) => (parseFloat(b.factor) || 0) - (parseFloat(a.factor) || 0));
        } else if (sortBy === "level") {
            users.sort((a, b) => (parseInt(b.level) || 0) - (parseInt(a.level) || 0));
        } else if (sortBy === "voice") {
            users.sort((a, b) => (parseInt(b.voice_minutes) || 0) - (parseInt(a.voice_minutes) || 0));
        } else {
            users.sort((a, b) => (parseInt(b.coins) || 0) - (parseInt(a.coins) || 0));
        }

        if (users.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 48px 0; font-size: 16px;">Пользователи не найдены</div>`;
            return;
        }

        grid.innerHTML = users.map(u => {
            const hex = getGenColorHex(u.gen_color_value);
            const shieldImg = getShieldPath(u.factor);
            const presents = u.equipped_presents || [];

            const isMe = Boolean(currentUser && String(currentUser.user_id) === String(u.user_id));
            const meClass = isMe ? " is-current-user" : "";
            const meBadge = isMe ? `<span class="current-user-badge">✨ ВЫ</span>` : "";

            let presentsHtml = "";
            for (let i = 0; i < 5; i++) {
                if (i < presents.length) {
                    presentsHtml += `<div class="p-slot"><span title="${escapeHtml(presents[i].name)}">🎁</span></div>`;
                } else {
                    presentsHtml += `<div class="p-slot empty">+</div>`;
                }
            }

            return `
                <div class="user-widget-horizontal${meClass}" onclick="window.KREIT.openUserModal(${u.user_id})" style="--user-glow: ${hex}; border-left: 4px solid ${hex};">
                    <div class="uwh-left">
                        <img src="${u.avatar_url}" class="uwh-avatar" style="border: 2px solid ${hex};">
                        <div class="uwh-user-meta">
                            <div class="uwh-username">${escapeHtml(u.display_name || u.username)} ${meBadge}</div>
                            <div class="uwh-gen-row">
                                <span class="badge-tag" style="border-color: ${hex}; color: ${hex};">GEN ${escapeHtml(u.gen_number || "—")}</span>
                                <span class="uwh-color-name">${escapeHtml(u.gen_color || "Цвет GEN")}</span>
                            </div>
                        </div>
                    </div>

                    <div class="uwh-center">
                        <div class="uwh-metrics-group">
                            <div class="uwh-metric">
                                <span class="uwh-metric-label">G.COIN</span>
                                <span class="uwh-metric-val mono-val" style="color: #64dcff;">🪙 ${formatNumber(u.coins)}</span>
                            </div>
                            <div class="uwh-metric">
                                <span class="uwh-metric-label">STARS</span>
                                <span class="uwh-metric-val mono-val" style="color: #ffd700;">⭐ ${formatStars(u.stars)}</span>
                            </div>
                            <div class="uwh-metric">
                                <span class="uwh-metric-label">УРОВЕНЬ</span>
                                <span class="uwh-metric-val mono-val">LVL ${u.level || 1}</span>
                            </div>
                        </div>
                        <div class="uwh-presents-group">
                            <span class="uwh-metric-label">ПОДАРКИ</span>
                            <div class="presents-row">${presentsHtml}</div>
                        </div>
                    </div>

                    <div class="uwh-right">
                        <div class="uwh-factor-box" title="Фактор доверия: ${parseFloat(u.factor || 60).toFixed(1)} / 120">
                            <img src="${shieldImg}" style="width: 22px; height: 22px;">
                            <span class="mono-val" style="font-size: 13px; font-weight: 700;">${parseFloat(u.factor || 60).toFixed(1)}</span>
                        </div>
                        <div class="uwh-button-open">
                            <span>ПРОФИЛЬ</span>
                            <span class="uwh-chevron">➔</span>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    // ================== MARKET VIEW ==================
    function renderMarket() {
        const container = document.getElementById("market-lots-grid");
        const lots = globalData.market || [];

        if (lots.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 50px; font-size: 16px;">На бирже BOURSE пока нет активных лотов</div>`;
            return;
        }

        container.innerHTML = lots.map((l, idx) => {
            return `
                <div class="user-card">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 12px; color: var(--accent-blue); font-weight: 800;">ЛОТ #${idx + 1}</span>
                        <span style="font-size: 18px; color: var(--accent-gold); font-weight: 800;">⭐ ${formatStars(l.price)}</span>
                    </div>
                    <div style="font-size: 18px; font-weight: 700; color: #ffffff;">${escapeHtml(l.item_name || "GEN Номер")}</div>
                    <div style="font-size: 13px; color: var(--text-secondary);">${escapeHtml(l.seller_name || "Игрок")}</div>
                </div>
            `;
        }).join("");
    }

    // ================== USER MODAL ==================
    window.KREIT = {
        openUserModal: function (userId) {
            if (!globalData || !globalData.users) return;
            const u = globalData.users.find(x => x.user_id === userId);
            if (!u) return;

            const hex = getGenColorHex(u.gen_color_value);
            const shieldImg = getShieldPath(u.factor);
            const factor = parseFloat(u.factor || 60).toFixed(1);

            document.getElementById("modal-avatar").src = u.avatar_url;
            document.getElementById("modal-avatar").style.borderColor = hex;
            document.getElementById("modal-avatar").style.boxShadow = `0 0 30px ${hex}`;
            document.getElementById("modal-username").innerText = u.display_name || u.username;
            document.getElementById("modal-gen").innerText = `GEN ${u.gen_number || "—"}`;
            document.getElementById("modal-gen").style.color = hex;
            document.getElementById("modal-color-name").innerText = u.gen_color || "Базовый";

            document.getElementById("modal-coins").innerText = `${formatNumber(u.coins)} G.COIN`;
            document.getElementById("modal-stars").innerText = `${formatStars(u.stars)} STARS`;
            document.getElementById("modal-level").innerText = `Уровень ${u.level || 1} (${u.experience || 0} XP)`;

            document.getElementById("modal-factor-num").innerText = `${factor} / 120`;
            document.getElementById("modal-factor-shield").src = shieldImg;
            document.getElementById("modal-factor-bar").style.width = Math.min(100, (parseFloat(factor) / 120) * 100) + "%";

            // Voice & Messages
            const vMins = u.voice_minutes || 0;
            const hours = Math.floor(vMins / 60);
            const mins = vMins % 60;
            document.getElementById("modal-voice").innerText = `${hours} ч ${mins} мин`;
            document.getElementById("modal-messages").innerText = `${formatNumber(u.messages_count || 0)}`;

            // Presents
            const presents = u.equipped_presents || [];
            const presBox = document.getElementById("modal-presents-container");
            if (presents.length === 0) {
                presBox.innerHTML = `<span style="color: var(--text-muted); font-size: 13px;">Нет надетых подарков</span>`;
            } else {
                presBox.innerHTML = presents.map(p => `
                    <div style="background: rgba(20, 28, 48, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 22px;">🎁</span>
                        <div>
                            <div style="font-size: 13px; font-weight: 700; color: #ffffff;">${escapeHtml(p.name)}</div>
                            <div style="font-size: 11px; color: var(--accent-gold); font-weight: 600;">⭐ ${p.price_usdf} STARS</div>
                        </div>
                    </div>
                `).join("");
            }

            document.getElementById("user-profile-modal").classList.add("active");
        },

        closeUserModal: function () {
            document.getElementById("user-profile-modal").classList.remove("active");
        }
    };

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ================== EVENT LISTENERS ==================
    document.addEventListener("DOMContentLoaded", () => {
        // Initial auth check and hero banner render
        renderAuthHeroBanner();

        // Tab switching
        document.querySelectorAll(".tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                currentTab = btn.dataset.tab;

                document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
                document.getElementById(`view-${currentTab}`).classList.add("active");
                renderActiveView();
                runTextScrambleAnimation(800);
            });
        });

        // Leaderboard filter pills
        document.querySelectorAll(".pill-filter").forEach(pill => {
            pill.addEventListener("click", () => {
                document.querySelectorAll(".pill-filter").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                currentLeaderFilter = pill.dataset.filter;
                renderLeaderboard();
                runTextScrambleAnimation(600);
            });
        });

        // Search
        const searchInput = document.getElementById("user-search-input");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                searchQuery = e.target.value.trim();
                renderUsersCatalog();
            });
        }

        // Color filter
        const colorSelect = document.getElementById("color-filter-select");
        if (colorSelect) {
            colorSelect.addEventListener("change", (e) => {
                selectedColor = e.target.value;
                renderUsersCatalog();
            });
        }

        // Sort selector
        const sortSelect = document.getElementById("sort-select");
        if (sortSelect) {
            sortSelect.addEventListener("change", (e) => {
                sortBy = e.target.value;
                renderUsersCatalog();
            });
        }

        // User profile modal backdrop close
        const modal = document.getElementById("user-profile-modal");
        if (modal) {
            modal.addEventListener("click", (e) => {
                if (e.target === modal) window.KREIT.closeUserModal();
            });
        }

        // ================== LOGIN MODAL & AUTH LISTENERS ==================
        const loginBtn = document.getElementById("btn-open-login");
        const loginModal = document.getElementById("login-modal");
        const closeLoginBtn = document.getElementById("btn-close-login");
        const loginForm = document.getElementById("login-form");
        const quickCodeForm = document.getElementById("quick-code-form");
        const loginErrorMsg = document.getElementById("login-error-msg");
        const codeErrorMsg = document.getElementById("code-error-msg");
        const logoutBtn = document.getElementById("auth-hero-logout");
        const discordOauthBtn = document.getElementById("btn-discord-oauth");
        const uriInput = document.getElementById("uri-copy-input");
        const copyUriBtn = document.getElementById("btn-copy-uri");

        // Auth Tabs Switching (Password / Quick Code / Discord)
        document.querySelectorAll(".login-tab-btn").forEach(tabBtn => {
            tabBtn.addEventListener("click", () => {
                document.querySelectorAll(".login-tab-btn").forEach(b => b.classList.remove("active"));
                tabBtn.classList.add("active");
                const targetTab = tabBtn.dataset.authTab;

                document.querySelectorAll(".auth-tab-content").forEach(content => {
                    if (content.dataset.authContent === targetTab) {
                        content.style.display = "flex";
                        if (content.tagName === "FORM") content.style.display = "flex";
                        else content.style.display = "block";
                    } else {
                        content.style.display = "none";
                    }
                });

                if (targetTab === "password") {
                    const uInp = document.getElementById("login-username-input");
                    if (uInp) uInp.focus();
                } else if (targetTab === "code") {
                    const cInp = document.getElementById("quick-code-input");
                    if (cInp) cInp.focus();
                }
            });
        });

        // Set and Copy exact Redirect URI
        const currentRedirectUri = window.location.origin + window.location.pathname;
        if (uriInput) {
            uriInput.value = currentRedirectUri;
        }
        if (copyUriBtn && uriInput) {
            copyUriBtn.addEventListener("click", () => {
                navigator.clipboard.writeText(currentRedirectUri).then(() => {
                    copyUriBtn.innerText = "СКОПИРОВАНО! ✓";
                    setTimeout(() => { copyUriBtn.innerText = "КОПИРОВАТЬ"; }, 2000);
                }).catch(() => {
                    uriInput.select();
                    document.execCommand("copy");
                    copyUriBtn.innerText = "СКОПИРОВАНО! ✓";
                    setTimeout(() => { copyUriBtn.innerText = "КОПИРОВАТЬ"; }, 2000);
                });
            });
        }

        // Discord OAuth 2.0 Button click with exact redirect_uri
        if (discordOauthBtn) {
            discordOauthBtn.addEventListener("click", () => {
                const oauthUrl = `https://discord.com/oauth2/authorize?client_id=1524868127392010471&response_type=token&scope=identify&redirect_uri=${encodeURIComponent(currentRedirectUri)}`;
                window.location.href = oauthUrl;
            });
        }

        if (loginBtn && loginModal) {
            loginBtn.addEventListener("click", () => {
                if (currentUser) {
                    const hero = document.getElementById("auth-user-hero");
                    if (hero) hero.scrollIntoView({ behavior: "smooth", block: "start" });
                } else {
                    if (loginErrorMsg) loginErrorMsg.style.display = "none";
                    if (codeErrorMsg) codeErrorMsg.style.display = "none";
                    loginModal.classList.add("active");
                    const userInp = document.getElementById("login-username-input");
                    if (userInp) userInp.focus();
                }
            });
        }

        if (closeLoginBtn && loginModal) {
            closeLoginBtn.addEventListener("click", () => {
                loginModal.classList.remove("active");
            });
        }

        if (loginModal) {
            loginModal.addEventListener("click", (e) => {
                if (e.target === loginModal) loginModal.classList.remove("active");
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener("click", () => {
                currentUser = null;
                try {
                    localStorage.removeItem("kreit_auth_user");
                } catch (e) {}
                renderAuthHeroBanner();
                renderActiveView();
            });
        }

        // 1. Password login submit
        if (loginForm) {
            loginForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const usernameInput = document.getElementById("login-username-input");
                const passwordInput = document.getElementById("login-password-input");
                const submitBtn = document.getElementById("btn-submit-login");

                const username = usernameInput ? usernameInput.value.trim() : "";
                const password = passwordInput ? passwordInput.value.trim() : "";

                if (!username || !password) return;

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerText = "ПРОВЕРКА...";
                }
                if (loginErrorMsg) loginErrorMsg.style.display = "none";

                try {
                    let resp = null;
                    try {
                        resp = await fetch("/api/login", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ username, password })
                        });
                    } catch (netErr) {
                        resp = await fetch("http://127.0.0.1:5055/api/login", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ username, password })
                        });
                    }

                    const result = await resp.json();
                    if (result.success && result.user) {
                        currentUser = result.user;
                        try {
                            localStorage.setItem("kreit_auth_user", JSON.stringify(currentUser));
                        } catch (e) {}

                        if (loginModal) loginModal.classList.remove("active");
                        if (loginForm) loginForm.reset();

                        renderAuthHeroBanner();
                        renderActiveView();
                        runTextScrambleAnimation(1000);
                    } else {
                        if (loginErrorMsg) {
                            loginErrorMsg.innerText = result.error || "Неверный юзернейм или пароль!";
                            loginErrorMsg.style.display = "block";
                        }
                    }
                } catch (err) {
                    if (loginErrorMsg) {
                        loginErrorMsg.innerText = "Ошибка соединения с сервером. Попробуйте еще раз.";
                        loginErrorMsg.style.display = "block";
                    }
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = `<span>ВОЙТИ В СИСТЕМУ</span><span class="btn-arrow">→</span>`;
                    }
                }
            });
        }

        // 2. Quick Code login submit (/код)
        if (quickCodeForm) {
            quickCodeForm.addEventListener("submit", async (e) => {
                e.preventDefault();
                const codeInput = document.getElementById("quick-code-input");
                const submitCodeBtn = document.getElementById("btn-submit-code");
                const code = codeInput ? codeInput.value.trim() : "";

                if (!code || code.length !== 6) return;

                if (submitCodeBtn) {
                    submitCodeBtn.disabled = true;
                    submitCodeBtn.innerText = "ПРОВЕРКА КОДА...";
                }
                if (codeErrorMsg) codeErrorMsg.style.display = "none";

                try {
                    let resp = null;
                    try {
                        resp = await fetch("/api/login", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ quick_code: code })
                        });
                    } catch (netErr) {
                        resp = await fetch("http://127.0.0.1:5055/api/login", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ quick_code: code })
                        });
                    }

                    const result = await resp.json();
                    if (result.success && result.user) {
                        currentUser = result.user;
                        try {
                            localStorage.setItem("kreit_auth_user", JSON.stringify(currentUser));
                        } catch (e) {}

                        if (loginModal) loginModal.classList.remove("active");
                        if (quickCodeForm) quickCodeForm.reset();

                        renderAuthHeroBanner();
                        renderActiveView();
                        runTextScrambleAnimation(1000);
                    } else {
                        if (codeErrorMsg) {
                            codeErrorMsg.innerText = result.error || "Неверный или просроченный код!";
                            codeErrorMsg.style.display = "block";
                        }
                    }
                } catch (err) {
                    if (codeErrorMsg) {
                        codeErrorMsg.innerText = "Ошибка соединения. Убедитесь, что бот онлайн.";
                        codeErrorMsg.style.display = "block";
                    }
                } finally {
                    if (submitCodeBtn) {
                        submitCodeBtn.disabled = false;
                        submitCodeBtn.innerHTML = `<span>ВОЙТИ ПО КОДУ</span><span class="btn-arrow">⚡</span>`;
                    }
                }
            });
        }

        // ================== DISCORD OAUTH CALLBACK & URL 1-CLICK LOGIN ==================
        async function checkDiscordOAuthCallback() {
            const hash = window.location.hash.substring(1);
            if (!hash.includes("access_token=")) return false;

            const params = new URLSearchParams(hash);
            const accessToken = params.get("access_token");
            if (!accessToken) return false;

            try {
                const resp = await fetch("https://discord.com/api/users/@me", {
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                if (resp.ok) {
                    const discordUser = await resp.json();
                    const discordId = String(discordUser.id);
                    const discordName = String(discordUser.username || "").toLowerCase();

                    if (!globalData || !globalData.users) {
                        await fetchSyncData();
                    }

                    const matched = (globalData && globalData.users ? globalData.users : []).find(u =>
                        String(u.user_id) === discordId ||
                        String(u.discord_username || "").toLowerCase() === discordName ||
                        String(u.username || "").toLowerCase() === discordName
                    );

                    if (matched) {
                        currentUser = matched;
                        try {
                            localStorage.setItem("kreit_auth_user", JSON.stringify(currentUser));
                        } catch (e) {}

                        window.history.replaceState({}, document.title, window.location.pathname);
                        renderAuthHeroBanner();
                        renderActiveView();
                        runTextScrambleAnimation(1000);
                        return true;
                    }
                }
            } catch (e) {
                console.warn("[DISCORD_AUTH]", e);
            }
            return false;
        }

        async function checkUrlAutoLogin() {
            const urlParams = new URLSearchParams(window.location.search);
            const authUser = urlParams.get("auth_user") || urlParams.get("user") || urlParams.get("u");
            const authPass = urlParams.get("auth_pass") || urlParams.get("pass") || urlParams.get("p");
            const quickCode = urlParams.get("quick_code") || urlParams.get("code") || urlParams.get("c");

            let requestBody = null;
            if (quickCode) {
                requestBody = { quick_code: quickCode };
            } else if (authUser && authPass) {
                requestBody = { username: authUser, password: authPass };
            }

            if (requestBody) {
                try {
                    let resp = null;
                    try {
                        resp = await fetch("/api/login", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(requestBody)
                        });
                    } catch (err) {
                        resp = await fetch("http://127.0.0.1:5055/api/login", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(requestBody)
                        });
                    }

                    if (resp && resp.ok) {
                        const result = await resp.json();
                        if (result.success && result.user) {
                            currentUser = result.user;
                            try {
                                localStorage.setItem("kreit_auth_user", JSON.stringify(currentUser));
                            } catch (e) {}

                            window.history.replaceState({}, document.title, window.location.pathname);
                            renderAuthHeroBanner();
                            renderActiveView();
                            runTextScrambleAnimation(1000);
                            return true;
                        }
                    }
                } catch (e) {
                    console.warn("[AUTO_LOGIN]", e);
                }
            }
            return false;
        }

        // Start initial sync & continuous loop every 3 seconds
        fetchSyncData().then(async () => {
            // Check for direct login from Discord button or OAuth
            await checkUrlAutoLogin();
            await checkDiscordOAuthCallback();
            // Run text scramble animation on first load (1 sec)
            runTextScrambleAnimation(1000);
        });
        setInterval(fetchSyncData, 3000);
    });
})();
