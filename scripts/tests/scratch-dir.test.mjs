// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scratch-dir 回归测试:钉死两条选址不变量(落点在仓库树外 + 不依赖进程 TEMP)。
// 成因见 scripts/lib/scratch-dir.mjs 注释:夹具曾随 os.tmpdir() 把 C 盘当垃圾场,
// 单日 45 个目录;而"非 git 仓库"用例要求夹具必须在任何仓库树之外。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

/* ── 退出钩子:让"忘了写 finally"在结构上不可能留下残留(2026-09-25 实测一天漏 3 个夹具) ── */

const LIB_URL = pathToFileURL(resolve(HERE, '..', 'lib', 'scratch-dir.mjs')).href

/** 在**子进程**里跑一段用夹具的代码 —— 钩子挂在 `process.on('exit')`,父进程测不出来。 */
function runChild(body) {
  return spawnSync(
    process.execPath,
    ['--input-type=module', '-e', `import { mkScratch, rmScratch } from ${JSON.stringify(LIB_URL)};\n${body}`],
    { encoding: 'utf8', windowsHide: true, timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] },
  )
}

test('断言抛在 rmScratch 之前 ⇒ 进程退出时夹具必须被带走(阳性对照)', () => {
  // 只判**这一次子进程建出来的那一个路径** —— 按"目录名前缀在 scratch 根里计数"的写法
  // 会被上一次运行留下的残留判成假红(实测就是这样红过一次:判据依赖历史,而不是依赖被测行为)。
  const r = runChild(`
process.stdout.write(mkScratch('leak-probe-'));
throw new Error('模拟断言失败(旧写法在这里就永久漏一个目录)');
`)
  assert.notEqual(r.status, 0, '子进程本该失败,否则这条测不到抛路径')
  assert.match(r.stderr, /模拟断言失败/)
  const childDir = r.stdout.trim()
  assert.ok(/^leak-probe-/.test(childDir.split(/[\\/]/).pop() ?? ''), `子进程没把夹具路径打出来:${childDir}`)
  assert.equal(existsSync(childDir), false, `退出钩子没生效,夹具仍在:${childDir}`)
})

test('退出钩子只回收本进程建的夹具,不得扫掉同目录里别人留下的东西(反向对照)', () => {
  const stranger = mkScratch('stranger-') // 本测试进程建的,但**不**显式删 —— 子进程退出时必须还在
  try {
    assert.ok(existsSync(stranger), '夹具没建出来,反向对照无从谈起')
    const r = runChild(`
process.stdout.write(mkScratch('child-own-'));
`)
    assert.equal(r.status, 0, r.stderr)
    assert.equal(existsSync(r.stdout.trim()), false, '子进程自己的夹具没被回收(钩子正向半边失效)')
    assert.ok(existsSync(stranger), '钩子越界删了别的进程/别的时刻留下的夹具 ⇒ 那是替人做删除决定')
  } finally {
    rmScratch(stranger)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
