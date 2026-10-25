// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// web→RN 缺口分诊探针(只读,不进提交链)—— 把对账尺报出的 unmapped web 路由,
// 从「人工逐屏比对」变成「机器先分档,人只判最值得判的那一桶」。
//
// 立因(goal 2026-10-25/26):对账尺 check-web-rn-screen-parity 报 229 条未映射路由,而它是只读尺子,
// 只给启发式候选(原文写明「仅建议不判定」)。229 条若靠人工逐屏读 web 页面正文分档,一轮就是几百次
// 文件读取 —— 2026-10-25 派 4 个分诊子代理全部因工具调用过载失联,正是「没有机器取证面」的直接后果。
// 本探针补的就是这一层:逐条取 web 页面正文,抽可复算的交互证据,落成六档,并给每条的 RN 候选。
//
// 分档判据(逐条可复算,写死在 bucketOf,不靠模型临场判断):
//   1. 正文取不到                 ⇒ undetermined(点名,绝不折成任何“已判”档 —— §0.3)
//   2. 有数据请求 ∧(状态 ∨ 表单)  ⇒ interactive  ← 强缺口候选(RN 要不要补,先判这一桶)
//   3. 有数据请求                 ⇒ data-view(读型页:列表/详情)
//   4. 有状态或表单但无数据请求    ⇒ local(纯端内交互:开关、设置项、本地计算)
//   5. 三者皆无 ∧ 有效行 ≤ 12      ⇒ shell(空壳/纯转发页 —— 该页在 web 自己也可能不是真页面)
//   6. 其余                       ⇒ static-doc(静态文档:条款/说明/落地页)
//
// 「有效行」= 去掉空行、注释、纯 import/再导出行之后的行数。空壳页的判据必须走有效行:
// 直接按总行数会漏掉「一堆 import + 一行 export default」这类转发页(实测 web 里这种页不少)。
//
// 取材面纪律(§0.4):默认 HEAD blob;--staged 判索引;--worktree 仅人工逃生舱;两面旗同给 exit 2。
// 单源纪律(§0.6):未映射集取自对账尺 evaluateMap,路由枚举/候选建议取自同尺 __test__,本文件零复算
// —— 对账尺报多少条,本探针就分诊多少条(两把尺子一旦漂移,差额就是没人认领的幽灵缺口)。
// 批量读正文走 lib/face-reader 的 catBatch:逐条 `git show` 在 Windows 0.2~0.4s/次,229 条要 46~92s。
//
// 定级:只读报告器,exit 0(取不到被审面 ⇒ exit 2「未判定」)。与对账尺同列,不进提交链 ——
// §12e:挂上去就是恒红门,而恒红门的唯一结局是逼人 --no-verify,连带废掉全部守门。
//
// 用法:
//   node scripts/probe-web-rn-gap.mjs                       # 分档摘要(每档前 15 条)
//   node scripts/probe-web-rn-gap.mjs --bucket=interactive  # 只看强缺口桶
//   node scripts/probe-web-rn-gap.mjs --json                # 全量明细(供派单/子代理消费)
//   node scripts/probe-web-rn-gap.mjs --full                # 全量逐条打印
//   node scripts/probe-web-rn-gap.mjs --top=40              # 每档条数
//   node scripts/probe-web-rn-gap.mjs --out=.ihui-agent/tmp/gap.json
//   node scripts/probe-web-rn-gap.mjs --self-test           # 分档矩阵自检(不读仓库)
import { pathToFileURL, fileURLToPath } from 'node:url'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { __test__ as parity } from './check-web-rn-screen-parity.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { catBatch } from './lib/face-reader.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const fullMode = argv.includes('--full')
const selfTestMode = argv.includes('--self-test')
const stagedMode = argv.includes('--staged')
const worktreeMode = argv.includes('--worktree')
const bucketArg = argv.find((a) => a.startsWith('--bucket='))
const outArg = argv.find((a) => a.startsWith('--out='))
const topArg = argv.find((a) => a.startsWith('--top='))
const topN = topArg ? Number.parseInt(topArg.split('=')[1], 10) : 15
const wantBucket = bucketArg ? bucketArg.slice('--bucket='.length) : null

if (stagedMode && worktreeMode) {
  console.error('❌ 未判定:--staged 与 --worktree 同给,取材面不明(§0.4 不允许回落另一个面)')
  process.exit(2)
}
const FACE = stagedMode ? 'staged' : worktreeMode ? 'worktree' : 'head'

