// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `strip-stale-claim-marks.mjs` 的镜像测试(§22c 模式:判据 import 源脚本的 `__test__`,
 * 本文件零复制判据 —— 复制一份迟早漂成"一边摘牌、一边不摘")。
 *
 * 三件事各钉一环:
 *   ① 摘谁不摘谁(超龄维 / 裸标记两档 / 幂等)——与器物 --self-test 同源实现;
 *   ② 形状锁:器物必须 import `claimMarkOf`,不得自带"什么算挂牌"的正则(本次事故的病根就是两处各写一份);
 *   ③ 派发层(git-guardian 的 sweepStaleClaimMarks)只认机读结论行,拿不到必须落未判定。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
// 夹具落点 = §15b/§26 唯一出口(不钉 os.tmpdir:活进程 TEMP 可能仍落 C 盘,也不落仓库树内)
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as strip, planSweep, sweepStaleClaimMarks } from '../strip-stale-claim-marks.mjs'
import { claimMarkOf } from '../lib/plan-task-index.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const NOW = Date.parse('2026-10-22T12:00:00Z')
const base = { nowMs: NOW, ttlHours: 72, seat: 't', asOf: '2026-10-22' }

test('①摘除集=三枚(两枚超龄租约 + 一枚裸标记),新鲜租约不许动', () => {
  const p = planSweep(strip.FIXTURE, base)
  assert.equal(p.leases.length, 3)
  assert.equal(p.held.length, 1)
  assert.equal(p.ok, true, p.why)
})

test('①行内注记只是指针:含 #seq 且长度 ≤62 字(依据不糊台账)', () => {
  const p = planSweep(strip.FIXTURE, base)
  const notes = [...p.text.matchAll(/（认领已释放@[^）]*）/g)].map((m) => m[0])
  assert.equal(notes.length, 3)
  for (const n of notes) {
    assert.ok(n.includes('#'), `注记没有指针:${n}`)
    assert.ok(n.length <= 62, `注记过长(${n.length} 字):${n}`)
  }
})

test('①原牌信息住在留痕条目里,逐字段等于判据读数', () => {
  const p = planSweep(strip.FIXTURE, base)
  const es = strip.buildEntries(p, { stamp: p.stamp, at: '2026-10-22T12:00:00Z', seat: 't', planSha: 'd'.repeat(40) })
  assert.equal(es.length, 3)
  const leases = es.filter((e) => e.form === 'lease')
  assert.equal(leases.length, 2)
  assert.ok(leases.every((e) => /^2026-01-0\d$/.test(e.claimDate) && e.holder && e.ageHours > 0))
  assert.ok(es.every((e) => typeof e.rowBefore === 'string' && e.rowBefore.includes('（进行中')))
  assert.ok(es.every((e) => p.text.includes(`#${e.seq}`)), '注记指向的 seq 在留痕里不存在')
})

test('①机主原话进留痕的 ruling 字段,行内仍是纯指针', () => {
  const a = planSweep(strip.FIXTURE, { ...base, legacyByOwnerRuling: '机主 2026-10-22 判定无席位在飞' })
  const es = strip.buildEntries(a, { stamp: a.stamp, at: '2026-10-22T12:00:00Z', seat: 't', planSha: 'e'.repeat(40) })
  assert.equal(es.filter((e) => e.form === 'legacy')[0].ruling, '机主 2026-10-22 判定无席位在飞')
  assert.ok(!a.text.includes('判定无席位在飞'), '原话又漏进台账行了')
  assert.equal(a.ok, true, a.why)
})

