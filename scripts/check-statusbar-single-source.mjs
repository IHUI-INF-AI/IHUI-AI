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
 * 三条判据:
 *  S1 单点在位 —— `apps/mobile-rn/App.tsx` 必须真的用 `SafeAreaView` 且 `edges` 含 `'top'`。
 *     防"装好被摘线":机制不在而判据仍报绿,等于没有(与守门 70/76 同型)。
 *  S2 不得再有第二个取值口 —— 代码行(非注释)出现 `StatusBar.currentHeight` 或
 *     `statusBarHeight` 即红。前者在 iOS 恒为 `undefined`(⇒ 0),后者是共享 NavBar 曾开过的岔口。
 *  S3 不得再写状态栏量级的魔法顶距 —— 页头/页面根样式键(container/page/root/wrapper/
 *     header/headerRow/screen/body)的对象内出现 `paddingTop: <24..60 字面量>` 即红,零容忍。
 *     区间取自状态栏可能高度(24~59dp);不认表达式,因为 `insets.top` 才是想要的写法。
 *
 * 内容口径:全量判 **HEAD blob**,`--staged` 判**索引 blob** —— 共享工作树常年滞后 HEAD,
 * 按磁盘算会在恒红/假绿之间来回跳(与守门 77/83 同取向)。
 *
 * 用法: node scripts/check-statusbar-single-source.mjs [--staged|--self-test|--json|--root <dir>]
 * 退出码: 0=通过; 1=有违规; 2=脚本自身异常(git 不可用 / 机制文件读不到)
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveGitBin } from './lib/gitdir.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT = resolveGitBin()

/** 顶距唯一注入点 */
const MECHANISM_FILE = 'apps/mobile-rn/App.tsx'
/** 扫描面:RN 端 + 跨端共享屏层 */
const SCAN_DIRS = ['packages/app/src', 'apps/mobile-rn/src']
/** 页头 / 页面根容器 —— 只有这两类样式键上的顶距才是状态栏补偿的形态 */
const TOP_STYLE_KEYS = ['container', 'page', 'root', 'wrapper', 'header', 'headerRow', 'screen', 'body']
/** 状态栏可能高度(dp):下界排除普通间距,上界排除整屏留白 */
const MAGIC_MIN = 24
const MAGIC_MAX = 60

const SECOND_SOURCE_RE = /\bStatusBar\.currentHeight\b|\bstatusBarHeight\b/
const SECOND_SOURCE_SCAN = new RegExp(SECOND_SOURCE_RE.source, 'g')
const EXEMPT_RE = /statusbar-exempt:/
const TOP_OBJECT_RE = new RegExp(`(?:^|[{,\\s])(${TOP_STYLE_KEYS.join('|')})\\s*:\\s*\\{`, 'g')
const MAGIC_PAD_RE = /paddingTop\s*:\s*(\d+)\b/

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
 * 剥注释(保留行数,便于报出准确行号)。
 * 必须带**块注释状态机**:JSDoc 的续行既不以 `//` 也不以 `*` 开头(如
 * ` *  说明` 之外的裸文字行),只按行首判定会把文档里的说明读成使用点 ——
 * 而一道拿文档判红的门,唯一结局就是逼人绕过、连带废掉全部守门。
 */
function stripComments(src) {
  const out = []
  let inBlock = false
  for (const line of src.split('\n')) {
    let res = ''
    let i = 0
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', i)
        if (end < 0) {
          i = line.length
        } else {
          inBlock = false
          i = end + 2
        }
        continue
      }
      const open = line.indexOf('/*', i)
      const slash = line.indexOf('//', i)
      if (open >= 0 && (slash < 0 || open < slash)) {
        res += line.slice(i, open)
        const end = line.indexOf('*/', open + 2)
        if (end < 0) {
          inBlock = true
          i = line.length
        } else i = end + 2
        continue
      }
      if (slash >= 0) {
        res += line.slice(i, slash)
        i = line.length
        continue
      }
      res += line.slice(i)
      i = line.length
    }
    out.push(res)
  }
  return out.join('\n')
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

/** 找页面根/页头样式对象里的魔法顶距,返回命中数组 */
function findMagicPads(code) {
  const hits = []
  for (const m of code.matchAll(TOP_OBJECT_RE)) {
    const braceIdx = code.indexOf('{', m.index + m[0].length - 1)
    if (braceIdx < 0) continue
    const body = objectBody(code, braceIdx)
    if (body === null) continue
    const pad = body.match(MAGIC_PAD_RE)
    if (!pad) continue
    const v = Number(pad[1])
    if (v >= MAGIC_MIN && v <= MAGIC_MAX) hits.push({ key: m[1], value: v })
  }
  return hits
}

/**
 * @param {string} root   仓库根
 * @param {'head'|'index'|'worktree'} face 取材面
 */
export function scan(root = ROOT, face = 'head') {
  const v = { s1: [], s2: [], s3: [] }
  const notes = { unreadable: 0, exempt: 0 }

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

  const files = face === 'index' ? listFiles(root, 'index') : listFiles(root, 'all')
  for (const rel of files) {
    const raw = readBlob(root, rel, face)
    if (raw === null) {
      notes.unreadable++
      continue
    }
    const code = stripComments(raw)
    if (EXEMPT_RE.test(raw)) {
      notes.exempt++
      continue
    }
    for (const m of code.matchAll(SECOND_SOURCE_SCAN)) {
      v.s2.push(`${rel}:${code.slice(0, m.index).split('\n').length} 第二顶距源 ${m[0]}`)
    }
    for (const h of findMagicPads(code)) {
      v.s3.push(`${rel} ${h.key}{{ paddingTop: ${h.value} }} —— 状态栏量级魔法顶距`)
    }
  }
  return { violations: v, notes, fileCount: files.length }
}

