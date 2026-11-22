// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 漂开族自动折叠档(`--fold-drifted-families`)的镜像测试 —— 收编席(seat-ledgerfold)漏掉的半格。
 *
 * 为什么单开一份:该通道是**第三条删行通道**(前两条 = 块级收口 / 单行副本),它自带
 * "分族 → 保留行 → 租约合并 → 真删行 → 逐字留痕"整条链,而既有套件里没有一条用例覆盖它。
 * 结构判据(站点表次序)归 `plan-tasks-merge-attestation.test.mjs`;F 维策略表归
 * `plan-tasks-merge-row-dedupe.test.mjs`;这里只钉**本条通道自己的可证伪面**:
 *  ① 分族(正/负控)、② 超规模拒折、③ 租约(唯一不丢 / 多张拒折)、④ 留痕与次序、
 *  ⑤ 零损失四条出口、⑥ 幂等(第二次数 0 且 HEAD 不动)、⑦ 变异自证(摘掉拒折判据 ⇒ ② 的夹具翻转)。
 *
 * 落点一律 `mkScratch`(工作树同盘、git 面外);夹具仓只放被 spawn 的
 * `check-plan-line-loss.mjs` 闭包,被测函数仍 import 真仓那一份(不复制判据,§22c)。
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
  DRIFT_FAMILY_MAX,
  DRIFT_FAMILY_SEAT,
  applyDriftedFamilyFolds,
  foldDriftedFamiliesAndLand,
  planDriftedFamilyFolds,
  verifyDriftedFamilyFold,
} from '../plan-tasks-merge.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MERGE_SRC = () => readFileSync(new URL('../plan-tasks-merge.mjs', import.meta.url), 'utf8')

/** 两行同题(题面逐字相等、正文已漂开)+ 一行无关 ⇒ 恰好一族可折。 */
const PLAN_TWO = [
  '# 计划',
  '',
  '- [ ] **G-201 同一件事**:第一份登记,正文甲。',
  '- [ ] **G-202 同一件事**:第二份登记,正文乙写得更长一些。',
  '- [ ] **G-203 别的事**:与上面无关。',
  '',
].join('\n')

/** 族内唯一完整租约(结构位)在正文最短的那行上。 */
const PLAN_LEASED = [
  '# 计划',
  '',
  '- [ ] （进行中@2026-10-25/seat-a）**G-401 同一件事**:带牌的那份正文。',
  '- [ ] **G-402 同一件事**:无牌的另一份正文,更长更长更长。',
  '',
].join('\n')

/** 两张互不相同的完整租约同族 ⇒ 机器不代摘任何一张。 */
const PLAN_CONFLICT = [
  '# 计划',
  '',
  '- [ ] （进行中@2026-10-25/seat-a）**G-501 同一件事**:甲牌正文。',
  '- [ ] （进行中@2026-10-24/seat-b）**G-502 同一件事**:乙牌正文。',
  '',
].join('\n')

const gitQ = (cwd, args) =>
  execFileSync(
    'git',
    ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e', '-c', 'user.name=e2e', ...args],
    {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      // 本机派生面 EBUSY 纪律(门 193):git 子进程必须显式配 stdio
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
const shaAt = (dir, ref = 'HEAD') => gitQ(dir, ['rev-parse', ref]).trim()

/**
 * 搭一个临时 git 仓。为什么只拷 `check-plan-line-loss.mjs`:
 * 落地腿会 spawn 它补跑台账自愈(门 71 的替身),临时仓缺它就会 loud 报"自愈未成"
 * —— 那既不是本档的判据,也会把输出噪声读成失败。其余被测实现 import 真仓那一份。
 */
function fixtureRepo(planText, msg = 'fixture: 漂开族折叠夹具') {
  const dir = mkScratch('plan-merge-fold-drifted')
  const sdst = path.join(dir, 'scripts')
  mkdirSync(sdst, { recursive: true })
  copyScriptWithClosure(path.join(ROOT, 'scripts'), 'check-plan-line-loss.mjs', sdst)
  gitQ(dir, ['init', '-q', '-b', 'main'])
  gitQ(dir, ['config', 'user.email', 't@e2e'])
  gitQ(dir, ['config', 'user.name', 'e2e'])
  writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), planText, 'utf8')
  gitQ(dir, ['add', 'PROJECT_PLAN.md'])
  gitQ(dir, ['commit', '-q', '-m', msg])
  return { dir }
}

