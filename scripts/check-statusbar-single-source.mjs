#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 顶部状态栏避让单一源头对账(blocking)
 *
 * 拦的是"第二顶距源"这一整类。真机实测(Redmi 2411DRN47C / 720x1640 / density 320):
 * 状态栏 inset = 68px = **34dp**。而全仓 399 个 *Screen.tsx 里真读 inset 的只有 3 个,
 * 83 个共享屏在页头/根容器上写死 `paddingTop: 48` 硬蒙量级 —— 蒙对了这台机,换机型即失配,
 * 另有 113 屏完全没有顶距,页头与系统时钟/电量直接叠字。
 *
 *  三条判据:
 *  S1 单点在位 —— `apps/mobile-rn/App.tsx` 必须真的用 `SafeAreaView` 且 `edges` 含 `'top'`。
 *     防"装好被摘线":机制不在而判据仍报绿,等于没有(与守门 70/76 同型)。
 *  S2 不得再有第二个取值口 —— 两类形态:
 *     ① `StatusBar.currentHeight` 出现在代码里(已剥注释与字符串)即红 —— 这个 API 本身就是
 *        取值口，且 iOS 恒为 `undefined`(⇒ 0)，没有"只是声明着玩"的合法形态。
 *     ② `statusBarHeight` **只有被当顶距取值时才判红**(`paddingTop: statusBarHeight` /
 *        `top: statusBarHeight + 8` / `const h = statusBarHeight`)。跨端共享层里"由调用方注入、
 *        默认 0"的 prop 声明(`statusBarHeight?: number` / `statusBarHeight = 0`)是**合法形态**，
 *        判红即假红 —— 本门只拦"接线使用"，不拦"形参存在"。
 *  S3 不得再写状态栏量级的魔法顶距 —— 页头/页面根样式键(container/page/root/wrapper/
 *     header/headerRow/screen/body + headerBar/topBar/navBar/tabBar/banner)的对象内
 *     出现 `paddingTop: <24..60 字面量>` 即红，零容忍。
 *     区间取自状态栏可能高度(24~59dp)；不认表达式，因为 `insets.top` 才是想要的写法。
 *     **两条刻意不扩的面**(2026-09-24 实测后决定，避免后人再推一遍)：
 *       ① `paddingVertical` / `padding` 简写 —— HEAD 里区间内命中 106 + 20 = 126 处，
 *          且它们全是 center/empty/行内对称间距等**合法**用法；纳入即造 126 处恒红。
 *       ② JSX 内联 `style={{ paddingTop: N }}` —— HEAD 里 0 处，但内联样式同样承载任意
 *          卡片间距，为零存量换一条会误伤的判据不划算。两者都属于"绕门最顺手"的通道，
 *          真出现回潮时按实例补，而不是先建一条宽判据逼人写豁免。
 *
 * 豁免面(两类，都必须"报数不静默"):
 *  M1 **RN `<Modal>` 类文件不判红** —— Modal 渲染在导航树**之外的原生窗口**，不继承 App.tsx
 *     那个 SafeAreaView，所以它们**必须**自带 `insets.top`(Drawer/SideMenu/BottomPops/
 *     HandPlatePops/GlobalFloatBox/PrivacyPolicyModal)。按判据判它们等于逼端内写豁免注释，
 *     所以这里只如实计数。识别用**剥注释后的代码**，故"文档里提了一句 Modal"不配豁免。
 *  M2 行内豁免 `statusbar-exempt: <一句话原因>` —— **逐行生效**(不是整文件免检，
 *     一行标记救不了同文件其余 47 处)，且**必须带原因**(裸标记不豁免)，与 §4 圆角豁免同风格。
 *
 * 内容口径：全量判 **HEAD blob**，`--staged` 判**索引 blob** —— 共享工作树常年滞后 HEAD，
 * 按磁盘算会在恒红/假绿之间来回跳(与守门 77/83 同取向)。
 *
 * 用法: node scripts/check-statusbar-single-source.mjs [--all|--staged|--self-test|--json|--root <dir>]
 * 退出码: 0=通过; 1=有违规; 2=脚本自身异常(git 不可用 / 机制文件读不到)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveGitBin } from './lib/gitdir.mjs'
// §26:临时夹具唯一落点(工作树同盘、不落 C 盘，且 Windows EPERM 有重试)
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT = resolveGitBin()

/** 顶距唯一注入点 */
const MECHANISM_FILE = 'apps/mobile-rn/App.tsx'
/**
 * 扫描面:RN 端 + 跨端共享屏层(整包根，不只 src —— 机制文件 App.tsx 与端内 scripts/
 * 同样在射程内;HEAD 实测这两个整包里 src 之外的 statusBarHeight/currentHeight 命中为 0，
 * 扩面零假红，代价是 556→627 个 tsx 约 +0.2s)。
 */
