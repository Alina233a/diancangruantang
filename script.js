window.onerror = function(msg, source, lineno) {
    console.error("捕获到错误:", msg, "行号:", lineno);
    return false;
};

// 🛡️ 安全转义工具函数（防止旧数据中含有单引号、换行符导致页面崩溃）
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeJsStr(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n').replace(/\r/g, '');
}

// 全局状态变量
let currentDetailIndex = -1;
let currentCategory = '全部';
let isBatchMode = false;
let selectedApis = [];
let categoryList = [];
let apiList = [];

// 🔄 安全读取数据
function loadDataFromStorage() {
    let rawList = [];
    try {
        const catData = localStorage.getItem('softboxCategoryStore');
        if (catData) {
            const parsedCat = JSON.parse(catData);
            if (Array.isArray(parsedCat)) categoryList = parsedCat.filter(c => typeof c === 'string' && c.trim() !== '');
        }
        const apiData = localStorage.getItem('softboxApiStore');
        if (apiData) {
            const parsedApi = JSON.parse(apiData);
            if (Array.isArray(parsedApi)) rawList = parsedApi;
        }
    } catch (e) {
        console.error("读取数据失败:", e);
    }

    apiList = rawList.map(api => {
        if (!api || typeof api !== 'object') return { name: "恢复的数据", url: "", key: "", share: "", categories: [], models: [] };
        if (api.category !== undefined) {
            api.categories = (api.category && api.category !== '未分类') ? [String(api.category)] : [];
            delete api.category;
        }
        if (!Array.isArray(api.categories)) api.categories = [];
        if (!Array.isArray(api.models)) api.models = [];
        
        api.categories.forEach(cat => {
            if (cat !== '全部' && cat !== '未分类' && !categoryList.includes(cat)) categoryList.push(cat);
        });
        return api;
    });
    saveAllData();
}

function saveAllData() {
    try {
        localStorage.setItem('softboxCategoryStore', JSON.stringify(categoryList));
        localStorage.setItem('softboxApiStore', JSON.stringify(apiList));
    } catch (e) {
        console.error("保存失败:", e);
    }
}

function getFilteredList() {
    if (currentCategory === '未分类') return apiList.filter(api => !api.categories || api.categories.length === 0);
    if (currentCategory !== '全部') return apiList.filter(api => api.categories && api.categories.includes(currentCategory));
    return apiList;
}

// 🎨 渲染函数
function renderCategories() {
    const tabsContainer = document.getElementById('category-tabs');
    if (!tabsContainer) return;

    const hasUncategorized = apiList.some(api => !api.categories || api.categories.length === 0);
    let tabsHtml = `<button class="cat-tab ${currentCategory === '全部' ? 'active' : ''}" onclick="switchCategory('全部')">全部</button>`;
    if (hasUncategorized || currentCategory === '未分类') {
        tabsHtml += `<button class="cat-tab ${currentCategory === '未分类' ? 'active' : ''}" onclick="switchCategory('未分类')">未分类</button>`;
    }
    categoryList.forEach(cat => {
        const isActive = currentCategory === cat ? 'active' : '';
        tabsHtml += `<button class="cat-tab ${isActive}" onclick="switchCategory('${escapeJsStr(cat)}')">${escapeHtml(cat)}</button>`;
    });
    tabsContainer.innerHTML = tabsHtml;

    ['api-category-list', 'batch-category-list'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '';
        categoryList.forEach(cat => {
            const span = document.createElement('span');
            span.className = 'multi-cat-tag';
            span.innerText = cat;
            span.onclick = () => span.classList.toggle('active');
            el.appendChild(span);
        });
    });
}

