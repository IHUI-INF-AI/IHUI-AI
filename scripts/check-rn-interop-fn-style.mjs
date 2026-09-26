#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-rn-interop-fn-style.mjs —— RN 侧「函数形态 style 被 cssInterop 整份吃掉」对账
 * (守门 131,blocking,2026-09-26 立;对应 PROJECT_PLAN G-211)
 *
 * 立因(真机 A/B 定案,见 PROJECT_PLAN「O83 登记④」):
 *   `react-native-css-interop/dist/runtime/components.js` 给一批 RN 核心组件注册了
 *   `cssInterop(X, { className: 'style' })`,而 `wrap-jsx` 是**无条件**替换的(与用没用
 *   className 无关)。收集内联档时,非数组声明走 `assignToTarget(props, { ...declaration })`,
 *   而 `{ ...函数 }` === `{}`(name/length 不可枚举);`applyStyles` 又把 `state.props` 清成
 *   `{}`,最终 `render-component.js` 以 `{...props, ...state.props}` 合并 ⇒ **原函数被空对象盖掉**。
 *   后果不是"少一个按压态",而是**该元素整份内联 style 消失**,布局退回默认 column + stretch。
 *   实测形态:区段头「更多」被折成两行(容器 padding/gap/flexDirection 全没)。
 *
 * 为什么判"注册表"而不是判"函数形态"本身:自定义组件收到函数形态 `style` 是它自己的契约,
 * 不在这一型里。所以**被哪些组件注册**是判据的输入 —— 而这张表绝不能手工维护第二份:
 * 本门每次运行都从 node_modules 里**现读** `cssInterop(...)` 注册语句,读不到就判"未判定"
 * 而不是拿内置清单冒充(内置清单只用于"注册表读不到时仍能报数",且会大声说明)。
 * 内置清单里出现一个**现读注册表没有**的名字 ⇒ 判"清单腐烂"红(与 §4 对 RN_ONLY_BRAND_KEYS
 * 同一条:豁免/清单项若已不存在同样算红)。
 *
 * 判据 F1:JSX 属性 `style={({...}) => ...}` / `style={(x) => ...}` 落在注册表内的组件上。
 * 棘轮锚点 = **该文件在 HEAD 自身的 F1 数**(与 77/83/98/102/113 同族):存量只报数、新增才判红。
 * 这一型存量有 119 处 / 59 文件(2026-09-26 实测),当场判红就是一台与任何提交都无关的恒红门,
 * 唯一结局是逼人绕过钩子、连带废掉全部守门(§12e 那条本仓最高反面教训)。
 * 行内出口:`interop-style-exempt: <一句话原因>`(须带原因;已登记进守门 108 存活期表,30 天)。
 *
 * 口径同 70/77/83/98/101/103/118:全量判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 仅人工逃生舱、两面旗同给 exit 2、任一面取不到 ⇒ **exit 2 无法判定**(不冒红也不记绿)。
 *
 * 用法:node scripts/check-rn-interop-fn-style.mjs [--staged|--worktree|--json|--self-test|--files a b]
 * 紧急跳过:HUSKY_SKIP_RN_INTEROP_FN_STYLE=1
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { catBatch, readWorktreeFile, selectFace, gitRaw } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120000
const SKIP_ENV = 'HUSKY_SKIP_RN_INTEROP_FN_STYLE'
/** 豁免必须**带原因**:裸标记(冒号后什么都没有)不算豁免 —— 与守门 102 对 `glyph-arrow-exempt`
 *  的同一条收紧(裸标记 + 注释闭合符曾被读成"带了原因",于是一行免检)。 */
const EXEMPT = /interop-style-exempt:\s*\S/
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/
const SCAN_ROOTS = ['apps/mobile-rn/src', 'packages/app/src']
const SCAN_EXT = /\.(tsx|ts)$/
/** 只在 JSX 里出现,故只扫这两类文件面 */
const STAGED_TRIGGER_HINT = 'apps/mobile-rn/ 与 packages/app/'