const SCAN_DIRS = ['packages/app', 'apps/mobile-rn']
/** 页头 / 页面根容器 —— 只有这两类样式键上的顶距才是状态栏补偿的形态 */
const TOP_STYLE_KEYS = [
  'container',
  'page',
  'root',
  'wrapper',
  'header',
  'headerRow',
  'screen',
  'body',
  // 2026-09-24 扩面:这五个键名本身就是"页顶"语义,加进来即时红 0(实测 HEAD 里
  // 它们在 24..60 区间无任何字面量,最大只有 headerBar=12 / title=8),纯拦未来。
  // 刻意**不**加 title / content / modalContent —— 那些键常承载合法的 ≥24 内容间距,
  // 加了是面向未来的误伤;而一道按规矩写就红的门,唯一结局是逼人绕过钩子、连带废掉全部守门。
  'headerBar',
  'topBar',
  'navBar',
  'tabBar',
  'banner',
]
/** 状态栏可能高度(dp):下界排除普通间距,上界排除整屏留白 */
const MAGIC_MIN = 24
const MAGIC_MAX = 60

/** S2-① 取值 API 本身:iOS 恒 undefined，出现在代码里就是第二源 */
const CURRENT_HEIGHT_RE = /\bStatusBar\.currentHeight\b/
const CURRENT_HEIGHT_SCAN = new RegExp(CURRENT_HEIGHT_RE.source, 'g')
/** 顶距族布局属性(状态栏补偿只会落在这几个键上) */
const TOP_FAMILY = 'paddingTop|paddingVertical|marginTop|top'
/**
 * S2-② `statusBarHeight` 的**布局取值**形态:`paddingTop: statusBarHeight`、
 * `top: statusBarHeight + 8`、`const h = statusBarHeight`。
 * 刻意不含声明形态(`statusBarHeight?: number` / 解构默认 `statusBarHeight = 0`)——
 * 那是跨端共享层"由调用方注入"的合法设计，判红即假红。
 */
const SBAR_LAYOUT_USE_RE = new RegExp(`(?:${TOP_FAMILY})\\s*:[^,}\\n]*\\bstatusBarHeight\\b|=[^,;\\n]*\\bstatusBarHeight\\b`, 'g')
/** RN Modal 渲染在本树之外，必须自带 inset —— 命中即豁免 S2/S3(只报数) */
const MODAL_RE = /<Modal[\s/>]|\bModal\./
/** 行内豁免必须带原因:裸 `statusbar-exempt:` 不生效(与 §4 radius-exempt 同口径) */
const EXEMPT_LINE_RE = /statusbar-exempt:\s*\S.{0,}/
const TOP_OBJECT_RE = new RegExp(`(?:^|[{,\\s])(${TOP_STYLE_KEYS.join('|')})\\s*:\\s*\\{`, 'g')
const MAGIC_PAD_RE = /paddingTop\s*:\s*(\d+)\b/

/** 全局正则带 lastIndex，单元断言里统一走这个无状态包装，避免"第二个用例漏判" */
function matchAll(text, re) {
  re.lastIndex = 0
  return [...text.matchAll(re)]
}

function git(args, cwd) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120000,
    windowsHide: true,
  })
}

/** 取指定取材面上某文件的内容;取不到返回 null —— 由调用方如实报"未判定",不得当作没有违规 */
function readBlob(root, rel, face) {
  // 工作树面不套 try:这里抛错只可能是脚本自己的缺陷(如漏 import),
  // 把它吞成"取不到内容"会让一个编码错误伪装成业务结论 —— 第一版正是这样把绿灯洗成灰灯的。
  if (face === 'worktree') return readFileSync(join(root, rel), 'utf8')
  try {
    return git(['show', `${face === 'index' ? ':' : 'HEAD:'}${rel}`], root)
  } catch {
    return null
  }
}

function listFiles(root, face) {
  if (face === 'index') {
    return git(['diff', '--cached', '--name-only', '--diff-filter=ACMRT', '--', ...SCAN_DIRS], root)
      .split('\n')
      .filter((l) => /\.tsx?$/.test(l))
  }
  return git(['ls-files', '--', ...SCAN_DIRS], root)
    .split('\n')
    .filter((l) => /\.tsx?$/.test(l))
}

