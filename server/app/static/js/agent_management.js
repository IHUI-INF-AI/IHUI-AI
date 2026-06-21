// 全局变量
let currentPage = 1;
let currentCallbackPage = 1;
const pageSize = 10;

// 切换标签页
function switchTab(tabName) {
    // 隐藏所有标签内容
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 显示选中的标签
    document.getElementById(tabName + '-tab').classList.add('active');
    event.target.classList.add('active');
    
    // 加载对应数据
    if (tabName === 'list') {
        loadAgents();
    } else if (tabName === 'callbacks') {
        loadCallbacks();
    }
}

// 创建智能体
document.getElementById('createAgentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const tags = document.getElementById('tags').value
        .split(',').map(tag => tag.trim()).filter(tag => tag);
    
    const data = {
        agent_name: document.getElementById('agentName').value,
        agent_description: document.getElementById('agentDescription').value,
        agent_avatar: document.getElementById('agentAvatar').value,
        agent_version: document.getElementById('agentVersion').value,
        agent_prompt: document.getElementById('agentPrompt').value,
        agent_model: document.getElementById('agentModel').value,
        agent_temperature: document.getElementById('agentTemperature').value,
        agent_max_tokens: parseInt(document.getElementById('agentMaxTokens').value),
        category: document.getElementById('category').value,
        tags: tags,
        is_public: document.getElementById('isPublic').checked,
        access_level: document.getElementById('accessLevel').value,
        creator_name: document.getElementById('creatorName').value
    };
    
    try {
        const response = await fetch('/agents/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            alert('智能体创建成功！');
            document.getElementById('createAgentForm').reset();
            switchTab('list');
        } else {
            const error = await response.json();
            alert('创建失败: ' + error.detail);
        }
    } catch (error) {
        alert('创建失败: ' + error.message);
    }
});

// 加载智能体列表
async function loadAgents(page = 1) {
    try {
        currentPage = page;
        const status = document.getElementById('statusFilter').value;
        const category = document.getElementById('categoryFilter').value;
        
        let url = `/agents/list?page=${page}&page_size=${pageSize}`;
        if (status) url += `&status=${status}`;
        if (category) url += `&category=${category}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        displayAgents(data);
        displayPagination(data, 'agents');
    } catch (error) {
        console.error('加载智能体列表失败:', error);
    }
}

// 显示智能体列表
function displayAgents(data) {
    const agentsList = document.getElementById('agentsList');
    const items = Array.isArray(data) ? data : (data && Array.isArray(data.agents) ? data.agents : (data && Array.isArray(data.list) ? data.list : []));

    if (items.length === 0) {
        agentsList.innerHTML = '<div class="agent-item">暂无智能体数据（后端未提供 agents.list 端点或返回结构不匹配）</div>';
        return;
    }

    agentsList.innerHTML = items.map(agent => `
        <div class="agent-item">
            <div class="agent-header">
                <div class="agent-info">
                    ${agent.agent_avatar ? `<img src="${agent.agent_avatar}" alt="头像" class="agent-avatar">` : ''}
                    <div class="agent-details">
                        <h3>${agent.agent_name}</h3>
                        <p><strong>ID:</strong> ${agent.agent_id}</p>
                    </div>
                </div>
                <span class="agent-status status-${agent.publish_status}">${getStatusText(agent.publish_status)}</span>
            </div>
            <p><strong>描述:</strong> ${agent.agent_description || '无'}</p>
            <p><strong>分类:</strong> ${agent.category || '未分类'} | <strong>模型:</strong> ${agent.agent_model || '未知'}</p>
            <div class="tags">
                ${agent.tags.map(tag => `<span class="tag ${tag === 'coze' ? 'coze-tag' : ''}">${tag}</span>`).join('')}
            </div>
            <p><strong>创建者:</strong> ${agent.creator_name} | <strong>访问级别:</strong> ${agent.access_level}</p>
            <p><strong>使用次数:</strong> ${agent.usage_count} | <strong>点赞:</strong> ${agent.like_count}</p>
            <p><strong>创建时间:</strong> ${new Date(agent.created_at).toLocaleString()}</p>
            <div>
                <button class="btn btn-primary" onclick="viewAgent('${agent.agent_id}')">查看详情</button>
                <button class="btn btn-success" onclick="viewCallbackData('${agent.agent_id}')">查看回调数据</button>
                <button class="btn btn-danger" onclick="deleteAgent('${agent.agent_id}')">删除</button>
            </div>
        </div>
    `).join('');
}

// 加载回调记录
async function loadCallbacks(page = 1) {
    try {
        currentCallbackPage = page;
        const callbackType = document.getElementById('callbackTypeFilter').value;
        const processStatus = document.getElementById('processStatusFilter').value;
        
        let url = `/agents/callbacks?page=${page}&page_size=${pageSize}`;
        if (callbackType) url += `&callback_type=${callbackType}`;
        if (processStatus) url += `&process_status=${processStatus}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        displayCallbacks(data);
        displayPagination(data, 'callbacks');
    } catch (error) {
        console.error('加载回调记录失败:', error);
    }
}