/**
 * 内置兜底清单 —— **不是判据来源**(判据用现读的注册表),只用于"包没装 / 干净检出"时仍能报数。
 * 内容 = 2026-09-26 从本机 `node_modules/.pnpm/react-native-css-interop@0.x/…/runtime/components.js`
 * 现读导出的 13 个组件,逐字照抄。两个反直觉事实值得留在案:
 *  - `Modal` **不在**注册表里 ⇒ 函数形态 style 落在 Modal 上不被 interop 吃掉,不算这一型;
 *  - `StatusBar` 在注册表里(它不画 UI,但确实被注册了)。
 * 清单里出现一个现读注册表没有的名字 ⇒ 本门判"清单腐烂"红 —— 与 §4 对 `RN_ONLY_BRAND_KEYS`
 * 同一条规矩:豁免/清单项若已不存在同样算红,否则清单会替人做出"这一型还在被管"的判断。
 */
const FALLBACK_REGISTRY = [
  'ActivityIndicator',
  'Image',
  'Pressable',
  'SafeAreaView',
  'ScrollView',
  'StatusBar',
  'Switch',
  'Text',
  'TextInput',
  'TouchableHighlight',
  'TouchableOpacity',
  'TouchableWithoutFeedback',
  'View',
]

/** 现读 interop 注册表:从包的 components.js 里抽注册语句的组件名。
 *
 * ⚠️ 必须同时认 **CJS 转译形态** `(0, api_1.cssInterop)(react_native_1.Pressable, {...})` ——
 * 包里发布的就是这个形状(`cssInterop` 与左括号之间隔着一个 `)`),按 ESM 直写形态
 * `cssInterop(X, …)` 写的正则会**恒空**,而恒空会被下面的 null 分支读成"读不到注册表",
 * 于是门一路用内置清单判、报告里只留一句"未对账" —— 这正是"判据失效的表现永远是安静"那一型。
 */
export function deriveInteropRegistry(sourceText) {
  if (typeof sourceText !== 'string') return null
  const names = new Set()
  const RE = /cssInterop\s*\)?\s*\(\s*(?:[A-Za-z_$][\w$]*\.)?([A-Z][\w$]*)\s*,/g
  for (const m of sourceText.matchAll(RE)) names.add(m[1])
  // 一个都没抽到 ⇒ 这份文件不是我要找的那份(包改版/换了写法)。返回 null 让调用方判"未判定",
  // 绝不返回空集 —— 空集会被读成"没有任何组件被注册",于是本门对整型缺陷全盲而一路报绿。
  return names.size ? names : null
}

/** 定位 interop 包里的注册文件(pnpm 不 hoist 传递依赖,故三处都要试)。读不到返回 null,不猜。 */
export function readInteropSource(root) {
  const cands = [
    join(root, 'node_modules/react-native-css-interop/dist/runtime/components.js'),
    join(root, 'apps/mobile-rn/node_modules/react-native-css-interop/dist/runtime/components.js'),
    join(root, 'node_modules/react-native-css-interop/dist/runtime/components.native.js'),
  ]
  // .pnpm 目录名带 peer 哈希后缀,不能写死 —— 用 glob 式枚举而不是 resolve():服务账户的
  // 解析路径与交互终端不通(§5b),而这里要的是"文件在不在",不是"模块能不能被 import"。
  try {
    const store = join(root, 'node_modules/.pnpm')
    for (const d of readdirSync(store)) {
      if (!d.startsWith('react-native-css-interop@')) continue
      cands.push(join(store, d, 'node_modules/react-native-css-interop/dist/runtime/components.js'))
    }
  } catch {
    /* 没有 .pnpm 目录 ⇒ 少一个候选,不是错误 */
  }
  for (const p of cands) {
    try {
      if (existsSync(p)) return readFileSync(p, 'utf8')
    } catch {
      /* 单个候选读失败继续下一个 */
    }
  }
  return null
}