test('②留痕真写盘:落文件后能解回,老化窗口裁掉多少必须报出来', async () => {
  const { mkScratch, rmScratch } = await import('../lib/scratch-dir.mjs')
  const dir = mkScratch('claim-ledger')
  const file = path.join(dir, 'ledger.jsonl')
  const p = planSweep(strip.FIXTURE, base)
  const es = strip.buildEntries(p, { stamp: p.stamp, at: '2026-10-22T12:00:00Z', seat: 't', planSha: 'f'.repeat(40) })
  const w = strip.appendLedger(es, { file, nowMs: Date.parse('2026-10-22T12:00:00Z') })
  assert.equal(w.written, 3)
  assert.equal(w.pruned, 0)
  const rep = strip.readLedgerReport({ file })
  assert.equal(rep.undetermined, false, '刚落盘就读不到')
  assert.equal(rep.lines, 3)
  assert.equal(rep.forms.lease, 2)
  assert.equal(rep.forms.legacy, 1)
  // 两年后同一本账:超窗条目必须被裁掉,且裁掉的条数被报出来(静默删等于没记录)
  const later = strip.appendLedger(es, { file, nowMs: Date.parse('2028-10-22T12:00:00Z') })
  assert.equal(later.pruned, 3, `老化未报出被裁条数:${JSON.stringify(later)}`)
  assert.equal(strip.reportLedger(readFileSync(file, 'utf8')).lines, 3)
  rmScratch(dir)
})

test('②留痕取不到时判未判定,不用 0 冒充"没摘过"', () => {
  const r = strip.readLedgerReport({ file: path.join(HERE, '..', '..', 'no-such-ledger-file.jsonl') })
  assert.equal(r.undetermined, true)
  assert.ok(typeof r.why === 'string' && r.why.length > 0, '未判定必须带原因')
})

test('①超龄维有牙:TTL 收到零时新鲜牌同批可摘', () => {
  assert.equal(planSweep(strip.FIXTURE, { ...base, ttlHours: -1 }).leases.length, 4)
})

test('①幂等:摘过的文本再跑=零可摘(否则每轮都在抖台账)', () => {
  const once = planSweep(strip.FIXTURE, base)
  const again = planSweep(once.text, base)
  assert.equal(again.leases.length, 0)
})

test('①括号形态两可:半角租约必须进射程,放宽不得吃掉两道既有防线', () => {
  // 阳性对照:2026-10-23 实测 HEAD 面那枚 `- [ ] **P1 侧边栏收敛批次…**(进行中@2026-10-19/opencode)`
  // 旧判据读 null ⇒ 4 天超龄的真牌既不被代摘器物看见,又被派单面当"可做"(两席领同一张票)。
  const half =
    '- [ ] **P1 侧边栏收敛批次:去重 4 处 + 设置项归位 3 项**(进行中@2026-10-19/opencode)—— 一级菜单 72→66'
  const got = claimMarkOf(half)
  assert.ok(got, '半角括号里的完整租约必须判为挂牌(两可口径,2026-10-23 补第四型漂移)')
  assert.equal(got.form, 'lease')
  assert.equal(got.date, '2026-10-19')
  assert.equal(got.holder, 'opencode')
  // 全角那侧一个字都不许变
  assert.equal(
    claimMarkOf('- [ ] （进行中@2026-10-19/opencode） **P1 侧边栏收敛批次**')?.mark,
    '（进行中@2026-10-19/opencode）',
    '全角形态读数必须逐字不变(只扩大,不改动)',
  )
  // 防线①:非结构位的**裸**标记仍不算牌(放宽只加括号形态,不加位置)
  assert.equal(
    claimMarkOf('- [ ] 叙述里提一句 上一席挂了(进行中) 不算认领'),
    null,
    '半角裸标记落在非结构位仍须判为不挂牌',
  )
  // 防线②:反引号代码段内的标记仍是在"描述形态本身",不是状态
  assert.equal(
    claimMarkOf('- [ ] 口径见 `(进行中@2026-01-01/x)` 这一族写法'),
    null,
    '代码段内的半角租约仍不得算牌',
  )
})

