#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ci-monorepo.yml `source-check` 步骤的行为夹具(P2-6)。
 *
 * 旧写法 `FILES=$(find ... || true)` 把 find 自身失败(目录不存在/权限)吞成空集,
 * 步骤照绿 —— "没扫到"与"扫完没问题"无法区分。修法:先断言 `apps/(*)/src` 存在,
 * 再去掉 `|| true`(set -e 下 find 失败即红)。
 *
 * T1 静态:块内不得再有 `|| true`;
 * T2 行为:空仓库(无 apps/)必须红;T3 干净 .ts 必须绿;T4 混入 .js 必须红。
 * 修前对 HEAD 块实测:无 apps/ 时 exit 0(假绿),修后 exit 1("找不到 apps/ * /src 扫描根")。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WF = join(HERE, '..', '..', '.github', 'workflows', 'ci-monorepo.yml')
// Windows 上 `bash` 常解析到 Git 的 usr/bin/bash,它把 C:\Windows\System32 排在 PATH 前面,
// `find` 会落到 Windows find.exe(报 "FIND: Parameter format not correct")。CI 是 ubuntu,
// 本机自证用 Git 的 bin/bash.exe —— 它会把 /usr/bin 排到前面。
const BASH =
  process.platform === 'win32' && existsSync('C:\\Program Files\\Git\\bin\\bash.exe')
    ? 'C:\\Program Files\\Git\\bin\\bash.exe'
    : 'bash'

/** 抽取 `id: source-check` 步骤的 run 块并去掉 YAML 缩进。 */
function extractSourceCheckScript() {
  const lines = readFileSync(WF, 'utf8').split('\n')
  const nameAt = lines.findIndex((l) => l.includes('- name: Check for .js/.jsx/.vue files'))
  assert.ok(nameAt >= 0, '找不到 source-check 步骤')
  const runAt = lines.findIndex((l, i) => i > nameAt && /^\s*run:\s*\|/.test(l))
  assert.ok(runAt >= 0, 'source-check 步骤没有 run: |')
  const runIndent = lines[runAt].match(/^(\s*)/)[1].length
  const body = []
  for (let i = runAt + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') {
      body.push('')
      continue
    }
    const indent = line.match(/^(\s*)/)[1].length
    if (indent <= runIndent) break
    body.push(line.slice(Math.min(indent, runIndent + 2)))
  }
  return body.join('\n')
}

/** 在临时目录里跑脚本,返回 { status, stdout, stderr }。 */
function runIn(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-p26-'))
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel)
    mkdirSync(dirname(full), { recursive: true })
    if (content !== null) writeFileSync(full, content)
    else mkdirSync(full, { recursive: true })
  }
  const r = spawnSync(BASH, ['-c', extractSourceCheckScript()], { cwd: dir, encoding: 'utf8' })
  return { ...r, dir }
}

test('T1 静态:source-check 块内不得出现 `|| true` 吞错', () => {
  // 注释里会引用旧写法作说明,判据只看非注释行。
  const script = extractSourceCheckScript()
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n')
  assert.ok(!/\|\|\s*true/.test(script), 'source-check 仍用 `|| true` 兜空集 ⇒ find 失败会被吞成"没扫到"')
  assert.ok(script.includes('找不到 apps/*/src 扫描根'), '缺少"扫描根存在"的前置断言')
})

test('T2 行为:没有 apps/ 目录时必须红(旧写法此处假绿)', () => {
  const r = runIn({})
  assert.notEqual(r.status, 0, `无 apps/ 时旧判据假绿:沿用 || true 会 exit 0。out=${JSON.stringify(r.stdout)}`)
  assert.doesNotMatch(r.stdout, /OK: No \.js/, '无 apps/ 却打印了"没发现违规"的成功结论')
})

test('T2b 行为:apps/ 存在但没有 */src 时必须点名"判据失明"', () => {
  const r = runIn({ 'apps/web/README.md': 'placeholder\n' })
  assert.notEqual(r.status, 0, '没有 src 目录却判绿')
  assert.match(r.stdout, /找不到 apps\/\*\/src 扫描根/, `未点名判据失明原因:${JSON.stringify(r.stdout)}`)
})

test('T3 行为:apps/*/src 内只有 .ts 时必须绿', () => {
  const r = runIn({ 'apps/web/src/index.ts': 'export const a = 1\n' })
  assert.equal(r.status, 0, `干净的 .ts 被误判红:${r.stdout}${r.stderr}`)
  assert.match(r.stdout, /OK: No \.js\/\.jsx\/\.vue files found/)
})

test('T4 行为:apps/*/src 内混入 .js 时必须红', () => {
  const r = runIn({ 'apps/web/src/index.ts': 'export const a = 1\n', 'apps/web/src/legacy.js': 'module.exports = 1\n' })
  assert.notEqual(r.status, 0, `.js 未触发红:${r.stdout}`)
  assert.match(r.stdout, /Found \.js\/\.jsx\/\.vue files/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
