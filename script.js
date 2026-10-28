// 【初始化主题设置】
(function() {
    const savedTheme = localStorage.getItem('xc_theme') || 'default';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

window.onerror = function(msg, source, lineno) {
    console.error("捕获到错误:", msg, "行号:", lineno);
    return false;
};

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeJsStr(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n').replace(/\r/g, '');
}

let currentDetailIndex = -1;
let isEditingDetail = false;
let currentCategory = '全部';
let isBatchMode = false;
let selectedApis = [];
let categoryList = [];
let apiList = [];

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
    } catch (e) {}

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
    } catch (e) {}
}

function getFilteredList() {
    if (currentCategory === '未分类') return apiList.filter(api => !api.categories || api.categories.length === 0);
    if (currentCategory !== '全部') return apiList.filter(api => api.categories && api.categories.includes(currentCategory));
    return apiList;
}

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
        apiContainer.innerHTML = '<p style="text-align:center; width:100%; color:var(--main-purple); font-size:1.1rem; margin-top: 40px; font-weight: bold;">这里还空着喔 ૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა</p>';
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

        const websiteIcon = api.website ? `<a href="${escapeJsStr(api.website)}" target="_blank" class="website-icon" title="前往官网" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg></a>` : '';

        card.innerHTML = `
            <div class="tape ${tapeClass}"></div>
            ${deleteBtnHtml}
            <h3>${escapeHtml(api.name)}${websiteIcon}<br>${tagsHtml}</h3>
            <div class="card-buttons">
                <button class="macaron-btn ${api.url ? 'btn-blue' : 'btn-disabled'}" onclick="copyText(event, '${escapeJsStr(api.url)}')">链接</button>
                <button class="macaron-btn ${api.key ? 'btn-yellow' : 'btn-disabled'}" onclick="copyText(event, '${escapeJsStr(api.key)}')">密钥</button>
                <button class="macaron-btn ${api.share ? 'btn-green' : 'btn-disabled'}" onclick="copyText(event, '${escapeJsStr(api.share)}')">邀人</button>
            </div>
        `;
        apiContainer.appendChild(card);
    });
}