function report(res) {
  const { violations: v, notes, fileCount } = res
  const total = v.s1.length + v.s2.length + v.s3.length
  const lines = [
    `顶部状态栏避让单一源头对账:判定 ${fileCount} 个源文件 + 1 个机制文件`,
    `  S1 单点在位    ${v.s1.length ? '❌ ' + v.s1.length : '✅ 0'}`,
    `  S2 第二取值口  ${v.s2.length ? '❌ ' + v.s2.length : '✅ 0'}`,
    `  S3 魔法顶距    ${v.s3.length ? '❌ ' + v.s3.length : '✅ 0'}`,
  ]
  if (notes.unreadable) lines.push(`  (取不到内容、未判定:${notes.unreadable} 个 —— 不计通过)`)
  if (notes.exempt) lines.push(`  (行内豁免 statusbar-exempt:${notes.exempt} 个文件)`)
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
 */
function selfTest() {
  const GITROOT = mkdtempSync(join(tmpdir(), 'ihui-statusbar-gate-'))
  const cases = []
  const t = (name, pass, detail = '') => cases.push({ name, pass, detail })
  try {
    git(['init', '-q'], GITROOT)
    git(['config', 'user.email', 'gate@test'], GITROOT)
    git(['config', 'user.name', 'gate'], GITROOT)
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
    t('S2 阳性对照:currentHeight 看得见', SECOND_SOURCE_RE.test('const h = StatusBar.currentHeight ?? 0'))
    t('S2 阳性对照:statusBarHeight 看得见', SECOND_SOURCE_RE.test('paddingTop: statusBarHeight,'))
    t('S2 反向:注释行不判红', stripComments('  // StatusBar.currentHeight 已废弃').trim() === '')
    t(
      'S2 反向:多行块注释中间的裸说明行不判红',
      SECOND_SOURCE_RE.test(
        stripComments('/**\n * 说明\n       再加一次 StatusBar.currentHeight 会推歪浮窗 */\nconst a = 1'),
      ) === false,
    )
    t(
      'S2 阳性对照:块注释结束后同文件的真代码仍须判红(状态机不得漏闭合)',
      SECOND_SOURCE_RE.test(stripComments('/* 说明 */ const h = StatusBar.currentHeight')),
    )
    t('剥注释保行数(行号仍对得上)', stripComments('a\n// b\nc').split('\n').length === 3)
    t('S3 阳性对照:header 上 48 看得见', findMagicPads('  header: { paddingTop: 48, height: 44 },').length === 1)
    t('S3 反向:12px 普通间距不计', findMagicPads('  card: { paddingTop: 12 }').length === 0)
    t('S3 反向:insets.top 表达式不计', findMagicPads('  header: { paddingTop: insets.top }').length === 0)
    t('S3 边界:24 计红 / 23 不计', findMagicPads('header:{paddingTop:24}').length === 1 && findMagicPads('header:{paddingTop:23}').length === 0)
    t('S3 边界:60 计红 / 61 不计', findMagicPads('header:{paddingTop:60}').length === 1 && findMagicPads('header:{paddingTop:61}').length === 0)
    t('S3 非页头键不判(content)', findMagicPads('  heroCard: { paddingTop: 40 }').length === 0)
    t('花括号配平:嵌套对象不越界吞并', findMagicPads('container: { inner: { a: 1 }, paddingTop: 30 }').length === 1)
    t('路径分隔符归一(Windows 反斜杠不影响)', !SCAN_DIRS.some((d) => d.includes(sep)) && !MECHANISM_FILE.includes(sep))

    // 端到端 1:全净 → 绿
    put(MECHANISM_FILE, GOOD_MECH)
    put('packages/app/src/features/x/XScreen.tsx', SCREEN_CLEAN)
    commitAll()
    let r = scan(GITROOT, 'head')
    t('E2E 净仓 exit 语义:三类全 0', r.violations.s1.length + r.violations.s2.length + r.violations.s3.length === 0, `fileCount=${r.fileCount}`)
    t('E2E 取材面确实收到了屏文件(否则判据是空转)', r.fileCount === 1)

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

    const failed = cases.filter((c) => !c.pass)
    for (const c of cases) console.log(`${c.pass ? '✅' : '❌'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`)
    console.log(`${cases.length - failed.length}/${cases.length} 通过`)
    return failed.length ? 1 : 0
  } finally {
    rmSync(GITROOT, { recursive: true, force: true })
  }
}

function main(argv) {
  const ri = argv.indexOf('--root')
  const root = ri >= 0 ? resolve(argv[ri + 1]) : ROOT
  if (argv.includes('--self-test')) return selfTest()
  const face = argv.includes('--staged') ? 'index' : 'head'
  let res
  try {
    res = scan(root, face)
  } catch (e) {
    console.error(`无法判定(git 调用失败):${e?.message ?? e}`)
    return 2
  }
  const { lines, total } = report(res)
  if (argv.includes('--json')) console.log(JSON.stringify({ ...res, total }, null, 2))
  else lines.forEach((l) => console.log(l))
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

export const __test__ = { scan, stripComments, objectBody, findMagicPads, SECOND_SOURCE_RE, MAGIC_PAD_RE, TOP_STYLE_KEYS, MAGIC_MIN, MAGIC_MAX, MECHANISM_FILE, SCAN_DIRS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
