#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:check-prod-checkout-foreign-work(生产签出外来工作只读尺子)。
 * §22c:判据全部 import 源脚本 __test__,不在本文件复制第二份。
 * 夹具四型(duplicate / foreign / staged-untracked / unjudged)用 mkScratch() 在工作区外建一次性
 * git 仓(**禁止在仓库树内 git init**,门 208);git 身份写**该仓 local config**(CI 无全局 user.*,
 * 2026-10-21 实测 21 枚用例因此第一步抛死);远端 = 本地另一枚 scratch 仓(git remote add + 本地
 * update-ref,绝不真打网络)。
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as P } from '../check-prod-checkout-foreign-work.mjs'

const results = []
const test = (name, fn) => results.push({ name, run: fn })

function git(cwd, args) {
  const r = spawnSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} exit ${r.status}: ${String(r.stderr).slice(0, 200)}`)
  return String(r.stdout).trim()
}

/** 一次性 git 夹具:local 身份 + main 分支 + 首提交(路径固定的三枚文件)。 */
function initRepo(prefix, files) {
  const dir = mkScratch(prefix)
  git(dir, ['init', '-b', 'main'])
  git(dir, ['config', 'user.email', 'fixture@ihui.test']) // CI 无全局 user.*,身份必须写 local
  git(dir, ['config', 'user.name', 'fixture'])
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(dir, p, '..'), { recursive: true })
    writeFileSync(join(dir, p), c)
  }
  git(dir, ['add', '.'])
  git(dir, ['commit', '-m', 'base'])
  return dir
}

let prodDir
let originDir

function setup() {
  originDir = initRepo('pfw-origin-', { 'a.txt': 'A v1\n', 'b.txt': 'B v1\n', 'c.txt': 'C v1\n' })
  prodDir = initRepo('pfw-prod-', { 'a.txt': 'A v1\n', 'b.txt': 'B v1\n', 'c.txt': 'C v1\n' })
  git(prodDir, ['remote', 'add', 'origin', originDir.replace(/\\/g, '/')])
  // 推进远端:a.txt → v2(此版本只存在于 origin 一侧)
  writeFileSync(join(originDir, 'a.txt'), 'A v2 origin only\n')
  git(originDir, ['add', 'a.txt'])
  git(originDir, ['commit', '-m', 'advance a'])
  // 本地路径 fetch(file transport,不走网络)把 origin 的对象与 refs/remotes/origin/main 带进 prod
  git(prodDir, ['fetch', 'origin', 'main'])

  // 四型夹具(在生产签出内铺,尺子只读探测):
  writeFileSync(join(prodDir, 'a.txt'), 'A v2 origin only\n') // duplicate:工作区 blob == origin tip blob
  writeFileSync(join(prodDir, 'b.txt'), 'B v3 nowhere\n') // foreign:两侧都取不到
  writeFileSync(join(prodDir, 'fresh.txt'), 'F untracked new\n') // untracked(全新未跟踪:只计数不判定,计数本身就是存续性信号)
  writeFileSync(join(prodDir, 'new.txt'), 'N staged new\n')
  git(prodDir, ['add', 'new.txt']) // staged-untracked:远端没有该路径 ∧ 已入索引
  rmSync(join(prodDir, 'c.txt')) // unjudged:删除型,工作区 blob 取不到,单列不并桶
}

function cleanup() {
  for (const d of [prodDir, originDir]) if (d) rmScratch(d, { bestEffort: true })
}

// 夹具是"最小 git 仓",不是完整项目树 ⇒ 身份判据(isProjectCheckout 的两个仓标记)会把它们读成
// 第三方仓并跳过。这些用例测的是**判定链本身**(probe/verdict/归因),所以显式声明夹具属于判定面;
// 身份那一维另有独立用例覆盖,且带反向对照:带标记的根必须入面(判据过紧 = 静默假绿)。
const FIXTURE_IS_PROJECT = { isProject: () => true }

// —— 四型夹具端到端 ——
test('四型夹具:duplicate/foreign/staged/unjudged 各归其桶,脏态判 dirty exit 1', () => {
  const r = P.probeProdCheckout(prodDir)
  assert.equal(r.state, 'dirty')
  assert.deepEqual(r.counts, { foreign: 1, duplicate: 1, staged: 1, untracked: 1, unjudged: 1 })
  assert.equal(r.duplicates[0].path, 'a.txt')
  assert.ok(r.foreign.map((x) => x.path).includes('b.txt'))
  assert.ok(!r.foreign.map((x) => x.path).includes('fresh.txt'), 'untracked 只计数,绝不进逐项判定面')
  const b = r.foreign.find((x) => x.path === 'b.txt')
  assert.match(b.blob, /^[0-9a-f]{12}$/)
  assert.ok(b.lineDiff && b.lineDiff.added >= 1, 'foreign 条目带行数差')
  assert.equal(r.staged[0].path, 'new.txt')
  assert.equal(r.unjudged[0].path, 'c.txt')
  assert.match(r.line, /^PROBE-RESULT state=dirty foreign=1 duplicate=1 staged=1 untracked=1 unjudged=1$/)
  assert.equal(P.exitFor(r), 1)
})

test('干净签出:0 脏路径才算绿(exit 0)', () => {
  const clean = initRepo('pfw-clean-', { 'x.txt': 'x\n' })
  try {
    const r = P.probeProdCheckout(clean)
    assert.equal(r.state, 'clean')
    assert.equal(r.counts.foreign + r.counts.duplicate + r.counts.staged + r.counts.untracked + r.counts.unjudged, 0)
    assert.match(r.line, /^PROBE-RESULT state=clean foreign=0 duplicate=0 staged=0 untracked=0 unjudged=0$/)
    assert.equal(P.exitFor(r), 0)
  } finally {
    rmScratch(clean, { bestEffort: true })
  }
})

test('unjudged 整轮:非 git 目录 ⇒ state=unjudged exit 2,绝不冒绿', () => {
  const notRepo = mkScratch('pfw-notrepo-')
  try {
    const r = P.probeProdCheckout(notRepo)
    assert.equal(r.state, 'unjudged')
    assert.ok(r.why)
    assert.equal(P.exitFor(r), 2)
  } finally {
    rmScratch(notRepo, { bestEffort: true })
  }
})

test('洪水未跟踪:200 枚 `??` 只计数不判定,结论行必须带真实计数、绝不塌成 unjudged', () => {
  const dir = initRepo('pfw-flood-', { 'x.txt': 'x\n' })
  try {
    for (let i = 0; i < 200; i++) writeFileSync(join(dir, `f${i}.txt`), `flood ${i}\n`)
    const r = P.probeProdCheckout(dir)
    assert.equal(r.state, 'clean')
    assert.equal(r.counts.untracked, 200)
    assert.equal(r.counts.foreign, 0)
    assert.match(r.line, /^PROBE-RESULT state=clean foreign=0 duplicate=0 staged=0 untracked=200 unjudged=0$/)
    assert.equal(P.exitFor(r), 0)
    // 变异对照(形状锁):摘掉 `??` 过滤器,这 200 枚会进逐项判据——无 origin 的仓里 ls-tree 失败⇒整轮
    // unjudged,有 origin 时⇒200 枚 foreign 假阳性。过滤器是唯一防线,钉死在源码形状上。
    const src = readFileSync(new URL('../check-prod-checkout-foreign-work.mjs', import.meta.url), 'utf8')
    assert.ok(src.includes(`e.status !== '??'`), 'probe 必须把 `??` 条目挡在逐项判据之外(只计数)')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

// —— 变异对照(判据摘松/摘紧各一次,结论按预期翻转)——
test('变异·摘松(丢掉 HEAD 侧只比 origin):workBlob==headBlob 的条目必须仍判 duplicate', () => {
  // 若判据被摘松成"只比 origin",下面这条(workBlob == headBlob ∧ != originBlob)会被误判 foreign
  const v = P.classifyEntry({ path: 'a.txt', status: ' M', workBlob: 'h'.repeat(40), idxBlob: 'h'.repeat(40), idxExists: true, headBlob: 'h'.repeat(40), originBlob: 'o'.repeat(40), inHead: true, inOrigin: true })
  assert.equal(v.bucket, 'duplicate')
})

test('变异·摘紧(还要求索引里也有条目):untracked 新文件必须仍判 foreign', () => {
  // 若判据被摘紧成"idxBlob 也两侧取不到才算 foreign",下面这条(无索引项)会被漏报成 unjudged/duplicate
  const v = P.classifyEntry({ path: 'fresh.txt', status: '??', workBlob: 'w'.repeat(40), idxBlob: null, idxExists: false, headBlob: null, originBlob: null, inHead: false, inOrigin: false })
  assert.equal(v.bucket, 'foreign')
})

test('classifyEntry:删除型(workBlob 取不到)单列 unjudged;索引 blob 不在对象库 ⇒ unjudged', () => {
  assert.equal(P.classifyEntry({ path: 'c.txt', status: ' D', workBlob: null, idxBlob: 'i'.repeat(40), idxExists: true, headBlob: 'i'.repeat(40), originBlob: 'i'.repeat(40), inHead: true, inOrigin: true }).bucket, 'unjudged')
  assert.equal(P.classifyEntry({ path: 'z.txt', status: 'M ', workBlob: 'w'.repeat(40), idxBlob: 'q'.repeat(40), idxExists: false, headBlob: 'h'.repeat(40), originBlob: 'o'.repeat(40), inHead: true, inOrigin: true }).bucket, 'unjudged')
})

// —— 坑①②的形状锁 ——
test('坑①:源码不得拼 ref:path 冒号形态(MSYS 会把冒号重写成反斜杠 ⇒ 假报不存在)', () => {
  const src = readFileSync(new URL('../check-prod-checkout-foreign-work.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /ORIGIN_REF\s*\+\s*['"`]:/, '不得 ORIGIN_REF + ":" 拼冒号形态')
  assert.doesNotMatch(src, /(HEAD|ORIGIN_REF)['"`]\s*\+\s*['"`]:/, '不得 ref 字面量 + ":" 拼冒号形态')
  assert.doesNotMatch(src, /`[^`]*\$\{(?:ORIGIN_REF|HEAD)\}:/, '不得模板串 ref:${…}: 拼冒号形态')
  assert.ok(src.includes("'ls-tree'"), '树内 blob 一律走 ls-tree argv')
})

