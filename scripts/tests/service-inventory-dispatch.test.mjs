// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 服务清单派发接线锁(2026-11-03 立)。
 *
 * 钉三件事,缺一即红:
 *  ① 只有 drift 才发信,dedupKey 稳定为 `service-inventory;drift=N`(不掺明细/时刻,§5e-3);
 *  ② unjudged / 取数失败 / 结论不可解析 ⇒ 只写日志、不发信,且不记绿(§0.3);
 *  ③ 读数 ok、或只有 FACE-RED(exit 1 但 drift=0)⇒ 同样不发信 —— 后者是上线当天的真实读数,
 *     漏了这条就会立刻把"仓里缺建服源"的旧债变成邮件轰炸。
 *
 * 另锁接线面:函数必须同时挂在 main() 单轮链与 daemon tick 链(§0.9 造好没装车 = 没有),
 * 且派发 argv 只能是 `--json`,绝不允许 `--snapshot`(那会写盘重建而不是比对)。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { auditDispatchSites, auditServiceInventory } from '../git-guardian.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const GUARDIAN_SRC = path.join(ROOT, 'scripts', 'git-guardian.mjs')
const TMP = path.join(ROOT, '.ihui-agent', 'tmp', 'service-inventory-dispatch')

let seq = 0
const RUN = Date.now()

/** 每例独立 tick/last 文件:共用会被节律窗拦住,把"没发信"与"压根没派生"读成同一件事。 */
function run(stdout, extra = {}) {
  seq += 1
  const mails = []
  const logs = []
  const res = auditServiceInventory({
    now: Date.parse('2026-11-03T05:00:00.000Z') + seq,
    tickFile: path.join(TMP, `tick-${RUN}-${seq}.ts`),
    lastFile: path.join(TMP, `last-${RUN}-${seq}.json`),
    logger: (m) => logs.push(String(m)),
    notify: (title, body, opts) => mails.push({ title, body, opts }),
    runner: () => ({ status: 0, stdout, stderr: '' }),
    ...extra,
  })
  return { res, mails, logs }
}

const out = (json, line) => `${JSON.stringify(json, null, 2)}\n${line}\n`

const driftJson = {
  ok: 1,
  drift: 2,
  unjudged: 0,
  verdicts: [
    { name: 'IHUI-WEB-ROUTER', status: 'drift', fields: [{ key: 'nssmManaged' }, { key: 'imagePath' }] },
    { name: 'IHUI-API', status: 'drift', fields: [{ key: 'displayName' }] },
  ],
  unjudgedReasons: [],
}
const driftOut = out(driftJson, 'OK=1 DRIFT=2 FACE-RED=0 UNJUDGED=0')
// 同 drift 计数、不同明细/顺序:身份必须仍稳定,否则明细抖动就会绕过去重窗口。
const driftOutB = out(
  { ...driftJson, verdicts: [...driftJson.verdicts].reverse() },
  'OK=1 DRIFT=2 FACE-RED=0 UNJUDGED=0',
)

test('①a drift ⇒ 发信,dedupKey=service-inventory;drift=N,信体点名漂移服务', () => {
  const r = run(driftOut, { runner: () => ({ status: 1, stdout: driftOut, stderr: '' }) })
  assert.equal(r.res.ran, true)
  assert.equal(r.res.judged, true)
  assert.equal(r.res.drift, 2)
  assert.equal(r.mails.length, 1)
  assert.equal(r.mails[0].opts.dedupKey, 'service-inventory;drift=2')
  assert.match(r.mails[0].title, /服务清单/)
  assert.match(r.mails[0].body, /IHUI-WEB-ROUTER/)
})

test('①b 明细顺序变化 ⇒ dedupKey 仍稳定(不把抖动绕成新故障)', () => {
  const a = run(driftOut, { runner: () => ({ status: 1, stdout: driftOut, stderr: '' }) })
  const b = run(driftOutB, { runner: () => ({ status: 1, stdout: driftOutB, stderr: '' }) })
  assert.equal(a.mails[0].opts.dedupKey, b.mails[0].opts.dedupKey)
})