/** 数据请求信号:真正在取数 —— fetch / React Query / SWR / 直连 `/api/` 常量 / 仓内 api 客户端 */
const RE_DATA =
  /(?:fetch\s*\(|useQuery\s*\(|useSWR\s*\(|useMutation\s*\(|["'`]\/api\/[A-Za-z0-9_-]|apiClient\s*\.|apiGet\s*\(|apiPost\s*\()/g
/** 端内状态信号 */
const RE_STATE = /\buse(?:State|Reducer)\s*\(/g
/** 表单/提交信号 */
const RE_FORM = /(?:onSubmit|handleSubmit|<form[\s>])/g

const countOf = (text, re) => (text.match(re) ?? []).length

/** 有效行:剔除空行、注释、纯 import 与再导出 —— 空壳页的判据靠它(总行数会把转发页读成真页面) */
function effectiveLines(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((s) => s && !s.startsWith('//') && !s.startsWith('*') && !s.startsWith('/*'))
    .filter((s) => !/^import\s/.test(s))
    .filter((s) => !/^export\s+(?:\*|\{)/.test(s))
    .filter((s) => !/^export\s+.*\bfrom\s+['"]/.test(s))
    .filter((s) => !/^export\s+type\s/.test(s)).length
}

/** 正文 → 证据(纯;text 取不到时 readable=false,由 bucketOf 判 undetermined,绝不折成空证据) */
function evOf(text) {
  const readable = typeof text === 'string'
  return {
    readable,
    bytes: readable ? text.length : 0,
    lines: readable ? text.split('\n').length : 0,
    eff: readable ? effectiveLines(text) : 0,
    data: readable ? countOf(text, RE_DATA) : 0,
    state: readable ? countOf(text, RE_STATE) : 0,
    form: readable ? countOf(text, RE_FORM) : 0,
  }
}

/** 证据 → 档位(六档互斥且全覆盖,逐条可复算) */
function bucketOf(ev) {
  if (!ev.readable) return 'undetermined'
  if (ev.data > 0 && (ev.state > 0 || ev.form > 0)) return 'interactive'
  if (ev.data > 0) return 'data-view'
  if (ev.state > 0 || ev.form > 0) return 'local'
  if (ev.eff <= 12) return 'shell'
  return 'static-doc'
}

const BUCKETS = ['interactive', 'data-view', 'local', 'shell', 'static-doc', 'undetermined']
const BUCKET_NOTE = {
  interactive: '强缺口候选(取数 + 交互)',
  'data-view': '读型页(取数展示)',
  local: '端内交互(无取数)',
  shell: '空壳/转发页',
  'static-doc': '静态文档(条款/说明)',
  undetermined: '未判定(正文取不到)',
}

/** 分档矩阵自检:六档每一档都必须能被构造出来命中 —— 判据分支不可构造 = 判据未被验证 */
function selfTest() {
  const cases = [
    { want: 'interactive', text: "export default function P(){const[a,s]=useState(0);fetch('/api/x');return null}" },
    { want: 'data-view', text: 'export default function P(){ useEffect(()=>{ fetch("/api/x") },[]) ; return <div/> }' },
    { want: 'local', text: 'export default function P(){const[a,s]=useState(0);return <div onClick={s}/>}' },
    { want: 'shell', text: "import X from './x'\nexport { X }\n" },
    {
      want: 'static-doc',
      // 多行静态文档页:无取数、无状态、无表单,但有效行足够多 —— 与 shell 档的分界就在这里
      text: `export default function P(){\n  return (\n    <div>\n${Array.from({ length: 16 }, (_, i) => `      <p>服务条款第 ${i} 条</p>`).join('\n')}\n    </div>\n  )\n}`,
    },
    { want: 'undetermined', text: null },
  ]
  const bad = []
  for (const c of cases) {
    const got = bucketOf(evOf(c.text))
    if (got !== c.want) bad.push(`want=${c.want} got=${got}`)
  }
  if (bad.length > 0) {
    console.error(`❌ 自检失败:分档矩阵 ${bad.length} 条不符 ⇒ ${bad.join('; ')}`)
    return 1
  }
  console.info('✅ 自检通过:六档判据逐档可构造(interactive/data-view/local/shell/static-doc/undetermined)')
  return 0
}

function run() {
  const webRoutes = parity.collectWebRoutes(FACE)
  const rnScreens = parity.collectRnScreens(FACE)
  if (webRoutes.length === 0 || rnScreens.length === 0) {
    console.error(`❌ 未判定:取不到被审面(web 路由 ${webRoutes.length} / RN 屏 ${rnScreens.length}),不记绿也不冒红`)
    return 2
  }
  const map = parity.loadMap(FACE)
  const { unmapped } = parity.evaluateMap(webRoutes, map, rnScreens, FACE)

  const revOf = (rel) => (FACE === 'staged' ? `:${rel}` : `HEAD:${rel}`)
  const texts = new Map()
  if (FACE === 'worktree') {
    for (const r of unmapped) {
      try {
        texts.set(revOf(r.rel), readFileSync(join(ROOT, r.rel), 'utf8'))
      } catch {
        texts.set(revOf(r.rel), null)
      }
    }
  } else {
    for (const [k, v] of catBatch(ROOT, unmapped.map((r) => revOf(r.rel)), { maxBuffer: 512 * 1024 * 1024 })) {
      texts.set(k, v)
    }
  }

  const rows = unmapped.map((r) => {
    const ev = evOf(texts.get(revOf(r.rel)) ?? null)
    return {
      web: r.route,
      rel: r.rel,
      seg: r.route.split('/')[0] ?? '(root)',
      bytes: ev.bytes,
      lines: ev.lines,
      eff: ev.eff,
      data: ev.data,
      state: ev.state,
      form: ev.form,
      bucket: bucketOf(ev),
      candidates: parity.suggestCandidates(r.route, rnScreens, 3).map((c) => `${c.exact ? '[同名] ' : ''}${c.name}`),
    }
  })

  if (wantBucket && !BUCKETS.includes(wantBucket)) {
    console.error(`❌ 未判定:未知档位 ${wantBucket}(合法档位:${BUCKETS.join('/')})`)
    return 2
  }

  const buckets = {}
  for (const b of BUCKETS) buckets[b] = rows.filter((r) => r.bucket === b).length
  const shown = wantBucket ? rows.filter((r) => r.bucket === wantBucket) : rows
  const payload = {
    face: FACE,
    webRoutes: webRoutes.length,
    rnScreens: rnScreens.length,
    unmapped: rows.length,
    buckets,
    routes: shown,
  }
  if (outArg) {
    writeFileSync(outArg.slice('--out='.length), `${JSON.stringify(payload, null, 2)}\n`)
  }
  if (jsonMode) {
    console.info(JSON.stringify(payload, null, 2))
    return 0
  }

  const log = (...a) => console.info(...a)
  log(`判定面        : ${FACE === 'head' ? 'HEAD blob' : FACE === 'staged' ? '索引 blob' : '工作树(人工逃生舱)'}`)
  log(`web 路由      : ${webRoutes.length} / RN 屏 ${rnScreens.length}`)
  log(`未映射(分诊对象): ${rows.length}`)
  log('')
  log(`分档结果(建议,不是判定 —— 登记权仍在 scripts/data/web-rn-screen-map.jsonl):`)
  for (const b of BUCKETS) {
    log(`  ${String(buckets[b]).padStart(4)}  ${b.padEnd(13)} ${BUCKET_NOTE[b]}${wantBucket && b !== wantBucket ? '' : ''}`)
  }
  log('')
  for (const b of BUCKETS) {
    if (wantBucket && b !== wantBucket) continue
    const list = rows.filter((r) => r.bucket === b)
    if (list.length === 0) continue
    const take = fullMode || wantBucket ? list.length : Math.min(list.length, topN)
    log(`── ${b}(${list.length} 条${take < list.length ? `,列前 ${take} 条` : ''}) ──`)
    for (const r of list.slice(0, take)) {
      const c = r.candidates.join(' | ') || '—'
      log(`  ${r.web.padEnd(42)} eff=${String(r.eff).padStart(4)} data=${r.data} state=${r.state} form=${r.form}  → ${c}`)
    }
    log('')
  }
  if (buckets.undetermined > 0) {
    log(`⚠ ${buckets.undetermined} 条正文取不到,已单列 undetermined 档(不是“已判无缺口”)`)
  }
  log('下一步:interactive 桶是 RN 该不该补的第一战场;static-doc/shell 两桶先问“RN 要不要承载”再登记。')
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  process.exit(selfTestMode ? selfTest() : run())
}

export const __test__ = {
  bucketOf,
  evOf,
  effectiveLines,
  BUCKETS,
  BUCKET_NOTE,
  countOf,
  RE_DATA,
  RE_STATE,
  RE_FORM,
  // 单源锁用:下游与本尺必须共用同一枚未映射判据,测试按引用相等断言(§0.6)。
  evaluateMap: parity.evaluateMap,
  cov,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