test('坑②:blob 存在性只认 cat-file -e 的退出码结论(实现里真实接线)', () => {
  const src = readFileSync(new URL('../check-prod-checkout-foreign-work.mjs', import.meta.url), 'utf8')
  assert.ok(src.includes("'cat-file', '-e'"), 'cat-file -e 必须在判据实现里')
  assert.ok(src.includes('idxExists = ce.code === 0'), '存在性 = 退出码结论,不解析输出文本')
})

test('§12g/§22d 形状锁:spawnSync 全带 windowsHide + 显式 stdio;isDirectRun 守卫 + __test__ 出口', () => {
  const src = readFileSync(new URL('../check-prod-checkout-foreign-work.mjs', import.meta.url), 'utf8')
  assert.ok(src.includes('pathToFileURL(process.argv[1]).href'), 'isDirectRun 用 pathToFileURL')
  assert.ok(src.includes('export const __test__'))
  const spawns = src.split('spawnSync(').length - 1
  assert.ok(spawns >= 1)
  assert.equal((src.match(/windowsHide: true/g) || []).length, spawns, '每处 spawnSync 都带 windowsHide')
  assert.equal((src.match(/stdio: \['ignore', 'pipe', 'pipe'\]/g) || []).length, spawns, '每处 spawnSync 都显式 stdio')
  assert.ok(!src.includes("input:"), '本器不带 input ⇒ stdin 恒 ignore(门 193 input↔stdin 维不适用)')
})