/**
 * F1:找 `style={(...) => ...}` 落在注册表内组件上的站点。
 * 归属做法:命中处**向前回溯**最近的一个 JSX 开标签 `<Tag`,只有 Tag ∈ registry 才算。
 * 回溯而不是全文配对,是因为这一型的判据只需要"离得最近的那个标签";做完整 JSX 解析
 * 要引 parser(提交链跑不动的量),而漏判方向是"归不到标签 ⇒ 计入未判定",不静默放行。
 */
export function findFnStyleHits(text, registry) {
  const hits = []
  const undetermined = []
  if (typeof text !== 'string') return { hits, undetermined: [{ reason: '内容取不到' }] }
  const lines = text.split('\n')
  const RE = /\bstyle=\{\s*\(([^)]*)\)\s*(?:=>|function)/g
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    RE.lastIndex = 0
    if (!RE.test(line)) continue
    if (
      EXEMPT.test(line) ||
      (i > 0 && COMMENT_LINE.test(lines[i - 1]) && EXEMPT.test(lines[i - 1]))
    )
      continue
    const before = lines.slice(Math.max(0, i - 14), i + 1).join('\n')
    const tags = [...before.matchAll(/<([A-Z][\w$]*)[\s\n/>]/g)].map((x) => x[1])
    const tag = tags.length ? tags[tags.length - 1] : null
    if (!tag) {
      undetermined.push({ line: i + 1, reason: '回溯不到 JSX 开标签(不猜,只报数)' })
      continue
    }
    if (!registry.has(tag)) continue // 自定义组件收函数形态是它自己的契约,不算这一型
    hits.push({ line: i + 1, tag, text: line.trim().slice(0, 120) })
  }
  return { hits, undetermined }
}

function listFacePaths(face) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], ROOT, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(Boolean)
  if (face === 'staged')
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], ROOT, {
      timeout: GIT_TIMEOUT,
    })
      .split('\0')
      .filter(Boolean)
  return gitRaw(['ls-files', '-z'], ROOT, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
}

