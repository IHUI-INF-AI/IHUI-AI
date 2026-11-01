// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-APK 2026-11-01

/**
 * RP-90 第三处形态遮蔽锁：`scripts/publish-mobile-apk.mjs` 的 `siteLegPlan()` 站点腿生产根
 * 必须问单源 `lib/prod-checkout-root.mjs`，不得再自拼 `join(devEnvRoot(repoRoot),'ihui-prod')`。
 *
 * 病灶（实测形态，G-814433 之后）：`devEnvRoot` 的选形态粒度是「仓内 `.DevEnv` **根目录**在不在」；
 * 当 `backups`/`Temp` 搬进仓内、而 `ihui-prod` 仍留盘根侧时，根在 ⇒ 返回 `<repo>/.DevEnv` ⇒
 * 自拼候选**恒缺** ⇒ `chosen` 静默落 `repo` 源（主仓影子目录）⇒ 站点腿把包发到**没人服务的影子目录**，
 * 而账面全绿（不是报错，是选错了源）。
 *
 * 合成面（不在 C:\ / G:\ 之类根上建任何真实目录，不碰真生产 checkout）：
 *   · 真实临时仓根 `<tmp>/sapk-xxxx/repo`，其内**真建** `.DevEnv/` 与仓内影子落点（病灶前提成立）；
 *   · 「盘根侧那份」也不写死在真盘根：单源第 3 条回落路径由 `parse(repoRoot).root + /DevEnv` 推导，
 *     本文件把这个前缀**重锚**到夹具内的真实目录 `<tmp>/sapk-xxxx/drive/`，注入的 `exists` 用**真
 *     `existsSync`** 去打重锚后的路径 —— 目录全是真的，只是盘根锚点搬进了夹具（否则只能去 C:\ 建目录）。
 *
 * 牙（正例 + 反向例，已实跑变异验证，记录见 `.ihui-agent/seats/S-APK.md`）：
 *   正例：同一面上 `chosen.source` 必须是 `prod-checkout` 且 `dir` 指向盘根侧那份；
 *   反向例：把生产文件改回 `join(devEnvRoot(repoRoot),'ihui-prod')`（本文件 `legacySiteLegPlan` 是逐字
 *     镜像）⇒ `chosen.source` 变成 `repo` ⇒ ① 翻红。
 *   失效方向（2026-11-02 收紧）：生产根缺失而主仓影子在（⑦）/ 单源抛错（⑤）⇒ `chosen=null`，
 *     main 以 2 退出并点名已试路径（⑧）—— 主仓影子目录不再当兜底腿。
 */
import { test, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, parse } from 'node:path'
import { fileURLToPath } from 'node:url'
import { devEnvRoot } from '../seal-c-root-stray.mjs'
import { maskComments } from '../lib/code-mask.mjs'
import { __test__ as pub } from '../publish-mobile-apk.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', 'publish-mobile-apk.mjs')

const norm = (p) => String(p ?? '').replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase()

// —— 合成面 ——
// 不用 lib/scratch-dir.mjs 的 mkScratch：落点含 `ihui-scratch` 段，而 devEnvRoot 对「仓根在 scratch
// 夹具内」显式抛错 ⇒ 造不出本格的病灶形态（那一格由 ⑤ 单独测）。
const FIXTURE = mkdtempSync(join(tmpdir(), 'sapk-siteleg-'))
const FIX = (() => {
  const repo = join(FIXTURE, 'repo')
  // 病灶前提：仓内 `.DevEnv` **根目录**真在（devEnvRoot 据此选仓内形态）
  mkdirSync(join(repo, '.DevEnv'), { recursive: true })
  // 主仓影子落点真在（旧写法会静默选中的那一边）
  mkdirSync(join(repo, pub.SITE_LEG.RelDir), { recursive: true })
  // 单源契约第 3 条的盘根形态（推导而来，不写死盘符）。
  // ⚠ 只重锚 `<盘根>/DevEnv/ihui-prod` 这一族，**不**锚 `<盘根>/DevEnv` 整棵：本机 tmpdir 实测是
  // `D:\DevEnv\Temp`（就在真 DevEnv 根里），锚整棵会把夹具仓自己一起改写，测出来的就是假面。
  const driveProdRoot = join(parse(repo).root, 'DevEnv', 'ihui-prod')
  const reanchored = join(FIXTURE, 'drive')
  // 盘根侧那份的真实目录（重锚落地处）
  mkdirSync(join(reanchored, pub.SITE_LEG.RelDir), { recursive: true })
  return { repo, driveProdRoot, reanchored, repoShadow: join(repo, pub.SITE_LEG.RelDir) }
})()

