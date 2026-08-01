module.exports = [
"[project]/packages/api-client/src/circuit-breaker.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CircuitBreaker",
    ()=>CircuitBreaker,
    "CircuitOpenError",
    ()=>CircuitOpenError,
    "clientPreset",
    ()=>clientPreset,
    "serverPreset",
    ()=>serverPreset
]);
const DEFAULT_OPTIONS = {
    failureThreshold: 5,
    successThreshold: 3,
    minSamples: 10,
    windowSizeMs: 60_000,
    halfOpenTimeoutMs: 30_000
};
const MAX_WINDOW_ENTRIES = 10_000;
class CircuitOpenError extends Error {
    breakerName;
    state;
    constructor(breakerName, state){
        super(`CircuitBreaker[${breakerName}] is ${state}; request rejected`);
        this.name = 'CircuitOpenError';
        this.breakerName = breakerName;
        this.state = state;
    }
}
class CircuitBreaker {
    name;
    options;
    state = 'closed';
    window = [];
    failureCount = 0;
    openedAt = 0;
    halfOpenSuccesses = 0;
    halfOpenProbeInFlight = false;
    constructor(name, options){
        this.name = name;
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options
        };
    }
    async execute(fn) {
        this.maybeTransitionToHalfOpen();
        if (this.state === 'open') {
            throw new CircuitOpenError(this.name, this.state);
        }
        if (this.state === 'half-open') {
            if (this.halfOpenProbeInFlight) {
                throw new CircuitOpenError(this.name, this.state);
            }
            this.halfOpenProbeInFlight = true;
            try {
                const result = await fn();
                this.recordHalfOpenSuccess();
                return result;
            } catch (err) {
                this.recordHalfOpenFailure();
                throw err;
            } finally{
                this.halfOpenProbeInFlight = false;
            }
        }
        try {
            const result = await fn();
            this.recordClosed(true);
            return result;
        } catch (err) {
            this.recordClosed(false);
            throw err;
        }
    }
    getState() {
        this.maybeTransitionToHalfOpen();
        return this.state;
    }
    getStats() {
        this.evictExpired();
        const total = this.window.length;
        const failures = this.failureCount;
        const successes = total - failures;
        const failureRate = total === 0 ? 0 : failures / total;
        return {
            successes,
            failures,
            total,
            failureRate
        };
    }
    reset() {
        this.state = 'closed';
        this.window.length = 0;
        this.failureCount = 0;
        this.openedAt = 0;
        this.halfOpenSuccesses = 0;
        this.halfOpenProbeInFlight = false;
    }
    maybeTransitionToHalfOpen() {
        if (this.state !== 'open') return;
        const now = Date.now();
        if (now - this.openedAt >= this.options.halfOpenTimeoutMs) {
            this.state = 'half-open';
            this.halfOpenSuccesses = 0;
            this.halfOpenProbeInFlight = false;
        }
    }
    recordClosed(success) {
        const now = Date.now();
        this.pushWindow(now, !success);
        this.evictExpired(now);
        const total = this.window.length;
        if (total >= this.options.minSamples && this.failureCount >= this.options.failureThreshold) {
            this.trip();
        }
    }
    recordHalfOpenSuccess() {
        this.halfOpenSuccesses += 1;
        if (this.halfOpenSuccesses >= this.options.successThreshold) {
            this.state = 'closed';
            this.window.length = 0;
            this.failureCount = 0;
            this.openedAt = 0;
            this.halfOpenSuccesses = 0;
        }
    }
    recordHalfOpenFailure() {
        this.state = 'open';
        this.openedAt = Date.now();
        this.halfOpenSuccesses = 0;
    }
    trip() {
        this.state = 'open';
        this.openedAt = Date.now();
        this.halfOpenSuccesses = 0;
    }
    pushWindow(ts, isFailure) {
        if (this.window.length >= MAX_WINDOW_ENTRIES) {
            const evicted = this.window.shift();
            if (evicted?.isFailure) this.failureCount -= 1;
        }
        this.window.push({
            ts,
            isFailure
        });
        if (isFailure) this.failureCount += 1;
    }
    evictExpired(now = Date.now()) {
        const cutoff = now - this.options.windowSizeMs;
        while(this.window.length > 0 && this.window[0].ts < cutoff){
            const evicted = this.window.shift();
            if (evicted.isFailure) this.failureCount -= 1;
        }
    }
}
const serverPreset = {
    failureThreshold: 5,
    minSamples: 10,
    windowSizeMs: 60_000,
    halfOpenTimeoutMs: 30_000
};
const clientPreset = {
    failureThreshold: 3,
    minSamples: 5,
    windowSizeMs: 30_000,
    halfOpenTimeoutMs: 15_000
};
}),
"[project]/packages/api-client/src/transport.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 可插拔 HTTP 传输层 — 抽象 native fetch,支持非浏览器环境(微信小程序 Taro.request 等)。
 *
 * 设计:
 * - TransportResponse 接口兼容 fetch Response 的子集(ok / status / headers.get / text / json)
 * - 默认 transport 包装 native fetch(web/desktop/extension/mobile-rn 直接用)
 * - 小程序环境通过 setTransport 注入 Taro.request 适配器
 * - streamChat / SSE 端点仍用 native fetch(需要 ReadableStream,小程序保持本地实现)
 */ /** 传输响应 — 兼容 fetch Response 子集 */ __turbopack_context__.s([
    "getTransport",
    ()=>getTransport,
    "setTransport",
    ()=>setTransport
]);
/** 默认 transport:包装 native fetch(web/desktop/extension/mobile-rn) */ const defaultTransport = async (url, init)=>{
    // 2026-07-28 加固:web 端 8801 -> 8802 跨端口 fetch 必须 credentials: 'include',
    // 否则 auth_token cookie 不会发送,api 端 csrf 校验失败返回 403
    // (localStorage token 不走 csrf 流程,但 cookie token 是主路径)
    const response = await fetch(url, {
        ...init,
        credentials: init.credentials ?? 'include'
    });
    return {
        ok: response.ok,
        status: response.status,
        headers: response.headers,
        text: ()=>response.text(),
        json: ()=>response.json(),
        blob: ()=>response.blob()
    };
};
let transport = defaultTransport;
function setTransport(t) {
    transport = t;
}
function getTransport() {
    return transport;
}
}),
"[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "extractAgentId",
    ()=>extractAgentId,
    "fetchAiServiceJson",
    ()=>fetchAiServiceJson,
    "fetchApi",
    ()=>fetchApi,
    "fetchRaw",
    ()=>fetchRaw,
    "fetchText",
    ()=>fetchText,
    "formatSSEError",
    ()=>formatSSEError,
    "getCircuitBreaker",
    ()=>getCircuitBreaker,
    "getSSEErrorInfo",
    ()=>getSSEErrorInfo,
    "getToken",
    ()=>getToken,
    "mergeAbortSignals",
    ()=>mergeAbortSignals,
    "normalizeUrlPublic",
    ()=>normalizeUrlPublic,
    "parseFallbackEvent",
    ()=>parseFallbackEvent,
    "parseStreamLine",
    ()=>parseStreamLine,
    "parseStreamLineReasoning",
    ()=>parseStreamLineReasoning,
    "setBaseUrl",
    ()=>setBaseUrl,
    "setCircuitBreaker",
    ()=>setCircuitBreaker,
    "setStreamBaseUrl",
    ()=>setStreamBaseUrl,
    "setTokenProvider",
    ()=>setTokenProvider,
    "streamChat",
    ()=>streamChat
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$circuit$2d$breaker$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/circuit-breaker.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$transport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/transport.ts [app-ssr] (ecmascript)");
;
;
let tokenProvider = {
    getToken: ()=>null
};
let baseUrl = '';
// SSE 流式请求专用 baseUrl(2026-07-27 立):
// Next.js dev proxy 对 SSE 流有超时/缓冲问题,导致流式响应被中断(net::ERR_ABORTED)。
// streamChat 用 streamBaseUrl 直连 API 服务器,绕过 Next.js dev proxy。
// 未设置时降级到 baseUrl,保持向后兼容。
let streamBaseUrl = '';
let circuitBreaker = null;
function setTokenProvider(provider) {
    tokenProvider = provider;
}
function setBaseUrl(url) {
    baseUrl = url.replace(/\/$/, '');
}
function setStreamBaseUrl(url) {
    streamBaseUrl = url.replace(/\/$/, '');
}
function setCircuitBreaker(cb) {
    circuitBreaker = cb;
}
function getCircuitBreaker() {
    return circuitBreaker;
}
function getToken() {
    return tokenProvider.getToken();
}
function normalizeUrlPublic(url) {
    return normalizeUrl(url);
}
function mergeAbortSignals(signals) {
    const controller = new AbortController();
    const onAbort = ()=>controller.abort();
    for (const sig of signals){
        if (!sig) continue;
        if (sig.aborted) {
            controller.abort();
            break;
        }
        sig.addEventListener('abort', onAbort, {
            once: true
        });
    }
    return controller.signal;
}
function normalizeUrl(url, useStreamBase = false) {
    if (/^https?:\/\//i.test(url)) return url;
    const normalized = (()=>{
        if (url.startsWith('/api/') || url.startsWith('/uploads/') || url.startsWith('/ws/')) return url;
        if (url.startsWith('/cozeZhsApi')) {
            return url.replace(/^\/cozeZhsApi/, '/api');
        }
        if (url.startsWith('/')) return `/api${url}`;
        return `/api/${url}`;
    })();
    const base = useStreamBase && streamBaseUrl ? streamBaseUrl : baseUrl;
    return base ? `${base}${normalized}` : normalized;
}
/**
 * 内部:执行一次 fetch 并解析为 ApiResult。
 *
 * 失败语义(供 CircuitBreaker 计样本):
 *   - 5xx 响应:抛 HttpError(带 status / errorCode / retryAfter),由外层转 ApiResult
 *   - 网络异常:抛原始 Error
 *   - 4xx 响应:返回 ApiResult(success=false),不抛错(业务错误不算服务不可用)
 *   - 2xx 但 code !== 0:返回 ApiResult(success=false),不抛错
 *   - 2xx 且 code === 0:返回 ApiResult(success=true)
 *
 * AbortError:抛回给外层统一处理(无论是否有 breaker)。
 */ async function fetchOnce(normalizedUrl, options, headers) {
    const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$transport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getTransport"])()(normalizedUrl, {
        method: options.method,
        headers,
        body: typeof options.body === 'string' ? options.body : undefined,
        signal: options.signal ?? undefined
    });
    if (!response.ok) {
        const text = await response.text().catch(()=>'');
        let errorCode;
        let message = text || `请求失败（${response.status}）`;
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed.message === 'string') message = parsed.message;
            if (parsed && typeof parsed.errorCode === 'string') errorCode = parsed.errorCode;
        } catch  {
        // 非 JSON 响应,保留 text 作为 message
        }
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined;
        const retryAfterValue = retryAfter && Number.isFinite(retryAfter) ? retryAfter : undefined;
        // 5xx 视为服务不可用:有 breaker 时抛错让熔断器计失败样本;无 breaker 时也抛,由外层统一处理
        if (response.status >= 500) {
            const err = new Error(message);
            err.status = response.status;
            if (errorCode) err.errorCode = errorCode;
            if (retryAfterValue !== undefined) err.retryAfter = retryAfterValue;
            throw err;
        }
        // 4xx:业务错误,返回 ApiResult,不计 breaker 失败样本
        return {
            success: false,
            error: message,
            status: response.status,
            errorCode,
            retryAfter: retryAfterValue
        };
    }
    const json = await response.json();
    if (json.code !== 0) {
        return {
            success: false,
            error: json.message || '请求失败',
            status: response.status,
            errorCode: json.errorCode
        };
    }
    return {
        success: true,
        data: json.data
    };
}
/** 把内部抛出的错误归一化为 ApiFailure(CircuitOpenError 由调用方处理) */ function normalizeErrorToResult(err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
        return {
            success: false,
            error: '请求已取消'
        };
    }
    const errAny = err;
    if (typeof errAny.status === 'number') {
        return {
            success: false,
            error: errAny.message,
            status: errAny.status,
            errorCode: errAny.errorCode,
            retryAfter: errAny.retryAfter
        };
    }
    return {
        success: false,
        error: err instanceof Error ? err.message : '网络异常'
    };
}
async function fetchApi(url, options = {}) {
    const token = tokenProvider.getToken();
    const { params, ...restOptions } = options;
    let normalizedUrl = normalizeUrl(url);
    if (params) {
        const qs = new URLSearchParams();
        for (const [key, value] of Object.entries(params)){
            if (value !== undefined && value !== null && value !== '') {
                qs.append(key, String(value));
            }
        }
        const qsString = qs.toString();
        if (qsString) {
            normalizedUrl += (normalizedUrl.includes('?') ? '&' : '?') + qsString;
        }
    }
    const isFormData = typeof FormData !== 'undefined' && restOptions.body instanceof FormData;
    // 2026-07-30 修复:无 body 的请求(DELETE/GET 等)不再强制带 Content-Type: application/json。
    // 原因:Fastify 5 对带 Content-Type 但空 body 的 DELETE 返回 400(空 body 解析失败),
    // 导致删除对话等无 body 写操作全部失败。Content-Type 应描述 body 媒体类型,无 body 不应带。
    const hasBody = restOptions.body !== undefined && restOptions.body !== null;
    const headers = {
        ...hasBody && !isFormData ? {
            'Content-Type': 'application/json'
        } : {},
        ...restOptions.headers
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    // 2026-07-22 P0 Round 4 鲁棒性加固:默认 30s 超时,防止请求无限挂起
    // 调用方传入的 signal 与超时 signal 合并(AbortSignal.any),任一触发都中止
    // streamChat SSE 流场景不经过 fetchApi(走独立 streamText),不受此超时影响
    const DEFAULT_TIMEOUT_MS = 30_000;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(()=>timeoutController.abort(), DEFAULT_TIMEOUT_MS);
    const userSignal = restOptions.signal;
    const mergedSignal = userSignal ? mergeAbortSignals([
        userSignal,
        timeoutController.signal
    ]) : timeoutController.signal;
    const optionsWithTimeout = {
        ...restOptions,
        signal: mergedSignal
    };
    try {
        // 无 breaker:保留原始重试策略(maxRetries=1)
        if (!circuitBreaker) {
            const maxRetries = 1;
            let lastError = '网络异常';
            for(let attempt = 0; attempt <= maxRetries; attempt++){
                try {
                    return await fetchOnce(normalizedUrl, optionsWithTimeout, headers);
                } catch (err) {
                    // AbortError:用户主动取消或超时,直接返回,不重试
                    if (err instanceof DOMException && err.name === 'AbortError') {
                        // 区分用户取消 vs 超时:timeoutController 已 abort 说明是超时
                        return {
                            success: false,
                            error: timeoutController.signal.aborted ? '请求超时(30s)' : '请求已取消'
                        };
                    }
                    const result = normalizeErrorToResult(err);
                    // 5xx / 4xx(已带 status):直接返回,不重试
                    if (result.status !== undefined) {
                        return result;
                    }
                    // 网络异常:重试或返回 lastError
                    lastError = result.error;
                    if (attempt < maxRetries) continue;
                }
            }
            return {
                success: false,
                error: lastError
            };
        }
        // 有 breaker:每次 fetchApi 计 1 个 breaker 样本(不内部重试,避免重复计样本)
        try {
            return await circuitBreaker.execute(async ()=>{
                return await fetchOnce(normalizedUrl, optionsWithTimeout, headers);
            });
        } catch (err) {
            if (err instanceof __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$circuit$2d$breaker$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CircuitOpenError"]) throw err;
            if (err instanceof DOMException && err.name === 'AbortError') {
                return {
                    success: false,
                    error: timeoutController.signal.aborted ? '请求超时(30s)' : '请求已取消'
                };
            }
            return normalizeErrorToResult(err);
        }
    } finally{
        clearTimeout(timeoutId);
    }
}
async function fetchText(url, options = {}) {
    const token = tokenProvider.getToken();
    const normalizedUrl = normalizeUrl(url);
    const headers = {
        ...options.headers
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$transport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getTransport"])()(normalizedUrl, {
        method: options.method,
        headers,
        body: typeof options.body === 'string' ? options.body : undefined,
        signal: options.signal ?? undefined
    });
    if (!response.ok) {
        const text = await response.text().catch(()=>'');
        throw new Error(`${response.status}: ${text}`);
    }
    return response.text();
}
async function fetchAiServiceJson(url, options = {}) {
    const token = tokenProvider.getToken();
    const { params, ...restOptions } = options;
    let normalizedUrl = normalizeUrl(url);
    if (params) {
        const qs = new URLSearchParams();
        for (const [key, value] of Object.entries(params)){
            if (value !== undefined && value !== null && value !== '') {
                qs.append(key, String(value));
            }
        }
        const qsString = qs.toString();
        if (qsString) {
            normalizedUrl += (normalizedUrl.includes('?') ? '&' : '?') + qsString;
        }
    }
    const isFormData = typeof FormData !== 'undefined' && restOptions.body instanceof FormData;
    const hasBody = restOptions.body !== undefined && restOptions.body !== null;
    const headers = {
        ...hasBody && !isFormData ? {
            'Content-Type': 'application/json'
        } : {},
        ...restOptions.headers
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const DEFAULT_TIMEOUT_MS = 30_000;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(()=>timeoutController.abort(), DEFAULT_TIMEOUT_MS);
    const userSignal = restOptions.signal;
    const mergedSignal = userSignal ? mergeAbortSignals([
        userSignal,
        timeoutController.signal
    ]) : timeoutController.signal;
    try {
        const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$transport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getTransport"])()(normalizedUrl, {
            method: restOptions.method,
            headers,
            body: typeof restOptions.body === 'string' ? restOptions.body : undefined,
            signal: mergedSignal
        });
        if (!response.ok) {
            const text = await response.text().catch(()=>'');
            let message = text || `请求失败(${response.status})`;
            let errorCode;
            try {
                const parsed = JSON.parse(text);
                if (parsed && typeof parsed.message === 'string') message = parsed.message;
                if (parsed && typeof parsed.detail === 'string') message = parsed.detail;
                if (parsed && typeof parsed.errorCode === 'string') errorCode = parsed.errorCode;
            } catch  {
            // 非 JSON 响应,保留 text 作为 message
            }
            return {
                success: false,
                error: message,
                status: response.status,
                errorCode
            };
        }
        // ai-service 直接返回 JSON,无 {code, data} 包装,整体作为 data
        const json = await response.json();
        return {
            success: true,
            data: json
        };
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            return {
                success: false,
                error: timeoutController.signal.aborted ? '请求超时(30s)' : '请求已取消'
            };
        }
        return normalizeErrorToResult(err);
    } finally{
        clearTimeout(timeoutId);
    }
}
async function fetchRaw(url, options = {}) {
    const token = tokenProvider.getToken();
    const normalizedUrl = normalizeUrl(url);
    const headers = {
        ...options.headers
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$transport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getTransport"])()(normalizedUrl, {
        method: options.method,
        headers,
        body: typeof options.body === 'string' ? options.body : undefined,
        signal: options.signal ?? undefined
    });
    if (!response.ok) {
        const text = await response.text().catch(()=>'');
        throw new Error(`${response.status}: ${text}`);
    }
    if (!response.blob) {
        throw new Error('当前 transport 不支持 blob 下载(小程序环境请用 native downloadFile)');
    }
    return response.blob();
}
function parseStreamLine(line) {
    if (!line || line.startsWith(':')) return null;
    let data = line;
    if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '');
    } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return null;
    }
    if (data === '[DONE]') return null;
    // Vercel AI SDK data-stream protocol: `TYPE:JSON`（type 0 = 文本 token，其他类型目前忽略）
    const proto = data.match(/^(\d+):(.*)$/s);
    if (proto?.[1] !== undefined) {
        if (proto[1] === '0') {
            try {
                const parsed = JSON.parse(proto[2]);
                if (typeof parsed === 'string') return parsed;
            } catch  {
            /* fallthrough */ }
        }
        return null;
    }
    try {
        const json = JSON.parse(data);
        if (json?.type === 'error' && typeof json?.message === 'string') {
            throw attachErrorMeta(new Error(json.message), json);
        }
        if (json?.error === true && typeof json?.error_message === 'string') {
            throw attachErrorMeta(new Error(json.error_message), json);
        }
        if (json?.error && typeof json?.error === 'string') {
            // OpenAI 错误格式:{ "error": { "message": "...", "code": "..." } } / { "error": "rate limit", "code": 429 }
            const e = new Error(typeof json.error === 'string' ? json.error : json.error.message ?? 'AI 服务异常');
            throw attachErrorMeta(e, json);
        }
        // P3-4: 识别 {code:"RATE_LIMIT", retryAfter:N, message:"..."} 格式(无 type/error 字段)
        // 该格式由后端限流中间件发出,无 type/error 字段时上方 3 个分支均不命中,retryAfter 会被丢弃
        if (typeof json?.code === 'string' && typeof json?.message === 'string') {
            const e = new Error(json.message);
            throw attachErrorMeta(e, json);
        }
        if (json?.type === 'reasoning') return null;
        const choice = json?.choices?.[0];
        const delta = choice?.delta?.content ?? choice?.message?.content ?? json?.content ?? json?.delta ?? json?.text;
        return typeof delta === 'string' ? delta : null;
    } catch (e) {
        if (e instanceof SyntaxError) return data;
        throw e;
    }
}
function attachErrorMeta(err, json) {
    err.name = 'SSEError';
    const code = typeof json.code === 'number' ? json.code : typeof json.statusCode === 'number' ? json.statusCode : typeof json.status === 'number' ? json.status : undefined;
    if (code !== undefined) err.code = code;
    if (typeof json.errorCode === 'string') {
        ;
        err.errorCode = json.errorCode;
    }
    if (typeof json.retryAfter === 'number') {
        ;
        err.retryAfter = json.retryAfter;
    }
    return err;
}
function extractAgentId(line) {
    if (!line || line.startsWith(':')) return undefined;
    let data = line;
    if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '');
    } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return undefined;
    }
    if (!data || data === '[DONE]') return undefined;
    // Vercel AI SDK 协议 `0:"..."` → 无 agentId
    if (/^\d+:/.test(data)) return undefined;
    if (!data.startsWith('{')) return undefined;
    try {
        const json = JSON.parse(data);
        if (typeof json?.agentId === 'string') return json.agentId;
    } catch  {
    /* 非 JSON */ }
    return undefined;
}
function parseFallbackEvent(line) {
    if (!line || line.startsWith(':')) return null;
    let data = line;
    if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '');
    } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return null;
    }
    if (!data || data === '[DONE]') return null;
    // Vercel AI SDK 协议 `0:"..."` → 非 fallback 事件
    if (/^\d+:/.test(data)) return null;
    if (!data.startsWith('{')) return null;
    try {
        const json = JSON.parse(data);
        if (json?.type === 'fallback' && typeof json?.primary_model === 'string') {
            return {
                primaryModel: json.primary_model,
                backupModel: typeof json.backup_model === 'string' ? json.backup_model : 'unknown',
                reason: typeof json.reason === 'string' ? json.reason : 'unknown'
            };
        }
    } catch  {
    /* 非 JSON 或格式不符,返回 null */ }
    return null;
}
function parseStreamLineReasoning(line) {
    if (!line || line.startsWith(':')) return null;
    let data = line;
    if (line.startsWith('data:')) {
        data = line.slice(5).replace(/^\s/, '');
    } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
        return null;
    }
    if (data === '[DONE]') return null;
    try {
        const json = JSON.parse(data);
        if (json?.type === 'error' && typeof json?.message === 'string') {
            const e = new Error(json.message);
            e.name = 'SSEError';
            throw e;
        }
        if (json?.error === true && typeof json?.error_message === 'string') {
            const e = new Error(json.error_message);
            e.name = 'SSEError';
            throw e;
        }
        if (json?.type === 'reasoning' && typeof json?.content === 'string') return json.content;
        const choice = json?.choices?.[0];
        const reasoning = choice?.delta?.reasoning_content ?? choice?.message?.reasoning_content ?? json?.reasoning;
        return typeof reasoning === 'string' ? reasoning : null;
    } catch (e) {
        if (e instanceof SyntaxError) return null;
        throw e;
    }
}
function asString(v) {
    if (typeof v === 'string' && v.length > 0) return v;
    return undefined;
}
function asNumber(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return undefined;
}
function getSSEErrorInfo(err) {
    if (!err) return undefined;
    const out = {};
    const sources = [];
    if (err instanceof Error) {
        sources.push(err);
        if (err.message) sources.push(err.message);
        const anyErr = err;
        if (anyErr.code !== undefined) sources.push({
            code: anyErr.code
        });
        if (anyErr.statusCode !== undefined) sources.push({
            statusCode: anyErr.statusCode
        });
        if (anyErr.errorCode !== undefined) sources.push({
            errorCode: anyErr.errorCode
        });
        if (anyErr.retryAfter !== undefined) sources.push({
            retryAfter: anyErr.retryAfter
        });
    } else if (typeof err === 'string') {
        sources.push(err);
    } else {
        sources.push(err);
    }
    for (const src of sources){
        if (typeof src === 'string') {
            const m = src.match(/[（(](\d{3})[)）]/);
            if (m && out.code === undefined) {
                const n = Number(m[1]);
                if (Number.isFinite(n)) out.code = n;
            }
            const codeMatch = src.match(/code=([0-9]{3})/);
            if (codeMatch && out.code === undefined) {
                const n = Number(codeMatch[1]);
                if (Number.isFinite(n)) out.code = n;
            }
            const errCodeMatch = src.match(/errorCode=([A-Z0-9_]+)/);
            if (errCodeMatch && out.errorCode === undefined) {
                out.errorCode = errCodeMatch[1];
            }
            continue;
        }
        if (typeof src !== 'object' || src === null) continue;
        const obj = src;
        if (out.code === undefined) {
            const c = asNumber(obj.code) ?? asNumber(obj.statusCode) ?? asNumber(obj.status);
            if (c !== undefined) out.code = c;
        }
        if (out.errorCode === undefined) {
            const ec = asString(obj.errorCode) ?? asString(obj.error_code);
            if (ec) out.errorCode = ec;
        }
        if (out.retryAfter === undefined) {
            const r = asNumber(obj.retryAfter) ?? asNumber(obj.retry_after);
            if (r !== undefined) out.retryAfter = r;
        }
    }
    if (out.code === undefined && out.errorCode === undefined && out.retryAfter === undefined) {
        return undefined;
    }
    return out;
}
function formatSSEError(err, fallbackMessageOrInfo = 'AI 服务异常') {
    // P3-4: 第二参数兼容两种形态 — 字符串(fallbackMessage,旧调用方)或 SSEErrorInfo(onError 透传 info)
    // onError 回调只拿到 errMsg 字符串 + info 对象,字符串本身不带 retryAfter,需通过 info 注入
    let fallbackMessage = 'AI 服务异常';
    let extraInfo;
    if (typeof fallbackMessageOrInfo === 'string') {
        fallbackMessage = fallbackMessageOrInfo;
    } else {
        extraInfo = fallbackMessageOrInfo;
    }
    let rawMessage;
    if (err instanceof Error) {
        rawMessage = err.message || fallbackMessage;
    } else if (typeof err === 'string' && err.length > 0) {
        rawMessage = err;
    } else if (err && typeof err === 'object' && 'message' in err) {
        const m = err.message;
        rawMessage = typeof m === 'string' && m.length > 0 ? m : fallbackMessage;
    } else {
        rawMessage = fallbackMessage;
    }
    // P3-4: extraInfo(onError 路径透传)优先于 getSSEErrorInfo(err)(catch 路径从 Error 对象提取)
    // onError 路径 err 是纯字符串,不含 retryAfter,必须靠 extraInfo 补全
    const extractedInfo = getSSEErrorInfo(err);
    const code = extraInfo?.code ?? extractedInfo?.code;
    const errorCode = extraInfo?.errorCode ?? extractedInfo?.errorCode;
    const retryAfter = extraInfo?.retryAfter ?? extractedInfo?.retryAfter;
    // 优先识别 LLM 厂商内容安全策略拦截关键词
    // 这些错误来自上游 LLM(Gemini/OpenAI/Anthropic),不是项目本身的违规判定
    // 识别后给出清晰提示,避免用户误以为是项目违规判定导致对话被自动结束
    const safetyHit = detectSafetyViolation(rawMessage, errorCode);
    if (safetyHit) {
        return {
            code,
            errorCode,
            retryAfter,
            severity: 'safety',
            title: '内容被 AI 厂商安全策略拦截',
            message: safetyHit,
            rawMessage,
            requireReauth: false
        };
    }
    if (code === 401) {
        return {
            code,
            errorCode,
            retryAfter,
            severity: 'auth',
            title: '登录已过期',
            message: '登录已过期,请重新登录',
            rawMessage,
            requireReauth: true
        };
    }
    if (code === 403) {
        return {
            code,
            errorCode,
            retryAfter,
            severity: 'forbidden',
            title: '访问被拒绝',
            message: '当前账户没有使用该 AI 模型的权限',
            rawMessage,
            requireReauth: false
        };
    }
    if (code === 429) {
        const waitHint = retryAfter ? `${retryAfter} 秒后重试` : '请稍候再试';
        return {
            code,
            errorCode,
            retryAfter,
            severity: 'ratelimit',
            title: '请求过于频繁',
            message: `AI 服务请求频率超限,${waitHint}`,
            rawMessage,
            requireReauth: false
        };
    }
    if (code !== undefined && code >= 500) {
        return {
            code,
            errorCode,
            retryAfter,
            severity: 'server',
            title: 'AI 服务异常',
            message: 'AI 服务暂时不可用,请稍后重试',
            rawMessage,
            requireReauth: false
        };
    }
    if (code !== undefined && code >= 400) {
        return {
            code,
            errorCode,
            retryAfter,
            severity: 'server',
            title: '请求失败',
            message: rawMessage,
            rawMessage,
            requireReauth: false
        };
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
        return {
            code,
            errorCode,
            retryAfter,
            severity: 'network',
            title: '请求已取消',
            message: '请求已取消',
            rawMessage,
            requireReauth: false
        };
    }
    // P3-4: 非 4xx/5xx 但带 retryAfter(如 SSE error {code:"RATE_LIMIT", retryAfter:N} 或
    // {type:"error", message:"...", retryAfter:N} 无 code 字段)→ 视为限流,追加倒计时到 message,
    // severity = ratelimit(触发 warning toast,非致命,与 429 一致不加 retry 按钮)
    // 429 已在上方分支处理(含 "N 秒后重试"),此处不重复,仅覆盖 code 缺失的限流场景
    if (retryAfter !== undefined && retryAfter >= 1) {
        return {
            code,
            errorCode,
            retryAfter,
            severity: 'ratelimit',
            title: '请求过于频繁',
            message: `${rawMessage}(${retryAfter} 秒后重试)`,
            rawMessage,
            requireReauth: false
        };
    }
    const isNetwork = /network|fetch|timeout|abort|failed to fetch|err_network/i.test(rawMessage);
    return {
        code,
        errorCode,
        retryAfter,
        severity: isNetwork ? 'network' : 'unknown',
        title: isNetwork ? '网络异常' : 'AI 服务异常',
        message: isNetwork ? '网络连接失败,请检查网络后重试' : rawMessage,
        rawMessage,
        requireReauth: false
    };
}
/**
 * 识别 LLM 厂商内容安全策略拦截关键词。
 *
 * 主流 LLM 厂商在内容被判定违规时会返回特定错误码/消息:
 * - OpenAI:    `content_policy_violation` / `content_policy` / 400 + "Your request was rejected as a result of our safety system"
 * - Anthropic: `output_length_stop` + "content filter" / 400 + "content that is unsafe"
 * - Gemini:    `SAFETY` / `RECITATION` / `BLOCKLIST` finishReason
 * - 通用:      "safety" / "policy" / "filtered" / "blocked" / "审查" / "违规"
 *
 * 命中返回清晰提示文案,未命中返回 null。
 * 该识别只针对上游 LLM 厂商的安全策略拦截,不是项目本身的违规判定。
 */ function detectSafetyViolation(message, errorCode) {
    const text = message.toLowerCase();
    const ec = (errorCode ?? '').toLowerCase();
    // Gemini finishReason
    if (/finishreason\s*=\s*safety/i.test(message)) {
        return '内容被 Gemini 安全策略拦截(SAFETY),请调整提问方式后重试';
    }
    if (/finishreason\s*=\s*recitation/i.test(message)) {
        return '内容被 Gemini 引用安全策略拦截(RECITATION),请减少大段引用后重试';
    }
    // OpenAI content_policy_violation
    if (ec === 'content_policy_violation' || text.includes('content_policy_violation')) {
        return '内容被 OpenAI 内容策略拦截,请调整提问方式后重试';
    }
    // Anthropic safety
    if (ec === 'safety_block' || text.includes('"type":"error"') && text.includes('"safety"')) {
        return '内容被 Anthropic 安全策略拦截,请调整提问方式后重试';
    }
    // 通用关键词兜底(需组合出现,避免误判普通错误)
    const safetyKeywords = [
        'safety',
        'content policy',
        'content filter',
        'safety system',
        'safety filter'
    ];
    const blockedKeywords = [
        'blocked',
        'rejected',
        'filtered'
    ];
    for (const sk of safetyKeywords){
        if (text.includes(sk)) {
            for (const bk of blockedKeywords){
                if (text.includes(bk)) {
                    return '内容被 AI 厂商安全策略拦截,请调整提问方式后重试';
                }
            }
        }
    }
    return null;
}
const STREAM_MAX_RETRIES = 3;
const STREAM_INITIAL_RETRY_DELAY = 1000;
const STREAM_MAX_RETRY_DELAY = 30_000;
/** 指数退避等待,支持 AbortSignal 中断(用户主动取消重连) */ function sleepWithAbort(ms, signal) {
    return new Promise((resolve, reject)=>{
        if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        const onAbort = ()=>{
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        const timer = setTimeout(()=>{
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal?.addEventListener('abort', onAbort, {
            once: true
        });
    });
}
async function streamChat(opts) {
    const maxRetries = opts.maxRetries ?? STREAM_MAX_RETRIES;
    // 跨重连尝试共享的状态:Last-Event-ID(断点续传)+ 已接收内容(dedupe)
    const lastEventIdRef = {
        current: ''
    };
    const receivedContentRef = {
        current: ''
    };
    const receivedAgentRef = {
        current: new Map()
    };
    let attempt = 0;
    const token = tokenProvider.getToken();
    // 2026-07-27 修复 SSE 流被 Next.js dev proxy 中断:
    // streamChat 用 streamBaseUrl(直连 API 服务器),绕过 Next.js dev proxy 的超时/缓冲。
    // 普通请求仍用 baseUrl(走同源代理,cookie SSR 正常)。
    const url = normalizeUrl(opts.path ?? '/ai/chat/stream', true);
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const body = {
        model: opts.model,
        messages: opts.messages
    };
    if (opts.metadata) body.metadata = opts.metadata;
    if (opts.temperature !== undefined) body.temperature = opts.temperature;
    if (opts.topP !== undefined) body.topP = opts.topP;
    if (opts.topK !== undefined) body.topK = opts.topK;
    if (opts.maxTokens !== undefined) body.maxTokens = opts.maxTokens;
    if (opts.stop !== undefined) body.stop = opts.stop;
    if (opts.workspacePath) body.workspacePath = opts.workspacePath;
    if (opts.contextLimit !== undefined) body.contextLimit = opts.contextLimit;
    if (opts.agentId) body.agentId = opts.agentId;
    if (opts.agentTools && opts.agentTools.length > 0) body.agentTools = opts.agentTools;
    if (opts.extraBody) Object.assign(body, opts.extraBody);
    while(true){
        const isRetry = attempt > 0;
        try {
            // 断点续传:每次尝试携带 Last-Event-ID(SSE 标准 resume 头),服务端支持则跳过已发送事件
            if (lastEventIdRef.current) headers['Last-Event-ID'] = lastEventIdRef.current;
            const resp = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: opts.signal,
                // 2026-07-27 跨域 SSE 直连:携带 credentials 让 CORS 允许凭证,
                // Bearer token 在 Authorization header 中不受影响。
                credentials: 'include'
            });
            if (!resp.ok || !resp.body) {
                const text = await resp.text().catch(()=>'');
                let parsedBody;
                try {
                    if (text) parsedBody = JSON.parse(text);
                } catch  {
                /* 非 JSON 响应忽略 */ }
                const err = new Error(text || `请求失败（${resp.status}）`);
                err.name = 'SSEError';
                err.code = resp.status;
                if (parsedBody) {
                    const ec = parsedBody.errorCode;
                    if (typeof ec === 'string') {
                        ;
                        err.errorCode = ec;
                    }
                    const msg = parsedBody.message;
                    if (typeof msg === 'string' && msg) {
                        err.message = `${msg}（${resp.status}）`;
                    }
                }
                const retryAfterHeader = resp.headers.get('retry-after');
                if (retryAfterHeader) {
                    const n = Number(retryAfterHeader);
                    if (Number.isFinite(n)) {
                        ;
                        err.retryAfter = n;
                    }
                }
                throw err;
            }
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            // 2026-07-27 立:response 已到达,立即触发 onResponse 回调,
            // 让前端清除"完全冷启动"超时(timeout15s),避免"response 到达但首 token 未到达"时误 abort。
            opts.onResponse?.();
            const hasReasoning = typeof opts.onReasoning === 'function';
            const hasCompaction = typeof opts.onCompaction === 'function';
            const hasQuestion = typeof opts.onQuestion === 'function';
            const hasAgentDelta = typeof opts.onAgentDelta === 'function';
            const hasToolCall = typeof opts.onToolCall === 'function';
            // P4-2: fallback 事件回调存在时启用解析
            const hasFallback = typeof opts.onFallback === 'function';
            // Subagent 自动派发(2026-07-28 立):任一回调存在时启用解析
            const hasSubagent = typeof opts.onSubagentSpawn === 'function' || typeof opts.onSubagentEnd === 'function' || typeof opts.onSubagentProgress === 'function';
            // ===== Dedupe 机制(isRetry 时启用) =====
            // 重连后若服务端不支持 Last-Event-ID 续传会从头重发,前端用 receivedContent 前缀匹配
            // 跳过已接收内容,仅追加新增部分;若服务端发送不同内容则放弃 dedupe 全量追加
            let dedupeBuffer = '';
            let dedupeActive = isRetry && receivedContentRef.current.length > 0;
            const agentDedupeBuffer = new Map();
            const emitDelta = (delta)=>{
                if (!dedupeActive) {
                    opts.onDelta?.(delta);
                    receivedContentRef.current += delta;
                    return;
                }
                dedupeBuffer += delta;
                const received = receivedContentRef.current;
                if (dedupeBuffer.length < received.length) {
                    if (received.startsWith(dedupeBuffer)) return;
                    opts.onDelta?.(dedupeBuffer);
                    receivedContentRef.current += dedupeBuffer;
                    dedupeBuffer = '';
                    dedupeActive = false;
                    return;
                }
                const tail = dedupeBuffer.slice(received.length);
                if (dedupeBuffer.slice(0, received.length) === received) {
                    if (tail) opts.onDelta?.(tail);
                    receivedContentRef.current += tail;
                } else {
                    opts.onDelta?.(dedupeBuffer);
                    receivedContentRef.current += dedupeBuffer;
                }
                dedupeBuffer = '';
                dedupeActive = false;
            };
            const emitAgentDelta = (agentId, delta)=>{
                const received = receivedAgentRef.current.get(agentId) ?? '';
                if (!isRetry || received.length === 0) {
                    opts.onAgentDelta(agentId, delta);
                    receivedAgentRef.current.set(agentId, received + delta);
                    return;
                }
                const buf = (agentDedupeBuffer.get(agentId) ?? '') + delta;
                if (buf.length < received.length) {
                    if (received.startsWith(buf)) {
                        agentDedupeBuffer.set(agentId, buf);
                        return;
                    }
                    opts.onAgentDelta(agentId, buf);
                    receivedAgentRef.current.set(agentId, received + buf);
                    agentDedupeBuffer.delete(agentId);
                    return;
                }
                const tail = buf.slice(received.length);
                if (buf.slice(0, received.length) === received) {
                    if (tail) opts.onAgentDelta(agentId, tail);
                    receivedAgentRef.current.set(agentId, received + tail);
                } else {
                    opts.onAgentDelta(agentId, buf);
                    receivedAgentRef.current.set(agentId, received + buf);
                }
                agentDedupeBuffer.delete(agentId);
            };
            const tryParseCompaction = (line)=>{
                if (!hasCompaction) return;
                if (!line || line.startsWith(':')) return;
                let data = line;
                if (line.startsWith('data:')) {
                    data = line.slice(5).replace(/^\s/, '');
                } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
                    return;
                }
                if (!data || data === '[DONE]') return;
                try {
                    const json = JSON.parse(data);
                    if (json?.compaction?.triggered === true) {
                        opts.onCompaction({
                            tokensBefore: Number(json.compaction.tokensBefore ?? 0),
                            tokensAfter: Number(json.compaction.tokensAfter ?? 0),
                            removedCount: Number(json.compaction.removedCount ?? 0),
                            usageRatio: Number(json.compaction.usageRatio ?? 0)
                        });
                    }
                } catch  {
                /* 非 JSON 或非 compaction 事件忽略 */ }
            };
            const tryParseQuestion = (line)=>{
                if (!hasQuestion) return;
                if (!line || line.startsWith(':')) return;
                let data = line;
                if (line.startsWith('data:')) {
                    data = line.slice(5).replace(/^\s/, '');
                } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
                    return;
                }
                if (!data || data === '[DONE]') return;
                try {
                    const json = JSON.parse(data);
                    if (json?.type === 'question' && json?.question?.questionId) {
                        const q = json.question;
                        opts.onQuestion({
                            questionId: String(q.questionId),
                            prompt: String(q.prompt ?? ''),
                            options: Array.isArray(q.options) ? q.options.filter((o)=>o && typeof o === 'object' && 'id' in o && 'label' in o).map((o)=>({
                                    id: String(o.id),
                                    label: String(o.label)
                                })) : [],
                            allowCustom: q.allowCustom !== false,
                            allowMultiple: q.allowMultiple === true
                        });
                    }
                } catch  {
                /* 非 JSON 或非 question 事件忽略 */ }
            };
            /** 解析 Vercel AI SDK 协议 tool_call 事件:
       *  - type 2(tool-call):{ toolCallId, toolName, args }
       *  - type 7(tool-result):{ toolCallId, result, isError }
       *  - 自定义 tool_result JSON:{ type:'tool_result', toolCallId, toolName, args, result }
       * 触发 onToolCall 回调,前端据 args.result 中的 url 自动打开 WorkPanel */ const tryParseToolCall = (line)=>{
                if (!hasToolCall) return;
                if (!line || line.startsWith(':')) return;
                let data = line;
                if (line.startsWith('data:')) {
                    data = line.slice(5).replace(/^\s/, '');
                } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
                    return;
                }
                if (!data || data === '[DONE]') return;
                // Vercel AI SDK 协议 TYPE:JSON
                const proto = data.match(/^(\d+):(.*)$/s);
                if (proto?.[1] !== undefined) {
                    const t = proto[1];
                    try {
                        const parsed = JSON.parse(proto[2]);
                        if (t === '2' && parsed?.toolCallId && parsed?.toolName) {
                            opts.onToolCall({
                                type: 'tool-call-start',
                                toolCallId: String(parsed.toolCallId),
                                toolName: String(parsed.toolName),
                                args: parsed.args
                            });
                        } else if (t === '7' && parsed?.toolCallId) {
                            opts.onToolCall({
                                type: 'tool-result',
                                toolCallId: String(parsed.toolCallId),
                                toolName: typeof parsed.toolName === 'string' ? parsed.toolName : '',
                                result: parsed.result,
                                isError: parsed.isError === true
                            });
                        }
                    } catch  {
                    /* JSON 解析失败忽略 */ }
                    return;
                }
                // 自定义 JSON 事件(支持 ai-service agent tool loop 推送的 tool-call-start / tool-result)
                if (data.startsWith('{')) {
                    try {
                        const json = JSON.parse(data);
                        if (json?.type === 'tool_result' && json?.toolCallId) {
                            opts.onToolCall({
                                type: 'tool-result',
                                toolCallId: String(json.toolCallId),
                                toolName: typeof json.toolName === 'string' ? json.toolName : '',
                                args: json.args,
                                result: json.result,
                                isError: json.isError === true
                            });
                        } else if (json?.type === 'tool-call-start' && json?.toolCallId) {
                            opts.onToolCall({
                                type: 'tool-call-start',
                                toolCallId: String(json.toolCallId),
                                toolName: typeof json.toolName === 'string' ? json.toolName : '',
                                args: json.args
                            });
                        } else if (json?.type === 'tool-result' && json?.toolCallId) {
                            opts.onToolCall({
                                type: 'tool-result',
                                toolCallId: String(json.toolCallId),
                                toolName: typeof json.toolName === 'string' ? json.toolName : '',
                                args: json.args,
                                result: json.result,
                                isError: json.isError === true
                            });
                        }
                    } catch  {
                    /* 非 JSON 忽略 */ }
                }
            };
            /** 解析 Subagent 派发事件(2026-07-28 立):
       *  - subagent_spawn:主 agent 调用 dispatch_subagent 工具执行前发出
       *  - subagent_progress:执行期间实时发出(thinking/tool_call/tool_result/output_ready)
       *  - subagent_end:执行后发出(带 status: done/failed)
       *  触发 onSubagentSpawn/onSubagentProgress/onSubagentEnd 回调,前端进度面板自动展示。 */ const tryParseSubagent = (line)=>{
                if (!hasSubagent) return;
                if (!line || line.startsWith(':')) return;
                let data = line;
                if (line.startsWith('data:')) {
                    data = line.slice(5).replace(/^\s/, '');
                } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
                    return;
                }
                if (!data || data === '[DONE]') return;
                try {
                    const json = JSON.parse(data);
                    if (json?.type === 'subagent_spawn' && json?.id) {
                        opts.onSubagentSpawn({
                            id: String(json.id),
                            role: typeof json.role === 'string' ? json.role : '',
                            task: typeof json.task === 'string' ? json.task : '',
                            timestamp: typeof json.timestamp === 'string' ? json.timestamp : new Date().toISOString()
                        });
                    } else if (json?.type === 'subagent_progress' && json?.id) {
                        const phase = json.phase;
                        if (phase === 'thinking' || phase === 'tool_call' || phase === 'tool_result' || phase === 'output_ready') {
                            opts.onSubagentProgress({
                                id: String(json.id),
                                phase,
                                timestamp: typeof json.timestamp === 'string' ? json.timestamp : new Date().toISOString(),
                                iteration: typeof json.iteration === 'number' ? json.iteration : undefined,
                                tool: typeof json.tool === 'string' ? json.tool : undefined,
                                ok: typeof json.ok === 'boolean' ? json.ok : undefined,
                                outputPreview: typeof json.output_preview === 'string' ? json.output_preview : undefined,
                                agentName: typeof json.agentName === 'string' ? json.agentName : undefined
                            });
                        }
                    } else if (json?.type === 'subagent_end' && json?.id) {
                        opts.onSubagentEnd({
                            id: String(json.id),
                            status: json.status === 'failed' ? 'failed' : 'done',
                            failureReason: typeof json.failureReason === 'string' ? json.failureReason : undefined,
                            timestamp: typeof json.timestamp === 'string' ? json.timestamp : new Date().toISOString()
                        });
                    }
                } catch  {
                /* 非 JSON 或非 subagent 事件忽略 */ }
            };
            for(;;){
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, {
                    stream: true
                });
                let nl;
                while((nl = buffer.indexOf('\n')) !== -1){
                    const line = buffer.slice(0, nl).replace(/\r$/, '');
                    buffer = buffer.slice(nl + 1);
                    // 捕获 SSE id: 行(用于 Last-Event-ID 断点续传)
                    if (line.startsWith('id:')) lastEventIdRef.current = line.slice(3).trim();
                    tryParseCompaction(line);
                    tryParseQuestion(line);
                    tryParseToolCall(line);
                    tryParseSubagent(line);
                    // P4-2: 优先检查 fallback 事件,命中即触发回调跳过 parseStreamLine
                    if (hasFallback) {
                        const fbEvt = parseFallbackEvent(line);
                        if (fbEvt) {
                            opts.onFallback(fbEvt);
                            continue;
                        }
                    }
                    const delta = parseStreamLine(line);
                    if (delta) {
                        const agentId = hasAgentDelta ? extractAgentId(line) : undefined;
                        if (agentId) emitAgentDelta(agentId, delta);
                        else emitDelta(delta);
                    }
                    if (hasReasoning) {
                        const r = parseStreamLineReasoning(line);
                        if (r) opts.onReasoning(r);
                    }
                }
            }
            if (buffer.trim()) {
                if (buffer.startsWith('id:')) lastEventIdRef.current = buffer.slice(3).trim();
                tryParseCompaction(buffer);
                tryParseQuestion(buffer);
                tryParseToolCall(buffer);
                tryParseSubagent(buffer);
                // P4-2: 优先检查 fallback 事件(尾部 buffer 残留);parseStreamLine 对 fallback 事件返回 null,无需跳过
                if (hasFallback) {
                    const fbEvt = parseFallbackEvent(buffer);
                    if (fbEvt) opts.onFallback(fbEvt);
                }
                const delta = parseStreamLine(buffer);
                if (delta) {
                    const agentId = hasAgentDelta ? extractAgentId(buffer) : undefined;
                    if (agentId) emitAgentDelta(agentId, delta);
                    else emitDelta(delta);
                }
                if (hasReasoning) {
                    const r = parseStreamLineReasoning(buffer);
                    if (r) opts.onReasoning(r);
                }
            }
            opts.onDone?.();
            return;
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                opts.onDone?.();
                return;
            }
            const info = getSSEErrorInfo(err);
            const code = info?.code;
            // P2-2 retry-after 协商:429 + retryAfter 视为可重试(走网络重试路径,按 retryAfter 等待);
            // 429 无 retryAfter 仍视为业务错误(不重连);401/403 永远是业务错误
            const isBusinessError = code === 401 || code === 403 || code === 429 && info?.retryAfter === undefined;
            const canRetry = !isBusinessError && attempt < maxRetries;
            if (!canRetry) {
                const message = err instanceof Error ? err.message : '网络异常';
                // recoverable=true 标记"网络可重试但已耗尽自动重连次数",前端可显示"网络不稳定,可手动重试"
                opts.onError?.(message, {
                    ...info,
                    recoverable: !isBusinessError
                });
                return;
            }
            // P2-2 优先消费 Retry-After(秒转毫秒,上限 STREAM_MAX_RETRY_DELAY);
            // 无 retryAfter 时走指数退避:1s, 2s, 4s, 8s... 上限 30s(与 useAgentSSE 重连模式一致)
            const delay = info?.retryAfter !== undefined ? Math.min(info.retryAfter * 1000, STREAM_MAX_RETRY_DELAY) : Math.min(STREAM_INITIAL_RETRY_DELAY * 2 ** attempt, STREAM_MAX_RETRY_DELAY);
            attempt++;
            opts.onReconnect?.(attempt, delay);
            await sleepWithAbort(delay, opts.signal);
        }
    }
}
}),
"[project]/packages/api-client/src/api-error.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ApiError",
    ()=>ApiError,
    "isErrorCode",
    ()=>isErrorCode,
    "isNotFound",
    ()=>isNotFound
]);
class ApiError extends Error {
    status;
    errorCode;
    constructor(message, status, errorCode){
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.errorCode = errorCode;
    }
}
function isNotFound(err) {
    return err instanceof ApiError && err.status === 404;
}
function isErrorCode(err, code) {
    return err instanceof ApiError && err.errorCode === code;
}
}),
"[project]/packages/api-client/src/model-context-capacity.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 模型上下文容量映射(跨端共享)
 *
 * 根据模型 id 推断该模型支持的最大上下文 token 数。
 * 数据基于 2025-2026 各厂商官方文档,部分估算值取保守下限。
 *
 * 跨端使用:web / desktop / extension / mobile-rn / miniapp-taro
 * 都通过 `@ihui/api-client` 导入 getModelContextCapacity,避免重复实现。
 */ /** 默认兜底上下文长度(未知模型保守值) */ __turbopack_context__.s([
    "DEFAULT_CONTEXT_CAPACITY",
    ()=>DEFAULT_CONTEXT_CAPACITY,
    "formatTokenCount",
    ()=>formatTokenCount,
    "getModelContextCapacity",
    ()=>getModelContextCapacity
]);
const DEFAULT_CONTEXT_CAPACITY = 32_000;
/** 精确模型 id → 上下文 token 数 */ const EXACT_CAPACITY = {
    // === OpenAI ===
    'gpt-4o': 128_000,
    'gpt-4o-mini': 128_000,
    'gpt-4.1': 1_047_576,
    'gpt-4.1-mini': 1_047_576,
    'gpt-4.1-nano': 1_047_576,
    o3: 200_000,
    'o3-mini': 200_000,
    'o4-mini': 200_000,
    // === Anthropic ===
    'claude-3-5-sonnet': 200_000,
    'claude-3-5-haiku': 200_000,
    'claude-3-7-sonnet': 200_000,
    'claude-opus-4': 200_000,
    'claude-sonnet-4': 200_000,
    // === Google Gemini ===
    'gemini-2.0-flash': 1_048_576,
    'gemini-2.5-pro': 2_097_152,
    'gemini-2.5-flash': 1_048_576,
    // === Google Gemma 开源 ===
    'gemma-2-27b-it': 8_192,
    'gemma-2-9b-it': 8_192,
    // === DeepSeek ===
    'deepseek-chat': 64_000,
    'deepseek-reasoner': 64_000,
    'deepseek-v3': 64_000,
    // === Meta Llama ===
    'llama-3.3-70b-versatile': 128_000,
    'llama-3.1-405b-instruct': 128_000,
    // === Mistral ===
    'mistral-large-latest': 128_000,
    'codestral-latest': 256_000,
    'pixtral-large-latest': 128_000,
    // === xAI Grok ===
    'grok-2': 128_000,
    'grok-3': 1_000_000,
    // === Cohere ===
    'command-r-plus': 128_000,
    'command-a': 256_000,
    // === Qwen 通义千问 ===
    'qwen-plus': 131_072,
    'qwen-max': 32_768,
    'qwen-turbo': 1_000_000,
    'qwen2.5-72b-instruct': 131_072,
    // === Zhipu 智谱 ===
    'glm-4-plus': 128_000,
    'glm-4.5': 128_000,
    'glm-4-air': 128_000,
    // === Moonshot 月之暗面 ===
    'moonshot-v1-8k': 8_000,
    'moonshot-v1-32k': 32_000,
    'kimi-k2': 200_000,
    // === Doubao 豆包 ===
    'doubao-1-6-pro': 32_000,
    'doubao-pro-32k': 32_000,
    // === StepFun 阶跃星辰 ===
    'stepfun/step-3.7-flash': 8_000,
    'stepfun/step-3.5-flash': 8_000,
    'stepfun/step-router-v1': 8_000,
    // === Tencent Hunyuan 腾讯混元 ===
    'hunyuan-pro': 32_000,
    'hunyuan-turbo': 32_000,
    // === Baidu Wenxin 百度文心 ===
    'ernie-4.0-turbo-8k': 8_000,
    'ernie-speed-128k': 128_000,
    // === MiniMax ===
    'abab6.5s-chat': 245_760,
    'minimax-text-01': 1_000_000,
    // === Baichuan 百川 ===
    'baichuan-4-turbo': 32_000,
    // === iFlyTek Spark 讯飞星火 ===
    'spark-v4': 8_000,
    // === 零一万物 ===
    'yi-large': 32_000,
    // === 商汤 SenseNova ===
    'sensenova-5': 32_000,
    // === 天工 Skywork ===
    'skywork-4': 32_000,
    // === InternLM 书生 ===
    'internlm2.5-20b': 32_000
};
/**
 * 按关键词模糊匹配的规则(当精确匹配失败时按顺序匹配)。
 */ const PATTERN_CAPACITY = [
    // 长上下文关键词优先
    {
        pattern: /1m|1[_-]?m(illion)?|1_000_000|1048576/i,
        capacity: 1_048_576
    },
    {
        pattern: /2m|2[_-]?m(illion)?|2097152/i,
        capacity: 2_097_152
    },
    {
        pattern: /128k|131072/i,
        capacity: 131_072
    },
    {
        pattern: /200k|200000/i,
        capacity: 200_000
    },
    {
        pattern: /256k|256000/i,
        capacity: 256_000
    },
    {
        pattern: /64k|64000/i,
        capacity: 64_000
    },
    {
        pattern: /32k|32000/i,
        capacity: 32_000
    },
    {
        pattern: /8k|8000/i,
        capacity: 8_000
    },
    // 厂商默认值
    {
        pattern: /^gpt-?4/,
        capacity: 128_000
    },
    {
        pattern: /^gpt-?5/,
        capacity: 256_000
    },
    {
        pattern: /claude/i,
        capacity: 200_000
    },
    {
        pattern: /gemini/i,
        capacity: 1_048_576
    },
    {
        pattern: /deepseek/i,
        capacity: 64_000
    },
    {
        pattern: /llama/i,
        capacity: 128_000
    },
    {
        pattern: /mistral|codestral|pixtral/i,
        capacity: 128_000
    },
    {
        pattern: /grok/i,
        capacity: 128_000
    },
    {
        pattern: /command-(r|a)/i,
        capacity: 128_000
    },
    {
        pattern: /qwen/i,
        capacity: 131_072
    },
    {
        pattern: /glm/i,
        capacity: 128_000
    },
    {
        pattern: /moonshot|kimi/i,
        capacity: 200_000
    },
    {
        pattern: /doubao/i,
        capacity: 32_000
    },
    {
        pattern: /stepfun|step-/i,
        capacity: 8_000
    },
    {
        pattern: /hunyuan/i,
        capacity: 32_000
    },
    {
        pattern: /ernie|wenxin/i,
        capacity: 8_000
    },
    {
        pattern: /minimax|abab/i,
        capacity: 245_760
    },
    {
        pattern: /baichuan/i,
        capacity: 32_000
    },
    {
        pattern: /spark/i,
        capacity: 8_000
    },
    {
        pattern: /yi-large/i,
        capacity: 32_000
    },
    {
        pattern: /sensenova/i,
        capacity: 32_000
    },
    {
        pattern: /skywork/i,
        capacity: 32_000
    },
    {
        pattern: /internlm/i,
        capacity: 32_000
    }
];
function getModelContextCapacity(modelId) {
    if (!modelId) return DEFAULT_CONTEXT_CAPACITY;
    const exact = EXACT_CAPACITY[modelId];
    if (exact) return exact;
    for (const { pattern, capacity } of PATTERN_CAPACITY){
        if (pattern.test(modelId)) return capacity;
    }
    return DEFAULT_CONTEXT_CAPACITY;
}
function formatTokenCount(tokens) {
    if (tokens >= 1_000_000) {
        const m = tokens / 1_000_000;
        return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
    }
    if (tokens >= 1_000) {
        const k = tokens / 1_000;
        return `${Number.isInteger(k) ? k : k.toFixed(0)}K`;
    }
    return String(tokens);
}
}),
"[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildQs",
    ()=>buildQs,
    "eduApi",
    ()=>eduApi
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$api$2d$error$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/api-error.ts [app-ssr] (ecmascript)");
;
;
async function eduApi(url, options) {
    const r = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(url, options);
    if (!r.success) throw new __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$api$2d$error$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ApiError"](r.error, r.status, r.errorCode);
    return r.data;
}
function buildQs(params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)){
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const s = qs.toString();
    return s ? `?${s}` : '';
}
}),
"[project]/packages/api-client/src/ws-client.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 框架无关的 WebSocket 客户端(跨端共享)。
 *
 * 封装通用能力:token 注入、心跳、断线指数退避重连、消息类型守卫。
 * 不依赖任何框架(React/Vue/RN/Tauri 均可用),各端自行写薄包装层。
 *
 * 后端端点:GET /ws/notifications?token=<access_token>
 * 消息格式:{ type: 'notification', data: {...} }
 * 心跳:客户端发 'ping' 字符串,服务端回 'pong' 字符串
 */ __turbopack_context__.s([
    "WebSocketClient",
    ()=>WebSocketClient,
    "buildNotificationWsUrl",
    ()=>buildNotificationWsUrl,
    "createNotificationClient",
    ()=>createNotificationClient,
    "isWSNotification",
    ()=>isWSNotification
]);
/** WebSocket readyState 数字常量(与标准 WebSocket 一致,避免直接引用全局 WebSocket) */ const WS_CONNECTING = 0;
const WS_OPEN = 1;
class WebSocketClient {
    options;
    handlers;
    ws;
    reconnectAttempt;
    reconnectTimer;
    heartbeatTimer;
    closedByUser;
    _isConnected;
    constructor(options, handlers = {}){
        this.options = options;
        this.handlers = handlers;
        this.ws = null;
        this.reconnectAttempt = 0;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.closedByUser = false;
        this._isConnected = false;
    }
    get isConnected() {
        return this._isConnected;
    }
    /** 连接 WebSocket(若已连接则忽略) */ connect() {
        const token = this.options.tokenProvider();
        if (!token || this.closedByUser) return;
        // 提供了 webSocketFactory 时跳过全局 WebSocket 检查(factory 可能不依赖全局 WebSocket)
        if (!this.options.webSocketFactory && typeof WebSocket === 'undefined') return;
        if (this.ws && (this.ws.readyState === WS_OPEN || this.ws.readyState === WS_CONNECTING)) {
            return;
        }
        let ws;
        try {
            ws = this.options.webSocketFactory ? this.options.webSocketFactory(this.options.urlBuilder(token)) : new WebSocket(this.options.urlBuilder(token));
        } catch (e) {
            this.handlers.onError?.(e instanceof Error ? e.message : 'WebSocket 连接失败');
            return;
        }
        this.ws = ws;
        ws.onopen = ()=>{
            this.reconnectAttempt = 0;
            this._isConnected = true;
            this.handlers.onOpen?.();
            this.startHeartbeat(ws);
        };
        // WebSocket onmessage 在 DOM(MessageEvent)和 RN(WebSocketMessageEvent)类型不同,
        // 用 WebSocketLike 的 { data: unknown } 统一签名兼容跨端(web/RN/desktop/extension)
        ws.onmessage = (event)=>{
            const raw = event?.data;
            if (raw === 'pong' || raw === '"pong"') return;
            if (typeof raw !== 'string') return;
            try {
                const parsed = JSON.parse(raw);
                if (!this.options.messageGuard(parsed)) return;
                this.handlers.onMessage?.(parsed);
            } catch  {
            // 非 JSON 消息忽略
            }
        };
        ws.onclose = ()=>{
            this._isConnected = false;
            this.handlers.onClose?.();
            this.clearTimers();
            if (!this.closedByUser) {
                this.scheduleReconnect();
            }
        };
        ws.onerror = ()=>{
            this.handlers.onError?.('WebSocket 连接错误');
        };
    }
    /** 主动断开(不触发重连) */ disconnect() {
        this.closedByUser = true;
        this.clearTimers();
        if (this.ws) {
            try {
                this.ws.close();
            } catch  {
            // ignore
            }
            this.ws = null;
        }
        this._isConnected = false;
    }
    /** 发送消息(仅当连接打开时) */ send(data) {
        if (this.ws && this.ws.readyState === WS_OPEN) {
            try {
                this.ws.send(data);
                return true;
            } catch  {
                return false;
            }
        }
        return false;
    }
    /** token 刷新后重置连接(断开当前连接,用新 token 重连) */ updateToken() {
        if (this.ws) {
            try {
                this.ws.close();
            } catch  {
            // ignore
            }
            this.ws = null;
        }
        this.closedByUser = false;
        this.reconnectAttempt = 0;
        this.connect();
    }
    startHeartbeat(ws) {
        const interval = this.options.heartbeatInterval ?? 30000;
        const heartbeatMessage = this.options.heartbeatMessage ?? (()=>'ping');
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = setInterval(()=>{
            if (ws.readyState === WS_OPEN) {
                try {
                    ws.send(heartbeatMessage());
                } catch  {
                // 心跳失败等 onclose 重连
                }
            }
        }, interval);
    }
    scheduleReconnect() {
        const token = this.options.tokenProvider();
        if (!token) return;
        const maxDelay = this.options.maxReconnectDelay ?? 30000;
        const delay = Math.min(1000 * 2 ** this.reconnectAttempt, maxDelay);
        this.reconnectAttempt += 1;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(()=>this.connect(), delay);
    }
    clearTimers() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
}
function isWSNotification(data) {
    if (typeof data !== 'object' || data === null) return false;
    const d = data;
    return d.type === 'notification' && !!d.data;
}
function buildNotificationWsUrl(baseUrl, token) {
    // baseUrl 形如 https://api.example.com 或 http://localhost:8801
    const url = new URL(baseUrl);
    const proto = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${url.host}/ws/notifications?token=${encodeURIComponent(token)}`;
}
function createNotificationClient(config, handlers = {}, overrides = {}) {
    return new WebSocketClient({
        urlBuilder: (token)=>buildNotificationWsUrl(config.baseUrl, token),
        tokenProvider: config.tokenProvider,
        messageGuard: isWSNotification,
        ...overrides
    }, handlers);
}
}),
"[project]/packages/api-client/src/endpoints/admin.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * @deprecated 2026-07-31 标记废弃。本文件 12 个函数在整个 monorepo 中零引用
 * (apps/web admin 页面各自使用 helpers.ts 中的 `api<T>()` 包装函数)。
 * 保留文件作为内部实现,如需统一 admin API client 调用可重新启用。
 * 后续 admin 页面迁移到 @ihui/api-client 统一调用时,可移除此标记。
 */ __turbopack_context__.s([
    "adminCreateProduct",
    ()=>adminCreateProduct,
    "adminCreateRole",
    ()=>adminCreateRole,
    "adminDeleteUser",
    ()=>adminDeleteUser,
    "adminGetConfig",
    ()=>adminGetConfig,
    "adminGetLogs",
    ()=>adminGetLogs,
    "adminGetOrders",
    ()=>adminGetOrders,
    "adminGetProducts",
    ()=>adminGetProducts,
    "adminGetRoles",
    ()=>adminGetRoles,
    "adminGetStatistics",
    ()=>adminGetStatistics,
    "adminGetUsers",
    ()=>adminGetUsers,
    "adminUpdateConfig",
    ()=>adminUpdateConfig,
    "adminUpdateUser",
    ()=>adminUpdateUser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function adminGetUsers(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/admin/usercenter/users${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function adminUpdateUser(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/admin/usercenter/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function adminDeleteUser(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/admin/usercenter/users/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
}
async function adminGetRoles() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/admin/roles');
}
async function adminCreateRole(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/admin/roles', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function adminGetOrders(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/admin/orders${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function adminGetProducts(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/admin/products${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function adminCreateProduct(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/admin/products', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function adminGetStatistics(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/admin/statistics${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function adminGetLogs(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/admin/logs${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function adminGetConfig() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/admin/configs');
}
async function adminUpdateConfig(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/admin/configs', {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
}),
"[project]/packages/api-client/src/endpoints/admin-auth.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * B 端用户中心管API
 * 对接后端 apps/api/src/routes/admin/ auth-* / user-roles / system-login-logs 模块,
 * 覆盖 auth-accounts / auth-info / auth-role / auth-tokens / auth-user-vip / auth-vip-level / auth-sms-temp / user-roles / login-logs 九大模块 */ __turbopack_context__.s([
    "addAuthAccount",
    ()=>addAuthAccount,
    "addAuthInfo",
    ()=>addAuthInfo,
    "addAuthRole",
    ()=>addAuthRole,
    "addAuthSmsTemp",
    ()=>addAuthSmsTemp,
    "addAuthToken",
    ()=>addAuthToken,
    "addAuthUserVip",
    ()=>addAuthUserVip,
    "addAuthVipLevel",
    ()=>addAuthVipLevel,
    "addLoginLog",
    ()=>addLoginLog,
    "addUserRole",
    ()=>addUserRole,
    "delAuthAccount",
    ()=>delAuthAccount,
    "delAuthInfo",
    ()=>delAuthInfo,
    "delAuthRole",
    ()=>delAuthRole,
    "delAuthSmsTemp",
    ()=>delAuthSmsTemp,
    "delAuthToken",
    ()=>delAuthToken,
    "delAuthUserVip",
    ()=>delAuthUserVip,
    "delAuthVipLevel",
    ()=>delAuthVipLevel,
    "delLoginLog",
    ()=>delLoginLog,
    "delUserRole",
    ()=>delUserRole,
    "getAuthAccount",
    ()=>getAuthAccount,
    "getAuthInfo",
    ()=>getAuthInfo,
    "getAuthRole",
    ()=>getAuthRole,
    "getAuthSmsTemp",
    ()=>getAuthSmsTemp,
    "getAuthToken",
    ()=>getAuthToken,
    "getAuthUserVip",
    ()=>getAuthUserVip,
    "getAuthVipLevel",
    ()=>getAuthVipLevel,
    "getLoginLog",
    ()=>getLoginLog,
    "getUserRole",
    ()=>getUserRole,
    "listAuthAccounts",
    ()=>listAuthAccounts,
    "listAuthInfo",
    ()=>listAuthInfo,
    "listAuthRoles",
    ()=>listAuthRoles,
    "listAuthSmsTemps",
    ()=>listAuthSmsTemps,
    "listAuthTokens",
    ()=>listAuthTokens,
    "listAuthUserVip",
    ()=>listAuthUserVip,
    "listAuthVipLevels",
    ()=>listAuthVipLevels,
    "listLoginLogs",
    ()=>listLoginLogs,
    "listUserRoles",
    ()=>listUserRoles,
    "updateAuthAccount",
    ()=>updateAuthAccount,
    "updateAuthInfo",
    ()=>updateAuthInfo,
    "updateAuthRole",
    ()=>updateAuthRole,
    "updateAuthSmsTemp",
    ()=>updateAuthSmsTemp,
    "updateAuthToken",
    ()=>updateAuthToken,
    "updateAuthUserVip",
    ()=>updateAuthUserVip,
    "updateAuthVipLevel",
    ()=>updateAuthVipLevel,
    "updateLoginLog",
    ()=>updateLoginLog,
    "updateUserRole",
    ()=>updateUserRole
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function listAuthAccounts(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-accounts${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getAuthAccount(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-accounts/${id}`);
}
async function addAuthAccount(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/auth-accounts', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAuthAccount(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-accounts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delAuthAccount(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-accounts/${id}`, {
        method: 'DELETE'
    });
}
async function listAuthInfo(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-info${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getAuthInfo(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-info/${id}`);
}
async function addAuthInfo(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/auth-info', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAuthInfo(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-info/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delAuthInfo(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-info/${id}`, {
        method: 'DELETE'
    });
}
async function listAuthRoles(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-role${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getAuthRole(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-role/${id}`);
}
async function addAuthRole(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/auth-role', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAuthRole(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-role/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delAuthRole(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-role/${id}`, {
        method: 'DELETE'
    });
}
async function listAuthTokens(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-tokens${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getAuthToken(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-tokens/${id}`);
}
async function addAuthToken(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/auth-tokens', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAuthToken(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-tokens/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delAuthToken(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-tokens/${id}`, {
        method: 'DELETE'
    });
}
async function listAuthUserVip(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-user-vip${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getAuthUserVip(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-user-vip/${id}`);
}
async function addAuthUserVip(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/auth-user-vip', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAuthUserVip(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-user-vip/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delAuthUserVip(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-user-vip/${id}`, {
        method: 'DELETE'
    });
}
async function listAuthVipLevels(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-vip-level${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getAuthVipLevel(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-vip-level/${id}`);
}
async function addAuthVipLevel(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/auth-vip-level', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAuthVipLevel(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-vip-level/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delAuthVipLevel(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-vip-level/${id}`, {
        method: 'DELETE'
    });
}
async function listAuthSmsTemps(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-sms-temp${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getAuthSmsTemp(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-sms-temp/${id}`);
}
async function addAuthSmsTemp(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/auth-sms-temp', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAuthSmsTemp(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-sms-temp/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delAuthSmsTemp(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/auth-sms-temp/${id}`, {
        method: 'DELETE'
    });
}
async function listUserRoles(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/user-roles${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getUserRole(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/user-roles/${id}`);
}
async function addUserRole(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/user-roles', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateUserRole(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/user-roles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delUserRole(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/user-roles/${id}`, {
        method: 'DELETE'
    });
}
async function listLoginLogs(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/system/login-logs${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getLoginLog(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/system/login-logs/${id}`);
}
async function addLoginLog(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/system/login-logs', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateLoginLog(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/system/login-logs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delLoginLog(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/system/login-logs/${id}`, {
        method: 'DELETE'
    });
}
}),
"[project]/packages/api-client/src/endpoints/admin-business.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Admin 后台业务管理 API(2026-07-28 立)
 *
 * @deprecated 2026-07-31 标记废弃。本文件 60 个函数在整个 monorepo 中零引用
 * (apps/web admin 页面各自使用 helpers.ts 中的 `api<T>()` 包装函数)。
 * 保留文件作为内部实现,如需统一 admin API client 调用可重新启用。
 * 后续 admin 页面迁移到 @ihui/api-client 统一调用时,可移除此标记。
 *
 * 补全 admin 端点:覆盖 articles / news / members / live / resources /
 * customer-service / invoices-titles / orders-refunds / shop-withdrawals 9 大模块,
 * 使用 @ihui/types 共享类型契约(与 apps/web/app/(main)/admin 下各 types.ts 对齐).
 *
 * 与 admin.ts(adminGetUsers/adminGetOrders 基础版)、admin-member.ts(member/users 路径)、
 * admin-content.ts(AdminRow 宽松类型)互补:本文件提供精确类型化的端点封装。
 */ __turbopack_context__.s([
    "approveAdminWithdrawal",
    ()=>approveAdminWithdrawal,
    "auditAdminRefund",
    ()=>auditAdminRefund,
    "batchImportAdminMembers",
    ()=>batchImportAdminMembers,
    "createAdminArticle",
    ()=>createAdminArticle,
    "createAdminInvoiceTitle",
    ()=>createAdminInvoiceTitle,
    "createAdminLiveChannel",
    ()=>createAdminLiveChannel,
    "createAdminMember",
    ()=>createAdminMember,
    "createAdminNewsArticle",
    ()=>createAdminNewsArticle,
    "createAdminNewsInformation",
    ()=>createAdminNewsInformation,
    "createAdminResource",
    ()=>createAdminResource,
    "deleteAdminArticle",
    ()=>deleteAdminArticle,
    "deleteAdminInvoiceTitle",
    ()=>deleteAdminInvoiceTitle,
    "deleteAdminLiveChannel",
    ()=>deleteAdminLiveChannel,
    "deleteAdminMember",
    ()=>deleteAdminMember,
    "deleteAdminNewsArticle",
    ()=>deleteAdminNewsArticle,
    "deleteAdminNewsInformation",
    ()=>deleteAdminNewsInformation,
    "deleteAdminResource",
    ()=>deleteAdminResource,
    "getAdminArticle",
    ()=>getAdminArticle,
    "getAdminCsStats",
    ()=>getAdminCsStats,
    "getAdminLiveChannel",
    ()=>getAdminLiveChannel,
    "getAdminLiveStatistics",
    ()=>getAdminLiveStatistics,
    "getAdminMember",
    ()=>getAdminMember,
    "getAdminMemberStatistics",
    ()=>getAdminMemberStatistics,
    "getAdminNewsArticle",
    ()=>getAdminNewsArticle,
    "getAdminOrderDetail",
    ()=>getAdminOrderDetail,
    "getAdminRefundDetail",
    ()=>getAdminRefundDetail,
    "getAdminResource",
    ()=>getAdminResource,
    "getAdminTicket",
    ()=>getAdminTicket,
    "getAdminWithdrawalDetail",
    ()=>getAdminWithdrawalDetail,
    "listAdminArticles",
    ()=>listAdminArticles,
    "listAdminCompanies",
    ()=>listAdminCompanies,
    "listAdminCsAgents",
    ()=>listAdminCsAgents,
    "listAdminCsCategories",
    ()=>listAdminCsCategories,
    "listAdminCsSessions",
    ()=>listAdminCsSessions,
    "listAdminInvoiceApplications",
    ()=>listAdminInvoiceApplications,
    "listAdminInvoiceTitles",
    ()=>listAdminInvoiceTitles,
    "listAdminLiveCategories",
    ()=>listAdminLiveCategories,
    "listAdminLiveChannels",
    ()=>listAdminLiveChannels,
    "listAdminLiveLecturers",
    ()=>listAdminLiveLecturers,
    "listAdminMemberLevels",
    ()=>listAdminMemberLevels,
    "listAdminMembers",
    ()=>listAdminMembers,
    "listAdminNewsArticles",
    ()=>listAdminNewsArticles,
    "listAdminNewsCategories",
    ()=>listAdminNewsCategories,
    "listAdminNewsInformation",
    ()=>listAdminNewsInformation,
    "listAdminOrdersV2",
    ()=>listAdminOrdersV2,
    "listAdminRefunds",
    ()=>listAdminRefunds,
    "listAdminResourceCategories",
    ()=>listAdminResourceCategories,
    "listAdminResources",
    ()=>listAdminResources,
    "listAdminTickets",
    ()=>listAdminTickets,
    "listAdminWithdrawalFlows",
    ()=>listAdminWithdrawalFlows,
    "listAdminWithdrawals",
    ()=>listAdminWithdrawals,
    "rejectAdminWithdrawal",
    ()=>rejectAdminWithdrawal,
    "updateAdminArticle",
    ()=>updateAdminArticle,
    "updateAdminInvoiceTitle",
    ()=>updateAdminInvoiceTitle,
    "updateAdminLiveChannel",
    ()=>updateAdminLiveChannel,
    "updateAdminMember",
    ()=>updateAdminMember,
    "updateAdminNewsArticle",
    ()=>updateAdminNewsArticle,
    "updateAdminNewsInformation",
    ()=>updateAdminNewsInformation,
    "updateAdminResource",
    ()=>updateAdminResource,
    "updateAdminTicket",
    ()=>updateAdminTicket
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function listAdminArticles(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/articles${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAdminArticle(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/articles/${id}`);
}
async function createAdminArticle(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/articles', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAdminArticle(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/articles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function deleteAdminArticle(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/articles/${id}`, {
        method: 'DELETE'
    });
}
async function listAdminNewsArticles(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/news/articles${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAdminNewsArticle(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/news/articles/${id}`);
}
async function createAdminNewsArticle(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/news/articles', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAdminNewsArticle(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/news/articles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function deleteAdminNewsArticle(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/news/articles/${id}`, {
        method: 'DELETE'
    });
}
async function listAdminNewsCategories(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/news/categories${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function listAdminNewsInformation(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/news/information${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function createAdminNewsInformation(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/news/information', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAdminNewsInformation(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/news/information/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function deleteAdminNewsInformation(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/news/information/${id}`, {
        method: 'DELETE'
    });
}
async function listAdminMembers(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/members${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAdminMember(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/members/by-id?id=${id}`);
}
async function createAdminMember(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/members', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAdminMember(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/members', {
        method: 'PUT',
        body: JSON.stringify({
            id,
            ...body
        })
    });
}
async function deleteAdminMember(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/members?id=${id}`, {
        method: 'DELETE'
    });
}
async function getAdminMemberStatistics() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/members/statistics');
}
async function listAdminMemberLevels(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/members/levels${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function listAdminCompanies(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/members/companies${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function batchImportAdminMembers(file) {
    const form = new FormData();
    form.append('file', file);
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/members/batch-import', {
        method: 'POST',
        body: form
    });
}
async function listAdminLiveChannels(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/live/channels${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAdminLiveChannel(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/live/channels/${id}`);
}
async function createAdminLiveChannel(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/live/channels', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAdminLiveChannel(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/live/channels/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function deleteAdminLiveChannel(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/live/channels/${id}`, {
        method: 'DELETE'
    });
}
async function listAdminLiveCategories(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/live/categories${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function listAdminLiveLecturers(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/live/lecturers${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAdminLiveStatistics() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/live/statistics');
}
async function listAdminResources(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/resources${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAdminResource(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/resources/${id}`);
}
async function createAdminResource(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/resources', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAdminResource(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/resources/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function deleteAdminResource(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/resources/${id}`, {
        method: 'DELETE'
    });
}
async function listAdminResourceCategories(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/resources/categories${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function listAdminTickets(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/customer-service/tickets${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAdminTicket(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/customer-service/tickets/${id}`);
}
async function updateAdminTicket(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/customer-service/tickets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function listAdminCsCategories(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/customer-service/categories${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function listAdminCsAgents(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/customer-service/agents${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAdminCsStats() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/customer-service/stats');
}
async function listAdminCsSessions(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/customer-service/sessions${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function listAdminInvoiceTitles(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/invoices/titles${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function createAdminInvoiceTitle(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/invoices/titles', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAdminInvoiceTitle(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/invoices/titles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function deleteAdminInvoiceTitle(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/invoices/titles/${id}`, {
        method: 'DELETE'
    });
}
async function listAdminOrdersV2(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/orders${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAdminOrderDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/orders/${id}`);
}
async function listAdminRefunds(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/refunds${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAdminRefundDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/refunds/${id}`);
}
async function auditAdminRefund(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/refunds/${id}/audit`, {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function listAdminInvoiceApplications(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/invoices/applications${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function listAdminWithdrawals(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/shop/withdrawals${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAdminWithdrawalDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/shop/withdrawals/${id}`);
}
async function approveAdminWithdrawal(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/shop/withdrawals/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(body || {})
    });
}
async function rejectAdminWithdrawal(id, reason) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/shop/withdrawals/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
            reason: reason || '审核未通过'
        })
    });
}
async function listAdminWithdrawalFlows(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/shop/withdrawal-flow${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
}),
"[project]/packages/api-client/src/endpoints/admin-content.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * B 端内容/运营管理 API
 * 对接后端 apps/api/src/routes/admin/ 下的内容运营与平台管理模块,
 * 覆盖 ai-gc / carousel / comments / comment-logs / video-logs / developer-link /
 * identity-proportion / oss-files / monitor(alerts/alert-rules) / monitoring(logs) /
 * stats(ai-model-config / shop/withdrawal-flow / configs) / system-login-logs(courses /
 * course-videos / learn/homework / developer/coze / oauth/apps) / system-operation-logs /
 * task-developer / user-agent-audio / user-agent-image / news/information /
 * zhs-activity / zhs-agent / zhs-identity / zhs-user 模块。
 */ __turbopack_context__.s([
    "addAdminCourse",
    ()=>addAdminCourse,
    "addAdminOauthApp",
    ()=>addAdminOauthApp,
    "addAiGc",
    ()=>addAiGc,
    "addAiModelConfig",
    ()=>addAiModelConfig,
    "addCarousel",
    ()=>addCarousel,
    "addDeveloperCoze",
    ()=>addDeveloperCoze,
    "addIdentityProportion",
    ()=>addIdentityProportion,
    "addLearnHomework",
    ()=>addLearnHomework,
    "addMonitorAlert",
    ()=>addMonitorAlert,
    "addMonitorAlertRule",
    ()=>addMonitorAlertRule,
    "addMonitoringLog",
    ()=>addMonitoringLog,
    "addNewsInformation",
    ()=>addNewsInformation,
    "addShopWithdrawalFlow",
    ()=>addShopWithdrawalFlow,
    "addTaskDeveloper",
    ()=>addTaskDeveloper,
    "addUserAgentImage",
    ()=>addUserAgentImage,
    "addZhsActivity",
    ()=>addZhsActivity,
    "addZhsIdentity",
    ()=>addZhsIdentity,
    "batchDeleteOssFiles",
    ()=>batchDeleteOssFiles,
    "delAdminComment",
    ()=>delAdminComment,
    "delAdminCourse",
    ()=>delAdminCourse,
    "delAdminOauthApp",
    ()=>delAdminOauthApp,
    "delAiGc",
    ()=>delAiGc,
    "delAiModelConfig",
    ()=>delAiModelConfig,
    "delCarousel",
    ()=>delCarousel,
    "delCommentLog",
    ()=>delCommentLog,
    "delDeveloperCoze",
    ()=>delDeveloperCoze,
    "delDeveloperLink",
    ()=>delDeveloperLink,
    "delIdentityProportion",
    ()=>delIdentityProportion,
    "delLearnHomework",
    ()=>delLearnHomework,
    "delMonitorAlert",
    ()=>delMonitorAlert,
    "delMonitorAlertRule",
    ()=>delMonitorAlertRule,
    "delMonitoringLog",
    ()=>delMonitoringLog,
    "delNewsInformation",
    ()=>delNewsInformation,
    "delShopWithdrawalFlow",
    ()=>delShopWithdrawalFlow,
    "delSystemOperationLog",
    ()=>delSystemOperationLog,
    "delTaskDeveloper",
    ()=>delTaskDeveloper,
    "delUserAgentAudio",
    ()=>delUserAgentAudio,
    "delUserAgentImage",
    ()=>delUserAgentImage,
    "delVideoLog",
    ()=>delVideoLog,
    "delZhsActivity",
    ()=>delZhsActivity,
    "delZhsAgent",
    ()=>delZhsAgent,
    "delZhsIdentity",
    ()=>delZhsIdentity,
    "delZhsUser",
    ()=>delZhsUser,
    "deleteOssFile",
    ()=>deleteOssFile,
    "getAdminComment",
    ()=>getAdminComment,
    "getAdminCourse",
    ()=>getAdminCourse,
    "getAdminCourseTemp",
    ()=>getAdminCourseTemp,
    "getAiModelConfig",
    ()=>getAiModelConfig,
    "getCourseVideo",
    ()=>getCourseVideo,
    "getCourseVideoTemp",
    ()=>getCourseVideoTemp,
    "getMonitorAlert",
    ()=>getMonitorAlert,
    "getMonitorAlertRule",
    ()=>getMonitorAlertRule,
    "getMonitoringLog",
    ()=>getMonitoringLog,
    "getUserAgentImage",
    ()=>getUserAgentImage,
    "listAdminComments",
    ()=>listAdminComments,
    "listAdminCourses",
    ()=>listAdminCourses,
    "listAdminOauthApps",
    ()=>listAdminOauthApps,
    "listAiGc",
    ()=>listAiGc,
    "listAiModelConfig",
    ()=>listAiModelConfig,
    "listCarousel",
    ()=>listCarousel,
    "listCommentLogs",
    ()=>listCommentLogs,
    "listDeveloperCoze",
    ()=>listDeveloperCoze,
    "listDeveloperLink",
    ()=>listDeveloperLink,
    "listIdentityProportion",
    ()=>listIdentityProportion,
    "listLearnHomework",
    ()=>listLearnHomework,
    "listMonitorAlertRules",
    ()=>listMonitorAlertRules,
    "listMonitorAlerts",
    ()=>listMonitorAlerts,
    "listMonitoringLogs",
    ()=>listMonitoringLogs,
    "listNewsInformation",
    ()=>listNewsInformation,
    "listOssFiles",
    ()=>listOssFiles,
    "listShopWithdrawalFlow",
    ()=>listShopWithdrawalFlow,
    "listSystemOperationLogs",
    ()=>listSystemOperationLogs,
    "listTaskDeveloper",
    ()=>listTaskDeveloper,
    "listUserAgentAudio",
    ()=>listUserAgentAudio,
    "listUserAgentImage",
    ()=>listUserAgentImage,
    "listVideoLogs",
    ()=>listVideoLogs,
    "listZhsActivity",
    ()=>listZhsActivity,
    "listZhsAgent",
    ()=>listZhsAgent,
    "listZhsIdentity",
    ()=>listZhsIdentity,
    "listZhsUser",
    ()=>listZhsUser,
    "ossFileToBase64",
    ()=>ossFileToBase64,
    "restoreAdminCourse",
    ()=>restoreAdminCourse,
    "testAiModelConfig",
    ()=>testAiModelConfig,
    "updateAdminCourse",
    ()=>updateAdminCourse,
    "updateAdminOauthApp",
    ()=>updateAdminOauthApp,
    "updateAdminOauthAppStatus",
    ()=>updateAdminOauthAppStatus,
    "updateAiGc",
    ()=>updateAiGc,
    "updateAiModelConfig",
    ()=>updateAiModelConfig,
    "updateCarousel",
    ()=>updateCarousel,
    "updateDeveloperCoze",
    ()=>updateDeveloperCoze,
    "updateDeveloperCozeStatus",
    ()=>updateDeveloperCozeStatus,
    "updateIdentityProportion",
    ()=>updateIdentityProportion,
    "updateLearnHomework",
    ()=>updateLearnHomework,
    "updateMonitorAlert",
    ()=>updateMonitorAlert,
    "updateMonitorAlertRule",
    ()=>updateMonitorAlertRule,
    "updateMonitoringLog",
    ()=>updateMonitoringLog,
    "updateNewsInformation",
    ()=>updateNewsInformation,
    "updateShopWithdrawalFlow",
    ()=>updateShopWithdrawalFlow,
    "updateTaskDeveloper",
    ()=>updateTaskDeveloper,
    "updateUserAgentImage",
    ()=>updateUserAgentImage,
    "updateZhsActivity",
    ()=>updateZhsActivity,
    "updateZhsIdentity",
    ()=>updateZhsIdentity,
    "upsertSystemConfig",
    ()=>upsertSystemConfig
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function listAiGc(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/ai-gc${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function addAiGc(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/ai-gc', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAiGc(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/ai-gc/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delAiGc(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/ai-gc/${id}`, {
        method: 'DELETE'
    });
}
async function listCarousel(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/carousel${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function addCarousel(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/carousel', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateCarousel(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/carousel/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delCarousel(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/carousel/${id}`, {
        method: 'DELETE'
    });
}
async function listAdminComments(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/comments${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getAdminComment(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/comments/${id}`);
}
async function delAdminComment(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/comments/${id}`, {
        method: 'DELETE'
    });
}
async function listCommentLogs(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/comment-logs${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function delCommentLog(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/comment-logs/${id}`, {
        method: 'DELETE'
    });
}
async function listVideoLogs(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/video-logs${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function delVideoLog(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/video-logs/${id}`, {
        method: 'DELETE'
    });
}
async function listDeveloperLink(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/developer-link${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function delDeveloperLink(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/developer-link/${id}`, {
        method: 'DELETE'
    });
}
async function listIdentityProportion(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/identity-proportion${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function addIdentityProportion(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/identity-proportion', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateIdentityProportion(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/identity-proportion/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delIdentityProportion(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/identity-proportion/${id}`, {
        method: 'DELETE'
    });
}
async function listOssFiles(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/oss/files${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function deleteOssFile(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/oss/files/${id}`, {
        method: 'DELETE'
    });
}
async function batchDeleteOssFiles(ids) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/oss/files/batch-delete`, {
        method: 'POST',
        body: JSON.stringify({
            ids
        })
    });
}
async function ossFileToBase64(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/oss/files/${id}/base64`);
}
async function listMonitorAlerts(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/monitor/alerts${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getMonitorAlert(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/monitor/alerts/${id}`);
}
async function addMonitorAlert(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/monitor/alerts', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateMonitorAlert(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/monitor/alerts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delMonitorAlert(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/monitor/alerts/${id}`, {
        method: 'DELETE'
    });
}
async function listMonitorAlertRules(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/monitor/alert-rules${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getMonitorAlertRule(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/monitor/alert-rules/${id}`);
}
async function addMonitorAlertRule(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/monitor/alert-rules', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateMonitorAlertRule(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/monitor/alert-rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delMonitorAlertRule(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/monitor/alert-rules/${id}`, {
        method: 'DELETE'
    });
}
async function listMonitoringLogs(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/monitoring/logs${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getMonitoringLog(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/monitoring/logs/${id}`);
}
async function addMonitoringLog(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/monitoring/logs', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateMonitoringLog(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/monitoring/logs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delMonitoringLog(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/monitoring/logs/${id}`, {
        method: 'DELETE'
    });
}
async function listAiModelConfig(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/ai-model-config${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getAiModelConfig(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/ai-model-config/${id}`);
}
async function addAiModelConfig(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/ai-model-config', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAiModelConfig(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/ai-model-config/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delAiModelConfig(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/ai-model-config/${id}`, {
        method: 'DELETE'
    });
}
async function testAiModelConfig(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/ai-model-config/${id}/test`, {
        method: 'POST'
    });
}
async function listShopWithdrawalFlow(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/shop/withdrawal-flow${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function addShopWithdrawalFlow(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/shop/withdrawal-flow', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateShopWithdrawalFlow(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/shop/withdrawal-flow/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delShopWithdrawalFlow(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/shop/withdrawal-flow/${id}`, {
        method: 'DELETE'
    });
}
async function upsertSystemConfig(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/configs', {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function listAdminCourses(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/courses${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getAdminCourse(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/courses/${id}`);
}
async function addAdminCourse(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/courses', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAdminCourse(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/courses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delAdminCourse(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/courses/${id}`, {
        method: 'DELETE'
    });
}
async function getAdminCourseTemp(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/courses/temp/${id}`);
}
async function restoreAdminCourse(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/courses/${id}/restore`, {
        method: 'POST'
    });
}
async function getCourseVideo(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/course-videos/${id}`);
}
async function getCourseVideoTemp(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/course-videos/temp/${id}`);
}
async function listLearnHomework(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/learn/homework${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function addLearnHomework(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/learn/homework', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateLearnHomework(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/learn/homework/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delLearnHomework(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/learn/homework/${id}`, {
        method: 'DELETE'
    });
}
async function listDeveloperCoze(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/developer/coze${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function addDeveloperCoze(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/developer/coze', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateDeveloperCoze(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/developer/coze/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delDeveloperCoze(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/developer/coze/${id}`, {
        method: 'DELETE'
    });
}
async function updateDeveloperCozeStatus(id, status) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/developer/coze/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
            status
        })
    });
}
async function listAdminOauthApps(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/oauth/apps${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function addAdminOauthApp(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/oauth/apps', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAdminOauthApp(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/oauth/apps/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delAdminOauthApp(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/oauth/apps/${id}`, {
        method: 'DELETE'
    });
}
async function updateAdminOauthAppStatus(id, status) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/oauth/apps/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
            status
        })
    });
}
async function listSystemOperationLogs(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/system/operation-logs${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function delSystemOperationLog(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/system/operation-logs/${id}`, {
        method: 'DELETE'
    });
}
async function listTaskDeveloper(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/task-developer${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function addTaskDeveloper(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/task-developer', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateTaskDeveloper(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/task-developer/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delTaskDeveloper(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/task-developer/${id}`, {
        method: 'DELETE'
    });
}
async function listUserAgentAudio(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/user-agent-audio${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function delUserAgentAudio(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/user-agent-audio/${id}`, {
        method: 'DELETE'
    });
}
async function listUserAgentImage(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/user-agent-image${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getUserAgentImage(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/user-agent-image/${id}`);
}
async function addUserAgentImage(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/user-agent-image', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateUserAgentImage(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/user-agent-image/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delUserAgentImage(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/user-agent-image/${id}`, {
        method: 'DELETE'
    });
}
async function listNewsInformation(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/news/information${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function addNewsInformation(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/news/information', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateNewsInformation(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/news/information/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delNewsInformation(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/news/information/${id}`, {
        method: 'DELETE'
    });
}
async function listZhsActivity(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/zhs-activity${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function addZhsActivity(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/zhs-activity', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateZhsActivity(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/zhs-activity/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delZhsActivity(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/zhs-activity/${id}`, {
        method: 'DELETE'
    });
}
async function listZhsAgent(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/zhs-agent${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function delZhsAgent(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/zhs-agent/${id}`, {
        method: 'DELETE'
    });
}
async function listZhsIdentity(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/zhs-identity${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function addZhsIdentity(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/zhs-identity', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateZhsIdentity(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/zhs-identity/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delZhsIdentity(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/zhs-identity/${id}`, {
        method: 'DELETE'
    });
}
async function listZhsUser(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/zhs-user${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function delZhsUser(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/zhs-user/${id}`, {
        method: 'DELETE'
    });
}
}),
"[project]/packages/api-client/src/endpoints/admin-member.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 会员管理 API
 * 对接后端 apps/api/src/routes/admin/member-users.ts / member-permissions.ts / admin.ts,
 * 覆盖会员用户、会员权限、管理员用户/项目/统计、旧项目 ai/users 模块�? */ __turbopack_context__.s([
    "addAdminProject",
    ()=>addAdminProject,
    "addAdminUser",
    ()=>addAdminUser,
    "addAiUser",
    ()=>addAiUser,
    "addAiUserSysLink",
    ()=>addAiUserSysLink,
    "addMemberPermission",
    ()=>addMemberPermission,
    "addMemberUser",
    ()=>addMemberUser,
    "batchUploadMember",
    ()=>batchUploadMember,
    "delAdminProject",
    ()=>delAdminProject,
    "delAdminUser",
    ()=>delAdminUser,
    "delAiUser",
    ()=>delAiUser,
    "delMemberPermission",
    ()=>delMemberPermission,
    "delMemberUser",
    ()=>delMemberUser,
    "excelUploadMember",
    ()=>excelUploadMember,
    "getAdminProject",
    ()=>getAdminProject,
    "getAdminStats",
    ()=>getAdminStats,
    "getAdminUser",
    ()=>getAdminUser,
    "getAiUser",
    ()=>getAiUser,
    "getCourseUser",
    ()=>getCourseUser,
    "getMemberUser",
    ()=>getMemberUser,
    "listAdminProjects",
    ()=>listAdminProjects,
    "listAdminUsers",
    ()=>listAdminUsers,
    "listAiUsers",
    ()=>listAiUsers,
    "listMemberPermissions",
    ()=>listMemberPermissions,
    "listMemberUsers",
    ()=>listMemberUsers,
    "updateAdminProject",
    ()=>updateAdminProject,
    "updateAdminUser",
    ()=>updateAdminUser,
    "updateAiUser",
    ()=>updateAiUser,
    "updateAiUserIdentity",
    ()=>updateAiUserIdentity,
    "updateMemberPermission",
    ()=>updateMemberPermission,
    "updateMemberUser",
    ()=>updateMemberUser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function listMemberUsers(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/member/users${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getMemberUser(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/member/users/${id}`);
}
async function addMemberUser(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/member/users', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateMemberUser(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/member/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
}
async function delMemberUser(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/member/users/${id}`, {
        method: 'DELETE'
    });
}
async function listMemberPermissions(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/member/permissions${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function addMemberPermission(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/member/permissions', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateMemberPermission(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/member/permissions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delMemberPermission(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/member/permissions/${id}`, {
        method: 'DELETE'
    });
}
async function getAdminStats() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/stats');
}
async function listAdminUsers(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/users${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAdminUser(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/users/${id}`);
}
async function addAdminUser(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAdminUser(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
}
async function delAdminUser(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/users/${id}`, {
        method: 'DELETE'
    });
}
async function listAdminProjects(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/projects${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAdminProject(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/projects/${id}`);
}
async function addAdminProject(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/projects', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAdminProject(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
}
async function delAdminProject(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/projects/${id}`, {
        method: 'DELETE'
    });
}
async function listAiUsers(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/ai/users/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAiUser(uuid) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/ai/users/${uuid}`);
}
async function addAiUser(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/ai/users', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAiUser(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/ai/users', {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delAiUser(uuid) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/ai/users/${uuid}`, {
        method: 'DELETE'
    });
}
async function updateAiUserIdentity(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/ai/users/set/user/identity', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function getCourseUser(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/ai/users/platform/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function addAiUserSysLink(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/ai/userSysLink', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function batchUploadMember(members) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/members/batch-upload', {
        method: 'POST',
        body: JSON.stringify({
            members
        })
    });
}
async function excelUploadMember(file) {
    const form = new FormData();
    form.append('file', file);
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/members/import/excel', {
        method: 'POST',
        body: form
    });
}
}),
"[project]/packages/api-client/src/endpoints/admin-monitor.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 监控管理 API
 * 对接后端 schedule.ts / admin-sys.ts(job/job_log/online) / admin-extended.ts(online-users),
 * 覆盖定时任务、任务日志、RuoYi 定时任务、在线用户模块 */ __turbopack_context__.s([
    "addAdminScheduleTask",
    ()=>addAdminScheduleTask,
    "addJob",
    ()=>addJob,
    "addScheduleTask",
    ()=>addScheduleTask,
    "changeJobStatus",
    ()=>changeJobStatus,
    "cleanJobLogs",
    ()=>cleanJobLogs,
    "completeScheduleTask",
    ()=>completeScheduleTask,
    "delAdminScheduleTask",
    ()=>delAdminScheduleTask,
    "delJobs",
    ()=>delJobs,
    "delScheduleTask",
    ()=>delScheduleTask,
    "disableScheduleTask",
    ()=>disableScheduleTask,
    "enableScheduleTask",
    ()=>enableScheduleTask,
    "forceLogoutOnlineUser",
    ()=>forceLogoutOnlineUser,
    "forceLogoutSession",
    ()=>forceLogoutSession,
    "getJob",
    ()=>getJob,
    "getScheduleLog",
    ()=>getScheduleLog,
    "getScheduleTask",
    ()=>getScheduleTask,
    "listJobLogs",
    ()=>listJobLogs,
    "listJobs",
    ()=>listJobs,
    "listOnlineSessions",
    ()=>listOnlineSessions,
    "listOnlineUsers",
    ()=>listOnlineUsers,
    "listScheduleLogs",
    ()=>listScheduleLogs,
    "listScheduleTasks",
    ()=>listScheduleTasks,
    "runJob",
    ()=>runJob,
    "runScheduleTask",
    ()=>runScheduleTask,
    "updateAdminScheduleTask",
    ()=>updateAdminScheduleTask,
    "updateJob",
    ()=>updateJob,
    "updateScheduleTask",
    ()=>updateScheduleTask
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function listScheduleTasks(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/schedule/tasks${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getScheduleTask(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/schedule/tasks/${id}`);
}
async function listScheduleLogs(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/schedule/logs${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getScheduleLog(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/schedule/logs/${id}`);
}
async function addScheduleTask(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/schedule', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateScheduleTask(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/schedule/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delScheduleTask(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/schedule/${id}`, {
        method: 'DELETE'
    });
}
async function completeScheduleTask(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/schedule/${id}/complete`, {
        method: 'POST'
    });
}
async function addAdminScheduleTask(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/schedule/tasks', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateAdminScheduleTask(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/schedule/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delAdminScheduleTask(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/schedule/tasks/${id}`, {
        method: 'DELETE'
    });
}
async function enableScheduleTask(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/schedule/tasks/${id}/enable`, {
        method: 'PUT'
    });
}
async function disableScheduleTask(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/schedule/tasks/${id}/disable`, {
        method: 'PUT'
    });
}
async function runScheduleTask(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/schedule/tasks/${id}/run`, {
        method: 'PUT'
    });
}
async function listJobs(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/job/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getJob(jobId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/job/${jobId}`);
}
async function addJob(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/job', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateJob(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/job', {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function changeJobStatus(jobId, status) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/job/changeStatus', {
        method: 'PUT',
        body: JSON.stringify({
            jobId,
            status
        })
    });
}
async function runJob(jobId, jobGroup) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/job/run', {
        method: 'PUT',
        body: JSON.stringify({
            jobId,
            jobGroup
        })
    });
}
async function delJobs(jobIds) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/job/${jobIds}`, {
        method: 'DELETE'
    });
}
async function listJobLogs(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/job/log/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function cleanJobLogs() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/job/log/clean', {
        method: 'DELETE'
    });
}
async function listOnlineSessions() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/online/list');
}
async function forceLogoutSession(tokenId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/online/${tokenId}`, {
        method: 'DELETE'
    });
}
async function listOnlineUsers(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/online-users${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function forceLogoutOnlineUser(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/online-users/${id}/force-logout`, {
        method: 'POST'
    });
}
}),
"[project]/packages/api-client/src/endpoints/admin-system.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * B 端系统管API
 * 对接后端 admin-sys.ts / rbac.ts / admin.ts,覆盖 user/role/menu/dept/config/post/notice/dict/logininfor/operlog 模块 */ __turbopack_context__.s([
    "addConfig",
    ()=>addConfig,
    "addDept",
    ()=>addDept,
    "addDictData",
    ()=>addDictData,
    "addDictType",
    ()=>addDictType,
    "addMenu",
    ()=>addMenu,
    "addNotice",
    ()=>addNotice,
    "addPost",
    ()=>addPost,
    "addRole",
    ()=>addRole,
    "addUser",
    ()=>addUser,
    "allocatedUserList",
    ()=>allocatedUserList,
    "authUserCancel",
    ()=>authUserCancel,
    "authUserCancelAll",
    ()=>authUserCancelAll,
    "authUserSelectAll",
    ()=>authUserSelectAll,
    "changeRoleStatus",
    ()=>changeRoleStatus,
    "changeUserStatus",
    ()=>changeUserStatus,
    "cleanLogininfor",
    ()=>cleanLogininfor,
    "cleanOperlog",
    ()=>cleanOperlog,
    "dataScope",
    ()=>dataScope,
    "delConfig",
    ()=>delConfig,
    "delDept",
    ()=>delDept,
    "delDictData",
    ()=>delDictData,
    "delDictType",
    ()=>delDictType,
    "delLogininfor",
    ()=>delLogininfor,
    "delMenu",
    ()=>delMenu,
    "delNotice",
    ()=>delNotice,
    "delOperlog",
    ()=>delOperlog,
    "delPost",
    ()=>delPost,
    "delRole",
    ()=>delRole,
    "delUser",
    ()=>delUser,
    "deleteCirclePost",
    ()=>deleteCirclePost,
    "deptTreeSelect",
    ()=>deptTreeSelect,
    "getAuthRole",
    ()=>getAuthRole,
    "getConfig",
    ()=>getConfig,
    "getConfigKey",
    ()=>getConfigKey,
    "getDept",
    ()=>getDept,
    "getDictData",
    ()=>getDictData,
    "getDictType",
    ()=>getDictType,
    "getDicts",
    ()=>getDicts,
    "getMenu",
    ()=>getMenu,
    "getNotice",
    ()=>getNotice,
    "getPost",
    ()=>getPost,
    "getRole",
    ()=>getRole,
    "getUser",
    ()=>getUser,
    "getUserProfile",
    ()=>getUserProfile,
    "listCirclePosts",
    ()=>listCirclePosts,
    "listConfig",
    ()=>listConfig,
    "listDept",
    ()=>listDept,
    "listDeptExcludeChild",
    ()=>listDeptExcludeChild,
    "listDictData",
    ()=>listDictData,
    "listDictType",
    ()=>listDictType,
    "listLogininfor",
    ()=>listLogininfor,
    "listMenu",
    ()=>listMenu,
    "listNotice",
    ()=>listNotice,
    "listOperlog",
    ()=>listOperlog,
    "listPost",
    ()=>listPost,
    "listRole",
    ()=>listRole,
    "listUsers",
    ()=>listUsers,
    "menuTreeselect",
    ()=>menuTreeselect,
    "optionselectDictType",
    ()=>optionselectDictType,
    "refreshConfigCache",
    ()=>refreshConfigCache,
    "refreshDictCache",
    ()=>refreshDictCache,
    "resetUserPwd",
    ()=>resetUserPwd,
    "roleDeptTreeSelect",
    ()=>roleDeptTreeSelect,
    "roleMenuTreeselect",
    ()=>roleMenuTreeselect,
    "unallocatedUserList",
    ()=>unallocatedUserList,
    "unlockLogininfor",
    ()=>unlockLogininfor,
    "updateAuthRole",
    ()=>updateAuthRole,
    "updateConfig",
    ()=>updateConfig,
    "updateDept",
    ()=>updateDept,
    "updateDictData",
    ()=>updateDictData,
    "updateDictType",
    ()=>updateDictType,
    "updateMenu",
    ()=>updateMenu,
    "updateNotice",
    ()=>updateNotice,
    "updatePost",
    ()=>updatePost,
    "updateRole",
    ()=>updateRole,
    "updateUser",
    ()=>updateUser,
    "updateUserProfile",
    ()=>updateUserProfile,
    "updateUserPwd",
    ()=>updateUserPwd,
    "uploadAvatar",
    ()=>uploadAvatar
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function listUsers(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/users${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getUser(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/users/${id}`);
}
async function addUser(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateUser(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
}
async function delUser(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/users/${id}`, {
        method: 'DELETE'
    });
}
async function resetUserPwd(userId, password) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/users/resetPwd', {
        method: 'PUT',
        body: JSON.stringify({
            userId,
            password
        })
    });
}
async function changeUserStatus(userId, status) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({
            status
        })
    });
}
async function getUserProfile() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/profile');
}
async function updateUserProfile(data) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}
async function updateUserPwd(oldPassword, newPassword) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/profile/password', {
        method: 'PUT',
        body: JSON.stringify({
            oldPassword,
            newPassword
        })
    });
}
async function uploadAvatar(data) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/users/avatar', {
        method: 'POST',
        body: data
    });
}
async function getAuthRole(userId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/users/${userId}/roles`);
}
async function updateAuthRole(userId, roleId, scopeResourceId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/users/${userId}/roles`, {
        method: 'POST',
        body: JSON.stringify({
            roleId,
            scopeResourceId
        })
    });
}
async function deptTreeSelect() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/dept/list');
}
async function listRole(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/roles${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getRole(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/roles/${id}`);
}
async function addRole(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/roles', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateRole(id, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/roles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
}
async function dataScope(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/role/dataScope', {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function changeRoleStatus(roleId, status) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/role/changeStatus', {
        method: 'PUT',
        body: JSON.stringify({
            roleId,
            status
        })
    });
}
async function delRole(roleId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/role/${roleId}`, {
        method: 'DELETE'
    });
}
async function allocatedUserList(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/role/authUser/allocatedList${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function unallocatedUserList(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/role/authUser/unallocatedList${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function authUserCancel(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/role/authUser/cancel', {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function authUserCancelAll(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/role/authUser/cancelAll${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`, {
        method: 'PUT'
    });
}
async function authUserSelectAll(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/role/authUser/selectAll${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`, {
        method: 'PUT'
    });
}
async function roleDeptTreeSelect(roleId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/role/deptTree/${roleId}`);
}
async function listMenu(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/sys-menu/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getMenu(menuId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/sys-menu/${menuId}`);
}
async function menuTreeselect() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/sys-menu/treeselect');
}
async function roleMenuTreeselect(roleId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/sys-menu/roleMenuTreeselect/${roleId}`);
}
async function addMenu(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/sys-menu', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateMenu(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/sys-menu', {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delMenu(menuId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/sys-menu/${menuId}`, {
        method: 'DELETE'
    });
}
async function listDept(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/dept/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function listDeptExcludeChild(deptId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/dept/list/exclude/${deptId}`);
}
async function getDept(deptId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/dept/${deptId}`);
}
async function addDept(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/dept', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateDept(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/dept', {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delDept(deptId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/dept/${deptId}`, {
        method: 'DELETE'
    });
}
async function listConfig(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/config/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getConfig(configId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/config/${configId}`);
}
async function getConfigKey(configKey) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/config/configKey/${configKey}`);
}
async function addConfig(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/config', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateConfig(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/config', {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delConfig(configIds) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/config/${configIds}`, {
        method: 'DELETE'
    });
}
async function refreshConfigCache() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/config/refreshCache', {
        method: 'DELETE'
    });
}
async function listPost(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/post/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getPost(postId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/post/${postId}`);
}
async function addPost(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/post', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updatePost(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/post', {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delPost(postIds) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/post/${postIds}`, {
        method: 'DELETE'
    });
}
async function listNotice(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/notice/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getNotice(noticeId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/notice/${noticeId}`);
}
async function addNotice(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/notice', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateNotice(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/notice', {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delNotice(noticeIds) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/notice/${noticeIds}`, {
        method: 'DELETE'
    });
}
async function listDictType(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/dict/type/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getDictType(dictId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/dict/type/${dictId}`);
}
async function addDictType(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/dict/type', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateDictType(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/dict/type', {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delDictType(dictIds) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/dict/type/${dictIds}`, {
        method: 'DELETE'
    });
}
async function refreshDictCache() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/dict/type/refreshCache', {
        method: 'DELETE'
    });
}
async function optionselectDictType() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/dict/type/optionselect');
}
async function listDictData(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/dict/data/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function getDictData(dictCode) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/dict/data/${dictCode}`);
}
async function getDicts(dictType) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/dict/data/type/${dictType}`);
}
async function addDictData(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/dict/data', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updateDictData(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/dict/data', {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function delDictData(dictCodes) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/dict/data/${dictCodes}`, {
        method: 'DELETE'
    });
}
async function listLogininfor(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/logininfor/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function delLogininfor(infoIds) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/logininfor/${infoIds}`, {
        method: 'DELETE'
    });
}
async function unlockLogininfor(userName) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/logininfor/unlock/${userName}`, {
        method: 'PUT'
    });
}
async function cleanLogininfor() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/logininfor/clean', {
        method: 'DELETE'
    });
}
async function listOperlog(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/operlog/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function delOperlog(operIds) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/operlog/${operIds}`, {
        method: 'DELETE'
    });
}
async function cleanOperlog() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/operlog/clean', {
        method: 'DELETE'
    });
}
async function listCirclePosts(params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/circles/posts${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(params)}`);
}
async function deleteCirclePost(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/circles/posts/${id}`, {
        method: 'DELETE'
    });
}
}),
"[project]/packages/api-client/src/endpoints/admin-tenants.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * P1-2.2 SaaS 部署层管理后台 — API 端点
 *
 * 调用链:web 端 → /api/admin-saas/* → Next.js Route Handler → admin-api /admin/api/*
 * 鉴权:由 Next.js middleware 注入 X-Admin-User,web 端无需关心
 */ __turbopack_context__.s([
    "adminBackupTenant",
    ()=>adminBackupTenant,
    "adminCreateTenant",
    ()=>adminCreateTenant,
    "adminDeleteBackup",
    ()=>adminDeleteBackup,
    "adminDeleteTenant",
    ()=>adminDeleteTenant,
    "adminGetCustomerMetrics",
    ()=>adminGetCustomerMetrics,
    "adminGetCustomerQuota",
    ()=>adminGetCustomerQuota,
    "adminGetMetricsSummary",
    ()=>adminGetMetricsSummary,
    "adminGetTenant",
    ()=>adminGetTenant,
    "adminListBackups",
    ()=>adminListBackups,
    "adminListCertificates",
    ()=>adminListCertificates,
    "adminListTenants",
    ()=>adminListTenants,
    "adminPauseTenant",
    ()=>adminPauseTenant,
    "adminRestoreTenant",
    ()=>adminRestoreTenant,
    "adminResumeTenant",
    ()=>adminResumeTenant
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
async function adminListTenants() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin-saas/customers');
}
async function adminGetTenant(slug) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin-saas/customers/${encodeURIComponent(slug)}`);
}
async function adminCreateTenant(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin-saas/customers', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function adminPauseTenant(slug) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin-saas/customers/${encodeURIComponent(slug)}/pause`, {
        method: 'POST'
    });
}
async function adminResumeTenant(slug) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin-saas/customers/${encodeURIComponent(slug)}/resume`, {
        method: 'POST'
    });
}
async function adminBackupTenant(slug) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin-saas/customers/${encodeURIComponent(slug)}/backup`, {
        method: 'POST'
    });
}
async function adminRestoreTenant(slug, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin-saas/customers/${encodeURIComponent(slug)}/restore`, {
        method: 'POST',
        body: JSON.stringify(body ?? {})
    });
}
async function adminDeleteTenant(slug) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin-saas/customers/${encodeURIComponent(slug)}`, {
        method: 'DELETE'
    });
}
async function adminListBackups(slug) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin-saas/customers/${encodeURIComponent(slug)}/backups`);
}
async function adminDeleteBackup(slug, timestamp) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin-saas/customers/${encodeURIComponent(slug)}/backups/${encodeURIComponent(timestamp)}`, {
        method: 'DELETE'
    });
}
async function adminListCertificates() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin-saas/certificates');
}
async function adminGetCustomerQuota(slug) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin-saas/customers/${encodeURIComponent(slug)}/quota`);
}
async function adminGetCustomerMetrics(slug) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin-saas/customers/${encodeURIComponent(slug)}/metrics`);
}
async function adminGetMetricsSummary() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin-saas/metrics/summary');
}
}),
"[project]/packages/api-client/src/endpoints/agent.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "batchDeleteAgentWithdrawals",
    ()=>batchDeleteAgentWithdrawals,
    "createAgentWithdrawal",
    ()=>createAgentWithdrawal,
    "deleteAgentWithdrawal",
    ()=>deleteAgentWithdrawal,
    "getAgentDetail",
    ()=>getAgentDetail,
    "getAgentPermission",
    ()=>getAgentPermission,
    "getAgentWithdrawal",
    ()=>getAgentWithdrawal,
    "getAgentWithdrawalStats",
    ()=>getAgentWithdrawalStats,
    "getAgentWithdrawalSummary",
    ()=>getAgentWithdrawalSummary,
    "getAgents",
    ()=>getAgents,
    "listAgentWithdrawals",
    ()=>listAgentWithdrawals,
    "processAgentWithdrawal",
    ()=>processAgentWithdrawal,
    "reviewAgentWithdrawal",
    ()=>reviewAgentWithdrawal,
    "updateAgentWithdrawal",
    ()=>updateAgentWithdrawal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getAgents(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/agents${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAgentDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/agents/${id}`);
}
const WITHDRAWAL_BASE = '/api/agent-ext/withdrawal';
async function listAgentWithdrawals(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`${WITHDRAWAL_BASE}/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAgentWithdrawalSummary(userId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`${WITHDRAWAL_BASE}/summary${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(userId ? {
        userId
    } : {})}`);
}
async function getAgentWithdrawalStats(userId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`${WITHDRAWAL_BASE}/stats/overview${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(userId ? {
        userId
    } : {})}`);
}
async function createAgentWithdrawal(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(WITHDRAWAL_BASE + '/create', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getAgentWithdrawal(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`${WITHDRAWAL_BASE}/${id}`);
}
async function updateAgentWithdrawal(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`${WITHDRAWAL_BASE}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteAgentWithdrawal(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`${WITHDRAWAL_BASE}/${id}`, {
        method: 'DELETE'
    });
}
async function reviewAgentWithdrawal(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`${WITHDRAWAL_BASE}/${id}/review`, {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function processAgentWithdrawal(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`${WITHDRAWAL_BASE}/${id}/process`, {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function batchDeleteAgentWithdrawals(ids) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`${WITHDRAWAL_BASE}/batch-delete`, {
        method: 'POST',
        body: JSON.stringify({
            ids
        })
    });
}
async function getAgentPermission(agentId, userId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/agent-ext/permission/${agentId}${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(userId ? {
        userId
    } : {})}`);
}
}),
"[project]/packages/api-client/src/endpoints/agent-runtime.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "callMCPTool",
    ()=>callMCPTool,
    "cancelAgent",
    ()=>cancelAgent,
    "cancelAgentRuntime",
    ()=>cancelAgentRuntime,
    "checkAgentRuntimePermission",
    ()=>checkAgentRuntimePermission,
    "executeAgent",
    ()=>executeAgent,
    "executeAgentRuntime",
    ()=>executeAgentRuntime,
    "executeAgentRuntimeStream",
    ()=>executeAgentRuntimeStream,
    "executeAgentStream",
    ()=>executeAgentStream,
    "executeSkill",
    ()=>executeSkill,
    "executeSlashCommand",
    ()=>executeSlashCommand,
    "getA2ATaskResult",
    ()=>getA2ATaskResult,
    "getA2ATaskStatus",
    ()=>getA2ATaskStatus,
    "getAgentRuntimeSession",
    ()=>getAgentRuntimeSession,
    "getAgentRuntimeStatus",
    ()=>getAgentRuntimeStatus,
    "getAgentSession",
    ()=>getAgentSession,
    "getAgentStatus",
    ()=>getAgentStatus,
    "getSkill",
    ()=>getSkill,
    "invokeMCPPrompt",
    ()=>invokeMCPPrompt,
    "listA2AAgents",
    ()=>listA2AAgents,
    "listAgentRuntimeSessions",
    ()=>listAgentRuntimeSessions,
    "listAgentSessions",
    ()=>listAgentSessions,
    "listMCPPrompts",
    ()=>listMCPPrompts,
    "listMCPResources",
    ()=>listMCPResources,
    "listMCPSkills",
    ()=>listMCPSkills,
    "listMCPTools",
    ()=>listMCPTools,
    "listSkills",
    ()=>listSkills,
    "listSlashCommands",
    ()=>listSlashCommands,
    "readMCPResource",
    ()=>readMCPResource,
    "registerA2AAgent",
    ()=>registerA2AAgent,
    "resumeAgentRuntimeSession",
    ()=>resumeAgentRuntimeSession,
    "resumeAgentSession",
    ()=>resumeAgentSession,
    "sendA2ATask",
    ()=>sendA2ATask
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
async function executeAgent(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])('/agents/execute', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function getAgentStatus(taskId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])(`/agents/${encodeURIComponent(taskId)}/status`);
}
async function cancelAgent(taskId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])(`/agents/${encodeURIComponent(taskId)}/cancel`, {
        method: 'POST'
    });
}
async function listAgentSessions() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])('/agents/sessions');
}
async function getAgentSession(sessionId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])(`/agents/sessions/${encodeURIComponent(sessionId)}/messages`);
}
async function resumeAgentSession(sessionId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])(`/agents/sessions/${encodeURIComponent(sessionId)}/resume`, {
        method: 'POST'
    });
}
async function sendA2ATask(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])('/a2a/tasks', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function getA2ATaskStatus(taskId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])(`/a2a/tasks/${encodeURIComponent(taskId)}/status`);
}
async function getA2ATaskResult(taskId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])(`/a2a/tasks/${encodeURIComponent(taskId)}/result`);
}
async function listA2AAgents() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])('/a2a/agents');
}
async function registerA2AAgent(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])('/a2a/agents/register', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function listMCPTools() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])('/mcp/tools');
}
async function callMCPTool(name, args = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])('/mcp/tools/call', {
        method: 'POST',
        body: JSON.stringify({
            name,
            arguments: args
        })
    });
}
async function listMCPSkills() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])('/mcp/skills');
}
async function listSlashCommands() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])('/mcp/slash-commands');
}
async function executeSlashCommand(command, args = []) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])('/mcp/slash-commands', {
        method: 'POST',
        body: JSON.stringify({
            command,
            args,
            ctx: {}
        })
    });
}
async function listSkills() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])('/mcp/skills');
}
async function getSkill(name) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])(`/mcp/skills/${encodeURIComponent(name)}`);
}
async function executeSkill(name, params = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])(`/mcp/skills/${encodeURIComponent(name)}/execute`, {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function listMCPResources() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])('/mcp/resources');
}
async function readMCPResource(uri) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])(`/mcp/resources/${encodeURI(uri)}`);
}
async function listMCPPrompts() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])('/mcp/prompts');
}
async function invokeMCPPrompt(name, args = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchAiServiceJson"])('/mcp/prompts/invoke', {
        method: 'POST',
        body: JSON.stringify({
            name,
            arguments: args
        })
    });
}
// ============================================================================
// SSE 流式执行(对应 AI-Service /agents/execute/stream)
// 因 client.ts 未导出 SSE 通用封装,此处使用 fetch 直连 + 显式 options。
// 多端调用方需通过 options.headers 传入 Authorization、options.baseUrl 传入网关地址。
// ============================================================================
function buildStreamUrl(path, baseUrl) {
    if (/^https?:\/\//i.test(path)) return path;
    const normalized = path.startsWith('/api/') ? path : path.startsWith('/') ? `/api${path}` : `/api/${path}`;
    return baseUrl ? `${baseUrl.replace(/\/$/, '')}${normalized}` : normalized;
}
function dispatchSSEEvent(event, callbacks) {
    callbacks.onEvent?.(event);
    const type = event.type;
    switch(type){
        case 'message':
            if (event.role === 'assistant' && typeof event.content === 'string') {
                callbacks.onDelta?.(event.content);
            }
            break;
        case 'summary':
            if (typeof event.content === 'string') {
                callbacks.onDelta?.(event.content);
            }
            break;
        case 'plan':
            callbacks.onPlanProposed?.({
                steps: Array.isArray(event.steps) ? event.steps.map(String) : []
            });
            break;
        case 'tool_call':
            callbacks.onToolCall?.({
                name: typeof event.name === 'string' ? event.name : String(event.name ?? ''),
                args: event.args ?? {}
            });
            break;
        case 'permission_request':
            callbacks.onPermissionRequest?.({
                tool_name: typeof event.tool_name === 'string' ? event.tool_name : '',
                args: event.args ?? {},
                request_id: typeof event.request_id === 'string' ? event.request_id : ''
            });
            break;
        case 'done':
            callbacks.onDone?.(event);
            break;
        case 'error':
            callbacks.onError?.(event.message || '未知错误');
            break;
        default:
            break;
    }
}
function parseSSEBlock(block, callbacks) {
    let dataStr = '';
    let eventType;
    for (const rawLine of block.split('\n')){
        const line = rawLine.replace(/\r$/, '');
        if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
            dataStr += line.slice(5).replace(/^\s/, '');
        }
    }
    if (!dataStr) return;
    let event;
    try {
        event = JSON.parse(dataStr);
    } catch  {
        return;
    }
    if (!event.type) event.type = eventType || 'message';
    dispatchSSEEvent(event, callbacks);
}
async function executeAgentStream(params, callbacks, options = {}) {
    const url = buildStreamUrl('/agents/execute/stream', options.baseUrl);
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...options.headers ?? {}
    };
    if (options.lastEventId) headers['Last-Event-ID'] = options.lastEventId;
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(params),
            signal: options.signal
        });
        if (!resp.ok || !resp.body) {
            const text = await resp.text().catch(()=>'');
            callbacks.onError?.(text || `请求失败(${resp.status})`);
            return;
        }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for(;;){
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, {
                stream: true
            });
            let boundary;
            while((boundary = buffer.indexOf('\n\n')) !== -1){
                const block = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);
                if (block.trim()) parseSSEBlock(block, callbacks);
            }
        }
        if (buffer.trim()) parseSSEBlock(buffer, callbacks);
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            callbacks.onDone?.({
                type: 'done'
            });
            return;
        }
        const message = err instanceof Error ? err.message : '网络异常';
        callbacks.onError?.(message);
    }
}
async function executeAgentRuntime(params) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/agent-runtime/execute', {
        method: 'POST',
        body: JSON.stringify(params)
    });
    if (!res.success) throw new Error(res.error);
    return res.data;
}
function parseAgentRuntimeSSEBlock(block, callbacks) {
    let eventName;
    let dataStr = '';
    for (const rawLine of block.split('\n')){
        const line = rawLine.replace(/\r$/, '');
        if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
            dataStr += line.slice(5).replace(/^\s/, '');
        }
    }
    if (!eventName || !dataStr) return;
    let data;
    try {
        data = JSON.parse(dataStr);
    } catch  {
        data = dataStr;
    }
    callbacks.onEvent?.(eventName, data);
    switch(eventName){
        case 'session':
            callbacks.onSession?.(data);
            break;
        case 'permission':
            callbacks.onPermission?.(data);
            break;
        case 'plan':
            callbacks.onPlan?.(data);
            break;
        case 'delta':
            callbacks.onDelta?.(data);
            break;
        case 'done':
            callbacks.onDone?.(data);
            break;
        case 'error':
            callbacks.onError?.(data);
            break;
    }
}
async function executeAgentRuntimeStream(params, callbacks, options = {}) {
    const url = buildStreamUrl('/agent-runtime/execute/stream', options.baseUrl);
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...options.headers ?? {}
    };
    if (options.lastEventId) headers['Last-Event-ID'] = options.lastEventId;
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(params),
            signal: options.signal
        });
        if (!resp.ok || !resp.body) {
            const text = await resp.text().catch(()=>'');
            callbacks.onError?.({
                message: text || `请求失败(${resp.status})`
            });
            return;
        }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for(;;){
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, {
                stream: true
            });
            let boundary;
            while((boundary = buffer.indexOf('\n\n')) !== -1){
                const block = buffer.slice(0, boundary);
                buffer = buffer.slice(boundary + 2);
                if (block.trim()) parseAgentRuntimeSSEBlock(block, callbacks);
            }
        }
        if (buffer.trim()) parseAgentRuntimeSSEBlock(buffer, callbacks);
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            callbacks.onDone?.({
                sessionId: '',
                status: 'aborted'
            });
            return;
        }
        const message = err instanceof Error ? err.message : '网络异常';
        callbacks.onError?.({
            message
        });
    }
}
async function listAgentRuntimeSessions(params) {
    const qs = new URLSearchParams();
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    if (params?.offset !== undefined) qs.set('offset', String(params.offset));
    const query = qs.toString();
    const url = query ? `/agent-runtime/sessions?${query}` : '/agent-runtime/sessions';
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(url);
    if (!res.success) throw new Error(res.error);
    return res.data;
}
async function getAgentRuntimeSession(sessionId) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/agent-runtime/sessions/${encodeURIComponent(sessionId)}`);
    if (!res.success) throw new Error(res.error);
    return res.data;
}
async function resumeAgentRuntimeSession(sessionId) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/agent-runtime/sessions/${encodeURIComponent(sessionId)}/resume`, {
        method: 'POST'
    });
    if (!res.success) throw new Error(res.error);
    return res.data;
}
async function getAgentRuntimeStatus(sessionId) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/agent-runtime/${encodeURIComponent(sessionId)}/status`);
    if (!res.success) throw new Error(res.error);
    return res.data;
}
async function cancelAgentRuntime(sessionId) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/agent-runtime/${encodeURIComponent(sessionId)}/cancel`, {
        method: 'POST'
    });
    if (!res.success) throw new Error(res.error);
    return res.data;
}
async function checkAgentRuntimePermission(params) {
    const qs = new URLSearchParams();
    qs.set('toolName', params.toolName);
    if (params.mode !== undefined) qs.set('mode', String(params.mode));
    if (params.dangerLevel !== undefined) qs.set('dangerLevel', String(params.dangerLevel));
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/agent-runtime/permission/check?${qs.toString()}`);
    if (!res.success) throw new Error(res.error);
    return res.data;
}
}),
"[project]/packages/api-client/src/endpoints/ai.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * AI 相关 API
 * 合并迁移自旧架构：ai-bot-sites, ai-career, ai-chat-types, ai-community,
 * ai-education, ai-feed, ai-index, ai-models, ai-proxy, ai-team, ai-world,
 * aiChat, aiModelInfo, aigc
 */ __turbopack_context__.s([
    "aiProxy",
    ()=>aiProxy,
    "cancelAigcTask",
    ()=>cancelAigcTask,
    "createAiBotSite",
    ()=>createAiBotSite,
    "createAiChatType",
    ()=>createAiChatType,
    "createAiCommunity",
    ()=>createAiCommunity,
    "createAiConversation",
    ()=>createAiConversation,
    "createAiModel",
    ()=>createAiModel,
    "createAiModelInfo",
    ()=>createAiModelInfo,
    "createAiTeam",
    ()=>createAiTeam,
    "createAigcTask",
    ()=>createAigcTask,
    "deleteAiBotSite",
    ()=>deleteAiBotSite,
    "deleteAiChatType",
    ()=>deleteAiChatType,
    "deleteAiConversation",
    ()=>deleteAiConversation,
    "deleteAiModel",
    ()=>deleteAiModel,
    "deleteAiModelInfo",
    ()=>deleteAiModelInfo,
    "deleteAiTeam",
    ()=>deleteAiTeam,
    "getAiBotSiteDetail",
    ()=>getAiBotSiteDetail,
    "getAiBotSites",
    ()=>getAiBotSites,
    "getAiCareerDetail",
    ()=>getAiCareerDetail,
    "getAiCareers",
    ()=>getAiCareers,
    "getAiChatHistory",
    ()=>getAiChatHistory,
    "getAiChatTypes",
    ()=>getAiChatTypes,
    "getAiCommunities",
    ()=>getAiCommunities,
    "getAiCommunityDetail",
    ()=>getAiCommunityDetail,
    "getAiConversations",
    ()=>getAiConversations,
    "getAiEducationDetail",
    ()=>getAiEducationDetail,
    "getAiEducations",
    ()=>getAiEducations,
    "getAiFeedDetail",
    ()=>getAiFeedDetail,
    "getAiFeeds",
    ()=>getAiFeeds,
    "getAiIndex",
    ()=>getAiIndex,
    "getAiModelDetail",
    ()=>getAiModelDetail,
    "getAiModelInfoDetail",
    ()=>getAiModelInfoDetail,
    "getAiModelInfoList",
    ()=>getAiModelInfoList,
    "getAiModels",
    ()=>getAiModels,
    "getAiTeamDetail",
    ()=>getAiTeamDetail,
    "getAiTeams",
    ()=>getAiTeams,
    "getAiWorldDetail",
    ()=>getAiWorldDetail,
    "getAiWorlds",
    ()=>getAiWorlds,
    "getAigcTask",
    ()=>getAigcTask,
    "getAigcTasks",
    ()=>getAigcTasks,
    "getCareerAdvice",
    ()=>getCareerAdvice,
    "sendAiChat",
    ()=>sendAiChat,
    "updateAiBotSite",
    ()=>updateAiBotSite,
    "updateAiChatType",
    ()=>updateAiChatType,
    "updateAiModel",
    ()=>updateAiModel,
    "updateAiModelInfo",
    ()=>updateAiModelInfo,
    "updateAiTeam",
    ()=>updateAiTeam
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getAiModels(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/models${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAiModelDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/models/${id}`);
}
async function createAiModel(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai/models', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateAiModel(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/models/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteAiModel(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/models/${id}`, {
        method: 'DELETE'
    });
}
async function getAiModelInfoList(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai-ext/model-info/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAiModelInfoDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai-ext/model-info/${id}`);
}
async function createAiModelInfo(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai-ext/model-info', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateAiModelInfo(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai-ext/model-info/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteAiModelInfo(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai-ext/model-info/${id}`, {
        method: 'DELETE'
    });
}
async function getAiBotSites(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/system-ext/bot-sites/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAiBotSiteDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/system-ext/bot-sites/${id}`);
}
async function createAiBotSite(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/system-ext/bot-sites', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateAiBotSite(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/system-ext/bot-sites/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteAiBotSite(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/system-ext/bot-sites/${id}`, {
        method: 'DELETE'
    });
}
async function getAiCareers(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/careers${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAiCareerDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/careers/${id}`);
}
async function getAiChatTypes(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/chat-types${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function createAiChatType(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai/chat-types', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateAiChatType(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/chat-types/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteAiChatType(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/chat-types/${id}`, {
        method: 'DELETE'
    });
}
async function getAiCommunities(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/community${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAiCommunityDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/community/${id}`);
}
async function createAiCommunity(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai/community', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getAiEducations(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai-education${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAiEducationDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai-education/${id}`);
}
async function getAiFeeds(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai-feed${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAiFeedDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai-feed/${id}`);
}
async function getAiIndex() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai/index');
}
async function getAiWorlds(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai-world${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAiWorldDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai-world/${id}`);
}
async function getAiTeams(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/team${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAiTeamDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/team/${id}`);
}
async function createAiTeam(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai/team', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateAiTeam(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/team/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteAiTeam(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/team/${id}`, {
        method: 'DELETE'
    });
}
async function aiProxy(url, params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(url, {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function sendAiChat(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getAiChatHistory(conversationId, query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/history${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        ...query,
        conversationId
    })}`);
}
async function createAiConversation(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai/chat/conversations', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getAiConversations(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/chat/conversations${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function deleteAiConversation(conversationId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/chat/conversations/${conversationId}`, {
        method: 'DELETE'
    });
}
async function createAigcTask(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai/aigc/records', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getAigcTask(taskId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/aigc/records/${taskId}`);
}
async function getAigcTasks(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/aigc/records${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function cancelAigcTask(taskId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/aigc/tasks/${taskId}/cancel`, {
        method: 'POST'
    });
}
async function getCareerAdvice(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai/career-advice', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
}),
"[project]/packages/api-client/src/endpoints/ai-media.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * AI 生成结果媒体提取工具：从各厂商差异化的响应结构中
 * 递归提取图片/视频/音频/模型 URL 与文本内容。
 */ __turbopack_context__.s([
    "extractMediaUrls",
    ()=>extractMediaUrls,
    "extractText",
    ()=>extractText,
    "getVoiceModels",
    ()=>getVoiceModels,
    "sendVoiceMessage",
    ()=>sendVoiceMessage,
    "speechToText",
    ()=>speechToText,
    "textToSpeech",
    ()=>textToSpeech
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
const HTTP_RE = /^https?:\/\//i;
const MEDIA_KEY_RE = /url|image|video|audio|download|result/i;
function isHttpUrl(value) {
    return typeof value === 'string' && HTTP_RE.test(value);
}
function extractMediaUrls(data) {
    const urls = new Set();
    const walk = (obj)=>{
        if (Array.isArray(obj)) {
            for (const item of obj)walk(item);
            return;
        }
        if (obj === null || typeof obj !== 'object') return;
        const record = obj;
        for (const [key, value] of Object.entries(record)){
            if (MEDIA_KEY_RE.test(key)) {
                if (isHttpUrl(value)) {
                    urls.add(value);
                } else if (Array.isArray(value)) {
                    for (const v of value)if (isHttpUrl(v)) urls.add(v);
                }
            }
            walk(value);
        }
    };
    walk(data);
    return [
        ...urls
    ];
}
function extractText(data) {
    if (typeof data === 'string') return data;
    if (data === null || typeof data !== 'object') return '';
    const obj = data;
    for (const key of [
        'text',
        'content',
        'reply',
        'answer',
        'description',
        'message'
    ]){
        const v = obj[key];
        if (typeof v === 'string' && v.trim()) return v;
    }
    const output = obj.output;
    if (output !== null && typeof output === 'object') {
        const out = output;
        const text = out.text;
        if (typeof text === 'string' && text.trim()) return text;
        const choices = out.choices;
        if (Array.isArray(choices) && choices.length > 0) {
            const first = choices[0];
            if (first !== null && typeof first === 'object') {
                const msg = first.message;
                if (msg !== null && typeof msg === 'object') {
                    const content = msg.content;
                    if (typeof content === 'string' && content.trim()) return content;
                }
            }
        }
    }
    const candidates = obj.candidates;
    if (Array.isArray(candidates) && candidates.length > 0) {
        const first = candidates[0];
        if (first !== null && typeof first === 'object') {
            const content = first.content;
            if (content !== null && typeof content === 'object') {
                const parts = content.parts;
                if (Array.isArray(parts)) {
                    for (const part of parts){
                        if (part !== null && typeof part === 'object') {
                            const text = part.text;
                            if (typeof text === 'string' && text.trim()) return text;
                        }
                    }
                }
            }
        }
    }
    return '';
}
async function sendVoiceMessage(audioBase64, format = 'mp3') {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai-audio/voice/chat', {
        method: 'POST',
        body: JSON.stringify({
            audio: audioBase64,
            format
        })
    });
}
async function textToSpeech(text, voice = 'default') {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai-audio/tts', {
        method: 'POST',
        body: JSON.stringify({
            text,
            voice
        })
    });
}
async function speechToText(audioBase64, format = 'mp3') {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai-audio/asr', {
        method: 'POST',
        body: JSON.stringify({
            audio: audioBase64,
            format
        })
    });
}
async function getVoiceModels() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai-audio/models');
}
}),
"[project]/packages/api-client/src/endpoints/auth.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "changePhone",
    ()=>changePhone,
    "dingtalkLogin",
    ()=>dingtalkLogin,
    "getDingtalkAuthUrl",
    ()=>getDingtalkAuthUrl,
    "getMe",
    ()=>getMe,
    "loginByAccount",
    ()=>loginByAccount,
    "loginByEmailCode",
    ()=>loginByEmailCode,
    "loginByPhone",
    ()=>loginByPhone,
    "loginBySms",
    ()=>loginBySms,
    "loginByUsername",
    ()=>loginByUsername,
    "loginByWechat",
    ()=>loginByWechat,
    "logout",
    ()=>logout,
    "refreshAccessToken",
    ()=>refreshAccessToken,
    "register",
    ()=>register,
    "registerByEmail",
    ()=>registerByEmail,
    "resetPassword",
    ()=>resetPassword,
    "sendChangePhoneNewCode",
    ()=>sendChangePhoneNewCode,
    "sendChangePhoneOldCode",
    ()=>sendChangePhoneOldCode,
    "sendCode",
    ()=>sendCode,
    "sendEmailCode",
    ()=>sendEmailCode,
    "sendSmsCode",
    ()=>sendSmsCode,
    "verifyChangePhoneOldCode",
    ()=>verifyChangePhoneOldCode,
    "wecomLogin",
    ()=>wecomLogin
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
async function loginByAccount(account, password, captcha) {
    const body = {
        account,
        password
    };
    if (captcha) body.captcha = captcha;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function loginByPhone(phone, password) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/login/password', {
        method: 'POST',
        body: JSON.stringify({
            phone,
            password
        })
    });
}
async function loginBySms(phone, code) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/login/sms', {
        method: 'POST',
        body: JSON.stringify({
            phone,
            code
        })
    });
}
async function loginByWechat(code) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/login/wechat', {
        method: 'POST',
        body: JSON.stringify({
            code
        })
    });
}
async function register(phone, password, code, invitationCode, account, captcha) {
    const body = {
        phone,
        password,
        code,
        invitationCode
    };
    if (account) body.account = account;
    if (captcha) body.captcha = captcha;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function logout(refreshToken) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({
            refreshToken
        })
    });
}
async function refreshAccessToken(refreshToken) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({
            refreshToken
        })
    });
}
async function sendSmsCode(phone, scene = 'login') {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/sms/send', {
        method: 'POST',
        body: JSON.stringify({
            phone,
            scene
        })
    });
}
async function getMe() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/me', {
        method: 'GET'
    });
}
async function sendChangePhoneOldCode() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/change-phone/send-old-code', {
        method: 'POST'
    });
}
async function verifyChangePhoneOldCode(code) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/change-phone/verify-old-code', {
        method: 'POST',
        body: JSON.stringify({
            code
        })
    });
}
async function sendChangePhoneNewCode(phone) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/change-phone/send-new-code', {
        method: 'POST',
        body: JSON.stringify({
            phone
        })
    });
}
async function changePhone(phone, code) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/change-phone/confirm', {
        method: 'POST',
        body: JSON.stringify({
            phone,
            code
        })
    });
}
async function getDingtalkAuthUrl() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/dingtalk/auth-url');
}
async function dingtalkLogin(code) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/auth/dingtalk/login?code=${encodeURIComponent(code)}`);
}
async function wecomLogin(code) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/auth/login/enterprise/pc/wxCode?code=${encodeURIComponent(code)}`);
}
async function loginByUsername(username, password) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/login/username', {
        method: 'POST',
        body: JSON.stringify({
            username,
            password
        })
    });
}
async function sendCode(method, target, scene = 'login') {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/send-code', {
        method: 'POST',
        body: JSON.stringify({
            [method]: target,
            scene
        })
    });
}
async function resetPassword(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function sendEmailCode(email, scene = 'register') {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/email/code', {
        method: 'POST',
        body: JSON.stringify({
            email,
            scene
        })
    });
}
async function loginByEmailCode(email, code) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/login/email', {
        method: 'POST',
        body: JSON.stringify({
            email,
            code
        })
    });
}
async function registerByEmail(email, code, password) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/register/email', {
        method: 'POST',
        body: JSON.stringify({
            email,
            code,
            password
        })
    });
}
}),
"[project]/packages/api-client/src/endpoints/banner.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Banner 跨端共享类型
 *
 * 从 apps/miniapp-taro/src/api/index.ts 下沉,供 web/miniapp-taro/mobile-rn 等端复用。
 * 字段对齐 miniapp-taro 原始定义,后端 GET /content/banner/list 返回。
 */ __turbopack_context__.s([]);
;
}),
"[project]/packages/api-client/src/endpoints/business.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 业务相关 API
 * 合并迁移自旧架构：checkin, ranking, tools, plaza, fund, trader, stock, groups, miniprogram, product-identity
 */ __turbopack_context__.s([
    "createCheckin",
    ()=>createCheckin,
    "createCheckinRecord",
    ()=>createCheckinRecord,
    "createGroup",
    ()=>createGroup,
    "createMiniprogram",
    ()=>createMiniprogram,
    "createPlaza",
    ()=>createPlaza,
    "createProductIdentity",
    ()=>createProductIdentity,
    "createTool",
    ()=>createTool,
    "deleteCheckin",
    ()=>deleteCheckin,
    "deleteCheckinRecord",
    ()=>deleteCheckinRecord,
    "deleteGroup",
    ()=>deleteGroup,
    "deleteMiniprogram",
    ()=>deleteMiniprogram,
    "deletePlaza",
    ()=>deletePlaza,
    "deleteProductIdentity",
    ()=>deleteProductIdentity,
    "deleteTool",
    ()=>deleteTool,
    "followTrader",
    ()=>followTrader,
    "getCheckinDetail",
    ()=>getCheckinDetail,
    "getCheckinList",
    ()=>getCheckinList,
    "getCheckinRecordDetail",
    ()=>getCheckinRecordDetail,
    "getCheckinRecords",
    ()=>getCheckinRecords,
    "getFundDetail",
    ()=>getFundDetail,
    "getFundNetValueHistory",
    ()=>getFundNetValueHistory,
    "getFunds",
    ()=>getFunds,
    "getGroupDetail",
    ()=>getGroupDetail,
    "getGroups",
    ()=>getGroups,
    "getMiniprogramDetail",
    ()=>getMiniprogramDetail,
    "getMiniprograms",
    ()=>getMiniprograms,
    "getPlazaDetail",
    ()=>getPlazaDetail,
    "getPlazaList",
    ()=>getPlazaList,
    "getProductIdentityDetail",
    ()=>getProductIdentityDetail,
    "getProductIdentityList",
    ()=>getProductIdentityList,
    "getRanking",
    ()=>getRanking,
    "getStockDetail",
    ()=>getStockDetail,
    "getStockQuote",
    ()=>getStockQuote,
    "getStocks",
    ()=>getStocks,
    "getToolDetail",
    ()=>getToolDetail,
    "getTools",
    ()=>getTools,
    "getTraderDetail",
    ()=>getTraderDetail,
    "getTraders",
    ()=>getTraders,
    "getUserRanking",
    ()=>getUserRanking,
    "joinGroup",
    ()=>joinGroup,
    "leaveGroup",
    ()=>leaveGroup,
    "unfollowTrader",
    ()=>unfollowTrader,
    "updateCheckin",
    ()=>updateCheckin,
    "updateCheckinRecord",
    ()=>updateCheckinRecord,
    "updateGroup",
    ()=>updateGroup,
    "updateMiniprogram",
    ()=>updateMiniprogram,
    "updatePlaza",
    ()=>updatePlaza,
    "updateProductIdentity",
    ()=>updateProductIdentity,
    "updateTool",
    ()=>updateTool,
    "verifyProductIdentity",
    ()=>verifyProductIdentity
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getCheckinList(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/checkin/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getCheckinDetail(cid) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/checkin/${cid}`);
}
async function createCheckin(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/checkin', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateCheckin(cid, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/checkin/${cid}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteCheckin(cid) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/checkin/${cid}`, {
        method: 'DELETE'
    });
}
async function getCheckinRecords(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/checkin/record/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getCheckinRecordDetail(rid) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/checkin/record/${rid}`);
}
async function createCheckinRecord(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/checkin/record', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateCheckinRecord(rid, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/checkin/record/${rid}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteCheckinRecord(rid) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/checkin/record/${rid}`, {
        method: 'DELETE'
    });
}
async function getRanking(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ranking${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getUserRanking(type) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ranking/me${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(type ? {
        type
    } : {})}`);
}
async function getTools(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/tools${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getToolDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/tools/${id}`);
}
async function createTool(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/tools', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateTool(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/tools/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteTool(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/tools/${id}`, {
        method: 'DELETE'
    });
}
async function getPlazaList(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/plaza${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getPlazaDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/plaza/${id}`);
}
async function createPlaza(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/plaza', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updatePlaza(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/plaza/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deletePlaza(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/plaza/${id}`, {
        method: 'DELETE'
    });
}
async function getFunds(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/fund${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getFundDetail(code) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/fund/${code}`);
}
async function getFundNetValueHistory(code, query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/fund/${code}/history${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getTraders(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/trader${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getTraderDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/trader/${id}`);
}
async function followTrader(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/trader/${id}/follow`, {
        method: 'POST'
    });
}
async function unfollowTrader(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/trader/${id}/unfollow`, {
        method: 'POST'
    });
}
async function getStocks(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/stock${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getStockDetail(code) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/stock/${code}`);
}
async function getStockQuote(code) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/stock/${code}/quote`);
}
async function getGroups(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/groups${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getGroupDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/groups/${id}`);
}
async function createGroup(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/groups', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateGroup(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/groups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input)
    });
}
async function deleteGroup(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/groups/${id}`, {
        method: 'DELETE'
    });
}
async function joinGroup(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/groups/${id}/join`, {
        method: 'POST'
    });
}
async function leaveGroup(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/groups/${id}/leave`, {
        method: 'POST'
    });
}
async function getMiniprograms(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/miniprogram${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getMiniprogramDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/miniprogram/${id}`);
}
async function createMiniprogram(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/miniprogram', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateMiniprogram(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/miniprogram/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteMiniprogram(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/miniprogram/${id}`, {
        method: 'DELETE'
    });
}
async function getProductIdentityList(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/product-identity${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getProductIdentityDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/product-identity/${id}`);
}
async function createProductIdentity(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/product-identity', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateProductIdentity(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/product-identity/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input)
    });
}
async function deleteProductIdentity(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/product-identity/${id}`, {
        method: 'DELETE'
    });
}
async function verifyProductIdentity(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/product-identity/verify', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
}),
"[project]/packages/api-client/src/endpoints/system.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 系统相关 API
 * 合并迁移自旧架构：app-version, behavior, category, monitor, settings, statistics, visit
 */ __turbopack_context__.s([
    "cancelAccountDeletion",
    ()=>cancelAccountDeletion,
    "checkAppVersion",
    ()=>checkAppVersion,
    "clearAllData",
    ()=>clearAllData,
    "createAppVersion",
    ()=>createAppVersion,
    "createCategory",
    ()=>createCategory,
    "deleteAccount",
    ()=>deleteAccount,
    "deleteAppVersion",
    ()=>deleteAppVersion,
    "deleteCategory",
    ()=>deleteCategory,
    "exportUserData",
    ()=>exportUserData,
    "getAccountDeletionStatus",
    ()=>getAccountDeletionStatus,
    "getAppVersions",
    ()=>getAppVersions,
    "getBehaviors",
    ()=>getBehaviors,
    "getCategories",
    ()=>getCategories,
    "getCategoryDetail",
    ()=>getCategoryDetail,
    "getCategoryTree",
    ()=>getCategoryTree,
    "getLatestVersion",
    ()=>getLatestVersion,
    "getLoginDevices",
    ()=>getLoginDevices,
    "getMonitorMetrics",
    ()=>getMonitorMetrics,
    "getMonitorStatus",
    ()=>getMonitorStatus,
    "getOrderStatistics",
    ()=>getOrderStatistics,
    "getSecurityLogs",
    ()=>getSecurityLogs,
    "getServicesHealth",
    ()=>getServicesHealth,
    "getStatistics",
    ()=>getStatistics,
    "getUserSettings",
    ()=>getUserSettings,
    "getUserStatistics",
    ()=>getUserStatistics,
    "getVisitStatistics",
    ()=>getVisitStatistics,
    "getVisitStats",
    ()=>getVisitStats,
    "getVisits",
    ()=>getVisits,
    "recordBehavior",
    ()=>recordBehavior,
    "recordVisit",
    ()=>recordVisit,
    "removeLoginDevice",
    ()=>removeLoginDevice,
    "updateAppVersion",
    ()=>updateAppVersion,
    "updateCategory",
    ()=>updateCategory,
    "updateNotificationSettings",
    ()=>updateNotificationSettings,
    "updatePreferences",
    ()=>updatePreferences,
    "updatePrivacySettings",
    ()=>updatePrivacySettings,
    "updateUserSettings",
    ()=>updateUserSettings
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function checkAppVersion(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/app-version/check-update${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(input)}`);
}
async function getAppVersions(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/app-version${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getLatestVersion(platform) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/app-version/latest${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        platform
    })}`);
}
async function createAppVersion(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/app-version', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateAppVersion(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/app-version/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteAppVersion(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/app-version/${id}`, {
        method: 'DELETE'
    });
}
async function recordBehavior(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/behavior', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getBehaviors(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/behavior${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getCategories(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/categories${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getCategoryTree(type) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/categories/tree${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(type ? {
        type
    } : {})}`);
}
async function getCategoryDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/categories/${id}`);
}
async function createCategory(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/categories', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateCategory(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteCategory(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/categories/${id}`, {
        method: 'DELETE'
    });
}
async function getMonitorStatus() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/monitor/status');
}
async function getMonitorMetrics(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/monitor/metrics${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getServicesHealth() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/monitor/services');
}
async function getUserSettings() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/settings');
}
async function updateUserSettings(data) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}
async function updateNotificationSettings(data) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/settings/notifications', {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}
async function updatePrivacySettings(data) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/settings/privacy', {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}
async function updatePreferences(data) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/settings/preferences', {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}
async function getLoginDevices() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/settings/devices');
}
async function removeLoginDevice(deviceId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/settings/devices/${deviceId}`, {
        method: 'DELETE'
    });
}
async function getSecurityLogs(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/settings/security-logs${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function exportUserData() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/settings/export', {
        method: 'POST'
    });
}
async function clearAllData() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/settings/clear-data', {
        method: 'POST'
    });
}
async function deleteAccount(password, reason) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/settings/delete-account', {
        method: 'POST',
        body: JSON.stringify({
            password,
            reason
        })
    });
}
async function getAccountDeletionStatus() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/settings/delete-account/status');
}
async function cancelAccountDeletion() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/settings/delete-account/cancel', {
        method: 'POST'
    });
}
async function getStatistics(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/statistics${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getUserStatistics(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/statistics/users${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getVisitStatistics(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/statistics/visits${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getOrderStatistics(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/statistics/orders${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function recordVisit(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/visit-tracking/page/record', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getVisits(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/visit-tracking/page/record${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getVisitStats(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/visit-tracking/stats${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
}),
"[project]/packages/api-client/src/endpoints/course.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "completeLesson",
    ()=>completeLesson,
    "enrollCourse",
    ()=>enrollCourse,
    "getCategories",
    ()=>getCategories,
    "getCourseById",
    ()=>getCourseById,
    "getCourses",
    ()=>getCourses,
    "getMyCourses",
    ()=>getMyCourses,
    "getProgress",
    ()=>getProgress
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getCourses(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/course${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getCourseById(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/course/${encodeURIComponent(id)}`);
}
async function getCategories() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/course/categories');
}
async function enrollCourse(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/course/${encodeURIComponent(id)}/enroll`, {
        method: 'POST'
    });
}
async function getProgress(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/course/${encodeURIComponent(id)}/progress`);
}
async function completeLesson(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/course/lesson-complete', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getMyCourses(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/course/my${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
}),
"[project]/packages/api-client/src/endpoints/category.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "clearCategoryCache",
    ()=>clearCategoryCache,
    "getAllCategories",
    ()=>getAllCategories,
    "getCategoryTreeByType",
    ()=>getCategoryTreeByType
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$system$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/system.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$course$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/course.ts [app-ssr] (ecmascript)");
;
;
;
;
const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map();
async function getAllCategories(types = [
    'lesson',
    'live',
    'article',
    'ask',
    'circle',
    'resource',
    'exam',
    'news'
], forceRefresh = false) {
    const now = Date.now();
    const result = {};
    await Promise.all(types.map(async (type)=>{
        const cached = cache.get(type);
        if (!forceRefresh && cached && now - cached.ts < CACHE_TTL) {
            result[type] = cached.data;
            return;
        }
        const res = type === 'lesson' ? await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$course$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getCategories"])() : await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$system$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getCategories"])({
            type
        });
        const list = res.success ? res.data : [];
        cache.set(type, {
            data: list,
            ts: now
        });
        result[type] = list;
    }));
    return result;
}
async function getCategoryTreeByType(type, forceRefresh = false) {
    const cached = cache.get(type);
    if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL) {
        return {
            success: true,
            data: cached.data
        };
    }
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/categories/tree${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        type
    })}`);
    if (res.success && res.data) {
        cache.set(type, {
            data: res.data,
            ts: Date.now()
        });
    }
    return res;
}
function clearCategoryCache(type) {
    if (type) {
        cache.delete(type);
    } else {
        cache.clear();
    }
}
}),
"[project]/packages/api-client/src/endpoints/chat.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "archiveConversation",
    ()=>archiveConversation,
    "batchOperateConversations",
    ()=>batchOperateConversations,
    "clearMessages",
    ()=>clearMessages,
    "compressConversation",
    ()=>compressConversation,
    "createConversation",
    ()=>createConversation,
    "deleteConversation",
    ()=>deleteConversation,
    "exportConversation",
    ()=>exportConversation,
    "getConversation",
    ()=>getConversation,
    "getMessages",
    ()=>getMessages,
    "persistQuestion",
    ()=>persistQuestion,
    "sendMessage",
    ()=>sendMessage,
    "unarchiveConversation",
    ()=>unarchiveConversation
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
function createConversation(input = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/chat/conversations', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
function getConversation(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/chat/conversations/${encodeURIComponent(id)}`);
}
function getMessages(id, params = {}) {
    const qs = new URLSearchParams();
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 20));
    if (params.before) qs.set('before', params.before);
    if (params.after) qs.set('after', params.after);
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/chat/conversations/${encodeURIComponent(id)}/messages?${qs.toString()}`);
}
function sendMessage(id, content, role = 'user', metadata) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/chat/conversations/${encodeURIComponent(id)}/messages`, {
        method: 'POST',
        body: JSON.stringify(metadata ? {
            content,
            role,
            metadata
        } : {
            content,
            role
        })
    });
}
function persistQuestion(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai/chat/questions', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
function deleteConversation(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/chat/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
}
function batchOperateConversations(action, ids) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/chat/conversations/batch', {
        method: 'POST',
        body: JSON.stringify({
            action,
            ids
        })
    });
}
function clearMessages(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/chat/conversations/${encodeURIComponent(id)}/clear`, {
        method: 'POST'
    });
}
function archiveConversation(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/chat/conversations/${encodeURIComponent(id)}/archive`, {
        method: 'POST'
    });
}
function unarchiveConversation(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/chat/conversations/${encodeURIComponent(id)}/archive`, {
        method: 'DELETE'
    });
}
function exportConversation(id, format = 'md') {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchText"])(`/api/chat/conversations/${encodeURIComponent(id)}/export?format=${format}`);
}
function compressConversation(id, targetChars) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/chat/conversations/${encodeURIComponent(id)}/compress`, {
        method: 'POST',
        body: JSON.stringify({
            targetChars
        })
    });
}
}),
"[project]/packages/api-client/src/endpoints/community.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "countMyAnswers",
    ()=>countMyAnswers,
    "countMyQuestions",
    ()=>countMyQuestions,
    "createAnswer",
    ()=>createAnswer,
    "createAsk",
    ()=>createAsk,
    "createCirclePost",
    ()=>createCirclePost,
    "deleteAnswer",
    ()=>deleteAnswer,
    "deleteAsk",
    ()=>deleteAsk,
    "getAnswers",
    ()=>getAnswers,
    "getAnswersByIds",
    ()=>getAnswersByIds,
    "getAskById",
    ()=>getAskById,
    "getAsks",
    ()=>getAsks,
    "getAsksByIds",
    ()=>getAsksByIds,
    "getCircleById",
    ()=>getCircleById,
    "getCircles",
    ()=>getCircles,
    "getLikeCounts",
    ()=>getLikeCounts,
    "getMyAnswers",
    ()=>getMyAnswers,
    "getMyAsks",
    ()=>getMyAsks,
    "getNews",
    ()=>getNews,
    "getNewsById",
    ()=>getNewsById,
    "getTopics",
    ()=>getTopics,
    "updateAnswer",
    ()=>updateAnswer,
    "updateAsk",
    ()=>updateAsk
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getCircles(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/circles${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getCircleById(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/circles/${encodeURIComponent(id)}`);
}
async function createCirclePost(circleId, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/circles/${encodeURIComponent(circleId)}/posts`, {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getAsks(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/asks${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAskById(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/asks/${encodeURIComponent(id)}`);
}
async function createAsk(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/asks', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateAsk(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/asks/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteAsk(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/asks/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
}
async function getAnswers(askId, query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/asks/${encodeURIComponent(askId)}/answers${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function createAnswer(askId, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/asks/${encodeURIComponent(askId)}/answers`, {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateAnswer(answerId, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/asks/answers/${encodeURIComponent(answerId)}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteAnswer(answerId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/asks/answers/${encodeURIComponent(answerId)}`, {
        method: 'DELETE'
    });
}
async function getMyAsks(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/asks/my${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getMyAnswers(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/asks/my/answers${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAsksByIds(ids) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/asks/by-ids${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        ids: ids.join(',')
    })}`);
}
async function getAnswersByIds(ids) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/asks/answers/by-ids${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        ids: ids.join(',')
    })}`);
}
async function countMyQuestions() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/asks/my/count');
}
async function countMyAnswers() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/asks/my/answers/count');
}
async function getTopics(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/topics${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getNews(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/news/articles${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getNewsById(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/news/articles/${encodeURIComponent(id)}`);
}
async function getLikeCounts(resourceType, resourceIds) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/behavior/likes/counts', {
        method: 'POST',
        body: JSON.stringify({
            resourceType,
            resourceIds
        })
    });
}
}),
"[project]/packages/api-client/src/endpoints/crew.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addCrewRunArtifact",
    ()=>addCrewRunArtifact,
    "checkCrewHealth",
    ()=>checkCrewHealth,
    "createCrewSession",
    ()=>createCrewSession,
    "getCrewRun",
    ()=>getCrewRun,
    "getCrewSession",
    ()=>getCrewSession,
    "listCrewAgents",
    ()=>listCrewAgents,
    "listCrewModels",
    ()=>listCrewModels,
    "listCrewRunArtifacts",
    ()=>listCrewRunArtifacts,
    "listCrewSessionMessages",
    ()=>listCrewSessionMessages,
    "listCrewSessionTasks",
    ()=>listCrewSessionTasks,
    "listCrewSessions",
    ()=>listCrewSessions,
    "runCrewSession",
    ()=>runCrewSession,
    "streamCrewRun",
    ()=>streamCrewRun
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
async function checkCrewHealth() {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/crew/health');
    if (!res.success) throw new Error(res.error || 'Crew 健康检查失败');
    return res.data;
}
async function listCrewAgents() {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/crew/agents');
    if (!res.success) throw new Error(res.error || '查询角色失败');
    return res.data;
}
async function listCrewModels() {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/crew/models');
    if (!res.success) throw new Error(res.error || '查询模型失败');
    return res.data;
}
async function createCrewSession(opts) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/crew/sessions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(opts)
    });
    if (!res.success) throw new Error(res.error || '创建会话失败');
    return res.data;
}
async function listCrewSessions(userId, limit) {
    const q = new URLSearchParams();
    if (userId) q.append('userId', userId);
    if (limit !== undefined) q.append('limit', String(limit));
    const qs = q.toString();
    const url = qs ? `/api/crew/sessions?${qs}` : '/api/crew/sessions';
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(url);
    if (!res.success) throw new Error(res.error || '查询会话列表失败');
    return res.data;
}
async function getCrewSession(id) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/crew/sessions/${id}`);
    if (!res.success) throw new Error(res.error || '查询会话失败');
    return res.data;
}
async function listCrewSessionTasks(id) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/crew/sessions/${id}/tasks`);
    if (!res.success) throw new Error(res.error || '查询任务失败');
    return res.data;
}
async function listCrewSessionMessages(id) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/crew/sessions/${id}/messages`);
    if (!res.success) throw new Error(res.error || '查询消息失败');
    return res.data;
}
async function runCrewSession(id) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/crew/sessions/${id}/runs`, {
        method: 'POST'
    });
    if (!res.success) throw new Error(res.error || '执行失败');
    return res.data;
}
async function getCrewRun(id) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/crew/runs/${id}`);
    if (!res.success) throw new Error(res.error || '查询运行失败');
    return res.data;
}
async function streamCrewRun(id) {
    // fetchApi 包装器对非 JSON 响应不友好,这里直接用原生 fetch + 共享 token
    const token = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getToken"])();
    const url = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizeUrlPublic"])(`/crew/runs/${id}/stream`);
    const resp = await fetch(url, {
        headers: token ? {
            Authorization: `Bearer ${token}`
        } : {}
    });
    if (!resp.ok) throw new Error(`SSE 启动失败: ${resp.status}`);
    return resp.body;
}
async function listCrewRunArtifacts(id) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/crew/runs/${id}/artifacts`);
    if (!res.success) throw new Error(res.error || '查询产物失败');
    return res.data;
}
async function addCrewRunArtifact(opts) {
    const { runId, ...body } = opts;
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/crew/runs/${runId}/artifacts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    if (!res.success) throw new Error(res.error || '保存产物失败');
    return res.data;
}
}),
"[project]/packages/api-client/src/endpoints/developer.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 开发者相API
 * 合并迁移自旧架构：developer, sdks, packages, webhooks, oauth-apps
 */ __turbopack_context__.s([
    "applyDeveloper",
    ()=>applyDeveloper,
    "auditDeveloper",
    ()=>auditDeveloper,
    "createOauthApp",
    ()=>createOauthApp,
    "createPackage",
    ()=>createPackage,
    "createSdk",
    ()=>createSdk,
    "createWebhook",
    ()=>createWebhook,
    "deleteOauthApp",
    ()=>deleteOauthApp,
    "deletePackage",
    ()=>deletePackage,
    "deleteSdk",
    ()=>deleteSdk,
    "deleteWebhook",
    ()=>deleteWebhook,
    "getDeveloperInfo",
    ()=>getDeveloperInfo,
    "getDeveloperPrice",
    ()=>getDeveloperPrice,
    "getDevelopers",
    ()=>getDevelopers,
    "getLatestSdk",
    ()=>getLatestSdk,
    "getMyAuthorizedApps",
    ()=>getMyAuthorizedApps,
    "getOauthAppDetail",
    ()=>getOauthAppDetail,
    "getOauthApps",
    ()=>getOauthApps,
    "getPackageDetail",
    ()=>getPackageDetail,
    "getPackages",
    ()=>getPackages,
    "getSdkDetail",
    ()=>getSdkDetail,
    "getSdkList",
    ()=>getSdkList,
    "getWebhookDeliveries",
    ()=>getWebhookDeliveries,
    "getWebhookDetail",
    ()=>getWebhookDetail,
    "getWebhooks",
    ()=>getWebhooks,
    "redeliverWebhook",
    ()=>redeliverWebhook,
    "regenerateOauthSecret",
    ()=>regenerateOauthSecret,
    "revokeAuthorization",
    ()=>revokeAuthorization,
    "testWebhook",
    ()=>testWebhook,
    "updateDeveloperInfo",
    ()=>updateDeveloperInfo,
    "updateOauthApp",
    ()=>updateOauthApp,
    "updatePackage",
    ()=>updatePackage,
    "updateSdk",
    ()=>updateSdk,
    "updateWebhook",
    ()=>updateWebhook
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getDeveloperInfo() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/developer/info');
}
async function getDeveloperPrice() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/developer/price');
}
async function applyDeveloper(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/developer/apply', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateDeveloperInfo(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/developer/info', {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function getDevelopers(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/developer${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function auditDeveloper(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/developer/${id}/audit`, {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getSdkList(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/sdks${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getSdkDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/sdks/${id}`);
}
async function getLatestSdk(platform) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/sdks/latest${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        platform
    })}`);
}
async function createSdk(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/sdks', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateSdk(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/sdks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input)
    });
}
async function deleteSdk(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/sdks/${id}`, {
        method: 'DELETE'
    });
}
async function getPackages(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/packages${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getPackageDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/packages/${id}`);
}
async function createPackage(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/packages', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updatePackage(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/packages/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input)
    });
}
async function deletePackage(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/packages/${id}`, {
        method: 'DELETE'
    });
}
async function getWebhooks(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/developer/webhooks${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getWebhookDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/developer/webhooks/${id}`);
}
async function createWebhook(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/developer/webhooks', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateWebhook(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/developer/webhooks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteWebhook(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/developer/webhooks/${id}`, {
        method: 'DELETE'
    });
}
async function testWebhook(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/developer/webhooks/${id}/test`, {
        method: 'POST'
    });
}
async function getWebhookDeliveries(id, query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/developer/webhooks/${id}/logs${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function redeliverWebhook(webhookId, deliveryId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/developer/webhooks/${webhookId}/retry`, {
        method: 'POST',
        body: JSON.stringify({
            deliveryId
        })
    });
}
async function getOauthApps(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/oauth-apps${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getOauthAppDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/oauth-apps/${id}`);
}
async function createOauthApp(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/oauth-apps', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateOauthApp(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/oauth-apps/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteOauthApp(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/oauth-apps/${id}`, {
        method: 'DELETE'
    });
}
async function regenerateOauthSecret(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/oauth-apps/${id}/regenerate-secret`, {
        method: 'POST'
    });
}
async function getMyAuthorizedApps(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/oauth-apps/my-authorized${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function revokeAuthorization(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/oauth-apps/authorizations/${id}`, {
        method: 'DELETE'
    });
}
}),
"[project]/packages/api-client/src/endpoints/browser.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 浏览器降级 API 端点(2026-07-22 立,P1 WorkPanel iframe 降级)
 *
 * 用于:
 *  - 前端 iframe 加载失败 → 探测是否可嵌入(/probe)
 *  - 不可嵌入 → 调截图 API 获取 base64(/screenshot)
 */ __turbopack_context__.s([
    "probeEmbed",
    ()=>probeEmbed,
    "takeScreenshot",
    ()=>takeScreenshot
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
async function takeScreenshot(req) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/browser/screenshot', {
        method: 'POST',
        body: JSON.stringify(req)
    });
}
async function probeEmbed(url) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/browser/probe', {
        method: 'POST',
        body: JSON.stringify({
            url
        })
    });
}
}),
"[project]/packages/api-client/src/endpoints/browser-hub.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Browser Hub CDP 端点(2026-07-31 立,P0 WorkPanel CDP 升级)
 *
 * 对标 Trae/Cursor 内置浏览器:后端持续 Chromium 实例 + CDP 画面流 + 事件回传。
 * 端点契约见 apps/ai-service/app/routers/browser_hub.py。
 *
 * 路由:/api/browser/sessions/*(Next.js dev 代理到 ai-service:8803)
 * WebSocket:/api/browser/ws/{sessionId}(前端直连 ai-service:8803,不走 Next.js rewrites)
 */ __turbopack_context__.s([
    "browserHubBack",
    ()=>browserHubBack,
    "browserHubForward",
    ()=>browserHubForward,
    "browserHubReload",
    ()=>browserHubReload,
    "buildBrowserWsUrl",
    ()=>buildBrowserWsUrl,
    "closeBrowserSession",
    ()=>closeBrowserSession,
    "createBrowserSession",
    ()=>createBrowserSession,
    "getBrowserCookies",
    ()=>getBrowserCookies,
    "getBrowserSessionInfo",
    ()=>getBrowserSessionInfo,
    "navigateBrowser",
    ()=>navigateBrowser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
async function createBrowserSession(req = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/browser/sessions', {
        method: 'POST',
        body: JSON.stringify(req)
    });
}
async function getBrowserSessionInfo(sessionId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/browser/sessions/${sessionId}`, {
        method: 'GET'
    });
}
async function closeBrowserSession(sessionId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/browser/sessions/${sessionId}`, {
        method: 'DELETE'
    });
}
async function navigateBrowser(sessionId, url, waitUntil = 'domcontentloaded') {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/browser/sessions/${sessionId}/navigate`, {
        method: 'POST',
        body: JSON.stringify({
            url,
            wait_until: waitUntil
        })
    });
}
async function getBrowserCookies(sessionId, urls) {
    const query = urls && urls.length > 0 ? `?urls=${encodeURIComponent(urls.join(','))}` : '';
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/browser/sessions/${sessionId}/cookies${query}`, {
        method: 'GET'
    });
}
async function browserHubBack(sessionId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/browser/sessions/${sessionId}/back`, {
        method: 'POST'
    });
}
async function browserHubForward(sessionId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/browser/sessions/${sessionId}/forward`, {
        method: 'POST'
    });
}
async function browserHubReload(sessionId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/browser/sessions/${sessionId}/reload`, {
        method: 'POST'
    });
}
function buildBrowserWsUrl(sessionId) {
    if (typeof window === 'undefined') {
        // SSR 防护:返回占位 URL,实际不应在 SSR 调用
        return `ws://localhost:8803/api/browser/ws/${sessionId}`;
    }
    if ("TURBOPACK compile-time truthy", 1) {
        return `ws://localhost:8803/api/browser/ws/${sessionId}`;
    }
    //TURBOPACK unreachable
    ;
    const proto = undefined;
}
}),
"[project]/packages/api-client/src/endpoints/distribution.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getCommissionList",
    ()=>getCommissionList,
    "getDayMonthSummary",
    ()=>getDayMonthSummary,
    "getInviteInfo",
    ()=>getInviteInfo,
    "getInvitedUsers",
    ()=>getInvitedUsers,
    "getOverview",
    ()=>getOverview,
    "getRanking",
    ()=>getRanking,
    "getWithdrawList",
    ()=>getWithdrawList,
    "requestWithdraw",
    ()=>requestWithdraw
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getOverview() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/distribution/overview');
}
async function getInviteInfo() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/distribution/invite-info');
}
async function getInvitedUsers(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/distribution/invited-users${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getCommissionList(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/distribution/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getWithdrawList(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/distribution/withdraw-list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function requestWithdraw(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/distribution/withdraw', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getRanking(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/distribution/ranking${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getDayMonthSummary() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/finance/commission/day-month-summary');
}
}),
"[project]/packages/api-client/src/endpoints/earnings.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getByokIncomeTrend",
    ()=>getByokIncomeTrend,
    "getConversionFunnel",
    ()=>getConversionFunnel,
    "getEarningsOverview",
    ()=>getEarningsOverview,
    "getReferralStats",
    ()=>getReferralStats
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
function getEarningsOverview() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/earnings/overview');
}
function getByokIncomeTrend(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/earnings/byok-trend${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
function getReferralStats() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/earnings/referral');
}
function getConversionFunnel() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/earnings/funnel');
}
}),
"[project]/packages/api-client/src/endpoints/edu.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 教育相关 API(2026-07-27 立)
 *
 * 当前仅封装"学习报告导出"端点(POST /api/edu/my-report/export):
 * - 响应可能是 JSON(StudentReportData)或二进制文件流(pdf / xlsx),
 *   不能走 fetchApi 的 JSON 协议路径(会因 code 字段缺失被判定失败);
 * - 这里复用 fetchApi 的 token 注入 + URL 规范化,但保留原生 fetch 返回 Response,
 *   让调用方自行根据 Content-Type 处理 blob 下载或 JSON 解析。
 *
 * 后端路由:apps/api/src/routes/edu-public.ts:605(POST /api/edu/my-report/export)
 */ __turbopack_context__.s([
    "exportMyReport",
    ()=>exportMyReport,
    "exportMyReportJson",
    ()=>exportMyReportJson
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
async function exportMyReport(config, init) {
    const token = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getToken"])();
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const url = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizeUrlPublic"])('/api/edu/my-report/export');
    return fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(config),
        credentials: 'include',
        signal: init?.signal
    });
}
async function exportMyReportJson(config) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/edu/my-report/export', {
        method: 'POST',
        body: JSON.stringify(config)
    });
}
}),
"[project]/packages/api-client/src/endpoints/exam.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cancelSignUp",
    ()=>cancelSignUp,
    "checkSubmitted",
    ()=>checkSubmitted,
    "getExamById",
    ()=>getExamById,
    "getExamChapters",
    ()=>getExamChapters,
    "getExams",
    ()=>getExams,
    "getExamsByIds",
    ()=>getExamsByIds,
    "getFavoriteExams",
    ()=>getFavoriteExams,
    "getHotExams",
    ()=>getHotExams,
    "getMyRecords",
    ()=>getMyRecords,
    "getMySignUps",
    ()=>getMySignUps,
    "getRecommendExams",
    ()=>getRecommendExams,
    "getResult",
    ()=>getResult,
    "getSignUp",
    ()=>getSignUp,
    "getWrongBook",
    ()=>getWrongBook,
    "saveSignUp",
    ()=>saveSignUp,
    "submitAnswer",
    ()=>submitAnswer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getExams(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/exam/papers${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getExamById(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/exam/papers/${encodeURIComponent(id)}/questions`);
}
async function submitAnswer(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/exam/papers/${encodeURIComponent(input.examId)}/submit-answers`, {
        method: 'POST',
        body: JSON.stringify({
            answers: input.answers
        })
    });
}
async function getResult(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/exam/records/${encodeURIComponent(id)}`);
}
async function getWrongBook(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/exam/wrong/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getExamChapters(examId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/exam/papers/${encodeURIComponent(examId)}/chapters`);
}
async function getSignUp(examId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/exam/composition/signup/${encodeURIComponent(examId)}`);
}
async function saveSignUp(examId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/exam/composition/signup`, {
        method: 'POST',
        body: JSON.stringify({
            eid: examId
        })
    });
}
async function cancelSignUp(examId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/exam/composition/signup/${encodeURIComponent(examId)}`, {
        method: 'DELETE'
    });
}
async function getMySignUps(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/exam/composition/signup/my${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getMyRecords(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/exam/records${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function checkSubmitted(examId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/exam/records/check-submitted${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        examId
    })}`);
}
async function getFavoriteExams(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/exam/papers${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        ...query,
        favorite: '1'
    })}`);
}
async function getRecommendExams(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/exam/papers${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        ...query,
        recommend: '1'
    })}`);
}
async function getHotExams(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/exam/papers${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        ...query,
        hot: '1'
    })}`);
}
async function getExamsByIds(ids) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/exam/papers/by-ids${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        ids: ids.join(',')
    })}`);
}
}),
"[project]/packages/api-client/src/endpoints/files.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 文件上传端点(跨端共享:web/mobile-rn/desktop/extension/miniapp-taro)
 *
 * 后端:`POST /api/files/upload/form` (multipart/form-data,字段名 file)
 * 响应:`{ code: 0, data: { file: { id, name, size, mimeType, path, uploadedBy } } }`
 *
 * 实现说明:不走 fetchApi,因为 transport.ts 的 TransportInit.body 类型为 string,
 * fetchOnce 会把 FormData body 转为 undefined。此处直接用 native fetch,
 * RN 与浏览器均原生支持 FormData + multipart 自动 boundary。
 */ __turbopack_context__.s([
    "resolveFileUrl",
    ()=>resolveFileUrl,
    "uploadFileMultipart",
    ()=>uploadFileMultipart
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
async function uploadFileMultipart(file) {
    try {
        const formData = new FormData();
        // RN FormData.append 接受 { uri, type, name } 对象;Web FormData.append 接受 File/Blob。
        // TS 标准库 FormData.append 签名不接受 RnFormDataFile,用 as never 绕过(RN 平台特性,非 any 兜底)。
        formData.append('file', file);
        const url = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizeUrlPublic"])('/api/files/upload/form');
        const token = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getToken"])();
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        // 不设置 Content-Type,让 fetch 自动生成 multipart boundary
        const resp = await fetch(url, {
            method: 'POST',
            headers,
            body: formData,
            credentials: 'include'
        });
        const json = await resp.json();
        if (!resp.ok) {
            return {
                success: false,
                error: json.message || `上传失败(${resp.status})`,
                status: resp.status
            };
        }
        if (json.code !== 0) {
            return {
                success: false,
                error: json.message || '上传失败',
                status: resp.status
            };
        }
        // 后端返回 { code: 0, data: { file: {...} } }
        const data = json.data;
        const fileData = data?.file;
        if (!fileData) {
            return {
                success: false,
                error: '上传响应缺少文件数据',
                status: resp.status
            };
        }
        return {
            success: true,
            data: fileData
        };
    } catch (e) {
        return {
            success: false,
            error: e instanceof Error ? e.message : '上传失败'
        };
    }
}
function resolveFileUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["normalizeUrlPublic"])(normalized);
}
}),
"[project]/packages/api-client/src/endpoints/learn.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 学习相关 API
 * 合并迁移自旧架构：learn, study, schedule, member
 */ __turbopack_context__.s([
    "completeSchedule",
    ()=>completeSchedule,
    "createLearnCourse",
    ()=>createLearnCourse,
    "createMemberLevel",
    ()=>createMemberLevel,
    "createSchedule",
    ()=>createSchedule,
    "deleteLearnCourse",
    ()=>deleteLearnCourse,
    "deleteMemberLevel",
    ()=>deleteMemberLevel,
    "deleteSchedule",
    ()=>deleteSchedule,
    "enrollLearnCourse",
    ()=>enrollLearnCourse,
    "getAllStudyProgress",
    ()=>getAllStudyProgress,
    "getHotLearnCourses",
    ()=>getHotLearnCourses,
    "getLearnCategoryParents",
    ()=>getLearnCategoryParents,
    "getLearnCourseDetail",
    ()=>getLearnCourseDetail,
    "getLearnCourses",
    ()=>getLearnCourses,
    "getMemberDetail",
    ()=>getMemberDetail,
    "getMemberLevelDetail",
    ()=>getMemberLevelDetail,
    "getMemberLevels",
    ()=>getMemberLevels,
    "getMembers",
    ()=>getMembers,
    "getMyLearnCourses",
    ()=>getMyLearnCourses,
    "getMyMemberInfo",
    ()=>getMyMemberInfo,
    "getRecommendLearnCourses",
    ()=>getRecommendLearnCourses,
    "getScheduleDetail",
    ()=>getScheduleDetail,
    "getSchedules",
    ()=>getSchedules,
    "getStudyProgress",
    ()=>getStudyProgress,
    "getStudyRecordDetail",
    ()=>getStudyRecordDetail,
    "getStudyRecords",
    ()=>getStudyRecords,
    "getStudyStatistics",
    ()=>getStudyStatistics,
    "recordStudy",
    ()=>recordStudy,
    "updateLearnCourse",
    ()=>updateLearnCourse,
    "updateMember",
    ()=>updateMember,
    "updateMemberLevel",
    ()=>updateMemberLevel,
    "updateSchedule",
    ()=>updateSchedule,
    "updateStudyProgress",
    ()=>updateStudyProgress
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getLearnCourses(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/learn/lessons${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getLearnCourseDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/learn/lessons/${id}`);
}
async function enrollLearnCourse(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/learn/lessons/${id}/sign-up`, {
        method: 'POST'
    });
}
async function getMyLearnCourses(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/learn/my-lessons${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function createLearnCourse(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/learn/lessons', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateLearnCourse(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/learn/lessons/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteLearnCourse(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/learn/lessons/${id}`, {
        method: 'DELETE'
    });
}
async function getRecommendLearnCourses(limit = 10) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/learn/recommend${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        limit
    })}`);
}
async function getHotLearnCourses(limit = 10) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/learn/hot${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        limit
    })}`);
}
async function getLearnCategoryParents(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/learn/categories/${id}/parents`);
}
async function getStudyRecords(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/study/records${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getStudyRecordDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/study/records/${id}`);
}
async function recordStudy(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/study/records', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateStudyProgress(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/study/records/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function getStudyProgress(courseId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/study/progress${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        courseId
    })}`);
}
async function getAllStudyProgress(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/study/progress/all${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getStudyStatistics(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/study/statistics${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getSchedules(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/schedule${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getScheduleDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/schedule/${id}`);
}
async function createSchedule(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/schedule', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateSchedule(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/schedule/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteSchedule(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/schedule/${id}`, {
        method: 'DELETE'
    });
}
async function completeSchedule(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/schedule/${id}/complete`, {
        method: 'POST'
    });
}
async function getMyMemberInfo() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/members/me');
}
async function getMembers(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/members${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getMemberDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/members/${id}`);
}
async function updateMember(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/members/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function getMemberLevels() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/members/levels');
}
async function getMemberLevelDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/members/levels/${id}`);
}
async function createMemberLevel(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/members/levels', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateMemberLevel(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/members/levels/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteMemberLevel(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/members/levels/${id}`, {
        method: 'DELETE'
    });
}
}),
"[project]/packages/api-client/src/endpoints/live.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getLiveById",
    ()=>getLiveById,
    "getLiveCalendar",
    ()=>getLiveCalendar,
    "getLiveHistory",
    ()=>getLiveHistory,
    "getLiveList",
    ()=>getLiveList,
    "subscribeLive",
    ()=>subscribeLive
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getLiveList(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/live/channels${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getLiveHistory(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/live/history${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getLiveById(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/live/channels/${encodeURIComponent(id)}`);
}
async function getLiveCalendar(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/live/calendar${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function subscribeLive(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/live/${encodeURIComponent(id)}/subscribe`, {
        method: 'POST'
    });
}
}),
"[project]/packages/api-client/src/endpoints/llm.js [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createCombo",
    ()=>createCombo,
    "deleteCombo",
    ()=>deleteCombo,
    "demoCompaction",
    ()=>demoCompaction,
    "fetchCombos",
    ()=>fetchCombos,
    "fetchModelSyncStatus",
    ()=>fetchModelSyncStatus,
    "fetchModels",
    ()=>fetchModels,
    "fetchProvidersAvailability",
    ()=>fetchProvidersAvailability,
    "fetchProvidersHealth",
    ()=>fetchProvidersHealth,
    "fetchProvidersHealthLite",
    ()=>fetchProvidersHealthLite,
    "triggerModelSync",
    ()=>triggerModelSync
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
async function fetchModels() {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/llm/models', {
        method: 'GET'
    });
    if (!res.success) {
        throw new Error(res.error || '获取模型列表失败');
    }
    return res.data;
}
async function fetchProvidersHealth() {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/llm/providers/health', {
        method: 'GET'
    });
    if (!res.success) {
        throw new Error(res.error || '获取 Provider 健康状态失败');
    }
    return res.data;
}
async function fetchCombos() {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/llm/combos', {
        method: 'GET'
    });
    if (!res.success) {
        throw new Error(res.error || '获取 Combo 链列表失败');
    }
    return res.data;
}
async function createCombo(input) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/llm/combos', {
        method: 'POST',
        body: JSON.stringify(input)
    });
    if (!res.success) {
        throw new Error(res.error || '创建 Combo 链失败');
    }
    return res.data;
}
async function deleteCombo(name) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/llm/combos/${encodeURIComponent(name)}`, {
        method: 'DELETE'
    });
    if (!res.success) {
        throw new Error(res.error || '删除 Combo 链失败');
    }
    return res.data;
}
async function demoCompaction(input) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/llm/compaction/demo', {
        method: 'POST',
        body: JSON.stringify(input)
    });
    if (!res.success) {
        throw new Error(res.error || 'Token 压缩演示失败');
    }
    return res.data;
}
async function fetchProvidersHealthLite() {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/llm/providers/health', {
        method: 'GET'
    });
    if (!res.success) {
        throw new Error(res.error || '获取 Provider 健康状态失败');
    }
    return res.data?.providers ?? [];
}
async function fetchProvidersAvailability() {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/llm/providers/availability', {
        method: 'GET'
    });
    if (!res.success) {
        throw new Error(res.error || '获取 Provider 可用性失败');
    }
    return res.data;
}
async function triggerModelSync() {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/llm/models/sync', {
        method: 'POST'
    });
    if (!res.success) {
        throw new Error(res.error || '触发模型同步失败');
    }
    return res.data;
}
async function fetchModelSyncStatus() {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/llm/models/sync/status', {
        method: 'GET'
    });
    if (!res.success) {
        throw new Error(res.error || '获取模型同步状态失败');
    }
    return res.data;
} //# sourceMappingURL=llm.js.map
}),
"[project]/packages/api-client/src/endpoints/knowledge-rag.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "batchDeleteKnowledgeDocs",
    ()=>batchDeleteKnowledgeDocs,
    "checkKnowledgeHealth",
    ()=>checkKnowledgeHealth,
    "deleteKnowledgeDoc",
    ()=>deleteKnowledgeDoc,
    "getKnowledgeDoc",
    ()=>getKnowledgeDoc,
    "getKnowledgeDocChunks",
    ()=>getKnowledgeDocChunks,
    "getKnowledgeRagContext",
    ()=>getKnowledgeRagContext,
    "ingestKnowledgeText",
    ()=>ingestKnowledgeText,
    "listKnowledgeDocs",
    ()=>listKnowledgeDocs,
    "searchKnowledge",
    ()=>searchKnowledge,
    "uploadKnowledgeDoc",
    ()=>uploadKnowledgeDoc
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
async function checkKnowledgeHealth() {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/knowledge/health');
    if (!res.success) throw new Error(res.error || '知识库健康检查失败');
    return res.data;
}
async function ingestKnowledgeText(opts) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/knowledge/ingest', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(opts)
    });
    if (!res.success) throw new Error(res.error || '入库失败');
    return res.data;
}
async function searchKnowledge(opts) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/knowledge/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(opts)
    });
    if (!res.success) throw new Error(res.error || '检索失败');
    return res.data;
}
async function getKnowledgeRagContext(opts) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/knowledge/rag-context', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(opts)
    });
    if (!res.success) throw new Error(res.error || '生成上下文失败');
    return res.data;
}
async function listKnowledgeDocs(ownerUuid) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/knowledge/docs?ownerUuid=${encodeURIComponent(ownerUuid)}`);
    if (!res.success) throw new Error(res.error || '查询文档列表失败');
    return res.data;
}
async function getKnowledgeDoc(docId, ownerUuid) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/knowledge/docs/${docId}?ownerUuid=${encodeURIComponent(ownerUuid)}`);
    if (!res.success) throw new Error(res.error || '查询文档失败');
    return res.data;
}
async function getKnowledgeDocChunks(docId, ownerUuid, limit) {
    const q = new URLSearchParams({
        ownerUuid
    });
    if (limit !== undefined) q.append('limit', String(limit));
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/knowledge/docs/${docId}/chunks?${q.toString()}`);
    if (!res.success) throw new Error(res.error || '查询切片失败');
    return res.data;
}
async function deleteKnowledgeDoc(docId, ownerUuid) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/knowledge/docs/${docId}?ownerUuid=${encodeURIComponent(ownerUuid)}`, {
        method: 'DELETE'
    });
    if (!res.success) throw new Error(res.error || '删除失败');
    return res.data;
}
async function uploadKnowledgeDoc(file, opts) {
    const form = new FormData();
    form.append('file', file, opts?.filename ?? (file instanceof File ? file.name : 'upload'));
    if (opts?.title) form.append('title', opts.title);
    if (opts?.collectionName) form.append('collectionName', opts.collectionName);
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/knowledge/upload', {
        method: 'POST',
        body: form
    });
    if (!res.success) throw new Error(res.error || '文件入库失败');
    return res.data;
}
async function batchDeleteKnowledgeDocs(docIds, ownerUuid) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/knowledge/docs/batch-delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            docIds,
            ownerUuid
        })
    });
    if (!res.success) throw new Error(res.error || '批量删除失败');
    return res.data;
}
}),
"[project]/packages/api-client/src/endpoints/member.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Member / VIP 会员相关跨端共享类型
 *
 * 从 apps/miniapp-taro/src/api/index.ts 下沉,供 web/miniapp-taro/mobile-rn 等端复用。
 * 包含:
 * - MemberInfo:会员信息(GET /member/info)
 * - VipPayInfo:VIP 支付参数(POST /vip/order 响应内的 payInfo)
 * - VipOrderResult:VIP 升级订单结果(POST /vip/order)
 *
 * 注:与 vip.ts 的 MembershipInfo 不同 — MembershipInfo 是后端 /vip/my 返回的当前会员状态,
 * VipPayInfo/VipOrderResult 是下单支付流程的类型。两者语义互补,不重复。
 */ __turbopack_context__.s([]);
;
}),
"[project]/packages/api-client/src/endpoints/misc.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 其他 API
 * 合并迁移自旧架构：mcp, openclaw, n8n, tbox, openrouter-proxy, coze
 */ __turbopack_context__.s([
    "cozeChat",
    ()=>cozeChat,
    "createCozeAgent",
    ()=>createCozeAgent,
    "createMcpProject",
    ()=>createMcpProject,
    "createN8nWorkflow",
    ()=>createN8nWorkflow,
    "createOpenclawResource",
    ()=>createOpenclawResource,
    "createTboxTool",
    ()=>createTboxTool,
    "deleteCozeAgent",
    ()=>deleteCozeAgent,
    "deleteMcpProject",
    ()=>deleteMcpProject,
    "deleteN8nWorkflow",
    ()=>deleteN8nWorkflow,
    "deleteOpenclawResource",
    ()=>deleteOpenclawResource,
    "deleteTboxTool",
    ()=>deleteTboxTool,
    "executeN8nWorkflow",
    ()=>executeN8nWorkflow,
    "getCozeAgentDetail",
    ()=>getCozeAgentDetail,
    "getCozeAgents",
    ()=>getCozeAgents,
    "getCozeChatHistory",
    ()=>getCozeChatHistory,
    "getMcpProjectDetail",
    ()=>getMcpProjectDetail,
    "getMcpProjects",
    ()=>getMcpProjects,
    "getN8nExecutionDetail",
    ()=>getN8nExecutionDetail,
    "getN8nExecutions",
    ()=>getN8nExecutions,
    "getN8nWorkflowDetail",
    ()=>getN8nWorkflowDetail,
    "getN8nWorkflows",
    ()=>getN8nWorkflows,
    "getOpenRouterModels",
    ()=>getOpenRouterModels,
    "getOpenclawResourceDetail",
    ()=>getOpenclawResourceDetail,
    "getOpenclawResources",
    ()=>getOpenclawResources,
    "getTboxToolDetail",
    ()=>getTboxToolDetail,
    "getTboxTools",
    ()=>getTboxTools,
    "invokeMcpTool",
    ()=>invokeMcpTool,
    "openRouterChatCompletions",
    ()=>openRouterChatCompletions,
    "toggleN8nWorkflow",
    ()=>toggleN8nWorkflow,
    "updateCozeAgent",
    ()=>updateCozeAgent,
    "updateMcpProject",
    ()=>updateMcpProject,
    "updateN8nWorkflow",
    ()=>updateN8nWorkflow,
    "updateOpenclawResource",
    ()=>updateOpenclawResource,
    "updateTboxTool",
    ()=>updateTboxTool
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getMcpProjects(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/mcp${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getMcpProjectDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/mcp/${id}`);
}
async function createMcpProject(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/mcp', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateMcpProject(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/mcp/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteMcpProject(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/mcp/${id}`, {
        method: 'DELETE'
    });
}
async function invokeMcpTool(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/mcp/invoke', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getOpenclawResources(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/openclaw${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getOpenclawResourceDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/openclaw/${id}`);
}
async function createOpenclawResource(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/openclaw', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateOpenclawResource(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/openclaw/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteOpenclawResource(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/openclaw/${id}`, {
        method: 'DELETE'
    });
}
async function getN8nWorkflows(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/n8n/workflows${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getN8nWorkflowDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/n8n/workflows/${id}`);
}
async function createN8nWorkflow(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai/n8n/workflows', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateN8nWorkflow(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/n8n/workflows/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteN8nWorkflow(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/n8n/workflows/${id}`, {
        method: 'DELETE'
    });
}
async function toggleN8nWorkflow(id, active) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/n8n/workflows/${id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({
            active
        })
    });
}
async function executeN8nWorkflow(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/n8n/workflows/${id}/execute`, {
        method: 'POST',
        body: JSON.stringify(input || {})
    });
}
async function getN8nExecutions(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/n8n/executions${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getN8nExecutionDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai/n8n/executions/${id}`);
}
async function getTboxTools(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/tbox${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getTboxToolDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/tbox/${id}`);
}
async function createTboxTool(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/tbox', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateTboxTool(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/tbox/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteTboxTool(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/tbox/${id}`, {
        method: 'DELETE'
    });
}
async function openRouterChatCompletions(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/openrouter-proxy/chat/completions', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function getOpenRouterModels() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/openrouter-proxy/models');
}
async function getCozeAgents(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/coze/bot/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getCozeAgentDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/coze/bot/get?bot_id=${encodeURIComponent(id)}`);
}
async function createCozeAgent(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/coze/bot/create', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateCozeAgent(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/coze/bot/update', {
        method: 'POST',
        body: JSON.stringify({
            ...input,
            bot_id: id
        })
    });
}
async function deleteCozeAgent(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/coze/bot/delete', {
        method: 'POST',
        body: JSON.stringify({
            bot_id: id
        })
    });
}
async function cozeChat(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai/coze/chat', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function getCozeChatHistory(botId, conversationId, query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/coze/chat/history/${botId}/${conversationId}${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
}),
"[project]/packages/api-client/src/endpoints/notification.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 通知相关 API
 * 合并迁移自旧架构：message, notification, customer-service
 *
 * 类型定义已下沉到 @ihui/types/notification.ts(跨端唯一类型源),
 * 此处仅 re-export 保持向后兼容,各端统一从 @ihui/types 或 @ihui/api-client 导入。
 */ __turbopack_context__.s([
    "closeCustomerServiceSession",
    ()=>closeCustomerServiceSession,
    "createCustomerServiceSession",
    ()=>createCustomerServiceSession,
    "createNotification",
    ()=>createNotification,
    "deleteMessage",
    ()=>deleteMessage,
    "deleteNotification",
    ()=>deleteNotification,
    "getCustomerServiceFaq",
    ()=>getCustomerServiceFaq,
    "getCustomerServiceMessages",
    ()=>getCustomerServiceMessages,
    "getCustomerServiceSessionDetail",
    ()=>getCustomerServiceSessionDetail,
    "getCustomerServiceSessions",
    ()=>getCustomerServiceSessions,
    "getMessageDetail",
    ()=>getMessageDetail,
    "getMessages",
    ()=>getMessages,
    "getNotificationDetail",
    ()=>getNotificationDetail,
    "getNotifications",
    ()=>getNotifications,
    "getUnreadCount",
    ()=>getUnreadCount,
    "markAllMessagesRead",
    ()=>markAllMessagesRead,
    "markAllNotificationsRead",
    ()=>markAllNotificationsRead,
    "markMessageRead",
    ()=>markMessageRead,
    "markNotificationRead",
    ()=>markNotificationRead,
    "sendCustomerServiceMessage",
    ()=>sendCustomerServiceMessage,
    "sendMessage",
    ()=>sendMessage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getMessages(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/messages${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getMessageDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/messages/${id}`);
}
async function sendMessage(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/messages', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function markMessageRead(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/messages/${id}/read`, {
        method: 'PUT'
    });
}
async function markAllMessagesRead() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/messages/read-all', {
        method: 'POST'
    });
}
async function deleteMessage(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/messages/${id}`, {
        method: 'DELETE'
    });
}
async function getNotifications(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/notifications${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getNotificationDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/notifications/${id}`);
}
async function createNotification(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/notifications', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function markNotificationRead(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/notifications/${id}/read`, {
        method: 'PATCH'
    });
}
async function markAllNotificationsRead() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/notifications/read-all', {
        method: 'POST'
    });
}
async function deleteNotification(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/notifications/${id}`, {
        method: 'DELETE'
    });
}
async function createCustomerServiceSession(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/customer-service/tickets', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getCustomerServiceSessions(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/customer-service/tickets${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getCustomerServiceSessionDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/customer-service/tickets/${id}`);
}
async function closeCustomerServiceSession(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/customer-service/tickets/${id}/close`, {
        method: 'POST'
    });
}
async function getCustomerServiceMessages(sessionId, query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/customer-service/tickets/${sessionId}/comments${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function sendCustomerServiceMessage(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/customer-service/tickets/${input.sessionId}/comments`, {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getCustomerServiceFaq(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/customer-service/faq${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getUnreadCount() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/notifications/unread-count');
}
}),
"[project]/packages/api-client/src/endpoints/order.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cancelOrder",
    ()=>cancelOrder,
    "createOrder",
    ()=>createOrder,
    "getOrderById",
    ()=>getOrderById,
    "getOrders",
    ()=>getOrders,
    "refundOrder",
    ()=>refundOrder
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getOrders(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/orders/me${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getOrderById(orderNo) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/orders/${encodeURIComponent(orderNo)}`);
}
async function createOrder(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/orders', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function cancelOrder(orderNo, reason) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/orders/${encodeURIComponent(orderNo)}/cancel`, {
        method: 'POST',
        body: JSON.stringify({
            reason
        })
    });
}
async function refundOrder(orderNo, reason) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/orders/${encodeURIComponent(orderNo)}/refund`, {
        method: 'POST',
        body: JSON.stringify({
            reason
        })
    });
}
}),
"[project]/packages/api-client/src/endpoints/payment.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 支付相关 API
 * 合并迁移自旧架构：ali-pay, payment, refund, top-up, withdrawal, invoice
 */ __turbopack_context__.s([
    "aliPayNotify",
    ()=>aliPayNotify,
    "aliPayReturn",
    ()=>aliPayReturn,
    "applyRefund",
    ()=>applyRefund,
    "approveWithdrawal",
    ()=>approveWithdrawal,
    "auditRefund",
    ()=>auditRefund,
    "cancelPaymentOrder",
    ()=>cancelPaymentOrder,
    "cancelRefund",
    ()=>cancelRefund,
    "checkPaymentStatus",
    ()=>checkPaymentStatus,
    "checkRefundStatus",
    ()=>checkRefundStatus,
    "createAliPay",
    ()=>createAliPay,
    "createAliPay2",
    ()=>createAliPay2,
    "createAlipayAppPayment",
    ()=>createAlipayAppPayment,
    "createAlipayMiniappPayment",
    ()=>createAlipayMiniappPayment,
    "createAlipayPagePayment",
    ()=>createAlipayPagePayment,
    "createTopUpOrder",
    ()=>createTopUpOrder,
    "createWechatAppPayment",
    ()=>createWechatAppPayment,
    "exchangeAlipayMiniappBuyerId",
    ()=>exchangeAlipayMiniappBuyerId,
    "generateInvoice",
    ()=>generateInvoice,
    "getAliPayFail",
    ()=>getAliPayFail,
    "getAliPaySuccess",
    ()=>getAliPaySuccess,
    "getInvoice",
    ()=>getInvoice,
    "getMyWithdrawalRecords",
    ()=>getMyWithdrawalRecords,
    "getPaymentOrderDetail",
    ()=>getPaymentOrderDetail,
    "getPaymentOrders",
    ()=>getPaymentOrders,
    "getRefundDetail",
    ()=>getRefundDetail,
    "getRefundList",
    ()=>getRefundList,
    "getTopUpRecords",
    ()=>getTopUpRecords,
    "getTopUpStatus",
    ()=>getTopUpStatus,
    "getWithdrawalDetail",
    ()=>getWithdrawalDetail,
    "getWithdrawalStatus",
    ()=>getWithdrawalStatus,
    "getWithdrawals",
    ()=>getWithdrawals,
    "processRefund",
    ()=>processRefund,
    "rejectWithdrawal",
    ()=>rejectWithdrawal,
    "requestWithdrawal",
    ()=>requestWithdrawal,
    "syncPaymentStatus",
    ()=>syncPaymentStatus,
    "verifyPaymentCallback",
    ()=>verifyPaymentCallback
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function checkPaymentStatus(orderNo) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payments/wechat/status/${orderNo}`);
}
async function cancelPaymentOrder(orderNo) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payment/order/${orderNo}/close`, {
        method: 'POST'
    });
}
async function syncPaymentStatus(orderNo) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payment/order/${orderNo}/sync`, {
        method: 'POST'
    });
}
async function verifyPaymentCallback(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/payment/callback/verify', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function getPaymentOrders(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payments/me${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getPaymentOrderDetail(orderNo) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payment/orders/${orderNo}`);
}
async function createWechatAppPayment(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payments/wechat/android/create${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        amount: params.amount,
        orderType: params.orderType,
        description: params.description
    })}`, {
        method: 'POST'
    });
}
async function createAlipayAppPayment(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payments/alipay/app/create${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        amount: params.amount,
        orderType: params.orderType,
        subject: params.subject
    })}`, {
        method: 'POST'
    });
}
async function createAlipayPagePayment(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payments/alipay/create${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        amount: params.amount,
        orderType: params.orderType,
        subject: params.subject,
        productId: params.productId
    })}`, {
        method: 'POST'
    });
}
async function exchangeAlipayMiniappBuyerId(authCode) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/payments/alipay/miniapp/exchange-buyer-id', {
        method: 'POST',
        body: JSON.stringify({
            authCode
        })
    });
}
async function createAlipayMiniappPayment(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payments/alipay/miniapp/create${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        amount: params.amount,
        orderType: params.orderType,
        subject: params.subject,
        productId: params.productId,
        buyerId: params.buyerId
    })}`, {
        method: 'POST'
    });
}
async function createAliPay(data) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/fund/ali/pay/create', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}
async function createAliPay2(data) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/fund/ali/pay/create2', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}
async function aliPayNotify(data) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/payments/alipay/notify', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}
async function getAliPaySuccess(orderNo) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payments/success${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(orderNo ? {
        orderNo
    } : {})}`);
}
async function getAliPayFail(orderNo) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payments/fail${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(orderNo ? {
        orderNo
    } : {})}`);
}
async function aliPayReturn(orderNo) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/fund/ali/pay/alipay/return${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(orderNo ? {
        orderNo
    } : {})}`);
}
async function applyRefund(data) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/refunds/apply', {
        method: 'POST',
        body: JSON.stringify({
            order_no: data.orderNo,
            reason: data.reason,
            amount: data.amount,
            description: data.description
        })
    });
}
async function getRefundList(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/refunds/me${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getRefundDetail(refundNo) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payment/refund/${refundNo}`);
}
async function cancelRefund(refundNo) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payment/refund/${refundNo}/cancel`, {
        method: 'POST'
    });
}
async function checkRefundStatus(refundNo) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payment/refund/${refundNo}/status`);
}
async function auditRefund(data) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payment/refund/${data.refundNo}/audit`, {
        method: 'POST',
        body: JSON.stringify({
            action: data.action,
            comment: data.comment
        })
    });
}
async function processRefund(refundNo) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payment/refund/${refundNo}/process`, {
        method: 'POST'
    });
}
async function createTopUpOrder(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/wallet/recharge', {
        method: 'POST',
        body: JSON.stringify({
            amount: input.amount,
            payment_method: input.paymentMethod
        })
    });
}
async function getTopUpStatus(orderId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/top-up/status/${orderId}`);
}
async function getTopUpRecords(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/wallet/recharge/records${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function requestWithdrawal(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/finance/withdrawal/withdrawal', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getWithdrawalStatus(nickname, openId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/finance/withdrawal/getWithdrawal', {
        method: 'POST',
        body: JSON.stringify({
            nickname,
            openId
        })
    });
}
async function getMyWithdrawalRecords(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/finance/withdrawal/my-records${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getWithdrawals(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/finance/withdrawal/flows/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getWithdrawalDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/finance/withdrawal/flows/${id}`);
}
async function approveWithdrawal(id, params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/finance/withdrawal/flows/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify(params || {})
    });
}
async function rejectWithdrawal(id, reason) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/finance/withdrawal/flows/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
            reason: reason || '审核未通过'
        })
    });
}
async function generateInvoice(orderId, invoiceData) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/invoices/applications`, {
        method: 'POST',
        body: JSON.stringify({
            ...invoiceData,
            orderId
        })
    });
}
async function getInvoice(orderId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/invoices/applications${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        orderId
    })}`);
}
}),
"[project]/packages/api-client/src/endpoints/plugin.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 插件市场 API 客户端封装(跨端共享,2026-07-22 立,2026-07-22 增 click + admin stats)
 *
 * 5 个用户端点 + 3 个 admin 端点:
 *  - GET    /api/plugins/installed          查询当前用户所有插件安装态
 *  - POST   /api/plugins/:id/install        安装/启用插件(可选 pinned)
 *  - DELETE /api/plugins/:id/install        卸载/禁用插件
 *  - PATCH  /api/plugins/:id/preferences    更新偏好(pinned)
 *  - POST   /api/plugins/:id/click          埋点:点击市场卡片外链(游客可触发)
 *  - GET    /api/admin/plugins/stats/summary  管理端:总览
 *  - GET    /api/admin/plugins/stats/top      管理端:热度榜 Top N
 *  - GET    /api/admin/plugins/stats/trend    管理端:按天趋势
 *
 * 跨端使用:web / desktop / extension / mobile-rn / miniapp-taro / cli
 * 都通过 @ihui/api-client 统一导入,各端薄包装层只做 re-export。
 */ __turbopack_context__.s([
    "getInstalledPlugins",
    ()=>getInstalledPlugins,
    "getPluginStatsSummary",
    ()=>getPluginStatsSummary,
    "getPluginStatsTop",
    ()=>getPluginStatsTop,
    "getPluginStatsTrend",
    ()=>getPluginStatsTrend,
    "installPlugin",
    ()=>installPlugin,
    "recordPluginClick",
    ()=>recordPluginClick,
    "uninstallPlugin",
    ()=>uninstallPlugin,
    "updatePluginPreferences",
    ()=>updatePluginPreferences
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
function getInstalledPlugins() {
    // 后端返回 ApiResponse<PluginInstalledResponse> = { code, message, data }
    // fetchApi 会自动解包为 ApiResult<PluginInstalledResponse>,此处再解包 data
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/plugins/installed').then((res)=>{
        if (!res.success) {
            // 未登录或网络异常:返回未认证态,前端隐藏操作按钮
            return {
                states: {},
                authenticated: false
            };
        }
        return res.data;
    });
}
async function installPlugin(pluginId, body) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/plugins/${encodeURIComponent(pluginId)}/install`, {
        method: 'POST',
        body: JSON.stringify(body ?? {})
    });
    if (!res.success) throw new Error(res.error);
    return res.data;
}
async function uninstallPlugin(pluginId) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/plugins/${encodeURIComponent(pluginId)}/install`, {
        method: 'DELETE'
    });
    if (!res.success) throw new Error(res.error);
    return res.data;
}
async function updatePluginPreferences(pluginId, body) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/plugins/${encodeURIComponent(pluginId)}/preferences`, {
        method: 'PATCH',
        body: JSON.stringify(body)
    });
    if (!res.success) throw new Error(res.error);
    return res.data;
}
async function recordPluginClick(pluginId) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/plugins/${encodeURIComponent(pluginId)}/click`, {
        method: 'POST'
    });
    if (!res.success) throw new Error(res.error);
    return res.data;
}
async function getPluginStatsSummary(query) {
    const qs = query?.days ? `?days=${query.days}` : '';
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/admin/plugins/stats/summary${qs}`);
    if (!res.success) throw new Error(res.error);
    return res.data;
}
async function getPluginStatsTop(query) {
    const params = new URLSearchParams();
    if (query?.days) params.set('days', String(query.days));
    if (query?.limit) params.set('limit', String(query.limit));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/admin/plugins/stats/top${qs}`);
    if (!res.success) throw new Error(res.error);
    return res.data;
}
async function getPluginStatsTrend(query) {
    const qs = query?.days ? `?days=${query.days}` : '';
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/admin/plugins/stats/trend${qs}`);
    if (!res.success) throw new Error(res.error);
    return res.data;
}
}),
"[project]/packages/api-client/src/endpoints/resource.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 资源相关 API
 * 合并迁移自旧架构：resource, certificate, knowledge, skills
 *
 * 字段命名对齐后端 schema(resource.ts):
 * - intro (非 description)
 * - coverImage (非 cover)
 * - fileUrl (非 url)
 * - categoryId (非 category)
 * - tagIdList (非 tags)
 * - 删除 likeCount (后端无此字段)
 *
 * 端点路径对齐:
 * - createResource/updateResource/deleteResource → /api/admin/resources (admin only)
 * - downloadResource → GET (非 POST)
 * - 删除 likeResource (后端无此端点)
 */ __turbopack_context__.s([
    "createCertificateTemplate",
    ()=>createCertificateTemplate,
    "createKnowledge",
    ()=>createKnowledge,
    "createResource",
    ()=>createResource,
    "createSkill",
    ()=>createSkill,
    "deleteCertificateTemplate",
    ()=>deleteCertificateTemplate,
    "deleteKnowledge",
    ()=>deleteKnowledge,
    "deleteResource",
    ()=>deleteResource,
    "deleteSkill",
    ()=>deleteSkill,
    "downloadResource",
    ()=>downloadResource,
    "getCertificateDetail",
    ()=>getCertificateDetail,
    "getCertificateTemplateDetail",
    ()=>getCertificateTemplateDetail,
    "getCertificateTemplates",
    ()=>getCertificateTemplates,
    "getCertificates",
    ()=>getCertificates,
    "getKnowledgeDetail",
    ()=>getKnowledgeDetail,
    "getKnowledgeList",
    ()=>getKnowledgeList,
    "getMyCertificates",
    ()=>getMyCertificates,
    "getResourceDetail",
    ()=>getResourceDetail,
    "getResources",
    ()=>getResources,
    "getSkillDetail",
    ()=>getSkillDetail,
    "getSkills",
    ()=>getSkills,
    "issueCertificate",
    ()=>issueCertificate,
    "likeKnowledge",
    ()=>likeKnowledge,
    "revokeCertificate",
    ()=>revokeCertificate,
    "updateCertificateTemplate",
    ()=>updateCertificateTemplate,
    "updateKnowledge",
    ()=>updateKnowledge,
    "updateResource",
    ()=>updateResource,
    "updateSkill",
    ()=>updateSkill,
    "verifyCertificate",
    ()=>verifyCertificate
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getResources(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/resources${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getResourceDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/resources/${id}`);
}
async function createResource(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/resources', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateResource(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/resources/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteResource(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/admin/resources/${id}`, {
        method: 'DELETE'
    });
}
async function downloadResource(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/resources/${id}/download`);
}
async function getCertificates(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/certificates${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getCertificateDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/certificates/${id}`);
}
async function getMyCertificates(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/certificates/my${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function issueCertificate(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/certificates/issue', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function revokeCertificate(id, reason) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/certificates/${id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({
            reason
        })
    });
}
async function verifyCertificate(certificateNo) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/certificates/verify${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        certificateNo
    })}`);
}
async function getCertificateTemplates(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/certificates/templates${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getCertificateTemplateDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/certificates/templates/${id}`);
}
async function createCertificateTemplate(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/certificates/templates', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateCertificateTemplate(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/certificates/templates/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteCertificateTemplate(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/certificates/templates/${id}`, {
        method: 'DELETE'
    });
}
async function getKnowledgeList(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/knowledge${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getKnowledgeDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/knowledge/${id}`);
}
async function createKnowledge(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/knowledge', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateKnowledge(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/knowledge/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteKnowledge(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/knowledge/${id}`, {
        method: 'DELETE'
    });
}
async function likeKnowledge(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/knowledge/${id}/like`, {
        method: 'POST'
    });
}
async function getSkills(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/skills${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getSkillDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/skills/${id}`);
}
async function createSkill(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/skills', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updateSkill(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/skills/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteSkill(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/skills/${id}`, {
        method: 'DELETE'
    });
}
}),
"[project]/packages/api-client/src/endpoints/share.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fetchShareContent",
    ()=>fetchShareContent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
