// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ITCP 一致性运行器的端到端镜像测试(2026-11-27)。
 *
 * 判据不重算:这里只用**假守门**(临时目录里的 mock 脚本)喂固定结论行,验证运行器的
 * 三项职责 —— ① 五项读数解析;② 三态判定(ok / not-ok / unknown)与退出码;
 * ③ 未判定时原样转述守门原话(不得把 unknown 读成通过,也不得吞掉守门的诊断)。
 *
 * 为什么端到端而不是拆函数单测:运行器的唯一职责就是"跑守门 + 读数 + 判定",
 * 拆开测等于测另一份实现;用 mock 守门跑真脚本,锁的是被测的那个二进制。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../..')
const RUNNER = path.join(REPO, 'scripts/tool-contract-conformance.mjs')

const MOCK_GATE = `#!/usr/bin/env node
const selfTest = process.argv.includes('--self-test')
if (selfTest) {
  console.log('--self-test:52 通过 / 0 失败(共 52 条)')
  process.exit(0)
}
const mode = process.env.MOCK_GATE_MODE || 'ok'
if (mode === 'cross-gen') {
  console.error('[UNDETERMINED] 未判定:门体与被判修订不同代 —— 本门没有资格回答 0 或 1')
  console.error('  人话: 本门正在用「本地这一代」判据,去判「HEAD」那一代树;两代不一致 ⇒ 先对齐再跑。')
  process.exit(2)
}
if (mode === 'missing') {
  console.log('注册工具数 129 / 无契约数 1 / 棘轮余量 0 / 契约摘除 0 / flip-audit 0')
  process.exit(1)
}
console.log('注册工具数 129 / 无契约数 0 / 棘轮余量 0 / 契约摘除 0 / flip-audit 0')
process.exit(0)
`

function makeFakeRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), 'itcp-conformance-'))
  mkdirSync(path.join(dir, 'scripts'), { recursive: true })
  writeFileSync(path.join(dir, 'scripts/check-tool-contract-declared.mjs'), MOCK_GATE, 'utf8')
  return dir
}

function runRunner(fakeRepo, args = [], env = {}) {
  const r = spawnSync(process.execPath, [RUNNER, ...args], {
    cwd: fakeRepo,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, ...env },
  })
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

describe('ITCP conformance 运行器(端到端)', () => {
  it('① 全五项达标 ⇒ verdict=ok,rc=0,读数解析正确', () => {
    const dir = makeFakeRepo()
    try {
      const r = runRunner(dir, ['--json'])
      const report = JSON.parse(r.out)
      assert.equal(report.verdict, 'ok')
      assert.deepEqual(report.readings, {
        tools: 129,
        missingContract: 0,
        ratchetMargin: 0,
        removedContracts: 0,
        flipAudit: 0,
      })
      assert.equal(report.selfTest.pass, 52)
      assert.equal(report.selfTest.fail, 0)
      assert.equal(report.selfTest.exit, 0)
      assert.equal(r.status, 0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('② 有缺契约 ⇒ verdict=not-ok,rc=1(不得报绿)', () => {
    const dir = makeFakeRepo()
    try {
      const r = runRunner(dir, ['--json'], { MOCK_GATE_MODE: 'missing' })
      const report = JSON.parse(r.out)
      assert.equal(report.verdict, 'not-ok')
      assert.equal(report.readings.missingContract, 1)
      assert.equal(r.status, 1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('③ 守门跨代未判定 ⇒ verdict=unknown,rc=2,且原样转述守门原话', () => {
    const dir = makeFakeRepo()
    try {
      const r = runRunner(dir, [], { MOCK_GATE_MODE: 'cross-gen' })
      assert.equal(r.status, 2)
      assert.match(r.out, /判定: unknown/)
      // 未判定不得读成通过:读数必须是"未判定",且守门的"人话"要出现在输出里
      assert.match(r.out, /\(未判定\)/)
      assert.match(r.out, /两代不一致/)
      assert.match(r.out, /--worktree-body/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('④ 找不到守门脚本 ⇒ rc=2 并给出明确报错(不猜、不静默)', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'itcp-conformance-empty-'))
    try {
      const r = runRunner(dir, [])
      assert.equal(r.status, 2)
      assert.match(r.out, /找不到守门/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