test('②形状锁:器物与守门 109 共用同一份挂牌判据,不得自带正则', () => {
  const src = readFileSync(path.join(HERE, '..', 'strip-stale-claim-marks.mjs'), 'utf8')
  assert.match(
    src,
    /import \{[^}]*claimMarkOf[^}]*\} from '\.\/lib\/plan-task-index\.mjs'/,
    '器物未从单源 import claimMarkOf',
  )
  assert.doesNotMatch(
    src,
    /const\s+\w*CLAIM\w*_RE\s*=\s*new RegExp|const\s+\w*CLAIM\w*_SRC\s*=\s*'（进行中/,
    '器物内另立了一份"什么算挂牌"的正则 —— 这正是 2026-10-22 那次 31 vs 59 漂移的病根',
  )
  // 正向对照:判据本体自带条目行前置(非条目行 ⇒ null)
  assert.equal(claimMarkOf('这段叙述里写着（进行中@2026-01-01/甲）,不是登记行'), null)
  assert.equal(claimMarkOf('- [ ]（进行中@2026-01-01/甲） 登记行')?.form, 'lease')
})

test('③派发层只认机读结论行:stripped 分读正确,拿不到一律未判定', () => {
  const logs = []
  const dir = path.join(HERE, '..', '..', '.ihui-agent', 'tmp', 'gc-claim-test')
  // tickFile 必须每臂唯一:派发层自带 30 分钟节流,复用同一个文件会让第二次运行落进
  // "未到节流窗口"分支而拿到 undefined —— 那是**测试不幂等**,不是器物错(2026-10-22 实犯)。
  const uniq = (k) => path.join(dir, `${k}-${process.pid}-${Date.now()}.json`)
  const r = sweepStaleClaimMarks({
    tickFile: uniq('a'),
    logger: (l) => logs.push(l),
    runner: () => ({ ok: true, out: 'x\nSWEEP-RESULT state=stripped stale=30 held=27 stripped=30 lines=258' }),
  })
  assert.equal(r.state, 'stripped')
  assert.equal(r.stripped, '30')
  assert.equal(r.held, '27')
  assert.match(logs.join('\n'), /代摘 30 枚/)

  const r2 = sweepStaleClaimMarks({
    tickFile: uniq('b'),
    logger: () => {},
    runner: () => ({ ok: true, out: '看起来一切正常,但没有机读行' }),
  })
  assert.equal(r2.state, 'undetermined', '拿不到结论行被读成"无需摘"就是把没做写成做过')
})

