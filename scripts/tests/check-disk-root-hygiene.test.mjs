#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试 —— scripts/check-disk-root-hygiene.mjs
 *
 * 为什么必须有它:`--self-test` 证明的是**纯函数会给答案**,证不了 main() 有人问它。
 * 本门的三态分流(违规 / 未判定 / 本机不适用)全部住在 main() 的根循环里 ——
 * 2026-10-05 那次把"另一台机的盘根读不到"算成违规、并把 §5b 禁删的外置 gitdir
 * 喊成"按 §12d 回收"的假指控,纯函数面一条都不红。所以这里跑**真 CLI + 真配置夹具**。
 *
 * 零副作用:配置与替身登记面落 mkScratch(§26 唯一临时物落点),读真盘根只 readdirSync
 * 一级不写不删。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { currentDriveRoot, deriveSanctioned, normalizeRootKey, auditDiskRoot, auditWorktreeRegistry } from '../check-disk-root-hygiene.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts', 'check-disk-root-hygiene.mjs')

function runCli(args) {
  const r = execFileSync(process.execPath, [GATE, ...args], {
    encoding: 'utf8',
    cwd: REPO,
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return r
}

// execFileSync 在非零退出时抛错,而本门的问责档就是要 rc=1 —— 三态一律从这里取。
function runCliCaptured(args) {
  try {
    const out = runCli(args)
    return { rc: 0, out }
  } catch (e) {
    return { rc: e.status ?? -1, out: String(e.stdout ?? '') + String(e.stderr ?? '') }
  }
}

test('T1 --self-test 必须真跑完并全绿(有求值的布尔,不是恒绿)', () => {
  const out = runCli(['--self-test'])
  assert.doesNotMatch(out, /❌/, `自检有失败项:\n${out}`)
  const m = out.match(/自检:pass (\d+) \/ fail (\d+)/)
  assert.ok(m, `末行缺 pass/fail 汇总:\n${out.slice(-200)}`)
  assert.equal(Number(m[2]), 0, 'fail 必须为 0')
  assert.ok(Number(m[1]) >= 12, `自检用例数不得倒退(现 ${m[1]})`)
})

test('T2 三态分流:声明的盘根在本机不存在 ⇒ 计"不适用",不得计违规、不得吞掉别的维', () => {
  const dir = mkScratch('drh-t2-')
  try {
    const fake = 'Z:\\definitely-not-a-real-root-xyz'
    const cfg = join(dir, 'cfg.json')
    writeFileSync(
      cfg,
      JSON.stringify({
        roots: { [fake]: { allow: [], note: '夹具:本机不可能有的根' } },
        worktreePolicy: { sanctionedPrefixes: [], exemptPaths: [] },
      }),
    )
    const wt = join(dir, 'wt.txt')
    writeFileSync(wt, 'worktree D:/IHUI-AI-git-repo\nHEAD abc\nbranch refs/heads/main\n\n')
    const j = JSON.parse(runCli(['--json', '--config', cfg, '--wt-file', wt]))
    assert.equal(j.counts.diskRootStray, 0, `不存在的盘根不得算违规:${JSON.stringify(j.violations)}`)
    assert.equal(j.counts.diskRootNotApplicable, 1, '必须单独计"不适用"')
    // 当前仓所在盘没在夹具里申报 ⇒ 该维未判定,所以整轮不出合格证 —— 这是设计,不是红。
    assert.ok(j.counts.diskRootUndetermined >= 1, '本机盘根未申报 ⇒ 必须落未判定')
    assert.equal(j.counts.worktreeUndetermined, 0, 'porcelain 取到了就不算未判定')
    assert.equal(j.verdict, 'undetermined', `verdict 应为 undetermined,实得 ${j.verdict}`)
  } finally {
    rmScratch(dir)
  }
})

test('T3 违规仍然要出得来:一维不适用/未判定不得把另一维已量到的违规吞掉', () => {
  const dir = mkScratch('drh-t3-')
  try {
    const here = currentDriveRoot()
    assert.ok(here, 'currentDriveRoot() 在本机必须解析得出来')
    const entries = readdirSync(here)
    assert.ok(entries.length > 0, '真盘根至少有一个条目才能构造违规')
    // 故意漏掉**第一项**(Windows 上恒为 `$RECYCLE.BIN`,不会在两次 readdir 之间消失)。
    // 取"最后一条"会让夹具自己变成 race:盘根条目会被别的会话加/删,那时 names.includes()
    // 就会假红 —— 那是假阳,不是判据有牙。新增条目只会多算,不影响本用例的断言方向。
    const dropped = entries[0]
    const keep = entries.filter((e) => e !== dropped)
    const cfg = join(dir, 'cfg.json')
    writeFileSync(
      cfg,
      JSON.stringify({
        roots: {
          [here]: { allow: keep, note: '夹具:漏一个条目' },
          'Z:\\nope-xyz': { allow: [], note: '夹具:本机没有的盘' },
        },
        worktreePolicy: { sanctionedPrefixes: [], exemptPaths: [] },
      }),
    )
    const wt = join(dir, 'wt.txt')
    // 两条:第一条按 git 契约是主工作树(恒豁免),第二条才是本用例要点名的落点外。
    writeFileSync(wt, 'worktree A:/main\nHEAD abc\n\nworktree anything-not-sanctioned\nHEAD def\n\n')
    const j = JSON.parse(runCli(['--json', '--config', cfg, '--wt-file', wt]))
    const names = j.violations.filter((v) => v.kind === 'stray-root-entry').map((v) => v.entry)
    assert.ok(names.includes(dropped), `被漏报的盘根条目必须点名 ${dropped},实得 ${JSON.stringify(names)}`)
    assert.equal(j.counts.diskRootNotApplicable, 1, '另一维不适用照常单独计')
    assert.ok(j.violations.some((v) => v.kind === 'worktree-outside-sanctioned-root'), 'worktree 违规不得被吞')
    assert.equal(j.verdict, 'red', '有真违规就必须是 red(未判定/不适用不降级它)')
  } finally {
    rmScratch(dir)
  }
})

test('T4 全申报 + 登记面干净 ⇒ green;--strict 才允许 exit 0', () => {
  const dir = mkScratch('drh-t4-')
  try {
    const cfg = join(dir, 'cfg.json')
    writeFileSync(
      cfg,
      JSON.stringify({
        roots: { 'Z:\\nope-xyz': { allow: [], note: '夹具' } },
        worktreePolicy: { sanctionedPrefixes: [], exemptPaths: [] },
      }),
    )
    const derived = deriveSanctioned()
    assert.ok(derived, 'deriveSanctioned() 在本机必须算得出来')
    const wt = join(dir, 'wt.txt')
    writeFileSync(wt, `worktree ${derived.exempt[1]}\nHEAD abc\nbranch refs/heads/main\n\n`)
    // 走 --root 测试通道拿确定性的"全申报"盘根:真盘根随时会被别的会话加条目,
    // 拿它断言 green 会造出一条**天生 flaky** 的判红用例(那是假红,不是判据有牙)。
    const j = JSON.parse(runCli(['--json', '--config', cfg, '--wt-file', wt, '--root', dir]))
    assert.equal(j.verdict, 'green', `应为 green,实得 ${JSON.stringify(j)}`)
    const cap = runCliCaptured(['--strict', '--json', '--config', cfg, '--wt-file', wt, '--root', dir])
    assert.equal(cap.rc, 0, `全绿时 --strict 应 exit 0,实得 ${cap.rc}`)
  } finally {
    rmScratch(dir)
  }
})

test('T5 本机盘根未申报 ⇒ --strict 拒绝出合格证(exit 1),不得静默 exit 0', () => {
  const dir = mkScratch('drh-t5-')
  try {
    const cfg = join(dir, 'cfg.json')
    writeFileSync(
      cfg,
      JSON.stringify({
        roots: { 'Z:\\nope-xyz': { allow: [], note: '夹具:只声明别的机器的盘' } },
        worktreePolicy: { sanctionedPrefixes: [], exemptPaths: [] },
      }),
    )
    const wt = join(dir, 'wt.txt')
    writeFileSync(wt, 'worktree D:/IHUI-AI-git-repo\nHEAD abc\n\n')
    const cap = runCliCaptured(['--strict', '--config', cfg, '--wt-file', wt])
    assert.equal(cap.rc, 1, `未判定在问责档必须 exit 1,实得 ${cap.rc} —— 把"没判"写成"判过了"是本仓最高频失效型`)
    assert.match(cap.out, /本机盘根未在 config 申报|未判定/, '要喊出为什么未判定')
  } finally {
    rmScratch(dir)
  }
})

test('T6 真配置在本机必须可跑(默认档不抛错、三态计数齐备)', () => {
  const out = runCli(['--json'])
  const j = JSON.parse(out)
  for (const k of ['diskRootStray', 'worktreeOutside', 'diskRootUndetermined', 'worktreeUndetermined', 'diskRootNotApplicable']) {
    assert.equal(typeof j.counts?.[k], 'number', `counts.${k} 缺失 ⇒ 消费侧(git-guardian)会读成 undefined`)
  }
  assert.ok(['red', 'undetermined', 'green'].includes(j.verdict), `verdict 非法:${j.verdict}`)
  assert.equal(Array.isArray(j.violations), true)
  assert.equal(Array.isArray(j.undetermined), true)
})

test('T7 外置 gitdir 不得被喊成"待回收"(§5b 禁删项 —— 本门最坏失效方向)', () => {
  const out = runCli([])
  assert.doesNotMatch(out, /git-repo\s*(\(prunable\))?\s*⇒/, `真实登记面里 gitdir 被点名待回收:\n${out}`)
  assert.doesNotMatch(out, /worktree 落点外: .*IHUI-AI-git-repo/, '外置 gitdir 必须被结构性/派生两层之一豁免')
})

test('T8 形状锁:H2 豁免链三层必须在位,不得退回"只认配置盘符"', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /const isMainWorktree = seenPaths === 0/, '结构性第一层(git 契约:porcelain 首条=主工作树)')
  assert.match(src, /export function deriveSanctioned/, '派生第二层的出口在位')
  assert.match(src, /import \{ resolveGitdir \} from '\.\/lib\/gitdir\.mjs'/, '派生只能引那一份实现,禁止再抄一套盘符推导')
  assert.match(src, /auditWorktreeRegistry\(porcelain, policy, derived\)/, 'main() 必须真把 derived 喂进去 —— 只定义不传参等于没修')
  assert.match(src, /const derivedMissing = !argv\['wt-file'\] && derived === null/, '派生失败要降级成未判定,不得继续判红')
})