test('resolveProdCheckout:取不到 nssm 值 ⇒ unjudged,绝不回落默认目录', () => {
  const r = P.resolveProdCheckout({ exists: () => false, nssmGet: () => ({ spawnError: 'ENOENT', stdoutBuf: Buffer.alloc(0), stderrBuf: Buffer.alloc(0) }) })
  assert.equal(r.state, 'unjudged')
  assert.ok(r.why.includes('AppDirectory') && r.why.includes('AppParameters'))
  // AppDirectory 給出合法根 ⇒ 直接采纳,不再问 AppParameters
  const roots = new Set()
  const ok = P.resolveProdCheckout({
    exists: (p) => (roots.add(p), true),
    isDirectory: () => true,
    nssmGet: (param) =>
      param === 'AppDirectory'
        ? { code: 0, stdoutBuf: Buffer.from('D:/fake-prod-root', 'utf16le'), stderrBuf: Buffer.alloc(0) }
        : { code: 1, stdoutBuf: Buffer.alloc(0), stderrBuf: Buffer.alloc(0) },
  })
  assert.equal(ok.state, 'ok')
  assert.equal(ok.via, 'AppDirectory')
  // utf16 夹具必须真被 decodeNssm 按 NUL 密度解出来,而不是 utf8 坏串碰巧过 exists
  assert.ok(roots.has('D:/fake-prod-root'))
})

test('parsePorcelainZ:重命名条目吃掉双 NUL 段,目的路径为准', () => {
  const es = P.parsePorcelainZ('R  new.txt\0old.txt\0 M b.txt\0')
  assert.deepEqual(es, [{ status: 'R ', path: 'new.txt' }, { status: ' M', path: 'b.txt' }])
})

// ===========================================================================
// 2026-10-24 归因改造(治"连续 52 小时判不出却无人收敛"):取材通道、归因码、判定面为空
// 三条纪律各一组用例。假注册表用**与 reg.exe 实跑同形**的 stdout(`HKEY_LOCAL_MACHINE\…` 全名,
// 不是 `HKLM\…` 缩写 —— 缩写正是当天把自己判成 svc-enum-empty 的那一发)。
// ===========================================================================

/** 假 reg query:按键名查表,查不到即 exit 1(与真 reg 对不存在的键同形;结论只认退出码)。
 *  表用**全名**登记(`HKEY_LOCAL_MACHINE\…`,即 reg 真实回显的形态),查询串先过 expandRegRoot
 *  —— 与本尺同一把归一化判据,不在测试里另抄一份缩写表(§22c)。 */
