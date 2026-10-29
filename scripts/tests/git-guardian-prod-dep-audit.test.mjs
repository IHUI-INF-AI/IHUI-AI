// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 生产依赖审计腿(尺子 = check-prod-dep-advisories.mjs)的接线锁(2026-10-29 立,§22c 直接 import 源模块)。
//
// 立因:守门 260 只在提交链/全量档判,而**上游发新 CVE 不会触发提交** —— 没有常驻派发点,
// 新 CVE 要等下一个人恰好提交且恰好跑全量档才会被发现,等于没守。本文件钉住五件事:
//   ① red ⇒ 必发信一次,severity=critical,身份按「条数档 + 前三个模块 + 持续档」折叠
//      (具体 advisory 标题会随上游更新位移,写进身份就是邮件风暴);
//   ② warn(豁免临期)⇒ 发信但 severity=warning —— 到期本身不是错,「到期没人知道」才是;
//   ③ unjudged ⇒ **不发信**(§0.3):网络抖动不是缺陷,喊了就是狼来了;
//   ④ 结论不可解析 ⇒ 判未判定,既不发信也不记账(把「脚本崩了」当「判过了」是最贵的假绿);
//   ⑤ 节流窗口内第二次调用直接让路(尺子 6h 一趟,不能每 2 分钟 spawn 一次)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { auditProdDepAdvisories } from '../git-guardian.mjs'

function scratchPaths() {
  const dir = mkScratch('prod-dep-leg-')
  return {
    dir,
    tickFile: join(dir, 'tick.ts'),
    firstFile: join(dir, 'first.json'),
    lastFile: join(dir, 'last.json'),
    // 宿主 safe-delete 守卫会拦批量删除 ⇒ 清理失败只留一个 gitignored 空目录,
    // 不得让"环境拦删"冒充"用例失败"。
    clean: () => {
      try {
        rmScratch(dir)
      } catch {
        /* 残留临时目录无害 */
      }
    },
  }
}

/** 造一个 runner:返回固定 stdout/status,不真的 spawn 子进程。 */
const runnerOf = (payload, status = 0) => () => ({
  status,
  stdout: typeof payload === 'string' ? payload : JSON.stringify(payload),
  stderr: '',
})

const redPayload = {
  verdict: 'red',
  red: [
    { module: 'alpha', severity: 'critical', kind: 'unwaived', patched: '>=2.0.0', title: 't1' },
    { module: 'beta', severity: 'high', kind: 'expired-waiver', patched: '', title: 't2' },
  ],
  waived: [],
  devOnlyTotal: 3,
}

const warnPayload = {
  verdict: 'warn',
  red: [],
  waived: [{ module: 'gamma', expiresAt: '2026-11-18', reason: 'x' }],
  expiringSoon: [{ module: 'gamma', expiresAt: '2026-11-18', daysLeft: 19 }],
  devOnlyTotal: 0,
}

const cleanPayload = {
  verdict: 'clean',
  red: [],
  waived: [{ module: 'delta', expiresAt: '2027-01-31', reason: 'y' }],
  expiringSoon: [],
  devOnlyTotal: 23,
}

test('red: 发信一次,severity=critical,身份按条数+模块折叠', () => {
  const p = scratchPaths()
  const mails = []
  try {
    const r = auditProdDepAdvisories({
      now: 1_700_000_000_000,
      intervalMs: 0,
      tickFile: p.tickFile,
      firstFile: p.firstFile,
      lastFile: p.lastFile,
      logger: () => {},
      notify: (name, detail, opts) => mails.push({ name, detail, opts }),
      runner: runnerOf(redPayload),
    })
    assert.equal(r.ran, true)
    assert.equal(r.judged, true)
    assert.equal(r.breaches, 2)
    assert.equal(mails.length, 1, 'red 必须发信且只发一次')
    assert.equal(mails[0].opts.severity, 'critical')
    assert.match(mails[0].name, /2 条/)
    // 身份里必须是模块名,不能是标题(标题随上游更新位移 ⇒ 每轮新身份 ⇒ 邮件风暴)
    assert.match(mails[0].opts.dedupKey, /mods=alpha,beta/)
    assert.doesNotMatch(mails[0].opts.dedupKey, /t1|t2/)
    // 正文必须给出两条出路,不能只说"有问题"
    assert.match(mails[0].detail, /升级到修复版/)
    assert.match(mails[0].detail, /dep-audit-policy\.json/)
  } finally {
    p.clean()
  }
})