test('T9 形状锁:H1 三桶不得并回一个数组', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /return \{ violations, undetermined \}/, 'auditDiskRoot 必须返回两桶')
  assert.doesNotMatch(src, /return \[\{ kind: 'undetermined', entry: rootDir/, '旧的"未判定混进违规数组"写法不得回来')
  assert.match(src, /verdict = violationCount \? 'red' : undetermined\.length \? 'undetermined' : 'green'/, 'verdict 顺序:违规 > 未判定 > 绿')
})

test('T10 消费侧:git-guardian 的未判定分支必须逐维报名(旧写法只印 worktree 一维)', () => {
  const g = readFileSync(join(REPO, 'scripts', 'git-guardian.mjs'), 'utf8')
  assert.match(g, /parsed\.verdict === 'undetermined'/, '守护仍须识别未判定')
  assert.match(g, /盘根维 \$\{uN\}、worktree 维 \$\{wN\};不适用盘根 \$\{nN\}/, '三族要各自量出来,不得只报一维')
  assert.doesNotMatch(g, /worktree 维度未判定=\$\{parsed\.counts\.worktreeUndetermined\}/, '旧的"只印一维"写法不得回来(它把没申报写成已判过)')
})

test('T13 消费侧:告警去重身份用档位而不是原始计数(实测 34 封、30 分钟一封的成因)', () => {
  const g = readFileSync(join(REPO, 'scripts', 'git-guardian.mjs'), 'utf8')
  assert.match(g, /dedupKey: `stray=\$\{tier\(c\.diskRootStray\)\};wtOutside=\$\{tier\(c\.worktreeOutside\)\}`/, '身份必须走 tier()')
  assert.doesNotMatch(g, /stray=\$\{parsed\.counts\.diskRootStray\}/, '原始计数不得再进身份 —— 它在多会话并行时每轮都变,4 小时窗口形同虚设')
  assert.match(g, /function tier\(n\)/, '档位函数在位')
  assert.match(g, /禁止删除/, '信文必须写明"本信不构成删除依据"(§5b 禁删项不能被一封告警指挥去删恢复源)')
})

