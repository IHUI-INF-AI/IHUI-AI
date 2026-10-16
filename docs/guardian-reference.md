# 守门体系参考文档（自动生成）

> 本文档由 `scripts/generate-guardian-docs.mjs` 从 `scripts/guardian-runner.mjs` 动态提取生成。
> 修改 guardian-runner.mjs 后请运行 `pnpm guardian:docs` 重新生成。
> **禁止手工编辑**——下次生成会覆盖。
>
> 最后生成：2026-10-15（共 252 项：blocking 225 / warn 26 / info 1）

## 目录

- [1. 守门项完整清单](#1-守门项完整清单)
- [2. P2-G: warn→blocking 升级时间表](#2-p2-g-warnblocking-升级时间表)
- [3. P2-H: id 命名空间重构建议](#3-p2-h-id-命名空间重构建议)
- [4. P3-C: 文档自动化机制说明](#4-p3-c-文档自动化机制说明)

---

## 1. 守门项完整清单

按 mode 分组，每组按 guardian-runner.mjs 中的出现顺序排列。

### 1.1 blocking 项（225 项）

| ID | Label | Script | Args | onFailHint |
|----|-------|--------|------|------------|
| 1 | 🔐 API key 泄露 | check-api-key-leak.mjs | — | — |
| 2 | 🌐 i18n 键完整性 | check-i18n-keys.mjs | — | — |
| 2b | 🔍 zh-TW 简体字残留 | scan-i18n-zh-residue.mjs | zh-TW | — |
| 2c | 🔍 ko.json 中文残留 | scan-i18n-zh-residue.mjs | ko | — |
| 2e | 🔍 en.json 破碎英文 | check-i18n-broken-en.mjs | — | — |
| 2e-dupns | 🧬 i18n 重复命名空间/重复键(blocking,防 JSON last-wins 静默遮蔽) | check-i18n-duplicate-namespaces.mjs | — | 有 |
| 2f-web | 🌐 i18n AI 翻译流水线(blocking) | i18n-diff.mjs | — | 有 |
| 2f-miniapp-taro | 🌐 [miniapp-taro] i18n AI 翻译流水线(blocking) | i18n-diff.mjs | --target=miniapp-taro | 有 |
| 2g-web | 🔍 i18n 命名空间传递(web→共享组件) | check-i18n-namespace-passing.mjs | — | — |
| 4 | 📦 packages 陈旧 dist | check-stale-dist.mjs | — | — |
| 4b | 🔤 dist UTF-8 BOM | check-dist-encoding.mjs | — | — |
| 4c | 🔤 api-client UTF-8 完整性 | check-api-client-utf8.mjs | — | — |
| 6 | 🛡️ skipResponseSanitization | check-sanitizer-bypass.mjs | — | — |
| 7 | 📦 依赖碎片化 | check-dedupe.mjs | — | — |
| 8 | 🔗 前端↔后端路由一致性 | check-api-routes.mjs | — | — |
| 11 | ⭕ 容器圆角违规 | check-rounded-full.mjs | — | — |
| 11b | 📐 圆角溢出(父 rounded + 子 bg 贴边) | check-rounded-overflow.mjs | — | — |
| 11c | 🏷️  选中态描边定稿防回退(禁纯黑/纯白,全站) | check-tagsview-visual.mjs | — | — |
| 11d | 🚫 分割线违规(divide-y / divide-x) | check-no-divider.mjs | — | — |
| 11h | 🚫 UI 图标位 emoji 违规(icon 字段/渲染位) | check-no-emoji-icons.mjs | — | — |
| 11e | 📏 单文件行数上限 (仅拦新增) | check-file-size.mjs | — | — |
| 11f | 🚫 原生 alert/confirm/prompt 弹窗 | check-no-native-dialog.mjs | — | — |
| 11g | 🚫 mask-image 渐变遮罩 | check-no-mask-image.mjs | — | — |
| 12 | 📋 交付报告一致性 | check-delivery-report-consistency.mjs | — | — |
| 13c | 🗂️  PROJECT_PLAN.md 已完成任务防误删 | check-project-plan-archive.mjs | — | — |
| 15 | 📊 迁移完整性(7 大类 29 子项) | check-api-migration-completeness.mjs | — | — |
| 17 | 🎨 CSS 颜色 token 嵌套 | check-input-border-var.mjs | — | — |
| 18 | 🖱️  原生 title tooltip 违规 | check-native-title-tooltip.mjs | — | — |
| 20 | 🎯 Tailwind class 冲突 | check-tailwind-class-conflict.mjs | — | — |
| 24a | 📏 侧边栏宽度一致性 | check-sidebar-width-consistency.mjs | — | — |
| 25 | 🧹 项目外路径违规(blocking) | check-workspace-hygiene.mjs | — | — |
| 26 | 🛡️  项目父目录污染巡查(blocking) | check-parent-pollution.mjs | — | — |
| 27 | 🛡️  z-index 层叠防护(防第三方 IDE 注入 + 遮罩 fade-in 回归 + 窗口按钮等效压暗) | check-z-index-guard.mjs | — | 有 |
| 28 | 🛡️  全屏遮罩 z-index 层级(防 fixed inset-0 + z-50 复发) | check-overlay-zindex.mjs | — | 有 |
| 29 | 🚀 Push 同步兜底(防"commit 后忘记 push"复发,AGENTS.md §21 第三道防线) | check-push-sync.mjs | — | 有 |
| 30 | 🛡️ i18n 文件完整性(防 prettier 截断事故复发) | validate-i18n-integrity.mjs | — | 有 |
| 30a | 🛡️  Commit 丢失防护(blocking,AGENTS.md §22,防 reset / drop stash 误丢 commit) | check-commit-loss-guard.mjs | --blocking --filter-stash | 有 |
| 30c | 🛡️  陈旧副本守门(blocking,2026-09-14 338 快照事故配套,防 staged 区夹带历史版本回退) | check-stale-copy.mjs | — | — |
| 30b | 🛡️  Stash 滞留源码改动守门(blocking,AGENTS.md §12d,防已完成工作滞留 stash 静默失联) | check-stale-stashes.mjs | --blocking | 有 |
| 16c | 🛡️  staged-typecheck 源/测镜像同步(blocking,AGENTS.md §22b 镜像同步义务) | check-staged-typecheck-mirror-sync.mjs | — | — |
| 35 | 🐍 mypy 类型检查(防 ai-service Python 类型回退) | check-mypy.mjs | — | 有 |
| 36 | 🎨 [miniapp-taro] design-tokens 同步(防 app.css 漂移) | check-miniapp-tokens-sync.mjs | — | 有 |
| 37 | 🎨 [web] design-tokens 同步(防 globals.css 漂移) | check-web-tokens-sync.mjs | — | 有 |
| 38 | 🛡️  solito 幽灵依赖回归守门(blocking,防 P0 优化被回退) | check-solito-residue.mjs | — | 有 |
| 39 | 📱 mobile-rn screen 迁移完整性(blocking,防独立实现回升) | check-rn-app-migration.mjs | — | 有 |
| 40 | 🔗 共享层重复检测(blocking,防端内重新实现 shared hook/util) | check-shared-layer-duplication.mjs | — | 有 |
| 41 | 🌿 单分支开发守门(blocking,AGENTS.md §9b) | check-single-branch.mjs | — | 有 |
| 2d | 🔍 ja.json 中文简体残留(blocking,常用汉字表精确判据) | scan-i18n-zh-residue.mjs | ja | — |
| 2o-shared | 🔍 [shared] ja.json 中文简体残留(blocking,常用汉字表精确判据) | scan-i18n-zh-residue.mjs | ja --target=shared | — |
| 2o-miniapp-taro | 🔍 [miniapp-taro] ja.json 中文简体残留(blocking,常用汉字表精确判据) | scan-i18n-zh-residue.mjs | ja --target=miniapp-taro | — |
| 2o-mobile-rn | 🔍 [mobile-rn] ja.json 中文简体残留(blocking,常用汉字表精确判据) | scan-i18n-zh-residue.mjs | ja --target=mobile-rn | — |
| 2f-ext | 🌐 [extension] i18n 键完整性(blocking,2026-09-28 由 warn 升档) | check-i18n-keys.mjs | --target=extension | — |
| 2f-shared | 🌐 [shared] i18n 键完整性(blocking,零变更验证通过) | check-i18n-keys.mjs | --target=shared | — |
| 2g-ext | 🔍 [extension] zh-TW 简体字残留(blocking,2026-09-28 由 warn 升档) | scan-i18n-zh-residue.mjs | zh-TW --target=extension | — |
| 2h-ext | 🔍 [extension] ko.json 中文残留(blocking,2026-09-28 由 warn 升档) | scan-i18n-zh-residue.mjs | ko --target=extension | — |
| 2i-ext | 🔍 [extension] en.json 破碎英文(blocking,2026-09-28 由 warn 升档) | check-i18n-broken-en.mjs | --target=extension | — |
| 2j-shared | 🔍 [shared] zh-TW 简体字残留(blocking) | scan-i18n-zh-residue.mjs | zh-TW --target=shared | — |
| 2p-api | 🔍 [api] zh-TW 简体字残留(blocking,2026-10-05 补分面射程) | scan-i18n-zh-residue.mjs | zh-TW --target=api | — |
| 2q-cli | 🔍 [cli] zh-TW 简体字残留(blocking,2026-10-05 补分面射程) | scan-i18n-zh-residue.mjs | zh-TW --target=cli | — |
| 2r-miniapp-taro | 🔍 [miniapp-taro] zh-TW 简体字残留(blocking,2026-10-05 补分面射程) | scan-i18n-zh-residue.mjs | zh-TW --target=miniapp-taro | — |
| 2s-mobile-rn | 🔍 [mobile-rn] zh-TW 简体字残留(blocking,2026-10-05 补分面射程) | scan-i18n-zh-residue.mjs | zh-TW --target=mobile-rn | — |
| 2t-api | 🔍 [api] ko.json 中文残留(blocking,2026-10-05 补分面射程) | scan-i18n-zh-residue.mjs | ko --target=api | — |
| 2u-cli | 🔍 [cli] ko.json 中文残留(blocking,2026-10-05 补分面射程) | scan-i18n-zh-residue.mjs | ko --target=cli | — |
| 2v-miniapp-taro | 🔍 [miniapp-taro] ko.json 中文残留(blocking,2026-10-05 补分面射程) | scan-i18n-zh-residue.mjs | ko --target=miniapp-taro | — |
| 2w-mobile-rn | 🔍 [mobile-rn] ko.json 中文残留(blocking,2026-10-05 补分面射程) | scan-i18n-zh-residue.mjs | ko --target=mobile-rn | — |
| 2k-shared | 🔍 [shared] ko.json 中文残留(blocking) | scan-i18n-zh-residue.mjs | ko --target=shared | — |
| 2m-shared | 🔍 [shared] en.json 破碎英文(blocking) | check-i18n-broken-en.mjs | --target=shared | — |
| 2f-shared-diff | 🌐 [shared] i18n AI 翻译流水线(blocking) | i18n-diff.mjs | --target=shared | 有 |
| 2n-web | 🌐 [web] 5 语言 i18n parity 强制校验 (blocking,2026-08-02 升级,兜底 item 2 漏检场景) | check-i18n-keys.mjs | --parity-only | — |
| 2f-mobile-rn | 🌐 mobile-rn i18n parity 守门(blocking,2026-09-28 由 warn 升档;立票 2026-07-28) | check-i18n-keys.mjs | --target=mobile-rn --parity-only | 有 |
| 9 | 🔍 safeParse 静默忽略(blocking,2026-07-26 升级) | check-safe-parse.mjs | — | 有 |
| 34 | 🔍 @ts-ignore 新增检测(blocking:存量已清零,只拦 staged 新增) | check-ts-ignore.mjs | — | 有 |
| 33 | 🛡️  LLM provider schema 守门 (blocking,阶段 3 主体已落地) | check-llm-provider-schema.mjs | — | 有 |
| 42 | 🛡️  React SyntheticEvent 闭包陷阱(防 popover 常驻显示复发) | check-event-closure-leak.mjs | — | 有 |
| 44 | 🧹 根目录整洁守门(一级目录白名单) | check-root-dir-clean.mjs | — | 有 |
| 46 | 🔙 统一返回键防私接守门(禁页面私写 router.back/history.back) | check-inline-back-button.mjs | — | 有 |
| 47 | 💧 溯源水印覆盖守门(自愈式: 缺失/损坏自动补齐并回暂存区) | check-watermark-coverage.mjs | — | 有 |
| 48 | 🧩 GitHub Actions 步骤顺序守门(setup-node cache:pnpm 必须在 pnpm/action-setup 之后) | check-workflow-step-order.mjs | — | 有 |
| 49 | 🧾 迁移记账守门(journal ↔ .sql 一一对应 / when 单调唯一 / B10 登记表空闲性 warn) | check-migration-bookkeeping.mjs | — | 有 |
| 50 | 🛡️ next-env.d.ts 构建污染守门(禁 .next-* 变体引用) | check-next-env-dist.mjs | — | 有 |
| 51 | 🧭 能力目录登记守门(产物一致性 / v1 端点必须接能力闸 / scope 语义) | check-capability-catalog.mjs | — | 有 |
| 52 | 🪟 派生弹窗守门(blocking,AGENTS.md §5b windowsHide 默认值配套) | check-no-visible-spawn.mjs | — | 有 |
| 53 | 🛡️  admin 面特权判定一致性(blocking,O13b roleId>=1 收敛) | check-admin-gate-consistency.mjs | — | 有 |
| 55 | 🈶 工具名显示覆盖率守门(blocking,D54/H16 界面禁直显英文工具码名) | check-tool-name-display-coverage.mjs | — | 有 |
| 59 | 🈳 ICU 语法跨端可用性守门(blocking,D101:非 web 端取词引擎只支持四形子集) | check-icu-locale-support.mjs | — | 有 |
| 57 | 🧩 对话流元素覆盖守门(blocking,D51/H13:①锚点漂移 ②契约事件两端不齐 ③清单条目倒退 ④锚点存续性倒退 ⑤注释式摘线) | check-chat-element-coverage.mjs | — | 有 |
| 58 | 🈹 中文术语机翻残留守门(blocking,D104/H29:竞品自家 zh 包实测 list→挂牌/房源,我方 zh 侧此前无闸) | check-zh-term-quality.mjs | — | 有 |
| 60 | 🕐 工具活动行双时态覆盖守门(blocking,D81①/D83/H28:键形合规 + 覆盖率 ratchet) | check-tool-activity-coverage.mjs | — | 有 |
| 56 | 🔤 工具功能名各端可解析守门(blocking,防取词回显与离线包过期) | check-tool-display-resolvable.mjs | — | 有 |
| 61 | 🖥️  桌面安装器资产三方对账(blocking,引用↔打包↔5 档落盘) | check-installer-assets.mjs | — | 有 |
| 62 | 🧩 桌面 NSIS 安装器模板漂移(blocking,installer.nsi == 上游模板 + 已登记补丁) | desktop-nsis-template.mjs | --check | 有 |
| 63 | 🔀 SSE 双解析器漏接对账(blocking,帧覆盖 ratchet + 未接帧须交代归属) | check-sse-parser-parity.mjs | — | 有 |
| 68 | 🔐 权限模式词汇对账(blocking,跨语言注册表一致 + 消费点禁漂移) | check-permission-mode-vocabulary.mjs | — | 有 |
| 64 | 🧩 [miniapp-taro] 适配层未接线即拦(防"造好没装车"死代码回升) | check-adapter-wiring.mjs | — | 有 |
| 66 | 🎨 [miniapp-taro] 适配层硬编码颜色基线(防新增 hex/rgb 绕过 token) | check-adapter-style-parity.mjs | — | 有 |
| 67 | 🔐 凭据经非2xx message 外泄对账(blocking,拦上游令牌/密钥响应体被拼进错误消息) | check-credential-leak-in-message.mjs | — | 有 |
| 69 | ⌨️ 快捷键声明与归属对账(blocking,声明未绑 / 同键被他功能接走) | check-declared-shortcuts.mjs | — | 有 |
| 70 | 🈲 硬编码中文基线棘轮(blocking,新增界面文案必须走 t()/语言包) | scan-hardcoded-zh.mjs | --exit 1 | 有 |
| 71 | 🈲 计划登记行防丢(blocking,PROJECT_PLAN.md 已入库的 G-/D/P/W 编号行不得整行消失) | check-plan-line-loss.mjs | --staged | 有 |
| 72 | 🐳 Dockerfile 构建上下文对账(blocking,钩子脚本必须 COPY 进镜像 + COPY 源必须在提交里) | check-dockerfile-copy-paths.mjs | — | 有 |
| 73 | 🈲 端内绕过 @ihui/api-client 直连后端(blocking,裸 fetch/Taro.request 指向本仓后端即拦,存量走基线只减不增) | check-direct-backend-calls.mjs | — | 有 |
| 74 | 🈴 词表键五语言可解析(blocking,静态映射缺语言/小程序离线包过期即红;W5 落点债只告警) | check-word-table-resolvable.mjs | — | 有 |
| 75 | 🗄️  配置表名存在性(blocking,O20d:COMPUTE_ALLOWED_TABLES 必须与 drizzle schema 对齐) | check-config-table-existence.mjs | — | 有 |
| 77 | 📐  圆角单一源头对账(blocking,全 8 端:档位表一致 + 端内取用必须引用档位) | check-radius-single-source.mjs | — | 有 |
| 93 | 🎨 跨端色值同源对账(blocking,RN rn-tokens ↔ tokens.css 逐位同值 + 品牌档不得端内自立) | check-cross-end-tokens.mjs | — | 有 |
| 91 | 🌗 主题接线对账(blocking,theme-driven 共享组件必须拿到调用方解析出的主题) | check-theme-prop-wiring.mjs | — | 有 |
| 10 | 📋 OpenAPI 契约一致性(blocking,O8b 清零后由 info 升级) | openapi-check.mjs | — | — |
| 65 | 🧹 整树删除拦截(blocking,索引 vs HEAD 文件存续性) | check-mass-deletion.mjs | — | 有 |
| 83 | 📱 [mobile-rn] 深色模式前景/容器守门(品牌底白字 blocking + 浅色容器 ratchet) | check-brand-foreground.mjs | — | 有 |
| 84 | 🧬 反回退守门(blocking,暂存内容等于历史版本 = 静默回滚他人改动) | check-stale-revert.mjs | — | 有 |
| 78 | 🔗 workspace 依赖"声明即已链接 / 链接即有内容 / 命令即可跑"五维对账(blocking,拦本地全绿·部署环恒红·全机门禁停摆) | check-workspace-dep-links.mjs | — | 有 |
| 80 | ⏱  热路径 git 只读调用必须带 timeout(blocking,拦无界挂起拖死守门链) | check-git-read-timeout.mjs | — | 有 |
| 79 | 🔀 提交内容含 Git 冲突标记(blocking,成对 <<<<====>>>> 标记一旦入树即拦) | check-no-conflict-markers.mjs | — | 有 |
| 81 | 📧 品牌邮件通道对账(blocking,拦绕过 email-templates 的纯文本自发通道) | check-brand-email-channel.mjs | — | 有 |
| 85 | 🧪 测试目录被 .gitignore 静默吞掉对账(blocking,AGENTS §23 配套,补装) | check-test-paths.mjs | — | 有 |
| 87 | 🈳 语言包文件存在性与合法性对账(blocking,40 项清单,补装) | check-i18n-messages-exist.mjs | — | 有 |
| 88 | 🧩 ui-react 组件复用对账(blocking,端内自实现 Dialog/Card/Form 提示,补装) | check-ui-react-usage.mjs | — | 有 |
| 89 | 🔌 守门接线层对账(blocking,R1/R2 撒谎 · R4 文档隐形 · R5 撞号 · R7 假依据) | check-gate-wiring.mjs | — | 有 |
| 90 | 📡 SSE 帧端内 dispatch 注册层对账(blocking,补守门 63 覆盖不到的第 3 层) | check-sse-dispatch-parity.mjs | — | 有 |
| [0-9]+" | sort -u -V | tail -1`。
    id:  | 🧭 errorCode 覆盖率对账(blocking,零"未知错误"兜底,补装) | check-error-code-coverage.mjs | — | 有 |
| 95 | 🔏 水印载荷/横幅行语法对账(blocking,零宽必须被注释包裹) | check-watermark-syntax.mjs | — | 有 |
| 97 | 📱 顶部状态栏避让单一源头对账(blocking,顶距只有一个注入点) | check-statusbar-single-source.mjs | — | 有 |
| 98 | 🧩 HEAD 悬空具名导入对账(blocking,import 的名字目标必须真导出) | check-dangling-local-imports.mjs | — | 有 |
| 99 | 🗑️ 暂存删除存续性对账(blocking,被删文件必须无人引用且无替代路径) | check-staged-deletions.mjs | — | 有 |
| 100 | 🧬 合并新增文件存续性对账(blocking,合并不得吞掉任一父提交的独有新增) | check-merge-addition-loss.mjs | — | 有 |
| 101 | 🔐 清单↔锁 specifier 对账(blocking,拦"本地全绿、生产构建必炸"的依赖真值) | check-lock-manifest-consistency.mjs | — | 有 |
| 102 | 🧷 文本箭头当图标 / 箭头字号倒挂对账(blocking,入口箭头必须是矢量且不小于标签) | check-glyph-arrow-icon.mjs | — | 有 |
| 103 | 🏛️ 架构契约对账(blocking,从 config/architecture-policy.yaml 的声明反查违规) | check-architecture-policy.mjs | — | 有 |
| 104 | 🧬 prod-bundle 影子副本对账(blocking,入库源 ↔ 生产实际执行的那份逐字节等值) | check-prod-bundle-shadow.mjs | — | 有 |
| 105 | 🧩 小程序+四端派生产物对账(blocking;离线语言包/图标/位图/四端 AI 可导航路由是否落后于源;孤儿与动态路径只报数不判红) | check-miniapp-generated.mjs | — | 有 |
| 106 | 🧩 extension 注入层色值同源(blocking,可派生档逐位等值 + 分歧必须登记且不得腐烂) | sync-extension-tokens.mjs | --check --staged | 有 |
| 107 | 🧾 第三方来源台账对账(blocking,嵌入/复制/覆盖三本账 + 机制来源账:roots 必须真实存在、盘上 vendored 件必须有条目、许可原文必须能自证) | provenance-ledger.mjs | — | 有 |
| 108 | ⏳ 豁免到期账(blocking,12 类行内豁免必须带到期日;到期未销账即红,存量进基线只报数) | check-exemption-expiry.mjs | — | 有 |
| 109 | 🔒 任务认领租约对账(blocking,（进行中）必须带日期与持有者;过期未清账即红,存量裸标记只报数) | check-task-claims.mjs | --check-gate | 有 |
| 111 | 🧬 工具契约声明对账(blocking,注册进工具面却没有契约声明即红;棘轮锚点=该文件 HEAD 自身违规数) | check-tool-contract-declared.mjs | — | 有 |
| 112 | 📐 压缩分母对账(blocking,阈值分母必须经 effectiveContextWindow;存量 8 文件/12 处进棘轮) | check-compaction-denominator.mjs | — | 有 |
| 113 | 🪪 路由身份键对账(blocking,路由身份不得进模型可见 schema;键清单唯一源在 @ihui/types) | check-tool-arg-routing-identity.mjs | — | 有 |
| 115 | 🧪 入参校验装车对账(blocking,校验器必须有生产调用方 + 影子档在位且默认不是 enforce) | check-tool-arg-validation-wired.mjs | — | 有 |
| 116 | 🌐 出站事实对账(blocking,厂商出站必须走带回 egress 的包装出口;绕档进棘轮基线) | check-egress-facts.mjs | — | 有 |
| 117 | 🔐 记忆端点属主绑定对账(blocking,收 user_id 的端点必须与令牌主体对齐;存量已归零⇒零容忍) | check-memory-owner-binding.mjs | --strict | 有 |
| 118 | 🧬 门脚本取材面纪律对账(blocking,本次改动动过的门必须经统一取材层;全量档只报数) | check-gate-face-discipline.mjs | — | — |
| 119 | 🛰️ 子代理权限继承对账(blocking,派生点必须下传 permissionMode/permissions) | check-subagent-permission-inherited.mjs | — | — |
| 120 | ✅ 名单类判据正向证明对账(blocking,登记名单必须被自己的成员命中过) | check-list-predicate-has-positive-proof.mjs | — | — |
| 121 | 🗑️ 声明策略必须有消费者(blocking,MAX_AGE/TTL/RETENTION/Contract 谓词/清理函数未接线即红,存量棘轮) | check-declared-policy-has-consumer.mjs | — | — |
| 122 | 💾 文件写盘安全对账(blocking,工具写文件必须走原子写出口;裸写盘棘轮) | check-file-write-safety.mjs | — | — |
| 123 | ⏱️ 工具执行预算对账(blocking,工具级超时/取消机制在位且被调用;缺常量/缺通道即红) | check-tool-exec-budget.mjs | — | — |
| 124 | 🎨 小程序原生 chrome 派生对账(blocking,theme.json + THEME_CHROME 必须是 tokens.css 的派生态) | check-miniapp-chrome.mjs | — | — |
| 125 | 🧭 派生面登记表自洽对账(blocking,TOKEN_SYNC_TARGETS 每行的触发文件/写回出口/复核门三方必须在位) | check-token-sync-registry.mjs | — | — |
| 126 | 🧪 shared 包非 Node 宿主纯度对账(blocking,入口闭包可达面内不得有 node: 内建导入) | check-shared-nonde-node-purity.mjs | — | — |
| 127 | 🛰️ 跨语言出站路由声明对账(blocking,默认档只报数;--strict 才判红,防恒红门) | check-declared-outbound-routes.mjs | — | — |
| 128 | 🪞 跨端 UI 差异账对账(blocking,同名配对组件的小程序/RN 可见几何档只减不增 —— 重复实现就是"改一端另一端不跟随"的根因) | check-cross-end-ui-parity.mjs | — | — |
| 129 | 🛡️ 提示注入登记对账(blocking,"以宿主名义进模型提示"的每段必须有登记的 producer 与记账出口;拦 登记没生产 / 生产没消费 / 裸 [系统提醒] 前缀 三型) | check-prompt-injection-registry.mjs | — | — |
| 130 | 🗂  任务状态分叉对账(blocking,差值棘轮:一次提交不得让"同一件事既已完成又挂着未勾"变多,不得带入没有交代的登记行,也不得新增撞号组(F9,存量只报数) —— 既有防护全在防丢,没有一道防错) | plan-tasks.mjs | --gate | — |
| 131 | 🧬 RN 函数形态 style 被 cssInterop 吃掉(blocking,按文件 HEAD 自身存量棘轮:存量只报数、新增即拦) | check-rn-interop-fn-style.mjs | — | — |
| 132 | 🔧 工具族注册对账(blocking,存量已归零:tools/** 里导出的一族工具必须能在生产面找到把它挂进注册表的调用点 —— "造好没装车"那一型) | check-tool-family-registered.mjs | — | 有 |
| 133 | 🈶 语言包语种内容对账(blocking,L1 跨族/块级只报数 + L2 同名自套一层按 HEAD 锚点棘轮 —— parity 绿不等于语种对) | check-i18n-locale-content-language.mjs | — | 有 |
| 134 | 🧮 批量写计数诚实性对账(blocking,拦「affected/deleted 由请求侧 .length 自算」这一型静默失真 —— 改了 0 行与改成功同形) | check-batch-write-count-honesty.mjs | — | 有 |
| 135 | 🧾 ApiResult 失败分支身份对账(blocking,拦「throw new Error(res.error) 丢掉 status/errorCode」—— 401 因此冒充「提交的信息有误」,把用户引导去改表单) | check-api-failure-throw.mjs | — | 有 |
| 136 | 🧵 后台任务类型三面 parity(blocking,拦「广告了任务类型却没实现 / 实现了却没接线 / 欠账清单腐烂」—— 声明面↔实现面↔接线面必须同时成立) | check-background-task-type-parity.mjs | — | 有 |
| 137 | 名字承诺/实现兑现对账(拦「函数或字段叫 hash/digest/指纹/脱敏,实现却是明文拼接且流向持久化或出网」这一型 —— 本仓 4 处真缺陷同族立门) | check-digest-name-reality.mjs | — | 有 |
| 138 | @ 多维提及引擎接线与单一源对账(V3 #61:三件不得回到无人调用 / 维度表与触发符解析不得出现第二份) | check-mention-engine-wired.mjs | — | 有 |
| 139 | 模式×权限档×审批三轴矩阵对账(V3 #53:ChatMode 硬收窄的表与判定两侧逐格等值,出口唯一、有生产调用点) | check-mode-permission-matrix.mjs | — | 有 |
| 140 | V3 #62/#63 对话流挂载与契约登记对账(拦「件在库而无人挂载」与「契约登记与消费点漂移」) | check-v3-62-conversation-mount.mjs | — | 有 |
| 141 | doom-loop parity 对账(共享层/CLI/agent.ts/Python 等价/主链路五面成套,策略数字不得有第二份) | check-doom-loop-parity.mjs | — | 有 |
| 142 | Guardian 复核接线对账(拦「复核出口造好没人调」与「未复核被折叠成通过」) | check-guardian-review-wired.mjs | — | 有 |
| 143 | LSP 语言表与探测四态对账(拦 binary 名回到写死字面量、能力声明无对应族、探测失败被折叠成无诊断) | check-lsp-language-table.mjs | — | 有 |
| 144 | 🩸 崩溃上报出口脱敏对账(blocking,拦「崩溃上报把未脱敏的 message/stack 送进 crash_reports(90 天)与管理面板」—— 发射点与落库点都必须调用共享层唯一出口 redactCrashText) | check-crash-report-redaction.mjs | — | 有 |
| 145 | RN 包装器双层页头对账(共享屏自带页头 × RN 屏又加 NavBar ⇒ 同屏两条返回键与两个标题) | check-rn-double-header.mjs | — | 有 |
| 146 | README 表格完整性对账(TI1 竖排续行判红/T-B 只报数/棘轮锚基线) | check-readme-table-integrity.mjs | — | 有 |
| 147 | 模型容量/推理档位跨语言对账 | check-model-capacity-parity.mjs | --strict | 有 |
| 148 | 会话失效统一出口注册对账:凡消费 @ihui/api-client fetchApi 的端必须注册 setUnauthorizedHandler 或持带 reason+未过期 reviewBy 的台账豁免(AP1);台账端已注册/指向不存在端/重复登记判红(AP2 反腐烂);注册口 export 或 notifyUnauthorized 调用点被摘线判失明不记绿(AP3);枚举 0 个消费端 exit 2 不记绿 | check-auth-handler-registration-parity.mjs | — | 有 |
| 149 | 包入口 barrel 漏 re-export 对账:端内从裸包名 import 的名字必须由包入口真的递出 | check-package-barrel-export.mjs | — | 有 |
| 151 | 子智能体/后台任务状态词汇跨语言与端内抄本对账(六档是落库/REST/SSE 三重对外契约) | check-agent-status-vocabulary-parity.mjs | — | 有 |
| 152 | 🔐 ai-service 身份消费对账(blocking,拦「端点取到已验证身份却一次都没用它」—— 认证不等于授权;判据单一真相在 apps/ai-service/scripts/audit_principal_consumed.py,本门只物化被审面并派生那把尺子) | check-principal-consumed.mjs | — | 有 |
| 157 | 🔐 按凭据存在性豁免对账(blocking,G-459:头名在场即跳过安全判定必须逐条裁过) | check-credential-presence-bypass.mjs | — | 有 |
| 158 | 🛡️ 凭据在场即豁免对账(blocking,拦「安全钩子里只要带了某个头就直接跳过校验」—— 票#23 CSRF 现场收口后无人看守的那一型) | check-gate-presence-exemption.mjs | — | 有 |
| 209 | 🔐 CSRF 豁免形状对账(blocking,存在性唯一条件放行/验真出口摘线/timingSafeEqual 单源三判据) | check-csrf-exemption-shape.mjs | — | 有 |
| 159 | 图源池与境外图片 URL 对账:渲染与 seed 路径不得再出现境外图片域名的完整 URL,且 database 侧镜像必须与 shared 逐字等值 | check-image-source-domains.mjs | — | 有 |
| 160 | 斜杠命令「注册表 ↔ 分派 switch」到达性对账 + 注册名去重:注册名(含别名)必须各有活 case/if 分支(W1)、注册名多重集零重复(W2)、分派顶层必须有 default 兜底(W4),三维零容忍;分派有而注册表无(W3 名字漂移)默认只报数、--strict 才判红(HEAD 面现读 2 条存量,当场判红就是恒红门);注册表/分派解析不到 ⇒ exit 2 未判定,枚举到 0 个判死不记绿 | check-slash-command-wired.mjs | — | 有 |
| 161 | 入站契约 .strict() 到达性对账 | check-inbound-schema-strict.mjs | — | 有 |
| 163 | 维护性写归属/CAS/回报计数三态对账(G-815920) | check-write-owner-predicate.mjs | — | 有 |
| 164 | 源码替换符(U+FFFD)对账 —— 字节级 UTF-8 完整性的缺失维度 | check-replacement-chars.mjs | — | 有 |
| 165 | 🧾 教育欠费口径单一出口对账(blocking,AR1 出口外重写算式/AR2 裸写派生列) | check-edu-arrears-single-source.mjs | — | 有 |
| 166 | 🧵 活文档按旧副本提交会写回他人已入库行(blocking,2026-09-29 立;只判本次真改掉的那份文档,索引==HEAD 记跳过不记通过) | check-live-doc-pathspec.mjs | — | 有 |
| 167 | 🔒 turn 序号分配点上锁(blocking,max(turnOrdinal) 与 insert(chatMessages) 同体 ⇒ 体内必须有 .for(\ | check-turn-ordinal-lock.mjs | — | 有 |
| 168 | 🔀 合并复活已删文件对账(blocking,DR1 基底判定 + DR2 删除出处;默认只判未入 origin/main 的合并,每枚判一次) | check-merge-deletion-resurrection.mjs | — | 有 |
| 171 | AI 面板装载守门:GlobalShell/AISidePanel 的骨架占位几何一致 + 8 个重组件懒加载边界 + inferVendor 单一来源(首屏延迟根治防回潮,2026-09-30;门体随 d5c54f4499 入库,本枚重注册补对账) | check-ai-panel-mount-guards.mjs | — | 有 |
| 173 | 对外文档数字对账(README/README.en 的生成块与散文声称必须等于 gen-doc-numbers 现算值;判责时机=改动被审文档的那枚,未触及只报漂移数 —— 防恒红) | check-doc-numbers.mjs | — | 有 |
| 174 | 诊断面脱敏守门(b76-08a票1配套):诊断/错误上报面不得携带未脱敏的密钥/令牌/邮箱/路径等敏感串,自检 --self-test 内嵌红绿对照 | check-diagnostic-redaction.mjs | — | 有 |
| 175 | 进程退出码归因守门(b76-08a票1配套):进程 exit 1/非零退出必须可归因到显式 failure kind/错误码,禁止无归因的裸退出,自检 --self-test 内嵌红绿对照 | check-process-exit-attribution.mjs | — | 有 |
| 176 | 能力位不得客户端自供守门(b76-08a票2配套):客户端不得自报 capability 字段(connectionId/clientMode/deliveryProfile/subscriberScope/workflowRunDeltas 名单),能力位只准服务端下发,自检 --self-test | check-capability-field-not-client-supplied.mjs | — | 有 |
| 177 | SSE 帧水印守门(b76-13票1配套):SSE 流消费环必须带 fromSeq≥1 帧水印接线(唯一出口 + 读环接线 + 阳性对照),摘线即红,自检 --self-test 红绿对照 | check-sse-frame-watermark.mjs | — | 有 |
| 178 | 列表截断诚实守门(b76-13票7配套):UI 列表截断必须如实交代截断帽(不得假装展示全量),三处 UI 命中已清偿;1 处字符串尾截(terminal-section.tsx)属票面不判面(未判定不判红) | check-list-cap-honesty.mjs | — | 有 |
| 179 | 工具 schema 投影完整性守门(b76-05票2配套):工具描述符 JSON schema 投影必须键序 canonical/拒绝通道在位/A-B 两面一致/缓存中性,99 个可判工具全过才绿,自检 --self-test 4 例 | check-tool-schema-projection.mjs | — | 有 |
| 180 | 嵌套 additionalProperties 闭集守门(b76-14票2配套):嵌套层 schema 的闭集声明不得被摘(嵌套三态在位 + 类型面收编 ≥2),取不到按 UNDETERMINED 不记绿,自检 --self-test 3 例 | check-nested-additional-properties.mjs | — | 有 |
| 181 | 错误文案有界化守门(b76-12b票1配套):错误文案出边界(PERSISTENT sink)的 JSON.stringify 内插必须有界或带 ref= 基线;测试面/CLI 面/stdout-only 豁免,基线棘轮只减不增 | check-error-message-bounded.mjs | — | 有 |
| 182 | 控制面 strict 棘轮门(b76-12c票2配套):扫描面(apps/api/src/plugins + packages/shared/src)的 z.object+.strict+.catch 总和只减不增(基线 91);禁 passthrough 降红/禁装饰字段塞控制面 | check-wire-strictness.mjs | — | 有 |
| 183 | 分片上传聚合预算棘轮门(b76-12c票3配套):chunked-upload.ts 的 begin 新建装配检(isPerUserSessionBudgetExceeded)与每片落盘追加检(wouldStagedBudgetOverflow)各 ≥1,两档常量须在 PROTOCOL_UPLOAD_LIMITS 登记,防死表回潮 | check-upload-budget.mjs | — | 有 |
| 184 | 📚 活文档点名路径存续性对账(blocking,正文反引号点名的仓内路径必须在被审面在位;索引缺而 HEAD 在 ⇒ 红,HEAD 缺席只 warning,2026-09-30 D169 立) | check-live-doc-references.mjs | — | 有 |
| 185 | 迁移内容不可变性对账(已入库 drizzle 迁移不得被改写;IM1 与"该 tag 首次入库的 blob"逐字节比,存量只报数;IM2 判本次改写面;枚举 0 判死不记绿) | check-migration-immutable.mjs | — | 有 |
| 189 | Python import 入库存续性对账 | check-python-import-landed.mjs | — | 有 |
| 192 | 注册表工作树超集对账(package.json / guardian-runner 的已入库入口被工作树副本整行写回旧态;今日 28 份注册表零存量 ⇒ blocking,只在 --staged 面问责) | check-registry-worktree-superset.mjs | — | 有 |
| 194 | 🧯 §22d 入口守卫对账:scripts/**.mjs 不得顶层裸 main()(存量以 node scripts/check-direct-run-guard.mjs 末行现读为准,差值棘轮只拦本次新增) | check-direct-run-guard.mjs | — | 有 |
| 195 | 事务体内取消探测对账(db.transaction 回调体内不得 throwIfAborted/signal.aborted) | check-txn-cancel-boundary.mjs | — | 有 |
| 199 | 派生把 stdout 丢掉/直通终端、同一作用域却又读它 ⇒ 结论恒 null,门把"没拿到"写成"机器态未判定"并 exit 0(立因 G-1108372) | check-spawn-output-channel.mjs | — | 有 |
| 200 | provider 健康四档单一真相源对账(值域并表后不得再分叉) | check-provider-health-vocabulary.mjs | --strict | 有 |
| 201 | 📱 mobile-rn Expo 配置必须产出单调递增的 versionCode/buildNumber(app.json 无 versionCode ⇒ Expo 默认恒 1,覆盖安装必被 Android 降级保护拒;2026-10-12 装机实测) | check-mobile-version-code.mjs | — | 有 |
| 202 | 📱 移动端 release 打包步必须能看到 EXPO_PUBLIC_API_BASE_URL(只挂 prebuild 步 ⇒ 打包期内联 localhost:8802,线上全量断网;2026-10-13 装机实测) | check-mobile-api-base-bake.mjs | — | 有 |
| 203 | 🧾 台账同题多号差值棘轮:PROJECT_PLAN.md 索引面不得比 HEAD 面多出「同一件事的第二次登记」(换了个编号也算,2026-10-13 机主拍板根治) | check-plan-task-duplicates.mjs | --ratchet | 有 |
| 204 | 🧭 错误归因唯一出口(blocking,生产面不得出现第二份 `.message.includes(` 归因判定;调用点必须走 packages/shared 的 attributeError) | check-error-attribution-single-source.mjs | — | 有 |
| 205 | 🧩 未知枚举兜底档(blocking,闭集状态的未命中分支兜初始态 ⇒ 红;未知值必须落「不再产生副作用」那一档) | check-enum-fallback-terminal.mjs | — | 有 |
| 206 | 🔢 错误码不得按文本判(blocking,新增分支按 err.message/includes(\ | check-error-code-not-text-matching.mjs | — | 有 |
| 207 | 📏 AGENTS.md 体积守门(逐字注入面尺寸,预算 96,000 字节;口径与定级依据见脚本头注) | check-agents-doc-size.mjs | — | — |
| 208 | 🪆 工作区嵌套 git 仓零容忍(blocking,0 存量棘轮;演练/夹具仓被 IDE 源代码管理扫成「暂存的更改 10000+ 全 D」幻影) | check-no-nested-git.mjs | — | 有 |
| 212 | 🎯 输入框聚焦反馈对账(描边输入/选择控件必须有聚焦反应,三端同尺;存量按该文件 HEAD 自身棘轮只报数,定级依据与取证窗见脚本头注) | check-input-focus-feedback.mjs | — | — |
| 213 | 🛡️  盘根写入回归锁(代码里别再产新的盘根外流;差值棘轮只拦新增) | check-disk-root-write.mjs | — | — |
| 214 | 📐 mobile-rn sheet/弹窗 flex 弹性契约(bounded 容器内列表必须唯一弹性块,固定 chrome 不被压扁) | check-sheet-flex-contract.mjs | — | — |
| 215 | 🎨 RN 端硬编码 hex 基线棘轮(基线之外新增 #hex 即 BLOCK,存量只减不增) | check-mobile-rn-style-parity.mjs | — | 有 |
| 150 | 角色档合规对账(元素类别→档位,77 不判的那一型) | check-radius-role-conformance.mjs | — | 有 |
| 170 | 🛰 旁路落地声明面对账(blocking,留痕声明面 ⊉ 实际面 ∧ 射程外路径写回旧 blob ⇒ 红并点名;增量台账每枚判一次) | check-bypass-landing-scope.mjs | — | 有 |
| 172 | 🛡  跳门变量承诺/兑现对账(blocking,文档承诺的 HUSKY_SKIP_* 必须有真实读点;差值棘轮只拦新增) | check-skip-env-promise.mjs | — | 有 |
| 187 | 不安全加载标记四形态扫描(finally-set / except-set / tail-set / set-add;判据本体单份住在 _load_lifecycle.py,门内零自行判定;blocking) | check-load-state-loaded-marks.mjs | — | 有 |
| 188 | 🔐 授权判据列隔离(blocking,拦「归属判据所在的 SELECT 顺带取了展示列」—— 展示字段损坏会把授权查询拖成 500 而不是 403/404;判据本体单份住在 check-authorization-column-isolation.mjs,门内零自行判定) | check-authorization-column-isolation.mjs | — | 有 |
| 198 | ⏱️  DB 盲写 updatedAt 棘轮(blocking,拦「.set({ ...data, updatedAt: new Date() })」无条件覆盖形态回潮 —— 它把增量读的 updatedAt 消费源污染成假变化) | check-db-blind-updatedat-set.mjs | — | 有 |
| 13d | 🚫 PROJECT_PLAN.md 重复登记副本指针棘轮 | check-plan-dup-pointer-ratchet.mjs | — | — |

### 1.2 warn 项（26 项）

| ID | Label | Script | Args | onFailHint |
|----|-------|--------|------|------------|
| 3 | 🗄️ schema drift | check-db-schema-drift.mjs | — | — |
| 45 | 🛡️  C 盘路径硬编码扫描(warn-only,AGENTS.md §26) | check-c-drive-paths.mjs | — | 有 |
| 2f-cli | 🌐 cli i18n parity 守门(warn-only,2026-07-28 立) | check-cli-i18n-parity.mjs | — | 有 |
| 13b | 📐 PROJECT_PLAN.md 体积(warn-only) | check-project-plan-size.mjs | — | — |
| 19 | ⚠️  staged 污染预警(warn-only) | check-staged-pollution.mjs | — | — |
| 21 | 🌐 多端同步开发守门(warn-only) | check-multi-end-sync.mjs | — | — |
| 22 | 📖 README 同步守门(warn-only) | check-readme-sync.mjs | — | — |
| 24b | 🔌 端口注册表守门(warn-only,monorepo-wide 全量) | check-port-registry.mjs | --all | — |
| 54 | ⏳ 未提交源码改动年龄守门(warn-only,B14 防工作树改动被并行 checkout 抹掉) | check-uncommitted-age.mjs | — | 有 |
| 76 | 📋  迁移账本带外对象防回潮(warn-only,O20e:journal 序号全集 vs 账本行全集) | check-migration-ledger-drift.mjs | — | 有 |
| 86 | 🗂  verify-*.mjs 临时验证文件落点(warn,AGENTS §25 配套,补装) | check-verify-tmp-files.mjs | — | — |
| 92 | 💽 C 盘污染实地扫描(warn,拦"源码没写死但东西真掉在 C 盘") | check-c-drive-pollution.mjs | — | 有 |
| 96 | 🏠 §26 家目录改道完整性(warn,机器态与 diff 无关 ⇒ 不拦提交链,回潮即打红字) | check-home-junctions.mjs | — | 有 |
| 110 | 📦 产物预算对账(warn,交付出去的产物第一次有上限表:主包口径 / 悬空 sourceMappingURL 引用) | check-artifact-budget.mjs | --target miniapp | 有 |
| 114 | 🧪 测试收集存续性对账(warn,收集失败套件必须为 0;断言失败不混计) | check-test-collection-runs.mjs | — | 有 |
| 153 | 🛡️ 服务二进制路径存续性对账(判机器状态:nssm 各服务 Application 绝对路径存在性;三态不并桶,§12e 只能 warn) | check-service-binary-paths.mjs | — | 有 |
| 154 | 临时夹具 scratch 根二阶嵌套巡检(只报不删,三态含未判定) | check-scratch-root-no-nesting.mjs | — | 有 |
| 155 | 镜像测试临时夹具落点对账(默认只报名,--strict 才判红) | check-fixture-tmpdir.mjs | — | 有 |
| 156 | 自检用例登记侧的求值配对对账(登记不求值 ∧ 用例传函数 ⇒ 才判红;潜伏档只报数) | check-selftest-registrant-evaluates.mjs | — | 有 |
| 190 | 枚举/映射取不到时的兜底分支不得落到更宽的权限或能力档(票 G-816027):宽档集合由被审面的两份注册表(TS POLICY_BY_MODE / PY skips_approval_permission_mode)现读推导,推导失败或槽位撞名一律未判定;与"凭据在场即豁免"那道门(157)不重叠计账 | check-enum-default-widening.mjs | — | 有 |
| 191 | 测试判据复制对账(§22c 跨门尺子;门体与镜像测试各写一份形态清单/正则即点名,存量 27 处只报数 ⇒ warn,升 blocking 前置 = 命中归零) | check-test-judge-not-replicated.mjs | — | 有 |
| 210 | 📐 TS/Python 行切分口径逐例同值对账(warn;§0.9 造好没装车那一格) | check-line-split-parity.mjs | — | 有 |
| 211 | 🧮 PROJECT_PLAN 号池对账(声明位号 >999 按重数差值棘轮;R2 发号路径点名,warn) | check-plan-id-pool.mjs | — | 有 |
| 186 | loadState 四档投影防漂移对账(LV1 四档字面量零散落 + LV2 五族 get_status 的 loadState 键与共享出口来源;warn 起步) | check-load-state-projection-parity.mjs | — | 有 |
| 196 | 📎 PROJECT_PLAN.md 短 sha 出处指针防回潮(新增行裸短 sha 须走台账/声明前缀/文件名通道,warn) | check-plan-sha-form.mjs | — | 有 |
| 197 | 📉 truncated 声明块计数伴随 + 投递档位收口绊线(DTO 类型层,warn) | check-truncation-accounting.mjs | — | 有 |

### 1.3 info 项（1 项）

| ID | Label | Script | Args |
|----|-------|--------|------|
| 23 | 📋 staged 文件清单(info) | check-staged-files.mjs | — |

### 1.4 失败提示详情（onFailHint）

仅展示有 onFailHint 的守门项（共 172 项），按 guardian-runner.mjs 出现顺序排列。

#### [2e-dupns] 🧬 i18n 重复命名空间/重复键(blocking,防 JSON last-wins 静默遮蔽)

```

  💡 检测到 messages JSON 存在重复命名空间/重复键(last-wins 遮蔽风险):
     1. node scripts/check-i18n-duplicate-namespaces.mjs  (定位文件与行号)
     2. 保留正确版本块,删除重复块(通常是写入侧误追加的尾部块)
     3. 重新 commit;禁止以"追加新块"方式修改既有命名空间

```

#### [2f-web] 🌐 i18n AI 翻译流水线(blocking)

```

  💡 zh-CN.json 有改动但 i18n pending 非空,请先跑翻译流水线:
     1. node scripts/i18n-diff.mjs          (检测差异,生成 pending 清单)
     2. AI agent 翻译 → .ihui-agent/tmp/i18n-translations.json
     3. node scripts/i18n-apply.mjs --check-first  (先对账再应用翻译)
     4. node scripts/check-i18n-keys.mjs    (验证 parity)
     5. git add apps/web/messages/{en,ja,ko,zh-TW}.json 重新 commit

```

#### [2f-miniapp-taro] 🌐 [miniapp-taro] i18n AI 翻译流水线(blocking)

```

  💡 miniapp-taro zh-CN.ts 有改动但 i18n pending 非空,请先跑翻译流水线:
     1. node scripts/i18n-diff.mjs --target=miniapp-taro  (检测差异,生成 pending 清单)
     2. AI agent 翻译 → .ihui-agent/tmp/i18n-translations.json
     3. node scripts/i18n-apply.mjs --target=miniapp-taro --check-first  (先对账再应用翻译)
     4. node scripts/i18n-diff.mjs --target=miniapp-taro   (复验 parity,应无 pending)
     5. git add apps/miniapp-taro/src/i18n/{en,ja,ko,zh-TW}.ts 重新 commit

```

#### [27] 🛡️  z-index 层叠防护(防第三方 IDE 注入 + 遮罩 fade-in 回归 + 窗口按钮等效压暗)

```

  💡 五类命中处置:
     ① tokens.css / globals.css 出现 !important → 项目禁令,改走 layout.tsx inline script setProperty;
     ② layout.tsx inline script 少设 --z-* 变量 → 补回 11 个 setProperty;
     ③ dialog.tsx 遮罩加了 open 态 fade-in → 删掉 animate-in / fade-in-0(渐显期间内容全亮);
     ④ GlobalTopBar.tsx 两组契约缺任一标记 ——
        等效压暗层 data-window-controls + data-window-controls-dim:窗口控制三按钮挂
        z-max(10003) 不能降(须高于 resize 抓手 z-loading=10000),遮罩永远盖不到它,
        只能靠等效压暗覆盖层,删掉=登录窗等 29+ 处遮罩下三按钮重新全亮(同族第 3 次复发);
        失焦非活动态 data-window-inactive(容器) + globals.css 的 [data-window-controls][data-window-inactive]
        无边框窗口拿不到 DWM 原生"非活动标题栏变灰",删掉即失焦时按钮不再降亮;
     ⑤ 判闸有效性自查:node scripts/check-z-index-guard.mjs --self-test(内存断言,不落盘)
     紧急跳过(不推荐):HUSKY_SKIP_Z_INDEX_GUARD=1 git commit ...

```

#### [28] 🛡️  全屏遮罩 z-index 层级(防 fixed inset-0 + z-50 复发)

```

  💡 fixed inset-0 全屏遮罩用了 z-50/z-40/z-30 等低数字 Tailwind 类(值 < 100),
     低于 AISidePanel 的 z-sticky=990,会被压在下面 = AI 面板露在遮罩之上。
     修复:把 z-50 改为 z-modal(=2000, 引用 --z-modal CSS 变量)。
     透明点击捕获层(无 bg-black)不在本守门范围。
     全量清单:node scripts/check-overlay-zindex.mjs
     紧急跳过(不推荐):HUSKY_SKIP_OVERLAY_ZINDEX=1 git commit ...

```

#### [29] 🚀 Push 同步兜底(防"commit 后忘记 push"复发,AGENTS.md §21 第三道防线)

```

  💡 本地有未 push 的 commit,本次 commit 已阻止。
     post-commit 钩子(git-push-guard.mjs)本应自动 push,但可能因以下原因失败:
       - HUSKY_SKIP_PUSH=1 跳过 / push 网络失败 / 凭据失效
       - agent 用 --no-verify 跳过所有钩子
       - pre-push typecheck 阻塞 / RunCommand 工具失联

  修复方法(任选其一):
     ① 自动 push: node scripts/git-push-guard.mjs
     ② 手动 push: git push origin main
     ③ 紧急跳过(不推荐): HUSKY_SKIP_PUSH_SYNC=1 git commit ...

```

#### [30] 🛡️ i18n 文件完整性(防 prettier 截断事故复发)

```

  💡 staged 的 i18n JSON 文件行数异常减少(>50% 且 >100 行),
     通常是 lint-staged 的 prettier --write 解析大 JSON 失败导致截断事故。
     修复:git restore --staged --worktree <file> 后重新编辑/格式化。

```

#### [30a] 🛡️  Commit 丢失防护(blocking,AGENTS.md §22,防 reset / drop stash 误丢 commit)

```

  💡 若上表是"仅远端 tag"或 origin 变 [gone],通常是宿主清理嵌套 ref 导致的抖动,
     并非真的丢 commit。处理(离线即可恢复):
       node scripts/git-refs-heal.mjs                  # 按清单重建 + 固化进 packed-refs
       node scripts/git-refs-heal.mjs --refresh-remote # 联网从 origin 校准(需 http_proxy)
     守护 IHUI-GIT-GUARD 每 10s 巡检,会自动修 —— 也可等它自动恢复。
     机制说明:AGENTS.md §5b「嵌套 ref 存续」。

```

#### [30b] 🛡️  Stash 滞留源码改动守门(blocking,AGENTS.md §12d,防已完成工作滞留 stash 静默失联)

```

  💡 存在滞留 ≥48h 的 stash 含源码改动且未做零损失备份,
     处置二选一:A. git stash apply "stash@{n}" → 验证 → commit 落地 → drop;
                B. git tag backup/stash-<slug>-<sha7> "stash@{n}" 后 drop(内容永不丢)。
     跳过(应急):HUSKY_SKIP_STALE_STASH_CHECK=1 git commit ...

```

#### [45] 🛡️  C 盘路径硬编码扫描(warn-only,AGENTS.md §26)

```

  💡 staged 文件中检测到硬编码 C 盘写入路径(如 C:\temp\ / C:\Users\*\AppData\Local\Temp\)。
     修复:用 os.tmpdir() (Node) 或 $env:TEMP (PowerShell) 替代,自动走 D 盘;
           用户配置目录用工具自带配置 (pnpm config / npm config / pip config);
           系统日志写 $env:TEMP (已指向 D 盘)。
     唯一例外:apps/desktop/src-tauri/ 内部 API (已自动排除)。
     跳过方法 (应急):HUSKY_SKIP_C_DRIVE_PATHS=1 git commit ...

```

#### [35] 🐍 mypy 类型检查(防 ai-service Python 类型回退)

```

  💡 apps/ai-service 的 Python 代码有 mypy 类型错误,
     修复:cd apps/ai-service && mypy app --ignore-missing-imports
     紧急跳过(不推荐):HUSKY_SKIP_MYPY=1 git commit ...

```

#### [36] 🎨 [miniapp-taro] design-tokens 同步(防 app.css 漂移)

```

  💡 apps/miniapp-taro/src/app.css 的**受管** --color-* 档与 packages/design-tokens/src/styles/tokens.css 不一致,
     修复:pnpm --filter @ihui/miniapp-taro sync-tokens(写回受管块,幂等)
     然后重新 git add apps/miniapp-taro/src/app.css 并 commit
     ⚠️ 本门曾被判错方向:判据只遍历副本已有的键 ⇒ 对「源头有、副本整批缺」一路报绿;
        补上判缺档后又拿源头**全部**属性去判,把生成器按政策刻意不搬的档(非色档 / web 独有的
        --color-sidebar*/--color-shell-panel / 跨行 --color-gradient-*)算成缺档,255 红点里 88 条是误判,
        门因此被降权。现在「该判什么」与「该写什么」是同一个谓词
        (scripts/sync-miniapp-tokens.mjs 导出的 MINIAPP_SKIP_PREFIXES + isManagedForMiniapp)。
        所以**不得**为了消红去放宽判据或往跳过表里塞条目:生成器写不出来的新跨行档,要么改写成单行,
        要么扩生成器的写回面(两侧同笔入账),要么交回主控判定。

```

#### [37] 🎨 [web] design-tokens 同步(防 globals.css 漂移)

```

  💡 apps/web/app/globals.css 未 @import tokens.css 或顶层手抄 :root/.dark 变量,
     修复:确认 globals.css 含 @import "../../../packages/design-tokens/src/styles/tokens.css";
     删除顶层 :root/.dark 块中与 tokens.css @theme 重复的变量

```

#### [38] 🛡️  solito 幽灵依赖回归守门(blocking,防 P0 优化被回退)

```

  💡 检测到 solito 依赖被重新引入,本仓库已于 2026-07-28 移除 solito(commit f8c9a6630c)。
     packages/app 已改用纯 props 注入式跨端共享组件(无外部导航库依赖)。
     修复:从 package.json 删除 solito 依赖,从 pnpm-workspace.yaml 删除 *solito* hoist,
     删除 patches/solito@*.patch,删除 packages/app 源码中 import from "solito/..." 语句。

```

#### [39] 📱 mobile-rn screen 迁移完整性(blocking,防独立实现回升)

```

  💡 发现 mobile-rn screen 未迁移到 @ihui/rn-app 共享层。
     P3-3.3 目标要求所有 screen(除白名单豁免)必须 import from "@ihui/rn-app"。
     修复(二选一):
       A. 迁移到共享层:packages/app/src/features/<feature>/ 创建共享组件 + wrapper 改造
       B. 若确属 RN 端独占,在 scripts/check-rn-app-migration.mjs WHITELIST 登记并附理由
     详见 scripts/check-rn-app-migration.mjs --help

```

#### [40] 🔗 共享层重复检测(blocking,防端内重新实现 shared hook/util)

```

  💡 发现端内(apps/*)独立实现了 packages/shared 已提供的 hook/util。
     AGENTS.md §3 "共享层优先" 要求:能共用的一定共用,禁止端内重新实现。
     修复:
       A. 删除端内实现,改为 import { xxx } from "@ihui/shared"
       B. 若确属平台特有(依赖 DOM/RN/Taro API),在脚本 whitelist 登记并附理由
     详见: node scripts/check-shared-layer-duplication.mjs

```

#### [41] 🌿 单分支开发守门(blocking,AGENTS.md §9b)

```

  💡 本门判的是"旁支长期滞留",不是"存在旁支"。红 = 某分支滞留超过在飞窗口且不在任何豁免内。
     两类豁免(名单与条数以门的现读输出为准,此处不写死):
     ① in-flight —— 分支尖端提交距今 ≤ GRACE_HOURS(默认 48;IHUI_SINGLE_BRANCH_GRACE_HOURS 可调,
        取不到尖端提交时刻 ⇒ 不豁免,宁误拦不静默);
     ② backup —— backup/ 与 ihui-backup/ 前缀(含其 origin/ 镜像);AGENTS §5b 明令禁止删除备份引用,
        本门永远不会教你去删它们。
     其余合法形态:goal/* 且 .ihui-agent/goal-runtime/STATE.md 标注 active;linked worktree 已 checkout
     的分支(AGENTS §12d sanctioned 并行隔离)。
     处置:红名单上的分支若工作已并入 main,`git branch -d <分支>`(只删已合并)是正常收口;
     尚未并入 ⇒ 先把改动合回 main,或等它在飞窗口内自然豁免。禁止 -D / origin --delete(门体不判的
     豁免分支更不许删)。
     阳性对照:IHUI_SINGLE_BRANCH_GRACE_HOURS=0 node scripts/check-single-branch.mjs(窗口调 0,
     豁免名单全部现读报出);复验:node --test scripts/tests/check-single-branch.test.mjs

```

#### [2f-shared-diff] 🌐 [shared] i18n AI 翻译流水线(blocking)

```

  💡 shared/zh-CN.json 有改动但 i18n pending 非空,请先跑翻译流水线:
     1. node scripts/i18n-diff.mjs --target=shared  (检测差异,生成 pending 清单)
     2. AI agent 翻译 → .ihui-agent/tmp/i18n-translations.json
     3. node scripts/i18n-apply.mjs --target=shared --check-first  (先对账再应用翻译)
     4. node scripts/check-i18n-keys.mjs --target=shared  (验证 parity)
     5. git add packages/i18n/messages/shared/{en,ja,ko,zh-TW}.json 重新 commit

```

#### [2f-mobile-rn] 🌐 mobile-rn i18n parity 守门(blocking,2026-09-28 由 warn 升档;立票 2026-07-28)

```

  💡 mobile-rn 端 5 语言 i18n key 集合不一致。
     修复:node scripts/check-i18n-keys.mjs --target=mobile-rn 查看详情,
     补齐缺失 key 或删除多余 key,确保 zh-CN/zh-TW/en/ja/ko 5 语言 key 集合完全一致。
     1 周后(2026-08-04)评估升级 blocking。

```

#### [2f-cli] 🌐 cli i18n parity 守门(warn-only,2026-07-28 立)

```

  💡 cli 端 5 语言 i18n key 集合不一致。
     修复:node scripts/check-cli-i18n-parity.mjs 查看详情,
     补齐缺失 key 或删除多余 key,确保 zh-CN/zh-TW/en/ja/ko 5 语言 key 集合完全一致。
     cli 端 i18n 体量小(63 行),warn-only 起步,后续按需升级 blocking。

```

#### [9] 🔍 safeParse 静默忽略(blocking,2026-07-26 升级)

```

  💡 Fastify 路由存在 safeParse 静默忽略反模式(result.success === false 不返回/不日志)。
     修复:对 parse 失败明确返回 400 + 错误信息,或记日志后返回,禁止 silent-ignore。
     详见 AGENTS.md §5 后端约束(Zod 校验请求参数)。

```

#### [34] 🔍 @ts-ignore 新增检测(blocking:存量已清零,只拦 staged 新增)

```

  💡 @ts-ignore 是类型安全压制,本仓库刚清理 215 处历史遗留
     请审视是否真的需要,或改用 e2e/tsconfig.json 独立配置
     跳过白名单:e2e/ / node_modules/ / dist/ / .next/ / build/

```

#### [33] 🛡️  LLM provider schema 守门 (blocking,阶段 3 主体已落地)

```

  💡 apps/ai-service/.env 的 LLM_PROVIDERS 字段不符合 ProviderConfig schema。
     常见错误:JSON 解析失败 / 字段类型错(api_key 必须是字符串、enabled 必须是布尔值) / 未知 provider。
     修复方法:
       ① 跑迁移脚本生成标准 JSON: node scripts/migrate-llm-providers.mjs --input apps/ai-service/.env --output apps/ai-service/.env.migrated --apply --backup
       ② 用 --strict 模式定位具体错误: node scripts/check-llm-provider-schema.mjs --strict --json
     详见 docs/llm-provider-stage3-changelog.md §4 用户升级指南

```

#### [42] 🛡️  React SyntheticEvent 闭包陷阱(防 popover 常驻显示复发)

```

  💡 在异步回调闭包内访问了 React SyntheticEvent 属性(如 e.currentTarget)。
     React 17+ 在 handler 返回后 currentTarget 置 null,异步闭包内访问永远为 null。
     修复:在 handler 同步阶段 const el = e.currentTarget 缓存到闭包变量,
     或用 useRef 管理 DOM 元素(anchorRef.current 替代 e.currentTarget)。
     参考:apps/web/src/components/chat/model-selector.tsx MemberDiscountSection

```

#### [44] 🧹 根目录整洁守门(一级目录白名单)

```

  💡 一级目录存在白名单外条目,已阻断 commit。
     处置(二选一):
       ① 临时/垃圾产物 → 删除,或移入 tmp/ 或 logs/
       ② 合法新增(新配置/新文档/新目录) → 加入 scripts/check-root-dir-clean.mjs 白名单后重新 commit
     白名单四组:ALLOWED_FILES / ALLOWED_DIRS / ALLOWED_HIDDEN_FILES / ALLOWED_HIDDEN_DIRS。

```

#### [46] 🔙 统一返回键防私接守门(禁页面私写 router.back/history.back)

```

  💡 页面私接了 router.back()/history.back(),绕过顶栏统一返回键。
     修复方式(声明而非实现):
       ① 二级及以上子页面:零代码,TopBarBackAutoRegister 已自动声明;
       ② 页内视图级返回(详情→列表):useTopBarBack(selected ? { onBack: () => setX(null) } : null);
       ③ 指定降级路由:<BackButton fallbackHref="/parent" />。
     唯一豁免:apps/web/src/components/layout/GlobalTopBar.tsx(统一返回键本体)。

```

#### [47] 💧 溯源水印覆盖守门(自愈式: 缺失/损坏自动补齐并回暂存区)

```

  💡 已有跟踪文件缺失/损坏溯源水印,且自动补齐未能达标(通常 = 缺口 > 200 个, 或类型不可注入)。
     CI 会因 Provenance watermark check 失败,请先修复。修复出路按判定面给,inject 完≠修好(G-866):
     --staged(提交档): node scripts/watermark.mjs inject <file> && git add <file>(提交带走的是索引 blob,必须 add 回索引)
     HEAD 面(全量/push-gate): inject 只写工作区 —— 必须 git add <file> 后随下一枚提交带上;不提交 = 欠账还在,门照红
     --worktree(人工逃生舱): inject 写到盘上即达标,无后续动作
     退出码 2 = 取不到被审面「未判定」,不是"没水印";列出全部缺口: node scripts/watermark.mjs list-uncovered
     排查批量改写来源(文本级 sed/prettier/生成器)后整体重注入: node scripts/watermark.mjs inject

```

#### [48] 🧩 GitHub Actions 步骤顺序守门(setup-node cache:pnpm 必须在 pnpm/action-setup 之后)

```

  💡 workflow 里 actions/setup-node 用了 cache: pnpm,但 pnpm/action-setup 排在它后面。
     修复: 把 pnpm/action-setup 步骤移到 actions/setup-node 之前。

```

#### [49] 🧾 迁移记账守门(journal ↔ .sql 一一对应 / when 单调唯一 / B10 登记表空闲性 warn)

```

  💡 packages/database/drizzle 的 journal 与 .sql 记账结构漂移:
     1. node scripts/check-migration-bookkeeping.mjs        (离线诊断)
     2. node scripts/check-migration-bookkeeping.mjs --db   (对照库内 drizzle.__drizzle_migrations)
     常见成因: 迁移文件被文本级改写导致命名/内容漂移;手工增删 journal 条目未同步 .sql。

```

#### [50] 🛡️ next-env.d.ts 构建污染守门(禁 .next-* 变体引用)

```

  💡 apps/web/next-env.d.ts 引用了 .next-* 变体(.next-staging/.next-static 等),
     这是 next build 在 IHUI_BUILD_DIST 覆盖 distDir 时的副作用残留。
     修复: git checkout -- apps/web/next-env.d.ts
     部署脚本 ihui-deploy.ps1 已在 staging→.next 交换后自动还原,本地误改请手动还原。

```

#### [51] 🧭 能力目录登记守门(产物一致性 / v1 端点必须接能力闸 / scope 语义)

```

  💡 对外端点未登记能力(或能力目录与产物漂移):
     1. node scripts/check-capability-catalog.mjs --json   (拿到端点/scope 清单)
     2. 在 packages/types/src/capability-catalog.ts 登记 scope 与 routes
     3. pnpm capabilities:export                            (重新生成 capabilities.json)
     4. 给 handler 接 preHandler: [requireApiKeyAuth, requireCapability('<scope>')],
        或在路由族上 addHook('preHandler', requireCapabilityRules([...]))
     5. node scripts/check-capability-catalog.mjs --self-test  (逻辑自检)

```

#### [52] 🪟 派生弹窗守门(blocking,AGENTS.md §5b windowsHide 默认值配套)

```

  💡 检测到派生控制台程序但漏 windowsHide → 无控制台父进程下必弹可见黑窗。
     修复:在该调用的 options 里加 `windowsHide: true`;
           无 options 则补 `{ windowsHide: true }`;带 args 数组补在 args 之后;
           末位是 callback 的把 options 插在 callback 之前。
     自检:node scripts/check-no-visible-spawn.mjs --self-test
     全量:node scripts/check-no-visible-spawn.mjs
     开发机静默兜底:node scripts/install-console-window-hook.mjs --verify

```

#### [53] 🛡️  admin 面特权判定一致性(blocking,O13b roleId>=1 收敛)

```

  💡 apps/api 出现新的裸 `roleId >= 1` 式判定 / 本地重定义 requireAdmin / platform 数据类别误开放。
     修复:preHandler 统一走 plugins/require-permission.ts 的 requirePermission / requireAnyPermission /
           requireAdmin;能力面 scope 的机器可见性以 capability-catalog 的 thirdPartyEligible 为准。
     自检:node scripts/check-admin-gate-consistency.mjs --self-test
     全量:node scripts/check-admin-gate-consistency.mjs

```

#### [54] ⏳ 未提交源码改动年龄守门(warn-only,B14 防工作树改动被并行 checkout 抹掉)

```

  💡 有源码改动停留在未提交状态超过阈值(默认 45 分钟)。工作树不是暂存区:
     任何一次并行的 git checkout / reset / clean 都会把它整体抹掉且不留痕迹。
     处置:node scripts/safe-commit.mjs -m "<本次改动说明>" -- <file>(改完即提交)
           或按 AGENTS.md §12d 用 git worktree 隔离并行开发。
     自检:node scripts/check-uncommitted-age.mjs --self-test
     全量:node scripts/check-uncommitted-age.mjs --json
     调阈值:IHUI_UNCOMMITTED_AGE_MIN=<分钟> 或 --threshold-min <分钟>

```

#### [55] 🈶 工具名显示覆盖率守门(blocking,D54/H16 界面禁直显英文工具码名)

```

  💡 有注册工具没有本地化功能名,或 taskStatus 里对应键缺某语言文案。
     修复两步:
       1) packages/shared/src/chat/tool-display.ts 的 TOOL_DISPLAY_KEYS 补 `工具名: 'toolXxx'`
       2) packages/i18n/messages/shared/{zh-CN,zh-TW,en,ja,ko}.json 的 taskStatus 补 toolXxx
     自检:node scripts/check-tool-name-display-coverage.mjs --json
     紧急跳过(不推荐):HUSKY_SKIP_TOOL_NAME_COVERAGE=1 git commit ...

```

#### [59] 🈳 ICU 语法跨端可用性守门(blocking,D101:非 web 端取词引擎只支持四形子集)

```

  💡 语言包里出现了某端渲染不了的 ICU 形态 —— 界面会直接显示 `{state, select, …}` 语法残,
     或与 web(next-intl 全量 ICU)静默渲染成不同文本。实测背景:next-intl 只挂在 apps/web。
     三种正解,按优先级:
       1) 拆成普通键(如 toolRunning / toolCompleted),不用 ICU
       2) 用共享子集解释器支持的四形:plural / select / selectordinal / number(plain style)
       3) 确需 `::` skeleton 或 cli 端要用 ICU → 先完成 PROJECT_PLAN.md D101 第④⑥项再解锁
     自检:node scripts/check-icu-locale-support.mjs --self-test

```

#### [57] 🧩 对话流元素覆盖守门(blocking,D51/H13:①锚点漂移 ②契约事件两端不齐 ③清单条目倒退 ④锚点存续性倒退 ⑤注释式摘线)

```

  💡 三类违规各有解法:
     ① 锚点漂移 = 该元素已在库内,其渲染位文件/关键标识被删或被改名 → 恢复实现,
        或确属重命名时同 PR 更新 scripts/data/chat-flow-elements.json 并说明理由
     ② 事件不齐 = 元素声明的 SSE 事件必须同时出现在 apps/ai-service/app/core/sse_contract.py
        与 packages/shared/src/sse/contract.ts(两端契约是一份事实源的两份拷贝)
     ③ 条目倒退 = 清单条目数低于 entryCountBaseline → 撤销误删的任务行,或在计划里说明撤销理由
     自检:node scripts/check-chat-element-coverage.mjs --self-test
     紧急跳过(不推荐):HUSKY_SKIP_CHAT_ELEMENT_COVERAGE=1 git commit ...

```

#### [58] 🈹 中文术语机翻残留守门(blocking,D104/H29:竞品自家 zh 包实测 list→挂牌/房源,我方 zh 侧此前无闸)

```

  💡 判据是「键名英文词根 ∧ 值内高置信错误译法」双条件,单条件一律放过(宁漏不误报)。
     两种正当处置:
       ① 确为误译 → 改成正确术语(如 list 类键里出现 房源/挂牌)
       ② 确为业务用词(真在做房产/港口类文案)→ 在 scripts/data/zh-term-glossary.json
          给该规则补 expect 词或收紧 keyRoot 定义,并在提交说明里写清理由
     误伤回归:node scripts/check-zh-term-quality.mjs(现存语言包须 0 命中才可加新判据)
     自检:node scripts/check-zh-term-quality.mjs --self-test
     紧急跳过(不推荐):HUSKY_SKIP_ZH_TERM_GUARD=1 git commit ...

```

#### [60] 🕐 工具活动行双时态覆盖守门(blocking,D81①/D83/H28:键形合规 + 覆盖率 ratchet)

```

  💡 两类失败,处置不同:
     ① 键形不合规(半套措辞)→ 五语言必须齐,且每个 *Activity 值必须是含
        running{} / completed{} / other{} 三支的 ICU select。半套比不补更糟:
        某语言会恒显示"正在…"或整条空白。
     ② 覆盖率低于 floor → 有人删了/改名了已配置的措辞键,补回;确属撤销才调
        scripts/data/tool-activity-coverage.json 的 floor,并在提交说明写数量变化。
     逐批补齐清单:node scripts/check-tool-activity-coverage.mjs --scaffold
     自检:node scripts/check-tool-activity-coverage.mjs --self-test
     紧急跳过(不推荐):HUSKY_SKIP_TOOL_ACTIVITY_COVERAGE=1 git commit ...

```

#### [56] 🔤 工具功能名各端可解析守门(blocking,防取词回显与离线包过期)

```

  💡 有工具功能名在某语言 / 某端语言包 / 小程序离线包里取不到值。
     修复:1) 补齐 packages/i18n/messages/shared/<lang>.json 的 taskStatus 键(5 语言齐全)
           2) cd apps/miniapp-taro && pnpm gen:i18n  重生成离线语言包
     全量:node scripts/check-tool-display-resolvable.mjs --json
     紧急跳过(不推荐):HUSKY_SKIP_TOOL_DISPLAY_RESOLVABLE=1 git commit ...

```

#### [61] 🖥️  桌面安装器资产三方对账(blocking,引用↔打包↔5 档落盘)

```

  💡 NSIS 脚本「引用的位图 ↔ File 打包清单 ↔ 磁盘 5 档 DPI 资产」三方不一致(编译期零报错,
     只有真机跑安装器才暴露 —— 静默失败必须在这里拦住):
     按报错项处置:
       ① “引用了但未打包: X.bmp” → 在 apps/desktop/src-tauri/windows/ihui-ui.nsi 的
          !macro IHUI_EXTRACTPAGESETS_SET 内补一行(与 btn-close.bmp 同处):
            File "/oname=$PLUGINSDIR\X.bmp" "${IHUI_ASSETROOT}\assets-${LIT}\X.bmp"
       ② “打包了但档位缺文件” → 重跑资产导出:node scripts/desktop-installer-assets.mjs
          五档(100/125/150/175/200)缺一档,就在那个 DPI 档位下控件空白
       ③ “解析到 0 个引用 / 0 条 File” → 判据正则与 nsi 结构漂移,门禁已失效,
          必须修 scripts/check-installer-assets.mjs 的解析式,**禁止放宽判定**
     单独复验:node scripts/check-installer-assets.mjs
     紧急跳过(不推荐):HUSKY_SKIP_INSTALLER_ASSETS_GUARD=1 git commit ...

```

#### [62] 🧩 桌面 NSIS 安装器模板漂移(blocking,installer.nsi == 上游模板 + 已登记补丁)

```

  💡 installer.nsi 已不等于「当前 Tauri CLI 内置模板 + 已登记补丁集」。两类成因处置不同:
     ① 直接手改了 installer.nsi(最常见)→ 把差量登记进侧车补丁,复验后随代码同 commit:
          node scripts/desktop-nsis-template.mjs --emit-patches
            (导出 scripts/desktop-nsis-ihui-patches.json)
          node scripts/desktop-nsis-template.mjs --check   # 应回到 OK
          git add scripts/desktop-nsis-ihui-patches.json
        不登记就提交,下次 --write 会把这段定制整体抹掉(已真实回退过一次)。
     ② 升级了 Tauri CLI(上游模板变了)→ 先 diff 上游与仓库两份模板、人工复核各补丁
        锚点是否仍成立,确认后再 --write,然后重跑 --check(必要时补 --emit-patches);
        **禁止盲目 --write**(会连带抹掉未登记定制)。
     注:未安装 @tauri-apps/cli 原生模块的环境里该脚本打印「跳过校验」并 exit 0,
         即本项在干净 checkout / 部分 CI 自动放行(既有宽松兜底,不是漏判)。
     紧急跳过(不推荐):HUSKY_SKIP_NSIS_TEMPLATE_GUARD=1 git commit ...

```

#### [63] 🔀 SSE 双解析器漏接对账(blocking,帧覆盖 ratchet + 未接帧须交代归属)

```

  💡 同一协议两处解析,漏接是**静默**的:小程序拿不到帧,界面上看起来就是"没这个功能"。
     看清单:node scripts/check-sse-parser-parity.mjs --report
     补接一帧后:删 scripts/data/sse-parser-coverage.json 里对应的 webOnly 登记项,
                并把 parseCoverageBaseline 上调到新实测值(降回去就是在倒退)。
     确实只有 web 消费:必须在该文件 webOnly 里写明**为什么**(空理由同样拦)。
     自检:node scripts/check-sse-parser-parity.mjs --self-test
     紧急跳过(不推荐):HUSKY_SKIP_SSE_PARSER_PARITY=1 git commit ...

```

#### [68] 🔐 权限模式词汇对账(blocking,跨语言注册表一致 + 消费点禁漂移)

```

  💡 权限档有 5 套拼写时,"发了"和"生效"是两件事 —— 本门拦的就是这个。
     唯一真源:packages/types/src/permission-mode.ts ↔ app/core/permission_mode.py
     改法:先在两侧同时登记成员/别名(顺序反了就是 R1 红),再改消费点。
     决策位比较请用 is_readonly_permission_mode / skips_approval_permission_mode,
     不要写 `== "auto"` 这类别名比较(R3 拦)。
     自检:node scripts/check-permission-mode-vocabulary.mjs --self-test
     紧急跳过(不推荐):HUSKY_SKIP_PERMISSION_VOCAB=1 git commit ...

```

#### [64] 🧩 [miniapp-taro] 适配层未接线即拦(防"造好没装车"死代码回升)

```

  💡 apps/miniapp-taro/src/components/adapters/*.taro.tsx 里有新增的无人 import 适配器。
     接线:页面里 import { X } from '@/components/adapters'
     或删除:确认端内已有自有实现后 rm(先过 AGENTS.md §7 删除三问)
     存量收紧基线:node scripts/check-adapter-wiring.mjs --update-baseline
     自检:node --test scripts/tests/check-adapter-wiring.test.mjs
     紧急跳过(不推荐):HUSKY_SKIP_ADAPTER_WIRING=1 git commit ...

```

#### [66] 🎨 [miniapp-taro] 适配层硬编码颜色基线(防新增 hex/rgb 绕过 token)

```

  💡 adapters/*.taro.tsx 出现了基线之外的新增硬编码颜色,
     改法:用 getRnTokens(effectiveScheme).xxx 取 token(与 packages/app 主题同源)。
     确属合理保留(逐字沿用共享源的轮播点/HSL 等着色算法)时:
       node scripts/check-adapter-style-parity.mjs --update-baseline 后随本次提交一起 add 基线文件
     自检:node scripts/check-adapter-style-parity.mjs
     紧急跳过(不推荐):HUSKY_SKIP_ADAPTER_STYLE_PARITY=1 git commit ...

```

#### [67] 🔐 凭据经非2xx message 外泄对账(blocking,拦上游令牌/密钥响应体被拼进错误消息)

```

  💡 非 2xx 响应**不经** response-sanitizer(plugins/response-sanitizer.ts:496 直接 return payload),
     所以把上游响应体拼进 error message 等于绕过脱敏把凭据发出去。
     改法:message 只放厂商名 / HTTP 状态码 / RFC 6749 的 error 码等白名单字段,
            需要排查上游返回内容时改为记服务端日志(且日志亦不得含令牌原文)。
     低置信候选(实参名无凭据语义 **且** 响应来源非令牌端点)不拦,仅供人审;确属长期豁免时:
       node scripts/check-credential-leak-in-message.mjs --update-baseline
     自检:node scripts/check-credential-leak-in-message.mjs --self-test
           node --test scripts/tests/check-credential-leak-in-message.test.mjs
     紧急跳过(不推荐,本门是安全门):HUSKY_SKIP_CREDENTIAL_LEAK_IN_MESSAGE=1 git commit ...

```

#### [69] ⌨️ 快捷键声明与归属对账(blocking,声明未绑 / 同键被他功能接走)

```

  💡 两类红点各自对应一种交付事故:
     ① 声明未绑:UI 上写了 `Ctrl+X` 但全仓没有处理器 → 要么把功能实现,要么把标签删掉。
     ② 同键被他功能接走:点选项标的键位其实归注册表里**另一个动作**(按下去干的不是这件事)。
        正解二选一:换标签/删标签;或让本组件独占该键(自有 handler + `e.stopPropagation()`)。
     全量审计与逐条定位:node scripts/check-declared-shortcuts.mjs
     自检:node --test scripts/tests/check-declared-shortcuts.test.mjs
     紧急跳过(不推荐):HUSKY_SKIP_DECLARED_SHORTCUTS=1 git commit ...

```

#### [70] 🈲 硬编码中文基线棘轮(blocking,新增界面文案必须走 t()/语言包)

```

  💡 本次改动在某个文件里**新增了**超过基线额度的硬编码中文行。
     正解:界面文案改用 useTranslations / 共享包的 t 注入(AGENTS.md §19),键落对应命名空间;
     定位:`node scripts/scan-hardcoded-zh.mjs --staged` 或全量 `node scripts/scan-hardcoded-zh.mjs`;
     若确属内容文案(示例数据/营销长文)或判据误报,先自行核实再下调基线:
       node scripts/scan-hardcoded-zh.mjs --update-baseline   # 全量重写,只能有人工确认时跑
     紧急跳过(不推荐):HUSKY_SKIP_HARDCODED_ZH_GUARD=1 git commit ...

```

#### [71] 🈲 计划登记行防丢(blocking,PROJECT_PLAN.md 已入库的 G-/D/P/W 编号行不得整行消失)

```

  💡 成因几乎总是"按内存里那份旧计划文档整文件提交",把别的会话(或更早的自己)
     **已经入库**的登记行按旧基线回写掉了。正解是前向恢复,不是 --no-verify:
       1) 找回原文:`git log --all -S "<提示里的标记>" -- PROJECT_PLAN.md`,
          再 `git show <那个提交>:PROJECT_PLAN.md` 取整行插回原锚点;
       2) 确属 §1 归档 → 原文必须在 .ihui-agent/archive/PROJECT_PLAN_*.md 里(本闸自动放行);
       3) 以后改计划文档一律**提交前现取 HEAD 版本**再插自己的行(AGENTS.md §1 配套)。
     自愈面:.husky/post-commit 第 6 段会在每次提交后扫历史并回捞(--no-verify 也照跑);
     手动执行:`node scripts/check-plan-line-loss.mjs --heal`(只写工作区)或
              `node scripts/check-plan-line-loss.mjs --heal --commit`(顺带前向提交)。
     自检:node scripts/check-plan-line-loss.mjs --self-test
     紧急跳过(不推荐):HUSKY_SKIP_PLAN_LINE_LOSS=1 git commit ...

```

#### [72] 🐳 Dockerfile 构建上下文对账(blocking,钩子脚本必须 COPY 进镜像 + COPY 源必须在提交里)

```

  💡 本机跑不到 docker 时,这里是唯一能发现"镜像构建必挂"的防线:
     - lifecycle-script-not-copied → 根 package.json 的 preinstall/postinstall/prepare 里
       `node <file>` 引用的脚本没被 COPY 进 deps 阶段 ⇒ 在该 Dockerfile 的 RUN pnpm install
       之前加一行 `COPY <file> <目录>/`(只 COPY 单个文件,别 COPY 整个 scripts/,会毁层缓存)
     - copy-source-missing → COPY 的源路径在构建上下文的提交里不存在(拼写/已删/被 .dockerignore 排除)
       注:存在性按 HEAD 提交内容判,工作树里缺文件不算数(并行会话可能删了未暂存)
     自检:node scripts/check-dockerfile-copy-paths.mjs --self-test
           node --test scripts/tests/check-dockerfile-copy-paths.test.mjs
     紧急跳过(不推荐,本门挡的是"部署才炸"的缺陷):HUSKY_SKIP_DOCKERFILE_COPY_GUARD=1 git commit ...

```

#### [73] 🈲 端内绕过 @ihui/api-client 直连后端(blocking,裸 fetch/Taro.request 指向本仓后端即拦,存量走基线只减不增)

```

  💡 AGENTS.md §3:端内(apps/* 与 packages/*,除 api / ai-service / api-client 自身)
     不得用裸 fetch / axios / Taro.request / XMLHttpRequest / sendBeacon / http.request
     直连本仓后端(URL 污点追到后端基址或锚定 /api/ 段即命中)。
     正确做法:走 @ihui/api-client 的 endpoint;确实需要平台差异时,把它做成
     Transport 并在 app 启动处 setTransport 注册(豁免需三条同立:URL 纯透传 +
     从 @ihui/api-client import 契约 + 该导出确实被 setTransport 注册)。
     存量 47 处已进 scripts/direct-backend-calls-baseline.json,迁移后跑
     `node scripts/check-direct-backend-calls.mjs --update-baseline` 收紧(只减不增)。
     自检:node scripts/check-direct-backend-calls.mjs --self-test
           node --test scripts/tests/check-direct-backend-calls.test.mjs
           node scripts/check-direct-backend-calls.mjs --list   # 逐条看基线
     紧急跳过(不推荐):HUSKY_SKIP_DIRECT_BACKEND_CALLS=1 git commit ...

```

#### [74] 🈴 词表键五语言可解析(blocking,静态映射缺语言/小程序离线包过期即红;W5 落点债只告警)

```

  💡 判据:一张"值全是 i18n 键字面量"的静态映射表(如 PERMISSION_TIER_WORD_KEYS /
     _TOOLS / ERROR_CODE_TO_I18N_KEY),每个键必须在 5 语言 × 消费端合并视图里取到值,
     小程序侧还要能在**离线生成包**里取到(忘跑 `pnpm gen:i18n` 就是这一条拦)。
     值是键名本身(静默回显)同样判缺 —— 那正是"界面显示 permissionTier.mode.plan.title"的成因。
     修法:补进 packages/i18n/messages/<shared|端>/<lang>.json 五语言齐(共享层词表优先沉到 shared);
     改完跑 `cd apps/miniapp-taro && pnpm gen:i18n` 重生成离线包。
     W5「落点债」= 某端依赖该包但尚未引用这张表 ⇒ 今天没有界面会回显键名,只报不计失败
     (计入会把门长期红在别人未接入的存量上);该端真接入后由 W3/W4 逐键硬拦。
     自检:node scripts/check-word-table-resolvable.mjs --self-test
           node --test scripts/tests/check-word-table-resolvable.test.mjs
     紧急跳过(不推荐):HUSKY_SKIP_WORD_TABLE_RESOLVABLE=1 git commit ...

```

#### [75] 🗄️  配置表名存在性(blocking,O20d:COMPUTE_ALLOWED_TABLES 必须与 drizzle schema 对齐)

```

  💡 COMPUTE_ALLOWED_TABLES(packages/types/src/capability-catalog.ts)含不存在的表名 ——
     运行时 compute 能力白名单指向空表,真实表改名后清单未跟上。
     修法:改为 packages/database/src/schema 中的真实表名,或从清单删除;
           若属存量已登记幽灵表,见脚本 KNOWN_GHOST_TABLES(条数只减不增,修后删行)。
     自检:node scripts/check-config-table-existence.mjs --self-test
     全量:node scripts/check-config-table-existence.mjs
     紧急跳过(不推荐):HUSKY_SKIP_CONFIG_TABLE_GUARD=1 git commit ...

```

#### [76] 📋  迁移账本带外对象防回潮(warn-only,O20e:journal 序号全集 vs 账本行全集)

```

  💡 drizzle 迁移账本行数与 journal 序号全集不一致 —— 有迁移的数据库对象带外存在
     (对象在库但 __drizzle_migrations 无对应行),或 journal 被裁剪/账本被污染。
     主用途:部署后独立调用 node scripts/check-migration-ledger-drift.mjs --dsn "$DATABASE_URL" [--strict]
     (DSN 来源优先级 --dsn > IHUI_LEDGER_DSN > DATABASE_URL;输出一律脱敏)
     连不上库时默认降级 SKIP(--strict 时按失败);本门 warn 级不阻塞 commit。
     自检:node scripts/check-migration-ledger-drift.mjs --self-test
     紧急跳过(不推荐):HUSKY_SKIP_MIGRATION_LEDGER_GUARD=1 git commit ...

```

#### [77] 📐  圆角单一源头对账(blocking,全 8 端:档位表一致 + 端内取用必须引用档位)

```

  💡 圆角档位唯一真相源 = packages/design-tokens/src/radius.js(xs2/sm4/md6/lg8/xl12/2xl16)。
     RN/内联 style : borderRadius: rnRadius.lg      (import { rnRadius } from '@ihui/design-tokens')
     CSS/SCSS      : border-radius: var(--radius-lg)
     类名          : rounded-lg(禁止 rounded-[24rpx] 这类任意值)
     真圆/头像/胶囊: 用 size/2 几何表达式或等于档位值的档;项目不允许胶囊,也没有豁免标记 —— 写标记本门 B8 判红
     档位漂移      : 改 radius.js 一处后跑 node scripts/check-radius-single-source.mjs --self-test,
                     CSS 端同步 tokens.css 并按端内脚本重跑 design-tokens 同步。
     自检:node scripts/check-radius-single-source.mjs --self-test
     全量:node scripts/check-radius-single-source.mjs
     紧急跳过(不推荐):HUSKY_SKIP_RADIUS_GUARD=1 git commit ...

```

#### [93] 🎨 跨端色值同源对账(blocking,RN rn-tokens ↔ tokens.css 逐位同值 + 品牌档不得端内自立)

```

  💡 三条判据:
     R1 已声明映射逐位同值 —— rn-tokens.ts 的色值必须等于 tokens.css 对应 CSS 变量(亮/暗各自对账)。
     R2 品牌键覆盖 —— rn-tokens 的 brand 命名空间里每个键,必须被某条映射声明,或在 RN_ONLY_BRAND_KEYS
        写明"web 无对应变量"的理由(豁免项若已不存在同样算红,防清单腐烂)。
     R3 悬空引用 —— tokens.brand.<key> / tk.brand.<key> 必须命中已声明键集合(默认判 HEAD,--staged 判索引)。

     品牌 CTA 的唯一写法(AGENTS §4,2026-09-26 回翻):backgroundColor/borderColor = brand.cta,
     其上文字 = brand.ctaForeground(等价 web 的 --color-cta + --color-cta-foreground;
     亮=纯黑底/白字,暗=纯白底/黑字,与 --color-primary 同一明暗行为);**不得再立 brand.ctaFill/ctaText
     这类端内档 —— 2026-09-24 已删,理由:浅色=web primary、深色=brand-accent 的混血档让同一语义三端三个值。**
     要调主按钮观感,改 tokens.css 的 --color-cta(亮)与 .dark --color-cta(暗)一处,三端一起动。

     定位:node scripts/check-cross-end-tokens.mjs --list(看映射与依据)
     自检:node scripts/check-cross-end-tokens.mjs --self-test(8 例正反对照)
     紧急跳过(不推荐):HUSKY_SKIP_CROSS_END_TOKENS=1 git commit ...

```

#### [91] 🌗 主题接线对账(blocking,theme-driven 共享组件必须拿到调用方解析出的主题)

```

  💡 两类红:
     ① 漏传 colorScheme —— 共享组件形参默认值是 'light',漏传等于静默锁死浅色档案;
        正解 `<X colorScheme={resolvedTheme} />`,值须来自 useTheme()/主题 store。
     ② 写死字面量 "light"/"dark" —— 永远错,后果同①(真机实测即此形)。
     跨行元素要连属性一起看;`{...props}` 展开不算传值(实测 115 处即藏在这里)。

     定位:node scripts/check-theme-prop-wiring.mjs --json
     自检:node scripts/check-theme-prop-wiring.mjs --self-test
     收紧基线(人工确认后):node scripts/check-theme-prop-wiring.mjs --update-baseline
     紧急跳过(不推荐):HUSKY_SKIP_THEME_PROP_WIRING=1 git commit ...

```

#### [65] 🧹 整树删除拦截(blocking,索引 vs HEAD 文件存续性)

```

  💡 索引相对 HEAD 大面积缺文件 = 提交会把它们从版本树里删掉。
     先分清成因(禁止用 reset --hard 抢救,那会连带抹掉并发会话的工作区改动):
       ① git ls-files | wc -l  与  git ls-tree -r HEAD | wc -l  差距大 → 索引被清空过
          (`git rm -r --cached .` 后未重加 / lint-staged 中断 / 索引被外部工具打残);
       ② 确属有意的大规模删除 → 影响范围写进提交信息,再 IHUI_ALLOW_MASS_DELETION=1;
       ③ 已经误提交 → 走索引层重建前向修复(见 PROJECT_PLAN 两次先例)。
     单独复验:node scripts/check-mass-deletion.mjs
```

#### [83] 📱 [mobile-rn] 深色模式前景/容器守门(品牌底白字 blocking + 浅色容器 ratchet)

```

  💡 R1(同一 style 块内 brand.DEFAULT / brand.cta 背景 + surface.light/text.primary 字)= 深色下白底白字;
     R4(2026-09-24 补,**兄弟 key** 之间的同一缺陷):底在 `retryBtn`、字在 `retryText` ——
        RN 的 StyleSheet 天然把按钮底和它的文字拆成两个 key,所以 R1 的同块判据
        对这类结构性缺陷全程沉默,PlazaScreen 四个 1.06:1 黑压黑按钮因此 shipped 到真机。
        R4 用**名字**配对(X/XText、XBtn|XButton 与 XBtnText|XButtonText、X/XLabel,顺序无关),
        不用行距滑窗 ⇒ 不会误伤不相干的相邻样式。
     唯一正解(AGENTS §4,2026-09-26 用户定稿回翻):品牌实底 + 其上文字一律成对写 brand.cta +
        **brand.ctaForeground**(= web 的 --color-cta / --color-cta-foreground;亮=纯黑底/白字,暗=纯白底/黑字);
        brand.DEFAULT / --color-primary 只保留墨色、描边、文字色三义,**不再**作大色块底 ——
        它亮=纯黑/暗=纯白,作大色块时两态都是与页面相反的那一极(用户实拍"浅黑深白")。
     ⚠️ brand.ctaFill / ctaText 这对端内自立的混血档已于 2026-09-24 删除,不得作为修法加回来
        —— 悬空引用由守门 93(check-cross-end-tokens)的品牌键判据直接判红。
     R2(surface.light / rgba 白 / bg-white 作容器底)= 深色不切换,改用 tokens.surface.*(深浅皆可)或补 dark: 变体;
     覆盖在媒体/彩色底上的合法浮层被误报时,先核语义再决定改码或 --update-baseline(禁止为过门而调高基线)。
     ⚠️ --update-baseline 会一并重写 R2/R3 基线,共享工作区脏时等于把别人的存量抬上去 —— 先确认可全量口径。
     单独复验:node scripts/check-brand-foreground.mjs;自检:node scripts/check-brand-foreground.mjs --self-test
```

#### [84] 🧬 反回退守门(blocking,暂存内容等于历史版本 = 静默回滚他人改动)

```

  💡 这些文件的暂存内容 = 它某个历史提交的原样,不是新工作,而是把别人的改动写回旧态。
     先分清成因:
       ① 工作区落后 HEAD(converge 不 checkout)→ 先 `git restore --source=HEAD --worktree -- <文件>`,
          再把你的改动重新施加(前提:该文件里没有你自己的未提交内容);
       ② 确属有意回退 → 用 `git revert <commit>` 生成前向提交,或 HUSKY_SKIP_STALE_REVERT_GUARD=1 并在提交信息写明理由;
     单独复验:node scripts/check-stale-revert.mjs --staged
```

#### [78] 🔗 workspace 依赖"声明即已链接 / 链接即有内容 / 命令即可跑"五维对账(blocking,拦本地全绿·部署环恒红·全机门禁停摆)

```

  💡 本门五个维度,先看清红在哪一维 —— 五维的**修复动作并不相同**:
     ① 声明↔链接:某包声明 workspace:* 而 node_modules 里没有 ⇒ 全量 `pnpm install`
        (不带 --filter;AGENTS.md §12e:--filter 安装会剪掉根链接,曾连带让 lint-staged
        消失、守门全废)。本地看不出来:typecheck 走 tsconfig paths,不看 node_modules;
        只有 vite/rollup 真打包时才 failed to resolve import —— 也就是部署环停在旧提交。
     ② 链接↔内容:链接在、目标被**掏空**(.pnpm/<pkg>/node_modules/<dep> 成空目录)。
        existsSync 对这一型仍返回 true ⇒ 旧判据恒绿,而 eslint/tsc 已从 .bin 消失。
        --strict 档另延伸到 .pnpm 传递闭包(实测真仓 10,015 条 / 0 红 / 约 1.4s);
        提交链不深扫 —— 并发 install 半复制态会一次闪出上百条,而本门 blocking,
        恒红门的唯一结局就是各会话 --no-verify ⇒ 其余全部守门一起作废。
     ③ 声明了 bin 但该处无 shim:**只报数**(并发 install 期实测 0↔113 跳),要判红用
        `pnpm check:dep-links:strict`(已串进 check:all)。
     ④ 钩子命令解析不到(lint-staged 必 spawn 的那些)⇒ 每次提交被迫跳门。
     ⑤ shim 在、它指向的**入口文件**没了 ⇒ lint-staged 报 Cannot find module。
     ⚠️ ④⑤ 的修复**不是** `pnpm install`:实测普通安装与 `--force` 都只回
        "Already up to date",shim 一个都不补;生效入口是 `node scripts/repair-node-bin-links.mjs`,
        验收一律实测命令本身(`node_modules/.bin/eslint --version` 与 `tsc --version` 都出版本号),
        只看 node_modules/eslint 在不在等于没测。
     单独复验:node scripts/check-workspace-dep-links.mjs(加 --strict 连 ②深扫 ③一并判红)
     自检:node scripts/check-workspace-dep-links.mjs --self-test(例数以末行「自检 N/N」为准,不写死防漂移)
     紧急跳过(不推荐):HUSKY_SKIP_WORKSPACE_DEP_LINKS=1 git commit ...

```

#### [80] ⏱  热路径 git 只读调用必须带 timeout(blocking,拦无界挂起拖死守门链)

```

  💡 这些 git 只读调用跑在 commit/守护/收敛链上,没有 timeout 就是一次无限挂起。
     修法:options 里加 `timeout: <ms>`(60_000~300_000 已远高于正常耗时)。
     本门**不**对写动词(commit/add/reset/mktree)要求 timeout —— 写操作被中途
     SIGTERM 可能留下 .git/index.lock,反而把一次挂起换成全局阻塞。
     单独复验:node scripts/check-git-read-timeout.mjs
     自检:node scripts/check-git-read-timeout.mjs --self-test(9 例)
     紧急跳过(不推荐):HUSKY_SKIP_GIT_READ_TIMEOUT=1 git commit ...

```

#### [79] 🔀 提交内容含 Git 冲突标记(blocking,成对 <<<<====>>>> 标记一旦入树即拦)

```

  💡 成对的 Git 冲突标记被提交进来了 —— 说明 merge/rebase 没真正归并就 add 了。
     正确做法:
       ① 取一侧真实内容:`git checkout --ours <文件>` 或 `git checkout --theirs <文件>`,
          或按 AGENTS.md §12b 协作收尾流程重新归并后再 add;
       ② **禁止**只手删 `<<<<====>>>>` 三行当作已解决(那会静默丢掉一侧改动);
       ③ 事后核验历史提交:node scripts/check-no-conflict-markers.mjs --rev HEAD。
     单独复现:node scripts/check-no-conflict-markers.mjs --staged
     紧急跳过(不推荐):HUSKY_SKIP_CONFLICT_MARKERS=1 git commit ...

```

#### [81] 📧 品牌邮件通道对账(blocking,拦绕过 email-templates 的纯文本自发通道)

```

  💡 ops 邮件出现了绕过品牌模板层的形态 —— 用户会收到无样式的纯文本邮件,
     而 typecheck/lint 全都不会红(与守门 72/78 同族)。
     修复的唯一正确姿势:发信一律经品牌层 —— PowerShell/CI/脚本改调
     `apps/api/scripts/notify-deploy-failure.ts`(版式由 email-templates.ts 单点决定);
     新增版式在 apps/api/src/services/email-templates.ts 加 render* 函数。
     确属有意的纯文本:命中行或紧邻上行加 `brand-mail-exempt: <原因>`;
     存量红进 scripts/brand-email-channel-baseline.json(只减不增,禁止调高)。
     单独复验:node scripts/check-brand-email-channel.mjs --staged
     自检:node scripts/check-brand-email-channel.mjs --self-test(61 例)
     紧急跳过(不推荐):HUSKY_SKIP_BRAND_MAIL_GUARD=1 git commit ...

```

#### [85] 🧪 测试目录被 .gitignore 静默吞掉对账(blocking,AGENTS §23 配套,补装)

```

  💡 `__tests__/` 被 .gitignore 吞掉了 —— `git status` 完全不显示,写了测试也不会入库。
     修复(二选一):
       ① 推荐:目录改名 tests/(避开 .gitignore 的 `__*` 规则);
       ② 或目录内放 .gitkeep,并确认反忽略两条都到位(`!__tests__/` 放开目录 +
          `!**/__tests__/**` 放开内容 —— 只写后者是无效反忽略,git add 实测仍报 ignored)。
     单独复验:node scripts/check-test-paths.mjs
     自检:node --test scripts/tests/check-test-paths.test.mjs(16 例,含反忽略双向对照)
     紧急跳过(不推荐):HUSKY_SKIP_TEST_PATHS_GUARD=1 git commit ...

```

#### [87] 🈳 语言包文件存在性与合法性对账(blocking,40 项清单,补装)

```

  💡 某个语言包 JSON 缺失 / 解析失败 / 是空对象 / 端内 loader 产物不合法。
     这一类不会让 typecheck 变红(它不看 JSON),但线上表现是**整页取词回显键名**。
     修复:node scripts/i18n-diff.mjs --target=<端> → 翻译 → node scripts/i18n-apply.mjs --target=<端>;
     判不了就 exit 2(根目录注入失效/清单为空),绝不静默报绿。
     单独复验:node scripts/check-i18n-messages-exist.mjs
     自检:node --test scripts/tests/check-i18n-messages-exist.test.mjs(16 例)
     紧急跳过(不推荐):HUSKY_SKIP_I18N_MESSAGES_EXIST=1 git commit ...

```

#### [88] 🧩 ui-react 组件复用对账(blocking,端内自实现 Dialog/Card/Form 提示,补装)

```

  💡 端内重新实现了 @ihui/ui-react 已提供的 Dialog/Card/Form 等组件(AGENTS §3 共享层优先)。
     修复:改用 `@ihui/ui-react` 的对应组件;确属平台特有则在报告里说明并走 
     HUSKY_SKIP_UI_REACT_USAGE=1(需在 commit message 写清理由)。
     单独复验:node scripts/check-ui-react-usage.mjs
     紧急跳过(不推荐):HUSKY_SKIP_UI_REACT_USAGE=1 git commit ...

```

#### [89] 🔌 守门接线层对账(blocking,R1/R2 撒谎 · R4 文档隐形 · R5 撞号 · R7 假依据)

```

  💡 某枚守门的头部(或 AGENTS.md)写着"集成位置/pre-commit/pre-push/必跑",
     但五处权威接线点(guardian-runner 的 script: ∪ scripts/lib/pre-commit-hook.js ∪
     .husky/* ∪ package.json ∪ .github/workflows)全部零命中 ⇒ 这道门形同虚设。
     正解二选一:① 真接线(实测真仓绿才可上 blocking);② 把那句表述改成如实的
     "未接线 + 原因 + 解阻判据"。**禁止为消红往台账塞条目** —— 台账只能救
     "结构上不该由这五处承载"的(生成器/被分发器派生/纯 CLI 工具)。
     R4 文档隐形(2026-09-24 起判红,前置=真仓缺口 48→0 已清零):门已接线但 AGENTS.md
     与 README.md 通篇没点名 ⇒ 后人看不见它,要么重复造一道、要么绕过它。
     文档面口径 = **HEAD ∪ 索引**(不是工作区、也不只 HEAD):所以"同一枚提交里既注册
     新门又补点名行"不会被自己判红,而只躺在工作区没 add 的文档行也不算点名。
     R5 撞号:同一 id 在 runner 里登记了两道门 ⇒ 串 skipEnv 与失败归属,后来者改号。
     ⚠️ 核查接线点时不要只看 .husky/pre-commit:它自 2026-09-22 起只是薄壳,
        真实 pre-commit 逻辑在 scripts/lib/pre-commit-hook.js(只查薄壳会得出相反结论)。
     单独复验:node scripts/check-gate-wiring.mjs
     自检:node scripts/check-gate-wiring.mjs --self-test(例数以末行「自检 N 例」为准,不写死防漂移)
           + node --test scripts/tests/check-gate-wiring.test.mjs
     紧急跳过(不推荐):HUSKY_SKIP_GATE_WIRING=1 git commit ...

```

#### [92] 💽 C 盘污染实地扫描(warn,拦"源码没写死但东西真掉在 C 盘")

```

  💡 列出的都是**本项目产物**落在 C 盘。名字不认识的条目只登记、不定性,
     不要顺手删 —— 先验明身份再决定(清理类任务的铁律)。
     看清单:node scripts/check-c-drive-pollution.mjs
     若报"TEMP 漂移":注册表 TEMP 已指 D 而活进程仍拿 C,新建终端/重启宿主后自愈;
     在此之前,任何走 os.tmpdir() 的脚本都会继续往 C 盘堆夹具。
     紧急跳过(不推荐):HUSKY_SKIP_C_DRIVE_POLLUTION=1 git commit ...

```

#### [90] 📡 SSE 帧端内 dispatch 注册层对账(blocking,补守门 63 覆盖不到的第 3 层)

```

  💡 帧被解析出来 ≠ 端内有人接:各端 streamChat 的回调表里没有这个 case,界面上就是"没这个功能"。
     看补接工单:node scripts/check-sse-dispatch-parity.mjs --report
     补接一帧后:删 scripts/data/sse-dispatch-coverage.json 里对应的 missing[端][帧] 条目,
                并把 baseline[端] 上调到新实测值(降回去就是在倒退)。
     该端确实无处渲染:必须在 missing 里写明**为什么**(空理由同样拦;
                已接却还挂着条目同样拦 —— 登记项不得变成墓志铭)。
     自检:node scripts/check-sse-dispatch-parity.mjs --self-test(8 例)
     紧急跳过(不推荐):HUSKY_SKIP_SSE_DISPATCH_PARITY=1 git commit ...

```

#### [[0-9]+" | sort -u -V | tail -1`。
    id: ] 🧭 errorCode 覆盖率对账(blocking,零"未知错误"兜底,补装)

```

  💡 有 errorCode 没进 `packages/shared/src/chat/error-catalog.ts`,或八类分类缺项 ⇒
     用户会看到笼统的"AI 服务异常"而不是具体原因(对标 Qoder 的码级标题)。
     修复:在该 catalog 补 `{ code: { category, titleKey, actionKey } }` 一条,
     并补 `packages/i18n/messages/*/`(五语言)对应标题/动作键;分类**复用 D92 的
     ViewFailureKind 15 类主干,禁止另起第二张表**(AGENTS §4/D71 硬约束)。
     单独复验:node scripts/check-error-code-coverage.mjs
     自检:node scripts/check-error-code-coverage.mjs --self-test
     紧急跳过(不推荐):HUSKY_SKIP_ERROR_CODE_COVERAGE=1 git commit ...

```

#### [95] 🔏 水印载荷/横幅行语法对账(blocking,零宽必须被注释包裹)

```

  💡 不可见载荷(U+200B/200C/200D/2060 等 Cf 类)出现在**非注释位置**，或 XML 声明不在首行。
     修复(唯一正确姿势):node scripts/watermark.mjs clean <文件> && node scripts/watermark.mjs inject <文件>;
     **禁止**用 sed/批量文本改写"修平"零宽字符(§5c:这类操作会静默损坏载荷，历史上坏过 144 文件 218 处)。
     手工写内容里若要出现零宽，必须放在注释行内。
     单独复验:node scripts/check-watermark-syntax.mjs  (或 --staged)
     取证:npm --test scripts/tests/check-watermark-syntax.test.mjs(20 例)
     紧急跳过(不推荐):HUSKY_SKIP_WATERMARK_SYNTAX=1 git commit ...

```

#### [96] 🏠 §26 家目录改道完整性(warn,机器态与 diff 无关 ⇒ 不拦提交链,回潮即打红字)

```

  💡 登记项又变回**实体目录**(或 junction 目标丢了),意味着工具链正在往 C 盘写。
     一律按 §26 的 junction 机制收口,不得改 Path/env 硬指(那会造"双根分裂"):
       robocopy <src> <D 盘目标> /E  →  逐文件(相对路径+字节)校验  →  源改名
       →  mklink /J <src> <D 盘目标>  →  经 junction 回读一致  →  才删源
     ⚠ robocopy 非零返回码时内容已搬走但**不会**建 junction,路径直接消失 —— 必须回读再补建。
     单独复验:node scripts/check-home-junctions.mjs --json
     自检:node scripts/check-home-junctions.mjs --self-test(6 例,含悬空 junction 反例)
     本门已改 warn(不拦提交),此变量现在的实际作用只剩"连红字警告一起关掉"——
     关掉之后回潮就真的没人看见了,除非有明确理由,否则不要设。

```

#### [97] 📱 顶部状态栏避让单一源头对账(blocking,顶距只有一个注入点)

```

  💡 三类红,改法各一条:
     ① S1 单点被摘 —— 顶距唯一源是 `apps/mobile-rn/App.tsx` 的 <SafeAreaView edges={['top']}>;
        它没了就是全屏叠字回来(真机实测差 34dp)。恢复该单点,不要逐屏补。
     ② S2 第二取值口 —— `StatusBar.currentHeight` 在 iOS 恒为 undefined(⇒ 0)见即红;
        `statusBarHeight` 只拦"布局取值"(paddingTop/top/marginTop/= …),共享层"调用方注入、默认 0"的声明不判红。
     ③ S3 魔法顶距 —— 页头/根容器上 `paddingTop: 24..60` 的字面量就是在蒙状态栏高度;
        删掉它,顶距由单点负责;确属设计需要的顶距请写 `statusbar-exempt: <一句话原因>`(逐行生效,必须带原因)。
     泄压阀 M1:含 JSX <Modal 的文件渲染在导航树外、不继承单点,其顶距命中只报数不判红(--all 逐条列出);
        注释里提 <Modal 不配豁免。
     单独复验:node scripts/check-statusbar-single-source.mjs
     自检:node scripts/check-statusbar-single-source.mjs --self-test(40 例,含 Modal 豁免与逐行豁免阳性对照)
     紧急跳过(不推荐):HUSKY_SKIP_STATUSBAR_SINGLE_SOURCE=1 git commit ...

```

#### [98] 🧩 HEAD 悬空具名导入对账(blocking,import 的名字目标必须真导出)

```

  💡 两类红,改法不同:
     ① D1 具名导入在目标文件里不存在 —— 要么补上那个导出(优先,别删消费者:
        删导入等于把别人正在接的功能摘掉),要么改从真正提供它的模块取。
     ② D2 相对路径解析不到 —— 路径改名/文件被删/大小写不符;目录只能经 `目录/index.*`。
     口径:棘轮锚点 = 该文件 HEAD 自身违规数(存量如实报数不拦),所以本门只拦
        "这次把悬空导入加回来了",不替历史债背红。
     单独复验:node scripts/check-dangling-local-imports.mjs --files <你的文件>
     自检:node scripts/check-dangling-local-imports.mjs --self-test(19 例,含真仓 HEAD 实测)
     紧急跳过(不推荐):HUSKY_SKIP_DANGLING_IMPORTS=1 git commit ...

```

#### [99] 🗑️ 暂存删除存续性对账(blocking,被删文件必须无人引用且无替代路径)

```

  💡 先分清成因,再决定动作(本门只读,不代恢复):
     ① 宿主清理层成批删的? 逐路径找回:`git checkout HEAD -- <path>`(禁止全局 reset --hard)。
     ② 确属有意删除? 把引用方(barrel/import)一并改掉,或登记进 scripts/staged-deletions-allowlist.json(必须写 reason)。
     口径:一律判索引 blob,不判滞后的共享工作树;E1∧E2 只成立一条时仅报数不判红。
     单独复验:node scripts/check-staged-deletions.mjs
     自检:node scripts/check-staged-deletions.mjs --self-test(33 例,正反成对)
     镜像测试:node --test scripts/tests/check-staged-deletions.test.mjs(12 例,含装车证明)
     紧急跳过(不推荐):HUSKY_SKIP_STAGED_DELETIONS=1 git commit ...

```

#### [100] 🧬 合并新增文件存续性对账(blocking,合并不得吞掉任一父提交的独有新增)

```

  💡 这一型不产生冲突、不进 diff 报告,只能靠对账(2026-09-24 实测一枚"按 union 归并"的合并
     吞掉 35 个路径 + 72 个文件回退成旧基线,而其提交信息写着"双方每一行均存活"):
     ① 补回:`git checkout <引入它的提交> -- <path>`,或改用真正的三路合并后重做该合并提交。
     ② 确要删:在合并**之后**单独 `git rm` 并写明理由(那时所有父提交都不含它,本判据放过)。
     口径:默认只判"未进入 origin/main 的合并"——已入库的历史事故不得把后来每次提交钉红
            (那只会逼人紧急跳过,连带废掉全部守门);回看历史用 --limit N 手工取证。
     单独复验:node scripts/check-merge-addition-loss.mjs --rev <合并提交 sha>
     自检:node scripts/check-merge-addition-loss.mjs --self-test(9 例,真临时仓)
     镜像测试:node --test scripts/tests/check-merge-addition-loss.test.mjs(含装车证明)
     紧急跳过(不推荐):HUSKY_SKIP_MERGE_ADDITION_LOSS=1 git commit ...

```

#### [101] 🔐 清单↔锁 specifier 对账(blocking,拦"本地全绿、生产构建必炸"的依赖真值)

```

  💡 package.json 声明与 pnpm-lock.yaml 的 importer specifier 不一致时,pnpm 是
     **整段跳过该包的链接步骤**(不报错、不改锁),本地 node_modules 早就装好 ⇒ typecheck/
     lint/单测/其余守门全绿,直到 bundler 报 Module not found 把生产构建打死。
     立因实例(2026-09-24):apps/web 写 "xlsx": "^0.18.5" 而锁记 npm:@e965/xlsx@^0.20.3,
     表现是"97 个声明依赖精确缺 3 条",`pnpm install` 与 `pnpm install --force` 都只回
     "Already up to date" —— 修它的路径不存在,必须把两边对齐。
     改法(二选一,不得两边都改):① 清单向锁对齐(改 package.json 取锁里的值,不动 lock);
     ② 锁向清单对齐(全量 `pnpm install` 重算 lock —— 禁 --filter,见 §12e)。
     口径:--staged 判索引 blob、全量判 HEAD blob(与 70/77/83/98/99 同取向)——
            盘上随后改对不算修好,提交进去的仍是索引那一份;人工排查用 --worktree。
     豁免不静默:因 overrides 放过 N 条、因 peer 记账形态放过 M 条都会如实打印。
     单独复验:node scripts/check-lock-manifest-consistency.mjs --staged
     自检:node scripts/check-lock-manifest-consistency.mjs --self-test(例数以命令末行现读为准,含 R6 段位置成对正反例与三面判定端到端)
     镜像测试:node --test scripts/tests/check-lock-manifest-consistency.test.mjs(例数同上,含真历史 blob 阳性对照与 runner 装车证明)
     紧急跳过(不推荐):HUSKY_SKIP_LOCK_MANIFEST_GUARD=1 git commit ...

```

#### [102] 🧷 文本箭头当图标 / 箭头字号倒挂对账(blocking,入口箭头必须是矢量且不小于标签)

```

  💡 三类红,改法各一条:
     ① GA1 整格字符箭头(› » → 》 或 {'>'})当 chevron 图标 —— 换矢量:RN/共享包用 MoreLink
        (lucide-react-native ChevronRight)、web 用 ViewMoreLink、小程序用 LineIcon
        name="chevron-right"(icons.ts 已含,零新素材)。
     ② GA2 「更多」类标签与同词干 *Arrow* 样式配对后**箭头字号 > 标签字号** —— 两者必须同一
        光学尺寸(RN/web 12px、小程序 24rpx);单位不同不判红,只如实计入 undetermined。
     ③ S0 三端唯一实现被摘线或无人 import —— 补回引用,别把共享实现删了留端内自拼。
     口径:全量判 HEAD blob、--staged 判索引;棘轮锚点 = 该文件 HEAD 自身违规数
            (行尾字符箭头存量 70 处只报数不拦,免得逼人 --no-verify 连带废掉全部门)。
     行内豁免:glyph-arrow-exempt: <一句话原因>(须带原因,逐行生效)。
     单独复验:node scripts/check-glyph-arrow-icon.mjs --staged
     自检:node scripts/check-glyph-arrow-icon.mjs --self-test(例数以其末行现读为准,不在本文钉数;含阳性对照与棘轮四向)
     镜像测试:node --test scripts/tests/check-glyph-arrow-icon.test.mjs(13 例,含装车证明)
     紧急跳过(不推荐):HUSKY_SKIP_GLYPH_ARROW_ICON=1 git commit ...

```

#### [103] 🏛️ 架构契约对账(blocking,从 config/architecture-policy.yaml 的声明反查违规)

```

  💡 本门不新增"风格洁癖",它只问一句:代码里真实存在的 import,和策略表声明的
     模块契约是不是同一件事。四类红各自对应一个会在生产上炸的形态:
     T1 表与现实脱节 —— 模块改名/目录搬走而 config/architecture-policy.yaml 没跟上;
        表一过期,所有依赖它的判断都在对着空气打分(本仓"清单腐烂"同一类)。
     C1 单文件行上限 —— 阈值取 6000,高于 HEAD 实测最大文件 5258 行,所以它只会咬
        "再写一个巨型文件"这件事,不会把既有存量变成人人绕过的红。
     D1/D2 依赖方向 —— 包 import 端、或 requires 里没声明就 import:
        今天不红是因为该模块 managed:false(只报数);翻 true 前先用
        `--managed-trial <id>` 看条数,别拿提交去试。
     D3 深导入 —— 绕过 public_entrypoints 直接摸别的包/src/内部:
        它让"改一个内部文件"变成跨端事故,是端内重复实现的入口。
     渐进收口是设计前提,**不得为了消红去改阈值或把不该对外的模块标成 exported**;
     要放行就地加 `// arch-exempt: <原因>`(必须带原因,缺原因只计数不放行)。
     口径:--staged 判索引 blob、全量判 HEAD blob;策略表自身也**按档定向取材**
            (--staged 索引优先、全量 HEAD 优先,再降级到工作树并大声提示)—— 否则改表的提交不被本门审。
     单独复验:node scripts/check-architecture-policy.mjs --staged
     自检:node scripts/check-architecture-policy.mjs --self-test(51 例,成对正反例)
     镜像测试:node --test scripts/tests/check-architecture-policy.test.mjs(含装车证明)
     紧急跳过(不推荐):HUSKY_SKIP_ARCH_POLICY=1 git commit ...

```

#### [104] 🧬 prod-bundle 影子副本对账(blocking,入库源 ↔ 生产实际执行的那份逐字节等值)

```

  💡 本门钉的是"生产到底在跑哪份代码":deploy/prod-bundle/ 整目录被 .gitignore 忽略,
     里面的运维脚本可以完全没有入库源(对跟踪文件做的 grep 对它零覆盖)。AGENTS §5e 早就
     写了"落进 prod-bundle 的脚本必须同时落一份入库源",本门是那句话说的那把尺子。
     四类红,各自对应一种会静默失真的形态:
     S0 入库源不存在 —— 登记表里有配对、仓内却没有源 ⇒ 对账无从成立(这一侧在所有机器上
        都该在,所以它不是"未判定",是真缺陷)。
     S1 入库源未被跟踪 —— 源写了但没入库,等于仍只有运行副本那一份真相。
     S2 运行副本竟在版本树里 —— 登记表过期,删掉这条登记即可(它已不需要本门)。
     S3 影子漂移 —— 两侧 sha1 不等 ⇒ 线上行为与仓内代码无关,这是最贵的一类。
     未判定(运行副本不在本机)不判红,但会在输出里点名:那是非部署机 / CI / 干净检出,
     提交者结构上无法满足它;拿它判红等于造一台恒红的尺子。
     同步方向:生产执行的是被忽略的那一份,改任何一侧都要把另一侧改成逐字节相同。
     单独复验:node scripts/check-prod-bundle-shadow.mjs
     自检:node scripts/check-prod-bundle-shadow.mjs --self-test(连跑两次都须 exit 0)
     镜像测试:node --test scripts/tests/check-prod-bundle-shadow.test.mjs(含装车证明)
     紧急跳过(不推荐):HUSKY_SKIP_PROD_BUNDLE_SHADOW=1 git commit ...

```

#### [105] 🧩 小程序+四端派生产物对账(blocking;离线语言包/图标/位图/四端 AI 可导航路由是否落后于源;孤儿与动态路径只报数不判红)

```

  💡 判据六组:
     R1 漏生成/引用断链 —— 源码引用的产物文件面上查无 ⇒ 报出引用方;
     R2 孤儿/死资源 —— 产物目录里没有任何静态引用(默认只报数,--strict 判红;删文件属 §7 须人工确认);
     G3 图标词表与 svg 目录的对账(图标源已外置,77/78 键无同名 svg 是**既有事实**,本条永不判红);
     I2 LineIcon 调用点「值→键」(G-415/A8):name 值位字面量不在 icons.ts 注册表 ⇒ 判红(各面同权);
        逃逸写法(as 断言/尾部 !)按该文件 HEAD 存量套棘轮,只在 --staged 拦新增,HEAD/worktree 只报数;
     G5/U1 四端 ui-routes 自述钉(G-816040):web/mobile-rn/miniapp-taro/extension 的 ui-routes.generated.ts;
        钉 ≠ 现算输入哈希 ⇒ 陈旧判红;钉 absent/malformed ⇒ 未判定(只报数);钉 matched ⇒ 名集对账,
        源侧派生集与产物解析集不等 ⇒ U1 判红逐条报名(RN 不镜像派生,只判钉);
     动态拼接的资源路径一律计入「判不了但如实数」,绝不静默当零违规。

     重新生成:node apps/miniapp-taro/scripts/gen-line-icons.mjs / gen-tabbar-icons.mjs
                node scripts/gen-taro-lucide-icons.mjs <name>;离线语言包 pnpm --filter @ihui/miniapp-taro gen:i18n
                四端 ui-routes:node apps/web/scripts/generate-ui-routes.mjs / apps/mobile-rn/scripts/generate-ui-routes.mjs
                / apps/miniapp-taro/scripts/generate-ui-routes.mjs / apps/extension/scripts/generate-ext-ui-routes.mjs
     自检:node scripts/check-miniapp-generated.mjs --self-test(32 例含成对正反)
     定位:node scripts/check-miniapp-generated.mjs --group tabbar|icons|i18n|assets|ui-routes 单组排查

```

#### [106] 🧩 extension 注入层色值同源(blocking,可派生档逐位等值 + 分歧必须登记且不得腐烂)

```

  💡 三条判据:
     D1 可派生档必须与 tokens.css 逐位等值(含 hsl/rgb/hex 归一,复用门 93 的 colorsAgree);
     D2 不等值者必须已被 EXTENSION_ONLY_KEYS(源头无此档)或 DECLARED_DIVERGENCE(同名档不同语义
        且写明依据)登记;两者都没有 ⇒ 红;
     D3 反向腐烂:登记了却已不存在、登记的分歧其实已相等、值被改而登记没跟着改 ⇒ 都红。

     修复(不要手改副本):node scripts/sync-extension-tokens.mjs   原位写回派生档
     查看台账:node scripts/sync-extension-tokens.mjs --list
     自检:node scripts/sync-extension-tokens.mjs --self-test(36 条含成对正反)
     紧急跳过(不推荐):HUSKY_SKIP_EXTENSION_TOKENS=1 git commit ...

```

#### [107] 🧾 第三方来源台账对账(blocking,嵌入/复制/覆盖三本账 + 机制来源账:roots 必须真实存在、盘上 vendored 件必须有条目、许可原文必须能自证)

```

  💡 本门把"哪些内容不是我们写的"变成机器可查的事实,有四类红:
     P1 roots 指向不存在的路径 —— 登记了但实物没了,等于台账在对空气记账。
     P2 盘上有 vendored 目录或第三方归属头,台账里却没有条目 —— 这是"来路不可考"的形状。
     P3 已登记条目的内容 hash 漂移 —— 登过之后又被人改过而没改记录。
     P4 revision 不可考却没有显式 null + 说明 —— "不知道"必须被写成不知道。
     判据取材与全仓主流一致:全量判 HEAD blob、--staged 判索引 blob,取不到判"无法判定"。
     为什么值得挂 blocking:本仓正在"吸收外部机制"的线上跑的正是这条纪律 ——
     台账是把"只吸收机制、未搬运代码"从一句主张变成可审计事实的唯一载体。
     单独复验:node scripts/provenance-ledger.mjs --check
     自检:node scripts/provenance-ledger.mjs --self-test(27 例,连跑两次须同结论)
     镜像测试:node --test scripts/tests/provenance-ledger.test.mjs
     紧急跳过(不推荐):HUSKY_SKIP_PROVENANCE_LEDGER=1 git commit ...

```

#### [108] ⏳ 豁免到期账(blocking,12 类行内豁免必须带到期日;到期未销账即红,存量进基线只报数)

```

  💡 本门钉的是"豁免只有出生、没有死亡":实测全仓 12 族 / 252 处行内豁免,
     带真到期日的是 **0 处**(规格当初量的"1 处带日期"是散文里的引用,不算)。
     三条判据:E1 新增豁免不带到期日 ⇒ 红;E2 到期日已过仍在生效 ⇒ 红;E3 lint 抑制只报数。
     为什么不当场全红:存量 252 处全部进 scripts/exemption-expiry-baseline.json 只报数,
     E1 的锚点是"该文件该族在 HEAD 自身的存量数"(棘轮,照 77/83/98 口径),
     且 grandfatherUntil 之前不追存量 —— 与改动无关的 blocking 红只会逼人 --no-verify,
     连带废掉全部守门(本仓记过最多次的反面教训)。
     出路只有三条,都在红字里点名:持有者续租 / 完成后翻勾销账 / 显式让渡。
     禁止用 HUSKY_SKIP_* 当"收口手段" —— 那正是本门要拦的那件事。
     单独复验:node scripts/check-exemption-expiry.mjs --all(看存量账) / --staged(看本票新增)
     自检:node scripts/check-exemption-expiry.mjs --self-test(36 例含成对正反)
     镜像测试:node --test scripts/tests/check-exemption-expiry.test.mjs
     紧急跳过(不推荐):HUSKY_SKIP_EXEMPTION_EXPIRY=1 git commit ...

```

#### [109] 🔒 任务认领租约对账(blocking,（进行中）必须带日期与持有者;过期未清账即红,存量裸标记只报数)

```

  💡 本门钉的是"认领是租约,不是文本标记":AGENTS §1 让每个 agent 开工前给任务加
     （进行中）、派单前先扫进行中项 —— 但那个标记过去**没有持有者、没有时间戳、不判年龄**,
     于是可达的失效形态是:agent 死了,标记永久留在 HEAD 里,下一个会话按 §1 扫描
     要么永远看不见那件活,要么把它当"别人正在做"而按住不做(本仓记录里已反复出现)。
     三条判据:CL1 带日期的进行中行年龄 > 阈值(默认 72h) ⇒ 红并点名行号+持有者;
     CL2 写了 @日期 却没写 /持有者 ⇒ 红(半个租约比没有租约更危险,它看起来像被管过);
     CL3 同一行同时出现"进行中"与 [x] ⇒ 红(协议自相矛盾 = 释放失败的现场)。
     **存量向后兼容是第一位**:裸（进行中）与旧的"翻勾未摘牌"行一律只计数不判红,
     否则本门上线当天就是一台恒红门(⇒ 逼人 --no-verify ⇒ 全部守门作废)。
     到期只判红、只点名,**本门绝不自动摘除任何人的认领**(摘别人的认领属越权,AGENTS §16)。
     新格式:`- [ ]（进行中@YYYY-MM-DD/持有者短名）`。出路三条:续租 / 完成翻勾并摘牌 / 显式让渡。
     单独复验:node scripts/check-task-claims.mjs --check-gate(现值须 exit 0)
     自检:node scripts/check-task-claims.mjs --self-test(11 例) + 含全角括号可选性反证
     镜像测试:node --test scripts/tests/check-task-claims.test.mjs(16 例,四对正反 + 存量恒绿不变量)
     紧急跳过(不推荐):HUSKY_SKIP_TASK_CLAIM_LEASE=1 git commit ...

```

#### [110] 📦 产物预算对账(warn,交付出去的产物第一次有上限表:主包口径 / 悬空 sourceMappingURL 引用)

```

  💡 本门判的是**磁盘上的构建产物**,与工作树/HEAD 无关 —— 全仓 130+ 道门过去
     没有一道量过我们真正交付出去的东西(AGENTS 末段自己承认:"同源门全部只核源码,
     没有一道看产物")。小程序主包实测已贴到 2,054,797 B / 上限 2,097,152 B,
     余量 42,355 B(97.98%),而这个数此前只人工写在计划文档里,一次无关的 UI 提交
     就能吃掉它而全程绿灯(构建本身 exit 0,炸的是上传微信那一步)。
     为什么挂 warn 而不是 blocking:产物目录在不在本机是**机器状态**,提交者结构上
     满足不了 ⇒ blocking 就是恒红门(§12e 同型)。判红问责放在 CI(build 之后必有产物)。
     缺产物不判红也不静默绿:exit 0 + 逐条打印"未判定:<原因>"并点名重建命令。
     主包口径:分包与独立分包不得计入主包(镜像测试 C5/C5b 用同字节换个目录做正反对照)。
     单独复验:node scripts/check-artifact-budget.mjs --target miniapp
     自检:node scripts/check-artifact-budget.mjs --self-test(32 条断言,连跑两次须同结论)
     镜像测试:node --test scripts/tests/check-artifact-budget.test.mjs(15 例,含"接了提交链就必须同时有 CI 调用点"的防退化断言)

```

#### [111] 🧬 工具契约声明对账(blocking,注册进工具面却没有契约声明即红;棘轮锚点=该文件 HEAD 自身违规数)

```

  💡 本门钉的是 A13 第一阶段立下的规矩:一次可被模型调用的能力,必须在实现旁边有一份
     **契约声明**(副作用范围 / 权限 / 结果预算),因为下游三个消费面(发给 provider 的
     function parameters、运行时入参校验、批准与预算判定)现在都从**同一份描述**投影而来 ——
     没有声明就不是"少一条元数据",而是那一格重新变成"三个面各写各的",正是本仓 8 道
     "声明↔实现对账"门存在的理由(打地鼠)。**新增工具必须带契约**;存量 104 个走棘轮,
     锚点取该文件在 HEAD 自身的违规数,所以老文件不会被别人欠的债钉红。
     注意**缺省语义这一层本门故意不管**:缺省仍按既有 dangerLevel 走。翻成"缺省即不可信"
     是第二阶段,前置是把 `--flip-audit` 点名的那批工具逐个补档 —— 否则用户侧表现是
     "昨天能跑今天全要批准",那不是收紧安全而是制造事故。
     单独复验:node scripts/check-tool-contract-declared.mjs
     存量与二阶段输入:node scripts/check-tool-contract-declared.mjs --flip-audit
     自检:node scripts/check-tool-contract-declared.mjs --self-test(11 条,连跑两次须同结论)
     镜像测试:node --test scripts/tests/check-tool-contract-declared.test.mjs(9 例)
     紧急跳过(不推荐):HUSKY_SKIP_TOOL_CONTRACT_DECLARED=1 git commit ...

```

#### [112] 📐 压缩分母对账(blocking,阈值分母必须经 effectiveContextWindow;存量 8 文件/12 处进棘轮)

```

  💡 本门钉的是 A30 那条实测缺口:provider 的 context window 是 **input 与 output 共享**的同一个窗口,
     所以"什么时候该压缩"的分母必须**先扣掉本轮要留给输出的预留**,否则阈值算的是"占满整个共享窗口
     的 88%",而同一窗口里模型还要生成回复 —— 故障形态是**越接近上限越容易炸,而现象写成"压缩判过了
     还是 400/context overflow",极难归因到分母**。立门前实测 `grep -rniE "outputReserve|
     effectiveContextWindow" apps/cli/src packages/context-compaction/src` = 0 命中(先确认没有
     等价实现,再确认没有这个名字,两步都要跑)。
     唯一出口:`packages/context-compaction` 的 `effectiveContextWindow({contextWindow, maxOutputTokens,
     buffer, enabled})`,预留封顶 `MAX_OUTPUT_RESERVE_TOKENS`;凡"token 数 ÷ contextLimit/contextWindow"
     而该分母未经此出口 ⇒ 红。**不得新建子路径导出** —— 架构契约表没登记 `packages/context-compaction`
     的子入口,深导入会被守门 103 判 D3 红(本仓踩过)。
     行为后果如实登记:分母只会变小 ⇒ **压缩更早触发**,用户可感知;回退有两条路(构造参数
     `outputReserveEnabled:false` 或环境变量 `IHUI_COMPACTION_OUTPUT_RESERVE=0`)。
     存量 8 文件/12 处已冻进 `scripts/compaction-denominator-baseline.json`(只减不增棘轮),
     其中 **api 端 `/chat/stream` 的溢出面尚未收口** —— 那是本票如实留下的账,不是"已修完"。
     单独复验:node scripts/check-compaction-denominator.mjs
     自检:node scripts/check-compaction-denominator.mjs --self-test(15 条,含成对正反例与
     "枚举到 0 个文件必须判无法判定、不得记绿"的反向对照)
     镜像测试:node --test scripts/tests/check-compaction-denominator.test.mjs

```

#### [113] 🪪 路由身份键对账(blocking,路由身份不得进模型可见 schema;键清单唯一源在 @ihui/types)

```

  💡 本门钉的是一条结构约束:**路由身份(sessionId / userId / instanceId / conversationId …)
     一律由宿主在 closure / ctx 里绑定,绝不得出现在模型可见的参数集合里。** 一旦进了 schema,
     模型就能自己填一个**别人的**值,把结果投给别的会话 / 别的宿主实例 —— 那是越权,不是参数校验问题
     (同族先例:O8「只开放功能不开放数据」、O19 端点级属主鉴权、agent-control 的"投递定址不得被覆盖")。
     键清单的**唯一源**是 packages/types/src/tool-contract.ts 的 ROUTING_IDENTITY_KEYS(门与类型层共用一份,
     禁止在别处抄第二份;该常量被摘线本门即 exit 2 并点名)。刻意只收"填错会把结果送到别人那里"的键,
     messageId / toolCallId / taskId / fileId 属**内容引用**,纳进来会误拦正当用法(镜像测试反向钉死)。
     存量 16 处已冻进 scripts/tool-arg-routing-identity-baseline.json(每文件每键、只减不增):
     其中 memory.ts 的 user_id×4 / session_id×1 是**待清偿的债**(服务端本就从令牌取 userId,该必填项
     模型无从满足),debug.ts ×7 / terminal.ts ×4 是 terminal_open / debug_launch 返回的**工具自句柄**,
     若要长期保留必须在 ROUTING_IDENTITY_KEYS 的注释里**正式登记排除理由**,不得用行内豁免遮掉
     (遮掉等于把判据改成"没人违规")。
     豁免写法:行内标记(族名 routing-identity-exempt)后接一句话原因与 until YYYY-MM-DD 到期日;
     **不带到期日的标记本门直接不认**(与守门 108 同一条口径,免得本门成为永久豁免的生产者)。
     单独复验:node scripts/check-tool-arg-routing-identity.mjs
     自检:node scripts/check-tool-arg-routing-identity.mjs --self-test(23 例,含成对正反例 +
     "枚举到 0 个注册不得记绿"与"清单源被摘线必须 exit 2"两条反向对照)
     镜像测试:node --test scripts/tests/check-tool-arg-routing-identity.test.mjs(7 例)

```

#### [114] 🧪 测试收集存续性对账(warn,收集失败套件必须为 0;断言失败不混计)

```

  💡 本门钉的是**最容易被当成"测试在跑"的那一类静默失败**:套件在收集阶段就炸(transform /
     import 解析 / vi.mock 缺导出),vitest 只报"Test Files N failed",而**那些文件里的每一条
     it 声明都没有执行过**。判据只认 "Failed Suites" 区块与 `FAIL <file> [ <file> ]` 的套件级
     形态 —— 文件级计数两种故障都会红,拿它当判据就是把"收集失败"和"断言失败"混计。
     三条不可动摇的口径:① 零测试文件(空扫)判红,绝不当绿;② 断言失败只报数不计红;③ 取不到
     结论(vitest 入口不可解析 / 超时 / 无汇总行 / 该端 test 入口不是 vitest)一律"未判定"并
     写明原因 —— 未判定 **不等于** 达标。
     只接 JS 系:pytest 的收集期故障是另一套版式(`ERROR tests/x.py` + `no tests ran`),照抄判据
     必然空转;非 vitest 入口的端会被如实记成"未判定",不冒绿。
     单独复验:node scripts/check-test-collection-runs.mjs(默认只跑 apps/mobile-rn)
     扩端:node scripts/check-test-collection-runs.mjs --end apps/web --strict
     自检:node scripts/check-test-collection-runs.mjs --self-test(17 例,临时目录造
     "收集失败 / 全绿 / 空扫 / 断言失败 / 入口不可解析 / 超时 / 无汇总行"七态,正反成对)
     镜像测试:node --test scripts/tests/check-test-collection-runs.test.mjs(含装车证明 +
     "未注册时 runner 清单里查不到本门、注册后必须被判定"的方向性对照)
     紧急跳过:HUSKY_SKIP_TEST_COLLECTION=1 git commit ...(本门 warn,通常不需要)

```

#### [115] 🧪 入参校验装车对账(blocking,校验器必须有生产调用方 + 影子档在位且默认不是 enforce)

```

  💡 本门钉的是 A36 查出来的事实:`apps/cli/src/tools/argument-validator.ts` 写得挺全
     (field / expected / actual、嵌套 items[0] 路径都有),但**生产面零调用方** —— grep 只命中它
     自己的定义行与注释。后果不是"少一道校验"这么轻:`required` 只被用来生成提示文案和投给 provider
     的 schema,没有任何一处按它拒绝或纠正入参 ⇒ 模型少传/传错类型时,同一类错误在 104 枚工具里
     有 104 种表现,而 A13 那句"运行时怎么校验与模型被告知怎么填同源"只有后半句成立。
     只判两条:① `validateToolArguments(` 必须有非测试调用方(**注释里的提及不算** —— 那正是
     "看起来有、其实没装车"这一型);② 模式开关必须在位、默认必须是 off、且 shadow 档存在
     (**enforce 档已实现,但默认档必须是 off**:未被执行过的描述一旦变成默认拒绝,就是运行时版恒红事故)。
     接线顺序登记在 PROJECT_PLAN 第八波:① 影子模式(本门钉住的这层)→ ② 用影子数据把描述修对
     → ③ 才允许 enforce 默认开,并把 {字段路径, 期望, 实得} 逐条回灌模型。
     覆盖面缺口(如实登记,不得读成"全链已覆盖"):hubEnabled 分支在拿到 Tool 对象之前就 return,
     那条路径下影子不生效。
     单独复验:node scripts/check-tool-arg-validation-wired.mjs
     自检:node scripts/check-tool-arg-validation-wired.mjs --self-test(14 条,含成对正反例 +
     "摘掉调用方必红"与"空枚举不得记绿"两条反向对照)
     镜像测试:node --test scripts/tests/check-tool-arg-validation-wired.test.mjs(5 例,含装车前置)

```

#### [116] 🌐 出站事实对账(blocking,厂商出站必须走带回 egress 的包装出口;绕档进棘轮基线)

```

  💡 本门钉的是 A34:一趟请求**实际**走没走代理、配置从哪来、有没有命中 NO_PROXY、
     用没用自定义 CA —— 这些必须是**响应上的返回值**,不是日志行。AGENTS §5b 连着记过
     "git 网络时通时不通 / 钩子进程不继承 shell env / 服务身份与交互账户的 safe.directory
     互不相通",每一次都靠人肉 `git config --local` 现读,因为没有一次调用把事实带回来。
     唯一包装出口:`apps/api/src/utils/proxy-dispatcher.ts` 的 `proxiedFetch`(响应上带
     不可枚举的 egress 字段,用 `readEgressFacts(res)` 取);厂商域名清单**不硬编码**,
     由 `VENDORS.baseUrl` + `DEFAULT_PROXY_DOMAINS` 两张仓库内真表推导(推导失败 ⇒ exit 2,不记绿)。
     判一条:对外发往第三方/厂商域名的请求出口未走包装 ⇒ 红;存量进 `scripts/egress-facts-baseline.json`
     每文件棘轮(只减不增)。覆盖面如实登记:`apps/api/src` + `apps/cli/src/provider`,
     `packages/api-client` 打的是自家后端**不在面内**;Python 侧(ai-service)同类出口只登记未纳面。
     未做的那半同样如实登记:**错误分流**("被策略拦" vs "网络错"两个码)本票没做 ——
     本仓 TS 侧当前没有任何出口会在传输前拒发请求,造两个码就是一台永远不响的门。
     单独复验:node scripts/check-egress-facts.mjs
     自检:node scripts/check-egress-facts.mjs --self-test(28 条,含成对正反例 + 空枚举/空表必判死)
     镜像测试:node --test scripts/tests/check-egress-facts.test.mjs(5 例,含真表真挂的装车证明)

```

#### [117] 🔐 记忆端点属主绑定对账(blocking,收 user_id 的端点必须与令牌主体对齐;存量已归零⇒零容忍)

```

  💡 本门钉的是**"认证不等于授权"那一层**:匿名进不来(不在 PUBLIC_PATHS)不代表安全,
     任何已登录用户填别人的 UUID 就能读/改/删别人的记忆 —— 判洞要问的是"有没有把请求里的
     id 与令牌里的 id 比对",而不是"有没有全局中间件"。
     两条语法锚点必须同时认:user_id 的 Query(...) 声明 与 Pydantic 的 Field(...) 声明 ——
     只认 Query 会让整类 POST 端点隐身;对齐出口只写在注释里不算(自称已拆实际没拆那一型)。
     修法(两种都会让本门归零,选型看 v1 对外语义):(a) 端点加 principal: str =
     Depends(require_request_user_id) 后只用 principal,忽略客户端值;(b) 保留入参做兼容
     校验,不等即 403。仓里现成出口 = app/core/jwt_auth.py 的 require_request_user_id
     (带 DEV_ANONYMOUS_PRINCIPAL 开发降级,以免 ASGI in-process 的既有测试整片 401)。
     单独复验:node scripts/check-memory-owner-binding.mjs(报清单与透传面)
     问责档:node scripts/check-memory-owner-binding.mjs --strict(未对齐即 exit 1)
     自检:node scripts/check-memory-owner-binding.mjs --self-test(17 例,正反成对)
     镜像测试:node --test scripts/tests/check-memory-owner-binding.test.mjs(14 例,含
     "本门未注册时不得被判定为已装车"的方向性对照)
     紧急跳过:HUSKY_SKIP_MEMORY_OWNER_BINDING=1 git commit ...(本门 blocking,跳过即把
一个跨用户读改删的面提交进 HEAD,必须在提交信息里写明理由与清偿票)

```

#### [132] 🔧 工具族注册对账(blocking,存量已归零:tools/** 里导出的一族工具必须能在生产面找到把它挂进注册表的调用点 —— "造好没装车"那一型)

```

  💡 本门补的是守门「运行时注册表投影对账」看不见的那一格:那道门的输入已经是**注册之后**
     的集合,所以"整族从未注册"在它眼里根本不存在(没注册 ⇒ 两侧都没有 ⇒ 一致)。
     立因实测:`apps/cli/src/tools/debug.ts` 导出 10 枚 DAP 工具(DEBUG_TOOLS),生产面
     **零 importer**(只命中自身定义与两个测试文件)⇒ 那句"30 分钟自动清理"与整族能力
     对模型不可达,而 typecheck / lint / 其余各门一路报绿。
     三态是这门的全部价值:命中 / 未注册(违规) / **未判定**(动态拼接参数、`export *`
     barrel、命名空间转发、别处同名本地符号 —— 承认看不见,既不记绿也不判红)。
     **定级 warn 是设计前提**:存量(DEBUG_TOOLS)未注册,当场 blocking 就是与任何提交
     都无关的恒红门 ⇒ 逼人 --no-verify 连带废掉全部守门(§12e 同型)。牙齿在**棘轮**:
     锚点 = 该族在 HEAD 自身的状态,只拦"新出现的零注册族"与"本次把注册点摘掉"。
     ① 看清单:node scripts/check-tool-family-registered.mjs(全量,HEAD 面)
     ② 问责档:pnpm check:tool-family(带 --strict,存量也判红)
     ③ 修法只有两条:在注册面把该族挂上,或按 §7 明确移除 —— **不得为消红去削判据**;
     ④ 是否向模型暴露某族(尤其 dangerous 工具)属产品决策,归用户/主会话(§24)。
     自检:node scripts/check-tool-family-registered.mjs --self-test(22 条,正反成对,
     含"摘掉注册点必红"与"间接注册只报数"两条对照)
     镜像测试:node --test scripts/tests/check-tool-family-registered.test.mjs
     紧急跳过(本门 warn,通常不需要):HUSKY_SKIP_TOOL_FAMILY_REGISTERED=1 git commit ...

```

#### [133] 🈶 语言包语种内容对账(blocking,L1 跨族/块级只报数 + L2 同名自套一层按 HEAD 锚点棘轮 —— parity 绿不等于语种对)

```

  💡 本门补的是既有五道 i18n 门**结构上看不见**的那一维:它们判"键集"与"有没有中文残留",
     所以"某一块整体被落成另一门语言"一路绿灯。立因实测(2026-09-26 同日两次):
     ① `web/ja :: aiChat.org` 整块是繁体中文、`web/zh-TW :: aiChat.org` 整块是谚文,
     ② `web/ko :: chat.exportMenu.exportPdf` 是日文假名(三向轮转),
     ③ `web/*:: aiChat.toast.orgSaved` 被机械写成 `{orgSaved:{orgSaved:"…"}}` 自套一层,
        `t()` 取到对象 ⇒ 功能成功但提示永远不响。三型当时五道门全绿。
     判据按**码位族**(han/hira/kata/hangul/latin,区间两两不相交由 lib 机器证明),
     汉字族内部简繁**刻意不判**(日本新字体与中国简化字同码位),判不了就计"未判定"并点名。
     ① 看清单:node scripts/check-i18n-locale-content-language.mjs --all
     ② 问责档:pnpm check:i18n-locale-content-language(带 --strict,L1 存量也判红)
     ③ 修法只有"把值改回这门语言";**不得**删键、改键名凑数、把值置空或改英文占位过门;
     ④ 改完必走 §19 流水线(i18n-diff → apply → check-i18n-keys → scan-i18n-zh-residue),
        并按守门 105 重生成小程序离线包,否则源改了产物没跟,到端还是旧词。
     自检:node scripts/check-i18n-locale-content-language.mjs --self-test(例数以末行为准)
     镜像测试:node --test scripts/tests/check-i18n-locale-content-language.test.mjs
     紧急跳过(不推荐):HUSKY_SKIP_I18N_LOCALE_CONTENT_LANGUAGE=1 git commit ...

```

#### [134] 🧮 批量写计数诚实性对账(blocking,拦「affected/deleted 由请求侧 .length 自算」这一型静默失真 —— 改了 0 行与改成功同形)

```

  💡 本票一轮人肉清出 8 处同一形状(chat.ts batch、admin-sys role cancelAll/selectAll、
     demand-square、admin/_shared.ts 的 registerCrud 批量删〔19 处路由复用同一个工厂〕、
     message.ts 批量删、workspace.ts batch-delete/batch-restore)。那一型的病灶是:
     where 带 eq(roleId)/eq(memberId) 过滤时,传进来的 id 一个都不命中也照样回
     deleted:3 —— 后台显示"已删除 3 项"而库里一行没动,typecheck/lint/其余各门全绿。
     唯一出口 apps/api/src/utils/batch-outcome.ts(dedupeIds + batchWriteOutcome),
     db 层一律 .returning({id}) 回报**库确认集合**,响应新增 missedIds 逐条点名。
     四条放过通道:① 同链有 .returning( ② 计数根 ≤2 跳可追到归属预查询
     (business-card-routes.ts 那种"先查 owned 再删"是**正确写法**,不得判红) 
     ③ 该文件 import 了唯一出口 ④ 行内 batch-count-exempt: <原因>(须带原因,
     并已挂进守门 108 的 30 天到期档 —— 豁免不得只出生不死亡)。
     刻意不判的两型:布尔 deleted:true(HEAD 面 257 处全仓惯例,改它属全 API 语义决策、
     交人定)与读查询 count: rows.length(不是写)。
     判不了的形状落「未判定」并报数,--strict 下有未判定即 exit 2(拒绝出合格证)。
     ① 看清单:node scripts/check-batch-write-count-honesty.mjs [--json|--staged]
     ② 自检:node scripts/check-batch-write-count-honesty.mjs --self-test(35 条)
     ③ 镜像:node --test scripts/tests/check-batch-write-count-honesty.test.mjs(10 例)
     紧急跳过(不推荐):HUSKY_SKIP_BATCH_WRITE_COUNT_HONESTY=1 git commit ...

```

#### [135] 🧾 ApiResult 失败分支身份对账(blocking,拦「throw new Error(res.error) 丢掉 status/errorCode」—— 401 因此冒充「提交的信息有误」,把用户引导去改表单)

```

  💡 立因是真机实测,不是假想:进 App「广场」tab 一进来就弹「提交的信息有误,请检查后重试」。
     定性结果**不是 400,是 401 被错标** —— ApiResult 失败分支本来带 status/errorCode
     (packages/types/src/api.ts),而 toUserFriendlyMessage 的判序是
     errorCode → HTTP status → 文案正则;只抛 message 时前两档全丢,401 的
     "Invalid or expired token" 只能落到参数类正则 /invalid|missing|required/ 上。
     修法只有一个出口:throw apiFailureToError(res)(packages/shared/src/utils/error-messages.ts)。
     判不了的形状:① catch 侧写 showFloat(e.message) 的,换出口也救不回身份 —— 本门刻意不判,
     迁移时必须逐处读 catch 路径;② 先解构成 const { error } 再抛的看不见(宁漏不误报)。
     存量走「该文件 HEAD 自身计数」棘轮(立项实测 958 处 / 576+ 文件),当场判红就是恒红门(§12e)。
     行内豁免 api-error-exempt: <原因>(须带原因,已挂进守门 108 的 30 天到期档)。
     ① 看清单:node scripts/check-api-failure-throw.mjs [--json|--staged]
     ② 自检:node scripts/check-api-failure-throw.mjs --self-test
     ③ 镜像:node --test scripts/tests/check-api-failure-throw.test.mjs
     紧急跳过(不推荐):HUSKY_SKIP_API_FAILURE_THROW=1 git commit ...

```

#### [136] 🧵 后台任务类型三面 parity(blocking,拦「广告了任务类型却没实现 / 实现了却没接线 / 欠账清单腐烂」—— 声明面↔实现面↔接线面必须同时成立)

```

  💡 本门是**补装**的:脚本与 AGENTS.md 的『已接线』声称早已入库,而 runner/钩子/package.json
     CI 五处权威点全部零命中 —— 即守门 89 的 RED-R2 一直红,每一次提交都被逼 --no-verify,
     一次绕过等于约 150 道门对该提交作废(§12e 那条本仓最高反面教训)。
     接线前置都实测过:全量面 exit 0(不在 HEAD 上造新红)、--self-test 30/30、自带 skipEnv。
     三面判据:P3 广告了却没实现(真幽灵)/ P4 新增未接线类型未入账 或 欠账清单腐烂
     (已接线还挂着账)—— 三种都要求**改一侧对齐另一侧**,不得删判据或清空账本消红。
     ① 看清单:node scripts/check-background-task-type-parity.mjs [--json]
     ② 自检:node scripts/check-background-task-type-parity.mjs --self-test(30 例)
     紧急跳过(不推荐):HUSKY_SKIP_BG_TASK_TYPE_PARITY=1 git commit ...

```

#### [137] 名字承诺/实现兑现对账(拦「函数或字段叫 hash/digest/指纹/脱敏,实现却是明文拼接且流向持久化或出网」这一型 —— 本仓 4 处真缺陷同族立门)

```

  💡 三条与门缺一不可才判红:① 命名承诺(词元匹配,非子串)② 可达返回/赋值面无任何真散列 ③ 值流向持久化/出网出口或被当等值标识。
     判不出的一律落「未判定」并报数,既不判红也不冒充合规;--strict 下有未判定即 exit 2(拒绝出合格证)。
     行内出口:digest-name-exempt: <一句话原因>(必须带原因,已挂守门 108 的 30 天存活期档)。
     ⚠ 落地当天真仓 HEAD 现读 3 处命中经逐条复核**全为假阳性**(fingerprints=哈希值集合 / hashIdx=URL 片段位置 / hashed=混装列表局部变量),
       它们已作为该文件 HEAD 存量被棘轮放过;升更严判据前必须先修准这三型,不得为消红去放宽词元匹配。

```

#### [138] @ 多维提及引擎接线与单一源对账(V3 #61:三件不得回到无人调用 / 维度表与触发符解析不得出现第二份)

```

  W1 造好没装车:useSearchMentions / addMention / MentionChips 三件必须有生产调用方(注释与测试面不计),零容忍不吃基线。
  W2/W3 单一源:维度清单与触发符解析各只许一份,走该文件 HEAD 自身存量棘轮 —— 只拦"把第二份加回来"。
  ① 现读:node scripts/check-mention-engine-wired.mjs [--json]
  ② 自检:node scripts/check-mention-engine-wired.mjs --self-test
  紧急跳过(不推荐):HUSKY_SKIP_MENTION_ENGINE_WIRED=1 git commit ...

```

#### [139] 模式×权限档×审批三轴矩阵对账(V3 #53:ChatMode 硬收窄的表与判定两侧逐格等值,出口唯一、有生产调用点)

```

  三轴矩阵(Py CHAT_MODE_TOOL_AXIS ↔ TS permission-mode.ts 契约表)必须 5×5 逐格等值,与只读白名单同源。
  只许一处交集实现:第二处手写 filter/白名单副本即红;READONLY_TOOLS 只报数。
  ① 现读:node scripts/check-mode-permission-matrix.mjs [--json]
  ② 自检:node scripts/check-mode-permission-matrix.mjs --self-test(13 条)
  紧急跳过(不推荐):HUSKY_SKIP_MODE_PERMISSION_MATRIX=1 git commit ...

```

#### [140] V3 #62/#63 对话流挂载与契约登记对账(拦「件在库而无人挂载」与「契约登记与消费点漂移」)

```

  本门钉三件:BusinessFormSection 必须真被 MessageList 挂载;form_request 契约段与消费点逐字段同形;sse/contract.ts 与 ai-service sse_contract.py 的既有 parity 不得被绕过。
  现读:node scripts/check-v3-62-conversation-mount.mjs --worktree / --json
  自检:node scripts/check-v3-62-conversation-mount.mjs --self-test
  紧急跳过:HUSKY_SKIP_V362_CONV_MOUNT=1 git commit ...

```

#### [141] doom-loop parity 对账(共享层/CLI/agent.ts/Python 等价/主链路五面成套,策略数字不得有第二份)

```

  P1 逐项常量等值 / P2 装车性(注释里的提及不算) / P3 三动作各有消费分支。
  现读:node scripts/check-doom-loop-parity.mjs ; 自检 --self-test(14 条) ; 紧急跳过 HUSKY_SKIP_DOOM_LOOP_PARITY=1

```

#### [142] Guardian 复核接线对账(拦「复核出口造好没人调」与「未复核被折叠成通过」)

```

  复核必须在生产面被调用;判不了/超时/无凭据必须显式未复核,禁止记为通过。
  现读:node scripts/check-guardian-review-wired.mjs ; 紧急跳过 HUSKY_SKIP_GUARDIAN_REVIEW_WIRED=1

```

#### [143] LSP 语言表与探测四态对账(拦 binary 名回到写死字面量、能力声明无对应族、探测失败被折叠成无诊断)

```

  T1-T5 五判据:表自洽/扩展名唯一/族清单静态对账/binary 唯一出处/能力投影同形;空枚举判死。
  现读:node scripts/check-lsp-language-table.mjs ; 自检 --self-test(14 条) ; 紧急跳过 HUSKY_SKIP_LSP_LANGUAGE_TABLE=1

```

#### [144] 🩸 崩溃上报出口脱敏对账(blocking,拦「崩溃上报把未脱敏的 message/stack 送进 crash_reports(90 天)与管理面板」—— 发射点与落库点都必须调用共享层唯一出口 redactCrashText)

```

  💡 立因是实测而不是假想:apps/web/src/components/common/ErrorBoundary.tsx 曾把
     error.message / error.stack 原样 POST 到 /api/crash-reports,而该端点按设计
     **匿名可写**、服务端只有 zod 长度上限(.max(4000)/.max(20000)),零脱敏 ⇒
     内嵌的 API key / Bearer / 用户机器绝对路径明文落库 90 天并进 admin 面板。
  三条判据:V1 站点(向 crash-reports 发请求 / insert(crashReports)必须调用唯一出口;
     V2 有人引用出口而面上没导出 ⇒ 判"没有出路";V3 出口出现第二份声明 ⇒ 判红。
  修法只有一个出口:redactCrashText(@ihui/shared/utils/redact)—— 服务端那一处是
     **权威防线**(不可信任客户端),落在 apps/api/src/services/crash-report-service.ts
     的 recordCrash(该表唯一写入口),顺序必须先脱敏、再截断。
  存量按「该文件 HEAD 自身违规数」棘轮只报数(立项现读:miniapp/RN 两处客户端发射点
     未收口)—— 绝不为消红放宽判据,也不用行内豁免遮掉。
  ① 现读:node scripts/check-crash-report-redaction.mjs [--json|--staged|--worktree]
  ② 自检:node scripts/check-crash-report-redaction.mjs --self-test
  ③ 镜像:node --test scripts/tests/check-crash-report-redaction.test.mjs
  紧急跳过(不推荐):HUSKY_SKIP_CRASH_REDACTION=1 git commit ...

```

#### [145] RN 包装器双层页头对账(共享屏自带页头 × RN 屏又加 NavBar ⇒ 同屏两条返回键与两个标题)

```

修法只有一条:给共享屏补页头抑制通道(hideHeader / renderHeader / nestedInScrollView)并在调用点传入 —— 与 SquareScreen/ShareScreen/AgentScreen 既有先例同形。
禁止删任意一层:共享页头是 163 个消费点的唯一页头;包装器 NavBar 在 Settings/Profile 上承载 SideMenu 抽屉唯一入口。
删包装器还会让 loading 态失去唯一返回手段(实测 packages/app/src/features/course-detail 的 loading 分支只有 spinner)。
行内出口 double-header-exempt: <原因>(须带原因,已挂守门 108 的 30 天到期档)。

```

#### [146] README 表格完整性对账(TI1 竖排续行判红/T-B 只报数/棘轮锚基线)

```

T-A 竖排续行超锚点:node scripts/readme-table-unwrap.mjs --file README.md --dry-run(默认零写盘,自证零内容损失后才 --apply)
确属有意保留:<!-- table-cell-exempt: <原因> --> 写在宿主行或该 run 内任一行(须带原因,守门 108 管 30 天到期)
T-B 半截行与孤立 2 竖线行只报数不判红(要逐案判语义,不归本门)

```

#### [147] 模型容量/推理档位跨语言对账

```


```

#### [148] 会话失效统一出口注册对账:凡消费 @ihui/api-client fetchApi 的端必须注册 setUnauthorizedHandler 或持带 reason+未过期 reviewBy 的台账豁免(AP1);台账端已注册/指向不存在端/重复登记判红(AP2 反腐烂);注册口 export 或 notifyUnauthorized 调用点被摘线判失明不记绿(AP3);枚举 0 个消费端 exit 2 不记绿

```

修复出口二选一:该端注册 setUnauthorizedHandler(共享层已有注册口),或在 scripts/auth-handler-registration-exemptions.json 补带 reason+reviewBy 的条目;不得放宽判据消红

```

#### [149] 包入口 barrel 漏 re-export 对账:端内从裸包名 import 的名字必须由包入口真的递出

```

  修复出口只有一个:把该符号补进包入口的显式清单(或在入口 re-export 它)。不得改判据、不得加豁免、不得去掉 web 的 ignoreBuildErrors 来"顺手收紧构建"。
  为什么本地一路绿:漏 re-export 既不报类型错(被 next.config.ts 的 typescript.ignoreBuildErrors 吃掉)也不报构建错(打包器只看 exports→dist/index.js),只有运行时 undefined 砸到用户手上 —— 与守门 98 方向相反(98 判 import 了不存在的,本门判存在但没递出来)。
  ① 现读:node scripts/check-package-barrel-export.mjs [--json|--staged|--worktree]
  ② 问责(未判定与存量一并拒出合格证):node scripts/check-package-barrel-export.mjs --strict
  ③ 取证:node scripts/check-package-barrel-export.mjs --self-test;node --test scripts/tests/check-package-barrel-export.test.mjs —— 例数以命令末行现读为准,勿照抄文档
  紧急跳过(不推荐):HUSKY_SKIP_PACKAGE_BARREL_EXPORT=1 git commit ...

```

#### [151] 子智能体/后台任务状态词汇跨语言与端内抄本对账(六档是落库/REST/SSE 三重对外契约)

```

成员集合的单一真相源 = packages/types/src/agent-runtime.ts 的 AGENT_TASK_STATUSES\n端内一律 import 它(或由它派生);Python 侧改 KANBAN_TASK_STATUSES + Literal 两处同笔\n六档值是对外契约:不得改名、不得删成员、不得为变绿放宽判据、不得写豁免清单消账\n新增一档必须同枚提交补齐 agents.kanban.* 五语言(AGENTS §30)\n判不出 ⇒ exit 2 报无法判定,不冒红也不记绿

```

#### [152] 🔐 ai-service 身份消费对账(blocking,拦「端点取到已验证身份却一次都没用它」—— 认证不等于授权;判据单一真相在 apps/ai-service/scripts/audit_principal_consumed.py,本门只物化被审面并派生那把尺子)

```

  💡 本门守的是「取到已验证身份却一次都没用它」这一型(认证≠授权):签名带身份依赖
     默认值而整个函数体既不读该参数、也不经 request.state.user_id 通道消费、也不把
     request 一跳委托给"自己读 state.user_id"的仓内 helper ⇒ 判未消费。
  棘轮锚点 = 该文件在锚点面(HEAD 档比 HEAD^、--staged 档比 HEAD)自身的存量,
     只拦"本次改动带进来的新账"与"豁免清单腐烂",存量不因无关提交判红。
  机器态不判红:拿不到 Python/尺子没产出结论 ⇒ 未判定 exit 0(末行如实,不出具
     "全部已判"合格证);被审面取材不到/枚举 0 个 ⇒ exit 2 判死,不静默。
  修复出口(二选一,不得为消红削判据):① 端点真的消费身份 —— 属主取令牌主体
     (app/core/jwt_auth.py 的 require_request_user_id)或归属比对走
     app/services/session_store.py 的 owner_scoped_allows,或把 request 一跳
     委托给 _owner_filter 形态的既有 helper;② 确属无归属轴的公共面 ⇒ 在尺子内
     PRINCIPAL_EXEMPTIONS 逐条登记 file+func+理由(禁止按目录整片放行)。
  ① 现读:node scripts/check-principal-consumed.mjs [--json|--staged|--worktree]
  ② 镜像:node --test scripts/tests/check-principal-consumed.test.mjs
  紧急跳过(不推荐):HUSKY_SKIP_PRINCIPAL_CONSUMED=1 git commit ...

```

#### [153] 🛡️ 服务二进制路径存续性对账(判机器状态:nssm 各服务 Application 绝对路径存在性;三态不并桶,§12e 只能 warn)

```

本门判的是"这台机装了什么",不是本次提交改了什么 ⇒ 定级 warn:
  挂 blocking 会让每台每次提交被逼 --no-verify,一次绕过等于全部守门对该提交作废(§12e)。
三态:可判存在 / 确认缺失 / 未判定;枚举不到 nssm 服务时如实报未判定,不冒充通过。
问责跑 --strict;应急跳过 HUSKY_SKIP_SERVICE_BINARY_PATHS=1。

```

#### [154] 临时夹具 scratch 根二阶嵌套巡检(只报不删,三态含未判定)

```


```

#### [155] 镜像测试临时夹具落点对账(默认只报名,--strict 才判红)

```


```

#### [156] 自检用例登记侧的求值配对对账(登记不求值 ∧ 用例传函数 ⇒ 才判红;潜伏档只报数)

```

判红只有一型:登记函数把实参裸存 / !!x / Boolean(x) 而全文无人调用它,且同一自检宿主内确实有用例传裸箭头函数或裸 function。
该 self-test 条目从未被判过 —— 打印的通过数是假的。
出路只有一条:把登记侧改成求值形态(体内调用该形参,或改用 push({name, fn}) + 消费循环 c.fn() 的 thunk 族)。禁止把用例改成布尔去过门。
判不出的形态(形参被喂进别的调用、括号配不平)只报名不判红;问责档:node scripts/check-selftest-registrant-evaluates.mjs --strict(有未判定即 rc=2)。
定级 warn 是设计前提:现读潜伏 36 处 + 未判定 4 处,接成 blocking 就是每台每次被逼跳门(AGENTS 12f)。

```

#### [157] 🔐 按凭据存在性豁免对账(blocking,G-459:头名在场即跳过安全判定必须逐条裁过)

```

  💡 出路只有两条:行内 credential-presence-exempt: <原因>,或台账 scripts/data/credential-presence-exemptions.json 带 file+anchor+reason+reviewBy。不得为消红放宽判据。

```

#### [158] 🛡️ 凭据在场即豁免对账(blocking,拦「安全钩子里只要带了某个头就直接跳过校验」—— 票#23 CSRF 现场收口后无人看守的那一型)

```

  💡 本门钉的形态:安全语义文件面(apps/api/src/plugins/** + apps/api/src/middleware/** + 文件名含 csrf/auth/permission/rate-limit/internal 的源码)里,if (<只对 headers/cookies 做存在性判断>) 紧跟裸放行(return / return true / return next()),且分支内没有任何验证调用。
     阳性对照(这门的存在理由):把票#23 修复前的 csrf.ts 历史 blob(6fb790eb70a8^)喂同一判据,必须点名那行 x-internal-service-token;改写成「验过才免」(isVerified*/secretsEqual/verify*/timingSafeEqual/jwt.verify/compare*)后落 passed。
     三态不可混:命中(判红;存量按该文件 HEAD 自身计数只报数)/ 放过(做了验证调用)/ 判不出(helper 调用、动态属性名、与凭据字段混项)—— 判不出逐条点名并计数,--strict 下有未判定即 exit 2,拒绝出合格证。
     口径同 70/77/83/98/101/103/118:全量判 HEAD blob、--staged 判索引 blob、--worktree 仅人工、两面旗同给 exit 2、取不到判"无法判定"不回落、枚举到 0 个候选判死。
     行内出口 presence-exempt: <原因>(须带原因,只救本行或紧邻上一纯注释行);该族尚未进守门 108 的存活期表,当前落其默认 90 天档,定档另计一票。
     刻意不判(如实登记):条件先存进变量再判(单跳回溯不在射程)、头值做 == 字面比较(是否安全比较属另一维)、continue 形态、Python 侧(守门 117 管那一层的另一型)。
     ① 看清单:node scripts/check-gate-presence-exemption.mjs [--json|--staged|--strict]
     ② 自检:node scripts/check-gate-presence-exemption.mjs --self-test
     ③ 镜像:node --test scripts/tests/check-gate-presence-exemption.test.mjs
     紧急跳过(不推荐):HUSKY_SKIP_GATE_PRESENCE_EXEMPTION=1 git commit ...

```

#### [209] 🔐 CSRF 豁免形状对账(blocking,存在性唯一条件放行/验真出口摘线/timingSafeEqual 单源三判据)

```

  💡 本门钉的形态:apps/api/src 的 CSRF 豁免决策面(文件名含 csrf / 代码面引用验真出口族 / 注册 preHandler|onRequest 钩子且代码面提 csrf)里——
     ① 以某 header/env 键的存在性为唯一条件即放行 ⇒ 红;正当形态只有调用 isVerified* 出口,或行内 csrf-exempt: <原因>(本族)/ credential-presence-exempt: <原因>(守门 157 族,防两道门互咬);裸标记无原因不放过。
     ② 验真出口被摘线(无人调用或 export 不见)⇒ 判"没有出路"并参与退出码。
     ③ timingSafeEqual 只许 secretsEqual 一份,再出现第二处即红(站点键不含行号,插入行不假红)。
     与 157/108 的分界(门体头注已写明):157/108 只审站点不问出口死活,且 157 的 VERIFIED_RE 反把 timingSafeEqual 当"已验真"信号放过——本门补的正是这两格,不是重复立项。
     三态不可混:命中(判红;存量按该文件 HEAD 自身计数只报数)/ 放过(验真出口或带原因豁免)/ 判不出(--strict 下未判定即 exit 2,拒绝出合格证)。timingSafeEqual 现读存量 48 处/20 文件,按 §12f 走首锚差值棘轮:只拦新增、只减不增。
     ① 看清单:node scripts/check-csrf-exemption-shape.mjs [--json|--staged|--strict]
     ② 自检:node scripts/check-csrf-exemption-shape.mjs --self-test
     ③ 镜像:node --test scripts/tests/check-csrf-exemption-shape.test.mjs
     紧急跳过(不推荐):HUSKY_SKIP_CSRF_EXEMPTION_SHAPE=1 git commit ...

```

#### [159] 图源池与境外图片 URL 对账:渲染与 seed 路径不得再出现境外图片域名的完整 URL,且 database 侧镜像必须与 shared 逐字等值

```


修法只有一条:把该 URL 换成境内可达图源池成员(packages/shared/src/constants/image-source-pool.ts,新增须按头注四要件实测入池);镜像漂移则两侧同批改那三张清单。禁止放宽域名清单或删镜像消红
单独复现:node scripts/check-image-source-domains.mjs --staged
自检/行为对账:node scripts/check-image-source-domains.mjs --self-test 与 node --test scripts/tests/image-source-pool-parity.test.mjs


```

#### [160] 斜杠命令「注册表 ↔ 分派 switch」到达性对账 + 注册名去重:注册名(含别名)必须各有活 case/if 分支(W1)、注册名多重集零重复(W2)、分派顶层必须有 default 兜底(W4),三维零容忍;分派有而注册表无(W3 名字漂移)默认只报数、--strict 才判红(HEAD 面现读 2 条存量,当场判红就是恒红门);注册表/分派解析不到 ⇒ exit 2 未判定,枚举到 0 个判死不记绿

```

修复出口二选一:在 apps/cli/src/commands/repl.ts 的分派里补上该名字的 case(或等价 if 比较),或把这条命令从 slash-registry.ts 的注册表摘掉;W3 报数的两条按同法处置。禁止为消红放宽判据或改注册表入口名

```

#### [161] 入站契约 .strict() 到达性对账

```

入站 Zod 契约未对未知字段表态:补 .strict()/z.strictObject,或写行内 inbound-strict-exempt: <原因>(该族已挂守门 108 存活期);存量按该文件 HEAD 自身锚点只报数,--strict 才问责

```

#### [163] 维护性写归属/CAS/回报计数三态对账(G-815920)

```

读三态请跑 pnpm check:write-owner(它走 --strict,有未判定即 exit 2,那是拒绝出合格证不是仓库故障);默认档与提交链只拦"该文件 HEAD 自身 missing 存量"之上的新增

```

#### [164] 源码替换符(U+FFFD)对账 —— 字节级 UTF-8 完整性的缺失维度

```

  这道门问的是「源码里有没有 U+FFFD 替换符」—— 守门 4c 判的是非法 UTF-8 字节序列,而 U+FFFD
  编码成 EF BF BD 完全合法,所以"内容已被有损解码换掉"在那道门上是隐形的(实测 718 处一路绿)。
  存量(该文件 HEAD 自身就有的)只报数不判红;本次把某文件的处数推高才红。
  修复出口:node scripts/check-replacement-chars.mjs --recover <路径>
  它按「代码括号」给每个损坏注释区间找最近零损坏祖先的原文;找不到的会如实报名,禁止编造。


```

#### [165] 🧾 教育欠费口径单一出口对账(blocking,AR1 出口外重写算式/AR2 裸写派生列)

```


```

#### [166] 🧵 活文档按旧副本提交会写回他人已入库行(blocking,2026-09-29 立;只判本次真改掉的那份文档,索引==HEAD 记跳过不记通过)

```

红 = 这次要提交进去的那份活文档,逐字丢了 HEAD 里已有的登记行(lost)。
1) 归并:`node scripts/merge-live-doc.mjs --file <该文档> --apply` —— 只补 lost,不补 stale;
2) 被点名成 stale 的行要人工取 HEAD 形态(`git show HEAD:<该文档>` 逐行取回),禁止整文件覆盖;
3) 真要删行:走 AGENTS §1 归档两步走,或合并之后显式 `git rm` —— 本门刻意不给行内豁免;
4) 确认红来自别人正在写的旧副本而不是本次改动:紧急跳过 HUSKY_SKIP_LIVE_DOC_PATHSPEC=1 并留痕。

```

#### [167] 🔒 turn 序号分配点上锁(blocking,max(turnOrdinal) 与 insert(chatMessages) 同体 ⇒ 体内必须有 .for(\

```

  💡 本门钉的是 G-818 那格不变量:turn_ordinal 是轮次组号,索引刻意非唯一,唯一约束
     结构上不可用 ⇒ "读 max 再分配"的每一段都必须锁;真库实测无事务的"读 max → 插"
     同会话并发双插撞号率 100%(60 对全撞,turn-ordinal-concurrency.test.ts)。
     红点名的形态 = max(${chatMessages.turnOrdinal}) 与 insert(chatMessages) 落在同一个
     语句块里,块内既无 .for('update') 也无 db.transaction。
     修法:把 max 读取与 insert 一并包进 db.transaction,并先对会话行 .for('update')
     —— 参照 apps/api/src/db/chat-queries.ts createMessage 与 routes/message.ts 的既有形态。
     本门只咬本次改动动过的文件(apps/api/src);全量档存量红(patrol-scheduler.ts:198)
     只报数 —— 改到它的那一刻必须顺手补锁,不得原样提交。
     单独复验:node scripts/check-turn-ordinal-lock.mjs --staged
     自检:node scripts/check-turn-ordinal-lock.mjs --self-test(16 例,正反成对)
     镜像测试:node --test scripts/tests/check-turn-ordinal-lock.test.mjs(10 例,含
     临时仓端到端 staged 棘轮双向 + 全量只报数)
     紧急跳过:HUSKY_SKIP_TURN_ORDINAL_LOCK=1(跳过即放弃"分配点上锁"这格不变量,
     必须在提交信息里写明理由与清偿票)

```

#### [168] 🔀 合并复活已删文件对账(blocking,DR1 基底判定 + DR2 删除出处;默认只判未入 origin/main 的合并,每枚判一次)

```

  💡 守门 100 的另一半:100 拦「合并吞掉对侧独有新增」,本门拦「本侧显式删除的路径被合并整批写回」。
     DR1:P ∈ tree(共同基底) ∧ P ∈ 对侧父 ∧ P ∉ 本侧父 ∧ P ∈ 结果 ⇒ 判红;
     DR2:第一轮复活后分叉点已推进到已删一侧 ⇒ 基底里已没有它,DR1 结构性失明;改判「本侧可达范围内
     存在一笔非合并提交删掉了它」—— 对侧独有新增拿不出删除出处 ⇒ 不判(那是守门 100 的地盘)。
     同一路径两条取证只计一条(两份基线互相顶掉,真值就读不出)。正当豁免:删除提交信息含
     intentional-delete:,或 scripts/data/deletion-survival-allowlist.json 带 path+reason+reviewBy 且未过期。
     增量台账 .workbuddy/merge-deletion-resurrection-audited.json 让每枚合并只判一次(判红不许反复红)。
     自检:node scripts/check-merge-deletion-resurrection.mjs --self-test(43 例);
     镜像:node --test scripts/tests/check-merge-deletion-resurrection.test.mjs(11 例,含 T1 方向锁)。
```

#### [171] AI 面板装载守门:GlobalShell/AISidePanel 的骨架占位几何一致 + 8 个重组件懒加载边界 + inferVendor 单一来源(首屏延迟根治防回潮,2026-09-30;门体随 d5c54f4499 入库,本枚重注册补对账)

```

单独复现:node scripts/check-ai-panel-mount-guards.mjs --staged(或 --worktree 人工排查)
自检:node scripts/check-ai-panel-mount-guards.mjs --self-test(44 例,正反成对)
判据:R1 GlobalShell 两处占位(dynamic loading + Suspense fallback)几何一字不动且内部是骨架;R2 ai-side-panel 8 个重组件只准动态 import;inferVendor 只从 vendor-infer 导入
修复方向:恢复懒加载边界与骨架占位,不要把重组件改回静态 import(零视觉症状的性能回退,测试抓不到,只有这道门能咬住)

```

#### [173] 对外文档数字对账(README/README.en 的生成块与散文声称必须等于 gen-doc-numbers 现算值;判责时机=改动被审文档的那枚,未触及只报漂移数 —— 防恒红)

```

刷新块: node scripts/gen-doc-numbers.mjs --markdown 替换 README 的 GENERATED NUMBERS 块(务必在 README 已在被审面上的那份面生成,否则 trackedFiles 天生差数);逐数来源: node scripts/gen-doc-numbers.mjs;连仓库简介一起问责: node scripts/check-doc-numbers.mjs --strict --description -
本门只在触及 README.md/README.en.md 的轮次判红;未触及轮次打印的"漂移只报数"是"下次改 README 必须重跑生成块"的前置提醒,不构成跳门理由。

```

#### [174] 诊断面脱敏守门(b76-08a票1配套):诊断/错误上报面不得携带未脱敏的密钥/令牌/邮箱/路径等敏感串,自检 --self-test 内嵌红绿对照

```

单独复现:node scripts/check-diagnostic-redaction.mjs
自检:node scripts/check-diagnostic-redaction.mjs --self-test
应急放行:HUSKY_SKIP_DIAGNOSTIC_REDACTION=1 git commit(commit message 写明责任归属)

```

#### [175] 进程退出码归因守门(b76-08a票1配套):进程 exit 1/非零退出必须可归因到显式 failure kind/错误码,禁止无归因的裸退出,自检 --self-test 内嵌红绿对照

```

单独复现:node scripts/check-process-exit-attribution.mjs
自检:node scripts/check-process-exit-attribution.mjs --self-test
应急放行:HUSKY_SKIP_PROCESS_EXIT_ATTRIBUTION=1 git commit(commit message 写明责任归属)

```

#### [176] 能力位不得客户端自供守门(b76-08a票2配套):客户端不得自报 capability 字段(connectionId/clientMode/deliveryProfile/subscriberScope/workflowRunDeltas 名单),能力位只准服务端下发,自检 --self-test

```

单独复现:node scripts/check-capability-field-not-client-supplied.mjs
自检:node scripts/check-capability-field-not-client-supplied.mjs --self-test
应急放行:HUSKY_SKIP_CAPABILITY_FIELD_NOT_CLIENT_SUPPLIED=1 git commit(commit message 写明责任归属)

```

#### [177] SSE 帧水印守门(b76-13票1配套):SSE 流消费环必须带 fromSeq≥1 帧水印接线(唯一出口 + 读环接线 + 阳性对照),摘线即红,自检 --self-test 红绿对照

```

单独复现:node scripts/check-sse-frame-watermark.mjs
自检:node scripts/check-sse-frame-watermark.mjs --self-test
应急放行:HUSKY_SKIP_SSE_FRAME_WATERMARK=1 git commit(commit message 写明责任归属)

```

#### [178] 列表截断诚实守门(b76-13票7配套):UI 列表截断必须如实交代截断帽(不得假装展示全量),三处 UI 命中已清偿;1 处字符串尾截(terminal-section.tsx)属票面不判面(未判定不判红)

```

单独复现:node scripts/check-list-cap-honesty.mjs
自检:node scripts/check-list-cap-honesty.mjs --self-test
应急放行:HUSKY_SKIP_LIST_CAP_HONESTY=1 git commit(commit message 写明责任归属)

```

#### [179] 工具 schema 投影完整性守门(b76-05票2配套):工具描述符 JSON schema 投影必须键序 canonical/拒绝通道在位/A-B 两面一致/缓存中性,99 个可判工具全过才绿,自检 --self-test 4 例

```

单独复现:node scripts/check-tool-schema-projection.mjs
自检:node scripts/check-tool-schema-projection.mjs --self-test(4 例)
应急放行:HUSKY_SKIP_TOOL_SCHEMA_PROJECTION=1 git commit(commit message 写明责任归属)

```

#### [180] 嵌套 additionalProperties 闭集守门(b76-14票2配套):嵌套层 schema 的闭集声明不得被摘(嵌套三态在位 + 类型面收编 ≥2),取不到按 UNDETERMINED 不记绿,自检 --self-test 3 例

```

单独复现:node scripts/check-nested-additional-properties.mjs
自检:node scripts/check-nested-additional-properties.mjs --self-test(3 例)
应急放行:HUSKY_SKIP_NESTED_ADDITIONAL_PROPERTIES=1 git commit(commit message 写明责任归属)

```

#### [181] 错误文案有界化守门(b76-12b票1配套):错误文案出边界(PERSISTENT sink)的 JSON.stringify 内插必须有界或带 ref= 基线;测试面/CLI 面/stdout-only 豁免,基线棘轮只减不增

```

单独复现:node scripts/check-error-message-bounded.mjs
自检:node scripts/check-error-message-bounded.mjs --self-test(12 例)
应急放行:HUSKY_SKIP_ERROR_MESSAGE_BOUNDED=1 git commit(commit message 写明责任归属)

```

#### [182] 控制面 strict 棘轮门(b76-12c票2配套):扫描面(apps/api/src/plugins + packages/shared/src)的 z.object+.strict+.catch 总和只减不增(基线 91);禁 passthrough 降红/禁装饰字段塞控制面

```

单独复现:node scripts/check-wire-strictness.mjs
自检:node scripts/check-wire-strictness.mjs --self-test(8 例)
基线吸收记录:立门读数 68 取自 strict 化落盘前工作树,与立门提交 be6da32e6b 树统计(91)不符;超出的 23 处经逐行核对全部来自 wave-2 W3 提交 ac63a7084a 帧 schema 票对 contract.ts 的落库(5 .object + 6 .strict + 12 .catch,控制面收紧+装饰载荷 .optional().catch 降级的正当形态),2026-09-30 接链时按当次真值吸收至 91,无未清偿红
应急放行:HUSKY_SKIP_WIRE_STRICTNESS=1 git commit(commit message 写明责任归属)

```

#### [183] 分片上传聚合预算棘轮门(b76-12c票3配套):chunked-upload.ts 的 begin 新建装配检(isPerUserSessionBudgetExceeded)与每片落盘追加检(wouldStagedBudgetOverflow)各 ≥1,两档常量须在 PROTOCOL_UPLOAD_LIMITS 登记,防死表回潮

```

单独复现:node scripts/check-upload-budget.mjs
自检:node scripts/check-upload-budget.mjs --self-test(4 例)
应急放行:HUSKY_SKIP_UPLOAD_BUDGET=1 git commit(commit message 写明责任归属)

```

#### [184] 📚 活文档点名路径存续性对账(blocking,正文反引号点名的仓内路径必须在被审面在位;索引缺而 HEAD 在 ⇒ 红,HEAD 缺席只 warning,2026-09-30 D169 立)

```

红 = 这次提交面上,活文档正文反引号点名的仓内路径在索引里没了(HEAD 在位)—— 本次提交正把被点名的文件弄丢(D169 事故格)。
1) 误删 ⇒ `git restore --staged <path>` 找回;确属下线 ⇒ 同步更新点名它的活文档(两条路,本门只读不代恢复);
2) 单复验:node scripts/check-live-doc-references.mjs --staged(提交链档)/ 不带旗 = 三面审计档;自检:--self-test(例数以命令末行为准);
   CK 维(2026-10-13,G-1113921 口径③承接落地):被已勾登记行(- [x])点名的 HEAD 缺失路径分桶 checkedMissing 单独报数、不判红(升红即恒红门,§12e);--strict 对 CK 存量判红;正当修法(验收行与文件同枚进来)由 newlyLanded 放过;
3) HEAD 本就没有的点名只 warning(笔误档),不构成红 —— 禁止用改判据/加豁免消红(§12e);
4) 紧急跳过(不推荐):HUSKY_SKIP_LIVE_DOC_REFERENCES=1 git commit ...

