// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scratch-dir 回归测试:钉死两条选址不变量(落点在仓库树外 + 不依赖进程 TEMP)。
// 成因见 scripts/lib/scratch-dir.mjs 注释:夹具曾随 os.tmpdir() 把 C 盘当垃圾场,
// 单日 45 个目录;而"非 git 仓库"用例要求夹具必须在任何仓库树之外。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')

test('mkScratch 建的目录不在仓库树内(否则"非 git"夹具会逃逸到真仓库)', () => {
  const dir = mkScratch('abspath-')
  try {
    assert.ok(!dir.startsWith(REPO_ROOT + '\\'), `夹具落在仓库内: ${dir}`)
    assert.ok(!dir.startsWith(REPO_ROOT + '/'), `夹具落在仓库内: ${dir}`)
  } finally {
    rmScratch(dir)
  }
})

test('mkScratch 不跟随进程 TEMP(把 TEMP 指向一个钉在 C 盘的旧值也必须不理它)', () => {
  // 旧写法是"夹具落在 process.env.TEMP 之下就算失败"。这句在本机 TEMP **已迁移成功**时
  // 自相矛盾:mkScratch 的锚点按定义就是 `<工作树盘>\DevEnv\Temp\ihui-scratch`,
  // 而 TEMP 现值正是 `D:\DevEnv\Temp` ⇒ 迁移越成功,这条越红(2026-09-24 实测红在此)。
  // 要钉的性质不是"与 TEMP 不同",而是"**不受 TEMP 影响**":所以显式把 TEMP 改成一个
  // 未迁移的 C 盘路径再取证,这才是原意。
  const before = { TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR }
  const stale = 'C:\\Users\\someone\\AppData\\Local\\Temp'
  process.env.TEMP = stale
  process.env.TMP = stale
  delete process.env.TMPDIR
  try {
    const dir = mkScratch('temp-env-')
    try {
      const r = resolve(dir)
      assert.ok(
        !r.toLowerCase().startsWith(resolve(stale).toLowerCase()),
        `夹具跟随了进程 TEMP ⇒ ${dir}(选址必须与工作树同盘,不看 TEMP 脸色)`,
      )
      assert.ok(
        /^[A-Za-z]:\\DevEnv\\Temp\\ihui-scratch/i.test(r) || !/^[Cc]:\\/.test(r),
        `夹具落点异常(既不在 DevEnv\\Temp\\ihui-scratch,又落在 C 盘):${dir}`,
      )
    } finally {
      rmScratch(dir)
    }
  } finally {
    for (const [k, v] of Object.entries(before)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
})

test('rmScratch 真删干净(git 只读对象靠重试兜底)', () => {
  const dir = mkScratch('rmcheck-')
  rmScratch(dir)
  assert.equal(existsSync(dir), false, `rmScratch 之后仍存在: ${dir}`)
})

test('IHUI_SCRATCH_DIR 可覆盖落点(换机/CI 无 D:\\DevEnv 时的逃生舱)', () => {
  const prev = process.env.IHUI_SCRATCH_DIR
  const override = join(REPO_ROOT, '.ihui-agent', 'tmp', 'scratch-override')
  process.env.IHUI_SCRATCH_DIR = override
  try {
    // 覆盖指向仓库内时按硬约束拒建,而不是静默产出会逃逸的夹具
    assert.throws(() => mkScratch('inside-repo-'), /不得在仓库树内/)
  } finally {
    if (prev === undefined) delete process.env.IHUI_SCRATCH_DIR
    else process.env.IHUI_SCRATCH_DIR = prev
    const left = existsSync(override) ? readdirSync(override) : []
    assert.deepEqual(left, [], `覆盖目录留下了残留: ${left.join(', ')}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
