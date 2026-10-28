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
 *   stagedTriggers 路径前缀数组(支持 `**`/`*`/`?` glob);声明后该项**仅在暂存区触及这些路径时**执行(见执行循环),
 *                  用于把与绝大多数提交无关的领域守门(桌面安装器等)挂上而不拖慢/误伤
 */
// 2026-10-16 C1 收口:执行段(缓存/计数/attest/汇总/PAR 池/主循环)整体外置到
// scripts/lib/guardian-executor.mjs 的 runGuardianBatch(ctx);本文件只剩注册表、
// CLI 解析与 help。执行语义逐字未动,镜像测试同票改取材面(见该 lib 头注)。
// 2026-10-25(GOAL-合入票):第 5 轮合并 c8fee04806ea 的「人工归并回灌」把本文件的门注册段截断 —— checks 数组里 240-249 十门注册整体消失、bare-decode-uri/token-literal-debt/rn-readout-cell 三条只剩尾巴、pushGateChecks 追加 68 行缺头缺尾的残骸 ⇒ 本文件语法错误 ⇒ push 门编排器(.husky/pre-push → guardian-runner --push-gate)整个跑不起来,本地 ahead 的提交一律推不动。
// 本次以 origin/main 当前面为基线逐字复原(§0.6 单一真相源下对侧的完整形态);判据面一字未改,只复原被截断的注册段。
import { execFileSync } from 'node:child_process'
import { runGuardianBatch } from './lib/guardian-executor.mjs'
import { resolveGateScope, isMetaGate } from './lib/gate-scope.mjs'


// === 检查配置(按 mode 分组;项数与分级见 `--help`,勿在此写死数字——写死必然过期) ===

