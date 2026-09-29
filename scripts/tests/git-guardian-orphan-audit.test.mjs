// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守护「孤儿删除引用巡检」派发点镜像测试(§22c:import 源模块 __test__,零复制实现)。
//
// 立因:尺子 `scripts/check-orphan-deletion-refs.mjs` 判的是"HEAD 有该路径 / 索引与磁盘都没有 /
// 源码仍 import 它"这一型 —— 它按设计**不能**进提交链(与提交内容无关的 blocking 红 = 每台每次被逼
// --no-verify),而"手动问责入口"的实际含义是**只有人在跑、没有班次在跑**。2026-09-29 现读它五个
// 权威接线点零命中,而同一型缺陷当晚两次炸构建。本测试钉的是接上之后的三件事:
//   (a) 装车证明:派发调用挂在**真正会执行**的分支(`!CHECK_ONLY`),挂错分支等于永不执行(本仓记过两次);
//   (b) 节流是节奏不是封量:未到窗口**绝不派生**(不得每 2 分钟打一遍 git);
//   (c) 三态不得并桶:命中 ⇒ 喊人且身份是常量(不带计数,§5e 的去重纪律)/ 未判定 ⇒ 只写日志不喊人 /
//       零命中 ⇒ 两者都不发生而日志必须报名 —— 把"没判"写成"判过了"是本仓最高频失效型。
// 全部用构造输入 + 假 runner + 假 notify 取证 ⇒ 零真派生、零真邮件、零生产端口、零活仓库副作用。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G } from '../git-guardian.mjs'

const NOW = 1_700_000_000_000
const MIN = 60_000
/** 告警身份的常量名 —— 变更它等于换了一把去重键,必须被本测试点名 */
const ALERT_NAME = '孤儿删除引用巡检命中'

function harness(call, intervalMs = 30 * MIN) {
  const logs = []
  const mails = []
  return {
    logs,
    mails,
    run(tickFile) {
      return G.auditOrphanDeletionRefs({
        now: NOW,
        intervalMs,
        tickFile,
        logger: (m) => logs.push(String(m)),
        notify: (title, desp, extra) => mails.push({ title, desp, extra }),
        runner: () => call,
      })
    },
  }
}

test('(a)装车证明:!CHECK_ONLY 分支真的调用 auditOrphanDeletionRefs', () => {
  const rel = 'scripts/git-guardian.mjs'
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  let src = ''
  try {
    src = execFileSync('git', ['show', `HEAD:${rel}`], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 32 << 20,
    })
  } catch {
    /* 问不到走工作树(新建文件尚未入库时本例仍要有牙) */
  }
  if (!src.includes('auditOrphanDeletionRefs')) src = readFileSync(join(repoRoot, rel), 'utf8')
  assert.ok(src.includes('auditOrphanDeletionRefs'), '派发函数根本不在守护里')
  const hook = src.match(/^\s*if \(!CHECK_ONLY\) auditOrphanDeletionRefs\(\)$/m)
  assert.ok(hook, '挂点必须是 `if (!CHECK_ONLY) auditOrphanDeletionRefs()` —— 挂进 CHECK_ONLY 早退分支等于永不执行')
  // 挂点必须在健康轮次那一串里(与 auditPublicPathProbe 同一段),而不是散落在异常恢复路径
  const probeIdx = src.indexOf('if (!CHECK_ONLY) auditPublicPathProbe()')
  const mineIdx = src.indexOf(hook[0])
  assert.ok(probeIdx > -1 && mineIdx > probeIdx, '挂点应与其余 !CHECK_ONLY 巡检同段(顺序:公网探测之后)')
  assert.ok(/export const __test__ = \{[\s\S]*?auditOrphanDeletionRefs,/.test(src), '派发点必须经 __test__ 暴露给镜像测试')
})

test('(b)节流:未到窗口绝不派生,取不到 tick 视为该跑', () => {
  assert.equal(G.orphanAuditDue(NOW, NaN), true, '没跑过 ⇒ 该跑')
  assert.equal(G.orphanAuditDue(NOW, NOW - 1000), false, '1 秒前刚跑过 ⇒ 不该派生')
  assert.equal(G.orphanAuditDue(NOW, NOW - 30 * MIN), true, '恰好一个窗口 ⇒ 该跑(边界取 >=)')
  const h = harness({ status: 0, stdout: '{"hits":[],"undetermined":[],"deleted":0,"candidates":0}' })
  const scratch = mkScratch('orphan-throttle')
  try {
    const tickFile = join(scratch, 'tick.ts')
    writeTick(tickFile, NOW - 5 * MIN)
    const r = h.run(tickFile)
    assert.equal(r.ran, false, '未到窗口不得派生')
    assert.equal(h.logs.join(''), '', '未到窗口也不得写噪音日志')
    assert.equal(h.mails.length, 0)
  } finally {
    rmScratch(scratch)
  }
})