async function fetchShareContent(code) {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/share/content/${code}`);
    if (!res.success) throw new Error(res.error || '获取分享内容失败');
    return res.data;
}
}),
"[project]/packages/api-client/src/endpoints/social.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cancelSubscription",
    ()=>cancelSubscription,
    "deleteFavorite",
    ()=>deleteFavorite,
    "getSubscriptions",
    ()=>getSubscriptions,
    "unfollowUser",
    ()=>unfollowUser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getSubscriptions(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/subscriptions${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function deleteFavorite(resourceType, resourceId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/favorites/${resourceType}/${resourceId}`, {
        method: 'DELETE'
    });
}
async function unfollowUser(userId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/follows/${userId}`, {
        method: 'DELETE'
    });
}
async function cancelSubscription(targetType, targetId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/subscriptions/${targetType}/${targetId}`, {
        method: 'DELETE'
    });
}
}),
"[project]/packages/api-client/src/endpoints/srs.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "checkSrsServerHealth",
    ()=>checkSrsServerHealth,
    "createSrsServer",
    ()=>createSrsServer,
    "createSrsStream",
    ()=>createSrsStream,
    "deleteSrsServer",
    ()=>deleteSrsServer,
    "deleteSrsStream",
    ()=>deleteSrsStream,
    "getSrsServers",
    ()=>getSrsServers,
    "getSrsStreamByKey",
    ()=>getSrsStreamByKey,
    "getSrsStreamStatus",
    ()=>getSrsStreamStatus,
    "getSrsStreams",
    ()=>getSrsStreams,
    "kickSrsStream",
    ()=>kickSrsStream,
    "updateSrsServer",
    ()=>updateSrsServer,
    "updateSrsStream",
    ()=>updateSrsStream
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getSrsStreams(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/srs/streams${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getSrsStreamByKey(key) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/srs/streams/${encodeURIComponent(key)}`);
}
async function createSrsStream(data) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/srs/streams', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}
async function updateSrsStream(id, data) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/srs/streams/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}
async function deleteSrsStream(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/srs/streams/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
}
async function kickSrsStream(key) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/srs/streams/${encodeURIComponent(key)}/kick`, {
        method: 'POST'
    });
}
async function getSrsStreamStatus(key) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/srs/streams/${encodeURIComponent(key)}/status`);
}
async function getSrsServers() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/srs/servers');
}
async function createSrsServer(data) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/srs/servers', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}
async function updateSrsServer(id, data) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/srs/servers/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}
async function deleteSrsServer(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/srs/servers/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
}
async function checkSrsServerHealth(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/srs/servers/${encodeURIComponent(id)}/health`);
}
}),
"[project]/packages/api-client/src/endpoints/study.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Study 学习记录跨端共享类型
 *
 * 从 apps/miniapp-taro/src/api/index.ts 下沉,供 web/miniapp-taro/mobile-rn 等端复用。
 * 后端 GET /study/records 返回的学习记录列表项。
 */ __turbopack_context__.s([]);
