// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-800 的镜像测试:`plan-tasks-merge.mjs` 六个旁路落地站点的跳门留痕。
 *
 * 为什么单开一份(而不是只靠 `plan-tasks-merge.test.mjs` 的 T26–T30):票面把四条判据写成
 * 验收项,而它们其中三条是**次序与成败归属**(写没写 / 该不该写 / 写失败算不算失败)。
 * 这一份只测这四条,不复制判据 —— 结构判据一律 import 生产侧那一份实现(§22c:
 * 镜像测试若自己抄一份,它就只是复读机)。
 *
 * 三条硬口径(与生产侧同源,不得在此放宽):
 *  1. 留痕只在「CAS 成功 ∧ 落地后复验通过」之后写 —— 复验不过回退的那一臂**必须一行不写**;
 *  2. 写留痕失败**不得改变落地的成败与退出码**(它记的是账,不是门禁);
 *  3. schema 只有一份:断言读的是 `lib/commit-attestation.mjs` 的 `BYPASS_KIND` 与 `readLedgerRecords`,
 *     不在这里重写字段名清单。
 *
 * 落点:`mkScratch`(工作树同盘的 DevEnv/Temp/ihui-scratch),临时仓真跑 commit-tree + CAS,
 * 不 mock git —— mock 出来的 git 永远证不了"回退把 HEAD 交回了父提交"这一条。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  BYPASS_LANDING_SITES,
  attestLanding,
  landingAttestationStructure,
  landingSiteTableProblems,
} from '../plan-tasks-merge.mjs'
import { BYPASS_KIND, readLedgerRecords } from '../lib/commit-attestation.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MERGE_SRC = () => readFileSync(new URL('../plan-tasks-merge.mjs', import.meta.url), 'utf8')

const gitQ = (cwd, args) =>
  execFileSync(
    'git',
    ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e', '-c', 'user.name=e2e', ...args],
    {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
/** sha 必须 trim:gitQ 带尾换行,拿它比台账里的 landedSha 会把"绑对了"读成"绑错了"。 */
const shaAt = (dir, ref = 'HEAD') => gitQ(dir, ['rev-parse', ref]).trim()
const countCommits = (dir) =>
  gitQ(dir, ['log', '--oneline']).trim().split('\n').filter(Boolean).length

/** F1 分叉夹具:一条已做完 + 一条未翻勾的同主键副本 ⇒ `--heal --commit` 有活可干且真会落地。 */
const PLAN_FORK = [
  '# 计划',
  '',
  '- [x] ✅(2026-09-20) **D9 同一件事**:做完了。',
  '- [ ] **D9 同一件事**:另一侧还挂着未勾。',
  '- [ ] **D8 真待办**:还没人做。',
  '',
].join('\n')

/** F10 折叠夹具:同题不同编号的一对孪生待办 + 一行不相干的事 ⇒ `--fold-twins --commit` 有活可干。 */
const PLAN_TWIN = [
  '# 计划',
  '',
  '- [ ] **G-11. 同一件事**:第一份登记,持有行。',
  '- [ ] **G-12. 同一件事**:并发取号抢到的另一个号,同一件事。',
  '- [ ] **G-13. 别的事**:与上面两行无关。',
  '',
].join('\n')

/**
 * 搭一个临时 git 仓,把被测脚本**连同相对 import 闭包**拷进去。
 * 为什么必须拷:脚本里的 `ROOT` 由自身位置推导 —— 不拷进临时仓,落地就会打在真仓 HEAD 上
 * (那是"测试写了夹具、结论却在生产面"的那一型,守门 70 的 cwd 失效同族)。
 */
function fixtureRepo(planText = PLAN_FORK, commitMsg = 'fixture: 台账夹具') {
  const dir = mkScratch('plan-merge-attest')
  const sdst = path.join(dir, 'scripts')
  mkdirSync(sdst, { recursive: true })
  copyScriptWithClosure(path.join(ROOT, 'scripts'), 'plan-tasks-merge.mjs', sdst, [
    'lib/plan-task-index.mjs',
  ])
  copyScriptWithClosure(path.join(ROOT, 'scripts'), 'check-plan-line-loss.mjs', sdst)
  gitQ(dir, ['init', '-q', '-b', 'main'])
  // 临时仓必须自带身份:被测工具的 commit-tree 不带 -c user.*(真仓里那等于篡改署名),
  // 而本机没有全局 git 身份 ⇒ 不配就是 `fatal: unable to auto-detect email address`,
  // 端到端臂会静默不落地,把"写了 0 行"读成"回退臂正确"。
  gitQ(dir, ['config', 'user.email', 't@e2e'])
  gitQ(dir, ['config', 'user.name', 'e2e'])
  writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), planText, 'utf8')
  gitQ(dir, ['add', 'PROJECT_PLAN.md'])
  gitQ(dir, ['commit', '-q', '-m', commitMsg])
  return { dir, entry: path.join(sdst, 'plan-tasks-merge.mjs') }
}

