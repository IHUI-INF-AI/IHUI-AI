// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// probe-web-rn-gap 的形状锁与判据锁 —— 目的不是"跑通脚本",而是钉死三条会被时间磨掉的约定:
// ① 六档判据逐档可构造(判据分支不可构造 = 判据未被验证);② 未映射集必须与对账尺同一实现
// (§0.6 单源:两把尺子一旦漂移,差额就是没人认领的幽灵缺口);③ 取不到的面必须显式未判定(§0.3)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { __test__ as probe } from '../probe-web-rn-gap.mjs'
import { __test__ as parity } from '../check-web-rn-screen-parity.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(HERE, '..', '..')
const PROBE = join(ROOT, 'scripts', 'probe-web-rn-gap.mjs')

test('T1 六档判据逐档可构造(判据分支不可构造 = 判据未被验证)', () => {
  const cases = [
    { want: 'interactive', text: "export default function P(){const[a,s]=useState(0);fetch('/api/x');return null}" },
    { want: 'data-view', text: 'export default function P(){ useEffect(()=>{ fetch("/api/x") },[]) ; return null }' },
    { want: 'local', text: 'export default function P(){const[a,s]=useState(0);return null}' },
    { want: 'shell', text: "import X from './x'\nexport { X }\n" },
    {
      want: 'static-doc',
      text: `export default function P(){ return (<div>\n${Array.from({ length: 16 }, (_, i) => `<p>服务条款第 ${i} 条</p>`).join('\n')}\n</div>) }`,
    },
    { want: 'undetermined', text: null },
  ]
  for (const c of cases) {
    assert.equal(probe.bucketOf(probe.evOf(c.text)), c.want, `档位 ${c.want} 未命中`)
  }
})

test('T2 空壳判据依赖有效行:import/再导出/注释不计入', () => {
  const text = [
    "import A from './a'",
    "import B from './b'",
    "export { A, B }",
    "export * from './c'",
    '// 这一行是注释',
    '/* 这一段也是注释 */',
    '',
    '   ',
    'export default function Page(){ return <A/> }',
  ].join('\n')
  // 9 行正文里只有最后一行是实质内容 ⇒ 有效行 1,总行数 9。按总行数判空壳会把它读成真页面。
  assert.equal(probe.effectiveLines(text), 1)
  assert.equal(text.split('\n').length, 9)
  assert.equal(probe.bucketOf(probe.evOf(text)), 'shell')
})

test('T3 取数信号命中主流写法(fetch / React Query / /api/ 常量 / 仓内客户端)', () => {
  const samples = ["fetch('/api/user')", 'useQuery({ queryKey: [1] })', 'const U = "/api/chat/list"', 'apiClient.get(x)', 'apiPost(y)']
  for (const s of samples) {
    assert.ok(probe.countOf(s, probe.RE_DATA) > 0, `取数信号漏检:${s}`)
  }
  // 反向:纯文案页不得误报取数
  assert.equal(probe.countOf('const s = "这是静态说明文案"', probe.RE_DATA), 0)
})

test('T4 单源锁(§0.6):未映射判据与对账尺是同一枚实现,不是各自复算', () => {
  assert.equal(typeof probe.evaluateMap, 'function')
  assert.equal(probe.evaluateMap, parity.evaluateMap, '探针与对账尺的未映射判据必须是同一引用')
})

