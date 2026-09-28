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
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
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
  //  上限来源:该文件 HEAD 版本的违规数。
  //  2026-09-26 取材收口后,这条"实读 HEAD blob"由共用层的一次批量预取兑现(face-reader 纪律):
  //  锁的方向随之反转 —— 必须出现层的读取入口 `catBatch(`,而旧的逐文件派生形态不得复活
  //  (复活 = fork 风暴 + 裸 'git' 在服务账户 PATH 下静默失效,§5b/门 118 同型)。
  assert.match(src, /catBatch\(/, 'HEAD blob 必须经 scripts/lib/face-reader.mjs 的批量预取读取')
  assert.match(
    src,
    /from '\.\/lib\/face-reader\.mjs'/,
    '必须真的 import 取材层(只写 catBatch 字样不引层 = 尺子失效)',
  )
  assert.doesNotMatch(src, /gitRo\(\['show'/, '锚点不得回到逐文件派生 git 读内容(取材纪律退化)')
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
/**
 * 2026-09-26 取材收口:门本体 import 了共用取材层 —— 夹具只复制门一个文件会当场
 * ERR_MODULE_NOT_FOUND(第一版四条端到端全被这一条咬红)。**门依赖层**这件事因此
 * 由夹具形态本身证明:缺依赖链就跑不起来,而不是"引了层却没用它"。
 */
const GUARD_DEPS = ['scripts/lib/face-reader.mjs', 'scripts/lib/gitdir.mjs', 'scripts/lib/scratch-dir.mjs']
function copyGuardWithDeps(base) {
  const g = writeAt(base, GUARD_REL, readFileSync(GUARD, 'utf8'))
  for (const d of GUARD_DEPS) writeAt(base, d, readFileSync(join(ROOT, ...d.split('/')), 'utf8'))
  return g
}

function git(dir, args) {
  return execFileSync('git', ['-c', 'safe.directory=*', ...args], { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 60000 })
}
function writeAt(base, rel, content) {
  const p = join(base, ...rel.split('/'))
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, content)
  return p
}
/**
 * 夹具的档位表必须**两半齐**(radius.js + 它的 .d.ts):A4 从 2026-09-28 起比"角色名两处一致",
 * 只写 js 半边会让每个端到端用例都红在 A4 上 —— 那是判据有牙,不是夹具坏了。
 */
const FIX_RADIUS_JS =
  "export const RADIUS_STEPS = { xs: 2, sm: 4, DEFAULT: 8, md: 6, lg: 8, xl: 12, '2xl': 16 }\n" +
  "export const RADIUS_ROLES = { tiny: 'xs', control: 'sm', chip: 'md', card: 'lg', panel: 'xl', hero: '2xl' }\n"
const FIX_RADIUS_DTS =
  "export type RadiusStep = 'xs' | 'sm' | 'DEFAULT' | 'md' | 'lg' | 'xl' | '2xl'\n" +
  "export type RadiusRole = 'tiny' | 'control' | 'chip' | 'card' | 'panel' | 'hero'\n"
/** 造一个最小可判定的 git 仓夹具:档位表四处齐 + 一个无违规源码文件;withViolation 再加一处 B1 */
function mkFixtureRepo(base, { withViolation, extra = {} }) {
  writeAt(base, 'packages/design-tokens/src/radius.js', FIX_RADIUS_JS)
  writeAt(base, 'packages/design-tokens/src/radius.d.ts', FIX_RADIUS_DTS)
  writeAt(base, 'packages/design-tokens/src/styles/tokens.css', '@theme {\n  --radius: 0.5rem;\n  --radius-xs: 0.125rem;\n  --radius-sm: 0.25rem;\n  --radius-md: 0.375rem;\n  --radius-lg: 0.5rem;\n  --radius-xl: 0.75rem;\n  --radius-2xl: 1rem;\n}\n')
  writeAt(base, 'packages/design-tokens/src/tailwind-preset.js', 'const RADIUS_REM = {}\nexport const preset = { theme: { borderRadius: RADIUS_REM } }\n')
  writeAt(base, 'apps/web/src/card.tsx', 'export const card = { a: { borderRadius: 0 } }\n')
  if (withViolation) writeAt(base, 'apps/web/src/bad.tsx', 'export const bad = { a: { borderRadius: 8 } }\n')
  for (const [rel, content] of Object.entries(extra)) writeAt(base, rel, content)
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
    const g = copyGuardWithDeps(base)
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
    const g = copyGuardWithDeps(iso)
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
    copyGuardWithDeps(base)
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
    copyGuardWithDeps(base)
    mkFixtureRepo(base, { withViolation: true })
    const r = runGuard(join(base, ...GUARD_REL.split('/')))
    assert.equal(r.status, 1, `注入的绕档必须判红,实际 ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`)
    assert.match(r.stderr, /新增 1 处/)
    assert.match(r.stderr, /\[B1\]/)
  } finally {
    rmScratch(base)
  }
})

/**
 * 阳性对照 · 多值声明与任意属性形态(2026-09-27 O81 票⑯)。
 * 病灶不是假想:HEAD 上真实存在 5 处,门 77 一路报绿 —— ① `border-radius: var(--radius-xl) 24rpx 0 0`
 * 被"值里出现 var( 就整条放行"短路(4 处),② Tailwind 任意属性 `[border-radius:6rpx]` 卡在
 * 值前导字符类不含 `[`(1 处)。同一型缺陷的门 150 反而看见了(它按逐值读),所以"两道门互相
 * 指认无人看守"这条教训在本仓是第二次落地。
 */
