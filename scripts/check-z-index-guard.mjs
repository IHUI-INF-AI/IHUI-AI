#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * z-index 层叠防护守门 (2026-07-24 立,2026-07-24 修正)
 *
 * 防止 AI 面板登录弹窗遮罩层叠修复被回归:
 *
 * 1. tokens.css 中 z-index 变量禁止 !important
 *    (项目规则:project_memory.md 第 6 行,2026-07-06 立,禁止 !important)
 *    第三方 IDE 注入防护由 layout.tsx inline script 运行时 setProperty 实现,无需 !important
 * 2. globals.css 中 z-index 工具类禁止 !important
 *    (同上,变量值由 inline script 覆盖,var() 引用自动拿到正确值)
 * 3. layout.tsx inline script 必须设置 11 个 z-index 变量
 *    (运行时 inline style 优先级高于 stylesheet,覆盖 第三方 IDE 注入)
 * 4. dialog.tsx 遮罩不得有 open 态 fade-in 动画
 *    (fade-in 让遮罩从 opacity:0 渐显,期间 AI 面板全亮度暴露 = "发亮")
 * 5. 桌面端窗口控制三按钮必须具备「等效压暗」+「失焦非活动态」两组契约
 *    (GlobalTopBar.tsx 两组标记缺一不可,详见 WINDOW_CONTROL_CONTRACT)
 *    5a 等效压暗:data-window-controls + data-window-controls-dim
 *       为什么只能"等效压暗"而不能降层级:三按钮挂在 z-max(10003),该值不能降 ——
 *       它必须高于 8 方向 resize 抓手的 z-loading(10000),否则无边框窗口拖拽失效。
 *       于是遮罩永远盖不住按钮本体,只能由同幅度压暗覆盖层在遮罩打开时把按钮一起压暗。
 *    5b 失焦非活动态:data-window-inactive + 容器 group/wc + group-data-[window-inactive=true]/wc: 变体
 *       无边框窗口拿不到 DWM 原生的"非活动标题栏变灰",前端不接 tauri://focus|blur
 *       就永远全亮 —— 这条视觉链路只有这三个挂点,删掉任一即失效。
 *
 * 历史教训(2026-07-24):
 *   v1 修复用 !important 违反项目禁令(project_memory.md 第 6 行),
 *   v2 改用 layout.tsx inline script 运行时 setProperty,合规且更可靠。
 *
 * 历史教训(2026-09-22,补第 5 项的直接原因):同族问题已第 3 次复发
 *   (① AI 面板跟着登录窗发亮 → ② 登录框本体 → ③ 桌面端右上角最小化/最大化/关闭三按钮)。
 *   ①② 当年是"改被遮元素自己"绕过的,判据没覆盖"高层级元素遮不住"这一类,所以③又漏了:
 *   窗口按钮容器挂 z-max(10003) 不能降(须高于 resize 抓手 z-loading=10000),只能等效压暗。
 *   本脚本自 2026-07-24 立项即由 guardian-runner id 27(blocking)自动执行,
 *   缺的是判据覆盖面而不是牙齿 —— 本轮补第 5 项两组契约。
 *   删掉 data-window-controls-dim = 登录窗等 29+ 处遮罩下三按钮重新全亮。
 *   删掉 data-window-inactive / group/wc / group-data-[window-inactive=true]/wc: 变体
 *   = 窗口失去系统焦点时按钮不再降亮(2026-09-22 补 5b,此前该链路完全裸奔)。
 *
 * 用法:
 *   node scripts/check-z-index-guard.mjs            (全量检查, exit 0/1)
 *   node scripts/check-z-index-guard.mjs --staged   (仅 staged 涉及时检查)
 *   node scripts/check-z-index-guard.mjs --self-test
 *       (判闸有效性自查:在内存字符串常量上跑第 5 项判据的两个分支 ——
 *        契约齐全判绿 / 逐项缺契约判红,共 6 条断言。
 *        不落盘、不注入、不读任何外部路径,因此第 5 项永远只检查真实的
 *        GlobalTopBar.tsx;历史上曾有 --fixture=<path> 后门可让第 5 项去读
 *        任意文件,已于 2026-09-22 移除(受控后门即使"不放宽判据"也不该留在
 *        blocking 守门里:它让"守门通过"与"真实文件通过"不再等价)。)
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')
const isSelfTest = process.argv.includes('--self-test')

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