test('T11 反向对照:纯函数面对不存在目录与空 allowlist 的结论不得互串', () => {
  const r1 = auditDiskRoot(join(REPO, 'config'), [])
  assert.equal(r1.violations.length, readdirSync(join(REPO, 'config')).length, '空白名单 ⇒ config 全部条目都是外流')
  assert.equal(r1.undetermined.length, 0, '可读目录不得落未判定')
  const v = auditWorktreeRegistry(
    'worktree A:/main\nHEAD a\n\nworktree A:/x/y\nHEAD b\n\nworktree C:/out\nHEAD c\n\n',
    { sanctionedPrefixes: ['A:/x'], exemptPaths: [] },
  )
  assert.equal(v.length, 1, `首条=主工作树、第二条命中前缀 ⇒ 只有 C:/out 该算外流,实得 ${JSON.stringify(v)}`)
  assert.equal(v[0].path, 'C:/out', `点名对象错了:${v[0].path}`)
})

test('T15 键形归一必须跟平台走(必需 job 在 ubuntu-latest,写死反斜杠会让盘根永久未判定)', () => {
  // parse/resolve 绑平台 ⇒ 在 Windows 上喂不进 POSIX 路径;归一式单独成纯函数就是为了这一条
  // **跨平台可证**。旧实现写死 `'\\'`:Windows 上恰好对,Linux 上算出 `\`,config 里
  // 无论申报什么键都匹配不上 ⇒ 盘根维度永久落"未判定"(不冒红,但也永远不出合格证)。
  assert.equal(normalizeRootKey('/', '/'), '/', `POSIX 根必须归一成 "/",实得 ${JSON.stringify(normalizeRootKey('/', '/'))}`)
  assert.equal(normalizeRootKey('D:\\', '\\'), 'D:\\', 'Windows 根必须归一成 "D:\\\\"')
  assert.equal(normalizeRootKey('D:/', '\\'), 'D:\\', '混写分隔符不得影响键形')
  assert.equal(normalizeRootKey(null, '/'), null, '取不到根必须报 null,不得凭空造一个键')
  assert.notEqual(normalizeRootKey('/', '\\'), '/', '写死反斜杠那一型必须与 POSIX 正解不同形(否则本用例没有牙)')
})

