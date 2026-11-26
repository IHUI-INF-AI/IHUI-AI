// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 扫描缓存三态：成功即刷新；窗口收起回上次成功快照并标 stale；其它失败如实失败；快照可落盘重读。
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { applyScanResult, loadSnapshot, saveSnapshot } from '../friends-scan-cache.mjs'

const FILE = process.env.BRIDGE_TEST_SNAPSHOT_FILE ?? '.bridge-test-friends-scan.json'
await rm(FILE, { force: true })

const good = { ok: true, status: 'ok', requests: [{ requestId: 'a', nickname: '张三' }], rawCount: 27, entered: true }
const cache = { at: 1000, body: good }
const hidden = { ok: false, status: 'failed', reason: 'window-hidden-or-empty', rawCount: 0, entered: false, window: { visible: false } }

// 成功即刷新缓存。
const r1 = applyScanResult({ ok: true, status: 'ok', requests: [], rawCount: 3 }, cache, 5000)
assert.equal(r1.cache.at, 5000)
assert.equal(r1.body.requests.length, 0)

// 窗口收起：回快照、标 stale、带上年龄，不谎报失败。
const r2 = applyScanResult(hidden, cache, 90000)
assert.equal(r2.body.ok, true)
assert.equal(r2.body.stale, true)
assert.equal(r2.body.staleReason, 'window-hidden')
assert.equal(r2.body.cacheAgeMs, 89000)
assert.equal(r2.body.requests[0].nickname, '张三')

// 窗口可见却失败（脚本/控件问题）：保持失败，不能拿旧数据冒充成功。
const r3 = applyScanResult({ ok: false, reason: 'button-not-found', window: { visible: true } }, cache, 90000)
assert.equal(r3.body.ok, false)
assert.equal(r3.body.stale, undefined)

// 没有历史快照：窗口收起也只能如实失败。
const r4 = applyScanResult(hidden, null, 90000)
assert.equal(r4.body.ok, false)

// 落盘 → 重读；坏文件当作没有。
saveSnapshot(FILE, cache)
const loaded = loadSnapshot(FILE)
assert.equal(loaded.body.requests[0].requestId, 'a')
await rm(FILE, { force: true })
assert.equal(loadSnapshot(FILE), null)

console.log('[friends-scan-cache] 成功刷新/窗口收起回快照/可见失败不冒充/无快照如实失败/落盘重读 5 组通过')
