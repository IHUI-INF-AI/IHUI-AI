// 创建应用
document.getElementById('createAppForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const redirectUris = document.getElementById('redirectUris').value
        .split('\n').filter(uri => uri.trim());
    
    const data = {
        app_name: document.getElementById('appName').value,
        app_description: document.getElementById('appDescription').value,
        redirect_uris: redirectUris,
        app_type: document.getElementById('appType').value
    };
    
    try {
        const response = await fetch('/cozeZhsApi/oauth/apps/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            alert('应用创建成功！');
            loadApps();
            document.getElementById('createAppForm').reset();
        } else {
            const error = await response.json();
            alert('创建失败: ' + error.detail);
        }
    } catch (error) {
        alert('创建失败: ' + error.message);
    }
});

// 加载应用列表
async function loadApps() {
    try {
        const response = await fetch('/cozeZhsApi/oauth/apps/list');
        const apps = await response.json();
        const list = Array.isArray(apps) ? apps : (apps && Array.isArray(apps.data) ? apps.data : (apps && Array.isArray(apps.list) ? apps.list : []));

        const appsList = document.getElementById('appsList');
        if (list.length === 0) {
            appsList.innerHTML = '<div class="app-item">暂无应用数据（后端未提供 /cozeZhsApi/oauth/apps/list 端点）</div>';
            return;
        }
        appsList.innerHTML = list.map(app => `
            <div class="app-item">
                <h3>${app.app_name}</h3>
                <div class="copy-section">
                    <p><strong>Client ID:</strong></p>
                    <p><span class="app-secret">${app.client_id}</span></p>
                    <button class="btn btn-primary" onclick="copyToClipboard('${app.client_id}', 'Client ID')">复制Client ID</button>
                </div>
                <div class="copy-section">
                    <p><strong>Client Secret:</strong></p>
                    <p><span class="app-secret client-secret">${app.client_secret}</span></p>
                    <button class="btn btn-primary" onclick="copyToClipboard('${app.client_secret}', 'Client Secret')">复制Client Secret</button>
                </div>
                <p><strong>描述:</strong> ${app.app_description || '无'}</p>
                <p><strong>类型:</strong> ${app.app_type}</p>
                <p><strong>回调地址:</strong> ${app.redirect_uris.join(', ')}</p>
                <p><strong>权限范围:</strong> ${app.scopes.join(', ')}</p>
                <p><strong>创建时间:</strong> ${new Date(app.created_at).toLocaleString()}</p>
                <button class="btn btn-danger" onclick="deleteApp('${app.client_id}')">删除应用</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('加载应用列表失败:', error);
    }
}

// 显示应用详情
async function showAppDetails(clientId) {
    try {
        const response = await fetch(`/cozeZhsApi/oauth/apps/${clientId}`);
        const app = await response.json();
        
        alert(`应用详情:\n\n` +
            `Client ID: ${app.client_id}\n` +
            `Client Secret: ${app.client_secret}\n` +
            `回调地址: ${app.redirect_uris.join(', ')}\n` +
            `权限范围: ${app.scopes.join(', ')}`);
    } catch (error) {
        alert('获取详情失败: ' + error.message);
    }
}

// 删除应用
async function deleteApp(clientId) {
    if (!confirm('确定要删除这个应用吗？')) return;
    
    try {
        const response = await fetch(`/cozeZhsApi/oauth/apps/${clientId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('应用已删除');
            loadApps();
        } else {
            alert('删除失败');
        }
    } catch (error) {
        alert('删除失败: ' + error.message);
    }
}

// 复制到剪贴板功能
async function copyToClipboard(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        alert(`${label} 已复制到剪贴板！`);
    } catch (err) {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert(`${label} 已复制到剪贴板！`);
    }
}

// 页面加载时获取应用列表
loadApps();