const TOKENS_PATH = join(ROOT, 'packages/design-tokens/src/styles/tokens.css')
const GLOBALS_PATH = join(ROOT, 'apps/web/app/globals.css')
const LAYOUT_PATH = join(ROOT, 'apps/web/app/layout.tsx')
const DIALOG_PATH = join(ROOT, 'packages/ui-react/src/components/dialog.tsx')
// 第 5 项检查的**唯一**真实路径:不提供任何覆盖入口(见头部 --self-test 说明)
const TOPBAR_PATH = join(ROOT, 'apps/web/src/components/layout/GlobalTopBar.tsx')

/**
 * 第 5 项契约表:桌面端窗口控制三按钮的两组视觉链路挂点。
 * 两组是**并列必查**,任一 group 下任一 token 计数不足即 hasError=true。
 *
 * boundary=true 的用途(防影子匹配):裸 `data-window-controls` 是
 * `data-window-controls-dim` 的前缀,若做纯子串判断,则容器标记被删后
 * 只要 -dim 还在就仍然判绿 → 判据形同虚设。加词边界后必须真存在裸标记。
 */
const WINDOW_CONTROL_CONTRACT = [
  {
    name: '等效压暗层(遮罩打开时把三按钮一起压暗)',
    required: [
      { token: 'data-window-controls', min: 1, boundary: true },
      { token: 'data-window-controls-dim', min: 1, boundary: true },
    ],
    why: [
      '为什么不能靠降层级解决:三按钮挂在 z-max(10003),该值不能降',
      '  — 必须高于 8 方向 resize 抓手的 z-loading(10000),否则无边框窗口拖拽失效',
      '层级压不住 → 只能靠等效压暗覆盖层(data-window-controls-dim)在遮罩打开时同幅度压暗',
      '删掉它 = 登录窗等 29+ 处遮罩下三按钮重新全亮(同族第 3 次复发,勿再回退)',
    ],
  },
  {
    name: '失焦非活动态(窗口失去系统焦点时按钮降亮)',
    required: [
      { token: 'data-window-inactive', min: 1, boundary: true },
      { token: 'group/wc', min: 1, boundary: true },
      { token: 'group-data-[window-inactive=true]/wc:', min: 1, boundary: false },
    ],
    why: [
      '无边框窗口拿不到 DWM 原生的「非活动标题栏变灰」效果',
      '  → 前端若不接 tauri://focus|blur 并落到这三个挂点,按钮永远全亮',
      '挂点三件套:容器 group/wc + data-window-inactive="true" + 按钮 group-data-[window-inactive=true]/wc: 变体',
      '删掉任一 = 聚焦/失焦视觉无差异(该条在 2026-09-22 之前完全裸奔,删了不会有任何守门变红)',
    ],
  },
]

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 统计标记出现次数(纯函数,不触碰磁盘 —— 供真实检查与 --self-test 共用同一实现,
 * 避免"测试镜像常量"两份真相,见 AGENTS.md §22c)。
 */
function countContractToken(source, token, boundary) {
  const pattern = boundary ? `${escapeRe(token)}(?![\\w-])` : escapeRe(token)
  return source.match(new RegExp(pattern, 'g'))?.length ?? 0
}

/** 返回缺失项清单 { group, token, min, found };空数组 = 两组契约齐全(判绿)。 */
function findWindowControlViolations(source) {
  const violations = []
  for (const group of WINDOW_CONTROL_CONTRACT) {
    for (const { token, min, boundary } of group.required) {
      const found = countContractToken(source, token, boundary)
      if (found < min) violations.push({ group: group.name, token, min, found })
    }
  }
  return violations
}

// ============================================================
// --self-test:判闸有效性内存自检(不落盘 / 不读外部路径 / 不写任何文件)
//   断言第 5 项判据的两个分支:含契约→判绿;逐项缺契约→判红且红在预期分组。
// ============================================================
const FT_LINES = {
  groupCls: 'className="relative z-max group/wc flex h-full shrink-0 items-center"',
  controls: 'data-window-controls',
  inactive: "data-window-inactive={windowFocused ? undefined : 'true'}",
  dim: 'data-window-controls-dim',
  variant:
    "'group-data-[window-inactive=true]/wc:text-muted-foreground group-data-[window-inactive=true]/wc:bg-card/50'",
}
const ft = (...keys) => keys.map((k) => FT_LINES[k]).join('\n')
const DIM_GROUP = WINDOW_CONTROL_CONTRACT[0].name
const INACTIVE_GROUP = WINDOW_CONTROL_CONTRACT[1].name

