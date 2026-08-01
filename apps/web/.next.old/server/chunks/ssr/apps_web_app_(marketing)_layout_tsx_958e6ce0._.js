module.exports = [
"[project]/apps/web/app/(marketing)/layout.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>MarketingLayout,
    "metadata",
    ()=>metadata
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@15.5.20_@babel+core@7.29.7_@opentelemetry+api@1.9.1_@playwright+test@1.61.1_react-dom@19_4n2gmm2d6xxijodamm5db6i3ae/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
;
const metadata = {
    title: {
        default: '智汇 AI 社区 — 8 端全覆盖 · 100+ LLM · 自研 CLI 对标 Claude Code · 省 ¥18 万/年',
        template: '%s | 智汇 AI'
    },
    description: '8 端全覆盖(Web/桌面/移动/小程序/CLI/扩展/API/AI-Service)企业级 AI 平台,覆盖范围较广。100+ LLM 大模型一个 API Key 全访问(国际 30+/国产 15+/云 40+),LangGraph+MCP+A2A 三栈合一,11 MCP 工具+5 A2A 端点+6 ACP 扩展,17 项 pre-commit 守门+122+ migrations 工业级严谨。5 大决策者场景(降本/提效/学习/创新/决策)· 8 项可量化 ROI(省 ¥18-30 万/年 · 10× 加速 · 60% 降本 · 99.9% SLA)· 8 行竞品对比多维度可对标 Claude Code/Cursor/ChatGPT。限 18 席决策者 · 早鸟价 ¥6000/年(3.3 折)· 不满意全额退款 · 1v1 AI 顾问 + AI 文化落地陪跑。',
    keywords: [
        'AI 平台',
        '8 端全覆盖',
        '100+ LLM',
        'LangGraph',
        'MCP',
        'A2A',
        'ACP Server',
        '自研 CLI',
        'Claude Code 替代',
        'Cursor 替代',
        'ChatGPT 替代',
        '企业 AI',
        '决策者社群',
        'AI 文化落地',
        '人机协同',
        'Qwen',
        'DeepSeek',
        'GLM',
        'Llama',
        'AI 降本',
        'AI 提效',
        'ROI',
        'AI 教育',
        'AI 培训',
        'AI 课程',
        'AI 直播',
        '企业 AI 平台',
        '决策者 AI 顾问',
        '18 席决策者',
        'AI 工作流',
        '智能体'
    ],
    openGraph: {
        type: 'website',
        locale: 'zh_CN',
        siteName: '智汇 AI 社区',
        title: '智汇 AI 社区 — 8 端全覆盖 · 100+ LLM · 自研 CLI · 省 ¥18 万/年',
        description: '8 端全覆盖企业级 AI 平台 · 5 大决策者场景 · 8 项可量化 ROI · 8 行竞品对比多维度可对标 · 限 18 席 · 早鸟价 ¥6000/年 · 不满意全额退款'
    }
};
function MarketingLayout({ children }) {
    return(// 2026-07-31 第十六次微调(用户反馈"内容展示区左侧贴屏边 / 右侧有间距,应该统一"):
    // 拆成 wrapper + 卡片双层,跟 MainShell 完全对齐:
    // - wrapper: pb-2 pl-2 pr-2  ← 给卡片 8px 边距(卡片本身不再贴屏边)
    // - card:    rounded-xl bg-shell-panel overflow-hidden  ← 卡片视觉
    // 移动端 sidebar 隐藏 → wrapper 占满 work-area → 卡片有 8px 左右呼吸空(对称)
    // 桌面端 sidebar 130px → wrapper 在 sidebar 右侧 → 卡片有 8px 左右呼吸空 + sidebar 130px(总 138px 视觉缓冲)
    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex min-h-0 flex-1 flex-col pb-2 pl-2 pr-2",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$15$2e$5$2e$20_$40$babel$2b$core$40$7$2e$29$2e$7_$40$opentelemetry$2b$api$40$1$2e$9$2e$1_$40$playwright$2b$test$40$1$2e$61$2e$1_react$2d$dom$40$19_4n2gmm2d6xxijodamm5db6i3ae$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-shell-panel",
            children: children
        }, void 0, false, {
            fileName: "[project]/apps/web/app/(marketing)/layout.tsx",
            lineNumber: 72,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/app/(marketing)/layout.tsx",
        lineNumber: 71,
        columnNumber: 5
    }, this));
}
}),
];

//# sourceMappingURL=apps_web_app_%28marketing%29_layout_tsx_958e6ce0._.js.map