// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面安装包"单一产物"不变量的回归测试。
// 反例(不该被删的东西)与正例同权重 —— 判据只要误删过一次的签名/包,就是发版事故。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { planArtifactInvariant } from '../lib/desktop-artifact-invariant.mjs'

const CUR = '智汇AI_0.1.44_x64-setup.exe'

test('正例:目录里只有当前包 + 签名 → 无陈旧、无违规', () => {
  const r = planArtifactInvariant([CUR, `${CUR}.sig`], CUR)
  assert.deepEqual(r.stale, [])
  assert.deepEqual(r.keep.sort(), [CUR, `${CUR}.sig`].sort())
  assert.deepEqual(r.violations, [])
})

test('正例:2026-09-22 真实污染场景(三个版本共存)→ 只留当前那一对', () => {
  const files = [
    CUR,
    `${CUR}.sig`,
    '智汇AI_0.1.45_x64-setup.exe',
    '智汇AI_0.1.45_x64-setup.exe.sig',
    '智汇AI_0.1.46_x64-setup.exe',
    '智汇AI_0.1.46_x64-setup.exe.sig',
  ]
  const r = planArtifactInvariant(files, CUR)
  assert.equal(r.stale.length, 4)
  assert.ok(!r.stale.includes(CUR), '当前包绝不能进 stale 清单')
  assert.ok(!r.stale.includes(`${CUR}.sig`), '当前签名绝不能进 stale 清单')
  assert.deepEqual(r.keep.sort(), [CUR, `${CUR}.sig`].sort())
})

test('反例:当前包字母序靠后也不能被当成陈旧(字母序选包正是本缺陷的成因)', () => {
  // 0.1.9 排在 0.1.10 之后 —— 若哪天有人按 glob[0] 取包就会拿到错的版本
  const r = planArtifactInvariant(['智汇AI_0.1.10_x64-setup.exe', '智汇AI_0.1.9_x64-setup.exe'], '智汇AI_0.1.9_x64-setup.exe')
  assert.deepEqual(r.stale, ['智汇AI_0.1.10_x64-setup.exe'])
  assert.deepEqual(r.keep, ['智汇AI_0.1.9_x64-setup.exe'])
})

test('反例:非产物文件一律不碰(日志/备份/说明不得被删)', () => {
  const decoys = ['README.md', 'build.log', `${CUR}.bak`, '智汇AI_0.1.45_x64-setup.exe.tmp', 'notes-setup.exe.txt']
  const r = planArtifactInvariant([CUR, `${CUR}.sig`, ...decoys], CUR)
  assert.deepEqual(r.stale, [], `诱饵被误判为陈旧产物: ${r.stale.join(',')}`)
  assert.deepEqual(r.keep.sort(), [CUR, `${CUR}.sig`].sort())
})

test('违规:缺当前包 → 必须报', () => {
  const r = planArtifactInvariant(['智汇AI_0.1.45_x64-setup.exe'], CUR)
  assert.ok(r.violations.some((v) => v.includes(CUR)), r.violations.join(';'))
})

test('违规:缺当前签名 → 必须报(签名缺失=更新链路不可用)', () => {
  const r = planArtifactInvariant([CUR], CUR)
  assert.ok(r.violations.some((v) => v.includes('.sig')), r.violations.join(';'))
})

test('护栏:exeName 传成通配/目录形态时立即抛,不给"glob 猜包"留活路', () => {
  for (const bad of ['', '*-setup.exe', '智汇AI_0.1.44_x64-setup', undefined, '智汇AI_0.1.44_x64-setup.exe.sig']) {
    assert.throws(() => planArtifactInvariant([CUR], bad), TypeError, `应拒绝: ${String(bad)}`)
  }
})

test('集成:临时目录里跑完整"删+复算"流程,收尾必须只剩当前一对', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-artifact-inv-'))
  try {
    const names = [CUR, `${CUR}.sig`, '智汇AI_0.1.45_x64-setup.exe', '智汇AI_0.1.45_x64-setup.exe.sig', 'keep-me.log']
    for (const n of names) writeFileSync(join(dir, n), 'x')
    const { stale } = planArtifactInvariant(readdirSync(dir), CUR)
    assert.deepEqual(stale.sort(), ['智汇AI_0.1.45_x64-setup.exe', '智汇AI_0.1.45_x64-setup.exe.sig'])
    for (const f of stale) rmSync(join(dir, f), { force: true })
    const after = readdirSync(dir).sort()
    assert.deepEqual(after, [CUR, `${CUR}.sig`, 'keep-me.log'].sort(), '无关文件必须活下来')
    assert.deepEqual(planArtifactInvariant(after, CUR).violations, [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ── 构建期钩子 scripts/desktop-artifact-single.mjs 的行为(它比判据多做两件事:
//    真删文件,以及"这次构建压根没产 nsis 时不许动手"的自缚条款)──
const HOOK = new URL('../desktop-artifact-single.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const runHook = (dir, expect) =>
  execFileSync(process.execPath, [HOOK, '--dir', dir, '--expect', expect], {
    encoding: 'utf8',
    windowsHide: true,
  })

test('钩子正例:多版本共存 → 目录里只剩当前一对,无关文件活下来', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-artifact-hook-'))
  try {
    for (const n of [CUR, `${CUR}.sig`, '智汇AI_0.1.45_x64-setup.exe', '智汇AI_0.1.45_x64-setup.exe.sig', 'keep-me.log']) {
      writeFileSync(join(dir, n), 'x')
    }
    const out = runHook(dir, CUR)
    assert.ok(out.includes('唯一安装包'), out)
    assert.deepEqual(readdirSync(dir).sort(), [CUR, `${CUR}.sig`, 'keep-me.log'].sort())
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('钩子反例:目录里没有"本次应产的包"时**一个文件都不许删**', () => {
  // 这条自缚条款是钩子唯一危险的地方:若它按"缺当前包"就清空目录,
  // 那么 `tauri build --bundles app`(不产 nsis)会把上一次 nsis 构建的包连带签名一起抹掉。
  const dir = mkdtempSync(join(tmpdir(), 'ihui-artifact-hook2-'))
  const others = ['智汇AI_0.1.45_x64-setup.exe', '智汇AI_0.1.45_x64-setup.exe.sig']
  try {
    for (const n of others) writeFileSync(join(dir, n), 'x')
    const out = runHook(dir, CUR)
    assert.ok(out.includes('按不产 nsis 处理'), out)
    assert.deepEqual(readdirSync(dir).sort(), others.sort(), '不属于自己的目录必须原样保留')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('钩子反例:目录压根不存在 → 静默退出 0,不报错也不建目录', () => {
  const missing = join(tmpdir(), `ihui-artifact-none-${Date.now()}`)
  const out = execFileSync(process.execPath, [HOOK, '--dir', missing], {
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.equal(out, '')
  assert.equal(existsSync(missing), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
