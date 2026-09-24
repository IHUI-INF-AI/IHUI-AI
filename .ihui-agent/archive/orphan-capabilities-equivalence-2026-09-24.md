# 孤儿 worktree 里三族"主仓不存在"的能力 —— 等价性核查与迁移工作清单(2026-09-24)

来源:收口 7 个断链 worktree 时,按 AGENTS.md §7 三问要求核查"这些文件承载什么功能 / 主仓是否有等价实现"。
**只按路径名 grep 不算等价性判断**,故逐族读源码 + 多落点交叉找对侧实现。源码原文在
`D:\DevEnv\backups\archives\ihui-orphan-worktrees\{wt-p2-12,wt-p2-13,wt-p2-14}-unique\`,一行没丢。
本文件是**交接档**,不是待办清单:迁不迁属新功能开发,按 §24 须由用户确认后再动。

## 结论总表

| 族 | 归档内容 | 定性 | 处置 |
|---|---|---|---|
| P2-13 管理台 AI 部署诊断 | `apps/api/src/routes/deploy-diagnosis.ts`(130)+ `apps/web/app/(main)/admin/deploy-diagnosis/page.tsx`(273)+ `packages/api-client/src/endpoints/admin-deploy.ts`(53) | **确认无等价物** | 迁(三文件零改动可落地) |
| P2-13 本机采集脚本 | `deploy/prod-bundle/ai-diagnose.sh`(202) | **CLI 侧已有更强等价**:`deploy/scripts/ai-diagnose.mjs`(170,自带脱敏、6 段报告,并已自动接线到 `deploy/scripts/deploy.sh` 四个失败点) | 不迁脚本;**prod-bundle 链路缺诊断**(约 5 行改,复用现成 .mjs) |
| P2-13 部署脚本 | `deploy/prod-bundle/deploy.sh`(307) | 是主仓同名文件的**旧版**,唯一差异 `CURRENT_STAGE` 全文只赋值不读取(死代码) | **不迁** —— 迁了会把管理员口令安全文案退回旧版 |
| P2-14 技能市场详情 | `[name]/{page,PageClient}.tsx`(245)+ `endpoints/skills.ts`(47) | **部分等价**:主仓 `/skills-market` 的 `SkillDetailDialog` 已覆盖字段与更多能力(订阅/评分),但**无 URL 深链、无 listing 级上下架、无 owner 判定、后端两路由不存在** | **不要原样迁**(会与弹层双轨);补 URL 同步 + 后端 2 路由 + 契约 3 字段 |
| P2-12 小程序卡片族 | `ai/cards/{index,PlanCard,ToolCallCard,TerminalCard}.tsx` + `ai/types.ts` | **主仓为超集**(`cards/ai-cards.tsx` 469 行 + 类型化 SSE 回调归约,比归档的裸 JSON 嗅探更严格) | 不迁 |
| P2-12 小程序 Markdown | `ai/Markdown.tsx`(446) | **确认没有,且缺口比"没组件"更大**:`ChatMessageItem.tsx:103` 主动剥掉 `*` 标记,围栏代码块/列表/行内码/引用/表格在小程序全退化为纯文本 | **必须迁**(纯新增,可按 §9 标"平台独占") |
| P2-12 子代理卡片 | `ai/cards/SubagentCard.tsx`(64) | **确认没有**:小程序侧 subagent 只产平铺文本行(`chat.tsx:579-584`),`StreamActivityCardsProps` 无 subagent 槽;web 端有 `sub-agent-activity-feed.tsx` | **必须迁**(否则 §9 双端不连通) |

净迁约 **6 个新文件 / 570 行**(归档 2342 行里约 1180 行已被主仓覆盖或已退化)。

## 迁移必须注意的三处"归档自身不完整"(不修就是坑)
1. **P2-14 的后端已随孤儿副本一起丢失**:`wt-p2-14-unique/apps/api/` 下只有 `tsbuildinfo`,零源码 —— 端点迁过来必 404,后端两个路由要重写。
2. **P2-12 卡片族不可编译**:4 个组件都 `from './kit'`,而 `kit.tsx` 没被恢复(`index.tsx` 自己重复定义了同名导出)→ 迁前先反推重建 kit,或把 import 改指 `./index`。
3. **P2-13 归档脚本 4 个输入里 3 个在主仓没有生产者**:`.last-deploy-result.json` 全仓零命中、`prod-bundle/health-check.sh` 不支持 `--json`、`prod-bundle/deploy.sh` 不写 `logs/deploy-*.log`;只有 `containerLogs` 有内容。→ 补 prod-bundle 诊断时必须一并补结果落盘,否则迁来的是个"什么都看不到"的脚本。

## 需要动的注册点(逐项实测过邻居位置)
- `apps/api/src/routes/index.ts` 加 `server.register(deployDiagnosisRoutes, { prefix: '/api/admin' })`(邻居 `:503/:504/:508`)。
- `packages/api-client/src/index.ts` 加 `export * from './endpoints/admin-deploy'`(邻居 `:107/:108`)。
- `apps/web/src/components/layout/AdminNav.tsx` 加一行(邻居 `:337-341`)。
- i18n:`admin.deployDiagnosis.*` 与 `ai.markdown.linkCopied` 需 **5 语种**新增(现全零命中);卡片状态键主仓用 `status.{done,failed}`,归档用 `success/error` → 要么 remap 要么补键。
- `AICardsData`(`cards/types.ts:239`)与 `StreamActivityCardsProps`(`ai-cards.tsx:417-420`)需加 `subagents` 字段 ⇒ 触及 i18n + 两端,按 §9"默认全端连通"处理,不得只改小程序一端。

## 找过且零命中的位置(防"没搜到=不存在")
`apps/api/src/routes/` 全部 313 项、`routes/index.ts` 373 处 register、`apps/web/app/(main)/admin/` 190 项、
`AdminNav.tsx`/`nav-data.ts`/`path-labels.ts`、`packages/api-client/src/endpoints/` 95 项 + 导出面、
`packages/i18n/messages/{web,miniapp-taro}/*.json`、`deploy/` 全域(docker compose 链与 `win/*.ps1` 分别零命中)、
`apps/web/src/lib/ui-routes.generated.ts`(skills 组无任何 `param:true` 动态段)、`packages/ui-native/`、
`apps/miniapp-taro/package.json`(无任何 markdown 依赖)。
计划文档面 `grep P2-12|P2-13|P2-14 PROJECT_PLAN.md AGENTS.md README.md` **全零命中** → 这三族从来没有"计划上已判定不做"的豁免依据,唯一例外是 `deploy/scripts/ai-diagnose.mjs` 头注释自标 P2-13(CLI 一角已落地并被认领)。