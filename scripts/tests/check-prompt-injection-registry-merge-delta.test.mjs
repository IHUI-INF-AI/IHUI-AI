// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 129(check-prompt-injection-registry)的合并面判据测试:
// R3 棘轮的锚点从"只看 HEAD"改为"HEAD ∪ MERGE_HEAD"(合并未收口时)。
// ① 上游带入的裸前缀不判红;② 合并里真新增一处裸前缀必判红。
//
// 跑法:node --test scripts/tests/check-prompt-injection-registry-merge-delta.test.mjs
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitRaw } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-prompt-injection-registry.mjs'

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'check-prompt-injection-registry.mjs',
)
const Z = 'apps/cli/src/commands/z.ts'
const REGISTRY = 'apps/cli/src/utils/prompt-injection-registry.ts'
const BOUNDARY = 'apps/cli/src/utils/prompt-boundary.ts'

const registryText = `
export const PROMPT_INJECTION_KINDS = ['reference_data', 'host_reminder', 'host_directive'] as const;
export const PROMPT_INJECTION_ENTRIES: readonly PromptInjectionEntry[] = [
  { id: 'alpha', kind: 'host_reminder', producer: 'apps/cli/src/utils/producer.ts#doA', consumer: 'apps/cli/src/utils/consumer.ts#build', title: 'A 段' },
];
export function renderInjectionNotice(): string { return ''; }
`
const producerText = `import { recordInjectionSkipped } from './prompt-injection-registry.js';
export function doA() { return recordInjectionSkipped('alpha', '本轮无内容'); }
`
const consumerText = `import { renderInjectionNotice } from './prompt-injection-registry.js';
export function build() { return renderInjectionNotice(); }
`
const bare = (n) =>
  Array.from({ length: n }, (_, i) => `export const s${i} = \`[系统提示] 旁路${i}\`;`).join('\n') + '\n'

const baseFiles = (zText) =>
  new Map([
    [REGISTRY, { text: registryText }],
    [BOUNDARY, { text: 'export function f(){}' }],
    ['apps/cli/src/utils/producer.ts', { text: producerText }],
    ['apps/cli/src/utils/consumer.ts', { text: consumerText }],
    [Z, { text: zText }],
  ])
const decideWith = (zText, headCounts) =>
  gate.decide({
    registryText,
    boundaryText: 'export function f(){}',
    files: baseFiles(zText),
    headCounts,
  })
const r3 = (res) => res.red.R3 || []

// ---------------------------------------------------------------- 纯构造面

test('A1 合并带入的既有裸前缀:naive 单父(HEAD 1)误判 1 条;双父(HEAD 1 ∪ MERGE_HEAD 2)绿', () => {
  assert.equal(gate.anchorFromParents(2, [1]), 1)
  assert.equal(gate.anchorFromParents(2, [1, 2]), 2)
  // 修前读数:锚点只看 HEAD(1处)⇒ R3 判红 1 条
  assert.equal(r3(decideWith(bare(2), new Map([[Z, 1]]))).length, 1)
  // 修后读数:双父锚点 2 处 ⇒ 0 条
  assert.equal(r3(decideWith(bare(2), new Map([[Z, 2]]))).length, 0)
})

test('A2 合并里真新增一处裸前缀(结果 3 / 父 1 ∪ 2):双父锚点 2 ⇒ 判红 1 条', () => {
  const anchor = gate.anchorFromParents(3, [1, 2])
  assert.equal(anchor, 2)
  const res = decideWith(bare(3), new Map([[Z, anchor]]))
  assert.equal(r3(res).length, 1)
  assert.match(r3(res)[0], /3 处.*2 处/)
})

test('A3 单父(非合并)与旧口径等价:判红结论仍由 HEAD 读数决定', () => {
  assert.equal(gate.anchorFromParents(2, [3]), 2) // 计数型锚点 = min(读数, 父)
  assert.equal(r3(decideWith(bare(2), new Map([[Z, gate.anchorFromParents(2, [3])]]))).length, 0)
  // 旧口径传入 HEAD 读数 3 ⇒ 同样不红(判据结论逐字等价)
  assert.equal(r3(decideWith(bare(2), new Map([[Z, 3]]))).length, 0)
  assert.equal(r3(decideWith(bare(2), new Map([[Z, 1]]))).length, 1)
})

// ---------------------------------------------------------------- 真临时仓(merge --no-commit)

test('X1 真临时仓合并面:上游带来的既有裸前缀绿;合并里再加一处判红', () => {
  let dir = null
  try {
    dir = mkScratch('prompt-injection-merge')
    const git = (args) => gitRaw(args, dir, { timeout: 30000 })
    const run = () => {
      const r = spawnSync(process.execPath, [SCRIPT, '--root', dir, '--staged', '--json'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 32 << 20,
      })
      let parsed = { red: [] }
      try {
        parsed = JSON.parse(r.stdout || '{}')
      } catch {
        /* 解析失败只信退出码,断言会红 */
      }
      const all = parsed.red && !Array.isArray(parsed.red) ? Object.values(parsed.red).flat() : parsed.red || []
      return { status: r.status, red: all.filter((v) => /R3/.test(String(v))), out: `${r.stdout || ''}${r.stderr || ''}` }
    }
    const write = (rel, text) => {
      const p = path.join(dir, rel)
      mkdirSync(path.dirname(p), { recursive: true })
      writeFileSync(p, text, 'utf8')
    }

    git(['init', '-q'])
    git(['config', 'user.email', 'gate@test.invalid'])
    git(['config', 'user.name', 'gate'])
    git(['checkout', '-b', 'main'])
    write(REGISTRY, registryText)
    write(BOUNDARY, 'export function f(){}')
    write('apps/cli/src/utils/producer.ts', producerText)
    write('apps/cli/src/utils/consumer.ts', consumerText)
    write(Z, bare(1))
    git(['add', '.'])
    git(['commit', '-q', '-m', 'base'])

    git(['checkout', '-b', 'upstream'])
    write(Z, bare(2))
    git(['add', Z])
    git(['commit', '-q', '-m', 'upstream 两处'])

    git(['checkout', 'main'])
    write('apps/cli/src/utils/other.ts', 'export const o = 1\n')
    git(['add', 'apps/cli/src/utils/other.ts'])
    git(['commit', '-q', '-m', 'main 侧'])
    git(['merge', '--no-commit', '--no-ff', 'upstream'])

    const resText = readFileSync(path.join(dir, Z), 'utf8')
    const headHits = gate.countBarePrefix(gate.maskCode(git(['show', `HEAD:${Z}`]), { strings: false }))
    const upHits = gate.countBarePrefix(gate.maskCode(git(['show', `MERGE_HEAD:${Z}`]), { strings: false }))
    const resHits = gate.countBarePrefix(gate.maskCode(resText, { strings: false }))
    assert.equal(headHits, 1)
    assert.equal(upHits, 2)
    assert.equal(resHits, 2)
    assert.equal(gate.anchorFromParents(resHits, [headHits, upHits]), 2)
    // 修前读数:单父锚点 1 处 ⇒ 会判红 1 条
    assert.equal(gate.anchorFromParents(resHits, [headHits]), 1)

    const first = run()
    assert.equal(first.status, 0, first.out)
    assert.equal(first.red.length, 0, first.out)

    write(Z, bare(3))
    git(['add', Z])
    const second = run()
    assert.equal(second.status, 1, second.out)
    assert.ok(second.red.length >= 1, second.out)
  } finally {
    if (dir) {
      try {
        rmScratch(dir)
      } catch {
        /* 夹具残留不改判据结论 */
      }
    }
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
