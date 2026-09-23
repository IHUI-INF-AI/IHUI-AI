#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 守门脚本批量执行器。
 *
 * 接收配置数组,单进程顺序执行所有检查,输出汇总。
 * 将 pre-commit 中 52 个独立 `node scripts/xxx.mjs` 调用合并为单进程批量执行,
 * 降低 commit 耗时,提供统一汇总输出。
 *
 * CLI 用法:
 *   node scripts/guardian-runner.mjs [--staged] [--timing] [--push-gate] [--help]
 *
 *   --staged      传递 --staged 给所有脚本(pre-commit 模式)
 *   --timing      打印每个检查的耗时
 *   --push-gate   仅执行 push 门检查集(T1 全量 typecheck,staged-scope 降级,
 *                 2026-08-31 新增,详见 pushGateChecks 定义处注释)
 *   --help        打印帮助和检查清单
 *
 * 检查模式:
 *   blocking  失败 → 立即 exit(1),阻塞 commit
 *   warn      失败 → 打印警告,继续执行(不阻塞 commit)
 *   info      始终继续,只打印信息
 *
 * 条目可选字段:
 *   skipEnv        环境变量名,值为 '1' 时跳过该项(应急放行,见执行循环)
 *   onFailHint     失败时打印的修复指引
 *   stagedTriggers 路径前缀数组;声明后该项**仅在暂存区触及这些路径时**执行(见执行循环),
 *                  用于把与绝大多数提交无关的领域守门(桌面安装器等)挂上而不拖慢/误伤
 */
