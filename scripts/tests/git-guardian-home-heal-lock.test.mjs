// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/git-guardian-home-heal-lock.test.mjs —— 家目录改道"单实例锁"的取证。
 *
 * 钉的是 2026-09-24 实测到的那个死循环:守护每 2 分钟一趟、每趟调修复器,而修复器被给的
 * 超时(240s)搬不完最大那项(371MB / 13973 文件)⇒ 被 SIGTERM 掐死,冷却文件只在正常结束时
 * 才写 ⇒ 下一轮从头再搬,门 96 连续判红 11 分钟、每一次提交都被逼成绕过 110 道守门。
 *
 * 判据住在 `scripts/lib/home-heal-lock.mjs` 而不是 `git-guardian.mjs`:后者没有 §22d 的
 * isDirectRun 守卫,`import` 它会把整轮巡检(含真搬目录)跑起来。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  HOME_HEAL_FIXER_TIMEOUT_MS,
  HOME_HEAL_TTL_MS,
  healLockDecision,
  healLockText,
  pidAlive,
} from '../lib/home-heal-lock.mjs'

const TTL = 31 * 60 * 1000
const NOW = 1_790_000_000_000
const alive = (pid) => pid === 111

test('活锁必须跳过:这是本轮真正要防的事(2 分钟节奏 × 25 分钟工作量必然重叠)', () => {
  assert.equal(healLockDecision(`111\n${NOW - 60000}\n`, NOW, TTL, alive), 'skip')
})

test('无锁就是无锁:null/undefined 判 free,不得与"内容坏"混成一类', () => {
  assert.equal(healLockDecision(null, NOW, TTL, alive), 'free')
  assert.equal(healLockDecision(undefined, NOW, TTL, alive), 'free')
})

test('三种情形都接管:坏内容 / 超 TTL / 持锁进程已死(锁绝不能把自愈永久冻住)', () => {
  for (const raw of ['', 'abc\n', '111\nnot-a-number\n', '\n\n']) {
    assert.equal(
      healLockDecision(raw, NOW, TTL, alive),
      'take',
      `异常内容 ${JSON.stringify(raw)} 必须接管`,
    )
  }
  assert.equal(
    healLockDecision(`111\n${NOW - TTL - 1}\n`, NOW, TTL, alive),
    'take',
    '超 TTL 即便进程还活着也要接管(否则一次卡死=永远不再修)',
  )
  assert.equal(
    healLockDecision(`999\n${NOW - 1000}\n`, NOW, TTL, alive),
    'take',
    '持锁进程已死必须接管(实测:守护被杀后锁会留下)',
  )
})

test('写读往返必须自洽:守护自己写的那份锁,自己的判据必须认(门让你怎么写,门就得能怎么读)', () => {
  // 这条不是装饰:判定按 `pid\n起始毫秒` 解析,而写入格式在调用方。两者一旦漂移,
  // 表现是"锁永远判 take"⇒ 单实例保护静默失效,而门照样每 2 分钟并发搬目录。
  const written = healLockText(111, NOW - 1000)
  assert.equal(healLockDecision(written, NOW, TTL, alive), 'skip')
  assert.equal(
    healLockDecision(written, NOW, TTL, () => false),
    'take',
  )
})

test('变异对照:判据不是"只要文件在就跳过"——新鲜度与存活缺一不可', () => {
  // 同一份锁内容,只改 TTL / 只改存活,结论必须相反 ⇒ 证明两个条件都真在参与判定
  const fresh = `111\n${NOW - 1000}\n`
  assert.equal(healLockDecision(fresh, NOW, TTL, alive), 'skip')
  assert.equal(healLockDecision(fresh, NOW, 500, alive), 'take')
  assert.equal(
    healLockDecision(fresh, NOW, TTL, () => false),
    'take',
  )
})

test('超时必须真放宽到搬得完,且 TTL > 修复器超时(否则锁在自己那轮里过期)', () => {
  assert.ok(
    HOME_HEAL_FIXER_TIMEOUT_MS >= 20 * 60 * 1000,
    `修复器超时 ${HOME_HEAL_FIXER_TIMEOUT_MS}ms 仍是那个搬不完 371MB 的量级`,
  )
  assert.ok(
    HOME_HEAL_TTL_MS > HOME_HEAL_FIXER_TIMEOUT_MS,
    'TTL 必须大于单轮工作量,否则一轮还没跑完锁就判过期被第二把接管',
  )
})

test('真 pid 探活:自己必然活着;不存在的 pid 与 NaN 都算死', () => {
  assert.equal(pidAlive(process.pid), true)
  assert.equal(pidAlive(4_000_000), false)
  assert.equal(pidAlive(Number.NaN), false)
  assert.equal(pidAlive(0), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