test('T5 --self-test 退出码 0(判据矩阵随脚本自证)', () => {
  execFileSync(process.execPath, [PROBE, '--self-test'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
})

test('T6 未知档位 ⇒ exit 2 未判定,绝不折成空清单冒充“该档无缺口”', () => {
  let code = 0
  let err = ''
  try {
    execFileSync(process.execPath, [PROBE, '--bucket=not-a-bucket'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    code = e.status
    err = `${e.stderr ?? ''}`
  }
  assert.equal(code, 2)
  assert.match(err, /未判定/)
})

test('T7 取材面二义(§0.4):--staged 与 --worktree 同给 ⇒ exit 2,不回落另一个面', () => {
  let code = 0
  let err = ''
  try {
    execFileSync(process.execPath, [PROBE, '--staged', '--worktree'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    code = e.status
    err = `${e.stderr ?? ''}`
  }
  assert.equal(code, 2)
  assert.match(err, /取材面不明/)
})

test('T8 页面族展开:薄壳 page.tsx 必须带上同目录 PageClient 一起取证(假阴性锁)', () => {
  const page = 'apps/web/app/(main)/x/page.tsx'
  const client = 'apps/web/app/(main)/x/PageClient.tsx'
  const fileSet = new Set([page, client])
  const texts = new Map([
    [page, "import PageClient from './PageClient'\nexport default function Page(){ return <PageClient /> }\n"],
    [client, "export default function C(){ const [a,s]=useState(0); fetch('/api/list'); return null }\n"],
  ])
  const fam = probe.familyOf(page, texts, fileSet)
  assert.ok(fam.files.includes(client), 'PageClient 未纳入取证面')
  // 只按 page.tsx 取证 ⇒ 空壳;带上页面族 ⇒ 真交互页。首版 71 条 shell 多是这一型假阴性。
  assert.equal(probe.bucketOf(probe.evOf(texts.get(page))), 'shell')
  assert.equal(probe.bucketOf(probe.evOf(fam.text)), 'interactive')
})

test('T9 第三方 import 不展开(解析不到如实不展开,不报错也不冒充已展开)', () => {
  const page = 'apps/web/app/(main)/y/page.tsx'
  const fileSet = new Set([page])
  const texts = new Map([[page, "import { Button } from '@/components/ui/button'\nexport default function P(){ return <Button/> }\n"]])
  const fam = probe.familyOf(page, texts, fileSet)
  assert.deepEqual(fam.files, [page])
  assert.equal(probe.resolveLocal(page, 'react', fileSet), null)
})

// ── 门户承载维(2026-10-27 立)────────────────────────────────────────
// 立因:本尺此前只看「web 路由集 × RN 屏集」,从不读 packages/shared/src/constants/web-portal.ts
// 那张移动端 WebView 门户表 ⇒ 门户在册的路由被逐条判成「RN 零承载」的既成缺口(现读 64 条 gap 里
// 有 14 条如此)。假缺口的真正代价是它只能靠人翻代码推翻,与机主"最大化减少开发"正面冲突。

const fakeRoutes = (...rs) => rs.map((route) => ({ route, rel: `apps/web/app/(main)/${route}/page.tsx` }))
const gapRow = (web, line) => ({ web, status: 'gap', note: 'RN 零承载(判过)', line })
const excludedRow = (web, line) => ({ web, status: 'excluded', reason: '结构性不承载', line })

test('T10 门户在册 ⇒ gap/excluded 行改判 contradicted,既不留在缺口也不掉进 unmapped', () => {
  const webRoutes = fakeRoutes('edu/schedule', 'models/overview', 'stock', 'knowledge-graph', 'letters')
  const map = [gapRow('edu/schedule', 1), excludedRow('models/overview', 2), gapRow('stock', 3)]
  const portal = {
    set: new Set(['edu/schedule', 'models/overview', 'knowledge-graph']),
    rows: [{ raw: '/knowledge-graph', route: 'knowledge-graph' }],
    unreadable: false,
  }
  const ev = parity.evaluateMap(webRoutes, map, [], 'head', portal)
  assert.equal(ev.judgedGap.length, 1, '门户没在册的 gap 行必须留在缺口档')
  assert.equal(ev.judgedGap[0].web, 'stock')
  assert.equal(ev.excluded.length, 0, '被门户推翻的 excluded 行不得继续冒充已豁免')
  assert.deepEqual(ev.contradicted.map((r) => [r.web, r.by]), [
    ['edu/schedule', 'gap'],
    ['models/overview', 'excluded'],
  ])
  // knowledge-graph 一行台账都没有,纯靠门户表被认成承载 ⇒ 这条腿是"表长一条、承载面自动跟一条";
  // 而 letters 既无台账行也不在表里 ⇒ 必须仍是未判定(尺子不能把"没读到"洗成"没缺口")。
  assert.deepEqual(ev.unmapped.map((r) => r.route), ['letters'])
  assert.equal(ev.portalCarried.size, 3)
  assert.equal(ev.portalUndetermined, false)
})

test('T11 门户表取不到 ⇒ 整维未判定:不洗白在册 gap、不扣 unmapped、不冒充 0 承载(§0.3)', () => {
  const webRoutes = fakeRoutes('edu/schedule', 'knowledge-graph')
  const map = [gapRow('edu/schedule', 1)]
  const ev = parity.evaluateMap(webRoutes, map, [], 'head', { set: null, rows: [], unreadable: true })
  assert.equal(ev.portalCarried, null)
  assert.equal(ev.portalUndetermined, true)
  assert.equal(ev.judgedGap.length, 1, '取不到表时不得把 gap 行洗成承载')
  assert.equal(ev.contradicted.length, 0, '取不到表时不得凭空造出"被推翻"的结论')
  assert.deepEqual(ev.unmapped.map((r) => r.route), ['knowledge-graph'], '取不到表时不得从 unmapped 里扣门户路由')
})

test('T14 入口可达性:侧栏 href 解析 + 六桶归类(阳性对照钉真源,不钉死路由名)', () => {
  const navText = [
    "export const NAV = [",
    "  { href: '/alpha', labelKey: 'a', adminOnly: true },",
    "  { href: '/beta', labelKey: 'b' },",
    "  { href: '/gamma', labelKey: 'c',",
    "    advancedOnly: true },",
    "  { href: `/dyn/${id}`, labelKey: 'd' },",
    "  { href: 'https://external/x', labelKey: 'e' },",
    ']',
  ].join('\n')
  // 解析口径由下面真仓阳性对照兜;这里只喂已解析好的条目集,验归类不串档
  const entries = parity.evaluateNav(
    { parsed: 3, entries: [{ route: 'alpha', href: '/alpha', admin: true, advanced: false }, { route: 'beta', href: '/beta', admin: false, advanced: false }, { route: 'gamma', href: '/gamma', admin: false, advanced: true }] },
    {
      aligned: [{ web: 'alpha' }],
      excluded: [],
      judgedGap: [{ web: 'beta' }],
      prefixRows: [],
      portalCarried: new Set(['gamma']),
    },
  )
  assert.equal(entries.counts.aligned, 1)
  assert.deepEqual(entries.gapItems, ['beta'], '判过零承载的入口必须被点名,且带档位标记')
  assert.equal(entries.counts.portal, 1, 'advancedOnly 项在门户表在册 ⇒ 算门户承载,不算缺口')

  // 档位标记跨行必须认得(导航项是多行对象;只看本行会把 admin 项读成普通项)
  const lines = navText.split('\n')
  const win = (i) => lines.slice(i, i + 5).join('\n')
  const iAlpha = lines.findIndex((l) => l.includes("'/alpha'"))
  const iGamma = lines.findIndex((l) => l.includes("'/gamma'"))
  assert.equal(/adminOnly:\s*true/.test(win(iAlpha)), true)
  assert.equal(/advancedOnly:\s*true/.test(win(iGamma)), true, 'advancedOnly 在下一行,窗口必须盖到')

  // 动态段归并(本维第一版在这里假阳了 6 条):入口写具体值,台账/路由记 `messages/[type]`
  const dyn = parity.evaluateNav(
    { parsed: 2, entries: [{ route: 'messages/notice', admin: false, advanced: false }] },
    {
      aligned: [{ web: 'messages/[type]' }],
      excluded: [],
      judgedGap: [],
      prefixRows: [],
      portalCarried: new Set(),
    },
    ['messages', 'messages/[type]', 'agents/[id]'],
  )
  assert.equal(dyn.counts.aligned, 1, '已承载的动态路由入口被误报成缺口/无记录')
  assert.equal(dyn.counts.unrecorded, 0)
  assert.equal(dyn.viaPattern, 1, '经动态段归并的条数必须自报,否则读数看不出这一步做过')
  const dynGap = parity.evaluateNav(
    { parsed: 1, entries: [{ route: 'letters/x', admin: false, advanced: false }] },
    { aligned: [], excluded: [], judgedGap: [{ web: 'letters/[id]' }], prefixRows: [], portalCarried: new Set() },
    ['letters/[id]'],
  )
  assert.deepEqual(dynGap.gapItems, ['letters/x → letters/[id]'], '缺口档入口必须带上归并来源,便于复核不是硬凑')

  // 真仓阳性对照:这仓真有的入口必须解析出来,否则"入口级缺口 0"可能是坏尺子
  const nav = parity.collectNavEntries('head')
  assert.ok(nav, `${parity.NAV_REL} 取不到`)
  const routes = new Set(nav.entries.map((e) => e.route))
  assert.ok(routes.has('admin/theme'), `阳性对照未命中(admin/theme),解析口径与真仓形不同,实读 ${[...routes].slice(0, 3)}`)
  assert.ok(nav.entries.length > 100, `只解析出 ${nav.entries.length} 条入口,与现读 200+ 量级不符`)

  // 未判定两支:导航件取不到 / 门户表取不到 ⇒ 整维未判定,绝不把门户入口算成 unrecorded 缺口
  assert.equal(parity.evaluateNav(null, { portalCarried: new Set() }).undetermined, true)
  const und = parity.evaluateNav({ parsed: 1, entries: [{ route: 'x', admin: false, advanced: false }] }, {
    aligned: [],
    excluded: [],
    judgedGap: [],
    prefixRows: [],
    portalCarried: null,
  })
  assert.equal(und.undetermined, true)
})

test('T13 在册 portal 行三态:表里有⇒计入承载 / 表里没有⇒腐烂点名 / 表取不到⇒未判定不冒红', () => {
  const webRoutes = fakeRoutes('edu/schedule', 'ghost-route')
  const portalRow = (web, line) => ({ web, status: 'portal', reason: '门户承载', line })
  const portal = { set: new Set(['edu/schedule']), rows: [], unreadable: false }
  const ok = parity.evaluateMap(webRoutes, [portalRow('edu/schedule', 1)], [], 'head', portal)
  assert.equal(ok.portalRows.length, 1)
  assert.equal(ok.rot.length, 0)
  assert.deepEqual(ok.unmapped.map((r) => r.route), ['ghost-route'])
  // 行说承载而表里查无此 path ⇒ 台账给一个不存在的承载背书(§0.7 验过才免)
  const bad = parity.evaluateMap(webRoutes, [portalRow('ghost-route', 1)], [], 'head', portal)
  assert.equal(bad.portalRows.length, 0)
  assert.match(bad.rot[0].why, /portal 行而门户表无此 path/)
  // 表整个取不到 ⇒ 不凭空造腐烂,也不凭空造缺口:行算已处置,另记未判定
  const und = parity.evaluateMap(webRoutes, [portalRow('edu/schedule', 1)], [], 'head', {
    set: null,
    rows: [],
    unreadable: true,
  })
  assert.equal(und.portalUnverified.length, 1)
  assert.equal(und.rot.length, 0, '表取不到不得造出"腐烂"这一判红输入')
  assert.deepEqual(und.unmapped.map((r) => r.route), ['ghost-route'])
})

test('T12 真仓存活 + 阳性对照(对照取自被审面的表内容,不钉死路由名)', () => {
  const portal = parity.collectPortalRoutes('head')
  assert.equal(portal.unreadable, false, `门户表取不到(${parity.WEB_PORTAL_REL})⇒ 这一维根本没装车`)
  assert.ok(portal.set.size >= 50, `门户表只读出 ${portal.set.size} 条,与 90+ 条的现读形态不符`)
  const webRoutes = parity.collectWebRoutes('head')
  const routeSet = new Set(webRoutes.map((r) => r.route))
  const carried = [...portal.set].filter((r) => routeSet.has(r))
  assert.ok(carried.length >= 30, `门户表与 web 路由集交集只有 ${carried.length} 条 ⇒ 两侧归一化形态漂移`)
  const sample = carried[0]
  // 阳性对照:同一张真表喂进判据,在册 gap 行必须被推翻
  const hit = parity.evaluateMap(fakeRoutes(sample), [gapRow(sample, 1)], [], 'head', portal)
  assert.equal(hit.contradicted.length, 1, `门户表在册的 ${sample} 没被认成承载 ⇒ 判据与表的 path 形态不同形`)
  assert.equal(hit.judgedGap.length, 0)
  // 反向对照:拿一条确定不在表里的路由,同一条尺子必须仍判它是未判定
  const notCarried = webRoutes.map((r) => r.route).find((r) => !portal.set.has(r))
  const miss = parity.evaluateMap(fakeRoutes(notCarried), [], [], 'head', portal)
  assert.deepEqual(miss.unmapped.map((r) => r.route), [notCarried])
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