function renderModels() {
    const listEl = document.getElementById('model-list');
    listEl.innerHTML = '';
    const models = apiList[currentDetailIndex]?.models || [];
    if (models.length === 0) {
        listEl.innerHTML = '<p style="text-align:center; color: var(--main-purple); font-size: 0.9rem; margin-top:20px;">还没有添加任何模型喔</p>';
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

window.switchCategory = function(catName) {
    if (isBatchMode) return;
    currentCategory = catName;
    renderCategories();
    renderAPIs();
};

window.openManageMenu = function() { document.getElementById('manage-menu-overlay').classList.remove('hidden'); };
window.closeManageMenu = function() { document.getElementById('manage-menu-overlay').classList.add('hidden'); };
window.showBatchMove = function() {
    if (selectedApis.length === 0) return alert("请先选中要追加分类的卡片喔！");
    document.querySelectorAll('#batch-category-list .multi-cat-tag').forEach(el => el.classList.remove('active'));
    document.getElementById('batch-move-overlay').classList.remove('hidden');
};
window.closeBatchMove = function() { document.getElementById('batch-move-overlay').classList.add('hidden'); };

window.openCategoryManage = function() {
    if (isBatchMode) return alert("请先退出批量管理模式喔");
    const action = prompt("输入新分类名称来添加，或者输入 '-分类名' 来删除（例如：-游戏）：");
    if (!action) return;
    if (action.startsWith('-')) {
        const target = action.substring(1).trim();
        if (confirm(`确定要删掉 [${target}] 分类吗？ ૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა`)) {
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

window.toggleBatchMode = function() {
    isBatchMode = !isBatchMode;
    selectedApis = [];
    document.getElementById('batch-action-bar').classList.toggle('hidden', !isBatchMode);
    document.getElementById('add-btn').classList.toggle('hidden', isBatchMode);
    document.getElementById('batch-count-num').innerText = '0';
    renderAPIs();
};

window.moveUp = function() {
    if (selectedApis.length !== 1) return alert("请仅选中 1 个卡片进行移动呀！");
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

window.moveDown = function() {
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

window.batchMove = function() {
    const activeEls = document.querySelectorAll('#batch-category-list .active');
    const targetCats = Array.from(activeEls).map(el => el.innerText);
    if (targetCats.length === 0) return alert("请在上面点击选择至少一个分类标签喔宝宝~");
    selectedApis.forEach(globalIdx => {
        if (apiList[globalIdx]) {
            apiList[globalIdx].categories = Array.from(new Set([...(apiList[globalIdx].categories || []), ...targetCats]));
        }
    });
    saveAllData();
    closeBatchMove();
    toggleBatchMode();
};

window.batchDelete = function() {
    if (selectedApis.length === 0) return alert("请先选中要删除的卡片喔！");
    if (confirm(`确定要一口气删掉这 ${selectedApis.length} 个站子吗？ /ᐠ꧞˃ 𛱊 ˂マ`)) {
        selectedApis.sort((a, b) => b - a).forEach(index => apiList.splice(index, 1));
        saveAllData();
        toggleBatchMode();
        renderCategories();
    }
};

window.openDetail = function(index) {
    if (!apiList[index]) return;
    currentDetailIndex = index;
    const api = apiList[index];

    // 每次打开弹窗，强制重置为非编辑状态
    isEditingDetail = false;
    const editBtn = document.getElementById('close-detail-btn');
    if (editBtn) {
        editBtn.innerText = '✎';
        editBtn.title = '修改信息';
    }
    
    // 隐藏输入框，显示纯文本
    document.querySelectorAll('.detail-display').forEach(el => el.classList.remove('d-none'));
    document.querySelectorAll('.detail-input').forEach(el => el.classList.add('d-none'));

    // 渲染纯文本数据
    document.getElementById('detail-name').innerText = api.name || "";
    const urls = getApiUrls(api);
    renderUrlCapsules(urls, api.activeUrlIndex || 0);
    document.getElementById('detail-key').innerText = api.key || "无";
    document.getElementById('detail-share').innerText = api.share || "无";
    
    const webEl = document.getElementById('detail-website');
    if (webEl) webEl.innerText = api.website || "无";

    const catEl = document.getElementById('detail-categories');
    if (catEl) catEl.innerText = (api.categories || []).join(', ') || "无";

    document.getElementById('page-1').classList.remove('d-none');
    document.getElementById('page-2').classList.add('d-none');
    renderModels();
    document.getElementById('detail-modal-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};

// 解析 API 中的所有 URL（兼容旧数据与多行数据）
function getApiUrls(api) {
    if (Array.isArray(api.urls) && api.urls.length > 0) return api.urls;
    if (typeof api.url === 'string' && api.url.trim() !== '') {
        return api.url.split('\n').map(u => u.trim()).filter(Boolean);
    }
    return [];
}

// 渲染 URL 胶囊切换器
window.renderUrlCapsules = function(urls, activeIndex = 0) {
    const bar = document.getElementById('url-capsule-bar');
    const urlText = document.getElementById('detail-url');
    if (!bar || !urlText) return;

    if (urls.length === 0) {
        bar.innerHTML = '';
        urlText.innerText = '无';
        return;
    }

    const safeIndex = (activeIndex >= 0 && activeIndex < urls.length) ? activeIndex : 0;
    urlText.innerText = urls[safeIndex];

    // 如果只有 1 个网址，自动隐藏胶囊栏，保持极简
    if (urls.length <= 1) {
        bar.innerHTML = '';
        return;
    }

    // 超过 1 个网址时，生成 [主] [1] [2] ...
    bar.innerHTML = urls.map((u, idx) => {
        const label = idx === 0 ? '主' : idx;
        const activeClass = idx === safeIndex ? 'active' : '';
        return `<span class="url-capsule ${activeClass}" onclick="switchDetailUrl(event, ${idx})" title="切换线路">${label}</span>`;
    }).join('');
};

// 点击胶囊切换显示的网址（同时将该线路设为默认复制线路）
window.switchDetailUrl = function(e, idx) {
    if (e && e.stopPropagation) e.stopPropagation();
    const api = apiList[currentDetailIndex];
    if (!api) return;
    const urls = getApiUrls(api);
    api.activeUrlIndex = idx; // 记住你最后选中的线路
    api.url = urls[idx] || urls[0] || ""; // 让主页外面的「链接」按钮也同步复制这条线路！
    saveAllData();
    renderUrlCapsules(urls, idx);
    renderAPIs();
};

window.editApiInfo = function() {
    if (currentDetailIndex === -1 || !apiList[currentDetailIndex]) return;
    const api = apiList[currentDetailIndex];
    const editBtn = document.getElementById('close-detail-btn');

    if (!isEditingDetail) {
        // 【进入编辑模式】
        isEditingDetail = true;
        editBtn.innerText = '✓'; 
        editBtn.title = '保存修改';

        document.getElementById('edit-name').value = api.name || "";
        document.getElementById('edit-url').value = getApiUrls(api).join('\n');
        document.getElementById('edit-key').value = api.key || "";
        document.getElementById('edit-share').value = api.share || "";
        
        const editWebEl = document.getElementById('edit-website');
        if (editWebEl) editWebEl.value = api.website || "";

        // 🌟 新增：动态渲染已有的分类供点击选择 🌟
        const editCatContainer = document.getElementById('edit-category-list');
        if (editCatContainer) {
            editCatContainer.innerHTML = '';
            categoryList.forEach(cat => {
                const span = document.createElement('span');
                span.className = 'multi-cat-tag';
                // 如果当前 API 已经有这个分类，就设置为选中状态
                if ((api.categories || []).includes(cat)) span.classList.add('active');
                span.innerText = cat;
                span.onclick = () => span.classList.toggle('active');
                editCatContainer.appendChild(span);
            });
        }

        // 隐藏纯文本，显示输入框
        document.querySelectorAll('.detail-display').forEach(el => el.classList.add('d-none'));
        document.querySelectorAll('.detail-input').forEach(el => el.classList.remove('d-none'));
        if(editCatContainer) editCatContainer.classList.remove('d-none');
        
    } else {
        // 【保存修改数据】
        const newName = document.getElementById('edit-name').value.trim();
        if (!newName) return alert("API 名称不能为空喔宝宝 来起个名字吧！");

        api.name = newName;
        const rawUrls = document.getElementById('edit-url').value.split('\n').map(u => u.trim()).filter(Boolean);
        api.urls = rawUrls;
        api.activeUrlIndex = 0;
        api.url = rawUrls[0] || "";
        api.key = document.getElementById('edit-key').value.trim();
        api.share = document.getElementById('edit-share').value.trim();
        
        const editWebEl = document.getElementById('edit-website');
        if (editWebEl) api.website = editWebEl.value.trim();

        // 🌟 新增：读取点击选中的分类标签 🌟
        const editCatContainer = document.getElementById('edit-category-list');
        if (editCatContainer) {
            const activeEls = editCatContainer.querySelectorAll('.active');
            api.categories = Array.from(activeEls).map(el => el.innerText);
        }

        saveAllData();
        
        // 退出编辑模式
        isEditingDetail = false;
        editBtn.innerText = '✎';
        editBtn.title = '修改信息';
        
        document.querySelectorAll('.detail-display').forEach(el => el.classList.remove('d-none'));
        document.querySelectorAll('.detail-input').forEach(el => el.classList.add('d-none'));
        if(editCatContainer) editCatContainer.classList.add('d-none');
        
        openDetail(currentDetailIndex); // 重新加载纯文本视觉，没有分类时底层 openDetail 原本的逻辑已经会自动设为 "无"
        renderCategories();
        renderAPIs();
    }
};

window.flipPage = function(targetPage) {
    document.getElementById('page-1').classList.toggle('d-none', targetPage === 2);
    document.getElementById('page-2').classList.toggle('d-none', targetPage === 1);
};

window.addModel = function() {
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

window.deleteModel = function(modelIndex) {
    if (confirm("确定删除吗？ ╭( ; ๐ ᎑ ๐)╮")) {
        apiList[currentDetailIndex].models.splice(modelIndex, 1);
        saveAllData();
        renderModels();
    }
};

window.copyText = function(e, text) {
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
    try { document.execCommand('copy'); if(callback) callback(); } catch (err) { alert("复制失败，要手动复制啦<(￣3￣)>"); }
    document.body.removeChild(ta);
}

window.deleteAPI = function(e, index) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (confirm("确定要擦除记录吗？ o((⊙﹏⊙))o")) {
        apiList.splice(index, 1);
        saveAllData();
        renderCategories();
        renderAPIs();
    }
};

// ==========================================
// ⚙️ 设置页 & 主题切换 & 云同步
// ==========================================
window.changeTheme = function(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('xc_theme', themeName);
};

window.openSettings = function() {
    const currentTheme = localStorage.getItem('xc_theme') || 'default';
    document.getElementById('theme-selector').value = currentTheme;
    
    document.getElementById('gh-token').value = localStorage.getItem('xc_gh_token') || '';
    document.getElementById('gh-username').value = localStorage.getItem('xc_gh_user') || '';
    document.getElementById('gh-repo').value = localStorage.getItem('xc_gh_repo') || 'xucenhe-backup';
    document.getElementById('gh-path').value = localStorage.getItem('xc_gh_path') || 'xucenhe_backup.json';
    
    document.getElementById('settings-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
};

window.closeSettings = function() {
    document.getElementById('settings-overlay').classList.add('hidden');
    document.body.style.overflow = '';
};

function saveGhConfig(token, user, repo, path) {
    localStorage.setItem('xc_gh_token', token);
    localStorage.setItem('xc_gh_user', user);
    localStorage.setItem('xc_gh_repo', repo);
    localStorage.setItem('xc_gh_path', path);
}

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
        const base64Content = btoa(unescape(encodeURIComponent(JSON.stringify(backupData, null, 2))));
        
        const body = { message: "Backup from 叙岑盒", content: base64Content };
        if (sha) body.sha = sha;

        const putRes = await fetch(url, { method: "PUT", headers: headers, body: JSON.stringify(body) });

        if (putRes.ok) {
            alert("成功备份到 GitHub 仓库！૮₍ ˶ᵔ ᵕ ᵔ˶ ₎ა");
        } else {
            const errData = await putRes.json();
            alert(`备份失败: ${errData.message}`);
        }
    } catch (err) {
        console.error(err);
        alert("网络错误，无法连接到 GitHub API");
    }
};

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
            if (confirm("读取成功！要覆盖本地数据吗？（原有数据将被替换）")) {
                localStorage.setItem('softboxCategoryStore', JSON.stringify(parsedData.categories));
                localStorage.setItem('softboxApiStore', JSON.stringify(parsedData.apis));
                alert("云端数据恢复成功啦！(˵>ㅿ<˵)♡");
                location.reload(); 
            }
        } else {
            alert("云端的数据格式不匹配诶宝宝^_ ̫ _ ̥`");
        }
    } catch (err) {
        console.error(err);
        alert("解析失败，请确认文件内容˃ ˄ ˂");
    }
};

window.testGithubConnection = async function() {
    const token = document.getElementById('gh-token').value.trim();
    const user = document.getElementById('gh-username').value.trim();
    const repo = document.getElementById('gh-repo').value.trim();
    const path = document.getElementById('gh-path').value.trim();

    if (!token || !user || !repo || !path) return alert("请先填写完整的 GitHub 配置信息喔！");

    const btn = document.getElementById('test-gh-btn');
    const originalText = btn.innerText;
    btn.innerText = "正在测试与读取...";

    // 巧用 GitHub Commits API，直接查这个备份文件最后一次被修改的时间
    const url = `https://api.github.com/repos/${user}/${repo}/commits?path=${path}&per_page=1`;
    const headers = { "Authorization": `token ${token}`, "Accept": "application/vnd.github.v3+json" };

    try {
        const res = await fetch(url, { headers });
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                // 解析云端最后提交的时间
                const commitDate = new Date(data[0].commit.committer.date).toLocaleString();
                document.getElementById('last-backup-time').innerText = `云端最新备份：${commitDate}`;
                alert(`连接成功啦！=ᗜωᗜ= \n并且读取到最近的备份时间为：\n${commitDate}`);
            } else {
                document.getElementById('last-backup-time').innerText = `云端暂无该文件的备份记录`;
                alert("连接成功！仓库可正常访问，但还没有备份记录噢՞⸝⸝'ᜊ'⸝⸝՞");
            }
        } else {
            const errData = await res.json();
            alert(`连接失败: ${errData.message}`);
        }
    } catch (err) {
        alert("网络错误，无法连接到 GitHub API ˃ ˄ ˂");
    } finally {
        btn.innerText = originalText;
    }
};

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
};

window.triggerImport = function() { document.getElementById('import-file').click(); };

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
                alert("恢复成功啦！(*･x･)/ﾟ･:*:･｡");
                location.reload(); 
            } else {
                alert("文件格式不对喔宝宝ㅠ⩊ㅠ");
            }
        } catch (err) {
            alert("读取失败了߹꒳߹");
        }
    };
    reader.readAsText(file);
    event.target.value = ''; 
};

