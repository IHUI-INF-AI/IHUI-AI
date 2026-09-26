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
import { normalizeTriggers, triggersTouch } from './lib/guardian-triggers.mjs'

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
    skipEnv: 'HUSKY_SKIP_TAGSVIEW_GUARD',
    // 2026-09-24 补齐:本门头注一直写着「紧急跳过 HUSKY_SKIP_TAGSVIEW_GUARD=1」,但 runner 从未声明该字段、
    // 脚本自己也不读 ⇒ 那是**假逃生舱**(设了毫无效果,只会逼人改用 --no-verify 连带废掉全部门)。
    // runner 的分发循环统一 honors skipEnv,故补这一行即让承诺成真。
    // (此处原文还写着"由守门 89 的 R8 常驻核验",而 89 只有 R1–R7、**没有 R8** —— 谎称有防线
    //  比没有防线更坏:后人会以为这类漂移已被机器看守。核验入口见计划登记的 R8 待办。)
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
    // 本条目头注承诺 `HUSKY_SKIP_STAGED_TYPECHECK_MIRROR_SYNC=1` 可应急跳过,而 runner 分发
    // 循环只认注册块里的 skipEnv —— 不声明就是**假逃生舱**:唯一出路退化成 --no-verify,
    // 一次绕过等于全部守门对该提交作废(§12e 同型)。2026-09-24 全量审计:151 个 check 脚本
    // 里仅此一枚如此,其余 75 枚均已声明或由脚本自读。
    skipEnv: 'HUSKY_SKIP_STAGED_TYPECHECK_MIRROR_SYNC',
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
  // blocking:Taro 4 + Tailwind v3 不兼容 v4 @theme 语法,app.css 由 scripts/sync-miniapp-tokens.mjs
  //   (2026-09-25 由端内 apps/miniapp-taro/scripts/sync-design-tokens.mjs 搬来,原因见该文件头注)
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
      '  💡 apps/miniapp-taro/src/app.css 的**受管** --color-* 档与 packages/design-tokens/src/styles/tokens.css 不一致,',
      '     修复:pnpm --filter @ihui/miniapp-taro sync-tokens(写回受管块,幂等)',
      '     然后重新 git add apps/miniapp-taro/src/app.css 并 commit',
      '     ⚠️ 本门曾被判错方向:判据只遍历副本已有的键 ⇒ 对「源头有、副本整批缺」一路报绿;',
      '        补上判缺档后又拿源头**全部**属性去判,把生成器按政策刻意不搬的档(非色档 / web 独有的',
      '        --color-sidebar*/--color-shell-panel / 跨行 --color-gradient-*)算成缺档,255 红点里 88 条是误判,',
      '        门因此被降权。现在「该判什么」与「该写什么」是同一个谓词',
      '        (scripts/sync-miniapp-tokens.mjs 导出的 MINIAPP_SKIP_PREFIXES + isManagedForMiniapp)。',
      '        所以**不得**为了消红去放宽判据或往跳过表里塞条目:生成器写不出来的新跨行档,要么改写成单行,',
      '        要么扩生成器的写回面(两侧同笔入账),要么交回主控判定。',
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
  // --staged 由本 runner 在 staged 模式下统一追加(见 passStaged 分支),**不得**写进 args:
  //   写死会让"不带 --staged 的全量审计"永远命中"无 staged screen 文件,跳过"→ 恒绿(2026-09-24 实测
  //   全量 204 个 screen 全绿,故摘掉硬编码不新增红点,只是把全量面从假绿变成真判)。
  // 失败含义:有人新增 mobile-rn screen 但未迁移到共享层,需迁移或登记白名单后重新 commit。
  {
    id: '39',
    label: '📱 mobile-rn screen 迁移完整性(blocking,防独立实现回升)',
    script: 'check-rn-app-migration.mjs',
    args: [],
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
  // 2026-09-24 补 per-end ja 门:2d 只跑 web 口径(args 无 --target),
  // 而 shared / miniapp-taro / mobile-rn 三端 ja.json 同样承载界面文案,此前无人守。
  // 装门前实测三端全 ✅(零命中),故升 blocking 不误伤在途提交;判据与豁免同 2d(见 scripts/joyo-kanji.json)。
  {
    id: '2o-shared',
    label: '🔍 [shared] ja.json 中文简体残留(blocking,常用汉字表精确判据)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ja', '--target=shared'],
    mode: 'blocking',
  },
  {
    id: '2o-miniapp-taro',
    label: '🔍 [miniapp-taro] ja.json 中文简体残留(blocking,常用汉字表精确判据)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ja', '--target=miniapp-taro'],
    mode: 'blocking',
  },
  {
    id: '2o-mobile-rn',
    label: '🔍 [mobile-rn] ja.json 中文简体残留(blocking,常用汉字表精确判据)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ja', '--target=mobile-rn'],
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
    // 原 `2l-shared`(warn,ja --target=shared)已于 2026-09-24 删除:2026-09-24 新增的 `2o-shared`
    // (blocking)用的是**逐字相同**的 script+args,同一条判定每轮 commit 跑两遍,汇总里同时产出
    // 1 条警告 + 1 条失败,污染归因。禁止再登记同参 warn 版(要双档必须 args 真不同)。
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
    skipEnv: 'HUSKY_SKIP_INLINE_BACK_GUARD',
    // 2026-09-24 补齐:本门头注一直写着「紧急跳过 HUSKY_SKIP_INLINE_BACK_GUARD=1」,但 runner 从未声明该字段、
    // 脚本自己也不读 ⇒ 那是**假逃生舱**(设了毫无效果,只会逼人改用 --no-verify 连带废掉全部门)。
    // runner 的分发循环统一 honors skipEnv,故补这一行即让承诺成真。
    // (此处原文还写着"由守门 89 的 R8 常驻核验",而 89 只有 R1–R7、**没有 R8** —— 谎称有防线
    //  比没有防线更坏:后人会以为这类漂移已被机器看守。核验入口见计划登记的 R8 待办。)
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
    label: '🧾 迁移记账守门(journal ↔ .sql 一一对应 / when 单调唯一 / B10 登记表空闲性 warn)',
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
    skipEnv: 'HUSKY_SKIP_NEXT_ENV_DIST',
    // 2026-09-24 补齐:本门头注一直写着「紧急跳过 HUSKY_SKIP_NEXT_ENV_DIST=1」,但 runner 从未声明该字段、
    // 脚本自己也不读 ⇒ 那是**假逃生舱**(设了毫无效果,只会逼人改用 --no-verify 连带废掉全部门)。
    // runner 的分发循环统一 honors skipEnv,故补这一行即让承诺成真。
    // (此处原文还写着"由守门 89 的 R8 常驻核验",而 89 只有 R1–R7、**没有 R8** —— 谎称有防线
    //  比没有防线更坏:后人会以为这类漂移已被机器看守。核验入口见计划登记的 R8 待办。)
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

  // --- 53 (2026-09-21 新增 warn 级起步;2026-09-23 O13b④ 升 blocking) ---
  // 当初 warn-only 的理由:存量 34 文件/74 处裸 roleId 比较刚完成一次性白名单登记,白名单
  //   口径与 --staged 判据需先观察一轮误报率;存量清零或稳定后再升。
  // 现在可升,两个前置都已完成:
  //   ① O13b 第二段 ①②③⑤ 已落地(34 文件白名单收敛到 8 文件/12 处,集中封装
  //      plugins/require-permission.ts 的 requireAdminRouteGuard 亦收编了 admin.ts 的 preHandler);
  //   ② 判据缺口已补 —— `if (roleId < 1)` 这一种文本形态同时是"特权判定"(读 jwtPayload → 403)
  //      和"入参校验"(读 request.query/body → 400 'roleId 无效',如 role-routes.ts 五处),
  //      两者逐字符几乎相同。warn 期无所谓,升 blocking 后任何新写的 roleId 入参校验都会
  //      被永久锁成红点。已按**来源回溯**排除后者(AUTH 证据优先、回溯不出即判红、属性访问
  //      不进排除通道 ⇒ 宁不误放),全量实测 17 → 12 处,排除 5 处入参校验、零真鉴权被误放。
  // 判据:裸 roleId 数值比较(集中封装之外)条数只减不增;本地重定义 requireAdmin 禁止回升;
  //   capability-catalog dataClass=platform 条目 thirdPartyEligible 必须为 false(机器凭据 403 不变量)。
  //   详见脚本头注释与 docs/developer/admin-permission-mapping.md。
  // 跳过方法:HUSKY_SKIP_ADMIN_GATE_GUARD=1 git commit ...(应急,不建议)
  {
    id: '53',
    label: '🛡️  admin 面特权判定一致性(blocking,O13b roleId>=1 收敛)',
    script: 'check-admin-gate-consistency.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_ADMIN_GATE_GUARD',
    // 2026-09-24 补齐:本门头注一直写着「紧急跳过 HUSKY_SKIP_ADMIN_GATE_GUARD=1」,但 runner 从未声明该字段、
    // 脚本自己也不读 ⇒ 那是**假逃生舱**(设了毫无效果,只会逼人改用 --no-verify 连带废掉全部门)。
    // runner 的分发循环统一 honors skipEnv,故补这一行即让承诺成真。
    // (此处原文还写着"由守门 89 的 R8 常驻核验",而 89 只有 R1–R7、**没有 R8** —— 谎称有防线
    //  比没有防线更坏:后人会以为这类漂移已被机器看守。核验入口见计划登记的 R8 待办。)
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
    label: '🧩 对话流元素覆盖守门(blocking,D51/H13:①锚点漂移 ②契约事件两端不齐 ③清单条目倒退 ④锚点存续性倒退 ⑤注释式摘线)',
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

  // --- 71 (2026-09-22 新增,计划登记行防丢) ---
  // 2026-09-24 补「条目标题级」判据:标题族(`^#{2,3} O<数字>…`)此前与 bullet 共用同一个"行首编号"
  //   判活集合,而同一节里几乎总有一条**同编号 bullet**(`- **O42 残余…**`)顶着那个编号 —— 于是并发
  //   "旧基线整文件写回"抹掉 `## O42 …` 标题时本门照报"无缺失"(真仓 HEAD 抽掉该行实测 0 报,
  //   事故登记见 PLAN 的 O45④)。现标题族单独判活:候选里必须仍有**一行标题**以该编号开头
  //   (只改写文案、## 降级 ### 仍放过;§1 归档仍在 archive 命中即放行)。
  //   能力边界:--heal 只逐行回捞,补不回"标题 + 其下整节正文"的从属关系 ⇒ 标题级丢失输出一律注明
  //   "需人工归并",不得当作已自愈。取证:scripts/tests/check-plan-line-loss.test.mjs(含临时真仓装车)。
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

  {
    id: '93',
    // 2026-09-24 改号(守门 89 的 R5「重复 id 判红」实测抓到):同一号被并发会话各登记了一次，
    // 同 id 两道 blocking 门会串 skipEnv 与失败归属。按本仓"后来者改号"规矩挪到 93;
    // 引用本门编号时一律以 scripts/guardian-runner.mjs 现值为准，别照抄文档/计划里的历史号。
    label: '🎨 跨端色值同源对账(blocking,RN rn-tokens ↔ tokens.css 逐位同值 + 品牌档不得端内自立)',
    script: 'check-cross-end-tokens.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_CROSS_END_TOKENS',
    // 不声明 stagedTriggers:R3 判的是"这次提交会带走的悬空引用",可能出现在任何端内文件
    // (mobile-rn / packages/app / ui-native …),收窄触发面等于给漏网留口;
    // 且实测开销仅 0.46s(--staged)/ 1.3s(全量),没有为之省时间的理由。
    onFailHint: [
      '',
      '  💡 三条判据:',
      '     R1 已声明映射逐位同值 —— rn-tokens.ts 的色值必须等于 tokens.css 对应 CSS 变量(亮/暗各自对账)。',
      '     R2 品牌键覆盖 —— rn-tokens 的 brand 命名空间里每个键,必须被某条映射声明,或在 RN_ONLY_BRAND_KEYS',
      '        写明"web 无对应变量"的理由(豁免项若已不存在同样算红,防清单腐烂)。',
      '     R3 悬空引用 —— tokens.brand.<key> / tk.brand.<key> 必须命中已声明键集合(默认判 HEAD,--staged 判索引)。',
      '',
      '     品牌 CTA 的唯一写法:backgroundColor/borderColor = brand.DEFAULT,其上文字 = brand.foreground',
      '     (等价 web 的 --color-primary + --color-primary-foreground);**不得再立 brand.ctaFill/ctaText 这类端内档',
      '     —— 2026-09-24 已删,理由:浅色=web primary、深色=brand-accent 的混血档让同一语义三端三个值。**',
      '     要调暗色主按钮对比度,改 tokens.css 的 .dark --color-primary 一处,三端一起动。',
      '',
      '     定位:node scripts/check-cross-end-tokens.mjs --list(看映射与依据)',
      '     自检:node scripts/check-cross-end-tokens.mjs --self-test(8 例正反对照)',
      '     紧急跳过(不推荐):HUSKY_SKIP_CROSS_END_TOKENS=1 git commit ...',
      '',
    ].join('\n'),
  },
  // 主题接线对账(2026-09-24 立)。起因是真机实测:广场页顶栏/底栏 #1a1a1a 而正文
  // #f5f5f5 —— 同一屏幕两套档案。根因在共享层:packages/app 里 213 个组件形参默认
  // `colorScheme = 'light'` 并据此 getTokens(),调用方只要漏传或写字面量,整棵子树
  // 就静默按该档案渲染,而端内 chrome 跟着真主题走。首轮实测命中 118 处 / 117 文件,
  // 已修 108 处;余 9 处(他人 M 在制的 7 个屏 + study-publish 需整文件主题化改造)
  // 冻结在 scripts/theme-prop-wiring-baseline.json,棘轮只减不增。
  // 组件清单由源码自动推导、不维护手工名单 —— 手工清单正是上一版判据漏东西的原因。
  {
    id: '91',
    label: '🌗 主题接线对账(blocking,theme-driven 共享组件必须拿到调用方解析出的主题)',
    script: 'check-theme-prop-wiring.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_THEME_PROP_WIRING',
    onFailHint: [
      '',
      '  💡 两类红:',
      '     ① 漏传 colorScheme —— 共享组件形参默认值是 \'light\',漏传等于静默锁死浅色档案;',
      '        正解 `<X colorScheme={resolvedTheme} />`,值须来自 useTheme()/主题 store。',
      '     ② 写死字面量 "light"/"dark" —— 永远错,后果同①(真机实测即此形)。',
      '     跨行元素要连属性一起看;`{...props}` 展开不算传值(实测 115 处即藏在这里)。',
      '',
      '     定位:node scripts/check-theme-prop-wiring.mjs --json',
      '     自检:node scripts/check-theme-prop-wiring.mjs --self-test',
      '     收紧基线(人工确认后):node scripts/check-theme-prop-wiring.mjs --update-baseline',
      '     紧急跳过(不推荐):HUSKY_SKIP_THEME_PROP_WIRING=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- blocking (OpenAPI 契约) ---
  {
    id: '10',
    label: '📋 OpenAPI 契约一致性(blocking,O8b 清零后由 info 升级)',
    script: 'openapi-check.mjs',
    // --staged 由 runner 统一追加,不得写死:写死后全量审计恒命中"暂存改动与契约无关,跳过"⇒ 假绿。
    // 2026-09-24 实测全量口径 A~E 全绿且仅 0.37s(原注释担心的 3.5MB 比对成本并不成立),
    // 故摘掉硬编码:pre-commit 行为不变,全量/CI 口径从"跳过"变成真判。
    args: [],
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
    id: '83',
    label: '📱 [mobile-rn] 深色模式前景/容器守门(品牌底白字 blocking + 浅色容器 ratchet)',
    script: 'check-brand-foreground.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_BRAND_FOREGROUND',
    onFailHint: [
      '',
      '  💡 R1(同一 style 块内 brand.DEFAULT / brand.cta 背景 + surface.light/text.primary 字)= 深色下白底白字;',
      '     R4(2026-09-24 补,**兄弟 key** 之间的同一缺陷):底在 `retryBtn`、字在 `retryText` ——',
      '        RN 的 StyleSheet 天然把按钮底和它的文字拆成两个 key,所以 R1 的同块判据',
      '        对这类结构性缺陷全程沉默,PlazaScreen 四个 1.06:1 黑压黑按钮因此 shipped 到真机。',
      '        R4 用**名字**配对(X/XText、XBtn|XButton 与 XBtnText|XButtonText、X/XLabel,顺序无关),',
      '        不用行距滑窗 ⇒ 不会误伤不相干的相邻样式。',
      '     唯一正解(2026-09-24 改档,AGENTS §4):品牌实底 + 其上文字一律成对写 brand.cta +',
      '        **brand.ctaForeground**(= web 的 --color-cta / --color-cta-foreground,明暗同值不反转);',
      '        brand.DEFAULT / --color-primary 只保留墨色、描边、文字色三义,**不再**作大色块底 ——',
      '        它亮=纯黑/暗=纯白,作大色块时两态都是与页面相反的那一极(用户实拍"浅黑深白")。',
      '     ⚠️ brand.ctaFill / ctaText 这对端内自立的混血档已于 2026-09-24 删除,不得作为修法加回来',
      '        —— 悬空引用由守门 93(check-cross-end-tokens)的品牌键判据直接判红。',
      '     R2(surface.light / rgba 白 / bg-white 作容器底)= 深色不切换,改用 tokens.surface.*(深浅皆可)或补 dark: 变体;',
      '     覆盖在媒体/彩色底上的合法浮层被误报时,先核语义再决定改码或 --update-baseline(禁止为过门而调高基线)。',
      '     ⚠️ --update-baseline 会一并重写 R2/R3 基线,共享工作区脏时等于把别人的存量抬上去 —— 先确认可全量口径。',
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
    id: '84',
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
    label:
      '🔗 workspace 依赖"声明即已链接 / 链接即有内容 / 命令即可跑"五维对账(blocking,拦本地全绿·部署环恒红·全机门禁停摆)',
    script: 'check-workspace-dep-links.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_WORKSPACE_DEP_LINKS',
    onFailHint: [
      '',
      '  💡 本门五个维度,先看清红在哪一维 —— 五维的**修复动作并不相同**:',
      '     ① 声明↔链接:某包声明 workspace:* 而 node_modules 里没有 ⇒ 全量 `pnpm install`',
      '        (不带 --filter;AGENTS.md §12e:--filter 安装会剪掉根链接,曾连带让 lint-staged',
      '        消失、守门全废)。本地看不出来:typecheck 走 tsconfig paths,不看 node_modules;',
      '        只有 vite/rollup 真打包时才 failed to resolve import —— 也就是部署环停在旧提交。',
      '     ② 链接↔内容:链接在、目标被**掏空**(.pnpm/<pkg>/node_modules/<dep> 成空目录)。',
      '        existsSync 对这一型仍返回 true ⇒ 旧判据恒绿,而 eslint/tsc 已从 .bin 消失。',
      '        --strict 档另延伸到 .pnpm 传递闭包(实测真仓 10,015 条 / 0 红 / 约 1.4s);',
      '        提交链不深扫 —— 并发 install 半复制态会一次闪出上百条,而本门 blocking,',
      '        恒红门的唯一结局就是各会话 --no-verify ⇒ 其余全部守门一起作废。',
      '     ③ 声明了 bin 但该处无 shim:**只报数**(并发 install 期实测 0↔113 跳),要判红用',
      '        `pnpm check:dep-links:strict`(已串进 check:all)。',
      '     ④ 钩子命令解析不到(lint-staged 必 spawn 的那些)⇒ 每次提交被迫跳门。',
      '     ⑤ shim 在、它指向的**入口文件**没了 ⇒ lint-staged 报 Cannot find module。',
      '     ⚠️ ④⑤ 的修复**不是** `pnpm install`:实测普通安装与 `--force` 都只回',
      '        "Already up to date",shim 一个都不补;生效入口是 `node scripts/repair-node-bin-links.mjs`,',
      '        验收一律实测命令本身(`node_modules/.bin/eslint --version` 与 `tsc --version` 都出版本号),',
      '        只看 node_modules/eslint 在不在等于没测。',
      '     单独复验:node scripts/check-workspace-dep-links.mjs(加 --strict 连 ②深扫 ③一并判红)',
      "     自检:node scripts/check-workspace-dep-links.mjs --self-test(例数以末行「自检 N/N」为准,不写死防漂移)",
      '     紧急跳过(不推荐):HUSKY_SKIP_WORKSPACE_DEP_LINKS=1 git commit ...',
      '',
    ].join('\n'),
  },

  // 热路径 git 只读调用超时封顶(2026-09-23 立,守门 80)。成因实测:check-port-registry 里
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
    id: '80',
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

  // 品牌邮件通道对账(2026-09-23 立,守门 81)。成因:邮件"版式模板"只存在于
  // apps/api/src/services/email-templates.ts,但 ops 侧曾有第二条绕过模板的自发通道 ——
  // deploy/win/ihui-deploy.ps1 的 Send-EmailNotify 自拼传输层(Send-MailMessage 无 -BodyAsHtml、
  // Resend payload 只有 text)。这类代码"能发出去、typecheck/lint 全绿",用户收到的邮件却没样式,
  // 与守门 72/78 同族("本地全绿也发现不了")。判据:R1 PS Send-MailMessage 缺 -BodyAsHtml /
  // R2 api.resend.com/emails 同一发送上下文无 html 字段(覆盖 host+path 分行形态)/ R3 ops 脚本
  // 有发信动作(createTransport/sendMail/api.resend.com)却不引用 email-templates /
  // notify-deploy-failure。范围 deploy/** + scripts/**(不含 tests)+ workflows *.yml;
  // 行内豁免 brand-mail-exempt:,存量走 scripts/brand-email-channel-baseline.json 只减不增
  // (建门实测:ihui-deploy.ps1 已被并行会话清干净,仅 check-credential-health.mjs 这条
  // "第三条纯文本通道"入基线待迁移 —— **2026-09-24 已迁至品牌出口,基线 counts 现为空**)。
  // --staged 暂存集为空/取不到 → 退化全量(守门 70 教训)。
  // **范围与 stagedTriggers 必须同步扩**(2026-09-24 补,本条目曾被并发整文件提交回退过一次,
  // 由 scripts/tests/check-brand-email-channel.test.mjs 的"装车证明"抓回):判据已扫到
  // monitoring/** 与 apps/api/scripts/**,若触发清单不跟上,则**只改 bridge 的提交在 pre-commit
  // 根本不会唤起本门** —— 判据存在而永不调用,等于没有(守门 70/76 同型)。
  {
    id: '81',
    label: '📧 品牌邮件通道对账(blocking,拦绕过 email-templates 的纯文本自发通道)',
    script: 'check-brand-email-channel.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_BRAND_MAIL_GUARD',
    stagedTriggers: ['deploy/', 'scripts/', '.github/workflows/', 'monitoring/', 'apps/api/scripts/'],
    onFailHint: [
      '',
      '  💡 ops 邮件出现了绕过品牌模板层的形态 —— 用户会收到无样式的纯文本邮件,',
      '     而 typecheck/lint 全都不会红(与守门 72/78 同族)。',
      '     修复的唯一正确姿势:发信一律经品牌层 —— PowerShell/CI/脚本改调',
      '     `apps/api/scripts/notify-deploy-failure.ts`(版式由 email-templates.ts 单点决定);',
      '     新增版式在 apps/api/src/services/email-templates.ts 加 render* 函数。',
      '     确属有意的纯文本:命中行或紧邻上行加 `brand-mail-exempt: <原因>`;',
      '     存量红进 scripts/brand-email-channel-baseline.json(只减不增,禁止调高)。',
      '     单独复验:node scripts/check-brand-email-channel.mjs --staged',
      '     自检:node scripts/check-brand-email-channel.mjs --self-test(61 例)',
      '     紧急跳过(不推荐):HUSKY_SKIP_BRAND_MAIL_GUARD=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 2026-09-24 补装三枚"造好没装车"的守门(第 3 次同型事故) ---
  // 成因:守门脚本写好了、AGENTS.md 也写了"接入 pre-commit",但五处权威接线点
  // (guardian-runner / scripts/lib/pre-commit-hook.js / .husky/* / package.json / CI)
  // 全部零命中 ⇒ 门禁形同虚设。此前已实证守门 64、70 同型,本轮实测又抓到这三枚。
  // 装门前逐枚实测真仓全量 exit 0,故 blocking 不会误伤任何在途提交。
  {
    id: '85',
    label: '🧪 测试目录被 .gitignore 静默吞掉对账(blocking,AGENTS §23 配套,补装)',
    script: 'check-test-paths.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_TEST_PATHS_GUARD',
    // 只在其扫描域(apps/packages/scripts)被本次提交触及时才跑:纯文档/部署提交不背这 0.3s,
    // 也不会被他人工作区里的半截测试目录误伤。
    stagedTriggers: ['apps/', 'packages/', 'scripts/'],
    onFailHint: [
      '',
      '  💡 `__tests__/` 被 .gitignore 吞掉了 —— `git status` 完全不显示,写了测试也不会入库。',
      '     修复(二选一):',
      '       ① 推荐:目录改名 tests/(避开 .gitignore 的 `__*` 规则);',
      '       ② 或目录内放 .gitkeep,并确认反忽略两条都到位(`!__tests__/` 放开目录 +',
      '          `!**/__tests__/**` 放开内容 —— 只写后者是无效反忽略,git add 实测仍报 ignored)。',
      '     单独复验:node scripts/check-test-paths.mjs',
      '     自检:node --test scripts/tests/check-test-paths.test.mjs(16 例,含反忽略双向对照)',
      '     紧急跳过(不推荐):HUSKY_SKIP_TEST_PATHS_GUARD=1 git commit ...',
      '',
    ].join('\n'),
  },
  {
    id: '86',
    label: '🗂  verify-*.mjs 临时验证文件落点(warn,AGENTS §25 配套,补装)',
    script: 'check-verify-tmp-files.mjs',
    args: [],
    mode: 'warn',
    // 该脚本自身默认 warn-only(有警告也 exit 0),--strict 才阻断 ⇒ 放 CI 用 --strict。
    // 这里保持 warn:§25 的原意是"提示层",升 blocking 会拦掉合法的 scripts/e2e-* 长期脚本。
  },
  {
    id: '87',
    label: '🈳 语言包文件存在性与合法性对账(blocking,40 项清单,补装)',
    script: 'check-i18n-messages-exist.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_I18N_MESSAGES_EXIST',
    onFailHint: [
      '',
      '  💡 某个语言包 JSON 缺失 / 解析失败 / 是空对象 / 端内 loader 产物不合法。',
      '     这一类不会让 typecheck 变红(它不看 JSON),但线上表现是**整页取词回显键名**。',
      '     修复:node scripts/i18n-diff.mjs --target=<端> → 翻译 → node scripts/i18n-apply.mjs --target=<端>;',
      '     判不了就 exit 2(根目录注入失效/清单为空),绝不静默报绿。',
      '     单独复验:node scripts/check-i18n-messages-exist.mjs',
      '     自检:node --test scripts/tests/check-i18n-messages-exist.test.mjs(16 例)',
      '     紧急跳过(不推荐):HUSKY_SKIP_I18N_MESSAGES_EXIST=1 git commit ...',
      '',
    ].join('\n'),
  },

  {
    id: '88',
    label: '🧩 ui-react 组件复用对账(blocking,端内自实现 Dialog/Card/Form 提示,补装)',
    script: 'check-ui-react-usage.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_UI_REACT_USAGE',
    // 只在触及有界面组件的端时跑;FAIL=用 @ihui/ui-react 已有能力的场景另起炉灶(阻塞),
    // WARN(独立实现可能有合理场景)不计失败 —— 装门前实测真仓 exit 0(FAIL 0 / WARN 2)。
    stagedTriggers: ['apps/web/src/', 'apps/extension/', 'apps/desktop/src/'],
    onFailHint: [
      '',
      '  💡 端内重新实现了 @ihui/ui-react 已提供的 Dialog/Card/Form 等组件(AGENTS §3 共享层优先)。',
      '     修复:改用 `@ihui/ui-react` 的对应组件;确属平台特有则在报告里说明并走 ',
      '     HUSKY_SKIP_UI_REACT_USAGE=1(需在 commit message 写清理由)。',
      '     单独复验:node scripts/check-ui-react-usage.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_UI_REACT_USAGE=1 git commit ...',
      '',
    ].join('\n'),
  },
  {
    // 本门专治"造好没装车"(守门 64/70/85/86/87 同型事故已四次),故它自己**更**不能漏接线。
    // 它一律按 HEAD 判 ⇒ 新建的守门脚本在**提交之前**对它不可见(设计如此),所以本票的
    // 端到端证明只能在提交后跑一次(见 O36 ③)。
    id: '89',
    label: '🔌 守门接线层对账(blocking,R1/R2 撒谎 · R4 文档隐形 · R5 撞号 · R7 假依据)',
    script: 'check-gate-wiring.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_GATE_WIRING',
    onFailHint: [
      '',
      '  💡 某枚守门的头部(或 AGENTS.md)写着"集成位置/pre-commit/pre-push/必跑",',
      '     但五处权威接线点(guardian-runner 的 script: ∪ scripts/lib/pre-commit-hook.js ∪',
      '     .husky/* ∪ package.json ∪ .github/workflows)全部零命中 ⇒ 这道门形同虚设。',
      '     正解二选一:① 真接线(实测真仓绿才可上 blocking);② 把那句表述改成如实的',
      '     "未接线 + 原因 + 解阻判据"。**禁止为消红往台账塞条目** —— 台账只能救',
      '     "结构上不该由这五处承载"的(生成器/被分发器派生/纯 CLI 工具)。',
      '     R4 文档隐形(2026-09-24 起判红,前置=真仓缺口 48→0 已清零):门已接线但 AGENTS.md',
      '     与 README.md 通篇没点名 ⇒ 后人看不见它,要么重复造一道、要么绕过它。',
      '     文档面口径 = **HEAD ∪ 索引**(不是工作区、也不只 HEAD):所以"同一枚提交里既注册',
      '     新门又补点名行"不会被自己判红,而只躺在工作区没 add 的文档行也不算点名。',
      '     R5 撞号:同一 id 在 runner 里登记了两道门 ⇒ 串 skipEnv 与失败归属,后来者改号。',
      '     ⚠️ 核查接线点时不要只看 .husky/pre-commit:它自 2026-09-22 起只是薄壳,',
      '        真实 pre-commit 逻辑在 scripts/lib/pre-commit-hook.js(只查薄壳会得出相反结论)。',
      '     单独复验:node scripts/check-gate-wiring.mjs',
      "     自检:node scripts/check-gate-wiring.mjs --self-test(例数以末行「自检 N 例」为准,不写死防漂移)",
      '           + node --test scripts/tests/check-gate-wiring.test.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_GATE_WIRING=1 git commit ...',
      '',
    ].join('\n'),
  },

  // C 盘污染实地扫描(2026-09-23 立,守门 90,warn-only)。成因:§15/§26 的三道旧门没有
  // 一道真去看文件系统 —— check-c-drive-paths 只扫 staged 源码里的字面量 C:\temp,看不见
  // os.tmpdir() 派生的写入;check-parent-pollution 只扫项目父目录(D:\);check-root-dir-clean
  // 只扫项目根。于是 C 盘实攒 13.2G .next 构建备份 + 单日 45 个 git 夹具而全链恒绿。
  // 本门实地扫 C 盘根 + C:\tmp + 活 TEMP,并单独判"TEMP 漂移"(注册表已指 D、活进程仍拿 C,
  // 即残骸天天新增的机制)。只读、不删文件;定级 warn 而非 blocking,因为盘根多数条目
  // 不属本仓,拦提交只会逼人 --no-verify 连带废掉其余守门(与守门 77/52 同取向)。
  {
    id: '92',
    label: '💽 C 盘污染实地扫描(warn,拦"源码没写死但东西真掉在 C 盘")',
    script: 'check-c-drive-pollution.mjs',
    args: [],
    mode: 'warn',
    skipEnv: 'HUSKY_SKIP_C_DRIVE_POLLUTION',
    onFailHint: [
      '',
      '  💡 列出的都是**本项目产物**落在 C 盘。名字不认识的条目只登记、不定性,',
      '     不要顺手删 —— 先验明身份再决定(清理类任务的铁律)。',
      '     看清单:node scripts/check-c-drive-pollution.mjs',
      '     若报"TEMP 漂移":注册表 TEMP 已指 D 而活进程仍拿 C,新建终端/重启宿主后自愈;',
      '     在此之前,任何走 os.tmpdir() 的脚本都会继续往 C 盘堆夹具。',
      '     紧急跳过(不推荐):HUSKY_SKIP_C_DRIVE_POLLUTION=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 90 (2026-09-24 装车,PROJECT_PLAN D107 ① 配套) ---
  // 本门 2026-09-23 就写好了,但**从未进入提交链**(守门 89 的 R3 名单里一直有点它),
  // 即"造好没装车"的第五次同型。装车同时校准台账:HEAD 实测四端已注册 onSteer,
  // 而台账仍按 D106 早先的 WONTFIX 判定挂着 `no-steer-ui` ⇒ 判据③(唯一真源)红四条,
  // baseline 也落后一格 —— 这正是它不上车道时没人能看见的漂移。
  // 取材基准一律 HEAD(含帧清单的 client.ts),否则并发会话未提交的新帧会让五端同时判红。
  // 2026-09-23 深夜说明:本条曾被提交 5db08f26e 整文件覆盖(该会话的新门最初也登记 90,
  // 撞号后其已改 91)。此处按 ce261e1a8 原文回插,勿再改写。
  {
    id: '90',
    label: '📡 SSE 帧端内 dispatch 注册层对账(blocking,补守门 63 覆盖不到的第 3 层)',
    script: 'check-sse-dispatch-parity.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: [
      'packages/api-client/src/client.ts',
      'scripts/data/sse-dispatch-coverage.json',
      'scripts/check-sse-dispatch-parity.mjs',
      'apps/web/src/',
      'apps/extension/',
      'apps/miniapp-taro/src/',
      'apps/mobile-rn/',
      'apps/cli/',
    ],
    skipEnv: 'HUSKY_SKIP_SSE_DISPATCH_PARITY',
    onFailHint: [
      '',
      '  💡 帧被解析出来 ≠ 端内有人接:各端 streamChat 的回调表里没有这个 case,界面上就是"没这个功能"。',
      '     看补接工单:node scripts/check-sse-dispatch-parity.mjs --report',
      '     补接一帧后:删 scripts/data/sse-dispatch-coverage.json 里对应的 missing[端][帧] 条目,',
      '                并把 baseline[端] 上调到新实测值(降回去就是在倒退)。',
      '     该端确实无处渲染:必须在 missing 里写明**为什么**(空理由同样拦;',
      '                已接却还挂着条目同样拦 —— 登记项不得变成墓志铭)。',
      '     自检:node scripts/check-sse-dispatch-parity.mjs --self-test(8 例)',
      '     紧急跳过(不推荐):HUSKY_SKIP_SSE_DISPATCH_PARITY=1 git commit ...',
      '',
    ].join('\n'),
  },

  {
    // D71 错误码覆盖率对账。此前该门自己写明"不注册进 guardian-runner(他人 in-flight)",
    // 2026-09-24 由守门接线对账(门 89)判为 R3 孤儿;实测真仓 exit 0 / 0.4s / 无写盘副作用
    // / 自带 25+ 例 --self-test 反演 ⇒ 属"今天就能接"的那一枚,已接线并同步改掉头部那句。
    // 守的是一整类静默失败:后端新增 errorCode 而界面把它压成同一句"AI 服务异常"。
    // ⚠️ 编号 91 → **92**(2026-09-24 改号):本门最初登记为 91 时,并发会话在同一位置也
    // 加了一道 91(check-c-drive-pollution)—— 同 id 两道 blocking 门会串 skipEnv 与失败归属,
    // 这是本仓第 N 次撞号(先例:75/76 各重复一次、79→80)。改号后由守门 89 的 R5 维度
    // (重复 id 判红)常驻看守,**登记新门前必须先查占用**:`git show HEAD:scripts/guardian-runner.mjs | grep -oE "id: '[0-9]+" | sort -u -V | tail -1`。
    id: '94',
    // 2026-09-24 改号(守门 89 的 R5「重复 id 判红」实测抓到):同一号被并发会话各登记了一次，
    // 同 id 两道 blocking 门会串 skipEnv 与失败归属。按本仓"后来者改号"规矩挪到 94;
    // 引用本门编号时一律以 scripts/guardian-runner.mjs 现值为准，别照抄文档/计划里的历史号。
    label: '🧭 errorCode 覆盖率对账(blocking,零"未知错误"兜底,补装)',
    script: 'check-error-code-coverage.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_ERROR_CODE_COVERAGE',
    // 判据要扫 641 个文件提取显式 errorCode 字面量;仅在触及码面/词表/账本时跑,纯文档提交不背。
    stagedTriggers: [
      'packages/api-client/src/',
      'apps/ai-service/app/',
      'packages/shared/src/chat/error-catalog.ts',
      'packages/i18n/messages/web/zh-CN.json',
      'scripts/check-error-code-coverage.mjs',
      'scripts/data/',
    ],
    onFailHint: [
      '',
      '  💡 有 errorCode 没进 `packages/shared/src/chat/error-catalog.ts`,或八类分类缺项 ⇒',
      '     用户会看到笼统的"AI 服务异常"而不是具体原因(对标 Qoder 的码级标题)。',
      '     修复:在该 catalog 补 `{ code: { category, titleKey, actionKey } }` 一条,',
      '     并补 `packages/i18n/messages/*/`(五语言)对应标题/动作键;分类**复用 D92 的',
      '     ViewFailureKind 15 类主干,禁止另起第二张表**(AGENTS §4/D71 硬约束)。',
      '     单独复验:node scripts/check-error-code-coverage.mjs',
      '     自检:node scripts/check-error-code-coverage.mjs --self-test',
      '     紧急跳过(不推荐):HUSKY_SKIP_ERROR_CODE_COVERAGE=1 git commit ...',
      '',
    ].join('\n'),
  },
  {
    // 溯源水印"语法层"守门(与守门 47 覆盖层互补:47 判载荷能不能解码,本门判写法本身合不合法)。
    // 2026-09-24 修完判据才敢接:旧判据按磁盘全 walk 且把字符串/正则字面量里的零宽当真命中,
    // 真仓 26 条红点里**真存量债 0 条**(22 条落在被 gitignore 的本地产物、4 条自家假阳性)——
    // 那种状态接线就是恒红门。修后真仓全量与 --staged 双口径 exit 0。
    id: '95',
    label: '🔏 水印载荷/横幅行语法对账(blocking,零宽必须被注释包裹)',
    script: 'check-watermark-syntax.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_WATERMARK_SYNTAX',
    onFailHint: [
      '',
      '  💡 不可见载荷(U+200B/200C/200D/2060 等 Cf 类)出现在**非注释位置**，或 XML 声明不在首行。',
      '     修复(唯一正确姿势):node scripts/watermark.mjs clean <文件> && node scripts/watermark.mjs inject <文件>;',
      '     **禁止**用 sed/批量文本改写"修平"零宽字符(§5c:这类操作会静默损坏载荷，历史上坏过 144 文件 218 处)。',
      '     手工写内容里若要出现零宽，必须放在注释行内。',
      '     单独复验:node scripts/check-watermark-syntax.mjs  (或 --staged)',
      '     取证:npm --test scripts/tests/check-watermark-syntax.test.mjs(20 例)',
      '     紧急跳过(不推荐):HUSKY_SKIP_WATERMARK_SYNTAX=1 git commit ...',
      '',
    ].join('\n'),
  },

  // 家目录改道完整性(2026-09-24 立,守门 96,blocking)。§26 把"工具态一律 junction 改道"写了
  // 一年多,但校验方法一直是**给人敲的三条命令** ⇒ 人肉校验等于没有校验:用户质问
  // "C 盘怎么还是被我们占用了"时实测 `AppData\Roaming\npm` 已长成 2.05GB、
  // `AppData\Local\pnpm-cache` 758MB,两处都是实体目录(同期已改道的 .ihui / 桌面端 appdata
  // 仍是 junction ⇒ 机制有效,缺的只是回潮哨兵)。判据三条:登记项存在却不是指针 = REAL-DIR 红;
  // 是指针但目标不可达 = DANGLING 红(§26 记过 robocopy rc=9 会"内容搬走却不建 junction");
  // 登记表被过滤空 = EMPTY-REGISTRY 红(空表即恒绿假门)。非 Windows 如实报"未判定",不计通过。
  // **刻意不收录第三方 IDE 自管态**(.workbuddy 含被 gitdir.mjs 当 git 二进制首选的 PortableGit、
  // .qoder-cn 是本会话宿主的记忆/工作区)—— 否则会把别人的运行态判成我们的债,挪一次丢一次记忆。
  // **2026-09-24 落点改判 warn(用户授权)**:本门判的是**机器态**,与任何 diff 无关 —— 实测
  // `Get-Item -Force` 的 LinkType 为空、无 ReparsePoint,`.codex` 583MB / `.trae-cn` 371MB / `.ihui`
  // / npm 前缀等 11 项确实回潮成实体目录(C 盘实体合计 4990MB)。判据没错,错的是落点:提交者改不动
  // 机器态 ⇒ **每次提交必红** ⇒ 唯一出路是 --no-verify,连带把另外 126 道门一起跳掉(同日实证:
  // 本门红着的那轮守门批量检查以 4/127 红收场,而提交照样落地)。恒红 blocking 门 = 全队关闸。
  // 三条判据一字未削,每次提交仍打红字(不静默);非提交入口:`pnpm check:home-junctions [--json]`。
  // 真做 §26 改道属机器级动作(要先停正在写这些目录的 IDE/CLI;robocopy 非零返回码会"内容搬走却
  // 不建 junction"→ 路径消失),由人放到部署窗口做,不由提交链逼出来。
  {
    id: '96',
    label: '🏠 §26 家目录改道完整性(warn,机器态与 diff 无关 ⇒ 不拦提交链,回潮即打红字)',
    script: 'check-home-junctions.mjs',
    args: [],
    mode: 'warn',
    skipEnv: 'HUSKY_SKIP_HOME_JUNCTIONS',
    onFailHint: [
      '',
      '  💡 登记项又变回**实体目录**(或 junction 目标丢了),意味着工具链正在往 C 盘写。',
      '     一律按 §26 的 junction 机制收口,不得改 Path/env 硬指(那会造"双根分裂"):',
      '       robocopy <src> <D 盘目标> /E  →  逐文件(相对路径+字节)校验  →  源改名',
      '       →  mklink /J <src> <D 盘目标>  →  经 junction 回读一致  →  才删源',
      '     ⚠ robocopy 非零返回码时内容已搬走但**不会**建 junction,路径直接消失 —— 必须回读再补建。',
      '     单独复验:node scripts/check-home-junctions.mjs --json',
      '     自检:node scripts/check-home-junctions.mjs --self-test(6 例,含悬空 junction 反例)',
      '     本门已改 warn(不拦提交),此变量现在的实际作用只剩"连红字警告一起关掉"——',
      '     关掉之后回潮就真的没人看见了,除非有明确理由,否则不要设。',
      '',
    ].join('\n'),
  },

  // 顶部状态栏避让单一源头(2026-09-24 立,真机走查 P0 收口)。
  // 真机实测 inset = 34dp(Redmi 720x1640/density 320),而 399 个 *Screen.tsx 里真读 inset 的只有 3 个:
  // 83 处在页头/根容器写死 `paddingTop: 48` 硬蒙量级、113 处完全没有顶距 ⇒ 页头与系统时钟叠字。
  // 单点在 apps/mobile-rn/App.tsx 的 <SafeAreaView edges={['top']}>;本门 S1 就是防它被人摘掉。
  {
    id: '97',
    label: '📱 顶部状态栏避让单一源头对账(blocking,顶距只有一个注入点)',
    script: 'check-statusbar-single-source.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_STATUSBAR_SINGLE_SOURCE',
    stagedTriggers: ['apps/mobile-rn/**', 'packages/app/**'],
    onFailHint: [
      '',
      '  💡 三类红,改法各一条:',
      '     ① S1 单点被摘 —— 顶距唯一源是 `apps/mobile-rn/App.tsx` 的 <SafeAreaView edges={[\'top\']}>;',
      '        它没了就是全屏叠字回来(真机实测差 34dp)。恢复该单点,不要逐屏补。',
      '     ② S2 第二取值口 —— `StatusBar.currentHeight` 在 iOS 恒为 undefined(⇒ 0)见即红;',
      '        `statusBarHeight` 只拦"布局取值"(paddingTop/top/marginTop/= …),共享层"调用方注入、默认 0"的声明不判红。',
      '     ③ S3 魔法顶距 —— 页头/根容器上 `paddingTop: 24..60` 的字面量就是在蒙状态栏高度;',
      '        删掉它,顶距由单点负责;确属设计需要的顶距请写 `statusbar-exempt: <一句话原因>`(逐行生效,必须带原因)。',
      '     泄压阀 M1:含 JSX <Modal 的文件渲染在导航树外、不继承单点,其顶距命中只报数不判红(--all 逐条列出);',
      '        注释里提 <Modal 不配豁免。',
      '     单独复验:node scripts/check-statusbar-single-source.mjs',
      '     自检:node scripts/check-statusbar-single-source.mjs --self-test(40 例,含 Modal 豁免与逐行豁免阳性对照)',
      '     紧急跳过(不推荐):HUSKY_SKIP_STATUSBAR_SINGLE_SOURCE=1 git commit ...',
      '',
    ].join('\n'),
  },

  //  与守门 77 B6 是同一类事故的两个方向:77 管"用了标识符却没 import",本门管
  //  "import 了目标根本不导出的名字"。两者都只在编译期可见,而 tsc 只跑共享工作区 ——
  //  工作区恰好是旧基线时两边都不红(2026-09-24 一天内各中一次:rnRadius 启动即崩 /
  //  PermissionTierRow 从未在任何提交里存在过)。
  {
    id: '98',
    label: '🧩 HEAD 悬空具名导入对账(blocking,import 的名字目标必须真导出)',
    script: 'check-dangling-local-imports.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_DANGLING_IMPORTS',
    stagedTriggers: ['apps/**/*.ts', 'apps/**/*.tsx', 'packages/**/*.ts', 'packages/**/*.tsx', 'scripts/**/*.mjs'],
    onFailHint: [
      '',
      '  💡 两类红,改法不同:',
      '     ① D1 具名导入在目标文件里不存在 —— 要么补上那个导出(优先,别删消费者:',
      '        删导入等于把别人正在接的功能摘掉),要么改从真正提供它的模块取。',
      '     ② D2 相对路径解析不到 —— 路径改名/文件被删/大小写不符;目录只能经 `目录/index.*`。',
      '     口径:棘轮锚点 = 该文件 HEAD 自身违规数(存量如实报数不拦),所以本门只拦',
      '        "这次把悬空导入加回来了",不替历史债背红。',
      '     单独复验:node scripts/check-dangling-local-imports.mjs --files <你的文件>',
      '     自检:node scripts/check-dangling-local-imports.mjs --self-test(19 例,含真仓 HEAD 实测)',
      '     紧急跳过(不推荐):HUSKY_SKIP_DANGLING_IMPORTS=1 git commit ...',
      '',
    ].join('\n'),
  },

  // 暂存删除的存续性对账(2026-09-24 立,Agent A 交付)。守门 65 只看删除规模(≥1000/≥20%),
  // 十几条精准打击全放过;heal-worktree-tracked 对暂存删除按设计"只报数、不代裁"。本门补的正是
  // 这个空档:删除规模不大、但仓库(索引 blob)仍在引用它 —— 任何人跑一次不带 pathspec 的普通
  // commit 就把已入库功能与测试从版本树里删掉。判据 E1(引用仍在)∧ E2(索引里无替代路径)
  // 同时成立才判红;引用方自己一起删 = 正当删除的形态,放行。不加 stagedTriggers —— 暂存删除
  // 可触及任意路径,任何提交都不得跳过。
  {
    id: '99',
    label: '🗑️ 暂存删除存续性对账(blocking,被删文件必须无人引用且无替代路径)',
    script: 'check-staged-deletions.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_STAGED_DELETIONS',
    onFailHint: [
      '',
      '  💡 先分清成因,再决定动作(本门只读,不代恢复):',
      '     ① 宿主清理层成批删的? 逐路径找回:`git checkout HEAD -- <path>`(禁止全局 reset --hard)。',
      '     ② 确属有意删除? 把引用方(barrel/import)一并改掉,或登记进 scripts/staged-deletions-allowlist.json(必须写 reason)。',
      '     口径:一律判索引 blob,不判滞后的共享工作树;E1∧E2 只成立一条时仅报数不判红。',
      '     单独复验:node scripts/check-staged-deletions.mjs',
      '     自检:node scripts/check-staged-deletions.mjs --self-test(33 例,正反成对)',
      '     镜像测试:node --test scripts/tests/check-staged-deletions.test.mjs(12 例,含装车证明)',
      '     紧急跳过(不推荐):HUSKY_SKIP_STAGED_DELETIONS=1 git commit ...',
      '',
    ].join('\n'),
  },

  {
    id: '100',
    label: '🧬 合并新增文件存续性对账(blocking,合并不得吞掉任一父提交的独有新增)',
    script: 'check-merge-addition-loss.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_MERGE_ADDITION_LOSS',
    onFailHint: [
      '',
      '  💡 这一型不产生冲突、不进 diff 报告,只能靠对账(2026-09-24 实测一枚"按 union 归并"的合并',
      '     吞掉 35 个路径 + 72 个文件回退成旧基线,而其提交信息写着"双方每一行均存活"):',
      '     ① 补回:`git checkout <引入它的提交> -- <path>`,或改用真正的三路合并后重做该合并提交。',
      '     ② 确要删:在合并**之后**单独 `git rm` 并写明理由(那时所有父提交都不含它,本判据放过)。',
      '     口径:默认只判"未进入 origin/main 的合并"——已入库的历史事故不得把后来每次提交钉红',
      '            (那只会逼人紧急跳过,连带废掉全部守门);回看历史用 --limit N 手工取证。',
      '     单独复验:node scripts/check-merge-addition-loss.mjs --rev <合并提交 sha>',
      '     自检:node scripts/check-merge-addition-loss.mjs --self-test(9 例,真临时仓)',
      '     镜像测试:node --test scripts/tests/check-merge-addition-loss.test.mjs(含装车证明)',
      '     紧急跳过(不推荐):HUSKY_SKIP_MERGE_ADDITION_LOSS=1 git commit ...',
      '',
    ].join('\n'),
  },
  {
    // 不设 stagedTriggers:前缀语义表达不出"任意 */package.json",而漏挂等于没有这道门
    // (守门 81 的教训:判据存在而永不调用 = 没有)。实测 --staged 282ms / 全量 342ms,每轮都跑得起。
    id: '101',
    label: '🔐 清单↔锁 specifier 对账(blocking,拦"本地全绿、生产构建必炸"的依赖真值)',
    script: 'check-lock-manifest-consistency.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_LOCK_MANIFEST_GUARD',
    onFailHint: [
      '',
      '  💡 package.json 声明与 pnpm-lock.yaml 的 importer specifier 不一致时,pnpm 是',
      '     **整段跳过该包的链接步骤**(不报错、不改锁),本地 node_modules 早就装好 ⇒ typecheck/',
      '     lint/单测/其余守门全绿,直到 bundler 报 Module not found 把生产构建打死。',
      '     立因实例(2026-09-24):apps/web 写 "xlsx": "^0.18.5" 而锁记 npm:@e965/xlsx@^0.20.3,',
      '     表现是"97 个声明依赖精确缺 3 条",`pnpm install` 与 `pnpm install --force` 都只回',
      '     "Already up to date" —— 修它的路径不存在,必须把两边对齐。',
      '     改法(二选一,不得两边都改):① 清单向锁对齐(改 package.json 取锁里的值,不动 lock);',
      '     ② 锁向清单对齐(全量 `pnpm install` 重算 lock —— 禁 --filter,见 §12e)。',
      '     口径:--staged 判索引 blob、全量判 HEAD blob(与 70/77/83/98/99 同取向)——',
      '            盘上随后改对不算修好,提交进去的仍是索引那一份;人工排查用 --worktree。',
      '     豁免不静默:因 overrides 放过 N 条、因 peer 记账形态放过 M 条都会如实打印。',
      '     单独复验:node scripts/check-lock-manifest-consistency.mjs --staged',
      '     自检:node scripts/check-lock-manifest-consistency.mjs --self-test(34 例,含三面判定端到端)',
      '     镜像测试:node --test scripts/tests/check-lock-manifest-consistency.test.mjs(24 例,含装车证明)',
      '     紧急跳过(不推荐):HUSKY_SKIP_LOCK_MANIFEST_GUARD=1 git commit ...',
      '',
    ].join('\n'),
  },

  //  起因是用户实拍"查看更多按钮图标跟文字错位"。根因不是间距而是**载体选错**:
  //  箭头被当成文字写(字符 › / >),且字号比自己的标签还大 —— 字形相对自身行盒中心的
  //  偏移只由字体度量决定(与 line-height、与字号无关),中文偏上、该字符偏下,两者相加
  //  故实测错位 2.0~2.5px。三端已收口到唯一矢量实现,但没有任何机器检查阻止第四份写法
  //  或新页面把字符箭头加回来,故立此门(判据必须覆盖门自己产出的形态:三端唯一入口由 S0 守住)。
  {
    id: '102',
    label: '🧷 文本箭头当图标 / 箭头字号倒挂对账(blocking,入口箭头必须是矢量且不小于标签)',
    script: 'check-glyph-arrow-icon.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_GLYPH_ARROW_ICON',
    stagedTriggers: ['apps/**/*.tsx', 'apps/**/*.ts', 'packages/app/**/*.tsx', 'packages/**/*.ts'],
    onFailHint: [
      '',
      '  💡 三类红,改法各一条:',
      '     ① GA1 整格字符箭头(› » → 》 或 {\'>\'})当 chevron 图标 —— 换矢量:RN/共享包用 MoreLink',
      '        (lucide-react-native ChevronRight)、web 用 ViewMoreLink、小程序用 LineIcon',
      '        name="chevron-right"(icons.ts 已含,零新素材)。',
      '     ② GA2 「更多」类标签与同词干 *Arrow* 样式配对后**箭头字号 > 标签字号** —— 两者必须同一',
      '        光学尺寸(RN/web 12px、小程序 24rpx);单位不同不判红,只如实计入 undetermined。',
      '     ③ S0 三端唯一实现被摘线或无人 import —— 补回引用,别把共享实现删了留端内自拼。',
      '     口径:全量判 HEAD blob、--staged 判索引;棘轮锚点 = 该文件 HEAD 自身违规数',
      '            (行尾字符箭头存量 70 处只报数不拦,免得逼人 --no-verify 连带废掉全部门)。',
      '     行内豁免:glyph-arrow-exempt: <一句话原因>(须带原因,逐行生效)。',
      '     单独复验:node scripts/check-glyph-arrow-icon.mjs --staged',
      '     自检:node scripts/check-glyph-arrow-icon.mjs --self-test(45 例,含阳性对照与棘轮四向)',
      '     镜像测试:node --test scripts/tests/check-glyph-arrow-icon.test.mjs(13 例,含装车证明)',
      '     紧急跳过(不推荐):HUSKY_SKIP_GLYPH_ARROW_ICON=1 git commit ...',
      '',
    ].join('\n'),
  },

  //  架构契约门(2026-09-24 立):与其余门相反的方向 —— 其余门是"发现一类违规 → 写一条判据",
  //  本门读 config/architecture-policy.yaml 这张**声明表**,从声明反查违规(模块清单/依赖方向/
  //  公开入口/层序 + 体积上限)。存量模块一律 managed:false ⇒ 只报数不判红,收口才翻 true;
  //  全仓即时判红的只有 C1(单文件行上限,阈值 6000 高于 HEAD 实测最大值 5258)与 T1(表与现实脱节)。
  //  id 说明:任务书指定的 102 在本门落地前被并行会话占用(check-glyph-arrow-icon),故按"后来者改号"
  //  规矩顺延取 103 —— 注册前已 `grep -n "id: '10[0-9]'"` 逐个复测,103 出现 0 次。
  {
    id: '103',
    label: '🏛️ 架构契约对账(blocking,从 config/architecture-policy.yaml 的声明反查违规)',
    script: 'check-architecture-policy.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_ARCH_POLICY',
    onFailHint: [
      '',
      '  💡 本门不新增"风格洁癖",它只问一句:代码里真实存在的 import,和策略表声明的',
      '     模块契约是不是同一件事。四类红各自对应一个会在生产上炸的形态:',
      '     T1 表与现实脱节 —— 模块改名/目录搬走而 config/architecture-policy.yaml 没跟上;',
      '        表一过期,所有依赖它的判断都在对着空气打分(本仓"清单腐烂"同一类)。',
      '     C1 单文件行上限 —— 阈值取 6000,高于 HEAD 实测最大文件 5258 行,所以它只会咬',
      '        "再写一个巨型文件"这件事,不会把既有存量变成人人绕过的红。',
      '     D1/D2 依赖方向 —— 包 import 端、或 requires 里没声明就 import:',
      '        今天不红是因为该模块 managed:false(只报数);翻 true 前先用',
      '        `--managed-trial <id>` 看条数,别拿提交去试。',
      '     D3 深导入 —— 绕过 public_entrypoints 直接摸别的包/src/内部:',
      '        它让"改一个内部文件"变成跨端事故,是端内重复实现的入口。',
      '     渐进收口是设计前提,**不得为了消红去改阈值或把不该对外的模块标成 exported**;',
      '     要放行就地加 `// arch-exempt: <原因>`(必须带原因,缺原因只计数不放行)。',
      '     口径:--staged 判索引 blob、全量判 HEAD blob;策略表自身也**按档定向取材**',
      '            (--staged 索引优先、全量 HEAD 优先,再降级到工作树并大声提示)—— 否则改表的提交不被本门审。',
      '     单独复验:node scripts/check-architecture-policy.mjs --staged',
      '     自检:node scripts/check-architecture-policy.mjs --self-test(51 例,成对正反例)',
      '     镜像测试:node --test scripts/tests/check-architecture-policy.test.mjs(含装车证明)',
      '     紧急跳过(不推荐):HUSKY_SKIP_ARCH_POLICY=1 git commit ...',
      '',
    ].join('\n'),
  },

  // prod-bundle 影子副本对账 —— 门 2026-09-24 就立了,但唯一挂点是根 package.json 的 check:all,
  // 从未进提交链(实测 `grep -c check-prod-bundle-shadow guardian-runner.mjs` = 0)。这正是本仓
  // 最高频的那一型:"造好没装车" —— 判据正确、跑得通,而没有任何调度器跑它,于是漂移永远静默。
  // 接进来时必须按「机器态 vs 内容态」分流,而不是简单二选 blocking/warn:
  //   deploy/prod-bundle/ 整目录被 .gitignore 忽略 ⇒ 运行副本**只存在于部署机上**。若按现状把
  //   "对账对象不在"判红,别的机器 / 干净 clone / CI 上每一次提交都会被拦,而恒红门的唯一结局是
  //   逼人 --no-verify,连带把全部 130+ 道守门一起作废(AGENTS §4 / §12e / 守门 77·78 同型)。
  //   所以:运行副本缺失 ⇒ 未判定 + exit 0(输出里必须喊出来,不许静默绿);
  //         入库源缺失 / 摘线 / 登记过期 / 逐字节漂移 ⇒ blocking 判红并点名(内容态,在哪台机都该红)。
  // 刻意**不挂 stagedTriggers**:会漂移的那一侧是被忽略的运行副本,它在结构上永远不会出现在暂存区,
  //   按 staged 收窄等于把本门立门的那一型(生产侧被单独改过)整个放过。runner 统一追加的
  //   --staged 本门不解释 ⇒ 恒全量判定(实测单次 ~0.4s,每轮跑得起)。
  // id 取号:注册前 `grep -oE "^    id: '[^']*'" | sort | uniq -d` 零输出(无重复号),
  //   纯数字最大 103 ⇒ 本门顺延取 104,并由镜像测试钉"104 在 runner 中恰好出现一次"。
  {
    id: '104',
    label: '🧬 prod-bundle 影子副本对账(blocking,入库源 ↔ 生产实际执行的那份逐字节等值)',
    script: 'check-prod-bundle-shadow.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_PROD_BUNDLE_SHADOW',
    onFailHint: [
      '',
      '  💡 本门钉的是"生产到底在跑哪份代码":deploy/prod-bundle/ 整目录被 .gitignore 忽略,',
      '     里面的运维脚本可以完全没有入库源(对跟踪文件做的 grep 对它零覆盖)。AGENTS §5e 早就',
      '     写了"落进 prod-bundle 的脚本必须同时落一份入库源",本门是那句话说的那把尺子。',
      '     四类红,各自对应一种会静默失真的形态:',
      '     S0 入库源不存在 —— 登记表里有配对、仓内却没有源 ⇒ 对账无从成立(这一侧在所有机器上',
      '        都该在,所以它不是"未判定",是真缺陷)。',
      '     S1 入库源未被跟踪 —— 源写了但没入库,等于仍只有运行副本那一份真相。',
      '     S2 运行副本竟在版本树里 —— 登记表过期,删掉这条登记即可(它已不需要本门)。',
      '     S3 影子漂移 —— 两侧 sha1 不等 ⇒ 线上行为与仓内代码无关,这是最贵的一类。',
      '     未判定(运行副本不在本机)不判红,但会在输出里点名:那是非部署机 / CI / 干净检出,',
      '     提交者结构上无法满足它;拿它判红等于造一台恒红的尺子。',
      '     同步方向:生产执行的是被忽略的那一份,改任何一侧都要把另一侧改成逐字节相同。',
      '     单独复验:node scripts/check-prod-bundle-shadow.mjs',
      '     自检:node scripts/check-prod-bundle-shadow.mjs --self-test(连跑两次都须 exit 0)',
      '     镜像测试:node --test scripts/tests/check-prod-bundle-shadow.test.mjs(含装车证明)',
      '     紧急跳过(不推荐):HUSKY_SKIP_PROD_BUNDLE_SHADOW=1 git commit ...',
      '',
    ].join('\n'),
  },

  {
    id: '105',
    // 定级史(升档已完成 —— 别把它再读成"永久 warn"):
    //  · 立项时 warn 是**有意**的:全量面当时就红 —— 8 处 G1/R1「源里有而产物面上查无」(qzdy/szdy/sqb/
    //    qqb/default-avatar/erweima/… 这批图在「图片全外置 CDN」那轮被清走而引用还留着)+ 9 处孤儿默认只
    //    报数。挂 blocking 等于每一次提交都红 ⇒ 逼人 --no-verify ⇒ 全部守门作废(本仓记过最多次的反面
    //    教训)。当时写下的前置条件:**G1/R1 存量清零**(或改成以"该文件 HEAD 自身违规数"为锚点的棘轮)。
    //  · 2026-09-25 前置实测达成 ⇒ 升 blocking:全量面 `未发现漏生成`、exit 0;R2 孤儿与 G3 图标按设计
    //    **不是** blocking 判据(默认只报数,--strict 才判红),所以升档不新增任何恒红面。
    //  · 升档的直接起因是本会话自己踩的坑:改了 i18n 键名却没重生成离线包,门判出 4 处 B2 —— 但因为它只是
    //    warn,提交链没有拦住,于是静默上线了一版"小程序取不到这个词"的产物。**warn 的代价不是"少一道闸",
    //    而是"门判对了也没人被打断"**。
    //  · 修法单命令、不需要人工裁:pnpm --filter @ihui/miniapp-taro gen:i18n(应急跳过
    //    HUSKY_SKIP_MINIAPP_GENERATED=1)。取不到判据输入仍是 exit 2「无法判定」,不冒红也不记绿。
    label:
      '🧩 小程序派生产物对账(blocking;离线语言包/图标/位图是否落后于源;孤儿与动态路径只报数不判红)',
    script: 'check-miniapp-generated.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_MINIAPP_GENERATED',
    onFailHint: [
      '',
      '  💡 判据四组:',
      '     R1 漏生成/引用断链 —— 源码引用的产物文件面上查无 ⇒ 报出引用方;',
      '     R2 孤儿/死资源 —— 产物目录里没有任何静态引用(默认只报数,--strict 判红;删文件属 §7 须人工确认);',
      '     G3 图标词表与 svg 目录的对账(图标源已外置,77/78 键无同名 svg 是**既有事实**,本条永不判红);',
      '     动态拼接的资源路径一律计入「判不了但如实数」,绝不静默当零违规。',
      '',
      '     重新生成:node apps/miniapp-taro/scripts/gen-line-icons.mjs / gen-tabbar-icons.mjs',
      '                node scripts/gen-taro-lucide-icons.mjs <name>;离线语言包 pnpm --filter @ihui/miniapp-taro gen:i18n',
      '     自检:node scripts/check-miniapp-generated.mjs --self-test(11 例含成对正反)',
      '     定位:node scripts/check-miniapp-generated.mjs --group tabbar|icons|i18n|assets 单组排查',
      '',
    ].join('\n'),
  },

  {
    id: '106',
    // extension 的 content script 把 UI 注进第三方页面,拿不到宿主的 CSS 变量,只能自带色值字面量。
    // 这类副本过去不在任何对账面内(改 tokens.css 扩展不会跟着变,也不会红),现在按 RN 同法收成派生面:
    // 可派生键逐位等值;不等值的必须落在两张登记表里(源头无此档 / 同名档语义分歧并写明依据),
    // 登记表腐烂(登了但档没了、分歧已消失、值被改却没更新登记)同样判红。
    // 写回出口就在提交链里(pre-commit-hook 的 TOKEN_SYNC_TARGETS),所以本门不会把人堵在门外。
    label: '🧩 extension 注入层色值同源(blocking,可派生档逐位等值 + 分歧必须登记且不得腐烂)',
    script: 'sync-extension-tokens.mjs',
    args: ['--check', '--staged'],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_EXTENSION_TOKENS',
    onFailHint: [
      '',
      '  💡 三条判据:',
      '     D1 可派生档必须与 tokens.css 逐位等值(含 hsl/rgb/hex 归一,复用门 93 的 colorsAgree);',
      '     D2 不等值者必须已被 EXTENSION_ONLY_KEYS(源头无此档)或 DECLARED_DIVERGENCE(同名档不同语义',
      '        且写明依据)登记;两者都没有 ⇒ 红;',
      '     D3 反向腐烂:登记了却已不存在、登记的分歧其实已相等、值被改而登记没跟着改 ⇒ 都红。',
      '',
      '     修复(不要手改副本):node scripts/sync-extension-tokens.mjs   原位写回派生档',
      '     查看台账:node scripts/sync-extension-tokens.mjs --list',
      '     自检:node scripts/sync-extension-tokens.mjs --self-test(36 条含成对正反)',
      '     紧急跳过(不推荐):HUSKY_SKIP_EXTENSION_TOKENS=1 git commit ...',
      '',
    ].join('\n'),
  },

  {
    id: '107',
    label: '🧾 第三方来源台账对账(blocking,嵌入/复制/覆盖三本账 + 机制来源账:roots 必须真实存在、盘上 vendored 件必须有条目、许可原文必须能自证)',
    script: 'provenance-ledger.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_PROVENANCE_LEDGER',
    onFailHint: [
      '',
      '  💡 本门把"哪些内容不是我们写的"变成机器可查的事实,有四类红:',
      '     P1 roots 指向不存在的路径 —— 登记了但实物没了,等于台账在对空气记账。',
      '     P2 盘上有 vendored 目录或第三方归属头,台账里却没有条目 —— 这是"来路不可考"的形状。',
      '     P3 已登记条目的内容 hash 漂移 —— 登过之后又被人改过而没改记录。',
      '     P4 revision 不可考却没有显式 null + 说明 —— "不知道"必须被写成不知道。',
      '     判据取材与全仓主流一致:全量判 HEAD blob、--staged 判索引 blob,取不到判"无法判定"。',
      '     为什么值得挂 blocking:本仓正在"吸收外部机制"的线上跑的正是这条纪律 ——',
      '     台账是把"只吸收机制、未搬运代码"从一句主张变成可审计事实的唯一载体。',
      '     单独复验:node scripts/provenance-ledger.mjs --check',
      '     自检:node scripts/provenance-ledger.mjs --self-test(27 例,连跑两次须同结论)',
      '     镜像测试:node --test scripts/tests/provenance-ledger.test.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_PROVENANCE_LEDGER=1 git commit ...',
      '',
    ].join('\n'),
  },

  {
    id: '108',
    label: '⏳ 豁免到期账(blocking,12 类行内豁免必须带到期日;到期未销账即红,存量进基线只报数)',
    script: 'check-exemption-expiry.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_EXEMPTION_EXPIRY',
    onFailHint: [
      '',
      '  💡 本门钉的是"豁免只有出生、没有死亡":实测全仓 12 族 / 252 处行内豁免,',
      '     带真到期日的是 **0 处**(规格当初量的"1 处带日期"是散文里的引用,不算)。',
      '     三条判据:E1 新增豁免不带到期日 ⇒ 红;E2 到期日已过仍在生效 ⇒ 红;E3 lint 抑制只报数。',
      '     为什么不当场全红:存量 252 处全部进 scripts/exemption-expiry-baseline.json 只报数,',
      '     E1 的锚点是"该文件该族在 HEAD 自身的存量数"(棘轮,照 77/83/98 口径),',
      '     且 grandfatherUntil 之前不追存量 —— 与改动无关的 blocking 红只会逼人 --no-verify,',
      '     连带废掉全部守门(本仓记过最多次的反面教训)。',
      '     出路只有三条,都在红字里点名:持有者续租 / 完成后翻勾销账 / 显式让渡。',
      '     禁止用 HUSKY_SKIP_* 当"收口手段" —— 那正是本门要拦的那件事。',
      '     单独复验:node scripts/check-exemption-expiry.mjs --all(看存量账) / --staged(看本票新增)',
      '     自检:node scripts/check-exemption-expiry.mjs --self-test(36 例含成对正反)',
      '     镜像测试:node --test scripts/tests/check-exemption-expiry.test.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_EXEMPTION_EXPIRY=1 git commit ...',
      '',
    ].join('\n'),
  },

  {
    id: '109',
    label: '🔒 任务认领租约对账(blocking,（进行中）必须带日期与持有者;过期未清账即红,存量裸标记只报数)',
    script: 'check-task-claims.mjs',
    args: ['--check-gate'],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_TASK_CLAIM_LEASE',
    stagedTriggers: ['PROJECT_PLAN.md'],
    onFailHint: [
      '',
      '  💡 本门钉的是"认领是租约,不是文本标记":AGENTS §1 让每个 agent 开工前给任务加',
      '     （进行中）、派单前先扫进行中项 —— 但那个标记过去**没有持有者、没有时间戳、不判年龄**,',
      '     于是可达的失效形态是:agent 死了,标记永久留在 HEAD 里,下一个会话按 §1 扫描',
      '     要么永远看不见那件活,要么把它当"别人正在做"而按住不做(本仓记录里已反复出现)。',
      '     三条判据:CL1 带日期的进行中行年龄 > 阈值(默认 72h) ⇒ 红并点名行号+持有者;',
      '     CL2 写了 @日期 却没写 /持有者 ⇒ 红(半个租约比没有租约更危险,它看起来像被管过);',
      '     CL3 同一行同时出现"进行中"与 [x] ⇒ 红(协议自相矛盾 = 释放失败的现场)。',
      '     **存量向后兼容是第一位**:裸（进行中）与旧的"翻勾未摘牌"行一律只计数不判红,',
      '     否则本门上线当天就是一台恒红门(⇒ 逼人 --no-verify ⇒ 全部守门作废)。',
      '     到期只判红、只点名,**本门绝不自动摘除任何人的认领**(摘别人的认领属越权,AGENTS §16)。',
      '     新格式:`- [ ]（进行中@YYYY-MM-DD/持有者短名）`。出路三条:续租 / 完成翻勾并摘牌 / 显式让渡。',
      '     单独复验:node scripts/check-task-claims.mjs --check-gate(现值须 exit 0)',
      '     自检:node scripts/check-task-claims.mjs --self-test(11 例) + 含全角括号可选性反证',
      '     镜像测试:node --test scripts/tests/check-task-claims.test.mjs(16 例,四对正反 + 存量恒绿不变量)',
      '     紧急跳过(不推荐):HUSKY_SKIP_TASK_CLAIM_LEASE=1 git commit ...',
      '',
    ].join('\n'),
  },

  {
    id: '110',
    label: '📦 产物预算对账(warn,交付出去的产物第一次有上限表:主包口径 / 悬空 sourceMappingURL 引用)',
    script: 'check-artifact-budget.mjs',
    // 必须带 --target:本门刻意「未知/缺 target 即 exit 2、不回落默认档」,空 args 会让它在提交链里
    // 永远跑不起来(实测 G-176)。miniapp 是唯一已校准上限的档;其余档在 CI 里逐档 --target 问责。
    args: ['--target', 'miniapp'],
    mode: 'warn',
    skipEnv: 'HUSKY_SKIP_ARTIFACT_BUDGET',
    onFailHint: [
      '',
      '  💡 本门判的是**磁盘上的构建产物**,与工作树/HEAD 无关 —— 全仓 130+ 道门过去',
      '     没有一道量过我们真正交付出去的东西(AGENTS 末段自己承认:"同源门全部只核源码,',
      '     没有一道看产物")。小程序主包实测已贴到 2,054,797 B / 上限 2,097,152 B,',
      '     余量 42,355 B(97.98%),而这个数此前只人工写在计划文档里,一次无关的 UI 提交',
      '     就能吃掉它而全程绿灯(构建本身 exit 0,炸的是上传微信那一步)。',
      '     为什么挂 warn 而不是 blocking:产物目录在不在本机是**机器状态**,提交者结构上',
      '     满足不了 ⇒ blocking 就是恒红门(§12e 同型)。判红问责放在 CI(build 之后必有产物)。',
      '     缺产物不判红也不静默绿:exit 0 + 逐条打印"未判定:<原因>"并点名重建命令。',
      '     主包口径:分包与独立分包不得计入主包(镜像测试 C5/C5b 用同字节换个目录做正反对照)。',
      '     单独复验:node scripts/check-artifact-budget.mjs --target miniapp',
      '     自检:node scripts/check-artifact-budget.mjs --self-test(32 条断言,连跑两次须同结论)',
      '     镜像测试:node --test scripts/tests/check-artifact-budget.test.mjs(15 例,含"接了提交链就必须同时有 CI 调用点"的防退化断言)',
      '',
    ].join('\n'),
  },
  {
    id: '111',
    label: '🧬 工具契约声明对账(blocking,注册进工具面却没有契约声明即红;棘轮锚点=该文件 HEAD 自身违规数)',
    script: 'check-tool-contract-declared.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_TOOL_CONTRACT_DECLARED',
    stagedTriggers: ['apps/cli/src/tools/'],
    onFailHint: [
      '',
      '  💡 本门钉的是 A13 第一阶段立下的规矩:一次可被模型调用的能力,必须在实现旁边有一份',
      '     **契约声明**(副作用范围 / 权限 / 结果预算),因为下游三个消费面(发给 provider 的',
      '     function parameters、运行时入参校验、批准与预算判定)现在都从**同一份描述**投影而来 ——',
      '     没有声明就不是"少一条元数据",而是那一格重新变成"三个面各写各的",正是本仓 8 道',
      '     "声明↔实现对账"门存在的理由(打地鼠)。**新增工具必须带契约**;存量 104 个走棘轮,',
      '     锚点取该文件在 HEAD 自身的违规数,所以老文件不会被别人欠的债钉红。',
      '     注意**缺省语义这一层本门故意不管**:缺省仍按既有 dangerLevel 走。翻成"缺省即不可信"',
      '     是第二阶段,前置是把 `--flip-audit` 点名的那批工具逐个补档 —— 否则用户侧表现是',
      '     "昨天能跑今天全要批准",那不是收紧安全而是制造事故。',
      '     单独复验:node scripts/check-tool-contract-declared.mjs',
      '     存量与二阶段输入:node scripts/check-tool-contract-declared.mjs --flip-audit',
      '     自检:node scripts/check-tool-contract-declared.mjs --self-test(11 条,连跑两次须同结论)',
      '     镜像测试:node --test scripts/tests/check-tool-contract-declared.test.mjs(9 例)',
      '     紧急跳过(不推荐):HUSKY_SKIP_TOOL_CONTRACT_DECLARED=1 git commit ...',
      '',
    ].join('\n'),
  },

  {
    id: '112',
    label: '📐 压缩分母对账(blocking,阈值分母必须经 effectiveContextWindow;存量 8 文件/12 处进棘轮)',
    script: 'check-compaction-denominator.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_COMPACTION_DENOMINATOR',
    onFailHint: [
      '',
      '  💡 本门钉的是 A30 那条实测缺口:provider 的 context window 是 **input 与 output 共享**的同一个窗口,',
      '     所以"什么时候该压缩"的分母必须**先扣掉本轮要留给输出的预留**,否则阈值算的是"占满整个共享窗口',
      '     的 88%",而同一窗口里模型还要生成回复 —— 故障形态是**越接近上限越容易炸,而现象写成"压缩判过了',
      '     还是 400/context overflow",极难归因到分母**。立门前实测 `grep -rniE "outputReserve|',
      '     effectiveContextWindow" apps/cli/src packages/context-compaction/src` = 0 命中(先确认没有',
      '     等价实现,再确认没有这个名字,两步都要跑)。',
      '     唯一出口:`packages/context-compaction` 的 `effectiveContextWindow({contextWindow, maxOutputTokens,',
      '     buffer, enabled})`,预留封顶 `MAX_OUTPUT_RESERVE_TOKENS`;凡"token 数 ÷ contextLimit/contextWindow"',
      '     而该分母未经此出口 ⇒ 红。**不得新建子路径导出** —— 架构契约表没登记 `packages/context-compaction`',
      '     的子入口,深导入会被守门 103 判 D3 红(本仓踩过)。',
      '     行为后果如实登记:分母只会变小 ⇒ **压缩更早触发**,用户可感知;回退有两条路(构造参数',
      '     `outputReserveEnabled:false` 或环境变量 `IHUI_COMPACTION_OUTPUT_RESERVE=0`)。',
      '     存量 8 文件/12 处已冻进 `scripts/compaction-denominator-baseline.json`(只减不增棘轮),',
      '     其中 **api 端 `/chat/stream` 的溢出面尚未收口** —— 那是本票如实留下的账,不是"已修完"。',
      '     单独复验:node scripts/check-compaction-denominator.mjs',
      '     自检:node scripts/check-compaction-denominator.mjs --self-test(15 条,含成对正反例与',
      '     "枚举到 0 个文件必须判无法判定、不得记绿"的反向对照)',
      '     镜像测试:node --test scripts/tests/check-compaction-denominator.test.mjs',
      '',
    ].join('\n'),
  },

  {
    id: '113',
    label: '🪪 路由身份键对账(blocking,路由身份不得进模型可见 schema;键清单唯一源在 @ihui/types)',
    script: 'check-tool-arg-routing-identity.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_TOOL_ARG_ROUTING_IDENTITY',
    stagedTriggers: ['apps/cli/src/tools/'],
    onFailHint: [
      '',
      '  💡 本门钉的是一条结构约束:**路由身份(sessionId / userId / instanceId / conversationId …)',
      '     一律由宿主在 closure / ctx 里绑定,绝不得出现在模型可见的参数集合里。** 一旦进了 schema,',
      '     模型就能自己填一个**别人的**值,把结果投给别的会话 / 别的宿主实例 —— 那是越权,不是参数校验问题',
      '     (同族先例:O8「只开放功能不开放数据」、O19 端点级属主鉴权、agent-control 的"投递定址不得被覆盖")。',
      '     键清单的**唯一源**是 packages/types/src/tool-contract.ts 的 ROUTING_IDENTITY_KEYS(门与类型层共用一份,',
      '     禁止在别处抄第二份;该常量被摘线本门即 exit 2 并点名)。刻意只收"填错会把结果送到别人那里"的键,',
      '     messageId / toolCallId / taskId / fileId 属**内容引用**,纳进来会误拦正当用法(镜像测试反向钉死)。',
      '     存量 16 处已冻进 scripts/tool-arg-routing-identity-baseline.json(每文件每键、只减不增):',
      '     其中 memory.ts 的 user_id×4 / session_id×1 是**待清偿的债**(服务端本就从令牌取 userId,该必填项',
      '     模型无从满足),debug.ts ×7 / terminal.ts ×4 是 terminal_open / debug_launch 返回的**工具自句柄**,',
      '     若要长期保留必须在 ROUTING_IDENTITY_KEYS 的注释里**正式登记排除理由**,不得用行内豁免遮掉',
      '     (遮掉等于把判据改成"没人违规")。',
      '     豁免写法:行内标记(族名 routing-identity-exempt)后接一句话原因与 until YYYY-MM-DD 到期日;',
      '     **不带到期日的标记本门直接不认**(与守门 108 同一条口径,免得本门成为永久豁免的生产者)。',
      '     单独复验:node scripts/check-tool-arg-routing-identity.mjs',
      '     自检:node scripts/check-tool-arg-routing-identity.mjs --self-test(23 例,含成对正反例 +',
      '     "枚举到 0 个注册不得记绿"与"清单源被摘线必须 exit 2"两条反向对照)',
      '     镜像测试:node --test scripts/tests/check-tool-arg-routing-identity.test.mjs(7 例)',
      '',
    ].join('\n'),
  },

  // --- 114 (2026-09-25 新增,测试「收集阶段」存续性对账,warn 级) ---
  // 立因(实测到的结构性失明,不是假想):`cd apps/mobile-rn && pnpm vitest run tests/` 曾长期报
  //   `Test Files 15 failed | 37 passed`,其中 14 个是**收集阶段就失败**(transform / import 解析报错),
  //   内含 131 条 it 声明(展开 137 枚用例)**一条都没跑** —— 端内约 1/3 覆盖被静默削掉。
  //   而全链 130+ 道门里**没有任何一道跑 vitest**:check-staged-typecheck 走 tsc,结构上看不见
  //   transform / 解析期失败;CI 会红(vitest 收集失败即 exit 1),但提交链不拦 ⇒ 本机可以永远"看着绿"。
  // 定级 warn 而非 blocking:本门判的是"端能不能收集到用例",一次完全无关的提交(改文档、改另一端)
  //   也可能撞上它。与改动无关的恒红门只会逼人 --no-verify,一次绕过 = 约 134 道门对该提交全部作废
  //   (§12e / §4 反复记过的教训)。问责通道 = `pnpm check:test-collection`(CI / 巡检直跑)。
  // stagedTriggers 取 apps/mobile-rn/ + packages/:能打断这份收集的只有 RN 端自身与它吃的共享包;
  //   不放 'apps/' —— 那会让每次 web/api 提交都白跑 20s vitest,而结论与本次改动无关。
  {
    id: '114',
    label: '🧪 测试收集存续性对账(warn,收集失败套件必须为 0;断言失败不混计)',
    script: 'check-test-collection-runs.mjs',
    args: [],
    mode: 'warn',
    skipEnv: 'HUSKY_SKIP_TEST_COLLECTION',
    stagedTriggers: ['apps/mobile-rn/', 'packages/'],
    onFailHint: [
      '',
      '  💡 本门钉的是**最容易被当成"测试在跑"的那一类静默失败**:套件在收集阶段就炸(transform /',
      '     import 解析 / vi.mock 缺导出),vitest 只报"Test Files N failed",而**那些文件里的每一条',
      '     it 声明都没有执行过**。判据只认 "Failed Suites" 区块与 `FAIL <file> [ <file> ]` 的套件级',
      '     形态 —— 文件级计数两种故障都会红,拿它当判据就是把"收集失败"和"断言失败"混计。',
      '     三条不可动摇的口径:① 零测试文件(空扫)判红,绝不当绿;② 断言失败只报数不计红;③ 取不到',
      '     结论(vitest 入口不可解析 / 超时 / 无汇总行 / 该端 test 入口不是 vitest)一律"未判定"并',
      '     写明原因 —— 未判定 **不等于** 达标。',
      '     只接 JS 系:pytest 的收集期故障是另一套版式(`ERROR tests/x.py` + `no tests ran`),照抄判据',
      '     必然空转;非 vitest 入口的端会被如实记成"未判定",不冒绿。',
      '     单独复验:node scripts/check-test-collection-runs.mjs(默认只跑 apps/mobile-rn)',
      '     扩端:node scripts/check-test-collection-runs.mjs --end apps/web --strict',
      '     自检:node scripts/check-test-collection-runs.mjs --self-test(17 例,临时目录造',
      '     "收集失败 / 全绿 / 空扫 / 断言失败 / 入口不可解析 / 超时 / 无汇总行"七态,正反成对)',
      '     镜像测试:node --test scripts/tests/check-test-collection-runs.test.mjs(含装车证明 +',
      '     "未注册时 runner 清单里查不到本门、注册后必须被判定"的方向性对照)',
      '     紧急跳过:HUSKY_SKIP_TEST_COLLECTION=1 git commit ...(本门 warn,通常不需要)',
      '',
    ].join('\n'),
  },

  {
    id: '115',
    label: '🧪 入参校验装车对账(blocking,校验器必须有生产调用方 + 影子档在位且默认不是 enforce)',
    script: 'check-tool-arg-validation-wired.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_TOOL_ARG_VALIDATION_WIRED',
    stagedTriggers: ['apps/cli/src/tools/', 'packages/types/src/'],
    onFailHint: [
      '',
      '  💡 本门钉的是 A36 查出来的事实:`apps/cli/src/tools/argument-validator.ts` 写得挺全',
      '     (field / expected / actual、嵌套 items[0] 路径都有),但**生产面零调用方** —— grep 只命中它',
      '     自己的定义行与注释。后果不是"少一道校验"这么轻:`required` 只被用来生成提示文案和投给 provider',
      '     的 schema,没有任何一处按它拒绝或纠正入参 ⇒ 模型少传/传错类型时,同一类错误在 104 枚工具里',
      '     有 104 种表现,而 A13 那句"运行时怎么校验与模型被告知怎么填同源"只有后半句成立。',
      '     只判两条:① `validateToolArguments(` 必须有非测试调用方(**注释里的提及不算** —— 那正是',
      '     "看起来有、其实没装车"这一型);② 模式开关必须在位、默认必须是 off、且 shadow 档存在',
      '     (**enforce 未实现前默认绝不能是 enforce**:没被执行过的描述一旦变成拒绝,就是运行时版恒红事故)。',
      '     接线顺序登记在 PROJECT_PLAN 第八波:① 影子模式(本门钉住的这层)→ ② 用影子数据把描述修对',
      '     → ③ 才允许 enforce 默认开,并把 {字段路径, 期望, 实得} 逐条回灌模型。',
      '     覆盖面缺口(如实登记,不得读成"全链已覆盖"):hubEnabled 分支在拿到 Tool 对象之前就 return,',
      '     那条路径下影子不生效。',
      '     单独复验:node scripts/check-tool-arg-validation-wired.mjs',
      '     自检:node scripts/check-tool-arg-validation-wired.mjs --self-test(14 条,含成对正反例 +',
      '     "摘掉调用方必红"与"空枚举不得记绿"两条反向对照)',
      '     镜像测试:node --test scripts/tests/check-tool-arg-validation-wired.test.mjs(5 例,含装车前置)',
      '',
    ].join('\n'),
  },

  {
    id: '116',
    label: '🌐 出站事实对账(blocking,厂商出站必须走带回 egress 的包装出口;绕档进棘轮基线)',
    script: 'check-egress-facts.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_EGRESS_FACTS',
    onFailHint: [
      '',
      '  💡 本门钉的是 A34:一趟请求**实际**走没走代理、配置从哪来、有没有命中 NO_PROXY、',
      '     用没用自定义 CA —— 这些必须是**响应上的返回值**,不是日志行。AGENTS §5b 连着记过',
      '     "git 网络时通时不通 / 钩子进程不继承 shell env / 服务身份与交互账户的 safe.directory',
      '     互不相通",每一次都靠人肉 `git config --local` 现读,因为没有一次调用把事实带回来。',
      '     唯一包装出口:`apps/api/src/utils/proxy-dispatcher.ts` 的 `proxiedFetch`(响应上带',
      '     不可枚举的 egress 字段,用 `readEgressFacts(res)` 取);厂商域名清单**不硬编码**,',
      '     由 `VENDORS.baseUrl` + `DEFAULT_PROXY_DOMAINS` 两张仓库内真表推导(推导失败 ⇒ exit 2,不记绿)。',
      '     判一条:对外发往第三方/厂商域名的请求出口未走包装 ⇒ 红;存量进 `scripts/egress-facts-baseline.json`',
      '     每文件棘轮(只减不增)。覆盖面如实登记:`apps/api/src` + `apps/cli/src/provider`,',
      '     `packages/api-client` 打的是自家后端**不在面内**;Python 侧(ai-service)同类出口只登记未纳面。',
      '     未做的那半同样如实登记:**错误分流**("被策略拦" vs "网络错"两个码)本票没做 ——',
      '     本仓 TS 侧当前没有任何出口会在传输前拒发请求,造两个码就是一台永远不响的门。',
      '     单独复验:node scripts/check-egress-facts.mjs',
      '     自检:node scripts/check-egress-facts.mjs --self-test(28 条,含成对正反例 + 空枚举/空表必判死)',
      '     镜像测试:node --test scripts/tests/check-egress-facts.test.mjs(5 例,含真表真挂的装车证明)',
      '',
    ].join('\n'),
  },

  // 定级 warn 而非 blocking:HEAD 实测未对齐存量 2 个文件(memory.py + routers/rules.py),
  //   而"怎么对齐"(客户端传的必须等于令牌主体 → 403,还是只信令牌、忽略客户端值)取决于
  //   v1 对外 API 能不能代表他人访问记忆 —— 那是产品口径,不由门替人决定。两种选型都会让
  //   本门归零,所以在选型落地前它就是"存量报数、新增判红"的棘轮;当场 blocking = 与任何一次
  //   提交都无关的恒红门,唯一结局是逼人 --no-verify 并连带废掉全部守门(§12e 同型)。
  //   升 blocking 的前置条件 = 未对齐存量归零。
  //   **2026-09-25 升档(前置已满足,不是顺手)**:`752c6eb110b` 清掉最后一个未对齐面
  //   (`app/routers/rules.py`)后,HEAD 面实测"未对齐 0 个"(`node scripts/check-memory-owner-binding.mjs`),
  //   零容忍不再等于恒红;故 args 带 --strict、mode 改 blocking。复算入口就是上面那条命令,
  //   若哪天 HEAD 面重新出现未对齐(例:有人 --no-verify 塞进来),先清偿再提其它票,不得削判据。
  {
    id: '117',
    label: '🔐 记忆端点属主绑定对账(blocking,收 user_id 的端点必须与令牌主体对齐;存量已归零⇒零容忍)',
    script: 'check-memory-owner-binding.mjs',
    args: ['--strict'],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_MEMORY_OWNER_BINDING',
    stagedTriggers: ['apps/ai-service/app/', 'apps/api/src/routes/'],
    onFailHint: [
      '',
      '  💡 本门钉的是**"认证不等于授权"那一层**:匿名进不来(不在 PUBLIC_PATHS)不代表安全,',
      '     任何已登录用户填别人的 UUID 就能读/改/删别人的记忆 —— 判洞要问的是"有没有把请求里的',
      '     id 与令牌里的 id 比对",而不是"有没有全局中间件"。',
      '     两条语法锚点必须同时认:user_id 的 Query(...) 声明 与 Pydantic 的 Field(...) 声明 ——',
      '     只认 Query 会让整类 POST 端点隐身;对齐出口只写在注释里不算(自称已拆实际没拆那一型)。',
      '     修法(两种都会让本门归零,选型看 v1 对外语义):(a) 端点加 principal: str =',
      '     Depends(require_request_user_id) 后只用 principal,忽略客户端值;(b) 保留入参做兼容',
      '     校验,不等即 403。仓里现成出口 = app/core/jwt_auth.py 的 require_request_user_id',
      '     (带 DEV_ANONYMOUS_PRINCIPAL 开发降级,以免 ASGI in-process 的既有测试整片 401)。',
      '     单独复验:node scripts/check-memory-owner-binding.mjs(报清单与透传面)',
      '     问责档:node scripts/check-memory-owner-binding.mjs --strict(未对齐即 exit 1)',
      '     自检:node scripts/check-memory-owner-binding.mjs --self-test(17 例,正反成对)',
      '     镜像测试:node --test scripts/tests/check-memory-owner-binding.test.mjs(14 例,含',
      '     "本门未注册时不得被判定为已装车"的方向性对照)',
      '     紧急跳过:HUSKY_SKIP_MEMORY_OWNER_BINDING=1 git commit ...(本门 blocking,跳过即把' +
        '一个跨用户读改删的面提交进 HEAD,必须在提交信息里写明理由与清偿票)',
      '',
    ].join('\n'),
  },

  {
    id: '118',
    label: '🧬 门脚本取材面纪律对账(blocking,本次改动动过的门必须经统一取材层;全量档只报数)',
    script: 'check-gate-face-discipline.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_GATE_FACE_DISCIPLINE',
    stagedTriggers: ['scripts/'],
    onFailHint: [
      '',
      '  💡 本仓 159 道门里只有 24 道走 scripts/lib/face-reader.mjs,散写 git/按磁盘判的 74 道',
      '     在"共享工作树滞后 HEAD"时会恒红与假绿来回跳,并把错数写回棘轮基线(守门 83 的 R3',
      '     被整文件回退三次即此型)。本门只咬**本次改动动过的门**,全量档只报数 ——',
      '     一次性把 74 道判红就是逼全队 --no-verify、连带废掉全部守门。',
      '     出路:改用 selectFace/readFace(或 catBatch)取内容;若这道门判的不是仓库内容',
      '     (纯计算/外部输入/机器态),去掉仓库锚点即可。',
      '     单独复验:node scripts/check-gate-face-discipline.mjs --staged',
      '     自检:node scripts/check-gate-face-discipline.mjs --self-test(16 例,含两层遮噪方向的反向锁)',
      '     镜像测试:node --test scripts/tests/check-gate-face-discipline.test.mjs',
      '',
    ]
  },

  {
    id: '119',
    label: '🛰️ 子代理权限继承对账(blocking,派生点必须下传 permissionMode/permissions)',
    script: 'check-subagent-permission-inherited.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_SUBAGENT_PERMISSION_INHERITED',
    stagedTriggers: ['apps/cli/src/'],
    onFailHint: [
      '',
      '  💡 判三条:P1 派生面出现字面量 bypassPermissions 作默认档(零容忍,不吃豁免)/',
      '     P2 构造调用未下传 permissionMode+permissions(棘轮锚点=该文件 HEAD 自身计数,存量 7 处只报数)/',
      '     P3 读到了权限键却没喂进派生(半个继承)。真缺陷不是"默认绕过",而是**整个不下传**:',
      '     子代理落兜底档后,父会话 --disallowed-tools 的显式 deny 在子代理里查不到。',
      '     单独复验:node scripts/check-subagent-permission-inherited.mjs',
      '     自检:--self-test(39 例) 镜像:node --test scripts/tests/check-subagent-permission-inherited.test.mjs(12 例)',
      '',
    ]
  },

  {
    id: '120',
    label: '✅ 名单类判据正向证明对账(blocking,登记名单必须被自己的成员命中过)',
    script: 'check-list-predicate-has-positive-proof.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_LIST_POSITIVE_PROOF',
    onFailHint: [
      '',
      '  💡 本仓的门大量是"名单驱动"(拦名单里的标识符/放过白名单里的成员)。第八批三份独立取证',
      '     收敛到同一形态缺陷:**名单有、从不命中** —— 反向证明(拦到坏值才红)全绿,而真实/构造',
      '     输入一次都没穿过名单,门对那个形态全盲。本门要求每条登记名单在其自测/镜像测试里',
      '     至少有一条断言的输入取自名单本身;判不出 ⇒ 记"未判定"并如实点名,不记通过。',
      '     单独复验:node scripts/check-list-predicate-has-positive-proof.mjs',
      '     自检:--self-test(15 条) 镜像:node --test scripts/tests/check-list-predicate-has-positive-proof.test.mjs(6 例)',
      '',
    ]
  },

  {
    id: '121',
    label: '🗑️ 声明策略必须有消费者(blocking,MAX_AGE/TTL/RETENTION/Contract 谓词/清理函数未接线即红,存量棘轮)',
    script: 'check-declared-policy-has-consumer.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_DECLARED_POLICY_CONSUMER',
    stagedTriggers: ['apps/', 'packages/'],
    onFailHint: [
      '',
      '  💡 本仓最高频失效型"造好没装车":声明了保留期/预算契约/清理函数,却没有任何生产面',
      '     消费者(注释、字符串、纯 re-export、测试面、scripts 层都不算消费者)。',
      '     实测存量:候选 131 / 未接线 32 处 29 文件(含 pruneOldSubagentStates、apps/api cleanup 族 9 处)⇒ 只报数。',
      '     棘轮锚点=该文件 HEAD 自身未接线数;新增即红。全量判 HEAD blob、--staged 判索引、取不到 exit 2。',
      '     单独复验:node scripts/check-declared-policy-has-consumer.mjs',
      '     自检:--self-test(22 例,含真未接线/已接线双夹具 + 禁闭包/禁外部消费双变异)',
      '     镜像:node --test scripts/tests/check-declared-policy-has-consumer.test.mjs(8 例,含装车前置证明)',
      '',
    ]
  },

  {
    id: '122',
    label: '💾 文件写盘安全对账(blocking,工具写文件必须走原子写出口;裸写盘棘轮)',
    script: 'check-file-write-safety.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_FILE_WRITE_SAFETY',
    stagedTriggers: ['apps/cli/src/tools/'],
    onFailHint: [
      '',
      '  💡 工具层写文件必须经 scripts/lib 的原子写出口(同目录临时文件 + rename + Windows',
      '  EPERM/ENOENT 重试 + 不跟随重解析点 + 读后写 stale 校验)。裸 writeFileSync 的风险:',
      '  多会话共享工作区里两个写者交错会静默覆盖;§26 记过递归操作穿透 junction 清空真实目标。',
      '  存量走棘轮(锚点=该文件 HEAD 自身计数);新增即红。',
      '  单独复验:node scripts/check-file-write-safety.mjs',
      '  自检:--self-test(24 例) 镜像:node --test scripts/tests/check-file-write-safety.test.mjs(13 例)',
      '',
    ]
  },

  {
    id: '123',
    label: '⏱️ 工具执行预算对账(blocking,工具级超时/取消机制在位且被调用;缺常量/缺通道即红)',
    script: 'check-tool-exec-budget.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_TOOL_EXEC_BUDGET',
    stagedTriggers: ['apps/cli/src/tools/'],
    onFailHint: [
      '',
      '  💡 钉"工具执行无界"三源:ToolContext 无 signal(取消无通道)/执行点无超时/exec 无 maxBuffer。',
      '     S1 系判机制在位(常量三件套/解析出口/Math.min 封顶/linkAbortSignal/executeWithinExecBudget 装车);',
      '     S2 判注入点(未传 signal 的 ctx 构造点名);判定面=取材面(HEAD/索引),不判滞后的共享工作树。',
      '     单独复验:node scripts/check-tool-exec-budget.mjs',
      '     自检:--self-test(26 例) 镜像:node --test scripts/tests/check-tool-exec-budget.test.mjs(9 例)',
      '',
    ]
  },

  {
    id: '124',
    label: '🎨 小程序原生 chrome 派生对账(blocking,theme.json + THEME_CHROME 必须是 tokens.css 的派生态)',
    script: 'check-miniapp-chrome.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_MINIAPP_CHROME',
    stagedTriggers: [
      'packages/design-tokens/src/styles/tokens.css',
      'apps/miniapp-taro/src/theme.json',
      'apps/miniapp-taro/src/lib/theme.ts',
    ],
    onFailHint: [
      '',
      '  💡 原生导航栏/tabBar 的配色不走 CSS,过去是**手抄**在 theme.json 与 theme.ts 的 THEME_CHROME 里,',
      '     改 tokens.css 不会带动它们 ⇒ "手机上改了 web 没改"的又一成因。现在两份副本由',
      '     `node scripts/sync-miniapp-chrome.mjs` 派生,并挂在 pre-commit 的 TOKEN_SYNC_TARGETS 上按',
      '     tokens.css 触发面自动写回(原位写回,不整块替换)。',
      '     已登记的唯一分歧(d2d80c1b23 对齐 rn gray.800)与"登记却已不冲突=清单腐烂"都由本门核。',
      '     单独复验:node scripts/check-miniapp-chrome.mjs(自检 --self-test,镜像 13 例)',
      '',
    ]
  },

  {
    id: '125',
    label: '🧭 派生面登记表自洽对账(blocking,TOKEN_SYNC_TARGETS 每行的触发文件/写回出口/复核门三方必须在位)',
    script: 'check-token-sync-registry.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_TOKEN_SYNC_REGISTRY',
    stagedTriggers: ['scripts/'],
    onFailHint: [
      '',
      '  💡 `scripts/lib/pre-commit-hook.js` 的 TOKEN_SYNC_TARGETS 是"改源头 ⇒ 自动写回各端副本"的唯一登记表,',
      '     每行三段:① 触发文件 ② 写回命令 ③ 复核门。**这三段过去没有任何一道门对账**,所以四种腐烂都能静默发生:',
      '     触发文件改名 ⇒ 那一行永不触发(副本从此不再自动跟随);写回脚本被删/改名 ⇒ 提交链跑到那步才崩;',
      '     复核门被摘线或改成 warn ⇒ 副本照样写回却再没人判它对不对;新加一行忘了配门 ⇒ 新派生面零覆盖。',
      '     最后一种最贵:表里挂着一行没人配门的行,比根本没有这行更糟 —— 它会替人做出"已经收口了"的判断。',
      '     判据只读表本身(不抄第二份清单);取材面同 77/83/93/103(全量判 HEAD、--staged 判索引、取不到 exit 2)。',
      '     修复口径:改表与配门,不得为消红放宽本门判据或把行删掉(删行 = 关掉那端的自动同步)。',
      '     单独复验:node scripts/check-token-sync-registry.mjs(自检 25 例,镜像 11 例)',
      '',
    ]
  },
  {
    id: '126',
    label: '🧪 shared 包非 Node 宿主纯度对账(blocking,入口闭包可达面内不得有 node: 内建导入)',
    script: 'check-shared-nonde-node-purity.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_SHARED_NONDE_PURITY',
    stagedTriggers: [
      'packages/shared/',
      'apps/miniapp-taro/src',
      'apps/mobile-rn/src',
      'packages/app/src',
      'apps/web/',
      'apps/extension/',
    ],
    onFailHint: [
      '',
      '  💡 `packages/shared` 被 web / 小程序 / RN / packages/app 这些**非 Node 宿主**共同消费,',
      '     而入口闭包可达面里一旦出现 `node:fs`/`node:dns` 这类内建导入,失败形态是构建期 resolve',
      '     报错或运行时 undefined —— `pnpm typecheck` 结构上看不见(TS 走 tsconfig paths,不看打包器)。',
      '     本门按**可达性**判:从 `src/index.ts` + package.json 非通配 exports 做值边传递闭包',
      '     (`import type` 不计),闭包内出现内建导入即红并打印链路;宿主直接摸进含内建的文件也红。',
      '     "含内建但闭包不可达"只报数不判红(那是待处置的源码面,不是当前缺陷) —— 但必须打印,',
      '     否则读报告的人会以为 shared 是纯的。正确修法=把平台特有依赖改成 adapter 注入或移出',
      '     共享面(§3 工厂模式),不得为消红去放宽判据或把可达文件改判成不可达。',
      '     单独复验:node scripts/check-shared-nonde-node-purity.mjs(自检 23 例,镜像 18 例)',
      '',
    ]
  },

  {
    id: '127',
    label: '🛰️ 跨语言出站路由声明对账(blocking,默认档只报数;--strict 才判红,防恒红门)',
    script: 'check-declared-outbound-routes.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_DECLARED_OUTBOUND_ROUTES',
    onFailHint: [
      '',
      '  💡 本门判的是"代码里写死了要打的自家路由,而两侧注册面里根本没有这条"。',
      '     ① 问责:node scripts/check-declared-outbound-routes.mjs --strict --explain 逐条看证据与匹配结果;',
      '     ② 处置二选一 —— 在对侧实现该路由,或删除这行硬编码声明;',
      '     ③ 禁止用基线文件/豁免清单遮红,禁止改阈值让它好看(台账会腐烂而这批是真缺陷)。',
      '',
    ]
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

// ── 守门 id 唯一性自检(2026-09-23 立,不阻塞) ──────────────────────────────
// 成因:同日实测两道 blocking 门撞同号 —— 77 曾被 check-radius-single-source 与
// check-no-conflict-markers 并用(后者已让号到 79),而 75/76 曾各存在两处(2026-09-24 由后落地方让号至 83/84)。同号本身
// 不报错,但会把 skipEnv 语义与"哪道门失败"的归因搅在一起,且逃过一次就没人再看见。
// 这里只打印、不改退出码:让每次运行都显形,由归属会话各自让号(后落地者让号)。
{
  const seen = new Map()
  for (const c of effectiveChecks) {
    if (!c || !c.id) continue
    seen.set(c.id, [...(seen.get(c.id) || []), c.script || '?'])
  }
  const dup = [...seen.entries()].filter(([, v]) => v.length > 1)
  if (dup.length) {
    console.log(
      `⚠️  守门 id 唯一性: ${dup.length} 个号被多道门共用(不阻塞,但 skipEnv 与失败归因会串) —— ` +
        dup.map(([k, v]) => `${k}=${v.join('/')}`).join(' ; ') +
        ' → 按"后落地者让号"各自改号(runner + AGENTS 速查 + README 三处同步)。',
    )
  }
}

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
  // 归一交给 lib/guardian-triggers.mjs:裸字符串注册(HEAD 实测 3 道)曾在此处
  // TypeError 崩掉整条守门链;空清单则抛错,不允许"永不运行"的隐形失踪。
  return triggersTouch(stagedFilesOrNull(), prefixes)
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
      `⏭  [${check.id}] ${check.label}(暂存区未触及:${normalizeTriggers(check.stagedTriggers).join(' / ')},跳过)`,
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
