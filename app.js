var App = {
    currentPage: 'home',
    currentScene: 0,
    currentStyle: 'formal',
    currentFolder: 'all',
    allScenes: [],
    allReplies: [],
    allFolders: [],
    allFavorites: [],
    allHistory: [],
    recognition: null,
    isRecording: false,
    _debounceTimer: null,

    _lockAttempts: 0,
    _lockLockedUntil: 0,
    _autoBackupTimer: null,
    _modalKeyHandler: null,
    _generating: false,

    async hashPassword(pwd, salt) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(pwd), 'PBKDF2', false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' },
            keyMaterial, 256
        );
        return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },

    unescapeHtml(html) {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent;
    },

    debounce(fn, delay = 300) {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => fn.call(this), delay);
    },

    async init() {
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled rejection:', e.reason);
        });

        try {
            await DB.init();
        } catch (e) {
            console.error('DB init failed:', e);
            document.getElementById('app').innerHTML = '<div style="padding:40px;text-align:center"><h2>初始化失败</h2><p>请确保浏览器支持IndexedDB，或尝试关闭隐私模式后重试。</p></div>';
            return;
        }

        try {
            const seeded = await seedDatabase();
            if (seeded) {
                this.showToast('欢迎使用高情商回复助手！', 'success');
            }

            await this.loadSettings();
            await this.loadScenes();
            await this.loadTagCloud();
            this.bindEvents();
            this.checkLock();
            this.updateDataStats();

            if ('serviceWorker' in navigator) {
                try {
                    await navigator.serviceWorker.register('sw.js');
                } catch (e) { /* ignore */ }
            }
        } catch (e) {
            console.error('App init error:', e);
            this.showToast('应用初始化出现异常，部分功能可能不可用', 'warning');
        }
    },

    async loadSettings() {
        const darkMode = await DB.getSetting('darkMode');
        if (darkMode === true || (darkMode === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('dark-mode-toggle').checked = true;
            document.querySelector('.theme-icon').textContent = '☀️';
        }

        const encryption = await DB.getSetting('encryption');
        if (encryption && !window.isSecureContext) {
            document.getElementById('encryption-toggle').checked = false;
            document.getElementById('encryption-toggle').disabled = true;
            document.getElementById('encryption-toggle').closest('.settings-item').querySelector('.settings-item-desc').textContent += '（需HTTPS环境）';
        } else {
            document.getElementById('encryption-toggle').checked = encryption === true;
            if (encryption && !CryptoUtil.hasKey()) {
                await CryptoUtil.generateKey();
            }
        }

        const autoBackup = await DB.getSetting('autoBackup');
        document.getElementById('auto-backup-toggle').checked = autoBackup === true;

        const backupFreq = await DB.getSetting('backupFrequency');
        if (backupFreq) document.getElementById('backup-frequency').value = backupFreq;

        if (autoBackup) {
            this.startAutoBackup(backupFreq || 'daily');
        }
    },

    checkLock() {
        const lockEnabled = localStorage.getItem('eq_lock_enabled') === 'true';
        document.getElementById('lock-toggle').checked = lockEnabled;
        document.getElementById('set-password-item').style.display = lockEnabled ? 'flex' : 'none';

        if (lockEnabled && localStorage.getItem('eq_lock_pwd')) {
            document.getElementById('lock-screen').classList.remove('hidden');
        }
    },

    async loadScenes() {
        this.allScenes = await DB.getAll('scenes');
        this.renderSceneChips();

        const filterScene = document.getElementById('filter-scene');
        filterScene.innerHTML = '<option value="">全部场景</option>';
        this.allScenes.filter(s => !s.parentId || s.parentId === 0).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.icon + ' ' + s.name;
            filterScene.appendChild(opt);
        });
    },

    renderSceneChips() {
        const container = document.getElementById('scene-chips');
        container.innerHTML = '<div class="scene-chip active" data-scene="0">全部</div>';

        const rootScenes = this.allScenes.filter(s => !s.parentId || s.parentId === 0);
        rootScenes.forEach(scene => {
            const chip = document.createElement('div');
            chip.className = 'scene-chip';
            chip.dataset.scene = scene.id;
            chip.textContent = scene.icon + ' ' + scene.name;
            container.appendChild(chip);
        });

        container.querySelectorAll('.scene-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                container.querySelectorAll('.scene-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.currentScene = parseInt(chip.dataset.scene);
            });
        });
    },

    async loadTagCloud() {
        const tags = await ReplyEngine.getTagCloud();
        const container = document.getElementById('tag-cloud');
        container.innerHTML = '';
        const maxCount = tags.length > 0 ? tags[0].count : 1;
        tags.forEach(({ tag, count }) => {
            const el = document.createElement('div');
            el.className = 'tag-cloud-item' + (count > maxCount * 0.6 ? ' hot' : '');
            el.textContent = tag;
            el.addEventListener('click', () => {
                document.getElementById('user-input').value = tag;
                this.generateReplies();
            });
            container.appendChild(el);
        });
    },

    bindEvents() {
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', () => this.switchPage(tab.dataset.page));
            tab.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.switchPage(tab.dataset.page);
                }
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    const tabs = Array.from(document.querySelectorAll('.tab-item'));
                    const idx = tabs.indexOf(tab);
                    const next = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
                    tabs[next].focus();
                    this.switchPage(tabs[next].dataset.page);
                }
            });
        });

        document.getElementById('generate-btn').addEventListener('click', () => this.generateReplies());
        document.getElementById('clear-input-btn').addEventListener('click', () => {
            document.getElementById('user-input').value = '';
            document.getElementById('replies-section').classList.add('hidden');
            document.getElementById('scene-suggest').classList.add('hidden');
            document.getElementById('diagnosis-section').classList.add('hidden');
        });

        document.getElementById('user-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.generateReplies();
            }
        });

        document.querySelectorAll('.style-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.style-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.currentStyle = chip.dataset.style;
            });
        });

        document.getElementById('random-style-btn').addEventListener('click', () => {
            const style = ReplyEngine.getRandomStyle();
            this.currentStyle = style;
            document.querySelectorAll('.style-chip').forEach(c => {
                c.classList.toggle('active', c.dataset.style === style);
            });
            this.showToast('已切换为' + ReplyEngine.styleMap[style] + '风格', 'info');
        });

        document.getElementById('voice-btn').addEventListener('click', () => this.toggleVoiceInput());

        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            document.getElementById('voice-btn').style.display = 'none';
        }

        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('dark-mode-toggle').addEventListener('change', (e) => {
            this.setDarkMode(e.target.checked);
        });

        document.getElementById('lock-toggle').addEventListener('change', (e) => {
            const enabled = e.target.checked;
            document.getElementById('set-password-item').style.display = enabled ? 'flex' : 'none';
            if (enabled && !localStorage.getItem('eq_lock_pwd')) {
                this.showPasswordModal();
            }
            localStorage.setItem('eq_lock_enabled', enabled);
        });

        document.getElementById('set-password-btn').addEventListener('click', () => this.showPasswordModal());

        document.getElementById('unlock-btn').addEventListener('click', () => this.unlock());
        document.getElementById('lock-password').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.unlock();
        });

        document.getElementById('encryption-toggle').addEventListener('change', async (e) => {
            if (e.target.checked) {
                if (!CryptoUtil.hasKey()) {
                    await CryptoUtil.generateKey();
                }
                this.showToast('导出加密已开启', 'success');
            } else {
                CryptoUtil._cachedKey = null;
                localStorage.removeItem('eq_enc_enabled');
                this.showToast('导出加密已关闭', 'info');
            }
            await DB.setSetting('encryption', e.target.checked);
        });

        document.getElementById('export-data-btn').addEventListener('click', () => this.exportData());
        document.getElementById('import-data-btn').addEventListener('click', () => {
            document.getElementById('import-file-input').click();
        });
        document.getElementById('import-file-input').addEventListener('change', (e) => this.importData(e));

        document.getElementById('view-log-btn').addEventListener('click', () => this.showActivityLog());
        document.getElementById('delete-all-btn').addEventListener('click', () => this.confirmDeleteAll());

        document.getElementById('auto-backup-toggle').addEventListener('change', async (e) => {
            await DB.setSetting('autoBackup', e.target.checked);
            if (e.target.checked) {
                const freq = await DB.getSetting('backupFrequency') || 'daily';
                this.startAutoBackup(freq);
            } else {
                this.stopAutoBackup();
            }
        });
        document.getElementById('backup-frequency').addEventListener('change', async (e) => {
            await DB.setSetting('backupFrequency', e.target.value);
            const autoBackup = await DB.getSetting('autoBackup');
            if (autoBackup) {
                this.startAutoBackup(e.target.value);
            }
        });

        document.getElementById('history-search').addEventListener('input', () => this.debounce(this.filterHistory));
        document.getElementById('history-filter-btn').addEventListener('click', () => {
            document.getElementById('history-filter-panel').classList.toggle('hidden');
        });
        document.getElementById('filter-scene').addEventListener('change', () => this.filterHistory());
        document.getElementById('filter-rating').addEventListener('change', () => this.filterHistory());
        document.getElementById('clear-history-btn').addEventListener('click', () => this.clearHistory());

        document.getElementById('add-folder-btn').addEventListener('click', () => this.showAddFolderModal());

        document.getElementById('scene-tree-btn').addEventListener('click', () => this.showSceneTree());

        document.getElementById('add-custom-reply-btn').addEventListener('click', () => this.showAddCustomReplyModal());

        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeModal();
        });
    },

    switchPage(page) {
        this.currentPage = page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-' + page).classList.add('active');
        document.querySelectorAll('.tab-item').forEach(t => {
            const isActive = t.dataset.page === page;
            t.classList.toggle('active', isActive);
            t.setAttribute('aria-selected', isActive);
            t.setAttribute('tabindex', isActive ? '0' : '-1');
        });

        if (page === 'history') this.loadHistory();
        if (page === 'favorites') this.loadFavorites();
        if (page === 'settings') this.updateDataStats();
    },

    async generateReplies() {
        if (this._generating) return;
        this._generating = true;

        const input = document.getElementById('user-input').value.trim();
        if (!input) {
            this._generating = false;
            this.showToast('请输入对话内容', 'warning');
            return;
        }

        const btn = document.getElementById('generate-btn');
        btn.disabled = true;
        btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> 生成中…';

        try {

        const suggestions = await ReplyEngine.suggestScenes(input);
        if (suggestions.length > 0 && this.currentScene === 0) {
            const suggestEl = document.getElementById('scene-suggest');
            const chipsEl = document.getElementById('suggest-chips');
            suggestEl.classList.remove('hidden');
            chipsEl.innerHTML = '';
            suggestions.forEach(s => {
                const chip = document.createElement('div');
                chip.className = 'suggest-chip';
                chip.textContent = s.icon + ' ' + s.name;
                chip.addEventListener('click', () => {
                    this.currentScene = s.id;
                    document.querySelectorAll('.scene-chip').forEach(c => {
                        c.classList.toggle('active', parseInt(c.dataset.scene) === s.id);
                    });
                    suggestEl.classList.add('hidden');
                    this.generateReplies();
                });
                chipsEl.appendChild(chip);
            });
        } else {
            document.getElementById('scene-suggest').classList.add('hidden');
        }

        const { replies: results, confidence, needsClarification, clarificationPrompt } = await ReplyEngine.generateReplies(input, this.currentScene, this.currentStyle);
        this.renderDiagnosis(input);

        const section = document.getElementById('replies-section');
        const list = document.getElementById('replies-list');
        const countEl = document.getElementById('reply-count');

        section.classList.remove('hidden');
        countEl.textContent = results.length + ' 条回复';
        if (confidence > 0 && confidence < 50) {
            countEl.textContent += ' · 匹配度较低';
        }
        list.innerHTML = '';

        if (needsClarification && clarificationPrompt) {
            const clarifyEl = document.createElement('div');
            clarifyEl.className = 'clarification-prompt';
            clarifyEl.innerHTML = `<div class="clarification-icon">💡</div><div class="clarification-text">${this.escapeHtml(clarificationPrompt.text)}</div><div class="clarification-tone">${this.escapeHtml(clarificationPrompt.tone)}</div>`;
            list.appendChild(clarifyEl);
        }

        if (results.length === 0) {
            list.innerHTML = '<div class="empty-state"><div class="empty-icon">🤔</div><p>暂无匹配回复</p><p class="empty-hint">试试换个描述或切换场景</p></div>';
            return;
        }

        const favorites = await DB.getAll('favorites');
        const favIds = new Set(favorites.map(f => f.replyId));
        const inputKeywords = ReplyEngine.extractKeywords(input);

        results.forEach((reply, index) => {
            const highlightedReply = ReplyEngine.highlightKeywords(reply.displayReply, inputKeywords);
            const card = this.createReplyCard(reply, input, favIds.has(reply.id), index, highlightedReply);
            list.appendChild(card);
        });

        const historyItem = {
            id: Date.now(),
            input: input,
            scene: this.currentScene,
            style: this.currentStyle,
            replyIds: results.map(r => r.id),
            timestamp: new Date().toISOString()
        };
        await DB.put('userHistory', historyItem);
        } finally {
            this._generating = false;
            btn.disabled = false;
            btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> 生成高情商回复';
        }
    },

    renderDiagnosis(input) {
        const diagnosis = ReplyEngine.analyzeConversation(input, this.currentScene);
        document.getElementById('diagnosis-intent').textContent = diagnosis.intent;
        document.getElementById('diagnosis-emotion').textContent = diagnosis.emotion;
        document.getElementById('diagnosis-strategy').textContent = diagnosis.strategy;
        document.getElementById('diagnosis-minefield').textContent = diagnosis.minefield;
        document.getElementById('diagnosis-section').classList.remove('hidden');
    },

    createReplyCard(reply, inputText, isFav, index, highlightedReply) {
        const card = document.createElement('div');
        card.className = 'reply-card';
        card.style.animationDelay = (index * 0.05) + 's';

        const scene = this.allScenes.find(s => s.id === reply.sceneId);
        const sceneName = scene ? scene.icon + ' ' + scene.name : '';
        const styleName = ReplyEngine.styleMap[reply.displayStyle] || '';

        const tagsHtml = (reply.tags || []).map(t => `<span class="reply-tag">${this.escapeHtml(t)}</span>`).join('');
        const styleTag = styleName ? `<span class="reply-tag style-tag">${this.escapeHtml(styleName)}</span>` : '';
        const strategy = reply.strategy || ReplyEngine.getStrategyMeta(reply, index);
        const strategyTag = strategy ? `<span class="reply-tag strategy-tag">选项 ${this.escapeHtml(strategy.key)} · ${this.escapeHtml(strategy.type)}</span>` : '';

        const upVotes = reply.votes ? reply.votes.up : 0;
        const downVotes = reply.votes ? reply.votes.down : 0;

        const displayText = highlightedReply || this.escapeHtml(reply.displayReply);
        const matchInfo = reply.matchedKeywords && reply.matchedKeywords.length > 0 
            ? `<div class="match-info">🎯 匹配关键词：${reply.matchedKeywords.map(k => this.escapeHtml(k)).join('、')}</div>` 
            : '';

        const escapedInput = this.escapeHtml(inputText);

        card.innerHTML = `
            <div class="reply-card-header">
                <div class="reply-tags">
                    ${sceneName ? `<span class="reply-tag">${this.escapeHtml(sceneName)}</span>` : ''}
                    ${tagsHtml}
                    ${styleTag}
                    ${strategyTag}
                </div>
                <button class="reply-fav-btn ${isFav ? 'active' : ''}" data-id="${reply.id}" title="收藏">
                    ${isFav ? '⭐' : '☆'}
                </button>
            </div>
            ${inputText ? `<div class="reply-card-input-preview">💬 ${escapedInput}</div>` : ''}
            ${matchInfo}
            <div class="reply-text">${displayText}</div>
            ${strategy ? `
                <div class="reply-analysis">
                    <div><strong>适用边界：</strong>${this.escapeHtml(strategy.fit)}</div>
                    <div><strong>解析：</strong>${this.escapeHtml(strategy.analysis)}</div>
                </div>
            ` : ''}
            <div class="reply-card-footer">
                <div class="reply-vote">
                    <button class="vote-btn upvote" data-id="${reply.id}">👍 <span>${upVotes}</span></button>
                    <button class="vote-btn downvote" data-id="${reply.id}">👎 <span>${downVotes}</span></button>
                </div>
                <div class="reply-actions">
                    <button class="reply-action-btn copy-btn" data-text="${this.escapeHtml(reply.displayReply)}" title="复制">📋</button>
                    <button class="reply-action-btn quote-btn" data-text="${this.escapeHtml(reply.displayReply)}" title="引用">💬</button>
                </div>
            </div>
        `;

        card.querySelector('.reply-fav-btn').addEventListener('click', (e) => {
            this.toggleFavorite(reply.id, e.currentTarget);
        });

        card.querySelectorAll('.vote-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const btnEl = e.currentTarget;
                const id = parseInt(btnEl.dataset.id);
                const type = btnEl.classList.contains('upvote') ? 'up' : 'down';
                const isActive = btnEl.classList.contains('active');
                const votes = await ReplyEngine.recordVote(id, type, isActive);
                if (votes) {
                    btnEl.classList.toggle('active');
                    btnEl.querySelector('span').textContent = votes[type];
                }
            });
        });

        card.querySelector('.copy-btn').addEventListener('click', (e) => {
            const text = this.unescapeHtml(e.currentTarget.dataset.text);
            navigator.clipboard.writeText(text).then(() => {
                this.showToast('已复制到剪贴板', 'success');
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                this.showToast('已复制到剪贴板', 'success');
            });
            ReplyEngine.recordUsage(reply.id);
        });

        card.querySelector('.quote-btn').addEventListener('click', (e) => {
            const text = this.unescapeHtml(e.currentTarget.dataset.text);
            const input = document.getElementById('user-input');
            input.value = text;
            input.focus();
            this.switchPage('home');
        });

        return card;
    },

    async toggleFavorite(replyId, btnEl) {
        const favorites = await DB.getAll('favorites');
        const existing = favorites.find(f => f.replyId === replyId);

        if (existing) {
            await DB.delete('favorites', existing.id);
            btnEl.classList.remove('active');
            btnEl.textContent = '☆';
            this.showToast('已取消收藏', 'info');
        } else {
            const reply = await DB.get('replies', replyId);
            if (reply) {
                await DB.put('favorites', {
                    id: Date.now(),
                    replyId: replyId,
                    folderId: 'default',
                    customTags: [],
                    createdAt: new Date().toISOString()
                });
                btnEl.classList.add('active');
                btnEl.textContent = '⭐';
                this.showToast('已收藏', 'success');
            }
        }
    },

    async loadHistory() {
        this.allHistory = await DB.getAll('userHistory');
        this.allHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        this.renderHistory(this.allHistory);
    },

    renderHistory(items, keyword = '') {
        const container = document.getElementById('history-list');
        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>暂无历史记录</p><p class="empty-hint">开始对话后，记录会出现在这里</p></div>';
            return;
        }

        container.innerHTML = '';
        items.forEach(item => {
            const scene = this.allScenes.find(s => s.id === item.scene);
            const sceneName = scene ? scene.icon + ' ' + scene.name : '未分类';
            const time = this.formatTime(item.timestamp);
            const inputHtml = keyword ? this.highlightText(this.escapeHtml(item.input), keyword) : this.escapeHtml(item.input);

            const card = document.createElement('div');
            card.className = 'history-card';
            card.innerHTML = `
                <div class="history-card-top">
                    <span class="history-card-scene">${this.escapeHtml(sceneName)}</span>
                    <span class="history-card-time">${time}</span>
                </div>
                <div class="history-card-input">${inputHtml}</div>
                <div class="history-card-reply" style="color:var(--text-muted);font-size:12px">${item.style ? ReplyEngine.styleMap[item.style] + '风格' : ''} · ${item.replyIds ? item.replyIds.length + '条回复' : ''}</div>
            `;
            card.addEventListener('click', () => {
                document.getElementById('user-input').value = item.input;
                if (item.scene) {
                    this.currentScene = item.scene;
                    document.querySelectorAll('.scene-chip').forEach(c => {
                        c.classList.toggle('active', parseInt(c.dataset.scene) === item.scene);
                    });
                }
                if (item.style) {
                    this.currentStyle = item.style;
                    document.querySelectorAll('.style-chip').forEach(c => {
                        c.classList.toggle('active', c.dataset.style === item.style);
                    });
                }
                this.switchPage('home');
                this.generateReplies();
            });
            container.appendChild(card);
        });
    },

    async filterHistory() {
        const keyword = document.getElementById('history-search').value.trim().toLowerCase();
        const sceneFilter = document.getElementById('filter-scene').value;
        const ratingFilter = document.getElementById('filter-rating').value;

        let filtered = [...this.allHistory];

        if (keyword) {
            filtered = filtered.filter(h => h.input.toLowerCase().includes(keyword));
        }
        if (sceneFilter) {
            filtered = filtered.filter(h => h.scene === parseInt(sceneFilter));
        }
        if (ratingFilter) {
            const minRating = parseInt(ratingFilter);
            const allReplyIds = new Set();
            filtered.forEach(h => {
                if (h.replyIds) h.replyIds.forEach(id => allReplyIds.add(id));
            });
            const replyMap = new Map();
            for (const id of allReplyIds) {
                const reply = await DB.get('replies', id);
                if (reply) replyMap.set(id, reply);
            }
            filtered = filtered.filter(h => {
                if (!h.replyIds || h.replyIds.length === 0) return false;
                return h.replyIds.some(rid => {
                    const reply = replyMap.get(rid);
                    return reply && reply.userRating && reply.userRating >= minRating;
                });
            });
        }

        this.renderHistory(filtered, keyword);
    },

    async clearHistory() {
        this.showConfirmModal('确定清空所有历史记录？', '此操作不可恢复', async () => {
            await DB.clear('userHistory');
            this.allHistory = [];
            this.renderHistory([]);
            this.showToast('历史记录已清空', 'success');
        });
    },

    async loadFavorites() {
        this.allFavorites = await DB.getAll('favorites');
        this.allFolders = await DB.getAll('folders');
        this.allReplies = await DB.getAll('replies');
        this.renderFolderTabs();
        this.renderFavorites();
    },

    renderFolderTabs() {
        const container = document.getElementById('folder-tabs');
        container.innerHTML = '<div class="folder-tab active" data-folder="all">全部</div>';
        this.allFolders.forEach(folder => {
            const tab = document.createElement('div');
            tab.className = 'folder-tab';
            tab.dataset.folder = folder.id;
            tab.textContent = folder.name;
            container.appendChild(tab);
        });

        container.querySelectorAll('.folder-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                container.querySelectorAll('.folder-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentFolder = tab.dataset.folder;
                this.renderFavorites();
            });
        });
    },

    async renderFavorites() {
        const container = document.getElementById('favorites-list');
        let favs = [...this.allFavorites];

        if (this.currentFolder !== 'all') {
            favs = favs.filter(f => f.folderId === this.currentFolder);
        }

        if (favs.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-icon">⭐</div><p>暂无收藏</p><p class="empty-hint">点击回复卡片上的⭐即可收藏</p></div>';
            return;
        }

        container.innerHTML = '';
        for (const fav of favs) {
            const reply = this.allReplies.find(r => r.id === fav.replyId);
            if (!reply) continue;

            const folder = this.allFolders.find(f => f.id === fav.folderId);
            const folderName = folder ? folder.name : '未分类';
            const tagsHtml = [...(reply.tags || []), ...(fav.customTags || [])].map(t => `<span class="reply-tag">${this.escapeHtml(t)}</span>`).join('');

            const card = document.createElement('div');
            card.className = 'favorite-card';
            card.innerHTML = `
                <div class="favorite-card-top">
                    <span class="favorite-card-folder">📁 ${this.escapeHtml(folderName)}</span>
                    <div class="favorite-card-actions">
                        <button class="reply-action-btn fav-copy-btn" title="复制">📋</button>
                        <button class="reply-action-btn fav-quote-btn" title="引用">💬</button>
                        <button class="reply-action-btn edit-fav-btn" data-id="${fav.id}" title="编辑">✏️</button>
                        <button class="reply-action-btn delete-fav-btn" data-id="${fav.id}" title="删除">🗑️</button>
                    </div>
                </div>
                <div class="favorite-card-text">${this.escapeHtml(reply.reply)}</div>
                <div class="favorite-card-tags">${tagsHtml}</div>
                <div class="custom-tag-input">
                    <input type="text" placeholder="添加自定义标签…" class="add-tag-input" data-fav-id="${fav.id}">
                    <button class="add-tag-btn" data-fav-id="${fav.id}">添加</button>
                </div>
            `;

            card.querySelector('.fav-copy-btn').addEventListener('click', () => {
                navigator.clipboard.writeText(reply.reply).then(() => {
                    this.showToast('已复制到剪贴板', 'success');
                }).catch(() => {
                    const ta = document.createElement('textarea');
                    ta.value = reply.reply;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    this.showToast('已复制到剪贴板', 'success');
                });
            });

            card.querySelector('.fav-quote-btn').addEventListener('click', () => {
                document.getElementById('user-input').value = reply.reply;
                this.switchPage('home');
            });

            card.querySelector('.edit-fav-btn').addEventListener('click', () => {
                this.showEditFavoriteModal(fav);
            });

            card.querySelector('.delete-fav-btn').addEventListener('click', async () => {
                await DB.delete('favorites', fav.id);
                this.showToast('已取消收藏', 'info');
                this.loadFavorites();
            });

            card.querySelector('.add-tag-btn').addEventListener('click', async (e) => {
                const input = card.querySelector('.add-tag-input');
                const tag = input.value.trim();
                if (tag) {
                    if (!fav.customTags) fav.customTags = [];
                    if (!fav.customTags.includes(tag)) {
                        fav.customTags.push(tag);
                        await DB.put('favorites', fav);
                        this.showToast('标签已添加', 'success');
                        this.loadFavorites();
                    }
                }
            });

            container.appendChild(card);
        }
    },

    showEditFavoriteModal(fav) {
        const reply = this.allReplies.find(r => r.id === fav.replyId);
        const folderOptions = this.allFolders.map(f =>
            `<option value="${f.id}" ${f.id === fav.folderId ? 'selected' : ''}>${this.escapeHtml(f.name)}</option>`
        ).join('');

        this.showModal(`
            <div class="modal-title">编辑收藏 <button class="modal-close" onclick="App.closeModal()">✕</button></div>
            <div class="modal-form-group">
                <label>回复内容</label>
                <textarea readonly>${reply ? this.escapeHtml(reply.reply) : ''}</textarea>
            </div>
            <div class="modal-form-group">
                <label>所属文件夹</label>
                <select id="edit-fav-folder">${folderOptions}</select>
            </div>
            <div class="modal-form-group">
                <label>自定义标签（逗号分隔）</label>
                <input type="text" id="edit-fav-tags" value="${this.escapeHtml((fav.customTags || []).join(', '))}">
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="App.saveFavoriteEdit('${fav.id}')">保存</button>
            </div>
        `);
    },

    async saveFavoriteEdit(favId) {
        const fav = await DB.get('favorites', parseInt(favId));
        if (fav) {
            fav.folderId = document.getElementById('edit-fav-folder').value;
            const tagsStr = document.getElementById('edit-fav-tags').value;
            fav.customTags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
            await DB.put('favorites', fav);
            this.showToast('收藏已更新', 'success');
            this.closeModal();
            this.loadFavorites();
        }
    },

    showAddFolderModal() {
        this.showModal(`
            <div class="modal-title">新建收藏夹 <button class="modal-close" onclick="App.closeModal()">✕</button></div>
            <div class="modal-form-group">
                <label>文件夹名称</label>
                <input type="text" id="new-folder-name" placeholder="如：谈判技巧">
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="App.createFolder()">创建</button>
            </div>
        `);
    },

    async createFolder() {
        const name = document.getElementById('new-folder-name').value.trim();
        if (!name) {
            this.showToast('请输入文件夹名称', 'warning');
            return;
        }
        await DB.put('folders', {
            id: 'folder_' + Date.now(),
            name: name,
            createdAt: new Date().toISOString()
        });
        this.showToast('文件夹已创建', 'success');
        this.closeModal();
        this.loadFavorites();
    },

    toggleTheme() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        this.setDarkMode(!isDark);
        document.getElementById('dark-mode-toggle').checked = !isDark;
    },

    async setDarkMode(dark) {
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
        document.querySelector('.theme-icon').textContent = dark ? '☀️' : '🌙';
        await DB.setSetting('darkMode', dark);
    },

    toggleVoiceInput() {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            this.showToast('您的浏览器不支持语音输入', 'error');
            return;
        }

        if (this.isRecording) {
            this.recognition.stop();
            this.isRecording = false;
            document.getElementById('voice-btn').classList.remove('voice-recording');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'zh-CN';
        this.recognition.continuous = false;
        this.recognition.interimResults = true;

        this.recognition.onstart = () => {
            this.isRecording = true;
            document.getElementById('voice-btn').classList.add('voice-recording');
            this.showToast('正在聆听…', 'info');
        };

        this.recognition.onresult = (e) => {
            let transcript = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                transcript += e.results[i][0].transcript;
            }
            document.getElementById('user-input').value = transcript;
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            document.getElementById('voice-btn').classList.remove('voice-recording');
        };

        this.recognition.onerror = (e) => {
            this.isRecording = false;
            document.getElementById('voice-btn').classList.remove('voice-recording');
            if (e.error !== 'no-speech') {
                this.showToast('语音识别出错：' + e.error, 'error');
            }
        };

        this.recognition.start();
    },

    showPasswordModal() {
        this.showModal(`
            <div class="modal-title">设置锁定密码 <button class="modal-close" onclick="App.closeModal()">✕</button></div>
            <div class="modal-form-group">
                <label>密码</label>
                <input type="password" id="new-lock-pwd" placeholder="输入密码">
            </div>
            <div class="modal-form-group">
                <label>确认密码</label>
                <input type="password" id="confirm-lock-pwd" placeholder="再次输入密码">
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="App.setPassword()">确认</button>
            </div>
        `);
    },

    async setPassword() {
        const pwd = document.getElementById('new-lock-pwd').value;
        const confirm = document.getElementById('confirm-lock-pwd').value;
        if (!pwd) {
            this.showToast('请输入密码', 'warning');
            return;
        }
        if (pwd.length < 6) {
            this.showToast('密码至少6位', 'warning');
            return;
        }
        if (pwd !== confirm) {
            this.showToast('两次密码不一致', 'error');
            return;
        }
        const salt = 'eq_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
        const hash = await this.hashPassword(pwd, salt);
        localStorage.setItem('eq_lock_pwd', JSON.stringify({ salt, hash }));
        localStorage.setItem('eq_lock_enabled', 'true');
        document.getElementById('lock-toggle').checked = true;
        document.getElementById('set-password-item').style.display = 'flex';
        this.showToast('密码设置成功', 'success');
        this.closeModal();
    },

    async unlock() {
        const now = Date.now();
        if (this._lockLockedUntil > now) {
            const remainSec = Math.ceil((this._lockLockedUntil - now) / 1000);
            document.getElementById('lock-error').textContent = `尝试次数过多，请${remainSec}秒后再试`;
            document.getElementById('lock-error').classList.remove('hidden');
            return;
        }

        const input = document.getElementById('lock-password').value;
        const stored = localStorage.getItem('eq_lock_pwd');
        try {
            const { salt, hash } = JSON.parse(stored);
            const inputHash = await this.hashPassword(input, salt);
            if (inputHash === hash) {
                this._lockAttempts = 0;
                this._lockLockedUntil = 0;
                document.getElementById('lock-screen').classList.add('hidden');
                document.getElementById('lock-error').classList.add('hidden');
                document.getElementById('lock-password').value = '';
            } else {
                this._lockAttempts++;
                if (this._lockAttempts >= 5) {
                    const lockDuration = Math.min(30000 * Math.pow(2, this._lockAttempts - 5), 300000);
                    this._lockLockedUntil = now + lockDuration;
                    const remainSec = Math.ceil(lockDuration / 1000);
                    document.getElementById('lock-error').textContent = `密码错误次数过多，请${remainSec}秒后再试`;
                } else {
                    document.getElementById('lock-error').textContent = `密码错误，请重试（${5 - this._lockAttempts}次后锁定）`;
                }
                document.getElementById('lock-error').classList.remove('hidden');
            }
        } catch (e) {
            this._lockAttempts++;
            document.getElementById('lock-error').textContent = '密码错误，请重试';
            document.getElementById('lock-error').classList.remove('hidden');
        }
    },

    async exportData() {
        try {
            const data = await DB.exportAll();
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '高情商回复助手_备份_' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('数据导出成功', 'success');
        } catch (e) {
            this.showToast('导出失败：' + e.message, 'error');
        }
    },

    async importData(e) {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const success = await DB.importAll(text);
            if (success) {
                this.showToast('数据导入成功', 'success');
                ReplyEngine.invalidateCache();
                await this.loadScenes();
                await this.loadTagCloud();
            } else {
                this.showToast('数据导入失败', 'error');
            }
        } catch (err) {
            this.showToast('导入失败：' + err.message, 'error');
        }
        e.target.value = '';
    },

    async showActivityLog() {
        const logs = await DataLog.getAll();
        const logsHtml = logs.slice(0, 50).map(log => `
            <div class="log-item">
                <span class="log-time">${this.formatTime(log.timestamp)}</span>
                <span class="log-action"> ${this.escapeHtml(log.action)} → ${this.escapeHtml(log.type)} ${this.escapeHtml(log.detail)}</span>
            </div>
        `).join('');

        this.showModal(`
            <div class="modal-title">数据活动日志 <button class="modal-close" onclick="App.closeModal()">✕</button></div>
            ${logs.length === 0 ? '<p style="color:var(--text-muted);text-align:center;padding:20px">暂无日志记录</p>' : logsHtml}
        `);
    },

    confirmDeleteAll() {
        this.showConfirmModal('确定删除所有数据？', '此操作不可恢复，所有数据将被永久删除', async () => {
            await DB.deleteAllData();
            ReplyEngine.invalidateCache();
            this.showToast('所有数据已删除', 'success');
            await this.loadScenes();
            await this.loadTagCloud();
            this.checkLock();
        });
    },

    showConfirmModal(title, desc, onConfirm) {
        this.showModal(`
            <div class="confirm-modal-body">
                <div class="confirm-icon">⚠️</div>
                <h3>${this.escapeHtml(title)}</h3>
                <p>${this.escapeHtml(desc)}</p>
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.closeModal()">取消</button>
                <button class="btn btn-danger" id="confirm-action-btn">确认</button>
            </div>
        `);
        document.getElementById('confirm-action-btn').addEventListener('click', async () => {
            await onConfirm();
            this.closeModal();
        });
    },

    showModal(html) {
        if (this._modalKeyHandler) {
            document.removeEventListener('keydown', this._modalKeyHandler);
            this._modalKeyHandler = null;
        }
        document.getElementById('modal-content').innerHTML = html;
        document.getElementById('modal-overlay').classList.remove('hidden');
        this._modalKeyHandler = (e) => {
            if (e.key === 'Escape') this.closeModal();
        };
        document.addEventListener('keydown', this._modalKeyHandler);
    },

    closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
        if (this._modalKeyHandler) {
            document.removeEventListener('keydown', this._modalKeyHandler);
            this._modalKeyHandler = null;
        }
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: '💡' };
        toast.innerHTML = `<span>${icons[type] || '💡'}</span><span>${this.escapeHtml(message)}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    },

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
        if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
        return date.toLocaleDateString('zh-CN');
    },

    async updateDataStats() {
        try {
            const scenes = await DB.count('scenes');
            const replies = await DB.count('replies');
            const history = await DB.count('userHistory');
            const favorites = await DB.count('favorites');
            document.getElementById('data-stats').textContent = `${scenes}场景 · ${replies}回复 · ${history}历史 · ${favorites}收藏`;
        } catch (e) {
            document.getElementById('data-stats').textContent = '加载失败';
        }
    },

    async showSceneTree() {
        const tree = await ReplyEngine.getSceneTree();
        const renderNode = (node, depth = 0) => {
            const indent = depth * 20;
            let html = `<div class="scene-tree-item" data-scene-id="${node.id}" style="padding-left:${14 + indent}px">
                <span class="arrow ${node.children && node.children.length > 0 ? '' : 'hidden'}">▶</span>
                <span>${node.icon || ''} ${this.escapeHtml(node.name)}</span>
            </div>`;
            if (node.children) {
                html += `<div class="scene-children" data-parent="${node.id}">`;
                for (const child of node.children) {
                    html += renderNode(child, depth + 1);
                }
                html += '</div>';
            }
            return html;
        };

        let treeHtml = tree.map(node => renderNode(node)).join('');

        this.showModal(`
            <div class="modal-title">场景浏览 <button class="modal-close" onclick="App.closeModal()">✕</button></div>
            <div id="scene-tree-container">${treeHtml}</div>
        `);

        document.querySelectorAll('.scene-tree-item').forEach(item => {
            item.addEventListener('click', () => {
                const sceneId = parseInt(item.dataset.sceneId);
                this.currentScene = sceneId;
                document.querySelectorAll('.scene-chip').forEach(c => {
                    c.classList.toggle('active', parseInt(c.dataset.scene) === sceneId);
                });
                if (!document.querySelector(`.scene-chip[data-scene="${sceneId}"]`)) {
                    const scene = this.allScenes.find(s => s.id === sceneId);
                    if (scene) {
                        const chips = document.getElementById('scene-chips');
                        const chip = document.createElement('div');
                        chip.className = 'scene-chip active';
                        chip.dataset.scene = scene.id;
                        chip.textContent = scene.icon + ' ' + scene.name;
                        chips.querySelectorAll('.scene-chip').forEach(c => c.classList.remove('active'));
                        chips.appendChild(chip);
                        chip.addEventListener('click', () => {
                            chips.querySelectorAll('.scene-chip').forEach(c => c.classList.remove('active'));
                            chip.classList.add('active');
                            this.currentScene = scene.id;
                        });
                    }
                }
                this.closeModal();
                this.showToast('已切换场景', 'info');
            });
        });

        document.querySelectorAll('.scene-tree-item .arrow:not(.hidden)').forEach(arrow => {
            arrow.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = arrow.closest('.scene-tree-item');
                const parentId = item.dataset.sceneId;
                const children = document.querySelector(`.scene-children[data-parent="${parentId}"]`);
                if (children) {
                    children.classList.toggle('hidden');
                    arrow.classList.toggle('expanded');
                }
            });
        });
    },

    showAddCustomReplyModal() {
        const sceneOptions = this.allScenes.map(s =>
            `<option value="${s.id}">${s.icon || ''} ${this.escapeHtml(s.name)}</option>`
        ).join('');

        this.showModal(`
            <div class="modal-title">添加自定义回复 <button class="modal-close" onclick="App.closeModal()">✕</button></div>
            <div class="modal-form-group">
                <label>对话场景</label>
                <select id="custom-reply-scene">${sceneOptions}</select>
            </div>
            <div class="modal-form-group">
                <label>对方说的话</label>
                <input type="text" id="custom-reply-input" placeholder="如：领导说“你看着办吧”">
            </div>
            <div class="modal-form-group">
                <label>你的高情商回复</label>
                <textarea id="custom-reply-text" rows="3" placeholder="输入你的回复话术"></textarea>
            </div>
            <div class="modal-form-group">
                <label>标签（逗号分隔）</label>
                <input type="text" id="custom-reply-tags" placeholder="如：委婉拒绝,资源协调">
            </div>
            <div class="modal-actions">
                <button class="btn btn-outline" onclick="App.closeModal()">取消</button>
                <button class="btn btn-primary" onclick="App.saveCustomReply()">保存</button>
            </div>
        `);
    },

    async saveCustomReply() {
        const sceneId = parseInt(document.getElementById('custom-reply-scene').value);
        const input = document.getElementById('custom-reply-input').value.trim();
        const reply = document.getElementById('custom-reply-text').value.trim();
        const tagsStr = document.getElementById('custom-reply-tags').value.trim();

        if (!reply) {
            this.showToast('请输入回复内容', 'warning');
            return;
        }

        const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];
        const keywords = input ? input.replace(/[，。！？、""''：；]/g, ' ').split(/\s+/).filter(w => w.length > 1) : [];

        const newReply = {
            id: Date.now(),
            sceneId: sceneId,
            input: input,
            reply: reply,
            tags: tags,
            keywords: keywords,
            style: 'formal',
            userRating: 5.0,
            userCustom: true,
            useCount: 0,
            votes: { up: 0, down: 0 },
            styleVariants: ReplyEngine.generateToneVariants(reply)
        };

        await DB.put('replies', newReply);
        ReplyEngine.invalidateCache();
        this.showToast('自定义回复已添加', 'success');
        this.closeModal();
        await this.loadTagCloud();
    },

    highlightText(text, keyword) {
        if (!keyword || !text) return text || '';
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        try {
            const regex = new RegExp(`(${escaped})`, 'gi');
            return text.replace(regex, '<span class="highlight">$1</span>');
        } catch (e) {
            return text;
        }
    },

    startAutoBackup(frequency) {
        this.stopAutoBackup();
        const interval = frequency === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
        const lastBackup = localStorage.getItem('eq_last_auto_backup');
        if (lastBackup) {
            const elapsed = Date.now() - parseInt(lastBackup);
            if (elapsed < interval) {
                const remaining = interval - elapsed;
                this._autoBackupTimer = setTimeout(() => {
                    this.performAutoBackup();
                    this._autoBackupTimer = setInterval(() => this.performAutoBackup(), interval);
                }, remaining);
                return;
            }
        }
        this.performAutoBackup();
        this._autoBackupTimer = setInterval(() => this.performAutoBackup(), interval);
    },

    stopAutoBackup() {
        if (this._autoBackupTimer) {
            clearTimeout(this._autoBackupTimer);
            clearInterval(this._autoBackupTimer);
            this._autoBackupTimer = null;
        }
    },

    async performAutoBackup() {
        try {
            const data = await DB.exportAll();
            const blob = new Blob([data], { type: 'application/json' });
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                if (estimate.usage && estimate.quota && estimate.usage / estimate.quota > 0.9) {
                    this.showToast('存储空间不足，自动备份跳过', 'warning');
                    return;
                }
            }
            const backupRecord = {
                id: 'auto_backup_' + Date.now(),
                timestamp: new Date().toISOString(),
                size: blob.size,
                type: 'auto',
                data: data
            };
            await DB.put('settings', { key: 'lastAutoBackup', value: backupRecord });
            localStorage.setItem('eq_last_auto_backup', Date.now().toString());
            this.showToast('自动备份已完成', 'success');
        } catch (e) {
            console.error('Auto backup failed:', e);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
