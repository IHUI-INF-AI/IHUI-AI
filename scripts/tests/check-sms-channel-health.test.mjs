// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 短信通道健康哨兵的镜像测试(§22c:判据只 import 源脚本 __test__,不在这里复抄)。
 *
 * 立因:2026-10-27 阿里云短信欠费静默停机一整天(11:41 投递仍 OUT_OF_SERVICE,12:59 才恢复),
 * 用户拿不到登录验证码,而全仓没有一道门喊过 —— 投递审计表 sms_delivery_logs 里明明写着
 * 失败原因,却只有 admin 报表在读。本文件钉两件事:
 *   ① 判据本身(三态 + suppressed 不算通道故障 + 窗口外样本不参与);
 *   ② 派发行为(breach 才发信、身份按档折叠不抖、未判定不喊人、节流生效、**不接进提交链**)。
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as S } from '../check-sms-channel-health.mjs'
import { auditSmsChannelHealth } from '../git-guardian.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRATCH = join(ROOT, '.ihui-agent', 'tmp', 'sms-channel-health-test')
const NOW = new Date('2026-10-27T05:00:00Z').getTime()
const at = (minAgo) => new Date(NOW - minAgo * 60_000).toISOString()

describe('判据:judgeSmsChannelHealth(与脚本自检同一份实现)', () => {
  it('停机族:1h 内全失败且命中 OUT_OF_SERVICE ⇒ breach(用生产日志里的真 reason 原文)', () => {
    const r = S.judgeSmsChannelHealth({
      rows: [
        { status: 'failed', reason: 'isv.OUT_OF_SERVICE', createdAt: at(9) },
        { status: 'failed', reason: 'isv.OUT_OF_SERVICE', createdAt: at(11) },
      ],
      now: new Date(NOW),
    })
    assert.equal(r.verdict, 'breach')
    assert.ok(r.detail.includes('OUT_OF_SERVICE'))
  })

  it('suppressed 是业务主动不发 ⇒ 不计尝试,零尝试只能判未判定(不许冒绿也不许冒红)', () => {
    const r = S.judgeSmsChannelHealth({
      rows: [
        { status: 'suppressed', reason: 'duplicate', createdAt: at(2) },
        { status: 'suppressed', reason: 'marketing_disabled', createdAt: at(3) },
      ],
      now: new Date(NOW),
    })
    assert.equal(r.verdict, 'unjudged')
    assert.equal(r.attempts, 0)
  })

  it('24h 内有过成功 ⇒ ok(单次抖动不得报成通道死亡)', () => {
    const r = S.judgeSmsChannelHealth({
      rows: [
        { status: 'failed', reason: 'isv.BUSINESS_LIMIT_CONTROL', createdAt: at(4) },
        { status: 'accepted', reason: null, createdAt: at(700) },
      ],
      now: new Date(NOW),
    })
    assert.equal(r.verdict, 'ok')
  })

  it('窗口外的样本不参与(25 小时前的失败不能当作今天的读数)', () => {
    const r = S.judgeSmsChannelHealth({
      rows: [{ status: 'failed', reason: 'isv.OUT_OF_SERVICE', createdAt: at(25 * 60) }],
      now: new Date(NOW),
    })
    assert.equal(r.verdict, 'unjudged')
  })
})

function scratchPaths(tag) {
  const dir = join(SCRATCH, tag)
  return {
    tickFile: join(dir, 'tick.ts'),
    firstFile: join(dir, 'first.json'),
    lastFile: join(dir, 'last.json'),
  }
}

/** 注入式 runner:返回与尺子 --json 同形的结论,不派生真进程。 */
function mkRunner(verdict, rc = 0) {
  const fn = () => ({
    status: rc,
    stdout: JSON.stringify({
      verdict,
      detail: verdict === 'breach' ? '近 24h 尝试 6 次、零成功' : '近 24h 尝试 6 次,成功 1 次',
      attempts: 6,
      success: verdict === 'ok' ? 1 : 0,
      lastHourAttempts: verdict === 'breach' ? 2 : 0,
    }),
    stderr: '',
  })
  fn.calls = 0
  return fn
}

describe('派发:auditSmsChannelHealth(注入 runner,不派生真进程)', () => {
  before(() => {
    mkdirSync(SCRATCH, { recursive: true })
  })
  after(() => {
    rmSync(SCRATCH, { recursive: true, force: true })
  })

  it('breach ⇒ 必须发信,身份按"档"折叠(不含明细/时间戳,守门 224 同训)', () => {
    const p = scratchPaths('breach')
    const calls = []
    const notify = (...args) => calls.push(args)
    const r = auditSmsChannelHealth({
      ...p,
      now: NOW,
      logger: () => {},
      notify,
      runner: mkRunner('breach', 1),
    })
    assert.equal(r.breaches, 1)
    assert.equal(calls.length, 1)
    const [, body, opts] = calls[0]
    assert.ok(String(body).includes('充值'), '正文必须写清收信人能做什么(§5e-1)')
    assert.ok(String(opts.dedupKey).includes('verdict=breach'))
    assert.match(String(opts.dedupKey), /held=/)
    assert.ok(existsSync(p.lastFile), '状态件必须落盘供 --status 现读')
  })

  it('ok ⇒ 不发信;unjudged ⇒ 不发信;不可解析 ⇒ 不发信且不记已探测', () => {
    const n1 = []
    auditSmsChannelHealth({
      ...scratchPaths('ok'),
      now: NOW,
      logger: () => {},
      notify: (...a) => n1.push(a),
      runner: mkRunner('ok'),
    })
    assert.equal(n1.length, 0)

    const n2 = []
    auditSmsChannelHealth({
      ...scratchPaths('unjudged'),
      now: NOW,
      logger: () => {},
      notify: (...a) => n2.push(a),
      runner: mkRunner('unjudged', 2),
    })
    assert.equal(n2.length, 0, '取不到样本不等于通道坏了,不许喊人')

    const n3 = []
    const r3 = auditSmsChannelHealth({
      ...scratchPaths('bad'),
      now: NOW,
      logger: () => {},
      notify: (...a) => n3.push(a),
      runner: () => ({ status: 1, stdout: 'not-json', stderr: 'boom' }),
    })
    assert.equal(n3.length, 0)
    assert.equal(r3.judged, false)
  })

  it('节流:同一窗口内第二次派发必须跳过(不许每轮都跑)', () => {
    const p = scratchPaths('throttle')
    const notify = () => {}
    const run = () =>
      auditSmsChannelHealth({ ...p, now: NOW, logger: () => {}, notify, runner: mkRunner('ok') })
    assert.equal(run().ran, true)
    const second = run()
    assert.equal(second.ran, false)
    assert.ok(String(second.why).includes('节流'))
  })
})

describe('接线:装车与不越线', () => {
  const guardSrc = readFileSync(join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')

  it('守护 tick 里必须真调 auditSmsChannelHealth(造好没装车 = 没有,§0.9)', () => {
    assert.match(guardSrc, /if \(!CHECK_ONLY\) auditSmsChannelHealth\(\)/)
  })

  it('不许接进提交链(判机器状态的门挂成提交门 = 与提交内容无关的恒红门,§12e)', () => {
    const runner = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
    assert.equal(runner.includes('check-sms-channel-health'), false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