function fakeRegQuery(table) {
  const norm = (s) => P.expandRegRoot(s).toUpperCase().replace(/[\\/]+/g, '\\')
  const byNorm = new Map(Object.entries(table).map(([k, v]) => [norm(k), v]))
  return (key) => {
    const hit = byNorm.get(norm(key))
    if (hit === undefined) return { code: 1, stdout: '', stderr: '找不到指定的注册表项或值' }
    return { code: 0, stdout: hit, stderr: '' }
  }
}

const SVC_PARENT = 'HKLM\\SYSTEM\\CurrentControlSet\\Services'
const SVC_FULL = 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services'
/** 服务枚举档 stdout:父键一行 + 每枚服务一行(全名形态)。 */
const enumText = (names) => [SVC_FULL, ...names.map((n) => `${SVC_FULL}\\${n}`)].join('\r\n') + '\r\n'
/** 单枚服务键的值档 stdout。 */
const svcText = (name, values) =>
  `${SVC_FULL}\\${name}\r\n` + Object.entries(values).map(([k, v]) => `    ${k}    REG_SZ    ${v}`).join('\r\n') + '\r\n'

test('归因·逐型点名:reg 不在位 / 枚举 0 枚 / 服务键读不到 / 根不是签出 —— 四种各一个码,绝不揉成一桶', () => {
  const noReg = P.surveyProdCheckouts({ reg: null, env: {}, exists: () => false, conventionalRoots: { state: 'measured', roots: [] } })
  assert.equal(noReg.state, 'unjudged')
  assert.deepEqual(noReg.causes, ['reg-not-located'])

  const emptyEnum = P.surveyProdCheckouts({
    reg: 'C:/fake/reg.exe',
    env: {},
    exists: () => true,
    regQuery: fakeRegQuery({ [SVC_PARENT.toUpperCase()]: enumText([]) }),
    conventionalRoots: { state: 'measured', roots: [] },
  })
  assert.equal(emptyEnum.state, 'unjudged', '枚举到 0 枚服务 ⇒ 判通道坏,不判"真没服务"(§0.3)')
  assert.deepEqual(emptyEnum.causes, ['svc-enum-empty'])

  // 候选服务键本身读不到(nssm 之外的服务没有 Parameters 子键 —— 那一档不许算通道坏)
  const keyFail = P.surveyProdCheckouts({
    reg: 'C:/fake/reg.exe',
    env: {},
    exists: () => true,
    regQuery: fakeRegQuery({ [SVC_PARENT.toUpperCase()]: enumText(['IHUI-GONE']) }),
    conventionalRoots: { state: 'measured', roots: [] },
  })
  assert.equal(keyFail.state, 'unjudged')
  assert.match(keyFail.causes.join('|'), /svc-key-fail:IHUI-GONE\(exit 1\)/)

  // 取到了目录但不是带 .git 的签出 ⇒ root-unusable 点名到具体路径,不折成"取不到"
  const badRoot = P.surveyProdCheckouts({
    reg: 'C:/fake/reg.exe',
    env: {},
    exists: () => false, // 目录不存在 ⇒ 向上也找不到 .git
    regQuery: fakeRegQuery({
      [SVC_PARENT.toUpperCase()]: enumText(['IHUI-WEB']),
      [`${SVC_FULL}\\IHUI-WEB`.toUpperCase()]: svcText('IHUI-WEB', { AppDirectory: 'D:/nowhere/checkout' }),
    }),
    conventionalRoots: { state: 'measured', roots: [] },
  })
  assert.ok(badRoot.evidence.unusable.some((u) => u.includes('D:/nowhere/checkout')), 'unusable 逐条留证')
})

test('阳性对照①(发现器整链真判红):假注册表把服务指向一枚真实 scratch 独立签出 ⇒ 判出 foreign', () => {
  // 夹具:一枚"生产签出"(带 origin)+ 一处两侧都取不到的改动 —— 走的是**发现器**通道,
  // 不是 --prod-root 人工通道;证明归因改造后的取材面本身能判出事。
  const appDir = join(prodDir, 'deploy', 'prod-bundle') // 实测形态:nssm 的 cwd 常写成签出根的下一层
  mkdirSync(appDir, { recursive: true })
  const table = {
    [SVC_PARENT.toUpperCase()]: enumText(['IHUI-DEPLOYLOOP', 'Spooler']),
    [`${SVC_FULL}\\IHUI-DEPLOYLOOP`.toUpperCase()]: svcText('IHUI-DEPLOYLOOP', {
      ImagePath: '"C:\\windows\\system32\\nssm.exe" IHUI-DEPLOYLOOP',
      AppDirectory: appDir,
      AppParameters: `-NoProfile -ExecutionPolicy Bypass -File "${join(prodDir, 'deploy', 'win', 'ihui-deploy-loop.ps1')}" -Daemon`,
    }),
  }
  const survey = P.surveyProdCheckouts({
    reg: 'C:/fake/reg.exe',
    env: {},
    regQuery: fakeRegQuery(table),
    conventionalRoots: { state: 'measured', roots: [] },
    repoRoot: 'G:/IHUI-AI',
  })
  assert.equal(survey.state, 'ok', `应经注册表发现独立签出,实际 ${survey.state} / ${JSON.stringify(survey.causes)}`)
  assert.equal(survey.roots.length, 1)
  assert.equal(P.normPath(survey.roots[0].value), P.normPath(prodDir), 'AppDirectory 落在下一层时必须向上折到带 .git 的根')
  const v = P.verdictFromSurvey(survey, FIXTURE_IS_PROJECT)
  assert.equal(v.state, 'dirty', '四型夹具里有 foreign ⇒ 发现器整链必须判红')
  assert.ok(v.foreign.some((x) => x.path === 'b.txt' && P.normPath(x.root) === P.normPath(prodDir)), 'foreign 条目带所属根(多根不混淆)')
  assert.equal(v.surface, 'judged')
  assert.equal(P.exitFor(v), 1)
})

