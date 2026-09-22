// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 id 65「整树删除拦截」的接线 + 有效性测试。
// 判闸是否真的生效,靠**注入一次整树删除**看它变红 —— 不读它自己的注册声明。
// 注入用私有 GIT_INDEX_FILE(从空树 read-tree),全程不碰真实索引。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GIT = 'C:\\Program Files\\Git\\cmd\\git.exe'
const RUNNER = join(ROOT, 'scripts/guardian-runner.mjs')
const GUARD = join(ROOT, 'scripts/check-mass-deletion.mjs')
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

const git = (args, env) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, ...env },
    maxBuffer: 1 << 28,
  })

const runGuard = (env) => {
  try {
    const out = execFileSync(process.execPath, [GUARD], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }
  }
}

test('id 65 已注册为 blocking,带应急变量,且**不带** stagedTriggers(任何提交都要跑)', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const i = src.indexOf("id: '65'")
  if (i < 0) throw new Error('runner 里找不到 id 65')
  const block = src.slice(i - 40, i + 1400)
  if (!block.includes("script: 'check-mass-deletion.mjs'")) throw new Error('未绑定脚本')
  if (!block.includes("mode: 'blocking'")) throw new Error('不是 blocking')
  if (!block.includes('HUSKY_SKIP_MASS_DELETION_GUARD')) throw new Error('缺 skipEnv')
  // 关键:这道闸不能被条件触发稀释掉 —— 索引被清空时往往"什么都没暂存"
  if (/stagedTriggers/.test(block)) throw new Error('不该有 stagedTriggers(会被条件触发跳过)')
})

test('runner 执行循环真的会跑到它(注册了不等于会执行)', () => {
  const src = readFileSync(RUNNER, 'utf8')
  // GUARDS 数组必须整体闭合且 65 落在数组内(而不是落在注释/字符串里)
  const arrStart = src.indexOf('const checks = [')
  if (arrStart < 0) throw new Error('找不到 checks 数组')
  const idx65 = src.indexOf("id: '65'")
  const arrEnd = src.indexOf('\n]', idx65)
  if (arrStart < idx65 && arrEnd > idx65) return
  throw new Error('id 65 不在 checks 数组范围内')
})

test('注入实测:把索引换成空树(= 整树删除形态)→ 守门必须 exit 1', () => {
  const idx = join(tmpdir(), `ihui-massdel-inject-${process.pid}.idx`)
  rmSync(idx, { force: true })
  try {
    git(['read-tree', EMPTY_TREE], { GIT_INDEX_FILE: idx })
    const r = runGuard({ GIT_INDEX_FILE: idx })
    if (r.code !== 1) throw new Error(`整树删除形态未被拦截,exit=${r.code}\n${r.out}`)
    if (!/整树删除|缺失/.test(r.out)) throw new Error('拦截了但输出不含判据说明:' + r.out)
  } finally {
    rmSync(idx, { force: true })
  }
})

test('注入实测:应急开关能放行同一形态(证明开关接的是真判据)', () => {
  const idx = join(tmpdir(), `ihui-massdel-allow-${process.pid}.idx`)
  rmSync(idx, { force: true })
  try {
    git(['read-tree', EMPTY_TREE], { GIT_INDEX_FILE: idx })
    const r = runGuard({ GIT_INDEX_FILE: idx, IHUI_ALLOW_MASS_DELETION: '1' })
    if (r.code !== 0) throw new Error(`应急开关未放行,exit=${r.code}\n${r.out}`)
  } finally {
    rmSync(idx, { force: true })
  }
})

test('当前仓库状态必须是绿的(接入不得引入既存红)', () => {
  const r = runGuard({})
  if (r.code !== 0) throw new Error('当前索引被判整树删除,先查成因:\n' + r.out)
})

test('判据自测 9 例全绿(阈值边界 + 空仓不判定)', () => {
  const out = execFileSync(process.execPath, [GUARD, '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  })
  if (!out.includes('self-test 全部通过')) throw new Error(out)
})

test('测试不留残余:私有索引文件都已清掉', () => {
  if (existsSync(join(tmpdir(), 'ihui-massdel-inject-0.idx'))) throw new Error('临时索引未清理')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
