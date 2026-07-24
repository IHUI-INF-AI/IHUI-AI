# scripts/ 守门脚本索引

本目录汇集 IHUI-AI 仓库的全部 Node.js 守门/审计/工具脚本(共 93 个 `.mjs`),覆盖 pre-commit 钩子、迁移审计、i18n 流水线、Git 协作守门、部署自检与运维工具。所有脚本均为 ESM(`.mjs`)、零第三方依赖(纯 Node 内置模块),通过 `guardian-runner.mjs` 在 pre-commit 单进程批量执行,详见 `AGENTS.md` 守门脚本速查表(pre-commit 第 1-29 项)。

---

## 一、i18n 守门与处理(25 个)

涵盖 i18n 键完整性校验、中文残留扫描、AI 翻译流水线、品牌术语映射、深度审校与修复、孤键清理等。

| 脚本名 | 用途 | pre-commit 项 | 备注 |
| --- | --- | --- | --- |
| check-i18n-keys.mjs | i18n 键完整性 + parity + 翻译白名单(15 条豁免) | 2 / 16 | 支持 `--staged` `--target=web\|extension` |
| check-i18n-broken-en.mjs | en.json 破碎机翻英文检测(no-space-concat / case-chaos / pinyin) | 2e | 支持 `--readme` |
| check-i18n-messages-exist.mjs | 4 端(desktop/extension/mobile-rn/miniapp-taro)i18n messages 文件存在性 | — | MIGRATION_INTEGRITY_REPORT §6.3 P0-7 |
| scan-i18n-zh-residue.mjs | 通用 i18n 中文残留守门(zh-TW opencc / ko 字符范围 / ja warn-only) | 2b / 2c / 2d | 替代 scan-zh-tw-simp / scan-ko-zh-residue |
| scan-zh-tw-simp.mjs | 扫描 zh-TW.json 简体字残留(opencc-js) | — | 已被 scan-i18n-zh-residue 替代,保留兼容 |
| scan-zh-tw-untranslated.mjs | 扫描 zh-TW.json 漏译英文 value,结果写 `_scan_result.json` | — | 一次性扫描工具 |
| scan-hardcoded-zh.mjs | 扫描 apps/web 下硬编码中文字符串(未走 t()/next-intl) | — | 支持 `--json` `--top N` `--exit 1` |
| i18n-diff.mjs | i18n AI 翻译流水线差异检测器(零 LLM API),输出 pending.json | 2f-web / 2f-miniapp-taro | 与 i18n-apply.mjs 配套 |
| i18n-apply.mjs | i18n AI 翻译流水线应用器,按 zh-CN 基准重排 key 顺序 | — | 读 `.trae-cn/tmp/i18n-translations.json` |
| apply-brand-glossary.mjs | 应用 brand-glossary.json 品牌/字体/术语 canonical 映射 | — | 支持 `--dry-run` |
| apply-translation-fallback.mjs | 为 ja/ko 补全 ASCII(===en)未翻译键(全角 Latin 兜底) | — | 机器翻译 fallback |
| apply-i18n-translations.mjs | 应用"英文值 → 翻译值"映射到语言文件 | — | 配合 translate-i18n-batch |
| analyze-unique-i18n-values.mjs | 统计未翻译键中的唯一英文值,输出到 goal-runtime JSON | — | 翻译前置分析 |
| audit-i18n-unused-keys.mjs | i18n 无引用 key 审计,输出 markdown 报告(只审计不删除) | — | 2026-07-25 立 |
| audit-i18n-missing-evaluate.mjs | i18n 缺失 key 三分类评估(阶段 6) | — | 迁移审计阶段产物 |
| deep-i18n-audit.mjs | 4 语言 i18n 深度规则审校(zh-TW 繁简 / ja 占位 / ko 乱码 / 一致性) | — | 支持 `--quiet` `--report` |
| export-untranslated-i18n.mjs | 导出未翻译键(值===en 且纯 ASCII)到 goal-runtime JSON | — | 供批量翻译使用 |
| fix-missing-i18n-keys.mjs | 补齐 pre-commit 检测到的 30 个缺失 i18n 键 | — | 一次性修复脚本 |
| fix-i18n-deep.mjs | i18n 深度审校问题修复(配套 deep-i18n-audit) | — | 修改 zh-TW/ja/ko |
| fix-zh-tw-simp.mjs | 修复 zh-TW.json 简体字残留(opencc-js cn→tw) | — | 与 scan-zh-tw-simp 配套 |
| fix-zhtw-parity.mjs | 修复 zh-CN↔zh-TW parity(hardcoded 命名空间覆盖) | — | 解决 1134 个 parity 差异 |
| prune-orphan-i18n-namespaces.mjs | 删除 5 个孤键命名空间(hardcoded/data/text/title/return) | — | 5 语言同步 |
| sync-i18n-fixes.mjs | i18n 一键补全(5 个新页面 + 29 个缺失键,5 语言同步) | — | 一次性补全脚本 |
| translate-i18n-batch.mjs | 用 StepFun AI 批量翻译 i18n 未翻译键 | — | 调用外部 LLM API |
| verify-i18n.mjs | 验证 5 个 i18n JSON 语法 + 重复键检测 | — | 替代 PowerShell ConvertFrom-Json |