```

#### [185] 迁移内容不可变性对账(已入库 drizzle 迁移不得被改写;IM1 与"该 tag 首次入库的 blob"逐字节比,存量只报数;IM2 判本次改写面;枚举 0 判死不记绿)

```


```

#### [189] Python import 入库存续性对账

```

HEAD 里有人 import 一个从未入库的 Python 模块 ⇒ 干净检出与 CI 起不来,而本机在跑的进程把它掩盖了。
出路只有一条:把被 import 的包/模块与实现同一枚提交入库,或去掉这条 import。不得为过门改判据。

```

#### [190] 枚举/映射取不到时的兜底分支不得落到更宽的权限或能力档(票 G-816027):宽档集合由被审面的两份注册表(TS POLICY_BY_MODE / PY skips_approval_permission_mode)现读推导,推导失败或槽位撞名一律未判定;与"凭据在场即豁免"那道门(157)不重叠计账

```

修复:兜底分支要么显式抛错,要么取最窄档;不得把"没声明"读成"允许"。
问责档(含未判定即拒绝出合格证):node scripts/check-enum-default-widening.mjs --strict

```

#### [191] 测试判据复制对账(§22c 跨门尺子;门体与镜像测试各写一份形态清单/正则即点名,存量 27 处只报数 ⇒ warn,升 blocking 前置 = 命中归零)

```


