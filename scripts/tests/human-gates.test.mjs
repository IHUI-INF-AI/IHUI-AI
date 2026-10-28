// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `human-gates.mjs` 镜像测试。钉:① 三档判定(自决 / 停机等人 / 未知不猜);② 退出码 0/2/1;
 * ③ 形状锁(空档、两档同 id、非法 stop 值一律抛);④ 现盘清单可读且两档都不为空。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as hg, GATES_PATH } from '../human-gates.mjs'

const DOC = hg.loadHumanGates(
  JSON.stringify({
    autonomous: [{ id: 'code-change', title: '改代码' }],
    gates: [{ id: 'api-key-change', title: '换密钥', stop: 'notify-human' }],
  }),
)

test('① 三档判定:未知 action 既不猜自决也不猜人工阀', () => {
  assert.equal(hg.classify(DOC, 'code-change').verdict, 'autonomous')
  assert.equal(hg.classify(DOC, 'api-key-change').verdict, 'stop')
  assert.equal(hg.classify(DOC, 'whatever').verdict, 'unknown')
  assert.equal(hg.classify(DOC, '').verdict, 'unknown')
})

test('② 退出码:0 自决 / 2 停机等人 / 1 未判定', () => {
  assert.equal(hg.exitCodeOf('autonomous'), 0)
  assert.equal(hg.exitCodeOf('stop'), 2)
  assert.equal(hg.exitCodeOf('unknown'), 1)
})

test('③ 形状锁:空档 / 两档同 id / 非法 stop 一律抛', () => {
  assert.throws(() => hg.loadHumanGates('{}'), /非空数组/)
  assert.throws(() => hg.loadHumanGates(JSON.stringify({ autonomous: [], gates: [] })), /非空数组/)
  assert.throws(
    () =>
      hg.loadHumanGates(
        JSON.stringify({ autonomous: [{ id: 'x', title: 't' }], gates: [{ id: 'x', title: 't' }] }),
      ),
    /两档/,
  )
  assert.throws(
    () =>
      hg.loadHumanGates(
        JSON.stringify({
          autonomous: [{ id: 'x', title: 't' }],
          gates: [{ id: 'y', title: 't', stop: 'hard-fail' }],
        }),
      ),
    /notify-human/,
  )
})

test('④ 现盘清单:两档非空,且关键人工阀在位', () => {
  const doc = hg.loadHumanGates(readFileSync(GATES_PATH, 'utf8'))
  const s = hg.summarize(doc)
  assert.ok(s.counts.autonomous > 0 && s.counts.gates > 0)
  for (const id of ['api-key-change', 'console-operation', 'device-scan', 'destructive-git']) {
    assert.equal(hg.classify(doc, id).verdict, 'stop', `${id} 必须是人工阀`)
  }
  assert.equal(hg.classify(doc, 'code-change').verdict, 'autonomous')
})

test('④b 清单文件路径在仓内单点(调度层读同一份)', () => {
  const expected = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'scripts',
    'data',
    'human-gates.json',
  )
  assert.equal(join(GATES_PATH), join(expected))
})