/** 跑被拷出去的 CLI:返回 {code,out},永不抛(退出码是判据的一部分)。 */
function runCli(env, args) {
  try {
    return {
      code: 0,
      out: execFileSync(process.execPath, [env.entry, ...args], {
        cwd: env.dir,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 180000,
        // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    }
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

/** 台账记录的稳定视图(只取本票四条判据要问的字段,字段名一律来自 lib 导出的那一份)。 */
function ledgerView(dir) {
  const led = readLedgerRecords(dir)
  return { led, records: led.records ?? [] }
}

test('A1 成功落地臂:落一枚 ⇒ 台账恰 1 行,kind=bypass-landing ∧ gatesRun=false ∧ landedSha==最终 HEAD', () => {
  const env = fixtureRepo(PLAN_FORK, 'fixture: 一条已做完 + 一条未翻勾的副本')
  try {
    const absent = ledgerView(env.dir)
    assert.equal(absent.led.state, 'missing', '夹具仓本不该有台账,否则"写了 1 行"这一维读不出来')
    const parent = shaAt(env.dir)
    const r = runCli(env, ['--heal', '--commit'])
    assert.equal(r.code, 0, `自愈应 exit 0,实得 ${r.code}:\n${r.out}`)
    assert.match(r.out, /自愈落地/, `这一臂要求真落一枚:\n${r.out}`)
    // 写了留痕必须由输出自己点名:静默多一行 = 没人知道这枚绕过过提交链
    assert.match(r.out, /跳门留痕 1 行已写入/, r.out)
    const { led, records } = ledgerView(env.dir)
    assert.ok(led.ok, `台账应可读:${led.why}`)
    assert.deepEqual(
      led.badLines,
      [],
      `自己写的行自己解不出(写面与读面漂开):${JSON.stringify(led.badLines)}`,
    )
    assert.equal(records.length, 1, `一枚落地只许写一行,实得 ${records.length}`)
    const rec = records[0]
    assert.equal(rec.kind, BYPASS_KIND, 'kind 必须是旁路留痕那一族')
    assert.equal(rec.gatesRun, false, '旁路一律 gatesRun:false —— 这一维就是本票要量的东西')
    assert.equal(rec.landedSha, shaAt(env.dir), 'landedSha 必须等于最终 HEAD(不是抢输的那枚)')
    assert.equal(rec.headBefore, parent, 'headBefore 必须是落地前那枚 HEAD')
    assert.deepEqual(rec.declaredFiles, ['PROJECT_PLAN.md'], 'declaredFiles 恒为本器唯一写出的路径')
    assert.equal(rec.source, 'plan-tasks-merge:heal', 'source 必须点名是哪一档绕的门')
  } finally {
    rmScratch(env.dir)
  }
})

test('A2 回退臂(票面①的牙):复验不过 ⇒ CAS 交回父提交,台账一行都不许写', () => {
  const env = fixtureRepo(PLAN_TWIN, 'fixture: 同题不同编号孪生一对(留痕回退臂)')
  try {
    const src = readFileSync(env.entry, 'utf8')
    const MUT = 'const recheck = verifyTwinFold(src, landedText, f.edits, f.refused)'
    // 锚点未命中就等于这条断言对着空气判绿 —— 先自证变异有牙
    assert.ok(src.includes(MUT), '变异锚点未命中(生产代码改名了)⇒ 本臂需同步,不得删断言')
    writeFileSync(
      env.entry,
      src.replace(
        MUT,
        "const recheck = { problems: ['变异注入:复验必失败(G-800 回退臂)'], before: {}, after: {} }",
      ),
      'utf8',
    )
    const before = shaAt(env.dir)
    const r = runCli(env, ['--fold-twins', '--commit'])
    assert.notEqual(r.code, 0, '回退那一支应把这一次落地判失败')
    // 只有真走到那一支,"没写行"才是证据;早退(无活可干)也会"没写行",但那什么也没证明
    assert.match(
      r.out,
      /落地后复验不过/,
      `这一臂应走到"复验不过 ⇒ 回退":${r.code} ${r.out.slice(0, 300)}`,
    )
    assert.doesNotMatch(r.out, /跳门留痕/, `已回退的落地不许写留痕(票面①禁止的那种插法):\n${r.out}`)
    const { led, records } = ledgerView(env.dir)
    assert.equal(
      records.length,
      0,
      `回退臂写出了 ${records.length} 行 ⇒ 统计器会把不在 HEAD 上的提交数成旁路`,
    )
    assert.ok(led.state === 'missing' || led.state === 'unreadable', `台账不该被创建:${led.state}`)
    assert.equal(shaAt(env.dir), before, '回退必须把 HEAD 交回父提交,否则"不写行"失去意义')
    assert.equal(countCommits(env.dir), 1, '回退后提交总数应仍是 1(只有夹具那枚)')
  } finally {
    rmScratch(env.dir)
  }
})

/**
 * 把判据表里的一整条站点删掉(`  { … fn: '<fn>' … },`)。
 * 为什么用"删表项"而不是"改表项":表项一少,该档的**落地形态还在源码里** ⇒ 结构判据的
 * "新站点未接"那一维必须报名;若只是把某条锚点写歪,红的是"锚点取不到",测的不是同一件事。
 */
function cutTableEntry(src, fnName) {
  const k = src.indexOf(`    fn: '${fnName}',`)
  if (k < 0) throw new Error(`表里找不到 ${fnName} ⇒ 这条变异没有牙`)
  // \n 前缀对 LF 与 CRLF 同时成立(\r\n 也含 \n),不必分叉
  const start = src.lastIndexOf('\n  {', k)
  const tail = src.slice(k).match(/\r?\n {2}\},/)
  // 切到 `},` 为止(含):它后面那一个换行属于**下一条**表项的起始,多吃一口就会把下一条的
  // `  {` 顶到上一行行尾 —— 手术刀本身不该改变语义面。
  if (start < 0 || !tail) throw new Error('表项边界取不到 ⇒ 手术刀与实态脱节')
  return src.slice(0, start) + src.slice(k + tail.index + tail[0].length)
}

test('A3 站点表少一站 ⇒ 结构判据必红;现读站点数与表内条数必须等值(变异对照)', () => {
  const real = landingAttestationStructure(MERGE_SRC())
  assert.deepEqual(real.bad, [], `真源码必须让每个登记站点成套:${JSON.stringify(real.bad)}`)
  assert.deepEqual(real.unwired, [], `不得有未接留痕的落地站点:${JSON.stringify(real.unwired)}`)
  assert.deepEqual(landingSiteTableProblems(), [], '判据表自身必须成套')
  assert.equal(
    real.counts.sites,
    BYPASS_LANDING_SITES.length,
    '判据读到的站点数与表内条数必须现读等值(不写死常量)',
  )
  // 原来这里写死 `=== 6`(“六个落地站点”)。字面量条数不是不变量:第 7 站(prefix-holder,
  // G-1111919)经逐站核过语义后登记进表,那个 6 就从"防漏登记的哨兵"变成"禁止合规"。
  // 真正要守的是**防缩水**,所以改成钉住六个历史站点必须仍在册(新增站不触发它,删站/改名必红),
  // 而"表与调用点等值"那一维由上一条 `real.counts.sites === BYPASS_LANDING_SITES.length` 把守。
  const REGISTERED = [
    'plan-tasks-merge:restore-terminals',
    'plan-tasks-merge:dedupe-rows',
    'plan-tasks-merge:dedupe-open-rows',
    'plan-tasks-merge:fold-twins',
    'plan-tasks-merge:dedupe-blocks',
    'plan-tasks-merge:heal',
  ]
  for (const src of REGISTERED)
    assert.ok(
      BYPASS_LANDING_SITES.some((s) => s.source === src),
      `原六站中的 ${src} 从判据表里消失了 —— 表缩水等于关掉那一站的次序判据`,
    )
  // 每档的 source 名必须**恰好出现在两处**:判据表里一次(锚点)、调用点一次(留痕)。
  // "调用点恰好一处"这一维由上面 `real.bad` 空替我把关(生产侧判据在函数体内数 attestLanding 次数),
  // 这里数的是"名字有没有被写丢"—— 一处不多一处不少,多了就是有人又抄了一份表项。
  const srcAll = MERGE_SRC()
  for (const s of BYPASS_LANDING_SITES) {
    const hits = srcAll.match(new RegExp(`source: '${s.source}'`, 'g')) || []
    assert.equal(hits.length, 2, `${s.source} 应出现 2 次(表 + 调用点),实得 ${hits.length}`)
  }
  assert.equal(
    (srcAll.match(/attestLanding\(\{/g) || []).length,
    BYPASS_LANDING_SITES.length + 1,
    '留痕调用总数 = 站点数 + 定义那一次(多一处 = 同一枚落地写两行)',
  )

  // 变异面:把判据表删掉一条,**在副本的模块里**跑判据(imported 的那张表在本进程里改不到)
  const dir = mkScratch('plan-merge-attest-table')
  const sdst = path.join(dir, 'scripts')
  mkdirSync(sdst, { recursive: true })
  try {
    copyScriptWithClosure(path.join(ROOT, 'scripts'), 'plan-tasks-merge.mjs', sdst, [
      'lib/plan-task-index.mjs',
    ])
    const entry = path.join(sdst, 'plan-tasks-merge.mjs')
    const probe = path.join(sdst, 'probe.mjs')
    writeFileSync(
      probe,
      [
        "import { readFileSync } from 'node:fs'",
        "import { landingAttestationStructure } from './plan-tasks-merge.mjs'",
        "const r = landingAttestationStructure(readFileSync(new URL('./plan-tasks-merge.mjs', import.meta.url), 'utf8'))",
        'console.log(JSON.stringify({ bad: r.bad, unwired: r.unwired, counts: r.counts }))',
        'process.exit(r.bad.length || r.unwired.length ? 1 : 0)',
        '',
      ].join('\n'),
      'utf8',
    )
    const code = (args) => {
      try {
        return {
          code: 0,
          out: execFileSync(process.execPath, args, {
            cwd: dir,
            encoding: 'utf8',
            windowsHide: true,
            timeout: 60000,
            // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
            stdio: ['ignore', 'pipe', 'pipe'],
          }),
        }
      } catch (e) {
        return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
      }
    }
    const base = code([probe])
    assert.equal(base.code, 0, `未变异副本必须判绿(否则下面的"红"不是变异造成的):${base.out}`)
    const mutated = cutTableEntry(readFileSync(entry, 'utf8'), 'twinFoldAndLand')
    assert.ok(
      !mutated.includes("fn: 'twinFoldAndLand'"),
      '手术未命中(表项没被删掉)⇒ 本条变异没有牙',
    )
    writeFileSync(entry, mutated, 'utf8')
    const mut = code([probe])
    assert.notEqual(mut.code, 0, '站点表少一站时结构判据必须判红')
    assert.match(mut.out, /twinFoldAndLand/, `红必须点名少了哪一档:${mut.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('A4 heal 档"无回退分支"是**声明**而非漏填,其余五档的回退锚点必须在位', () => {
  const heal = BYPASS_LANDING_SITES.find((s) => s.fn === 'healAndLand')
  assert.ok(heal, '表里必须有自愈档(它是六个站点里唯一挂在 post-commit 上自动跑的那一个)')
  // healAndLand 确实没有"复验不过 ⇒ 交回父提交"那一支(CAS 抢输即 return 1,内容复验只决定退出码),
  // 所以 rollback:null 是如实声明。把它钉成断言的目的不是护着 null,而是:
  // **谁给这一档新加了回退分支却忘了在表里登记,这里必须红** —— 否则次序判据会对那一型静默放行,
  // 而静默放行正是票面①禁的那件事的复发路径。
  assert.equal(
    heal.rollback,
    null,
    '自愈档的 rollback 必须显式声明为 null(漏填与"确无回退"是两件事)',
  )
  const src = MERGE_SRC()
  const bodyOf = (name) => {
    // 两种声明形态都要认:`export function X(` 与裸 `function X(`(第 7 站 healWithPrefixHolder
    // 就是非导出的内部函数)。只认导出形态会让"函数在、判据读不到"表现为**本用例红**,
    // 而那红会被误读成"站点被改名"—— 误红的代价和漏判一样:它会诱导人去改代码而不是修判据。
    const hs = src.search(new RegExp(`^(?:export )?function ${name}\\(`, 'm'))
    assert.ok(hs >= 0, `${name} 必须还在(改名 ⇒ 本判据失明,而不是它合规)`)
    const rest = src.slice(hs + 1)
    const nxt = rest.search(/^(?:export )?function /m)
    return nxt < 0 ? rest : rest.slice(0, nxt)
  }
  /**
   * 「确无回退分支」的站点(必须与表里 `rollback: null` 的集合**逐名等值**)。
   * 为什么用集合而不是只放行 healAndLand:第 7 站 prefix-holder(G-1111919)与 heal 档同形 ——
   * CAS 抢输即 return,复验(rev-parse 等值回读)只决定退出码、从不撤回已成的提交。
   * 这一维守的不是"允许 null",而是**"漏填"与"确无"必须是两件事**:
   * 表里声明 null 的,函数体里就不许藏着回退分支;反过来,谁给这些档加了回退分支却没登记表,这里必须红。
   */
  const NO_ROLLBACK = new Set(['healAndLand', 'healWithPrefixHolder'])
  assert.deepEqual(
    BYPASS_LANDING_SITES.filter((s) => s.rollback === null).map((s) => s.fn).sort(),
    [...NO_ROLLBACK].sort(),
    '表里 rollback:null 的集合必须与本用例核过的"确无回退"集合等值(多一个是漏填,少一个是有人加了回退分支没登记)',
  )
  for (const s of BYPASS_LANDING_SITES) {
    if (NO_ROLLBACK.has(s.fn)) {
      assert.ok(
        !/casUpdateRef\(parent,|'update-ref', 'HEAD', head, commit|'update-ref', 'HEAD', head0, commitSha/.test(
          bodyOf(s.fn),
        ),
        `${s.fn} 若新增了回退分支,必须同步把表里的 rollback 填上(本断言即这一同步的看门)`,
      )
      continue
    }
    assert.equal(
      typeof s.rollback,
      'string',
      `${s.fn} 必须有回退锚点(它是"复验不过 ⇒ 交回父提交"那一支)`,
    )
    assert.ok(s.rollback.length > 0, `${s.fn} 的回退锚点不得是空串`)
    assert.ok(src.includes(s.rollback), `${s.fn} 的回退锚点与实态脱节:${s.rollback}`)
  }
})

test('A5 留痕写不出去 ⇒ 返回 ok:false 并给出原因,绝不抛(构造面:不得把记账变成门禁)', () => {
  const dir = mkScratch('plan-merge-attest-fail')
  try {
    // 用同名**目录**占住台账该在的位置:appendFileSync 必失败(EISDIR / EPERM)
    mkdirSync(path.join(dir, '.workbuddy', 'safe-commit-attestation.jsonl'), { recursive: true })
    let ret
    assert.doesNotThrow(() => {
      ret = attestLanding({
        source: 'plan-tasks-merge:heal',
        landedSha: 'f'.repeat(40),
        headBefore: 'e'.repeat(40),
        root: dir,
      })
    }, '出口 lib 承诺永不抛;抛了就会把一次成功落地判红')
    assert.equal(ret.ok, false, '写失败必须如实返回 ok:false,不得假装成功')
    assert.ok(typeof ret.why === 'string' && ret.why.length > 0, '必须给出原因(不得静默)')
    const { records } = ledgerView(dir)
    assert.equal(records.length, 0, '写失败那一臂不得留下半行')

    // 正对照:同一颗函数在可写的根上必须 ok:true 且落一行可读记录
    const okDir = mkScratch('plan-merge-attest-ok')
    try {
      const good = attestLanding({
        source: 'plan-tasks-merge:dedupe-rows',
        landedSha: 'a'.repeat(40),
        headBefore: 'b'.repeat(40),
        root: okDir,
      })
      assert.equal(good.ok, true, `可写面上应成功:${good.why}`)
      const view = ledgerView(okDir)
      assert.equal(view.records.length, 1)
      assert.equal(view.records[0].kind, BYPASS_KIND)
      assert.equal(view.records[0].gatesRun, false)
      assert.equal(view.records[0].source, 'plan-tasks-merge:dedupe-rows')
    } finally {
      rmScratch(okDir)
    }
  } finally {
    rmScratch(dir)
  }
})

/**
 * A5 —— 装车锁必须**判 HEAD 面**,不能只判工作树副本。
 * 立因(2026-09-29 实测,同族第二格):前一站的 object-space-land 接线被一次"按滞后工作树副本
 * 提交的旁路落地"整体抹掉,而只读盘上副本的锁一路报绿 —— 那份绿什么也没证明:本仓真正交付的是
 * HEAD,不是某台机上恰好摊开的目录(留痕台账的 T5b 补了同一格,这里补本工具这一格)。
 * 行为类断言(端到端写几行、回退臂不写行)仍按原样跑在被审代码上;本条只钉"接线还在不在",
 * 且刻意不依赖仓库瞬时状态之外的那一格 —— HEAD 就是它的判据面。
 */
test('A5 HEAD 面装车锁:plan-tasks-merge 在 HEAD 上必须真的引了留痕出口且站点表成套', () => {
  const head = execFileSync(
    'git',
    ['-c', 'safe.directory=*', '-C', ROOT, 'show', 'HEAD:scripts/plan-tasks-merge.mjs'],
    {
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      windowsHide: true,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  assert.ok(
    head.includes("from './lib/commit-attestation.mjs'"),
    'HEAD 那份没引唯一出口 ⇒ 接线已被回写掉(盘上副本算不算,都不叫已交付)',
  )
  assert.equal(
    head.split('\n').filter((l) => l.includes('recordBypassLanding')).length,
    2,
    'HEAD 那份里 import + 调用应恰好 2 行',
  )
  const sites = head.split('BYPASS_LANDING_SITES').length - 1
  assert.ok(sites >= 2, `站点表标识符在 HEAD 里出现 ${sites} 次 ⇒ 表或引用不见了`)
  assert.ok(
    !head.includes('safe-commit-attestation.jsonl'),
    'HEAD 那份自己拼了台账路径 ⇒ 落点分叉(必须只经 commit-attestation 那一个出口)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