---

## 二、迁移审计(7 个)

IHUI-AI 架构迁移(Java 微服务 → TS Monorepo)的多阶段审计脚本,比对历史项目存档与当前仓库,输出 CSV/JSON 报告。

| 脚本名 | 用途 | pre-commit 项 | 备注 |
| --- | --- | --- | --- |
| audit-migration.mjs | 4 合 1 审计脚本(i18n/frontend-routes/db-fields/api-routes) | — | `--target=<子项>` 切换 |
| audit-migration-file-list.mjs | 阶段 1:文件清单级迁移审计(6 个子项目 vs IHUI-AI) | — | 输出 `reports/migration-audit-*.csv` |
| audit-migration-api-routes.mjs | 阶段 2:Java 微服务端点 vs Fastify 路由 content-level 比对 | — | 输出 4 类对照表 CSV |
| audit-migration-db-schema.mjs | 阶段 3:数据库 schema content-level 比对(旧 SQL vs Drizzle) | — | 比对来源:edu/coze_zhs_py/ai-smart-society-java |
| audit-edu-pages-sample-check.mjs | edu 业务编辑子页抽样核对(架构迁移审计阶段 5) | — | 三分类输出 |
| audit-multi-platform-sync.mjs | 多端同步对接审计(8 端 vs 6 个新端点 + 27 张表) | — | AGENTS.md §9 |
| audit-remaining-evaluate.mjs | 架构迁移审计 P3 剩余评估项三分类决策 | — | 设计风格差异 / 真实补开发 / 废弃 |

---

## 三、守门检查(36 个)

pre-commit / commit-msg / pre-push 钩子使用的 `check-*` 守门脚本(含 `openapi-check.mjs`),集成于 `guardian-runner.mjs` 批量执行器。