;
}),
"[project]/packages/api-client/src/endpoints/subscription.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 微信支付周期扣款(连续包月)API 客户端。
 * 对应后端路由:apps/api/src/routes/payment-recurring.ts + payment-extended.ts
 */ __turbopack_context__.s([
    "cancelRecurringContract",
    ()=>cancelRecurringContract,
    "getRecurringContract",
    ()=>getRecurringContract,
    "getSubscriptionStatus",
    ()=>getSubscriptionStatus,
    "listRecurringContracts",
    ()=>listRecurringContracts,
    "signRecurringContract",
    ()=>signRecurringContract
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
async function signRecurringContract(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/payments/recurring/sign', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function listRecurringContracts() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/payments/recurring/contracts');
}
async function getRecurringContract(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payments/recurring/contracts/${id}`);
}
async function cancelRecurringContract(id, reason) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/payments/recurring/contracts/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify(reason ? {
            reason
        } : {})
    });
}
async function getSubscriptionStatus() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/payments/subscription/status');
}
}),
"[project]/packages/api-client/src/endpoints/voice-stt.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 语音转文字(STT)—— 跨端共用封装(不含 Taro 专用实现)。
 *
 * 2026-07-28 拆分:将 miniapp-taro 专用实现 `voiceSttFromTaro` 移至
 * `./voice-stt.taro.ts`,仅通过深路径 `@ihui/api-client/endpoints/voice-stt.taro`
 * 暴露给 miniapp-taro。其他端(web/api/mobile-rn/extension/desktop/cli)永不接触
 * `@tarojs/taro`,避免跨端依赖污染导致 dev 阶段静态解析失败。
 *
 * 本文件提供的端适配:
 * - web/extension:浏览器直连 ai-service(http://localhost:8803 或生产域名)
 * - mobile-rn:fetch + FormData 上传音频 URI 对应文件
 *
 * 后端端点:POST {aiServiceUrl}/api/voice/stt(multipart/form-data)
 * 响应:{ text: string, stub: boolean, model: string }
 */ /** STT 响应结构(与 ai-service STTResponse 对齐)。 */ __turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__,
    "voiceSttFromBlob",
    ()=>voiceSttFromBlob,
    "voiceSttFromReactNative",
    ()=>voiceSttFromReactNative
]);
/** 默认 ai-service URL(与 web 端 voice-input.tsx 保持一致)。 */ const DEFAULT_AI_SERVICE_URL = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_AI_SERVICE_URL ? process.env.NEXT_PUBLIC_AI_SERVICE_URL : 'http://localhost:8803';
async function voiceSttFromBlob(params) {
    const { blob, filename = 'voice.webm', mimeType = 'audio/webm', language = 'zh', aiServiceUrl = DEFAULT_AI_SERVICE_URL } = params;
    if (!blob) return '';
    try {
        const formData = new FormData();
        // Blob 类型直接 append;ArrayBuffer 需要 wrap 成 Blob
        const audioBlob = blob instanceof Blob ? blob : new Blob([
            blob
        ], {
            type: mimeType
        });
        formData.append('file', audioBlob, filename);
        if (language) formData.append('language', language);
        const res = await fetch(`${aiServiceUrl}/api/voice/stt`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) return '';
        const data = await res.json();
        // stub 响应不返回给用户(避免占位文字污染输入框)
        return data.stub ? '' : data.text ?? '';
    } catch  {
        // 静默处理失败(不阻塞用户输入)
        return '';
    }
}
async function voiceSttFromReactNative(fileUri, options) {
    const language = options?.language ?? 'zh';
    const aiServiceUrl = options?.aiServiceUrl ?? DEFAULT_AI_SERVICE_URL;
    if (!fileUri) return '';
    try {
        const filename = fileUri.split('/').pop() ?? 'voice.m4a';
        const mimeType = filename.endsWith('.wav') ? 'audio/wav' : filename.endsWith('.mp3') ? 'audio/mp3' : 'audio/m4a';
        // RN FormData 支持 { uri, type, name } 结构(原生 fetch 会读取文件并上传)
        const fd = new FormData();
        fd.append('file', {
            uri: fileUri,
            type: mimeType,
            name: filename
        });
        if (language) fd.append('language', language);
        const res = await fetch(`${aiServiceUrl}/api/voice/stt`, {
            method: 'POST',
            body: fd
        });
        if (!res.ok) return '';
        const data = await res.json();
        return data.stub ? '' : data.text ?? '';
    } catch  {
        return '';
    }
}
const __TURBOPACK__default__export__ = voiceSttFromBlob;
}),
"[project]/packages/api-client/src/endpoints/teacher.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Teacher 跨端共享类型
 *
 * 从 apps/miniapp-taro/src/api/index.ts 下沉,供 web/miniapp-taro/mobile-rn 等端复用。
 * 后端 GET /teacher/list 与 GET /teacher/:id 返回。
 */ __turbopack_context__.s([]);
;
}),
"[project]/packages/api-client/src/endpoints/token.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getTokenBalance",
    ()=>getTokenBalance,
    "getTokenFlows",
    ()=>getTokenFlows
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getTokenBalance() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/user/token-balance');
}
async function getTokenFlows(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/user/token-flow${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
}),
"[project]/packages/api-client/src/endpoints/user.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "bindPhone",
    ()=>bindPhone,
    "getFans",
    ()=>getFans,
    "getFavorites",
    ()=>getFavorites,
    "getFollowing",
    ()=>getFollowing,
    "getProfile",
    ()=>getProfile,
    "getUserStatistics",
    ()=>getUserStatistics,
    "replacePhone",
    ()=>replacePhone,
    "updatePassword",
    ()=>updatePassword,
    "updateProfile",
    ()=>updateProfile
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getProfile() {
    const res = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/me');
    if (!res.success) return res;
    return {
        success: true,
        data: res.data.user
    };
}
async function updateProfile(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function updatePassword(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth/profile/password', {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function bindPhone(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/users/change-phone', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function replacePhone(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/users/change-phone', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getUserStatistics() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/statistics/user-center');
}
async function getFavorites(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/favorites${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getFollowing(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/follows/following${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getFans(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/follows/followers${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
}),
"[project]/packages/api-client/src/endpoints/vip.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getCoupons",
    ()=>getCoupons,
    "getMembershipInfo",
    ()=>getMembershipInfo,
    "getPoints",
    ()=>getPoints,
    "getVipBenefits",
    ()=>getVipBenefits,
    "getVipLevels",
    ()=>getVipLevels,
    "signIn",
    ()=>signIn
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getVipLevels() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/vip/levels');
}
async function getVipBenefits(query = {}) {
    // 后端缺失
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/vip/benefits${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getMembershipInfo() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/vip/my');
}
async function getPoints() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/points');
}
async function signIn() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/sign-in', {
        method: 'POST'
    });
}
async function getCoupons(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/coupons/verify${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
}),
"[project]/packages/api-client/src/endpoints/wallet.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getBalance",
    ()=>getBalance,
    "getRechargeRecords",
    ()=>getRechargeRecords,
    "getWithdrawRecords",
    ()=>getWithdrawRecords,
    "recharge",
    ()=>recharge,
    "withdraw",
    ()=>withdraw
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getBalance() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/wallet/balance');
}
async function recharge(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/wallet/recharge', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function withdraw(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getWithdrawRecords(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/wallet/withdraw/records${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getRechargeRecords(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/wallet/recharge/records${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
}),
"[project]/packages/api-client/src/endpoints/workspace.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addPermissionRule",
    ()=>addPermissionRule,
    "browseDirectory",
    ()=>browseDirectory,
    "createSwarm",
    ()=>createSwarm,
    "createWorkspace",
    ()=>createWorkspace,
    "deleteFile",
    ()=>deleteFile,
    "deletePermissionRule",
    ()=>deletePermissionRule,
    "deleteWorkspace",
    ()=>deleteWorkspace,
    "deleteWorkspacePermission",
    ()=>deleteWorkspacePermission,
    "editFile",
    ()=>editFile,
    "executeSandbox",
    ()=>executeSandbox,
    "getFiles",
    ()=>getFiles,
    "getPermissionAuditLog",
    ()=>getPermissionAuditLog,
    "getPermissionTemplates",
    ()=>getPermissionTemplates,
    "getRecentFilesForMention",
    ()=>getRecentFilesForMention,
    "getRecentWorkspaces",
    ()=>getRecentWorkspaces,
    "getSwarm",
    ()=>getSwarm,
    "getWorkspaceById",
    ()=>getWorkspaceById,
    "getWorkspacePermission",
    ()=>getWorkspacePermission,
    "getWorkspaces",
    ()=>getWorkspaces,
    "globFiles",
    ()=>globFiles,
    "grepFiles",
    ()=>grepFiles,
    "indexCodebase",
    ()=>indexCodebase,
    "listAllWorkspacePermissions",
    ()=>listAllWorkspacePermissions,
    "listCheckpoints",
    ()=>listCheckpoints,
    "listPendingPermissionRequests",
    ()=>listPendingPermissionRequests,
    "listPermissionRules",
    ()=>listPermissionRules,
    "openWorkspace",
    ()=>openWorkspace,
    "readFile",
    ()=>readFile,
    "resetPermissionRules",
    ()=>resetPermissionRules,
    "resolvePermissionRequest",
    ()=>resolvePermissionRequest,
    "rollbackCheckpoint",
    ()=>rollbackCheckpoint,
    "runCommand",
    ()=>runCommand,
    "searchCodebase",
    ()=>searchCodebase,
    "searchFilesForMention",
    ()=>searchFilesForMention,
    "setWorkspacePermission",
    ()=>setWorkspacePermission,
    "undoCheckpoint",
    ()=>undoCheckpoint,
    "updatePermissionRule",
    ()=>updatePermissionRule,
    "updateWorkspace",
    ()=>updateWorkspace,
    "uploadFile",
    ()=>uploadFile,
    "writeFile",
    ()=>writeFile
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getWorkspaces(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/projects${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function createWorkspace(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/projects', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function getWorkspaceById(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/projects/${encodeURIComponent(id)}`);
}
async function updateWorkspace(id, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/projects/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteWorkspace(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/projects/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
}
async function getSwarm(workspaceId, query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/swarms${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        ...query,
        workspaceId
    })}`);
}
async function createSwarm(workspaceId, input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/swarms', {
        method: 'POST',
        body: JSON.stringify({
            ...input,
            workspaceId
        })
    });
}
async function getFiles(workspaceId, query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/projects/${encodeURIComponent(workspaceId)}/files${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function uploadFile(workspaceId, file, parentId) {
    const formData = new FormData();
    formData.append('file', file);
    if (parentId) formData.append('parentId', parentId);
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/projects/${encodeURIComponent(workspaceId)}/files`, {
        method: 'POST',
        body: formData
    });
}
async function getRecentFilesForMention(limit = 20) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/files/recent?limit=${limit}`);
}
async function searchFilesForMention(q) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/files/search?q=${encodeURIComponent(q)}`);
}
async function browseDirectory(path) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/fs/browse', {
        method: 'POST',
        body: JSON.stringify({
            path: path ?? ''
        })
    });
}
async function openWorkspace(path, name) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/fs/open', {
        method: 'POST',
        body: JSON.stringify({
            path,
            name
        })
    });
}
async function getRecentWorkspaces() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/fs/recent');
}
async function readFile(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/fs/read', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function writeFile(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/fs/write', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function editFile(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/fs/edit', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function deleteFile(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/fs/delete', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function grepFiles(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/fs/grep', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function globFiles(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/fs/glob', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function runCommand(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/fs/run', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function executeSandbox(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/sandbox/execute', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function indexCodebase(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/codebase/index', {
        method: 'POST',
        body: JSON.stringify(params)
    });
}
async function searchCodebase(params) {
    const qs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        workspacePath: params.workspacePath,
        q: params.query
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/codebase/search${qs}`);
}
async function listCheckpoints(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/checkpoints?workspacePath=${encodeURIComponent(params.workspacePath)}`);
}
async function rollbackCheckpoint(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/checkpoints/${encodeURIComponent(params.checkpointId)}/rollback`, {
        method: 'POST',
        body: JSON.stringify({
            workspacePath: params.workspacePath
        })
    });
}
async function undoCheckpoint(params) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/checkpoints/undo', {
        method: 'POST',
        body: JSON.stringify({
            workspacePath: params.workspacePath
        })
    });
}
async function getWorkspacePermission(path) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/permission?workspacePath=${encodeURIComponent(path)}`);
}
async function listAllWorkspacePermissions() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/permissions');
}
async function setWorkspacePermission(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/permissions', {
        method: 'PUT',
        body: JSON.stringify(input)
    });
}
async function deleteWorkspacePermission(path) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/permission?workspacePath=${encodeURIComponent(path)}`, {
        method: 'DELETE'
    });
}
async function listPermissionRules(path) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/permissions/rules?workspacePath=${encodeURIComponent(path)}`);
}
async function addPermissionRule(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/permissions/rules', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function updatePermissionRule(id, patch) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/permissions/rules/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch)
    });
}
async function deletePermissionRule(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/permissions/rules/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
}
async function resetPermissionRules(workspacePath) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/permissions/rules/reset', {
        method: 'POST',
        body: JSON.stringify({
            workspacePath
        })
    });
}
async function getPermissionAuditLog(path, limit = 50) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/permissions/audit-log?workspacePath=${encodeURIComponent(path)}&limit=${limit}`);
}
async function getPermissionTemplates() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/templates');
}
async function listPendingPermissionRequests() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/workspace/permission/requests');
}
async function resolvePermissionRequest(requestId, approved, reason) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/workspace/permission/requests/${encodeURIComponent(requestId)}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
            approved,
            reason
        })
    });
}
}),
"[project]/packages/api-client/src/endpoints/auth-codes.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 验证码相关 API(legacy /public-api/auth-code + /check 补开发,2 个端点)
 * 对应后端:apps/api/src/routes/auth-codes.ts(prefix: /api/auth-codes)
 * 公开端点,无鉴权(对齐 Java);验证码一次性,内存存储
 */ __turbopack_context__.s([
    "sendAuthCode",
    ()=>sendAuthCode,
    "verifyAuthCode",
    ()=>verifyAuthCode
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function sendAuthCode(mobile) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/auth-codes${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        mobile
    })}`);
}
async function verifyAuthCode(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/auth-codes/check', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
}),
"[project]/packages/api-client/src/endpoints/chat-skills.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createChatSkill",
    ()=>createChatSkill,
    "deleteChatSkill",
    ()=>deleteChatSkill,
    "listChatSkills",
    ()=>listChatSkills,
    "updateChatSkill",
    ()=>updateChatSkill
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
function listChatSkills() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/chat/skills');
}
function createChatSkill(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/chat/skills', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
function updateChatSkill(id, patch) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/chat/skills/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch)
    });
}
function deleteChatSkill(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/chat/skills/${encodeURIComponent(id)}`, {
        method: 'DELETE'
    });
}
}),
"[project]/packages/api-client/src/endpoints/ai-skills.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getAiSkill",
    ()=>getAiSkill,
    "invokeAiSkill",
    ()=>invokeAiSkill,
    "listAiSkills",
    ()=>listAiSkills
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
function listAiSkills() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/ai-skills');
}
function getAiSkill(skillId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai-skills/${encodeURIComponent(skillId)}`);
}
function invokeAiSkill(skillId, req) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/ai-skills/${encodeURIComponent(skillId)}/invoke`, {
        method: 'POST',
        body: JSON.stringify(req)
    });
}
}),
"[project]/packages/api-client/src/endpoints/exam-marking.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 阅卷评分相关 API(legacy /auth-api/mark/paper 补开发,1 个端点)
 * 对应后端:apps/api/src/routes/exam-marking.ts(prefix: /api/exam-marking)
 * 将答题记录从 submitted 状态置为 graded,记录得分
 */ __turbopack_context__.s([
    "submitExamMarking",
    ()=>submitExamMarking
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
async function submitExamMarking(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/exam-marking', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
}),
"[project]/packages/api-client/src/endpoints/mail.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 邮件相关 API(legacy /public-api/mail/send + /send/html 补开发,2 个端点)
 * 对应后端:apps/api/src/routes/mail.ts(prefix: /api/mail)
 * 公开端点,无鉴权(对齐 Java);未配置 SMTP 时自动降级为 stub
 */ __turbopack_context__.s([
    "sendHtmlMail",
    ()=>sendHtmlMail,
    "sendMail",
    ()=>sendMail
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
async function sendMail(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/mail/send', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function sendHtmlMail(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/mail/send/html', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
}),
"[project]/packages/api-client/src/endpoints/private-letters.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 私信相关 API(legacy /auth-api/private-letter 补开发,7 个端点)
 * 对应后端:apps/api/src/routes/private-letters.ts(prefix: /api/private-letters)
 * 数据表: t_private_letter;全部端点需登录,仅发送者/接收者可见自己的私信
 */ __turbopack_context__.s([
    "deletePrivateLetter",
    ()=>deletePrivateLetter,
    "getPrivateLetterDetail",
    ()=>getPrivateLetterDetail,
    "getPrivateLetterLatest",
    ()=>getPrivateLetterLatest,
    "getPrivateLetterList",
    ()=>getPrivateLetterList,
    "getPrivateLetterMembers",
    ()=>getPrivateLetterMembers,
    "getPrivateLetterNewList",
    ()=>getPrivateLetterNewList,
    "sendPrivateLetter",
    ()=>sendPrivateLetter
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function sendPrivateLetter(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/private-letters', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function deletePrivateLetter(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/private-letters', {
        method: 'DELETE',
        body: JSON.stringify({
            id
        })
    });
}
async function getPrivateLetterDetail(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/private-letters${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        id
    })}`);
}
async function getPrivateLetterMembers(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/private-letters/members${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getPrivateLetterLatest(memberId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/private-letters/member${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        memberId
    })}`);
}
async function getPrivateLetterList(query) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/private-letters/list${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getPrivateLetterNewList(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/private-letters/new${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
}),
"[project]/packages/api-client/src/endpoints/wrong-questions.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 错题本相关 API(legacy /auth-api/wrong-question 补开发,3 个端点)
 * 对应后端:apps/api/src/routes/wrong-questions.ts(prefix: /api/wrong-questions)
 * 数据表: exam_wrong_question;全部端点需登录,仅本人可见自己的错题
 */ __turbopack_context__.s([
    "createOrUpdateWrongQuestion",
    ()=>createOrUpdateWrongQuestion,
    "deleteWrongQuestion",
    ()=>deleteWrongQuestion,
    "getWrongQuestions",
    ()=>getWrongQuestions
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function createOrUpdateWrongQuestion(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/wrong-questions', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
async function deleteWrongQuestion(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/wrong-questions', {
        method: 'DELETE',
        body: JSON.stringify({
            id
        })
    });
}
async function getWrongQuestions(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/wrong-questions${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
}),
"[project]/packages/api-client/src/endpoints/admin-tool-gen.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * B 端 admin 工具代码生成器 API client。
 * 对接后端 admin/tool/gen(GET 元信息 + POST 生成代码)。
 */ __turbopack_context__.s([
    "getToolGenMeta",
    ()=>getToolGenMeta,
    "postToolGen",
    ()=>postToolGen
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
async function getToolGenMeta() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/tool/gen');
}
async function postToolGen(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/admin/tool/gen', {
        method: 'POST',
        body: JSON.stringify(input)
    });
}
}),
"[project]/packages/api-client/src/endpoints/legacy-public.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 旧架构 edu-web 公开 API 端点(2026-07-22 立)
 *
 * 来源: git commit 3ee96cf09 旧架构 client/src/api/{category,article,news,
 * letter,point,search,agreement,carousel}.ts 中存在但 api-client 未导出的
 * 公开端点。函数名按新架构命名(见 LEGACY_EDU_API_RENAMES 映射表),
 * apps/web/src/lib/legacy-edu-api.ts 进一步提供旧函数名桥接层。
 *
 * 覆盖端点:
 * - /api/carousels                       (carousel.ts → getActiveCarousels)
 * - /api/agreements/current              (admin-agreements.ts → getCurrentAgreement)
 * - /api/announcements[/...]              (content.ts → getAnnouncements/Detail/Read)
 * - /api/points[/transactions]            (gamification.ts → getMyPoints/getPointTransactions)
 * - /api/search[/hot-words]              (search.ts → searchContent/getHotWords)
 */ __turbopack_context__.s([
    "addSearchHistory",
    ()=>addSearchHistory,
    "clearSearchHistory",
    ()=>clearSearchHistory,
    "getActiveCarousels",
    ()=>getActiveCarousels,
    "getAnnouncementById",
    ()=>getAnnouncementById,
    "getAnnouncements",
    ()=>getAnnouncements,
    "getCurrentAgreement",
    ()=>getCurrentAgreement,
    "getMyPoints",
    ()=>getMyPoints,
    "getPointTransactions",
    ()=>getPointTransactions,
    "getSearchHistory",
    ()=>getSearchHistory,
    "getSearchHotWords",
    ()=>getSearchHotWords,
    "getUnreadAnnouncementCount",
    ()=>getUnreadAnnouncementCount,
    "markAnnouncementRead",
    ()=>markAnnouncementRead,
    "searchContent",
    ()=>searchContent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
;
;
async function getActiveCarousels(position) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/carousels${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(position ? {
        position
    } : {})}`);
}
async function getCurrentAgreement(type) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/agreements/current${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])({
        type
    })}`);
}
async function getAnnouncements(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/announcements${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getAnnouncementById(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/announcements/${encodeURIComponent(id)}`);
}
async function markAnnouncementRead(id) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/announcements/${encodeURIComponent(id)}/read`, {
        method: 'POST'
    });
}
async function getUnreadAnnouncementCount() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/announcements/unread/count');
}
async function getMyPoints() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/points');
}
async function getPointTransactions(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/points/transactions${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function searchContent(input) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/search${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(input)}`);
}
async function getSearchHotWords(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/search/hot-words${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function getSearchHistory(query = {}) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/search/history${(0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildQs"])(query)}`);
}
async function addSearchHistory(keyword) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/search/history', {
        method: 'POST',
        body: JSON.stringify({
            keyword
        })
    });
}
async function clearSearchHistory() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/search/history', {
        method: 'DELETE'
    });
}
}),
"[project]/packages/api-client/src/endpoints/publish.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 多平台一键发布 API 端点(2026-07-30 新增)。
 *
 * 覆盖:
 * - 账号管理(列表/创建/更新/删除/验证)
 * - 任务管理(创建/查询/取消/重试)
 * - 历史/统计/上传
 * - 扫码登录(2026-07-30 新增,WorkPanel 内置浏览器扫码 → 自动保存 cookies)
 */ __turbopack_context__.s([
    "cancelPublishTask",
    ()=>cancelPublishTask,
    "cancelScanLogin",
    ()=>cancelScanLogin,
    "createPublishAccount",
    ()=>createPublishAccount,
    "createPublishTask",
    ()=>createPublishTask,
    "deletePublishAccount",
    ()=>deletePublishAccount,
    "detectLoginFromCdp",
    ()=>detectLoginFromCdp,
    "fetchScanLoginQr",
    ()=>fetchScanLoginQr,
    "getPublishTask",
    ()=>getPublishTask,
    "getScanLoginQrUrl",
    ()=>getScanLoginQrUrl,
    "getScanLoginStatus",
    ()=>getScanLoginStatus,
    "listPublishAccounts",
    ()=>listPublishAccounts,
    "listPublishTasks",
    ()=>listPublishTasks,
    "listScanLoginPlatforms",
    ()=>listScanLoginPlatforms,
    "retryPublishTask",
    ()=>retryPublishTask,
    "startScanLogin",
    ()=>startScanLogin,
    "updatePublishAccount",
    ()=>updatePublishAccount,
    "verifyPublishAccount",
    ()=>verifyPublishAccount
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
;
async function listPublishAccounts(userId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/publish/accounts/${encodeURIComponent(userId)}`);
}
async function createPublishAccount(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/publish/accounts', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function updatePublishAccount(accountId, body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/publish/accounts/${accountId}`, {
        method: 'PUT',
        body: JSON.stringify(body)
    });
}
async function deletePublishAccount(accountId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/publish/accounts/${accountId}`, {
        method: 'DELETE'
    });
}
async function verifyPublishAccount(accountId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/publish/accounts/${accountId}/verify`, {
        method: 'POST'
    });
}
async function createPublishTask(body) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/publish/tasks', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
async function listPublishTasks(params) {
    const qs = params ? '?' + Object.entries(params).filter(([, v])=>v !== undefined && v !== null).map(([k, v])=>`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&') : '';
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/publish/tasks${qs}`);
}
async function getPublishTask(taskId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/publish/tasks/${taskId}`);
}
async function cancelPublishTask(taskId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/publish/tasks/${taskId}/cancel`, {
        method: 'POST'
    });
}
async function retryPublishTask(taskId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/publish/tasks/${taskId}/retry`, {
        method: 'POST'
    });
}
async function listScanLoginPlatforms() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/publish/scan-login/platforms');
}
async function startScanLogin(platform) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/publish/scan-login/start', {
        method: 'POST',
        body: JSON.stringify({
            platform
        })
    });
}
async function getScanLoginStatus(taskId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/publish/scan-login/${encodeURIComponent(taskId)}/status`);
}
function getScanLoginQrUrl(taskId) {
    return `/api/publish/scan-login/${encodeURIComponent(taskId)}/qr`;
}
async function fetchScanLoginQr(taskId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchRaw"])(`/api/publish/scan-login/${encodeURIComponent(taskId)}/qr`);
}
async function cancelScanLogin(taskId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])(`/api/publish/scan-login/${encodeURIComponent(taskId)}/cancel`, {
        method: 'POST'
    });
}
async function detectLoginFromCdp(sessionId, platform) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchApi"])('/api/publish/scan-login/detect-from-cdp', {
        method: 'POST',
        body: JSON.stringify({
            session_id: sessionId,
            platform
        })
    });
}
}),
"[project]/packages/api-client/src/endpoints/coze.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Coze API 端点(跨端共享)— 直连 Coze 官方 API(PAT 鉴权),不走项目后端。
 * 各端通过 createCozeClient(config) 创建客户端,config 由各端自行持久化。
 */ __turbopack_context__.s([
    "COZE_DEFAULT_BASE_URL",
    ()=>COZE_DEFAULT_BASE_URL,
    "COZE_DEFAULT_TIMEOUT",
    ()=>COZE_DEFAULT_TIMEOUT,
    "CozeApiError",
    ()=>CozeApiError,
    "createCozeClient",
    ()=>createCozeClient
]);
const COZE_DEFAULT_BASE_URL = 'https://api.coze.cn';
const COZE_DEFAULT_TIMEOUT = 30000;
class CozeApiError extends Error {
    code;
    detail;
    constructor(message, code, detail){
        super(message);
        this.name = 'CozeApiError';
        this.code = code;
        this.detail = detail;
    }
}
function buildUrl(baseUrl, path, params) {
    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    if (!params) return url;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)){
        if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    }
    const s = qs.toString();
    return s ? `${url}?${s}` : url;
}
function createCozeClient(config) {
    const baseUrl = config.baseUrl || COZE_DEFAULT_BASE_URL;
    const timeout = config.timeout || COZE_DEFAULT_TIMEOUT;
    async function cozeRequest(path, opts = {}) {
        if (!config.token) throw new CozeApiError('Coze token 未配置,请先到 API 设置页填写', -1, '');
        const url = buildUrl(baseUrl, path, opts.params);
        const controller = new AbortController();
        const timer = setTimeout(()=>controller.abort(), opts.timeoutMs ?? timeout);
        try {
            const res = await fetch(url, {
                method: opts.method ?? 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${config.token}`
                },
                body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
                signal: controller.signal
            });
            if (!res.ok) {
                const text = await res.text().catch(()=>'');
                throw new CozeApiError(`HTTP ${res.status}`, res.status, text);
            }
            const json = await res.json();
            if (json.code !== 0) throw new CozeApiError(json.msg || `业务错误 code=${json.code}`, json.code, JSON.stringify(json));
            return json.data;
        } finally{
            clearTimeout(timer);
        }
    }
    return {
        createChat (opts) {
            return cozeRequest('/v3/chat', {
                method: 'POST',
                body: {
                    bot_id: opts.bot_id,
                    user_id: opts.user_id,
                    stream: false,
                    auto_save_history: opts.auto_save_history ?? true,
                    additional_messages: opts.additional_messages?.map((m)=>({
                            role: m.role,
                            type: m.type ?? 'question',
                            content: m.content,
                            content_type: m.content_type ?? 'text',
                            meta_data: m.meta_data
                        })),
                    ...opts.conversation_id ? {
                        conversation_id: opts.conversation_id
                    } : {},
                    ...opts.custom_variables ? {
                        custom_variables: opts.custom_variables
                    } : {},
                    ...opts.parameters ? {
                        parameters: opts.parameters
                    } : {}
                }
            });
        },
        retrieveChat (conversationId, chatId) {
            return cozeRequest('/v3/chat/retrieve', {
                params: {
                    conversation_id: conversationId,
                    chat_id: chatId
                }
            });
        },
        listChatMessages (conversationId, chatId) {
            return cozeRequest('/v3/chat/message/list', {
                params: {
                    conversation_id: conversationId,
                    chat_id: chatId
                }
            });
        },
        async pollChatComplete (conversationId, chatId, opts = {}) {
            const interval = opts.intervalMs ?? 1500;
            const maxWait = opts.maxWaitMs ?? 120000;
            const start = Date.now();
            for(;;){
                const status = await this.retrieveChat(conversationId, chatId);
                if ([
                    'completed',
                    'failed',
                    'canceled'
                ].includes(status.status)) {
                    return {
                        status,
                        messages: (await this.listChatMessages(conversationId, chatId)).data ?? []
                    };
                }
                if (Date.now() - start > maxWait) throw new CozeApiError('轮询超时', -1, `wait > ${maxWait}ms`);
                await new Promise((r)=>setTimeout(r, interval));
            }
        },
        createConversation (meta) {
            return cozeRequest('/v3/conversation/create', {
                method: 'POST',
                body: meta ?? {}
            });
        },
        retrieveConversation (id) {
            return cozeRequest('/v3/conversation/retrieve', {
                params: {
                    conversation_id: id
                }
            });
        },
        runWorkflow (opts) {
            return cozeRequest('/v1/workflow/run', {
                method: 'POST',
                body: {
                    workflow_id: opts.workflow_id,
                    parameters: opts.parameters,
                    is_async: opts.is_async ?? false
                },
                timeoutMs: opts.timeoutMs
            });
        },
        getWorkflowHistory (workflowId, executeId) {
            return cozeRequest(`/v1/workflows/${workflowId}/run_histories/${executeId}`);
        },
        listBots (workspaceId) {
            return cozeRequest('/v1/bot/list', {
                params: {
                    workspace_id: workspaceId
                }
            });
        },
        getBotOnlineInfo (botId) {
            return cozeRequest('/v1/bot/get_online_info', {
                method: 'POST',
                body: {
                    bot_id: botId
                }
            });
        },
        listDatasets (workspaceId, pageSize = 20, pageIndex = 1) {
            return cozeRequest('/v1/datasets', {
                params: {
                    workspace_id: workspaceId,
                    page_size: String(pageSize),
                    page_index: String(pageIndex)
                }
            });
        },
        createDataset (name, workspaceId) {
            return cozeRequest('/v1/datasets', {
                method: 'POST',
                body: {
                    name,
                    workspace_id: workspaceId,
                    capacity: 1
                }
            });
        },
        deleteDataset (datasetId) {
            return cozeRequest(`/v1/datasets/${datasetId}`, {
                method: 'DELETE'
            });
        },
        async testConnection () {
            if (!config.token) return {
                ok: false,
                message: '未填写 API 令牌'
            };
            const controller = new AbortController();
            const timer = setTimeout(()=>controller.abort(), timeout);
            try {
                const res = await fetch(buildUrl(baseUrl, '/v3/conversation/create', {}), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${config.token}`
                    },
                    body: JSON.stringify({}),
                    signal: controller.signal
                });
                if (res.status === 401) return {
                    ok: false,
                    message: 'API 令牌无效(401)'
                };
                if (res.status === 404) return {
                    ok: false,
                    message: 'Base URL 不可达(404)'
                };
                if (!res.ok) return {
                    ok: false,
                    message: `HTTP ${res.status}`
                };
                return {
                    ok: true,
                    message: '连接成功'
                };
            } catch (e) {
                return {
                    ok: false,
                    message: e instanceof Error ? e.message : '网络异常'
                };
            } finally{
                clearTimeout(timer);
            }
        },
        async streamChat (opts, handlers, timeoutMs) {
            if (!config.token) throw new CozeApiError('Coze token 未配置', -1, '');
            const controller = new AbortController();
            const timer = setTimeout(()=>controller.abort(), timeoutMs ?? timeout);
            try {
                const res = await fetch(buildUrl(baseUrl, '/v3/chat', {}), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${config.token}`
                    },
                    body: JSON.stringify({
                        ...opts,
                        stream: true
                    }),
                    signal: controller.signal
                });
                if (!res.ok || !res.body) {
                    throw new CozeApiError(`HTTP ${res.status}`, res.status, await res.text().catch(()=>''));
                }
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                for(;;){
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, {
                        stream: true
                    });
                    let nl;
                    while((nl = buffer.indexOf('\n')) !== -1){
                        const line = buffer.slice(0, nl).replace(/\r$/, '');
                        buffer = buffer.slice(nl + 1);
                        if (!line || line.startsWith(':') || !line.startsWith('data:')) continue;
                        const data = line.slice(5).trim();
                        if (data === '[DONE]') continue;
                        try {
                            const json = JSON.parse(data);
                            if (json?.code && json.code !== 0) throw new CozeApiError(json.msg || `code=${json.code}`, json.code, data);
                            const delta = json?.delta ?? json?.content ?? json?.data?.content;
                            if (typeof delta === 'string' && delta) handlers.onDelta?.(delta);
                        } catch (e) {
                            if (e instanceof CozeApiError) throw e;
                        }
                    }
                }
                handlers.onDone?.();
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    handlers.onError?.(new Error('请求超时或被取消'));
                    return;
                }
                handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
            } finally{
                clearTimeout(timer);
            }
        }
    };
}
}),
"[project]/packages/api-client/src/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$api$2d$error$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/api-error.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$transport$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/transport.ts [app-ssr] (ecmascript)");
// 模型上下文容量映射(跨端共享:web/desktop/extension/mobile-rn/miniapp-taro)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$model$2d$context$2d$capacity$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/model-context-capacity.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$circuit$2d$breaker$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/circuit-breaker.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$utils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/utils.ts [app-ssr] (ecmascript)");
// WebSocket 跨端客户端(框架无关,各端写薄包装层)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$ws$2d$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/ws-client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/types/src/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$admin$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/admin.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$admin$2d$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/admin-auth.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$admin$2d$business$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/admin-business.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$admin$2d$content$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/admin-content.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$admin$2d$member$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/admin-member.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$admin$2d$monitor$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/admin-monitor.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$admin$2d$system$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/admin-system.ts [app-ssr] (ecmascript)");
// P1-2.2a: SaaS 部署层管理后台 API 端点
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$admin$2d$tenants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/admin-tenants.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$agent$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/agent.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$agent$2d$runtime$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/agent-runtime.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$ai$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/ai.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$ai$2d$media$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/ai-media.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$auth$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/auth.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$banner$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/banner.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$business$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/business.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$category$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/category.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$chat$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/chat.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$community$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/community.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$course$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/course.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$crew$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/crew.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$developer$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/developer.ts [app-ssr] (ecmascript)");
// 浏览器降级端点(2026-07-22 立,P1 WorkPanel iframe 降级)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$browser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/browser.ts [app-ssr] (ecmascript)");
// Browser Hub CDP 端点(2026-07-31 立,P0 WorkPanel CDP 完整 Chrome 升级)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$browser$2d$hub$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/browser-hub.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$distribution$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/distribution.ts [app-ssr] (ecmascript)");
// 挣钱中心仪表盘 API(2026-07-31 立,P0 挣钱核心,跨端共享)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$earnings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/earnings.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$edu$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/edu.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$exam$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/exam.ts [app-ssr] (ecmascript)");
// 文件上传端点(2026-07-28 立,mobile-rn AigcPublishScreen 接入真实文件选择+上传)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$files$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/files.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$learn$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/learn.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$live$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/live.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$llm$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/llm.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$knowledge$2d$rag$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/knowledge-rag.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$member$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/member.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$misc$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/misc.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$notification$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/notification.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$order$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/order.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$payment$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/payment.ts [app-ssr] (ecmascript)");
// 插件市场 API(2026-07-22 立,跨端共享)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$plugin$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/plugin.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$resource$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/resource.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$share$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/share.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$social$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/social.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$srs$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/srs.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$study$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/study.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$subscription$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/subscription.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$system$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/system.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$voice$2d$stt$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/voice-stt.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$teacher$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/teacher.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$token$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/token.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$user$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/user.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$vip$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/vip.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$wallet$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/wallet.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$workspace$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/workspace.ts [app-ssr] (ecmascript)");
// 架构迁移审计 P2 v2 补开发:5 个新端点共享封装(private-letters / wrong-questions / mail / auth-codes / exam-marking)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$auth$2d$codes$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/auth-codes.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$chat$2d$skills$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/chat-skills.ts [app-ssr] (ecmascript)");
// AI Skills TOP 19 个 skill 端点(2026-07-23 新增,跨端共享)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$ai$2d$skills$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/ai-skills.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$exam$2d$marking$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/exam-marking.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$mail$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/mail.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$private$2d$letters$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/private-letters.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$wrong$2d$questions$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/wrong-questions.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$admin$2d$tool$2d$gen$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/admin-tool-gen.ts [app-ssr] (ecmascript)");
// 旧架构 edu-web 公开 API 端点(2026-07-22 立)
// 覆盖 audit 清单中 carousels/agreements/announcements/points/search 公开端点
// 旧函数名通过 apps/web/src/lib/legacy-edu-api.ts 桥接
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$legacy$2d$public$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/legacy-public.ts [app-ssr] (ecmascript)");
// 多平台一键发布(账号 + 任务 + 扫码登录,2026-07-30 新增)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$publish$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/publish.ts [app-ssr] (ecmascript)");
// Coze 平台 API 端点(2026-07-27 立,PAT 直连 Coze 官方 API,跨端共享)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$api$2d$client$2f$src$2f$endpoints$2f$coze$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/api-client/src/endpoints/coze.ts [app-ssr] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
}),
];

//# sourceMappingURL=packages_api-client_src_55a9af0e._.js.map