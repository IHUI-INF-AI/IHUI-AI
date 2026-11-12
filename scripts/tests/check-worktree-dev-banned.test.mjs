// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as gate } from '../check-worktree-dev-banned.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GATE = join(HERE, '..', 'check-worktree-dev-banned.mjs')
const ROOT = join(HERE, '..', '..')

test('scanBlock 大括号平衡与字符串跳过', () => {
  const fake = 'function f(){ if(x){ deep() } }'
  const ob = fake.indexOf('{')
  assert.equal(gate.scanBlock(fake, ob), fake.lastIndexOf('}'))
  assert.equal(gate.scanBlock("const s='}nope'", 0), -1, '非 { 起点返回 -1')
  const strCase = "const s='}nope'; if(a){b()}"
  const strOb = strCase.indexOf('{')
  assert.ok(gate.scanBlock(strCase, strOb) > strOb, '字符串里的 } 不参与平衡')
})

test('阳性:现读真实源码两出口均拒绝态', () => {
  const awSrc = readFileSync(join(ROOT, 'scripts/agent-worktree.mjs'), 'utf8')
  const wiSrc = readFileSync(join(ROOT, 'scripts/worktree-isolate.mjs'), 'utf8')
  assert.equal(gate.judgeAgentWorktree(awSrc).ok, true)
  assert.equal(gate.judgeWorktreeIsolate(wiSrc).ok, true)
})

test('阴性A:agent-worktree --create 改回 worktree add 应判红', () => {
  const fake = "if (has('--create')) {\n  git(['worktree','add','-b',br,p,base])\n  return\n}"
  const j = gate.judgeAgentWorktree(fake)
  assert.equal(j.ok, false)
  assert.ok(j.findings.some((f) => /worktree add/.test(f.reason)))
})

test('阴性A2:agent-worktree --create 摘掉 EXIT_REFUSED 应判红', () => {
  const fake = "if (has('--create')) {\n  console.log('creating')\n  return\n}"
  const j = gate.judgeAgentWorktree(fake)
  assert.equal(j.ok, false)
})

test('阴性B:worktree-isolate new 改回调 newWorktree 应判红', () => {
  const fake = "if (cmd === 'new') {\n  return (await newWorktree({slug})).exit\n}"
  const j = gate.judgeWorktreeIsolate(fake)
  assert.equal(j.ok, false)
  assert.ok(j.findings.some((f) => /newWorktree/.test(f.reason)))
})

test('阴性C:agent-worktree --create 入口字面量删掉应判红', () => {
  const j = gate.judgeAgentWorktree("if (has('--create-disabled')) {\n  return\n}")
  assert.equal(j.ok, false)
  assert.ok(j.findings.some((f) => /入口消失/.test(f.reason)))
})

test('阴性D:worktree-isolate new 分支字面量删掉应判红', () => {
  const j = gate.judgeWorktreeIsolate("if (cmd === 'land') {\n  return\n}")
  assert.equal(j.ok, false)
  assert.ok(j.findings.some((f) => /分支消失/.test(f.reason)))
})

test('CLI --self-test exit 0 + 通过行', () => {
  const r = spawnSync('node', [GATE, '--self-test'], { encoding: 'utf8', cwd: ROOT })
  assert.equal(r.status, 0)
  assert.match((r.stdout || ''), /self-test 通过/)
})

// 三个 CLI 审判用例走工作树门体(门体尚未入库时 HEAD 面会因"不同代"未判定):
// IHUI_GATE_BODY_SOURCE=worktree 是 gate-body-provenance 明示的合法判面声明(显式留痕,非跳门),
// 镜像测试正是要在工作树门体上验证判据行为。门体入库后判 HEAD 面同样成立。
const CLI_ENV = { ...process.env, IHUI_GATE_BODY_SOURCE: 'worktree' }

test('CLI 普通审判对现合规状态 exit 0', () => {
  const r = spawnSync('node', [GATE], { encoding: 'utf8', cwd: ROOT, env: CLI_ENV })
  assert.equal(r.status, 0)
  assert.match((r.stdout || ''), /✅/)
})

test('CLI --json 输出为纯 JSON 且两键 ok', () => {
  const out = execFileSync('node', [GATE, '--json'], { encoding: 'utf8', cwd: ROOT, env: CLI_ENV })
  const j = JSON.parse(out)
  assert.deepEqual(Object.keys(j).sort(), ['scripts/agent-worktree.mjs', 'scripts/worktree-isolate.mjs'])
  for (const v of Object.values(j)) assert.equal(v.ok, true)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