// 待摘点名行的形状锁(2026-10-22):裸标记那一档没有日期/持有者,照完整租约模板印会产出
// 「原牌 null/null 超龄 nullh」这种不成立断言(实测就在 refused 那轮的输出里)。
test('待摘点名行:裸标记不许印 null,完整租约仍印日期与超龄', () => {
  const bare = strip.leaseReportLine({
    line: 99,
    ageH: null,
    mark: { form: 'legacy', date: null, holder: null },
  })
  assert.ok(!bare.includes('null'), '裸标记行仍会出现 null:' + bare)
  assert.match(bare, /裸标记/)
  const lease = strip.leaseReportLine({
    line: 7,
    ageH: 96,
    mark: { form: 'lease', date: '2026-10-18', holder: 'w1-x' },
  })
  assert.ok(
    lease.includes('2026-10-18/w1-x') && /超龄 96h/.test(lease),
    '完整租约行丢了可追责三要素:' + lease,
  )
  const src = readFileSync(path.join(HERE, '..', 'strip-stale-claim-marks.mjs'), 'utf8')
  assert.ok(
    /console\.log\(leaseReportLine\(r\)\)/.test(src.replace(/\s+/g, ' ')),
    '打印点必须走单源 leaseReportLine,不得再内联第二份模板(§0.6)',
  )
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 接线锁(2026-10-22 补,同 `git-guardian-strip-closed.test.mjs` 那一把的形状):
 * 代摘器物在仓里而派发点被删 = "造好没装车"(§0.9),而它的表现是超龄牌永不自清、
 * 派单面虚低 —— 本次实测:整段接线被一枚已入库提交删掉,直到这条锁才被发现。
 */
test('装车成套:派发点在巡检轮里恰有一处实调用,且在 __test__ 出口上', () => {
  const src = readFileSync(path.join(HERE, '..', 'git-guardian.mjs'), 'utf8')
  const rows = src.split('\n')
  const dispatch = rows.filter((l) => l.trim() === 'if (!CHECK_ONLY) sweepStaleClaimMarks()')
  assert.equal(dispatch.length, 1, `巡检轮派发点必须恰有一处实调用,实得 ${dispatch.length}(注释里的示例形态不算出路 §0.8)`)
  assert.ok(typeof sweepStaleClaimMarks === 'function', '__test__ 出口必须挂着本层')
  assert.ok(
    rows.some((l) => l.trim() === 'sweepStaleClaimMarks,'),
    '函数在而 __test__ 没导出 = 测试拿不到它,锁形同虚设',
  )
})


/**
 * 护栏③ 收窄的锁(2026-10-23)。
 *
 * 立因(实测):原护栏判 `git status --porcelain -- PROJECT_PLAN.md` 非空 ⇒ 整批让路。本仓多会话
 * 共写该活文档,工作树副本常年不净 ⇒ 护栏天天触发、器物天天让路:留痕最后一条停在
 * 2026-10-22 07:45,而派发节流台账显示此后每 30 分钟仍在跑,45 枚超龄牌一枚未摘 ——
 * "造好装了车、判据也对、却被一道必触发的让路条件永久停摆",与上一轮清扫器那个洞同族。
 *
 * 收窄后的语义:**只在本批旧形态行被别席就地改写时让路**,纯滞后(逐字还在)一律放行
 * —— 本器取材 HEAD 面、落地走对象空间 CAS + 行级复活守卫,旧形态行的回潮由
 * `scrub-declared-removals` 与 `union-converge` 的 `declaredDropCaps` 兜(两条均已装车)。
 */
test('护栏③:本批旧形态行仍逐字在场(别席纯滞后)⇒ 不得让路', () => {
  const leases = [
    { line: 10, raw: '- [ ]（进行中@2026-10-01/old） A 票' },
    { line: 20, raw: '- [ ]（进行中@2026-10-01/old） B 票' },
  ]
  // 生产函数读仓库真实工作树;这里用夹具证明判据方向(判据本体在 planFaceBlockedBy 内,不复算)
  const r = strip.planFaceBlockedBy(leases)
  // 真仓里这些行的旧形态几乎必然已被摘 ⇒ 断言不了"在场";故本用例钉的是"函数存在且形状可判"
  assert.equal(typeof r.blocked, 'boolean')
  assert.ok(Array.isArray(r.byWorktree))
  assert.ok(
    typeof strip.planFaceBlockedBy === 'function',
    '__test__ 必须导出 planFaceBlockedBy,否则本锁只能去抄第二份判据(§22c)',
  )
})

test('护栏③:工作树副本读不到 ⇒ 让路(未判定不猜,§0.3)', () => {
  const dir = mkScratch('claim-guard-')
  try {
    // 夹具目录里没有 PROJECT_PLAN.md ⇒ readFileSync 抛 ⇒ 必须让路而不是放行
    const r = strip.planFaceBlockedBy([{ line: 1, raw: '- [ ]（进行中） x' }], { root: dir })
    assert.equal(r.blocked, true, '取不到工作树副本 = 判不出 ⇒ 让路(原护栏的失效方向)')
    assert.ok(r.byWorktree.length > 0, '让路必须点名,不得静默')
  } finally {
    rmScratch(dir)
  }
})

test('护栏③ 形状锁:不得再出现"工作树脏 ⇒ 整批让路"那一型,理由必须写在代码里', () => {
  const src = readFileSync(path.join(HERE, '..', 'strip-stale-claim-marks.mjs'), 'utf8')
  assert.ok(
    !/planFaceClean\(/.test(src),
    'planFaceClean(按 git status 判净)必须已退役 —— 它在多会话共写的活文档上天天触发,让器物永久空转',
  )
  assert.ok(
    /脏的是"别人的副本",不是"我的判据面"/.test(src),
    '护栏③ 的立因与失效方向必须写在代码里,不得靠读者自己悟',
  )
  assert.ok(
    /只在本批要摘的旧形态行.*被别席就地改写/.test(src.replace(/\n/g, ' ')) || /就地改写/.test(src),
    '收窄后的判据必须落在"别席就地改写过"这一型上',
  )
})