test('阳性对照②(反向):服务全部直跑本仓工作树 ⇒ "量出来的空",与"没量到"不同形', () => {
  const self = P.REPO_ROOT
  // exists 只承认"本仓根带 .git"这一件事,别的一律没有:桩若给宽(needs-startsWith),
  // 向上折根会停在 apps/api 那种中间层 ⇒ 假夹具变成"独立签出"⇒ 这条用例会在真工作树上跑 git。
  const exists = (p) => P.normPath(p) === P.normPath(join(self, '.git'))
  const survey = P.surveyProdCheckouts({
    reg: 'C:/fake/reg.exe',
    env: {},
    exists,
    regQuery: fakeRegQuery({
      [SVC_PARENT.toUpperCase()]: enumText(['IHUI-API', 'IHUI-WEB']),
      [`${SVC_FULL}\\IHUI-API`.toUpperCase()]: svcText('IHUI-API', { ImagePath: `cmd.exe /c "cd /d ${self}\\apps\\api && node src/index.ts"` }),
      [`${SVC_FULL}\\IHUI-WEB`.toUpperCase()]: svcText('IHUI-WEB', { ImagePath: `cmd.exe /c "cd /d ${self}\\apps\\web && node next dev"` }),
    }),
    conventionalRoots: { state: 'measured', roots: [] },
  })
  assert.equal(survey.state, 'absent', '自树让路 + 约定目录没有 ⇒ 判定面为空(不是未判定)')
  assert.deepEqual(survey.causes, [])
  assert.ok(survey.evidence.selfExcluded.length > 0, '必须留下"为什么判空"的自树让路证据')
  assert.equal(P.normPath(survey.evidence.selfExcluded[0]), P.normPath(self), '让路的是仓根本身,不是某个中间层')
  assert.equal(survey.evidence.servicesEnumerated, 2, '枚举计数本身是"量过了"的凭据')
  assert.equal(survey.evidence.conventionalProbe, 'measured', '约定目录"量过但没有"也要留成 measured,不得读成未取')
  assert.ok(survey.evidence.channels.includes('conventional-dir'), '通道 C 量过即入证据(空集也是量过)')
  assert.match(survey.why, /量过·无此目录/, '人读 why 不得把量过写成"未取"')
  const v = P.verdictFromSurvey(survey)
  assert.equal(v.state, 'clean')
  assert.equal(v.surface, 'absent-surveyed')
  assert.match(v.line, /surface=absent-surveyed undet=na$/)
  assert.equal(P.exitFor(v), 0)
})

test('通道 D(人工/复核):指定根成立即判;根不成立当场未判定,绝不静默回落自动发现', () => {
  const ok = P.surveyProdCheckouts({ overrideRoot: prodDir, env: {}, conventionalRoots: { state: 'measured', roots: [] } })
  assert.equal(ok.state, 'ok')
  assert.equal(ok.via, 'override')
  const v = P.verdictFromSurvey(ok, FIXTURE_IS_PROJECT)
  assert.equal(v.state, 'dirty', '--prod-root 是真通道,不是"只影响发现不影响判定"的装饰')
  assert.ok(v.foreign.length > 0)

  let registryWasTouched = false
  // 用一个"没有任何 .git 祖先"的路径:夹具仓的兄弟目录会被向上折回夹具本身(那是**正确**语义
  // —— `--prod-root <签出>/子目录` 就该折到签出根),拿它当"不成立"的输入等于在测自己的误解。
  const refused = P.surveyProdCheckouts({
    overrideRoot: 'Q:\\ihui-no-such-checkout',
    env: {},
    reg: 'C:/fake/reg.exe',
    regQuery: () => {
      registryWasTouched = true
      return { code: 0, stdout: '', stderr: '' }
    },
  })
  assert.equal(refused.state, 'unjudged')
  assert.match(refused.causes.join('|'), /override-root-unusable:/)
  assert.equal(registryWasTouched, false, '人工指定的根不成立时绝不回落自动发现(§0.3:不猜)')
  // 反向对照:同一把尺子对"签出的子目录"必须折到根,而不是拒判
  const child = P.surveyProdCheckouts({ overrideRoot: join(prodDir, 'apps', 'api'), env: {}, conventionalRoots: { state: 'measured', roots: [] } })
  assert.equal(child.state, 'ok')
  assert.equal(P.normPath(child.roots[0].value), P.normPath(prodDir))
})