| 脚本名 | 用途 | pre-commit 项 | 备注 |
| --- | --- | --- | --- |
| check-api-key-leak.mjs | API Key 泄露检查(暂存文件 + .example + memory) | 1 (blocking) | 已知 key 前缀黑名单 |
| check-db-schema-drift.mjs | packages/database schema drift 检测(TS schema vs migration SQL) | 3 (blocking) | 检测缺失/死 migration/DROP 后重建 |
| check-stale-dist.mjs | packages 陈旧 dist 检测(src export vs dist export 集合比对) | 4 (blocking) | tsbuildinfo 为唯一真相源 |
| check-dist-encoding.mjs | packages/* + apps/* dist 文件 UTF-8 BOM 守门 | 4b (blocking) | 防 Turbopack UTF-8 解析报错 |
| check-api-client-utf8.mjs | packages/api-client 源码字节级 UTF-8 完整性 | 4c (blocking) | 检测 3 字节序列第 3 字节 0x3F 损坏 |
| check-sanitizer-bypass.mjs | skipResponseSanitization 一致性(reply.send 含 token 必须旁路) | 6 (blocking) | 白名单:auth/auth-sso/gdpr/developer/agents |
| check-dedupe.mjs | 依赖版本碎片化检查(pnpm-lock.yaml 可去重版本) | 7 (warn) | `pnpm check:dedupe` |
| check-api-routes.mjs | 前端 API 调用 vs 后端路由注册比对(防 404) | 8 (blocking) | — |
| check-safe-parse.mjs | Fastify 路由 safeParse 反模式巡检(silent ignore) | 9 (warn) | 检测 5 行内是否 return 400 |
| openapi-check.mjs | OpenAPI spec 存在性 + 路由数量一致性 | 10 (info) | 始终 exit 0 |
| check-rounded-full.mjs | 容器圆角违规(rounded-full / 9999px / 50%) | 11 (blocking) | AGENTS.md §4 唯一豁免清单 |
| check-delivery-report-consistency.mjs | 交付报告一致性(防"无后续建议 + 列后续建议"矛盾) | 12 (blocking) | AGENTS.md §10 |
| check-project-plan-size.mjs | PROJECT_PLAN.md 体积守门(500KB 软参考) | 13b (warn) | 2026-07-23 解除阻塞 |
| check-project-plan-archive.mjs | PROJECT_PLAN.md 已完成任务条目防误删 | 13c (blocking) | 检测"已归档"占位注释 |
| check-api-migration-completeness.mjs | 防"100% 整合迁移"虚假声明 | 15 (blocking) | 基于代码实测覆盖率 |
| check-input-border-var.mjs | CSS 颜色 token 嵌套守门(禁 hsl(var(--xxx))) | 17 (blocking) | Tailwind v4 @theme 序列化 |
| check-native-title-tooltip.mjs | 浏览器原生 title tooltip 违规(必须用项目 Tooltip 组件) | 18 (blocking) | AGENTS.md §4 |
| check-staged-pollution.mjs | Staged 文件污染预警(跨 ≥4 目录) | 19 (warn) | 多 agent 并行场景 |
| check-tailwind-class-conflict.mjs | Tailwind 同元素 size 类冲突(模板字面量 BASE/BRANCH) | 20 (blocking) | 2026-07-21 M-64 类问题 |
| check-multi-end-sync.mjs | 多端同步守门(单端未标注平台独占) | 21 (warn) | AGENTS.md §9,8 端映射 |
| check-readme-sync.mjs | README 同步守门(功能代码改动但 README 未更新) | 22 (warn) | AGENTS.md §22 |
| check-staged-files.mjs | 打印 staged 文件清单(info-only) | 23 (info) | 始终 exit 0 |
| check-sidebar-width-consistency.mjs | 侧边栏宽度一致性(design-tokens vs sidebar.tsx) | 24a (blocking) | 防首屏宽度跳变闪烁 |
| check-port-registry.mjs | 端口注册表守门(非 88xx) | 24b (warn) | 豁免 CI/Docker/healthcheck |
| check-workspace-hygiene.mjs | 项目外路径违规(代码层守门) | 25 (blocking) | v2,7 大漏洞修复 |
| check-parent-pollution.mjs | 项目父目录污染巡查(运行时守门) | 26 (blocking) | 反向巡查项目父目录 |
| check-z-index-guard.mjs | z-index 层叠防护(禁 !important + inline script + fade-in 回归) | 27 (blocking) | 2026-07-24 立 |
| check-overlay-zindex.mjs | 全屏遮罩 z-index 层级(防 fixed inset-0 + z-50 复发) | 28 (blocking) | 根治 SSO 登录遮罩盖不住 AI 面板 |
| check-push-sync.mjs | Push 同步兜底(commit 前检测未 push 的 commit) | 29 (blocking) | §21 第一道防线 |
| check-style-verification.mjs | 样式改动强制验证(commit message 附 `Verified-DOM:` trailer) | commit-msg | AGENTS.md §17/§19 |
| check-agents.mjs | 检查 agents 表新列(collect_count/publish_status/suggested_questions) | — | 数据库 schema 检查工具 |
| check-ignore-todos.mjs | warn-only TODO 检查 | — | 始终 exit 0 |
| check-lock.mjs | 防 next dev 与 next build 并行 + stale dev server 警告 | — | 锁文件机制 |
| check-messages-dev-restart.mjs | i18n messages 修改后 dev server 重启提醒 | — | Next.js server 静态嵌入 chunk |
| check-nativewind-status.mjs | NativeWind 升级就绪监控(等 5.0 stable) | — | 监控 npm registry |
| check-rn-global-css-sync.mjs | mobile-rn/global.css 颜色变量与 tokens.css 同步 | — | NativeWind 4.x 手动复制变量 |

---

## 四、构建/部署(2 个)

| 脚本名 | 用途 | pre-commit 项 | 备注 |
| --- | --- | --- | --- |
| archive-completed-tasks.mjs | PROJECT_PLAN.md 已完成任务条目自动归档(≥7 天) | post-commit | 防递归:IHUI_ARCHIVE_COMMIT=1 |
| pre-deploy.mjs | R65 生产部署 pre-deploy 自检(typecheck/lint/test/i18n parity/migration/页面/端点/env) | — | 8 项硬性门禁 |

---

## 五、工具脚本(23 个)

Git 协作守门、CLI 验证、运维工具、证书管理、API 工具、基础设施工具等。

### Git 协作守门(3 个)

| 脚本名 | 用途 | pre-commit 项 | 备注 |
| --- | --- | --- | --- |
| safe-commit.mjs | 多 agent 并行 commit 边界守门(5 步零信任:reset→add→校验→commit→verify) | — | AGENTS.md §12 |
| git-push-guard.mjs | 杜绝"commit 后忘记 push"(检测+推送+验证三合一) | post-commit | AGENTS.md §21 主防线 |
| guard-push-other-agent-changes.mjs | 跨 Agent 改动保护(whitelist/baseline/danger 三模式) | — | AGENTS.md §16/§12 |

### CLI 验证(3 个)

| 脚本名 | 用途 | pre-commit 项 | 备注 |
| --- | --- | --- | --- |
| verify-cli-settings-init.mjs | settings.json 模板生成端到端验证(settings init --force) | — | IHUI_HOME 重定向到临时目录 |
| verify-cli-acp-launch.mjs | ACP (Agent Client Protocol) server 启动验证(initialize + session/new) | — | 模拟最小 ACP 客户端 |
| verify-cli-stepfun-llm.mjs | 真实 LLM 联调验证(stepfun/agnes plan 套餐 key 连通) | — | 真实 key 从 .env 读取,验证后清理 |

### API 工具(2 个)

| 脚本名 | 用途 | pre-commit 项 | 备注 |
| --- | --- | --- | --- |
| find-route-conflicts.mjs | 扫描后端路由文件,输出按 method+path 分组的真实重复路由 | — | 按 pluginName 划分插件块 |
| generate-stub-routes.mjs | 根据 api-routes-missing.json 批量生成前端缺失路由桩 | — | 输出 apps/api/src/routes/frontend-stub-*.ts |

### 基础设施(4 个)

| 脚本名 | 用途 | pre-commit 项 | 备注 |
| --- | --- | --- | --- |
| guardian-runner.mjs | 守门脚本批量执行器(单进程顺序执行所有 check-*) | pre-commit 主入口 | blocking/warn/info 三模式 |
| guardian-utils.mjs | 守门脚本共享工具模块(git staged/参数解析/颜色/退出码/glob) | — | 纯 Node 内置模块 |
| typecheck-full.mjs | 全量 TypeScript 类型检查(清除 .tsbuildinfo 增量缓存) | — | `pnpm typecheck:full` |
| verify-ui.mjs | UI 视觉回归守门(Playwright) | — | 支持 `--spec` `--check-server` |

### 运维/部署工具(7 个)

| 脚本名 | 用途 | pre-commit 项 | 备注 |
| --- | --- | --- | --- |
| dev-web.mjs | 启动 @ihui/web dev server + 进程树生命周期管理(防僵尸 next-server) | — | 支持 `--clean` `--port` |
| miniapp-preview.mjs | 启动 miniapp H5 开发服务器并输出预览 URL | — | `pnpm --filter @ihui/miniapp dev:h5` |
| setup-mirror-repos.mjs | 国内镜像仓库一键初始化(Gitee + GitCode) | — | 用 PAT,仓库已存在视为成功 |
| setup-admin-account.mjs | 用 bcryptjs 生成 admin123 密码 hash,更新 users 表 admin 用户 | — | 临时脚本 |
| grant-ihui-superuser.mjs | 给 ihui 数据库用户授予 SUPERUSER | — | 幂等 |
| test-llm-connection.mjs | 验证 AI service LLM 接入是否可用(/health + 模型调用) | — | 默认 AI_URL=http://localhost:8803 |
| video-ops.mjs | 视频下载(yt-dlp)与 OSS 上传工具 | — | 等价自历史项目 PowerShell 脚本 |

### 证书管理(3 个)

| 脚本名 | 用途 | pre-commit 项 | 备注 |
| --- | --- | --- | --- |
| fetch-wechat-platform-cert.mjs | 微信支付 V3 平台证书拉取(写入 cert/platform_cert.pem) | — | 用于验签回调 |
| cert-renew-watchdog.mjs | 平台证书续签 Watchdog(周期拉取,有变化才写入) | — | 建议 cron:每月 1 次 |
| cert-expiry-check.mjs | 证书过期检查(提前 30 天告警 + 私钥格式 + 证书私钥匹配) | — | 已过期 exit 1 |

### 其他工具(1 个)

| 脚本名 | 用途 | pre-commit 项 | 备注 |
| --- | --- | --- | --- |
| refresh-cli-token.mjs | 刷新 CLI apiKey(JWT accessToken) | — | Windows 任务计划每周一 03:00 |

---

## 附录:分类统计

| 类别 | 数量 |
| --- | --- |
| i18n 守门与处理 | 25 |
| 迁移审计 | 7 |
| 守门检查(check-* + openapi-check) | 36 |
| 构建/部署 | 2 |
| 工具脚本 | 23 |
| **合计** | **93** |

## 附录:pre-commit 项速查

详见 `AGENTS.md` "守门脚本速查(pre-commit 第 1-27 项)" 表格,本 README 的 pre-commit 项编号与之一一对应。`blocking` 失败阻塞 commit,`warn` 仅提醒,`info` 仅打印。post-commit 钩子调用 `git-push-guard.mjs` + `archive-completed-tasks.mjs`(自动归档)。
