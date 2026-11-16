// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// closeProduct 第四腿(跨会话终止)行为单测 —— 注入 probe + run mock,不真调 taskkill/helper
// 2026-11-15 扩写:原文件只钉了签名注入 + 提前返回两条弱行为;
// 现在加了 probe 注入点后,第四腿的真实逻辑可以稳定构造并验证:
//   ① 不存在的产品 ⇒ pids=[] ⇒ 提前 return ⇒ closed=true, run 不被调用
//   ② 第四腿成功(cross-kill 后 pids 清零) ⇒ closed=true, crossSession.ok=true, 逐 pid 结果留痕
//   ③ 第四腿失败(pid 拒绝终止) ⇒ closed=false, crossSession.ok=false, 逐 pid error 留痕
//   ④ helper 抛错 ⇒ closed=false, crossSession.error="helper 抛错:..."
//   ⑤ helper 输出非 JSON ⇒ closed=false, crossSession.error="helper 输出不含 JSON 数组"
import assert from 'node:assert/strict'
import { closeProduct } from '../lib/trae-client-process.mjs'

// 用例 ①:不存在的产品 ⇒ 提前 return,run 不被触发
{
  let runCalled = false
  const run = () => { runCalled = true; return '[]' }
  const r = closeProduct('IHUI-Not-There-Product', { waitMs: 1, run })
  assert.equal(r.closed, true, '不存在的产品 ⇒ pids=[] ⇒ 提前 return(closed=true)')
  assert.equal(r.wasRunning, false, '不存在的产品 ⇒ wasRunning=false')
  assert.equal(runCalled, false, '提前 return ⇒ 第四腿 run 不应被调用')
}

// ── 以下四例共同模式:probe 始终返回非空 ⇒ 前三腿的 waitOnce 全落空 ⇒ 必然进第四腿 ──
// 注:每例 ~1.2s(3 次 waitOnce 各400ms sleep);不真调 taskkill(helper 不存在被 try/catch 吞掉)

// 用例 ②:第四腿成功 —— run 清零 alive 数组 ⇒ waitOnce 第二次探测返回 [] ⇒ closed=true
{
  let alive = [123]
  let crossCalled = false
  const run = () => {
    crossCalled = true
    alive = []  // cross kill 成功,pids 清零,waitOnce 探测后返回 true
    return JSON.stringify([{ pid: 123, ok: true, error: '' }])
  }
  const probe = () => alive
  const r = closeProduct('fake-product', { waitMs: 100, pids: [123], probe, run })
  assert.equal(crossCalled, true, '前三腿全失败 ⇒ 第四腿 run 应被触发')
  assert.equal(r.closed, true, '第四腿成功 ⇒ closed=true')
  assert.equal(r.forced, true, 'forced=true')
  assert.equal(r.wasRunning, true, 'wasRunning=true')
  assert.equal(r.crossSession?.attempted, true, 'crossSession.attempted=true')
  assert.equal(r.crossSession?.ok, true, 'crossSession.ok=true')
  assert.equal(r.crossSession?.via, 'cross-session', 'crossSession.via=cross-session')
  assert.deepEqual(
    r.crossSession?.results,
    [{ pid: 123, ok: true, error: '' }],
    '逐 pid 结果:ok=true, error 空',
  )
}

// 用例 ③:第四腿失败(pid 拒绝终止) ⇒ closed=false, crossSession.ok=false, pid error 留痕
{
  const run = () =>
    JSON.stringify([{ pid: 123, ok: false, error: 'TerminateProcess failed:拒绝访问' }])
  const probe = () => [123]
  const r = closeProduct('fake-product', { waitMs: 100, pids: [123], probe, run })
  assert.equal(r.closed, false, '第四腿 pid 拒绝 ⇒ closed=false')
  assert.equal(r.forced, true, 'forced=true')
  assert.equal(r.crossSession?.attempted, true, 'crossSession.attempted=true')
  assert.equal(r.crossSession?.ok, false, 'crossSession.ok=false')
  assert.equal(
    r.crossSession?.error,
    undefined,
    '全局 error 键不存在(每 pid 的 error 单独记录,cross.error 为空串时不展开)',
  )
  assert.equal(r.crossSession?.results?.[0]?.ok, false, 'pid 拒绝结果留痕:ok=false')
  assert.match(
    r.crossSession?.results?.[0]?.error ?? '',
    /拒绝访问/,
    'pid 错误原因留痕',
  )
}

// 用例 ④:helper 抛错 ⇒ crossSession.error="helper 抛错:..." 且包含原始异常信息
{
  const run = () => { throw new Error('PowerShell not found') }
  const probe = () => [123]
  const r = closeProduct('fake-product', { waitMs: 100, pids: [123], probe, run })
  assert.equal(r.closed, false, 'helper 抛错 ⇒ closed=false')
  assert.equal(r.crossSession?.attempted, true, 'crossSession.attempted=true')
  assert.match(r.crossSession?.error ?? '', /helper 抛错/, 'error 说明 helper 抛错')
  assert.match(r.crossSession?.error ?? '', /PowerShell not found/, 'error 包含原始异常信息')
  assert.deepEqual(r.crossSession?.results, [], '抛错 ⇒ results=[]')
}

// 用例 ⑤:helper 输出非 JSON(无 [ 字符) ⇒ crossSession.error="helper 输出不含 JSON 数组"
{
  const run = () => 'PowerShell noise: WARNING blah blah no brackets here'
  const probe = () => [123]
  const r = closeProduct('fake-product', { waitMs: 100, pids: [123], probe, run })
  assert.equal(r.closed, false, 'helper 输出非 JSON ⇒ closed=false')
  assert.equal(r.crossSession?.attempted, true, 'crossSession.attempted=true')
  assert.match(
    r.crossSession?.error ?? '',
    /helper 输出不含 JSON 数组/,
    'error 提示输出不含 JSON 数组',
  )
  assert.deepEqual(r.crossSession?.results, [], '输出非 JSON ⇒ results=[]')
}

console.log('✓ closeProduct 第四腿单测通过:5 例(提前返回/成功/拒绝/抛错/非JSON)')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