/**
 * 一次 git grep 把"根本不可能命中任何判据"的文件筛掉。
 *
 * 为什么需要:逐文件 `git show` 在 627 个 tsx 上实测 38s —— 这是钩子链上的门，
 * 慢到一定程度就等于逼人 `--no-verify`。
 * 为什么安全:这个模式串是**三条判据所需字面量的严格超集**
 *   paddingTop(S3) / statusBarHeight、StatusBar.currentHeight(S2) / `<Modal`、`Modal.`(M1 豁免面)
 * 少一个词都没有的文件，按定义产不出任何命中，所以筛掉它不改变结论。
 * **筛不动就退回全量读**(git grep 异常/exit>=2)，绝不退成"少扫文件=少违规"。
 * 工作树面不筛(要读磁盘，grep 的 tree 形态对它不适用)，如实按全量走。
 */
const PREFILTER_PATTERN = 'paddingTop|statusBarHeight|StatusBar\\.currentHeight|<Modal|Modal\\.'
function candidateSet(root, face) {
  if (face === 'worktree') return null
  const args = face === 'index' ? ['grep', '--cached', '-l', '-I', '-E', PREFILTER_PATTERN, '--', ...SCAN_DIRS] : ['grep', '-l', '-I', '-E', PREFILTER_PATTERN, 'HEAD', '--', ...SCAN_DIRS]
  let out
  try {
    out = git(args, root)
  } catch (e) {
    // git grep 用 exit 1 表达"零命中"(合法的空候选集)，其余非零是真失败 → 退回全量
    if (e?.status === 1) return new Set()
    return null
  }
  return new Set(
    out
      .split('\n')
      .filter(Boolean)
      .map((l) => l.replace(/^HEAD:/, '').replaceAll('\\', '/')),
  )
}

/**
 * 剥注释 + 抹字符串(保留**行与列偏移**，便于报出准确行号)。
 *
 * 两件事必须一次做完，且必须是**字符级状态机**，不能"先按行判注释、再按行判字符串":
 *  - 只判行首会把 JSDoc 续行的裸文字读成使用点(文档里写一句 StatusBar.currentHeight 就判红，
 *    这种门的唯一结局是逼人绕过、连带废掉全部守门);
 *  - 反过来，不认字符串就会把 `'see //statusbar docs'`、`` `paddingTop: 48` `` 这类**串内**
 *    文本当真代码判红，而串里的 `//` 还会把块注释状态机带偏(守门 70 同型坑)。
 * 注释整段删除但保留其中的换行；字符串保留两侧引号、内容替换为空格(模板串换行保留)。
 */
function stripComments(src) {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const ch = src[i]
    const nx = src[i + 1]
    if (ch === '/' && nx === '/') {
      while (i < n && src[i] !== '\n') i++
      continue
    }
    if (ch === '/' && nx === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n'
        i++
      }
      i += 2
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      out += ch
      i++
      while (i < n) {
        if (src[i] === '\\') {
          // 转义序列整体抹掉；`\␊` 这类续行仍要保住那个换行，否则行号漂移
          out += src[i + 1] === '\n' ? ' \n' : '  '
          i += 2
          continue
        }
        if (src[i] === ch) break
        out += src[i] === '\n' ? '\n' : ' '
        i++
      }
      if (i < n) {
        out += ch
        i++
      }
      continue
    }
    out += ch
    i++
  }
  return out
}

/** 字符偏移 → 1-based 行号 */
function lineOf(text, idx) {
  let line = 1
  for (let i = 0; i < idx && i < text.length; i++) if (text[i] === '\n') line++
  return line
}

/** 收集带原因的行内豁免行号(逐行生效，不是整文件免检) */
function collectExemptLines(raw) {
  const lines = new Set()
  raw.split('\n').forEach((l, idx) => {
    // 必须有非空原因；`statusbar-exempt:` 后面啥都没写不算豁免
    const m = l.match(EXEMPT_LINE_RE)
    if (m && m[0].replace('statusbar-exempt:', '').trim().length > 0) lines.add(idx + 1)
  })
  return lines
}

/** 从 openIdx(指向 '{')起花括号配平,返回对象体文本;不配对返回 null */
function objectBody(src, openIdx) {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) return src.slice(openIdx + 1, i)
  }
  return null
}