const SELF_TEST_CASES = [
  {
    title: '两组契约齐全 → 判绿',
    source: ft('groupCls', 'controls', 'inactive', 'dim', 'variant'),
    expectGreen: true,
  },
  {
    title: '缺 data-window-controls-dim(压暗覆盖层) → 判红',
    source: ft('groupCls', 'controls', 'inactive', 'variant'),
    expectRed: { group: DIM_GROUP, token: 'data-window-controls-dim' },
  },
  {
    title: '缺 data-window-inactive(失焦挂点) → 判红',
    source: ft('groupCls', 'controls', 'dim', 'variant'),
    expectRed: { group: INACTIVE_GROUP, token: 'data-window-inactive' },
  },
  {
    title: '缺 group-data-[window-inactive=true]/wc: 变体 → 判红',
    source: ft('groupCls', 'controls', 'inactive', 'dim'),
    expectRed: { group: INACTIVE_GROUP, token: 'group-data-[window-inactive=true]/wc:' },
  },
  {
    title: '只剩 data-window-controls-dim、裸 data-window-controls 被删(防影子匹配) → 判红',
    source: ft('groupCls', 'inactive', 'dim', 'variant'),
    expectRed: { group: DIM_GROUP, token: 'data-window-controls' },
  },
  {
    title: '缺容器 group/wc(变体失去 group 根) → 判红',
    source: ft('controls', 'inactive', 'dim', 'variant'),
    expectRed: { group: INACTIVE_GROUP, token: 'group/wc' },
  },
]

function runSelfTest() {
  console.log('🧪 check-z-index-guard --self-test(第 5 项判据内存自检,不落盘、不读外部路径)...')
  let failed = 0
  SELF_TEST_CASES.forEach((c, i) => {
    const violations = findWindowControlViolations(c.source)
    let ok
    let detail
    if (c.expectGreen) {
      ok = violations.length === 0
      detail = ok ? '判绿(符合预期)' : `意外判红:${violations.map((v) => v.token).join(' / ')}`
    } else {
      const hit = violations.some((v) => v.group === c.expectRed.group && v.token === c.expectRed.token)
      ok = violations.length > 0 && hit
      detail = ok
        ? `判红且红在「${c.expectRed.group}」/ ${c.expectRed.token}`
        : `期望判红 ${c.expectRed.token},实得 ${violations.length === 0 ? '判绿(判据漏网)' : violations.map((v) => v.token).join(' / ')}`
    }
    if (!ok) failed += 1
    console.log(`${ok ? C.green : C.red}  ${ok ? '✅' : '❌'} [${i + 1}/${SELF_TEST_CASES.length}] ${c.title}${C.reset}`)
    console.log(`${C.dim}       ${detail}${C.reset}`)
  })
  console.log('')
  if (failed > 0) {
    console.log(`${C.red}❌ 自检失败:${failed}/${SELF_TEST_CASES.length} 条断言未通过 → 第 5 项判据已不可信${C.reset}`)
    process.exit(1)
  }
  console.log(`${C.green}✅ 自检通过:${SELF_TEST_CASES.length} 条断言全绿(1 绿分支 + 5 红分支,均在内存字符串上)${C.reset}`)
  process.exit(0)
}

if (isSelfTest) {
  runSelfTest()
}


// --staged 模式:只在相关文件被 staged 时才检查
if (isStaged) {
  try {
    const { execSync } = await import('node:child_process')
    const staged = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      encoding: 'utf8',
      cwd: ROOT,
      windowsHide: true,
    })
    const files = staged.split('\n').filter(Boolean)
    const relevant = files.some(
      (f) =>
        f.includes('design-tokens/src/styles/tokens.css') ||
        f.includes('apps/web/app/globals.css') ||
        f.includes('apps/web/app/layout.tsx') ||
        f.includes('ui-react/src/components/dialog.tsx') ||
        f.includes('layout/GlobalTopBar.tsx'),
    )
    if (!relevant) {
      console.log(`${C.dim}⏭  z-index 层叠防护守门(无相关 staged 改动, 跳过)${C.reset}`)
      process.exit(0)
    }
  } catch {
    // 非 git 环境,跑全量
  }
}

let hasError = false
console.log(
  '🛡️  z-index 层叠防护守门(禁 !important + inline script 覆盖 + 遮罩 fade-in 回归 + 窗口按钮等效压暗 + 失焦非活动态)...',
)

// ============================================================
// 检查 1: tokens.css 中 z-index 变量禁止 !important
// ============================================================
const CHECK_VARS = [
  { name: '--z-base', value: '1' },
  { name: '--z-sticky', value: '990' },
  { name: '--z-modal', value: '2000' },
  { name: '--z-popover', value: '2001' },
  { name: '--z-notification', value: '9999' },
  { name: '--z-max', value: '10003' },
  { name: '--z-0', value: '0' },
  { name: '--z-header', value: '100' },
  { name: '--z-dropdown', value: '1000' },
  { name: '--z-overlay', value: '1000' },
  { name: '--z-loading', value: '10000' },
]