/** 读 `plan-row-drop.jsonl`(只读夹具仓,缺失 = 空)。 */
function dropLedgerOf(dir) {
  const abs = path.join(dir, '.ihui-agent', 'state', 'plan-row-drop.jsonl')
  try {
    return readFileSync(abs, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
  } catch {
    return []
  }
}

/** 顶层函数体(名字 + 起点切到下一个顶层函数)。判次序锁用,不按行号(§1 规矩 3)。 */
function bodyOf(src, name) {
  const heads = [...src.matchAll(/^(?:export )?function ([A-Za-z0-9_$]+)\s*\(/gm)]
  const i = heads.findIndex((h) => h[1] === name)
  assert.ok(i >= 0, `${name} 必须还在(改名/搬走 ⇒ 本锁对它失明)`)
  return src.slice(heads[i].index, i + 1 < heads.length ? heads[i + 1].index : src.length)
}

/** 只替换目标族那一条的 `after`(其余不动)。 */
function withAfter(plan, target, text) {
  return {
    ...plan,
    folds: plan.folds.map((f) => (f === target ? { ...f, after: text } : f)),
  }
}

test('① 分族:同题族内 ≥2 条未勾行 ⇒ 报为可折;同题只剩 1 条 ⇒ 不进候选(负控)', () => {
  const p = planDriftedFamilyFolds(PLAN_TWO)
  assert.equal(p.groups, 1, '同题两行必须报为一族')
  assert.equal(p.folds.length, 1)
  assert.deepEqual(
    p.folds[0].deleted.map((d) => d.raw),
    ['- [ ] **G-201 同一件事**:第一份登记,正文甲。'],
    '被折的必须是同题副本',
  )
  assert.equal(
    p.folds[0].keeper.raw,
    '- [ ] **G-202 同一件事**:第二份登记,正文乙写得更长一些。',
    '保留行按"正文最全"确定性选出',
  )
  // 负控:把第二行换成另一个题面 ⇒ 两族各 1 行,一族都不折(1 行不是"副本",是两件活)
  const single = PLAN_TWO.replace('**G-202 同一件事**', '**G-202 另一件事**')
  const q = planDriftedFamilyFolds(single)
  assert.equal(q.groups, 0, '族内只有 1 条时不得报为可折')
  assert.deepEqual(q.folds, [])
  assert.equal(q.skipped.length, 0, '单行族也不进"跳过"清单 —— 它根本不在射程内')
})

test('② 超规模拒折:族内 > 上限一律不猜并逐行点名(真仓现读有一族 10 份被拒)', () => {
  const lines = ['# 计划', '']
  for (let i = 1; i <= DRIFT_FAMILY_MAX + 1; i++)
    lines.push(`- [ ] **G-30${i} 同一件事**:第 ${i} 份正文,各不相同的内容 ${'x'.repeat(i)}。`)
  const p = planDriftedFamilyFolds(lines.join('\n'))
  assert.equal(p.folds.length, 0, '超限族不得产出折叠计划(题面撞车 ≠ 同题)')
  assert.equal(p.skipped.length, 1)
  assert.match(p.skipped[0].why, new RegExp(`> 上限 ${DRIFT_FAMILY_MAX}`), '必须点名为什么拒')
  assert.equal(
    p.skipped[0].lines.length,
    DRIFT_FAMILY_MAX + 1,
    '拒折必须逐行列出,交人工时不用重新数',
  )
})

test('③ 租约:族内唯一完整租约留在保留行(不丢牌);多张不同租约整族拒折并逐张点名(正控)', () => {
  const p = planDriftedFamilyFolds(PLAN_LEASED)
  assert.equal(p.folds.length, 1)
  const f = p.folds[0]
  assert.match(f.keeper.raw, /（进行中@2026-10-25\/seat-a）/, '带牌行必须是保留行')
  assert.match(f.after, /（进行中@2026-10-25\/seat-a）/, '产物必须仍带那枚完整租约')
  assert.ok(
    !f.deleted.some((d) => /进行中/.test(d.raw)),
    '带牌行不得被删 —— 删它等于代人释放租约',
  )
  // 正控:两条不同租约 ⇒ 拒折(不代摘任何一张),reason 必须逐张点名
  const q = planDriftedFamilyFolds(PLAN_CONFLICT)
  assert.equal(q.folds.length, 0, '多人在飞的族机器无权折')
  assert.equal(q.refused.length, 1)
  assert.match(q.refused[0].reason, /进行中@2026-10-25\/seat-a/)
  assert.match(q.refused[0].reason, /进行中@2026-10-24\/seat-b/)
})

test('④ 留痕:被删行逐字进 plan-row-drop.jsonl(六字段齐备),且必须排在落地成功之后', () => {
  const env = fixtureRepo(PLAN_TWO)
  try {
    const parent = shaAt(env.dir)
    assert.equal(foldDriftedFamiliesAndLand(8, { root: env.dir }), 0, '夹具面应真落一枚')
    const head = shaAt(env.dir)
    assert.notEqual(head, parent, 'HEAD 必须前进一步(否则"留痕"没有凭据)')
    const led = dropLedgerOf(env.dir)
    assert.equal(led.length, 1, `一枚落地只许写一行留痕,实得 ${led.length}`)
    const rec = led[0]
    for (const k of ['at', 'seat', 'file', 'kind', 'commit', 'baseline', 'rowBefore'])
      assert.ok(k in rec, `留痕缺字段 ${k}:${JSON.stringify(rec)}`)
    assert.equal(rec.seat, DRIFT_FAMILY_SEAT)
    assert.equal(rec.file, 'PROJECT_PLAN.md')
    assert.equal(rec.rowBefore, '- [ ] **G-201 同一件事**:第一份登记,正文甲。', '必须逐字')
    assert.equal(rec.commit, head, 'commit 必须是落地那一枚(不是抢输的)')
    assert.equal(rec.baseline, parent, 'baseline 必须是落地前的 HEAD')
    assert.match(rec.at, /^\d{4}-\d{2}-\d{2}T/)
    // 形状锁:留痕必须排在 CAS 与"落地后回读 + 复验"之后(先写后落 = 面上还在却说已删)
    const body = bodyOf(MERGE_SRC(), 'foldDriftedFamiliesAndLand')
    const at = body.indexOf('appendDropLedger(')
    assert.ok(at > 0, '落地腿必须真的写摘除留痕')
    assert.ok(
      at > body.indexOf('casUpdateRef(landed.commit, parent'),
      '留痕排在正向 CAS 之前 ⇒ 抢输的尝试也会被记成已删',
    )
    assert.ok(
      at > body.indexOf('verifyDriftedFamilyFold(src, landedText, plan)'),
      '留痕排在落地后复验之前 ⇒ 复验不过、回退掉的那一枚也会被记成已删',
    )
  } finally {
    rmScratch(env.dir)
  }
})

test('⑤ 零损失:行数差 / 未参与行逐字 / 勾选态·归属桶·认领三维任一破坏 ⇒ 整批不落', () => {
  const p = planDriftedFamilyFolds(PLAN_TWO)
  const out = applyDriftedFamilyFolds(PLAN_TWO, p)
  assert.deepEqual(
    verifyDriftedFamilyFold(PLAN_TWO, out, p).problems,
    [],
    '基准产物必须零问题(否则下面每一条"红"都不是变异造成的)',
  )
  // (a) 行数差 ≠ 删除数
  const extra = verifyDriftedFamilyFold(PLAN_TWO, `${out}\n- [ ] **G-299 多出来的一行**`, p)
  assert.ok(
    extra.problems.some((x) => /行数差/.test(x)),
    `行数差那一维必须点名:${JSON.stringify(extra.problems)}`,
  )
  // (b) 未参与行逐字不变(改一个标点也红)
  const tamperedFree = out.replace(
    '- [ ] **G-203 别的事**:与上面无关。',
    '- [ ] **G-203 别的事**:与上面无关!',
  )
  const seq = verifyDriftedFamilyFold(PLAN_TWO, tamperedFree, p)
  assert.ok(
    seq.problems.some((x) => /顺序子序列/.test(x)),
    `未参与行被动过必须点名:${JSON.stringify(seq.problems)}`,
  )
  const f = p.folds[0]
  // (c) 勾选态:保留行被翻勾
  const done = f.after.replace(/^(\s*-\s*)\[ \]/, '$1[x]')
  assert.notEqual(done, f.after, '变异自证:翻勾替换必须命中')
  const pDone = withAfter(p, f, done)
  const outDone = out.replace(f.after, done)
  assert.ok(
    verifyDriftedFamilyFold(PLAN_TWO, outDone, pDone).problems.some((x) => /翻勾/.test(x)),
    '勾选态守恒必须有人把守',
  )
  // (d) 归属桶:保留行被塞进"归属他人"措辞
  const owned = `${f.after} 归属:他席`
  const pOwned = withAfter(p, f, owned)
  const outOwned = out.replace(f.after, owned)
  assert.ok(
    verifyDriftedFamilyFold(PLAN_TWO, outOwned, pOwned).problems.some((x) =>
      /归属判定会漂/.test(x),
    ),
    '归属桶守恒必须有人把守',
  )
  // (e) 认领:把保留行上唯一那张完整租约切掉
  const lp = planDriftedFamilyFolds(PLAN_LEASED)
  const lf = lp.folds[0]
  const lout = applyDriftedFamilyFolds(PLAN_LEASED, lp)
  assert.deepEqual(verifyDriftedFamilyFold(PLAN_LEASED, lout, lp).problems, [])
  const stripped = lf.after.replace('（进行中@2026-10-25/seat-a）', '')
  assert.notEqual(stripped, lf.after, '变异自证:切牌替换必须命中')
  const pStripped = withAfter(lp, lf, stripped)
  const outStripped = lout.replace(lf.after, stripped)
  assert.ok(
    verifyDriftedFamilyFold(PLAN_LEASED, outStripped, pStripped).problems.some((x) =>
      /租约被切掉/.test(x),
    ),
    '认领守恒必须有人把守(删牌 = 代人释放租约)',
  )
})

test('⑥ 幂等:同台账连跑两次,第二次数 0 且 HEAD 与留痕条数都不动', () => {
  const env = fixtureRepo(PLAN_TWO)
  try {
    assert.equal(foldDriftedFamiliesAndLand(8, { root: env.dir }), 0)
    const head1 = shaAt(env.dir)
    const n1 = dropLedgerOf(env.dir).length
    assert.equal(n1, 1)
    assert.equal(foldDriftedFamiliesAndLand(8, { root: env.dir }), 0, '第二次必须 rc=0(no-op)')
    assert.equal(shaAt(env.dir), head1, '第二次不得再落提交')
    assert.equal(dropLedgerOf(env.dir).length, n1, '第二次不得再写留痕')
    // 依据不是"跑过一次",而是产物面每族只剩 1 行
    const landed = gitQ(env.dir, ['show', 'HEAD:PROJECT_PLAN.md'])
    assert.equal(planDriftedFamilyFolds(landed).folds.length, 0, '落地面必须已无族可折')
  } finally {
    rmScratch(env.dir)
  }
})

test('⑦ 变异自证:把「族内 > 上限拒折」的判据摘掉 ⇒ ② 的夹具行为必须翻转', () => {
  const dir = mkScratch('plan-merge-fold-drifted-mut')
  const sdst = path.join(dir, 'scripts')
  mkdirSync(sdst, { recursive: true })
  try {
    copyScriptWithClosure(path.join(ROOT, 'scripts'), 'plan-tasks-merge.mjs', sdst, [
      'lib/plan-task-index.mjs',
    ])
    const entry = path.join(sdst, 'plan-tasks-merge.mjs')
    const lines = ['# 计划', '']
    for (let i = 1; i <= DRIFT_FAMILY_MAX + 1; i++)
      lines.push(`- [ ] **G-30${i} 同一件事**:第 ${i} 份正文,各不相同的内容 ${'x'.repeat(i)}。`)
    writeFileSync(path.join(dir, 'plan.md'), lines.join('\n'), 'utf8')
    const probe = path.join(sdst, 'probe.mjs')
    writeFileSync(
      probe,
      [
        "import { readFileSync } from 'node:fs'",
        "import { planDriftedFamilyFolds } from './plan-tasks-merge.mjs'",
        "const p = planDriftedFamilyFolds(readFileSync(new URL('../plan.md', import.meta.url), 'utf8'))",
        'console.log(JSON.stringify({ folds: p.folds.length, deleted: p.folds[0]?.deleted.length ?? 0, skipped: p.skipped.length }))',
        '',
      ].join('\n'),
      'utf8',
    )
    const runProbe = () => {
      try {
        return {
          code: 0,
          out: execFileSync(process.execPath, [probe], {
            cwd: dir,
            encoding: 'utf8',
            windowsHide: true,
            timeout: 120000,
            stdio: ['ignore', 'pipe', 'pipe'],
          }),
        }
      } catch (e) {
        return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
      }
    }
    const base = runProbe()
    assert.equal(base.code, 0, `未变异副本必须可跑:${base.out}`)
    assert.deepEqual(JSON.parse(base.out), { folds: 0, deleted: 0, skipped: 1 }, '基线:超限族被拒')
    // 变异:把拒折分支变成恒假(等价于"判据被注释掉"),其余一字不动
    const src = readFileSync(entry, 'utf8')
    const MUT = 'if (grp.length > DRIFT_FAMILY_MAX) {'
    assert.ok(src.includes(MUT), '变异锚点未命中(拒折判据改名了)⇒ 本臂需同步,不得删断言')
    writeFileSync(entry, src.replace(MUT, 'if (false && grp.length > DRIFT_FAMILY_MAX) {'), 'utf8')
    const mut = runProbe()
    assert.equal(mut.code, 0, `变异副本应可跑:${mut.out}`)
    const got = JSON.parse(mut.out)
    assert.ok(got.folds >= 1, `摘掉拒折判据后同一夹具必须变红(实得 ${JSON.stringify(got)})`)
    assert.ok(got.deleted >= 1, '变异后必须真的开始删行 —— 这才证明 ② 的"拒"长在新代码上')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