/** 找页面根/页头样式对象里的魔法顶距，返回命中数组(带行号，供逐行豁免与准确报告) */
function findMagicPads(code) {
  const hits = []
  for (const m of code.matchAll(TOP_OBJECT_RE)) {
    const braceIdx = code.indexOf('{', m.index + m[0].length - 1)
    if (braceIdx < 0) continue
    const body = objectBody(code, braceIdx)
    if (body === null) continue
    // 用 matchAll 而非 match:一个对象里可能有多处顶距，只报第一处会让"豁免那一行"
    // 顺带把同对象另一处静默洗掉
    for (const pad of body.matchAll(new RegExp(MAGIC_PAD_RE.source, 'g'))) {
      const v = Number(pad[1])
      if (v < MAGIC_MIN || v > MAGIC_MAX) continue
      hits.push({
        key: m[1],
        value: v,
        line: lineOf(code, braceIdx + 1 + pad.index),
        // keyLine 必须从**键名本身**算起:m[0] 的首字符是 `[{,\s]` 里的锚点，
        // 那个字符常常是**上一行行尾的 \n** —— 按 m.index 算会把上一行的豁免标记
        // 错认成本行的豁免，等于"上一行写一句 exempt，下一行的顶距也跟着免检"
        keyLine: lineOf(code, m.index + m[0].indexOf(m[1])),
      })
    }
  }
  return hits
}

/**
 * @param {string} root   仓库根
 * @param {'head'|'index'|'worktree'} face 取材面
 */
