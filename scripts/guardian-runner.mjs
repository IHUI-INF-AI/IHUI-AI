#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 守门脚本批量执行器。
 *
 * 接收配置数组,单进程顺序执行所有检查,输出汇总。
 * 将 pre-commit 中 52 个独立 `node scripts/xxx.mjs` 调用合并为单进程批量执行,
 * 降低 commit 耗时,提供统一汇总输出。
 *
 * CLI 用法:
 *   node scripts/guardian-runner.mjs [--staged] [--timing] [--help]
 *
 *   --staged  传递 --staged 给所有脚本(pre-commit 模式)
 *   --timing  打印每个检查的耗时
 *   --help    打印帮助和检查清单
 *
 * 检查模式:
 *   blocking  失败 → 立即 exit(1),阻塞 commit
 *   warn      失败 → 打印警告,继续执行(不阻塞 commit)
 *   info      始终继续,只打印信息
 */
import { execSync } from 'node:child_process'

// === 颜色 ===
const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

// === 检查配置(52 项,顺序与原 pre-commit 一致) ===

const checks = [
  // --- blocking (36 项) ---
  {
    id: '1',
    label: '🔐 API key 泄露',
    script: 'check-api-key-leak.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '2',
    label: '🌐 i18n 键完整性',
    script: 'check-i18n-keys.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '2b',
    label: '🔍 zh-TW 简体字残留',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['zh-TW'],
    mode: 'blocking',
  },
  {
    id: '2c',
    label: '🔍 ko.json 中文残留',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ko'],
    mode: 'blocking',
  },
  {
    id: '2e',
    label: '🔍 en.json 破碎英文',
    script: 'check-i18n-broken-en.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '2f-web',
    label: '🌐 i18n AI 翻译流水线(blocking)',
    script: 'i18n-diff.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 zh-CN.json 有改动但 i18n pending 非空,请先跑翻译流水线:',
      '     1. node scripts/i18n-diff.mjs          (检测差异,生成 pending 清单)',
      '     2. AI agent 翻译 → .trae-cn/tmp/i18n-translations.json',
      '     3. node scripts/i18n-apply.mjs         (应用翻译)',
      '     4. node scripts/check-i18n-keys.mjs    (验证 parity)',
      '     5. git add apps/web/messages/{en,ja,ko,zh-TW}.json 重新 commit',
      '',
    ].join('\n'),
  },
  {
    id: '2f-miniapp-taro',
    label: '🌐 [miniapp-taro] i18n AI 翻译流水线(blocking)',
    script: 'i18n-diff.mjs',
    args: ['--target=miniapp-taro'],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 miniapp-taro zh-CN.ts 有改动但 i18n pending 非空,请先跑翻译流水线:',
      '     1. node scripts/i18n-diff.mjs --target=miniapp-taro  (检测差异,生成 pending 清单)',
      '     2. AI agent 翻译 → .trae-cn/tmp/i18n-translations.json',
      '     3. node scripts/i18n-apply.mjs --target=miniapp-taro  (应用翻译)',
      '     4. node scripts/i18n-diff.mjs --target=miniapp-taro   (复验 parity,应无 pending)',
      '     5. git add apps/miniapp-taro/src/i18n/{en,ja,ko,zh-TW}.ts 重新 commit',
      '',
    ].join('\n'),
  },
  // --- 2g-web (2026-07-27 新增,i18n 命名空间传递守门,warn-only 起步) ---
  // 检测"useTranslations('xxx') 限定命名空间 + 把 t 传给 @ihui/ui-react 共享登录组件"bug 模式
  // 背景:LoginFormContent.tsx 曾用 useTranslations('auth') 限定命名空间后把 t 传给共享 LoginForm,
  //   共享组件内部调用 t('auth.emailLogin') 长 key 路径,实际查找 auth.auth.emailLogin 失败,
  //   导致弹窗内全部显示 key 名。已修复(改用 useTranslations() 无命名空间),本守门防复发。
  // 检测目标:apps/web/src/ 下所有 .tsx(8 个共享登录组件:LoginForm/EmailCodeLoginForm/
  //   PhoneCodeLoginForm/PasswordLoginForm/AgreementCheckbox/AgreementNoticeDialog/
  //   ThirdPartyLoginButtons/QrTab)
  // 升级 blocking 评估:1 周观察期(2026-08-03)若无误报 → 改 mode: 'blocking'
  {
    id: '2g-web',
    label: '🔍 i18n 命名空间传递(web→共享组件)',
    script: 'check-i18n-namespace-passing.mjs',
    args: [],
    mode: 'warn',
  },
  {
    id: '3',
    label: '🗄️ schema drift',
    script: 'check-db-schema-drift.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '4',
    label: '📦 packages 陈旧 dist',
    script: 'check-stale-dist.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '4b',
    label: '🔤 dist UTF-8 BOM',
    script: 'check-dist-encoding.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '4c',
    label: '🔤 api-client UTF-8 完整性',
    script: 'check-api-client-utf8.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '6',
    label: '🛡️ skipResponseSanitization',
    script: 'check-sanitizer-bypass.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '7',
    label: '📦 依赖碎片化',
    script: 'check-dedupe.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '8',
    label: '🔗 前端↔后端路由一致性',
    script: 'check-api-routes.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '11',
    label: '⭕ 容器圆角违规',
    script: 'check-rounded-full.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '12',
    label: '📋 交付报告一致性',
    script: 'check-delivery-report-consistency.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '13c',
    label: '🗂️  PROJECT_PLAN.md 已完成任务防误删',
    script: 'check-project-plan-archive.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '15',
    label: '📊 迁移完整性(7 大类 29 子项)',
    script: 'check-api-migration-completeness.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '17',
    label: '🎨 CSS 颜色 token 嵌套',
    script: 'check-input-border-var.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '18',
    label: '🖱️  原生 title tooltip 违规',
    script: 'check-native-title-tooltip.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '20',
    label: '🎯 Tailwind class 冲突',
    script: 'check-tailwind-class-conflict.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '24a',
    label: '📏 侧边栏宽度一致性',
    script: 'check-sidebar-width-consistency.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '25',
    label: '🧹 项目外路径违规(blocking)',
    script: 'check-workspace-hygiene.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '26',
    label: '🛡️  项目父目录污染巡查(blocking)',
    script: 'check-parent-pollution.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '27',
    label: '🛡️  z-index 层叠防护(防 TRAE 注入 + 遮罩 fade-in 回归)',
    script: 'check-z-index-guard.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '28',
    label: '🛡️  全屏遮罩 z-index 层级(防 fixed inset-0 + z-50 复发)',
    script: 'check-overlay-zindex.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 fixed inset-0 全屏遮罩用了 z-50/z-40/z-30 等低数字 Tailwind 类(值 < 100),',
      '     低于 AISidePanel 的 z-sticky=990,会被压在下面 = AI 面板露在遮罩之上。',
      '     修复:把 z-50 改为 z-modal(=2000, 引用 --z-modal CSS 变量)。',
      '     透明点击捕获层(无 bg-black)不在本守门范围。',
      '',
    ].join('\n'),
  },
  {
    id: '29',
    label: '🚀 Push 同步兜底(防"commit 后忘记 push"复发,AGENTS.md §21 第三道防线)',
    script: 'check-push-sync.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 本地有未 push 的 commit,本次 commit 已阻止。',
      '     post-commit 钩子(git-push-guard.mjs)本应自动 push,但可能因以下原因失败:',
      '       - HUSKY_SKIP_PUSH=1 跳过 / push 网络失败 / 凭据失效',
      '       - agent 用 --no-verify 跳过所有钩子',
      '       - pre-push typecheck 阻塞 / RunCommand 工具失联',
      '',
      '  修复方法(任选其一):',
      '     ① 自动 push: node scripts/git-push-guard.mjs',
      '     ② 手动 push: git push origin main',
      '     ③ 紧急跳过(不推荐): HUSKY_SKIP_PUSH_SYNC=1 git commit ...',
      '',
    ].join('\n'),
  },
  {
    id: '30',
    label: '🛡️ i18n 文件完整性(防 prettier 截断事故复发)',
    script: 'validate-i18n-integrity.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 staged 的 i18n JSON 文件行数异常减少(>50% 且 >100 行),',
      '     通常是 lint-staged 的 prettier --write 解析大 JSON 失败导致截断事故。',
      '     修复:git restore --staged --worktree <file> 后重新编辑/格式化。',
      '',
    ].join('\n'),
  },

  // --- 12 项(2026-07-25 升级 commit 丢失防护为 blocking,id 改 30a 避免与 30 冲突) ---
  {
    id: '30a',
    label:
      '🛡️  Commit 丢失防护(blocking,AGENTS.md §22,防 reset / drop stash 误丢 commit)',
    script: 'check-commit-loss-guard.mjs',
    args: ['--blocking', '--filter-stash'],
    mode: 'blocking',
  },
  // --- 35 (2026-07-26 新增,mypy 防回归守门,防 ai-service Python 类型回退) ---
  // blocking:项目刚完成 mypy 全库清零(4 批次 256→0 errors,226 source files),
  //   但 mypy 检查只在 pnpm typecheck:full 手工运行,无 pre-commit 守门。
  //   typecheck:full 可能被 --no-verify 跳过 → mypy errors 回退。本守门在 staged
  //   涉及 apps/ai-service/**/*.py 时触发 mypy 检查,0 errors 才通过。
  // 失败含义:staged 的 Python 代码引入类型错误,需修复后重新 commit。
  // id 说明:任务原话要求 id '31',但 '31' 已被 verify-auth-shell.mjs 占用
  //   (同日 2026-07-26 新增),'34' 也被 check-ts-ignore.mjs 占用,故用下一个可用
  //   编号 '35'。插入位置:30a 之后、2d(warn-only 区)之前(blocking 区末尾)。
  {
    id: '35',
    label: '🐍 mypy 类型检查(防 ai-service Python 类型回退)',
    script: 'check-mypy.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 apps/ai-service 的 Python 代码有 mypy 类型错误,',
      '     修复:cd apps/ai-service && mypy app --ignore-missing-imports',
      '     紧急跳过(不推荐):HUSKY_SKIP_MYPY=1 git commit ...',
      '',
    ].join('\n'),
  },
  {
    id: '2d',
    label: '🔍 ja.json 中文残留(warn-only)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ja'],
    mode: 'warn',
  },
  {
    id: '2f-ext',
    label: '🌐 [extension] i18n 键完整性(warn-only)',
    script: 'check-i18n-keys.mjs',
    args: ['--target=extension'],
    mode: 'warn',
  },
  {
    id: '2f-shared',
    label: '🌐 [shared] i18n 键完整性(blocking,零变更验证通过)',
    script: 'check-i18n-keys.mjs',
    args: ['--target=shared'],
    mode: 'blocking',
  },
  {
    id: '2g-ext',
    label: '🔍 [extension] zh-TW 简体字残留(warn-only)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['zh-TW', '--target=extension'],
    mode: 'warn',
  },
  {
    id: '2h-ext',
    label: '🔍 [extension] ko.json 中文残留(warn-only)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ko', '--target=extension'],
    mode: 'warn',
  },
  {
    id: '2i-ext',
    label: '🔍 [extension] en.json 破碎英文(warn-only)',
    script: 'check-i18n-broken-en.mjs',
    args: ['--target=extension'],
    mode: 'warn',
  },
  // --- shared 守门(5 项,2026-07-26 i18n shared/ 抽取重构前置条件) ---
  // 与 2f-shared(已存在,跑 check-i18n-keys.mjs --target=shared)独立,不冲突
  // shared/{en,ja,ko,zh-TW}.json 当前可能为 19 行,后续阶段同步到 505 行
  {
    id: '2j-shared',
    label: '🔍 [shared] zh-TW 简体字残留(blocking)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['zh-TW', '--target=shared'],
    mode: 'blocking',
  },
  {
    id: '2k-shared',
    label: '🔍 [shared] ko.json 中文残留(blocking)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ko', '--target=shared'],
    mode: 'blocking',
  },
  {
    id: '2l-shared',
    label: '🔍 [shared] ja.json 中文残留(warn-only)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ja', '--target=shared'],
    mode: 'warn',
  },
  {
    id: '2m-shared',
    label: '🔍 [shared] en.json 破碎英文(blocking)',
    script: 'check-i18n-broken-en.mjs',
    args: ['--target=shared'],
    mode: 'blocking',
  },
  {
    id: '2f-shared-diff',
    label: '🌐 [shared] i18n AI 翻译流水线(blocking)',
    script: 'i18n-diff.mjs',
    args: ['--target=shared'],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 shared/zh-CN.json 有改动但 i18n pending 非空,请先跑翻译流水线:',
      '     1. node scripts/i18n-diff.mjs --target=shared  (检测差异,生成 pending 清单)',
      '     2. AI agent 翻译 → .trae-cn/tmp/i18n-translations.json',
      '     3. node scripts/i18n-apply.mjs --target=shared  (应用翻译)',
      '     4. node scripts/check-i18n-keys.mjs --target=shared  (验证 parity)',
      '     5. git add packages/i18n/messages/shared/{en,ja,ko,zh-TW}.json 重新 commit',
      '',
    ].join('\n'),
  },
  // --- 2n-web (2026-07-26 新增,web 端 5 语言 i18n parity 强制校验, warn-only 起步 1 周后升级 blocking) ---
  // 与 item 2 区别:item 2 现有逻辑仅在 staged messages 改动时跑 parity,源码改动不触发
  // (避免每次 commit 都跑 parity 影响性能);本项强制每次 commit 都跑 5 语言 parity
  // (只做 parity,不扫源文件,耗时 < 100ms),防止"i18n JSON 没动但 parity 漂移漏检"。
  // 触发场景:有人手动编辑 zh-TW.json 误删键/合并冲突/三方工具破坏 JSON,
  //          item 2 检测不到但下次 commit 会因 parity 漂移阻塞主流程,
  //          提前到本次 commit 给出 warn 提示,降低主流程阻塞概率。
  // 升级 blocking 时间表:2026-08-02 (1 周后) 评估,期间观察误报率 → 改 mode: 'blocking'。
  // 2026-08-02 升级 blocking ✅(提前至 2026-07-26 收口,1 周观察期无误报)
  // --parity-only 标志作用:跳过源文件扫描 + 强制跑 parity(即使 staged 无 messages 改动)。
  // 任务原话"第 32 项"已被 32-web/32-miniapp-taro/32-mobile-rn/32-extension(同日 2026-07-26 死 key 扫描)占用,
  //   2n-web 延续 2* i18n 系列命名,与 item 2 同源。
  {
    id: '2n-web',
    label: '🌐 [web] 5 语言 i18n parity 强制校验 (blocking,2026-08-02 升级,兜底 item 2 漏检场景)',
    script: 'check-i18n-keys.mjs',
    args: ['--parity-only'],
    mode: 'blocking',
  },
  {
    // 2026-07-26 升级 blocking:11 天观察期(2026-07-15 引入)零误报,
    // 当前 3344 路由 / 2180 safeParse / 0 silent-ignore;AGENTS.md §5 强制 Zod 校验,
    // silent-ignore 是明确反模式,误报风险低。任务候选之一,符合"所有 parse 已加 safeParse"条件。
    id: '9',
    label: '🔍 safeParse 静默忽略(blocking,2026-07-26 升级)',
    script: 'check-safe-parse.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 Fastify 路由存在 safeParse 静默忽略反模式(result.success === false 不返回/不日志)。',
      '     修复:对 parse 失败明确返回 400 + 错误信息,或记日志后返回,禁止 silent-ignore。',
      '     详见 AGENTS.md §5 后端约束(Zod 校验请求参数)。',
      '',
    ].join('\n'),
  },
  {
    id: '13b',
    label: '📐 PROJECT_PLAN.md 体积(warn-only)',
    script: 'check-project-plan-size.mjs',
    args: [],
    mode: 'warn',
  },
  {
    id: '19',
    label: '⚠️  staged 污染预警(warn-only)',
    script: 'check-staged-pollution.mjs',
    args: [],
    mode: 'warn',
  },
  {
    id: '21',
    label: '🌐 多端同步开发守门(warn-only)',
    script: 'check-multi-end-sync.mjs',
    args: [],
    mode: 'warn',
  },
  {
    id: '22',
    label: '📖 README 同步守门(warn-only)',
    script: 'check-readme-sync.mjs',
    args: [],
    mode: 'warn',
  },
  {
    id: '24b',
    label: '🔌 端口注册表守门(warn-only)',
    script: 'check-port-registry.mjs',
    args: [],
    mode: 'warn',
  },

  // --- 31 (2026-07-26 新增,扩展端登录界面与 web 端视觉一致任务收尾) ---
  // warn-only:脚本刚建,先观察一周,后续可升级 blocking。
  // 静态扫描 7 项:web 端 AuthShell re-export + thin wrapper 仅透传 SharedAuthShell、
  // 共享 .login-scope/.welcome-img-dark 单一来源、web+extension globals.css 无根级
  // .login-scope 重复、extension 必须从 @ihui/ui-react import。
  // 失败含义:有人重新写了一份本地 AuthShell,导致 web/extension 视觉漂移。
  // 接入原因:commit 1f6f35cf9 + 09db8938e 已把 AuthShell 抽到 packages/ui-react 共享,
  // 但若不接 pre-commit 守门,后续会被无意回退。AGENTS.md §4 圆角守门 + 本脚本 =
  // 共享组件"单一来源"双保险。
  {
    id: '31',
    label: '🛡️  AuthShell 共享实现静态守门(warn-only,防 web/extension 视觉漂移)',
    script: 'verify-auth-shell.mjs',
    args: [],
    mode: 'warn',
  },

  // --- 34 (2026-07-26 新增,@ts-ignore 新增检测,防历史遗留复发) ---
  // warn-only:本批次刚清理 215 处历史遗留 @ts-ignore(早期 workspace 包未导出类型时的压制),
  //   包已修复导出,@ts-ignore 是无效历史遗留。warn 级别原因:@ts-ignore 有时是合理压制
  //   (如第三方库类型缺陷),不强制阻塞 commit,只提醒开发者审视。
  // 跳过白名单:e2e/ 目录(@playwright/test 类型解析场景)、node_modules/ / dist/ / .next/ / build/。
  // 失败含义:staged 文件中新增 @ts-ignore / @ts-nocheck 注释,需审视是否真的需要。
  // id 说明:任务原话"第 31 项"但 id '31' 已被 AuthShell 占用(同日 2026-07-26 新增),
  //   故用 id '34'(33 LLM provider 之后的下一个可用编号)。
  {
    id: '34',
    label: '🔍 @ts-ignore 新增检测(warn-only,防 215 处历史遗留复发)',
    script: 'check-ts-ignore.mjs',
    args: [],
    mode: 'warn',
    onFailHint: [
      '',
      '  💡 @ts-ignore 是类型安全压制,本仓库刚清理 215 处历史遗留',
      '     请审视是否真的需要,或改用 e2e/tsconfig.json 独立配置',
      '     跳过白名单:e2e/ / node_modules/ / dist/ / .next/ / build/',
      '',
    ].join('\n'),
  },

  // --- 33 (2026-07-26 新增,LLM provider 字典化阶段 3 主体 blocking 守门) ---
  // blocking:阶段 3 主体已落地(2026-07-26),扁平字段已从 config.py 删除,
  //   LLM_PROVIDERS JSON 是唯一配置源,守门必须 blocking 防止 .env 配置错误导致运行时崩。
  //   详见 docs/llm-provider-stage3-changelog.md §3.2 步骤 3.4。
  // 校验 apps/ai-service/.env 的 LLM_PROVIDERS 字段是否符合
  //   ProviderConfig schema(apps/ai-service/app/core/provider_config.py),
  //   提前发现 JSON 格式错 / 字段类型错 / 未知 provider,避免运行时 Pydantic ValidationError。
  // 校验规则(7 条):JSON 解析 / 顶层对象 / 31 个 provider 白名单 / 字段类型 / 未知字段 / 空值 / 重复。
  // 失败含义:用户 .env 中 LLM_PROVIDERS JSON 字段不符合 schema,ai-service 启动后会运行时崩。
  // 已有依赖:scripts/check-llm-provider-schema.mjs(2026-07-26),3 退出码(0/1/2)。
  // 注意:LLM_PROVIDERS 为空是合法的(降级 stub 模式),info 不阻塞。
  {
    id: '33',
    label: '🛡️  LLM provider schema 守门 (blocking,阶段 3 主体已落地)',
    script: 'check-llm-provider-schema.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 apps/ai-service/.env 的 LLM_PROVIDERS 字段不符合 ProviderConfig schema。',
      '     常见错误:JSON 解析失败 / 字段类型错(api_key 必须是字符串、enabled 必须是布尔值) / 未知 provider。',
      '     修复方法:',
      '       ① 跑迁移脚本生成标准 JSON: node scripts/migrate-llm-providers.mjs --input apps/ai-service/.env --output apps/ai-service/.env.migrated --apply --backup',
      '       ② 用 --strict 模式定位具体错误: node scripts/check-llm-provider-schema.mjs --strict --json',
      '     详见 docs/llm-provider-stage3-changelog.md §4 用户升级指南',
      '',
    ].join('\n'),
  },

  // --- info (2 项) ---
  {
    id: '10',
    label: '📋 OpenAPI spec(informational)',
    script: 'openapi-check.mjs',
    args: [],
    mode: 'info',
  },
  {
    id: '23',
    label: '📋 staged 文件清单(info)',
    script: 'check-staged-files.mjs',
    args: [],
    mode: 'info',
  },
]