test('②a unjudged ⇒ 只写日志不发信,且不记绿', () => {
  const r = run(out({ ok: 0, drift: 0, unjudged: 2, verdicts: [], unjudgedReasons: [] }, 'OK=0 DRIFT=0 FACE-RED=0 UNJUDGED=2'), {
    runner: () => ({ status: 2, stdout: out({ ok: 0, drift: 0, unjudged: 2, verdicts: [], unjudgedReasons: [] }, 'OK=0 DRIFT=0 FACE-RED=0 UNJUDGED=2'), stderr: '' }),
  })
  assert.equal(r.res.ran, true)
  assert.equal(r.res.judged, false)
  assert.equal(r.mails.length, 0)
  assert.match(r.logs.join('\n'), /未判定/)
})

test('②b 取数失败/结论不可解析 ⇒ 只写日志不发信', () => {
  const r = run('boom', { runner: () => ({ status: 2, stdout: 'boom', stderr: 'pwsh 枚举失败' }) })
  assert.equal(r.res.ran, true)
  assert.equal(r.res.judged, false)
  assert.equal(r.mails.length, 0)
  assert.match(r.logs.join('\n'), /未产出结论/)
})

test('②c 派生自身抛异常 ⇒ ran:false,不发信', () => {
  const r = run('', { runner: () => { throw new Error('spawn blew up') } })
  assert.equal(r.res.ran, false)
  assert.equal(r.mails.length, 0)
})

test('③a 读数 ok ⇒ 不发信', () => {
  const body = out({ ok: 28, drift: 0, unjudged: 0, verdicts: [], unjudgedReasons: [] }, 'OK=28 DRIFT=0 FACE-RED=0 UNJUDGED=0')
  const r = run(body, { runner: () => ({ status: 0, stdout: body, stderr: '' }) })
  assert.equal(r.res.judged, true)
  assert.equal(r.res.drift, 0)
  assert.equal(r.mails.length, 0)
})

test('③b 只有 FACE-RED(exit 1 但 drift=0)⇒ 不发信(上线当天真实读数)', () => {
  const body = out({ ok: 28, drift: 0, unjudged: 0, verdicts: [], unjudgedReasons: [] }, 'OK=28 DRIFT=0 FACE-RED=3 UNJUDGED=0')
  const r = run(body, { runner: () => ({ status: 1, stdout: body, stderr: '' }) })
  assert.equal(r.res.judged, true)
  assert.equal(r.res.drift, 0)
  assert.equal(r.mails.length, 0)
  assert.match(r.logs.join('\n'), /FACE-RED/)
})

test('④ 接线面:main() + daemon tick 均挂载,派发 argv 只允许 --json', () => {
  const src = readFileSync(GUARDIAN_SRC, 'utf8')
  assert.match(src, /export function auditServiceInventory/)
  assert.match(src, /if \(!CHECK_ONLY\) auditServiceInventory\(\)/)
  const tickCall = /\n\s{8}auditServiceInventory\(\)/
  assert.match(src, tickCall, 'daemon tick 链缺少 auditServiceInventory() 派发')
  assert.match(src, /\n\s{2}auditServiceInventory,/, '导出台账未登记 auditServiceInventory')
  const fnStart = src.indexOf('export function auditServiceInventory')
  const fnBody = src.slice(fnStart, src.indexOf('\nexport ', fnStart))
  assert.match(fnBody, /execFileSync\(process\.execPath, \[script, '--json'\]/)
  assert.ok(!/\[script, '--snapshot'\]/.test(fnBody), '派发 argv 不得带 --snapshot')
  const site = auditDispatchSites(src).find((s) => s.name.includes('服务清单快照与注册表漂移'))
  assert.ok(site, 'notify 调用点未被 auditDispatchSites 识别')
  assert.equal(site.hasDedupKey, true, '派发点必须带 dedupKey,否则退回按内容指纹去重')
})