test('verdictLine:归因码进结论行,空格折 _;无码写 na(结论行恒纯 ASCII 供派发侧切词)', () => {
  const c = { foreign: 1, duplicate: 0, staged: 0, untracked: 2, unjudged: 0 }
  assert.equal(P.verdictLine('dirty', c, { surface: 'judged', undet: [] }), 'PROBE-RESULT state=dirty foreign=1 duplicate=0 staged=0 untracked=2 unjudged=0 surface=judged undet=na')
  const l = P.verdictLine('unjudged', { foreign: 0, duplicate: 0, staged: 0, untracked: 0, unjudged: 0 }, { surface: 'none', undet: ['root-unusable:C:\\Program Files\\x'] })
  assert.ok(l.includes('root-unusable:C:\\Program_Files\\x'), `空格必须折掉:${l}`)
  assert.doesNotMatch(l, /[^\x00-\x7F]/, '结论行必须纯 ASCII')
  // 真实 unjudged 归因码会带中文(stderr / devEnvRoot 抛错原文):结论行必须折成 _,原文留给 JSON undet
  const cn = P.verdictLine('unjudged', { foreign: 0, duplicate: 0, staged: 0, untracked: 0, unjudged: 0 }, {
    surface: 'none',
    undet: ['dir-survey-refused(仓库根本身在夹具内)', 'probe-unjudged:G:/x(git-status-fail(exit 1): 中文错误)'],
  })
  assert.doesNotMatch(cn, /[^\x00-\x7F]/, `中文归因也必须压成 ASCII:${cn}`)
  assert.ok(cn.includes('dir-survey-refused(') && cn.includes('probe-unjudged:G:/x'), '码位主干保留,只折非 ASCII 段')
})

test('reg 取值形态锁:HKEY 全名 vs HKLM 缩写(当天把自查判成 svc-enum-empty 的那一发)、多行值、Parameters 覆盖', () => {
  const names = P.listServiceNamesFromQuery(enumText(['IHUI-AI-SERVICE', 'WSearch']), SVC_PARENT)
  assert.deepEqual(names.names, ['IHUI-AI-SERVICE', 'WSearch'], '缩写父键必须能对上 reg 回显的全名')
  assert.equal(P.listServiceNamesFromQuery(`${SVC_FULL}\r\n`, SVC_PARENT).names.length, 0)
  assert.equal(P.expandRegRoot('HKLM\\A'), 'HKEY_LOCAL_MACHINE\\A')
  assert.equal(P.expandRegRoot('HKCU\\A'), 'HKEY_CURRENT_USER\\A')
  // 孙键不算服务名
  const nested = P.listServiceNamesFromQuery(`${SVC_FULL}\\IHUI-API\r\n${SVC_FULL}\\IHUI-API\\Parameters\r\n`, SVC_PARENT)
  assert.deepEqual(nested.names, ['IHUI-API'])
  const knownRoot = 'D:\\DevEnv\\ihui-prod'
  const existsOnly = (p) => P.normPath(p) === P.normPath(join(knownRoot, '.git'))
  const derived = P.rootsFromServiceValues(
    new Map([
      ['IMAGEPATH', { type: 'REG_EXPAND_SZ', value: '"D:\\tools\\nssm.exe" IHUI-DEPLOYLOOP' }],
      ['APPPARAMETERS', { type: 'REG_SZ', value: `-File "${join(knownRoot, 'deploy', 'win', 'ihui-deploy-loop.ps1')}" -Daemon` }],
    ]),
    { exists: existsOnly },
  )
  assert.equal(derived.nssmBin.toLowerCase().replace(/\\/g, '/'), 'd:/tools/nssm.exe', 'nssm 位置按该服务 ImagePath 现读(§5e)')
  assert.equal(derived.roots.length, 1, `脚本向上折根与 \\deploy\\ 截断必须收敛到同一枚根:${JSON.stringify(derived.roots)}`)
  assert.equal(P.normPath(derived.roots[0].value), P.normPath(knownRoot))
  const cutOnly = P.rootsFromServiceValues(new Map([['APPPARAMETERS', { type: 'REG_SZ', value: `-File "${join(knownRoot, 'deploy', 'win', 'x.ps1')}"` }]]), { exists: existsOnly })
  assert.ok(cutOnly.roots.every((r) => P.normPath(r.value) === P.normPath(knownRoot)), '旧 \\deploy\\ 截断规则不许再交出带前缀的脏根')
})