test('(c1)命中 ⇒ 喊人,身份是常量且不带计数', () => {
  const hits = Array.from({ length: 14 }, (_, i) => ({ path: `src/m${i}.ts`, via: `src/keep.ts:${i}` }))
  const h = harness({
    status: 0,
    stdout: JSON.stringify({ hits, undetermined: [], deleted: 14, candidates: 20 }),
  })
  const scratch = mkScratch('orphan-hits')
  try {
    const r = h.run(join(scratch, 'tick.ts'))
    assert.deepEqual(r, { ran: true, judged: true, hits: 14, undetermined: 0 })
    assert.equal(h.mails.length, 1, '命中必须派发一封')
    assert.equal(h.mails[0].title, ALERT_NAME, '告警身份必须逐字为常量(嵌进计数 = 每轮换身份 = 去重永不命中)')
    assert.doesNotMatch(h.mails[0].title, /\d/, '身份里不得出现数字')
    assert.ok(h.mails[0].desp.includes('src/m0.ts'), '正文必须点名被引用的路径')
    assert.ok(h.mails[0].desp.includes('另有 2 条'), '超 12 条必须报剩余条数,不得静默截断')
    assert.ok(h.logs.join('\n').includes('已派发到邮件通道'), '日志必须报名,不得静默')
  } finally {
    rmScratch(scratch)
  }
})

test('(c2)未判定 ⇒ 只写日志、绝不喊人,且不得记为已巡检', () => {
  const scratch = mkScratch('orphan-undet')
  try {
    const a = harness({ status: 2, stdout: '', stderr: 'fatal: not a git repository' })
    const ra = a.run(join(scratch, 'a.ts'))
    assert.equal(ra.judged, false, 'rc=2 必须落未判定')
    assert.equal(a.mails.length, 0, '没量到不等于出事,发信是把噪音冒充告警')
    assert.ok(a.logs.join('\n').includes('未判定'), '日志必须写"未判定"')

    const b = harness({ status: 0, stdout: 'not json at all' })
    const rb = b.run(join(scratch, 'b.ts'))
    assert.equal(rb.judged, false)
    assert.equal(b.mails.length, 0)
    assert.ok(b.logs.join('\n').includes('不得把"没解析出"写成"没有命中"'), '解析失败必须喊出口诀')

    const c = harness({
      status: 0,
      stdout: JSON.stringify({ hits: [], undetermined: ['git grep 派生失败:timeout'], deleted: 0, candidates: 0 }),
    })
    const rc = c.run(join(scratch, 'c.ts'))
    assert.deepEqual(rc, { ran: true, judged: true, hits: 0, undetermined: 1 })
    assert.equal(c.mails.length, 0)
    assert.ok(c.logs.join('\n').includes('未判定'), '零命中但有未判定点 ⇒ 日志必须点名未判定条数')
  } finally {
    rmScratch(scratch)
  }
})

test('(c3)已判定且零命中 ⇒ 不喊人而日志必须报"已判定"', () => {
  const h = harness({ status: 0, stdout: '{"hits":[],"undetermined":[],"deleted":0,"candidates":3}' })
  const scratch = mkScratch('orphan-clean')
  try {
    const r = h.run(join(scratch, 'tick.ts'))
    assert.deepEqual(r, { ran: true, judged: true, hits: 0, undetermined: 0 })
    assert.equal(h.mails.length, 0)
    assert.ok(h.logs.join('\n').includes('已判定且零命中'), '"没问题"必须由量出来的结论说出,不是由沉默暗示')
  } finally {
    rmScratch(scratch)
  }
})

test('(c4)节流戳落盘:跑过之后同一窗口内第二次必须不派生', () => {
  const scratch = mkScratch('orphan-tick')
  try {
    const tickFile = join(scratch, 'tick.ts')
    const call = { status: 0, stdout: '{"hits":[],"undetermined":[],"deleted":0,"candidates":0}' }
    const h = harness(call)
    assert.equal(h.run(tickFile).ran, true, '首趟该跑')
    assert.ok(existsSync(tickFile), '跑过就必须写节流戳(否则每 2 分钟重打一遍 git)')
    assert.equal(Date.parse(readFileSync(tickFile, 'utf8').trim()), NOW, '戳必须落在本次 now,不是实现里另取一次时间')

    const h2 = harness(call)
    assert.equal(h2.run(tickFile).ran, false, '同一窗口内第二趟必须不派生')
    assert.equal(h2.mails.length, 0)

    // 把戳推到窗口之外 ⇒ 必须恢复派生(证明节流是**节奏**不是**封量**,§5e 禁止自设总量上限)
    writeTick(tickFile, NOW - 31 * MIN)
    const h3 = harness(call)
    assert.equal(h3.run(tickFile).ran, true, '过窗必须重新派生')
  } finally {
    rmScratch(scratch)
  }
})

function writeTick(file, ms) {
  writeFileSync(file, new Date(ms).toISOString(), 'utf8')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
