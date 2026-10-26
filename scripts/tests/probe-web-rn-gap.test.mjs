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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