test('通道 C 被拒时点名归因(不许静默当"没有");能推导时按实测给空集', () => {
  const table = {
    [SVC_PARENT.toUpperCase()]: enumText(['IHUI-OTHER']),
    [`${SVC_FULL}\\IHUI-OTHER`.toUpperCase()]: svcText('IHUI-OTHER', { AppDirectory: 'D:/nope' }),
  }
  const refused = P.surveyProdCheckouts({
    reg: 'C:/fake/reg.exe',
    env: {},
    exists: () => false,
    regQuery: fakeRegQuery(table),
    conventionalRoots: { state: 'refused', roots: [], reason: '仓库根本身在夹具内' },
  })
  assert.equal(refused.state, 'unjudged', '通道 C 被拒 ⇒ 未判定,不得冒充"判定面为空"')
  assert.ok(refused.causes.some((c) => c.startsWith('dir-survey-refused(')), JSON.stringify(refused.causes))
  // 同形夹具的盘上探测:目录不带 .git ⇒ measured 空集(不是 refused),该走 absent 那一档
  const conv = P.conventionalProdRoots(P.REPO_ROOT, { exists: () => false })
  assert.equal(conv.state, 'measured')
  assert.deepEqual(conv.roots, [])
  // 反向对照(这台机最可能的复活形态):约定目录 `<DevEnv>/ihui-prod` 回来了,而承载体服务没装
  // ⇒ 通道 C 必须把它纳进判定面并**真判出事**,不许因为"没有服务"就判空
  const revived = P.surveyProdCheckouts({
    reg: 'C:/fake/reg.exe',
    env: {},
    regQuery: fakeRegQuery({ [SVC_PARENT.toUpperCase()]: enumText(['Spooler', 'WSearch']) }),
    conventionalRoots: { state: 'measured', roots: [prodDir] },
    repoRoot: 'G:/IHUI-AI',
  })
  assert.equal(revived.state, 'ok', '约定目录命中 ⇒ 进判定面')
  assert.equal(P.normPath(revived.roots[0].value), P.normPath(prodDir))
  const rv = P.verdictFromSurvey(revived, FIXTURE_IS_PROJECT)
  assert.equal(rv.state, 'dirty')
  assert.ok(rv.foreign.length > 0 && rv.foreign[0].root, '复活的生产签出里的外来改动必须被点名(带所属根)')
})

test('形状锁:多通道判据只有一份 —— 派发侧不再从散文里猜根因(git-guardian-prod-foreign 的日志行仍是它的,尺子负责 undet=)', () => {
  const src = readFileSync(new URL('../check-prod-checkout-foreign-work.mjs', import.meta.url), 'utf8')
  assert.ok(src.includes("causes.push(`svc-enum-empty`)") || src.includes("'svc-enum-empty'"), '枚举到 0 的归因码必须在判据里')
  assert.ok(src.includes('surface=absent-surveyed') || src.includes("'absent-surveyed'"), '判定面为空必须是独立一档,不与 unjudged 同形')
  assert.ok(!/process\.cwd\(\)/.test(src), 'ROOT 由脚本自身位置推导(守门 70),不吃共享工作区 cwd')
  assert.ok(src.includes("import { devEnvRoot } from './seal-c-root-stray.mjs'"), 'DevEnv 根复用唯一出口(§0.6)')
})

test('isProjectCheckout:两个仓标记同在才算本项目签出(第三方仓不得冒充生产签出)', () => {
  const dir = mkScratch('pfw-id-')
  try {
    const a = join(dir, 'apps', 'api', 'package.json')
    const b = join(dir, 'packages', 'database', 'package.json')
    mkdirSync(join(dir, 'apps', 'api'), { recursive: true })
    mkdirSync(join(dir, 'packages', 'database'), { recursive: true })
    writeFileSync(a, '{}')
    writeFileSync(b, '{}')
    assert.equal(P.isProjectCheckout(dir), true)
    rmSync(b)
    assert.equal(P.isProjectCheckout(dir), false, '只有一个标记不算本项目')
  } finally {
    rmScratch(dir)
  }
})

test('非本项目根(RSSHub 等)必须**跳过**而不是未判定 ⇒ 不再每轮寄“未判定”信', () => {
  const dir = mkScratch('pfw-skip-')
  try {
    const merged = P.probeAllRoots([{ value: dir, via: 'test' }])
    assert.equal(merged.roots[0].state, 'not-project')
    assert.equal(merged.state, 'clean', '第三方仓不是判定面缺失,不得把整轮读成 unjudged')
    assert.equal(merged.causes.length, 0)
    assert.deepEqual(merged.notProject, [dir])
  } finally {
    rmScratch(dir)
  }
})

