// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * push-gate 缓存指纹(2026-11-03):门 47 挂进 push 门后,缓存必须能感知两件事——
 *   ① 门集合/参数变化(否则老缓存会把新挂的门直接放过去);
 *   ② HEAD 全树变化(门 47 判 push scope ∩ HEAD 全树,只改 scripts/ 的提交若命中旧指纹,
 *      水印门在结构上等于没挂)。
 * 这两格都只能问生产函数 `computeGateFingerprint`;测试不复制判据。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

const REPO = resolve(fileURLToPath(import.meta.url), '../../..')
const CACHE = resolve(REPO, 'scripts/lib/guardian-pushgate-cache.mjs')

const git = (cwd, args) =>
  execFileSync(process.env.GIT_EXE || 'git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

/** 在临时仓里问一次生产指纹函数(子进程设 cwd,避免 chdir 污染本进程其它用例)。 */
const fingerprintOf = (cwd, gateSpecs) => {
  const mod = new URL(`file://${CACHE.replace(/\\/g, '/')}`).href
  const src = `import { computeGateFingerprint } from ${JSON.stringify(mod)};process.stdout.write(String(computeGateFingerprint({gateSpecs:${JSON.stringify(gateSpecs)}})))`
  return execFileSync(process.execPath, ['--input-type=module', '-e', src], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

const makeRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-pushgate-fp-'))
  git(dir, ['init', '-q'])
  git(dir, ['config', 'user.email', 'fp@test.local'])
  git(dir, ['config', 'user.name', 'fp'])
  mkdirSync(join(dir, 'apps'), { recursive: true })
  mkdirSync(join(dir, 'packages'), { recursive: true })
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  writeFileSync(join(dir, 'apps', 'x.ts'), 'export const x = 1\n')
  writeFileSync(join(dir, 'packages', 'y.ts'), 'export const y = 1\n')
  writeFileSync(join(dir, 'scripts', 'note.txt'), 'note 1\n')
  writeFileSync(join(dir, 'package.json'), '{}\n')
  git(dir, ['add', '-A'])
  git(dir, ['commit', '-q', '-m', 'init'])
  return dir
}

test('PF1 门集合/参数变化 ⇒ 指纹必变(新挂门不得被老缓存放过)', () => {
  const dir = makeRepo()
  try {
    const a = fingerprintOf(dir, "47\u0000check-watermark-coverage.mjs\u0000[\"--push-scope\"]")
    const b = fingerprintOf(dir, "T1\u0000check-typecheck.mjs\u0000[]")
    assert.notEqual(a, b, '同一 HEAD、不同门集指纹相同 ⇒ 新门会被旧缓存跳过')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('PF2 只改 scripts/ 的提交(types 子树不变)⇒ 指纹必变(门 47 判的是 HEAD 全树)', () => {
  const dir = makeRepo()
  try {
    const specs = "47\u0000check-watermark-coverage.mjs\u0000[\"--push-scope\"]"
    const before = fingerprintOf(dir, specs)
    writeFileSync(join(dir, 'scripts', 'note.txt'), 'note 2\n')
    git(dir, ['add', '-A'])
    git(dir, ['commit', '-q', '-m', 'scripts only'])
    const after = fingerprintOf(dir, specs)
    assert.notEqual(
      before,
      after,
      'scripts/ 变化没有进入指纹 ⇒ 只改脚本的推送会复用到旧指纹,水印门被缓存结构性绕过',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('PF3 同一 HEAD + 同一门集 ⇒ 指纹稳定(缓存仍能在重复推送时生效)', () => {
  const dir = makeRepo()
  try {
    const specs = "47\u0000check-watermark-coverage.mjs\u0000[\"--push-scope\"]"
    const a = fingerprintOf(dir, specs)
    const b = fingerprintOf(dir, specs)
    assert.equal(a, b, '同一输入两次派生结果不同 ⇒ 缓存永远不会命中,等于砍掉缓存')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('PF4 工作区改了 scripts/ 下文件(未提交)⇒ 指纹必变(DG-02)', () => {
  const dir = makeRepo()
  try {
    const specs = "47\u0000check-watermark-coverage.mjs\u0000[\"--push-scope\"]"
    const before = fingerprintOf(dir, specs)
    writeFileSync(join(dir, 'scripts', 'note.txt'), 'dirty scripts note\n')
    const after = fingerprintOf(dir, specs)
    assert.notEqual(
      before,
      after,
      '未提交的判据/门体改动没进入指纹 ⇒ 带着脏判据也能命中旧缓存跳过 push 门',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('PF5 工作区改了根配置 package.json(未提交)⇒ 指纹必变(DG-02)', () => {
  const dir = makeRepo()
  try {
    const specs = "47\u0000check-watermark-coverage.mjs\u0000[\"--push-scope\"]"
    const before = fingerprintOf(dir, specs)
    writeFileSync(join(dir, 'package.json'), '{"scripts":{"x":"y"}}\n')
    const after = fingerprintOf(dir, specs)
    assert.notEqual(before, after, '根配置脏改动没进入指纹 ⇒ 根配置可绕过 push 门缓存')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('PF6 脏条目超过 400 ⇒ 指纹返回 null(缓存 fail-closed 弃用),不许截断冒充全量', () => {
  const dir = makeRepo()
  try {
    for (let i = 0; i < 401; i++) {
      writeFileSync(join(dir, 'apps', `dirty-${i}.txt`), `v${i}\n`)
    }
    const fp = fingerprintOf(dir, "47\u0000check-watermark-coverage.mjs\u0000[]")
    assert.equal(fp, 'null', '超限仍给出指纹 ⇒ 截断的"部分工作树"会被当成全量而假命中')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
