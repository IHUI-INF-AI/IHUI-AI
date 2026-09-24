// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 77 的镜像测试:整跑 --self-test 并钉住「判据必须在真实仓生效」两条端到端断言,
// 外加「空扫不记绿」三型端到端证明(2026-09-25 补:隔离检出里 git 向上逃逸 → ls-files
// 返回"退出码 0 + 空清单" → 整道门判据零执行却打印 ✅ —— 对齐守门 78/94/99/101 的 exit 2 口径)
import { execFileSync, spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, dirname } from 'node:path'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUARD = join(ROOT, 'scripts/check-radius-single-source.mjs')

test('守门 77 自检全通过(含真实档位表端到端对账 + TS 内嵌 CSS 与同行多声明)', () => {
  const out = execFileSync(process.execPath, [GUARD, '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.match(out, /全部 (\d+) 例通过/)
  assert.doesNotMatch(out, /❌/)
})

test('档位表四处同源:tokens.css 与 radius.js 逐档同值', async () => {
  const mod = await import(`file://${join(ROOT, 'packages/design-tokens/src/radius.js').replaceAll('\\', '/')}`)
  const css = readFileSync(join(ROOT, 'packages/design-tokens/src/styles/tokens.css'), 'utf8')
  const expect = {
    '--radius': mod.RADIUS_STEPS.DEFAULT,
    '--radius-xs': mod.RADIUS_STEPS.xs,
    '--radius-sm': mod.RADIUS_STEPS.sm,
    '--radius-md': mod.RADIUS_STEPS.md,
    '--radius-lg': mod.RADIUS_STEPS.lg,
    '--radius-xl': mod.RADIUS_STEPS.xl,
    '--radius-2xl': mod.RADIUS_STEPS['2xl'],
  }
  for (const [name, px] of Object.entries(expect)) {
    const m = new RegExp(`^\\s*${name}:\\s*([0-9.]+)rem`, 'm').exec(css)
    assert.ok(m, `tokens.css 缺少 ${name} 定义`)
    assert.equal(Number(m[1]) * 16, px, `tokens.css ${name} 与 radius.js 漂移`)
  }
})

test('tailwind preset 不得重新内联档位字面量(必须引用 RADIUS_REM)', () => {
  const preset = readFileSync(join(ROOT, 'packages/design-tokens/src/tailwind-preset.js'), 'utf8')
  assert.match(preset, /borderRadius:\s*RADIUS_REM\s*,/)
  assert.doesNotMatch(preset, /borderRadius:\s*\{[\s\S]{0,200}?0\.375rem/)
})

test('守门 77 的棘轮锚点必须是 HEAD 自身而不是静态清单(装车证明)', () => {
  const src = readFileSync(GUARD, 'utf8')
  //  上限来源:该文件 HEAD 版本的违规数
  assert.match(src, /gitRo\(\['show', `HEAD:\$\{rel\}`\]\)/, '锚点必须实读 HEAD blob')
  assert.match(src, /const tolOf = \(rel\) => Math\.max\(/, 'tolOf 必须存在并被使用')
  assert.match(src, /isStaged \|\| FILES_MODE \? headCountOf\(rel\) : 0/)
  //  全量审计判 HEAD 内容:否则并行会话滞后的旧草稿会被记成本仓债务(误红 → --no-verify 常态化)
  assert.match(src, /const auditHead = !isStaged && !FILES_MODE/)
  assert.match(src, /export function splitFresh/)
  //  静态清单只是兜底,HEAD 清零后必须为空 —— 留着非空清单等于给"整文件回写旧基线"放行
  const b = JSON.parse(readFileSync(join(ROOT, 'scripts/radius-single-source-baseline.json'), 'utf8'))
  assert.equal(b.sites.length, 0, `基线应为空,实际 ${b.sites.length} 处`)
  //  自检必须钉住误红、误绿两个方向
  const out = execFileSync(process.execPath, [GUARD, '--self-test'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000 })
  assert.match(out, /锚点:HEAD 已迁完\(0 处\)/)
  assert.match(out, /锚点:HEAD 本来 3 处、待提交仍 3 处/)
  assert.match(out, /全部 \d+ 例通过/)
})

// ── 「空扫不记绿」端到端四例(2026-09-25)──
// 缺陷原型:隔离检出(git archive HEAD 解出、无 .git)里 git 向上逃逸到外层仓,
// `git ls-files` 从该 cwd 返回「退出码 0 + 空清单」——不是报错。旧实现把空清单当合法值,
// 棘轮过滤把候选整批滤成 0,判据一条没跑却打印「✅ 通过」exit 0。

const GUARD_REL = 'scripts/check-radius-single-source.mjs'

function git(dir, args) {
  return execFileSync('git', ['-c', 'safe.directory=*', ...args], { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 60000 })
}
function writeAt(base, rel, content) {
  const p = join(base, ...rel.split('/'))
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, content)
  return p
}
/** 造一个最小可判定的 git 仓夹具:档位表四处齐 + 一个无违规源码文件;withViolation 再加一处 B1 */
function mkFixtureRepo(base, { withViolation }) {
  writeAt(base, 'packages/design-tokens/src/radius.js', "export const RADIUS_STEPS = { xs: 2, sm: 4, DEFAULT: 8, md: 6, lg: 8, xl: 12, '2xl': 16 }\n")
  writeAt(base, 'packages/design-tokens/src/styles/tokens.css', '@theme {\n  --radius: 0.5rem;\n  --radius-xs: 0.125rem;\n  --radius-sm: 0.25rem;\n  --radius-md: 0.375rem;\n  --radius-lg: 0.5rem;\n  --radius-xl: 0.75rem;\n  --radius-2xl: 1rem;\n}\n')
  writeAt(base, 'packages/design-tokens/src/tailwind-preset.js', 'const RADIUS_REM = {}\nexport const preset = { theme: { borderRadius: RADIUS_REM } }\n')
  writeAt(base, 'apps/web/src/card.tsx', 'export const card = { a: { borderRadius: 0 } }\n')
  if (withViolation) writeAt(base, 'apps/web/src/bad.tsx', 'export const bad = { a: { borderRadius: 8 } }\n')
  git(base, ['init', '-b', 'main'])
  git(base, ['add', '-A'])
  git(base, ['-c', 'user.name=radius-guard-fixture', '-c', 'user.email=guard-fixture@invalid', 'commit', '-m', 'fixture'])
}
function runGuard(guardPath) {
  return spawnSync(process.execPath, [guardPath], { encoding: 'utf8', windowsHide: true, timeout: 120000 })
}

test('无 git 环境(任何仓之外)⇒ exit 2 且输出含「无法判定」,不得记绿', () => {
  const base = mkScratch('r77-nogit')
  try {
    const g = writeAt(base, GUARD_REL, readFileSync(GUARD, 'utf8'))
    const r = runGuard(g)
    assert.equal(r.status, 2, `期望 exit 2(无法判定),实际 ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`)
    assert.match(r.stderr, /无法判定/)
    assert.doesNotMatch(`${r.stdout}`, /对账通过/, '取材面失效时绝不允许打印通过结论')
  } finally {
    rmScratch(base)
  }
})

test('隔离检出(无 .git 而祖先目录是 git 仓 ⇒ ls-files 假空集而非报错)⇒ exit 2「无法判定」', () => {
  const base = mkScratch('r77-escape')
  try {
    // 外层先立一个真 git 仓(内容与本缺陷无关),再把守门复制进无 .git 的子目录 ——
    // 子目录里 `git ls-files` 逃逸到外层仓、按 cwd 收窄返回空清单:这正是缺陷的机制本体。
    git(base, ['init', '-b', 'main'])
    writeAt(base, 'outer-readme.md', 'outer repo anchor\n')
    git(base, ['add', '-A'])
    git(base, ['-c', 'user.name=radius-guard-fixture', '-c', 'user.email=guard-fixture@invalid', 'commit', '-m', 'outer'])
    const iso = join(base, 'iso-checkout')
    mkdirSync(iso, { recursive: true })
    const g = writeAt(iso, GUARD_REL, readFileSync(GUARD, 'utf8'))
    const r = runGuard(g)
    assert.equal(r.status, 2, `逃逸到外层仓的假空清单必须判"无法判定"(exit 2)而非记绿,实际 ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`)
    assert.match(r.stderr, /无法判定/)
    assert.doesNotMatch(r.stdout, /对账通过/)
  } finally {
    rmScratch(base)
  }
})

test('判据真的在跑:有 git 的真仓夹具、0 违规 ⇒ exit 0 且扫描计数非 0(区分"执行了、命中 0")', () => {
  const base = mkScratch('r77-green')
  try {
    copyFileSync(GUARD, writeAt(base, GUARD_REL, 'placeholder'))
    mkFixtureRepo(base, { withViolation: false })
    const r = runGuard(join(base, ...GUARD_REL.split('/')))
    assert.equal(r.status, 0, `夹具应判绿\nstdout:${r.stdout}\nstderr:${r.stderr}`)
    assert.match(r.stdout, /扫描 [1-9]\d* 文件/, '结论行的候选计数必须 >0 —— 证明判据真在执行,不是空扫')
    assert.match(r.stdout, /对账通过/)
  } finally {
    rmScratch(base)
  }
})

test('注入一处绕档取用(borderRadius: 8 数字字面量)⇒ exit 1 并点名 B1(阳性对照)', () => {
  const base = mkScratch('r77-red')
  try {
    copyFileSync(GUARD, writeAt(base, GUARD_REL, 'placeholder'))
    mkFixtureRepo(base, { withViolation: true })
    const r = runGuard(join(base, ...GUARD_REL.split('/')))
    assert.equal(r.status, 1, `注入的绕档必须判红,实际 ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`)
    assert.match(r.stderr, /新增 1 处/)
    assert.match(r.stderr, /\[B1\]/)
  } finally {
    rmScratch(base)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
