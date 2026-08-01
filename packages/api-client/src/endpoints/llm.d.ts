/** 模型能力位(Phase C+D:后端 /llm/models 返回的 caps 字段,可选,旧端点无此字段时缺失) */
export interface LlmModelCaps {
    supports_stream_usage?: boolean;
    supports_tools?: boolean;
    supports_vision?: boolean;
    supports_response_format?: boolean;
    supports_temperature?: boolean;
    default_timeout?: number;
    max_context?: number;
    protocol?: string;
}
export interface LlmModel {
    id: string;
    name: string;
    provider: string;
    context_length: number;
    input_price: number;
    /** 模型能力位(可选,后端 /llm/models 升级后返回) */
    caps?: LlmModelCaps;
}
export interface FetchModelsResult {
    models: LlmModel[];
    default: string;
    stub_mode: boolean;
}
/** 获取可用模型列表 — GET /llm/models (代理到 AI-service) */
export declare function fetchModels(): Promise<FetchModelsResult>;
export type ProviderStatus = 'ok' | 'invalid_key' | 'unreachable';
export type ProviderCategory = 'domestic' | 'international' | 'local' | 'credits';
export interface GatewayProvider {
    provider: string;
    status: ProviderStatus;
    latency_ms: number;
    model_count: number;
    last_check?: string;
    display_name?: string;
    category?: ProviderCategory;
    free_quota?: string;
    default_base_url?: string;
    default_models?: string[];
    is_in_cooldown?: boolean;
    consecutive_failures?: number;
}
export interface ProvidersHealthResult {
    providers: GatewayProvider[];
    summary: {
        total: number;
        ok: number;
        invalid_key: number;
        unreachable: number;
        configured?: number;
        local?: number;
        not_configured?: number;
    };
}
export type ComboStrategy = 'priority' | 'cheapest' | 'fusion';
export interface ComboChain {
    name: string;
    strategy: ComboStrategy;
    chain: string[];
    judge: string | null;
    description: string;
}
export interface ComboListResult {
    combos: ComboChain[];
}
export interface ComboCreateInput {
    name: string;
    strategy: ComboStrategy;
    chain: string[];
    judge?: string | null;
    description?: string;
}
export interface ComboCreateResult {
    ok: boolean;
    combo: ComboChain;
}
export interface ComboDeleteResult {
    ok: boolean;
    name: string;
}
export type CompactionStrategy = 'rtk' | 'caveman' | 'rtk_caveman';
export interface CompactionDemoInput {
    messages: Array<{
        role: string;
        content: string;
    }>;
    strategy?: CompactionStrategy;
    keep_recent?: number;
}
export interface CompactionDemoResult {
    original_tokens: number;
    compressed_tokens: number;
    compression_ratio: number;
    strategy: CompactionStrategy;
    rtk_map_size: number;
    compressed_messages: Array<{
        role: string;
        content: string;
    }>;
    decompressed_messages: Array<{
        role: string;
        content: string;
    }>;
}
/** 获取 Provider 健康状态 — GET /llm/providers/health */
export declare function fetchProvidersHealth(): Promise<ProvidersHealthResult>;
/** 获取 Combo 链列表 — GET /llm/combos */
export declare function fetchCombos(): Promise<ComboListResult>;
/** 新建 Combo 链 — POST /llm/combos */
export declare function createCombo(input: ComboCreateInput): Promise<ComboCreateResult>;
/** 删除 Combo 链 — DELETE /llm/combos/{name} */
export declare function deleteCombo(name: string): Promise<ComboDeleteResult>;
/** Token 压缩演示 — POST /llm/compaction/demo */
export declare function demoCompaction(input: CompactionDemoInput): Promise<CompactionDemoResult>;
/** Provider 健康状态(轻量版,新 schema,Phase C+D 模型选择器消费)
 *  与旧版 GatewayProvider(网关 Dashboard 用)字段不同,本类型聚焦三态徽章所需最小信息 */
export interface ProviderHealth {
    provider: string;
    status: 'ok' | 'invalid_key' | 'unreachable';
    latency_ms: number;
    model_count: number;
    last_check?: string;
}
/** 获取 Provider 健康状态(轻量版)— GET /llm/providers/health
 *  返回 ProviderHealth[](provider/status/latency_ms/model_count/last_check)
 *  与旧版 fetchProvidersHealth(返回 ProvidersHealthResult,网关 Dashboard 用)并存,互不影响。
 *  后端 /llm/providers/health 升级后返回 {code:0, data:{providers:[...]}},fetchApi 解析信封取 data.providers */
export declare function fetchProvidersHealthLite(): Promise<ProviderHealth[]>;
/** Provider 健康状态(与 ai-service ModelAvailabilityService.ProviderHealthStatus 对齐) */
export type ProviderAvailabilityStatus = 'healthy' | 'degraded' | 'down' | 'not_configured' | 'local' | 'zero_cost' | 'pending';
/** Provider 错误类型(细化 DOWN 原因,决定是否显示"去充值"按钮) */
export type ProviderErrorType = 'none' | 'payment_required' | 'forbidden' | 'rate_limited' | 'timeout' | 'network_error' | 'invalid_key' | 'unknown';
/** 单个 Provider 的可用性信息(后端 /llm/providers/availability 返回) */
export interface ProviderAvailabilityItem {
    provider_code: string;
    status: ProviderAvailabilityStatus;
    latency_ms: number;
    last_check: number;
    error: string;
    error_type: ProviderErrorType;
    /** 账户余额(若 provider 支持余额查询);null 表示未查询 */
    balance: number | null;
    /** 余额货币单位(如 "USD" / "CNY") */
    balance_currency: string | null;
    /** 充值/billing 页面 URL(管理端"去充值"按钮跳转用) */
    recharge_url: string;
}
/** /llm/providers/availability 响应(信封内 data 字段结构) */
export interface ProviderAvailabilityResult {
    providers: ProviderAvailabilityItem[];
    summary: {
        total: number;
        healthy: number;
        degraded: number;
        down: number;
        local: number;
        zero_cost: number;
    };
}
/** 获取 Provider 余额与健康状态 — GET /llm/providers/availability
 *  用于 Admin 端"Provider 余额健康"页面:展示每个 provider 的状态/余额/错误,并提供"去充值"按钮。
 *  账户没钱的 provider(error_type=payment_required 或 balance<=0)在 /llm/models 已被过滤,不显示给终端用户。 */
export declare function fetchProvidersAvailability(): Promise<ProviderAvailabilityResult>;
/** 单个 provider 的同步结果 */
export interface ModelSyncResult {
    provider_code: string;
    success: boolean;
    total_models: number;
    new_models: number;
    removed_models: number;
    error: string;
    latency_ms: number;
}
/** 模型同步状态 */
export interface ModelSyncStatus {
    last_sync_at: string;
    last_sync_duration_ms: number;
    total_providers: number;
    total_new_models: number;
    total_removed_models: number;
    is_syncing: boolean;
    results: ModelSyncResult[];
}
/** 触发模型自动同步 — POST /llm/models/sync
 *  返回同步状态(含每个 provider 的结果) */
export declare function triggerModelSync(): Promise<ModelSyncStatus>;
/** 查询模型同步状态 — GET /llm/models/sync/status */
export declare function fetchModelSyncStatus(): Promise<ModelSyncStatus>;