function renderAPIs() {
    const apiContainer = document.getElementById('api-container');
    if (!apiContainer) return;
    apiContainer.innerHTML = '';
    const filteredList = getFilteredList();
    if (filteredList.length === 0) {
        apiContainer.innerHTML = '<p style="text-align:center; width:100%; color:#bca0dc; font-size:1.1rem; margin-top: 40px; font-weight: bold;">这里还空着喔 ૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა</p>';
        return;
    }

    filteredList.forEach((api) => {
        const realIndex = apiList.indexOf(api);
        const card = document.createElement('div');
        card.className = 'api-card hand-drawn-border';
        if (isBatchMode && selectedApis.includes(realIndex)) card.classList.add('selected');

        card.onclick = () => {
            if (isBatchMode) {
                if (selectedApis.includes(realIndex)) {
                    selectedApis = selectedApis.filter(i => i !== realIndex);
                    card.classList.remove('selected');
                } else {
                    selectedApis.push(realIndex);
                    card.classList.add('selected');
                }
                const countEl = document.getElementById('batch-count-num');
                if (countEl) countEl.innerText = selectedApis.length;
            } else {
                openDetail(realIndex);
            }
        };

        const tapeClass = realIndex % 2 === 0 ? 'top-center' : 'top-left';
        const deleteBtnHtml = isBatchMode ? '' : `<button class="delete-btn" onclick="deleteAPI(event, ${realIndex})" title="擦除记录">✖</button>`;
        let tagsHtml = (api.categories || []).map(c => `<span class="card-category-tag">${escapeHtml(c)}</span>`).join(' ');

        card.innerHTML = `
            <div class="tape ${tapeClass}"></div>
            ${deleteBtnHtml}
            <h3>${escapeHtml(api.name)} <br> ${tagsHtml}</h3>
            <div class="card-buttons">
                <button class="macaron-btn ${api.url ? 'btn-blue' : 'btn-disabled'}" onclick="copyText(event, '${escapeJsStr(api.url)}')">链接</button>
                <button class="macaron-btn ${api.key ? 'btn-yellow' : 'btn-disabled'}" onclick="copyText(event, '${escapeJsStr(api.key)}')">密钥</button>
                <button class="macaron-btn ${api.share ? 'btn-green' : 'btn-disabled'}" onclick="copyText(event, '${escapeJsStr(api.share)}')">邀人</button>
            </div>
        `;
        apiContainer.appendChild(card);
    });
}

// 🖱️ 全局交互函数
window.switchCategory = function(catName) {
    if (isBatchMode) return;
    currentCategory = catName;
    renderCategories();
    renderAPIs();
};

window.openManageMenu = () => document.getElementById('manage-menu-overlay').classList.remove('hidden');
window.closeManageMenu = () => document.getElementById('manage-menu-overlay').classList.add('hidden');

window.showBatchMove = () => {
    if (selectedApis.length === 0) return alert("请先选中要追加分类的卡片喔！");
    document.querySelectorAll('#batch-category-list .multi-cat-tag').forEach(el => el.classList.remove('active'));
    document.getElementById('batch-move-overlay').classList.remove('hidden');
};
window.closeBatchMove = () => document.getElementById('batch-move-overlay').classList.add('hidden');

window.openCategoryManage = () => {
    if (isBatchMode) return alert("请先退出批量管理模式喔");
    const action = prompt("输入新分类名称来添加，或者输入 '-分类名' 来删除（例如：-游戏）：");
    if (!action) return;
    if (action.startsWith('-')) {
        const target = action.substring(1).trim();
        if (confirm(`确定要删掉 [${target}] 分类吗？ Ovo`)) {
            categoryList = categoryList.filter(c => c !== target);
            apiList.forEach(api => { if (api.categories) api.categories = api.categories.filter(c => c !== target); });
        }
    } else {
        const newCat = action.trim();
        if (newCat && !categoryList.includes(newCat) && newCat !== '未分类' && newCat !== '全部') categoryList.push(newCat);
    }
    saveAllData();
    if (!categoryList.includes(currentCategory) && currentCategory !== '全部' && currentCategory !== '未分类') currentCategory = '全部';
    renderCategories();
    renderAPIs();
};

window.toggleBatchMode = () => {
    isBatchMode = !isBatchMode;
    selectedApis = [];
    document.getElementById('batch-action-bar').classList.toggle('hidden', !isBatchMode);
    document.getElementById('add-btn').classList.toggle('hidden', isBatchMode);
    document.getElementById('batch-count-num').innerText = '0';
    renderAPIs();
};

window.moveUp = () => {
    if (selectedApis.length !== 1) return alert("请仅选中 1 个卡片进行移动喔！");
    const globalIdx = selectedApis[0];
    const currentFiltered = getFilteredList();
    const visibleIdx = currentFiltered.findIndex(api => api === apiList[globalIdx]);
    if (visibleIdx > 0) {
        const targetGlobalIdx = apiList.indexOf(currentFiltered[visibleIdx - 1]);
        [apiList[globalIdx], apiList[targetGlobalIdx]] = [apiList[targetGlobalIdx], apiList[globalIdx]];
        selectedApis = [targetGlobalIdx];
        saveAllData();
        renderAPIs();
    }
};