```

#### [192] 注册表工作树超集对账(package.json / guardian-runner 的已入库入口被工作树副本整行写回旧态;今日 28 份注册表零存量 ⇒ blocking,只在 --staged 面问责)

```


```

#### [194] 🧯 §22d 入口守卫对账:scripts/**.mjs 不得顶层裸 main()(存量以 node scripts/check-direct-run-guard.mjs 末行现读为准,差值棘轮只拦本次新增)

```
本门判的是:scripts/**.mjs 顶层裸 main() 且全文没有 §22d 的 isDirectRun 双形态入口守卫。
复现与现读:node scripts/check-direct-run-guard.mjs(全量档判 HEAD blob 只报数,差值棘轮只拦本次新增)
修法只有一个:在文件末尾按 AGENTS.md §22d 那四行补守卫(main() 位置不动,只决定何时触发),
  并把判据单元 export 成 __test__ 供 §22c 镜像测试调用;禁止为变绿去删用例或放宽形态清单。
紧急跳过:HUSKY_SKIP_DIRECT_RUN_GUARD=1(跳过即放弃「新脚本必须可导入」这一不变量,须在提交信息写明理由与清偿票)
具名台账唯一出口:scripts/data/direct-run-guard-exemptions.json(逐条 path+reason+reviewBy,过期即回到队列)。
```

#### [195] 事务体内取消探测对账(db.transaction 回调体内不得 throwIfAborted/signal.aborted)

```

取消检查必须落在事务边界外;紧急跳过 HUSKY_SKIP_TXN_CANCEL_BOUNDARY=1(跳过即放弃 G-815960 那格不变量,须在提交信息写明理由)

```

#### [199] 派生把 stdout 丢掉/直通终端、同一作用域却又读它 ⇒ 结论恒 null,门把"没拿到"写成"机器态未判定"并 exit 0(立因 G-1108372)

```

  ❌ 本门拦的是**反极性**:标量 stdio:"ignore" 对三个通道同时生效,而该调用靠 stdout 拿结论。
     改法 = stdio: ["ignore","pipe","pipe"](stdin 关掉、输出收),不是给"不吃输出"的调用加豁免。
  💡 与 check-git-stdio-discipline / check-spawn-stdio 的分工:那两道判"缺 stdio / 写 pipe 也算病";
     本门只问"stdout 通道被丢了却还有人读"。并进去会把正当写法判红(AGENTS §12e 恒红门同型)。
  📖 判据唯一实现 scripts/lib/spawn-output-channel.mjs;本型**没有行内豁免通道也没有基线**。

```

#### [200] provider 健康四档单一真相源对账(值域并表后不得再分叉)

```

1) 本门判的是 provider 健康档位 unknown/healthy/degraded/down 的单一真相源:canonical 住在 apps/web/app/(main)/settings/llm/types-v2.ts 的 PROVIDER_HEALTH_STATUSES(2026-10-07 机主拍板并表);
2) 红 = 全仓出现第二份同值档位声明,或 canonical 被摘线/改值域 ⇒ 把重复那份改为 import canonical(类型或 as const 数组),不要改任一侧取值、不要加豁免;
3) 真子集(残缺表)与同名不同域只报名不判红 —— 补齐到全档即翻红,那是预期行为,不是门坏了;
4) 单复验:node scripts/check-provider-health-vocabulary.mjs --strict(问责档)/ --staged --strict(提交链档)/ --self-test;
5) 应急跳过(不推荐,跳过即放弃这次并表防回潮):HUSKY_SKIP_PROVIDER_HEALTH_VOCAB=1 git commit ...

```

#### [201] 📱 mobile-rn Expo 配置必须产出单调递增的 versionCode/buildNumber(app.json 无 versionCode ⇒ Expo 默认恒 1,覆盖安装必被 Android 降级保护拒;2026-10-12 装机实测)

```

  ❌ 本门拦的是"版本号回潮":app.json 不声明 android.versionCode 时 Expo prebuild 默认恒为 1,
     CI nightly 包覆盖任何更高版本号的构建必被降级保护拒(install -r / -d / uninstall -k 全试过,
     只有全删重装一条路,本地登录态全丢)。iOS 同病:无 ios.buildNumber ⇒ CFBundleVersion 恒 1。
  💡 判据不扫源码正则,而是以 Expo 同构语义执行被审面 app.config.js(type:module,落 .cjs 载入),
     审计产出的 android.versionCode / ios.buildNumber;号段边界 FLOOR/CEILING 由 app.config.js
     导出、本门读取,不写第二份。修复出口(二选一):① 恢复 resolveBuildNumber 注入;
     ② 确需钉号设 IHUI_VERSION_CODE(正整数 ∈ [26010100, 2100000000])。不得为消红删导出或削判据。
  📖 单复验:node scripts/check-mobile-version-code.mjs --self-test / --staged / --worktree / --json

```

#### [202] 📱 移动端 release 打包步必须能看到 EXPO_PUBLIC_API_BASE_URL(只挂 prebuild 步 ⇒ 打包期内联 localhost:8802,线上全量断网;2026-10-13 装机实测)

```

  ❌ 本门拦的是"基址没被内联进产物":把它只挂在 `expo prebuild` 那一步的 env 上没用 ——
     真正求值并内联 process.env.EXPO_PUBLIC_* 的是打包器(gradle 的 createBundleReleaseJsAndAssets /
     xcodebuild 的 Bundle React Native)跑 metro+babel 的转换期,那一步不在 prebuild 的 env 作用域里。
     实测后果:产物里 https://api.aizhs.top 命中 0 次、http://localhost:8802 命中 1 次,
     且包 targetSdk=36 无 usesCleartextTraffic ⇒ 明文回环也被拦 ⇒ 登录页恒「网络连接异常」。
  💡 修复出口(二选一,不得为消红削判据):① 提到 job 级 env(见 mobile-apk-build.yml 的 jobs.apk.env)
     或打包步自身的 env(iOS 现状),使打包器转换期可见;② 确需换基址时同步改
     apps/mobile-rn/eas.json 的 build.production.env(本门以它为单一真相)。
  📖 单复验:node scripts/check-mobile-api-base-bake.mjs --self-test / --staged / --worktree / --strict / --json

```

#### [203] 🧾 台账同题多号差值棘轮:PROJECT_PLAN.md 索引面不得比 HEAD 面多出「同一件事的第二次登记」(换了个编号也算,2026-10-13 机主拍板根治)

```

  ❌ 本门拦的是「同题多号」—— 同一件事在台账上挂着多个编号。复合主键(编号+题面前缀)
     换个编号即通过,所以并发取号撞车后让号重登 / union 并集回流 / 回捞复位三条路径
     每次都往台账各抄一份(立项现读单组最多 22 行),派单口径被同题灌水 ⇒「任务永远做不完」。
  💡 判据 = 标题指纹(归一化标题,剥编号/日期/〔〕注记)的**成员键计数**只许变少:
     锚点取 HEAD:PROJECT_PLAN.md,候选取索引 blob(本次提交真会带走的那一份)。
     存量组只报数不拦(判存量 = 恒红门,§12e);组内多挂一个号、新增一整组、
     同题同号再抄一份,三型都在计数维上判红(组数维对「清一组 + 新增一组」恒绿)。
  🛠 修法(择一,禁止为消红放宽判据或摘掉指纹维):
     ① 让号/重登必须**旧行同批**加〔【归并】同题多号收拢〕指针或删掉 —— 只增不删就是重复登记;
     ② 确属另一件事 ⇒ 把题面写到取不出同一个指纹(换编号不算改题);
     ③ 登记一律走 live-doc-edit 的 {{NEXT_ID}} 令牌(发号前已查同题,命中拒发),别手填号。
  📖 单复验:node scripts/check-plan-task-duplicates.mjs --self-test(18 例) / --ratchet(索引面 vs HEAD 面) / --staged --ratchet;默认档只报数,--strict 问责。
  ⚠️ 应急跳过:HUSKY_SKIP_PLAN_DUP_TITLE=1(跳过即放弃「同一件事只有一行当前状态」这条不变量,须在提交信息写明理由与清偿票)

```

#### [204] 🧭 错误归因唯一出口(blocking,生产面不得出现第二份 `.message.includes(` 归因判定;调用点必须走 packages/shared 的 attributeError)

```

  💡 三条判据缺一不可(缺一条,这道门就是"看着在判"的摆设):
     ① 反第二份 —— 生产面出现 `.message.includes(` / `.message?.includes(` 形态的错误文本判定 ⇒ 判红。
        上游把同一判定散在 40 处是反面教材;本票同批把存量清零,此后**任何**一处即红(不设棘轮)。
     ② 引用出口 —— 调用 attributeError( 的生产文件必须从唯一出口导入;出口必须至少有一个**端外**
        生产消费者(只有 barrel re-export 不算 —— 出口零消费者 = 判据挂在半空,只判了纯形状)。
     ③ 反向锁 —— 站点键 = 文件 + 行 + 列 + 该处**原文**片段,绝不按文本归并、也绝不按归因结果归并
        (按结果去重会把第二处违规抹平:「超时」与「timeout」是同一规则的两个 needle,但它们是两处判定)。
  🛠 修法:新错误源进 packages/shared/src/utils/error-attribution.ts 加规则,调用点 import attributeError;
     禁止在调用点再抄一份 message 文本判定 —— 判据只认"调用唯一出口",不认"内容看着一样"。
  📖 单复验:node scripts/check-error-attribution-single-source.mjs(全量档,判 HEAD blob)/
     --staged(提交链档,判索引 blob)/ --worktree(仅人工)/ --self-test
  ⚠️ 应急跳过:HUSKY_SKIP_ERROR_ATTRIBUTION_SINGLE_SOURCE=1(须在提交信息写明理由与清偿票)

```

#### [205] 🧩 未知枚举兜底档(blocking,闭集状态的未命中分支兜初始态 ⇒ 红;未知值必须落「不再产生副作用」那一档)

```

  💡 题面:未知枚举的兜底档必须是"不再产生副作用"那一档。兜到初始态等于把**已终态的账**
     放回可写集合(上游反例 session-inputs.ts:369-391:未知 status→'admitted',已终态行重新
     进入可 settle 集合,与状态前置 CAS 相互拆台)。
  🔍 判据(结构/语义特征点名,不扫注释词面):候选 = 闭集状态集合的成员判定
     `SET.includes(v)` / `SET.has(v)`(SET 须含 status/state 语义且是集合形),或唯一出口
     `coerceKnownOr(v, known, safe)` 的 safe 实参;取档 = 未命中分支的落点(三元 else /
     `if (!TEST) return|throw|continue|break` / 块内首个 return)。
  🛠 修法(档位词表):初始态/可写档(pending/running/admitted/open/draft/…)⇒ 红;
     终态档(closed/completed/failed/cancelled/unknown/…)或显式拒绝(null/throw/continue/break)⇒ 绿;
     两表皆不中、标识符不可解析、表达式落点 ⇒ 中性不判(这是反向锁,防"语义不同形"被词面误伤)。
  📖 单复验:node scripts/check-enum-fallback-terminal.mjs --self-test(11 例)/ --staged(本次暂存变更,
     判索引 blob)/ --worktree(仅人工逃生舱)/ 不带旗 = 全量档判 HEAD blob;镜像测试 6 例。
  ⚠️ 应急跳过:HUSKY_SKIP_ENUM_FALLBACK_TERMINAL=1(须在提交信息写明理由与清偿票)

```

#### [206] 🔢 错误码不得按文本判(blocking,新增分支按 err.message/includes(\

```

  💡 判据与预筛**同源**(都由 TEXT_OPS 派生)—— 预筛漏一个算子,门就对该算子整型失明而账面报绿
     (守门 102:预筛必须是判据字面量超集)。遮噪方向**刻意只遮注释、保留字符串**:本门要判的
     就是 `includes('429')` 里那个字面量,整条遮字符串 = 对该形态全盲,而全盲的门报出来的是
     最贵的那种假绿(门 131 正是被自己写的解释判红的)。
  🔍 射程 = apps/ 与 packages/ 的 .ts/.tsx/.js/.jsx;测试面不判红但**必须报名**(--all 逐文件量),
     因为把"按文本判"当契约钉在测试里,会让缺陷从"实现里的一处疏忽"升级成"改了就红"的锁。
  🛠 修法:让抛出方给码(new ToolError(code, message)),消费侧 resolveFailureCode(err, site) 读码;
     确属正当形态(断言外部驱动的真实文本)加行内豁免 `error-code-exempt: <原因>`,到期由守门 108 追。
  📖 单复验:node scripts/check-error-code-not-text-matching.mjs --self-test(12 例)/ --staged / --worktree /
     --all / --json;镜像测试 12 例(T10 即"门已入库就必须已接线"的问责)。
  ⚠️ 应急跳过:HUSKY_SKIP_ERROR_CODE_TEXT_MATCHING=1(须在提交信息写明理由与清偿票)

```

#### [208] 🪆 工作区嵌套 git 仓零容忍(blocking,0 存量棘轮;演练/夹具仓被 IDE 源代码管理扫成「暂存的更改 10000+ 全 D」幻影)

```

  💡 工作树里出现嵌套 .git —— 2026-10-14 的「暂存的更改 10000+(全 D)」幻影就是这么来的:
     IDE 把嵌套仓当独立仓库扫描,而主仓命令行面自始至终干净,机主因此看不出有没有活没交。
  🔍 定位:node scripts/check-no-nested-git.mjs(逐条点名绝对路径)
  🛠 修法:① 夹具/演练仓无留存价值 → 删目录或只摘 .git(大目录走 robocopy /MIR,§5e-2);
          ② 测试基建要临时仓 → 落点改 scripts/lib/scratch-dir.mjs 的 mkScratch()(工作区外+退出回收);
          ③ 确属合法 → 不许静默豁免:门脚本加显式常量 + 因由 + §22c 镜像对账(.worktrees 顶层已在射程外)。
  ⚠️ 应急跳过:HUSKY_SKIP_NO_NESTED_GIT=1(须在提交信息写明理由与清偿票)

```

#### [210] 📐 TS/Python 行切分口径逐例同值对账(warn;§0.9 造好没装车那一格)

```

  尺子 scripts/check-line-split-parity.mjs 早在库,现读「P1 行切分 22 例 / P2 改动行 32 例 | 漂移 0 / 未判定 0 ✅ 两侧逐例同值」,
  但提交链/CI 注册点逐处 grep 命中 0 ⇒ "复刻 llm.py 口径"只在有人手动跑时才成立(§0.9)。本次以 warn 接入:三态同值/漂移/未判定绝不并桶,
  取不到对照解释器 exit 2 拒绝出具合格证(现走仓内 apps/ai-service/.venv,不猜 PATH 上的 python)。
  升 blocking 的前置(§12e):先给 CI 一条能稳定取到对照解释器的通道,否则在无 venv 的机器上会把每次提交顶成"未判定"。

```

#### [211] 🧮 PROJECT_PLAN 号池对账(声明位号 >999 按重数差值棘轮;R2 发号路径点名,warn)

```

  现值以门体与 runner 双向一致为准(门 89 R10/R12 会核对);
  单独复验:node scripts/check-plan-id-pool.mjs [--staged|--json];
  自检:node scripts/check-plan-id-pool.mjs --self-test(4 组判据 · 阳性对照 5 条);
  取证长号是谁的:node scripts/check-plan-id-pool.mjs --json 看 stock 列表;
  修法:用正牌取号器换池内空闲号并留改号尾注(node scripts/next-plan-id.mjs 报池内空闲清单);
  紧急跳过(不推荐):HUSKY_SKIP_PLAN_ID_POOL=1 git commit ...

```

#### [215] 🎨 RN 端硬编码 hex 基线棘轮(基线之外新增 #hex 即 BLOCK,存量只减不增)

```

  改法:把 #hex 换成 @ihui/design-tokens(rnLightTokens/rnDarkTokens)的 token 引用,不要新造近似色。
  存量治理后可运行 node scripts/check-mobile-rn-style-parity.mjs --update-baseline 收紧基线(全量档,不得与 --staged 同用)。
  取材口径:全量=HEAD blob、--staged=索引 blob、--worktree=人工排查;取不到 ⇒ exit 2 无法判定。
  自检:node scripts/check-mobile-rn-style-parity.mjs --self-test

```

#### [150] 角色档合规对账(元素类别→档位,77 不判的那一型)

```

  这道门问的不是"有没有绕档位表写死数字"(那是守门 77),而是"这一类元素取了角色表里的哪一档"。
  修法只有一个:改成 packages/design-tokens/src/radius.js 的 RADIUS_ROLES 指定的那一档
  (tiny→xs / control→sm / chip→md / card→lg / panel→xl / hero→2xl)。
  确属新元素类别 ⇒ 先在 RADIUS_ROLES 加角色并同笔给出消费方,不得为消红放宽判据。
  圆角豁免通道已整体废除(2026-09-29 O81 票㊵):标记不改变任何结论,而写标记本身由守门 77 的 B8 判红。
  自验:node scripts/check-radius-role-conformance.mjs --files <你改的文件>;
  存量还剩多少:同命令加 --json(数字一律现读,勿照文档抄)。
  紧急跳过:HUSKY_SKIP_RADIUS_ROLE_CONFORMANCE=1(仅限红确属他人文件时)。
```

#### [170] 🛰 旁路落地声明面对账(blocking,留痕声明面 ⊉ 实际面 ∧ 射程外路径写回旧 blob ⇒ 红并点名;增量台账每枚判一次)

```

  💡 G-978069 那一型:旁路入库(object-space-land / live-doc-edit / commit-tree+CAS)的提交把
     **声明路径之外**的路径按旧副本整文件写回,吞掉别人已入库的内容 —— 提交链三道门(84 R1 /
     100 / 30c)都跑在钩子里,拦不到结构上不跑钩子的旁路通道;本门按留痕日志事后逐枚复量。
     修复只有前向回补(§22 不重写历史):按被吞内容的原 blob 重新落地,参照 cfabf3128a 的形态;
     判红已记入增量台账(.workbuddy/bypass-landing-scope-audited.json),不会反复红,但内容必须修。
     单独复验:node scripts/check-bypass-landing-scope.mjs
```

#### [172] 🛡  跳门变量承诺/兑现对账(blocking,文档承诺的 HUSKY_SKIP_* 必须有真实读点;差值棘轮只拦新增)

```

  💡 新增的假承诺:文档(AGENTS.md/README.md)新写了一条 `HUSKY_SKIP_X=1` 出路,而代码里没人读它。
     修法只有两条:① 给该变量接真实读取点(或 runner 注册块 skipEnv 一行);② 把文档那句改成如实
     措辞(禁令/说明),不要承诺一条跑不通的出路。存量假承诺不拦本次提交,可用 --strict 点名问责。
     应急放行:HUSKY_SKIP_SKIP_ENV_PROMISE=1 git commit ...(commit message 写明责任归属)。
```

#### [186] loadState 四档投影防漂移对账(LV1 四档字面量零散落 + LV2 五族 get_status 的 loadState 键与共享出口来源;warn 起步)

```

LV1:`"never_tried"` / `"retry_backoff"` / `"gave_up"` 三档字面量只许住在 _load_lifecycle.py 一个文件;
     第二个服务文件逐字写出即红(下一次改动只改一处 ⇒ 四档语义分叉而两端都自洽)。
LV2:五族(ab_test_tracker / meta_learner / federated_learner / memory_decay / user_profile)的
     get_status 必须含 loadState 键,且其值必须来自共享出口 state_label(...) / LoadRecord.state_label()。
  ⚠️ per-key 族(memory_decay / user_profile)**刻意不用** loaded / loadFailures 键名(同名不同义是最坏的
     下游陷阱)——**不得**为"看起来一致"给它们补上这两个键;要改语义得另开一票动下游。
定级 warn 是设计前提(照守门 156 的教训):接 blocking 就是让每台每次提交被逼 --no-verify,
     一次绕过等于全部守门对该提交作废(AGENTS §12e/§12f)。存量与新增在报告里同列,不靠棘轮遮盖。
问责跑 node scripts/check-load-state-projection-parity.mjs --strict;应急跳过 HUSKY_SKIP_LOAD_STATE_PROJECTION_PARITY=1。

```

#### [187] 不安全加载标记四形态扫描(finally-set / except-set / tail-set / set-add;判据本体单份住在 _load_lifecycle.py,门内零自行判定;blocking)

```

判据:调用 _load_lifecycle.py 的 find_unsafe_loaded_marks(AST + 控制流位置),四形态逐条点名 path:line ——
     ① finally 块里无条件 `self._loaded = True`(读失败也被记成已加载);
     ② except 体内置真(异常分支被折成"已加载"哨兵,与成功路径不可判别);
     ③ try/except 同块尾随置真(异常兜底之后无条件固化);
     ④ 集合 add 记"已加载"(集合表达不了"试过了但没读到")。
改法:置真只许落在成功路径与权威写入上;失败计数走 _load_lifecycle 的共享出口
     (load_failures / 退避 / gave_up),别自己另写一套。
⚠️ 单份实现纪律:判据只有一份,住在 _load_lifecycle.py。**不得**在门里或任何新模块里再抄一份正则/AST 判据 ——
     两处算同一件事必漂移,且抄的那份会随被审面演化而唯一实现不动,两端各自自洽。
⚠️ 覆盖面:扫描面是 app/**/*.py,**刻意不含 tests/****(测试注入会主动置真,扫进来即恒红)。
     本门绿只意味着 app/** 侧无不安全载体,**不得**外推为"全仓 _loaded 载体合规"。
定级 blocking 与姊妹门 186(warn)不同的理由:186 的"恒红门"前提在本门不成立 —— 存量面
     (HEAD app/** 590 个 .py / 12.6MB)实测零命中,--strict 实测 rc=0,且判定面取自 blob
     (不读工作树半编辑态,并发会话不会误伤)。所以 187 一旦有红是真新增,正是提交链该拦的那类。
未判定(面取不到 / Python 派生失败 / SyntaxError / 判据符号缺失)= exit 2,既不冒红也不记绿;
     "看不见"绝不能记成通过 —— 一台永远喊未判定的门和一台瞎掉的门在账面上是一样的。
问责跑 node scripts/check-load-state-loaded-marks.mjs --strict;应急跳过 HUSKY_SKIP_LOAD_STATE_LOADED_MARKS=1。

```

#### [188] 🔐 授权判据列隔离(blocking,拦「归属判据所在的 SELECT 顺带取了展示列」—— 展示字段损坏会把授权查询拖成 500 而不是 403/404;判据本体单份住在 check-authorization-column-isolation.mjs,门内零自行判定)

```

  💡 本门守的是「认证≠授权」的姊妹型:不是没校验身份,是**校验身份的那条查询被展示面
     的数据质量绑架了** —— 归属判据 SELECT 里带了 content/title/display_name 这类展示列,
     展示列一坏(脏数据/超长/编码坏)整条查询失败 ⇒ 请求返 500 而不是 403/404。
  判据 = 归属轴谓词(必要) ∧ 下游存在存在性判决分支(充分)。**WHERE 里有 user_id 不等于
     这条查询在做授权判决** —— 列表/检索/导出端点的 user_id 过滤只是范围过滤,
     后面没有 `if not row: 404` 就不是判据(首版据此误报 11 处,实测教训已写进头注)。
  SELECT * 不判红只报数:星号含不含展示列取决于表结构(DDL 不在Python 源里),
     一刀切判红已被实测证伪(sweep_logs 整表 5 列零展示列)。
  ⚠️ 真修复**必须放行**:存量命中因"展示列被摘掉"而消失时只报数、不判红 —— 首版护栏
     把自己修的那四处判成了"删查询消红"并拦下,护栏挡正确修复比没护门更坏。
  修复出口(二选一,不得为消红削判据):① 为归属判据单开一条窄查询,只 SELECT 判据所需列
     (owner_user_id / user_id / 主键),展示列一概不取,展示路径另走自己那条查询
     (参考 sso_identity_store.py 的 SELECT id, user_uuid + 独立 UPDATE email/name、
     approval_persistence.py 的 SELECT 1);② 确属载荷列(业务键/缓存镜像,已在白名单)
     ⇒ 在脚本 LOAD_BEARING_COLUMNS 逐条登记证据,禁止按目录整片放行。
  ① 现读:node scripts/check-authorization-column-isolation.mjs [--json|--staged|--worktree|--strict]
  ② 自检:node scripts/check-authorization-column-isolation.mjs --self-test(39 例,正反成对)
  ③ 镜像:node --test scripts/tests/check-authorization-column-isolation.test.mjs(13 例)
  紧急跳过(不推荐):HUSKY_SKIP_AUTHZ_COLUMN_ISOLATION=1 git commit ...

```

#### [196] 📎 PROJECT_PLAN.md 短 sha 出处指针防回潮(新增行裸短 sha 须走台账/声明前缀/文件名通道,warn)

```

  💡 台账新增行里出现裸短 sha(7–12 位十六进制)且不属于任一放行通道 —— 票 G-1079146。
     放行通道(判据侧,按序):①具名台账 scripts/data/plan-sha-noncommit.json 命中
       (token+kind+reason+reviewBy,30 天复核,台账唯一通道,行内 -exempt 标记不构成放行);
     ②声明表前缀行(revision= / 上游仓库: / 冻结上游 … 结尾紧贴 token);
     ③文件名/ref 形态(path.ext、分支段 —— 不是提交指针)。40 位全量 sha 与形状歧义不进判。
     修法:改 40 位全量 / 把缩写带 reason+reviewBy 登记进台账 / 改写为声明表行。
     台账缺字段/日期非法/到期/被审面没命中(清单腐烂)/重复 ⇒ 两档皆红,由本门同判。
     单独复验:node scripts/check-plan-sha-form.mjs --staged
     自检:node scripts/check-plan-sha-form.mjs --self-test(26 例)
     量算尺(可解析性现读):node scripts/check-plan-sha-resolvable.mjs

```

#### [197] 📉 truncated 声明块计数伴随 + 投递档位收口绊线(DTO 类型层,warn)

```

  💡 有界列表截断诚实(票 G-998100/G-998101,观察档):
     ① truncated 声明块裸奔 = interface/type/z.object 块里数组成员 + truncated 却无计数/总量型
        数值兄弟键 ⇒ 同块补 total/unlisted/omitted/… 计数键(正型:packages/types/src/api-contracts.ts
        BoundedListProjection)。函数体/if 块里的同名局部不判。
     ② 档位/流过滤词表命中(deliveryProfile/streamTier/…)= "决定砍"已发生的绊线 ⇒ 收口不变量
        (被 profile 过滤的事件必须最终被某个不可过滤事件收口 + live 直连与 Last-Event-ID 重放两路
        终态逐字节一致测试)必须同期落地;字符串槽位/注释提及只报数不判红(绊线咬代码标识符)。
     单独复验:node scripts/check-truncation-accounting.mjs --staged
     自检:node scripts/check-truncation-accounting.mjs --self-test(23 例)
     全量档(HEAD 面)只报数恒 exit 0(棘轮:改到哪只咬哪);Python 面只报数不判。

```

#### [198] ⏱️  DB 盲写 updatedAt 棘轮(blocking,拦「.set({ ...data, updatedAt: new Date() })」无条件覆盖形态回潮 —— 它把增量读的 updatedAt 消费源污染成假变化)

```

  💡 立票凭据(G-998153,2026-10-09):HEAD 面该形态 329 处/130 文件,而 2026-10-02 登记的
     基线是 326 ⇒ 已被并行提交无声顶破一次。updatedAt 是增量读的消费源
     (routes/tasks.ts:378 since 补拉、admin-extended/user-routes.ts:220 gte 七日窗口),
     同值空写把「没变」伪装成「变过」,WS 重连补拉被假变化污染。
  出路:改成「先取现值、按键比较,只有真变化进 set;无变化不发 UPDATE、不盖 updatedAt」
     (出口形态见 apps/api/src/db/admin-sys-queries.ts 的 updateMenu,展开名固定用
     ...changed 才受本门豁免);确实必须无条件盖时,先立票收窄基线 —— 基线只许收窄
     (scripts/db-blind-updatedat-baseline.json),不许靠放宽消红。
  单独复验:node scripts/check-db-blind-updatedat-set.mjs [--staged|--json]
     自检:node scripts/check-db-blind-updatedat-set.mjs --self-test(7 例)
  紧急跳过(不推荐):HUSKY_SKIP_DB_BLIND_UPDATEDAT=1 git commit ...

```

---

## 2. P2-G: warn→blocking 升级时间表

按升级优先级分 4 档：**短期**（1-2 周）/ **中长期**（1-3 个月）/ **待评估** / **永久 warn**。
分类依据：guardian-runner.mjs 源码注释 + AGENTS.md §"守门脚本速查" + 实际依赖评估。

### 2.1 短期升级（1-2 周）

已有明确"观察期无误报即升级"评估结论。

| ID | Label | 建议升级时间 | 前置条件 | 风险点 |
|----|-------|--------------|----------|--------|
| — | — | — | — | — |

### 2.2 中长期升级（1-3 个月）

依赖外部条件（脚本修复、子模块稳定）才能升级。

| ID | Label | 建议升级时间 | 前置条件 | 风险点 |
|----|-------|--------------|----------|--------|
| — | — | — | — | — |

### 2.3 待评估

warn-only 起步，无明确升级计划，需触发条件。

| ID | Label | 评估时间点 | 触发条件 | 风险点 |
|----|-------|------------|----------|--------|
| 2f-cli | 🌐 cli i18n parity 守门(warn-only,2026-07-28 立) | 按需 | cli 端 i18n 体量增长后评估(当前 63 行) | 体量过小,升级收益低 |

### 2.4 永久 warn（不升级）

设计上选择 warn 而非 blocking，原因明确，无升级计划。

| ID | Label | 永久 warn 原因 |
|----|-------|----------------|
| 13b | 📐 PROJECT_PLAN.md 体积(warn-only) | PLAN 体积超限不应阻塞 commit,仅提醒(脚本名已标 warn-only) |
| 19 | ⚠️  staged 污染预警(warn-only) | 跨 agent 协作场景复杂,机械阻塞会误伤正常 commit |
| 21 | 🌐 多端同步开发守门(warn-only) | 平台独占豁免需人工判断,无法机械阻塞(AGENTS.md §9 明确 warn-only) |
| 22 | 📖 README 同步守门(warn-only) | bug 修复/重构场景合理不更新 README(AGENTS.md §21 豁免场景) |
| 24b | 🔌 端口注册表守门(warn-only,monorepo-wide 全量) | 端口冲突可后期修复,不应阻塞 commit |

### 2.5 未分类 warn 项

以下 warn 项未在 UPGRADE_TIMELINE 配置中，需补充评估。

| ID | Label | Script |
|----|-------|--------|
| 3 | 🗄️ schema drift | check-db-schema-drift.mjs |
| 45 | 🛡️  C 盘路径硬编码扫描(warn-only,AGENTS.md §26) | check-c-drive-paths.mjs |
| 54 | ⏳ 未提交源码改动年龄守门(warn-only,B14 防工作树改动被并行 checkout 抹掉) | check-uncommitted-age.mjs |
| 76 | 📋  迁移账本带外对象防回潮(warn-only,O20e:journal 序号全集 vs 账本行全集) | check-migration-ledger-drift.mjs |
| 86 | 🗂  verify-*.mjs 临时验证文件落点(warn,AGENTS §25 配套,补装) | check-verify-tmp-files.mjs |
| 92 | 💽 C 盘污染实地扫描(warn,拦"源码没写死但东西真掉在 C 盘") | check-c-drive-pollution.mjs |
| 96 | 🏠 §26 家目录改道完整性(warn,机器态与 diff 无关 ⇒ 不拦提交链,回潮即打红字) | check-home-junctions.mjs |
| 110 | 📦 产物预算对账(warn,交付出去的产物第一次有上限表:主包口径 / 悬空 sourceMappingURL 引用) | check-artifact-budget.mjs |
| 114 | 🧪 测试收集存续性对账(warn,收集失败套件必须为 0;断言失败不混计) | check-test-collection-runs.mjs |
| 153 | 🛡️ 服务二进制路径存续性对账(判机器状态:nssm 各服务 Application 绝对路径存在性;三态不并桶,§12e 只能 warn) | check-service-binary-paths.mjs |
| 154 | 临时夹具 scratch 根二阶嵌套巡检(只报不删,三态含未判定) | check-scratch-root-no-nesting.mjs |
| 155 | 镜像测试临时夹具落点对账(默认只报名,--strict 才判红) | check-fixture-tmpdir.mjs |
| 156 | 自检用例登记侧的求值配对对账(登记不求值 ∧ 用例传函数 ⇒ 才判红;潜伏档只报数) | check-selftest-registrant-evaluates.mjs |
| 190 | 枚举/映射取不到时的兜底分支不得落到更宽的权限或能力档(票 G-816027):宽档集合由被审面的两份注册表(TS POLICY_BY_MODE / PY skips_approval_permission_mode)现读推导,推导失败或槽位撞名一律未判定;与"凭据在场即豁免"那道门(157)不重叠计账 | check-enum-default-widening.mjs |
| 191 | 测试判据复制对账(§22c 跨门尺子;门体与镜像测试各写一份形态清单/正则即点名,存量 27 处只报数 ⇒ warn,升 blocking 前置 = 命中归零) | check-test-judge-not-replicated.mjs |
| 210 | 📐 TS/Python 行切分口径逐例同值对账(warn;§0.9 造好没装车那一格) | check-line-split-parity.mjs |
| 211 | 🧮 PROJECT_PLAN 号池对账(声明位号 >999 按重数差值棘轮;R2 发号路径点名,warn) | check-plan-id-pool.mjs |
| 186 | loadState 四档投影防漂移对账(LV1 四档字面量零散落 + LV2 五族 get_status 的 loadState 键与共享出口来源;warn 起步) | check-load-state-projection-parity.mjs |
| 196 | 📎 PROJECT_PLAN.md 短 sha 出处指针防回潮(新增行裸短 sha 须走台账/声明前缀/文件名通道,warn) | check-plan-sha-form.mjs |
| 197 | 📉 truncated 声明块计数伴随 + 投递档位收口绊线(DTO 类型层,warn) | check-truncation-accounting.mjs |

---

## 3. P2-H: id 命名空间重构建议

### 3.1 现状问题

- ID 是数字 1-38 + 字母后缀（2b/2c/2d/2e/2f/4b/4c/13b/13c/24a/24b/30a 等）
- 数字无语义，新增项需查表找下一个可用编号（源码注释显示 35/36/37/38 都因编号冲突而改用其他数字）
- 字母后缀规则不统一（2b/2c 表示同主题子项，但 4b/4c/13b/13c 含义不同）
- ID 与脚本名无映射关系（id=2 → check-i18n-keys.mjs，需查文档）

### 3.2 重构方案：分层命名空间

格式：`<category>/<topic>[-<subtopic>]`

| 分类 | 范围 | 示例 |
|------|------|------|
| `security/` | 安全相关 | `security/api-key-leak` |
| `i18n/` | 国际化（parity / 残留检测 / 流水线 / 完整性） | `i18n/parity-web`、`i18n/zh-tw-residue` |
| `code-quality/` | 代码质量（schema / dist / 路由 / 类型） | `code-quality/schema-drift` |
| `ui/` | UI 样式（圆角 / z-index / token / tooltip） | `ui/rounded-full`、`ui/z-index` |
| `engineering/` | 工程约束（PLAN / 多端同步 / README） | `engineering/multi-end-sync` |
| `workspace/` | 工作区卫生 | `workspace/external-paths` |
| `commit-loss/` | 防提交丢失 | `commit-loss/guard` |
| `push/` | Push 同步 | `push/sync` |
| `dependencies/` | 依赖治理 | `dependencies/solito-residue` |
| `llm/` | LLM 配置 | `llm/provider-schema` |

### 3.3 完整映射表（数字 ID → 语义化 ID）

按 guardian-runner.mjs 出现顺序排列。

| 数字 ID | 语义化 ID | Label | Script |
|---------|-----------|-------|--------|
| 1 | `security/api-key-leak` | 🔐 API key 泄露 | check-api-key-leak.mjs |
| 2 | `i18n/parity-web` | 🌐 i18n 键完整性 | check-i18n-keys.mjs |
| 2b | `i18n/zh-tw-residue-web` | 🔍 zh-TW 简体字残留 | scan-i18n-zh-residue.mjs |
| 2c | `i18n/ko-residue-web` | 🔍 ko.json 中文残留 | scan-i18n-zh-residue.mjs |
| 2e | `i18n/en-broken-web` | 🔍 en.json 破碎英文 | check-i18n-broken-en.mjs |
| 2e-dupns | `—（待补充）` | 🧬 i18n 重复命名空间/重复键(blocking,防 JSON last-wins 静默遮蔽) | check-i18n-duplicate-namespaces.mjs |
| 2f-web | `i18n/pipeline-web` | 🌐 i18n AI 翻译流水线(blocking) | i18n-diff.mjs |
| 2f-miniapp-taro | `i18n/pipeline-miniapp-taro` | 🌐 [miniapp-taro] i18n AI 翻译流水线(blocking) | i18n-diff.mjs |
| 2g-web | `i18n/namespace-passing-web` | 🔍 i18n 命名空间传递(web→共享组件) | check-i18n-namespace-passing.mjs |
| 3 | `code-quality/schema-drift` | 🗄️ schema drift | check-db-schema-drift.mjs |
| 4 | `code-quality/stale-dist` | 📦 packages 陈旧 dist | check-stale-dist.mjs |
| 4b | `code-quality/dist-utf8` | 🔤 dist UTF-8 BOM | check-dist-encoding.mjs |
| 4c | `code-quality/api-client-utf8` | 🔤 api-client UTF-8 完整性 | check-api-client-utf8.mjs |
| 6 | `code-quality/sanitizer-bypass` | 🛡️ skipResponseSanitization | check-sanitizer-bypass.mjs |
| 7 | `code-quality/dedupe` | 📦 依赖碎片化 | check-dedupe.mjs |
| 8 | `code-quality/api-routes` | 🔗 前端↔后端路由一致性 | check-api-routes.mjs |
| 11 | `ui/rounded-full` | ⭕ 容器圆角违规 | check-rounded-full.mjs |
| 11b | `—（待补充）` | 📐 圆角溢出(父 rounded + 子 bg 贴边) | check-rounded-overflow.mjs |
| 11c | `—（待补充）` | 🏷️  选中态描边定稿防回退(禁纯黑/纯白,全站) | check-tagsview-visual.mjs |
| 11d | `—（待补充）` | 🚫 分割线违规(divide-y / divide-x) | check-no-divider.mjs |
| 11h | `—（待补充）` | 🚫 UI 图标位 emoji 违规(icon 字段/渲染位) | check-no-emoji-icons.mjs |
| 11e | `—（待补充）` | 📏 单文件行数上限 (仅拦新增) | check-file-size.mjs |
| 11f | `—（待补充）` | 🚫 原生 alert/confirm/prompt 弹窗 | check-no-native-dialog.mjs |
| 11g | `—（待补充）` | 🚫 mask-image 渐变遮罩 | check-no-mask-image.mjs |
| 12 | `engineering/delivery-report` | 📋 交付报告一致性 | check-delivery-report-consistency.mjs |
| 13c | `engineering/project-plan-archive` | 🗂️  PROJECT_PLAN.md 已完成任务防误删 | check-project-plan-archive.mjs |
| 15 | `engineering/migration-completeness` | 📊 迁移完整性(7 大类 29 子项) | check-api-migration-completeness.mjs |
| 17 | `ui/css-token-nesting` | 🎨 CSS 颜色 token 嵌套 | check-input-border-var.mjs |
| 18 | `ui/native-title-tooltip` | 🖱️  原生 title tooltip 违规 | check-native-title-tooltip.mjs |
| 20 | `ui/tailwind-class-conflict` | 🎯 Tailwind class 冲突 | check-tailwind-class-conflict.mjs |
| 24a | `ui/sidebar-width` | 📏 侧边栏宽度一致性 | check-sidebar-width-consistency.mjs |
| 25 | `workspace/external-paths` | 🧹 项目外路径违规(blocking) | check-workspace-hygiene.mjs |
| 26 | `workspace/parent-pollution` | 🛡️  项目父目录污染巡查(blocking) | check-parent-pollution.mjs |
| 27 | `ui/z-index` | 🛡️  z-index 层叠防护(防第三方 IDE 注入 + 遮罩 fade-in 回归 + 窗口按钮等效压暗) | check-z-index-guard.mjs |
| 28 | `ui/overlay-zindex` | 🛡️  全屏遮罩 z-index 层级(防 fixed inset-0 + z-50 复发) | check-overlay-zindex.mjs |
| 29 | `push/sync` | 🚀 Push 同步兜底(防"commit 后忘记 push"复发,AGENTS.md §21 第三道防线) | check-push-sync.mjs |
| 30 | `i18n/integrity` | 🛡️ i18n 文件完整性(防 prettier 截断事故复发) | validate-i18n-integrity.mjs |
| 30a | `commit-loss/guard` | 🛡️  Commit 丢失防护(blocking,AGENTS.md §22,防 reset / drop stash 误丢 commit) | check-commit-loss-guard.mjs |
| 30c | `—（待补充）` | 🛡️  陈旧副本守门(blocking,2026-09-14 338 快照事故配套,防 staged 区夹带历史版本回退) | check-stale-copy.mjs |
| 30b | `—（待补充）` | 🛡️  Stash 滞留源码改动守门(blocking,AGENTS.md §12d,防已完成工作滞留 stash 静默失联) | check-stale-stashes.mjs |
| 16c | `—（待补充）` | 🛡️  staged-typecheck 源/测镜像同步(blocking,AGENTS.md §22b 镜像同步义务) | check-staged-typecheck-mirror-sync.mjs |
| 45 | `—（待补充）` | 🛡️  C 盘路径硬编码扫描(warn-only,AGENTS.md §26) | check-c-drive-paths.mjs |
| 35 | `code-quality/mypy` | 🐍 mypy 类型检查(防 ai-service Python 类型回退) | check-mypy.mjs |
| 36 | `ui/design-tokens-miniapp-taro` | 🎨 [miniapp-taro] design-tokens 同步(防 app.css 漂移) | check-miniapp-tokens-sync.mjs |
| 37 | `ui/design-tokens-web` | 🎨 [web] design-tokens 同步(防 globals.css 漂移) | check-web-tokens-sync.mjs |
| 38 | `dependencies/solito-residue` | 🛡️  solito 幽灵依赖回归守门(blocking,防 P0 优化被回退) | check-solito-residue.mjs |
| 39 | `—（待补充）` | 📱 mobile-rn screen 迁移完整性(blocking,防独立实现回升) | check-rn-app-migration.mjs |
| 40 | `—（待补充）` | 🔗 共享层重复检测(blocking,防端内重新实现 shared hook/util) | check-shared-layer-duplication.mjs |
| 41 | `—（待补充）` | 🌿 单分支开发守门(blocking,AGENTS.md §9b) | check-single-branch.mjs |
| 2d | `i18n/ja-residue-web` | 🔍 ja.json 中文简体残留(blocking,常用汉字表精确判据) | scan-i18n-zh-residue.mjs |
| 2o-shared | `—（待补充）` | 🔍 [shared] ja.json 中文简体残留(blocking,常用汉字表精确判据) | scan-i18n-zh-residue.mjs |
| 2o-miniapp-taro | `—（待补充）` | 🔍 [miniapp-taro] ja.json 中文简体残留(blocking,常用汉字表精确判据) | scan-i18n-zh-residue.mjs |
| 2o-mobile-rn | `—（待补充）` | 🔍 [mobile-rn] ja.json 中文简体残留(blocking,常用汉字表精确判据) | scan-i18n-zh-residue.mjs |
| 2f-ext | `i18n/parity-extension` | 🌐 [extension] i18n 键完整性(blocking,2026-09-28 由 warn 升档) | check-i18n-keys.mjs |
| 2f-shared | `i18n/parity-shared` | 🌐 [shared] i18n 键完整性(blocking,零变更验证通过) | check-i18n-keys.mjs |
| 2g-ext | `i18n/zh-tw-residue-extension` | 🔍 [extension] zh-TW 简体字残留(blocking,2026-09-28 由 warn 升档) | scan-i18n-zh-residue.mjs |
| 2h-ext | `i18n/ko-residue-extension` | 🔍 [extension] ko.json 中文残留(blocking,2026-09-28 由 warn 升档) | scan-i18n-zh-residue.mjs |
| 2i-ext | `i18n/en-broken-extension` | 🔍 [extension] en.json 破碎英文(blocking,2026-09-28 由 warn 升档) | check-i18n-broken-en.mjs |
| 2j-shared | `i18n/zh-tw-residue-shared` | 🔍 [shared] zh-TW 简体字残留(blocking) | scan-i18n-zh-residue.mjs |
| 2p-api | `—（待补充）` | 🔍 [api] zh-TW 简体字残留(blocking,2026-10-05 补分面射程) | scan-i18n-zh-residue.mjs |
| 2q-cli | `—（待补充）` | 🔍 [cli] zh-TW 简体字残留(blocking,2026-10-05 补分面射程) | scan-i18n-zh-residue.mjs |
| 2r-miniapp-taro | `—（待补充）` | 🔍 [miniapp-taro] zh-TW 简体字残留(blocking,2026-10-05 补分面射程) | scan-i18n-zh-residue.mjs |
| 2s-mobile-rn | `—（待补充）` | 🔍 [mobile-rn] zh-TW 简体字残留(blocking,2026-10-05 补分面射程) | scan-i18n-zh-residue.mjs |
| 2t-api | `—（待补充）` | 🔍 [api] ko.json 中文残留(blocking,2026-10-05 补分面射程) | scan-i18n-zh-residue.mjs |
| 2u-cli | `—（待补充）` | 🔍 [cli] ko.json 中文残留(blocking,2026-10-05 补分面射程) | scan-i18n-zh-residue.mjs |
| 2v-miniapp-taro | `—（待补充）` | 🔍 [miniapp-taro] ko.json 中文残留(blocking,2026-10-05 补分面射程) | scan-i18n-zh-residue.mjs |
| 2w-mobile-rn | `—（待补充）` | 🔍 [mobile-rn] ko.json 中文残留(blocking,2026-10-05 补分面射程) | scan-i18n-zh-residue.mjs |
| 2k-shared | `i18n/ko-residue-shared` | 🔍 [shared] ko.json 中文残留(blocking) | scan-i18n-zh-residue.mjs |
| 2m-shared | `i18n/en-broken-shared` | 🔍 [shared] en.json 破碎英文(blocking) | check-i18n-broken-en.mjs |
| 2f-shared-diff | `i18n/pipeline-shared` | 🌐 [shared] i18n AI 翻译流水线(blocking) | i18n-diff.mjs |
| 2n-web | `i18n/parity-web-strict` | 🌐 [web] 5 语言 i18n parity 强制校验 (blocking,2026-08-02 升级,兜底 item 2 漏检场景) | check-i18n-keys.mjs |
| 2f-mobile-rn | `i18n/parity-mobile-rn` | 🌐 mobile-rn i18n parity 守门(blocking,2026-09-28 由 warn 升档;立票 2026-07-28) | check-i18n-keys.mjs |
| 2f-cli | `i18n/parity-cli` | 🌐 cli i18n parity 守门(warn-only,2026-07-28 立) | check-cli-i18n-parity.mjs |
| 9 | `code-quality/safe-parse` | 🔍 safeParse 静默忽略(blocking,2026-07-26 升级) | check-safe-parse.mjs |
| 13b | `engineering/project-plan-size` | 📐 PROJECT_PLAN.md 体积(warn-only) | check-project-plan-size.mjs |
| 19 | `engineering/staged-pollution` | ⚠️  staged 污染预警(warn-only) | check-staged-pollution.mjs |
| 21 | `engineering/multi-end-sync` | 🌐 多端同步开发守门(warn-only) | check-multi-end-sync.mjs |
| 22 | `engineering/readme-sync` | 📖 README 同步守门(warn-only) | check-readme-sync.mjs |
| 24b | `engineering/port-registry` | 🔌 端口注册表守门(warn-only,monorepo-wide 全量) | check-port-registry.mjs |
| 34 | `code-quality/ts-ignore` | 🔍 @ts-ignore 新增检测(blocking:存量已清零,只拦 staged 新增) | check-ts-ignore.mjs |
| 33 | `llm/provider-schema` | 🛡️  LLM provider schema 守门 (blocking,阶段 3 主体已落地) | check-llm-provider-schema.mjs |
| 42 | `—（待补充）` | 🛡️  React SyntheticEvent 闭包陷阱(防 popover 常驻显示复发) | check-event-closure-leak.mjs |
| 44 | `—（待补充）` | 🧹 根目录整洁守门(一级目录白名单) | check-root-dir-clean.mjs |
| 46 | `—（待补充）` | 🔙 统一返回键防私接守门(禁页面私写 router.back/history.back) | check-inline-back-button.mjs |
| 47 | `—（待补充）` | 💧 溯源水印覆盖守门(自愈式: 缺失/损坏自动补齐并回暂存区) | check-watermark-coverage.mjs |
| 48 | `—（待补充）` | 🧩 GitHub Actions 步骤顺序守门(setup-node cache:pnpm 必须在 pnpm/action-setup 之后) | check-workflow-step-order.mjs |
| 49 | `—（待补充）` | 🧾 迁移记账守门(journal ↔ .sql 一一对应 / when 单调唯一 / B10 登记表空闲性 warn) | check-migration-bookkeeping.mjs |
| 50 | `—（待补充）` | 🛡️ next-env.d.ts 构建污染守门(禁 .next-* 变体引用) | check-next-env-dist.mjs |
| 51 | `—（待补充）` | 🧭 能力目录登记守门(产物一致性 / v1 端点必须接能力闸 / scope 语义) | check-capability-catalog.mjs |
| 52 | `—（待补充）` | 🪟 派生弹窗守门(blocking,AGENTS.md §5b windowsHide 默认值配套) | check-no-visible-spawn.mjs |
| 53 | `—（待补充）` | 🛡️  admin 面特权判定一致性(blocking,O13b roleId>=1 收敛) | check-admin-gate-consistency.mjs |
| 54 | `—（待补充）` | ⏳ 未提交源码改动年龄守门(warn-only,B14 防工作树改动被并行 checkout 抹掉) | check-uncommitted-age.mjs |
| 55 | `—（待补充）` | 🈶 工具名显示覆盖率守门(blocking,D54/H16 界面禁直显英文工具码名) | check-tool-name-display-coverage.mjs |
| 59 | `—（待补充）` | 🈳 ICU 语法跨端可用性守门(blocking,D101:非 web 端取词引擎只支持四形子集) | check-icu-locale-support.mjs |
| 57 | `—（待补充）` | 🧩 对话流元素覆盖守门(blocking,D51/H13:①锚点漂移 ②契约事件两端不齐 ③清单条目倒退 ④锚点存续性倒退 ⑤注释式摘线) | check-chat-element-coverage.mjs |
| 58 | `—（待补充）` | 🈹 中文术语机翻残留守门(blocking,D104/H29:竞品自家 zh 包实测 list→挂牌/房源,我方 zh 侧此前无闸) | check-zh-term-quality.mjs |
| 60 | `—（待补充）` | 🕐 工具活动行双时态覆盖守门(blocking,D81①/D83/H28:键形合规 + 覆盖率 ratchet) | check-tool-activity-coverage.mjs |
| 56 | `—（待补充）` | 🔤 工具功能名各端可解析守门(blocking,防取词回显与离线包过期) | check-tool-display-resolvable.mjs |
| 61 | `—（待补充）` | 🖥️  桌面安装器资产三方对账(blocking,引用↔打包↔5 档落盘) | check-installer-assets.mjs |
| 62 | `—（待补充）` | 🧩 桌面 NSIS 安装器模板漂移(blocking,installer.nsi == 上游模板 + 已登记补丁) | desktop-nsis-template.mjs |
| 63 | `—（待补充）` | 🔀 SSE 双解析器漏接对账(blocking,帧覆盖 ratchet + 未接帧须交代归属) | check-sse-parser-parity.mjs |
| 68 | `—（待补充）` | 🔐 权限模式词汇对账(blocking,跨语言注册表一致 + 消费点禁漂移) | check-permission-mode-vocabulary.mjs |
| 64 | `—（待补充）` | 🧩 [miniapp-taro] 适配层未接线即拦(防"造好没装车"死代码回升) | check-adapter-wiring.mjs |
| 66 | `—（待补充）` | 🎨 [miniapp-taro] 适配层硬编码颜色基线(防新增 hex/rgb 绕过 token) | check-adapter-style-parity.mjs |
| 67 | `—（待补充）` | 🔐 凭据经非2xx message 外泄对账(blocking,拦上游令牌/密钥响应体被拼进错误消息) | check-credential-leak-in-message.mjs |
| 69 | `—（待补充）` | ⌨️ 快捷键声明与归属对账(blocking,声明未绑 / 同键被他功能接走) | check-declared-shortcuts.mjs |
| 70 | `—（待补充）` | 🈲 硬编码中文基线棘轮(blocking,新增界面文案必须走 t()/语言包) | scan-hardcoded-zh.mjs |
| 71 | `—（待补充）` | 🈲 计划登记行防丢(blocking,PROJECT_PLAN.md 已入库的 G-/D/P/W 编号行不得整行消失) | check-plan-line-loss.mjs |
| 72 | `—（待补充）` | 🐳 Dockerfile 构建上下文对账(blocking,钩子脚本必须 COPY 进镜像 + COPY 源必须在提交里) | check-dockerfile-copy-paths.mjs |
| 73 | `—（待补充）` | 🈲 端内绕过 @ihui/api-client 直连后端(blocking,裸 fetch/Taro.request 指向本仓后端即拦,存量走基线只减不增) | check-direct-backend-calls.mjs |
| 74 | `—（待补充）` | 🈴 词表键五语言可解析(blocking,静态映射缺语言/小程序离线包过期即红;W5 落点债只告警) | check-word-table-resolvable.mjs |
| 75 | `—（待补充）` | 🗄️  配置表名存在性(blocking,O20d:COMPUTE_ALLOWED_TABLES 必须与 drizzle schema 对齐) | check-config-table-existence.mjs |
| 76 | `—（待补充）` | 📋  迁移账本带外对象防回潮(warn-only,O20e:journal 序号全集 vs 账本行全集) | check-migration-ledger-drift.mjs |
| 77 | `—（待补充）` | 📐  圆角单一源头对账(blocking,全 8 端:档位表一致 + 端内取用必须引用档位) | check-radius-single-source.mjs |
| 93 | `—（待补充）` | 🎨 跨端色值同源对账(blocking,RN rn-tokens ↔ tokens.css 逐位同值 + 品牌档不得端内自立) | check-cross-end-tokens.mjs |
| 91 | `—（待补充）` | 🌗 主题接线对账(blocking,theme-driven 共享组件必须拿到调用方解析出的主题) | check-theme-prop-wiring.mjs |
| 10 | `code-quality/openapi-info` | 📋 OpenAPI 契约一致性(blocking,O8b 清零后由 info 升级) | openapi-check.mjs |
| 65 | `—（待补充）` | 🧹 整树删除拦截(blocking,索引 vs HEAD 文件存续性) | check-mass-deletion.mjs |
| 83 | `—（待补充）` | 📱 [mobile-rn] 深色模式前景/容器守门(品牌底白字 blocking + 浅色容器 ratchet) | check-brand-foreground.mjs |
| 84 | `—（待补充）` | 🧬 反回退守门(blocking,暂存内容等于历史版本 = 静默回滚他人改动) | check-stale-revert.mjs |
| 78 | `—（待补充）` | 🔗 workspace 依赖"声明即已链接 / 链接即有内容 / 命令即可跑"五维对账(blocking,拦本地全绿·部署环恒红·全机门禁停摆) | check-workspace-dep-links.mjs |
| 80 | `—（待补充）` | ⏱  热路径 git 只读调用必须带 timeout(blocking,拦无界挂起拖死守门链) | check-git-read-timeout.mjs |
| 79 | `—（待补充）` | 🔀 提交内容含 Git 冲突标记(blocking,成对 <<<<====>>>> 标记一旦入树即拦) | check-no-conflict-markers.mjs |
| 81 | `—（待补充）` | 📧 品牌邮件通道对账(blocking,拦绕过 email-templates 的纯文本自发通道) | check-brand-email-channel.mjs |
| 85 | `—（待补充）` | 🧪 测试目录被 .gitignore 静默吞掉对账(blocking,AGENTS §23 配套,补装) | check-test-paths.mjs |
| 86 | `—（待补充）` | 🗂  verify-*.mjs 临时验证文件落点(warn,AGENTS §25 配套,补装) | check-verify-tmp-files.mjs |
| 87 | `—（待补充）` | 🈳 语言包文件存在性与合法性对账(blocking,40 项清单,补装) | check-i18n-messages-exist.mjs |
| 88 | `—（待补充）` | 🧩 ui-react 组件复用对账(blocking,端内自实现 Dialog/Card/Form 提示,补装) | check-ui-react-usage.mjs |
| 89 | `—（待补充）` | 🔌 守门接线层对账(blocking,R1/R2 撒谎 · R4 文档隐形 · R5 撞号 · R7 假依据) | check-gate-wiring.mjs |
| 92 | `—（待补充）` | 💽 C 盘污染实地扫描(warn,拦"源码没写死但东西真掉在 C 盘") | check-c-drive-pollution.mjs |
| 90 | `—（待补充）` | 📡 SSE 帧端内 dispatch 注册层对账(blocking,补守门 63 覆盖不到的第 3 层) | check-sse-dispatch-parity.mjs |
| [0-9]+" | sort -u -V | tail -1`。
    id:  | `—（待补充）` | 🧭 errorCode 覆盖率对账(blocking,零"未知错误"兜底,补装) | check-error-code-coverage.mjs |
| 95 | `—（待补充）` | 🔏 水印载荷/横幅行语法对账(blocking,零宽必须被注释包裹) | check-watermark-syntax.mjs |
| 96 | `—（待补充）` | 🏠 §26 家目录改道完整性(warn,机器态与 diff 无关 ⇒ 不拦提交链,回潮即打红字) | check-home-junctions.mjs |
| 97 | `—（待补充）` | 📱 顶部状态栏避让单一源头对账(blocking,顶距只有一个注入点) | check-statusbar-single-source.mjs |
| 98 | `—（待补充）` | 🧩 HEAD 悬空具名导入对账(blocking,import 的名字目标必须真导出) | check-dangling-local-imports.mjs |
| 99 | `—（待补充）` | 🗑️ 暂存删除存续性对账(blocking,被删文件必须无人引用且无替代路径) | check-staged-deletions.mjs |
| 100 | `—（待补充）` | 🧬 合并新增文件存续性对账(blocking,合并不得吞掉任一父提交的独有新增) | check-merge-addition-loss.mjs |
| 101 | `—（待补充）` | 🔐 清单↔锁 specifier 对账(blocking,拦"本地全绿、生产构建必炸"的依赖真值) | check-lock-manifest-consistency.mjs |
| 102 | `—（待补充）` | 🧷 文本箭头当图标 / 箭头字号倒挂对账(blocking,入口箭头必须是矢量且不小于标签) | check-glyph-arrow-icon.mjs |
| 103 | `—（待补充）` | 🏛️ 架构契约对账(blocking,从 config/architecture-policy.yaml 的声明反查违规) | check-architecture-policy.mjs |
| 104 | `—（待补充）` | 🧬 prod-bundle 影子副本对账(blocking,入库源 ↔ 生产实际执行的那份逐字节等值) | check-prod-bundle-shadow.mjs |
| 105 | `—（待补充）` | 🧩 小程序+四端派生产物对账(blocking;离线语言包/图标/位图/四端 AI 可导航路由是否落后于源;孤儿与动态路径只报数不判红) | check-miniapp-generated.mjs |
| 106 | `—（待补充）` | 🧩 extension 注入层色值同源(blocking,可派生档逐位等值 + 分歧必须登记且不得腐烂) | sync-extension-tokens.mjs |
| 107 | `—（待补充）` | 🧾 第三方来源台账对账(blocking,嵌入/复制/覆盖三本账 + 机制来源账:roots 必须真实存在、盘上 vendored 件必须有条目、许可原文必须能自证) | provenance-ledger.mjs |
| 108 | `—（待补充）` | ⏳ 豁免到期账(blocking,12 类行内豁免必须带到期日;到期未销账即红,存量进基线只报数) | check-exemption-expiry.mjs |
| 109 | `—（待补充）` | 🔒 任务认领租约对账(blocking,（进行中）必须带日期与持有者;过期未清账即红,存量裸标记只报数) | check-task-claims.mjs |
| 110 | `—（待补充）` | 📦 产物预算对账(warn,交付出去的产物第一次有上限表:主包口径 / 悬空 sourceMappingURL 引用) | check-artifact-budget.mjs |
| 111 | `—（待补充）` | 🧬 工具契约声明对账(blocking,注册进工具面却没有契约声明即红;棘轮锚点=该文件 HEAD 自身违规数) | check-tool-contract-declared.mjs |
| 112 | `—（待补充）` | 📐 压缩分母对账(blocking,阈值分母必须经 effectiveContextWindow;存量 8 文件/12 处进棘轮) | check-compaction-denominator.mjs |
| 113 | `—（待补充）` | 🪪 路由身份键对账(blocking,路由身份不得进模型可见 schema;键清单唯一源在 @ihui/types) | check-tool-arg-routing-identity.mjs |
| 114 | `—（待补充）` | 🧪 测试收集存续性对账(warn,收集失败套件必须为 0;断言失败不混计) | check-test-collection-runs.mjs |
| 115 | `—（待补充）` | 🧪 入参校验装车对账(blocking,校验器必须有生产调用方 + 影子档在位且默认不是 enforce) | check-tool-arg-validation-wired.mjs |
| 116 | `—（待补充）` | 🌐 出站事实对账(blocking,厂商出站必须走带回 egress 的包装出口;绕档进棘轮基线) | check-egress-facts.mjs |
| 117 | `—（待补充）` | 🔐 记忆端点属主绑定对账(blocking,收 user_id 的端点必须与令牌主体对齐;存量已归零⇒零容忍) | check-memory-owner-binding.mjs |
| 118 | `—（待补充）` | 🧬 门脚本取材面纪律对账(blocking,本次改动动过的门必须经统一取材层;全量档只报数) | check-gate-face-discipline.mjs |
| 119 | `—（待补充）` | 🛰️ 子代理权限继承对账(blocking,派生点必须下传 permissionMode/permissions) | check-subagent-permission-inherited.mjs |
| 120 | `—（待补充）` | ✅ 名单类判据正向证明对账(blocking,登记名单必须被自己的成员命中过) | check-list-predicate-has-positive-proof.mjs |
| 121 | `—（待补充）` | 🗑️ 声明策略必须有消费者(blocking,MAX_AGE/TTL/RETENTION/Contract 谓词/清理函数未接线即红,存量棘轮) | check-declared-policy-has-consumer.mjs |
| 122 | `—（待补充）` | 💾 文件写盘安全对账(blocking,工具写文件必须走原子写出口;裸写盘棘轮) | check-file-write-safety.mjs |
| 123 | `—（待补充）` | ⏱️ 工具执行预算对账(blocking,工具级超时/取消机制在位且被调用;缺常量/缺通道即红) | check-tool-exec-budget.mjs |
| 124 | `—（待补充）` | 🎨 小程序原生 chrome 派生对账(blocking,theme.json + THEME_CHROME 必须是 tokens.css 的派生态) | check-miniapp-chrome.mjs |
| 125 | `—（待补充）` | 🧭 派生面登记表自洽对账(blocking,TOKEN_SYNC_TARGETS 每行的触发文件/写回出口/复核门三方必须在位) | check-token-sync-registry.mjs |
| 126 | `—（待补充）` | 🧪 shared 包非 Node 宿主纯度对账(blocking,入口闭包可达面内不得有 node: 内建导入) | check-shared-nonde-node-purity.mjs |
| 127 | `—（待补充）` | 🛰️ 跨语言出站路由声明对账(blocking,默认档只报数;--strict 才判红,防恒红门) | check-declared-outbound-routes.mjs |
| 128 | `—（待补充）` | 🪞 跨端 UI 差异账对账(blocking,同名配对组件的小程序/RN 可见几何档只减不增 —— 重复实现就是"改一端另一端不跟随"的根因) | check-cross-end-ui-parity.mjs |
| 129 | `—（待补充）` | 🛡️ 提示注入登记对账(blocking,"以宿主名义进模型提示"的每段必须有登记的 producer 与记账出口;拦 登记没生产 / 生产没消费 / 裸 [系统提醒] 前缀 三型) | check-prompt-injection-registry.mjs |
| 130 | `—（待补充）` | 🗂  任务状态分叉对账(blocking,差值棘轮:一次提交不得让"同一件事既已完成又挂着未勾"变多,不得带入没有交代的登记行,也不得新增撞号组(F9,存量只报数) —— 既有防护全在防丢,没有一道防错) | plan-tasks.mjs |
| 131 | `—（待补充）` | 🧬 RN 函数形态 style 被 cssInterop 吃掉(blocking,按文件 HEAD 自身存量棘轮:存量只报数、新增即拦) | check-rn-interop-fn-style.mjs |
| 132 | `—（待补充）` | 🔧 工具族注册对账(blocking,存量已归零:tools/** 里导出的一族工具必须能在生产面找到把它挂进注册表的调用点 —— "造好没装车"那一型) | check-tool-family-registered.mjs |
| 133 | `—（待补充）` | 🈶 语言包语种内容对账(blocking,L1 跨族/块级只报数 + L2 同名自套一层按 HEAD 锚点棘轮 —— parity 绿不等于语种对) | check-i18n-locale-content-language.mjs |
| 134 | `—（待补充）` | 🧮 批量写计数诚实性对账(blocking,拦「affected/deleted 由请求侧 .length 自算」这一型静默失真 —— 改了 0 行与改成功同形) | check-batch-write-count-honesty.mjs |
| 135 | `—（待补充）` | 🧾 ApiResult 失败分支身份对账(blocking,拦「throw new Error(res.error) 丢掉 status/errorCode」—— 401 因此冒充「提交的信息有误」,把用户引导去改表单) | check-api-failure-throw.mjs |
| 136 | `—（待补充）` | 🧵 后台任务类型三面 parity(blocking,拦「广告了任务类型却没实现 / 实现了却没接线 / 欠账清单腐烂」—— 声明面↔实现面↔接线面必须同时成立) | check-background-task-type-parity.mjs |
| 137 | `—（待补充）` | 名字承诺/实现兑现对账(拦「函数或字段叫 hash/digest/指纹/脱敏,实现却是明文拼接且流向持久化或出网」这一型 —— 本仓 4 处真缺陷同族立门) | check-digest-name-reality.mjs |
| 138 | `—（待补充）` | @ 多维提及引擎接线与单一源对账(V3 #61:三件不得回到无人调用 / 维度表与触发符解析不得出现第二份) | check-mention-engine-wired.mjs |
| 139 | `—（待补充）` | 模式×权限档×审批三轴矩阵对账(V3 #53:ChatMode 硬收窄的表与判定两侧逐格等值,出口唯一、有生产调用点) | check-mode-permission-matrix.mjs |
| 140 | `—（待补充）` | V3 #62/#63 对话流挂载与契约登记对账(拦「件在库而无人挂载」与「契约登记与消费点漂移」) | check-v3-62-conversation-mount.mjs |
| 141 | `—（待补充）` | doom-loop parity 对账(共享层/CLI/agent.ts/Python 等价/主链路五面成套,策略数字不得有第二份) | check-doom-loop-parity.mjs |
| 142 | `—（待补充）` | Guardian 复核接线对账(拦「复核出口造好没人调」与「未复核被折叠成通过」) | check-guardian-review-wired.mjs |
| 143 | `—（待补充）` | LSP 语言表与探测四态对账(拦 binary 名回到写死字面量、能力声明无对应族、探测失败被折叠成无诊断) | check-lsp-language-table.mjs |
| 144 | `—（待补充）` | 🩸 崩溃上报出口脱敏对账(blocking,拦「崩溃上报把未脱敏的 message/stack 送进 crash_reports(90 天)与管理面板」—— 发射点与落库点都必须调用共享层唯一出口 redactCrashText) | check-crash-report-redaction.mjs |
| 145 | `—（待补充）` | RN 包装器双层页头对账(共享屏自带页头 × RN 屏又加 NavBar ⇒ 同屏两条返回键与两个标题) | check-rn-double-header.mjs |
| 146 | `—（待补充）` | README 表格完整性对账(TI1 竖排续行判红/T-B 只报数/棘轮锚基线) | check-readme-table-integrity.mjs |
| 147 | `—（待补充）` | 模型容量/推理档位跨语言对账 | check-model-capacity-parity.mjs |
| 148 | `—（待补充）` | 会话失效统一出口注册对账:凡消费 @ihui/api-client fetchApi 的端必须注册 setUnauthorizedHandler 或持带 reason+未过期 reviewBy 的台账豁免(AP1);台账端已注册/指向不存在端/重复登记判红(AP2 反腐烂);注册口 export 或 notifyUnauthorized 调用点被摘线判失明不记绿(AP3);枚举 0 个消费端 exit 2 不记绿 | check-auth-handler-registration-parity.mjs |
| 149 | `—（待补充）` | 包入口 barrel 漏 re-export 对账:端内从裸包名 import 的名字必须由包入口真的递出 | check-package-barrel-export.mjs |
| 151 | `—（待补充）` | 子智能体/后台任务状态词汇跨语言与端内抄本对账(六档是落库/REST/SSE 三重对外契约) | check-agent-status-vocabulary-parity.mjs |
| 152 | `—（待补充）` | 🔐 ai-service 身份消费对账(blocking,拦「端点取到已验证身份却一次都没用它」—— 认证不等于授权;判据单一真相在 apps/ai-service/scripts/audit_principal_consumed.py,本门只物化被审面并派生那把尺子) | check-principal-consumed.mjs |
| 153 | `—（待补充）` | 🛡️ 服务二进制路径存续性对账(判机器状态:nssm 各服务 Application 绝对路径存在性;三态不并桶,§12e 只能 warn) | check-service-binary-paths.mjs |
| 154 | `—（待补充）` | 临时夹具 scratch 根二阶嵌套巡检(只报不删,三态含未判定) | check-scratch-root-no-nesting.mjs |
| 155 | `—（待补充）` | 镜像测试临时夹具落点对账(默认只报名,--strict 才判红) | check-fixture-tmpdir.mjs |
| 156 | `—（待补充）` | 自检用例登记侧的求值配对对账(登记不求值 ∧ 用例传函数 ⇒ 才判红;潜伏档只报数) | check-selftest-registrant-evaluates.mjs |
| 157 | `—（待补充）` | 🔐 按凭据存在性豁免对账(blocking,G-459:头名在场即跳过安全判定必须逐条裁过) | check-credential-presence-bypass.mjs |
| 158 | `—（待补充）` | 🛡️ 凭据在场即豁免对账(blocking,拦「安全钩子里只要带了某个头就直接跳过校验」—— 票#23 CSRF 现场收口后无人看守的那一型) | check-gate-presence-exemption.mjs |
| 209 | `—（待补充）` | 🔐 CSRF 豁免形状对账(blocking,存在性唯一条件放行/验真出口摘线/timingSafeEqual 单源三判据) | check-csrf-exemption-shape.mjs |
| 159 | `—（待补充）` | 图源池与境外图片 URL 对账:渲染与 seed 路径不得再出现境外图片域名的完整 URL,且 database 侧镜像必须与 shared 逐字等值 | check-image-source-domains.mjs |
| 160 | `—（待补充）` | 斜杠命令「注册表 ↔ 分派 switch」到达性对账 + 注册名去重:注册名(含别名)必须各有活 case/if 分支(W1)、注册名多重集零重复(W2)、分派顶层必须有 default 兜底(W4),三维零容忍;分派有而注册表无(W3 名字漂移)默认只报数、--strict 才判红(HEAD 面现读 2 条存量,当场判红就是恒红门);注册表/分派解析不到 ⇒ exit 2 未判定,枚举到 0 个判死不记绿 | check-slash-command-wired.mjs |
| 161 | `—（待补充）` | 入站契约 .strict() 到达性对账 | check-inbound-schema-strict.mjs |
| 163 | `—（待补充）` | 维护性写归属/CAS/回报计数三态对账(G-815920) | check-write-owner-predicate.mjs |
| 164 | `—（待补充）` | 源码替换符(U+FFFD)对账 —— 字节级 UTF-8 完整性的缺失维度 | check-replacement-chars.mjs |
| 165 | `—（待补充）` | 🧾 教育欠费口径单一出口对账(blocking,AR1 出口外重写算式/AR2 裸写派生列) | check-edu-arrears-single-source.mjs |
| 166 | `—（待补充）` | 🧵 活文档按旧副本提交会写回他人已入库行(blocking,2026-09-29 立;只判本次真改掉的那份文档,索引==HEAD 记跳过不记通过) | check-live-doc-pathspec.mjs |
| 167 | `—（待补充）` | 🔒 turn 序号分配点上锁(blocking,max(turnOrdinal) 与 insert(chatMessages) 同体 ⇒ 体内必须有 .for(\ | check-turn-ordinal-lock.mjs |
| 168 | `—（待补充）` | 🔀 合并复活已删文件对账(blocking,DR1 基底判定 + DR2 删除出处;默认只判未入 origin/main 的合并,每枚判一次) | check-merge-deletion-resurrection.mjs |
| 171 | `—（待补充）` | AI 面板装载守门:GlobalShell/AISidePanel 的骨架占位几何一致 + 8 个重组件懒加载边界 + inferVendor 单一来源(首屏延迟根治防回潮,2026-09-30;门体随 d5c54f4499 入库,本枚重注册补对账) | check-ai-panel-mount-guards.mjs |
| 173 | `—（待补充）` | 对外文档数字对账(README/README.en 的生成块与散文声称必须等于 gen-doc-numbers 现算值;判责时机=改动被审文档的那枚,未触及只报漂移数 —— 防恒红) | check-doc-numbers.mjs |
| 174 | `—（待补充）` | 诊断面脱敏守门(b76-08a票1配套):诊断/错误上报面不得携带未脱敏的密钥/令牌/邮箱/路径等敏感串,自检 --self-test 内嵌红绿对照 | check-diagnostic-redaction.mjs |
| 175 | `—（待补充）` | 进程退出码归因守门(b76-08a票1配套):进程 exit 1/非零退出必须可归因到显式 failure kind/错误码,禁止无归因的裸退出,自检 --self-test 内嵌红绿对照 | check-process-exit-attribution.mjs |
| 176 | `—（待补充）` | 能力位不得客户端自供守门(b76-08a票2配套):客户端不得自报 capability 字段(connectionId/clientMode/deliveryProfile/subscriberScope/workflowRunDeltas 名单),能力位只准服务端下发,自检 --self-test | check-capability-field-not-client-supplied.mjs |
| 177 | `—（待补充）` | SSE 帧水印守门(b76-13票1配套):SSE 流消费环必须带 fromSeq≥1 帧水印接线(唯一出口 + 读环接线 + 阳性对照),摘线即红,自检 --self-test 红绿对照 | check-sse-frame-watermark.mjs |
| 178 | `—（待补充）` | 列表截断诚实守门(b76-13票7配套):UI 列表截断必须如实交代截断帽(不得假装展示全量),三处 UI 命中已清偿;1 处字符串尾截(terminal-section.tsx)属票面不判面(未判定不判红) | check-list-cap-honesty.mjs |
| 179 | `—（待补充）` | 工具 schema 投影完整性守门(b76-05票2配套):工具描述符 JSON schema 投影必须键序 canonical/拒绝通道在位/A-B 两面一致/缓存中性,99 个可判工具全过才绿,自检 --self-test 4 例 | check-tool-schema-projection.mjs |
| 180 | `—（待补充）` | 嵌套 additionalProperties 闭集守门(b76-14票2配套):嵌套层 schema 的闭集声明不得被摘(嵌套三态在位 + 类型面收编 ≥2),取不到按 UNDETERMINED 不记绿,自检 --self-test 3 例 | check-nested-additional-properties.mjs |
| 181 | `—（待补充）` | 错误文案有界化守门(b76-12b票1配套):错误文案出边界(PERSISTENT sink)的 JSON.stringify 内插必须有界或带 ref= 基线;测试面/CLI 面/stdout-only 豁免,基线棘轮只减不增 | check-error-message-bounded.mjs |
| 182 | `—（待补充）` | 控制面 strict 棘轮门(b76-12c票2配套):扫描面(apps/api/src/plugins + packages/shared/src)的 z.object+.strict+.catch 总和只减不增(基线 91);禁 passthrough 降红/禁装饰字段塞控制面 | check-wire-strictness.mjs |
| 183 | `—（待补充）` | 分片上传聚合预算棘轮门(b76-12c票3配套):chunked-upload.ts 的 begin 新建装配检(isPerUserSessionBudgetExceeded)与每片落盘追加检(wouldStagedBudgetOverflow)各 ≥1,两档常量须在 PROTOCOL_UPLOAD_LIMITS 登记,防死表回潮 | check-upload-budget.mjs |
| 184 | `—（待补充）` | 📚 活文档点名路径存续性对账(blocking,正文反引号点名的仓内路径必须在被审面在位;索引缺而 HEAD 在 ⇒ 红,HEAD 缺席只 warning,2026-09-30 D169 立) | check-live-doc-references.mjs |
| 185 | `—（待补充）` | 迁移内容不可变性对账(已入库 drizzle 迁移不得被改写;IM1 与"该 tag 首次入库的 blob"逐字节比,存量只报数;IM2 判本次改写面;枚举 0 判死不记绿) | check-migration-immutable.mjs |
| 189 | `—（待补充）` | Python import 入库存续性对账 | check-python-import-landed.mjs |
| 190 | `—（待补充）` | 枚举/映射取不到时的兜底分支不得落到更宽的权限或能力档(票 G-816027):宽档集合由被审面的两份注册表(TS POLICY_BY_MODE / PY skips_approval_permission_mode)现读推导,推导失败或槽位撞名一律未判定;与"凭据在场即豁免"那道门(157)不重叠计账 | check-enum-default-widening.mjs |
| 191 | `—（待补充）` | 测试判据复制对账(§22c 跨门尺子;门体与镜像测试各写一份形态清单/正则即点名,存量 27 处只报数 ⇒ warn,升 blocking 前置 = 命中归零) | check-test-judge-not-replicated.mjs |
| 192 | `—（待补充）` | 注册表工作树超集对账(package.json / guardian-runner 的已入库入口被工作树副本整行写回旧态;今日 28 份注册表零存量 ⇒ blocking,只在 --staged 面问责) | check-registry-worktree-superset.mjs |
| 194 | `—（待补充）` | 🧯 §22d 入口守卫对账:scripts/**.mjs 不得顶层裸 main()(存量以 node scripts/check-direct-run-guard.mjs 末行现读为准,差值棘轮只拦本次新增) | check-direct-run-guard.mjs |
| 195 | `—（待补充）` | 事务体内取消探测对账(db.transaction 回调体内不得 throwIfAborted/signal.aborted) | check-txn-cancel-boundary.mjs |
| 199 | `—（待补充）` | 派生把 stdout 丢掉/直通终端、同一作用域却又读它 ⇒ 结论恒 null,门把"没拿到"写成"机器态未判定"并 exit 0(立因 G-1108372) | check-spawn-output-channel.mjs |
| 200 | `—（待补充）` | provider 健康四档单一真相源对账(值域并表后不得再分叉) | check-provider-health-vocabulary.mjs |
| 201 | `—（待补充）` | 📱 mobile-rn Expo 配置必须产出单调递增的 versionCode/buildNumber(app.json 无 versionCode ⇒ Expo 默认恒 1,覆盖安装必被 Android 降级保护拒;2026-10-12 装机实测) | check-mobile-version-code.mjs |
| 202 | `—（待补充）` | 📱 移动端 release 打包步必须能看到 EXPO_PUBLIC_API_BASE_URL(只挂 prebuild 步 ⇒ 打包期内联 localhost:8802,线上全量断网;2026-10-13 装机实测) | check-mobile-api-base-bake.mjs |
| 203 | `—（待补充）` | 🧾 台账同题多号差值棘轮:PROJECT_PLAN.md 索引面不得比 HEAD 面多出「同一件事的第二次登记」(换了个编号也算,2026-10-13 机主拍板根治) | check-plan-task-duplicates.mjs |
| 204 | `—（待补充）` | 🧭 错误归因唯一出口(blocking,生产面不得出现第二份 `.message.includes(` 归因判定;调用点必须走 packages/shared 的 attributeError) | check-error-attribution-single-source.mjs |
| 205 | `—（待补充）` | 🧩 未知枚举兜底档(blocking,闭集状态的未命中分支兜初始态 ⇒ 红;未知值必须落「不再产生副作用」那一档) | check-enum-fallback-terminal.mjs |
| 206 | `—（待补充）` | 🔢 错误码不得按文本判(blocking,新增分支按 err.message/includes(\ | check-error-code-not-text-matching.mjs |
| 207 | `—（待补充）` | 📏 AGENTS.md 体积守门(逐字注入面尺寸,预算 96,000 字节;口径与定级依据见脚本头注) | check-agents-doc-size.mjs |
| 208 | `—（待补充）` | 🪆 工作区嵌套 git 仓零容忍(blocking,0 存量棘轮;演练/夹具仓被 IDE 源代码管理扫成「暂存的更改 10000+ 全 D」幻影) | check-no-nested-git.mjs |
| 210 | `—（待补充）` | 📐 TS/Python 行切分口径逐例同值对账(warn;§0.9 造好没装车那一格) | check-line-split-parity.mjs |
| 211 | `—（待补充）` | 🧮 PROJECT_PLAN 号池对账(声明位号 >999 按重数差值棘轮;R2 发号路径点名,warn) | check-plan-id-pool.mjs |
| 212 | `—（待补充）` | 🎯 输入框聚焦反馈对账(描边输入/选择控件必须有聚焦反应,三端同尺;存量按该文件 HEAD 自身棘轮只报数,定级依据与取证窗见脚本头注) | check-input-focus-feedback.mjs |
| 213 | `—（待补充）` | 🛡️  盘根写入回归锁(代码里别再产新的盘根外流;差值棘轮只拦新增) | check-disk-root-write.mjs |
| 214 | `—（待补充）` | 📐 mobile-rn sheet/弹窗 flex 弹性契约(bounded 容器内列表必须唯一弹性块,固定 chrome 不被压扁) | check-sheet-flex-contract.mjs |
| 215 | `—（待补充）` | 🎨 RN 端硬编码 hex 基线棘轮(基线之外新增 #hex 即 BLOCK,存量只减不增) | check-mobile-rn-style-parity.mjs |
| 23 | `engineering/staged-files-info` | 📋 staged 文件清单(info) | check-staged-files.mjs |
| 150 | `—（待补充）` | 角色档合规对账(元素类别→档位,77 不判的那一型) | check-radius-role-conformance.mjs |
| 170 | `—（待补充）` | 🛰 旁路落地声明面对账(blocking,留痕声明面 ⊉ 实际面 ∧ 射程外路径写回旧 blob ⇒ 红并点名;增量台账每枚判一次) | check-bypass-landing-scope.mjs |
| 172 | `—（待补充）` | 🛡  跳门变量承诺/兑现对账(blocking,文档承诺的 HUSKY_SKIP_* 必须有真实读点;差值棘轮只拦新增) | check-skip-env-promise.mjs |
| 186 | `—（待补充）` | loadState 四档投影防漂移对账(LV1 四档字面量零散落 + LV2 五族 get_status 的 loadState 键与共享出口来源;warn 起步) | check-load-state-projection-parity.mjs |
| 187 | `—（待补充）` | 不安全加载标记四形态扫描(finally-set / except-set / tail-set / set-add;判据本体单份住在 _load_lifecycle.py,门内零自行判定;blocking) | check-load-state-loaded-marks.mjs |
| 188 | `—（待补充）` | 🔐 授权判据列隔离(blocking,拦「归属判据所在的 SELECT 顺带取了展示列」—— 展示字段损坏会把授权查询拖成 500 而不是 403/404;判据本体单份住在 check-authorization-column-isolation.mjs,门内零自行判定) | check-authorization-column-isolation.mjs |
| 196 | `—（待补充）` | 📎 PROJECT_PLAN.md 短 sha 出处指针防回潮(新增行裸短 sha 须走台账/声明前缀/文件名通道,warn) | check-plan-sha-form.mjs |
| 197 | `—（待补充）` | 📉 truncated 声明块计数伴随 + 投递档位收口绊线(DTO 类型层,warn) | check-truncation-accounting.mjs |
| 198 | `—（待补充）` | ⏱️  DB 盲写 updatedAt 棘轮(blocking,拦「.set({ ...data, updatedAt: new Date() })」无条件覆盖形态回潮 —— 它把增量读的 updatedAt 消费源污染成假变化) | check-db-blind-updatedat-set.mjs |
| 13d | `—（待补充）` | 🚫 PROJECT_PLAN.md 重复登记副本指针棘轮 | check-plan-dup-pointer-ratchet.mjs |

### 3.4 迁移建议

1. **过渡期（1-2 个月）**：guardian-runner.mjs 增加 `semanticId` 字段，与 `id` 并存；日志/onFailHint 同时输出两个 ID
2. **文档同步**：AGENTS.md §"守门脚本速查" / docs/GATEKEEPERS.md / 各 check-*.mjs 输出全部改用 semanticId
3. **完成迁移**：删除数字 `id` 字段，所有引用改为 `semanticId`
4. **影响范围**：guardian-runner.mjs / .husky/pre-commit / AGENTS.md / docs/GATEKEEPERS.md / 各 check-*.mjs 脚本输出

### 3.5 重构收益

- 新增守门项无需查表找编号，直接按主题命名
- 日志/CI 输出更易读（`[i18n/parity-web]` 比 `[2n-web]` 直观）
- 与 AGENTS.md §"守门脚本速查"分类完全对齐
- 便于按分类过滤执行（如 `guardian-runner --filter 'i18n/*'`）

---

## 4. P3-C: 文档自动化机制说明

### 4.1 脚本用法

```bash
# 生成（覆盖）docs/guardian-reference.md
pnpm guardian:docs

# 等价于
node scripts/generate-guardian-docs.mjs

# 仅校验文档是否最新（CI 用，过期则 exit 1）
node scripts/generate-guardian-docs.mjs --check

# 打印帮助
node scripts/generate-guardian-docs.mjs --help
```

### 4.2 工作原理

1. 读取 `scripts/guardian-runner.mjs` 源码
2. 字符级解析 `const checks = [...]` 数组（字符串/注释感知，避免误匹配）
3. 对每个 check 对象提取 `id` / `label` / `script` / `args` / `mode` / `onFailHint`
4. 同时提取对象前的 `//` 注释块（包含升级评估、设计原因等上下文）
5. 与内置的 `UPGRADE_TIMELINE`（升级时间表）和 `NAMESPACE_MAP`（命名空间映射）合并
6. 渲染 Markdown 模板，写入 `docs/guardian-reference.md`

### 4.3 CI 集成建议

| 场景 | 命令 | 失败行为 |
|------|------|----------|
| PR 检查 | `pnpm guardian:docs -- --check` | 文档过期则 CI fail，提示重新生成 |
| Pre-commit（可选） | `node scripts/generate-guardian-docs.mjs --check` | staged 含 guardian-runner.mjs 但 docs 未更新时 warn |
| 文档生成 | `pnpm guardian:docs` | 自动覆盖，无需人工编辑 |

**推荐集成位置**：CI 流水线在 lint/typecheck 之后加一步 `pnpm guardian:docs -- --check`，确保文档与代码同步。

### 4.4 维护规则

- **禁止手工编辑** `docs/guardian-reference.md`（会被下次生成覆盖）
- **修改 guardian-runner.mjs** 后必须运行 `pnpm guardian:docs` 重新生成
- **新增守门项** 时同步在脚本的 `UPGRADE_TIMELINE` 和 `NAMESPACE_MAP` 配置中添加条目
- **升级 mode**（warn → blocking）后需同步更新 `UPGRADE_TIMELINE` 配置（删除该 ID 条目，因它已不在 warn 列表）

### 4.5 局限性

- 升级时间表（`UPGRADE_TIMELINE`）和命名空间映射（`NAMESPACE_MAP`）是手工维护的配置表，无法从代码自动推导
- 解析器是字符级状态机，假设 guardian-runner.mjs 的 checks 数组语法规范（无嵌套对象、无 spread 操作符、无动态字段）
- 字符串内转义引号场景未处理（当前 guardian-runner.mjs 无此情况，未来如有需更新解析器）
- onFailHint 中的多行字符串在 §1 表格中只显示"有/无"，完整内容在 §1.4

---

*本文档由 `scripts/generate-guardian-docs.mjs` 自动生成，禁止手工编辑。*
