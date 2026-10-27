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

// 备份恢复
window.exportData = () => {
    const blob = new Blob([JSON.stringify({ categories: categoryList, apis: apiList }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `软盒备份_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    window.closeBackupModal();
};
window.triggerImport = () => document.getElementById('import-file').click();
window.importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            localStorage.setItem('softboxCategoryStore', JSON.stringify(data.categories || []));
            localStorage.setItem('softboxApiStore', JSON.stringify(data.apis || []));
            alert("恢复成功！");
            location.reload();
        } catch (err) { alert("文件可能损坏~"); }
    };
    reader.readAsText(file);
    event.target.value = '';
};
window.closeBackupModal = () => { document.getElementById('backup-modal-overlay').classList.add('hidden'); document.body.style.overflow = ''; };

// 🚀 初始化
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

    const overlays = ['modal-overlay', 'detail-modal-overlay'];
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

    const mainTitle = document.getElementById('main-title');
    const backupModal = document.getElementById('backup-modal-overlay');
    if (mainTitle && backupModal) {
        let pressTimer;
        const openBackup = () => { backupModal.classList.remove('hidden'); document.body.style.overflow = 'hidden'; };
        const startPress = () => { pressTimer = setTimeout(openBackup, 600); };
        const cancelPress = () => { clearTimeout(pressTimer); };
        
        mainTitle.addEventListener('touchstart', startPress, { passive: true });
        mainTitle.addEventListener('touchend', cancelPress);
        mainTitle.addEventListener('mousedown', startPress);
        mainTitle.addEventListener('mouseup', cancelPress);
        mainTitle.addEventListener('mouseleave', cancelPress);
        mainTitle.addEventListener('dblclick', openBackup);
    }
    
    renderCategories();
    renderAPIs();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
else initApp();