window.moveDown = () => {
    if (selectedApis.length !== 1) return alert("请仅选中 1 个卡片进行移动喔！");
    const globalIdx = selectedApis[0];
    const currentFiltered = getFilteredList();
    const visibleIdx = currentFiltered.findIndex(api => api === apiList[globalIdx]);
    if (visibleIdx !== -1 && visibleIdx < currentFiltered.length - 1) {
        const targetGlobalIdx = apiList.indexOf(currentFiltered[visibleIdx + 1]);
        [apiList[globalIdx], apiList[targetGlobalIdx]] = [apiList[targetGlobalIdx], apiList[globalIdx]];
        selectedApis = [targetGlobalIdx];
        saveAllData();
        renderAPIs();
    }
};

window.batchMove = () => {
    const activeEls = document.querySelectorAll('#batch-category-list .active');
    const targetCats = Array.from(activeEls).map(el => el.innerText);
    if (targetCats.length === 0) return alert("请在上面点击选择至少一个分类标签喔！");
    selectedApis.forEach(globalIdx => {
        if (apiList[globalIdx]) {
            apiList[globalIdx].categories = Array.from(new Set([...(apiList[globalIdx].categories || []), ...targetCats]));
        }
    });
    saveAllData();
    closeBatchMove();
    toggleBatchMode();
};

window.batchDelete = () => {
    if (selectedApis.length === 0) return alert("请先选中要删除的卡片喔！");
    if (confirm(`确定要一口气删掉这 ${selectedApis.length} 个站子吗？ Ovo`)) {
        selectedApis.sort((a, b) => b - a).forEach(index => apiList.splice(index, 1));
        saveAllData();
        toggleBatchMode();
        renderCategories();
    }
};

