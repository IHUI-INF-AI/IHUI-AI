// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 79 镜像测试:热路径 git 只读调用必须带 timeout
//
// 与源脚本的 __test__ 出口对接(§22c:测试直接 import,不复制判据实现)。
// 重点钉三件容易在后续改动里悄悄坏掉的事:
//  ① 判据不能把**字符串/注释里的 git** 当成真调用(曾经就会,被自检抓出);
//  ② 写动词必须**不判**(给 commit 加超时会因 SIGTERM 留 index.lock);
//  ③ 装车证明 —— guardian-runner 里必须真有这道门。
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as gate } from '../check-git-read-timeout.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')

test('__test__ 出口齐备(§22c 锚点)', () => {
  for (const fn of ['scanSource', 'auditHot', 'callSpan', 'markHidden']) {
    assert.equal(typeof gate[fn], 'function', `缺少导出 ${fn}`)
  }
  assert.ok(gate.HOT.length >= 10, 'HOT 清单塌缩会让本门恒绿')
  assert.ok(gate.READ_ONLY.has('ls-files') && !gate.READ_ONLY.has('commit'), '只读/写动词划分被改动')
})

test('夹具字符串与注释内的 git 不参与判定(误报面为零的根据)', () => {
  const src = [
    `const fixture = "execFileSync('git', ['ls-files'], {})"`,
    `// execFileSync('git', ['rev-parse', 'HEAD'], {})`,
    `/* execFileSync('git', ['status'], {}) */`,
  ].join('\n')
  const r = gate.scanSource(src)
  assert.deepEqual(r.misses, [], `夹具/注释被误判: ${JSON.stringify(r.misses)}`)
})

test('真调用缺 timeout 判红,补上(含简写属性)判绿', () => {
  assert.equal(gate.scanSource(`const a = execFileSync('git', ['ls-files'], { windowsHide: true })`).misses.length, 1)
  assert.equal(gate.scanSource(`const a = execFileSync('git', ['ls-files'], { timeout: 60000 })`).misses.length, 0)
  assert.equal(gate.scanSource(`const t = 1\nconst a = execFileSync('git', ['ls-files'], { timeout })`).misses.length, 0)
})

test('写动词不判但如实计数(不得静默当成已封顶)', () => {
  const r = gate.scanSource(`execFileSync('git', ['commit', '-m', 'x'], {})`)
  assert.deepEqual(r.misses, [])
  assert.equal(r.writes.length, 1)
  assert.equal(r.writes[0].verb, 'commit')
})

test('真仓不变量:HOT 集合内只读 git 调用全部已封顶', () => {
  const bad = gate.auditHot(REPO)
  const misses = bad.flatMap((b) => b.misses.map((m) => `${b.rel}:L${m.line} ${m.verb}`))
  assert.deepEqual(misses, [], `热路径仍有无界 git 只读调用:\n${misses.join('\n')}`)
})

test('装车证明:guardian-runner 已注册守门 79 且为 blocking', () => {
  const runner = readFileSync(join(REPO, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const block = runner.match(/id:\s*'79',[\s\S]{0,2500}?\n {2}\},/)
  assert.ok(block, '未找到守门 79 注册块 —— 脚本存在但没接上守门链等于没有闸')
  assert.match(block[0], /script:\s*'check-git-read-timeout\.mjs'/)
  assert.match(block[0], /mode:\s*'blocking'/)
  assert.match(block[0], /skipEnv:\s*'HUSKY_SKIP_GIT_READ_TIMEOUT'/)
})

test('--self-test 入口可用且全绿', () => {
  const out = execFileSync(process.execPath, [join(REPO, 'scripts', 'check-git-read-timeout.mjs'), '--self-test'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
  })
  assert.match(out, /--self-test \d+\/\d+ 通过/)
  assert.doesNotMatch(out, /❌ /, '自检存在失败用例')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
