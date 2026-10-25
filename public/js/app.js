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

    // ================== DATA FETCHING ==================
    async function fetchSyncData() {
        try {
            const resp = await fetch("/api/sync");
            if (resp.ok) {
                const data = await resp.json();
                globalData = data;
                updateStatusBadge(data.bot_online, data.last_sync, data.is_cached);
                updateStatsOverview(data.stats, data.users);
                renderActiveView();
            } else {
                updateStatusBadge(false, 0, true);
            }
        } catch (e) {
            console.warn("[SYNC] Ошибка получения данных от сервера:", e);
            updateStatusBadge(false, 0, true);
        }
    }

    function updateStatusBadge(isOnline, lastSync, isCached) {
        const badge = document.getElementById("bot-status-badge");
        const statusText = document.getElementById("bot-status-text");
        const syncTimer = document.getElementById("sync-timer-text");

        if (isOnline) {
            badge.className = "status-pill online";
            statusText.innerText = "БОТ ОНЛАЙН";
            syncTimer.innerText = "• Синхронизация раз в 5 сек (Live)";
        } else {
            badge.className = "status-pill offline";
            statusText.innerText = "АВТОНОМНЫЙ РЕЖИМ";
            syncTimer.innerText = isCached ? "• База данных сохранена на сервере" : "• Ожидание подключения";
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

        let podiumHtml = "";

        // 2nd Place
        if (top2) {
            const hex = getGenColorHex(top2.gen_color_value);
            podiumHtml += `
                <div class="podium-card second" onclick="window.KREIT.openUserModal(${top2.user_id})">
                    <div class="crown-badge">🥈</div>
                    <div class="podium-avatar-wrapper">
                        <img src="${top2.avatar_url}" class="podium-avatar" style="border-color: ${hex}; box-shadow: 0 0 20px ${hex}88;">
                    </div>
                    <div class="podium-name">${escapeHtml(top2.display_name || top2.username)}</div>
                    <div class="podium-gen" style="color: ${hex}">GEN ${escapeHtml(top2.gen_number || "—")}</div>
                    <div class="podium-score">${getScoreString(top2)}</div>
                </div>
            `;
        } else {
            podiumHtml += `<div></div>`;
        }

        // 1st Place
        if (top1) {
            const hex = getGenColorHex(top1.gen_color_value);
            podiumHtml += `
                <div class="podium-card first" onclick="window.KREIT.openUserModal(${top1.user_id})">
                    <div class="crown-badge">🥇</div>
                    <div class="podium-avatar-wrapper">
                        <img src="${top1.avatar_url}" class="podium-avatar" style="border-color: ${hex}; box-shadow: 0 0 30px ${hex};">
                    </div>
                    <div class="podium-name" style="font-size: 20px;">${escapeHtml(top1.display_name || top1.username)}</div>
                    <div class="podium-gen" style="color: ${hex}; font-size: 15px;">GEN ${escapeHtml(top1.gen_number || "—")}</div>
                    <div class="podium-score" style="font-size: 24px;">${getScoreString(top1)}</div>
                </div>
            `;
        } else {
            podiumHtml += `<div></div>`;
        }

        // 3rd Place
        if (top3) {
            const hex = getGenColorHex(top3.gen_color_value);
            podiumHtml += `
                <div class="podium-card third" onclick="window.KREIT.openUserModal(${top3.user_id})">
                    <div class="crown-badge">🥉</div>
                    <div class="podium-avatar-wrapper">
                        <img src="${top3.avatar_url}" class="podium-avatar" style="border-color: ${hex}; box-shadow: 0 0 20px ${hex}88;">
                    </div>
                    <div class="podium-name">${escapeHtml(top3.display_name || top3.username)}</div>
                    <div class="podium-gen" style="color: ${hex}">GEN ${escapeHtml(top3.gen_number || "—")}</div>
                    <div class="podium-score">${getScoreString(top3)}</div>
                </div>
            `;
        } else {
            podiumHtml += `<div></div>`;
        }

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
            return `
                <tr onclick="window.KREIT.openUserModal(${u.user_id})">
                    <td class="mono-val" style="color: var(--text-muted); width: 60px;">#${rank}</td>
                    <td>
                        <div class="user-title-cell">
                            <img src="${u.avatar_url}" class="table-user-av" style="border-color: ${hex}">
                            <div>
                                <div class="table-user-name">${escapeHtml(u.display_name || u.username)}</div>
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

            let presentsHtml = "";
            for (let i = 0; i < 5; i++) {
                if (i < presents.length) {
                    presentsHtml += `<div class="p-slot"><span title="${escapeHtml(presents[i].name)}">🎁</span></div>`;
                } else {
                    presentsHtml += `<div class="p-slot empty">+</div>`;
                }
            }

            return `
                <div class="user-card" onclick="window.KREIT.openUserModal(${u.user_id})" style="border-left: 3px solid ${hex};">
                    <div class="user-card-header">
                        <img src="${u.avatar_url}" class="user-card-avatar" style="border: 1px solid ${hex};">
                        <div class="user-card-info">
                            <div class="user-card-title">${escapeHtml(u.display_name || u.username)}</div>
                            <span class="badge-tag" style="border-color: ${hex}; color: ${hex};">GEN ${escapeHtml(u.gen_number || "—")}</span>
                        </div>
                        <img src="${shieldImg}" style="width: 24px; height: 24px;" title="Фактор доверия: ${parseFloat(u.factor || 60).toFixed(1)}">
                    </div>

                    <div class="user-card-metrics">
                        <div class="metric-item">
                            <span class="metric-label">G.COIN</span>
                            <span class="metric-val" style="color: #64dcff;">🪙 ${formatNumber(u.coins)}</span>
                        </div>
                        <div class="metric-item">
                            <span class="metric-label">STARS</span>
                            <span class="metric-val" style="color: #ffd700;">⭐ ${formatStars(u.stars)}</span>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px;">
                        <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">ПОДАРКИ</span>
                        <div class="presents-row">${presentsHtml}</div>
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
        // Tab switching
        document.querySelectorAll(".tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                currentTab = btn.dataset.tab;

                document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
                document.getElementById(`view-${currentTab}`).classList.add("active");
                renderActiveView();
            });
        });

        // Leaderboard filter pills
        document.querySelectorAll(".pill-filter").forEach(pill => {
            pill.addEventListener("click", () => {
                document.querySelectorAll(".pill-filter").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                currentLeaderFilter = pill.dataset.filter;
                renderLeaderboard();
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

        // Modal backdrop close
        const modal = document.getElementById("user-profile-modal");
        if (modal) {
            modal.addEventListener("click", (e) => {
                if (e.target === modal) window.KREIT.closeUserModal();
            });
        }

        // Start initial sync & loop every 5 seconds
        fetchSyncData();
        setInterval(fetchSyncData, 5000);
    });
})();
