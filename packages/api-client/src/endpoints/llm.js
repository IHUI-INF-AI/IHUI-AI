import { fetchApi } from '../client';
/** 获取可用模型列表 — GET /llm/models (代理到 AI-service) */
export async function fetchModels() {
    const res = await fetchApi('/llm/models', { method: 'GET' });
    if (!res.success) {
        throw new Error(res.error || '获取模型列表失败');
    }
    return res.data;
}
/** 获取 Provider 健康状态 — GET /llm/providers/health */
export async function fetchProvidersHealth() {
    const res = await fetchApi('/llm/providers/health', { method: 'GET' });
    if (!res.success) {
        throw new Error(res.error || '获取 Provider 健康状态失败');
    }
    return res.data;
}
/** 获取 Combo 链列表 — GET /llm/combos */
export async function fetchCombos() {
    const res = await fetchApi('/llm/combos', { method: 'GET' });
    if (!res.success) {
        throw new Error(res.error || '获取 Combo 链列表失败');
    }
    return res.data;
}
/** 新建 Combo 链 — POST /llm/combos */
export async function createCombo(input) {
    const res = await fetchApi('/llm/combos', {
        method: 'POST',
        body: JSON.stringify(input),
    });
    if (!res.success) {
        throw new Error(res.error || '创建 Combo 链失败');
    }
    return res.data;
}
/** 删除 Combo 链 — DELETE /llm/combos/{name} */
export async function deleteCombo(name) {
    const res = await fetchApi(`/llm/combos/${encodeURIComponent(name)}`, {
        method: 'DELETE',
    });
    if (!res.success) {
        throw new Error(res.error || '删除 Combo 链失败');
    }
    return res.data;
}
/** Token 压缩演示 — POST /llm/compaction/demo */
export async function demoCompaction(input) {
    const res = await fetchApi('/llm/compaction/demo', {
        method: 'POST',
        body: JSON.stringify(input),
    });
    if (!res.success) {
        throw new Error(res.error || 'Token 压缩演示失败');
    }
    return res.data;
}
/** 获取 Provider 健康状态(轻量版)— GET /llm/providers/health
 *  返回 ProviderHealth[](provider/status/latency_ms/model_count/last_check)
 *  与旧版 fetchProvidersHealth(返回 ProvidersHealthResult,网关 Dashboard 用)并存,互不影响。
 *  后端 /llm/providers/health 升级后返回 {code:0, data:{providers:[...]}},fetchApi 解析信封取 data.providers */
export async function fetchProvidersHealthLite() {
    const res = await fetchApi('/llm/providers/health', {
        method: 'GET',
    });
    if (!res.success) {
        throw new Error(res.error || '获取 Provider 健康状态失败');
    }
    return res.data?.providers ?? [];
}
/** 获取 Provider 余额与健康状态 — GET /llm/providers/availability
 *  用于 Admin 端"Provider 余额健康"页面:展示每个 provider 的状态/余额/错误,并提供"去充值"按钮。
 *  账户没钱的 provider(error_type=payment_required 或 balance<=0)在 /llm/models 已被过滤,不显示给终端用户。 */
export async function fetchProvidersAvailability() {
    const res = await fetchApi('/llm/providers/availability', {
        method: 'GET',
    });
    if (!res.success) {
        throw new Error(res.error || '获取 Provider 可用性失败');
    }
    return res.data;
}
/** 触发模型自动同步 — POST /llm/models/sync
 *  返回同步状态(含每个 provider 的结果) */
export async function triggerModelSync() {
    const res = await fetchApi('/llm/models/sync', { method: 'POST' });
    if (!res.success) {
        throw new Error(res.error || '触发模型同步失败');
    }
    return res.data;
}
/** 查询模型同步状态 — GET /llm/models/sync/status */
export async function fetchModelSyncStatus() {
    const res = await fetchApi('/llm/models/sync/status', { method: 'GET' });
    if (!res.success) {
        throw new Error(res.error || '获取模型同步状态失败');
    }
    return res.data;
}
//# sourceMappingURL=llm.js.map