test('warn(豁免临期): 发信但 severity=warning,不判 breach', () => {
  const p = scratchPaths()
  const mails = []
  try {
    const r = auditProdDepAdvisories({
      now: 1_700_000_000_000,
      intervalMs: 0,
      tickFile: p.tickFile,
      firstFile: p.firstFile,
      lastFile: p.lastFile,
      logger: () => {},
      notify: (name, detail, opts) => mails.push({ name, detail, opts }),
      runner: runnerOf(warnPayload),
    })
    assert.equal(r.breaches, 0, '临期不是 breach')
    assert.equal(mails.length, 1)
    assert.equal(mails[0].opts.severity, 'warning')
    assert.match(mails[0].name, /gamma/)
    assert.match(mails[0].detail, /19 天/)
  } finally {
    p.clean()
  }
})

test('unjudged: 不发信(网络抖动不是缺陷)', () => {
  const p = scratchPaths()
  const mails = []
  try {
    const r = auditProdDepAdvisories({
      now: 1_700_000_000_000,
      intervalMs: 0,
      tickFile: p.tickFile,
      firstFile: p.firstFile,
      lastFile: p.lastFile,
      logger: () => {},
      notify: (...a) => mails.push(a),
      runner: runnerOf({ verdict: 'unjudged', why: '快照缺失且刷新失败' }),
    })
    assert.equal(r.judged, false)
    assert.equal(mails.length, 0, '未判定不得发信')
  } finally {
    p.clean()
  }
})

test('结论不可解析: 判未判定,不发信(不能把「脚本崩了」当「判过了」)', () => {
  const p = scratchPaths()
  const mails = []
  try {
    const r = auditProdDepAdvisories({
      now: 1_700_000_000_000,
      intervalMs: 0,
      tickFile: p.tickFile,
      firstFile: p.firstFile,
      lastFile: p.lastFile,
      logger: () => {},
      notify: (...a) => mails.push(a),
      runner: runnerOf('这不是 JSON', 1),
    })
    assert.equal(r.ran, true)
    assert.equal(r.judged, false)
    assert.equal(r.why, '结论不可解析')
    assert.equal(mails.length, 0)
  } finally {
    p.clean()
  }
})

test('clean: 不发信,并把最后结论落到状态件', () => {
  const p = scratchPaths()
  const mails = []
  try {
    const r = auditProdDepAdvisories({
      now: 1_700_000_000_000,
      intervalMs: 0,
      tickFile: p.tickFile,
      firstFile: p.firstFile,
      lastFile: p.lastFile,
      logger: () => {},
      notify: (...a) => mails.push(a),
      runner: runnerOf(cleanPayload),
    })
    assert.equal(r.breaches, 0)
    assert.equal(mails.length, 0, 'clean 不得发信')
    const saved = JSON.parse(readFileSync(p.lastFile, 'utf8'))
    assert.equal(saved.verdict, 'clean')
  } finally {
    p.clean()
  }
})

test('节流:窗口内第二次调用直接让路,不 spawn 第二次', () => {
  const p = scratchPaths()
  let calls = 0
  try {
    const run = () => {
      calls += 1
      return auditProdDepAdvisories({
        now: 1_700_000_000_000,
        intervalMs: 6 * 60 * 60 * 1000,
        tickFile: p.tickFile,
        firstFile: p.firstFile,
        lastFile: p.lastFile,
        logger: () => {},
        notify: () => {},
        runner: runnerOf(cleanPayload),
      })
    }
    const first = run()
    assert.equal(first.ran, true)
    assert.equal(calls, 1)
    // 同一时刻再来一次:节流命中,runner 不该被再调一次
    const second = auditProdDepAdvisories({
      now: 1_700_000_000_000 + 1000,
      intervalMs: 6 * 60 * 60 * 1000,
      tickFile: p.tickFile,
      firstFile: p.firstFile,
      lastFile: p.lastFile,
      logger: () => {},
      notify: () => {},
      runner: () => {
        calls += 1
        return runnerOf(cleanPayload)()
      },
    })
    assert.equal(second.ran, false)
    assert.equal(second.why, '未到节流窗口')
    assert.equal(calls, 1, '窗口内不得再跑一次')
  } finally {
    p.clean()
  }
})