window.openDetail = (index) => {
    if (!apiList[index]) return;
    currentDetailIndex = index;
    const api = apiList[index];
    document.getElementById('detail-name').innerText = api.name || "";
    document.getElementById('detail-url').innerText = api.url || "";
    document.getElementById('detail-key').innerText = api.key || "无";
    document.getElementById('detail-share').innerText = api.share || "无";
    document.getElementById('page-1').classList.remove('d-none');
    document.getElementById('page-2').classList.add('d-none');
    renderModels();
    document.getElementById('detail-modal-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};

window.editApiInfo = () => {
    if (currentDetailIndex === -1 || !apiList[currentDetailIndex]) return;
    const api = apiList[currentDetailIndex];
    const newName = prompt("修改 API 名称：", api.name);
    if (newName === null) return;
    api.url = prompt("修改 URL：", api.url) ?? api.url;
    api.key = prompt("修改 KEY (可为空)：", api.key || "") ?? api.key;
    api.share = prompt("修改 邀人链接 (可为空)：", api.share || "") ?? api.share;
    
    const newCatsInput = prompt("修改分类 (多个请用逗号隔开)：", (api.categories || []).join(', '));
    if (newCatsInput !== null) {
        const newCatsArray = newCatsInput.split(/[,，]/).map(c => c.trim()).filter(c => c !== '');
        api.categories = newCatsArray;
        newCatsArray.forEach(cat => { if (!categoryList.includes(cat) && cat !== '全部' && cat !== '未分类') categoryList.push(cat); });
    }
    if (newName.trim() !== '') api.name = newName.trim();
    saveAllData();
    openDetail(currentDetailIndex);
    renderCategories();
    renderAPIs();
};

window.flipPage = (targetPage) => {
    document.getElementById('page-1').classList.toggle('d-none', targetPage === 2);
    document.getElementById('page-2').classList.toggle('d-none', targetPage === 1);
};

function renderModels() {
    const listEl = document.getElementById('model-list');
    listEl.innerHTML = '';
    const models = apiList[currentDetailIndex]?.models || [];
    if (models.length === 0) {
        listEl.innerHTML = '<p style="text-align:center; color: #bca0dc; font-size: 0.9rem; margin-top:20px;">还没有添加任何模型喔</p>';
        return;
    }
    models.forEach((model, mIndex) => {
        const item = document.createElement('div');
        item.className = 'model-item';
        item.innerHTML = `
            <span class="model-item-name">${escapeHtml(model)}</span>
            <div class="model-actions-btn">
                <button class="sticker-btn btn-blue copy-icon-btn" onclick="copyText(event, '${escapeJsStr(model)}')">⧉</button>
                <button class="model-delete-btn" onclick="deleteModel(${mIndex})">✖</button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

window.addModel = () => {
    const input = document.getElementById('new-model-input');
    const modelName = input.value.trim();
    if (modelName && currentDetailIndex !== -1) {
        if (!apiList[currentDetailIndex].models) apiList[currentDetailIndex].models = [];
        apiList[currentDetailIndex].models.push(modelName);
        saveAllData();
        input.value = '';
        renderModels();
    }
};

window.deleteModel = (modelIndex) => {
    if (confirm("确定删除吗？ Ovo")) {
        apiList[currentDetailIndex].models.splice(modelIndex, 1);
        saveAllData();
        renderModels();
    }
};

window.copyText = (e, text) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!text || text === "无" || isBatchMode) return;
    const btn = e.currentTarget || e.target;
    const showSuccess = () => {
        const originalText = btn.innerText;
        btn.innerText = btn.classList.contains('copy-icon-btn') ? "✓" : "✓ 已复制";
        setTimeout(() => { btn.innerText = originalText; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(showSuccess).catch(() => fallbackCopy(text, showSuccess));
    } else {
        fallbackCopy(text, showSuccess);
    }
};

function fallbackCopy(text, callback) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); if(callback) callback(); } catch (err) { alert("复制失败，请手动复制"); }
    document.body.removeChild(ta);
}

window.deleteAPI = (e, index) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (confirm("擦除记录？ Ovo")) {
        apiList.splice(index, 1);
        saveAllData();
        renderCategories();
        renderAPIs();
    }
};

// ==========================================
// ⚙️ 全新设置页 & GitHub云同步 & 本地备份
// ==========================================

window.openSettings = function() {
    document.getElementById('gh-token').value = localStorage.getItem('xc_gh_token') || '';
    document.getElementById('gh-username').value = localStorage.getItem('xc_gh_user') || '';
    document.getElementById('gh-repo').value = localStorage.getItem('xc_gh_repo') || 'xucenhe-backup';
    document.getElementById('gh-path').value = localStorage.getItem('xc_gh_path') || 'xucenhe_backup.json';
    
    document.getElementById('settings-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

window.closeSettings = function() {
    document.getElementById('settings-overlay').classList.add('hidden');
    document.body.style.overflow = '';
}

// 保存配置到本地，免得每次输入
function saveGhConfig(token, user, repo, path) {
    localStorage.setItem('xc_gh_token', token);
    localStorage.setItem('xc_gh_user', user);
    localStorage.setItem('xc_gh_repo', repo);
    localStorage.setItem('xc_gh_path', path);
}

// 备份到 GitHub
window.syncToGithub = async function() {
    const token = document.getElementById('gh-token').value.trim();
    const user = document.getElementById('gh-username').value.trim();
    const repo = document.getElementById('gh-repo').value.trim();
    const path = document.getElementById('gh-path').value.trim();

    if (!token || !user || !repo || !path) return alert("请填写完整的 GitHub 配置信息喔！");
    saveGhConfig(token, user, repo, path);

    const url = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;
    const headers = { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json" };

    try {
        let sha = null;
        const getRes = await fetch(url, { headers });
        if (getRes.ok) {
            const data = await getRes.json();
            sha = data.sha;
        }

        const backupData = { categories: categoryList, apis: apiList, exportDate: new Date().toLocaleString() };
        // 解决 Base64 编码中文报错
        const base64Content = btoa(unescape(encodeURIComponent(JSON.stringify(backupData, null, 2))));
        
        const body = { message: "Backup from 叙岑盒", content: base64Content };
        if (sha) body.sha = sha;

        const putRes = await fetch(url, { method: "PUT", headers: headers, body: JSON.stringify(body) });

        if (putRes.ok) {
            alert("☁️ 成功备份到 GitHub 仓库！");
        } else {
            const errData = await putRes.json();
            alert(`备份失败: ${errData.message}`);
        }
    } catch (err) {
        console.error(err);
        alert("网络错误，无法连接到 GitHub API");
    }
}

// 从 GitHub 恢复
window.syncFromGithub = async function() {
    const token = document.getElementById('gh-token').value.trim();
    const user = document.getElementById('gh-username').value.trim();
    const repo = document.getElementById('gh-repo').value.trim();
    const path = document.getElementById('gh-path').value.trim();

    if (!token || !user || !repo || !path) return alert("请填写完整的 GitHub 配置信息喔！");
    saveGhConfig(token, user, repo, path);

    const url = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;
    const headers = { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json" };

    try {
        const res = await fetch(url, { headers });
        if (!res.ok) {
            if (res.status === 404) return alert("云端还没有这个备份文件喔 (404)！");
            return alert("获取失败，请检查 Token 权限或仓库信息是否正确");
        }

        const data = await res.json();
        const jsonStr = decodeURIComponent(escape(atob(data.content)));
        const parsedData = JSON.parse(jsonStr);

        if (parsedData.categories && parsedData.apis) {
            if (confirm("云端数据读取成功！要覆盖本地数据吗？（原有数据将被替换噢！想清楚呀宝宝）")) {
                localStorage.setItem('softboxCategoryStore', JSON.stringify(parsedData.categories));
                localStorage.setItem('softboxApiStore', JSON.stringify(parsedData.apis));
                alert("云端数据恢复成功啦！૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა");
                location.reload(); 
            }
        } else {
            alert("云端的数据格式不匹配喔~");
        }
    } catch (err) {
        console.error(err);
        alert("解析云端数据失败，请确认文件内容正确");
    }
}

// 本地文件导出
window.exportData = function() {
    const backupData = { categories: categoryList, apis: apiList, exportDate: new Date().toLocaleString() };
    const dataStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, ""); 
    a.download = `叙岑盒备份_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    closeSettings();
}

// 本地文件导入
window.triggerImport = function() { document.getElementById('import-file').click(); }
window.importData = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.categories && data.apis) {
                localStorage.setItem('softboxCategoryStore', JSON.stringify(data.categories));
                localStorage.setItem('softboxApiStore', JSON.stringify(data.apis));
                alert("本地数据恢复成功啦！૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა");
                location.reload(); 
            } else {
                alert("这个文件好像不是叙岑盒的备份文件呀＞ᨓ＜");
            }
        } catch (err) {
            alert("读取失败了，备份文件可能损坏了耶߹꒳߹");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
}

// 🚀 启动与绑定事件监听
function initApp() {
    loadDataFromStorage();
    
    document.getElementById('add-btn').onclick = () => {
        document.querySelectorAll('#api-category-list .multi-cat-tag').forEach(el => el.classList.remove('active'));
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };
    
    document.getElementById('cancel-btn').onclick = () => {
        document.getElementById('modal-overlay').classList.add('hidden');
        document.getElementById('api-form').reset();
        document.body.style.overflow = '';
    };

    const overlays = ['modal-overlay', 'detail-modal-overlay', 'settings-overlay'];
    overlays.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', (e) => {
            if (e.target === el) { el.classList.add('hidden'); document.body.style.overflow = ''; }
        });
    });

    document.getElementById('api-form').onsubmit = (e) => {
        e.preventDefault();
        const activeEls = document.querySelectorAll('#api-category-list .active');
        apiList.push({
            name: document.getElementById('api-name').value.trim(),
            url: document.getElementById('api-url').value.trim(),
            key: document.getElementById('api-key').value.trim(),
            share: document.getElementById('api-share').value.trim(),
            categories: Array.from(activeEls).map(el => el.innerText),
            models: []
        });
        saveAllData();
        renderCategories();
        renderAPIs();
        document.getElementById('modal-overlay').classList.add('hidden');
        e.target.reset();
        document.body.style.overflow = '';
    };

    // 绑定标题长按与双击打开设置面板
    const mainTitle = document.getElementById('main-title');
    if (mainTitle) {
        let pressTimer;
        const startPress = () => { pressTimer = setTimeout(() => { openSettings(); if(navigator.vibrate) navigator.vibrate(50); }, 600); };
        const cancelPress = () => clearTimeout(pressTimer);
        
        mainTitle.addEventListener('contextmenu', e => e.preventDefault());
        mainTitle.addEventListener('touchstart', startPress, { passive: true });
        mainTitle.addEventListener('touchend', cancelPress);
        mainTitle.addEventListener('touchcancel', cancelPress);
        mainTitle.addEventListener('touchmove', cancelPress);
        mainTitle.addEventListener('mousedown', startPress);
        mainTitle.addEventListener('mouseup', cancelPress);
        mainTitle.addEventListener('mouseleave', cancelPress);
        mainTitle.addEventListener('dblclick', openSettings);
    }
    
    renderCategories();
    renderAPIs();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
else initApp();