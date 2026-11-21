// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// 修表器取数面必须能被声明成"与判据同一面"(2026-11-21 第 109 项)
// =============================================================================
// 病灶(实测):README.en.md:658 的 testFiles,判据(check-doc-numbers 默认档)按 HEAD 面现算 5953,
// 而修表器(scrub-doc-numbers)恒按 worktree 取数、写进 5950 ⇒ `--scope=archive --apply` 报
// "零改动",红却还在。同一句"现算"被两份实现按两面算 —— §0.6 的第二份判据漂移。
//
// 这一档钉三件:① `--face` 被解析;② 取值原样传给 collectNumbers(不许在中间被换回 worktree);
// ③ 非法面当场 exit 2 未判定(不许静默落回缺省面)。
//
// 跑法:node --test scripts/tests/scrub-doc-numbers-face.test.mjs
// =============================================================================
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SRC = readFileSync(join(REPO, 'scripts', 'scrub-doc-numbers.mjs'), 'utf8')

test('109-① --face 被解析,缺省仍是 worktree(人工逃生舱行为不变)', () => {
  assert.match(SRC, /argv\.find\(\(a\) => a\.startsWith\('--face='\)\)/, '找不到 --face 解析')
  assert.match(SRC, /const face = faceArg \? .* : 'worktree'/, '缺省面必须是 worktree(与原文行为一致)')
})

test('109-② 取数面原样传给 collectNumbers', () => {
  assert.match(SRC, /collectNumbers\(\{\s*root: ROOT,\s*face\s*\}\)/, 'collectNumbers 没有吃到 --face ⇒ 声明了也不算(§0.9 造好没装车)')
  assert.ok(
    !/collectNumbers\(\{\s*root: ROOT,\s*face: 'worktree'\s*\}\)/.test(SRC),
    '仍存在写死的 worktree 取数 ⇒ 两面又会漂移',
  )
})

test('109-③ 非法面当场 exit 2(未判定),不静默落回缺省', () => {
  const block = SRC.slice(SRC.indexOf("const faceArg ="), SRC.indexOf('const texts = new Map()'))
  assert.match(block, /if \(face !== 'worktree' && face !== 'head' && face !== 'staged'\)/, '非法面没有白名单判定')
  assert.match(block, /return 2/, '非法面必须 exit 2,不得落回 worktree 继续写盘')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