/** 把「盘根/DevEnv/ihui-prod」前缀重锚进夹具；其余路径原样 ⇒ exists 仍是真 existsSync。 */
const reanchor = (p) => {
  const s = String(p)
  const d = FIX.driveProdRoot
  if (norm(s) === norm(d)) return FIX.reanchored
  if (norm(s).startsWith(norm(d) + '/')) return join(FIX.reanchored, s.slice(d.length).replace(/^[\\/]+/, ''))
  return p
}
const realExists = (p) => existsSync(reanchor(p))

/** 期望的盘根侧落点（由单源契约推导，不写死盘符）。 */
const DRIVE_PROD_DIR = join(FIX.driveProdRoot, pub.SITE_LEG.RelDir)

const prevDevEnv = process.env.IHUI_DEVENV_ROOT
beforeEach(() => {
  // devEnvRoot 先读 process.env.IHUI_DEVENV_ROOT（显式覆盖=强声明），会绕过形态推导 ⇒ 本文件必须清干净。
  delete process.env.IHUI_DEVENV_ROOT
})
after(() => {
  if (prevDevEnv !== undefined) process.env.IHUI_DEVENV_ROOT = prevDevEnv
  try {
    rmSync(FIXTURE, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } catch (e) {
    console.warn(`⚠ S-APK 夹具未清理：${FIXTURE} —— ${String(e?.message ?? e).slice(0, 120)}`)
  }
})

/** 回退版站点腿的逐字镜像（= 修复前的写法）。不是被测对象，是"变成什么样该红"的标尺。 */
function legacySiteLegPlan({ repoRoot }) {
  const candidates = []
  let prodDir = null
  try {
    prodDir = join(devEnvRoot(repoRoot), 'ihui-prod')
  } catch {
    prodDir = null
  }
  if (prodDir) candidates.push({ source: 'prod-checkout', dir: join(prodDir, pub.SITE_LEG.RelDir) })
  candidates.push({ source: 'repo', dir: join(repoRoot, pub.SITE_LEG.RelDir) })
  const hit = candidates.find((c) => realExists(c.dir))
  return { candidates, chosen: hit ?? null }
}

// —— ⓪ 前提：合成面真的复现了病灶（否则本文件的断言无判别力）——
test('⓪ 前提：仓内 .DevEnv 在 ⇒ devEnvRoot 取仓内形态；盘根侧与仓内影子是两处不同目录', () => {
  assert.equal(norm(devEnvRoot(FIX.repo)), norm(join(FIX.repo, '.DevEnv')), '合成面必须真的触发仓内形态')
  assert.notEqual(norm(FIX.driveProdRoot), norm(join(FIX.repo, '.DevEnv', 'ihui-prod')), '两形态必须是不同目录')
  assert.ok(existsSync(FIX.repoShadow), '主仓影子落点必须真在（旧写法就是静默选它）')
  assert.ok(existsSync(reanchor(DRIVE_PROD_DIR)), '盘根侧落点必须真在（重锚后的真实目录）')
})

// —— ① 正例 ——
test('① 正例：仓内 .DevEnv 在 + ihui-prod 在盘根侧 ⇒ chosen 必须取 prod-checkout 且指向盘根侧那份', () => {
  const plan = pub.siteLegPlan({ repoRoot: FIX.repo, exists: realExists, env: {} })
  assert.ok(plan.chosen, '两处都在，不得给 null')
  assert.equal(plan.chosen.source, 'prod-checkout', '静默落 repo 源 = 把包发到没人服务的影子目录，而账面是绿的')
  assert.equal(plan.chosen.dir, DRIVE_PROD_DIR, '落点必须是盘根侧那份生产 checkout 的站点目录')
  assert.notEqual(norm(plan.chosen.dir), norm(FIX.repoShadow), '绝不能是主仓影子目录')
  // 候选序仍是 prod 在前、repo 兜底在后（repo 兜底源是有意保留的降级腿）
  assert.deepEqual(plan.candidates.map((c) => c.source), ['prod-checkout', 'repo'])
})

// —— ② 反向例：回退写法在同一面上必须落到 repo 源 ⇒ ① 的断言据此必红 ——
test('② 反向例：join(devEnvRoot,ihui-prod) 在同一合成面上 ⇒ chosen.source 变 repo（① 据此有牙）', () => {
  const legacy = legacySiteLegPlan({ repoRoot: FIX.repo })
  assert.equal(legacy.chosen.source, 'repo', '回退写法在病灶形态上 prod 候选恒缺')
  assert.equal(norm(legacy.chosen.dir), norm(FIX.repoShadow), '回退后选中主仓影子 —— 正是本票要治的那一格')
  assert.notEqual(legacy.chosen.source, 'prod-checkout', '与 ① 的期望对撞：两条不可能同时成立')
})

// —— ③ 两处都不存在 ⇒ null（调用方必须失败，不许"跳过站点腿还报成功"）——
test('③ 两处都不存在 ⇒ chosen === null 且候选仍是两条', () => {
  const plan = pub.siteLegPlan({ repoRoot: FIX.repo, exists: () => false, env: {} })
  assert.equal(plan.chosen, null, '两处都不在时必须给 null，由调用方判未判定')
  assert.deepEqual(plan.candidates.map((c) => c.source), ['prod-checkout', 'repo'])
})

// —— ④ IHUI_SITE_CDN_DIR 覆盖仍原样回传，返回形状不增删键 ——
test('④ IHUI_SITE_CDN_DIR 覆盖仍生效（返回形状 {candidates,chosen,envOverride} 未变）', () => {
  const plan = pub.siteLegPlan({ repoRoot: FIX.repo, exists: realExists, env: { IHUI_SITE_CDN_DIR: '  Q:/cdn-out  ' } })
  assert.equal(plan.envOverride, 'Q:/cdn-out', '覆盖值必须 trim 后回传')
  assert.deepEqual(Object.keys(plan).sort(), ['candidates', 'chosen', 'envOverride'], '返回形状不得增删键（有消费方读 chosen.source）')
  assert.equal(pub.siteLegPlan({ repoRoot: FIX.repo, exists: realExists, env: {} }).envOverride, null)
  assert.equal(pub.siteLegPlan({ repoRoot: FIX.repo, exists: realExists, env: { IHUI_SITE_CDN_DIR: '   ' } }).envOverride, null)
})

// —— ⑤ 单源抛错 ⇒ 不炸、chosen=null（repo 只留诊断），且**不静默** ——
test('⑤ prodCheckoutRoot 抛错（仓根在 scratch 夹具内）⇒ 不炸、chosen=null、只点名 repo 已试路径且有告警一行', () => {
  const warns = []
  const orig = console.warn
  console.warn = (...a) => warns.push(a.join(' '))
  let plan
  try {
    plan = pub.siteLegPlan({
      repoRoot: join('X:', 'ihui-scratch', 'repo'),
      exists: (p) => norm(p) === norm(join('X:', 'ihui-scratch', 'repo', pub.SITE_LEG.RelDir)),
      env: {},
    })
  } finally {
    console.warn = orig
  }
  assert.deepEqual(plan.candidates.map((c) => c.source), ['repo'], 'prod 源取不到时无法点名它，但 repo 已试路径仍要留')
  assert.equal(plan.chosen, null, '取不到生产根 = 未判定；repo 影子目录再在也不许顶上（静默回落=发到没人服务的目录）')
  assert.equal(warns.length, 1, '取不到必须喊一行（静默 = 把"取不到"读成"没有"）')
  assert.match(warns[0], /生产 checkout 根取不到/)
  assert.match(warns[0], /未判定,不回落主仓影子目录/)
})

// —— ⑥ 源码形状锁：回退到自拼会在这里立刻红（§0.9 造好没装车=没有）——
test('⑥ 形状锁：siteLegPlan 必须问单源，不得再出现 devEnvRoot 自拼或 .DevEnv 字面', () => {
  const src = maskComments(readFileSync(SRC, 'utf8'))
  assert.match(src, /import\s*\{\s*prodCheckoutRoot\s*\}\s*from\s*'\.\/lib\/prod-checkout-root\.mjs'/, '站点腿必须 import 单源')
  assert.match(src, /prodCheckoutRoot\(\s*repoRoot\s*,\s*exists\s*,\s*env\s*\)/, 'exists/env 必须一并下透单源（同一构造面）')
  assert.doesNotMatch(src, /devEnvRoot\(/, '不得再调用 devEnvRoot 自拼生产根')
  assert.doesNotMatch(src, /'\.DevEnv'/, "不得出现 '.DevEnv' 字面自拼")
  assert.doesNotMatch(src, /resolveDevEnvRoot/, 'resolveDevEnvRoot 兼容入参已删（唯一调用方已同改）')
})

// —— ⑦ 生产根缺失但主仓影子在 ⇒ chosen 必须 null（旧写法会静默选中影子）——
test('⑦ 生产根缺失 + 主仓影子存在 ⇒ chosen===null，已试路径点名 prod-checkout 与 repo', () => {
  // 只让主仓影子"存在"：prod 候选（<repo>/.DevEnv/ihui-prod 与盘根侧）都不在。
  const plan = pub.siteLegPlan({
    repoRoot: FIX.repo,
    exists: (p) => norm(p) === norm(FIX.repoShadow),
    env: {},
  })
  assert.equal(plan.chosen, null, '生产根缺失时绝不能选主仓影子目录（线上 cdn-server 的 --root 不是它）')
  assert.deepEqual(plan.candidates.map((c) => c.source), ['prod-checkout', 'repo'])
  assert.ok(
    plan.candidates.some((c) => c.source === 'prod-checkout' && norm(c.dir).includes('/ihui-prod/')),
    '已试路径必须点名生产 checkout 候选（判定面可见，不是"没找过"）',
  )
  assert.equal(norm(plan.candidates.find((c) => c.source === 'repo').dir), norm(FIX.repoShadow), 'repo 路径必须原样列出供诊断')
})

// —— ⑧ main 契约：生产根缺失 ⇒ exit 2，并打印已试路径（不落包、不联网）——
test('⑧ main：生产根缺失 ⇒ exit 2 且点名 prod-checkout/repo 已试路径（不选主仓影子）', () => {
  const apkDir = mkdtempSync(join(tmpdir(), 'sapk-apk-'))
  const envRoot = mkdtempSync(join(tmpdir(), 'sapk-devenv-'))
  try {
    const apk = join(apkDir, 'app-release.apk')
    writeFileSync(apk, Buffer.alloc(1024, 0x41))
    // IHUI_DEVENV_ROOT = 强声明且该根下无 ihui-prod ⇒ 生产根必缺，主仓影子即使存在也不得顶上。
    const r = spawnSync(
      process.execPath,
      [SRC, '--apk', apk, '--version', '0.0.9', '--version-code', '26102816'],
      { cwd: join(HERE, '..', '..'), encoding: 'utf8', timeout: 30000, env: { ...process.env, IHUI_DEVENV_ROOT: envRoot } },
    )
    assert.equal(r.status, 2, '站点落点未判定必须 exit 2（不是 0 假绿，也不是 1 混同执行失败）')
    const err = String(r.stderr || '')
    assert.match(err, /未判定: 站点 CDN 落点不存在/)
    assert.match(err, /已试: /)
    assert.match(err, /prod-checkout=/)
    assert.match(err, /repo=/)
    assert.match(err, /不选它/)
    assert.ok(!existsSync(join(envRoot, 'ihui-prod')), '测试结束前该生产根仍不存在（没有顺手造出假面）')
  } finally {
    rmSync(apkDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    rmSync(envRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