// === CLI 解析 ===

const cliArgs = process.argv.slice(2)
const passStaged = cliArgs.includes('--staged')
const showTiming = cliArgs.includes('--timing')
const showHelp = cliArgs.includes('--help') || cliArgs.includes('-h')

// === Help ===

if (showHelp) {
  const blocking = checks.filter((c) => c.mode === 'blocking')
  const warn = checks.filter((c) => c.mode === 'warn')
  const info = checks.filter((c) => c.mode === 'info')
  console.log(`
guardian-runner.mjs — 守门脚本批量执行器

用法:
  node scripts/guardian-runner.mjs [--staged] [--timing] [--help]

选项:
  --staged   传递 --staged 给所有脚本(pre-commit 模式)
  --timing   打印每个检查的耗时
  --help     打印此帮助

检查清单(${checks.length} 项):
  blocking (${blocking.length} 项): ${blocking.map((c) => c.id).join(', ')}
  warn     (${warn.length} 项): ${warn.map((c) => c.id).join(', ')}
  info     (${info.length} 项): ${info.map((c) => c.id).join(', ')}

执行逻辑:
  blocking 失败 → 立即 exit(1),阻塞 commit
  warn     失败 → 打印警告,继续执行
  info     →    始终继续,只打印信息
`)
  process.exit(0)
}

