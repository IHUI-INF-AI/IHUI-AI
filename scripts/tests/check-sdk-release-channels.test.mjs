// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// O14 · scripts/check-sdk-release-channels.mjs 的 §22c 镜像测试。
// 判据函数一律 **直接 import 源文件**(§22c 根治路径第 2 步),禁止在本文件复制实现。
// 覆盖:真台账过结构判据 / 假 ready 的 secret 面 / 双向腐烂面的纯函数锁 / 装车链
// (publish-ready 回归确实消费台账,且台账点名的 liveChecker 就是本脚本)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateStructure, decideChannel, runProbe, STATUS_ENUM } from '../check-sdk-release-channels.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const MANIFEST = resolve(REPO_ROOT, 'config/sdk-release-channels.json')
const CHECKER = resolve(REPO_ROOT, 'scripts/check-sdk-release-channels.mjs')
const PUBLISH_TEST = resolve(REPO_ROOT, 'packages/sdk/tests/publish-ready.test.mjs')

test('真台账通过结构判据(镜像测试的输入逐字取自真实文件,§22c 反"只复读实现")', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  assert.deepEqual(validateStructure(manifest), [], '真实台账不合规 —— 先修账再动判据')
  assert.equal(manifest.channels.length, 5)
  assert.deepEqual(
    manifest.channels.map((c) => c.id),
    ['npm', 'pypi', 'maven', 'nuget', 'go'],
  )
  for (const ch of manifest.channels) assert.ok(STATUS_ENUM.includes(ch.status), `${ch.id} 的 status 不在枚举`)
})

test('台账点名的 liveChecker 就是本脚本,且被 publish-ready 回归真实消费(装车链)', () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  assert.equal(resolve(REPO_ROOT, manifest.liveChecker), CHECKER)
  assert.ok(existsSync(CHECKER))
  const t = readFileSync(PUBLISH_TEST, 'utf8')
  for (const needle of ['config/sdk-release-channels.json', 'validateChannelsLedger', 'publishJobKeys']) {
    assert.ok(t.includes(needle), `publish-ready.test.mjs 不再引用 ${needle} —— 结构面与实跑面的对账断链`)
  }
})

test('纯函数判据:ready+无法验证 / blocked+已命中 两个腐烂方向各红一次', () => {
  const ab = { state: 'absent', detail: 'HTTP 404' }
  const det = { state: 'present', detail: 'HTTP 200' }
  const un = { state: 'undetermined', detail: 'fixture' }
  const base = { id: 'npm', status: 'ready', verifyCommand: 'npm view @ihui/sdk version', requiredSecrets: [], probe: { kind: 'none' } }
  assert.ok(decideChannel(base, { bin: true, binName: 'npm', outcome: un }).red.some((x) => x.includes('无法验')))
  assert.ok(decideChannel({ ...base, status: 'blocked-by-credential' }, { bin: true, binName: 'npm', outcome: det }).red.some((x) => x.includes('台账腐烂')))
  assert.equal(decideChannel(base, { bin: true, binName: 'npm', outcome: ab }).red.length, 0, 'ready+absent 是就绪待发的正当态,不得判红')
})

test('verifyCommand 不可跑判红与 status 无关(三条通道各测一次)', () => {
  const out = { state: 'absent', detail: 'x' }
  for (const status of ['ready', 'blocked-by-credential', 'blocked-by-external-ownership']) {
    const { red } = decideChannel({ id: 'c', status, verifyCommand: 'definitely-not-a-real-binary x', requiredSecrets: [], probe: { kind: 'none' } }, { bin: false, binName: 'definitely-not-a-real-binary', outcome: out })
    assert.ok(red.some((x) => x.includes('不可跑')), `${status} 下不可跑未判红`)
  }
})

test('探针三态:连接被拒绝不坍缩成 present/absent', async () => {
  // 127.0.0.1:9 (discard 端口,无监听) → 必为 undetermined;若哪天它被判成 absent,
  // 说明 fetch 错误路径被误分类 —— 那正是"blocked 项靠猜翻绿"的入口。
  const r = await runProbe({ kind: 'http-status', url: 'http://127.0.0.1:9/probe-must-fail' })
  assert.equal(r.state, 'undetermined', JSON.stringify(r))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