export function scan(root = ROOT, face = 'head') {
  const v = { s1: [], s2: [], s3: [] }
  const notes = { unreadable: 0, exempt: 0, modalFiles: 0, modalSuppressed: [], totalFiles: 0, prefiltered: 0 }

  // 机制文件必须与屏文件走**同一个取材面** —— 否则 --root/工作树通道下发的是 worktree,
  // 而 S1 偷偷读 HEAD,结论会自相矛盾(第一版就踩在这里)。
  const mech = readBlob(root, MECHANISM_FILE, face)
  if (mech === null) {
    v.s1.push(`${MECHANISM_FILE} 取不到内容 —— 无法判定单点是否在位`)
  } else if (!/<SafeAreaView\b/.test(mech) || !/edges\s*=\s*\{?\s*\[[^\]]*'top'/.test(mech)) {
    v.s1.push(
      `${MECHANISM_FILE} 缺顶距单点:SafeAreaView=${/<SafeAreaView\b/.test(mech)} / edges 含 'top'=${/edges\s*=\s*\{?\s*\[[^\]]*'top'/.test(mech)}`,
    )
  }

  const allFiles = face === 'index' ? listFiles(root, 'index') : listFiles(root, 'all')
  const cand = candidateSet(root, face)
  const files = cand ? allFiles.filter((f) => cand.has(f)) : [...allFiles]
  // 机制文件永远实读:它被筛掉虽然不会漏判(没命中词=没有 S2/S3)，但"App.tsx 自己也射程内"
  // 这条不变量就得能被观察 —— 多读 1 个文件换一句能证明的话，值。
  if (allFiles.includes(MECHANISM_FILE) && !files.includes(MECHANISM_FILE)) files.push(MECHANISM_FILE)
  notes.totalFiles = allFiles.length
  notes.prefiltered = cand ? allFiles.length - files.length : 0
  for (const rel of files) {
    const raw = readBlob(root, rel, face)
    if (raw === null) {
      notes.unreadable++
      continue
    }
    const code = stripComments(raw)
    const exemptLines = collectExemptLines(raw)
    // M1:Modal 类文件在导航树**之外**渲染，不继承单点，自带 inset 是**正确写法**而非违规。
    //     不判红，但命中必须如实计数 —— 静默放过等于豁免面无人看得见。
    const isModal = MODAL_RE.test(code)
    if (isModal) notes.modalFiles++
    const sink = (arr, msg) => (isModal ? notes.modalSuppressed.push(`${rel}:${msg}`) : arr.push(`${rel}:${msg}`))

    for (const m of code.matchAll(CURRENT_HEIGHT_SCAN)) {
      const line = lineOf(code, m.index)
      if (exemptLines.has(line)) {
        notes.exempt++
        continue
      }
      sink(v.s2, `${line} 第二顶距源 ${m[0]}`)
    }
    for (const m of code.matchAll(SBAR_LAYOUT_USE_RE)) {
      const line = lineOf(code, m.index)
      if (exemptLines.has(line)) {
        notes.exempt++
        continue
      }
      sink(v.s2, `${line} 第二顶距源 statusBarHeight(布局取值)`)
    }
    for (const h of findMagicPads(code)) {
      if (exemptLines.has(h.line) || exemptLines.has(h.keyLine)) {
        notes.exempt++
        continue
      }
      sink(v.s3, `L${h.line} ${h.key}{{ paddingTop: ${h.value} }} —— 状态栏量级魔法顶距`)
    }
  }
  return { violations: v, notes, fileCount: files.length }
}

function report(res) {
  const { violations: v, notes, fileCount } = res
  const total = v.s1.length + v.s2.length + v.s3.length
  const lines = [
    `顶部状态栏避让单一源头对账:实读 ${fileCount} 个源文件 + 1 个机制文件` +
      (notes.prefiltered ? `(候选面 ${notes.totalFiles}，${notes.prefiltered} 个经一次 git grep 筛除:不含任何判据所需字面量)` : ''),
    `  S1 单点在位    ${v.s1.length ? '❌ ' + v.s1.length : '✅ 0'}`,
    `  S2 第二取值口  ${v.s2.length ? '❌ ' + v.s2.length : '✅ 0'}`,
    `  S3 魔法顶距    ${v.s3.length ? '❌ ' + v.s3.length : '✅ 0'}`,
    // 两条豁免面都必须"报数不静默":看不见豁免面 = 不知道这门到底管了多少
    `  M1 Modal 树外文件 ${notes.modalFiles} 个(不继承单点，自带 inset 属正确写法)，其中 ${notes.modalSuppressed.length} 处顶距取值未判红、如实计数`,
  ]
  if (notes.exempt) lines.push(`  M2 行内豁免 statusbar-exempt 放过:${notes.exempt} 处`)
  if (notes.unreadable) lines.push(`  (取不到内容、未判定:${notes.unreadable} 个 —— 不计通过)`)
  for (const arr of [v.s1, v.s2, v.s3]) for (const x of arr) lines.push(`  ✗ ${x}`)
  return { lines, total }
}

const GOOD_MECH = `import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <Navigator />
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
`
const BAD_MECH = GOOD_MECH.replace("<SafeAreaView edges={['top']} style={{ flex: 1 }}>", '<View style={{ flex: 1 }}>').replace(
  /<\/SafeAreaView>/,
  '</View>',
)
const SCREEN_WITH_MAGIC = `import { StyleSheet } from 'react-native'
const styles = StyleSheet.create({
  header: { flexDirection: 'row', paddingTop: 48, height: 44 },
})
`
const SCREEN_WITH_SECOND_SOURCE = `const h = StatusBar.currentHeight ?? 0
export const styles = { header: { paddingTop: h } }
`
/** 任务书点名的阳性对照原文:页头上直接写 StatusBar.currentHeight */
const PAD_SNIPPET = 'paddingTop: StatusBar.currentHeight ?? 0'
/** 同一段代码放进**非 Modal** 文件必红 */
const PLAIN_SCREEN_WITH_SNIPPET = `import { StyleSheet } from 'react-native'
export const styles = StyleSheet.create({ header: { ${PAD_SNIPPET}, } })
`
/** 同一段代码放进**含 `<Modal`** 的文件必须放过(树外渲染，自带 inset 才是对的) */
const MODAL_SCREEN_WITH_SNIPPET = `import { Modal, View } from 'react-native'
export function Pops({ visible }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, ${PAD_SNIPPET} }} />
    </Modal>
  )
}
`
/** 只在注释里提了一句 `<Modal` —— 不配豁免(否则注释就是逃生舱) */
const FAKE_MODAL_SCREEN = `// 这里借鉴了 <Modal 的写法,但本组件在导航树内
export const styles = { header: { ${PAD_SNIPPET}, } }
`
const SCREEN_CLEAN = `import { StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
const s = StyleSheet.create({ header: { height: 44 }, card: { paddingTop: 12 } })
export function X() {
  const insets = useSafeAreaInsets()
  return <View style={{ paddingTop: insets.top }} />
}
`

/**
 * 端到端自检:在**独立临时仓**里造现场 —— 判据只有在独立仓做端到端取证才暴露得出来
 * (真仓工作树受并发会话影响,拿它当夹具会得到时真时假的结论)。
 * 夹具落点用 §26 的唯一出口 mkScratch(工作树同盘，不落 C 盘)。
 */
function selfTest() {
  const GITROOT = mkScratch('statusbar-gate')
  const cases = []
  const t = (name, pass, detail = '') => cases.push({ name, pass, detail })
  try {
    git(['init', '-q'], GITROOT)
    git(['config', 'user.email', 'gate@test'], GITROOT)
    git(['config', 'user.name', 'gate'], GITROOT)
    // 夹具仓不得继承宿主的 autocrlf / gpgsign:前者每次自检刷一屏 CRLF 警告，
    // 后者一旦为 true 会让 commitAll 直接失败 —— "端到端"就悄悄变成"根本没提交"
    git(['config', 'core.autocrlf', 'false'], GITROOT)
    git(['config', 'commit.gpgsign', 'false'], GITROOT)
    git(['config', 'gc.auto', '0'], GITROOT)
    const put = (rel, text) => {
      const abs = join(GITROOT, rel)
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, text)
    }
    const commitAll = () => {
      git(['add', '-A'], GITROOT)
      git(['commit', '-qm', 'fixture'], GITROOT)
    }

    // 单元语义:探针自身必须能看见已知目标(阳性对照),否则"扫到 0"毫无意义
    t('S2 阳性对照:currentHeight 看得见', CURRENT_HEIGHT_RE.test('const h = StatusBar.currentHeight ?? 0'))
    t('S2 阳性对照:statusBarHeight 作布局取值看得见', matchAll('paddingTop: statusBarHeight,', SBAR_LAYOUT_USE_RE).length === 1)
    t('S2 阳性对照:statusBarHeight 参与算术仍看得见', matchAll('top: statusBarHeight + 8', SBAR_LAYOUT_USE_RE).length > 0)
    t('S2 阳性对照:const h = statusBarHeight 赋值看得见', matchAll('const h = statusBarHeight', SBAR_LAYOUT_USE_RE).length > 0)
    t(
      'S2 反向:共享层"调用方注入、默认 0"的 prop 声明不算第二源(类型字段 / 解构默认 / 形参)',
      matchAll('statusBarHeight?: number', SBAR_LAYOUT_USE_RE).length === 0 &&
        matchAll('  statusBarHeight = 0,\n', SBAR_LAYOUT_USE_RE).length === 0 &&
        matchAll('    statusBarHeight: number,\n', SBAR_LAYOUT_USE_RE).length === 0,
    )
    t('S2 反向:注释行不判红', stripComments('  // StatusBar.currentHeight 已废弃').trim() === '')
    t(
      'S2 反向:多行块注释中间的裸说明行不判红',
      CURRENT_HEIGHT_RE.test(
        stripComments('/**\n * 说明\n       再加一次 StatusBar.currentHeight 会推歪浮窗 */\nconst a = 1'),
      ) === false,
    )
    t(
      'S2 阳性对照:块注释结束后同文件的真代码仍须判红(状态机不得漏闭合)',
      CURRENT_HEIGHT_RE.test(stripComments('/* 说明 */ const h = StatusBar.currentHeight')),
    )
    t('剥注释保行数(行号仍对得上)', stripComments('a\n// b\nc').split('\n').length === 3)
    t(
      'S2 反向:字符串字面量里的 StatusBar.currentHeight 不算使用点',
      CURRENT_HEIGHT_RE.test(stripComments("const doc = '改用 StatusBar.currentHeight 是错的'")) === false,
    )
    t(
      'S2 反向:串内的 // 不得把同行后续真代码吞成注释(旧行级实现在这里假绿)',
      CURRENT_HEIGHT_RE.test(stripComments("const u = 'http://a//b', h = StatusBar.currentHeight")),
    )
    t(
      'S3 反向:多行模板字符串里的 CSS 文本不算 RN 样式(串内容抹除且行号不漂移)',
      findMagicPads(stripComments('const css = `\n  .header{paddingTop:48}\n`\nconst b = 1')).length === 0 &&
        stripComments('const css = `\nabc\n`\nconst b = 1').split('\n').length === 4,
    )
    t('S3 阳性对照:header 上 48 看得见', findMagicPads('  header: { paddingTop: 48, height: 44 },').length === 1)
    t('S3 反向:12px 普通间距不计', findMagicPads('  card: { paddingTop: 12 }').length === 0)
    t('S3 反向:insets.top 表达式不计', findMagicPads('  header: { paddingTop: insets.top }').length === 0)
    t('S3 边界:24 计红 / 23 不计', findMagicPads('header:{paddingTop:24}').length === 1 && findMagicPads('header:{paddingTop:23}').length === 0)
    t('S3 边界:60 计红 / 61 不计', findMagicPads('header:{paddingTop:60}').length === 1 && findMagicPads('header:{paddingTop:61}').length === 0)
    t('S3 非页头键不判(content)', findMagicPads('  heroCard: { paddingTop: 40 }').length === 0)
    t('花括号配平:嵌套对象不越界吞并', findMagicPads('container: { inner: { a: 1 }, paddingTop: 30 }').length === 1)
    t(
      'S3 同对象多处顶距必须逐处报(只报第一处会让豁免顺带洗掉另一处)',
      findMagicPads('container: { paddingTop: 48, inner: { paddingTop: 30 } }').length === 2,
    )
    t('S3 命中带准确行号', findMagicPads('const s = {\n  header: { paddingTop: 48 },\n}').some((h) => h.line === 2))
    t(
      'S3 行号精确到键名行(不被上一行行尾锚点带偏 —— exempt 串行的入口)',
      (() => {
        const pads = findMagicPads('const s = {\n  a: { x: 1 },\n  header: { paddingTop: 48 },\n}')
        return pads.length === 1 && pads[0].line === 3 && pads[0].keyLine === 3
      })(),
    )
    t('M1 Modal 判据:JSX 形态看得见', MODAL_RE.test('  return (\n    <Modal visible={v}>'))
    t('M1 Modal 判据:注释里的 <Modal 不算(剥注释后才判，注释不是逃生舱)', MODAL_RE.test(stripComments('// <Modal')) === false)
    t('M2 行内豁免:必须带原因，裸标记不生效', collectExemptLines('a // statusbar-exempt:').size === 0 && collectExemptLines('a // statusbar-exempt: 与封面同高').size === 1)
    t('M2 行内豁免:逐行生效，不是整文件免检', collectExemptLines('a\nb // statusbar-exempt: 原因\nc').size === 1)
    t('路径分隔符归一(Windows 反斜杠不影响)', !SCAN_DIRS.some((d) => d.includes(sep)) && !MECHANISM_FILE.includes(sep))

    // 端到端 1:全净 → 绿
    put(MECHANISM_FILE, GOOD_MECH)
    put('packages/app/src/features/x/XScreen.tsx', SCREEN_CLEAN)
    commitAll()
    let r = scan(GITROOT, 'head')
    t('E2E 净仓 exit 语义:三类全 0', r.violations.s1.length + r.violations.s2.length + r.violations.s3.length === 0, `fileCount=${r.fileCount}`)
    // 2 = 夹具屏 + 机制文件本身(App.tsx 也在 S2/S3 射程内，它自己偷加顶距同样算第二源)
    t('E2E 取材面确实收到了屏文件与机制文件(否则判据是空转)', r.fileCount === 2, `fileCount=${r.fileCount}`)

    // 端到端 2:写死 48 → S3 必红
    put('packages/app/src/features/x/XScreen.tsx', SCREEN_WITH_MAGIC)
    commitAll()
    r = scan(GITROOT, 'head')
    t('E2E 魔法顶距必红', r.violations.s3.length === 1, r.violations.s3[0] ?? '')

    // 端到端 3:第二取值口 → S2 必红
    put('packages/app/src/features/x/XScreen.tsx', SCREEN_WITH_SECOND_SOURCE)
    commitAll()
    r = scan(GITROOT, 'head')
    t('E2E 第二顶距源必红', r.violations.s2.length >= 1, JSON.stringify(r.violations.s2))

    // 端到端 4:摘掉唯一源 → S1 必红(防"装好被摘线")
    put('packages/app/src/features/x/XScreen.tsx', SCREEN_CLEAN)
    put(MECHANISM_FILE, BAD_MECH)
    commitAll()
    r = scan(GITROOT, 'head')
    t('E2E 单点被摘必红', r.violations.s1.length === 1, r.violations.s1[0] ?? '')

    // 端到端 5:行内豁免放过
    put(MECHANISM_FILE, GOOD_MECH)
    put(
      'packages/app/src/features/x/XScreen.tsx',
      SCREEN_WITH_MAGIC.replace('header:', 'header: /* statusbar-exempt: 该页刻意与封面同高 */'),
    )
    commitAll()
    r = scan(GITROOT, 'head')
    t('E2E 带原因的行内豁免应放过', r.violations.s3.length === 0 && r.notes.exempt === 1)

    // 端到端 6/7:**任务书点名的成对阳性对照** —— 同一段代码，非 Modal 必红、Modal 必放过
    // 顺带钉住"一次 git grep 预筛"的侧漏风险:旁边放一个不含任何判据字面量的文件，
    // 它必须被筛除(prefiltered=1)，而**同一轮里的脏文件仍须被判红** —— 筛得快不等于筛错。
    put('packages/app/src/features/y/Noise.ts', 'export const a = 1\n')
    put('packages/app/src/features/x/XScreen.tsx', PLAIN_SCREEN_WITH_SNIPPET)
    commitAll()
    r = scan(GITROOT, 'head')
    t('E2E 非 Modal 文件 paddingTop: StatusBar.currentHeight ?? 0 必红', r.violations.s2.length >= 1, JSON.stringify(r.violations.s2))
    t('E2E 非 Modal 文件不得被误记为 Modal 豁免', r.notes.modalFiles === 0 && r.notes.modalSuppressed.length === 0)
    t('E2E 预筛只筛掉无命中的文件(脏文件不得被筛走)', r.notes.prefiltered === 1 && r.fileCount === 2, `prefiltered=${r.notes.prefiltered} fileCount=${r.fileCount}`)

    // 先把上一个非 Modal 夹具清空，否则"放过"的结论会被它自己的红混淆(阳性残留)
    put('packages/app/src/features/x/XScreen.tsx', SCREEN_CLEAN)
    put('apps/mobile-rn/src/components/Drawer.tsx', MODAL_SCREEN_WITH_SNIPPET)
    commitAll()
    r = scan(GITROOT, 'head')
    t(
      'E2E 同一段代码放进含 <Modal 的文件 → 放过且如实报数',
      r.violations.s2.length === 0 && r.notes.modalFiles === 1 && r.notes.modalSuppressed.length >= 1,
      JSON.stringify(r.notes.modalSuppressed),
    )

    // 端到端 8:注释里提一句 `<Modal` 不配当逃生舱
    rmSync(join(GITROOT, 'apps/mobile-rn/src/components/Drawer.tsx'), { force: true })
    put('packages/app/src/features/x/XScreen.tsx', FAKE_MODAL_SCREEN)
    commitAll()
    r = scan(GITROOT, 'head')
    t('E2E 只在注释里出现 <Modal 的文件仍须判红', r.violations.s2.length >= 1 && r.notes.modalFiles === 0, JSON.stringify(r.violations.s2))

    // 端到端 9:一行豁免救不了同文件另一处(整文件免检就是原来的洞)
    // 两处都用**受管键**(header/page)；写成 footer 之类不在本门视野内，测不出东西
    put(
      'packages/app/src/features/x/XScreen.tsx',
      'const styles = {\n  header: { paddingTop: 48 }, // statusbar-exempt: 与封面同高\n  page: { paddingTop: 40 },\n}\n',
    )
    commitAll()
    r = scan(GITROOT, 'head')
    t('E2E 逐行豁免:被标那行放过、同文件另一处仍红', r.violations.s3.length === 1 && /L3 page/.test(r.violations.s3[0]), JSON.stringify(r.violations.s3))
    t('E2E 无 Modal 文件时不吞顶距:modalSuppressed 归零', r.notes.modalSuppressed.length === 0)

    const failed = cases.filter((c) => !c.pass)
    for (const c of cases) console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`)
    console.log(`${cases.length - failed.length}/${cases.length} 通过`)
    return failed.length ? 1 : 0
  } finally {
    rmScratch(GITROOT)
  }
}

function main(argv) {
  const ri = argv.indexOf('--root')
  const root = ri >= 0 ? resolve(argv[ri + 1]) : ROOT
  if (argv.includes('--self-test')) return selfTest()
  // --all = 显式全量(与缺省同义，但必须被接受：runner/CI 传这个参数时若被无声忽略，
  // 就会把"我以为跑了全量"当成结论)
  const face = argv.includes('--staged') ? 'index' : 'head'
  let res
  try {
    res = scan(root, face)
  } catch (e) {
    console.error(`无法判定(git 调用失败):${e?.message ?? e}`)
    return 2
  }
  const { lines, total } = report(res)
  if (argv.includes('--json')) {
    // JSON 模式必须**只**吐一份可被 `| jq` 直接吃的文档:此前人话尾巴接在 JSON 后面，
    // 任何机器消费方 JSON.parse 必崩(报错还看起来像判据的问题)
    console.log(JSON.stringify({ ...res, total, ok: total === 0, face }, null, 2))
    return total > 0 ? 1 : 0
  }
  lines.forEach((l) => console.log(l))
  if (argv.includes('--all') && res.notes.modalSuppressed.length) {
    console.log('  —— 以下为 Modal 文件内计数(不判红，供人工核:)')
    for (const m of res.notes.modalSuppressed) console.log(`  · ${m}`)
  }
  if (total > 0) {
    console.log(`\n共 ${total} 处违规。顶距唯一源 = ${MECHANISM_FILE} 的 <SafeAreaView edges={['top']}>。`)
    console.log("改法:删掉本文件里的状态栏顶距(取值一律交给单点);确属例外写 `statusbar-exempt: <一句话原因>`。")
    return 1
  }
  console.log('✅ 顶距单一源头成立')
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  scan,
  stripComments,
  objectBody,
  findMagicPads,
  collectExemptLines,
  lineOf,
  CURRENT_HEIGHT_RE,
  SBAR_LAYOUT_USE_RE,
  MODAL_RE,
  MAGIC_PAD_RE,
  TOP_STYLE_KEYS,
  MAGIC_MIN,
  MAGIC_MAX,
  MECHANISM_FILE,
  SCAN_DIRS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