test('反向对照:带仓标记的根走默认判据必须入面 —— 判据过紧会把真签出静默跳过 = 假绿', () => {
  const dir = initRepo('pfw-marker-', { 'apps/api/package.json': '{}\n', 'packages/database/package.json': '{}\n' })
  try {
    // 留一处工作区改动:entries 非空 ⇒ 必须真去问 origin/main(夹具没造远端 ref ⇒ 未判定)。
    // 若根被跳过,整轮会说 clean —— 那正是"判据过紧 ⇒ 静默假绿"的形态。
    writeFileSync(join(dir, 'apps', 'api', 'package.json'), '{ "changed": true }\n')
    const merged = P.probeAllRoots([{ value: dir, via: 'test' }])
    assert.deepEqual(merged.notProject, [], '有仓标记的根不得被判成第三方')
    assert.equal(merged.roots[0].state, 'unjudged', '入面后问不到 origin/main ⇒ 未判定(不是 clean)')
    assert.equal(merged.state, 'unjudged')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('逐项判不出也必须点名:只有 unjudged 而无 foreign 时 ⇒ 整轮未判定 + entry-unjudged 归因码', () => {
  // 夹具:一枚 tracked 文件被从工作区删除 ⇒ 工作区 blob 取不到(删除型),两侧都无 foreign。
  // 旧映射会把它折成 dirty ⇒ 派发侧既不寄信也不写日志(沉默的那一型)。
  const dir = initRepo('pfw-delonly-', { 'gone.txt': 'G v1\n' })
  try {
    git(dir, ['update-ref', 'refs/remotes/origin/main', 'HEAD']) // 本地造远端 tip,不打网络
    rmSync(join(dir, 'gone.txt'))
    const merged = P.probeAllRoots([{ value: dir, via: 'test' }], FIXTURE_IS_PROJECT)
    assert.equal(merged.counts.foreign, 0)
    assert.equal(merged.counts.unjudged, 1)
    assert.equal(merged.state, 'unjudged', '判不出的一格不许被读成 dirty(=派发侧沉默)也不许读成 clean')
    assert.ok(merged.causes.some((c) => c.startsWith('entry-unjudged=')), JSON.stringify(merged.causes))
    const v = P.verdictFromSurvey({ state: 'ok', roots: [{ value: dir, via: 'test' }], evidence: {}, via: 'test' }, FIXTURE_IS_PROJECT)
    assert.equal(v.state, 'unjudged')
    assert.equal(v.surface, 'judged-but-unresolved')
    assert.match(v.line, /state=unjudged .* surface=judged-but-unresolved undet=entry-unjudged=1$/)
    assert.equal(P.exitFor(v), 2)
    assert.match(merged.unjudged[0].why, /工作区 blob 取不到/, '明细留在逐项 why 里,归因码不替代明细')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('候选服务名判据放宽到"含 IHUI"(改名/前缀漂移不许静默判空)+ 环境补充名当次现读', () => {
  const table = {
    [SVC_PARENT.toUpperCase()]: enumText(['ihui-prod-loop', 'WSearch']),
    [`${SVC_FULL}\\ihui-prod-loop`.toUpperCase()]: svcText('ihui-prod-loop', { AppDirectory: prodDir }),
  }
  const s = P.surveyProdCheckouts({ reg: 'C:/fake/reg.exe', env: {}, regQuery: fakeRegQuery(table), conventionalRoots: { state: 'measured', roots: [] }, repoRoot: 'G:/IHUI-AI' })
  assert.equal(s.state, 'ok', '小写 + 非前缀形态也要入射程')
  assert.equal(P.normPath(s.roots[0].value), P.normPath(prodDir))

  const named = P.surveyProdCheckouts({
    reg: 'C:/fake/reg.exe',
    env: { IHUI_PROD_SERVICE_NAMES: 'LOOP-BOX' },
    regQuery: fakeRegQuery({
      [SVC_PARENT.toUpperCase()]: enumText(['LOOP-BOX']),
      [`${SVC_FULL}\\LOOP-BOX`.toUpperCase()]: svcText('LOOP-BOX', { AppDirectory: prodDir }),
    }),
    conventionalRoots: { state: 'measured', roots: [] },
    repoRoot: 'G:/IHUI-AI',
  })
  assert.equal(named.state, 'ok', '登记在环境里的载体名不等改名也能纳进射程(免代码漂移)')
})

// —— runner ——
let failed = 0
setup()
try {
  for (const t of results) {
    try {
      t.run()
      console.log(`✅ ${t.name}`)
    } catch (e) {
      failed++
      console.error(`❌ ${t.name}\n   ${e?.message ?? e}`)
    }
  }
} finally {
  cleanup()
}
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