const checks = [
  // --- blocking(项数见 --help) ---
  {
    id: '1',
    label: '🔐 API key 泄露',
    script: 'check-api-key-leak.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
  },
  {
    id: '2',
    label: '🌐 i18n 键完整性',
    script: 'check-i18n-keys.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/", "apps/web/", "scripts/data/i18n-key-removals.json"],
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
    stagedTriggers: ["packages/i18n/messages/web/zh-TW.json"],
  },
  {
    id: '2c',
    label: '🔍 ko.json 中文残留',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ko'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/web/ko.json"],
  },
  {
    id: '2e',
    label: '🔍 en.json 破碎英文',
    script: 'check-i18n-broken-en.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/web/en.json"],
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
    stagedTriggers: ["packages/i18n/messages/"],
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
    stagedTriggers: ["packages/i18n/messages/web/"],
    onFailHint: [
      '',
      '  💡 zh-CN.json 有改动但 i18n pending 非空,请先跑翻译流水线:',
      '     1. node scripts/i18n-diff.mjs          (检测差异,生成 pending 清单)',
      '     2. AI agent 翻译 → .ihui-agent/tmp/i18n-translations.json',
      '     3. node scripts/i18n-apply.mjs --check-first  (先对账再应用翻译)',
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
    stagedTriggers: ["packages/i18n/messages/miniapp-taro/"],
    onFailHint: [
      '',
      '  💡 miniapp-taro zh-CN.ts 有改动但 i18n pending 非空,请先跑翻译流水线:',
      '     1. node scripts/i18n-diff.mjs --target=miniapp-taro  (检测差异,生成 pending 清单)',
      '     2. AI agent 翻译 → .ihui-agent/tmp/i18n-translations.json',
      '     3. node scripts/i18n-apply.mjs --target=miniapp-taro --check-first  (先对账再应用翻译)',
      '     4. node scripts/i18n-diff.mjs --target=miniapp-taro   (复验 parity,应无 pending)',
      '     5. git add apps/miniapp-taro/src/i18n/{en,ja,ko,zh-TW}.ts 重新 commit',
      '',
    ].join('\n'),
  },
// 〈原 9 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l139(门 103 C1 收口)〉首意: --- 2g-web (2026-07-27 新增,i18n 命名空间传递守门,warn-only 起步) ---
  {
    id: '2g-web',
    label: '🔍 i18n 命名空间传递(web→共享组件)',
    script: 'check-i18n-namespace-passing.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["apps/web/src/"],
  },
  {
    id: '3',
    label: '🗄️ schema drift',
    script: 'check-db-schema-drift.mjs',
    args: [],
    // 2026-10-15 由 blocking 降为 warn(AGENTS.md §12E:判历史存量的门应当 warn 或差值棘轮,
    // 「升 blocking 的前置 = 存量归零」)。降级依据 —— 实测阻塞取证:
    //   本门只比"TS schema 表定义"与"drizzle migration 文件",判的是**仓库内历史存量**,
    //   与任何单次提交的内容面无关(前端 CSS/表格/路由产物改动碰不到 packages/database)。
    //   存量实证:packages/database/drizzle/20261014100000_chat_element_packs.sql 正被并发会话
    //   删除,而 src/schema/chat.ts:237 仍定义 chat_element_packs ⇒ 本门恒红;该红会挡住**每一个**
    //   会话的任何一次提交,唯一出路是绕回裸 git commit 跳门,连带该枚提交上全部守门作废(§12e)。
    //   降为 warn 后存量仍逐次可见并打印结论,不再阻塞;真正的修复动作(补 migration 或同步删
    //   schema 定义)仍由该门自己持续喊话。升回 blocking 的前置 = chat_element_packs /
    //   rag_chunks / audit_logs_default / 26 处 extra columns 这批存量归零。
    mode: 'warn',
    stagedTriggers: ["packages/database/"],
  },
  {
    id: '4',
    label: '📦 packages 陈旧 dist',
    script: 'check-stale-dist.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["packages/"],
  },
  {
    id: '4b',
    label: '🔤 dist UTF-8 BOM',
    script: 'check-dist-encoding.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["packages/", "apps/"],
  },
  {
    id: '4c',
    label: '🔤 api-client UTF-8 完整性',
    script: 'check-api-client-utf8.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["packages/api-client/src/endpoints/"],
  },
  {
    id: '6',
    label: '🛡️ skipResponseSanitization',
    script: 'check-sanitizer-bypass.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["apps/api/src/routes/"],
  },
  {
    id: '7',
    label: '📦 依赖碎片化',
    script: 'check-dedupe.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["pnpm-lock.yaml", "**/package.json"],
  },
  {
    id: '8',
    label: '🔗 前端↔后端路由一致性',
    script: 'check-api-routes.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
  },
  {
    id: '11',
    label: '⭕ 容器圆角违规',
    script: 'check-rounded-full.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
  },
  {
    id: '11b',
    label: '📐 圆角溢出(父 rounded + 子 bg 贴边)',
    script: 'check-rounded-overflow.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
  },
  {
    id: '11c',
    label: '🏷️  选中态描边定稿防回退(禁纯黑/纯白,全站)',
    script: 'check-tagsview-visual.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["apps/web/"],
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
    stagedTriggers: ["**/*"],
  },
  {
    id: '11h',
    label: '🚫 UI 图标位 emoji 违规(icon 字段/渲染位)',
    script: 'check-no-emoji-icons.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["apps/web/", "apps/mobile-rn/", "apps/miniapp-taro/", "apps/extension/", "apps/desktop/", "packages/app/", "packages/ui-react/"],
  },
  {
    id: '11e',
    label: '📏 单文件行数上限 (仅拦新增)',
    script: 'check-file-size.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["apps/"],
  },
  {
    id: '11f',
    label: '🚫 原生 alert/confirm/prompt 弹窗',
    script: 'check-no-native-dialog.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
  },
  {
    id: '11g',
    label: '🚫 mask-image 渐变遮罩',
    script: 'check-no-mask-image.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
  },
  {
    id: '12',
    label: '📋 交付报告一致性',
    script: 'check-delivery-report-consistency.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*.md"],
  },
  // 13c(check-project-plan-archive)已退役(2026-10-16 机主令:完成即删,存档机制拆除):
  // 归档器/归档件不再存在,防误删语义由门 71 新判据("已勾行不进保护集,未勾行照旧拦")承接。
  {
    id: '15',
    label: '📊 迁移完整性(7 大类 29 子项)',
    script: 'check-api-migration-completeness.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
  },
  {
    id: '17',
    label: '🎨 CSS 颜色 token 嵌套',
    script: 'check-input-border-var.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
    // 2026-10-03 立:门体此前**没有**任何逃生舱(脚本也不读跳过变量)。本门属"读 HEAD 面"的一族,
    // 批量跑 24–30 分钟期间并发会话推进 main ⇒ 拿过期基线报红(逐门单独复跑是绿的),
    // 而没有逃生舱就只剩 --no-verify 一条路 —— 那是最后手段,不该是唯一手段。
    skipEnv: 'HUSKY_SKIP_INPUT_BORDER_VAR',
  },
  {
    id: '18',
    label: '🖱️  原生 title tooltip 违规',
    script: 'check-native-title-tooltip.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
  },
  {
    id: '20',
    label: '🎯 Tailwind class 冲突',
    script: 'check-tailwind-class-conflict.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
  },
  {
    id: '24a',
    label: '📏 侧边栏宽度一致性',
    script: 'check-sidebar-width-consistency.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["packages/design-tokens/", "apps/web/src/styles/design-tokens.css", "apps/web/src/components/sidebar.tsx"],
  },
  {
    id: '25',
    label: '🧹 项目外路径违规(blocking)',
    script: 'check-workspace-hygiene.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
  },
  {
    id: '26',
    label: '🛡️  项目父目录污染巡查(blocking)',
    script: 'check-parent-pollution.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
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
    stagedTriggers: ["packages/design-tokens/src/styles/tokens.css", "apps/web/app/globals.css", "apps/web/app/layout.tsx", "packages/ui-react/src/components/dialog.tsx", "apps/web/src/components/layout/GlobalTopBar.tsx"],
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
    stagedTriggers: ["apps/web/", "packages/ui-react/src/"],
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
    stagedTriggers: ["**/*"],
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
    stagedTriggers: ["packages/i18n/messages/"],
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
    stagedTriggers: ["**/*"],
    // 2026-10-03 补齐:门体头注一直写着 `HUSKY_SKIP_COMMIT_LOSS_CHECK`,但 runner 从未声明该字段
    // ⇒ 那是**假逃生舱**(设了毫无效果,只会逼人改用 --no-verify 连带废掉全部门)。
    // 照 TAGSVIEW_GUARD 的同一处修法补这一行即让承诺成真(runner 的分发循环统一 honors skipEnv)。
    skipEnv: 'HUSKY_SKIP_COMMIT_LOSS_CHECK',
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
    stagedTriggers: ["**/*"],
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
    stagedTriggers: ["**/*"],
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
    stagedTriggers: ["scripts/check-staged-typecheck.mjs", "scripts/tests/check-staged-typecheck.test.mjs"],
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
    stagedTriggers: ["**/*"],
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
// 〈原 9 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l529(门 103 C1 收口)〉首意: --- 35 (2026-07-26 新增,mypy 防回归守门,防 ai-service Python 类型回退) ---
  {
    id: '35',
    label: '🐍 mypy 类型检查(防 ai-service Python 类型回退)',
    script: 'check-mypy.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["apps/ai-service/"],
    onFailHint: [
      '',
      '  💡 apps/ai-service 的 Python 代码有 mypy 类型错误,',
      '     修复:cd apps/ai-service && mypy app --ignore-missing-imports',
      '     紧急跳过(不推荐):HUSKY_SKIP_MYPY=1 git commit ...',
      '',
    ].join('\n'),
  },
// 〈原 7 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l552(门 103 C1 收口)〉首意: --- 36 (2026-07-27 新增,miniapp-taro token 同步守门,防 app.css 与 tokens.css 漂移) ---
  {
    id: '36',
    label: '🎨 [miniapp-taro] design-tokens 同步(防 app.css 漂移)',
    script: 'check-miniapp-tokens-sync.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["packages/design-tokens/src/styles/tokens.css", "apps/miniapp-taro/src/app.css"],
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
    stagedTriggers: ["apps/web/app/globals.css", "packages/design-tokens/src/styles/tokens.css"],
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
    stagedTriggers: ["package.json", "pnpm-workspace.yaml", "patches/", "packages/app/", "apps/*/package.json"],
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
  // blocking:P3-3.3 "独立 screen 实现清零" 目标完成后,screen 若漏迁移到 @ihui/rn-app
  //   共享层,独立实现会回升、维护成本系数恶化。**计数一律现读**(`node scripts/
  //   check-rn-app-migration.mjs` 会打当刻数字)—— 头注写死的"151/153"在 2026-10-21 已
  //   失真到 219 枚,写死数字必然腐烂成"文档说一套、门跑另一套"(§0.1)。
  // 检测逻辑(2026-10-21 G-922 四修后的形态,判据只有一份,住在门体里):
  //   V1 screen 未 import @ihui/rn-app 且无**有效**(未到期)豁免 ⇒ 红;
  //   V2 「屏级共享」:有 import 还得 packages/app 有同名共享屏,存量只报数,只拦新增与退化;
  //   V3 豁免登记名在被审面 screens 清单里不存在 = 清单腐烂 ⇒ 红;
  //   V4 豁免到期 ⇒ 不再生效,须按当刻现读重新登记(带 why + expires);
  //   面纪律:全量档=HEAD blob / --staged=索引 blob / --worktree=人工逃生舱,取不到即 exit 2。
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
    stagedTriggers: ["apps/mobile-rn/src/screens/", "packages/app/src/"],
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
    stagedTriggers: ["packages/shared/src/", "packages/types/src/", "apps/web/src/", "apps/mobile-rn/src/", "apps/miniapp-taro/src/", "apps/extension/src/", "apps/cli/src/"],
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
// 〈原 7 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l664(门 103 C1 收口)〉首意: --- 41 (2026-08-02 新增,单分支开发守门,AGENTS.md §9b 落地) ---
  {
    id: '41',
    label: '🌿 单分支开发守门(blocking,AGENTS.md §9b)',
    script: 'check-single-branch.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
    // onFailHint 与门体同形(G-331):门体自 aea810c81 起判"旁支长期滞留"而非"存在旁支",
    // 且对 in-flight / backup 两类豁免;旧 hint 教人 `git branch -D` / `git push origin --delete`,
    // 按它执行的人正是在删别的会话的在飞分支与 §5b 明令禁删的备份引用。条数一律由门现读报出,
    // 这里不写死任何数字。
    onFailHint: [
      '',
      '  💡 本门判的是"旁支长期滞留",不是"存在旁支"。红 = 某分支滞留超过在飞窗口且不在任何豁免内。',
      '     两类豁免(名单与条数以门的现读输出为准,此处不写死):',
      '     ① in-flight —— 分支尖端提交距今 ≤ GRACE_HOURS(默认 48;IHUI_SINGLE_BRANCH_GRACE_HOURS 可调,',
      '        取不到尖端提交时刻 ⇒ 不豁免,宁误拦不静默);',
      '     ② backup —— backup/ 与 ihui-backup/ 前缀(含其 origin/ 镜像);AGENTS §5b 明令禁止删除备份引用,',
      '        本门永远不会教你去删它们。',
      '     其余合法形态:goal/* 且 .ihui-agent/goal-runtime/STATE.md 标注 active;linked worktree 已 checkout',
      '     的分支(AGENTS §12d sanctioned 并行隔离)。',
      '     处置:红名单上的分支若工作已并入 main,`git branch -d <分支>`(只删已合并)是正常收口;',
      '     尚未并入 ⇒ 先把改动合回 main,或等它在飞窗口内自然豁免。禁止 -D / origin --delete(门体不判的',
      '     豁免分支更不许删)。',
      '     阳性对照:IHUI_SINGLE_BRANCH_GRACE_HOURS=0 node scripts/check-single-branch.mjs(窗口调 0,',
      '     豁免名单全部现读报出);复验:node --test scripts/tests/check-single-branch.test.mjs',
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
    stagedTriggers: ["packages/i18n/messages/web/", "scripts/joyo-kanji.json", "scripts/brand-glossary.json"],
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
    stagedTriggers: ["packages/i18n/messages/shared/", "scripts/joyo-kanji.json", "scripts/brand-glossary.json"],
  },
  {
    id: '2o-miniapp-taro',
    label: '🔍 [miniapp-taro] ja.json 中文简体残留(blocking,常用汉字表精确判据)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ja', '--target=miniapp-taro'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/miniapp-taro/", "scripts/joyo-kanji.json", "scripts/brand-glossary.json"],
  },
  {
    id: '2o-mobile-rn',
    label: '🔍 [mobile-rn] ja.json 中文简体残留(blocking,常用汉字表精确判据)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ja', '--target=mobile-rn'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/mobile-rn/", "scripts/joyo-kanji.json", "scripts/brand-glossary.json"],
  },
  {
    id: '2f-ext',
    label: '🌐 [extension] i18n 键完整性(blocking,2026-09-28 由 warn 升档)',
    script: 'check-i18n-keys.mjs',
    args: ['--target=extension'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/extension/", "packages/i18n/messages/shared/"],
  },
  {
    id: '2f-shared',
    label: '🌐 [shared] i18n 键完整性(blocking,零变更验证通过)',
    script: 'check-i18n-keys.mjs',
    args: ['--target=shared'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/shared/"],
  },
  {
    id: '2g-ext',
    label: '🔍 [extension] zh-TW 简体字残留(blocking,2026-09-28 由 warn 升档)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['zh-TW', '--target=extension'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/extension/", "scripts/brand-glossary.json"],
  },
  {
    id: '2h-ext',
    label: '🔍 [extension] ko.json 中文残留(blocking,2026-09-28 由 warn 升档)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ko', '--target=extension'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/extension/", "scripts/brand-glossary.json"],
  },
  {
    id: '2i-ext',
    label: '🔍 [extension] en.json 破碎英文(blocking,2026-09-28 由 warn 升档)',
    script: 'check-i18n-broken-en.mjs',
    args: ['--target=extension'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/extension/"],
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
    stagedTriggers: ["packages/i18n/messages/shared/", "scripts/brand-glossary.json"],
  },
// 〈原 8 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l779(门 103 C1 收口)〉首意: --- 2026-10-05 补:zh-TW / ko 的**分面射程** —— 此前这两个 blocking 档只守
  {
    id: '2p-api',
    label: '🔍 [api] zh-TW 简体字残留(blocking,2026-10-05 补分面射程)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['zh-TW', '--target=api'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/api/", "scripts/brand-glossary.json"],
  },
  {
    id: '2q-cli',
    label: '🔍 [cli] zh-TW 简体字残留(blocking,2026-10-05 补分面射程)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['zh-TW', '--target=cli'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/cli/", "scripts/brand-glossary.json"],
  },
  {
    id: '2r-miniapp-taro',
    label: '🔍 [miniapp-taro] zh-TW 简体字残留(blocking,2026-10-05 补分面射程)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['zh-TW', '--target=miniapp-taro'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/miniapp-taro/", "scripts/brand-glossary.json"],
  },
  {
    id: '2s-mobile-rn',
    label: '🔍 [mobile-rn] zh-TW 简体字残留(blocking,2026-10-05 补分面射程)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['zh-TW', '--target=mobile-rn'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/mobile-rn/", "scripts/brand-glossary.json"],
  },
  {
    id: '2t-api',
    label: '🔍 [api] ko.json 中文残留(blocking,2026-10-05 补分面射程)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ko', '--target=api'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/api/", "scripts/brand-glossary.json"],
  },
  {
    id: '2u-cli',
    label: '🔍 [cli] ko.json 中文残留(blocking,2026-10-05 补分面射程)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ko', '--target=cli'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/cli/", "scripts/brand-glossary.json"],
  },
  {
    id: '2v-miniapp-taro',
    label: '🔍 [miniapp-taro] ko.json 中文残留(blocking,2026-10-05 补分面射程)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ko', '--target=miniapp-taro'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/miniapp-taro/", "scripts/brand-glossary.json"],
  },
  {
    id: '2w-mobile-rn',
    label: '🔍 [mobile-rn] ko.json 中文残留(blocking,2026-10-05 补分面射程)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ko', '--target=mobile-rn'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/mobile-rn/", "scripts/brand-glossary.json"],
  },
  {
    id: '2k-shared',
    label: '🔍 [shared] ko.json 中文残留(blocking)',
    script: 'scan-i18n-zh-residue.mjs',
    args: ['ko', '--target=shared'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/shared/", "scripts/brand-glossary.json"],
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
    stagedTriggers: ["packages/i18n/messages/shared/"],
  },
  {
    id: '2f-shared-diff',
    label: '🌐 [shared] i18n AI 翻译流水线(blocking)',
    script: 'i18n-diff.mjs',
    args: ['--target=shared'],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/shared/"],
    onFailHint: [
      '',
      '  💡 shared/zh-CN.json 有改动但 i18n pending 非空,请先跑翻译流水线:',
      '     1. node scripts/i18n-diff.mjs --target=shared  (检测差异,生成 pending 清单)',
      '     2. AI agent 翻译 → .ihui-agent/tmp/i18n-translations.json',
      '     3. node scripts/i18n-apply.mjs --target=shared --check-first  (先对账再应用翻译)',
      '     4. node scripts/check-i18n-keys.mjs --target=shared  (验证 parity)',
      '     5. git add packages/i18n/messages/shared/{en,ja,ko,zh-TW}.json 重新 commit',
      '',
    ].join('\n'),
  },
// 〈原 12 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l877(门 103 C1 收口)〉首意: --- 2n-web (2026-07-26 新增,web 端 5 语言 i18n parity 强制校验, warn-only 起步 1 周后升级 blocking) ---
  {
    id: '2n-web',
    label: '🌐 [web] 5 语言 i18n parity 强制校验 (blocking,2026-08-02 升级,兜底 item 2 漏检场景)',
    script: 'check-i18n-keys.mjs',
    args: ['--parity-only'],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
    // 2026-09-21 补应急通道(与其余 10+ 门的 HUSKY_SKIP_* 惯例对齐,此前遗漏):
    // 本项 --parity-only 是"每次 commit 都跑全量 parity",且 parity 漂移**没有** WIP 降级
    // 通道(check-i18n-keys.mjs 的 wipMissingKeyIssues 只覆盖 missing key,不覆盖 parity)。
    // 后果:只要工作区存在"并发会话新增 zh-CN 键、4 语言尚未补齐"的未提交 WIP,
    // --- 即使本次提交完全不含 packages/i18n/** --- 全仓 commit 一律被阻塞(实测 2026-09-21)。
    // 应急放行:HUSKY_SKIP_I18N_PARITY=1 git commit ...(commit message 写明责任归属)
    skipEnv: 'HUSKY_SKIP_I18N_PARITY',
  },
// 〈原 8 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l903(门 103 C1 收口)〉首意: --- 2f-mobile-rn (2026-07-28 新增,mobile-rn 端 5 语言 i18n parity 守门) ---
  {
    id: '2f-mobile-rn',
    label: '🌐 mobile-rn i18n parity 守门(blocking,2026-09-28 由 warn 升档;立票 2026-07-28)',
    script: 'check-i18n-keys.mjs',
    args: ['--target=mobile-rn', '--parity-only'],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
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
    stagedTriggers: ["packages/i18n/messages/cli/"],
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
    stagedTriggers: ["apps/api/src/routes/"],
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
    stagedTriggers: ["PROJECT_PLAN.md"],
  },
  {
    id: '19',
    label: '⚠️  staged 污染预警(warn-only)',
    script: 'check-staged-pollution.mjs',
    args: [],
    mode: 'warn',
    stagedTriggers: ["**/*"],
  },
  {
    id: '21',
    label: '🌐 多端同步开发守门(warn-only)',
    script: 'check-multi-end-sync.mjs',
    args: [],
    mode: 'warn',
    stagedTriggers: ["**/*"],
  },
  {
    id: '22',
    label: '📖 README 同步守门(warn-only)',
    script: 'check-readme-sync.mjs',
    args: [],
    mode: 'warn',
    stagedTriggers: ["**/*"],
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
    stagedTriggers: ["**/*"],
  },

  // --- 31 (2026-07-26 新增,2026-08-19 删除) ---
  // ID 31 verify-auth-shell 已废弃(迁移 shim,实际检查由 verify-shared-auth.mjs 11 项接管)
  // 删除理由:verify-shared-auth.mjs 已在 §22 SOP 阶段成为 shared/auth 真实守门入口,
  //   原 verify-auth-shell.mjs 只是兼容 shim,2026-08-19 完成迁移后无任何 caller 依赖,
  //   删 file + guardian-runner 注册项,守卫器序列号顺延(2026-08-19 节点)
  //   留空占位:不重新分配 id,避免历史 commit log / AGENTS.md §22 引用断裂。

  // --- 34 (2026-07-26 新增,@ts-ignore 新增检测,防历史遗留复发) ---
  // id '34'(@ts-ignore/@ts-nocheck 增长):定级/成因散文已整段逐字归档到 `.ihui-agent/archive/guardian-runner-comments-pre-6000-2026-10-14.md`(2026-10-15 二次腾行,守门 103 C1 单文件 6000 行上限;
  // 机主拍板出路 = 归档注释腾行,不调阈值不拆注册表)。升档史与 id 占号说明。
  {
    id: '34',
    label: '🔍 @ts-ignore 新增检测(blocking:存量已清零,只拦 staged 新增)',
    script: 'check-ts-ignore.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
    onFailHint: [
      '',
      '  💡 @ts-ignore 是类型安全压制,本仓库刚清理 215 处历史遗留',
      '     请审视是否真的需要,或改用 e2e/tsconfig.json 独立配置',
      '     跳过白名单:e2e/ / node_modules/ / dist/ / .next/ / build/',
      '',
    ].join('\n'),
  },

  // --- 33 (2026-07-26 新增,LLM provider 字典化阶段 3 主体 blocking 守门) ---
  // LLM_PROVIDERS schema 对账门:定级/成因散文已整段逐字归档到 `.ihui-agent/archive/guardian-runner-comments-pre-6000-2026-10-14.md`(2026-10-15 二次腾行,守门 103 C1 单文件 6000 行上限;
  // 机主拍板出路 = 归档注释腾行,不调阈值不拆注册表)。阶段 3 定级史与校验规则复述。
  {
    id: '33',
    label: '🛡️  LLM provider schema 守门 (blocking,阶段 3 主体已落地)',
    script: 'check-llm-provider-schema.mjs',
    // 射程收窄(2026-10-17):本门判的是 apps/ai-service/.env 这个 **gitignored 机器态文件**,
    // 与提交内容无因果关系;无条件挂上 = §12e 恒红门(.env 缺失时任何提交都被堵)。
    // 与门 208 同型:只在暂存区触及本域路径时才跑,判据一字未改。
    stagedTriggers: ['apps/ai-service/'],
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

// 〈原 10 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1051(门 103 C1 收口)〉首意: --- 42 (2026-08-12 新增,React SyntheticEvent 闭包陷阱守门,AGENTS.md §42 配套) ---
  {
    id: '42',
    label: '🛡️  React SyntheticEvent 闭包陷阱(防 popover 常驻显示复发)',
    script: 'check-event-closure-leak.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
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
    // 2026-10-03 补齐:门体头注写着 `HUSKY_SKIP_ROOT_DIR_GUARD`,runner 从未声明 ⇒ 假逃生舱
    // (同 30a,照 TAGSVIEW_GUARD 的修法)。本门尤甚:它的 `--staged` 档靠 `git ls-files` 取索引面,
    // 而本机 Node 间歇性 spawnSync git EBUSY ⇒ 取不到就按自己注释里的退路「退回全量拦截」,
    // 把本机若干**未跟踪**目录算成本枚提交引入。没有逃生舱就只剩 --no-verify 一条路。
    skipEnv: 'HUSKY_SKIP_ROOT_DIR_GUARD',
    mode: 'blocking',
    stagedTriggers: ["**/*"],
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
    stagedTriggers: ["apps/web/src/", "apps/web/app/"],
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
    stagedTriggers: ["**/*"],
    onFailHint: [
      '',
      '  💡 已有跟踪文件缺失/损坏溯源水印,且自动补齐未能达标(通常 = 缺口 > 200 个, 或类型不可注入)。',
      '     CI 会因 Provenance watermark check 失败,请先修复。修复出路按判定面给,inject 完≠修好(G-866):',
      '     --staged(提交档): node scripts/watermark.mjs inject <file> && git add <file>(提交带走的是索引 blob,必须 add 回索引)',
      '     HEAD 面(全量/push-gate): inject 只写工作区 —— 必须 git add <file> 后随下一枚提交带上;不提交 = 欠账还在,门照红',
      '     --worktree(人工逃生舱): inject 写到盘上即达标,无后续动作',
      '     退出码 2 = 取不到被审面「未判定」,不是"没水印";列出全部缺口: node scripts/watermark.mjs list-uncovered',
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
    stagedTriggers: [".github/workflows/"],
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
    stagedTriggers: ["packages/database/drizzle/", "**/*.sql"],
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
    stagedTriggers: ["apps/web/next-env.d.ts"],
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
    stagedTriggers: ["packages/types/src/capability-catalog.ts", "packages/types/generated/capabilities.json", "apps/api/src/routes/"],
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
    stagedTriggers: ["**/*"],
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
  // id '53'(admin gate 一致性):定级/成因散文已整段逐字归档到 `.ihui-agent/archive/guardian-runner-comments-pre-6000-2026-10-14.md`(2026-10-15 二次腾行,守门 103 C1 单文件 6000 行上限;
  // 机主拍板出路 = 归档注释腾行,不调阈值不拆注册表)。warn→blocking 的两个前置取证叙述。
  {
    id: '53',
    label: '🛡️  admin 面特权判定一致性(blocking,O13b roleId>=1 收敛)',
    script: 'check-admin-gate-consistency.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["apps/api/src/", "packages/types/src/capability-catalog.ts"],
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

// 〈原 7 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1316(门 103 C1 收口)〉首意: --- 54 (2026-09-21 新增,B14 未提交源码改动「年龄」守门,warn 级起步) ---
  {
    id: '54',
    label: '⏳ 未提交源码改动年龄守门(warn-only,B14 防工作树改动被并行 checkout 抹掉)',
    script: 'check-uncommitted-age.mjs',
    args: [],
    mode: 'warn',
    stagedTriggers: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs", "**/*.py", "**/*.css", "**/*.sql"],
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
    stagedTriggers: ["apps/ai-service/app/services/mcp_server.py", "packages/shared/src/chat/tool-display.ts", "packages/i18n/messages/shared/"],
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
    stagedTriggers: ["packages/i18n/messages/"],
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
    stagedTriggers: ["**/*"],
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
    stagedTriggers: ["packages/i18n/messages/", "scripts/data/zh-term-glossary.json"],
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
    stagedTriggers: ["packages/shared/src/chat/tool-display.ts", "packages/i18n/messages/shared/", "scripts/data/tool-activity-coverage.json"],
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
    stagedTriggers: ["packages/shared/src/chat/", "packages/i18n/messages/", "scripts/gen-i18n-compressed.mjs", "apps/miniapp-taro/src/i18n/generated/"],
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

// 〈原 10 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l1505(门 103 C1 收口)〉首意: --- 62 (2026-09-22 接入 pre-commit,NSIS 安装器模板漂移守门,blocking) ---
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
    // 2026-10-22 G-966:packages/app/src(共享登录屏层)并入扫描射程,注册面射程同步跟上,
    // 否则该层的暂存提交根本不触发本门。
    stagedTriggers: [
      'apps/web/app/',
      'apps/web/src/components/',
      'apps/web/src/hooks/',
      'packages/ui-react/src/',
      'packages/shared/src/',
      'packages/app/src/',
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
  //   几何圆(头像/装饰点/胶囊)由盒形量证(正方+半边=真圆出射程,非正方+半边=胶囊判红)。豁免标记族已于 2026-09-29 O81 票㊵ 整体废除,写它由 B8 判红。存量走 HEAD 棘轮只减不增。
  {
    id: '77',
    label: '📐  圆角单一源头对账(blocking,全 8 端:档位表一致 + 端内取用必须引用档位)',
    script: 'check-radius-single-source.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
    skipEnv: 'HUSKY_SKIP_RADIUS_GUARD',
    onFailHint: [
      '',
      '  💡 圆角档位唯一真相源 = packages/design-tokens/src/radius.js(xs2/sm4/md6/lg8/xl12/2xl16)。',
      '     RN/内联 style : borderRadius: rnRadius.lg      (import { rnRadius } from \'@ihui/design-tokens\')',
      '     CSS/SCSS      : border-radius: var(--radius-lg)',
      '     类名          : rounded-lg(禁止 rounded-[24rpx] 这类任意值)',
      '     真圆/头像/胶囊: 用 size/2 几何表达式或等于档位值的档;项目不允许胶囊,也没有豁免标记 —— 写标记本门 B8 判红',
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
    stagedTriggers: ["**/*"],
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
      '     品牌 CTA 的唯一写法(AGENTS §4,2026-09-26 回翻):backgroundColor/borderColor = brand.cta,',
      '     其上文字 = brand.ctaForeground(等价 web 的 --color-cta + --color-cta-foreground;',
      '     亮=纯黑底/白字,暗=纯白底/黑字,与 --color-primary 同一明暗行为);**不得再立 brand.ctaFill/ctaText',
      '     这类端内档 —— 2026-09-24 已删,理由:浅色=web primary、深色=brand-accent 的混血档让同一语义三端三个值。**',
      '     要调主按钮观感,改 tokens.css 的 --color-cta(亮)与 .dark --color-cta(暗)一处,三端一起动。',
      '',
      '     定位:node scripts/check-cross-end-tokens.mjs --list(看映射与依据)',
      '     自检:node scripts/check-cross-end-tokens.mjs --self-test(8 例正反对照)',
      '     紧急跳过(不推荐):HUSKY_SKIP_CROSS_END_TOKENS=1 git commit ...',
      '',
    ].join('\n'),
  },
// 〈原 7 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2018(门 103 C1 收口)〉首意: 主题接线对账(2026-09-24 立)。起因是真机实测:广场页顶栏/底栏 #1a1a1a 而正文
  {
    id: '91',
    label: '🌗 主题接线对账(blocking,theme-driven 共享组件必须拿到调用方解析出的主题)',
    script: 'check-theme-prop-wiring.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["packages/app/src/", "apps/mobile-rn/src/", "apps/desktop/src/", "apps/cli/src/"],
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
    stagedTriggers: ["apps/api/src/routes/", "apps/api/src/server.ts", "apps/api/scripts/export-openapi.ts", "apps/api/openapi.json", "packages/types/generated/capabilities.json"],
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
    stagedTriggers: ["**/*"],
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
    stagedTriggers: ["apps/mobile-rn/src/", "packages/app/src/", "apps/web/", "packages/ui-react/", "apps/miniapp-taro/"],
    skipEnv: 'HUSKY_SKIP_BRAND_FOREGROUND',
    onFailHint: [
      '',
      '  💡 R1(同一 style 块内 brand.DEFAULT / brand.cta 背景 + surface.light/text.primary 字)= 深色下白底白字;',
      '     R4(2026-09-24 补,**兄弟 key** 之间的同一缺陷):底在 `retryBtn`、字在 `retryText` ——',
      '        RN 的 StyleSheet 天然把按钮底和它的文字拆成两个 key,所以 R1 的同块判据',
      '        对这类结构性缺陷全程沉默,PlazaScreen 四个 1.06:1 黑压黑按钮因此 shipped 到真机。',
      '        R4 用**名字**配对(X/XText、XBtn|XButton 与 XBtnText|XButtonText、X/XLabel,顺序无关),',
      '        不用行距滑窗 ⇒ 不会误伤不相干的相邻样式。',
      '     唯一正解(AGENTS §4,2026-09-26 用户定稿回翻):品牌实底 + 其上文字一律成对写 brand.cta +',
      '        **brand.ctaForeground**(= web 的 --color-cta / --color-cta-foreground;亮=纯黑底/白字,暗=纯白底/黑字);',
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
// 〈原 7 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2115(门 103 C1 收口)〉首意: 反回退守门(2026-09-23 立)。成因实测:共享工作区 + converge 只推进 HEAD/index 不 checkout,
  {
    id: '84',
    label: '🧬 反回退守门(blocking,暂存内容等于历史版本 = 静默回滚他人改动)',
    script: 'check-stale-revert.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
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
    stagedTriggers: ["**/package.json", "pnpm-workspace.yaml"],
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

// 〈原 10 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2183(门 103 C1 收口)〉首意: 热路径 git 只读调用超时封顶(2026-09-23 立,守门 80)。成因实测:check-port-registry 里
  {
    id: '80',
    label: '⏱  热路径 git 只读调用必须带 timeout(blocking,拦无界挂起拖死守门链)',
    script: 'check-git-read-timeout.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: [".husky/", "scripts/"],
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

// 〈原 9 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2213(门 103 C1 收口)〉首意: 提交内容含 Git 冲突标记(2026-09-23 立)。成因实测:.git 被宿主清除后的恢复期,某会话在
  {
    id: '79',
    label: '🔀 提交内容含 Git 冲突标记(blocking,成对 <<<<====>>>> 标记一旦入树即拦)',
    script: 'check-no-conflict-markers.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
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

  // id '81'(品牌邮件通道对账):定级/成因散文已整段逐字归档到 `.ihui-agent/archive/guardian-runner-comments-pre-6000-2026-10-14.md`(2026-10-15 二次腾行,守门 103 C1 单文件 6000 行上限;
  // 机主拍板出路 = 归档注释腾行,不调阈值不拆注册表)。立因叙述与"范围与 stagedTriggers 必须同步扩"。
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
    stagedTriggers: ["apps/"],
    // 该脚本自身默认 warn-only(有警告也 exit 0),--strict 才阻断 ⇒ 放 CI 用 --strict。
    // 这里保持 warn:§25 的原意是"提示层",升 blocking 会拦掉合法的 scripts/e2e-* 长期脚本。
  },
  {
    id: '87',
    label: '🈳 语言包文件存在性与合法性对账(blocking,40 项清单,补装)',
    script: 'check-i18n-messages-exist.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["packages/i18n/messages/", "apps/miniapp-taro/src/i18n/", "apps/mobile-rn/src/i18n/", "apps/extension/src/i18n/", "apps/cli/src/i18n/"],
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
    stagedTriggers: ["scripts/", ".husky/", "package.json", ".github/workflows/", "AGENTS.md", "README.md", "docs/"],
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

// 〈原 7 行注释已逐字归档 .ihui-agent/archive/scripts-comment-archive-2026-10-26.md#guardian-l2379(门 103 C1 收口)〉首意: C 盘污染实地扫描(2026-09-23 立,守门 90,warn-only)。成因:§15/§26 的三道旧门没有
  {
    id: '92',
    label: '💽 C 盘污染实地扫描(warn,拦"源码没写死但东西真掉在 C 盘")',
    script: 'check-c-drive-pollution.mjs',
    args: [],
    mode: 'warn',
    stagedTriggers: ["**/*"],
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
    stagedTriggers: ["**/*"],
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

  // 96 check-home-junction-integrity.mjs 的立门因由/事故史/定级史逐字归档:.ihui-agent/archive/guardian-runner-comments-pre-6000-2026-10-15.md#b1(§1 两步归档;C1 上限腾行,判据字段一字未动)
  {
    id: '96',
    label: '🏠 §26 家目录改道完整性(warn,机器态与 diff 无关 ⇒ 不拦提交链,回潮即打红字)',
    script: 'check-home-junctions.mjs',
    args: [],
    mode: 'warn',
    stagedTriggers: ["**/*"],
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
    // 落地后复跑档必须以锚点档跑本门(本门支持 --rev/--anchor,判"相对上一枚是否新增"):
    // 不带锚点 ⇒ HEAD 上 16 条存量被算成本枚新增,每次旁路落地都判红一次 —— 那是逼人设
    // IHUI_LAND_SKIP_AFFECTED_GATES=1 的恒红臂(§12e),而落地前那一跑本来就是带锚点的,
    // 两跑口径不一致才是这次的病根。CI/pre-commit 的 --staged 档不受此字段影响。
    rerunAnchor: true,
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
    stagedTriggers: ["**/*"],
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
    stagedTriggers: ["**/*"],
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
      '     位移取证(引用被 update-ref 侧移、没有合并提交可审那一型):',
      '     单独复验:node scripts/check-merge-addition-loss.mjs --move <from>..<to>(G-939 原案 = 72b3a20c50..588a6342d8)',
      '     巡检档另带位移游标(A4):node scripts/check-merge-addition-loss.mjs --all-new —— 每枚新于游标的位移判恰好一次,',
      '     提交链窗口档只看最近 40 条(本仓实测 ≈53 分钟),旁路落地不跑钩子时靠这一档兜住滑出窗口的那一段。',
      '     自检:node scripts/check-merge-addition-loss.mjs --self-test(48 例,真临时仓;含生成块剥离正反两臂)',
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
    stagedTriggers: ["**/*"],
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
      '     自检:node scripts/check-lock-manifest-consistency.mjs --self-test(例数以命令末行现读为准,含 R6 段位置成对正反例与三面判定端到端)',
      '     镜像测试:node --test scripts/tests/check-lock-manifest-consistency.test.mjs(例数同上,含真历史 blob 阳性对照与 runner 装车证明)',
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
      '     自检:node scripts/check-glyph-arrow-icon.mjs --self-test(例数以其末行现读为准,不在本文钉数;含阳性对照与棘轮四向)',
      '     镜像测试:node --test scripts/tests/check-glyph-arrow-icon.test.mjs(例数以其末行现读为准,不在本文钉数;含装车证明)',
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
    stagedTriggers: ["**/*"],
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

  // 104 check-prod-bundle-shadow.mjs 的立门因由/事故史/定级史逐字归档:.ihui-agent/archive/guardian-runner-comments-pre-6000-2026-10-14.md#b2(§1 两步归档;C1 上限腾行,判据字段一字未动)
  {
    id: '104',
    label: '🧬 prod-bundle 影子副本对账(blocking,入库源 ↔ 生产实际执行的那份逐字节等值)',
    script: 'check-prod-bundle-shadow.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
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
  // 105 check-miniapp-generated.mjs 的立门因由/事故史/定级史逐字归档:.ihui-agent/archive/guardian-runner-comments-pre-6000-2026-10-14.md#b3(§1 两步归档;C1 上限腾行,判据字段一字未动)
    label:
      '🧩 小程序+四端派生产物对账(blocking;离线语言包/图标/位图/四端 AI 可导航路由是否落后于源;孤儿与动态路径只报数不判红)',
    script: 'check-miniapp-generated.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
    skipEnv: 'HUSKY_SKIP_MINIAPP_GENERATED',
    onFailHint: [
      '',
      '  💡 判据六组:',
      '     R1 漏生成/引用断链 —— 源码引用的产物文件面上查无 ⇒ 报出引用方;',
      '     R2 孤儿/死资源 —— 产物目录里没有任何静态引用(默认只报数,--strict 判红;删文件属 §7 须人工确认);',
      '     G3 图标词表与 svg 目录的对账(图标源已外置,77/78 键无同名 svg 是**既有事实**,本条永不判红);',
      '     I2 LineIcon 调用点「值→键」(G-415/A8):name 值位字面量不在 icons.ts 注册表 ⇒ 判红(各面同权);',
      '        逃逸写法(as 断言/尾部 !)按该文件 HEAD 存量套棘轮,只在 --staged 拦新增,HEAD/worktree 只报数;',
      '     G5/U1 四端 ui-routes 自述钉(G-816040):web/mobile-rn/miniapp-taro/extension 的 ui-routes.generated.ts;',
      '        钉 ≠ 现算输入哈希 ⇒ 陈旧判红;钉 absent/malformed ⇒ 未判定(只报数);钉 matched ⇒ 名集对账,',
      '        源侧派生集与产物解析集不等 ⇒ U1 判红逐条报名(RN 不镜像派生,只判钉);',
      '     动态拼接的资源路径一律计入「判不了但如实数」,绝不静默当零违规。',
      '',
      '     重新生成:node apps/miniapp-taro/scripts/gen-line-icons.mjs / gen-tabbar-icons.mjs',
      '                node scripts/gen-taro-lucide-icons.mjs <name>;离线语言包 pnpm --filter @ihui/miniapp-taro gen:i18n',
      '                四端 ui-routes:node apps/web/scripts/generate-ui-routes.mjs / apps/mobile-rn/scripts/generate-ui-routes.mjs',
      '                / apps/miniapp-taro/scripts/generate-ui-routes.mjs / apps/extension/scripts/generate-ext-ui-routes.mjs',
      '     自检:node scripts/check-miniapp-generated.mjs --self-test(32 例含成对正反)',
      '     定位:node scripts/check-miniapp-generated.mjs --group tabbar|icons|i18n|assets|ui-routes 单组排查',
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
    stagedTriggers: ["packages/design-tokens/src/styles/tokens.css", "apps/extension/entrypoints/content.ts", "apps/extension/entrypoints/content/content-toolbar.tsx", "packages/ui-react/src/styles/auth-shell.css"],
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
    stagedTriggers: ["**/*"],
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
    stagedTriggers: ["**/*"],
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
    label: '🔒 任务认领租约对账(blocking,CL1 过期租约/CL2 缺持有者/CL3 翻勾未摘牌/CL4 新增裸「（进行中）」;四档同用 HEAD 存量棘轮,只拦本次带进来的)',
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
    stagedTriggers: ["apps/miniapp-taro/"],
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
      '     自检:node scripts/check-artifact-budget.mjs --self-test(39 条断言,连跑两次须同结论)',
      '     镜像测试:node --test scripts/tests/check-artifact-budget.test.mjs(21 例,含"接了提交链就必须同时有 CI 调用点"的防退化断言)',
      '     AB3 单分包尺寸(2026-10-26 加):微信对**每个分包**同样有 2 MiB 硬上限,只判主包等于',
      '     把会坏的那一格留在盲区 —— 实测 78 枚壳承载页只让主包涨 46 KB,pkg-user 却到 3,769,041 B',
      '     (超 1.8 倍,上传必拒),而主包口径与 CI 全绿。逐包超限即判红(含独立分包)。',
      '     AB4 整档总量(同日加):微信对**整档**还有 20 MiB 上限。实测落完 219 屏后合计 18,016,705 B(86%),',
      '     只判逐包会漏"每个包都装得下、整档传不上去"那一型 ⇒ 破 90% 水位即判红(造页器的总量水位在 88%,停在红线之前)。',
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
    stagedTriggers: ["**/*"],
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
      '     (**enforce 档已实现,但默认档必须是 off**:未被执行过的描述一旦变成默认拒绝,就是运行时版恒红事故)。',
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
    stagedTriggers: ["apps/api/src/", "apps/cli/src/provider/"],
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
    stagedTriggers: ["scripts/", "packages/shared/src/utils/ip-literal.ts", "apps/cli/tests/ssrf-outbound.test.ts"],
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
      '  💡 本仓最高频失效型"造好没装车":声明了保留期/预算契约/清理函数/导出工厂,',
      '     却没有任何生产面消费者(注释、字符串、纯 re-export、测试面、scripts 层都不算消费者)。',
      '     候选族含 C7 工厂族(导出 create*Handler / create*Transport,G-816034 ①②)——',
      '     零生产调用方只报数并逐条点名 file:line,升 blocking 的前置 = 存量清零(§12e)。',
      '     存量/候选/自检/镜像的数**一律跑命令现读**,本提示不钉数字(钉了就是一份会腐烂的假账)。',
      '     棘轮锚点=该文件 HEAD 自身未接线数;新增即红。全量判 HEAD blob、--staged 判索引、取不到 exit 2。',
      '     单独复验:node scripts/check-declared-policy-has-consumer.mjs',
      '     问责档:node scripts/check-declared-policy-has-consumer.mjs --strict',
      '     自检:--self-test  镜像:node --test scripts/tests/check-declared-policy-has-consumer.test.mjs',
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
    stagedTriggers: ["apps/api/src/", "apps/ai-service/app/"],
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
  {
    id: '128',
    label:
      '🪞 跨端 UI 差异账对账(blocking,同名配对组件的小程序/RN 可见几何档只减不增 —— 重复实现就是"改一端另一端不跟随"的根因)',
    script: 'check-cross-end-ui-parity.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_CROSS_END_UI_PARITY',
    stagedTriggers: [
      'apps/miniapp-taro/src/components/',
      'packages/app/src/components/',
      'packages/app/src/features/',
      'apps/mobile-rn/src/components/',
      'scripts/check-cross-end-ui-parity.mjs',
      'scripts/cross-end-ui-parity-baseline.json',
    ],
    onFailHint: [
      '',
      '  💡 本门拦的是"两端差异变大",不是"两端有差异"。台账钉着 HEAD 读数,与本次改动无关的存量不会拦你。',
      '     ① 看差在哪:node scripts/check-cross-end-ui-parity.mjs 逐条点名(仅小程序档 / 仅 RN 档 / 同名常量不同值);',
      '     ② 唯一正确的收口姿势 = 让两端取**同一份源**(packages/shared 的平台无关组件源 + 每端注入 primitives adapter);',
      '     ③ 禁止给单端补一个数字去凑平 —— 那只是把第二份真相挪了个位置,下次又漂;',
      '     ④ 确属平台导致(原生导航栏/输入法/状态栏):在台账 waivers 里写 reason,由守门 108 管到期,不得静默。',
      '',
    ]
  },
  {
    id: '237',
    label:
      '🧭 跨端页面覆盖对账(blocking,共享屏→小程序镜像数与 RN 下沉数只增不减 —— 拦「RN 加页面、小程序不跟随」这类分叉回潮)',
    script: 'check-cross-end-screen-coverage.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_CROSS_END_SCREEN_COVERAGE',
    stagedTriggers: [
      'packages/app/src/features/',
      'packages/app/src/components/',
      'apps/mobile-rn/src/screens/',
      'apps/miniapp-taro/src/',
      'scripts/check-cross-end-screen-coverage.mjs',
      'scripts/data/cross-end-screen-registry.json',
    ],
    onFailHint: [
      '',
      '  💡 本门是「两端一模一样」的正向推进尺:存量只报数,**只拦本次带进来的倒退**(§12e)。',
      '     ① 看缺口在哪:node scripts/check-cross-end-screen-coverage.mjs(结论行自带"共享屏被小程序显式镜像 x/N",N 由门体现读,别在提示里钉死计数 —— §0.1);',
      '     ② 小程序页声明对齐目标,只需在文件顶部写一行注释:',
      '        // 对齐目标(RN 共享屏): packages/app/src/features/<domain>/<Name>Screen.tsx',
      '     ③ 禁止靠删条目或改判据去消红 —— 那是把尺子锯短,不是收口;棘轮锚点是 HEAD 面(无基线文件可维护),确需放行时用 skipEnv 并把理由写进提交信息;',
      '     ④ 「小程序端没有这一页」≠ 缺口:本门把无标记的记为**未判定**,既不记已对齐也不判红。',
      '',
    ]
  },
  {
    id: '251',
    label:
      '🧱 RN 兼容层覆盖面对账(blocking,小程序复用共享屏/RN 壳的"能不能编过"三维 —— 缺一名即整屏运行期炸,而 babel 构建照样绿)',
    script: 'check-rn-compat-coverage.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_RN_COMPAT_COVERAGE',
    stagedTriggers: [
      'apps/miniapp-taro/src/rn-compat/',
      'apps/miniapp-taro/src/app.config.ts',
      'apps/miniapp-taro/config/',
      'packages/app/src/',
      'apps/mobile-rn/src/',
      'scripts/gen-rn-compat.mjs',
      'scripts/check-rn-compat-coverage.mjs',
    ],
    onFailHint: [
      '',
      '  💡 本门判的是覆盖面,不是观感:消费面(packages/app + apps/mobile-rn)从 react-native /',
      '     lucide-react-native 具名取用的全集,必须在 src/rn-compat 出口或生成物里真在册。',
      '     ① C1 缺标识符 ⇒ 在 apps/miniapp-taro/src/rn-compat 补出口(值档补实现、类型档补类型位,',
      '        两者缺一分别炸运行期与 tsc);',
      '     ② C2 缺图标 ⇒ 跑 `node scripts/gen-rn-compat.mjs --write`(名字全集按 HEAD 面现算,不需要人工登记);',
      '     ③ C3 路由映射指向不在册页 ⇒ 同上重生成(映射由导航器登记 ∩ 跨端登记表 join 得出)。',
      '     绝对零容忍:兼容层的缺口没有"存量合理"这一说 —— 补上即绿,禁止为消红放宽判据(§12e)。',
      '     自检:node scripts/check-rn-compat-coverage.mjs --self-test(6 例,含摘掉即翻红)',
      '',
    ]
  },
  {
    id: '252',
    label:
      '📦 workspace 包 exports 条件真值对账(blocking,子路径必须对 CJS 解析条件可达 —— 缺 default 就是小程序/CI 构建当场红)',
    script: 'fix-package-exports-conditions.mjs',
    args: ['--check'],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_PACKAGE_EXPORTS_CONDITIONS',
    stagedTriggers: [
      'packages/',
      'apps/',
      'scripts/fix-package-exports-conditions.mjs',
    ],
    onFailHint: [
      '  💡 判的是 exports 条件覆盖:只写 types+import 的子路径,对 webpack(require/module/production)' +
         '与 pnpm frozen install 都不可达(import 条件不等于 module/require)。',
      '     ① 看哪几条缺:node scripts/fix-package-exports-conditions.mjs --check;',
      '     ② 补(单向增覆盖面,不改既有条件、不删条目):node scripts/fix-package-exports-conditions.mjs --apply,',
      '     ② 补(单向增覆盖面,不改既有条件、不删条目):node scripts/fix-package-exports-conditions.mjs --apply,',
      '        并把所改 package.json 与本枚改动同提交;',
      '     ③ 判据本体:node scripts/fix-package-exports-conditions.mjs --self-test(5 例)。',
      '     禁止为消红放宽判据(§12e);存量已于 e91d8c38ed96 一次清零,故本门从第一天起绝对零容忍。',
    ]
  },
  {
    id: '253',
    label:
      '🧬 scripts 相对具名导入 ↔ 目标模块出口面真值对账(blocking,生产方被削出口那一型的唯一着力点 —— 消费方一字未动而守护当场起不来)',
    script: 'check-mjs-export-resolution.mjs',
    args: ['--staged'],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_MJS_EXPORT_RESOLUTION',
    stagedTriggers: ['scripts/'],
    onFailHint: [
      '  💡 两维:D1 = 本枚改动的文件里有人按名取用而目标不再导出;D2 = 本枚改动/删除的文件削掉了某个仍被按名取用的出口。',
      '     ① 看清单:node scripts/check-mjs-export-resolution.mjs --staged(全量档只报存量,不拦提交);',
      '     ② 修法二选一,不许两边都不选:',
      '        · 能力仍在用 ⇒ 把出口连实现补回生产方(逐字回补可参考 HEAD^ 面,补完 node --check + import 自证);',
      '        · 能力确已退役 ⇒ 同批把消费方的取用一起摘掉(删者须答 §7 三问,不得只删一半留个崩口)。',
      '     ③ 判据本体:node scripts/check-mjs-export-resolution.mjs --self-test(11 例,含 D2 正控/反向对照/新建面不判)。',
      '     立因实测:9fdbc207ba2e 删 lib/gitdir.mjs 的 brokenRefsFromSnapshot 而 git-guardian.mjs 未动 ⇒ 守护实例化期抛、任何档起不来,巡检腿全停。',
    ]
  },
  {
    id: '254',
    label:
      '🎨 RN 令牌表派生面 ↔ tokens.css 对账(blocking;值同步 + 覆盖面块落后都算漂移 —— 源改一处 RN 自动跟上,不跟上就拦在提交口)',
    script: 'sync-rn-tokens.mjs',
    args: ['--check', '--staged'],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_RN_TOKEN_DERIVATION',
    stagedTriggers: [
      'packages/design-tokens/',
      'scripts/sync-rn-tokens.mjs',
    ],
    onFailHint: [
      '  💡 判的是 rn-tokens.ts 的派生面落后于唯一源 packages/design-tokens/src/styles/tokens.css。',
      '     ① 看差在哪:node scripts/sync-rn-tokens.mjs --check;台账(逐档可派生/不可派生/拒绝/跳过):node scripts/sync-rn-tokens.mjs --list;',
      '     ② 修:node scripts/sync-rn-tokens.mjs(原位写回,幂等;含末端的 rnCssLight/rnCssDark 覆盖面块),',
      '        然后 pnpm --filter @ihui/design-tokens build(RN 读 dist,不重建则设备上毫无变化 —— 2026-10-20 实测四轮),',
      '        并把所改文件与本枚改动同提交;',
      '     ③ 判据本体:node scripts/sync-rn-tokens.mjs --self-test(41 例;J 族钉覆盖面块:遮蔽手抄档即跳 / 应用后幂等 / 源改值即落后 / 标记不齐拒写 / 水印仍在文件末)。',
      '     拒绝项(refusals)与语义分歧档属人工裁决,派生器不抹平;禁止为消红放宽判据(§12e)。',
    ]
  },
  {
    id: '256',
    label:
      '🌐 门户表↔端内词包不变量(blocking;门户表每个 webViewPortal.* titleKey 必须在两端×五语言十份词包里,且条目指向的 web 路由真存在)',
    script: 'check-web-portal-label-keys.mjs',
    args: [],
    mode: 'blocking',
    // 2026-10-28 立:存量现读 0(140 titleKey × 10 份词包 W1=0、W2=0、W3 116 条 path 全在位)⇒ 绝对零容忍,
    // 不是差值棘轮(§12e 升 blocking 前置=存量归零已满足)。缺任意一份词包时端上按约定回落中文 fallbackLabel,
    // 界面不报错、只是变成中文 —— 既有 i18n 门只判词包↔词包对齐,不知道门户表引用了哪些键,结构上判不到。
    skipEnv: 'HUSKY_SKIP_PORTAL_LABEL_KEYS',
    stagedTriggers: ['packages/shared/src/constants/web-portal.ts', 'packages/i18n/messages/'],
    onFailHint: [
      '  💡 修复出口:node scripts/add-web-portal-entries.mjs --routes-file <清单> --apply',
      '     手工补词包也行,但必须两端×五语言十份齐补;W3 红=条目指向的 web 路由不在被审面(点开即 404)。',
    ],
  },
  {
    id: '255',
    label:
      '🎨 端内写死源档色值拦新增(blocking;只按本枚改动的文件计数 —— 源里已有档却写回字面量,下一枚提交就拦在这里)',
    script: 'fix-rn-color-literals.mjs',
    args: ['--check', '--staged'],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_RN_COLOR_LITERAL_RATCHET',
    stagedTriggers: [
      'apps/mobile-rn/src/',
      'packages/app/src/',
    ],
    onFailHint: [
      '  💡 判的是 packages/app 与 apps/mobile-rn 里「对象字面量属性值上写了个等于源档的色字面量」。',
      '     ① 看清单:node scripts/fix-rn-color-literals.mjs(只读报告,含歧义/需主题两类队列);',
      '     ② 修:node scripts/fix-rn-color-literals.mjs --apply —— 机械改写 + 逐处 colorsAgree 自证,写完 pnpm --filter @ihui/design-tokens build;',
      '     ③ 确实要留在端内的(比如与源档只是巧合同值、或语义就是本地常量):在同文件加一行 handcopy-token-exempt: <原因>(门 93 R8 同族豁免,须带原因);',
      '     ④ 判据本体:node scripts/fix-rn-color-literals.mjs --self-test(11 例,T10 是拦新增的正反控)。',
      '     禁止为消红放宽判据(§12e);存量只报数,不由本门代裁。',
    ]
  },
  {
    id: '129',
    label:
      '🛡️ 提示注入登记对账(blocking,"以宿主名义进模型提示"的每段必须有登记的 producer 与记账出口;拦 登记没生产 / 生产没消费 / 裸 [系统提醒] 前缀 三型)',
    script: 'check-prompt-injection-registry.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_PROMPT_INJECTION_REGISTRY',
    stagedTriggers: ['apps/cli/src/', 'scripts/check-prompt-injection-registry.mjs'],
    onFailHint: [
      '',
      '  💡 本门拦的是"提示链断在登记与生产之间",不是"提示里有敏感词"。',
      '     ① 逐条看:node scripts/check-prompt-injection-registry.mjs(全量档判 HEAD blob);',
      '     ② 生产者缺失/造好没装车 → 把记账出口接回被登记 producer 的调用点(注释里的提及不算装车);',
      '     ③ 裸宿主前缀 → 改走 apps/cli/src/utils/prompt-boundary.ts 的 frameSystemReminder,不得再产出 [系统提醒] 字样;',
      '     ④ 禁止为消红放宽判据或另立豁免清单(该门判据输入全部由被审面自身推导,不留会腐烂的白名单)。',
      '',
    ]
  },
  // --- 任务状态一致性 (1 项, 2026-09-26 立) ---
  {
    id: '130',
    label:
      '🗂  任务状态分叉对账(blocking,差值棘轮:一次提交不得让"同一件事既已完成又挂着未勾"变多,不得带入没有交代的登记行,不得新增撞号组(F9,存量只报数),也不得把 HEAD 面已结清的登记行捣回未勾(F13 跨面对账,锚点=HEAD 面自身存量、存量只报数) —— 既有防护全在防丢,没有一道防错)',
    script: 'plan-tasks.mjs',
    args: ['--gate'],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_PLAN_TASK_STATE',
    stagedTriggers: ['PROJECT_PLAN.md', 'scripts/plan-tasks.mjs', 'scripts/lib/plan-task-index.mjs'],
    onFailHint: [
      '',
      '  💡 本门拦的是"这次改动让状态分叉变多",不是"文档里有存量分叉"。存量(F1/F2/F3)默认只报数。',
      '     F9 撞号(2026-09-27 G-267):同一编号挂 >1 个不同标题前缀即点名("编号 G-x 被 N 个不同标题共用")。',
      '     存量绝大多数是子项命名惯例(D30① 一族)⇒ F9 只报数、连 --strict 也不判红(防恒红门,§12e);',
      '     棘轮只拦**本次新增的撞号组**。修法:登记新任务前先取号(node scripts/plan-tasks.mjs --next-id G),',
      '     或把两行的标题改成逐字等值(那本来就该是 F1/F4 的同题副本)。禁止给编号加豁免清单(§4)。',
      '     为什么必须有:§1 让每个 agent 往计划文档追加登记,但文档**没有主键约束** ——',
      '     同一任务编号被不同批次各登记一次,做完时只翻自己那一批的那份,其余副本永久烂成"未勾选";',
      '     而既有防护链全部**单向防丢**(门 71 防丢行 / 84 防写回旧版 / 100 防合并吞文件 / 工作区自愈',
      '     把删掉的行原地恢复),没有一道门判"状态分叉";并集合并策略又是"每行重数取 max",',
      '     所以改写必然产出两份 —— 每天在产,账面全绿。',
      '     五条判据都不依赖行号顺序、也不依赖相似度:',
      '       F1 复合主键(编号 + 标题前缀,逐字等值)下 `- [x]` 与 `- [ ]` 并存;',
      '       F2 行首未勾选,但正文自带"判:已完成/裸副本/读数过期/勿照本行派单"这类闭合或作废声明;',
      '       F3 证据写成 `存活于 L<行号>` 而被指的行在当前面上已不是那条正题(行号一次 append 就挪位);',
      '       F4 同一复合主键下 ≥2 条未勾选(同一件活被派两遍,副本行不进派单口径);',
      '       F4b **没有编号**的逐字孪生待办 —— F4 的分组键是复合主键,而"叙述式待办"整族一辈子',
      '         没有编号,所以它们在 F4 里恒为 0 而账面照样一人两句(2026-09-27 实测 14 组全部隐身);',
      '       F6 **块级**量纲:≥3 行且每行 ≥40 字符的连续 bullet 块被逐字追加两遍 —— 行级四条对这一型',
      '         同时全绿(每行看起来都只是"又一个孪生行"),2026-09-26 实测自伤逼出来的一维。',
      '       F8 新增登记必须有**交代**(三选一:已认领租约 / 说清等什么或归谁 / 带可算日期),只判',
      '         **本次带进来的行**(差值档)。存量没交代的条数一律现读(`--undisposed`),不把数字写进',
      '         本文 —— 上线当天集体判红就是与任何提交都无关的恒红门(§12e)。到期档(超 21 天无进展)',
      '         默认只报数、--strict 才判红:',
      '         年龄现读自 git blame(scripts/lib/plan-line-age.mjs),不要求人在正文里维护第二个日期',
      '         —— 那 128 条无日期账在"只看行内日期"的口径下永远隐形,而补标记等于抢同一份活文档。',
      '     派单面另有**归属分层**(现在可做/等人拍板/等条件/归他人),按正文推导且刻意不扣行:',
      '         正则推错一条的代价是一件真活从此在任何清单里都不现身,那比虚高的数字更难发现。',
      '         只看"今晚就能做的":node scripts/plan-tasks.mjs --open --dispatchable',
      '     ① 看差在哪:node scripts/plan-tasks.mjs --forks / --void / --pointers;',
      '     ② 唯一正确修法 = **归并**(把副本行翻成已完成并注记归并到谁),不是删行(§1 禁止无声删除);',
      '     ③ 新登记的指针必须用**内容锚点**(编号 + 标题),不得写行号;',
      '     ④ 严禁为过门去 `--update-baseline` 抬高基线或削判据 —— 那等于关掉这一维。',
      '     单独复验:node scripts/plan-tasks.mjs --gate(全量档) / --staged --gate(本次提交档,含差值棘轮)',
      '     自检:node scripts/plan-tasks.mjs --self-test;镜像测试:node --test scripts/tests/plan-tasks.test.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_PLAN_TASK_STATE=1 git commit ...(会把别人的分叉塞进 HEAD)',
      '',
    ],
  },
  // --- RN interop 函数形态 style 对账(1 项,blocking)---
  {
    id: '131',
    label:
      '🧬 RN 函数形态 style 被 cssInterop 吃掉(blocking,按文件 HEAD 自身存量棘轮:存量只报数、新增即拦)',
    script: 'check-rn-interop-fn-style.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_RN_INTEROP_FN_STYLE',
    stagedTriggers: ['apps/mobile-rn/', 'packages/app/'],
    onFailHint: [
      '',
      '  💡 拦的是:函数形态 `style={({pressed}) => …}` 落在**被 cssInterop 注册过的 RN 组件**上。',
      '     为什么必须拦(真机 A/B 定案,PROJECT_PLAN「O83 登记④」):interop 收集内联档时对非数组声明',
      '     执行 `{ ...declaration }`,而 `{ ...函数 }` === `{}`,又因 `applyStyles` 把 props 清成 `{}`',
      '     后再合并 ⇒ **该元素整份内联 style 消失**,布局退回默认 column + stretch。',
      '     症状不是"少个按压态",而是 padding/gap/flexDirection/背景全不见(实测把「更多」折成两行)。',
      '     ① 唯一正确修法:`style` 用数组,按压反馈走 Pressable 的 children 渲染函数',
      '        (不新增布局节点、几何不变)—— 参照 packages/app/src/components/MoreLink.tsx;',
      '     ② 注册表是**现读** node_modules 里的 interop 包,不是手工清单;`Modal` 不在注册表内,',
      '        落在 Modal 上的函数形态不算这一型;',
      '     ③ 确属例外写 `interop-style-exempt: <一句话原因>`(带原因,已进守门 108 存活期表 30 天);',
      '     ④ 严禁为过门去削判据或改注册表清单 —— 内置兜底表若与现读注册表对不上会判"清单腐烂"红。',
      '     单独复验:node scripts/check-rn-interop-fn-style.mjs(全量档) / --staged(本次提交档)',
      '     自检:node scripts/check-rn-interop-fn-style.mjs --self-test',
      '     镜像测试:node --test scripts/tests/check-rn-interop-fn-style.test.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_RN_INTEROP_FN_STYLE=1 git commit ...',
      '',
    ],
  },
  // --- 工具族注册对账(1 项,warn)---
  {
    id: '132',
    label:
      '🔧 工具族注册对账(blocking,存量已归零:tools/** 里导出的一族工具必须能在生产面找到把它挂进注册表的调用点 —— "造好没装车"那一型)',
    script: 'check-tool-family-registered.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_TOOL_FAMILY_REGISTERED',
    stagedTriggers: ['apps/cli/src/'],
    onFailHint: [
      '',
      '  💡 本门补的是守门「运行时注册表投影对账」看不见的那一格:那道门的输入已经是**注册之后**',
      '     的集合,所以"整族从未注册"在它眼里根本不存在(没注册 ⇒ 两侧都没有 ⇒ 一致)。',
      '     立因实测:`apps/cli/src/tools/debug.ts` 导出 10 枚 DAP 工具(DEBUG_TOOLS),生产面',
      '     **零 importer**(只命中自身定义与两个测试文件)⇒ 那句"30 分钟自动清理"与整族能力',
      '     对模型不可达,而 typecheck / lint / 其余各门一路报绿。',
      '     三态是这门的全部价值:命中 / 未注册(违规) / **未判定**(动态拼接参数、`export *`',
      '     barrel、命名空间转发、别处同名本地符号 —— 承认看不见,既不记绿也不判红)。',
      '     **定级 warn 是设计前提**:存量(DEBUG_TOOLS)未注册,当场 blocking 就是与任何提交',
      '     都无关的恒红门 ⇒ 逼人 --no-verify 连带废掉全部守门(§12e 同型)。牙齿在**棘轮**:',
      '     锚点 = 该族在 HEAD 自身的状态,只拦"新出现的零注册族"与"本次把注册点摘掉"。',
      '     ① 看清单:node scripts/check-tool-family-registered.mjs(全量,HEAD 面)',
      '     ② 问责档:pnpm check:tool-family(带 --strict,存量也判红)',
      '     ③ 修法只有两条:在注册面把该族挂上,或按 §7 明确移除 —— **不得为消红去削判据**;',
      '     ④ 是否向模型暴露某族(尤其 dangerous 工具)属产品决策,归用户/主会话(§24)。',
      '     自检:node scripts/check-tool-family-registered.mjs --self-test(22 条,正反成对,',
      '     含"摘掉注册点必红"与"间接注册只报数"两条对照)',
      '     镜像测试:node --test scripts/tests/check-tool-family-registered.test.mjs',
      '     紧急跳过(本门 warn,通常不需要):HUSKY_SKIP_TOOL_FAMILY_REGISTERED=1 git commit ...',
      '',
    ].join('\n'),
  },
  // --- i18n 语种内容对账(1 项,blocking;2026-09-26 立)---
  {
    id: '133',
    label:
      '🈶 语言包语种内容对账(blocking,L1 跨族/块级只报数 + L2 同名自套一层按 HEAD 锚点棘轮 —— parity 绿不等于语种对)',
    script: 'check-i18n-locale-content-language.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_I18N_LOCALE_CONTENT_LANGUAGE',
    stagedTriggers: ['packages/i18n/messages/'],
    onFailHint: [
      '',
      '  💡 本门补的是既有五道 i18n 门**结构上看不见**的那一维:它们判"键集"与"有没有中文残留",',
      '     所以"某一块整体被落成另一门语言"一路绿灯。立因实测(2026-09-26 同日两次):',
      '     ① `web/ja :: aiChat.org` 整块是繁体中文、`web/zh-TW :: aiChat.org` 整块是谚文,',
      '     ② `web/ko :: chat.exportMenu.exportPdf` 是日文假名(三向轮转),',
      '     ③ `web/*:: aiChat.toast.orgSaved` 被机械写成 `{orgSaved:{orgSaved:"…"}}` 自套一层,',
     '        `t()` 取到对象 ⇒ 功能成功但提示永远不响。三型当时五道门全绿。',
      '     判据按**码位族**(han/hira/kata/hangul/latin,区间两两不相交由 lib 机器证明),',
      '     汉字族内部简繁**刻意不判**(日本新字体与中国简化字同码位),判不了就计"未判定"并点名。',
      '     ① 看清单:node scripts/check-i18n-locale-content-language.mjs --all',
      '     ② 问责档:pnpm check:i18n-locale-content-language(带 --strict,L1 存量也判红)',
      '     ③ 修法只有"把值改回这门语言";**不得**删键、改键名凑数、把值置空或改英文占位过门;',
      '     ④ 改完必走 §19 流水线(i18n-diff → apply → check-i18n-keys → scan-i18n-zh-residue),',
      '        并按守门 105 重生成小程序离线包,否则源改了产物没跟,到端还是旧词。',
      '     自检:node scripts/check-i18n-locale-content-language.mjs --self-test(例数以末行为准)',
      '     镜像测试:node --test scripts/tests/check-i18n-locale-content-language.test.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_I18N_LOCALE_CONTENT_LANGUAGE=1 git commit ...',
      '',
    ].join('\n'),
  },
  // --- 批量写计数诚实性对账(1 项,blocking)---
  {
    id: '134',
    label:
      '🧮 批量写计数诚实性对账(blocking,拦「affected/deleted 由请求侧 .length 自算」这一型静默失真 —— 改了 0 行与改成功同形)',
    script: 'check-batch-write-count-honesty.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_BATCH_WRITE_COUNT_HONESTY',
    stagedTriggers: ['apps/api/src/routes/', 'apps/api/src/db/'],
    onFailHint: [
      '',
      '  💡 本票一轮人肉清出 8 处同一形状(chat.ts batch、admin-sys role cancelAll/selectAll、',
      '     demand-square、admin/_shared.ts 的 registerCrud 批量删〔19 处路由复用同一个工厂〕、',
      '     message.ts 批量删、workspace.ts batch-delete/batch-restore)。那一型的病灶是:',
      '     where 带 eq(roleId)/eq(memberId) 过滤时,传进来的 id 一个都不命中也照样回',
      '     deleted:3 —— 后台显示"已删除 3 项"而库里一行没动,typecheck/lint/其余各门全绿。',
      '     唯一出口 apps/api/src/utils/batch-outcome.ts(dedupeIds + batchWriteOutcome),',
      '     db 层一律 .returning({id}) 回报**库确认集合**,响应新增 missedIds 逐条点名。',
      '     四条放过通道:① 同链有 .returning( ② 计数根 ≤2 跳可追到归属预查询',
      '     (business-card-routes.ts 那种"先查 owned 再删"是**正确写法**,不得判红) ',
      '     ③ 该文件 import 了唯一出口 ④ 行内 batch-count-exempt: <原因>(须带原因,',
      '     并已挂进守门 108 的 30 天到期档 —— 豁免不得只出生不死亡)。',
      '     刻意不判的两型:布尔 deleted:true(HEAD 面 257 处全仓惯例,改它属全 API 语义决策、',
      '     交人定)与读查询 count: rows.length(不是写)。',
      '     判不了的形状落「未判定」并报数,--strict 下有未判定即 exit 2(拒绝出合格证)。',
      '     ① 看清单:node scripts/check-batch-write-count-honesty.mjs [--json|--staged]',
      '     ② 自检:node scripts/check-batch-write-count-honesty.mjs --self-test(35 条)',
      '     ③ 镜像:node --test scripts/tests/check-batch-write-count-honesty.test.mjs(10 例)',
      '     紧急跳过(不推荐):HUSKY_SKIP_BATCH_WRITE_COUNT_HONESTY=1 git commit ...',
      '',
    ].join('\n'),
  },
  {
    id: '135',
    label:
      '🧾 ApiResult 失败分支身份对账(blocking,拦「throw new Error(res.error) 丢掉 status/errorCode」—— 401 因此冒充「提交的信息有误」,把用户引导去改表单)',
    script: 'check-api-failure-throw.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_API_FAILURE_THROW',
    stagedTriggers: ['apps/', 'packages/'],
    onFailHint: [
      '',
      '  💡 立因是真机实测,不是假想:进 App「广场」tab 一进来就弹「提交的信息有误,请检查后重试」。',
      '     定性结果**不是 400,是 401 被错标** —— ApiResult 失败分支本来带 status/errorCode',
      '     (packages/types/src/api.ts),而 toUserFriendlyMessage 的判序是',
      '     errorCode → HTTP status → 文案正则;只抛 message 时前两档全丢,401 的',
      '     "Invalid or expired token" 只能落到参数类正则 /invalid|missing|required/ 上。',
      '     修法只有一个出口:throw apiFailureToError(res)(packages/shared/src/utils/error-messages.ts)。',
      '     判不了的形状:① catch 侧写 showFloat(e.message) 的,换出口也救不回身份 —— 本门刻意不判,',
      '     迁移时必须逐处读 catch 路径;② 先解构成 const { error } 再抛的看不见(宁漏不误报)。',
      '     存量走「该文件 HEAD 自身计数」棘轮(立项实测 958 处 / 576+ 文件),当场判红就是恒红门(§12e)。',
      '     行内豁免 api-error-exempt: <原因>(须带原因,已挂进守门 108 的 30 天到期档)。',
      '     ① 看清单:node scripts/check-api-failure-throw.mjs [--json|--staged]',
      '     ② 自检:node scripts/check-api-failure-throw.mjs --self-test',
      '     ③ 镜像:node --test scripts/tests/check-api-failure-throw.test.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_API_FAILURE_THROW=1 git commit ...',
      '',
    ].join('\n'),
  },
  {
    id: '136',
    label:
      '🧵 后台任务类型三面 parity(blocking,拦「广告了任务类型却没实现 / 实现了却没接线 / 欠账清单腐烂」—— 声明面↔实现面↔接线面必须同时成立)',
    script: 'check-background-task-type-parity.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_BG_TASK_TYPE_PARITY',
    stagedTriggers: ['apps/ai-service/'],
    onFailHint: [
      '',
      '  💡 本门是**补装**的:脚本与 AGENTS.md 的『已接线』声称早已入库,而 runner/钩子/package.json',
      '     CI 五处权威点全部零命中 —— 即守门 89 的 RED-R2 一直红,每一次提交都被逼 --no-verify,',
      '     一次绕过等于约 150 道门对该提交作废(§12e 那条本仓最高反面教训)。',
      '     接线前置都实测过:全量面 exit 0(不在 HEAD 上造新红)、--self-test 30/30、自带 skipEnv。',
      '     三面判据:P3 广告了却没实现(真幽灵)/ P4 新增未接线类型未入账 或 欠账清单腐烂',
      '     (已接线还挂着账)—— 三种都要求**改一侧对齐另一侧**,不得删判据或清空账本消红。',
      '     ① 看清单:node scripts/check-background-task-type-parity.mjs [--json]',
      '     ② 自检:node scripts/check-background-task-type-parity.mjs --self-test(30 例)',
      '     紧急跳过(不推荐):HUSKY_SKIP_BG_TASK_TYPE_PARITY=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 名字承诺/实现兑现对账(拦「函数或字段叫 hash/digest/指纹/脱敏,实现却是明文拼接且流向持久化或出网」这一型 —— 本仓 4 处真缺陷同族立门)(1 项,blocking)---
  {
    id: '137',
    label:
      '名字承诺/实现兑现对账(拦「函数或字段叫 hash/digest/指纹/脱敏,实现却是明文拼接且流向持久化或出网」这一型 —— 本仓 4 处真缺陷同族立门)',
    script: 'check-digest-name-reality.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_DIGEST_NAME_REALITY',
    stagedTriggers: ['apps/', 'packages/', 'scripts/', 'deploy/', 'monitoring/', 'sdks/'],
    onFailHint: [
      '',
      '  💡 三条与门缺一不可才判红:① 命名承诺(词元匹配,非子串)② 可达返回/赋值面无任何真散列 ③ 值流向持久化/出网出口或被当等值标识。',
      '     判不出的一律落「未判定」并报数,既不判红也不冒充合规;--strict 下有未判定即 exit 2(拒绝出合格证)。',
      '     行内出口:digest-name-exempt: <一句话原因>(必须带原因,已挂守门 108 的 30 天存活期档)。',
      '     ⚠ 落地当天真仓 HEAD 现读 3 处命中经逐条复核**全为假阳性**(fingerprints=哈希值集合 / hashIdx=URL 片段位置 / hashed=混装列表局部变量),',
      '       它们已作为该文件 HEAD 存量被棘轮放过;升更严判据前必须先修准这三型,不得为消红去放宽词元匹配。',
      '',
    ].join('\n'),
  },

  // --- @ 多维提及引擎接线与单一源对账(V3 #61:三件不得回到无人调用 / 维度表与触发符解析不得出现第二份)(1 项,blocking)---
  {
    id: '138',
    label:
      '@ 多维提及引擎接线与单一源对账(V3 #61:三件不得回到无人调用 / 维度表与触发符解析不得出现第二份)',
    script: 'check-mention-engine-wired.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_MENTION_ENGINE_WIRED',
    stagedTriggers: ['apps/web/src/', 'packages/shared/src/'],
    onFailHint: [
      '',
      '  W1 造好没装车:useSearchMentions / addMention / MentionChips 三件必须有生产调用方(注释与测试面不计),零容忍不吃基线。',
      '  W2/W3 单一源:维度清单与触发符解析各只许一份,走该文件 HEAD 自身存量棘轮 —— 只拦"把第二份加回来"。',
      '  ① 现读:node scripts/check-mention-engine-wired.mjs [--json]',
      '  ② 自检:node scripts/check-mention-engine-wired.mjs --self-test',
      '  紧急跳过(不推荐):HUSKY_SKIP_MENTION_ENGINE_WIRED=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 模式×权限档×审批三轴矩阵对账(V3 #53:ChatMode 硬收窄的表与判定两侧逐格等值,出口唯一、有生产调用点)(1 项,blocking)---
  {
    id: '139',
    label:
      '模式×权限档×审批三轴矩阵对账(V3 #53:ChatMode 硬收窄的表与判定两侧逐格等值,出口唯一、有生产调用点)',
    script: 'check-mode-permission-matrix.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_MODE_PERMISSION_MATRIX',
    stagedTriggers: ['apps/ai-service/', 'packages/types/'],
    onFailHint: [
      '',
      '  三轴矩阵(Py CHAT_MODE_TOOL_AXIS ↔ TS permission-mode.ts 契约表)必须 5×5 逐格等值,与只读白名单同源。',
      '  只许一处交集实现:第二处手写 filter/白名单副本即红;READONLY_TOOLS 只报数。',
      '  ① 现读:node scripts/check-mode-permission-matrix.mjs [--json]',
      '  ② 自检:node scripts/check-mode-permission-matrix.mjs --self-test(13 条)',
      '  紧急跳过(不推荐):HUSKY_SKIP_MODE_PERMISSION_MATRIX=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- V3 #62/#63 对话流挂载与契约登记对账(拦「件在库而无人挂载」与「契约登记与消费点漂移」)(1 项,blocking)---
  {
    id: '140',
    label:
      'V3 #62/#63 对话流挂载与契约登记对账(拦「件在库而无人挂载」与「契约登记与消费点漂移」)',
    script: 'check-v3-62-conversation-mount.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_V362_CONV_MOUNT',
    stagedTriggers: ['apps/web/src/components/chat/', 'packages/shared/src/sse/'],
    onFailHint: [
      '',
      '  本门钉三件:BusinessFormSection 必须真被 MessageList 挂载;form_request 契约段与消费点逐字段同形;sse/contract.ts 与 ai-service sse_contract.py 的既有 parity 不得被绕过。',
      '  现读:node scripts/check-v3-62-conversation-mount.mjs --worktree / --json',
      '  自检:node scripts/check-v3-62-conversation-mount.mjs --self-test',
      '  紧急跳过:HUSKY_SKIP_V362_CONV_MOUNT=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- doom-loop parity 对账(共享层/CLI/agent.ts/Python 等价/主链路五面成套,策略数字不得有第二份)(1 项,blocking)---
  {
    id: '141',
    label:
      'doom-loop parity 对账(共享层/CLI/agent.ts/Python 等价/主链路五面成套,策略数字不得有第二份)',
    script: 'check-doom-loop-parity.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_DOOM_LOOP_PARITY',
    stagedTriggers: ['apps/cli/src/', 'apps/ai-service/app/', 'packages/shared/src/'],
    onFailHint: [
      '',
      '  P1 逐项常量等值 / P2 装车性(注释里的提及不算) / P3 三动作各有消费分支。',
      '  现读:node scripts/check-doom-loop-parity.mjs ; 自检 --self-test(14 条) ; 紧急跳过 HUSKY_SKIP_DOOM_LOOP_PARITY=1',
      '',
    ].join('\n'),
  },

  // --- Guardian 复核接线对账(拦「复核出口造好没人调」与「未复核被折叠成通过」)(1 项,blocking)---
  {
    id: '142',
    label:
      'Guardian 复核接线对账(拦「复核出口造好没人调」与「未复核被折叠成通过」)',
    script: 'check-guardian-review-wired.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_GUARDIAN_REVIEW_WIRED',
    stagedTriggers: ['apps/ai-service/app/'],
    onFailHint: [
      '',
      '  复核必须在生产面被调用;判不了/超时/无凭据必须显式未复核,禁止记为通过。',
      '  现读:node scripts/check-guardian-review-wired.mjs ; 紧急跳过 HUSKY_SKIP_GUARDIAN_REVIEW_WIRED=1',
      '',
    ].join('\n'),
  },

  // --- LSP 语言表与探测四态对账(拦 binary 名回到写死字面量、能力声明无对应族、探测失败被折叠成无诊断)(1 项,blocking)---
  {
    id: '143',
    label:
      'LSP 语言表与探测四态对账(拦 binary 名回到写死字面量、能力声明无对应族、探测失败被折叠成无诊断)',
    script: 'check-lsp-language-table.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_LSP_LANGUAGE_TABLE',
    stagedTriggers: ['apps/cli/src/'],
    onFailHint: [
      '',
      '  T1-T5 五判据:表自洽/扩展名唯一/族清单静态对账/binary 唯一出处/能力投影同形;空枚举判死。',
      '  现读:node scripts/check-lsp-language-table.mjs ; 自检 --self-test(14 条) ; 紧急跳过 HUSKY_SKIP_LSP_LANGUAGE_TABLE=1',
      '',
    ].join('\n'),
  },

  // --- 崩溃上报出口脱敏对账(拦「error.message/stack 原样进长期保留表」这一型凭据外泄)(1 项,blocking)---
  {
    id: '144',
    label:
      '🩸 崩溃上报出口脱敏对账(blocking,拦「崩溃上报把未脱敏的 message/stack 送进 crash_reports(90 天)与管理面板」—— 发射点与落库点都必须调用共享层唯一出口 redactCrashText)',
    script: 'check-crash-report-redaction.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_CRASH_REDACTION',
    stagedTriggers: ['apps/', 'packages/'],
    onFailHint: [
      '',
      '  💡 立因是实测而不是假想:apps/web/src/components/common/ErrorBoundary.tsx 曾把',
      '     error.message / error.stack 原样 POST 到 /api/crash-reports,而该端点按设计',
      '     **匿名可写**、服务端只有 zod 长度上限(.max(4000)/.max(20000)),零脱敏 ⇒',
      '     内嵌的 API key / Bearer / 用户机器绝对路径明文落库 90 天并进 admin 面板。',
      '  三条判据:V1 站点(向 crash-reports 发请求 / insert(crashReports)必须调用唯一出口;',
      '     V2 有人引用出口而面上没导出 ⇒ 判"没有出路";V3 出口出现第二份声明 ⇒ 判红。',
      '  修法只有一个出口:redactCrashText(@ihui/shared/utils/redact)—— 服务端那一处是',
      '     **权威防线**(不可信任客户端),落在 apps/api/src/services/crash-report-service.ts',
      '     的 recordCrash(该表唯一写入口),顺序必须先脱敏、再截断。',
      '  存量按「该文件 HEAD 自身违规数」棘轮只报数(立项现读:miniapp/RN 两处客户端发射点',
      '     未收口)—— 绝不为消红放宽判据,也不用行内豁免遮掉。',
      '  ① 现读:node scripts/check-crash-report-redaction.mjs [--json|--staged|--worktree]',
      '  ② 自检:node scripts/check-crash-report-redaction.mjs --self-test',
      '  ③ 镜像:node --test scripts/tests/check-crash-report-redaction.test.mjs',
      '  紧急跳过(不推荐):HUSKY_SKIP_CRASH_REDACTION=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- RN 包装器双层页头对账(共享屏自带页头 × RN 屏又加 NavBar ⇒ 同屏两条返回键与两个标题)(1 项,blocking)---
  {
    id: '145',
    label:
      'RN 包装器双层页头对账(共享屏自带页头 × RN 屏又加 NavBar ⇒ 同屏两条返回键与两个标题)',
    script: 'check-rn-double-header.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_RN_DOUBLE_HEADER',
    stagedTriggers: ['apps/mobile-rn/'],
    onFailHint: [
      '',
      '修法只有一条:给共享屏补页头抑制通道(hideHeader / renderHeader / nestedInScrollView)并在调用点传入 —— 与 SquareScreen/ShareScreen/AgentScreen 既有先例同形。',
      '禁止删任意一层:共享页头是 163 个消费点的唯一页头;包装器 NavBar 在 Settings/Profile 上承载 SideMenu 抽屉唯一入口。',
      '删包装器还会让 loading 态失去唯一返回手段(实测 packages/app/src/features/course-detail 的 loading 分支只有 spinner)。',
      '行内出口 double-header-exempt: <原因>(须带原因,已挂守门 108 的 30 天到期档)。',
      '',
    ].join('\n'),
  },

  // --- README 表格完整性对账(TI1 竖排续行判红/T-B 只报数/棘轮锚基线)(1 项,blocking)---
  {
    id: '146',
    label:
      'README 表格完整性对账(TI1 竖排续行判红/T-B 只报数/棘轮锚基线)',
    script: 'check-readme-table-integrity.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_README_TABLE_INTEGRITY',
    stagedTriggers: ['README.md'],
    onFailHint: [
      '',
      'T-A 竖排续行超锚点:node scripts/readme-table-unwrap.mjs --file README.md --dry-run(默认零写盘,自证零内容损失后才 --apply)',
      '确属有意保留:<!-- table-cell-exempt: <原因> --> 写在宿主行或该 run 内任一行(须带原因,守门 108 管 30 天到期)',
      'T-B 半截行与孤立 2 竖线行只报数不判红(要逐案判语义,不归本门)',
      '',
    ].join('\n'),
  },

  // --- 模型容量/推理档位跨语言对账(1 项,blocking)---
  {
    id: '147',
    label:
      '模型容量/推理档位跨语言对账',
    script: 'check-model-capacity-parity.mjs',
    args: ['--strict'],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_MODEL_CAPACITY_PARITY',
    stagedTriggers: ['packages/api-client/src/', 'apps/ai-service/app/core/', 'apps/cli/src/subagents/'],
    onFailHint: [
      '',
      '',
    ].join('\n'),
  },

  // --- 会话失效出口对账(1 项,blocking)---
  {
    id: '148',
    label:
      '会话失效统一出口注册对账:凡消费 @ihui/api-client fetchApi 的端必须注册 setUnauthorizedHandler 或持带 reason+未过期 reviewBy 的台账豁免(AP1);台账端已注册/指向不存在端/重复登记判红(AP2 反腐烂);注册口 export 或 notifyUnauthorized 调用点被摘线判失明不记绿(AP3);枚举 0 个消费端 exit 2 不记绿',
    script: 'check-auth-handler-registration-parity.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_AUTH_HANDLER_PARITY',
    stagedTriggers: ['apps/', 'packages/api-client/', 'scripts/'],
    onFailHint: [
      '',
      '修复出口二选一:该端注册 setUnauthorizedHandler(共享层已有注册口),或在 scripts/auth-handler-registration-exemptions.json 补带 reason+reviewBy 的条目;不得放宽判据消红',
      '',
    ].join('\n'),
  },

  // --- 包入口 barrel 漏 re-export 对账(G-215)(1 项,blocking)---
  {
    id: '149',
    label:
      '包入口 barrel 漏 re-export 对账:端内从裸包名 import 的名字必须由包入口真的递出',
    script: 'check-package-barrel-export.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_PACKAGE_BARREL_EXPORT',
    stagedTriggers: ['packages/', 'apps/'],
    onFailHint: [
      '',
      '  修复出口只有一个:把该符号补进包入口的显式清单(或在入口 re-export 它)。不得改判据、不得加豁免、不得去掉 web 的 ignoreBuildErrors 来"顺手收紧构建"。',
      '  为什么本地一路绿:漏 re-export 既不报类型错(被 next.config.ts 的 typescript.ignoreBuildErrors 吃掉)也不报构建错(打包器只看 exports→dist/index.js),只有运行时 undefined 砸到用户手上 —— 与守门 98 方向相反(98 判 import 了不存在的,本门判存在但没递出来)。',
      '  ① 现读:node scripts/check-package-barrel-export.mjs [--json|--staged|--worktree]',
      '  ② 问责(未判定与存量一并拒出合格证):node scripts/check-package-barrel-export.mjs --strict',
      '  ③ 取证:node scripts/check-package-barrel-export.mjs --self-test;node --test scripts/tests/check-package-barrel-export.test.mjs —— 例数以命令末行现读为准,勿照抄文档',
      '  紧急跳过(不推荐):HUSKY_SKIP_PACKAGE_BARREL_EXPORT=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 状态词汇对账(1 项,blocking)---
  {
    id: '151',
    label:
      '子智能体/后台任务状态词汇跨语言与端内抄本对账(六档是落库/REST/SSE 三重对外契约)',
    script: 'check-agent-status-vocabulary-parity.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_STATUS_VOCABULARY_PARITY',
    stagedTriggers: ['packages/types/src/', 'apps/ai-service/app/services/', 'apps/web/src/components/', 'apps/cli/src/'],
    onFailHint: [
      '',
      '成员集合的单一真相源 = packages/types/src/agent-runtime.ts 的 AGENT_TASK_STATUSES\\n端内一律 import 它(或由它派生);Python 侧改 KANBAN_TASK_STATUSES + Literal 两处同笔\\n六档值是对外契约:不得改名、不得删成员、不得为变绿放宽判据、不得写豁免清单消账\\n新增一档必须同枚提交补齐 agents.kanban.* 五语言(AGENTS §30)\\n判不出 ⇒ exit 2 报无法判定,不冒红也不记绿',
      '',
    ].join('\n'),
  },

  // --- 身份消费对账(1 项,blocking)---
  {
    id: '152',
    label:
      '🔐 ai-service 身份消费对账(blocking,拦「端点取到已验证身份却一次都没用它」—— 认证不等于授权;判据单一真相在 apps/ai-service/scripts/audit_principal_consumed.py,本门只物化被审面并派生那把尺子)',
    script: 'check-principal-consumed.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_PRINCIPAL_CONSUMED',
    stagedTriggers: ['apps/ai-service/'],
    onFailHint: [
      '',
      '  💡 本门守的是「取到已验证身份却一次都没用它」这一型(认证≠授权):签名带身份依赖',
      '     默认值而整个函数体既不读该参数、也不经 request.state.user_id 通道消费、也不把',
      '     request 一跳委托给"自己读 state.user_id"的仓内 helper ⇒ 判未消费。',
      '  棘轮锚点 = 该文件在锚点面(HEAD 档比 HEAD^、--staged 档比 HEAD)自身的存量,',
      '     只拦"本次改动带进来的新账"与"豁免清单腐烂",存量不因无关提交判红。',
      '  机器态不判红:拿不到 Python/尺子没产出结论 ⇒ 未判定 exit 0(末行如实,不出具',
      '     "全部已判"合格证);被审面取材不到/枚举 0 个 ⇒ exit 2 判死,不静默。',
      '  修复出口(二选一,不得为消红削判据):① 端点真的消费身份 —— 属主取令牌主体',
      '     (app/core/jwt_auth.py 的 require_request_user_id)或归属比对走',
      '     app/services/session_store.py 的 owner_scoped_allows,或把 request 一跳',
      '     委托给 _owner_filter 形态的既有 helper;② 确属无归属轴的公共面 ⇒ 在尺子内',
      '     PRINCIPAL_EXEMPTIONS 逐条登记 file+func+理由(禁止按目录整片放行)。',
      '  ① 现读:node scripts/check-principal-consumed.mjs [--json|--staged|--worktree]',
      '  ② 镜像:node --test scripts/tests/check-principal-consumed.test.mjs',
      '  紧急跳过(不推荐):HUSKY_SKIP_PRINCIPAL_CONSUMED=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 服务二进制路径存续性对账(1 项,warn)---
  {
    id: '153',
    label:
      '🛡️ 服务二进制路径存续性对账(判机器状态:nssm 各服务 Application 绝对路径存在性;三态不并桶,§12e 只能 warn)',
    script: 'check-service-binary-paths.mjs',
    args: [],
    mode: 'warn',
    stagedTriggers: ["**/*"],
    skipEnv: 'HUSKY_SKIP_SERVICE_BINARY_PATHS',
    onFailHint: [
      '',
      '本门判的是"这台机装了什么",不是本次提交改了什么 ⇒ 定级 warn:',
      '  挂 blocking 会让每台每次提交被逼 --no-verify,一次绕过等于全部守门对该提交作废(§12e)。',
      '三态:可判存在 / 确认缺失 / 未判定;枚举不到 nssm 服务时如实报未判定,不冒充通过。',
      '问责跑 --strict;应急跳过 HUSKY_SKIP_SERVICE_BINARY_PATHS=1。',
      '',
    ].join('\n'),
  },

  // --- 临时夹具 scratch 根二阶嵌套巡检(只报不删,三态含未判定)(1 项,warn)---
  {
    id: '154',
    label:
      '临时夹具 scratch 根二阶嵌套巡检(只报不删,三态含未判定)',
    script: 'check-scratch-root-no-nesting.mjs',
    args: [],
    mode: 'warn',
    stagedTriggers: ["**/*"],
    skipEnv: 'HUSKY_SKIP_SCRATCH_NESTING',
    onFailHint: [
      '',
      '',
    ].join('\n'),
  },

  // --- 镜像测试临时夹具落点对账(默认只报名,--strict 才判红)(1 项,warn)---
  {
    id: '155',
    label:
      '镜像测试临时夹具落点对账(默认只报名,--strict 才判红)',
    script: 'check-fixture-tmpdir.mjs',
    args: [],
    mode: 'warn',
    stagedTriggers: ["**/*"],
    skipEnv: 'HUSKY_SKIP_FIXTURE_TMPDIR',
    onFailHint: [
      '',
      '',
    ].join('\n'),
  },

  // --- 自检登记求值配对(1 项,warn)---
  {
    id: '156',
    label:
      '自检用例登记侧的求值配对对账(登记不求值 ∧ 用例传函数 ⇒ 才判红;潜伏档只报数)',
    script: 'check-selftest-registrant-evaluates.mjs',
    args: [],
    mode: 'warn',
    skipEnv: 'HUSKY_SKIP_SELFTEST_REGISTRANT',
    stagedTriggers: ['scripts/'],
    onFailHint: [
      '',
      '判红只有一型:登记函数把实参裸存 / !!x / Boolean(x) 而全文无人调用它,且同一自检宿主内确实有用例传裸箭头函数或裸 function。',
      '该 self-test 条目从未被判过 —— 打印的通过数是假的。',
      '出路只有一条:把登记侧改成求值形态(体内调用该形参,或改用 push({name, fn}) + 消费循环 c.fn() 的 thunk 族)。禁止把用例改成布尔去过门。',
      '判不出的形态(形参被喂进别的调用、括号配不平)只报名不判红;问责档:node scripts/check-selftest-registrant-evaluates.mjs --strict(有未判定即 rc=2)。',
      '定级 warn 是设计前提:现读潜伏 36 处 + 未判定 4 处,接成 blocking 就是每台每次被逼跳门(AGENTS 12f)。',
      '',
    ].join('\n'),
  },

  // --- 🔐 按凭据存在性豁免对账(blocking,G-459:头名在场即跳过安全判定必须逐条裁过)(1 项,blocking)---
  {
    id: '157',
    label:
      '🔐 按凭据存在性豁免对账(blocking,G-459:头名在场即跳过安全判定必须逐条裁过)',
    script: 'check-credential-presence-bypass.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_CREDENTIAL_PRESENCE_BYPASS',
    stagedTriggers: ['apps/api/src/plugins', 'apps/api/src/routes', 'apps/api/src/utils'],
    onFailHint: [
      '',
      '  💡 出路只有两条:行内 credential-presence-exempt: <原因>,或台账 scripts/data/credential-presence-exemptions.json 带 file+anchor+reason+reviewBy。不得为消红放宽判据。',
      '',
    ].join('\n'),
  },

  // --- 凭据在场即豁免对账(1 项,blocking)---
  // 编号说明(union 收敛当日):本条目与上一条是**同一天两个会话各立的同型门**(都判「安全钩子里
  // 凭据头名在场即裸放行」)。两侧已各自入库,删任一道等于替别人卸闸,故两道全留;撞号按
  // 「后来者改号」处置 —— 上一条已占远端号,本侧尚未推送 ⇒ 本侧让号。是否把两道合成一道属
  // 各判据持有人的裁决,不在收敛票范围内。编号一律以 runner 现值为准,不得照文档派单。
  {
    id: '158',
    label:
      '🛡️ 凭据在场即豁免对账(blocking,拦「安全钩子里只要带了某个头就直接跳过校验」—— 票#23 CSRF 现场收口后无人看守的那一型)',
    script: 'check-gate-presence-exemption.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_GATE_PRESENCE_EXEMPTION',
    stagedTriggers: ['apps/', 'packages/'],
    onFailHint: [
      '',
      '  💡 本门钉的形态:安全语义文件面(apps/api/src/plugins/** + apps/api/src/middleware/** + 文件名含 csrf/auth/permission/rate-limit/internal 的源码)里,if (<只对 headers/cookies 做存在性判断>) 紧跟裸放行(return / return true / return next()),且分支内没有任何验证调用。',
      '     阳性对照(这门的存在理由):把票#23 修复前的 csrf.ts 历史 blob(6fb790eb70a8^)喂同一判据,必须点名那行 x-internal-service-token;改写成「验过才免」(isVerified*/secretsEqual/verify*/timingSafeEqual/jwt.verify/compare*)后落 passed。',
      '     三态不可混:命中(判红;存量按该文件 HEAD 自身计数只报数)/ 放过(做了验证调用)/ 判不出(helper 调用、动态属性名、与凭据字段混项)—— 判不出逐条点名并计数,--strict 下有未判定即 exit 2,拒绝出合格证。',
      '     口径同 70/77/83/98/101/103/118:全量判 HEAD blob、--staged 判索引 blob、--worktree 仅人工、两面旗同给 exit 2、取不到判"无法判定"不回落、枚举到 0 个候选判死。',
      '     行内出口 presence-exempt: <原因>(须带原因,只救本行或紧邻上一纯注释行);该族尚未进守门 108 的存活期表,当前落其默认 90 天档,定档另计一票。',
      '     刻意不判(如实登记):条件先存进变量再判(单跳回溯不在射程)、头值做 == 字面比较(是否安全比较属另一维)、continue 形态、Python 侧(守门 117 管那一层的另一型)。',
      '     ① 看清单:node scripts/check-gate-presence-exemption.mjs [--json|--staged|--strict]',
      '     ② 自检:node scripts/check-gate-presence-exemption.mjs --self-test',
      '     ③ 镜像:node --test scripts/tests/check-gate-presence-exemption.test.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_GATE_PRESENCE_EXEMPTION=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 🔐 CSRF 豁免形状对账(blocking,存在性唯一条件放行/验真出口摘线/timingSafeEqual 单源三判据)---
  {
    id: '209',
    label:
      '🔐 CSRF 豁免形状对账(blocking,存在性唯一条件放行/验真出口摘线/timingSafeEqual 单源三判据)',
    script: 'check-csrf-exemption-shape.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_CSRF_EXEMPTION_SHAPE',
    stagedTriggers: ['apps/api/src'],
    onFailHint: [
      '',
      '  💡 本门钉的形态:apps/api/src 的 CSRF 豁免决策面(文件名含 csrf / 代码面引用验真出口族 / 注册 preHandler|onRequest 钩子且代码面提 csrf)里——',
      '     ① 以某 header/env 键的存在性为唯一条件即放行 ⇒ 红;正当形态只有调用 isVerified* 出口,或行内 csrf-exempt: <原因>(本族)/ credential-presence-exempt: <原因>(守门 157 族,防两道门互咬);裸标记无原因不放过。',
      '     ② 验真出口被摘线(无人调用或 export 不见)⇒ 判"没有出路"并参与退出码。',
      '     ③ timingSafeEqual 只许 secretsEqual 一份,再出现第二处即红(站点键不含行号,插入行不假红)。',
      '     与 157/108 的分界(门体头注已写明):157/108 只审站点不问出口死活,且 157 的 VERIFIED_RE 反把 timingSafeEqual 当"已验真"信号放过——本门补的正是这两格,不是重复立项。',
      '     三态不可混:命中(判红;存量按该文件 HEAD 自身计数只报数)/ 放过(验真出口或带原因豁免)/ 判不出(--strict 下未判定即 exit 2,拒绝出合格证)。timingSafeEqual 现读存量 48 处/20 文件,按 §12f 走首锚差值棘轮:只拦新增、只减不增。',
      '     ① 看清单:node scripts/check-csrf-exemption-shape.mjs [--json|--staged|--strict]',
      '     ② 自检:node scripts/check-csrf-exemption-shape.mjs --self-test',
      '     ③ 镜像:node --test scripts/tests/check-csrf-exemption-shape.test.mjs',
      '     紧急跳过(不推荐):HUSKY_SKIP_CSRF_EXEMPTION_SHAPE=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 图源池与境外图片 URL 对账(1 项,blocking)---
  {
    id: '159',
    label:
      '图源池与境外图片 URL 对账:渲染与 seed 路径不得再出现境外图片域名的完整 URL,且 database 侧镜像必须与 shared 逐字等值',
    script: 'check-image-source-domains.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_IMAGE_SOURCE_POOL',
    stagedTriggers: ['packages/database/', 'apps/', 'packages/shared/', 'packages/app/', 'packages/ui-react/'],
    onFailHint: [
      '',
      '',
      '修法只有一条:把该 URL 换成境内可达图源池成员(packages/shared/src/constants/image-source-pool.ts,新增须按头注四要件实测入池);镜像漂移则两侧同批改那三张清单。禁止放宽域名清单或删镜像消红',
      '单独复现:node scripts/check-image-source-domains.mjs --staged',
      '自检/行为对账:node scripts/check-image-source-domains.mjs --self-test 与 node --test scripts/tests/image-source-pool-parity.test.mjs',
      '',
      '',
    ].join('\n'),
  },

  // --- 斜杠命令注册到达性对账(G-814404)(1 项,blocking)---
  {
    id: '160',
    label:
      '斜杠命令「注册表 ↔ 分派 switch」到达性对账 + 注册名去重:注册名(含别名)必须各有活 case/if 分支(W1)、注册名多重集零重复(W2)、分派顶层必须有 default 兜底(W4),三维零容忍;分派有而注册表无(W3 名字漂移)默认只报数、--strict 才判红(HEAD 面现读 2 条存量,当场判红就是恒红门);注册表/分派解析不到 ⇒ exit 2 未判定,枚举到 0 个判死不记绿',
    script: 'check-slash-command-wired.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_SLASH_COMMAND_WIRED',
    stagedTriggers: ['apps/cli/src/commands/'],
    onFailHint: [
      '',
      '修复出口二选一:在 apps/cli/src/commands/repl.ts 的分派里补上该名字的 case(或等价 if 比较),或把这条命令从 slash-registry.ts 的注册表摘掉;W3 报数的两条按同法处置。禁止为消红放宽判据或改注册表入口名',
      '',
    ].join('\n'),
  },

  // --- 入站契约 .strict() 到达性对账(1 项,blocking)---
  {
    id: '161',
    label:
      '入站契约 .strict() 到达性对账',
    script: 'check-inbound-schema-strict.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_INBOUND_SCHEMA_STRICT',
    stagedTriggers: ['apps/api/src/', 'apps/cli/src/', 'apps/extension/', 'apps/desktop/'],
    onFailHint: [
      '',
      '入站 Zod 契约未对未知字段表态:补 .strict()/z.strictObject,或写行内 inbound-strict-exempt: <原因>(该族已挂守门 108 存活期);存量按该文件 HEAD 自身锚点只报数,--strict 才问责',
      '',
    ].join('\n'),
  },

  // --- 错误码文本判分支对账(1 项,blocking)---

  // --- 维护性写归属对账(1 项,blocking)---
  {
    id: '163',
    label:
      '维护性写归属/CAS/回报计数三态对账(G-815920)',
    script: 'check-write-owner-predicate.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_WRITE_OWNER_PREDICATE',
    stagedTriggers: ['apps/api/src/db/', 'apps/api/src/routes/'],
    onFailHint: [
      '',
      '读三态请跑 pnpm check:write-owner(它走 --strict,有未判定即 exit 2,那是拒绝出合格证不是仓库故障);默认档与提交链只拦"该文件 HEAD 自身 missing 存量"之上的新增',
      '',
    ].join('\n'),
  },

  // --- 源码 U+FFFD 对账(合法编码承载损坏内容那一型)(1 项,blocking)---
  {
    id: '164',
    label:
      '源码替换符(U+FFFD)对账 —— 字节级 UTF-8 完整性的缺失维度',
    script: 'check-replacement-chars.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_REPLACEMENT_CHARS',
    stagedTriggers: ['apps/', 'packages/', 'scripts/', 'sdks/'],
    onFailHint: [
      '',
      '  这道门问的是「源码里有没有 U+FFFD 替换符」—— 守门 4c 判的是非法 UTF-8 字节序列,而 U+FFFD',
      '  编码成 EF BF BD 完全合法,所以"内容已被有损解码换掉"在那道门上是隐形的(实测 718 处一路绿)。',
      '  存量(该文件 HEAD 自身就有的)只报数不判红;本次把某文件的处数推高才红。',
      '  修复出口:node scripts/check-replacement-chars.mjs --recover <路径>',
      '  它按「代码括号」给每个损坏注释区间找最近零损坏祖先的原文;找不到的会如实报名,禁止编造。',
      '',
      '',
    ].join('\n'),
  },

  // --- 🧾 教育欠费口径单一出口对账(blocking,AR1 出口外重写算式/AR2 裸写派生列)(1 项,blocking)---
  {
    id: '165',
    label:
      '🧾 教育欠费口径单一出口对账(blocking,AR1 出口外重写算式/AR2 裸写派生列)',
    script: 'check-edu-arrears-single-source.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["apps/api/src/", "apps/web/", "apps/miniapp-taro/src/", "packages/app/src/"],
    skipEnv: 'HUSKY_SKIP_EDU_ARREARS_SINGLE_SOURCE',
    onFailHint: [
      '',
      '',
    ].join('\n'),
  },

  // --- 活文档写回对账(1 项,blocking)---
  {
    id: '166',
    label:
      '🧵 活文档按旧副本提交会写回他人已入库行(blocking,2026-09-29 立;只判本次真改掉的那份文档,索引==HEAD 记跳过不记通过)',
    script: 'check-live-doc-pathspec.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_LIVE_DOC_PATHSPEC',
    stagedTriggers: ['PROJECT_PLAN.md', 'AGENTS.md', 'README.md'],
    onFailHint: [
      '',
      '红 = 这次要提交进去的那份活文档,逐字丢了 HEAD 里已有的登记行(lost)。',
      '1) 归并:`node scripts/merge-live-doc.mjs --file <该文档> --apply` —— 只补 lost,不补 stale;',
      '2) 被点名成 stale 的行要人工取 HEAD 形态(`git show HEAD:<该文档>` 逐行取回),禁止整文件覆盖;',
      '3) 真要删行:走 AGENTS §1 归档两步走,或合并之后显式 `git rm` —— 本门刻意不给行内豁免;',
      '4) 确认红来自别人正在写的旧副本而不是本次改动:紧急跳过 HUSKY_SKIP_LIVE_DOC_PATHSPEC=1 并留痕。',
      '',
    ].join('\n'),
  },

  {
    id: '167',
    label:
      '🔒 turn 序号分配点上锁(blocking,max(turnOrdinal) 与 insert(chatMessages) 同体 ⇒ 体内必须有 .for(\'update\') 或 db.transaction;全量档只报数)',
    script: 'check-turn-ordinal-lock.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_TURN_ORDINAL_LOCK',
    stagedTriggers: ['apps/api/src/'],
    onFailHint: [
      '',
      '  💡 本门钉的是 G-818 那格不变量:turn_ordinal 是轮次组号,索引刻意非唯一,唯一约束',
      '     结构上不可用 ⇒ "读 max 再分配"的每一段都必须锁;真库实测无事务的"读 max → 插"',
      '     同会话并发双插撞号率 100%(60 对全撞,turn-ordinal-concurrency.test.ts)。',
      '     红点名的形态 = max(${chatMessages.turnOrdinal}) 与 insert(chatMessages) 落在同一个',
      '     语句块里,块内既无 .for(\'update\') 也无 db.transaction。',
      '     修法:把 max 读取与 insert 一并包进 db.transaction,并先对会话行 .for(\'update\')',
      '     —— 参照 apps/api/src/db/chat-queries.ts createMessage 与 routes/message.ts 的既有形态。',
      '     本门只咬本次改动动过的文件(apps/api/src);全量档存量红(patrol-scheduler.ts:198)',
      '     只报数 —— 改到它的那一刻必须顺手补锁,不得原样提交。',
      '     单独复验:node scripts/check-turn-ordinal-lock.mjs --staged',
      '     自检:node scripts/check-turn-ordinal-lock.mjs --self-test(16 例,正反成对)',
      '     镜像测试:node --test scripts/tests/check-turn-ordinal-lock.test.mjs(10 例,含',
      '     临时仓端到端 staged 棘轮双向 + 全量只报数)',
      '     紧急跳过:HUSKY_SKIP_TURN_ORDINAL_LOCK=1(跳过即放弃"分配点上锁"这格不变量,',
      '     必须在提交信息里写明理由与清偿票)',
      '',
    ].join('\n'),
  },

  {
    id: '168',
    label:
      '🔀 合并复活已删文件对账(blocking,DR1 基底判定 + DR2 删除出处;默认只判未入 origin/main 的合并,每枚判一次)',
    script: 'check-merge-deletion-resurrection.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
    skipEnv: 'HUSKY_SKIP_MERGE_DELETION_RESURRECTION',
    onFailHint: [
      '',
      '  💡 守门 100 的另一半:100 拦「合并吞掉对侧独有新增」,本门拦「本侧显式删除的路径被合并整批写回」。',
      '     DR1:P ∈ tree(共同基底) ∧ P ∈ 对侧父 ∧ P ∉ 本侧父 ∧ P ∈ 结果 ⇒ 判红;',
      '     DR2:第一轮复活后分叉点已推进到已删一侧 ⇒ 基底里已没有它,DR1 结构性失明;改判「本侧可达范围内',
      '     存在一笔非合并提交删掉了它」—— 对侧独有新增拿不出删除出处 ⇒ 不判(那是守门 100 的地盘)。',
      '     同一路径两条取证只计一条(两份基线互相顶掉,真值就读不出)。正当豁免:删除提交信息含',
      '     intentional-delete:,或 scripts/data/deletion-survival-allowlist.json 带 path+reason+reviewBy 且未过期。',
      '     增量台账 .ihui-agent/state/merge-deletion-resurrection-audited.json 让每枚合并只判一次(判红不许反复红)。',
      '     自检:node scripts/check-merge-deletion-resurrection.mjs --self-test(43 例);',
      '     镜像:node --test scripts/tests/check-merge-deletion-resurrection.test.mjs(11 例,含 T1 方向锁)。',
    ].join('\n'),
  },

  // --- AI 面板装载守门(1 项,blocking)---
  {
    id: '171',
    label:
      'AI 面板装载守门:GlobalShell/AISidePanel 的骨架占位几何一致 + 8 个重组件懒加载边界 + inferVendor 单一来源(首屏延迟根治防回潮,2026-09-30;门体随 d5c54f4499 入库,本枚重注册补对账)',
    script: 'check-ai-panel-mount-guards.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_AI_PANEL_MOUNT_GUARDS',
    stagedTriggers: ['apps/web/src/components/layout/GlobalShell.tsx', 'apps/web/src/components/ai/ai-side-panel.tsx'],
    onFailHint: [
      '',
      '单独复现:node scripts/check-ai-panel-mount-guards.mjs --staged(或 --worktree 人工排查)',
      '自检:node scripts/check-ai-panel-mount-guards.mjs --self-test(44 例,正反成对)',
      '判据:R1 GlobalShell 两处占位(dynamic loading + Suspense fallback)几何一字不动且内部是骨架;R2 ai-side-panel 8 个重组件只准动态 import;inferVendor 只从 vendor-infer 导入',
      '修复方向:恢复懒加载边界与骨架占位,不要把重组件改回静态 import(零视觉症状的性能回退,测试抓不到,只有这道门能咬住)',
      '',
    ].join('\n'),
  },

  // --- 文档数字对账(1 项,blocking)---
  {
    id: '173',
    label:
      '对外文档数字对账(README/README.en 的生成块与散文声称必须等于 gen-doc-numbers 现算值;判责时机=改动被审文档的那枚,未触及只报漂移数 —— 防恒红)',
    script: 'check-doc-numbers.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_DOC_NUMBERS',
    stagedTriggers: ['README.md', 'README.en.md'],
    onFailHint: [
      '',
      '刷新块: node scripts/gen-doc-numbers.mjs --markdown 替换 README 的 GENERATED NUMBERS 块(务必在 README 已在被审面上的那份面生成,否则 trackedFiles 天生差数);逐数来源: node scripts/gen-doc-numbers.mjs;连仓库简介一起问责: node scripts/check-doc-numbers.mjs --strict --description -',
      '本门只在触及 README.md/README.en.md 的轮次判红;未触及轮次打印的"漂移只报数"是"下次改 README 必须重跑生成块"的前置提醒,不构成跳门理由。',
      '',
    ].join('\n'),
  },

  // --- 诊断面脱敏(1 项,blocking)---
  {
    id: '174',
    label:
      '诊断面脱敏守门(b76-08a票1配套):诊断/错误上报面不得携带未脱敏的密钥/令牌/邮箱/路径等敏感串,自检 --self-test 内嵌红绿对照',
    script: 'check-diagnostic-redaction.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["apps/cli/src/subagents/worker-pool.ts", "apps/api/src/services/transcode-service.ts"],
    skipEnv: 'HUSKY_SKIP_DIAGNOSTIC_REDACTION',
    onFailHint: [
      '',
      '单独复现:node scripts/check-diagnostic-redaction.mjs',
      '自检:node scripts/check-diagnostic-redaction.mjs --self-test',
      '应急放行:HUSKY_SKIP_DIAGNOSTIC_REDACTION=1 git commit(commit message 写明责任归属)',
      '',
    ].join('\n'),
  },

  // --- 退出码归因(1 项,blocking)---
  {
    id: '175',
    label:
      '进程退出码归因守门(b76-08a票1配套):进程 exit 1/非零退出必须可归因到显式 failure kind/错误码,禁止无归因的裸退出,自检 --self-test 内嵌红绿对照',
    script: 'check-process-exit-attribution.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["apps/cli/src/subagents/worker-pool.ts", "apps/api/src/services/transcode-service.ts", "apps/api/src/services/terminal-service.ts", "apps/ai-service/app/services/command_streamer.py"],
    skipEnv: 'HUSKY_SKIP_PROCESS_EXIT_ATTRIBUTION',
    onFailHint: [
      '',
      '单独复现:node scripts/check-process-exit-attribution.mjs',
      '自检:node scripts/check-process-exit-attribution.mjs --self-test',
      '应急放行:HUSKY_SKIP_PROCESS_EXIT_ATTRIBUTION=1 git commit(commit message 写明责任归属)',
      '',
    ].join('\n'),
  },

  // --- 能力位客户端自供(1 项,blocking)---
  {
    id: '176',
    label:
      '能力位不得客户端自供守门(b76-08a票2配套):客户端不得自报 capability 字段(connectionId/clientMode/deliveryProfile/subscriberScope/workflowRunDeltas 名单),能力位只准服务端下发,自检 --self-test',
    script: 'check-capability-field-not-client-supplied.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
    skipEnv: 'HUSKY_SKIP_CAPABILITY_FIELD_NOT_CLIENT_SUPPLIED',
    onFailHint: [
      '',
      '单独复现:node scripts/check-capability-field-not-client-supplied.mjs',
      '自检:node scripts/check-capability-field-not-client-supplied.mjs --self-test',
      '应急放行:HUSKY_SKIP_CAPABILITY_FIELD_NOT_CLIENT_SUPPLIED=1 git commit(commit message 写明责任归属)',
      '',
    ].join('\n'),
  },

  // --- SSE 帧水印(1 项,blocking)---
  {
    id: '177',
    label:
      'SSE 帧水印守门(b76-13票1配套):SSE 流消费环必须带 fromSeq≥1 帧水印接线(唯一出口 + 读环接线 + 阳性对照),摘线即红,自检 --self-test 红绿对照',
    script: 'check-sse-frame-watermark.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["packages/shared/src/sse/agent-events.ts", "packages/api-client/src/frame-watermark.ts", "packages/api-client/src/client.ts"],
    skipEnv: 'HUSKY_SKIP_SSE_FRAME_WATERMARK',
    onFailHint: [
      '',
      '单独复现:node scripts/check-sse-frame-watermark.mjs',
      '自检:node scripts/check-sse-frame-watermark.mjs --self-test',
      '应急放行:HUSKY_SKIP_SSE_FRAME_WATERMARK=1 git commit(commit message 写明责任归属)',
      '',
    ].join('\n'),
  },

  // --- 列表截断诚实(1 项,blocking)---
  {
    id: '178',
    label:
      '列表截断诚实守门(b76-13票7配套):UI 列表截断必须如实交代截断帽(不得假装展示全量),三处 UI 命中已清偿;1 处字符串尾截(terminal-section.tsx)属票面不判面(未判定不判红)',
    script: 'check-list-cap-honesty.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["apps/web/src/components/ai/progress-sections/", "packages/api-client/src/client.ts"],
    skipEnv: 'HUSKY_SKIP_LIST_CAP_HONESTY',
    onFailHint: [
      '',
      '单独复现:node scripts/check-list-cap-honesty.mjs',
      '自检:node scripts/check-list-cap-honesty.mjs --self-test',
      '应急放行:HUSKY_SKIP_LIST_CAP_HONESTY=1 git commit(commit message 写明责任归属)',
      '',
    ].join('\n'),
  },

  // --- 工具schema投影(1 项,blocking)---
  {
    id: '179',
    label:
      '工具 schema 投影完整性守门(b76-05票2配套):工具描述符 JSON schema 投影必须键序 canonical/拒绝通道在位/A-B 两面一致/缓存中性,99 个可判工具全过才绿,自检 --self-test 4 例',
    script: 'check-tool-schema-projection.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["packages/types/src/schema-projection.ts", "apps/cli/src/tools/"],
    skipEnv: 'HUSKY_SKIP_TOOL_SCHEMA_PROJECTION',
    onFailHint: [
      '',
      '单独复现:node scripts/check-tool-schema-projection.mjs',
      '自检:node scripts/check-tool-schema-projection.mjs --self-test(4 例)',
      '应急放行:HUSKY_SKIP_TOOL_SCHEMA_PROJECTION=1 git commit(commit message 写明责任归属)',
      '',
    ].join('\n'),
  },

  // --- 嵌套闭集声明(1 项,blocking)---
  {
    id: '180',
    label:
      '嵌套 additionalProperties 闭集守门(b76-14票2配套):嵌套层 schema 的闭集声明不得被摘(嵌套三态在位 + 类型面收编 ≥2),取不到按 UNDETERMINED 不记绿,自检 --self-test 3 例',
    script: 'check-nested-additional-properties.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["apps/cli/src/tools/"],
    skipEnv: 'HUSKY_SKIP_NESTED_ADDITIONAL_PROPERTIES',
    onFailHint: [
      '',
      '单独复现:node scripts/check-nested-additional-properties.mjs',
      '自检:node scripts/check-nested-additional-properties.mjs --self-test(3 例)',
      '应急放行:HUSKY_SKIP_NESTED_ADDITIONAL_PROPERTIES=1 git commit(commit message 写明责任归属)',
      '',
    ].join('\n'),
  },

  // --- 错误文案有界化(1 项,blocking)---
  {
    id: '181',
    label:
      '错误文案有界化守门(b76-12b票1配套):错误文案出边界(PERSISTENT sink)的 JSON.stringify 内插必须有界或带 ref= 基线;测试面/CLI 面/stdout-only 豁免,基线棘轮只减不增',
    script: 'check-error-message-bounded.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
    skipEnv: 'HUSKY_SKIP_ERROR_MESSAGE_BOUNDED',
    onFailHint: [
      '',
      '单独复现:node scripts/check-error-message-bounded.mjs',
      '自检:node scripts/check-error-message-bounded.mjs --self-test(12 例)',
      '应急放行:HUSKY_SKIP_ERROR_MESSAGE_BOUNDED=1 git commit(commit message 写明责任归属)',
      '',
    ].join('\n'),
  },

  // --- 控制面strict棘轮(1 项,blocking)---
  {
    id: '182',
    label:
      '控制面 strict 棘轮门(b76-12c票2配套):扫描面(apps/api/src/plugins + packages/shared/src)的 z.object+.strict+.catch 总和只减不增(基线 91);禁 passthrough 降红/禁装饰字段塞控制面',
    script: 'check-wire-strictness.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["apps/api/src/plugins/", "packages/shared/src/"],
    skipEnv: 'HUSKY_SKIP_WIRE_STRICTNESS',
    onFailHint: [
      '',
      '单独复现:node scripts/check-wire-strictness.mjs',
      '自检:node scripts/check-wire-strictness.mjs --self-test(8 例)',
      '基线吸收记录:立门读数 68 取自 strict 化落盘前工作树,与立门提交 be6da32e6b 树统计(91)不符;超出的 23 处经逐行核对全部来自 wave-2 W3 提交 ac63a7084a 帧 schema 票对 contract.ts 的落库(5 .object + 6 .strict + 12 .catch,控制面收紧+装饰载荷 .optional().catch 降级的正当形态),2026-09-30 接链时按当次真值吸收至 91,无未清偿红',
      '应急放行:HUSKY_SKIP_WIRE_STRICTNESS=1 git commit(commit message 写明责任归属)',
      '',
    ].join('\n'),
  },

  // --- 分片上传聚合预算(1 项,blocking)---
  {
    id: '183',
    label:
      '分片上传聚合预算棘轮门(b76-12c票3配套):chunked-upload.ts 的 begin 新建装配检(isPerUserSessionBudgetExceeded)与每片落盘追加检(wouldStagedBudgetOverflow)各 ≥1,两档常量须在 PROTOCOL_UPLOAD_LIMITS 登记,防死表回潮',
    script: 'check-upload-budget.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["apps/api/src/routes/chunked-upload.ts", "apps/api/src/services/upload-integrity.ts"],
    skipEnv: 'HUSKY_SKIP_UPLOAD_BUDGET',
    onFailHint: [
      '',
      '单独复现:node scripts/check-upload-budget.mjs',
      '自检:node scripts/check-upload-budget.mjs --self-test(4 例)',
      '应急放行:HUSKY_SKIP_UPLOAD_BUDGET=1 git commit(commit message 写明责任归属)',
      '',
    ].join('\n'),
  },

  // --- 活文档点名路径存续性对账(1 项,blocking)---
  {
    id: '184',
    label:
      '📚 活文档点名路径存续性对账(blocking,正文反引号点名的仓内路径必须在被审面在位;索引缺而 HEAD 在 ⇒ 红,HEAD 缺席只 warning,2026-09-30 D169 立)',
    script: 'check-live-doc-references.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_LIVE_DOC_REFERENCES',
    stagedTriggers: ['PROJECT_PLAN.md', 'AGENTS.md', 'README', 'docs/', 'scripts/', 'apps/', 'packages/', 'config/'],
    onFailHint: [
      '',
      '红 = 这次提交面上,活文档正文反引号点名的仓内路径在索引里没了(HEAD 在位)—— 本次提交正把被点名的文件弄丢(D169 事故格)。',
      '1) 误删 ⇒ \`git restore --staged <path>\` 找回;确属下线 ⇒ 同步更新点名它的活文档(两条路,本门只读不代恢复);',
      '2) 单复验:node scripts/check-live-doc-references.mjs --staged(提交链档)/ 不带旗 = 三面审计档;自检:--self-test(例数以命令末行为准);',
      '   CK 维(2026-10-13,G-1113921 口径③承接落地):被已勾登记行(- [x])点名的 HEAD 缺失路径分桶 checkedMissing 单独报数、不判红(升红即恒红门,§12e);--strict 对 CK 存量判红;正当修法(验收行与文件同枚进来)由 newlyLanded 放过;',
      '3) HEAD 本就没有的点名只 warning(笔误档),不构成红 —— 禁止用改判据/加豁免消红(§12e);',
      '4) 紧急跳过(不推荐):HUSKY_SKIP_LIVE_DOC_REFERENCES=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 迁移内容不可变性对账(已入库 drizzle 迁移不得被改写;IM1 与"该 tag 首次入库的 blob"逐字节比,存量只报数;IM2 判本次改写面;枚举 0 判死不记绿)(1 项,blocking)---
  {
    id: '185',
    label:
      '迁移内容不可变性对账(已入库 drizzle 迁移不得被改写;IM1 与"该 tag 首次入库的 blob"逐字节比,存量只报数;IM2 判本次改写面;枚举 0 判死不记绿)',
    script: 'check-migration-immutable.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_MIGRATION_IMMUTABLE',
    stagedTriggers: ['packages/database/', 'apps/api/src/'],
    onFailHint: [
      '',
      '',
    ].join('\n'),
  },

  // --- Python import 入库存续性对账(1 项,blocking)---
  {
    id: '189',
    label:
      'Python import 入库存续性对账',
    script: 'check-python-import-landed.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_PYTHON_IMPORT_LANDED',
    stagedTriggers: ['apps/ai-service/'],
    onFailHint: [
      '',
      'HEAD 里有人 import 一个从未入库的 Python 模块 ⇒ 干净检出与 CI 起不来,而本机在跑的进程把它掩盖了。',
      '出路只有一条:把被 import 的包/模块与实现同一枚提交入库,或去掉这条 import。不得为过门改判据。',
      '',
    ].join('\n'),
  },

  // --- 枚举兜底不得取宽档(1 项,warn)---
  {
    id: '190',
    label:
      '枚举/映射取不到时的兜底分支不得落到更宽的权限或能力档(票 G-816027):宽档集合由被审面的两份注册表(TS POLICY_BY_MODE / PY skips_approval_permission_mode)现读推导,推导失败或槽位撞名一律未判定;与"凭据在场即豁免"那道门(157)不重叠计账',
    script: 'check-enum-default-widening.mjs',
    args: [],
    mode: 'warn',
    skipEnv: 'HUSKY_SKIP_ENUM_DEFAULT_WIDENING',
    stagedTriggers: ['apps/cli/src/', 'packages/types/src/', 'apps/ai-service/app/core/'],
    onFailHint: [
      '',
      '修复:兜底分支要么显式抛错,要么取最窄档;不得把"没声明"读成"允许"。',
      '问责档(含未判定即拒绝出合格证):node scripts/check-enum-default-widening.mjs --strict',
      '',
    ].join('\n'),
  },

  // --- 测试判据复制对账(§22c 跨门尺子;门体与镜像测试各写一份形态清单/正则即点名,存量 27 处只报数 ⇒ warn,升 blocking 前置 = 命中归零)(1 项,warn)---
  {
    id: '191',
    label:
      '测试判据复制对账(§22c 跨门尺子;门体与镜像测试各写一份形态清单/正则即点名,存量 27 处只报数 ⇒ warn,升 blocking 前置 = 命中归零)',
    script: 'check-test-judge-not-replicated.mjs',
    args: [],
    mode: 'warn',
    skipEnv: 'HUSKY_SKIP_TEST_JUDGE_REPLICATED',
    stagedTriggers: ['scripts/check-', 'scripts/tests/'],
    onFailHint: [
      '',
      '',
    ].join('\n'),
  },

  // --- 注册表工作树超集对账(package.json / guardian-runner 的已入库入口被工作树副本整行写回旧态;今日 28 份注册表零存量 ⇒ blocking,只在 --staged 面问责)(1 项,blocking)---
  {
    id: '192',
    label:
      '注册表工作树超集对账(package.json / guardian-runner 的已入库入口被工作树副本整行写回旧态;今日 28 份注册表零存量 ⇒ blocking,只在 --staged 面问责)',
    script: 'check-registry-worktree-superset.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_REGISTRY_WORKTREE_SUPERSET',
    stagedTriggers: ['package.json', 'scripts/guardian-runner.mjs'],
    onFailHint: [
      '',
      '',
    ].join('\n'),
  },

  // --- §22d 入口守卫对账(1 项,blocking)---
  {
    id: '194',
    label:
      '🧯 §22d 入口守卫对账:scripts/**.mjs 不得顶层裸 main()(存量以 node scripts/check-direct-run-guard.mjs 末行现读为准,差值棘轮只拦本次新增)',
    script: 'check-direct-run-guard.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_DIRECT_RUN_GUARD',
    stagedTriggers: ['scripts/'],
    onFailHint: [
      "本门判的是:scripts/**.mjs 顶层裸 main() 且全文没有 §22d 的 isDirectRun 双形态入口守卫。",
      "复现与现读:node scripts/check-direct-run-guard.mjs(全量档判 HEAD blob 只报数,差值棘轮只拦本次新增)",
      "修法只有一个:在文件末尾按 AGENTS.md §22d 那四行补守卫(main() 位置不动,只决定何时触发),",
      "  并把判据单元 export 成 __test__ 供 §22c 镜像测试调用;禁止为变绿去删用例或放宽形态清单。",
      "紧急跳过:HUSKY_SKIP_DIRECT_RUN_GUARD=1(跳过即放弃「新脚本必须可导入」这一不变量,须在提交信息写明理由与清偿票)",
      "具名台账唯一出口:scripts/data/direct-run-guard-exemptions.json(逐条 path+reason+reviewBy,过期即回到队列)。",
    ].join('\n'),
  },

  // --- 事务体内取消探测对账(db.transaction 回调体内不得 throwIfAborted/signal.aborted)(1 项,blocking)---
  {
    id: '195',
    label:
      '事务体内取消探测对账(db.transaction 回调体内不得 throwIfAborted/signal.aborted)',
    script: 'check-txn-cancel-boundary.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_TXN_CANCEL_BOUNDARY',
    stagedTriggers: ['apps/', 'packages/'],
    onFailHint: [
      '',
      '取消检查必须落在事务边界外;紧急跳过 HUSKY_SKIP_TXN_CANCEL_BOUNDARY=1(跳过即放弃 G-815960 那格不变量,须在提交信息写明理由)',
      '',
    ].join('\n'),
  },

  // --- 派生结论通道对账(1 项,blocking)---
  {
    id: '199',
    label:
      '派生把 stdout 丢掉/直通终端、同一作用域却又读它 ⇒ 结论恒 null,门把"没拿到"写成"机器态未判定"并 exit 0(立因 G-1108372)',
    script: 'check-spawn-output-channel.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_SPAWN_OUTPUT_CHANNEL',
    stagedTriggers: ['scripts/'],
    onFailHint: [
      '',
      '  ❌ 本门拦的是**反极性**:标量 stdio:"ignore" 对三个通道同时生效,而该调用靠 stdout 拿结论。',
      '     改法 = stdio: ["ignore","pipe","pipe"](stdin 关掉、输出收),不是给"不吃输出"的调用加豁免。',
      '  💡 与 check-git-stdio-discipline / check-spawn-stdio 的分工:那两道判"缺 stdio / 写 pipe 也算病";',
      '     本门只问"stdout 通道被丢了却还有人读"。并进去会把正当写法判红(AGENTS §12e 恒红门同型)。',
      '  📖 判据唯一实现 scripts/lib/spawn-output-channel.mjs;本型**没有行内豁免通道也没有基线**。',
      '',
    ].join('\n'),
  },

  // --- provider 健康四档单一真相源对账(1 项,blocking)---
  {
    id: '200',
    label:
      'provider 健康四档单一真相源对账(值域并表后不得再分叉)',
    script: 'check-provider-health-vocabulary.mjs',
    args: ['--strict'],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_PROVIDER_HEALTH_VOCAB',
    stagedTriggers: ['apps/', 'packages/'],
    onFailHint: [
      '',
      '1) 本门判的是 provider 健康档位 unknown/healthy/degraded/down 的单一真相源:canonical 住在 apps/web/app/(main)/settings/llm/types-v2.ts 的 PROVIDER_HEALTH_STATUSES(2026-10-07 机主拍板并表);',
      '2) 红 = 全仓出现第二份同值档位声明,或 canonical 被摘线/改值域 ⇒ 把重复那份改为 import canonical(类型或 as const 数组),不要改任一侧取值、不要加豁免;',
      '3) 真子集(残缺表)与同名不同域只报名不判红 —— 补齐到全档即翻红,那是预期行为,不是门坏了;',
      '4) 单复验:node scripts/check-provider-health-vocabulary.mjs --strict(问责档)/ --staged --strict(提交链档)/ --self-test;',
      '5) 应急跳过(不推荐,跳过即放弃这次并表防回潮):HUSKY_SKIP_PROVIDER_HEALTH_VOCAB=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- mobile-rn 版本号单调递增对账(1 项,blocking)---
  {
    id: '201',
    label:
      '📱 mobile-rn Expo 配置必须产出单调递增的 versionCode/buildNumber(app.json 无 versionCode ⇒ Expo 默认恒 1,覆盖安装必被 Android 降级保护拒;2026-10-12 装机实测)',
    script: 'check-mobile-version-code.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_MOBILE_VERSION_CODE',
    stagedTriggers: ['apps/mobile-rn/', 'scripts/check-mobile-version-code.mjs'],
    onFailHint: [
      '',
      '  ❌ 本门拦的是"版本号回潮":app.json 不声明 android.versionCode 时 Expo prebuild 默认恒为 1,',
      '     CI nightly 包覆盖任何更高版本号的构建必被降级保护拒(install -r / -d / uninstall -k 全试过,',
      '     只有全删重装一条路,本地登录态全丢)。iOS 同病:无 ios.buildNumber ⇒ CFBundleVersion 恒 1。',
      '  💡 判据不扫源码正则,而是以 Expo 同构语义执行被审面 app.config.js(type:module,落 .cjs 载入),',
      '     审计产出的 android.versionCode / ios.buildNumber;号段边界 FLOOR/CEILING 由 app.config.js',
      '     导出、本门读取,不写第二份。修复出口(二选一):① 恢复 resolveBuildNumber 注入;',
      '     ② 确需钉号设 IHUI_VERSION_CODE(正整数 ∈ [26010100, 2100000000])。不得为消红删导出或削判据。',
      '  📖 单复验:node scripts/check-mobile-version-code.mjs --self-test / --staged / --worktree / --json',
      '',
    ].join('\n'),
  },

  // --- 移动端 release 打包的 API 基址是否真被内联(1 项,blocking)---
  {
    id: '202',
    label:
      '📱 移动端 release 打包步必须能看到 EXPO_PUBLIC_API_BASE_URL(只挂 prebuild 步 ⇒ 打包期内联 localhost:8802,线上全量断网;2026-10-13 装机实测)',
    script: 'check-mobile-api-base-bake.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_MOBILE_API_BASE_BAKE',
    stagedTriggers: [
      '.github/workflows/',
      'apps/mobile-rn/',
      'scripts/check-mobile-api-base-bake.mjs',
    ],
    onFailHint: [
      '',
      '  ❌ 本门拦的是"基址没被内联进产物":把它只挂在 `expo prebuild` 那一步的 env 上没用 ——',
      '     真正求值并内联 process.env.EXPO_PUBLIC_* 的是打包器(gradle 的 createBundleReleaseJsAndAssets /',
      '     xcodebuild 的 Bundle React Native)跑 metro+babel 的转换期,那一步不在 prebuild 的 env 作用域里。',
      '     实测后果:产物里 https://api.aizhs.top 命中 0 次、http://localhost:8802 命中 1 次,',
      '     且包 targetSdk=36 无 usesCleartextTraffic ⇒ 明文回环也被拦 ⇒ 登录页恒「网络连接异常」。',
      '  💡 修复出口(二选一,不得为消红削判据):① 提到 job 级 env(见 mobile-apk-build.yml 的 jobs.apk.env)',
      '     或打包步自身的 env(iOS 现状),使打包器转换期可见;② 确需换基址时同步改',
      '     apps/mobile-rn/eas.json 的 build.production.env(本门以它为单一真相)。',
      '  📖 单复验:node scripts/check-mobile-api-base-bake.mjs --self-test / --staged / --worktree / --strict / --json',
      '',
    ].join('\n'),
  },

  // --- 台账同题多号差值棘轮对账(1 项,blocking)---
  {
    id: '203',
    label:
      '🧾 台账同题多号差值棘轮:PROJECT_PLAN.md 索引面不得比 HEAD 面多出「同一件事的第二次登记」(换了个编号也算,2026-10-13 机主拍板根治)',
    script: 'check-plan-task-duplicates.mjs',
    args: ['--ratchet'],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_PLAN_DUP_TITLE',
    stagedTriggers: ['PROJECT_PLAN.md', 'scripts/check-plan-task-duplicates.mjs', 'scripts/live-doc-edit.mjs'],
    onFailHint: [
      '',
      '  ❌ 本门拦的是「同题多号」—— 同一件事在台账上挂着多个编号。复合主键(编号+题面前缀)',
      '     换个编号即通过,所以并发取号撞车后让号重登 / union 并集回流 / 回捞复位三条路径',
      '     每次都往台账各抄一份(立项现读单组最多 22 行),派单口径被同题灌水 ⇒「任务永远做不完」。',
      '  💡 判据 = 标题指纹(归一化标题,剥编号/日期/〔〕注记)的**成员键计数**只许变少:',
      '     锚点取 HEAD:PROJECT_PLAN.md,候选取索引 blob(本次提交真会带走的那一份)。',
      '     存量组只报数不拦(判存量 = 恒红门,§12e);组内多挂一个号、新增一整组、',
      '     同题同号再抄一份,三型都在计数维上判红(组数维对「清一组 + 新增一组」恒绿)。',
      '  🛠 修法(择一,禁止为消红放宽判据或摘掉指纹维):',
      '     ① 让号/重登必须**旧行同批**加〔【归并】同题多号收拢〕指针或删掉 —— 只增不删就是重复登记;',
      '     ② 确属另一件事 ⇒ 把题面写到取不出同一个指纹(换编号不算改题);',
      '     ③ 登记一律走 live-doc-edit 的 {{NEXT_ID}} 令牌(发号前已查同题,命中拒发),别手填号。',
      '  📖 单复验:node scripts/check-plan-task-duplicates.mjs --self-test(30 例) / --ratchet(索引面 vs HEAD 面) / --staged --ratchet;默认档只报数,--strict 问责。',
      '  ⚠️ 应急跳过:HUSKY_SKIP_PLAN_DUP_TITLE=1(跳过即放弃「同一件事只有一行当前状态」这条不变量,须在提交信息写明理由与清偿票)',
      '',
    ].join('\n'),
  },

  // --- 错误归因唯一出口对账(1 项,blocking;G-816012 交付物,2026-10-13 主会话接线)---
  {
    id: '204',
    label:
      '🧭 错误归因唯一出口(blocking,生产面不得出现第二份 `.message.includes(` 归因判定;调用点必须走 packages/shared 的 attributeError)',
    script: 'check-error-attribution-single-source.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_ERROR_ATTRIBUTION_SINGLE_SOURCE',
    stagedTriggers: ['apps/', 'packages/', 'scripts/'],
    onFailHint: [
      '',
      '  💡 三条判据缺一不可(缺一条,这道门就是"看着在判"的摆设):',
      '     ① 反第二份 —— 生产面出现 `.message.includes(` / `.message?.includes(` 形态的错误文本判定 ⇒ 判红。',
      '        上游把同一判定散在 40 处是反面教材;本票同批把存量清零,此后**任何**一处即红(不设棘轮)。',
      '     ② 引用出口 —— 调用 attributeError( 的生产文件必须从唯一出口导入;出口必须至少有一个**端外**',
      '        生产消费者(只有 barrel re-export 不算 —— 出口零消费者 = 判据挂在半空,只判了纯形状)。',
      '     ③ 反向锁 —— 站点键 = 文件 + 行 + 列 + 该处**原文**片段,绝不按文本归并、也绝不按归因结果归并',
      '        (按结果去重会把第二处违规抹平:「超时」与「timeout」是同一规则的两个 needle,但它们是两处判定)。',
      '  🛠 修法:新错误源进 packages/shared/src/utils/error-attribution.ts 加规则,调用点 import attributeError;',
      '     禁止在调用点再抄一份 message 文本判定 —— 判据只认"调用唯一出口",不认"内容看着一样"。',
      '  📖 单复验:node scripts/check-error-attribution-single-source.mjs(全量档,判 HEAD blob)/',
      '     --staged(提交链档,判索引 blob)/ --worktree(仅人工)/ --self-test',
      '  ⚠️ 应急跳过:HUSKY_SKIP_ERROR_ATTRIBUTION_SINGLE_SOURCE=1(须在提交信息写明理由与清偿票)',
      '',
    ].join('\n'),
  },

  // --- 未知枚举兜底档(1 项,blocking;G-815963 交付物,2026-10-13 主会话接线)---
  {
    id: '205',
    label:
      '🧩 未知枚举兜底档(blocking,闭集状态的未命中分支兜初始态 ⇒ 红;未知值必须落「不再产生副作用」那一档)',
    script: 'check-enum-fallback-terminal.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_ENUM_FALLBACK_TERMINAL',
    stagedTriggers: ['apps/', 'packages/', 'scripts/'],
    onFailHint: [
      '',
      '  💡 题面:未知枚举的兜底档必须是"不再产生副作用"那一档。兜到初始态等于把**已终态的账**',
      '     放回可写集合(上游反例 session-inputs.ts:369-391:未知 status→\'admitted\',已终态行重新',
      '     进入可 settle 集合,与状态前置 CAS 相互拆台)。',
      '  🔍 判据(结构/语义特征点名,不扫注释词面):候选 = 闭集状态集合的成员判定',
      '     `SET.includes(v)` / `SET.has(v)`(SET 须含 status/state 语义且是集合形),或唯一出口',
      '     `coerceKnownOr(v, known, safe)` 的 safe 实参;取档 = 未命中分支的落点(三元 else /',
      '     `if (!TEST) return|throw|continue|break` / 块内首个 return)。',
      '  🛠 修法(档位词表):初始态/可写档(pending/running/admitted/open/draft/…)⇒ 红;',
      '     终态档(closed/completed/failed/cancelled/unknown/…)或显式拒绝(null/throw/continue/break)⇒ 绿;',
      '     两表皆不中、标识符不可解析、表达式落点 ⇒ 中性不判(这是反向锁,防"语义不同形"被词面误伤)。',
      '  📖 单复验:node scripts/check-enum-fallback-terminal.mjs --self-test(11 例)/ --staged(本次暂存变更,',
      '     判索引 blob)/ --worktree(仅人工逃生舱)/ 不带旗 = 全量档判 HEAD blob;镜像测试 6 例。',
      '  ⚠️ 应急跳过:HUSKY_SKIP_ENUM_FALLBACK_TERMINAL=1(须在提交信息写明理由与清偿票)',
      '',
    ].join('\n'),
  },

  // --- 错误码不得按文本判(1 项,blocking;G-710 残项收口,2026-10-13 主会话接线)---
  {
    id: '206',
    label:
      '🔢 错误码不得按文本判(blocking,新增分支按 err.message/includes(\'429\') 判身份 ⇒ 红;存量按该文件 HEAD 自身棘轮只报数)',
    script: 'check-error-code-not-text-matching.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_ERROR_CODE_TEXT_MATCHING',
    stagedTriggers: ['apps/', 'packages/'],
    onFailHint: [
      '',
      '  💡 判据与预筛**同源**(都由 TEXT_OPS 派生)—— 预筛漏一个算子,门就对该算子整型失明而账面报绿',
      '     (守门 102:预筛必须是判据字面量超集)。遮噪方向**刻意只遮注释、保留字符串**:本门要判的',
      '     就是 `includes(\'429\')` 里那个字面量,整条遮字符串 = 对该形态全盲,而全盲的门报出来的是',
      '     最贵的那种假绿(门 131 正是被自己写的解释判红的)。',
      '  🔍 射程 = apps/ 与 packages/ 的 .ts/.tsx/.js/.jsx;测试面不判红但**必须报名**(--all 逐文件量),',
      '     因为把"按文本判"当契约钉在测试里,会让缺陷从"实现里的一处疏忽"升级成"改了就红"的锁。',
      '  🛠 修法:让抛出方给码(new ToolError(code, message)),消费侧 resolveFailureCode(err, site) 读码;',
      '     确属正当形态(断言外部驱动的真实文本)加行内豁免 `error-code-exempt: <原因>`,到期由守门 108 追。',
      '  📖 单复验:node scripts/check-error-code-not-text-matching.mjs --self-test(12 例)/ --staged / --worktree /',
      '     --all / --json;镜像测试 12 例(T10 即"门已入库就必须已接线"的问责)。',
      '  ⚠️ 应急跳过:HUSKY_SKIP_ERROR_CODE_TEXT_MATCHING=1(须在提交信息写明理由与清偿票)',
      '',
    ].join('\n'),
  },

  { id: '207', label: '📏 AGENTS.md 体积守门(逐字注入面尺寸,预算 96,000 字节;口径与定级依据见脚本头注)', script: 'check-agents-doc-size.mjs', args: [], mode: 'blocking', skipEnv: 'HUSKY_SKIP_AGENTS_DOC_SIZE', stagedTriggers: ['AGENTS.md'] },
  // --- 工作区嵌套 git 仓零容忍(2026-10-14 幻影仓事故)(1 项,blocking)---
  {
    id: '208',
    label:
      '🪆 工作区嵌套 git 仓零容忍(blocking,0 存量棘轮;演练/夹具仓被 IDE 源代码管理扫成「暂存的更改 10000+ 全 D」幻影)',
    script: 'check-no-nested-git.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_NO_NESTED_GIT',
    stagedTriggers: ['scripts/'],
    onFailHint: [
      '',
      '  💡 工作树里出现嵌套 .git —— 2026-10-14 的「暂存的更改 10000+(全 D)」幻影就是这么来的:',
      '     IDE 把嵌套仓当独立仓库扫描,而主仓命令行面自始至终干净,机主因此看不出有没有活没交。',
      '  🔍 定位:node scripts/check-no-nested-git.mjs(逐条点名绝对路径)',
      '  🛠 修法:① 夹具/演练仓无留存价值 → 删目录或只摘 .git(大目录走 robocopy /MIR,§5e-2);',
      '          ② 测试基建要临时仓 → 落点改 scripts/lib/scratch-dir.mjs 的 mkScratch()(工作区外+退出回收);',
      '          ③ 确属合法 → 不许静默豁免:门脚本加显式常量 + 因由 + §22c 镜像对账(.worktrees 顶层已在射程外)。',
      '  ⚠️ 应急跳过:HUSKY_SKIP_NO_NESTED_GIT=1(须在提交信息写明理由与清偿票)',
      '',
    ].join('\n'),
  },

  // --- 行切分口径对账(1 项,warn)---
  {
    id: '210',
    label:
      '📐 TS/Python 行切分口径逐例同值对账(warn;§0.9 造好没装车那一格)',
    script: 'check-line-split-parity.mjs',
    args: [],
    mode: 'warn',
    stagedTriggers: ["apps/web/src/lib/py-line-count.ts", "apps/ai-service/app/routers/llm.py"],
    skipEnv: 'HUSKY_SKIP_LINE_SPLIT_PARITY',
    onFailHint: [
      '',
      '  尺子 scripts/check-line-split-parity.mjs 早在库,现读「P1 行切分 22 例 / P2 改动行 32 例 | 漂移 0 / 未判定 0 ✅ 两侧逐例同值」,',
      '  但提交链/CI 注册点逐处 grep 命中 0 ⇒ "复刻 llm.py 口径"只在有人手动跑时才成立(§0.9)。本次以 warn 接入:三态同值/漂移/未判定绝不并桶,',
      '  取不到对照解释器 exit 2 拒绝出具合格证(现走仓内 apps/ai-service/.venv,不猜 PATH 上的 python)。',
      '  升 blocking 的前置(§12e):先给 CI 一条能稳定取到对照解释器的通道,否则在无 venv 的机器上会把每次提交顶成"未判定"。',
      '',
    ].join('\n'),
  },

  // --- 号池对账(G-313 续,2026-10-15 立):机主裁定任务号池 1..99(2026-10-24 由三位数收紧为两位数),该硬上限原先只写在发号器里,活面无门拦"声明位号 >99"⇒ 绕开发号器用 usedIdsOfPrefix max+1 发出过两条七位号(已让号)。升 blocking 前置 = HEAD 面存量归零(§12e);2026-10-15 复注:原 209 号注册块被 80bfe30520 覆盖掉,现由正牌插入器重新占号(1 项,blocking;2026-10-22 HEAD 存量归零后升档)---
  {
    id: '211',
    label:
      '🧮 PROJECT_PLAN 号池对账(声明位号 >99 按重数差值棘轮;R2 发号路径点名)',
    script: 'check-plan-id-pool.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_PLAN_ID_POOL',
    stagedTriggers: ['PROJECT_PLAN.md'],
    onFailHint: [
      '',
      '  现值以门体与 runner 双向一致为准(门 89 R10/R12 会核对);',
      '  单独复验:node scripts/check-plan-id-pool.mjs [--staged|--json];',
      '  自检:node scripts/check-plan-id-pool.mjs --self-test(4 组判据 · 阳性对照 5 条);',
      '  取证长号是谁的:node scripts/check-plan-id-pool.mjs --json 看 stock 列表;',
      '  修法:用正牌取号器换池内空闲号并留改号尾注(node scripts/next-plan-id.mjs 报池内空闲清单);',
      '  紧急跳过(不推荐):HUSKY_SKIP_PLAN_ID_POOL=1 git commit ...',
      '',
    ].join('\n'),
  },

  { id: '212', label: '🎯 输入框聚焦反馈对账(描边输入/选择控件必须有聚焦反应,三端同尺;存量按该文件 HEAD 自身棘轮只报数,定级依据与取证窗见脚本头注)', script: 'check-input-focus-feedback.mjs', args: [], mode: 'blocking', skipEnv: 'HUSKY_SKIP_INPUT_FOCUS_FEEDBACK', stagedTriggers: ['apps/', 'packages/'] },
  // --- 213 (2026-10-15 新增,盘根写入回归锁:从代码面杜绝新的盘根外流生产者) ---
  // blocking:只拦**本次提交新增**的盘根一级写入(差值棘轮,锚点 = 该文件 HEAD 自身 W1 数),
  //   存量只报数不判红(§12e 恒红门禁令);全量档按构造恒"新增 0",提交链走 --staged。
  //   与 check-disk-root-hygiene(守盘上别留垃圾)互补,本门守代码别再产新的。应急放行:
  //   HUSKY_SKIP_DISK_ROOT_WRITE=1 git commit ...(不推荐)。
  {
    id: '213',
    label: '🛡️  盘根写入回归锁(代码里别再产新的盘根外流;差值棘轮只拦新增)',
    script: 'check-disk-root-write.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
    skipEnv: 'HUSKY_SKIP_DISK_ROOT_WRITE',
  },
  // --- ApiKeyPermission 三面对账(1 项,blocking)---
  {
    id: '214',
    label:
      'ApiKeyPermission 三面对账(union ↔ web 两处标签表 ↔ 五语言 apiKeyPerms;2026-10-16 CI e2e 因缺 voice:stt 标签恒红那格的防回潮)',
    script: 'check-api-key-permission-labels.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_API_KEY_PERM_LABELS',
    stagedTriggers: ['packages/types/src/api-key.ts', 'apps/web/app/(main)/admin/developer/DeveloperKeyDialog.tsx', 'apps/web/app/(main)/settings/api-keys/PermissionSelector.tsx', 'packages/i18n/messages/web'],
    onFailHint: [
      '',
      '红线:不得为变绿把表改成 Partial<Record<...>> 或加 ! 断言 —— 那等于废掉编译期那把尺(镜像测试第 4 臂钉住)。',
      '出路:同一笔提交把 union 新成员在 DeveloperKeyDialog.PERMISSION_LABELS 与 PermissionSelector.PERM_LABELS 两处补齐,并同批补五语言 packages/i18n/messages/web/*.json 的 apiKeyPerms.<leaf>(§19)。',
      '取证:node scripts/check-api-key-permission-labels.mjs --self-test(8 臂) + 镜像 scripts/tests/check-api-key-permission-labels.test.mjs;定级前置 = 落地当刻 HEAD 面 RC=0(§12e)。',
      '',
    ].join('\n'),
  },

  // --- CI 失败自述对账(1 项,blocking)---
  {
    id: '215',
    label:
      'CI 失败自述覆盖面与自洽性对账(blocking,W2/W3 硬拦;W1 覆盖面走差值棘轮只拦新增,存量只报数)',
    script: 'check-ci-failure-triage-wiring.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_CI_TRIAGE_WIRING',
    stagedTriggers: ['.github/workflows/', 'scripts/ci-failure-triage.sh', 'scripts/data/ci-triage-exempt-jobs.json', 'scripts/check-ci-failure-triage-wiring.mjs'],
    onFailHint: [
      '',
      '红线:不得为变绿去放宽 TRIAGE_IDS 匹配或删掉豁免台账条目;W1 覆盖面存量归各工作流持有人,判据只拦新增(§12e)。',
      '修复出口:给该作业每个带 id 的步骤补 TRIAGE_IDS 与同名 O_ 注入,TRIAGE_WORKFLOW_FILE 写本文件自身,命令单行 bash scripts/ci-failure-triage.sh;确属例外往 scripts/data/ci-triage-exempt-jobs.json 具名登记并写 reason。',
      '备注:本条注册曾被他席整文件回写洗掉一次(枚 dc57b333a9 落过 id 213),现重新注册;回潮即说明共享注册表必须逐块核对 diff(§26)。',
      '',
    ].join('\n'),
  },

  // --- 217/218(2026-10-15/16 立;原注 213/214→214/215 两度与上游撞号让位顺延:213 已归盘根写入门、214 已归 ApiKeyPermission 三面对账;病理五类实锤/hex 取材口径逐字归档 .ihui-agent/archive/guardian-runner-comments-pre-6000-2026-10-14.md §门214/215,2026-10-16 C1 腾行)---
  { id: '217', label: '📐 mobile-rn sheet/弹窗 flex 弹性契约(bounded 容器内列表必须唯一弹性块,固定 chrome 不被压扁)', script: 'check-sheet-flex-contract.mjs', args: [], mode: 'blocking', stagedTriggers: ['apps/mobile-rn/src/'] },
  {
    id: '218',
    label: '🎨 RN 端硬编码 hex 基线棘轮(基线之外新增 #hex 即 BLOCK,存量只减不增)',
    script: 'check-mobile-rn-style-parity.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_RN_STYLE_PARITY',
    stagedTriggers: ['apps/mobile-rn/src/', 'scripts/rn-style-parity-baseline.json'],
    onFailHint: [
      '',
      '  改法:把 #hex 换成 @ihui/design-tokens(rnLightTokens/rnDarkTokens)的 token 引用,不要新造近似色。',
      '  存量治理后可运行 node scripts/check-mobile-rn-style-parity.mjs --update-baseline 收紧基线(全量档,不得与 --staged 同用)。',
      '  取材口径:全量=HEAD blob、--staged=索引 blob、--worktree=人工排查;取不到 ⇒ exit 2 无法判定。',
      '  自检:node scripts/check-mobile-rn-style-parity.mjs --self-test',
      '',
    ].join('\n'),
  },
  // --- 端内共享类型重声明(1 项,blocking)---
  {
    id: '219',
    label:
      '🧬 端内共享类型重声明对账(共享对外类型名不得在端内再写一份;差值棘轮锚点=该文件 HEAD 自身违规数,存量只报数)',
    script: 'check-shared-type-not-redeclared.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_SHARED_TYPE_REDECLARED',
    stagedTriggers: ['apps/', 'packages/'],
    onFailHint: [
      '',
      '① 看是哪一条:node scripts/check-shared-type-not-redeclared.mjs --staged --json 里 detail 逐条点名 文件/类型名/sameShape(yes|no|undetermined)/reachable;\\n② sameShape=yes 且 reachable=true 的才是一条命令能收的:删本地声明,改 import 自 @ihui/types(原本导出的另起一行 export type { X } 保住上游 import 面);\\n③ sameShape=no 是"跨层同名不同物",不许并 —— 并了就是把两件不同的东西并成一件(改档前必须先读完两侧字段);\\n④ sameShape=undetermined 要人工读两侧声明(门刻意不猜,判不出理由写在 shapeWhy);\\n⑤ 禁止用改阈值/加豁免/把命中集缩小消红;唯一出口是改 import 共享出口(AGENTS §3 共享层优先)。',
      '',
    ].join('\n'),
  },

  // --- 监控大屏指标名对账(1 项,blocking)---
  {
    id: '220',
    label:
      '监控大屏指标名对账(大屏查询的每个指标必须有代码发射点或台账登记)',
    script: 'check-grafana-metric-exists.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_GRAFANA_METRIC_EXISTS',
    stagedTriggers: ['monitoring', 'deploy', 'apps/ai-service/app', 'apps/api/src', 'packages', 'scripts/'],
    onFailHint: [
      '',
      '',
    ].join('\n'),
  },

  // --- 监控大屏 ↔ 数据源 接线对账(1 项,blocking)---
  {
    id: '222',
    label:
      '监控大屏 ↔ 数据源 接线对账(面板引用的 uid 必须在 provisioning 里;声明了却零面板使用的源只报数不判红——未部署的基建是合法状态)',
    script: 'check-grafana-datasource-wiring.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_GRAFANA_DATASOURCE_WIRING',
    stagedTriggers: ['monitoring', 'scripts/sync-grafana-live-provisioning.mjs'],
    onFailHint: [
      '面板引用的数据源 uid 不在 monitoring/panel-defs/provisioning/datasources/datasources.yml 里 ——',
      '这样的面板只会静静显示 "Datasource not found",和"这业务本来没流量"长得一模一样。',
      '要么把 uid 改成已声明的源,要么先在 provisioning 里声明这个源(并跑 sync-grafana-live-provisioning.mjs 派生到线上副本)。',
    ].join('\n'),
  },

  // --- mjs 语法对账(1 项,blocking)---
  {
    id: '221',
    label:
      '🧾 .mjs 语法对账(被审面全量纯解析,只解析不执行;--staged 差值棘轮只拦本次带进来的,存量只报数——上线当刻 HEAD 面实测 1 枚存量,定级与清偿见门体头注)',
    script: 'check-mjs-syntax.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*.mjs"],
    skipEnv: 'HUSKY_SKIP_MJS_SYNTAX',
    onFailHint: [
      '',
      '  修法:对点名文件跑 node --check <file> 看行(事故型 = 块注释/字符串被劈成孤残行),修完复跑 node scripts/check-mjs-syntax.mjs --staged 确认转绿。',
      '  存量报数(不拦提交)= node scripts/check-mjs-syntax.mjs;清偿后要问责存量加 --strict;禁止为消红改判据。',
      '  自检:node scripts/check-mjs-syntax.mjs --self-test(11 例,含哨兵反证"绝不执行顶层代码");镜像:node --test scripts/tests/check-mjs-syntax.test.mjs',
      '  应急跳过(不推荐):HUSKY_SKIP_MJS_SYNTAX=1 git commit ...(须在提交信息写明理由)',
      '',
    ].join('\n'),
  },

  // --- 桌面端事件链路接线(1 项,blocking)---
  {
    id: '223',
    label:
      '桌面端(Tauri)事件链路三层接线守门:Rust emit→use-desktop listen/case→CustomEvent→web addEventListener 消费方闭环;含 G8 整页导航先复位深链闸门、G9 整页导航发起点必须先触发存草稿(desktop-before-close)',
    script: 'check-desktop-event-wiring.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_DESKTOP_EVENT_WIRING',
    stagedTriggers: ['apps/desktop/src-tauri/src', 'apps/web/src'],
    onFailHint: [
      '',
      '① 看清单:node scripts/check-desktop-event-wiring.mjs',
      '② 自检:node scripts/check-desktop-event-wiring.mjs --self-test',
      '③ 修:Rust emit 的事件须在 apps/web/src/hooks/use-desktop.ts 有 listen+case;dispatch 的 CustomEvent 须有 addEventListener 消费方;auto_refresh.rs 整页导航发起点须先 emit desktop-before-close(存草稿)',
      '紧急跳过:HUSKY_SKIP_DESKTOP_EVENT_WIRING=1',
      '',
    ].join('\n'),
  },

  // --- 生成器资源释放(1 项,warn;升 blocking 前置见门体头注)---
  {
    id: '225',
    label: '生成器资源释放对账(warn;持有事务/句柄/订阅的 async 生成器,消费方提前 break/抛错时不得只靠退出作用域与 GC)',
    script: 'check-generator-resource-release.mjs',
    args: [],
    mode: 'warn',
    skipEnv: 'HUSKY_SKIP_GENERATOR_RESOURCE_RELEASE',
    stagedTriggers: ['apps/ai-service/'],
    onFailHint: [
      '',
      '  💡 本门的红只有一格能收:消费点必须在自己 finally 里显式 aclose()/return() 生成器,',
      '     而不是靠作用域退出与 GC(判据本体见门体头注;升 blocking 的前置 = violations 归零,§12e)。',
      '     单独复现:node scripts/check-generator-resource-release.mjs',
      '     自检:node scripts/check-generator-resource-release.mjs --self-test',
    ],
  },

  // --- 告警身份抖动(1 项,blocking)---
  {
    id: '224',
    label:
      '告警身份抖动对账(到人邮件的去重身份不得含逐轮抖动的 sha/时刻/原始计数/异常原文;差值棘轮:只拦本次加回来的)',
    script: 'check-alert-identity-volatility.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_ALERT_IDENTITY',
    stagedTriggers: ['scripts/', 'deploy/win/', 'apps/api/src/', 'apps/api/scripts/'],
    onFailHint: [
      '',
      '  💡 判的是"到人邮件的去重身份里塞了每轮都变的量"(sha / 时刻 / 原始计数 / 异常原文)。',
      '     身份只留「类别 × 折档」—— 折档只用这几把通用尺子:alertCountTier / alertHeldTier /',
      '     classifyAlertIdentity(js) 或 Get-*Tier(ps1);实时读数一律只进邮件正文,不进身份。',
      '     单独复现:node scripts/check-alert-identity-volatility.mjs --staged',
      '     自检:node scripts/check-alert-identity-volatility.mjs --self-test(15 例,含成对反证)',
      '     确属稳定语义主键(如同一枚 commit 的 intake)⇒ 只认具名到期台账:',
      '     scripts/data/alert-identity-exemptions.json(每条带 reason/ticket/until,无行内豁免)。',
      '     发信面总账:scripts/data/alert-mail-faces.json(V3 射程声明 / V4 发现集都读它)。',
      '     紧急跳过:HUSKY_SKIP_ALERT_IDENTITY=1 git commit …(不推荐:这一维直接决定信箱会不会被刷屏)',
      '',
    ].join('\n'),
  },

  // --- 钩子形态(1 项,blocking)---
  {
    id: '226',
    label:
      '钩子装载形态对账(.husky 钩子必须 sh 薄壳,node 正文只能在 scripts/lib)',
    script: 'check-husky-hook-form.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_HOOK_FORM',
    stagedTriggers: ['.husky/'],
    onFailHint: [
      '',
      'node 正文搬进 scripts/lib/<hook>-hook.js,钩子文件只留 sh 薄壳(样板 .husky/pre-commit);薄壳引用的包装与正文必须在同一判定面在位',
      '',
    ].join('\n'),
  },

  // --- miniapp-design-token-parity(1 项,blocking)---
  {
    id: '227',
    label:
      '🎨 小程序 design-token 副本逐位同值(blocking,判 app.css 首块已有键 × 7 类 token,含提交链唯一覆盖的 --chart-* 档)',
    script: 'check-miniapp-taro-design-tokens.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_MINIAPP_TARO_DESIGN_TOKENS',
    stagedTriggers: ['apps/miniapp-taro/src/app.css', 'packages/design-tokens/src/styles/tokens.css'],
    onFailHint: [
      '',
      '  💡 app.css 首块的 design-token 档与 packages/design-tokens/src/styles/tokens.css 不同值。',
      '     正解只有一条:改源头 tokens.css,再跑派生写回(node scripts/sync-miniapp-tokens.mjs 或 TOKEN_SYNC_TARGETS 那条入口),',
      '     禁止手改 app.css 受管块(那是派生态,下一次 sync 就把它洗掉)。',
      '     缺档(源头有、副本没有)不归本门,那是守门 36 的判据。',
      '',
    ].join('\n'),
  },

  // --- 跨端 BPE 词表对账(1 项,blocking) ---
  {
    id: '228',
    label: '跨端 BPE 词表对账(blocking;C1 声明 + C2 行为 + C3 反向锁)',
    script: 'check-bpe-encoding-parity.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_BPE_ENCODING_PARITY',
    stagedTriggers: ['packages/context-compaction/', 'apps/ai-service/app/core/context_compaction.py'],
    onFailHint: [
      '',
      '  💡 两端 BPE 表必须同是已批准的 cl100k_base;改 token-estimate.ts 或 context_compaction.py 后',
      '     先跑 node scripts/check-bpe-encoding-parity.mjs --worktree 取读数,再提交。',
      '     紧急跳过:HUSKY_SKIP_BPE_ENCODING_PARITY=1(仅限红确属他人文件时)。',
      '',
    ].join('\n'),
  },

  // --- 会话 Cookie 域作用域对账(blocking):Domain= 只许经 auth-cookies 的 resolveCookieDomain 单源按请求 host 下发,Host 取样必须走代理感知出口 request.hostname —— 2026-10-20 本机臂(127.0.0.1 无条件挂域,浏览器安静拒收,Cookie 从未落地)与公网臂(裸 headers.host 把反代后面的域内访客降级成 host-only,跨子域共享登录被打断)两连安静失效后立(1 项,blocking)---
  {
    id: '230',
    label:
      '会话 Cookie 域作用域对账(blocking):Domain= 只许经 auth-cookies 的 resolveCookieDomain 单源按请求 host 下发,Host 取样必须走代理感知出口 request.hostname —— 2026-10-20 本机臂(127.0.0.1 无条件挂域,浏览器安静拒收,Cookie 从未落地)与公网臂(裸 headers.host 把反代后面的域内访客降级成 host-only,跨子域共享登录被打断)两连安静失效后立',
    script: 'check-auth-cookie-domain-scope.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_AUTH_COOKIE_DOMAIN_SCOPE',
    stagedTriggers: ['apps/api/'],
    onFailHint: [
      '',
      '',
    ].join('\n'),
  },

  // --- 暖色描边禁令(1 项,blocking)---
  {
    id: '231',
    label:
      '🚫 暖色描边禁令(W1 聚焦态描边取暖色 / W2 原生 EditText 背景引用 textfield_* 9-patch / W3 AppTheme 未钉强调色 / W4 plugins 被 .gitignore 吞掉)',
    script: 'check-no-warm-border.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
    skipEnv: 'HUSKY_SKIP_WARM_BORDER',
    onFailHint: [
      '',
      '',
    ].join('\n'),
  },

  // --- 嵌套仓豁免台账耐久性(1 项,blocking)---
  {
    id: '232',
    label:
      '🧾 嵌套仓豁免台账耐久性(HEAD 面已登记未到期行被洗掉即红;载体=行式 no-nested-git-sites.jsonl + 旧 JSON 台账;现场存续仍由门 208 现算,本门只守行存续)',
    script: 'check-no-nested-git-sites-durability.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["scripts/data/no-nested-git-sites.jsonl", "scripts/data/no-nested-git-exemptions.json"],
    skipEnv: 'HUSKY_SKIP_NESTED_GIT_SITES_DURABILITY',
    onFailHint: [
      '',
      '  💡 门 208 的两把豁免台账(行式 scripts/data/no-nested-git-sites.jsonl + 旧 JSON',
      '     scripts/data/no-nested-git-exemptions.json)里,HEAD 面上**未到期**的登记行在被审面上不见了。',
      '     两把台账是数据文件 —— 整文件覆盖就是整文件覆盖,一次拿滞后副本提交就会把别人的登记行整批洗掉',
      '     (本门正是为此而设:洗掉那一刻没有任何东西报警)。',
      '     修复(二选一,都走一次提交,不靠跳门):',
      '       A. 无意洗掉 ⇒ 把 HEAD 面的登记行原样带回再提交(行式按 rel 逐字;JSON 按条目);',
      '       B. 有意摘除(现场真消失 / 已到期 / 换载体)⇒ 在本枚提交里写明摘的是哪一条、为什么,',
      '          行式台账改删那一行、JSON 台账改删那一条目,让"少了一行"这件事本身出现在 diff 里。',
      '     现读命令: node scripts/check-no-nested-git-sites-durability.mjs [--staged]',
      '     (现场在不在由门 208 判红那一刻现算,本门只守"已登记未到期的行不许静默消失")',
      '',
    ].join('\n'),
  },

  // --- SSE 全量帧盲合并(1 项,blocking;票 G-274 的接线落点)---
  // 接线前置现读(2026-10-21):① HEAD 全量档 候选 7019 · 实判 312 · 命中 0 · 放过 6 · 未判定 0;
  // ② 棘轮锚点 = 该文件 HEAD 自身命中数 0 ⇒ 零基线上"绝对判红"与"差值棘轮"等价(存量非零前
  // 不得升 blocking,§12e);③ 生产消费点已接:`packages/shared/src/utils/sse-parse.ts` 从
  // `../chat/projection-watermark` 导入(去测试面后非测试命中 2 个文件)。
  // stagedTriggers 恰等于本门的候选枚举面(apps/ + packages/),执行层再按反向依赖闭包加宽。
  {
    id: '233',
    label:
      '🧬 SSE 全量帧盲合并(全量帧 snapshot/initial 分支里铺开本地旧状态即红;未判定逐条点名,--strict 下 exit 2)',
    script: 'check-sse-no-blind-merge.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_SSE_NO_BLIND_MERGE',
    stagedTriggers: ['apps/', 'packages/'],
    onFailHint: [
      '',
      '  💡 全量帧的语义是"这就是完整状态",写成 `{ ...prev, ... }` 会让 initial 丢失后的',
      '     新代次第一帧拼在旧投影上,产出一段自洽但根本不存在的对话(日志零痕迹)。',
      '     唯一正解:全量帧整体替换投影;能不能拼交给 packages/shared/src/chat/projection-watermark.ts',
      '     (基线代次 + 序号单调 + 断档只重订阅),不得在分支里就地补偿。',
      '  单独复验:node scripts/check-sse-no-blind-merge.mjs [--staged|--strict|--json]',
      '     自检:node scripts/check-sse-no-blind-merge.mjs --self-test(15 例)',
      '  紧急跳过(不推荐):HUSKY_SKIP_SSE_NO_BLIND_MERGE=1 git commit ...',
      '',
    ].join('\n'),
  },

  // 档位依据(G-965):红线只由**差值维**触发 —— A1 只数相对 HEAD 基准面本次新带入的未勾行,
  // A2 只数被审面上标头与侧车不一致的枚数;存量缺侧车(现读 109 枚)只在结论行报数、不进 verdict,
  // 否则就是与提交内容无关的恒红门(§12e)。存量是否清零由门自己打印,人不复述。
  // --- 计划/台账(1 项,blocking)---
  {
    id: '234',
    label:
      '计划台账侧车字段一致性(新增行有侧车 ∧ 标头==侧车投影)',
    script: 'check-plan-fields.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_PLAN_FIELDS',
    stagedTriggers: ['PROJECT_PLAN.md'],
    onFailHint: [
      '',
      '读数:node scripts/check-plan-fields.mjs;结清存量:node scripts/plan-fields-extract.mjs --apply(只搬说辞不改台账行)',
      '',
    ].join('\n'),
  },

  // --- Button 档位收编(1 项,blocking)---
  {
    id: '235',
    label:
      '📏 Button 高度档位(三面取材:HEAD blob / 索引 blob / 工作区仅人工)',
    script: 'check-button-height.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_BUTTON_HEIGHT_GUARD',
    stagedTriggers: ['apps/', 'packages/'],
    onFailHint: [
      '',
      '修复:改用 size 档位(新高度先在 packages/ui-react/src/components/button.tsx 立档)',
      '自检:node scripts/check-button-height.mjs --self-test',
      '紧急跳过:HUSKY_SKIP_BUTTON_HEIGHT_GUARD=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- tracked-ignored(1 项,blocking)---
  {
    id: '236',
    label:
      'tracked-but-ignored 新增拦截(gitignored 的东西不得进版本控制)',
    script: 'check-tracked-ignored.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
    skipEnv: 'HUSKY_SKIP_TRACKED_IGNORED',
    onFailHint: [
      '',
      '把落点改成写盘/写 gitignored 的运行态目录,或从本次声明集去掉该路径。',
      '不要用 git add -f 绕过;不要把 .gitignore 的否定规则放宽到整个目录。',
      '',
    ].join('\n'),
  },

  // --- 239 (2026-10-23 新增,计划归档单调性;原登记 237 与 check-cross-end-screen-coverage 撞号,2026-10-24 改号) ---
  // 立因(当日实测事故):工作区台账被旧快照回插 29+/16- —— 4 条**已归档**(✅ 含日期)的完成票
  //   (D17/G-807/僵尸实例/G-8160 失败共享事实)被展开回"未勾活行",整批已被 git add 进暂存区。
  //   门 71 守"丢行"、门 229 守"跨枚滞留的已勾行",两侧都不覆盖"已完成票复活成待办"。
  //   判据只裁决**本次新增行**(存量只报数,§12e):复活已归档标记 ⇒ 红;同标记逐字孪生 ⇒ 红;
  //   改写/搬移(删旧+增新)与全新票放行。自证:`node scripts/check-plan-archive-monotonic.mjs --self-test`。
  {
    // 2026-10-24 改号:原误登记 id '237' 与跨端页面覆盖对账撞号(门 89 R5 判红,串 skipEnv
    // 与失败归属);后来者改号,判据面不动。
    id: '239',
    label: '🈲 计划归档单调性(PROJECT_PLAN.md 已归档✅的票不得复活成未勾活行/逐字孪生回插)',
    script: 'check-plan-archive-monotonic.mjs',
    args: ['--staged'],
    mode: 'blocking',
    stagedTriggers: ['PROJECT_PLAN.md'],
    skipEnv: 'HUSKY_SKIP_PLAN_ARCHIVE_MONOTONIC',
    onFailHint: [
      '',
      '  💡 成因几乎总是"按旧快照整文件写回":HEAD 里已归档(✅)的票被展开回未勾活行,',
      '     或同一条登记行被再插一份(逐字孪生)。正解是从 HEAD 取现版重放,不是 --no-verify:',
      '       1) 取现版:git show HEAD:PROJECT_PLAN.md > <临时文件>;',
      '       2) 用 scripts/live-doc-edit.mjs 定向改写(带 CAS)重放你要写的行;',
      '       3) 复核:node scripts/check-plan-archive-monotonic.mjs --worktree(审磁盘面)。',
      '     自检:node scripts/check-plan-archive-monotonic.mjs --self-test(8 例,含反向锁)',
      '     紧急跳过(不推荐):HUSKY_SKIP_PLAN_ARCHIVE_MONOTONIC=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 大屏读数不得断行(2026-10-24 立,机主指认号池面板「6天19小时」被切成两半)---
  {
    id: '240',
    label:
      '📏 大屏「一格一读数」网格的读数不得断行(blocking;R1 大字号读数 nowrap / R2 --wb-cell-min 定义且被消费 / R3 c3 档引用常数 / R4 wb-split-c3 面板内每组同档 / R5 栏阈值按源码常数复算 / R6 时长读数不得停在裸 auto-fit 档)',
    script: 'check-readout-no-break.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ['apps/web/', 'packages/ui-react/', 'apps/extension/'],
    skipEnv: 'HUSKY_SKIP_READOUT_NO_BREAK',
    onFailHint: [
      '',
      '  💡 读数被折成两行(如「6天19小 / 时」)的成因是三层常数脱钩。修法只有一条:',
      '     列宽不足时**减列/减栏**,不得让读数折行、不得截断数字、不得缩字号。',
      '       1) 长读数组用 .wb-cells.wb-cells-c3(下限 = var(--wb-cell-min),实测 143px);',
      '          复合读数(两个量并排 / 带 unit 槽)用 .wb-cells-wide(实测 224px,c3 不够);',
      '       2) 该组住在 wb-split 里时,面板须带 wb-split-c3(两栏阈值由同一批常数复算);',
      '       3) 改了 --wb-cell-min 必须让 R5 的复算式仍成立(阈值=2×(3×下限+2×列间距)+栏间距)。',
      '     自检:node scripts/check-readout-no-break.mjs --self-test(9 例,每条判据各有反向锁)',
      '     像素够不够本门不判(取决于运行时值长度)⇒ 复跑只读尺:',
      '       node scripts/verify-wallboard-readout.mjs --worktree --widths 1280,1440,1920',
      '     规范:docs/UI_GUIDELINES.md「读数不得断行」',
      '     紧急跳过(不推荐):HUSKY_SKIP_READOUT_NO_BREAK=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 端侧等分读数格(2026-10-24 立;§13.4 的端侧分支,存量已归零才升 blocking)---
  {
    id: '241',
    label:
      '📏 端侧(RN / 共享源)「读数被压缩」形状不变量(blocking;V1 等分格缺 minWidth / V2 行缺 flexWrap / V3 space-between 行内读数缺 flexShrink:0 / V4 absolute 容器内读数缺 flexShrink:0 / V5 定宽格缺 minWidth;AST 判 JSX 父子关系,存量 69 处已归零)',
    script: 'check-rn-readout-cell.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ['packages/app/', 'apps/mobile-rn/', 'apps/miniapp-taro/'],
    skipEnv: 'HUSKY_SKIP_RN_READOUT_CELL',
    onFailHint: [
      '',
      '  💡 端侧没有 white-space,读数被压缩就折行。修法按宿主形态分五档(docs/UI_GUIDELINES.md §13.4):',
      '     【等分格】1) 行加 flexWrap: \'wrap\'  —— 放不下就**整格换行**;',
      '                2) 格加 minWidth = 该格最坏读数的单行宽 —— 没有它 flexWrap 一次都不触发',
      '                   (flex:1 的 flexBasis 是 0,子项总宽永不超容器,只会等分压缩)。',
      '     【space-between 行】读数 Text 加 flexShrink: 0 —— 行内两个子项都没有 flex 时,',
      '                读数默认 flexShrink:1,行宽不够会**先压读数**,标签反而完整。',
      '     【absolute 容器】同上,加 flexShrink: 0。',
      '     【定宽格 width%/flexBasis】只能加 minWidth —— flexShrink 是纵向主轴属性,',
      '                对横向定宽无效,给它加 flexShrink 等于没加。',
      '     minWidth 取值按字号档(实测):16-18px → 96 / 20-22px → 112 / 24px → 128~136。',
      '     禁止用 numberOfLines={1} 顶替 —— 那是把断行换成省略号,同样违反本条。',
      '     自检:node scripts/check-rn-readout-cell.mjs --self-test(8 例,含 V2 与「只加 wrap」两条反向锁)',
      '     镜像测试:node scripts/tests/check-rn-readout-cell.test.mjs(16 例,V1-V5 各有反向锁)',
      '     复跑:node scripts/check-rn-readout-cell.mjs --worktree [--json]',
      '     紧急跳过(不推荐):HUSKY_SKIP_RN_READOUT_CELL=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 读数零分母 / 定时器句柄覆盖(2026-10-25 立;支付轮询僵尸 + 看板 NaN% 上屏)(1 项,blocking)---
  {
    id: '244',
    label:
      '⏱️ 读数分母与定时器句柄卫生(blocking;D1 `<ref>.current = setInterval(` 前既无字面 clearInterval、也无一跳可验的具名停止函数 ⇒ 绝对零容忍 / D2 `A / B.length` 无 B 的零守卫 ⇒ 差值棘轮,存量现读 0)',
    script: 'check-readout-and-timer-hygiene.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ['apps/web/', 'packages/'],
    skipEnv: 'HUSKY_SKIP_READOUT_AND_TIMER_HYGIENE',
    onFailHint: [
      '',
      '  💡 全文住门体头注:node scripts/check-readout-and-timer-hygiene.mjs(D1 句柄被覆盖 ⇒ 僵尸轮询带旧订单号;',
      '     D2 零分母 ⇒ 首屏明写 NaN%)。修法:起新前先 clearInterval(同一句柄);分母为零如实给 null/"—"。--self-test 20 例。',
      '     紧急跳过(不推荐):HUSKY_SKIP_READOUT_AND_TIMER_HYGIENE=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 额度守卫写入的影响行 / 回调吞失败(2026-10-25 立;积分兑换超卖 + 提现黑洞)(1 项,blocking)---
  {
    id: '243',
    label:
      '💸 额度扣减必须读回影响行 + 资金回调不得用 SUCCESS 吞失败(blocking;G1 扣额度型守卫写入无 .returning 且结果被丢 / G3 相对扣减完全没有额度守卫 / G4 额度列无锁的绝对值回写(锁内 FOR UPDATE 机器豁免) / G5 计数字段(…Count/aiRounds)读出来±1再写绝对值 / G2 回调 catch 里回 code:SUCCESS)',
    script: 'check-guarded-write-affected.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ['apps/api/src/'],
    skipEnv: 'HUSKY_SKIP_GUARDED_WRITE_AFFECTED',
    onFailHint: [
      '',
      '  💡 立因/修法全文住门体头注(§22c 不重抄):node scripts/check-guarded-write-affected.mjs',
      '     G1 扣额度写入不读回影响行(兑换超卖不退款)/ G2 资金回调回 SUCCESS 吞失败(提现永冻)/',
      '     G3 相对扣减缺 gte(余额,数额)/ G4 无锁绝对值回写=丢失更新(锁内 FOR UPDATE 机器豁免)。',
      '     不收:单调推进(lt(lastMessageAt))与范围删除(gt(createdAt))的 0 行本就是正解。',
      '     --staged 复验 / --self-test(24 例)/ 镜像 scripts/tests/check-guarded-write-affected.test.mjs。',
      '     紧急跳过(不推荐):HUSKY_SKIP_GUARDED_WRITE_AFFECTED=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 活文档同形态副本翻倍(2026-10-25 立;README 4.6MB / 同一行 596 份的 union 病)(1 项,blocking)---
  {
    id: '245',
    label:
      '📜 活文档副本增生对账(blocking;六份活文档各按自身差值棘轮拦"本次把同形态副本加回来了";折叠判据 import scripts/dedupe-live-doc.mjs,本门不写第二份)',
    script: 'check-live-doc-duplicates.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ['README.md', 'README.en.md', 'README.ko.md', 'README.ja.md', 'AGENTS.md', 'PROJECT_PLAN.md'],
    skipEnv: 'HUSKY_SKIP_LIVE_DOC_DUPLICATES',
    onFailHint: [
      '',
      '  💡 立因(现读):README.md 曾长到 4,653,356 B / 15,334 行,同一形态行最多 596 份 —— 行级 union 只守恒"不丢行",',
      '     判不出"同一段落被复制一千份" ⇒ 逐次合并单调翻倍(4→51→99→198→296→589→1176 枚 A:Yes 行),门 173 只逐键比数字。',
      '     唯一出口(只折副本不折内容,四档守恒):node scripts/dedupe-live-doc.mjs <文档路径…> --apply;' +
        '按文档差值棘轮,AGENTS/PLAN 存量只报数(§12e)。--self-test 6 例 / 镜像 18 例。',
      '     紧急跳过(不推荐):HUSKY_SKIP_LIVE_DOC_DUPLICATES=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 业务日界单一真相源(2026-10-25 立;大屏同屏 UTC 签到日 vs 上海新增日)(1 项,blocking)---
  {
    id: '246',
    label:
      '🕐 业务日界只许一个出口(blocking;B1 第二份日界算法 ⇒ 绝对零容忍(存量本枚清零)/ B2 日键型 toISOString().slice(0,10) ⇒ 差值棘轮 / B3 唯一出口无人 import ⇒ 造好未装车)',
    script: 'check-biz-day-single-source.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ['apps/api/src/'],
    skipEnv: 'HUSKY_SKIP_BIZ_DAY_SINGLE_SOURCE',
    onFailHint: [
      '',
      '  💡 立因:"哪一天算一天"曾有 6 份私有实现(5 份逐字相同的 shanghaiDayStartUtc + 同屏 shanghaiDateString),',
      '     加上钉成 UTC 的 checkin-helpers.todayString(扇出 6 个签到/积分调用点)与访客日 ⇒ 大屏同屏「今日新增(上海日)」与',
      '     「今日签到(UTC 日)」并排,每天上海 00:00–08:00 签到格读成 0、连续天数断裂。',
      '     出口:apps/api/src/utils/biz-day.ts(bizDayStartUtc/bizDayKey/shiftBizDayKey);委托转发合法,自己再算不合法。',
      '     --staged 复验 / --self-test(9 例)/ 镜像 scripts/tests/check-biz-day-single-source.test.mjs。',
       '     紧急跳过(不推荐):HUSKY_SKIP_BIZ_DAY_SINGLE_SOURCE=1 git commit ...',
       '',
     ].join('\n'),
   },

  // --- asyncio 后台任务强引用(2026-10-26 立;create_task 弱引用被 GC 族根治)---
  {
    id: '247',
    label:
      '🧵 ai-service asyncio 后台任务强引用(blocking;W1 裸 create_task/ensure_future ⇒ 绝对零容忍 / W3 唯一出口无人 import ⇒ 造好未装车;赋值/列表持有型只报数,见门体 W2)',
    script: 'check-ai-task-background-reference.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ['apps/ai-service/'],
    skipEnv: 'HUSKY_SKIP_AI_TASK_BG_REF',
    onFailHint: [
      '',
      '  💡 事件循环对 create_task 返回值只握弱引用,丢弃 ⇒ 任务半路被 GC 且零报错(workflow 实例永逝/存活监控断线同型)。',
      '     出口:from app.core.background_tasks import spawn;合法豁免登记 scripts/data/ai-task-bare-exemptions.json(marker=调用行子串+reason+until,marker 消失=腐烂判红)。',
      '     --self-test 12 例 / 镜像 scripts/tests/check-ai-task-background-reference.test.mjs。',
      '     紧急跳过(不推荐):HUSKY_SKIP_AI_TASK_BG_REF=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 富文本动作锚点渲染器单一源头(2026-10-25 立;D99/G-136 账面兑现:MISSING_ANCHOR_RENDERERS"供守门判红"此前全仓 scripts 面 0 命中)(1 项,blocking)---
  {
    id: '249',
    label:
      '🧩 富文本锚点渲染器单一源头(blocking;A1 渲染表键集==RICH_ANCHOR_TAGS 双向相等+守卫在位(绝对零容忍,非棘轮)/ A2 apps/web 生产面 t.rich 内联渲染器分叉逐条点名(真 AST)/ A3 载体 importer 枚举 0 即死)',
    script: 'check-rich-anchor-renderer-single-source.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ['apps/web/', 'packages/shared/src/chat/'],
    skipEnv: 'HUSKY_SKIP_RICH_ANCHOR_RENDERER_SINGLE_SOURCE',
    onFailHint: [
      '',
      '  💡 立因:rich-anchor-text.tsx 头注与台账声称 MISSING_ANCHOR_RENDERERS"供守门/自检判红",',
      '     但备案当刻 git grep HEAD -- scripts 实测 0 个文件 —— 账面无人付费(§0.9"造好没装车"= 没有);',
      '     同刻 HEAD 实测 1 处 t.rich 调用把白名单标签渲染器内联在调用点(worktree-dialog 的 branch)——',
      '     表改了、内联副本不跟着改,两条腿静默漂开且无从对账。',
      '     A1 修法:新增/删标签两翼同批显式同步(packages/shared/src/chat/rich-anchors.ts 白名单 →',
      '            apps/web/src/components/chat/rich-anchor-text.tsx 同表补键),守卫不许改写;',
      "     A2 修法:调用点改成 { <tag>: richAnchorRenderer('<tag>') }(或整体传 RICH_ANCHOR_COMPONENTS);",
      '     A3 修法:恢复任一生产屏面对 RichAnchorText/richAnchorRenderer 的真实挂载,禁止为过门加假 import。',
      '     单独复验:node scripts/check-rich-anchor-renderer-single-source.mjs --staged',
      '     自检:node scripts/check-rich-anchor-renderer-single-source.mjs --self-test(14 例,A1/A2/A3 成对正反控)',
      '     镜像:node --test scripts/tests/check-rich-anchor-renderer-single-source.test.mjs(判据 import 门体 __test__,不复制)',
      '     紧急跳过(不推荐):HUSKY_SKIP_RICH_ANCHOR_RENDERER_SINGLE_SOURCE=1 git commit ...',
    ].join('\n'),
  },
  // --- 显示层分→元格式化单一出口(2026-10-26 立;20 份 fmtYuan 型副本收口后防复活)---
  {
    id: '248',
    label:
      '💴 显示层分→元格式化只许一个出口(blocking;M1 本地自算定义 ⇒ 绝对零容忍(存量本波清零)/ M2 行内定长格式化 ⇒ 差值棘轮只拦新增 / M3 唯一出口无人 import ⇒ 造好未装车)',
    script: 'check-money-display-single-source.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ['apps/web/', 'apps/miniapp-taro/src/', 'apps/mobile-rn/src/', 'packages/app/src/'],
    skipEnv: 'HUSKY_SKIP_MONEY_DISPLAY_SINGLE_SOURCE',
    onFailHint: [
      '',
      '  💡 `¥${(n/100).toFixed(2)}` 同形曾被逐字复制 20 份(改单位口径要 20 处手改,漏一处=该页 100 倍显示事故;',
      '     分销族 46758b5b2b8 的"分当元"批修即同型受害者)。出口:import { formatPrice } from @ihui/shared/utils;',
      '     委托转发(¥${formatPrice(n)})合法,数字换算(返回 number)出射程;行内定长存量走 ratchet 只报数。',
      '     --self-test 10 例 / 镜像 scripts/tests/check-money-display-single-source.test.mjs。',
      '     紧急跳过(不推荐):HUSKY_SKIP_MONEY_DISPLAY_SINGLE_SOURCE=1 git commit ...',
      '',
    ].join('\n'),
  },


  // --- 身份主体单一真相源(2026-10-25 立;crew/knowledge 匿名越权族根治)(1 项,blocking)---
  {
    id: '242',
    label:
      '🪪 apps/api 身份主体取值对账(blocking;W1 身份取自 auth 层从不填充的 request.user ⇒ 绝对零容忍 / W2 主体与客户端自报字段同一条 ??·|| 链 ⇒ 差值棘轮 / W3 测试夹具给生产不填的字段赋值(假 oracle)⇒ 绝对零容忍)',
    script: 'check-identity-principal-source.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ['apps/api/src/'],
    skipEnv: 'HUSKY_SKIP_IDENTITY_PRINCIPAL_SOURCE',
    onFailHint: [
      '',
      '  💡 本门抓的是"取到的人不是登录主体"这一族(2026-10-25 实测:crew.ts 13 端点 +',
      '     knowledge-rag.ts 8 处读 req.user,而 @fastify/jwt 把该字段 decorateRequest 成 null、',
      '     本仓 authenticate 走 jose 只写 request.userId ⇒ 恒 undefined,于是匿名调用即可按',
      '     客户端自报 userId/ownerUuid 读删他人数据;server.ts:276 的 onRoute 只注入网络分段,',
      '     **不注入鉴权**,所以此前没有任何门覆盖这一族)。同族 2026-08-06 曾在 openclaw-routes',
      '     发生过一次并只修了那一个点,没装闸 ⇒ 静默复发 15 个月。',
      '     【W1】身份只读 request.userId(或经 authenticate() 的返回值),不得再读 req.user/request.user。',
      '     【W2】归属主体必须只来自令牌;要按 userId 代他人操作,走具名出口',
      '            isSystemAdmin(req, { includeInternalChannel: false }) 显式特权判定,而不是 ?? 链。',
      '     【W3】测试夹具要填生产真会填的字段(request.userId / request.jwtPayload)。',
      '     单独复验:node scripts/check-identity-principal-source.mjs --staged(全量档不带旗)',
      '     自检:node scripts/check-identity-principal-source.mjs --self-test(19 例,W1/W2/W3 与具名出口各有成对反向锁)',
      '     镜像:node scripts/tests/check-identity-principal-source.test.mjs(判据 import 门体 __test__,不复制)',
      '     紧急跳过(不推荐):HUSKY_SKIP_IDENTITY_PRINCIPAL_SOURCE=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 镜像 purge 内容完好(2026-10-23 立)(1 项,blocking)---
  {
    id: '238',
    label:
      '🧹 镜像 purge 内容完好对账(blocking;M1 死仓 URL / M2 仓库根链接 / M3 徽章同行 / M4 在役断言;绝对零容忍,射程 10 文档,2026-10-23 union 行合并回潮根治)',
    script: 'check-mirror-purge-intact.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_MIRROR_PURGE_INTACT',
    stagedTriggers: ['README.md', 'README.en.md', 'README.ja.md', 'README.ko.md', 'AGENTS.md', 'docs/marketing/cn-launch-post.md', 'docs/marketing/multi-platform-distribution.md', 'docs/engineering/readme-01-positioning.md', 'docs/RELEASE.md', 'scripts/README.md'],
    onFailHint: [
      '',
      '  💡 射程内任何一面出现镜像 purge 内容 = 回潮(union 行合并不传播删除,2026-10-23 实测两例:AGENTS.md §5b 旧断言复活、README 徽章回归)。\\n  M1 gitcode.com/IHUI-AI 死仓 URL(该仓已删)/ M2 gitee.com/JLSLSSZWHYXGS_0/IHUI-AI 仓库根链接(/releases/ 资产路径豁免)/\\n  M3 同行含「国内镜像」且含 gitee|gitcode / M4 mirror-to-cn 无弃用标记(弃用|已删除|不再写回|退役|2026-10-23)。\\n  修法:把该行改回 purge 后形态(删徽章 / 删链接 / 补弃用标记),别想着加豁免 —— 射程 10 个文档是机主令永禁清单;\\n  PROJECT_PLAN.md 刻意不在射程(历史台账叙事,收进来即恒红)。\\n  单独复验:node scripts/check-mirror-purge-intact.mjs --staged\\n  自检:node scripts/check-mirror-purge-intact.mjs --self-test(19 例,正反成对);\\n  镜像:node --test scripts/tests/check-mirror-purge-intact.test.mjs(10 例,含 T1 方向锁)。\\n  紧急跳过:HUSKY_SKIP_MIRROR_PURGE_INTACT=1(必须在提交信息里写明理由与清偿票)',
      '',
    ].join('\n'),
  },


  // --- 新模块缺对应测试准入(增量)(1 项,warn)---
  {
    id: '250',
    label:
      '🧪 新模块缺对应测试(增量;票 E2E 自动补测·发现缺口那半,先 warn 观察)',
    script: 'check-e2e-coverage-gap.mjs',
    args: [],
    mode: 'warn',
    skipEnv: 'HUSKY_SKIP_E2E_COVERAGE_GAP',
    // 2026-10-27 补:判据层增规则③(收集目录同名),apps/*/tests|test/ 里的测试被删/改也会翻缺口
    // (测试被删 ⇒ 模块落进新增缺口),触发面必须罩住收集目录,否则那一族回潮跑不到本门。
    stagedTriggers: [
      'apps/web/app/',
      'apps/web/src/',
      'apps/web/tests/',
      'apps/api/src/',
      'apps/api/tests/',
      'apps/api/test/',
      'scripts/check-e2e-coverage-gap.mjs',
      'scripts/data/e2e-coverage-gap-scope.json',
      'scripts/lib/e2e-coverage-gap.mjs',
    ],
    onFailHint: [
      '',
      '  💡 本次暂存带进了没有对应测试的新模块(判据:①同目录 *.test.*|*.spec.* 同名;',
      '     ② __tests__ 词边界前缀;③ 收集目录 apps/*/tests|test/ 精确同名,同包同名唯一才认)。',
      '     补测骨架:node scripts/e2e-autofill.mjs --propose --staged',
      '     存量缺口只报数(差值棘轮),不拦本次;warn 档观察中。',
      '     紧急跳过:HUSKY_SKIP_E2E_COVERAGE_GAP=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- .ps1 BOM(差值棘轮)(1 项,blocking)---
  {
    id: '251',
    label:
      '📄 .ps1 必须带 UTF-8 BOM(差值棘轮:只拦本次新增/弄掉的)',
    script: 'check-ps1-bom.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_PS1_BOM',
    // 2026-10-27 补:判据面是**任意位置的** .ps1/.psm1(BOM 与目录无关),所以触发器不能只写
    // 某个端目录,否则改了别处的 .ps1 落地器不会复跑本门。
    stagedTriggers: ['**/*.ps1', '**/*.psm1'],
    onFailHint: [
      '',
      '给这些文件补 3 字节 UTF-8 BOM(正文一字节不动):',
      '  node scripts/lib/ps1-add-bom.mjs <文件...>',
      '为什么要管:AGENTS.md:319 规定 .ps1 用 UTF-8 with BOM 写。无 BOM 的中文脚本在 5.1 引擎上按 GBK 解码,',
      '报「意外的标记」并连累整模块「缺少右 }」 —— 2026-10-26 deploy-window-common.ps1 就是这样让 main 恒红的。',
      '判据是差值棘轮:HEAD 也没有的存量只报数不判红,只拦「本次新增」与「本次把 BOM 弄掉」。',
      '阈值与读数:node scripts/check-ps1-bom.mjs 末行;逐条列存量加 --list-existing。',
      '',
    ].join('\n'),
  },

  // --- lint-staged stdio 三针盯针(1 项,warn:判机器状态 ⇒ §12e 只能 warn,与门 153 同型)---
  {
    id: '252',
    label:
      '📌 lint-staged stdio 三针盯针(判机器状态:node_modules 里三针还在不在;§12e 只能 warn)',
    script: 'check-lint-staged-stdio-pin.mjs',
    args: [],
    mode: 'warn',
    stagedTriggers: ["**/*"],
    skipEnv: 'HUSKY_SKIP_LINT_STAGED_PIN',
    onFailHint: [
      '',
      '  💡 三针注在 node_modules 里(patch-lint-staged-stdio.mjs 写进去),一次 pnpm install 就没了,',
      '     而失效方向是安静的:钩子照跑,只在下次提交时以 errno 面目复现(G-53/G-63 消解过的死法)。',
      '     重打:node scripts/lib/patch-lint-staged-stdio.mjs(幂等,已打则零写盘);本门只读不修。',
      '     三档:0 三针齐 / 1 有缺口(逐针点名 file:mode) / 2 未判定(安装副本不在或版本目录漂移,不记绿也不冒红)。',
      '     判机器状态 ⇒ 挂 blocking 就是恒红门(§12e);另有 git-guardian 巡检轮 45 分钟派发一次',
      '     (实现 scripts/lib/lint-staged-pin-audit.mjs),两处共用同一把尺子。',
      '     紧急跳过:HUSKY_SKIP_LINT_STAGED_PIN=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 门注册表射程声明(1 项,blocking)---
  {
    id: '253',
    label:
      '📌 门注册表射程声明完备性(新增门必须写 stagedTriggers;摘射程判红;存量只报数)',
    script: 'check-gate-triggers.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_GATE_TRIGGERS',
    stagedTriggers: ['scripts/'],
    onFailHint: [
      '',
      '补射程:在 scripts/guardian-runner.mjs 的对应条目上加 stagedTriggers: ["<这条门真正读的路径前缀或 glob>"]',
      '要「任何提交都跑」也必须写出来(全匹配通配),不许留空 —— 留空在提交通道=任何提交都跑、在落地通道=永不复跑,两通道反义',
      '存量缺射程的道数见末行「存量缺=」;要逐条列加 --list-existing;要全量判红加 --strict',
      '',
    ].join('\n'),
  },
  {
    id: '254',
    label: '🐍 Python ruff lint(拦 chore(auto)/旁路落地把 Python 欠账直带进 HEAD)—— 2026-10-27 补注册,接线与点名同批',
    script: 'check-ruff-python.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_RUFF',
    stagedTriggers: ['apps/ai-service/'],
    onFailHint: [
      '',
      '  修法:node scripts/check-ruff-python.mjs 看红点 → 修掉 ruff 判红再提交;判定面与门 35 mypy 同口径(HEAD/索引/磁盘),',
      '  版本 pin 唯一源 = apps/ai-service/pyproject.toml;ruff 缺失/pin 坏/面取不到 ⇒ exit 2 未判定;',
      '  应急放行 HUSKY_SKIP_RUFF=1(§22c 形态锁,不得常态使用)。',
    ],
  },

  // --- 跨端视觉原子 spec 覆盖率棘轮(阶段3,守门 256)---
  {
    id: '256',
    label: '🔗 跨端视觉原子 spec 覆盖率棘轮(退化才拦;口径见 scripts/check-cross-end-spec-coverage.mjs)',
    script: 'check-cross-end-spec-coverage.mjs',
    args: ['--ratchet'],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_CROSS_END_SPEC_COVERAGE',
    stagedTriggers: [
      'packages/shared/src/ui/',
      'packages/ui-react/src/components/',
      'packages/ui-native/src/',
      'apps/web/src/components/data/',
      'scripts/check-cross-end-spec-coverage.mjs',
      'scripts/data/cross-end-spec-baseline.json',
    ],
    onFailHint: [
      '',
      '  💡 跨端视觉原子 spec 覆盖率相对基线退化(某原子 spec 已存在却某端不再消费)。',
      '     看差在哪:node scripts/check-cross-end-spec-coverage.mjs',
      '     基线:scripts/data/cross-end-spec-baseline.json(口径已校正:视觉原子 11 项含 button,collapsible 为 EXEMPT 不计分母)。',
      '     应急放行 HUSKY_SKIP_CROSS_END_SPEC_COVERAGE=1(仅限退化确属他人文件/并行谱系时,须在提交信息写明理由)。',
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
  // --- 角色档合规对账(元素类别→档位,77 不判的那一型)(1 项,blocking)---
  {
    id: '150',
    label:
      '角色档合规对账(元素类别→档位,77 不判的那一型)',
    script: 'check-radius-role-conformance.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_RADIUS_ROLE_CONFORMANCE',
    stagedTriggers: ['apps/', 'packages/'],
    onFailHint: [
      '',
      '  这道门问的不是"有没有绕档位表写死数字"(那是守门 77),而是"这一类元素取了角色表里的哪一档"。',
      '  修法只有一个:改成 packages/design-tokens/src/radius.js 的 RADIUS_ROLES 指定的那一档',
      '  (tiny→xs / control→sm / chip→md / card→lg / panel→xl / hero→2xl)。',
      '  确属新元素类别 ⇒ 先在 RADIUS_ROLES 加角色并同笔给出消费方,不得为消红放宽判据。',
      '  圆角豁免通道已整体废除(2026-09-29 O81 票㊵):标记不改变任何结论,而写标记本身由守门 77 的 B8 判红。',
      '  自验:node scripts/check-radius-role-conformance.mjs --files <你改的文件>;',
      '  存量还剩多少:同命令加 --json(数字一律现读,勿照文档抄)。',
      '  紧急跳过:HUSKY_SKIP_RADIUS_ROLE_CONFORMANCE=1(仅限红确属他人文件时)。',
    ].join('\n'),
  },
  // --- 旁路落地声明面对账(写回旧态那一型;G-978069 复裁判据落地)(1 项,blocking)---
  {
    id: '170',
    label:
      '🛰 旁路落地声明面对账(blocking,留痕声明面 ⊉ 实际面 ∧ 射程外路径写回旧 blob ⇒ 红并点名;增量台账每枚判一次)',
    script: 'check-bypass-landing-scope.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
    skipEnv: 'HUSKY_SKIP_BYPASS_LANDING_SCOPE',
    onFailHint: [
      '',
      '  💡 G-978069 那一型:旁路入库(object-space-land / live-doc-edit / commit-tree+CAS)的提交把',
      '     **声明路径之外**的路径按旧副本整文件写回,吞掉别人已入库的内容 —— 提交链三道门(84 R1 /',
      '     100 / 30c)都跑在钩子里,拦不到结构上不跑钩子的旁路通道;本门按留痕日志事后逐枚复量。',
      '     修复只有前向回补(§22 不重写历史):按被吞内容的原 blob 重新落地,参照 cfabf3128a 的形态;',
      '     判红已记入增量台账(.ihui-agent/state/bypass-landing-scope-audited.json),不会反复红,但内容必须修。',
      '     单独复验:node scripts/check-bypass-landing-scope.mjs',
    ].join('\n'),
  },
  // --- 承诺面/兑现面对账(2026-09-30 立,blocking)---
  //   拦"文档写了 HUSKY_SKIP_XXX=1 出路而全仓没有任何一处真读它" —— 按了静默无效,唯一出路退化成
  //   --no-verify,一次绕过等于全部守门对该提交作废(§12e 同型)。提交链档 --staged:与 HEAD 面的
  //   假承诺集合做差值棘轮,只拦**新增**假承诺;存量只点名不判红(问责出口 --strict)。
  {
    id: '172',
    label: '🛡  跳门变量承诺/兑现对账(blocking,文档承诺的 HUSKY_SKIP_* 必须有真实读点;差值棘轮只拦新增)',
    script: 'check-skip-env-promise.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
    skipEnv: 'HUSKY_SKIP_SKIP_ENV_PROMISE',
    onFailHint: [
      '',
      '  💡 新增的假承诺:文档(AGENTS.md/README.md)新写了一条 `HUSKY_SKIP_X=1` 出路,而代码里没人读它。',
      '     修法只有两条:① 给该变量接真实读取点(或 runner 注册块 skipEnv 一行);② 把文档那句改成如实',
      '     措辞(禁令/说明),不要承诺一条跑不通的出路。存量假承诺不拦本次提交,可用 --strict 点名问责。',
      '     应急放行:HUSKY_SKIP_SKIP_ENV_PROMISE=1 git commit ...(commit message 写明责任归属)。',
    ].join('\n'),
  },

  // --- loadState 四档投影防漂移对账(1 项,warn)---
  // 编号 186:注册前已核 `grep -n "id: '186'"` 为空(未被占用);现值以本文件为准。
  {
    id: '186',
    label:
      'loadState 四档投影防漂移对账(LV1 四档字面量零散落 + LV2 五族 get_status 的 loadState 键与共享出口来源;warn 起步)',
    script: 'check-load-state-projection-parity.mjs',
    args: [],
    mode: 'warn',
    skipEnv: 'HUSKY_SKIP_LOAD_STATE_PROJECTION_PARITY',
    stagedTriggers: ['apps/ai-service/app/services/'],
    onFailHint: [
      '',
      'LV1:`"never_tried"` / `"retry_backoff"` / `"gave_up"` 三档字面量只许住在 _load_lifecycle.py 一个文件;',
      '     第二个服务文件逐字写出即红(下一次改动只改一处 ⇒ 四档语义分叉而两端都自洽)。',
      'LV2:五族(ab_test_tracker / meta_learner / federated_learner / memory_decay / user_profile)的',
      '     get_status 必须含 loadState 键,且其值必须来自共享出口 state_label(...) / LoadRecord.state_label()。',
      '  ⚠️ per-key 族(memory_decay / user_profile)**刻意不用** loaded / loadFailures 键名(同名不同义是最坏的',
      '     下游陷阱)——**不得**为"看起来一致"给它们补上这两个键;要改语义得另开一票动下游。',
      '定级 warn 是设计前提(照守门 156 的教训):接 blocking 就是让每台每次提交被逼 --no-verify,',
      '     一次绕过等于全部守门对该提交作废(AGENTS §12e/§12f)。存量与新增在报告里同列,不靠棘轮遮盖。',
      '问责跑 node scripts/check-load-state-projection-parity.mjs --strict;应急跳过 HUSKY_SKIP_LOAD_STATE_PROJECTION_PARITY=1。',
      '',
    ].join('\n'),
  },

  // --- 不安全 `_loaded` 载体写入侧(1 项,blocking)---
  // 编号 187:注册前已核 `grep -n "id: '187'"` 为空(未被占用);现值以本文件为准。
  {
    id: '187',
    label:
      '不安全加载标记四形态扫描(finally-set / except-set / tail-set / set-add;判据本体单份住在 _load_lifecycle.py,门内零自行判定;blocking)',
    script: 'check-load-state-loaded-marks.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_LOAD_STATE_LOADED_MARKS',
    stagedTriggers: [
      'apps/ai-service/app/services/',
      'apps/ai-service/app/routers/',
      'apps/ai-service/app/core/',
    ],
    onFailHint: [
      '',
      '判据:调用 _load_lifecycle.py 的 find_unsafe_loaded_marks(AST + 控制流位置),四形态逐条点名 path:line ——',
      '     ① finally 块里无条件 `self._loaded = True`(读失败也被记成已加载);',
      '     ② except 体内置真(异常分支被折成"已加载"哨兵,与成功路径不可判别);',
      '     ③ try/except 同块尾随置真(异常兜底之后无条件固化);',
      '     ④ 集合 add 记"已加载"(集合表达不了"试过了但没读到")。',
      '改法:置真只许落在成功路径与权威写入上;失败计数走 _load_lifecycle 的共享出口',
      '     (load_failures / 退避 / gave_up),别自己另写一套。',
      '⚠️ 单份实现纪律:判据只有一份,住在 _load_lifecycle.py。**不得**在门里或任何新模块里再抄一份正则/AST 判据 ——',
      '     两处算同一件事必漂移,且抄的那份会随被审面演化而唯一实现不动,两端各自自洽。',
      '⚠️ 覆盖面:扫描面是 app/**/*.py,**刻意不含 tests/****(测试注入会主动置真,扫进来即恒红)。',
      '     本门绿只意味着 app/** 侧无不安全载体,**不得**外推为"全仓 _loaded 载体合规"。',
      '定级 blocking 与姊妹门 186(warn)不同的理由:186 的"恒红门"前提在本门不成立 —— 存量面',
      '     (HEAD app/** 590 个 .py / 12.6MB)实测零命中,--strict 实测 rc=0,且判定面取自 blob',
      '     (不读工作树半编辑态,并发会话不会误伤)。所以 187 一旦有红是真新增,正是提交链该拦的那类。',
      '未判定(面取不到 / Python 派生失败 / SyntaxError / 判据符号缺失)= exit 2,既不冒红也不记绿;',
      '     "看不见"绝不能记成通过 —— 一台永远喊未判定的门和一台瞎掉的门在账面上是一样的。',
      '问责跑 node scripts/check-load-state-loaded-marks.mjs --strict;应急跳过 HUSKY_SKIP_LOAD_STATE_LOADED_MARKS=1。',
      '',
    ].join('\n'),
  },

  // 编号 188:注册前已核最大在用 id 为 187(见 187 上方注释),188 未被占用。
  {
    id: '188',
    label:
      '🔐 授权判据列隔离(blocking,拦「归属判据所在的 SELECT 顺带取了展示列」—— 展示字段损坏会把授权查询拖成 500 而不是 403/404;判据本体单份住在 check-authorization-column-isolation.mjs,门内零自行判定)',
    script: 'check-authorization-column-isolation.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_AUTHZ_COLUMN_ISOLATION',
    stagedTriggers: [
      'apps/ai-service/app/services/',
      'apps/ai-service/app/routers/',
      'apps/ai-service/app/api/',
      'apps/api/src/routes/',
      'apps/api/src/plugins/',
      'scripts/check-authorization-column-isolation.mjs',
    ],
    onFailHint: [
      '',
      '  💡 本门守的是「认证≠授权」的姊妹型:不是没校验身份,是**校验身份的那条查询被展示面',
      '     的数据质量绑架了** —— 归属判据 SELECT 里带了 content/title/display_name 这类展示列,',
      '     展示列一坏(脏数据/超长/编码坏)整条查询失败 ⇒ 请求返 500 而不是 403/404。',
      '  判据 = 归属轴谓词(必要) ∧ 下游存在存在性判决分支(充分)。**WHERE 里有 user_id 不等于',
      '     这条查询在做授权判决** —— 列表/检索/导出端点的 user_id 过滤只是范围过滤,',
      '     后面没有 `if not row: 404` 就不是判据(首版据此误报 11 处,实测教训已写进头注)。',
      '  SELECT * 不判红只报数:星号含不含展示列取决于表结构(DDL 不在Python 源里),',
      '     一刀切判红已被实测证伪(sweep_logs 整表 5 列零展示列)。',
      '  ⚠️ 真修复**必须放行**:存量命中因"展示列被摘掉"而消失时只报数、不判红 —— 首版护栏',
      '     把自己修的那四处判成了"删查询消红"并拦下,护栏挡正确修复比没护门更坏。',
      '  修复出口(二选一,不得为消红削判据):① 为归属判据单开一条窄查询,只 SELECT 判据所需列',
      '     (owner_user_id / user_id / 主键),展示列一概不取,展示路径另走自己那条查询',
      '     (参考 sso_identity_store.py 的 SELECT id, user_uuid + 独立 UPDATE email/name、',
      '     approval_persistence.py 的 SELECT 1);② 确属载荷列(业务键/缓存镜像,已在白名单)',
      '     ⇒ 在脚本 LOAD_BEARING_COLUMNS 逐条登记证据,禁止按目录整片放行。',
      '  ① 现读:node scripts/check-authorization-column-isolation.mjs [--json|--staged|--worktree|--strict]',
      '  ② 自检:node scripts/check-authorization-column-isolation.mjs --self-test(39 例,正反成对)',
      '  ③ 镜像:node --test scripts/tests/check-authorization-column-isolation.test.mjs(13 例)',
      '  紧急跳过(不推荐):HUSKY_SKIP_AUTHZ_COLUMN_ISOLATION=1 git commit ...',
      '',
    ].join('\n'),
  },

  // --- 台账短 sha 出处指针防回潮(G-1079146,warn 起步)(1 项)---
  {
    id: '196',
    label: '📎 PROJECT_PLAN.md 短 sha 出处指针防回潮(新增行裸短 sha 须走台账/声明前缀/文件名通道,warn)',
    script: 'check-plan-sha-form.mjs',
    args: [],
    mode: 'warn',
    stagedTriggers: ['PROJECT_PLAN.md', 'scripts/data/plan-sha-noncommit.json'],
    onFailHint: [
      '',
      '  💡 台账新增行里出现裸短 sha(7–12 位十六进制)且不属于任一放行通道 —— 票 G-1079146。',
      '     放行通道(判据侧,按序):①具名台账 scripts/data/plan-sha-noncommit.json 命中',
      '       (token+kind+reason+reviewBy,30 天复核,台账唯一通道,行内 -exempt 标记不构成放行);',
      '     ②声明表前缀行(revision= / 上游仓库: / 冻结上游 … 结尾紧贴 token);',
      '     ③文件名/ref 形态(path.ext、分支段 —— 不是提交指针)。40 位全量 sha 与形状歧义不进判。',
      '     修法:改 40 位全量 / 把缩写带 reason+reviewBy 登记进台账 / 改写为声明表行。',
      '     台账缺字段/日期非法/到期/被审面没命中(清单腐烂)/重复 ⇒ 两档皆红,由本门同判。',
      '     单独复验:node scripts/check-plan-sha-form.mjs --staged',
      '     自检:node scripts/check-plan-sha-form.mjs --self-test(26 例)',
      '     量算尺(可解析性现读):node scripts/check-plan-sha-resolvable.mjs',
      '',
    ].join('\n'),
  },

  // --- 有界列表截断诚实 + 投递档位收口绊线(G-998100/G-998101,观察票 warn 起步)(1 项)---
  {
    id: '197',
    label: '📉 truncated 声明块计数伴随 + 投递档位收口绊线(DTO 类型层,warn)',
    script: 'check-truncation-accounting.mjs',
    args: [],
    mode: 'warn',
    stagedTriggers: ['packages/', 'apps/api/src/', 'apps/ai-service/app/'],
    onFailHint: [
      '',
      '  💡 有界列表截断诚实(票 G-998100/G-998101,观察档):',
      '     ① truncated 声明块裸奔 = interface/type/z.object 块里数组成员 + truncated 却无计数/总量型',
      '        数值兄弟键 ⇒ 同块补 total/unlisted/omitted/… 计数键(正型:packages/types/src/api-contracts.ts',
      '        BoundedListProjection)。函数体/if 块里的同名局部不判。',
      '     ② 档位/流过滤词表命中(deliveryProfile/streamTier/…)= "决定砍"已发生的绊线 ⇒ 收口不变量',
      '        (被 profile 过滤的事件必须最终被某个不可过滤事件收口 + live 直连与 Last-Event-ID 重放两路',
      '        终态逐字节一致测试)必须同期落地;字符串槽位/注释提及只报数不判红(绊线咬代码标识符)。',
      '     单独复验:node scripts/check-truncation-accounting.mjs --staged',
      '     自检:node scripts/check-truncation-accounting.mjs --self-test(23 例)',
      '     全量档(HEAD 面)只报数恒 exit 0(棘轮:改到哪只咬哪);Python 面只报数不判。',
      '',
    ].join('\n'),
  },
  {
    id: '198',
    label:
      '⏱️  DB 盲写 updatedAt 棘轮(blocking,拦「.set({ ...data, updatedAt: new Date() })」无条件覆盖形态回潮 —— 它把增量读的 updatedAt 消费源污染成假变化)',
    script: 'check-db-blind-updatedat-set.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_DB_BLIND_UPDATEDAT',
    stagedTriggers: ['apps/api/src/', 'scripts/db-blind-updatedat-baseline.json'],
    onFailHint: [
      '',
      '  💡 立票凭据(G-998153,2026-10-09):HEAD 面该形态 329 处/130 文件,而 2026-10-02 登记的',
      '     基线是 326 ⇒ 已被并行提交无声顶破一次。updatedAt 是增量读的消费源',
      '     (routes/tasks.ts:378 since 补拉、admin-extended/user-routes.ts:220 gte 七日窗口),',
      '     同值空写把「没变」伪装成「变过」,WS 重连补拉被假变化污染。',
      '  出路:改成「先取现值、按键比较,只有真变化进 set;无变化不发 UPDATE、不盖 updatedAt」',
      '     (出口形态见 apps/api/src/db/admin-sys-queries.ts 的 updateMenu,展开名固定用',
      '     ...changed 才受本门豁免);确实必须无条件盖时,先立票收窄基线 —— 基线只许收窄',
      '     (scripts/db-blind-updatedat-baseline.json),不许靠放宽消红。',
      '  单独复验:node scripts/check-db-blind-updatedat-set.mjs [--staged|--json]',
      '     自检:node scripts/check-db-blind-updatedat-set.mjs --self-test(7 例)',
      '  紧急跳过(不推荐):HUSKY_SKIP_DB_BLIND_UPDATEDAT=1 git commit ...',
      '',
    ].join('\n'),
  },
  {
    id: '13d',
    label: '🚫 PROJECT_PLAN.md 重复登记副本指针棘轮',
    script: 'check-plan-dup-pointer-ratchet.mjs',
    args: [],
    mode: 'blocking',
    stagedTriggers: ["PROJECT_PLAN.md"],
    // 2026-10-13 立(用户指令"彻底根治"):存量指针注记已由 scripts/plan-pointer-purge.mjs --apply 一次性清偿并对象空间落地(715d495a9b5)。差值棘轮(同门 130 F7/F8):只拦"本次提交让登记行注记变多",存量不担责 —— 与提交内容无关的恒红门只会逼人 --no-verify 连带废掉全部守门(§12e)。
  },
  {
    id: '229',
    label: '🧹 PROJECT_PLAN.md 完成即删守门(拦跨枚滞留的已勾登记行;全量档只报数)',
    script: 'check-plan-closed-stock.mjs',
    args: [],
    mode: 'blocking',
    // 2026-10-20 立(机主令"要彻底根治 固定完成立即删掉记录"):S1 只拦"被审面已勾 ∧ 父提交同复合主键也已勾"的**跨枚滞留**行;刚翻勾的那一枚给宽限 —— 否则守门 71 头注 (c)「翻勾后整行删除」的配平凭据永远造不出来,每条结清都会变成"无凭据减少"被无限回捞(本机当日实测)。全量档只报数(§12e:与提交内容无关的红只会逼人跳门),存量清扫归 scripts/strip-stale-closed-rows.mjs。
    stagedTriggers: ['PROJECT_PLAN.md'],
    skipEnv: 'HUSKY_SKIP_PLAN_CLOSED_STOCK',
  },
  {
    id: '70b',
    label: '🌐 i18n 死 key 扫描(blocking,判定面=索引 blob;2026-10-22 从 pre-commit 移入并行池)',
    script: 'scan-dead-i18n-keys.mjs',
    args: ['--exit', '1'],
    mode: 'blocking',
    stagedTriggers: ["**/*"],
    // 2026-10-22 立:原先由 pre-commit-hook 用 execSync **串行**跑,独占 6.6s(实测)。
    // 移进并行池后与其他门重叠 ⇒ 这 6.6s 等于白得。判据、退出码、跳过开关一字未动。
    // 逃生:HUSKY_SKIP_I18N_DEAD_KEY=1(与原 pre-commit 段同一变量,语义不变)。
    skipEnv: 'HUSKY_SKIP_I18N_DEAD_KEY',
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
  // 193 check-git-stdio-discipline.mjs 的立门因由/事故史/定级史逐字归档:.ihui-agent/archive/guardian-runner-comments-pre-6000-2026-10-14.md#b1(§1 两步归档;C1 上限腾行,判据字段一字未动)
  {
    id: '193',
    label:
      '🧯  git 派生调用必须显式接管 stdio(blocking,拦本机 EBUSY 病灶 —— 不写 stdio 时 0/30 成功,补上即 30/30)',
    script: 'check-git-stdio-discipline.mjs',
    args: [],
    mode: 'blocking',
    skipEnv: 'HUSKY_SKIP_GIT_STDIO_DISCIPLINE',
    // 2026-10-27 补:本门判的是 scripts/ 下的 JS 派生面,不声明触发器 ⇒ 绕过落地器
    // (object-space-land)时它**不会进"受影响门"复跑集**。实测代价:新门 check-ps1-bom.mjs
    // 两处裸被派生 git 一路带到 push 才被 pre-push 拦下 —— 落地报"19 臂全绿"却是盲绿。
    stagedTriggers: ['scripts/'],
    onFailHint: [
      '',
      '  💡 病根(2026-10-03 实测):options 里**不写** `stdio` ⇒ 派生 git 抛 EBUSY(0/30);',
      '     同一段补 `stdio: [\x27ignore\x27,\x27pipe\x27,\x27pipe\x27]` ⇒ 30/30 成功。',
      '     绝对路径 GIT_BIN / gitBinary() / resolveGitBin() **不是豁免** —— EBUSY 是派生面的病。',
      '     另一副面孔:`execSync(<字符串>)` / `shell: true` 经 cmd.exe,同样 100% EBUSY。',
      '  ⚠️ 不要用单次探测下结论:实测有一次测到"不写 stdio 6/6 通过" —— 单次/小样本会给出',
      '     "不需要 stdio"的假象。任何相关判断必须**成组对照**(每组 ≥10 次)。',
      '  修法:options 里显式写 `stdio` 属性名。取值两种都合规:',
      '     [\x27ignore\x27,\x27pipe\x27,\x27pipe\x27] 与 [\x27pipe\x27,\x27pipe\x27,\x27pipe\x27]。',
      '  豁免只能进具名数据文件 scripts/check-git-stdio-exemptions.json',
      '     (字段 file/reason/owner/reviewBy);**行内注释不是豁免通道**。',
      '  单独复验:node scripts/check-git-stdio-discipline.mjs [--staged|--worktree]',
      '     自检:node scripts/check-git-stdio-discipline.mjs --self-test(23 例,含折行不改判据命门例 + ES6 属性简写族)',
      '     镜像:node --test scripts/tests/check-git-stdio-discipline.test.mjs(16 例;T13 可能因 AD 态文件在环境性红)',
      '  紧急跳过(不推荐):HUSKY_SKIP_GIT_STDIO_DISCIPLINE=1 git commit ...',
      '',
    ].join('\n'),
  },
]

// === CLI 解析 ===

const cliArgs = process.argv.slice(2)
const passStaged = cliArgs.includes('--staged')
const showTiming = cliArgs.includes('--timing')
const showHelp = cliArgs.includes('--help') || cliArgs.includes('-h')
const pushGate = cliArgs.includes('--push-gate')

// --push-gate 模式:仅执行 push 门检查集(不跑 pre-commit 的全部检查)
let effectiveChecks = pushGate ? pushGateChecks : checks

// ── 档位裁剪(2026-10-22 立,判据与理由全在 scripts/lib/gate-scope.mjs 头注)──────────
// 只决定"这次改动该跑哪些门",**不碰任何门的判据**。含业务路径 / 含判据库 / 判不出
// 一律回落全量 —— 失效方向永远是"多跑",不是"少跑"。
if (passStaged && !pushGate) {
  try {
    const stagedPaths = String(
      execFileSync('git', ['-c', 'safe.directory=*', 'diff', '--cached', '--name-only'], {
        encoding: 'utf8',
        cwd: process.cwd(),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 30_000,
      }) || '',
    )
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    const sc = resolveGateScope(stagedPaths)
    if (sc.scope === 'meta') {
      const before = effectiveChecks.length
      effectiveChecks = effectiveChecks.filter((c) => isMetaGate(c))
      console.log(
        `⚡ 元门档:${sc.reason} ⇒ 只跑 ${effectiveChecks.length}/${before} 道工具/仓库状态门` +
          `(业务门本轮与改动无关,已跳过;强制全量:IHUI_GATE_SCOPE=full)`,
      )
    } else {
      console.log(`🛡️ 全量档:${sc.reason}`)
    }
  } catch (e) {
    console.log(`⚠️ 档位判定失败(${e?.message || e})⇒ 回落全量(失效方向是多跑,不是少跑)`)
  }
}

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
  子门中断(75 / 信号族码 / 无码只有 signal) → 视为被杀而非检查结论,**立即**以 75 向上传播(hook → push guard 据此重试),不收敛成 1
  warn     失败 → 打印警告,继续执行
  info     →    始终继续,只打印信息
`)
  process.exit(0)
}


await runGuardianBatch({ checks, pushGateChecks, effectiveChecks, passStaged, pushGate, showTiming, cliArgs })
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