test('夹具注入多值混写与任意属性形态 ⇒ 逐值点名(旧整串短路看不见)', () => {
  const base = mkScratch('r77-multi')
  try {
    copyGuardWithDeps(base)
    mkFixtureRepo(base, {
      withViolation: false,
      extra: {
        'apps/miniapp-taro/src/pages/multi.css':
          '.sheet {\n  border-radius: var(--radius-xl) 24rpx 0 0;\n}\n.bar {\n  border-radius: var(--radius-sm) 6rpx 0 0;\n}\n.ok {\n  border-radius: var(--radius-lg) var(--radius-lg) 0 0;\n}\n',
        'apps/miniapp-taro/src/pages/dot.tsx':
          'export const V = () => <View className="w-[12rpx] h-[12rpx] [border-radius:6rpx] bg-primary" />\n',
      },
    })
    const r = runGuard(join(base, ...GUARD_REL.split('/')))
    assert.equal(r.status, 1, `两处混写必须判红,实际 ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`)
    assert.match(r.stderr, /新增 3 处/, '全 var 的那一条不得被计进来(逐值判不得反过来误伤)')
    assert.match(r.stderr, /24rpx/, '多值声明的第二个角必须被点名')
    assert.match(r.stderr, /\[B3-off\][^\n]*6rpx/, '不在档位表上的角必须按偏档点名')
    assert.match(r.stderr, /dot\.tsx/, '任意属性形态 [border-radius:…] 必须在射程内')
  } finally {
    rmScratch(base)
  }
})

/**
 * 反向锁:整串 `var(` 短路不得回来。形状判据用归一化后的源码文本比较(不锚定缩进/换行),
 * 否则 prettier 一折行就造出与本判据无关的假红。
 */
test('反向锁:B3 不得回到"值里出现 var( 就整条放行"的旧形状', () => {
  const norm = (s) => s.replace(/\s+/g, ' ').trim()
  const src = norm(readFileSync(GUARD, 'utf8'))
  //  三条都用"源码里出现这段字面量文本"判,不用正则:regex 字面量里的反斜杠在测试侧再转义
  //  一次就会静默失配(失配表现为"锁着,其实恒绿")。
  assert.match(src, /for \(const part of val\.split\(/, '逐值循环必须在位')
  assert.ok(
    !src.includes('if (!/var\\(--radius|inherit|none/.test(val))'),
    '旧写法的整串短路不得回来:它让 4 处多值混写(var 之后的裸字面量)整条隐身',
  )
  assert.ok(
    !src.includes('(^|[;{}\\s])(border'),
    '值前导字符类必须含左方括号 —— 旧写法把 Tailwind 任意属性形态 [border-radius:…] 整个漏掉',
  )
  assert.ok(
    src.includes("([^;}\\n'\"\\]]+)"),
    '值字符类必须排除右方括号,否则任意属性形态会把后半串 className 当成一个值读',
  )
})

/**
 * A4 端到端(2026-09-28 O81 票㉙)。五态纯函数在门自己的 --self-test 里已经钉过,这里证的是
 * **另一件事**:角色漂移能一路走到提交链上把提交挡下,而不是只有函数会答话。
 * 立因是本票给 radius.js 加了 popover/bubble,而 .d.ts 是手抄的第二份 —— 运行时取到值、
 * TS 消费方 TS2339、`pnpm typecheck` 只在 worktree 跑,没人写那一行就永远不红。
 */
test("A4 端到端:radius.js 有新角色而 .d.ts 未跟上 ⇒ exit 1 并点名缺档", () => {
  const base = mkScratch('r77-a4')
  try {
    copyGuardWithDeps(base)
    mkFixtureRepo(base, {})
    const js = join(base, 'packages/design-tokens/src/radius.js')
    writeFileSync(js, readFileSync(js, 'utf8').replace("hero: '2xl' }", "hero: '2xl', popover: 'md' }"))
    git(base, ['add', '-A'])
    git(base, [
      '-c',
      'user.name=radius-guard-fixture',
      '-c',
      'user.email=guard-fixture@invalid',
      'commit',
      '-m',
      'a4-drift',
    ])
    const r = runGuard(join(base, ...GUARD_REL.split('/')))
    assert.equal(r.status, 1, `角色漂移必须判红,实际 ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`)
    assert.match(r.stderr + r.stdout, /RadiusRole 缺 'popover'/, '红线必须点名缺的是哪个角色')
  } finally {
    rmScratch(base)
  }
})

test('A4 端到端反向:两侧同值的同一夹具 ⇒ 判绿且不出现角色对账红线(与上一条成对)', () => {
  const base = mkScratch('r77-a4ok')
  try {
    copyGuardWithDeps(base)
    mkFixtureRepo(base, {})
    const r = runGuard(join(base, ...GUARD_REL.split('/')))
    assert.equal(r.status, 0, `一致面必须绿,实际 ${r.status}\nstdout:${r.stdout}\nstderr:${r.stderr}`)
    assert.doesNotMatch(r.stdout + r.stderr, /RadiusRole/, '一致时不该出现角色对账的红线')
  } finally {
    rmScratch(base)
  }
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