console.log('  [1/5] 检查 tokens.css z-index 变量无 !important...')
if (existsSync(TOKENS_PATH)) {
  const css = readFileSync(TOKENS_PATH, 'utf8')
  for (const { name, value } of CHECK_VARS) {
    // 检查变量存在
    const valuePattern = new RegExp(
      `${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*${value}\\s*(?:;|$)`,
    )
    // 检查变量没有 !important
    const importantPattern = new RegExp(
      `${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*${value}\\s*!important`,
    )

    if (importantPattern.test(css)) {
      console.log(`${C.red}    ❌ ${name}: ${value} 含有 !important(违反项目禁令)${C.reset}`)
      console.log(`${C.dim}       项目规则(project_memory.md 第 6 行)禁止 !important${C.reset}`)
      console.log(`${C.dim}       第三方 IDE 注入防护由 layout.tsx inline script 运行时 setProperty 实现${C.reset}`)
      hasError = true
    } else if (!valuePattern.test(css)) {
      console.log(`${C.red}    ❌ ${name}: ${value} 未找到(变量缺失)${C.reset}`)
      hasError = true
    } else {
      console.log(`${C.green}    ✅ ${name}: ${value} (无 !important)${C.reset}`)
    }
  }
} else {
  console.log(`${C.yellow}    ⚠️  tokens.css 不存在: ${TOKENS_PATH}${C.reset}`)
  hasError = true
}

// ============================================================
// 检查 2: globals.css 中 z-index 工具类禁止 !important
// ============================================================
const CHECK_UTILITIES = ['.z-sticky', '.z-modal', '.z-popover', '.z-notification', '.z-max']

console.log('  [2/5] 检查 globals.css z-index 工具类无 !important...')
if (existsSync(GLOBALS_PATH)) {
  const css = readFileSync(GLOBALS_PATH, 'utf8')
  for (const cls of CHECK_UTILITIES) {
    const varName = cls.replace('.', '--')
    const importantPattern = new RegExp(
      `${cls.replace('.', '\\.')}\\s*\\{[^}]*z-index\\s*:\\s*var\\(${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\s*!important`,
    )

    if (importantPattern.test(css)) {
      console.log(`${C.red}    ❌ ${cls} 的 z-index 含有 !important(违反项目禁令)${C.reset}`)
      console.log(`${C.dim}       变量值由 layout.tsx inline script 覆盖,var() 自动拿到正确值${C.reset}`)
      hasError = true
    } else {
      console.log(`${C.green}    ✅ ${cls} (无 !important)${C.reset}`)
    }
  }
} else {
  console.log(`${C.yellow}    ⚠️  globals.css 不存在: ${GLOBALS_PATH}${C.reset}`)
  hasError = true
}

// ============================================================
// 检查 3: layout.tsx inline script 必须设置 z-index 变量
// ============================================================
console.log('  [3/5] 检查 layout.tsx inline script 设置 z-index 变量...')
if (existsSync(LAYOUT_PATH)) {
  const tsx = readFileSync(LAYOUT_PATH, 'utf8')

  // 检查 inline script 中是否包含 setProperty 调用设置 z-index 变量
  const requiredInScript = [
    "setProperty('--z-base'",
    "setProperty('--z-sticky'",
    "setProperty('--z-modal'",
    "setProperty('--z-popover'",
    "setProperty('--z-notification'",
    "setProperty('--z-max'",
    "setProperty('--z-0'",
    "setProperty('--z-header'",
    "setProperty('--z-dropdown'",
    "setProperty('--z-overlay'",
    "setProperty('--z-loading'",
  ]

  for (const snippet of requiredInScript) {
    if (!tsx.includes(snippet)) {
      console.log(`${C.red}    ❌ inline script 缺少 ${snippet}${C.reset}`)
      console.log(`${C.dim}       需在 layout.tsx 的 <script dangerouslySetInnerHTML> 中设置此变量${C.reset}`)
      hasError = true
    }
  }

  if (!hasError) {
    console.log(`${C.green}    ✅ inline script 包含 11 个 z-index 变量设置${C.reset}`)
  }
} else {
  console.log(`${C.yellow}    ⚠️  layout.tsx 不存在: ${LAYOUT_PATH}${C.reset}`)
  hasError = true
}

