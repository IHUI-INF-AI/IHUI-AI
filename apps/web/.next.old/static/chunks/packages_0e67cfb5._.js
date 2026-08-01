(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/packages/design-tokens/src/cn.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cn",
    ()=>cn
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$clsx$40$2$2e$1$2e$1$2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$tailwind$2d$merge$40$2$2e$6$2e$1$2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/tailwind-merge@2.6.1/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-client] (ecmascript)");
;
;
function cn() {
    for(var _len = arguments.length, inputs = new Array(_len), _key = 0; _key < _len; _key++){
        inputs[_key] = arguments[_key];
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$tailwind$2d$merge$40$2$2e$6$2e$1$2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$clsx$40$2$2e$1$2e$1$2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/design-tokens/src/rn-tokens.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * RN 专用设计令牌(mobile-rn / packages/app 共享)。
 *
 * 与 web 端 HSL shadcn 色板(packages/design-tokens/src/styles/tokens.css)并存,理由:
 * - RN NativeWind 4.x 仅支持 Tailwind v3,不兼容 v4 @theme HSL 语法
 * - RN 端用 HEX 表达,与 React Native StyleSheet 数字化颜色约定一致
 * - 单一源头:此文件为 RN tokens 唯一定义处,packages/app/theme/tokens.ts 仅 re-export
 *
 * 跨端颜色对齐策略(2026-07-28 更新,对齐 web tokens.css 2026-07-24 消除绿色改纯黑):
 * - brand.DEFAULT = #000000(rnLight/base)↔ web 亮色 --color-primary = hsl(0 0% 0%)(纯黑)
 * - brand.DEFAULT = #FFFFFF(rnDark)↔ web 暗色 --color-primary = hsl(0 0% 100%)(纯白)
 * - surface.dark = #1F2937 ↔ web darkColors.card = hsl(0 0% 10%)(同深灰,保留 RN 端 Tab Bar 历史色)
 * 值漂移即 bug,修改时必须双向校对。
 */ /**
 * 扩展语义色:用于 mobile-rn 端状态徽章 / 卡片背景的细分层级。
 * - success.lighter / lightest:更浅的成功绿背景(d1fae5 / f0fdf4)
 * - success.deepText:深绿色文字(065F46,用于 success 卡片标签)
 * - warning.amber / amberLight / amberText / orangeLight:amber 警告色变体
 * - danger.bright:亮红色(ef4444,职位薪资等强调红)
 */ __turbopack_context__.s([
    "getRnTokens",
    ()=>getRnTokens,
    "rnDarkTokens",
    ()=>rnDarkTokens,
    "rnLightTokens",
    ()=>rnLightTokens,
    "rnTokens",
    ()=>rnTokens
]);
const rnTokens = {
    brand: {
        DEFAULT: '#000000',
        dark: '#34D399'
    },
    surface: {
        light: '#FFFFFF',
        muted: '#F9FAFB',
        card: '#F3F4F6',
        dark: '#1F2937'
    },
    text: {
        primary: '#111827',
        secondary: '#6B7280',
        tertiary: '#9CA3AF',
        medium: '#374151'
    },
    border: {
        light: '#E5E7EB',
        medium: '#D1D5DB'
    },
    error: {
        bg: '#FEE2E2',
        text: '#B91C1C'
    },
    overlay: {
        modal: 'rgba(0,0,0,0.4)'
    },
    indigo: {
        light: '#eef2ff',
        DEFAULT: '#6366f1',
        deep: '#4f46e5'
    },
    purple: {
        light: '#f5f3ff',
        DEFAULT: '#7B61FF'
    },
    warning: {
        light: '#fffbeb',
        amberLight: '#fef3c7',
        orangeLight: '#fff7ed',
        amber: '#f59e0b',
        DEFAULT: '#d97706',
        amberText: '#92400e',
        deep: '#FF6B00'
    },
    success: {
        lightest: '#f0fdf4',
        lighter: '#d1fae5',
        light: '#ecfdf5',
        DEFAULT: '#10B981',
        deep: '#16a34a',
        deepText: '#065F46'
    },
    danger: {
        light: '#fef2f2',
        DEFAULT: '#dc2626',
        bright: '#ef4444'
    },
    gray: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827',
        black: '#000'
    }
};
const rnLightTokens = {
    brand: {
        DEFAULT: '#000000',
        dark: '#34D399'
    },
    surface: {
        bg: '#FFFFFF',
        light: '#FFFFFF',
        muted: '#F9FAFB',
        card: '#F3F4F6',
        dark: '#1F2937'
    },
    text: {
        primary: '#111827',
        secondary: '#6B7280',
        tertiary: '#9CA3AF',
        medium: '#374151'
    },
    border: {
        light: '#E5E7EB',
        medium: '#D1D5DB'
    },
    error: {
        bg: '#FEE2E2',
        text: '#B91C1C'
    },
    overlay: {
        modal: 'rgba(0,0,0,0.4)'
    },
    indigo: {
        light: '#eef2ff',
        DEFAULT: '#6366f1',
        deep: '#4f46e5'
    },
    purple: {
        light: '#f5f3ff',
        DEFAULT: '#7B61FF'
    },
    warning: {
        light: '#fffbeb',
        amberLight: '#fef3c7',
        orangeLight: '#fff7ed',
        amber: '#f59e0b',
        DEFAULT: '#d97706',
        amberText: '#92400e',
        deep: '#FF6B00'
    },
    success: {
        lightest: '#f0fdf4',
        lighter: '#d1fae5',
        light: '#ecfdf5',
        DEFAULT: '#10B981',
        deep: '#16a34a',
        deepText: '#065F46'
    },
    danger: {
        light: '#fef2f2',
        DEFAULT: '#dc2626',
        bright: '#ef4444'
    },
    gray: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827',
        black: '#000'
    }
};
const rnDarkTokens = {
    brand: {
        DEFAULT: '#FFFFFF',
        dark: '#34D399'
    },
    surface: {
        bg: '#1F2937',
        light: '#FFFFFF',
        muted: '#111827',
        card: '#374151',
        dark: '#0F172A'
    },
    text: {
        primary: '#F9FAFB',
        secondary: '#9CA3AF',
        tertiary: '#6B7280',
        medium: '#D1D5DB'
    },
    border: {
        light: '#374151',
        medium: '#4B5563'
    },
    error: {
        bg: '#7F1D1D',
        text: '#FCA5A5'
    },
    overlay: {
        modal: 'rgba(0,0,0,0.6)'
    },
    indigo: {
        light: '#312e81',
        DEFAULT: '#6366f1',
        deep: '#818cf8'
    },
    purple: {
        light: '#4c1d95',
        DEFAULT: '#7B61FF'
    },
    warning: {
        light: '#451a03',
        amberLight: '#78350f',
        orangeLight: '#431407',
        amber: '#fbbf24',
        DEFAULT: '#f59e0b',
        amberText: '#fbbf24',
        deep: '#FF6B00'
    },
    success: {
        lightest: '#052e16',
        lighter: '#064e3b',
        light: '#052e16',
        DEFAULT: '#10B981',
        deep: '#16a34a',
        deepText: '#86efac'
    },
    danger: {
        light: '#450a0a',
        DEFAULT: '#ef4444',
        bright: '#f87171'
    },
    gray: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827',
        black: '#000'
    }
};
function getRnTokens(theme) {
    return theme === 'dark' ? rnDarkTokens : rnLightTokens;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/design-tokens/src/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/design-tokens/src/cn.ts [app-client] (ecmascript)");
// RN 专用 tokens(mobile-rn / packages/app 共享,HEX 表达,与 web HSL 并存)
// 注:web HSL token 集曾由 ./tokens.ts 提供,因 0 引用且与 tokens.css 严重漂移
// (colors.primary=绿色 vs --color-primary=黑色)已于 2026-07-28 删除。
// web 端 token 单一来源 = ./styles/tokens.css(@theme + .dark 覆盖)。
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$design$2d$tokens$2f$src$2f$rn$2d$tokens$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/design-tokens/src/rn-tokens.ts [app-client] (ecmascript)");
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/user.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/api.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/token.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Token 对跨端共享类型契约。
 *
 * 4 端统一引用(extension / web / api),取代各端本地重复定义。
 * refreshToken / expiresIn 设为可选(最宽松),兼容所有消费端用法;
 * 需要必填版本的端(如 api token-service)用 `Required<TokenPair>` 收窄。
 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/ai.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/cli-config.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * CLI 配置导入共享类型
 *
 * 用于 cc-switch / codex++ / 各 CLI 工具(Claude Code / Codex / Gemini CLI / Hermes 等)
 * 配置文件的统一导入。前后端、CLI、Desktop 共用。
 *
 * 关键约束:
 * - ImportedProvider.apiKey 仅在后端内存中存在,序列化到前端前必须经 maskApiKey 脱敏
 * - CliAppType 严格对齐 cc-switch Rust AppType 枚举(8 值)
 * - CliApiFormat 是 ApiFormat 的超集(扩展 gemini_native)
 */ /** 导入来源工具 */ __turbopack_context__.s([
    "maskApiKey",
    ()=>maskApiKey
]);
function maskApiKey(key) {
    if (!key) return '(空)';
    if (key.length <= 8) return '***';
    return "".concat(key.slice(0, 4), "***").concat(key.slice(-4));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/notification.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 通知与 WebSocket 消息类型(跨端共享唯一类型源)
 *
 * 涵盖:
 * - WebSocket 实时通知消息格式(WSNotification / AIResponseNotification)
 * - 通知业务类型(NotificationItem / MessageItem / UnreadCount)
 * - 客服会话(CustomerServiceSession / CustomerServiceMessage)
 *
 * 各端(api/web/desktop/extension/mobile-rn/miniapp-taro)统一从 @ihui/types 导入,
 * 禁止本地重复定义。
 */ // ===================== WebSocket 消息类型 =====================
/** WebSocket 通知推送消息(后端 /ws/notifications 推送格式) */ __turbopack_context__.s([
    "isAIQuestion",
    ()=>isAIQuestion,
    "isAIQuestionAnswered",
    ()=>isAIQuestionAnswered,
    "isAIResponse",
    ()=>isAIResponse
]);
function isAIResponse(n) {
    var _n_data, _n_data1;
    return !!n && ((_n_data = n.data) === null || _n_data === void 0 ? void 0 : _n_data.type) === 'ai_response' && !!((_n_data1 = n.data) === null || _n_data1 === void 0 ? void 0 : _n_data1.message);
}
function isAIQuestion(n) {
    var _n_data, _n_data1;
    return !!n && ((_n_data = n.data) === null || _n_data === void 0 ? void 0 : _n_data.type) === 'ai_question' && !!((_n_data1 = n.data) === null || _n_data1 === void 0 ? void 0 : _n_data1.question);
}
function isAIQuestionAnswered(n) {
    var _n_data, _n_data1;
    return !!n && ((_n_data = n.data) === null || _n_data === void 0 ? void 0 : _n_data.type) === 'chat_question_answered' && !!((_n_data1 = n.data) === null || _n_data1 === void 0 ? void 0 : _n_data1.questionId);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/notification-channels.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 通知渠道类型定义(短信/邮件/站内/推送/钉钉/飞书/企业微信)
 *
 * 各端(api/web/desktop)统一从 @ihui/types 导入,禁止本地重复定义。
 */ /** 通知渠道类型 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/message-repair.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 会话历史结构修复(messages 数组自愈)。
 *
 * 参考行业 Agent 框架的 session repair 扩展方法设计,CLI P37 第四次深度审计整合。
 * 跨端共享:CLI(本地 JSON 文件)+ API(/chat/stream 入口)+ ai-service(llm_gateway 兜底)共用同一套规则。
 *
 * 问题:Web/API/ai-service 链路中,messages 数组可能因各种原因出现结构异常,
 * 触发 LLM 400 错误或语义错乱:
 *   - 非法 role(tool/function 残留,Web 端不应传)
 *   - 空 content(输入框未填就发送)
 *   - 连续相同 role(用户连点发送 / 压缩残留)
 *   - 开头是 assistant(history 顺序错乱)
 *   - 末尾无响应的 user(用户发了消息但 AI 还没回)
 *
 * 修复规则(与 CLI repairSessionHistory 完全一致):
 *   1. 过滤非法 role(只保留 system/user/assistant,移除 tool/function/unknown 等)
 *   2. 过滤空 content(空字符串/纯空白)
 *   3. 去重连续相同 role(合并 content,用 \n\n 连接)
 *   4. 确保首条是 system 或 user(丢弃开头的 assistant,无前置 user 的 stale response)
 *   5. 移除末尾无响应的 user 消息(前面有 assistant 响应时才移除,首轮 user 保留)
 *
 * 注意:本函数过滤 tool role。tool role 只在 ai-service 内部 agent_loop
 * (LangGraph 工具调用结果)使用,不应出现在 Web → API 入口的 messages 中。
 * ai-service 内部 agent_loop 不应调用本函数(其 messages 由 LangGraph 管理)。
 */ __turbopack_context__.s([
    "repairMessages",
    ()=>repairMessages
]);
const VALID_ROLES = new Set([
    'system',
    'user',
    'assistant'
]);
function repairMessages(messages) {
    const reasons = [];
    let removed = 0;
    // Rule 1+2:过滤非法 role + 空 content
    let cleaned = messages.filter((m)=>{
        if (!m || typeof m !== 'object') {
            removed++;
            return false;
        }
        if (!VALID_ROLES.has(m.role)) {
            reasons.push("移除非法 role: ".concat(m.role));
            removed++;
            return false;
        }
        if (typeof m.content !== 'string' || m.content.trim() === '') {
            reasons.push("移除空 content(role=".concat(m.role, ")"));
            removed++;
            return false;
        }
        return true;
    });
    // Rule 3:去重连续相同 role(合并 content)
    const deduped = [];
    for (const m of cleaned){
        const last = deduped[deduped.length - 1];
        if (last && last.role === m.role) {
            reasons.push("合并连续 ".concat(m.role, " 消息"));
            last.content = "".concat(last.content, "\n\n").concat(m.content);
        } else {
            deduped.push({
                ...m
            });
        }
    }
    cleaned = deduped;
    // Rule 4:确保首条是 system 或 user(丢弃开头的 assistant)
    while(cleaned.length > 0 && cleaned[0].role === 'assistant'){
        reasons.push('移除开头的 assistant 消息(无前置 user)');
        cleaned.shift();
        removed++;
    }
    // Rule 5:移除末尾无响应的 user 消息(前面有 assistant 响应时才移除,首轮 user 保留)
    if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === 'user') {
        const hasAssistant = cleaned.some((m)=>m.role === 'assistant');
        if (hasAssistant) {
            reasons.push('移除末尾无 assistant 响应的 user 消息(可能是 interjection 残留)');
            cleaned.pop();
            removed++;
        }
    }
    return {
        repaired: cleaned,
        removed,
        reasons
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/agent-runtime.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/workspace.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Workspace wire 类型,adjacent tagging({ type: '...', data: { ... } })
// 参考 ACP 协议设计,与多端共享
// ============ 基础 ID 类型 ============
__turbopack_context__.s([
    "isToolChunk",
    ()=>isToolChunk,
    "isWorkspaceEvent",
    ()=>isWorkspaceEvent,
    "isWorkspaceRequest",
    ()=>isWorkspaceRequest
]);
function isWorkspaceRequest(x) {
    return typeof x === 'object' && x !== null && 'type' in x && 'data' in x;
}
function isToolChunk(x) {
    if (typeof x !== 'object' || x === null || !('type' in x) || !('data' in x)) {
        return false;
    }
    const typeValue = x.type;
    return typeof typeValue === 'string' && typeValue.startsWith('tool_call_');
}
function isWorkspaceEvent(x) {
    return typeof x === 'object' && x !== null && 'type' in x && 'data' in x;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/plugin.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 插件市场跨端共享类型契约 (2026-07-22 立)
 *
 * 设计哲学:
 *  - 后端只管"安装态"(installState),插件目录(catalog)由前端静态数据提供
 *  - 复用 user_preferences 表(group='plugins', key=pluginId, value=JSON),零迁移
 *  - pluginId 一经发布不可变,作为 user_preferences.key 持久化
 *
 * 跨端使用:web / desktop / extension / mobile-rn / miniapp-taro / cli
 * 都通过 @ihui/types 统一导入,避免重复定义。
 */ /**
 * 单个插件的安装状态(持久化在 user_preferences.value 中,JSON 字符串)
 *  - installedAt: ISO8601 安装时间(utc)
 *  - pinned:     是否收藏/置顶(影响排序)
 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/agent-control.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * AI 自动控制跨端契约(2026-07-22 立)
 *
 * 定义 AI 在对话中调用浏览器/电脑控制能力时,ai-service MCP tool → api → extension/desktop 的跨端消息契约。
 * - browser_control.* 由 extension 执行(content script DOM 操作 + 截图)
 * - computer_control.* 由 desktop 执行(Tauri IPC + screenshots/enigo/arboard crate)
 *
 * 数据传输:截图统一用 base64 dataURL(无 'data:image/png;base64,' 前缀),避免二进制传输复杂度。
 */ // ================== Browser Control(由 extension 执行)==================
__turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/work-panel.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 工作展示区(WorkPanel)跨端契约类型
 * 用于 AI 对话内嵌浏览器 / URL 预览 / Artifact 展示
 * 跨端共享: web + desktop + mobile-rn + miniapp-taro + extension
 */ /** 工作展示区 Tab 类型 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/api-contracts.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端 API 契约类型 — 单一导入面。
 *
 * 范围:web / api / ai-service / desktop / extension / mobile-rn / miniapp-taro / cli
 *       八端共享 API 契约类型(用户/认证/分页/通知/消息/WebSocket/工作区/智能体/AI 聊天)。
 *
 * 设计原则:
 * 1. **纯类型,无运行时** — 仅 `interface` / `type` 声明 + 类型守卫(无业务数据,无副作用)。
 * 2. **零冗余** — 全部 `export type` / `export` 自 `@ihui/types` 子模块,不重新定义。
 * 3. **稳定入口** — 各端从此处导入共享类型,避免散落在 `endpoints/*` 文件中。
 *
 * 注意:
 * - 端点专属类型(AuthUser / AiModel / CourseItem / ...)继续在 `@ihui/api-client/endpoints/*` 中定义
 *   (与运行时 fetch 函数就近耦合),各端通过 `@ihui/api-client` 导入。
 * - 本文件只承载**跨端共享的、不与特定 fetch 函数耦合的**契约类型。
 * - 命名冲突已显式 `export type`(详见 @ihui/types/index.ts 的 PermissionMode/PermissionDecision 注释)。
 */ // ===================== 用户与认证 =====================
__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$notification$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/notification.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$message$2d$repair$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/message-repair.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$workspace$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/workspace.ts [app-client] (ecmascript)");
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/legacy-migration.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 旧架构迁移补齐类型定义 (2026-07-22)
 *
 * 来源: git commit 3ee96cf09 (旧架构 client/src/api/*) 中存在但新架构未独立导出的类型。
 * 路由功能已迁移并连通 (apps/api/src/routes/*),但类型定义未迁移到共享类型层。
 * 本文件将这些类型集中到 packages/types,供跨端共享引用。
 *
 * P0 (28 组): 纯类型定义文件 — 路由已存在,类型未独立导出
 * P3 (7 组): FastAPI/监控/OAuth 类型 — 确认无新架构替代类型
 */ // ═══════════════════════════════════════════════════════════
// 1. Admin Dashboard 模块
// ═══════════════════════════════════════════════════════════
__turbopack_context__.s([
    "EduPlatformType",
    ()=>EduPlatformType
]);
var EduPlatformType = /*#__PURE__*/ function(EduPlatformType) {
    EduPlatformType[EduPlatformType["ADMIN"] = 1] = "ADMIN";
    EduPlatformType[EduPlatformType["USER"] = 2] = "USER";
    return EduPlatformType;
}({});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/ide-workspace.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * IDE 工作区跨端类型契约(2026-07-22 立,2026-07-22 修订前后端连通)
 *
 * 仿 TRAE/Codex IDE 界面的类型定义,供 web 端 IDE 组件使用。
 * 前后端连通:web 端消费类型,api 端通过 /api/workspace/fs/* 端点提供数据。
 * - FileNode / EditorTab / SearchResult / GitChange → 由 FS Bridge 端点提供数据
 * - Breakpoint / StackFrame / DebugVariable / LaunchConfig → 前端内存/localStorage
 * - OutlineNode → 可由 /api/workspace/codebase/search 提供数据
 * - DiffFile → 由 git diff 数据转换
 */ /** 左侧 activity bar 视图类型 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/api-key.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 开发者 API Key 跨端契约(2026-07-22 立)。
 *
 * 解决问题:此前 permissions 字段为任意字符串数组,无枚举、无校验、无中间件。
 * 本文件定义权限点枚举 + 鉴权请求/响应类型,供 api / web / 共享层引用。
 *
 * 鉴权链路契约:
 * - 入站 header:`Authorization: Bearer ihui_xxx`(公开标识)或 `X-Api-Key: ihui_xxx`
 * - 可选 secret 校验:`X-Api-Secret: sk_xxx`(创建/轮换时返回,存储为 sha256 哈希)
 * - 鉴权中间件:authenticateApiKey + requireApiKeyPermission(perm)
 * - 配额:ApiKeyQuota.checkAndConsume,超限返回 429
 */ /**
 * API Key 权限点枚举。
 * 与 /v1/* 对外路由一一对应,新增端点必须同步新增权限点。
 *
 * 2026-07-22 扩展:从 7 个扩展到 27 个,覆盖全功能对外开放。
 */ __turbopack_context__.s([
    "API_KEY_PERMISSIONS",
    ()=>API_KEY_PERMISSIONS,
    "API_KEY_PERMISSION_SET",
    ()=>API_KEY_PERMISSION_SET,
    "isValidApiKeyPermission",
    ()=>isValidApiKeyPermission
]);
const API_KEY_PERMISSIONS = [
    // ===== Agent 类 =====
    /** 读取 Agent 列表/详情:GET /v1/agents, GET /v1/agents/:id */ 'agents:read',
    /** 调用 Agent:POST /v1/agents/:id/call, POST /v1/agents/execute */ 'agents:call',
    // ===== Chat / LLM 类 =====
    /** 读取 Chat 会话:GET /v1/chat/sessions */ 'chat:read',
    /** 发起 Chat 补全:POST /v1/chat/completions, POST /v1/chat/vision, POST /v1/chat/moa */ 'chat:write',
    // ===== Models 类 =====
    /** 读取模型列表/详情:GET /v1/models, GET /v1/models/:id */ 'models:read',
    /** 用户自定义模型配置:GET/POST/PUT/DELETE /v1/user/models */ 'models:write',
    // ===== Embeddings 类 =====
    /** Embedding 向量生成:POST /v1/embeddings */ 'embeddings:write',
    // ===== Files 类 =====
    /** 读取文件列表/详情/内容:GET /v1/files, GET /v1/files/:id, GET /v1/files/:id/content */ 'files:read',
    /** 上传/管理文件:POST /v1/files, DELETE /v1/files/:id, POST /v1/files/upload-init */ 'files:write',
    // ===== Audio 类 =====
    /** 读取音色/声纹:GET /v1/audio/voices, GET /v1/audio/speakers */ 'audio:read',
    /** TTS/ASR/语音对话/声纹注册:POST /v1/audio/speech, POST /v1/audio/transcriptions */ 'audio:write',
    // ===== Images 类 =====
    /** 文生图/图片编辑/修复/风格迁移:POST /v1/images/generations, POST /v1/images/edits */ 'images:write',
    // ===== Videos 类 =====
    /** 视频生成/编排:POST /v1/videos/generations, POST /v1/videos/compose */ 'videos:write',
    /** 视频任务查询:GET /v1/videos/tasks/:id */ 'videos:read',
    // ===== 3D 类 =====
    /** 3D 模型生成:POST /v1/3d/generations */ 'threed:write',
    // ===== Generation 队列类 =====
    /** 生成队列入队/取消/状态:POST /v1/generation/enqueue, GET /v1/generation/status/:id */ 'generation:write',
    // ===== Knowledge / RAG 类 =====
    /** 知识库文档/分块/搜索/RAG:GET /v1/knowledge/documents, POST /v1/knowledge/search */ 'knowledge:read',
    /** 文档入库/删除/知识图谱:POST /v1/knowledge/documents, DELETE /v1/knowledge/documents/:id */ 'knowledge:write',
    // ===== MCP Tools 类 =====
    /** MCP 工具/资源/提示词/技能查询:GET /v1/tools, GET /v1/resources, GET /v1/prompts */ 'tools:read',
    /** MCP 工具调用/sampling/slash 命令:POST /v1/tools/call, POST /v1/sampling */ 'tools:call',
    // ===== Memory 类 =====
    /** 记忆召回/语义搜索:GET /v1/memory, POST /v1/memory/search */ 'memory:read',
    /** 记忆保存/遗忘/Dream:POST /v1/memory, DELETE /v1/memory, POST /v1/memory/dream */ 'memory:write',
    // ===== Messages 类 =====
    /** 消息状态查询:GET /v1/messages/:id/status */ 'messages:read',
    /** 消息发布/订阅:POST /v1/messages, POST /v1/messages/subscribe */ 'messages:write',
    // ===== User / Workspace 类 =====
    /** 当前用户信息:GET /v1/me */ 'user:read',
    /** 工作区项目/文件:GET /v1/projects, GET /v1/projects/:id/files */ 'workspace:read',
    // ===== Workflows 类 =====
    /** 工作流定义查询:GET /v1/workflows/:id */ 'workflows:read',
    /** 工作流实例执行:POST /v1/workflows/instances, POST /v1/workflows/coze/run */ 'workflows:write',
    // ===== Stats 类 =====
    /** 使用量统计:GET /v1/usage, GET /v1/usage/:vendor */ 'stats:read'
];
const API_KEY_PERMISSION_SET = new Set(API_KEY_PERMISSIONS);
function isValidApiKeyPermission(value) {
    return API_KEY_PERMISSION_SET.has(value);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/v1-endpoints.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * /v1/* 对外开放 API 端点请求/响应类型契约(2026-07-22 立)。
 *
 * 配套 api-key.ts 的 27 个权限点,覆盖全功能对外开放。
 * 字段命名统一 camelCase(非 OpenAI snake_case),与 @ihui/types 契约一致。
 *
 * 端点分组(与后端路由文件对应):
 * - AI 核心:chat / embeddings / models / agents 高级执行
 * - 多模态:audio / images / videos / 3d / generation
 * - 知识工具:knowledge / tools / memory / messages
 * - 资源管理:files 补齐 / user / workspace / workflows / stats
 */ // =============================================================================
// 1. AI 核心 - Chat / Embeddings / Models
// =============================================================================
/** POST /v1/embeddings 请求体(OpenAI 兼容)。 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/memory.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 四层记忆系统跨端契约类型(2026-07-22 立,对标 OpenClaw Mem)。
 *
 * 四层架构:
 * - working:工作记忆(当前会话内存缓冲,不持久化,LRU 上限 50 条)
 * - episodic:情景记忆(历史会话片段,PostgreSQL 持久化 + 遗忘曲线衰减)
 * - semantic:语义记忆(向量检索知识,pgvector 1536 维 + cosine similarity)
 * - procedural:程序记忆(技能/工具用法模式,success/failure 计数)
 *
 * Dream 梦境机制:空闲时把短期记忆 Consolidation 到长期向量库,提取跨会话模式。
 */ /** 记忆层枚举 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/webhook-trigger.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Webhook 唤醒机制跨端契约类型(2026-07-22 立,深度对标并反超 OpenClaw webhook 触发)。
 *
 * 相比 OpenClaw 只能"接收 webhook 触发 agent",本契约扩展:
 * - HMAC-SHA256 签名验证(防时序攻击)
 * - 路由到指定 agent(agentId)
 * - 触发后异步执行(立即返回 202,后台执行)
 * - 指数退避重试(1s / 2s / 4s,最多 3 次)
 * - 审计日志(每次触发记录签名/条件/状态)
 * - 可配置触发条件(payload 字段匹配规则,支持 eq/neq/contains/regex/exists)
 */ // ================== 触发条件 ==================
/** payload 字段匹配条件 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/webhook.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** Webhook 唤醒机制跨端契约(Wave 3 W3-3 简化唤醒 Bearer token) */ /** webhook 唤醒请求入参(Bearer token 鉴权) */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/message-bus.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** 多通道消息总线跨端契约(Wave 3 W3-2 对标 OpenClaw 多通道消息) */ /** 消息总线支持的外部 IM 渠道 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/leaderboard.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 大模型排行榜共享类型(跨端共享)。
 * 参考 arena.ai/leaderboard,Elo 评分 + 排名 + 核心参数 + 能力雷达。
 */ /** 模型分类(6 类 + agent 智能体) */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/terminal.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 终端会话跨端类型契约(2026-07-22 立,xterm.js + node-pty + WebSocket 全链路)。
 *
 * Web 端消费:terminal store + use-terminal-session hook + terminal-panel 组件。
 * API 端消费:terminal-service + routes/terminal + plugins/terminal-ws。
 */ /** 终端会话状态 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/rules.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Rules 引擎跨端类型契约(2026-07-22 立,对标 Trae IDE Rules)。
 *
 * Rule = 用户可编辑的规则集,约束 agent 运行时行为。
 * 与 AGENTS.md(项目级强制规则)互补:AGENTS.md 是人读 + 守门脚本执行,
 * Rule 是 agent 运行时动态加载 + 注入 system prompt。
 *
 * 存储:ai-service 端用文件系统(.trae-cn/rules/*.md frontmatter),不走数据库。
 * 匹配:always / keyword / regex / semantic(embedding cosine)。
 */ /** 规则作用域 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/hooks.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Web Hook 服务跨端契约类型(2026-07-22 立,对标 Trae IDE Hooks)。
 *
 * 设计:
 *  - Hook 引擎位于 ai-service,提供事件总线 emit(event, context) 接口
 *  - Hook 配置:事件 + 条件(JSONLogic) + 动作(webhook/script/log/notify)
 *  - apps/api 仅做 JWT 鉴权 + Zod 校验后转发到 ai-service,自身不存储状态
 *  - 前端 web 通过 /api/hooks/* 管理配置 + 查看日志 + 触发测试
 *
 * 命名说明:
 *  - 类型用 `HookTrigger*` 前缀(而非 `HookEvent`),避免与 agent-runtime.ts
 *    已有的 `HookEvent`(`preToolCall/postToolCall` 等)在 `@ihui/types` 主入口冲突
 *  - 与既有 webhook-trigger.ts 的区别:
 *    - webhook-trigger 是"接收外部 webhook 触发 agent"(被动接收)
 *    - 本 hooks 是"agent 行为事件触发外部动作"(主动发出,事件总线模式)
 */ // ================== Hook 触发事件 ==================
/** Hook 触发事件类型(agent 行为事件) */ __turbopack_context__.s([
    "HOOK_ACTION_TYPES",
    ()=>HOOK_ACTION_TYPES,
    "HOOK_TRIGGER_EVENTS",
    ()=>HOOK_TRIGGER_EVENTS,
    "hookEventGroup",
    ()=>hookEventGroup
]);
function hookEventGroup(event) {
    if (event === 'tool.before' || event === 'tool.after') return 'tool';
    if (event === 'message.send' || event === 'message.receive') return 'message';
    if (event === 'session.start' || event === 'session.end') return 'session';
    return 'error';
}
const HOOK_TRIGGER_EVENTS = [
    'tool.before',
    'tool.after',
    'message.send',
    'message.receive',
    'session.start',
    'session.end',
    'error'
];
const HOOK_ACTION_TYPES = [
    'webhook',
    'script',
    'log',
    'notify'
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/spec.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Spec 模式类型定义(2026-07-22 立,2026-07-24 整合去重)。
 *
 * 跨端共享类型(SpecScopeType / SpecSection / SpecScope / SpecGenerateInput / SpecTemplate
 * / SpecDocument / SpecGenerateResult / SpecHistoryEntry / SpecDiff / SpecVariable 等)
 * 已统一到 @ihui/shared/spec(index.ts),本文件仅保留 @ihui/types 独有类型:
 *  - ChatMode(web stores/mode.ts 独有,4 态对话模式;2026-07-28 移除 mode-switcher.tsx 后由
 *    message-input.tsx CurrentModeBadge 显示当前模式,use-chat.ts suggestMode 做自动判断)
 *  - SpecStats(api spec-service.ts + web spec-panel.tsx 独有,字段与 shared SpecGenerateResult.stats 不同)
 *  - SpecGenerateOutput(api spec-service.ts + web spec-panel.tsx 独有,与 shared SpecGenerateResult 字段不同)
 *
 * 设计说明:@ihui/types 与 @ihui/shared 互不依赖(平级包,见两者 package.json dependencies),
 * 因此 SpecGenerateOutput.sections 不能引用 @ihui/shared 的 SpecSection,采用内联结构类型
 * (TypeScript 结构类型系统下与 shared SpecSection 兼容,可互相赋值)。
 *
 * 历史清理(2026-07-24):
 *  - 删除重复的 SpecScopeType 定义(与 @ihui/shared/spec 重复,消费者改从 @ihui/shared 导入)
 *  - 删除重复的 SpecSection 导出(与 @ihui/shared/spec 重复,改为 SpecGenerateOutput 内联)
 *  - SpecGenerateResponseData / SpecTemplatesResponseData 为死代码(零消费者),已删除
 */ /** 对话模式(对标 CLI mode-manager.ts 的 WorkMode,扩展 spec 四态) */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/context-mention.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Context Mention 跨端类型契约(2026-07-22 立,对标 Qoder 多维 @ 提及)。
 *
 * 支持 5 类上下文提及:file / database / symbol / folder / web。
 * 由 packages/types 集中导出,apps/api 路由响应 + apps/web store/hooks/组件共用。
 */ /** 提及类型 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/orchestration.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨支柱编排中枢 — 共享类型契约(2026-07-23 立)。
 *
 * 让 6 大超越支柱(Rules/Hook/Spec/Context/Subagent/Terminal)
 * 通过事件总线协同决策,统一 LLM 预算治理与遥测。
 */ // ---------------------------------------------------------------------------
// 支柱枚举
// ---------------------------------------------------------------------------
__turbopack_context__.s([
    "PILLARS",
    ()=>PILLARS,
    "PILLAR_EVENT_TYPES",
    ()=>PILLAR_EVENT_TYPES
]);
const PILLARS = [
    'rules',
    'hook',
    'spec',
    'context',
    'subagent',
    'terminal',
    'budget'
];
const PILLAR_EVENT_TYPES = [
    'rules.matched',
    'rules.violated',
    'rules.conflict_resolved',
    'rules.auto_generated',
    'hook.emitted',
    'hook.failed',
    'hook.health_degraded',
    'hook.ab_test_completed',
    'spec.generated',
    'spec.approved',
    'spec.rejected',
    'spec.task_split',
    'spec.patch_applied',
    'context.compressed',
    'context.enriched',
    'context.behavior_recorded',
    'subagent.dispatched',
    'subagent.completed',
    'subagent.failed',
    'subagent.evolved',
    'terminal.command_failed',
    'terminal.command_succeeded',
    'terminal.ai_diagnosed',
    'terminal.recording_completed',
    'budget.exceeded',
    'budget.warning'
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/langgraph.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** LangGraph checkpoint 状态 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/education.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/** SM-2 间隔重复算法参数 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/registry.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 资源上游自动同步中心跨端契约类型(2026-07-24 立)。
 *
 * 设计目标:统一描述 MCP / Skill / Plugin 三类资源从多上游源
 * (GitHub / npm / MCP marketplace / 自建 registry)拉取、缓存、
 * 评分、安装、升级、回滚的完整生命周期,以及 webhook 触发记录
 * 持久化、Provider 模型列表动态拉取、上游配置漂移检测与自动迁移。
 */ // ================== 基础枚举 ==================
/** 资源类型 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/app.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端 app 组件类型契约 — @ihui/types
 *
 * 从 packages/app/src/types.ts 迁移而来(2026-07-25),作为单一来源。
 * web/miniapp-taro 可直接 `import type { SharedUser } from '@ihui/types'`,
 * 无需安装 @ihui/rn-app(后者有 react-native peerDep)。
 * packages/app/src/types.ts 改为 re-export 本文件,保持向后兼容(mobile-rn 不受影响)。
 *
 * 平台无关的 props 契约,RN/web wrapper 通过 props 注入平台实现
 * (i18n t 函数、导航、API 调用、Alert/Confirm 弹窗等),
 * 共享组件只负责纯 UI 渲染,不直接依赖任何平台 API。
 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/coze.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Coze 跨端共享类型定义
 * 各端 Coze 客户端禁止本地定义类型,必须 import 本文件。
 * 字段命名与 Coze 官方 API 保持一致(snake_case),token/baseUrl/botId/timeout 为本地配置。
 */ /** Coze 客户端配置(PAT 直连 Coze 官方 API) */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/pay.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端支付参数类型(从 apps/miniapp-taro/src/utils/pay.ts 下沉)。
 *
 * 注意:AnyPayParams 是 WxPayParams & AliPayParams 的交集类型(非联合),
 * 兼容微信/支付宝双端字段共存场景。
 */ /** 支付平台标识 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/share.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端分享信息类型(从 apps/miniapp-taro/src/utils/share.ts 下沉)。
 */ /** 分享给朋友(shareAppMessage)的参数 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/ui-native-components.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 跨端组件共享类型(mobile-rn + miniapp-taro 同名组件)
 *
 * 设计原则:
 * - 只提取两端完全相同或语义相同的类型
 * - 字段名不同的 Props 不统一(保留两端各自定义),仅统一 Item 类型
 * - 命名采用组件前缀避免冲突(如 TitleSwitchOverlapItem 而非 TitleSwitchItem)
 * - 差异大的组件对提取 Minimal Props(只含两端公共语义字段),各端本地 Props 可 extends
 *
 * 字段名映射说明(两端语义相同但命名不同,未提取统一 Props):
 * - Carousel: mobile-rn 用 banner/autoplayInterval/onItemPress,
 *             miniapp-taro 用 items/autoplay/interval/onItemClick/className
 * - Menu: mobile-rn 用 onPress,miniapp-taro 用 onItemClick/className
 * - VideoPlayer: mobile-rn 用 url(必选)/onProgress/onComplete/startPosition/VideoComponent,
 *                miniapp-taro 用 src(可选)/onTimeUpdate/onEnded/poster/autoplay/controls/className
 *                (字段名不同,提取 VideoPlayerMinimalProps 仅含公共语义字段,以 mobile-rn 命名为准)
 * - UserInfoCard: mobile-rn 用 `userInfo: UserInfo` 对象结构 + 登录/编辑/充值回调,
 *                 miniapp-taro 用扁平 props(avatar/nickname/level/levelTitle/isVip/vipTitle/desc/className)
 *                 (结构完全不同,提取 UserInfo 数据类型 + UserInfoCardMinimalProps 扁平公共字段)
 * - AiModelCard: mobile-rn 用 `data: AiModelData` 对象结构 + type('view'|'buy') + onBuyPress,
 *                miniapp-taro 用扁平 props(name/description/extra/className)
 *                (结构不同,提取 AiModelData/AiModelUserType 数据类型 + AiModelCardMinimalProps 扁平公共字段)
 * - VoiceInput: mobile-rn 额外有 aiServiceUrl/language,miniapp-taro 额外有 onError
 *               (公共字段提取为 VoiceInputMinimalProps,各端 extends)
 */ // ===== Carousel =====
/** 轮播图单项数据(两端完全相同) */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/admin-types.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Admin 后台业务类型契约(2026-07-28 立)
 *
 * 来源:从 apps/web/app/(main)/admin 下 9 个 types.ts 文件下沉的通用业务类型。
 * 命名策略:
 *  - 与 packages/types 已有类型(legacy-migration.ts 的 Article / News)冲突的,加业务前缀
 *    (AdminArticle / NewsArticle / NewsInformation 等);
 *  - 与 @ihui/api-client 已有同名但语义不同的类型(api-client/learn.ts Member / MemberLevel、
 *    api-client/resource.ts Resource、api-client/system.ts Category、api-client/agent.ts
 *    Agent / AgentStatus)冲突的,加业务前缀(AdminMember / AdminMemberLevel / AdminResource /
 *    AdminCategory / CsAgent / CsAgentStatus);
 *  - 无冲突的保留原名(OrderStatus / RefundStatus / EduOrder / InvoiceTitle / WithdrawalItem 等)。
 *
 * 各 admin types.ts 通过 `export type { AdminArticle as Article, ... } from '@ihui/types'`
 * 保持外部引用名称不变。
 */ // ===================== 订单 / 退款 / 发票(orders) =====================
/**
 * 订单状态。
 * 必须与 @ihui/api-client endoints/order.ts 的 OrderStatus 对齐(7 值完整枚举)。
 * admin/orders/types.ts 原仅 4 值(pending/paid/cancelled/refunded),此处采用完整枚举。
 */ __turbopack_context__.s([]);
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$user$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/user.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$api$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/api.ts [app-client] (ecmascript)");
// Token 对跨端共享类型(4 端统一引用,取代各端本地重复定义)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$token$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/token.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$ai$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/ai.ts [app-client] (ecmascript)");
// CLI 配置导入(cc-switch / codex++ / 各 CLI 工具)共享类型
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$cli$2d$config$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/cli-config.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$notification$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/notification.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$notification$2d$channels$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/notification-channels.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$message$2d$repair$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/message-repair.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$agent$2d$runtime$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/agent-runtime.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$workspace$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/workspace.ts [app-client] (ecmascript)");
// 插件市场跨端类型契约(2026-07-22 立,复用 user_preferences 表)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$plugin$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/plugin.ts [app-client] (ecmascript)");
// AI 自动控制跨端契约(2026-07-22 立,browser_control + computer_control MCP tool 全链路)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$agent$2d$control$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/agent-control.ts [app-client] (ecmascript)");
// 工作展示区跨端契约(2026-07-22 立,AI 对话内嵌浏览器 + URL 预览 + Artifact)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$work$2d$panel$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/work-panel.ts [app-client] (ecmascript)");
// 跨端 API 契约类型单一入口(纯类型 re-export,见 api-contracts.ts)
// 通过 @ihui/types/api-contracts subpath 访问,避免与上方散落导出冲突。
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$api$2d$contracts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/types/src/api-contracts.ts [app-client] (ecmascript) <locals>");
// 旧架构迁移补齐类型 (2026-07-22)
// 来源: git commit 3ee96cf09 旧架构 client/src/api/* 中存在但新架构未独立导出的类型
// 路由功能已迁移连通,本文件将 28 组类型定义集中到共享类型层供跨端引用
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$legacy$2d$migration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/legacy-migration.ts [app-client] (ecmascript)");
// IDE 工作区类型契约 (2026-07-22 立,仿 TRAE/Codex IDE 界面)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$ide$2d$workspace$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/ide-workspace.ts [app-client] (ecmascript)");
// 开发者 API Key 跨端契约(2026-07-22 立,统一权限点枚举 + 鉴权类型 + /v1/* 响应格式)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$api$2d$key$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/api-key.ts [app-client] (ecmascript)");
// /v1/* 对外开放 API 端点请求/响应类型契约(2026-07-22 立,27 权限点 + 97 端点全功能覆盖)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$v1$2d$endpoints$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/v1-endpoints.ts [app-client] (ecmascript)");
// 四层记忆 + Dream 梦境系统跨端契约(2026-07-22 立,对标 OpenClaw Mem)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$memory$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/memory.ts [app-client] (ecmascript)");
// Webhook 触发器跨端契约(2026-07-22 立,Wave 3 W3-3 对标 OpenClaw webhook)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$webhook$2d$trigger$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/webhook-trigger.ts [app-client] (ecmascript)");
// Webhook 唤醒机制跨端契约(2026-07-22 立,Wave 3 W3-3 简化唤醒 Bearer token)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$webhook$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/webhook.ts [app-client] (ecmascript)");
// 多通道消息总线跨端契约(2026-07-22 立,Wave 3 W3-2 对标 OpenClaw 多通道消息)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$message$2d$bus$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/message-bus.ts [app-client] (ecmascript)");
// 大模型排行榜跨端契约(2026-07-22 立,参考 arena.ai/leaderboard,6 类模型 + Agent + 总榜)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$leaderboard$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/leaderboard.ts [app-client] (ecmascript)");
// P3 Wave 11:6 大对标能力跨端契约(2026-07-22 立,对标 Codex/Trae/Qoder)
// 终端集成(对标 Codex/OpenCode 内置终端)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$terminal$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/terminal.ts [app-client] (ecmascript)");
// Rules 引擎(对标 Trae Rules)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$rules$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/rules.ts [app-client] (ecmascript)");
// Hook 服务(对标 Trae Hooks)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$hooks$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/hooks.ts [app-client] (ecmascript)");
// Plan/Spec 模式(对标 Trae Plan/Spec)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$spec$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/spec.ts [app-client] (ecmascript)");
// Context Engineering(对标 Qoder)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$context$2d$mention$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/context-mention.ts [app-client] (ecmascript)");
// 跨支柱编排中枢(2026-07-23 立,6 支柱协同 + LLM 预算 + 统一遥测)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$orchestration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/orchestration.ts [app-client] (ecmascript)");
// P3 深度层:LangGraph 升级跨端契约(2026-07-23 立,PostgresSaver + interrupt HITL + 5 模式 streaming + Time Travel)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$langgraph$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/langgraph.ts [app-client] (ecmascript)");
// P3 深度层:AI 教育引擎跨端契约(2026-07-23 立,SM-2 间隔重复 + AI 助教 + AI 批改 + AI 出题)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$education$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/education.ts [app-client] (ecmascript)");
// 资源上游自动同步中心跨端契约(2026-07-24 立,MCP/Skill/Plugin 四源拉取 + 双路径触发 + 全量自动更新)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/registry.ts [app-client] (ecmascript)");
// 跨端 app 组件类型契约(从 packages/app 迁移,2026-07-25)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$app$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/app.ts [app-client] (ecmascript)");
// Coze 平台 API 跨端契约(2026-07-27 立,PAT 直连 Coze 官方 API,chat/workflow/bot/dataset)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$coze$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/coze.ts [app-client] (ecmascript)");
// 跨端支付参数类型(2026-07-28 立,从 miniapp-taro 下沉:PayPlatform/WxPayParams/AliPayParams/AnyPayParams)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$pay$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/pay.ts [app-client] (ecmascript)");
// 跨端分享信息类型(2026-07-28 立,从 miniapp-taro 下沉:ShareInfo/TimelineShareInfo)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$share$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/share.ts [app-client] (ecmascript)");
// 跨端同名组件共享 props 类型(2026-07-28 立,mobile-rn + miniapp-taro 14 对组件类型去重)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$ui$2d$native$2d$components$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/ui-native-components.ts [app-client] (ecmascript)");
// Admin 后台业务类型契约(2026-07-28 立,从 apps/web/app/(main)/admin/**/types.ts 9 个文件下沉)
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$admin$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/admin-types.ts [app-client] (ecmascript)");
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/packages/types/src/api-contracts.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isAIResponse",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$notification$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAIResponse"],
    "isToolChunk",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$workspace$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isToolChunk"],
    "isWorkspaceEvent",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$workspace$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isWorkspaceEvent"],
    "isWorkspaceRequest",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$workspace$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isWorkspaceRequest"],
    "repairMessages",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$message$2d$repair$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["repairMessages"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$api$2d$contracts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/packages/types/src/api-contracts.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$notification$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/notification.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$message$2d$repair$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/message-repair.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$packages$2f$types$2f$src$2f$workspace$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/packages/types/src/workspace.ts [app-client] (ecmascript)");
}),
]);

//# sourceMappingURL=packages_0e67cfb5._.js.map