// ==========================================
// 🚀 初始化与事件绑定
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadDataFromStorage();
    
    document.getElementById('add-btn').addEventListener('click', () => {
        document.querySelectorAll('#api-category-list .multi-cat-tag').forEach(el => el.classList.remove('active'));
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    });
    
    document.getElementById('cancel-btn').addEventListener('click', () => {
        document.getElementById('modal-overlay').classList.add('hidden');
        document.getElementById('api-form').reset();
        document.body.style.overflow = '';
    });

    const overlays = ['modal-overlay', 'detail-modal-overlay'];
    overlays.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                if (e.target === el) { el.classList.add('hidden'); document.body.style.overflow = ''; }
            });
        }
    });

    document.getElementById('api-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const activeEls = document.querySelectorAll('#api-category-list .active');
        // 👇 新增：按行解析多个 URL 👇
        const rawUrls = document.getElementById('api-url').value.split('\n').map(u => u.trim()).filter(Boolean);
        
        apiList.push({
            name: document.getElementById('api-name').value.trim(),
            url: rawUrls[0] || "", // 主线
            urls: rawUrls,         // 包含所有备用的数组
            activeUrlIndex: 0,
            key: document.getElementById('api-key').value.trim(),
            share: document.getElementById('api-share').value.trim(),
            website: document.getElementById('api-website') ? document.getElementById('api-website').value.trim() : "",
            categories: Array.from(activeEls).map(el => el.innerText),
            models: []
        });
        saveAllData();
        renderCategories();
        renderAPIs();
        document.getElementById('modal-overlay').classList.add('hidden');
        e.target.reset();
        document.body.style.overflow = '';
    });

    // 核心修改点：绑定大标题触发事件（右键/长按）
    const mainTitle = document.getElementById('main-title');
    if (mainTitle) {
        // 电脑端：右键打开
        mainTitle.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            openSettings();
        });

        // 手机端：长按打开
        let pressTimer;
        const startPress = () => { 
            pressTimer = setTimeout(() => { 
                openSettings(); 
                if(navigator.vibrate) navigator.vibrate(50); 
            }, 600); 
        };
        const cancelPress = () => clearTimeout(pressTimer);
        
        mainTitle.addEventListener('touchstart', startPress, { passive: true });
        mainTitle.addEventListener('touchend', cancelPress);
        mainTitle.addEventListener('touchcancel', cancelPress);
        mainTitle.addEventListener('touchmove', cancelPress);
    }
    
    renderCategories();
    renderAPIs();
});