// ============================================================
// 检查 4: dialog.tsx 遮罩不得有 open 态 fade-in 动画
// ============================================================
console.log('  [4/5] 检查 dialog.tsx 遮罩无 open 态 fade-in 动画...')
if (existsSync(DIALOG_PATH)) {
  const tsx = readFileSync(DIALOG_PATH, 'utf8')

  // 找 Overlay 的 className 行
  const overlayMatch = tsx.match(/DialogPrimitive\.Overlay[^>]*className="([^"]+)"/)
  if (!overlayMatch) {
    console.log(`${C.yellow}    ⚠️  未找到 DialogPrimitive.Overlay,可能 dialog.tsx 结构已变更${C.reset}`)
    console.log(`${C.dim}       请人工确认遮罩无 fade-in 动画${C.reset}`)
  } else {
    const overlayClass = overlayMatch[1]

    // 检测 open 态 fade-in: data-[state=open]:animate-in 或 data-[state=open]:fade-in-0
    const hasOpenFadeIn =
      /data-\[state=open\]:animate-in/.test(overlayClass) ||
      /data-\[state=open\]:fade-in-0/.test(overlayClass)

    if (hasOpenFadeIn) {
      console.log(`${C.red}    ❌ 遮罩含 open 态 fade-in 动画: ${overlayClass.substring(0, 80)}...${C.reset}`)
      console.log(`${C.dim}       fade-in 让遮罩从 opacity:0 渐显,150ms 内 AI 面板全亮度暴露 = "发亮"${C.reset}`)
      console.log(`${C.dim}       修复:移除 data-[state=open]:animate-in 和 data-[state=open]:fade-in-0${C.reset}`)
      hasError = true
    } else {
      console.log(`${C.green}    ✅ 遮罩无 open 态 fade-in 动画${C.reset}`)
    }
  }
} else {
  console.log(`${C.yellow}    ⚠️  dialog.tsx 不存在: ${DIALOG_PATH}${C.reset}`)
  hasError = true
}

// ============================================================
// 检查 5: 桌面端窗口控制三按钮必须有等效压暗层(2026-09-22 立,同族第 3 次复发)
// ============================================================
console.log('  [5/5] 检查窗口控制按钮两组契约(等效压暗层 + 失焦非活动态)...')
if (existsSync(TOPBAR_PATH)) {
  const tsx = readFileSync(TOPBAR_PATH, 'utf8')
  const violations = findWindowControlViolations(tsx)

  if (violations.length > 0) {
    for (const group of WINDOW_CONTROL_CONTRACT) {
      const own = violations.filter((v) => v.group === group.name)
      if (own.length === 0) continue
      console.log(
        `${C.red}    ❌ [${group.name}] 缺少契约标记:${own.map((v) => `${v.token}(实得 ${v.found},需 ≥${v.min})`).join(' / ')}${C.reset}`,
      )
      console.log(`${C.dim}       路径:${TOPBAR_PATH}${C.reset}`)
      for (const line of group.why) console.log(`${C.dim}       ${line}${C.reset}`)
    }
    hasError = true
  } else {
    const total = WINDOW_CONTROL_CONTRACT.reduce((n, g) => n + g.required.length, 0)
    console.log(
      `${C.green}    ✅ 两组契约齐全(等效压暗 + 失焦非活动态,共 ${total} 个标记:${WINDOW_CONTROL_CONTRACT.map((g) => g.required.map((r) => r.token).join('+')).join(' | ')})${C.reset}`,
    )
  }
} else {
  console.log(`${C.yellow}    ⚠️  GlobalTopBar.tsx 不存在: ${TOPBAR_PATH}${C.reset}`)
  hasError = true
}

// ============================================================
// 汇总
// ============================================================
if (hasError) {
  console.log('')
  console.log(`${C.red}❌ z-index 层叠防护守门失败${C.reset}`)
  console.log(`${C.dim}   历史教训:2026-07-24 AI 面板"跟着登录窗发亮"问题${C.reset}`)
  console.log(`${C.dim}   v1 用 !important 违反项目禁令,v2 改用 inline script 运行时覆盖${C.reset}`)
  console.log(`${C.dim}   防护:layout.tsx setProperty + 无 fade-in + 禁止 !important${C.reset}`)
  console.log(`${C.dim}   2026-09-22 追加:窗口控制三按钮等效压暗层 + 失焦非活动态两组契约(同族第 3 次复发)${C.reset}`)
  console.log(`${C.dim}   判据有效性自查(内存,不落盘):node scripts/check-z-index-guard.mjs --self-test${C.reset}`)
  process.exit(1)
} else {
  console.log(`${C.green}✅ z-index 层叠防护守门通过${C.reset}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