// === 执行 ===

let passed = 0
let warned = 0
let failed = 0
const startTime = Date.now()

for (const check of checks) {
  const cmdArgs = [...check.args]
  if (passStaged) cmdArgs.push('--staged')
  const cmd = `node scripts/${check.script}${cmdArgs.length > 0 ? ' ' + cmdArgs.join(' ') : ''}`

  console.log(`[${check.id}] ${check.label}...`)
  const checkStart = Date.now()

  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() })
    passed++
    if (showTiming) {
      console.log(`  ${C.dim}⏱  ${Date.now() - checkStart}ms${C.reset}`)
    }
  } catch {
    const elapsed = Date.now() - checkStart
    if (check.mode === 'blocking') {
      failed++
      if (check.onFailHint) {
        console.log(check.onFailHint)
      }
      console.error(`${C.red}❌ [${check.id}] ${check.label} 失败,提交已阻止${C.reset}`)
      // 打印汇总后退出
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
      console.error('')
      console.error(`${C.bold}🛡️ 守门脚本批量检查汇总${C.reset}`)
      console.error(`  总检查数: ${passed + warned + failed + (checks.length - passed - warned - failed)}`)
      console.error(`  ${C.green}通过: ${passed}${C.reset}`)
      console.error(`  ${C.yellow}警告: ${warned}${C.reset}`)
      console.error(`  ${C.red}失败: ${failed}${C.reset}`)
      console.error(`  总耗时: ${totalTime}s`)
      process.exit(1)
    } else if (check.mode === 'warn') {
      warned++
      console.warn(`${C.yellow}⚠️ [${check.id}] ${check.label} 失败 (warn-only,不阻塞 commit)${C.reset}`)
      if (showTiming) {
        console.log(`  ${C.dim}⏱  ${elapsed}ms${C.reset}`)
      }
    } else {
      // info 模式:失败不计数,视为通过
      passed++
      if (showTiming) {
        console.log(`  ${C.dim}⏱  ${elapsed}ms${C.reset}`)
      }
    }
  }
}

// === 汇总 ===

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
console.log('')
console.log(`${C.bold}🛡️ 守门脚本批量检查汇总${C.reset}`)
console.log(`  总检查数: ${checks.length}`)
console.log(`  ${C.green}通过: ${passed}${C.reset}`)
console.log(`  ${C.yellow}警告: ${warned}${C.reset}`)
console.log(`  ${C.red}失败: ${failed}${C.reset}`)
console.log(`  总耗时: ${totalTime}s`)

process.exit(0)