test('T14 派生豁免的行为证明:本机仓内 .worktrees 的登记项不得被喊成落点外(带变异对照)', () => {
  // 生产档 main() 只在"真读登记面"时才喂 derived(--wt-file 是人工夹具通道),
  // 所以 CLI 档证不了这一层 —— 这里直接喂真实派生集,并**同时**跑一次不喂的对照。
  const derived = deriveSanctioned()
  assert.ok(derived, 'deriveSanctioned() 在本机必须算得出来')
  const landing = derived.prefixes[0]
  const txt = `worktree ${derived.exempt[0]}\nHEAD abc\n\nworktree ${landing}/wt-live\nHEAD def\ndetached\n\n`
  const withDerived = auditWorktreeRegistry(txt, { exemptPaths: [], sanctionedPrefixes: [] }, derived)
  assert.equal(withDerived.length, 0, `仓内 .worktrees 必须被派生层豁免,实得 ${JSON.stringify(withDerived)}`)
  // 变异对照:摘掉派生层 ⇒ 同一份登记面必须翻红(证明上面那个 0 是判据给的,不是没看见)
  const withoutDerived = auditWorktreeRegistry(txt, { exemptPaths: [], sanctionedPrefixes: [] })
  assert.ok(withoutDerived.length >= 1, '变异失效:摘掉派生层仍然 0 违规 ⇒ 这条断言没有牙')
})

test('T12 前置:真盘根可读性判据不得把"目录里有被拒条目"当成读不到', () => {
  const here = currentDriveRoot()
  assert.ok(here && existsSync(here), '本机盘根必须存在,否则上面几条夹具都在对着空气判')
  const r = auditDiskRoot(here, [])
  assert.equal(r.undetermined.length, 0, '真盘根不得落 undetermined')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