import { execSync, execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

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

// === 检查配置(按 mode 分组;项数与分级见 `--help`,勿在此写死数字——写死必然过期) ===

const checks = [
  // --- blocking(项数见 --help) ---
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
    // 2026-09-21 补应急通道:[2] 与 [2n-web] 同用 check-i18n-keys.mjs,full 模式同样会跑
    // parity(见脚本 837 行 label 分支),因此与 2n-web 共用同一应急变量 —— 并发会话
    // 未提交的 i18n WIP 造成的 parity 漂移属"非本 commit 范畴"假阳性。
    // 应急放行:HUSKY_SKIP_I18N_PARITY=1 git commit ...(commit message 写明责任归属)
    skipEnv: 'HUSKY_SKIP_I18N_PARITY',
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
    // --- 2e-dupns (2026-09-08 新增,i18n 重复命名空间/重复键守门,blocking) ---
    // 背景:JSON 标准对重复键静默 last-wins,写入侧"追加块而非编辑既有块"会静默遮蔽正确翻译。
    // 已发生两次同款事故:web messages 追加了重复 repoWiki 块(en=zh-TW 值遮蔽英文;ja/ko/zh-CN/zh-TW 尾部重复块)。
    // JSON.parse/reviver 无法检测(Walk 阶段已去重),必须字符级扫描。
    id: '2e-dupns',
    label: '🧬 i18n 重复命名空间/重复键(blocking,防 JSON last-wins 静默遮蔽)',
    script: 'check-i18n-duplicate-namespaces.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 检测到 messages JSON 存在重复命名空间/重复键(last-wins 遮蔽风险):',
      '     1. node scripts/check-i18n-duplicate-namespaces.mjs  (定位文件与行号)',
      '     2. 保留正确版本块,删除重复块(通常是写入侧误追加的尾部块)',
      '     3. 重新 commit;禁止以"追加新块"方式修改既有命名空间',
      '',
    ].join('\n'),
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
      '     2. AI agent 翻译 → .ihui-agent/tmp/i18n-translations.json',
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
      '     2. AI agent 翻译 → .ihui-agent/tmp/i18n-translations.json',
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
    id: '11b',
    label: '📐 圆角溢出(父 rounded + 子 bg 贴边)',
    script: 'check-rounded-overflow.mjs',
    args: [],
    mode: 'warn',
  },
  {
    id: '11c',
    label: '🏷️  选中态描边定稿防回退(禁纯黑/纯白,全站)',
    script: 'check-tagsview-visual.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '11d',
    label: '🚫 分割线违规(divide-y / divide-x)',
    script: 'check-no-divider.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '11h',
    label: '🚫 UI 图标位 emoji 违规(icon 字段/渲染位)',
    script: 'check-no-emoji-icons.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '11e',
    label: '📏 单文件行数上限 (仅拦新增)',
    script: 'check-file-size.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '11f',
    label: '🚫 原生 alert/confirm/prompt 弹窗',
    script: 'check-no-native-dialog.mjs',
    args: [],
    mode: 'blocking',
  },
  {
    id: '11g',
    label: '🚫 mask-image 渐变遮罩',
    script: 'check-no-mask-image.mjs',
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
    // 2026-09-21 补应急通道(与其余 10+ 门惯例对齐,此前遗漏):
    // 本项巡查"项目父目录及其非项目子目录"的运行时产物,与 staged 内容无关 ——
    // 只要工作环境里存在**其他会话/其他任务**正在使用的项目外临时文件,本次提交即被
    // 阻塞(实测 2026-09-21 09:5x:G:\tmp-probe 下有并发会话 2 分钟前才创建的审计脚本,
    // 而官方清理工具 pnpm hygiene:parent:clean 会直接删掉对方正在使用的文件)。
    // 应急放行:HUSKY_SKIP_PARENT_POLLUTION=1 git commit ...(commit message 写明责任归属)
    skipEnv: 'HUSKY_SKIP_PARENT_POLLUTION',
  },
  {
    id: '27',
    label: '🛡️  z-index 层叠防护(防第三方 IDE 注入 + 遮罩 fade-in 回归 + 窗口按钮等效压暗)',
    script: 'check-z-index-guard.mjs',
    args: [],
    mode: 'blocking',
    // 2026-09-22 补:此前无应急通道,与其余门惯例对齐
    skipEnv: 'HUSKY_SKIP_Z_INDEX_GUARD',
    onFailHint: [
      '',
      '  💡 五类命中处置:',
      '     ① tokens.css / globals.css 出现 !important → 项目禁令,改走 layout.tsx inline script setProperty;',
      '     ② layout.tsx inline script 少设 --z-* 变量 → 补回 11 个 setProperty;',
      '     ③ dialog.tsx 遮罩加了 open 态 fade-in → 删掉 animate-in / fade-in-0(渐显期间内容全亮);',
      '     ④ GlobalTopBar.tsx 两组契约缺任一标记 ——',
      '        等效压暗层 data-window-controls + data-window-controls-dim:窗口控制三按钮挂',
      '        z-max(10003) 不能降(须高于 resize 抓手 z-loading=10000),遮罩永远盖不到它,',
      '        只能靠等效压暗覆盖层,删掉=登录窗等 29+ 处遮罩下三按钮重新全亮(同族第 3 次复发);',
      '        失焦非活动态 data-window-inactive(容器) + globals.css 的 [data-window-controls][data-window-inactive]',
      '        无边框窗口拿不到 DWM 原生"非活动标题栏变灰",删掉即失焦时按钮不再降亮;',
      '     ⑤ 判闸有效性自查:node scripts/check-z-index-guard.mjs --self-test(内存断言,不落盘)',
      '     紧急跳过(不推荐):HUSKY_SKIP_Z_INDEX_GUARD=1 git commit ...',
      '',
    ].join('\n'),
  },
  {
    id: '28',
    label: '🛡️  全屏遮罩 z-index 层级(防 fixed inset-0 + z-50 复发)',
    script: 'check-overlay-zindex.mjs',
    // 脚本无 --staged 语义(全量扫 apps/web + packages/ui-react,实测 0 违规才接入)
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_OVERLAY_ZINDEX',
    onFailHint: [
      '',
      '  💡 fixed inset-0 全屏遮罩用了 z-50/z-40/z-30 等低数字 Tailwind 类(值 < 100),',
      '     低于 AISidePanel 的 z-sticky=990,会被压在下面 = AI 面板露在遮罩之上。',
      '     修复:把 z-50 改为 z-modal(=2000, 引用 --z-modal CSS 变量)。',
      '     透明点击捕获层(无 bg-black)不在本守门范围。',
      '     全量清单:node scripts/check-overlay-zindex.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_OVERLAY_ZINDEX=1 git commit ...',
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
  // 2026-09-12 补注:本机宿主会清理 gitdir 下 depth>=2 的嵌套 ref 目录
  //   (refs/remotes/<remote>/、refs/tags/<ns>/) → 该守门会因"仅远端 tag"抖动性阻塞。
  //   守护 IHUI-GIT-GUARD 已内建离线自愈(见 git-guardian.mjs healRefs);
  //   手工触发:node scripts/git-refs-heal.mjs [--refresh-remote]
  {
    id: '30a',
    label: '🛡️  Commit 丢失防护(blocking,AGENTS.md §22,防 reset / drop stash 误丢 commit)',
    script: 'check-commit-loss-guard.mjs',
    args: ['--blocking', '--filter-stash'],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 若上表是"仅远端 tag"或 origin 变 [gone],通常是宿主清理嵌套 ref 导致的抖动,',
      '     并非真的丢 commit。处理(离线即可恢复):',
      '       node scripts/git-refs-heal.mjs                  # 按清单重建 + 固化进 packed-refs',
      '       node scripts/git-refs-heal.mjs --refresh-remote # 联网从 origin 校准(需 http_proxy)',
      '     守护 IHUI-GIT-GUARD 每 10s 巡检,会自动修 —— 也可等它自动恢复。',
      '     机制说明:AGENTS.md §5b「嵌套 ref 存续」。',
      '',
    ].join('\n'),
  },
  // --- 30c (2026-09-15 新增,陈旧副本守门,2026-09-14 338 快照事故配套) ---
  // blocking:338 快照曾夹带 2026-09-13 生产关键工作的整体回退(计费/4 迁移/
  //   守门脚本),typecheck/守门全绿也发现不了(删功能不报错、测试也被删)。
  //   根因:staged 区被并行会话塞入陈旧副本(blob = 基线祖先的历史版本)。
  //   本守门对 staged 的 M 文件做 blob 祖先检测、对红旗路径删除(迁移/测试/守门脚本)拦截。
  // 跳过方法:HUSKY_SKIP_STALE_COPY=1 git commit ...
  {
    id: '30c',
    label: '🛡️  陈旧副本守门(blocking,2026-09-14 338 快照事故配套,防 staged 区夹带历史版本回退)',
    script: 'check-stale-copy.mjs',
    args: [],
    mode: 'blocking',
  },
  // --- 30b (2026-09-08 新增,stash 滞留源码改动守门,AGENTS.md §12d 配套) ---
  // blocking:stash 是黑盒,滞留的已完成工作在并行合流下必然造成"功能被回滚"假象
  //   (2026-09-08 实证:压缩入口整合 3 文件 + IM 聊天室重写 775 行双双滞留丢失误判)。
  //   ≥48h 含源码改动且无 backup/stash-* 或 lost-commit/* tag 备份 → 阻塞 commit。
  // 跳过方法:HUSKY_SKIP_STALE_STASH_CHECK=1 git commit ...
  {
    id: '30b',
    label: '🛡️  Stash 滞留源码改动守门(blocking,AGENTS.md §12d,防已完成工作滞留 stash 静默失联)',
    script: 'check-stale-stashes.mjs',
    args: ['--blocking'],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 存在滞留 ≥48h 的 stash 含源码改动且未做零损失备份,',
      '     处置二选一:A. git stash apply "stash@{n}" → 验证 → commit 落地 → drop;',
      '                B. git tag backup/stash-<slug>-<sha7> "stash@{n}" 后 drop(内容永不丢)。',
      '     跳过(应急):HUSKY_SKIP_STALE_STASH_CHECK=1 git commit ...',
      '',
    ].join('\n'),
  },
  // --- 16c (2026-08-18 新增,staged-typecheck 源/测镜像漂移防御,AGENTS.md §22b 配套) ---
  // blocking:scripts/check-staged-typecheck.mjs 的核心过滤函数
  //   (filterTscOutputForStagedFiles / getOriginalInclude / normalizePath)
  //   未导出,测试靠镜像常量复制函数体,易漂移。指纹比对守卫源/测同步。
  // id 选 16c(续 16 / 16b staged-typecheck 系列),放在 30a 之后(逻辑上紧贴 §22b 守门簇)。
  // 跳过方法:HUSKY_SKIP_STAGED_TYPECHECK_MIRROR_SYNC=1 git commit ...
  {
    id: '16c',
    label: '🛡️  staged-typecheck 源/测镜像同步(blocking,AGENTS.md §22b 镜像同步义务)',
    script: 'check-staged-typecheck-mirror-sync.mjs',
    args: [],
    mode: 'blocking',
  },
  // --- 45 (2026-08-19 新增,C 盘路径硬编码扫描守门,AGENTS.md §26 配套) ---
  // warn-only:§26 C 盘防护已配置 11 个环境变量永久指向 D 盘,但 agent 偶尔会在
  //   写代码时把 `C:\temp\xxx` / `C:\Users\*\AppData\Local\Temp\xxx` 硬编码进源文件,
  //   绕过环境变量直接落 C 盘。本守门在 pre-commit 阶段拦 staged 区 .ts/.tsx/.js/
  //   .mjs/.cjs/.py/.ps1/.sh 中的硬编码写入路径(8 种正则 + 4 项排除),违规 exit 1。
  // warn-only 起步理由:脚本刚建,先观察一周误报率,后续可升级 blocking。
  // 跳过方法:HUSKY_SKIP_C_DRIVE_PATHS=1 git commit ...
  // id 说明:任务原话无特定 id 要求,§26 是新章节,选下一个可用编号 '45'(44 已被
  //   check-root-dir-clean.mjs 占用)。插入位置:16c 之后(逻辑上紧贴 staged
  //   系列守门簇,与 staging area 扫描同源)。
  {
    id: '45',
    label: '🛡️  C 盘路径硬编码扫描(warn-only,AGENTS.md §26)',
    script: 'check-c-drive-paths.mjs',
    args: [],
    mode: 'warn',
    onFailHint: [
      '',
      '  💡 staged 文件中检测到硬编码 C 盘写入路径(如 C:\\temp\\ / C:\\Users\\*\\AppData\\Local\\Temp\\)。',
      '     修复:用 os.tmpdir() (Node) 或 $env:TEMP (PowerShell) 替代,自动走 D 盘;',
      '           用户配置目录用工具自带配置 (pnpm config / npm config / pip config);',
      '           系统日志写 $env:TEMP (已指向 D 盘)。',
      '     唯一例外:apps/desktop/src-tauri/ 内部 API (已自动排除)。',
      '     跳过方法 (应急):HUSKY_SKIP_C_DRIVE_PATHS=1 git commit ...',
      '',
    ].join('\n'),
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
  // --- 36 (2026-07-27 新增,miniapp-taro token 同步守门,防 app.css 与 tokens.css 漂移) ---
  // blocking:Taro 4 + Tailwind v3 不兼容 v4 @theme 语法,app.css 由 sync-design-tokens.mjs
  //   自动生成 :root/.dark 块。若手动编辑 app.css 或 tokens.css 改后未运行 sync 脚本,
  //   会导致 miniapp-taro 视觉与 web 端不一致。本守门在 pre-commit 校验,发现漂移阻塞 commit。
  // 失败含义:app.css 的 --color-* 变量与 tokens.css 不一致,需运行:
  //   pnpm --filter @ihui/miniapp-taro sync-tokens 重新同步后重新 commit。
  {
    id: '36',
    label: '🎨 [miniapp-taro] design-tokens 同步(防 app.css 漂移)',
    script: 'check-miniapp-tokens-sync.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 apps/miniapp-taro/src/app.css 的 --color-* 变量与 packages/design-tokens/src/styles/tokens.css 不一致,',
      '     修复:pnpm --filter @ihui/miniapp-taro sync-tokens',
      '     然后重新 git add apps/miniapp-taro/src/app.css 并 commit',
      '',
    ].join('\n'),
  },
  {
    id: '37',
    label: '🎨 [web] design-tokens 同步(防 globals.css 漂移)',
    script: 'check-web-tokens-sync.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 apps/web/app/globals.css 未 @import tokens.css 或顶层手抄 :root/.dark 变量,',
      '     修复:确认 globals.css 含 @import "../../../packages/design-tokens/src/styles/tokens.css";',
      '     删除顶层 :root/.dark 块中与 tokens.css @theme 重复的变量',
      '',
    ].join('\n'),
  },
  // --- 38 (2026-07-28 新增,solito 幽灵依赖回归守门,防 P0 优化被回退) ---
  // blocking:本仓库刚完成 P0 级优化移除 solito 幽灵依赖(commit f8c9a6630c),
  //   solito 0 真实运行时调用,packages/app 改用纯 props 注入式跨端共享组件。
  //   若其他 agent 误把 solito 重新引入,会导致依赖树复杂度回升 + packages/app 耦合回升。
  //   本守门检测 package.json / pnpm-workspace.yaml / patches/ / packages/app 源码 中的 solito 残留。
  // 失败含义:有人重新引入 solito 依赖,需移除后重新 commit。
  {
    id: '38',
    label: '🛡️  solito 幽灵依赖回归守门(blocking,防 P0 优化被回退)',
    script: 'check-solito-residue.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 检测到 solito 依赖被重新引入,本仓库已于 2026-07-28 移除 solito(commit f8c9a6630c)。',
      '     packages/app 已改用纯 props 注入式跨端共享组件(无外部导航库依赖)。',
      '     修复:从 package.json 删除 solito 依赖,从 pnpm-workspace.yaml 删除 *solito* hoist,',
      '     删除 patches/solito@*.patch,删除 packages/app 源码中 import from "solito/..." 语句。',
      '',
    ].join('\n'),
  },
  // --- 39 (2026-07-29 新增,mobile-rn screen 迁移完整性守门,防独立实现回升) ---
  // blocking:P3-3.3 "独立 screen 实现清零" 目标完成,153 个 .tsx 中 151 个迁移到
  //   @ihui/rn-app 共享层,仅 2 个豁免(DebugScreen/DevEnterScreen)。若不接 pre-commit
  //   守门,后续新增 screen 漏迁移会导致独立实现回升、维护成本系数恶化。
  // 检测逻辑:扫描 apps/mobile-rn/src/screens/*.tsx,检查是否 import from '@ihui/rn-app',
  //   未导入且不在白名单(Debug/DevEnter/SharedDemo/profileMenuData)→ blocking 阻塞 commit。
  // --staged 模式:仅检查 staged 的 screen 文件(性能优化,pre-commit 用)。
  // 失败含义:有人新增 mobile-rn screen 但未迁移到共享层,需迁移或登记白名单后重新 commit。
  {
    id: '39',
    label: '📱 mobile-rn screen 迁移完整性(blocking,防独立实现回升)',
    script: 'check-rn-app-migration.mjs',
    args: ['--staged'],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 发现 mobile-rn screen 未迁移到 @ihui/rn-app 共享层。',
      '     P3-3.3 目标要求所有 screen(除白名单豁免)必须 import from "@ihui/rn-app"。',
      '     修复(二选一):',
      '       A. 迁移到共享层:packages/app/src/features/<feature>/ 创建共享组件 + wrapper 改造',
      '       B. 若确属 RN 端独占,在 scripts/check-rn-app-migration.mjs WHITELIST 登记并附理由',
      '     详见 scripts/check-rn-app-migration.mjs --help',
      '',
    ].join('\n'),
  },
  {
    id: '40',
    label: '🔗 共享层重复检测(blocking,防端内重新实现 shared hook/util)',
    script: 'check-shared-layer-duplication.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 发现端内(apps/*)独立实现了 packages/shared 已提供的 hook/util。',
      '     AGENTS.md §3 "共享层优先" 要求:能共用的一定共用,禁止端内重新实现。',
      '     修复:',
      '       A. 删除端内实现,改为 import { xxx } from "@ihui/shared"',
      '       B. 若确属平台特有(依赖 DOM/RN/Taro API),在脚本 whitelist 登记并附理由',
      '     详见: node scripts/check-shared-layer-duplication.mjs',
      '',
    ].join('\n'),
  },
  // --- 41 (2026-08-02 新增,单分支开发守门,AGENTS.md §9b 落地) ---
  // blocking:仓库曾积累 12 个分支(本地 6 + 远程 7 + 1 upstream),教训:分支不是"工作单元",
  //   是"协作单元"——单 agent 单任务无需分支,直接 main 提交即可。
  // 本守门检测 git branch -a 中除 main / origin/main / upstream/main 外的分支;
  // goal/ 前缀 + .ihui-agent/goal-runtime/STATE.md 标注 active 的 goal 模式临时分支豁免。
  // 失败含义:检测到非法分支,需删除或标注豁免后重新 commit。
  {
    id: '41',
    label: '🌿 单分支开发守门(blocking,AGENTS.md §9b)',
    script: 'check-single-branch.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 AGENTS.md §9b:除 main 外禁止创建任何分支,所有改动统一往 main 合并。',
      '     修复:git branch -d <已合并分支> / git branch -D <未合并分支>(先 tag 备份)',
      '     或 git push origin --delete <远程分支>',
      '     goal/ 临时分支需在 .ihui-agent/goal-runtime/STATE.md 标注 active 才豁免',
      '',
    ].join('\n'),
  },
  {
    id: '2d',
    // 2026-09-23 升阻塞:判据已从"任何汉字都 warn"(web/ja 实测 15132 处噪音,等于没判)
    // 换成**字形与繁体不同 ∧ 不在 2010 常用汉字表 2136 字内**的精确判定,
    // 并补两条必须存在的豁免(法定备案号 / 平台品牌名),276 处真账已由 `aa0286afeb8` 清零,
    // 六端 ja 全绿 ⇒ 此刻升阻塞不会误伤任何在途提交。判据见 scripts/scan-i18n-zh-residue.mjs + scripts/joyo-kanji.json。
    label: '🔍 ja.json 中文简体残留(blocking,常用汉字表精确判据)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ja'],
    mode: 'blocking',
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
      '     2. AI agent 翻译 → .ihui-agent/tmp/i18n-translations.json',
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
    // 2026-09-21 补应急通道(与其余 10+ 门的 HUSKY_SKIP_* 惯例对齐,此前遗漏):
    // 本项 --parity-only 是"每次 commit 都跑全量 parity",且 parity 漂移**没有** WIP 降级
    // 通道(check-i18n-keys.mjs 的 wipMissingKeyIssues 只覆盖 missing key,不覆盖 parity)。
    // 后果:只要工作区存在"并发会话新增 zh-CN 键、4 语言尚未补齐"的未提交 WIP,
    // --- 即使本次提交完全不含 packages/i18n/** --- 全仓 commit 一律被阻塞(实测 2026-09-21)。
    // 应急放行:HUSKY_SKIP_I18N_PARITY=1 git commit ...(commit message 写明责任归属)
    skipEnv: 'HUSKY_SKIP_I18N_PARITY',
  },
  // --- 2f-mobile-rn (2026-07-28 新增,mobile-rn 端 5 语言 i18n parity 守门) ---
  // mobile-rn 是 5 端中唯一无显式 parity 守门的端(仅靠死 key 扫描内置 5 语言 JSON 加载做隐式校验)。
  // ⚠️ 已知限制(2026-07-28 验证):check-i18n-keys.mjs 当前 MESSAGES_DIR 分支只识别
  //   web/extension/shared/cli 四种 target,mobile-rn 会 fall through 到默认 web 分支,
  //   实际检查的是 packages/i18n/messages/web/ 而非 mobile-rn/。
  //   要让本守门真正生效,需在 check-i18n-keys.mjs 增加 mobile-rn 分支(类似 cli 分支),
  //   当前为占位项,warn-only 不阻塞 commit。修复后此项才有实际防护意义。
  // 升级 blocking 评估:待 check-i18n-keys.mjs 补 mobile-rn 分支后再评估。
  {
    id: '2f-mobile-rn',
    label: '🌐 mobile-rn i18n parity 守门(warn-only 起步,2026-07-28 立)',
    script: 'check-i18n-keys.mjs',
    args: ['--target=mobile-rn', '--parity-only'],
    mode: 'warn',
    onFailHint: [
      '',
      '  💡 mobile-rn 端 5 语言 i18n key 集合不一致。',
      '     修复:node scripts/check-i18n-keys.mjs --target=mobile-rn 查看详情,',
      '     补齐缺失 key 或删除多余 key,确保 zh-CN/zh-TW/en/ja/ko 5 语言 key 集合完全一致。',
      '     1 周后(2026-08-04)评估升级 blocking。',
      '',
    ].join('\n'),
  },
  // --- 2f-cli (2026-07-28 新增,cli 端 5 语言 i18n parity 守门) ---
  // check-cli-i18n-parity.mjs 是独立脚本(校验 packages/i18n/messages/cli/*.json),
  // 原未挂载 guardian-runner,CI 未自动跑。cli 端 i18n 体量小(59 keys/5 locales),
  // 风险低,warn-only 起步,后续按需升级 blocking。
  {
    id: '2f-cli',
    label: '🌐 cli i18n parity 守门(warn-only,2026-07-28 立)',
    script: 'check-cli-i18n-parity.mjs',
    args: [],
    mode: 'warn',
    onFailHint: [
      '',
      '  💡 cli 端 5 语言 i18n key 集合不一致。',
      '     修复:node scripts/check-cli-i18n-parity.mjs 查看详情,',
      '     补齐缺失 key 或删除多余 key,确保 zh-CN/zh-TW/en/ja/ko 5 语言 key 集合完全一致。',
      '     cli 端 i18n 体量小(63 行),warn-only 起步,后续按需升级 blocking。',
      '',
    ].join('\n'),
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
    label: '🔌 端口注册表守门(warn-only,monorepo-wide 全量)',
    script: 'check-port-registry.mjs',
    // 2026-08-19 立:从仅 staged 升级为 --all monorepo-wide 全量静态规则
    // (端口注册表是项目级契约,不应只检查本次 commit 改动,
    //  否则历史遗留非 88xx 端口会持续漏检)
    args: ['--all'],
    mode: 'warn',
  },

  // --- 31 (2026-07-26 新增,2026-08-19 删除) ---
  // ID 31 verify-auth-shell 已废弃(迁移 shim,实际检查由 verify-shared-auth.mjs 11 项接管)
  // 删除理由:verify-shared-auth.mjs 已在 §22 SOP 阶段成为 shared/auth 真实守门入口,
  //   原 verify-auth-shell.mjs 只是兼容 shim,2026-08-19 完成迁移后无任何 caller 依赖,
  //   删 file + guardian-runner 注册项,守卫器序列号顺延(2026-08-19 节点)
  //   留空占位:不重新分配 id,避免历史 commit log / AGENTS.md §22 引用断裂。

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

  // --- 42 (2026-08-12 新增,React SyntheticEvent 闭包陷阱守门,AGENTS.md §42 配套) ---
  // blocking:apps/web/src/components/chat/model-selector.tsx 原实现 onMouseLeave 内
  //   setTimeout 闭包访问已失效的 e.currentTarget(React 17+ SyntheticEvent 在 handler
  //   返回后 currentTarget 置 null),导致 popover 常驻显示。本守门禁止在 setTimeout /
  //   setInterval / requestAnimationFrame / requestIdleCallback / queueMicrotask 的
  //   回调闭包内访问 e.currentTarget / e.target / e.preventDefault / e.stopPropagation
  //   等 React SyntheticEvent 属性/方法。
  // 失败含义:在异步回调闭包内访问了 React 事件对象属性,会在 React 17+ 下产生不可预测的
  //   行为(如 setPopoverAnchor 永远不进关闭分支)。需将 event 属性在同步阶段缓存到变量,
  //   或用 useRef 管理 DOM 元素。
  {
    id: '42',
    label: '🛡️  React SyntheticEvent 闭包陷阱(防 popover 常驻显示复发)',
    script: 'check-event-closure-leak.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 在异步回调闭包内访问了 React SyntheticEvent 属性(如 e.currentTarget)。',
      '     React 17+ 在 handler 返回后 currentTarget 置 null,异步闭包内访问永远为 null。',
      '     修复:在 handler 同步阶段 const el = e.currentTarget 缓存到闭包变量,',
      '     或用 useRef 管理 DOM 元素(anchorRef.current 替代 e.currentTarget)。',
      '     参考:apps/web/src/components/chat/model-selector.tsx MemberDiscountSection',
      '',
    ].join('\n'),
  },

  // --- 44 (2026-08-15 新增,根目录整洁守门,AGENTS.md「根目录整洁铁律」配套) ---
  // blocking:一级目录只允许白名单内条目(配置 + 标准文档 + 项目强制文档 + 固定目录),
  //   任何新文件/新目录/新隐藏文件落地根目录都会触发,阻断 commit,逼你清理或显式加白名单。
  //   背景:根目录曾散落 debug.log / page_*.html / cookies.txt / 过时 start-dev.ps1 /
  //   browser_test_output 等 10+ 临时产物,2026-08-15 整理后立此守门防回潮。
  //   白名单维护在 scripts/check-root-dir-clean.mjs 内(4 组 Set),新增合法条目需显式审批。
  {
    id: '44',
    label: '🧹 根目录整洁守门(一级目录白名单)',
    script: 'check-root-dir-clean.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 一级目录存在白名单外条目,已阻断 commit。',
      '     处置(二选一):',
      '       ① 临时/垃圾产物 → 删除,或移入 tmp/ 或 logs/',
      '       ② 合法新增(新配置/新文档/新目录) → 加入 scripts/check-root-dir-clean.mjs 白名单后重新 commit',
      '     白名单四组:ALLOWED_FILES / ALLOWED_DIRS / ALLOWED_HIDDEN_FILES / ALLOWED_HIDDEN_DIRS。',
      '',
    ].join('\n'),
  },

  // --- 46 (2026-09-09 新增,统一返回键防私接守门) ---
  // blocking:顶栏统一返回键(搜索右侧/加号左侧,动画拉出)是全站返回行为唯一渲染点,
  //   页面私写 router.back()/history.back() 会绕过顶栏(动画/降级/页内 onBack 优先级全部失效),
  //   重演"各页面各写各的返回键"散乱态。页面需要返回键 = 声明而非实现:
  //   二级及以上子页面由 TopBarBackAutoRegister 自动声明(零代码),
  //   页内视图级返回用 useTopBarBack(config),指定降级路由用 <BackButton fallbackHref />。
  //   id 45 已被 check-c-drive-paths.mjs(warn-only)占用,顺延取 46。
  // 跳过方法:HUSKY_SKIP_INLINE_BACK_GUARD=1 git commit ...
  {
    id: '46',
    label: '🔙 统一返回键防私接守门(禁页面私写 router.back/history.back)',
    script: 'check-inline-back-button.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 页面私接了 router.back()/history.back(),绕过顶栏统一返回键。',
      '     修复方式(声明而非实现):',
      '       ① 二级及以上子页面:零代码,TopBarBackAutoRegister 已自动声明;',
      '       ② 页内视图级返回(详情→列表):useTopBarBack(selected ? { onBack: () => setX(null) } : null);',
      '       ③ 指定降级路由:<BackButton fallbackHref="/parent" />。',
      '     唯一豁免:apps/web/src/components/layout/GlobalTopBar.tsx(统一返回键本体)。',
      '',
    ].join('\n'),
  },

  // --- watermark coverage (blocking, 2026-09-10 立; 2026-09-12 升级**自愈式**) ---
  //   历史事故 ①: 新增文件未注入溯源水印 -> 本地提交通过、CI `Provenance watermark check` 红。
  //   历史事故 ②: 生成器/sed 等文本级改写把已跟踪文件的水印弄丢/弄坏 -> 门禁**恒红**,
  //   而旧版工具无法复现自己强制的版式, 只能靠 HUSKY_SKIP_WATERMARK_GUARD=1 绕过提交。
  //   2026-09-12: 门禁自带自愈 —— 检出缺口后自动 clean+inject 并 git add 回暂存区,
  //   "未加水印的文件进入提交"在结构上不再可能。CI 仍用 `watermark.mjs verify` 严格判定。
  //   只看 git 已跟踪文件(含本次新 git add, 与 CI 检出范围一致, 本地未跟踪构建产物不计入)。
  //   纯判定(不改文件, 审计用): node scripts/check-watermark-coverage.mjs --no-fix
  //   跳过: HUSKY_SKIP_WATERMARK_GUARD=1 git commit ...(紧急; 正常流程不再需要)
  {
    id: '47',
    label: '💧 溯源水印覆盖守门(自愈式: 缺失/损坏自动补齐并回暂存区)',
    script: 'check-watermark-coverage.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 已有跟踪文件缺失/损坏溯源水印,且自动补齐未能达标(通常 = 缺口 > 200 个, 或类型不可注入)。',
      '     CI 会因 Provenance watermark check 失败,请先修复。',
      '     手动修复: node scripts/watermark.mjs inject <file>',
      '     列出全部缺口: node scripts/watermark.mjs list-uncovered',
      '     排查批量改写来源(文本级 sed/prettier/生成器)后整体重注入: node scripts/watermark.mjs inject',
      '',
    ].join('\n'),
  },

  // --- workflow step order (blocking, 2026-09-10 立) ---
  //   历史事故: mobile-apk / mobile-ios workflow 里 setup-node(cache: pnpm) 排在 pnpm/action-setup
  //   之前 -> setup-node 找不到 pnpm -> "Unable to locate executable file: pnpm" 永久失败。
  //   跳过: HUSKY_SKIP_WORKFLOW_ORDER=1 git commit ...
  {
    id: '48',
    label: '🧩 GitHub Actions 步骤顺序守门(setup-node cache:pnpm 必须在 pnpm/action-setup 之后)',
    script: 'check-workflow-step-order.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 workflow 里 actions/setup-node 用了 cache: pnpm,但 pnpm/action-setup 排在它后面。',
      '     修复: 把 pnpm/action-setup 步骤移到 actions/setup-node 之前。',
      '',
    ].join('\n'),
  },

  // --- 49 (2026-09-13 新增,迁移记账守门,blocking) ---
  //   背景: drizzle-kit migrate 按 `Number(DB.created_at) < entry.when` 判定是否应用。
  //   仓库 journal 的 when 一度是合成时间戳(等差 +86400000,止于 1721513600000),而库内
  //   created_at 是真实时间(1788717703662)→ 判据恒假 → migrate 每轮空转、一条也不应用,
  //   且无任何守门 → 静默数周。修复后 journal 与库双射对齐(254 ↔ 254,when 集合完全相同)。
  //   本项校验: journal↔.sql 双向一一对应、tag 唯一、when 严格递增且唯一;idx 断号仅告警
  //   (drizzle 按 tag 配对 SQL、按 when 排序,idx 只是元数据)。
  //   库内双射(B6~B8)需数据库连接,故不在 pre-commit 跑;用 pnpm migration:check:db 手工校验。
  //   跳过方法(应急): HUSKY_SKIP_MIGRATION_BOOKKEEPING=1 git commit ...
  {
    id: '49',
    label: '🧾 迁移记账守门(journal ↔ .sql 一一对应 / when 单调唯一)',
    script: 'check-migration-bookkeeping.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 packages/database/drizzle 的 journal 与 .sql 记账结构漂移:',
      '     1. node scripts/check-migration-bookkeeping.mjs        (离线诊断)',
      '     2. node scripts/check-migration-bookkeeping.mjs --db   (对照库内 drizzle.__drizzle_migrations)',
      '     常见成因: 迁移文件被文本级改写导致命名/内容漂移;手工增删 journal 条目未同步 .sql。',
      '',
    ].join('\n'),
  },

  // --- 50 (2026-09-15 新增,next-env.d.ts 构建污染守门,AGENTS.md「.next-* 变体永不提交」配套) ---
  // blocking:ihui-deploy.ps1 用 IHUI_BUILD_DIST=.next-staging 做零停机交换时,next build 改写被跟踪的
  //   next-env.d.ts 为引用 .next-staging,残留污染源码树。pre-commit 阶段仅当该文件被 git add 才判定
  //   (铁律本就不提交它,避免本地构建脏文件误伤),发现 .next-* 变体引用即阻塞。
  //   修复: git checkout -- apps/web/next-env.d.ts  (部署脚本已在 swap 后自动还原)。
  //   跳过: HUSKY_SKIP_NEXT_ENV_DIST=1 git commit ...
  {
    id: '50',
    label: '🛡️ next-env.d.ts 构建污染守门(禁 .next-* 变体引用)',
    script: 'check-next-env-dist.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 apps/web/next-env.d.ts 引用了 .next-* 变体(.next-staging/.next-static 等),',
      '     这是 next build 在 IHUI_BUILD_DIST 覆盖 distDir 时的副作用残留。',
      '     修复: git checkout -- apps/web/next-env.d.ts',
      '     部署脚本 ihui-deploy.ps1 已在 staging→.next 交换后自动还原,本地误改请手动还原。',
      '',
    ].join('\n'),
  },

  // --- 51 (2026-09-20 新增,能力目录登记守门,blocking) ---
  //   背景:packages/types/src/capability-catalog.ts 是「哪些端点可被机器凭据调用」的
  //   单一事实源,运行时闸口在 apps/api/src/utils/capability-guard.ts。但"新增对外端点
  //   必须登记能力"此前只是注释里的约定 —— 本项把它变成机械门禁(防漂移,不是开放 /api/*)。
  //   四项检查:A 目录↔generated/capabilities.json 一致性;B v1 路由 handler 必须接能力闸;
  //   C 闸口引用的 scope 必须在目录内,platform/非第三方 scope 不得进 /v1 对第三方的 rules 表;
  //   D 目录声明了但代码无注册点(warn)。
  //   --staged(pre-commit)只判定本次暂存的 v1 路由文件;全量模式(不带 --staged)留给 CI,
  //   人工跑 `node scripts/guardian-runner.mjs` 会走全量,存量未覆盖端点会红 —— 属预期。
  //   跳过:HUSKY_SKIP_CAPABILITY_CATALOG_GUARD=1 git commit ...
  {
    id: '51',
    label: '🧭 能力目录登记守门(产物一致性 / v1 端点必须接能力闸 / scope 语义)',
    script: 'check-capability-catalog.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 对外端点未登记能力(或能力目录与产物漂移):',
      '     1. node scripts/check-capability-catalog.mjs --json   (拿到端点/scope 清单)',
      '     2. 在 packages/types/src/capability-catalog.ts 登记 scope 与 routes',
      '     3. pnpm capabilities:export                            (重新生成 capabilities.json)',
      "     4. 给 handler 接 preHandler: [requireApiKeyAuth, requireCapability('<scope>')],",
      "        或在路由族上 addHook('preHandler', requireCapabilityRules([...]))",
      '     5. node scripts/check-capability-catalog.mjs --self-test  (逻辑自检)',
      '',
    ].join('\n'),
  },

  // --- 52 (2026-09-20 新增,桌面弹窗复发守门,AGENTS.md §5b「机器级根治 windowsHide 默认值」配套) ---
  // blocking:派生控制台程序(git/node/pnpm/cmd/pwsh/schtasks…)却漏 windowsHide 的调用点。
  // 根因:Node v24 该方法默认 false,无控制台父进程(agent GUI 宿主 / detached worker / 计划任务)
  // 派生时 Windows 必新分配可见控制台 → 用户桌面闪黑窗。此问题历史复发 4 次,改为机制拦截。
  // 采用"宁漏不误报"策略:仅首参可**肯定**是控制台程序时判违规,避免误阻塞他人提交。
  {
    id: '52',
    label: '🪟 派生弹窗守门(blocking,AGENTS.md §5b windowsHide 默认值配套)',
    script: 'check-no-visible-spawn.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 检测到派生控制台程序但漏 windowsHide → 无控制台父进程下必弹可见黑窗。',
      '     修复:在该调用的 options 里加 `windowsHide: true`;',
      '           无 options 则补 `{ windowsHide: true }`;带 args 数组补在 args 之后;',
      '           末位是 callback 的把 options 插在 callback 之前。',
      '     自检:node scripts/check-no-visible-spawn.mjs --self-test',
      '     全量:node scripts/check-no-visible-spawn.mjs',
      '     开发机静默兜底:node scripts/install-console-window-hook.mjs --verify',
      '',
    ].join('\n'),
  },

  // --- 53 (2026-09-21 新增,O13b admin 面特权判定收敛守门,warn 级起步) ---
  // warn-only 理由:存量 34 文件/74 处裸 roleId 比较刚完成一次性白名单登记(文件级
  //   count 上限),白名单口径与 --staged 判据需先观察一轮误报率(动态拼出的判定、
  //   注释行计数偏差等);存量清零或稳定一周后再升 blocking。
  // 判据:裸 roleId 数值比较(集中封装 plugins/require-permission.ts 之外)条数只减
  //   不增;本地重定义 requireAdmin 禁止回升;capability-catalog dataClass=platform
  //   条目 thirdPartyEligible 必须为 false(机器凭据 403 不变量)。详见脚本头注释与
  //   docs/developer/admin-permission-mapping.md。
  // 跳过方法:HUSKY_SKIP_ADMIN_GATE_GUARD=1 git commit ...(应急,不建议)
  {
    id: '53',
    label: '🛡️  admin 面特权判定一致性(warn-only,O13b roleId>=1 收敛)',
    script: 'check-admin-gate-consistency.mjs',
    args: [],
    mode: 'warn',
    onFailHint: [
      '',
      '  💡 apps/api 出现新的裸 `roleId >= 1` 式判定 / 本地重定义 requireAdmin / platform 数据类别误开放。',
      '     修复:preHandler 统一走 plugins/require-permission.ts 的 requirePermission / requireAnyPermission /',
      '           requireAdmin;能力面 scope 的机器可见性以 capability-catalog 的 thirdPartyEligible 为准。',
      '     自检:node scripts/check-admin-gate-consistency.mjs --self-test',
      '     全量:node scripts/check-admin-gate-consistency.mjs',
      '',
    ].join('\n'),
  },

  // --- 54 (2026-09-21 新增,B14 未提交源码改动「年龄」守门,warn 级起步) ---
  // 背景:同日两次功能丢失 —— 并行会话执行 git checkout/reset,把另一会话**已验证但
  //   尚未 commit** 的工作树改动整体还原(一次要重做,一次连带丢失两条常驻防漂移测试)。
  //   stash 侧已有 30b 兜住,「留在工作树里没提交」这一整类此前无任何机制覆盖。
  // warn-only 理由:共享工作树里并行会话常态存在超龄未提交改动(实测本仓当前 21 个,
  //   最老 21 天),一上来 blocking 会把别人未完成的工作变成我的提交阻塞;先观察一轮,
  //   等并行会话收敛后再评估升级。判据/阈值见 scripts/check-uncommitted-age.mjs 头注释。
  {
    id: '54',
    label: '⏳ 未提交源码改动年龄守门(warn-only,B14 防工作树改动被并行 checkout 抹掉)',
    script: 'check-uncommitted-age.mjs',
    args: [],
    mode: 'warn',
    onFailHint: [
      '',
      '  💡 有源码改动停留在未提交状态超过阈值(默认 45 分钟)。工作树不是暂存区:',
      '     任何一次并行的 git checkout / reset / clean 都会把它整体抹掉且不留痕迹。',
      '     处置:node scripts/safe-commit.mjs -m "<本次改动说明>" -- <file>(改完即提交)',
      '           或按 AGENTS.md §12d 用 git worktree 隔离并行开发。',
      '     自检:node scripts/check-uncommitted-age.mjs --self-test',
      '     全量:node scripts/check-uncommitted-age.mjs --json',
      '     调阈值:IHUI_UNCOMMITTED_AGE_MIN=<分钟> 或 --threshold-min <分钟>',
      '',
    ].join('\n'),
  },

  // --- 55 (2026-09-21 新增,D54/H16 工具名显示覆盖率收口,blocking) ---
  // 判据:mcp_server._TOOLS 每个注册工具名都要在 packages/shared 的 TOOL_DISPLAY_KEYS 有映射,
  //   且该 key 在五语言 messages/shared/*.json 的 taskStatus 里真有值。
  // 为什么 blocking:界面禁止直显 read_file / browser_click_element 这类英文码名;运行时的
  //   "回落原展示"兜底恰恰会让新增工具**静默地**带着码名上线,只有静态比对拦得住。
  {
    id: '55',
    label: '🈶 工具名显示覆盖率守门(blocking,D54/H16 界面禁直显英文工具码名)',
    script: 'check-tool-name-display-coverage.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_TOOL_NAME_COVERAGE',
    onFailHint: [
      '',
      '  💡 有注册工具没有本地化功能名,或 taskStatus 里对应键缺某语言文案。',
      '     修复两步:',
      "       1) packages/shared/src/chat/tool-display.ts 的 TOOL_DISPLAY_KEYS 补 `工具名: 'toolXxx'`",
      '       2) packages/i18n/messages/shared/{zh-CN,zh-TW,en,ja,ko}.json 的 taskStatus 补 toolXxx',
      '     自检:node scripts/check-tool-name-display-coverage.mjs --json',
      '     紧急跳过(不推荐):HUSKY_SKIP_TOOL_NAME_COVERAGE=1 git commit ...',
      '',
    ].join('\n'),
  },

  {
    id: '59',
    label: '🈳 ICU 语法跨端可用性守门(blocking,D101:非 web 端取词引擎只支持四形子集)',
    script: 'check-icu-locale-support.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 语言包里出现了某端渲染不了的 ICU 形态 —— 界面会直接显示 `{state, select, …}` 语法残,',
      '     或与 web(next-intl 全量 ICU)静默渲染成不同文本。实测背景:next-intl 只挂在 apps/web。',
      '     三种正解,按优先级:',
      '       1) 拆成普通键(如 toolRunning / toolCompleted),不用 ICU',
      '       2) 用共享子集解释器支持的四形:plural / select / selectordinal / number(plain style)',
      '       3) 确需 `::` skeleton 或 cli 端要用 ICU → 先完成 PROJECT_PLAN.md D101 第④⑥项再解锁',
      '     自检:node scripts/check-icu-locale-support.mjs --self-test',
      '',
    ].join('\n'),
  },

  {
    id: '57',
    label: '🧩 对话流元素覆盖守门(blocking,D51/H13:锚点漂移·契约事件两端不齐·清单条目倒退)',
    script: 'check-chat-element-coverage.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 三类违规各有解法:',
      '     ① 锚点漂移 = 该元素已在库内,其渲染位文件/关键标识被删或被改名 → 恢复实现,',
      '        或确属重命名时同 PR 更新 scripts/data/chat-flow-elements.json 并说明理由',
      '     ② 事件不齐 = 元素声明的 SSE 事件必须同时出现在 apps/ai-service/app/core/sse_contract.py',
      '        与 packages/shared/src/sse/contract.ts(两端契约是一份事实源的两份拷贝)',
      '     ③ 条目倒退 = 清单条目数低于 entryCountBaseline → 撤销误删的任务行,或在计划里说明撤销理由',
      '     自检:node scripts/check-chat-element-coverage.mjs --self-test',
      '     紧急跳过(不推荐):HUSKY_SKIP_CHAT_ELEMENT_COVERAGE=1 git commit ...',
      '',
    ].join('\n'),
  },

  {
    id: '58',
    label:
      '🈹 中文术语机翻残留守门(blocking,D104/H29:竞品自家 zh 包实测 list→挂牌/房源,我方 zh 侧此前无闸)',
    script: 'check-zh-term-quality.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 判据是「键名英文词根 ∧ 值内高置信错误译法」双条件,单条件一律放过(宁漏不误报)。',
      '     两种正当处置:',
      '       ① 确为误译 → 改成正确术语(如 list 类键里出现 房源/挂牌)',
      '       ② 确为业务用词(真在做房产/港口类文案)→ 在 scripts/data/zh-term-glossary.json',
      '          给该规则补 expect 词或收紧 keyRoot 定义,并在提交说明里写清理由',
      '     误伤回归:node scripts/check-zh-term-quality.mjs(现存语言包须 0 命中才可加新判据)',
      '     自检:node scripts/check-zh-term-quality.mjs --self-test',
      '     紧急跳过(不推荐):HUSKY_SKIP_ZH_TERM_GUARD=1 git commit ...',
      '',
    ].join('\n'),
  },

  {
    id: '60',
    label: '🕐 工具活动行双时态覆盖守门(blocking,D81①/D83/H28:键形合规 + 覆盖率 ratchet)',
    script: 'check-tool-activity-coverage.mjs',
    args: [],
    mode: 'blocking',
    onFailHint: [
      '',
      '  💡 两类失败,处置不同:',
      '     ① 键形不合规(半套措辞)→ 五语言必须齐,且每个 *Activity 值必须是含',
      '        running{} / completed{} / other{} 三支的 ICU select。半套比不补更糟:',
      '        某语言会恒显示"正在…"或整条空白。',
      '     ② 覆盖率低于 floor → 有人删了/改名了已配置的措辞键,补回;确属撤销才调',
      '        scripts/data/tool-activity-coverage.json 的 floor,并在提交说明写数量变化。',
      '     逐批补齐清单:node scripts/check-tool-activity-coverage.mjs --scaffold',
      '     自检:node scripts/check-tool-activity-coverage.mjs --self-test',
      '     紧急跳过(不推荐):HUSKY_SKIP_TOOL_ACTIVITY_COVERAGE=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 56 (2026-09-21 新增,工具功能名"各端取得到值"覆盖守门,blocking) ---
  // 拦两类静默失败:① 词表加了映射但某语言/某端语言包没有该 taskStatus 键 →
  //   端内点号取词器缺键回显键名,把 read_file 显示成 toolReadFile(断言"不含 read_file"照样绿);
  // ② 改了 shared 却忘了跑 pnpm gen:i18n → 小程序离线包整块过期(实测曾 13 vs 139 键)。
  {
    id: '56',
    label: '🔤 工具功能名各端可解析守门(blocking,防取词回显与离线包过期)',
    script: 'check-tool-display-resolvable.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_TOOL_DISPLAY_RESOLVABLE',
    onFailHint: [
      '',
      '  💡 有工具功能名在某语言 / 某端语言包 / 小程序离线包里取不到值。',
      '     修复:1) 补齐 packages/i18n/messages/shared/<lang>.json 的 taskStatus 键(5 语言齐全)',
      '           2) cd apps/miniapp-taro && pnpm gen:i18n  重生成离线语言包',
      '     全量:node scripts/check-tool-display-resolvable.mjs --json',
      '     紧急跳过(不推荐):HUSKY_SKIP_TOOL_DISPLAY_RESOLVABLE=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 61 (2026-09-22 接入 pre-commit,桌面安装器品牌资产三方对账,blocking) ---
  // 背景:2026-09-20 真实事故 —— ihui-ui.nsi 新增「最小化」按钮引用 btn-min.bmp,却漏登记
  //   IHUI_EXTRACTPAGESETS_SET 里的 File 行 → $PLUGINSDIR 里根本没有该文件 → LoadImage 返回 0
  //   → STM_SETIMAGE 贴空位图 → 按钮**肉眼不可见**,而 makensis 零报错零警告(用户报「最小化
  //   按钮没显示」)。守门脚本自写下后只被手动跑过,在 guardian-runner / .husky / .github
  //   零命中 = 没有任何自动执行点,等于「记得跑才有保护」。本次正式接入。
  // 判据(任一不通过 exit 1):① 引用 ⊆ 打包;② 打包 ⊆ 落盘(100/125/150/175/200 五档齐全);
  //   ③ 引用/打包解析为零命中即失败(正则被改坏时不自愈放行);④ installer.nsi 的 GetOptions
  //   不得直接吃 $CMDLINE(路径里的 /ns 段会前缀误匹配)。
  // 条件触发:见 stagedTriggers —— 安装器目录或资产生成器进暂存区才跑,全量模式一律跑。
  {
    id: '61',
    label: '🖥️  桌面安装器资产三方对账(blocking,引用↔打包↔5 档落盘)',
    script: 'check-installer-assets.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ['apps/desktop/src-tauri/windows/', 'scripts/desktop-installer-assets.mjs'],
    skipEnv: 'HUSKY_SKIP_INSTALLER_ASSETS_GUARD',
    onFailHint: [
      '',
      '  💡 NSIS 脚本「引用的位图 ↔ File 打包清单 ↔ 磁盘 5 档 DPI 资产」三方不一致(编译期零报错,',
      '     只有真机跑安装器才暴露 —— 静默失败必须在这里拦住):',
      '     按报错项处置:',
      '       ① “引用了但未打包: X.bmp” → 在 apps/desktop/src-tauri/windows/ihui-ui.nsi 的',
      '          !macro IHUI_EXTRACTPAGESETS_SET 内补一行(与 btn-close.bmp 同处):',
      '            File "/oname=$PLUGINSDIR\\X.bmp" "${IHUI_ASSETROOT}\\assets-${LIT}\\X.bmp"',
      '       ② “打包了但档位缺文件” → 重跑资产导出:node scripts/desktop-installer-assets.mjs',
      '          五档(100/125/150/175/200)缺一档,就在那个 DPI 档位下控件空白',
      '       ③ “解析到 0 个引用 / 0 条 File” → 判据正则与 nsi 结构漂移,门禁已失效,',
      '          必须修 scripts/check-installer-assets.mjs 的解析式,**禁止放宽判定**',
      '     单独复验:node scripts/check-installer-assets.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_INSTALLER_ASSETS_GUARD=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 62 (2026-09-22 接入 pre-commit,NSIS 安装器模板漂移守门,blocking) ---
  // 背景:apps/desktop/src-tauri/windows/installer.nsi 是「Tauri CLI 内置模板 + IHUI 补丁集」
  //   的副本(Tauri v2 只暴露四个 Section 内宏,改不了向导页面结构,唯一官方接管方式是
  //   bundle.nsis.template 整体替换)。2026-09-22 实测:该文件里累积了 11 段历史上**直接手改、
  //   从未登记进 PATCHES / 侧车 JSON** 的定制,于是 --check 恒绿而 --write 会把这些定制整体
  //   抹掉 —— 已真实发生过一次回退。--check 正是拦这一类的,但此前同样零自动执行点。
  // 已核实的宽松兜底(保持不改、不改成阻塞):工作区未安装 @tauri-apps/cli 原生模块时,脚本
  //   打印「未找到 @tauri-apps/cli 原生模块,跳过校验」并 exit 0(源码 desktop-nsis-template.mjs
  //   第 373-381 行)。干净 checkout / 部分 CI 属正常态,该项在这些环境**自动放行**;
  //   本机已装 @tauri-apps/cli 2.11.4 → 实测走的是真比对(命中 20+ 处 IHUI 补丁)。
  {
    id: '62',
    label: '🧩 桌面 NSIS 安装器模板漂移(blocking,installer.nsi == 上游模板 + 已登记补丁)',
    script: 'desktop-nsis-template.mjs',
    args: ['--check'],
    mode: 'blocking',
    stagedTriggers: [
      'apps/desktop/src-tauri/windows/installer.nsi',
      'scripts/desktop-nsis-template.mjs',
      'scripts/desktop-nsis-ihui-patches.json',
    ],
    skipEnv: 'HUSKY_SKIP_NSIS_TEMPLATE_GUARD',
    onFailHint: [
      '',
      '  💡 installer.nsi 已不等于「当前 Tauri CLI 内置模板 + 已登记补丁集」。两类成因处置不同:',
      '     ① 直接手改了 installer.nsi(最常见)→ 把差量登记进侧车补丁,复验后随代码同 commit:',
      '          node scripts/desktop-nsis-template.mjs --emit-patches',
      '            (导出 scripts/desktop-nsis-ihui-patches.json)',
      '          node scripts/desktop-nsis-template.mjs --check   # 应回到 OK',
      '          git add scripts/desktop-nsis-ihui-patches.json',
      '        不登记就提交,下次 --write 会把这段定制整体抹掉(已真实回退过一次)。',
      '     ② 升级了 Tauri CLI(上游模板变了)→ 先 diff 上游与仓库两份模板、人工复核各补丁',
      '        锚点是否仍成立,确认后再 --write,然后重跑 --check(必要时补 --emit-patches);',
      '        **禁止盲目 --write**(会连带抹掉未登记定制)。',
      '     注:未安装 @tauri-apps/cli 原生模块的环境里该脚本打印「跳过校验」并 exit 0,',
      '         即本项在干净 checkout / 部分 CI 自动放行(既有宽松兜底,不是漏判)。',
      '     紧急跳过(不推荐):HUSKY_SKIP_NSIS_TEMPLATE_GUARD=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 63 (2026-09-22 接入 pre-commit,SSE 双解析器漏接对账,blocking,D106/G-148 配套) ---
  // 背景(实测非推测):同一份 SSE 协议在库内被两处独立解析 —— packages/api-client/src/client.ts
  // (web/extension/mobile-rn)与 packages/shared/src/utils/sse-parse.ts(miniapp-taro 经 @ihui/shared
  // 单一真源使用,其端内 utils/sse-parse.ts 只是 re-export)。每加一帧要在两处各写一遍分支、
  // 再在每端回调表注册一次;历史上 citations/steer 就是"一侧有、另一侧 0 命中"被静默遗忘,
  // injection_applied/retry_scheduled 第 42 轮也只补了 api-client 一侧。
  // 判据强度(实测):把 sse-parse 的 steer 守卫改成不匹配的字面量 → 本闸立即红两条
  // (ratchet 20<21 + steer 未登记),证明"只剩产出语句/只剩类型联合声明"都骗不过它。
  {
    id: '63',
    label: '🔀 SSE 双解析器漏接对账(blocking,帧覆盖 ratchet + 未接帧须交代归属)',
    script: 'check-sse-parser-parity.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: [
      'packages/shared/src/sse/contract.ts',
      'packages/api-client/src/client.ts',
      'packages/shared/src/utils/sse-parse.ts',
      'scripts/data/sse-parser-coverage.json',
      'scripts/check-sse-parser-parity.mjs',
    ],
    skipEnv: 'HUSKY_SKIP_SSE_PARSER_PARITY',
    onFailHint: [
      '',
      '  💡 同一协议两处解析,漏接是**静默**的:小程序拿不到帧,界面上看起来就是"没这个功能"。',
      '     看清单:node scripts/check-sse-parser-parity.mjs --report',
      '     补接一帧后:删 scripts/data/sse-parser-coverage.json 里对应的 webOnly 登记项,',
      '                并把 parseCoverageBaseline 上调到新实测值(降回去就是在倒退)。',
      '     确实只有 web 消费:必须在该文件 webOnly 里写明**为什么**(空理由同样拦)。',
      '     自检:node scripts/check-sse-parser-parity.mjs --self-test',
      '     紧急跳过(不推荐):HUSKY_SKIP_SSE_PARSER_PARITY=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 68 (2026-09-22 新增,权限模式词汇对账,PROJECT_PLAN G-161 配套) ---
  // blocking:同一语义曾有 5 套拼写并存(agent-runtime 5-camel / workspace 4-kebab /
  //   api-client 3-kebab / AgentLoopV2 default+plan+auto / 对外文档 read-only+accept-all+plan-only),
  //   非法值被 Pydantic 静默丢弃或在构造期 ValueError 打 500 —— 即"客户端发了 ≠ 服务端生效"。
  //   判据:TS 注册表 ↔ Python 注册表成员/别名逐字一致 + 消费点取值必须已注册 +
  //   决策位不得拿别名比较 + 不许自造档位白名单。有效性由 --self-test 注入违规自证(11 例)。
  {
    id: '68',
    label: '🔐 权限模式词汇对账(blocking,跨语言注册表一致 + 消费点禁漂移)',
    script: 'check-permission-mode-vocabulary.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: [
      'packages/types/src/permission-mode.ts',
      'packages/types/src/agent-runtime.ts',
      'packages/types/src/workspace.ts',
      'packages/api-client/src/endpoints/workspace.ts',
      'apps/ai-service/app/core/permission_mode.py',
      'apps/ai-service/app/services/agent_loop_v2.py',
      'apps/ai-service/app/routers/agent_runtime.py',
      'apps/ai-service/app/routers/agents.py',
      'apps/api/src/routes/workspace-permissions.ts',
      'apps/api/src/routes/v1-ai-core.ts',
      'apps/cli/src/tools/permissions.ts',
      'apps/cli/src/commands/settings.ts',
      'apps/cli/src/commands/config-cmd.ts',
      'apps/cli/src/commands/repl.ts',
      'apps/cli/src/commands/status-cmd.ts',
      'apps/cli/src/commands/agent.ts',
      'packages/types/package.json',
      'scripts/tests/check-permission-mode-vocabulary.test.mjs',
      'docs/developer/api/agents.md',
      'scripts/check-permission-mode-vocabulary.mjs',
    ],
    skipEnv: 'HUSKY_SKIP_PERMISSION_VOCAB',
    onFailHint: [
      '',
      '  💡 权限档有 5 套拼写时,"发了"和"生效"是两件事 —— 本门拦的就是这个。',
      '     唯一真源:packages/types/src/permission-mode.ts ↔ app/core/permission_mode.py',
      '     改法:先在两侧同时登记成员/别名(顺序反了就是 R1 红),再改消费点。',
      '     决策位比较请用 is_readonly_permission_mode / skips_approval_permission_mode,',
      '     不要写 `== "auto"` 这类别名比较(R3 拦)。',
      '     自检:node scripts/check-permission-mode-vocabulary.mjs --self-test',
      '     紧急跳过(不推荐):HUSKY_SKIP_PERMISSION_VOCAB=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 64 (2026-09-22 新增,miniapp-taro 适配层「未接线即拦」,PROJECT_PLAN P2-F.5 配套) ---
  // blocking:适配层历史上 18 个 .taro.tsx 里的 9 个屏级(共 3078 行)从写下到删除始终零页面引用,
  //   而既有 check-adapter-style-parity.mjs 只守硬编码颜色、不守「是否被 import」,
  //   所以「造好没装车」这种死代码此前无闸可挡 —— 本门补的就是这一格。
  //   判据:新增适配器必须被 adapters 目录**之外**的源文件从 adapters 路径 import
  //   (端内存在同名自有组件,不限定 specifier 会把它们误判为已接线);
  //   基线已于同日三批清理后收紧为空数组 → 零豁免硬门。
  {
    id: '64',
    label: '🧩 [miniapp-taro] 适配层未接线即拦(防"造好没装车"死代码回升)',
    script: 'check-adapter-wiring.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ['apps/miniapp-taro/src/components/adapters/'],
    skipEnv: 'HUSKY_SKIP_ADAPTER_WIRING',
    onFailHint: [
      '',
      '  💡 apps/miniapp-taro/src/components/adapters/*.taro.tsx 里有新增的无人 import 适配器。',
      "     接线:页面里 import { X } from '@/components/adapters'",
      '     或删除:确认端内已有自有实现后 rm(先过 AGENTS.md §7 删除三问)',
      '     存量收紧基线:node scripts/check-adapter-wiring.mjs --update-baseline',
      '     自检:node --test scripts/tests/check-adapter-wiring.test.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_ADAPTER_WIRING=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 66 (2026-09-22 补注册,miniapp-taro 适配层硬编码颜色基线门;65 已被「整树删除拦截」占用) ---
  // 该脚本自 2026-09-03 起只挂在 package.json 的 check:all(手动/CI),**从未进 pre-commit 链路**,
  //   所以新增硬编码颜色可以一路提交到 CI 才发现。本次适配层治理同族收口时补上这一格。
  // 基线模式:存量 1 处/1 文件已在 scripts/adapter-style-parity-baseline.json 放行,只减不增。
  {
    id: '66',
    label: '🎨 [miniapp-taro] 适配层硬编码颜色基线(防新增 hex/rgb 绕过 token)',
    script: 'check-adapter-style-parity.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ['apps/miniapp-taro/src/components/adapters/'],
    skipEnv: 'HUSKY_SKIP_ADAPTER_STYLE_PARITY',
    onFailHint: [
      '',
      '  💡 adapters/*.taro.tsx 出现了基线之外的新增硬编码颜色,',
      '     改法:用 getRnTokens(effectiveScheme).xxx 取 token(与 packages/app 主题同源)。',
      '     确属合理保留(逐字沿用共享源的轮播点/HSL 等着色算法)时:',
      '       node scripts/check-adapter-style-parity.mjs --update-baseline 后随本次提交一起 add 基线文件',
      '     自检:node scripts/check-adapter-style-parity.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_ADAPTER_STYLE_PARITY=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 67 (2026-09-22 新增,凭据经非2xx message 外泄对账,PROJECT_PLAN P2-F.8 配套) ---
  // blocking:response-sanitizer.ts:496 明写非 2xx 响应原样返回(不打码),于是"把上游响应体
  //   stringify 进 error message"构成脱敏体系的真实旁路 —— 已发生真实事故:
  //   proxy-extended-media3.ts 曾把 Adobe IMS OAuth2 令牌端点整个响应体(含 access_token)
  //   拼进 502 message 回传客户端(修复见 7384c92ed0)。本门把该类目变成结构性不可能。
  // 判据刻意窄(宁漏不误报):仅在 4xx/5xx 构造上下文内、且被 stringify 的实参具备凭据语义时 BLOCK;
  //   errData/genData/data 这类非凭据实参只进"低置信候选"清单打印、不计失败
  //   (全仓此类历史写法 35 处 / 13 文件,一律拦会变成阻塞他人的假阳性)。
  {
    id: '67',
    label: '🔐 凭据经非2xx message 外泄对账(blocking,拦上游令牌/密钥响应体被拼进错误消息)',
    script: 'check-credential-leak-in-message.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ['apps/'],
    skipEnv: 'HUSKY_SKIP_CREDENTIAL_LEAK_IN_MESSAGE',
    onFailHint: [
      '',
      '  💡 非 2xx 响应**不经** response-sanitizer(plugins/response-sanitizer.ts:496 直接 return payload),',
      '     所以把上游响应体拼进 error message 等于绕过脱敏把凭据发出去。',
      '     改法:message 只放厂商名 / HTTP 状态码 / RFC 6749 的 error 码等白名单字段,',
      '            需要排查上游返回内容时改为记服务端日志(且日志亦不得含令牌原文)。',
      '     低置信候选(实参名无凭据语义 **且** 响应来源非令牌端点)不拦,仅供人审;确属长期豁免时:',
      '       node scripts/check-credential-leak-in-message.mjs --update-baseline',
      '     自检:node scripts/check-credential-leak-in-message.mjs --self-test',
      '           node --test scripts/tests/check-credential-leak-in-message.test.mjs',
      '     紧急跳过(不推荐,本门是安全门):HUSKY_SKIP_CREDENTIAL_LEAK_IN_MESSAGE=1 git commit ...',
      '',
    ].join('\n'),
  },

  // 快捷键"声明 ↔ 归属"对账(2026-09-22 立)。成因两例都是真实发生过的:
  //   ① view-switcher 曾给 document/browser/figma/code-changes/agent 五个点选项标 Ctrl+1-5,
  //      而这族键位实际被 use-global-shortcuts 注册表接走(按下去切 AI 对话模式) —— 标签说谎;
  //   ② 注册表条目"有键无消费者"。判据两类:声明未绑(unbound)+ 同键被他功能接走(mislabelled),
  //      后者只认 field 类声明(点选动作旁标的键位),<kbd>/正文描述类不纳入 —— 那类合法地在
  //      描述**别的表面**的键位,纳进必假红。
  {
    id: '69',
    label: '⌨️ 快捷键声明与归属对账(blocking,声明未绑 / 同键被他功能接走)',
    script: 'check-declared-shortcuts.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ['apps/web/'],
    skipEnv: 'HUSKY_SKIP_DECLARED_SHORTCUTS',
    onFailHint: [
      '',
      '  💡 两类红点各自对应一种交付事故:',
      '     ① 声明未绑:UI 上写了 `Ctrl+X` 但全仓没有处理器 → 要么把功能实现,要么把标签删掉。',
      '     ② 同键被他功能接走:点选项标的键位其实归注册表里**另一个动作**(按下去干的不是这件事)。',
      '        正解二选一:换标签/删标签;或让本组件独占该键(自有 handler + `e.stopPropagation()`)。',
      '     全量审计与逐条定位:node scripts/check-declared-shortcuts.mjs',
      '     自检:node --test scripts/tests/check-declared-shortcuts.test.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_DECLARED_SHORTCUTS=1 git commit ...',
      '',
    ].join('\n'),
  },

  // 硬编码中文 ratchet(2026-09-22 接线)。该脚本 2026-07-20 就写好了,但只登记在 scripts/README,
  // 从未接入守门链 ⇒ 一年多里新增的硬编码中文无人拦(审计实测 web+ui-react+shared 已积到 900+ 文件)。
  // 存量清不完也不该挡所有提交,故用"每文件额度基线":只拦比基线更多的命中,清理后 --update-baseline 下调。
  {
    id: '70',
    label: '🈲 硬编码中文基线棘轮(blocking,新增界面文案必须走 t()/语言包)',
    script: 'scan-hardcoded-zh.mjs',
    args: ['--exit', '1'],
    mode: 'blocking',
    stagedTriggers: [
      'apps/web/app/',
      'apps/web/src/components/',
      'apps/web/src/hooks/',
      'packages/ui-react/src/',
      'packages/shared/src/',
    ],
    skipEnv: 'HUSKY_SKIP_HARDCODED_ZH_GUARD',
    onFailHint: [
      '',
      '  💡 本次改动在某个文件里**新增了**超过基线额度的硬编码中文行。',
      '     正解:界面文案改用 useTranslations / 共享包的 t 注入(AGENTS.md §19),键落对应命名空间;',
      '     定位:`node scripts/scan-hardcoded-zh.mjs --staged` 或全量 `node scripts/scan-hardcoded-zh.mjs`;',
      '     若确属内容文案(示例数据/营销长文)或判据误报,先自行核实再下调基线:',
      '       node scripts/scan-hardcoded-zh.mjs --update-baseline   # 全量重写,只能有人工确认时跑',
      '     紧急跳过(不推荐):HUSKY_SKIP_HARDCODED_ZH_GUARD=1 git commit ...',
      '',
    ].join('\n'),
  },

  {
    id: '71',
    label: '🈲 计划登记行防丢(blocking,PROJECT_PLAN.md 已入库的 G-/D/P/W 编号行不得整行消失)',
    script: 'check-plan-line-loss.mjs',
    args: ['--staged'],
    mode: 'blocking',
    stagedTriggers: ['PROJECT_PLAN.md'],
    skipEnv: 'HUSKY_SKIP_PLAN_LINE_LOSS',
    onFailHint: [
      '',
      '  💡 成因几乎总是"按内存里那份旧计划文档整文件提交",把别的会话(或更早的自己)',
      '     **已经入库**的登记行按旧基线回写掉了。正解是前向恢复,不是 --no-verify:',
      '       1) 找回原文:`git log --all -S "<提示里的标记>" -- PROJECT_PLAN.md`,',
      '          再 `git show <那个提交>:PROJECT_PLAN.md` 取整行插回原锚点;',
      '       2) 确属 §1 归档 → 原文必须在 .ihui-agent/archive/PROJECT_PLAN_*.md 里(本闸自动放行);',
      '       3) 以后改计划文档一律**提交前现取 HEAD 版本**再插自己的行(AGENTS.md §1 配套)。',
      '     自愈面:.husky/post-commit 第 6 段会在每次提交后扫历史并回捞(--no-verify 也照跑);',
      '     手动执行:`node scripts/check-plan-line-loss.mjs --heal`(只写工作区)或',
      '              `node scripts/check-plan-line-loss.mjs --heal --commit`(顺带前向提交)。',
      '     自检:node scripts/check-plan-line-loss.mjs --self-test',
      '     紧急跳过(不推荐):HUSKY_SKIP_PLAN_LINE_LOSS=1 git commit ...',
      '',
    ].join('\n'),
  },
  // --- 72 (2026-09-22 新增,Dockerfile 构建上下文对账) ---
  // blocking:提交 79b906463f 给根 package.json 加了 postinstall(node scripts/fix-expo-metro-junction.mjs),
  //   而 deploy/docker/Dockerfile.{api,web,cli,migrate} 只 COPY 清单文件就跑 pnpm install ⇒ 镜像里没有该脚本
  //   ⇒ CI 上 build-api / build-web 同时红(`MODULE_NOT_FOUND`)。typecheck/lint/单测全绿也发现不了,
  //   因为本机没有 docker、也没人跑 docker build。本门按 workflow 声明的 context 对账两件事:
  //   A) 根上下文安装依赖的 Dockerfile 必须 COPY 生命周期钩子引用的脚本;
  //   B) 每条 COPY 源必须在**提交内容**里存在(工作树可能被并行会话删而未暂存,故不信工作树)。
  // 跳过方法:HUSKY_SKIP_DOCKERFILE_COPY_GUARD=1 git commit ...
  {
    id: '72',
    label: '🐳 Dockerfile 构建上下文对账(blocking,钩子脚本必须 COPY 进镜像 + COPY 源必须在提交里)',
    script: 'check-dockerfile-copy-paths.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: [
      'deploy/docker/',
      'deploy/saas/',
      'apps/ai-service/Dockerfile',
      'package.json',
      '.github/workflows/',
    ],
    skipEnv: 'HUSKY_SKIP_DOCKERFILE_COPY_GUARD',
    onFailHint: [
      '',
      '  💡 本机跑不到 docker 时,这里是唯一能发现"镜像构建必挂"的防线:',
      '     - lifecycle-script-not-copied → 根 package.json 的 preinstall/postinstall/prepare 里',
      '       `node <file>` 引用的脚本没被 COPY 进 deps 阶段 ⇒ 在该 Dockerfile 的 RUN pnpm install',
      '       之前加一行 `COPY <file> <目录>/`(只 COPY 单个文件,别 COPY 整个 scripts/,会毁层缓存)',
      '     - copy-source-missing → COPY 的源路径在构建上下文的提交里不存在(拼写/已删/被 .dockerignore 排除)',
      '       注:存在性按 HEAD 提交内容判,工作树里缺文件不算数(并行会话可能删了未暂存)',
      '     自检:node scripts/check-dockerfile-copy-paths.mjs --self-test',
      '           node --test scripts/tests/check-dockerfile-copy-paths.test.mjs',
      '     紧急跳过(不推荐,本门挡的是"部署才炸"的缺陷):HUSKY_SKIP_DOCKERFILE_COPY_GUARD=1 git commit ...',
      '',
    ].join('\n'),
  },

  {
    id: '73',
    label: '🈲 端内绕过 @ihui/api-client 直连后端(blocking,裸 fetch/Taro.request 指向本仓后端即拦,存量走基线只减不增)',
    script: 'check-direct-backend-calls.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: [
      'apps/',
      'packages/',
      'scripts/direct-backend-calls-baseline.json',
      'scripts/check-direct-backend-calls.mjs',
    ],
    skipEnv: 'HUSKY_SKIP_DIRECT_BACKEND_CALLS',
    onFailHint: [
      '',
      '  💡 AGENTS.md §3:端内(apps/* 与 packages/*,除 api / ai-service / api-client 自身)',
      '     不得用裸 fetch / axios / Taro.request / XMLHttpRequest / sendBeacon / http.request',
      '     直连本仓后端(URL 污点追到后端基址或锚定 /api/ 段即命中)。',
      '     正确做法:走 @ihui/api-client 的 endpoint;确实需要平台差异时,把它做成',
      '     Transport 并在 app 启动处 setTransport 注册(豁免需三条同立:URL 纯透传 +',
      '     从 @ihui/api-client import 契约 + 该导出确实被 setTransport 注册)。',
      '     存量 47 处已进 scripts/direct-backend-calls-baseline.json,迁移后跑',
      '     `node scripts/check-direct-backend-calls.mjs --update-baseline` 收紧(只减不增)。',
      '     自检:node scripts/check-direct-backend-calls.mjs --self-test',
      '           node --test scripts/tests/check-direct-backend-calls.test.mjs',
      '           node scripts/check-direct-backend-calls.mjs --list   # 逐条看基线',
      '     紧急跳过(不推荐):HUSKY_SKIP_DIRECT_BACKEND_CALLS=1 git commit ...',
      '',
    ].join('\n'),
  },

  {
    id: '74',
    label: '🈴 词表键五语言可解析(blocking,静态映射缺语言/小程序离线包过期即红;W5 落点债只告警)',
    script: 'check-word-table-resolvable.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ['packages/', 'apps/', 'packages/i18n/messages/'],
    skipEnv: 'HUSKY_SKIP_WORD_TABLE_RESOLVABLE',
    onFailHint: [
      '',
      '  💡 判据:一张"值全是 i18n 键字面量"的静态映射表(如 PERMISSION_TIER_WORD_KEYS /',
      '     _TOOLS / ERROR_CODE_TO_I18N_KEY),每个键必须在 5 语言 × 消费端合并视图里取到值,',
      '     小程序侧还要能在**离线生成包**里取到(忘跑 `pnpm gen:i18n` 就是这一条拦)。',
      '     值是键名本身(静默回显)同样判缺 —— 那正是"界面显示 permissionTier.mode.plan.title"的成因。',
      '     修法:补进 packages/i18n/messages/<shared|端>/<lang>.json 五语言齐(共享层词表优先沉到 shared);',
      '     改完跑 `cd apps/miniapp-taro && pnpm gen:i18n` 重生成离线包。',
      '     W5「落点债」= 某端依赖该包但尚未引用这张表 ⇒ 今天没有界面会回显键名,只报不计失败',
      '     (计入会把门长期红在别人未接入的存量上);该端真接入后由 W3/W4 逐键硬拦。',
      '     自检:node scripts/check-word-table-resolvable.mjs --self-test',
      '           node --test scripts/tests/check-word-table-resolvable.test.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_WORD_TABLE_RESOLVABLE=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 75 (2026-09-23 新增,O20d 配置表名存在性机械门,blocking) ---
  // 背景:生产 COMPUTE_ALLOWED_TABLES 含不存在的表名(api_key_usage_windows 计划已知 +
  //   agent_runs 本轮机械门首跑新发现),compute 能力 DB 白名单指向空表 = DATA_ACCESS_DENIED
  //   而 typecheck/单测全绿。判据:清单里每个表名必须存在于 drizzle schema,不存在即红;
  //   存量 2 个真实幽灵表按"白名单棘轮 + 条数只减不增"豁免,新增即拦。详见脚本头注释。
  {
    id: '75',
    label: '🗄️  配置表名存在性(blocking,O20d:COMPUTE_ALLOWED_TABLES 必须与 drizzle schema 对齐)',
    script: 'check-config-table-existence.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: [
      'packages/types/src/capability-catalog.ts',
      'packages/database/src/schema/',
      'scripts/check-config-table-existence.mjs',
    ],
    skipEnv: 'HUSKY_SKIP_CONFIG_TABLE_GUARD',
    onFailHint: [
      '',
      '  💡 COMPUTE_ALLOWED_TABLES(packages/types/src/capability-catalog.ts)含不存在的表名 ——',
      '     运行时 compute 能力白名单指向空表,真实表改名后清单未跟上。',
      '     修法:改为 packages/database/src/schema 中的真实表名,或从清单删除;',
      '           若属存量已登记幽灵表,见脚本 KNOWN_GHOST_TABLES(条数只减不增,修后删行)。',
      '     自检:node scripts/check-config-table-existence.mjs --self-test',
      '     全量:node scripts/check-config-table-existence.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_CONFIG_TABLE_GUARD=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 76 (2026-09-23 新增,O20e 迁移账本带外对象防回潮,warn 级) ---
  // 背景:生产迁移账本曾有 7 个迁移的数据库对象带外存在(对象在库但 __drizzle_migrations
  //   无对应行)。判据:journal 序号全集 vs 账本行全集(行数与水位序),缺行/多余行即告警;
  //   按序号界定不按 hash(改历史文件会让按 hash 判定误报)。
  // warn 理由:连库门进 pre-commit 会拖慢/断网误红;主用途是部署后独立调用
  //   (node scripts/check-migration-ledger-drift.mjs --dsn <url> [--strict])。
  //   本机库可达时顺带对账,不可达时脚本自身降级 SKIP 并如实打印(不假装通过)。
  {
    id: '76',
    label: '📋  迁移账本带外对象防回潮(warn-only,O20e:journal 序号全集 vs 账本行全集)',
    script: 'check-migration-ledger-drift.mjs',
    args: [],
    mode: 'warn',
    stagedTriggers: ['packages/database/drizzle/'],
    skipEnv: 'HUSKY_SKIP_MIGRATION_LEDGER_GUARD',
    onFailHint: [
      '',
      '  💡 drizzle 迁移账本行数与 journal 序号全集不一致 —— 有迁移的数据库对象带外存在',
      '     (对象在库但 __drizzle_migrations 无对应行),或 journal 被裁剪/账本被污染。',
      '     主用途:部署后独立调用 node scripts/check-migration-ledger-drift.mjs --dsn "$DATABASE_URL" [--strict]',
      '     (DSN 来源优先级 --dsn > IHUI_LEDGER_DSN > DATABASE_URL;输出一律脱敏)',
      '     连不上库时默认降级 SKIP(--strict 时按失败);本门 warn 级不阻塞 commit。',
      '     自检:node scripts/check-migration-ledger-drift.mjs --self-test',
      '     紧急跳过(不推荐):HUSKY_SKIP_MIGRATION_LEDGER_GUARD=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 77 (2026-09-23 新增,全 8 端圆角单一源头对账,blocking) ---
  // 背景:档位表在 radius.js / tokens.css / app.css / tailwind-preset 四处各写一份,v3 端
  //   rounded-sm=2px 与 web v4 sm=4px 同名不同值;更严重的是端内根本不走档位 ——
  //   RN StyleSheet 数字 1292 处、taro rounded-[24rpx] 任意值 509 处、CSS px/rpx 字面量 495 处,
  //   全仓实测偏档 246 点/120 文件。用户可见后果:手机上所有容器圆角与全局设定不一致。
  // 判据 A:四处档位表逐档同值(preset 必须写 `borderRadius: RADIUS_REM`,不得重新内联)。
  // 判据 B:端内取用必须引用档位(rnRadius.<step> / var(--radius-*) / rounded-<step>),
  //   数字字面量、rpx()、每文件自定 *_RADIUS 常量、rounded-[任意值] 一律红;
  //   几何圆(头像/装饰点/胶囊)须显式 `radius-exempt:` 注释,不得静默。存量走基线棘轮只减不增。
  {
    id: '77',
    label: '📐  圆角单一源头对账(blocking,全 8 端:档位表一致 + 端内取用必须引用档位)',
    script: 'check-radius-single-source.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_RADIUS_GUARD',
    onFailHint: [
      '',
      '  💡 圆角档位唯一真相源 = packages/design-tokens/src/radius.js(xs2/sm4/md6/lg8/xl12/2xl16)。',
      '     RN/内联 style : borderRadius: rnRadius.lg      (import { rnRadius } from \'@ihui/design-tokens\')',
      '     CSS/SCSS      : border-radius: var(--radius-lg)',
      '     类名          : rounded-lg(禁止 rounded-[24rpx] 这类任意值)',
      '     真圆/头像/胶囊: 保留形状并加同行注释 radius-exempt: <原因>(不得静默写死数字)',
      '     档位漂移      : 改 radius.js 一处后跑 node scripts/check-radius-single-source.mjs --self-test,',
      '                     CSS 端同步 tokens.css 并按端内脚本重跑 design-tokens 同步。',
      '     自检:node scripts/check-radius-single-source.mjs --self-test',
      '     全量:node scripts/check-radius-single-source.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_RADIUS_GUARD=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- blocking (OpenAPI 契约) ---
  {
    id: '10',
    label: '📋 OpenAPI 契约一致性(blocking,O8b 清零后由 info 升级)',
    script: 'openapi-check.mjs',
    // --staged:仅当本轮暂存触及 apps/api/src/routes/**、契约产物或能力清单时才判定,
    // 否则无关提交也要背 3.5MB 产物的比对成本。判据本身见 scripts/openapi-check.mjs。
    args: ['--staged'],
    mode: 'blocking',
  },
  // 整树删除事故的结构化拦截(2026-09-22 立)。同类事故已真实发生两次:
  //   1ec8c7f0f3 / 05f049ba09 各带着"被清空的索引"提交,一次删掉 11,607 / 11,640 个文件,
  //   事后各需一次索引层重建前向修复。当时**没有任何提交前闸**,只有事后人肉
  //   `git ls-tree -r HEAD | wc -l`。本条把它变成结构性不可能。
  // 判据:索引相对 HEAD 缺失 ≥1000 个文件,或缺失 ≥20% → 拦截;应急 IHUI_ALLOW_MASS_DELETION=1。
  // 不加 stagedTriggers —— 恰恰在"暂存区被清空"时最需要它跑,任何提交都不得跳过。
  {
    id: '65',
    label: '🧹 整树删除拦截(blocking,索引 vs HEAD 文件存续性)',
    script: 'check-mass-deletion.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_MASS_DELETION_GUARD',
    onFailHint: [
      '',
      '  💡 索引相对 HEAD 大面积缺文件 = 提交会把它们从版本树里删掉。',
      '     先分清成因(禁止用 reset --hard 抢救,那会连带抹掉并发会话的工作区改动):',
      '       ① git ls-files | wc -l  与  git ls-tree -r HEAD | wc -l  差距大 → 索引被清空过',
      '          (`git rm -r --cached .` 后未重加 / lint-staged 中断 / 索引被外部工具打残);',
      '       ② 确属有意的大规模删除 → 影响范围写进提交信息,再 IHUI_ALLOW_MASS_DELETION=1;',
      '       ③ 已经误提交 → 走索引层重建前向修复(见 PROJECT_PLAN 两次先例)。',
      '     单独复验:node scripts/check-mass-deletion.mjs',
    ].join('\n'),
  },
  // mobile-rn 深色模式前景/容器守门(2026-09-23 立,Drawer 残留 NativeWind 类 + Profile 对比度事故收口)。
  // R1: brand.DEFAULT 深色下是纯白 → 只能作前景色,其上再叠 surface.light/text.primary 文字 = 白底白字;
  // R2: surface.light / rgba(255,255,255,α≥0.5) / bg-white 作容器底色在深色下不切换 = 页面底色不统一。
  // R2 走 baseline 棘轮(overlay-on-media 等合法场景冻结存量,只拦新增);R1 全量拦截。
  // 自检:node scripts/check-brand-foreground.mjs --self-test;紧急跳过 HUSKY_SKIP_BRAND_FOREGROUND=1。
  {
    id: '75',
    label: '📱 [mobile-rn] 深色模式前景/容器守门(品牌底白字 blocking + 浅色容器 ratchet)',
    script: 'check-brand-foreground.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_BRAND_FOREGROUND',
    onFailHint: [
      '',
      '  💡 R1(brand.DEFAULT 作背景且文字用 surface.light/text.primary)= 深色下白底白字,必须改 brand.foreground;',
      '     R2(surface.light / rgba 白 / bg-white 作容器底)= 深色不切换,改用 tokens.surface.*(深浅皆可)或补 dark: 变体;',
      '     覆盖在媒体/彩色底上的合法浮层被误报时,先核语义再决定改码或 --update-baseline(禁止为过门而调高基线)。',
      '     单独复验:node scripts/check-brand-foreground.mjs;自检:node scripts/check-brand-foreground.mjs --self-test',
    ].join('\n'),
  },
  // 反回退守门(2026-09-23 立)。成因实测:共享工作区 + converge 只推进 HEAD/index 不 checkout,
  // 工作区曾整体落后 HEAD 486 个提交(503 个文件);此时 `git add <file>` 提交的是旧基线,
  // 对该文件等于把别人后续改动静默回滚,而 diff 看着"只动几行"。守门 71 只护 PLAN 登记行,
  // 源码/配置面无闸,故补此闸。判据 = 暂存内容 != HEAD 且**字节级等于该路径某祖先提交的版本**;
  // merge/cherry-pick/revert 上下文整轮豁免,暂存删除只 warn(真删是合法 git rm),
  // >300 文件跳过(性能护栏,避免逼人 --no-verify 把全部守门一起关)。
  // 演练:node scripts/check-stale-revert.mjs --self-test(8 例,含"写回 v1 必判红"阳性对照)。
  {
    id: '76',
    label: '🧬 反回退守门(blocking,暂存内容等于历史版本 = 静默回滚他人改动)',
    script: 'check-stale-revert.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_STALE_REVERT_GUARD',
    onFailHint: [
      '',
      '  💡 这些文件的暂存内容 = 它某个历史提交的原样,不是新工作,而是把别人的改动写回旧态。',
      '     先分清成因:',
      '       ① 工作区落后 HEAD(converge 不 checkout)→ 先 `git restore --source=HEAD --worktree -- <文件>`,',
      '          再把你的改动重新施加(前提:该文件里没有你自己的未提交内容);',
      '       ② 确属有意回退 → 用 `git revert <commit>` 生成前向提交,或 HUSKY_SKIP_STALE_REVERT_GUARD=1 并在提交信息写明理由;',
      '     单独复验:node scripts/check-stale-revert.mjs --staged',
    ].join('\n'),
  },

  // workspace 依赖链接对账(2026-09-23 立,守门 78)。成因是当天的生产停摆:
  // apps/extension 声明了 @ihui/design-tokens: workspace:*,但 node_modules 里没这个链接
  // (§12e 那类 `pnpm install --filter` 把链接剪掉)。deploy 跑 pnpm -r build,wxt 在 rollup
  // 阶段 failed to resolve import → 连续 4 次构建失败 → 部署环进入 30 分钟冷却并反复循环,
  // 线上停在旧提交。关键:**typecheck/lint/单测全都不会知道**(TS 走 tsconfig paths,
  // 不看 node_modules),所以这类破损只有真打包时才暴露 —— 本地全绿、生产恒红。
  // 判据:每个包声明的 workspace:* 依赖必须在 <pkg>/node_modules 或根 node_modules 可解析
  // (existsSync 跟随符号链接,悬空链接同样判红);扫不到任何包时 exit 1,不报假绿灯。
  {
    id: '78',
    label: '🔗 workspace 依赖"声明即已链接"对账(blocking,拦本地全绿/部署环恒红)',
    script: 'check-workspace-dep-links.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_WORKSPACE_DEP_LINKS',
    onFailHint: [
      '',
      '  💡 某包 package.json 声明了 workspace:* 依赖,但 node_modules 里解析不到。',
      '     修复 = 跑 **全量** `pnpm install`(不带 --filter,见 AGENTS.md §12e:',
      '     --filter 安装会剪掉根 node_modules 链接,曾连带让 lint-staged 消失、守门全废)。',
      '     为什么本地看不出来:typecheck 走 tsconfig paths,不看 node_modules;只有 vite/rollup',
      '     真打包时才 failed to resolve import —— 也就是部署环失败、线上停在旧提交。',
      '     单独复验:node scripts/check-workspace-dep-links.mjs',
      '     自检:node scripts/check-workspace-dep-links.mjs --self-test(9 例)',
      '     紧急跳过(不推荐):HUSKY_SKIP_WORKSPACE_DEP_LINKS=1 git commit ...',
      '',
    ].join('\n'),
  },

  // 热路径 git 只读调用超时封顶(2026-09-23 立,守门 79)。成因实测:check-port-registry 里
  // 一处 execSync('git ls-files') 没有 timeout,在共享工作区挂住 80 分钟而 CPU 只用了 2.84s
  // —— 等锁/等 IO 型挂起,表现是"提交像死掉了",而 git status 与 typecheck 全看不出异常。
  // 全仓首参锚定实测 159 处 git 派生调用无一带 timeout,即"没有约束"而非"个别疏忽"。
  // 口径刻意收窄(宁漏不误报,与门 52 同取向):① 只判钩子/守护链可达的 HOT 文件;
  // ② 只判动词为字面量的调用(包装器动词未知,整体加超时会把写操作一并 bound,
  //    而 commit/add/reset 中途被 SIGTERM 可能留下 .git/index.lock,把挂起换成全局阻塞);
  // ③ 只判只读动词。写动词/包装器不判但如实计数。字符串与注释内的命中一律丢弃
  // (自检抓到过判据把测试夹具源码字符串当真调用误红,已按 markHidden 修掉)。
  // 存量已随本门一并清零(runner 3 处 + converge 4 处 + commit-loss-guard 默认值),不留基线债。
  {
    id: '79',
    label: '⏱  热路径 git 只读调用必须带 timeout(blocking,拦无界挂起拖死守门链)',
    script: 'check-git-read-timeout.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_GIT_READ_TIMEOUT',
    onFailHint: [
      '',
      '  💡 这些 git 只读调用跑在 commit/守护/收敛链上,没有 timeout 就是一次无限挂起。',
      '     修法:options 里加 `timeout: <ms>`(60_000~300_000 已远高于正常耗时)。',
      '     本门**不**对写动词(commit/add/reset/mktree)要求 timeout —— 写操作被中途',
      '     SIGTERM 可能留下 .git/index.lock,反而把一次挂起换成全局阻塞。',
      '     单独复验:node scripts/check-git-read-timeout.mjs',
      '     自检:node scripts/check-git-read-timeout.mjs --self-test(9 例)',
      '     紧急跳过(不推荐):HUSKY_SKIP_GIT_READ_TIMEOUT=1 git commit ...',
      '',
    ].join('\n'),
  },

  // 提交内容含 Git 冲突标记(2026-09-23 立)。成因实测:.git 被宿主清除后的恢复期,某会话在
  // 共享工作区跑了真实 `git merge`,留下 103 个未合并路径 + 94 个带字面标记的工作区文件,而
  // 全链守门**没有一道**看"被提交的内容含 <<<<====>>>> 标记",于是带标记的文件一路进 HEAD 树,
  // 整轮 merge 结束都无人察觉。判据 = 同文件内**成对**的行首 `<<<<<<< ` 与 `>>>>>>> `
  // (中间可夹整行 `=======`);单行不判(`=======` 在 setext 标题/表格/ASCII 图里合法,
  // 只判单行会满天假红)。三模式:--staged 判索引内容(git show :<path>,取不到退回工作区;
  // 未合并 U 路径也在清单内)、缺省判全量跟踪文件工作区内容、--rev 判提交树。护栏:自豁免
  // (本门脚本与测试必含字面量)/ >2MB / 二进制,三类均如实计数不静默。
  // 自检:node scripts/check-no-conflict-markers.mjs --self-test(26 例含正反成对对照 + E1 豁免与混搭反例 + 真实 merge 未合并路径现场)。
  {
    id: '79',
    label: '🔀 提交内容含 Git 冲突标记(blocking,成对 <<<<====>>>> 标记一旦入树即拦)',
    script: 'check-no-conflict-markers.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_CONFLICT_MARKERS',
    onFailHint: [
      '',
      '  💡 成对的 Git 冲突标记被提交进来了 —— 说明 merge/rebase 没真正归并就 add 了。',
      '     正确做法:',
      '       ① 取一侧真实内容:`git checkout --ours <文件>` 或 `git checkout --theirs <文件>`,',
      '          或按 AGENTS.md §12b 协作收尾流程重新归并后再 add;',
      '       ② **禁止**只手删 `<<<<====>>>>` 三行当作已解决(那会静默丢掉一侧改动);',
      '       ③ 事后核验历史提交:node scripts/check-no-conflict-markers.mjs --rev HEAD。',
      '     单独复现:node scripts/check-no-conflict-markers.mjs --staged',
      '     紧急跳过(不推荐):HUSKY_SKIP_CONFLICT_MARKERS=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- info (1 项) ---
  {
    id: '23',
    label: '📋 staged 文件清单(info)',
    script: 'check-staged-files.mjs',
    args: [],
    mode: 'info',
  },
]

// === push 门检查集(2026-08-31 新增) ===
// .husky/pre-push 直跑 `pnpm typecheck:full`,多会话并行时被其他会话非暂存损坏文件误伤
// (上千个 TS1005 全部来自非暂存文件,却输出"❌ 全量 typecheck 失败,推送已阻止")。
// 新增 scripts/check-typecheck.mjs 包装做 staged-scope 降级判定(全部报错文件均不在
// 暂存区 → 降级为警告放行),经 --push-gate 显式启用;hook 本体不在改动允许范围内。
const pushGateChecks = [
  {
    id: 'T1',
    label: '🔍 push 门全量 typecheck(staged-scope 降级)',
    script: 'check-typecheck.mjs',
    args: [],
    mode: 'blocking',
  },
]

// === CLI 解析 ===

const cliArgs = process.argv.slice(2)
const passStaged = cliArgs.includes('--staged')
const showTiming = cliArgs.includes('--timing')
const showHelp = cliArgs.includes('--help') || cliArgs.includes('-h')
const pushGate = cliArgs.includes('--push-gate')

// --push-gate 模式:仅执行 push 门检查集(不跑 pre-commit 的全部检查)
const effectiveChecks = pushGate ? pushGateChecks : checks

// === Help ===

if (showHelp) {
  const blocking = effectiveChecks.filter((c) => c.mode === 'blocking')
  const warn = effectiveChecks.filter((c) => c.mode === 'warn')
  const info = effectiveChecks.filter((c) => c.mode === 'info')
  console.log(`
guardian-runner.mjs — 守门脚本批量执行器

用法:
  node scripts/guardian-runner.mjs [--staged] [--timing] [--push-gate] [--help]

选项:
  --staged      传递 --staged 给所有脚本(pre-commit 模式)
  --timing      打印每个检查的耗时
  --push-gate   仅执行 push 门检查集(T1 全量 typecheck,staged-scope 降级)
  --help        打印此帮助

检查清单(${effectiveChecks.length} 项):
  blocking (${blocking.length} 项): ${blocking.map((c) => c.id).join(', ')}
  warn     (${warn.length} 项): ${warn.map((c) => c.id).join(', ')}
  info     (${info.length} 项): ${info.map((c) => c.id).join(', ')}

执行逻辑:
  blocking 失败 → 记入清单并**继续跑完全部**,末尾列出全部失败门后 exit(1)
                  (逃生舱 GUARDIAN_STOP_ON_FIRST=1 恢复旧的"首个失败立即 exit(1)")
  子门 exit 75   → 视为中断而非检查结论,**立即**以 75 向上传播(hook → push guard 据此重试),不收敛成 1
  warn     失败 → 打印警告,继续执行
  info     →    始终继续,只打印信息
`)
  process.exit(0)
}

// === 执行 ===

// ─── push-gate 结果缓存(2026-09-18 立,"已推完还在等"根治第二刀) ───
// 背景:pre-push 钩子是仓库级——同一批 commit 推 N 个仓就清缓存全量 tsc+mypy N 遍,
//      单遍数分钟,多会话收尾动辄干等 8-13 分钟。而同一 HEAD 的代码内容完全相同,
//      短窗口内重复跑门是纯浪费。
// 策略(2026-09-18 晚二次根治):**内容指纹**为键,不再按 HEAD sha——
//      typecheck 实际消费的是工作区(apps/+packages/ 的 HEAD 子树 + 脏改动),
//      合并提交/文档提交虽推进 HEAD 但类型相关内容不变,按 sha 键控必 miss,
//      导致每轮收敛都重跑 270s 全量门(实测收敛 3 轮 = 13 分钟)。
//      指纹 = HEAD:apps 树 hash + HEAD:packages 树 hash + 脏文件清单及内容 hash。
//      只缓存"全部通过"结果;指纹一变立即失效。
// 跳过:HUSKY_SKIP_PUSHGATE_CACHE=1(需要强制重跑全量门时使用)。
const PUSHGATE_CACHE_TTL_MS = 10 * 60 * 1000
const pushGateCacheFile = resolve(process.cwd(), '.workbuddy/push-gate-cache.json')

function readPushGateCache() {
  try {
    return JSON.parse(readFileSync(pushGateCacheFile, 'utf8'))
  } catch {
    return null
  }
}

/** 计算门检查输入的内容指纹:HEAD 类型相关子树 + 工作区脏状态(含脏文件内容) */
function computeGateFingerprint() {
  try {
    const trees = execFileSync('git', ['rev-parse', 'HEAD:apps', 'HEAD:packages'], {
      encoding: 'utf8',
      windowsHide: true,
      // 只读查询,可安全封顶:同日 check-port-registry 因无 timeout 挂住 80 分钟,
      // 把整条 pre-commit 拖成"看起来像卡死"。5 分钟远高于任何正常耗时,只截病态挂起。
      timeout: 300_000,
    }).trim()
    // -z:NUL 分隔,路径无转义歧义;rename 条目 "R  new\0old\0" 需跳过 old 段
    const statusRaw = execFileSync(
      'git',
      ['status', '--porcelain', '-z', '--', 'apps', 'packages'],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 300_000,
      },
    )
    const h = createHash('sha1')
    h.update(trees)
    h.update(statusRaw)
    const tokens = statusRaw.split('\0').filter(Boolean)
    for (let i = 0; i < tokens.length && i < 400; i++) {
      const tok = tokens[i]
      if (tok.length <= 3 || tok[2] !== ' ') continue
      const xy = tok.slice(0, 2)
      try {
        h.update(readFileSync(resolve(process.cwd(), tok.slice(3))))
      } catch {
        /* 删除态/瞬时不可读文件跳过,不影响指纹整体有效性 */
      }
      if (xy.includes('R') || xy.includes('C')) i++ // 跳过 rename 的 old path 段
    }
    return h.digest('hex')
  } catch {
    return null
  }
}

if (pushGate && !cliArgs.includes('--no-cache') && process.env.HUSKY_SKIP_PUSHGATE_CACHE !== '1') {
  const cache = readPushGateCache()
  const fp = computeGateFingerprint()
  if (
    cache &&
    cache.passed === true &&
    cache.fp &&
    cache.fp === fp &&
    Date.now() - cache.ts < PUSHGATE_CACHE_TTL_MS
  ) {
    const ageMin = ((Date.now() - cache.ts) / 60000).toFixed(1)
    console.log(
      `${C.green}⚡ [push-gate] 命中缓存:类型相关内容指纹 ${String(fp).slice(0, 11)} 于 ${ageMin} 分钟前已通过全量门,跳过重复 typecheck${C.reset}`,
    )
    console.log(`${C.dim}   (内容一致复用结果;强制重跑:HUSKY_SKIP_PUSHGATE_CACHE=1)${C.reset}`)
    process.exit(0)
  }
}

let passed = 0
let warned = 0
let failed = 0
let skipped = 0
const startTime = Date.now()
// 跑完再汇总(2026-09-22 改版):原先任一 blocking 门失败即 exit(1),会遮蔽其后所有门的结论
// —— 既让人误判"刚注册的门没生效"(实测两次被 id 6 / id 30c 的在途失败截断),也会把
// 本可一次看全的多处故障拆成多轮。改为一轮跑完、末尾列清单一次性退出。
// 两条不变量:① exit 75(中断)仍**立即**向上传播,不收敛成 1(push guard 靠它决定重试);
// ② GUARDIAN_STOP_ON_FIRST=1 完整恢复旧的快速失败行为(逃生舱)。
const stopOnFirst = process.env.GUARDIAN_STOP_ON_FIRST === '1'
/** blocking 失败门清单(末尾汇总用)。 */
const failedGates = []

/** 打印批量检查汇总。早退与跑完两条路径共用,避免两份实现漂移。 */
function printSummary(useStderr) {
  const out = useStderr ? console.error : console.log
  const executed = passed + warned + failed + skipped
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  out('')
  out(`${C.bold}🛡️ 守门脚本批量检查汇总${C.reset}`)
  out(
    `  总检查数: ${effectiveChecks.length}(已执行 ${executed}${executed < effectiveChecks.length ? ' ← 提前中止' : ''})`,
  )
  out(`  ${C.green}通过: ${passed}${C.reset}`)
  out(`  ${C.yellow}警告: ${warned}${C.reset}`)
  out(`  ${C.red}失败: ${failed}${C.reset}`)
  out(`  ${C.dim}跳过: ${skipped}${C.reset}`)
  out(`  总耗时: ${totalTime}s`)
}

// ─── 条件触发(2026-09-22 立)───
// 条目声明 stagedTriggers(路径前缀数组)时,--staged 模式下只在**暂存区触及这些前缀**才执行,
// 口径与 .husky/pre-commit 的 16b/16c/16e 条件守门完全一致(git diff --cached --name-only)。
// 为什么需要:领域守门(桌面安装器等)与绝大多数提交无关,无条件挂上既拖慢每次 commit,
//   又会因他人未完成的工作树改动误伤;但判据本身必须 blocking —— 静默失败类事故
//   (NSIS 少一行 File 编译零报错、--write 抹掉未登记定制)只有真拦住才有意义。
// 全量模式(不带 --staged,手动 / CI)一律执行;拿不到暂存区(非 git 环境)按「触及」处理,
//   宁误跑不误漏。结果缓存一次,多个条件项共用。
// 边界:--staged 而暂存区为空(手动误跑该模式)按「未触及」跳过 —— 需要全量审计请不带 --staged。
let stagedFilesCache = null
function stagedFilesOrNull() {
  if (stagedFilesCache) return stagedFilesCache
  try {
    stagedFilesCache = execFileSync('git', ['diff', '--cached', '--name-only'], {
      encoding: 'utf8',
      cwd: process.cwd(),
      windowsHide: true,
      timeout: 120_000,
    })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return null
  }
  return stagedFilesCache
}

function stagedPathsTouch(prefixes) {
  const files = stagedFilesOrNull()
  if (files === null) return true
  return files.some((f) => {
    const norm = f.replace(/\\/g, '/')
    return prefixes.some((p) => norm.startsWith(p))
  })
}

for (const check of effectiveChecks) {
  // 逐项应急放行(2026-09-21 立):与各门脚本内部 HUSKY_SKIP_* 惯例一致,由 item 的
  // skipEnv 字段声明变量名。适用场景 = 并发会话未提交 WIP 造成"工作区级"漂移,
  // 阻塞与本任务无关的提交(本次改动不含该目录时,门的结论是假阳性)。
  // 纪律:commit message 必须写明责任归属;默认行为不变(不设变量照常阻塞)。
  if (check.skipEnv && process.env[check.skipEnv] === '1') {
    skipped++
    console.log(`⏭  [${check.id}] ${check.label}(跳过:${check.skipEnv}=1)`)
    continue
  }
  // 条件触发(2026-09-22 立,见上方 stagedPathsTouch):暂存区未触及声明路径 → 不执行。
  // 与 skipEnv 同计入"跳过",并打印触发清单,避免"静默没跑"。
  if (check.stagedTriggers && passStaged && !stagedPathsTouch(check.stagedTriggers)) {
    skipped++
    console.log(
      `⏭  [${check.id}] ${check.label}(暂存区未触及:${check.stagedTriggers.join(' / ')},跳过)`,
    )
    continue
  }
  const cmdArgs = [...check.args]
  if (passStaged) cmdArgs.push('--staged')
  const cmd = `node scripts/${check.script}${cmdArgs.length > 0 ? ' ' + cmdArgs.join(' ') : ''}`

  console.log(`[${check.id}] ${check.label}...`)
  const checkStart = Date.now()

  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd(), windowsHide: true })
    passed++
    if (showTiming) {
      console.log(`  ${C.dim}⏱  ${Date.now() - checkStart}ms${C.reset}`)
    }
  } catch (e) {
    const elapsed = Date.now() - checkStart
    // 2026-09-18 中断传播:子检查以 exit 75(临时失败/被中断)退出 ≠ 检查结论失败,
    // 必须原样向上传播(hook → push guard 据此带 hook 重试),不得收敛成 1。
    if (check.mode === 'blocking' && e && e.status === 75) {
      console.error(
        `⏭️ [${check.id}] ${check.label} 被中断(exit 75 临时失败)—— 非检查结论,以 75 向上传播`,
      )
      process.exit(75)
    }
    // 2026-08-19 立:catch {} 同时覆盖三种情况 — 脚本 exit 1 / 脚本崩溃 / 脚本不存在
    // stdio:inherit 已把 stderr/stdout 透传给上游,无需额外 silent-skip 检测。
    // (执行 stdio:inherit 后,子进程任何 stdout/stderr 都会立即打印,
    //  silent-skip 仅在 stdio:pipe 但未读 stdout 的场景才可能发生,本 runner 不存在该风险)
    if (check.mode === 'blocking') {
      failed++
      failedGates.push({ id: check.id, label: check.label, script: check.script })
      if (check.onFailHint) {
        console.log(check.onFailHint)
      }
      console.error(`${C.red}❌ [${check.id}] ${check.label} 失败,提交已阻止${C.reset}`)
      // 默认继续跑完(见 failedGates 声明处注释);逃生舱才早退。
      if (stopOnFirst) {
        printSummary(true)
        process.exit(1)
      }
    } else if (check.mode === 'warn') {
      warned++
      console.warn(
        `${C.yellow}⚠️ [${check.id}] ${check.label} 失败 (warn-only,不阻塞 commit)${C.reset}`,
      )
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

printSummary(false)
if (failedGates.length > 0) {
  console.error('')
  console.error(
    `${C.bold}${C.red}🚫 ${failedGates.length} 道 blocking 门失败 —— 本轮已跑完全部 ${effectiveChecks.length} 项,未提前中止:${C.reset}`,
  )
  for (const g of failedGates) {
    console.error(`   · [${g.id}] ${g.label}`)
    console.error(`     单独复现:node scripts/${g.script}${passStaged ? ' --staged' : ''}`)
  }
  console.error(`  ${C.dim}(紧急只跑首个即停:GUARDIAN_STOP_ON_FIRST=1)${C.reset}`)
  process.exit(1)
}

// push-gate 全部通过 → 写缓存(内容指纹键控,同内容短窗口内重复 push 复用,见执行段注释)
if (pushGate && failed === 0) {
  try {
    mkdirSync(resolve(process.cwd(), '.workbuddy'), { recursive: true })
    writeFileSync(
      pushGateCacheFile,
      JSON.stringify({ fp: computeGateFingerprint(), passed: true, ts: Date.now() }),
    )
    console.log(
      `${C.dim}⚡ [push-gate] 结果已缓存(类型相关内容一致时 10 分钟内重复推送免重跑)${C.reset}`,
    )
  } catch {
    /* 缓存写失败不影响放行 */
  }
}

process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
