// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * hook-tool-path.test.mjs — 钩子 PATH 显式构造的单元证据(2026-11-05 立)
 *
 * 被锁的行为:buildToolPath 必须把 [node 目录, <repo>/node_modules/.bin] 显式放在最前,
 * 再接原 PATH;重复项(Windows 大小写不敏感)只保留第一次出现,空段丢弃。
 * 这是"eslint/prettier 不依赖继承 PATH"的可执行判据,而不是注释承诺。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const requireCjs = createRequire(import.meta.url)
const { buildToolPath } = requireCjs('../lib/hook-tool-path.js')

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const NODE_DIR = dirname(process.execPath)
const BIN_DIR = join(ROOT, 'node_modules', '.bin')

test('前置两项:node 目录 + 仓库 node_modules/.bin,再接原 PATH', () => {
  const extra = join(ROOT, '..', 'outside-bin')
  const envPath = [extra, 'C:\\Windows'].join(process.platform === 'win32' ? ';' : ':')
  const parts = buildToolPath({ envPath, execPath: process.execPath, root: ROOT }).split(
    process.platform === 'win32' ? ';' : ':',
  )
  assert.equal(parts[0], NODE_DIR)
  assert.equal(parts[1], BIN_DIR)
  assert.deepEqual(parts.slice(2), [extra, 'C:\\Windows'])
})

test('重复项只保留第一次(原 PATH 里已有 node 目录/.bin 也不重复)', () => {
  const delim = process.platform === 'win32' ? ';' : ':'
  const envPath = [BIN_DIR, NODE_DIR, BIN_DIR, NODE_DIR].join(delim)
  const parts = buildToolPath({ envPath, execPath: process.execPath, root: ROOT }).split(delim)
  assert.deepEqual(parts, [NODE_DIR, BIN_DIR])
  if (process.platform === 'win32') {
    const upper = buildToolPath({
      envPath: BIN_DIR.toUpperCase(),
      execPath: process.execPath,
      root: ROOT,
    })
      .split(delim)
      .map((p) => p.toLowerCase())
    assert.equal(new Set(upper).size, upper.length, 'Windows 下重复项应大小写不敏感去重')
  }
})

test('空 PATH 也产出两项;缺 root 显式报错(不静默拼出半截)', () => {
  const delim = process.platform === 'win32' ? ';' : ':'
  assert.deepEqual(
    buildToolPath({ envPath: '', execPath: process.execPath, root: ROOT }).split(delim),
    [NODE_DIR, BIN_DIR],
  )
  assert.throws(() => buildToolPath({ envPath: '', root: '' }), /缺少 root/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
