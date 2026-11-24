// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回灌腿节拍常量与失败身份判据的锁(2026-11-05 立)。
 *
 * 钉三件事:
 *  1. 三腿 + worker 外层**只有一份数值源**:编排器与 ts 侧的值必须与 lib 常量逐字相等,
 *     且源码里不得再残留当年随手定的 120_000(它没有定值依据,量自 0efd05ef9ee4)。
 *  2. 「超时」必须压过 stderr:旧形态 `stderr || 退出码/信号` 会让 ts 脚本常态打的 db 噪音
 *     把超时身份顶掉,于是"本方等死它"与"它自己崩了"混成同一个读数(§0.3)。
 *  3. 反向对照:**别人**发的 SIGTERM 不得被写成"我方窗口到点" —— 那是另一件事的修法
 *     (查谁杀的),把它报成超时会误导去调窗口。
 *
 * 判据一律 import 生产端(__test__ 与源文件文本),测试内零复制规则(§22c)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import {
  CAPTURE_TIMEOUT_MS,
  DB_WRITE_TIMEOUT_MS,
  WORKER_OUTER_TIMEOUT_MS,
  stageFailureText,
  isUndeterminedOutcome,
} from '../lib/sync-stage-timeouts.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

test('① 窗口取值来自生产实测锚,且两段之和必须真的小于 worker 外层(否则外层先杀父留孤儿)', () => {
  assert.ok(CAPTURE_TIMEOUT_MS >= 107_000 * 2, '捕获段下限 = 已完成的单段最慢 107s × 2')
  assert.equal(
    DB_WRITE_TIMEOUT_MS,
    CAPTURE_TIMEOUT_MS,
    '落库段与捕获段对称取同档(生产右删失,不另造数)',
  )
  assert.ok(
    WORKER_OUTER_TIMEOUT_MS >= CAPTURE_TIMEOUT_MS + DB_WRITE_TIMEOUT_MS,
    '外层 < 两段之和 = 外层先动手,Windows 上不杀孙',
  )
  assert.ok(WORKER_OUTER_TIMEOUT_MS < 600_000, '外层必须小于每 10 分钟节拍,不让一轮跨拍')
})

test('② 同值单源:六条腿与 worker 外层的数值必须与 lib 常量逐字相等', () => {
  const legs = [
    'scripts/sync-qoder-client-session.mjs',
    'scripts/sync-trae-client-session.mjs',
    'scripts/sync-minimax-client-session.mjs',
    // 2026-11-12 接车的三条同型腿(loomy/zcode/raccoon)
    'scripts/sync-loomy-client-session.mjs',
    'scripts/sync-zcode-client-session.mjs',
    'scripts/sync-raccoon-client-session.mjs',
  ]
  for (const p of legs) {
    const src = read(p)
    assert.ok(src.includes("from './lib/sync-stage-timeouts.mjs'"), `${p} 未接单源常量`)
    // 只认**旧代码形态**(两种:spawnSync 的 timeout 位、setTimeout 的第二参),
    // 不查任意文本 —— 否则注释里解释历史的 "120_000" 会把好代码判红(本测试第一版就这么假阳过)。
    for (const dead of ['timeout: 120_000', 'child.kill(), 120_000']) {
      assert.ok(!src.includes(dead), `${p} 仍残留随手定的旧窗口写法:${dead}`)
    }
  }
  const worker = read('apps/api/src/workers/relay-account-pool-worker.ts')
  const m = worker.match(/timeout:\s*([0-9_]+),/)
  assert.ok(m, 'worker 外层 timeout 数值取不到 ⇒ 未判定,不冒绿')
  assert.equal(
    Number(m[1].replace(/_/g, '')),
    WORKER_OUTER_TIMEOUT_MS,
    'worker 外层与 lib 常量不同值(两侧各改一半就是下一次孤儿进程的起点)',
  )
})

test('③ 超时压过 stderr:子进程写过噪音也不许把超时身份顶掉', () => {
  const text = stageFailureText({
    timedOut: true,
    signal: 'SIGTERM',
    code: null,
    stderr: '[db] DATABASE_APP_URL 启动探测成功(SELECT 1)',
    limitMs: DB_WRITE_TIMEOUT_MS,
  })
  assert.match(text, /超时被杀/, '必须点名"超时"')
  assert.ok(text.includes(String(DB_WRITE_TIMEOUT_MS)), '必须带本方窗口值,好让人判断该不该调')
  assert.equal(isUndeterminedOutcome({ timedOut: true, code: null }), true, '超时算未判定,不算判死')
})

test('④ 反向牙:别人发的 SIGTERM 不得被报成"我方窗口到点"', () => {
  const text = stageFailureText({
    timedOut: false,
    signal: 'SIGTERM',
    code: null,
    stderr: '',
    limitMs: DB_WRITE_TIMEOUT_MS,
  })
  assert.doesNotMatch(text, /超时/, '外部终止被写成超时 ⇒ 会把人误导去调窗口')
  assert.match(text, /信号 SIGTERM/)
})

test('⑤ 非超时且有 stderr 时仍优先给子进程原文(保持旧行为不变的那一半)', () => {
  const text = stageFailureText({
    timedOut: false,
    signal: null,
    code: 1,
    stderr: '真实业务错误',
    limitMs: DB_WRITE_TIMEOUT_MS,
  })
  assert.equal(text, '真实业务错误')
  const noErr = stageFailureText({
    timedOut: false,
    signal: null,
    code: 3,
    stderr: '',
    limitMs: DB_WRITE_TIMEOUT_MS,
  })
  assert.match(noErr, /退出码 3/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
