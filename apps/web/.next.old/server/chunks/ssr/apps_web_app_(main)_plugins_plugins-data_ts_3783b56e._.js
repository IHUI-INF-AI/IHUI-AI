module.exports = [
"[project]/apps/web/app/(main)/plugins/plugins-data.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * 插件市场数据源(2026-07-22 v3 重构,扩充至 24 内置 + 100+ 市场主流)
 *
 * 三类元数据:
 *  - category: 用于分类筛选(all/builtin/market/installed/pinned + 16 个 category)
 *  - tags:     展示用标签 chip
 *  - vendor:   lobehub 厂商 code(小写),用于 BrandIcon 渲染官方矢量图标
 *
 * 图标策略:
 *  - 项目插件: lucide-react(与侧边栏视觉一致)
 *  - 市场插件: 优先 BrandIcon(@lobehub/icons),未收录用 lucide 兜底
 *
 * 重点强化(用户需求 2026-07-22):
 *  - browser 浏览器控制(10+):Playwright / Puppeteer / Browser Use / Browserbase / Stagehand / Skyvern...
 *  - computer 电脑控制(10+):Anthropic Computer Use / Open Interpreter / AutoGPT / MultiOn / Self-Operating Computer...
 *  - video 视频创作(10+):Remotion / Hyperframes / Motion Canvas / Runway / Pika / Sora / Kling / Hailuo...
 *  - devops 开发部署:Vercel / Netlify / Cloudflare / Supabase / Railway...
 */ __turbopack_context__.s([
    "MARKET_PLUGINS",
    ()=>MARKET_PLUGINS,
    "PROJECT_PLUGINS",
    ()=>PROJECT_PLUGINS,
    "getPluginIntegration",
    ()=>getPluginIntegration
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cable$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cable$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/cable.js [app-ssr] (ecmascript) <export default as Cable>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bot$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Bot$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/bot.js [app-ssr] (ecmascript) <export default as Bot>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/workflow.js [app-ssr] (ecmascript) <export default as Workflow>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sparkles.js [app-ssr] (ecmascript) <export default as Sparkles>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wrench$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Wrench$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wrench.js [app-ssr] (ecmascript) <export default as Wrench>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Image$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/image.js [app-ssr] (ecmascript) <export default as Image>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Code$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/code.js [app-ssr] (ecmascript) <export default as Code>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/globe.js [app-ssr] (ecmascript) <export default as Globe>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$boxes$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Boxes$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/boxes.js [app-ssr] (ecmascript) <export default as Boxes>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$link$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Link2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/link-2.js [app-ssr] (ecmascript) <export default as Link2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mouse$2d$pointer$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MousePointer2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/mouse-pointer-2.js [app-ssr] (ecmascript) <export default as MousePointer2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$server$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Server$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/server.js [app-ssr] (ecmascript) <export default as Server>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$rocket$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Rocket$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/rocket.js [app-ssr] (ecmascript) <export default as Rocket>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/terminal.js [app-ssr] (ecmascript) <export default as Terminal>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$send$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Send$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/send.js [app-ssr] (ecmascript) <export default as Send>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$network$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Network$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/network.js [app-ssr] (ecmascript) <export default as Network>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__BookOpen$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/book-open.js [app-ssr] (ecmascript) <export default as BookOpen>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/database.js [app-ssr] (ecmascript) <export default as Database>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-text.js [app-ssr] (ecmascript) <export default as FileText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chart$2d$column$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__BarChart3$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chart-column.js [app-ssr] (ecmascript) <export default as BarChart3>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$check$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldCheck$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shield-check.js [app-ssr] (ecmascript) <export default as ShieldCheck>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$building$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Building2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/building-2.js [app-ssr] (ecmascript) <export default as Building2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$palette$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Palette$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/palette.js [app-ssr] (ecmascript) <export default as Palette>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layers$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Layers$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/layers.js [app-ssr] (ecmascript) <export default as Layers>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cpu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cpu$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/cpu.js [app-ssr] (ecmascript) <export default as Cpu>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/zap.js [app-ssr] (ecmascript) <export default as Zap>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/star.js [app-ssr] (ecmascript) <export default as Star>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$store$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Store$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/store.js [app-ssr] (ecmascript) <export default as Store>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$monitor$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Monitor$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/monitor.js [app-ssr] (ecmascript) <export default as Monitor>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/video.js [app-ssr] (ecmascript) <export default as Video>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cloud$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/cloud.js [app-ssr] (ecmascript) <export default as Cloud>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mail$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Mail$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/mail.js [app-ssr] (ecmascript) <export default as Mail>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/message-square.js [app-ssr] (ecmascript) <export default as MessageSquare>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/lock.js [app-ssr] (ecmascript) <export default as Lock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/search.js [app-ssr] (ecmascript) <export default as Search>");
;
const PROJECT_PLUGINS = [
    {
        id: 'mcp-projects',
        name: 'MCP 项目',
        description: 'Model Context Protocol 服务器管理,让 AI 调用外部工具与数据源',
        href: '/mcp-projects',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cable$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cable$3e$__["Cable"],
        tags: [
            'MCP',
            '工具调用'
        ],
        category: 'mcp'
    },
    {
        id: 'agents',
        name: 'AI 智能体',
        description: '创建与管理自定义 AI Agent,支持多模型编排与工具组合',
        href: '/agents',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bot$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Bot$3e$__["Bot"],
        tags: [
            'Agent',
            '多模型'
        ],
        category: 'agent'
    },
    {
        id: 'workflows',
        name: '工作流',
        description: '可视化工作流编排,串联 AI 节点 / API 调用 / 条件分支',
        href: '/workflows',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"],
        tags: [
            '工作流',
            '编排'
        ],
        category: 'workflow'
    },
    {
        id: 'skills',
        name: 'AI 技能',
        description: '平台技能市场,管理与配置 AI 模型可调用的技能模板',
        href: '/models/skills',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"],
        tags: [
            '技能',
            '模板'
        ],
        category: 'tool'
    },
    {
        id: 'tools',
        name: 'AI 工具',
        description: '在线 AI 工具集合,涵盖 PDF 处理 / 文档转换 / 文本分析等',
        href: '/tools',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wrench$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Wrench$3e$__["Wrench"],
        tags: [
            '工具',
            '在线'
        ],
        category: 'tool'
    },
    {
        id: 'image-gen',
        name: '图像生成',
        description: 'AI 图像生成能力,支持文生图 / 图生图 / 多模型切换',
        href: '/image-gen',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Image$3e$__["Image"],
        tags: [
            '图像',
            '生成'
        ],
        category: 'creation'
    },
    {
        id: 'ai-generation',
        name: 'AI 创作',
        description: 'AI 内容创作中心,文案 / 脚本 / 小说 / 营销内容一键生成',
        href: '/ai-generation',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"],
        tags: [
            '创作',
            '内容'
        ],
        category: 'creation'
    },
    {
        id: 'api-test',
        name: 'API 测试',
        description: '在线 API 调试与测试工具,支持参数配置 / 历史记录 / 结果对比',
        href: '/api-test',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Code$3e$__["Code"],
        tags: [
            'API',
            '调试'
        ],
        category: 'tool'
    },
    {
        id: 'ai-world',
        name: 'AI 世界',
        description: 'AI 应用探索中心,热门 AI 应用 / 智能创作 / 场景化体验',
        href: '/ai-world',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__["Globe"],
        tags: [
            '应用',
            '探索'
        ],
        category: 'creation'
    },
    {
        id: 'knowledge-graph',
        name: '知识图谱',
        description: '构建与管理知识图谱,实体关系可视化 / 图谱推理 / 关联查询',
        href: '/knowledge-graph',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$network$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Network$3e$__["Network"],
        tags: [
            '图谱',
            '知识'
        ],
        category: 'knowledge'
    },
    {
        id: 'knowledge-base',
        name: '知识库',
        description: '企业知识库管理,文档上传 / 分 chunk / 向量化 / 检索召回',
        href: '/knowledge-base',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__BookOpen$3e$__["BookOpen"],
        tags: [
            '知识库',
            '向量'
        ],
        category: 'knowledge'
    },
    {
        id: 'knowledge-rag',
        name: '知识检索 RAG',
        description: 'RAG 检索增强生成,文档问答 / 语义检索 / 引用溯源',
        href: '/knowledge-rag',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            'RAG',
            '检索'
        ],
        category: 'knowledge'
    },
    {
        id: 'docs',
        name: '文档中心',
        description: '项目文档与 API 参考手册,开发者必读 / 接口契约 / 架构说明',
        href: '/feature-center/documents',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"],
        tags: [
            '文档',
            'API'
        ],
        category: 'knowledge'
    },
    {
        id: 'publish',
        name: '多平台发布',
        description: '一键多平台发布工具,支持 md / docx / html / pdf / 图片 / 视频 → 14 平台',
        href: '/publish',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$send$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Send$3e$__["Send"],
        tags: [
            '发布',
            '多平台'
        ],
        category: 'creation'
    },
    {
        id: 'articles',
        name: '文章',
        description: '长文创作与管理,支持 Markdown / 富文本 / 草稿 / 发布工作流',
        href: '/articles',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"],
        tags: [
            '文章',
            'Markdown'
        ],
        category: 'creation'
    },
    {
        id: 'models',
        name: '模型市场',
        description: '50+ 主流大模型市场,OpenAI / Anthropic / Google / 国产模型一网打尽',
        href: '/models',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cpu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cpu$3e$__["Cpu"],
        tags: [
            '模型',
            '市场'
        ],
        category: 'model'
    },
    {
        id: 'developer',
        name: '开发者中心',
        description: '开发者工具集,API Key 管理 / Webhook / 调试 / 日志 / 监控',
        href: '/developer',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"],
        tags: [
            '开发',
            'API Key'
        ],
        category: 'ide'
    },
    {
        id: 'n8n-agents',
        name: 'n8n Agents',
        description: 'n8n 工作流 Agent 集成,可视化编排 + AI 节点 + 自动化触发',
        href: '/n8n-agents',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"],
        tags: [
            'n8n',
            '自动化'
        ],
        category: 'workflow'
    },
    {
        id: 'openclaw',
        name: 'OpenClaw',
        description: '开源 AI Agent 平台,多智能体协作 / 工具调用 / 工作流编排',
        href: '/openclaw',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$rocket$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Rocket$3e$__["Rocket"],
        tags: [
            '开源',
            'Agent'
        ],
        category: 'agent'
    },
    {
        id: 'dashboard',
        name: '数据看板',
        description: '平台运营数据看板,用户 / 收入 / 调用量 / 模型分布实时可视化',
        href: '/dashboard',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chart$2d$column$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__BarChart3$3e$__["BarChart3"],
        tags: [
            '数据',
            '看板'
        ],
        category: 'tool'
    },
    {
        id: 'bi-dashboard',
        name: 'BI 仪表板',
        description: '商业智能仪表板,多维度数据分析 / 自定义图表 / 导出报表',
        href: '/bi-dashboard',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chart$2d$column$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__BarChart3$3e$__["BarChart3"],
        tags: [
            'BI',
            '报表'
        ],
        category: 'tool'
    },
    {
        id: 'security-audit',
        name: '安全审计',
        description: '平台安全审计中心,API Key 泄露检测 / 权限审查 / 操作日志',
        href: '/security-audit',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$check$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldCheck$3e$__["ShieldCheck"],
        tags: [
            '安全',
            '审计'
        ],
        category: 'security'
    },
    {
        id: 'enterprise',
        name: '企业版',
        description: '企业级能力,SSO 单点登录 / 组织架构 / 配额管理 / 私有部署',
        href: '/enterprise',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$building$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Building2$3e$__["Building2"],
        tags: [
            '企业',
            'SSO'
        ],
        category: 'tool'
    },
    {
        id: 'design-system',
        name: '设计系统',
        description: 'UI 设计系统文档,组件库 / 色彩 token / 图标 / 间距规范',
        href: '/design-system',
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$palette$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Palette$3e$__["Palette"],
        tags: [
            '设计',
            'UI'
        ],
        category: 'design'
    }
];
const MARKET_PLUGINS = [
    // ========================================
    // ★ 浏览器控制(用户重点需求)— 12 项
    // ========================================
    {
        id: 'playwright-mcp',
        name: 'Playwright MCP',
        description: '微软出品浏览器自动化 MCP Server,跨 Chromium / Firefox / WebKit,AI 操控真实浏览器',
        url: 'https://github.com/microsoft/playwright-mcp',
        vendor: 'microsoft',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mouse$2d$pointer$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MousePointer2$3e$__["MousePointer2"],
        tags: [
            '浏览器',
            'MCP'
        ],
        category: 'browser',
        free: true,
        official: true
    },
    {
        id: 'puppeteer',
        name: 'Puppeteer',
        description: 'Google Chrome DevTools 团队出品 Node.js 浏览器自动化框架,Headless Chrome 控制',
        url: 'https://pptr.dev',
        vendor: 'google',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mouse$2d$pointer$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MousePointer2$3e$__["MousePointer2"],
        tags: [
            '浏览器',
            'Chrome'
        ],
        category: 'browser',
        free: true,
        official: true
    },
    {
        id: 'browser-use',
        name: 'Browser Use',
        description: 'AI 浏览器控制开源框架,LLM 直接操控网页,自然语言指令完成复杂任务',
        url: 'https://browser-use.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mouse$2d$pointer$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MousePointer2$3e$__["MousePointer2"],
        tags: [
            '浏览器',
            'AI'
        ],
        category: 'browser',
        free: true
    },
    {
        id: 'browserbase',
        name: 'Browserbase',
        description: '云端浏览器基础设施,Serverless 浏览器 / Stealth Mode / 大规模并发自动化',
        url: 'https://browserbase.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cloud$3e$__["Cloud"],
        tags: [
            '浏览器',
            '云端'
        ],
        category: 'browser',
        official: true
    },
    {
        id: 'stagehand',
        name: 'Stagehand',
        description: 'Browserbase 出品 AI 浏览器自动化 SDK,act / extract / observe 三大原语',
        url: 'https://stagehand.dev',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mouse$2d$pointer$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MousePointer2$3e$__["MousePointer2"],
        tags: [
            '浏览器',
            'SDK'
        ],
        category: 'browser',
        free: true
    },
    {
        id: 'skyvern',
        name: 'Skyvern',
        description: 'AI 浏览器工作流自动化,LLM + 视觉模型操控浏览器,自动完成表单 / 工作流',
        url: 'https://skyvern.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mouse$2d$pointer$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MousePointer2$3e$__["MousePointer2"],
        tags: [
            '浏览器',
            '自动化'
        ],
        category: 'browser',
        free: true
    },
    {
        id: 'browserless',
        name: 'Browserless',
        description: '云端浏览器即服务,大规模 Headless Chrome 集群 / PDF 生成 / 截图 / 抓取',
        url: 'https://browserless.io',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cloud$3e$__["Cloud"],
        tags: [
            '浏览器',
            'SaaS'
        ],
        category: 'browser'
    },
    {
        id: 'selenium',
        name: 'Selenium',
        description: '经典浏览器自动化框架,跨浏览器 / 跨语言 / WebDriver 协议,Web 测试行业标杆',
        url: 'https://www.selenium.dev',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mouse$2d$pointer$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MousePointer2$3e$__["MousePointer2"],
        tags: [
            '浏览器',
            '测试'
        ],
        category: 'browser',
        free: true,
        official: true
    },
    {
        id: 'playwright',
        name: 'Playwright',
        description: '微软现代浏览器自动化框架,跨浏览器 / 跨语言 / 自动等待 / 网络拦截',
        url: 'https://playwright.dev',
        vendor: 'microsoft',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mouse$2d$pointer$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MousePointer2$3e$__["MousePointer2"],
        tags: [
            '浏览器',
            '微软'
        ],
        category: 'browser',
        free: true,
        official: true
    },
    {
        id: 'multion',
        name: 'MultiOn',
        description: 'AI 浏览器代理,自然语言操控浏览器完成购物 / 预订 / 数据采集等任务',
        url: 'https://multion.ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mouse$2d$pointer$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MousePointer2$3e$__["MousePointer2"],
        tags: [
            '浏览器',
            'Agent'
        ],
        category: 'browser'
    },
    {
        id: 'axiom',
        name: 'Axiom.ai',
        description: '无代码浏览器自动化平台,录制回放 / 可视化编排 / 数据抓取,无需编程',
        url: 'https://axiom.ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mouse$2d$pointer$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MousePointer2$3e$__["MousePointer2"],
        tags: [
            '浏览器',
            '无代码'
        ],
        category: 'browser'
    },
    {
        id: 'brightdata',
        name: 'Bright Data',
        description: 'Bright Data 浏览器自动化,7200 万住宅 IP / 反检测 / 大规模数据采集',
        url: 'https://brightdata.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mouse$2d$pointer$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MousePointer2$3e$__["MousePointer2"],
        tags: [
            '浏览器',
            '采集'
        ],
        category: 'browser'
    },
    // ========================================
    // ★ 电脑控制(用户重点需求)— 10 项
    // ========================================
    {
        id: 'anthropic-computer-use',
        name: 'Anthropic Computer Use',
        description: 'Claude 官方电脑控制能力,截图识别 + 鼠标键盘操作,直接操控桌面应用',
        url: 'https://anthropic.com/news/3-5-models-and-computer-use',
        vendor: 'anthropic',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$monitor$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Monitor$3e$__["Monitor"],
        tags: [
            '电脑',
            'Claude'
        ],
        category: 'computer',
        official: true
    },
    {
        id: 'open-interpreter',
        name: 'Open Interpreter',
        description: '让 LLM 在本地执行代码 / 命令,自然语言操控电脑,Python / Shell / JS 全栈',
        url: 'https://openinterpreter.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"],
        tags: [
            '电脑',
            '本地'
        ],
        category: 'computer',
        free: true
    },
    {
        id: 'auto-gpt',
        name: 'AutoGPT',
        description: '自主 AI Agent 鼻祖,设定目标后自动拆解任务 + 联网 + 执行 + 迭代',
        url: 'https://github.com/Significant-Gravitas/AutoGPT',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bot$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Bot$3e$__["Bot"],
        tags: [
            '电脑',
            'Agent'
        ],
        category: 'computer',
        free: true
    },
    {
        id: 'babyagi',
        name: 'BabyAGI',
        description: '任务驱动 AI Agent 框架,自动创建 / 优先级排序 / 执行任务循环',
        url: 'https://github.com/yoheinakajima/babyagi',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bot$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Bot$3e$__["Bot"],
        tags: [
            '电脑',
            '任务'
        ],
        category: 'computer',
        free: true
    },
    {
        id: 'self-operating-computer',
        name: 'Self-Operating Computer',
        description: '开源 AI 操控电脑框架,自然语言指令 + 视觉模型 + 鼠标键盘控制',
        url: 'https://github.com/OthersideAI/self-operating-computer',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$monitor$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Monitor$3e$__["Monitor"],
        tags: [
            '电脑',
            '开源'
        ],
        category: 'computer',
        free: true
    },
    {
        id: 'openadapt',
        name: 'OpenAdapt',
        description: '开源 AI 桌面自动化,录制人类操作 + LLM 生成自动化脚本,零代码 RPA',
        url: 'https://openadapt.ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$monitor$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Monitor$3e$__["Monitor"],
        tags: [
            '电脑',
            'RPA'
        ],
        category: 'computer',
        free: true
    },
    {
        id: 'adept-act',
        name: 'Adept ACT-1',
        description: 'Adept AI 出品 ACT-1 模型,自然语言操控浏览器 / 软件 / 工具,企业级 Agent',
        url: 'https://adept.ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$monitor$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Monitor$3e$__["Monitor"],
        tags: [
            '电脑',
            'Adept'
        ],
        category: 'computer'
    },
    {
        id: 'claude-desktop',
        name: 'Claude Desktop',
        description: 'Anthropic Claude 桌面应用,本地 MCP 集成 / 文件访问 / 应用操控',
        url: 'https://claude.ai/download',
        vendor: 'anthropic',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$monitor$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Monitor$3e$__["Monitor"],
        tags: [
            '电脑',
            '桌面'
        ],
        category: 'computer',
        free: true,
        official: true
    },
    {
        id: 'agsafety-agent',
        name: 'Agent.exe',
        description: '开源跨平台 AI 桌面 Agent,基于 E2B 沙箱 + Computer Use,自然语言控制电脑',
        url: 'https://github.com/E2B-Dev/agent',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$monitor$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Monitor$3e$__["Monitor"],
        tags: [
            '电脑',
            'E2B'
        ],
        category: 'computer',
        free: true
    },
    {
        id: 'openai-operator',
        name: 'OpenAI Operator',
        description: 'OpenAI Operator AI Agent,CU 计算机使用模型,云端浏览器代理自动完成任务',
        url: 'https://openai.com/index/introducing-operator/',
        vendor: 'openai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$monitor$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Monitor$3e$__["Monitor"],
        tags: [
            '电脑',
            'Operator'
        ],
        category: 'computer',
        official: true
    },
    // ========================================
    // ★ 视频创作(用户特别提到)— 12 项
    // ========================================
    {
        id: 'remotion',
        name: 'Remotion',
        description: 'React 程序化视频创作框架,组件化视频 / 数据驱动 / SSR 渲染,前端开发者首选',
        url: 'https://remotion.dev',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"],
        tags: [
            '视频',
            'React'
        ],
        category: 'video',
        free: true,
        official: true
    },
    {
        id: 'hyperframes',
        name: 'Hyperframes',
        description: 'Hyperframes Studio 交互式 React 动画创作,代码 + 时间轴 / 导出 MP4 / GIF',
        url: 'https://hyperframes.studio',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"],
        tags: [
            '视频',
            '动画'
        ],
        category: 'video',
        free: true
    },
    {
        id: 'motion-canvas',
        name: 'Motion Canvas',
        description: 'TypeScript 程序化动画引擎,代码驱动动画 / 实时预览 / 导出 4K 视频',
        url: 'https://motioncanvas.io',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"],
        tags: [
            '视频',
            'TS'
        ],
        category: 'video',
        free: true
    },
    {
        id: 'manim',
        name: 'Manim',
        description: '3Blue1Brown 数学动画引擎,Python 代码生成精确数学动画 / 教学视频',
        url: 'https://www.manim.community',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"],
        tags: [
            '视频',
            '数学'
        ],
        category: 'video',
        free: true
    },
    {
        id: 'ffmpeg-mcp',
        name: 'FFmpeg MCP',
        description: 'FFmpeg 视频 / 音频处理 MCP Server,AI 自然语言操控转码 / 剪辑 / 滤镜',
        url: 'https://ffmpeg.org',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"],
        tags: [
            '视频',
            'FFmpeg'
        ],
        category: 'video',
        free: true
    },
    {
        id: 'runway',
        name: 'Runway',
        description: 'Runway AI 视频生成平台,Gen-3 / 文生视频 / 图生视频 / 视频风格化',
        url: 'https://runwayml.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"],
        tags: [
            '视频',
            'AI 生成'
        ],
        category: 'video',
        official: true
    },
    {
        id: 'pika',
        name: 'Pika Labs',
        description: 'Pika AI 视频生成,文本 / 图片生成短视频 / Pikaffects 特效 / 创意社区',
        url: 'https://pika.art',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"],
        tags: [
            '视频',
            'AI 生成'
        ],
        category: 'video'
    },
    {
        id: 'sora',
        name: 'OpenAI Sora',
        description: 'OpenAI Sora 文生视频模型,长视频 / 高保真 / 物理世界模拟 / 故事创作',
        url: 'https://openai.com/sora',
        vendor: 'openai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"],
        tags: [
            '视频',
            'Sora'
        ],
        category: 'video',
        official: true
    },
    {
        id: 'kling',
        name: '快手可灵 Kling',
        description: '快手可灵 AI 视频生成,国产顶尖 / 长视频 / 1080P / 物理规律 / 中国美学',
        url: 'https://kling.kuaishou.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"],
        tags: [
            '视频',
            '国产'
        ],
        category: 'video',
        official: true
    },
    {
        id: 'hailuo',
        name: 'MiniMax 海螺',
        description: 'MiniMax 海螺 AI 视频生成,国产 / 文生视频 / 图生视频 / 速度快',
        url: 'https://hailuoai.video',
        vendor: 'minimax',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"],
        tags: [
            '视频',
            '国产'
        ],
        category: 'video',
        official: true
    },
    {
        id: 'veo',
        name: 'Google Veo',
        description: 'Google DeepMind Veo 文生视频模型,1080P / 长视频 / 物理一致 / 电影级',
        url: 'https://deepmind.google/technologies/veo/',
        vendor: 'google',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"],
        tags: [
            '视频',
            'Google'
        ],
        category: 'video',
        official: true
    },
    {
        id: 'synthesia',
        name: 'Synthesia',
        description: 'Synthesia AI 数字人视频生成,140+ 语言 / 自定义 avatar / 企业培训视频',
        url: 'https://synthesia.io',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"],
        tags: [
            '视频',
            '数字人'
        ],
        category: 'video'
    },
    // ========================================
    // ★ 开发部署(用户特别提到 Vercel)— 12 项
    // ========================================
    {
        id: 'vercel',
        name: 'Vercel',
        description: '前端云平台,Next.js 母公司 / Edge Functions / 预览部署 / 全球 CDN',
        url: 'https://vercel.com',
        vendor: 'vercel',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cloud$3e$__["Cloud"],
        tags: [
            '部署',
            'Edge'
        ],
        category: 'devops',
        free: true,
        official: true
    },
    {
        id: 'netlify',
        name: 'Netlify',
        description: '静态站点 / JAMstack 部署平台,自动 CI/CD / Edge Functions / 表单处理',
        url: 'https://netlify.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cloud$3e$__["Cloud"],
        tags: [
            '部署',
            'JAMstack'
        ],
        category: 'devops',
        free: true,
        official: true
    },
    {
        id: 'cloudflare',
        name: 'Cloudflare',
        description: 'Cloudflare Workers / Pages / R2 / D1 / KV,边缘计算全栈平台',
        url: 'https://cloudflare.com',
        vendor: 'cloudflare',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cloud$3e$__["Cloud"],
        tags: [
            '部署',
            '边缘'
        ],
        category: 'devops',
        free: true,
        official: true
    },
    {
        id: 'supabase',
        name: 'Supabase',
        description: '开源 Firebase 替代,Postgres / Auth / 实时订阅 / Storage / Edge Functions',
        url: 'https://supabase.com',
        vendor: 'supabase',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            'BaaS',
            'Postgres'
        ],
        category: 'devops',
        free: true,
        official: true
    },
    {
        id: 'railway',
        name: 'Railway',
        description: '现代化应用部署平台,数据库 / 后端 / 前端一键部署 / 无 Docker 配置',
        url: 'https://railway.app',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cloud$3e$__["Cloud"],
        tags: [
            '部署',
            '全栈'
        ],
        category: 'devops',
        free: true
    },
    {
        id: 'render',
        name: 'Render',
        description: '云应用部署平台,Web Service / 后台任务 / 数据库 / 静态站点',
        url: 'https://render.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cloud$3e$__["Cloud"],
        tags: [
            '部署',
            '云'
        ],
        category: 'devops',
        free: true
    },
    {
        id: 'fly-io',
        name: 'Fly.io',
        description: '边缘应用部署平台,全球数据中心 / Firecracker VM / Apps v2',
        url: 'https://fly.io',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cloud$3e$__["Cloud"],
        tags: [
            '部署',
            '边缘'
        ],
        category: 'devops',
        free: true
    },
    {
        id: 'deno-deploy',
        name: 'Deno Deploy',
        description: 'Deno 官方边缘部署平台,JavaScript / TypeScript / 全球 35 区域',
        url: 'https://deno.com/deploy',
        vendor: 'deno',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cloud$3e$__["Cloud"],
        tags: [
            '部署',
            'Deno'
        ],
        category: 'devops',
        free: true,
        official: true
    },
    {
        id: 'github-pages',
        name: 'GitHub Pages',
        description: 'GitHub 静态站点托管,免费 / 自定义域名 / HTTPS / 与 Git 仓库深度集成',
        url: 'https://pages.github.com',
        vendor: 'githubcopilot',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cloud$3e$__["Cloud"],
        tags: [
            '部署',
            'GitHub'
        ],
        category: 'devops',
        free: true,
        official: true
    },
    {
        id: 'docker',
        name: 'Docker',
        description: '容器化平台,Docker Hub / Compose / Build Cloud / 容器化部署行业标杆',
        url: 'https://docker.com',
        vendor: 'docker',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$boxes$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Boxes$3e$__["Boxes"],
        tags: [
            '容器',
            '部署'
        ],
        category: 'devops',
        official: true
    },
    {
        id: 'koyeb',
        name: 'Koyeb',
        description: 'Serverless 应用部署平台,Docker / Git 部署 / 全球边缘 / 自动扩缩',
        url: 'https://koyeb.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cloud$3e$__["Cloud"],
        tags: [
            '部署',
            'Serverless'
        ],
        category: 'devops',
        free: true
    },
    {
        id: 'workers-ai',
        name: 'Cloudflare Workers AI',
        description: 'Cloudflare Workers AI 推理平台,Llama / Mistral / 嵌入模型边缘推理',
        url: 'https://developers.cloudflare.com/workers-ai/',
        vendor: 'cloudflare',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cpu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cpu$3e$__["Cpu"],
        tags: [
            '部署',
            'AI'
        ],
        category: 'devops',
        free: true,
        official: true
    },
    // ========================================
    // ★ Superpowers 与 AI 能力增强 — 8 项
    // ========================================
    {
        id: 'superpowers',
        name: 'Superpowers',
        description: 'Anthropic 推出的 Claude 增强能力,长期记忆 / 持续工作 / 自主任务执行',
        url: 'https://github.com/obra/superpowers',
        vendor: 'anthropic',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"],
        tags: [
            'Superpowers',
            '增强'
        ],
        category: 'agent',
        free: true
    },
    {
        id: 'anthropic-skills',
        name: 'Anthropic Skills',
        description: 'Claude Skills 市场,Bash / Artifacts / Computer Use / Filesystem 官方技能集',
        url: 'https://docs.anthropic.com/claude/docs/skills',
        vendor: 'anthropic',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"],
        tags: [
            'Claude',
            'Skills'
        ],
        category: 'agent',
        free: true,
        official: true
    },
    {
        id: 'claude-code',
        name: 'Claude Code',
        description: 'Anthropic 官方 CLI 编程 Agent,终端原生 / 多文件编辑 / 工具调用',
        url: 'https://docs.anthropic.com/claude/docs/claude-code',
        vendor: 'anthropic',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"],
        tags: [
            'Claude',
            'CLI'
        ],
        category: 'ide',
        official: true
    },
    {
        id: 'openai-codex',
        name: 'OpenAI Codex',
        description: 'OpenAI Codex CLI,开源命令行 AI 编程助手,GPT-4 / o3 模型 / 多语言',
        url: 'https://github.com/openai/codex',
        vendor: 'openai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"],
        tags: [
            'OpenAI',
            'CLI'
        ],
        category: 'ide',
        free: true,
        official: true
    },
    {
        id: 'gemini-cli',
        name: 'Gemini CLI',
        description: 'Google Gemini CLI,开源命令行 AI 助手,Gemini 2.5 Pro / 1M 上下文',
        url: 'https://github.com/google-gemini/gemini-cli',
        vendor: 'google',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"],
        tags: [
            'Gemini',
            'CLI'
        ],
        category: 'ide',
        free: true,
        official: true
    },
    {
        id: 'aider',
        name: 'Aider',
        description: '开源 AI pair programming,终端 / Git 集成 / 多模型 / 多文件编辑',
        url: 'https://aider.chat',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"],
        tags: [
            '开源',
            '编程'
        ],
        category: 'ide',
        free: true
    },
    {
        id: 'openai-operator-plus',
        name: 'OpenAI ChatGPT Agent',
        description: 'ChatGPT Agent 能力,长任务自主执行 / 浏览器操作 / 编程 / 文件操作',
        url: 'https://openai.com/index/introducing-chatgpt-agent/',
        vendor: 'openai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bot$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Bot$3e$__["Bot"],
        tags: [
            'Agent',
            'OpenAI'
        ],
        category: 'agent',
        official: true
    },
    {
        id: 'devin',
        name: 'Devin',
        description: 'Cognition Labs Devin AI 软件工程师,自主完成开发任务 / 修复 bug / PR',
        url: 'https://devin.ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bot$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Bot$3e$__["Bot"],
        tags: [
            'Agent',
            '工程师'
        ],
        category: 'agent'
    },
    // ========================================
    // ★ 搜索能力 — 8 项
    // ========================================
    {
        id: 'brave-search-mcp',
        name: 'Brave Search MCP',
        description: 'Brave Search 官方 MCP Server,AI 调用隐私搜索 / 网页 / 新闻 / 图片',
        url: 'https://brave.com/search/api/',
        vendor: 'brave',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"],
        tags: [
            '搜索',
            'MCP'
        ],
        category: 'search',
        free: true,
        official: true
    },
    {
        id: 'tavily',
        name: 'Tavily AI',
        description: 'Tavily AI 搜索 API,LLM 优化 / 实时结果 / 摘要 / 答案,Agent 首选搜索',
        url: 'https://tavily.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"],
        tags: [
            '搜索',
            'AI'
        ],
        category: 'search'
    },
    {
        id: 'exa',
        name: 'Exa AI',
        description: 'Exa 神经网络搜索 API,语义搜索 / 全文内容 / 相似度查询 / 大规模抓取',
        url: 'https://exa.ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"],
        tags: [
            '搜索',
            '语义'
        ],
        category: 'search'
    },
    {
        id: 'google-search-mcp',
        name: 'Google Search MCP',
        description: 'Google Search 官方 MCP Server,自定义搜索 API / Serp / 知识图谱',
        url: 'https://developers.google.com/custom-search',
        vendor: 'google',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"],
        tags: [
            '搜索',
            'Google'
        ],
        category: 'search',
        official: true
    },
    {
        id: 'serpapi',
        name: 'SerpAPI',
        description: 'SerpAPI 搜索引擎结果 API,Google / Bing / 百度 / 淘宝等 20+ 引擎结构化数据',
        url: 'https://serpapi.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"],
        tags: [
            '搜索',
            'API'
        ],
        category: 'search'
    },
    {
        id: 'bing-search',
        name: 'Microsoft Bing',
        description: '微软 Bing 搜索 API,Web / News / Image / Video / Web Search MCP Server',
        url: 'https://www.microsoft.com/bing/apis',
        vendor: 'microsoft',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"],
        tags: [
            '搜索',
            '微软'
        ],
        category: 'search',
        official: true
    },
    {
        id: 'duckduckgo',
        name: 'DuckDuckGo',
        description: 'DuckDuckGo 隐私搜索 API,无追踪 / 即时答案 / AI Agent 调用',
        url: 'https://duckduckgo.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"],
        tags: [
            '搜索',
            '隐私'
        ],
        category: 'search',
        free: true
    },
    {
        id: 'jina-reader',
        name: 'Jina Reader',
        description: 'Jina AI Reader,任意 URL → Markdown,LLM 友好内容提取 / 全网可读',
        url: 'https://jina.ai/reader',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"],
        tags: [
            '搜索',
            'Reader'
        ],
        category: 'search',
        free: true
    },
    // ========================================
    // ★ 数据存储 MCP — 8 项
    // ========================================
    {
        id: 'postgres-mcp',
        name: 'Postgres MCP',
        description: 'PostgreSQL 官方 MCP Server,AI 自然语言查询 / Schema 探索 / SQL 执行',
        url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/postgres',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            '数据库',
            'MCP'
        ],
        category: 'data',
        free: true,
        official: true
    },
    {
        id: 'sqlite-mcp',
        name: 'SQLite MCP',
        description: 'SQLite MCP Server,本地轻量数据库 / AI 查询 / 嵌入式数据存储',
        url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            '数据库',
            'SQLite'
        ],
        category: 'data',
        free: true
    },
    {
        id: 'mongodb-mcp',
        name: 'MongoDB MCP',
        description: 'MongoDB 官方 MCP Server,AI 操控 NoSQL / 文档数据库 / 聚合管道',
        url: 'https://www.mongodb.com/docs/mongodb-ai-voice/mcp',
        vendor: 'mongodb',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            '数据库',
            'NoSQL'
        ],
        category: 'data',
        free: true,
        official: true
    },
    {
        id: 'redis-mcp',
        name: 'Redis MCP',
        description: 'Redis MCP Server,AI 操控缓存 / 队列 / 发布订阅 / 数据结构',
        url: 'https://redis.io/mcp',
        vendor: 'redis',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            '数据库',
            'Redis'
        ],
        category: 'data',
        free: true,
        official: true
    },
    {
        id: 'supabase-mcp',
        name: 'Supabase MCP',
        description: 'Supabase 官方 MCP Server,AI 操控 Postgres / Auth / Storage / Edge',
        url: 'https://supabase.com/docs/guides/getting-started/mcp',
        vendor: 'supabase',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            '数据库',
            'Supabase'
        ],
        category: 'data',
        free: true,
        official: true
    },
    {
        id: 'neon',
        name: 'Neon Postgres',
        description: 'Neon Serverless Postgres,分支 / 即时恢复 / Scale to zero / MCP 集成',
        url: 'https://neon.tech',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            '数据库',
            'Serverless'
        ],
        category: 'data',
        free: true
    },
    {
        id: 'planetscale',
        name: 'PlanetScale',
        description: 'PlanetScale Serverless MySQL,分支 / 在线 Schema 变更 / 全球分布',
        url: 'https://planetscale.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            '数据库',
            'MySQL'
        ],
        category: 'data'
    },
    {
        id: 'turso',
        name: 'Turso',
        description: 'Turso 边缘 SQLite,libSQL / 多区域复制 / 嵌入式 / Serverless',
        url: 'https://turso.tech',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            '数据库',
            '边缘'
        ],
        category: 'data',
        free: true
    },
    // ========================================
    // ★ 文件与存储 MCP — 6 项
    // ========================================
    {
        id: 'filesystem-mcp',
        name: 'Filesystem MCP',
        description: 'Filesystem MCP Server,官方文件系统访问 / 读写 / 搜索 / 目录操作',
        url: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"],
        tags: [
            '文件',
            'MCP'
        ],
        category: 'data',
        free: true,
        official: true
    },
    {
        id: 'google-drive-mcp',
        name: 'Google Drive MCP',
        description: 'Google Drive 官方 MCP Server,AI 搜索 / 读取 / 管理 Drive 文件',
        url: 'https://developers.google.com/drive',
        vendor: 'google',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"],
        tags: [
            '文件',
            'Google'
        ],
        category: 'data',
        official: true
    },
    {
        id: 'onedrive-mcp',
        name: 'OneDrive MCP',
        description: 'Microsoft OneDrive MCP Server,AI 访问 / 搜索 / 管理 OneDrive 文件',
        url: 'https://www.microsoft.com/en-us/microsoft-365/onedrive/online-cloud-storage',
        vendor: 'microsoft',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"],
        tags: [
            '文件',
            '微软'
        ],
        category: 'data',
        official: true
    },
    {
        id: 'dropbox',
        name: 'Dropbox',
        description: 'Dropbox 云存储,文件同步 / 共享 / 版本 / API 集成 AI 工作流',
        url: 'https://dropbox.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"],
        tags: [
            '文件',
            '云存储'
        ],
        category: 'data',
        official: true
    },
    {
        id: 's3-mcp',
        name: 'AWS S3 MCP',
        description: 'AWS S3 MCP Server,AI 操控对象存储 / 上传 / 下载 / 桶管理',
        url: 'https://aws.amazon.com/s3/',
        vendor: 'bedrock',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"],
        tags: [
            '文件',
            'S3'
        ],
        category: 'data',
        official: true
    },
    {
        id: 'box',
        name: 'Box',
        description: 'Box 企业内容管理平台,文件共享 / 协作 / 安全 / AI 集成',
        url: 'https://box.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"],
        tags: [
            '文件',
            '企业'
        ],
        category: 'data'
    },
    // ========================================
    // ★ 通信协作 MCP — 8 项
    // ========================================
    {
        id: 'slack-mcp',
        name: 'Slack MCP',
        description: 'Slack 官方 MCP Server,AI 发送消息 / 频道管理 / 搜索历史 / 工作流',
        url: 'https://slack.com/mcp',
        vendor: 'slack',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__["MessageSquare"],
        tags: [
            '通信',
            'Slack'
        ],
        category: 'communication',
        official: true
    },
    {
        id: 'discord-mcp',
        name: 'Discord MCP',
        description: 'Discord MCP Server,AI 操控 Bot / 发消息 / 服务器管理 / 频道操作',
        url: 'https://discord.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__["MessageSquare"],
        tags: [
            '通信',
            'Discord'
        ],
        category: 'communication',
        free: true
    },
    {
        id: 'telegram-mcp',
        name: 'Telegram Bot MCP',
        description: 'Telegram Bot MCP Server,AI 发送消息 / 群组管理 / 文件 / 通知',
        url: 'https://core.telegram.org/bots/api',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$send$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Send$3e$__["Send"],
        tags: [
            '通信',
            'Bot'
        ],
        category: 'communication',
        free: true
    },
    {
        id: 'email-mcp',
        name: 'Email MCP',
        description: 'Email MCP Server,AI 发送 / 接收 / 管理邮件,IMAP / SMTP 协议支持',
        url: 'https://github.com/modelcontextprotocol/servers',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mail$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Mail$3e$__["Mail"],
        tags: [
            '通信',
            '邮件'
        ],
        category: 'communication',
        free: true
    },
    {
        id: 'gmail-mcp',
        name: 'Gmail MCP',
        description: 'Gmail 官方 MCP Server,AI 管理 Gmail 邮件 / 标签 / 草稿 / 发送',
        url: 'https://developers.google.com/gmail/api',
        vendor: 'google',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mail$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Mail$3e$__["Mail"],
        tags: [
            '通信',
            'Gmail'
        ],
        category: 'communication',
        official: true
    },
    {
        id: 'whatsapp',
        name: 'WhatsApp Business',
        description: 'WhatsApp Business API,企业消息 / 客户服务 / 通知 / AI 自动回复',
        url: 'https://business.whatsapp.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__["MessageSquare"],
        tags: [
            '通信',
            'WhatsApp'
        ],
        category: 'communication',
        official: true
    },
    {
        id: 'microsoft-teams',
        name: 'Microsoft Teams',
        description: 'Microsoft Teams 协作平台,Bot / 消息 / 会议 / 文件 / AI 集成',
        url: 'https://www.microsoft.com/microsoft-teams',
        vendor: 'microsoft',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__["MessageSquare"],
        tags: [
            '通信',
            '微软'
        ],
        category: 'communication',
        official: true
    },
    {
        id: 'feishu',
        name: '飞书 Lark',
        description: '飞书 Lark 开放平台,消息 / 文档 / 多维表格 / 日历 / 审批 MCP 集成',
        url: 'https://open.feishu.cn',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$square$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageSquare$3e$__["MessageSquare"],
        tags: [
            '通信',
            '飞书'
        ],
        category: 'communication',
        official: true
    },
    // ========================================
    // ★ 知识与生产力 MCP — 8 项
    // ========================================
    {
        id: 'notion-mcp',
        name: 'Notion MCP',
        description: 'Notion 官方 MCP Server,AI 搜索 / 创建 / 编辑 Notion 页面 / 数据库',
        url: 'https://www.notion.com/my-integrations',
        vendor: 'notion',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__BookOpen$3e$__["BookOpen"],
        tags: [
            '知识',
            'Notion'
        ],
        category: 'productivity',
        official: true
    },
    {
        id: 'obsidian',
        name: 'Obsidian',
        description: 'Obsidian 知识管理工具,本地 Markdown / 双向链接 / MCP 集成',
        url: 'https://obsidian.md',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__BookOpen$3e$__["BookOpen"],
        tags: [
            '知识',
            'Markdown'
        ],
        category: 'productivity',
        free: true
    },
    {
        id: 'linear-mcp',
        name: 'Linear MCP',
        description: 'Linear 官方 MCP Server,AI 创建 / 更新 / 查询 Issue / 项目管理',
        url: 'https://linear.app/docs/mcp',
        vendor: 'linear',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layers$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Layers$3e$__["Layers"],
        tags: [
            '任务',
            'Linear'
        ],
        category: 'productivity',
        official: true
    },
    {
        id: 'jira-mcp',
        name: 'Jira MCP',
        description: 'Atlassian Jira MCP Server,AI 管理 Issue / Sprint / 看板 / 工作流',
        url: 'https://www.atlassian.com/software/jira',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layers$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Layers$3e$__["Layers"],
        tags: [
            '任务',
            'Jira'
        ],
        category: 'productivity',
        official: true
    },
    {
        id: 'github-mcp',
        name: 'GitHub MCP',
        description: 'GitHub 官方 MCP Server,AI 管理 Repo / Issue / PR / Action / Workflow',
        url: 'https://github.com/github/github-mcp-server',
        vendor: 'githubcopilot',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Code$3e$__["Code"],
        tags: [
            '任务',
            'GitHub'
        ],
        category: 'productivity',
        free: true,
        official: true
    },
    {
        id: 'gitlab',
        name: 'GitLab',
        description: 'GitLab DevOps 平台,Repo / CI/CD / Issue / Wiki / MCP 集成',
        url: 'https://gitlab.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Code$3e$__["Code"],
        tags: [
            '任务',
            'GitLab'
        ],
        category: 'productivity',
        official: true
    },
    {
        id: 'asana',
        name: 'Asana',
        description: 'Asana 项目管理平台,任务 / 项目 / 时间线 / 团队协作 / API 集成',
        url: 'https://asana.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layers$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Layers$3e$__["Layers"],
        tags: [
            '任务',
            '项目'
        ],
        category: 'productivity',
        official: true
    },
    {
        id: 'trello',
        name: 'Trello',
        description: 'Atlassian Trello 看板管理,看板 / 列表 / 卡片 / Drag & Drop / Atlassian',
        url: 'https://trello.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layers$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Layers$3e$__["Layers"],
        tags: [
            '任务',
            '看板'
        ],
        category: 'productivity',
        free: true,
        official: true
    },
    // ========================================
    // ★ 设计创作 — 8 项
    // ========================================
    {
        id: 'figma-mcp',
        name: 'Figma MCP',
        description: 'Figma 官方 MCP Server,AI 读取 / 修改 / 生成设计 / Dev Mode 集成',
        url: 'https://www.figma.com/developers',
        vendor: 'figma',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$palette$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Palette$3e$__["Palette"],
        tags: [
            '设计',
            'Figma'
        ],
        category: 'design',
        official: true
    },
    {
        id: 'framer',
        name: 'Framer',
        description: 'Framer 无代码网站构建,可视化设计 / 响应式 / CMS / AI 生成',
        url: 'https://framer.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$palette$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Palette$3e$__["Palette"],
        tags: [
            '设计',
            '网站'
        ],
        category: 'design',
        official: true
    },
    {
        id: 'canva',
        name: 'Canva',
        description: 'Canva 在线设计平台,模板 / 图片 / 视频 / 演示文稿 / AI 设计助手',
        url: 'https://canva.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$palette$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Palette$3e$__["Palette"],
        tags: [
            '设计',
            '模板'
        ],
        category: 'design',
        free: true,
        official: true
    },
    {
        id: 'adobe-firefly',
        name: 'Adobe Firefly',
        description: 'Adobe Firefly AI 创作全家桶,图像 / 视频 / 音频 / 矢量 / 字体生成',
        url: 'https://firefly.adobe.com',
        vendor: 'adobe',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$palette$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Palette$3e$__["Palette"],
        tags: [
            '设计',
            'Adobe'
        ],
        category: 'design',
        official: true
    },
    {
        id: 'midjourney',
        name: 'Midjourney',
        description: 'Midjourney AI 图像生成,艺术风格 / 高质量 / Discord / 网页版',
        url: 'https://midjourney.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Image$3e$__["Image"],
        tags: [
            '设计',
            'AI 生成'
        ],
        category: 'design'
    },
    {
        id: 'dalle',
        name: 'OpenAI DALL·E',
        description: 'OpenAI DALL·E 3 文生图模型,集成 ChatGPT / API / 编辑 / 变体',
        url: 'https://openai.com/dall-e-3',
        vendor: 'openai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Image$3e$__["Image"],
        tags: [
            '设计',
            'OpenAI'
        ],
        category: 'design',
        official: true
    },
    {
        id: 'stable-diffusion',
        name: 'Stable Diffusion',
        description: 'Stability AI 开源图像生成模型,SDXL / SD3 / 自托管 / LoRA 微调',
        url: 'https://stability.ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Image$3e$__["Image"],
        tags: [
            '设计',
            '开源'
        ],
        category: 'design',
        free: true
    },
    {
        id: 'flux',
        name: 'Black Forest Labs FLUX',
        description: 'Black Forest Labs FLUX.1 图像生成模型,质量顶尖 / 开源 / 速度快',
        url: 'https://blackforestlabs.ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Image$3e$__["Image"],
        tags: [
            '设计',
            'FLUX'
        ],
        category: 'design',
        free: true
    },
    // ========================================
    // ★ 大模型厂商官方市场 — 18 项
    // ========================================
    {
        id: 'gpt-store',
        name: 'OpenAI GPT Store',
        description: 'OpenAI 官方 GPTs 市场,百万级自定义 GPT 机器人,涵盖工作 / 学习 / 生活',
        url: 'https://chatgpt.com/gpts',
        vendor: 'openai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$store$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Store$3e$__["Store"],
        tags: [
            'GPTs',
            '官方'
        ],
        category: 'market',
        free: true,
        official: true
    },
    {
        id: 'claude-skills',
        name: 'Anthropic Claude',
        description: 'Claude 官方技能与工具市场,Artifacts / Computer Use / MCP 原生支持',
        url: 'https://anthropic.com/claude',
        vendor: 'anthropic',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            'Claude',
            '官方'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'gemini-gems',
        name: 'Google Gemini Gems',
        description: 'Google Gemini 官方定制 Gems 市场,个性化 AI 助手 / 多模态 / 原生多语言',
        url: 'https://gemini.google.com',
        vendor: 'google',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            'Gemini',
            '官方'
        ],
        category: 'market',
        free: true,
        official: true
    },
    {
        id: 'grok',
        name: 'xAI Grok',
        description: 'Elon Musk 的 xAI 公司 Grok 模型,实时信息 / 幽默风格 / X 平台深度集成',
        url: 'https://x.ai',
        vendor: 'xai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"],
        tags: [
            'Grok',
            'xAI'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'mistral',
        name: 'Mistral AI',
        description: '欧洲 Mistral AI 开源模型平台,Mixtral / Codestral / 函数调用原生支持',
        url: 'https://mistral.ai',
        vendor: 'mistral',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            'Mistral',
            '开源'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'cohere',
        name: 'Cohere',
        description: 'Cohere 企业级 LLM 平台,Command R+ / Rerank / Embed 多模型协同',
        url: 'https://cohere.com',
        vendor: 'cohere',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            'Cohere',
            '企业'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'perplexity',
        name: 'Perplexity',
        description: 'Perplexity AI 搜索引擎,实时联网 / 引用溯源 / Pro 模型多选',
        url: 'https://perplexity.ai',
        vendor: 'perplexity',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            '搜索',
            '联网'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'deepseek',
        name: 'DeepSeek 深度求索',
        description: 'DeepSeek 开源大模型,V3 / R1 推理模型 / 极低价格 / 代码能力领先',
        url: 'https://deepseek.com',
        vendor: 'deepseek',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            'DeepSeek',
            '开源'
        ],
        category: 'market',
        free: true,
        official: true
    },
    {
        id: 'qwen',
        name: '阿里通义千问',
        description: '阿里巴巴通义千问模型市场,Qwen 系列 / 开源闭源双线 / 多模态',
        url: 'https://qwen.com',
        vendor: 'qwen',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            'Qwen',
            '阿里'
        ],
        category: 'market',
        free: true,
        official: true
    },
    {
        id: 'zhipu',
        name: '智谱 GLM',
        description: '智谱 AI GLM 系列模型市场,GLM-4 / CogVideoX / 开源 ChatGLM',
        url: 'https://open.bigmodel.cn',
        vendor: 'zhipu',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            'GLM',
            '智谱'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'moonshot',
        name: '月之暗面 Kimi',
        description: 'Moonshot AI Kimi 模型,超长上下文 / 文档解析 / 联网搜索',
        url: 'https://kimi.moonshot.cn',
        vendor: 'moonshot',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            'Kimi',
            '长上下文'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'doubao',
        name: '字节豆包',
        description: '字节跳动豆包大模型,火山引擎方舟平台 / 多模态 / 低价调用',
        url: 'https://volcengine.com/product/doubao',
        vendor: 'doubao',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            '豆包',
            '字跳'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'baidu-ernie',
        name: '百度文心',
        description: '百度文心一言 / ERNIE 模型市场,千帆平台 / 知识增强 / 产业级',
        url: 'https://yiyan.baidu.com',
        vendor: 'baidu',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            '文心',
            '百度'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'minimax',
        name: 'MiniMax',
        description: 'MiniMax 大模型平台,abab 系列 / 语音合成 / 视频生成全栈',
        url: 'https://minimaxi.com',
        vendor: 'minimax',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            'MiniMax',
            '多模态'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'hunyuan',
        name: '腾讯混元',
        description: '腾讯混元大模型,多模态 / 长文本 / 微信生态深度集成',
        url: 'https://hunyuan.tencent.com',
        vendor: 'hunyuan',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            '混元',
            '腾讯'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'yi',
        name: '零一万物 Yi',
        description: '李开复零一万物 Yi 系列模型,开源 / 闭源 / 长上下文',
        url: 'https://lingyiwanwu.com',
        vendor: 'yi',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            'Yi',
            '零一'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'spark',
        name: '讯飞星火',
        description: '科大讯飞星火大模型,语音交互 / 教育场景 / 国产自主',
        url: 'https://xinghuo.xfyun.cn',
        vendor: 'spark',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            '星火',
            '讯飞'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'baichuan',
        name: '百川智能',
        description: '王小川百川大模型,Baichuan 系列 / 搜索增强 / 医疗垂类',
        url: 'https://baichuan-ai.com',
        vendor: 'baichuan',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            '百川',
            '搜索'
        ],
        category: 'market',
        official: true
    },
    // ========================================
    // ★ AI 应用开发平台 — 12 项
    // ========================================
    {
        id: 'coze',
        name: 'Coze 扣子',
        description: '字节跳动 AI Bot 开发平台,可视化编排 / 插件市场 / 知识库 / 工作流',
        url: 'https://www.coze.com',
        vendor: 'coze',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bot$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Bot$3e$__["Bot"],
        tags: [
            'Bot',
            '字跳'
        ],
        category: 'market',
        free: true,
        official: true
    },
    {
        id: 'dify',
        name: 'Dify',
        description: 'Dify 开源 LLM 应用开发平台,工具 / 模型 / Agent 模板社区',
        url: 'https://dify.ai/marketplace',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$boxes$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Boxes$3e$__["Boxes"],
        tags: [
            '开源',
            'LLMOps'
        ],
        category: 'market',
        free: true
    },
    {
        id: 'huggingface-spaces',
        name: 'Hugging Face Spaces',
        description: 'Hugging Face 模型演示空间,数十万 AI 应用 / Demo / 模型在线体验',
        url: 'https://huggingface.co/spaces',
        vendor: 'huggingface',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$boxes$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Boxes$3e$__["Boxes"],
        tags: [
            'Demo',
            '开源'
        ],
        category: 'market',
        free: true,
        official: true
    },
    {
        id: 'poe',
        name: 'Poe',
        description: 'Quora 旗下 Poe AI 平台,聚合 100+ 顶级模型 / 自定义 Bot / 一键创建',
        url: 'https://poe.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$star$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Star$3e$__["Star"],
        tags: [
            '聚合',
            'Bot'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'character-ai',
        name: 'Character.AI',
        description: 'Character.AI 角色对话平台,百万级 AI 角色 / 个性化 / 沉浸式',
        url: 'https://character.ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bot$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Bot$3e$__["Bot"],
        tags: [
            '角色',
            '对话'
        ],
        category: 'market',
        free: true
    },
    {
        id: 'openwebui',
        name: 'OpenWebUI',
        description: '开源 AI Web UI,兼容 Ollama / OpenAI,内置工具 / 函数 / 知识库插件',
        url: 'https://openwebui.com',
        vendor: 'openwebui',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$globe$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Globe$3e$__["Globe"],
        tags: [
            '开源',
            'Ollama'
        ],
        category: 'market',
        free: true
    },
    {
        id: 'lobehub-plugins',
        name: 'LobeHub Plugins',
        description: 'LobeChat 插件市场,数百个 AI 工具插件,搜索 / 联网 / 多模态',
        url: 'https://lobehub.com/plugins',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$boxes$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Boxes$3e$__["Boxes"],
        tags: [
            '插件',
            'LobeChat'
        ],
        category: 'market',
        free: true
    },
    {
        id: 'flowise',
        name: 'Flowise',
        description: '开源无代码 LLM 应用构建器,拖拽式编排 / LangChain 可视化 / 自托管',
        url: 'https://flowiseai.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"],
        tags: [
            '无代码',
            '开源'
        ],
        category: 'market',
        free: true
    },
    {
        id: 'langflow',
        name: 'Langflow',
        description: 'DataStax 旗下开源 LangChain 可视化编排工具,拖拽构建 / 多模型',
        url: 'https://langflow.org',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"],
        tags: [
            '可视化',
            '开源'
        ],
        category: 'market',
        free: true
    },
    {
        id: 'anythingllm',
        name: 'AnythingLLM',
        description: '开源私有化 RAG 框架,文档问答 / 多用户 / 工作空间 / 自托管',
        url: 'https://anythingllm.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$boxes$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Boxes$3e$__["Boxes"],
        tags: [
            'RAG',
            '自托管'
        ],
        category: 'market',
        free: true
    },
    {
        id: 'privategpt',
        name: 'PrivateGPT',
        description: '开源私有化 LLM 框架,本地推理 / 文档问答 / 零数据泄露',
        url: 'https://privategpt.dev',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$check$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldCheck$3e$__["ShieldCheck"],
        tags: [
            '私有化',
            '本地'
        ],
        category: 'market',
        free: true
    },
    {
        id: 'quivr',
        name: 'Quivr',
        description: '开源 generative AI 第二大脑,知识库 / 多模型 / 团队协作',
        url: 'https://quivr.ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            '第二大脑',
            '开源'
        ],
        category: 'market',
        free: true
    },
    // ========================================
    // ★ 开发工具 / IDE 扩展 — 10 项
    // ========================================
    {
        id: 'cursor',
        name: 'Cursor',
        description: 'Cursor AI 代码编辑器,扩展市场 / MCP 集成 / 规则文件 / Agent 模式',
        url: 'https://cursor.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mouse$2d$pointer$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MousePointer2$3e$__["MousePointer2"],
        tags: [
            'IDE',
            '代码'
        ],
        category: 'ide',
        official: true
    },
    {
        id: 'vscode-marketplace',
        name: 'VSCode Marketplace',
        description: 'Visual Studio Code 扩展市场,AI 类扩展涵盖 Copilot / Continue / Cline',
        url: 'https://marketplace.visualstudio.com',
        vendor: 'microsoft',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Code$3e$__["Code"],
        tags: [
            'IDE',
            '微软'
        ],
        category: 'ide',
        free: true,
        official: true
    },
    {
        id: 'github-models',
        name: 'GitHub Models',
        description: 'GitHub 官方模型市场,免费体验主流 LLM,集成 Codespaces / Copilot',
        url: 'https://github.com/models',
        vendor: 'githubcopilot',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Code$3e$__["Code"],
        tags: [
            '模型',
            'GitHub'
        ],
        category: 'ide',
        free: true,
        official: true
    },
    {
        id: 'github-copilot',
        name: 'GitHub Copilot',
        description: 'GitHub 官方 AI 编程助手,Copilot Chat / Agent / PR Review / 多 IDE 支持',
        url: 'https://github.com/features/copilot',
        vendor: 'githubcopilot',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Code$3e$__["Code"],
        tags: [
            'Copilot',
            '编程'
        ],
        category: 'ide',
        official: true
    },
    {
        id: 'cline',
        name: 'Cline',
        description: '开源 AI 编程 Agent,VSCode 扩展,支持 MCP / 自定义工具 / 浏览器控制',
        url: 'https://cline.bot',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"],
        tags: [
            'Agent',
            'VSCode'
        ],
        category: 'ide',
        free: true
    },
    {
        id: 'continue',
        name: 'Continue',
        description: '开源 AI 编程助手,VSCode / JetBrains,自定义模型 / 代码补全 / Chat',
        url: 'https://continue.dev',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Code$3e$__["Code"],
        tags: [
            '开源',
            '补全'
        ],
        category: 'ide',
        free: true
    },
    {
        id: 'replit-agent',
        name: 'Replit Agent',
        description: 'Replit AI 编程 Agent 平台,云端开发环境 + Agent 商店 + 一键部署',
        url: 'https://replit.com',
        vendor: 'replit',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"],
        tags: [
            'IDE',
            '云端'
        ],
        category: 'ide',
        official: true
    },
    {
        id: 'windsurf',
        name: 'Windsurf',
        description: 'Codeium 出品 AI IDE,Cascade Agent / 多文件编辑 / MCP / Flux 工作流',
        url: 'https://codeium.com/windsurf',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mouse$2d$pointer$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MousePointer2$3e$__["MousePointer2"],
        tags: [
            'IDE',
            'Agent'
        ],
        category: 'ide',
        free: true
    },
    {
        id: 'trae',
        name: 'Trae IDE',
        description: '字节跳动 Trae AI IDE,多 Agent 协作 / MCP / Skills / 国际版 + 国内版',
        url: 'https://trae.ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mouse$2d$pointer$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__MousePointer2$3e$__["MousePointer2"],
        tags: [
            'IDE',
            '字跳'
        ],
        category: 'ide',
        free: true,
        official: true
    },
    {
        id: 'zed',
        name: 'Zed',
        description: 'Zed 高性能代码编辑器,Rust 编写 / 协作 / AI Assistant / 130+ 语言',
        url: 'https://zed.dev',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Code$3e$__["Code"],
        tags: [
            'IDE',
            'Rust'
        ],
        category: 'ide',
        free: true
    },
    // ========================================
    // ★ 协议 / 注册中心 / 模型聚合 — 12 项
    // ========================================
    {
        id: 'mcp-registry',
        name: 'MCP Registry',
        description: 'Model Context Protocol 官方服务器注册表,10000+ MCP Server 跨客户端复用',
        url: 'https://modelcontextprotocol.io',
        vendor: 'anthropic',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$server$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Server$3e$__["Server"],
        tags: [
            'MCP',
            '协议'
        ],
        category: 'mcp',
        free: true,
        official: true
    },
    {
        id: 'smithery',
        name: 'Smithery MCP',
        description: 'Smithery MCP Server 注册中心,一键安装 / 运行 / 管理 MCP 服务器',
        url: 'https://smithery.ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$server$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Server$3e$__["Server"],
        tags: [
            'MCP',
            '注册中心'
        ],
        category: 'mcp',
        free: true
    },
    {
        id: 'mcp-get',
        name: 'mcp-get',
        description: 'mcp-get CLI 工具,一键安装 / 管理 MCP Server,跨客户端统一',
        url: 'https://mcp-get.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$server$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Server$3e$__["Server"],
        tags: [
            'MCP',
            'CLI'
        ],
        category: 'mcp',
        free: true
    },
    {
        id: 'pulsemcp',
        name: 'PulseMCP',
        description: 'PulseMCP MCP Server 发现平台,精选 / 评分 / 分类 / 一键安装',
        url: 'https://pulsemcp.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$server$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Server$3e$__["Server"],
        tags: [
            'MCP',
            '目录'
        ],
        category: 'mcp',
        free: true
    },
    {
        id: 'langchain-hub',
        name: 'LangChain Hub',
        description: 'LangChain 官方 Prompt / Agent / Tool 仓库,LangGraph 工作流模板社区',
        url: 'https://smith.langchain.com/hub',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$link$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Link2$3e$__["Link2"],
        tags: [
            'Prompt',
            'Tool'
        ],
        category: 'market',
        free: true,
        official: true
    },
    {
        id: 'langgraph',
        name: 'LangGraph Studio',
        description: 'LangGraph 官方可视化 Agent 编排与调试工具,状态图 / 断点 / 回放',
        url: 'https://langchain.com/langgraph',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"],
        tags: [
            'LangGraph',
            '编排'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        description: '统一 LLM API 路由,300+ 模型聚合,内置函数调用 / 工具 / 结构化输出',
        url: 'https://openrouter.ai',
        vendor: 'openrouter',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$link$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Link2$3e$__["Link2"],
        tags: [
            'API',
            '聚合'
        ],
        category: 'model',
        free: true,
        official: true
    },
    {
        id: 'together-ai',
        name: 'Together AI',
        description: 'Together AI 推理平台,开源模型加速 / Fine-tune / Embedding / 重排',
        url: 'https://together.ai',
        vendor: 'together',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cpu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cpu$3e$__["Cpu"],
        tags: [
            '推理',
            '开源'
        ],
        category: 'model',
        official: true
    },
    {
        id: 'fireworks-ai',
        name: 'Fireworks AI',
        description: 'Fireworks AI 高速推理平台,开源模型 / serverless / 函数调用',
        url: 'https://fireworks.ai',
        vendor: 'fireworks',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"],
        tags: [
            '推理',
            'serverless'
        ],
        category: 'model',
        official: true
    },
    {
        id: 'groq',
        name: 'Groq',
        description: 'Groq 超低延迟推理平台,LPU 芯片 / 开源模型 / 毫秒级响应',
        url: 'https://groq.com',
        vendor: 'groq',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"],
        tags: [
            '推理',
            'LPU'
        ],
        category: 'model',
        free: true,
        official: true
    },
    {
        id: 'replicate',
        name: 'Replicate',
        description: 'Replicate 模型运行平台,开源模型 / API 调用 / 一键部署 / 图片视频生成',
        url: 'https://replicate.com',
        vendor: 'replicate',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layers$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Layers$3e$__["Layers"],
        tags: [
            '模型',
            '部署'
        ],
        category: 'model',
        official: true
    },
    {
        id: 'huggingface-models',
        name: 'Hugging Face Models',
        description: 'Hugging Face 模型仓库,百万级开源模型 / 权重下载 / Inference API',
        url: 'https://huggingface.co/models',
        vendor: 'huggingface',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cpu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cpu$3e$__["Cpu"],
        tags: [
            '模型',
            '开源'
        ],
        category: 'model',
        free: true,
        official: true
    },
    // ========================================
    // ★ 本地 / 推理 / 国产 — 10 项
    // ========================================
    {
        id: 'ollama',
        name: 'Ollama',
        description: 'Ollama 本地大模型运行框架,一行命令跑 Llama / Qwen / DeepSeek / 离线',
        url: 'https://ollama.com',
        vendor: 'ollama',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cpu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cpu$3e$__["Cpu"],
        tags: [
            '本地',
            '开源'
        ],
        category: 'model',
        free: true
    },
    {
        id: 'lm-studio',
        name: 'LM Studio',
        description: 'LM Studio 本地 LLM 桌面应用,GUI / 模型下载 / OpenAI 兼容 API',
        url: 'https://lmstudio.ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cpu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cpu$3e$__["Cpu"],
        tags: [
            '本地',
            'GUI'
        ],
        category: 'model',
        free: true
    },
    {
        id: 'jan',
        name: 'Jan',
        description: 'Jan 开源本地 AI 助手,桌面应用 / 离线 / OpenAI 兼容 / 自托管',
        url: 'https://jan.ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cpu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cpu$3e$__["Cpu"],
        tags: [
            '本地',
            '开源'
        ],
        category: 'model',
        free: true
    },
    {
        id: 'cerebras',
        name: 'Cerebras',
        description: 'Cerebras 超快推理平台,Wafer-Scale Engine / 极速 token 生成',
        url: 'https://cerebras.ai',
        vendor: 'cerebras',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cpu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cpu$3e$__["Cpu"],
        tags: [
            '推理',
            '极速'
        ],
        category: 'model',
        official: true
    },
    {
        id: 'sambanova',
        name: 'SambaNova',
        description: 'SambaNova AI 推理平台,RDU 芯片 / 开源模型 / 企业级部署',
        url: 'https://sambanova.ai',
        vendor: 'sambanova',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cpu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cpu$3e$__["Cpu"],
        tags: [
            '推理',
            '企业'
        ],
        category: 'model',
        official: true
    },
    {
        id: 'siliconcloud',
        name: '硅基流动 SiliconCloud',
        description: 'SiliconCloud 国产模型聚合推理平台,开源模型 / 极低价格 / 高并发',
        url: 'https://siliconflow.cn',
        vendor: 'siliconcloud',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cpu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cpu$3e$__["Cpu"],
        tags: [
            '推理',
            '国产'
        ],
        category: 'model',
        free: true
    },
    {
        id: 'modelscope',
        name: 'ModelScope 魔搭',
        description: '阿里达摩院 ModelScope 模型社区,国产开源模型 / Demo / 数据集',
        url: 'https://modelscope.cn',
        vendor: 'modelscope',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cpu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cpu$3e$__["Cpu"],
        tags: [
            '模型',
            '阿里'
        ],
        category: 'model',
        free: true,
        official: true
    },
    {
        id: 'volcengine',
        name: '火山方舟',
        description: '字节跳动火山引擎方舟大模型平台,豆包 / 多模型 / 精调 / 推理加速',
        url: 'https://volcengine.com/product/ark',
        vendor: 'volcengine',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cpu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cpu$3e$__["Cpu"],
        tags: [
            '火山',
            '字跳'
        ],
        category: 'model',
        official: true
    },
    {
        id: 'bailian',
        name: '阿里百炼',
        description: '阿里云百炼大模型平台,通义系列 / 精调 / RAG / Agent 一站式',
        url: 'https://bailian.console.aliyun.com',
        vendor: 'bailian',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cpu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cpu$3e$__["Cpu"],
        tags: [
            '百炼',
            '阿里'
        ],
        category: 'model',
        official: true
    },
    {
        id: 'tencent-cloud-lke',
        name: '腾讯云大模型知识引擎',
        description: '腾讯云 LKE 大模型知识引擎,RAG / Agent / 知识库 / 行业模型',
        url: 'https://lke.cloud.tencent.com',
        vendor: 'tencent',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cpu$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cpu$3e$__["Cpu"],
        tags: [
            '腾讯',
            'RAG'
        ],
        category: 'model',
        official: true
    },
    // ========================================
    // ★ 自动化 / 工作流 — 8 项
    // ========================================
    {
        id: 'n8n-templates',
        name: 'n8n Templates',
        description: 'n8n 工作流自动化平台模板市场,数千个 AI 工作流模板一键导入',
        url: 'https://n8n.io/templates',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"],
        tags: [
            '工作流',
            '自动化'
        ],
        category: 'workflow',
        free: true
    },
    {
        id: 'make-com',
        name: 'Make.com',
        description: 'Make 可视化自动化平台,1500+ 应用集成 / AI 节点 / 场景化模板',
        url: 'https://make.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"],
        tags: [
            '自动化',
            '集成'
        ],
        category: 'workflow',
        official: true
    },
    {
        id: 'zapier-ai',
        name: 'Zapier AI Actions',
        description: 'Zapier AI Actions 市场,7000+ 应用集成 / AI 中央 / Agent 自动化',
        url: 'https://zapier.com/ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"],
        tags: [
            '自动化',
            'AI'
        ],
        category: 'workflow',
        official: true
    },
    {
        id: 'pipedream',
        name: 'Pipedream',
        description: 'Pipedream 开发者自动化平台,2600+ 应用 / 代码 + 无代码 / AI 工作流',
        url: 'https://pipedream.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"],
        tags: [
            '自动化',
            '开发者'
        ],
        category: 'workflow',
        free: true
    },
    {
        id: 'activepieces',
        name: 'Activepieces',
        description: '开源 AI 自动化平台,200+ 集成 / 自托管 / Zapier 替代品',
        url: 'https://activepieces.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"],
        tags: [
            '自动化',
            '开源'
        ],
        category: 'workflow',
        free: true
    },
    {
        id: 'n8n-cloud',
        name: 'n8n Cloud',
        description: 'n8n 官方云端版本,AI 工作流 / Agent / 自动化 / 无需自托管',
        url: 'https://n8n.io/cloud',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"],
        tags: [
            '自动化',
            '云端'
        ],
        category: 'workflow',
        official: true
    },
    {
        id: 'relay',
        name: 'Relay.app',
        description: 'Relay 现代化自动化平台,AI 步骤 / 人机协作 / 100+ 应用集成',
        url: 'https://relay.app',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"],
        tags: [
            '自动化',
            'AI'
        ],
        category: 'workflow'
    },
    {
        id: 'bardeen',
        name: 'Bardeen',
        description: 'Bardeen AI 浏览器自动化,Chrome 扩展 / 一键自动化 / AI 工作流',
        url: 'https://bardeen.ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"],
        tags: [
            '自动化',
            '浏览器'
        ],
        category: 'workflow',
        free: true
    },
    // ========================================
    // ★ 云厂商 AI 平台 — 8 项
    // ========================================
    {
        id: 'aws-bedrock',
        name: 'AWS Bedrock',
        description: 'Amazon Bedrock 托管 LLM 服务,多模型 / Knowledge Base / Agent / Guardrails',
        url: 'https://aws.amazon.com/bedrock',
        vendor: 'bedrock',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$building$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Building2$3e$__["Building2"],
        tags: [
            'AWS',
            '云'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'azure-ai',
        name: 'Azure AI Foundry',
        description: 'Microsoft Azure AI Foundry 模型目录,OpenAI / 开源模型 / 多模态 / 企业级',
        url: 'https://ai.azure.com',
        vendor: 'azureai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$building$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Building2$3e$__["Building2"],
        tags: [
            'Azure',
            '云'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'vertex-ai',
        name: 'Vertex AI Agent Builder',
        description: 'Google Cloud Vertex AI Agent Builder,企业级 Agent / RAG / 模型花园',
        url: 'https://cloud.google.com/vertex-ai',
        vendor: 'vertexai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$building$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Building2$3e$__["Building2"],
        tags: [
            'GCP',
            'Agent'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'copilot-studio',
        name: 'Microsoft Copilot Studio',
        description: 'Microsoft Copilot Studio 低代码 Agent 构建平台,深度集成 M365 生态',
        url: 'https://copilotstudio.microsoft.com',
        vendor: 'microsoft',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bot$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Bot$3e$__["Bot"],
        tags: [
            '微软',
            'Copilot'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'aws-q-developer',
        name: 'Amazon Q Developer',
        description: 'AWS Amazon Q Developer AI 编程助手,代码生成 / 安全扫描 / AWS 集成',
        url: 'https://aws.amazon.com/q/developer',
        vendor: 'bedrock',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$code$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Code$3e$__["Code"],
        tags: [
            'AWS',
            '编程'
        ],
        category: 'ide',
        official: true
    },
    {
        id: 'watsonx',
        name: 'IBM watsonx',
        description: 'IBM watsonx AI 平台,企业级 / watsonx.ai / watsonx Assistant / 治理',
        url: 'https://ibm.com/watsonx',
        vendor: 'ibm',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$building$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Building2$3e$__["Building2"],
        tags: [
            'IBM',
            '企业'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'alibaba-cloud-bailian',
        name: '阿里云百炼',
        description: '阿里云百炼大模型平台,通义千问 / 精调 / RAG / Agent 一站式',
        url: 'https://bailian.aliyun.com',
        vendor: 'alibaba-cloud',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$building$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Building2$3e$__["Building2"],
        tags: [
            '阿里云',
            '百炼'
        ],
        category: 'market',
        official: true
    },
    {
        id: 'huawei-cloud-pangu',
        name: '华为云盘古大模型',
        description: '华为云盘古大模型,行业 AI / 工业质检 / 气象 / 金融 / 政企',
        url: 'https://huaweicloud.com/product/pangu.html',
        vendor: 'huawei-cloud',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$building$2d$2$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Building2$3e$__["Building2"],
        tags: [
            '华为云',
            '盘古'
        ],
        category: 'market',
        official: true
    },
    // ========================================
    // ★ 代码执行 / 沙箱 — 6 项
    // ========================================
    {
        id: 'e2b',
        name: 'E2B',
        description: 'E2B 沙箱代码执行平台,LLM 安全运行代码 / 文件系统 / 进程 / 网络隔离',
        url: 'https://e2b.dev',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"],
        tags: [
            '沙箱',
            '代码'
        ],
        category: 'tool',
        free: true
    },
    {
        id: 'code-interpreter-mcp',
        name: 'Code Interpreter MCP',
        description: 'OpenAI Code Interpreter 兼容 MCP Server,AI 执行 Python / 数据分析',
        url: 'https://github.com/modelcontextprotocol/servers',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"],
        tags: [
            '沙箱',
            'Python'
        ],
        category: 'tool',
        free: true
    },
    {
        id: 'daytona',
        name: 'Daytona',
        description: 'Daytona 开源开发环境管理,沙箱 / 远程工作区 / AI 代码执行环境',
        url: 'https://daytona.io',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"],
        tags: [
            '沙箱',
            '开源'
        ],
        category: 'tool',
        free: true
    },
    {
        id: 'modal',
        name: 'Modal',
        description: 'Modal Serverless Python 云计算,跑 AI / 数据 / 模型推理 / 任务编排',
        url: 'https://modal.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$cloud$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Cloud$3e$__["Cloud"],
        tags: [
            'Serverless',
            'Python'
        ],
        category: 'tool',
        free: true
    },
    {
        id: 'replit-mobile',
        name: 'Replit Mobile',
        description: 'Replit 移动编程,手机 / 平板写代码 / AI Agent / 云端 IDE',
        url: 'https://replit.com/mobile',
        vendor: 'replit',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"],
        tags: [
            'IDE',
            '移动'
        ],
        category: 'ide',
        free: true
    },
    {
        id: 'jupyter',
        name: 'Jupyter AI',
        description: 'Jupyter AI Notebook,AI 助手 / 代码生成 / 解释 / 多模型支持',
        url: 'https://jupyter.org/ai',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$terminal$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Terminal$3e$__["Terminal"],
        tags: [
            'Notebook',
            'AI'
        ],
        category: 'tool',
        free: true
    },
    // ========================================
    // ★ 安全 / 鉴权 — 6 项
    // ========================================
    {
        id: '1password-mcp',
        name: '1Password MCP',
        description: '1Password MCP Server,AI 安全访问密码 / 凭据 / 保险库 / 自动填充',
        url: 'https://1password.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"],
        tags: [
            '安全',
            '密码'
        ],
        category: 'security',
        official: true
    },
    {
        id: 'bitwarden',
        name: 'Bitwarden',
        description: 'Bitwarden 开源密码管理,跨平台 / 团队共享 / MCP Server / 自托管',
        url: 'https://bitwarden.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"],
        tags: [
            '安全',
            '开源'
        ],
        category: 'security',
        free: true
    },
    {
        id: 'auth0',
        name: 'Auth0',
        description: 'Okta Auth0 身份认证平台,SSO / MFA / OAuth2 / 社交登录 / 企业级',
        url: 'https://auth0.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"],
        tags: [
            '安全',
            '认证'
        ],
        category: 'security',
        official: true
    },
    {
        id: 'clerk',
        name: 'Clerk',
        description: 'Clerk 现代化用户认证,React / Next.js 友好 / 多因子 / B2B / 组织',
        url: 'https://clerk.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lock$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Lock$3e$__["Lock"],
        tags: [
            '安全',
            'Next.js'
        ],
        category: 'security'
    },
    {
        id: 'cloudflare-waf',
        name: 'Cloudflare WAF',
        description: 'Cloudflare Web 应用防火墙,DDoS 防护 / Bot 管理 / API 安全',
        url: 'https://cloudflare.com/waf',
        vendor: 'cloudflare',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$check$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldCheck$3e$__["ShieldCheck"],
        tags: [
            '安全',
            'WAF'
        ],
        category: 'security',
        official: true
    },
    {
        id: 'snyk',
        name: 'Snyk',
        description: 'Snyk 开发者安全平台,依赖漏洞 / 容器 / IaC / 代码安全 / AI 修复',
        url: 'https://snyk.io',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$check$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldCheck$3e$__["ShieldCheck"],
        tags: [
            '安全',
            '漏洞'
        ],
        category: 'security'
    },
    // ========================================
    // ★ 数据分析 / BI — 6 项
    // ========================================
    {
        id: 'airtable-mcp',
        name: 'Airtable MCP',
        description: 'Airtable MCP Server,AI 操控低代码数据库 / 表格 / 视图 / 自动化',
        url: 'https://airtable.com/developers',
        vendor: 'airtable',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            '数据',
            'Airtable'
        ],
        category: 'data',
        official: true
    },
    {
        id: 'google-sheets-mcp',
        name: 'Google Sheets MCP',
        description: 'Google Sheets MCP Server,AI 读写 / 分析 / 计算 / 图表 / 数据透视',
        url: 'https://developers.google.com/sheets',
        vendor: 'google',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            '数据',
            'Sheets'
        ],
        category: 'data',
        official: true
    },
    {
        id: 'excel-mcp',
        name: 'Microsoft Excel MCP',
        description: 'Microsoft Excel MCP Server,AI 操控工作簿 / 公式 / 图表 / 数据分析',
        url: 'https://www.microsoft.com/excel',
        vendor: 'microsoft',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            '数据',
            'Excel'
        ],
        category: 'data',
        official: true
    },
    {
        id: 'snowflake',
        name: 'Snowflake',
        description: 'Snowflake 云数据仓库,AI 数据云 / Cortex AI / Streamlit / 数据共享',
        url: 'https://snowflake.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            '数据',
            '云'
        ],
        category: 'data',
        official: true
    },
    {
        id: 'databricks',
        name: 'Databricks',
        description: 'Databricks 数据 + AI 平台,Lakehouse / MLflow / Mosaic AI / Delta',
        url: 'https://databricks.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            '数据',
            'AI'
        ],
        category: 'data',
        official: true
    },
    {
        id: 'motherduck',
        name: 'MotherDuck',
        description: 'MotherDuck DuckDB 云端数据仓库,本地 + 云 / SQL / AI 数据分析',
        url: 'https://motherduck.com',
        fallbackIcon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$database$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__Database$3e$__["Database"],
        tags: [
            '数据',
            'DuckDB'
        ],
        category: 'data',
        free: true
    }
];
// ============================================================================
// 真实集成度映射表(2026-07-22 立,基于 ai-service mcp_server.py + llm_gateway 调研)
// 集中管理避免逐项散落,PluginMarketplace 渲染时查询 getPluginIntegration(id)。
// ============================================================================
/** ai-service 后端有对应 MCP 工具(可真实调用,非纯 prompt 意图)的 plugin id */ const REAL_INTEGRATED_IDS = new Set([
    // 浏览器控制(12)→ 走 ai-service 12 个 browser_* MCP 工具(桥接到 extension 端)
    'playwright-mcp',
    'puppeteer',
    'browser-use',
    'browserbase',
    'stagehand',
    'skyvern',
    'browserless',
    'selenium',
    'playwright',
    'multion',
    'axiom',
    'brightdata',
    // 电脑控制(7)→ 走 ai-service 10 个 computer_* MCP 工具(桥接到 desktop 端)
    'anthropic-computer-use',
    'claude-desktop',
    'self-operating-computer',
    'openadapt',
    'adept-act',
    'agsafety-agent',
    'openai-operator',
    // 文件系统(1)
    'filesystem-mcp',
    // 数据库(1)→ ai-service db_query MCP 工具(只读 SELECT/WITH)
    'postgres-mcp',
    // 搜索(1)→ ai-service search_web / web_search MCP 工具
    'duckduckgo',
    // 代码执行(2)
    'code-interpreter-mcp',
    'e2b',
    // git(1)→ ai-service git_operations MCP 工具
    'github-mcp',
    // LangGraph 已用
    'langgraph'
]);
/** LiteLLM 已接入的模型供应商 plugin id(需用户配 .env 激活) */ const MODEL_INTEGRATED_IDS = new Set([
    // 原生 provider 适配器(14 个)
    'claude-skills',
    'doubao',
    'zhipu',
    'qwen',
    'hunyuan',
    'volcengine',
    'kling',
    'openrouter',
    // LiteLLM catchall(模型前缀路由,60+ env key)
    'grok',
    'mistral',
    'cohere',
    'perplexity',
    'deepseek',
    'moonshot',
    'baidu-ernie',
    'minimax',
    'yi',
    'spark',
    'baichuan',
    'together-ai',
    'fireworks-ai',
    'groq',
    'replicate',
    'ollama',
    'lm-studio',
    'jan',
    'cerebras',
    'sambanova',
    'siliconcloud',
    'modelscope',
    'bailian',
    'alibaba-cloud-bailian',
    'aws-bedrock',
    'azure-ai',
    'vertex-ai',
    'watsonx',
    'huggingface-models',
    'huggingface-spaces',
    'workers-ai',
    'github-models'
]);
function getPluginIntegration(pluginId) {
    if (REAL_INTEGRATED_IDS.has(pluginId)) return true;
    if (MODEL_INTEGRATED_IDS.has(pluginId)) return 'model';
    return undefined;
}
}),
];

//# sourceMappingURL=apps_web_app_%28main%29_plugins_plugins-data_ts_3783b56e._.js.map