// 显示回调记录
function displayCallbacks(data) {
    const callbacksList = document.getElementById('callbacksList');
    
    if (data.callbacks.length === 0) {
        callbacksList.innerHTML = '<div class="agent-item">暂无回调记录</div>';
        return;
    }
    
    callbacksList.innerHTML = data.callbacks.map(cb => `
        <div class="agent-item callback-item ${cb.process_status}">
            <div class="agent-header">
                <h4>回调记录 - ${getCallbackTypeText(cb.callback_type)}</h4>
                <span class="agent-status status-${cb.process_status}">${cb.process_status}</span>
            </div>
            <p><strong>回调ID:</strong> ${cb.callback_id}</p>
            <p><strong>智能体ID:</strong> ${cb.agent_id}</p>
            <p><strong>来源:</strong> ${cb.callback_source}</p>
            <p><strong>处理消息:</strong> ${cb.process_message || '无'}</p>
            <p><strong>重试次数:</strong> ${cb.retry_count}</p>
            <p><strong>处理时间:</strong> ${cb.process_time ? new Date(cb.process_time).toLocaleString() : '未处理'}</p>
            <p><strong>创建时间:</strong> ${new Date(cb.created_at).toLocaleString()}</p>
            <button class="btn btn-primary" onclick="viewCallbackDetails('${cb.callback_id}')">查看详情</button>
        </div>
    `).join('');
}

// 显示分页
function displayPagination(data, type) {
    const paginationId = type === 'agents' ? 'agentsPagination' : 'callbacksPagination';
    let paginationContainer = document.getElementById(paginationId);
    
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = paginationId;
        paginationContainer.className = 'pagination';
        
        const listContainer = type === 'agents' ? 
            document.getElementById('agentsList') : 
            document.getElementById('callbacksList');
        listContainer.parentNode.appendChild(paginationContainer);
    }
    
    const currentPageNum = type === 'agents' ? currentPage : currentCallbackPage;
    const loadFunction = type === 'agents' ? loadAgents : loadCallbacks;
    
    paginationContainer.innerHTML = `
        <button ${currentPageNum <= 1 ? 'disabled' : ''} onclick="${loadFunction.name}(${currentPageNum - 1})">上一页</button>
        <span class="current-page">第 ${currentPageNum} 页 / 共 ${data.total_pages} 页</span>
        <button ${currentPageNum >= data.total_pages ? 'disabled' : ''} onclick="${loadFunction.name}(${currentPageNum + 1})">下一页</button>
        <span>共 ${data.total} 条记录</span>
    `;
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        'draft': '草稿',
        'published': '已发布',
        'unpublished': '已下架',
        'rejected': '已拒绝',
        'deleted': '已删除'
    };
    return statusMap[status] || status;
}

// 获取回调类型文本
function getCallbackTypeText(type) {
    const typeMap = {
        'bot.published': '智能体发布',
        'bot.updated': '智能体更新',
        'bot.unpublished': '智能体下架'
    };
    return typeMap[type] || type;
}

// 查看智能体详情
async function viewAgent(agentId) {
    try {
        const response = await fetch(`/agents/${agentId}`);
        const agent = await response.json();
        
        const details = `智能体详情:

名称: ${agent.agent_name}
描述: ${agent.agent_description || '无'}
版本: ${agent.agent_version}
模型: ${agent.agent_model}
温度: ${agent.agent_temperature}
最大Token: ${agent.agent_max_tokens}
状态: ${getStatusText(agent.publish_status)}
分类: ${agent.category || '未分类'}
标签: ${agent.tags.join(', ')}
创建者: ${agent.creator_name}
创建时间: ${new Date(agent.created_at).toLocaleString()}
更新时间: ${new Date(agent.updated_at).toLocaleString()}`;

        alert(details);
    } catch (error) {
        alert('获取详情失败: ' + error.message);
    }
}

// 查看回调数据
async function viewCallbackData(agentId) {
    try {
        const response = await fetch(`/agents/${agentId}`);
        const agent = await response.json();
        
        if (agent.callback_data_1) {
            const callbackWindow = window.open('', '_blank', 'width=800,height=600');
            callbackWindow.document.write(`
                <html>
                <head><title>回调数据 - ${agent.agent_name}</title></head>
                <body>
                    <h2>智能体回调数据</h2>
                    <h3>完整回调数据:</h3>
                    <pre>${JSON.stringify(agent.callback_data_1, null, 2)}</pre>
                    <h3>处理信息:</h3>
                    <p>${agent.callback_data_3}</p>
                </body>
                </html>
            `);
        } else {
            alert('该智能体没有回调数据（可能是本地创建的）');
        }
    } catch (error) {
        alert('获取回调数据失败: ' + error.message);
    }
}

// 删除智能体
async function deleteAgent(agentId) {
    if (!confirm('确定要删除这个智能体吗？')) return;
    
    try {
        const response = await fetch(`/agents/${agentId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('智能体已删除');
            loadAgents(currentPage);
        } else {
            alert('删除失败');
        }
    } catch (error) {
        alert('删除失败: ' + error.message);
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    loadAgents();
});
