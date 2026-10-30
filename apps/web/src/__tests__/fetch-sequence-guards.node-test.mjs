// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 在途请求序号守卫 形状锁(2026-10-26,守门批同族:竞态钉形状不钉时序)。
//   node --test apps/web/src/__tests__/fetch-sequence-guards.node-test.mjs
//
// 钉四格(全部量自 2026-10-25 普查后修复):
//  1) TrendChartDialog(itemId/window 连发,旧响应覆盖新曲线 + 假 loading 熄灭);
//  2) learn/topic PageClient(切课的迟到付费课列表串进新课);
//  3) ide/mcp-pane DetailPanel(切换选中项时迟到详情张冠李戴);
//  4) ModelDetailDialog 行过滤:合法 0(免费模型 inputPrice=0)不得被 `r.value` 当缺失吞行。
// 判据与 history-page-hydration 同源:effect 体内 fetch/promise 的 .then 对写入前做
// 序号/身份复核,缺一即红;变异夹具(摘守卫)必须翻红 —— 摘掉判据不算通过。
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT_WEB = resolve(import.meta.dirname, '../../')
const W = (p) => resolve(ROOT_WEB, p)

const FILES = {
  trend: 'app/(main)/ai-news/components/TrendChartDialog.tsx',
  topic: 'app/(main)/learn/topic/[id]/PageClient.tsx',
  mcp: 'src/components/ide/mcp-pane.tsx',
  detail: 'app/(main)/ai-news/components/ModelDetailDialog.tsx',
}

function region(text, headRe, span = 4200) {
  const m = text.match(headRe)
  if (!m) return null
  return text.slice(m.index, m.index + span)
}

// ── 判据 1:effect 的 promise 链前必先 ++seqRef,写 set* 前必复核 ──
function checkSeqGuard(body, refName) {
  const problems = []
  if (!new RegExp(String.raw`const mine = \+\+${refName}\.current`).test(body))
    problems.push('缺请求序号自增')
  if (!new RegExp(String.raw`if \(${refName}\.current !== mine\) return`).test(body) && !new RegExp(String.raw`if \(.*\.current === mine`).test(body))
    problems.push('写入前未复验序号')
  return problems
}

test('TrendChartDialog 取数 effect 有在途序号复核', () => {
  const src = readFileSync(W(FILES.trend), 'utf8')
  const body = region(src, /const requestSeqRef[\s\S]{0,80}React\.useEffect\(\(\) => \{/) ?? src
  assert.deepEqual(checkSeqGuard(body, 'requestSeqRef'), [])
})

test('learn/topic PageClient 付费课 effect 有在途序号复核', () => {
  const src = readFileSync(W(FILES.topic), 'utf8')
  const body = region(src, /useEffect\(\(\) => \{\s*\n\s*if \(data\?\.source === 'premium'\)[\s\S]{0,1200}/)
  assert.ok(body, '找不到 premium effect(结构搬了家,锁要跟着搬家,不许静默失配)')
  assert.deepEqual(checkSeqGuard(body, 'premiumSeqRef'), [])
})

test('mcp-pane DetailPanel getSkill 有在途序号复核', () => {
  const src = readFileSync(W(FILES.mcp), 'utf8')
  const body = region(src, /const skillSeqRef = React\.useRef\(0\)[\s\S]{0,1200}/)
  assert.ok(body, '找不到 skillSeqRef 声明段')
  assert.deepEqual(checkSeqGuard(body, 'skillSeqRef'), [])
})

test('ModelDetailDialog 行过滤不吞合法 0(裸 .filter((r) => r.value) 即红)', () => {
  const src = readFileSync(W(FILES.detail), 'utf8')
  assert.ok(
    !/\.filter\(\(r\) => r\.value\)/.test(src),
    '裸 r.value 过滤复活:免费模型 inputPrice=0 / voteCount=0 整行消失(读作「无此项」)',
  )
  assert.match(src, /\.filter\(\(r\) => r\.value !== null && r\.value !== undefined && r\.value !== ''\)/)
})

// ── 变异自证:摘掉守卫形状,判据必须响 ──
test('成对:摘掉序号复核 ⇒ 判据翻红', () => {
  const stripped = 'React.useEffect(()=>{\n setLoading(true)\n fetchX().then(setData).finally(()=>setLoading(false))\n},[x])'
  assert.ok(checkSeqGuard(stripped, 'seqRef').length >= 2)
})

test('成对:合格形态不误伤', () => {
  const good =
    'const seqRef = useRef(0)\nuseEffect(() => {\n const mine = ++seqRef.current\n fetchData().then(d => { if (seqRef.current === mine) setD(d) })\n}, [k])'
  assert.deepEqual(checkSeqGuard(good, 'seqRef'), [])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