function readFace(paths, face) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(ROOT, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(ROOT, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

export function analyze(face) {
  const interopSrc = readInteropSource(ROOT)
  const derived = deriveInteropSourceSafe(interopSrc)
  const registry = derived ?? new Set(FALLBACK_REGISTRY)
  const registrySource = derived ? '现读 interop 包' : '内置兜底清单(未判定:读不到 interop 注册表)'
  const rot = derived ? FALLBACK_REGISTRY.filter((n) => !derived.has(n)) : []

  const all = listFacePaths(face)
  const files = all.filter((p) => SCAN_ROOTS.some((d) => p.startsWith(`${d}/`)) && SCAN_EXT.test(p))
  const unreadable = []
  const contents = readFace(files, face)
  const counts = new Map()
  const headCounts = new Map()
  const undetermined = []
  const detail = []
  for (const f of files) {
    const text = contents.get(f)
    if (typeof text !== 'string') {
      unreadable.push(f)
      continue
    }
    const { hits, undetermined: u } = findFnStyleHits(text, registry)
    for (const x of u) undetermined.push({ file: f, ...x })
    if (hits.length) {
      counts.set(f, hits.length)
      for (const h of hits) detail.push({ file: f, ...h })
    }
  }
  // 棘轮锚点:同一批文件在 **HEAD** 自身的数量。判 head 面时两者同一次读数 ⇒ 存量恒等于本轮,
  // 这正是"全量档只报数"的语义;判 staged 面时才真读到上一枚提交。
  if (face === 'head') {
    for (const [f, n] of counts) headCounts.set(f, n)
  } else {
    const headMap = readFace(files, 'head')
    for (const f of files) {
      const t = headMap.get(f)
      if (typeof t !== 'string') continue
      headCounts.set(f, findFnStyleHits(t, registry).hits.length)
    }
  }
  const red = []
  for (const [f, n] of [...counts].sort()) {
    const cap = headCounts.get(f) ?? 0
    if (n > cap) red.push({ file: f, n, cap })
  }
  /**
   * 空扫不得记绿:`head` 面枚举到 0 个候选文件,只可能是枚举/锚点坏了(仓库根错位、
   * ls-tree 静默空输出),而不是"这个仓没有 RN 源码"。判"无法判定"并点名,
   * 与守门 70/78/98"扫到 0 条一律判死"同一条取向。`staged` 面 0 个是正当形态
   * (本次提交没碰 RN 目录),不在此列。
   */
  const emptyScan = face === 'head' && files.length === 0
  return {
    face,
    registrySource,
    registrySize: registry.size,
    registryRot: rot,
    scannedFiles: files.length,
    unreadable,
    undetermined,
    stock: detail.filter((d) => !red.some((r) => r.file === d.file)),
    total: detail.length,
    filesWithHits: counts.size,
    red,
    emptyScan,
    // 注册表读不到**不影响退出码**:那是机器态(没装依赖 / 干净检出 / CI 未 install),
    // 提交者结构上满足不了 ⇒ 判红就是一台恒红门,唯一结局是逼人绕过钩子连带废掉全部守门
    // (守门 104/110 同一取向)。此时按内置清单判并在报告里点名"注册表未对账"。
    // 只有"枚举说该文件在、内容却取不到"或"head 面空扫"才是真的无法判定 ⇒ exit 2。
    exit: unreadable.length || emptyScan ? 2 : red.length || rot.length ? 1 : 0,
  }
}

function deriveInteropSourceSafe(src) {
  try {
    return deriveInteropRegistry(src)
  } catch {
    return null
  }
}

function runSelfTest() {
  let fail = 0
  const ok = (name, cond) => {
    if (cond) console.log(`✅ ${name}`)
    else {
      fail++
      console.log(`❌ ${name}`)
    }
  }
  const REG = new Set(['Pressable', 'View', 'Text'])
  const t1 = `
<Pressable
  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
>
  <Text>x</Text>
</Pressable>`
  ok('F1 命中:注册组件 + 函数形态', findFnStyleHits(t1, REG).hits.length === 1)
  const t2 = t1.replace('<Pressable', '<MyOwnButton')
  ok('F1 放过:自定义组件收函数形态不算这一型', findFnStyleHits(t2, REG).hits.length === 0)
  const t3 = `
<Pressable
  // interop-style-exempt: 这里刻意用函数形态,组件不经过 cssInterop
  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
>`
  ok('豁免:紧邻上一行是纯注释行且带原因 ⇒ 放行', findFnStyleHits(t3, REG).hits.length === 0)
  const t4 = `
<Pressable style={({ pressed }) => [a, pressed && b]} // 没带原因的标记不算 interop-style-exempt
`
  ok('无原因不生效', findFnStyleHits(t4, new Set(['Pressable'])).hits.length === 1)
  /**
   * 裸标记(冒号后什么都没有)也**不得**放行 —— 守门 102 记过同一型:一行"看起来带了豁免"
   * 就把整处免检,等于给这扇门开了一个不需要理由的出口。
   */
  const t4b = `
<Pressable
  // interop-style-exempt:
  style={({ pressed }) => [a, pressed && b]}
>`
  ok('裸标记(冒号后无原因)不得放行', findFnStyleHits(t4b, new Set(['Pressable'])).hits.length === 1)
  const t5 = `<View style={[styles.a]} />`
  ok('数组形态放过(数组不受 interop 影响)', findFnStyleHits(t5, REG).hits.length === 0)
  ok(
    '注册表解析:必须真抽出组件名(逐字取自真包的 CJS 转译形态,不是自造夹具)',
    (() => {
      // 这一行是从 node_modules/react-native-css-interop/dist/runtime/components.js:7 抄下来的原文。
      // 夹具若只写 ESM 直调形态,正则会"在自己的测试里全绿"而对真包失明(§22c 那条实测教训)。
      const real = '(0, api_1.cssInterop)(react_native_1.Pressable, { className: "style" });'
      const r = deriveInteropRegistry(real)
      return !!r && r.has('Pressable') && r.size === 1
    })(),
  )
  ok(
    '注册表解析:一行注册语句都抽不到 ⇒ 返回 null(判未判定),绝不返回空集冒充"没有组件被注册"',
    deriveInteropRegistry('/* 改版后的别的写法 */') === null,
  )
  ok(
    '真包现读:本仓安装的 interop 必须给出非空注册表,且含 Pressable 与 View',
    (() => {
      const r = deriveInteropRegistry(readInteropSource(ROOT))
      return !!r && r.has('Pressable') && r.has('View')
    })(),
  )
  ok(
    '内置兜底清单必须与现读注册表对得上(对不上就是清单腐烂,不得留成第二份真相)',
    (() => {
      const r = deriveInteropRegistry(readInteropSource(ROOT))
      return !r || FALLBACK_REGISTRY.every((n) => r.has(n))
    })(),
  )
  console.log(`--self-test: ${fail === 0 ? '全部通过' : `${fail} 条失败`}`)
  return fail
}

function main() {
  const argv = process.argv.slice(2)
  if (process.env[SKIP_ENV] === '1' && !argv.includes('--self-test')) {
    console.log(`⏭ 已跳过(${SKIP_ENV}=1)`)
    process.exit(0)
  }
  if (argv.includes('--self-test')) {
    process.exitCode = runSelfTest() === 0 ? 0 : 1
    return
  }
  const picked = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    process.exit(2)
  }
  const r = analyze(picked.face)
  if (argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2))
    process.exitCode = r.exit
    return
  }
  console.log(
    `[interop-fn-style] 面:${r.face} · 注册表:${r.registrySource}(${r.registrySize} 个组件)· 扫描 ${r.scannedFiles} 文件`,
  )
  if (r.registryRot.length)
    console.log(
      `❌ 清单腐烂:内置兜底表里有 ${r.registryRot.length} 个名字在现读注册表中已不存在:${r.registryRot.join(' , ')}`,
    )
  if (r.unreadable.length)
    console.log(
      `❌ 无法判定:${r.unreadable.length} 个候选文件在本面取不到内容(不记绿也不冒红),首个:${r.unreadable[0]}`,
    )
  if (r.emptyScan)
    console.log(
      '❌ 无法判定:head 面枚举到 **0 个**候选文件 —— 只可能是枚举面或仓库根错位,不得读成"这个仓没有 RN 源码"',
    )
  if (r.undetermined.length)
    console.log(`⚠️ 未判定(回溯不到 JSX 开标签)${r.undetermined.length} 处 —— 判据看不见 ≠ 没有`)
  if (r.red.length) {
    console.log(`❌ F1 新增(超出该文件 HEAD 自身存量)${r.red.length} 个文件:`)
    for (const x of r.red) console.log(`   ${x.file} 现 ${x.n} 处 > HEAD ${x.cap} 处`)
    console.log(
      `   出路:style 改数组形态,按压反馈走 Pressable 的 children 渲染函数(见 PROJECT_PLAN「O83 登记④」);\n` +
        `         确属例外写 \`interop-style-exempt: <原因>\`(带原因,已进守门 108 存活期表)。`,
    )
  } else {
    console.log(
      `✅ F1 无新增。存量 ${r.total} 处 / ${r.filesWithHits} 文件按"HEAD 自身存量"棘轮只报数(清偿进度看这一行,别引用文档里的旧数)`,
    )
  }
  console.log(`提示:本门射程 = ${STAGED_TRIGGER_HINT} 的 .tsx/.ts`)
  process.exitCode = r.exit
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href
)
  main()

export const __test__ = {
  findFnStyleHits,
  deriveInteropRegistry,
  readInteropSource,
  analyze,
  FALLBACK_REGISTRY,
  SCAN_ROOTS,
  EXEMPT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
