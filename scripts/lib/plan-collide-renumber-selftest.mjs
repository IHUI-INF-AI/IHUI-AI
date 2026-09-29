// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-collide-renumber 的自检夹具库(`--self-test` 的实现体)。
 *
 * 为什么搬出去:判据本体与取证夹具是两种东西 —— 挤在一格里,加一条判据就要在几百行夹具里找位置,
 * 而"为了让文件变短而删注释"是净损失。
 * ⚠️ 搬出时那句"守门 11e 对新增文件按 800 行 blocking"**不是真的**:11e 只扫
 * `.ts/.tsx/.js/.jsx`(`scripts/check-file-size.mjs:85`,staged 档 :149 用它筛清单),`.mjs` 不在射程。
 * 拆分的理由因此只能是可读性与关注点,不是过门 —— 假前提会指挥下一个人做错动作。
 * 搬法是**依赖注入**而不是互相 import ——
 * 否则 `plan-collide-renumber.mjs ⇄ 本模块` 就是一个循环,而循环在两处都只有函数声明时"看起来能跑",
 * 一旦谁加了顶层求值就是 undefined(§22c 记过的"两个真相"同族)。
 *
 * 每条 `t(name, cond)` 的 cond 必须是**已求值的布尔**(§22c:传函数恒真 ⇒ 断言从写下起从未跑过,
 * 而账面记的是绿)。这里一律 `cond === true` 或立即求值的 IIFE。
 */
import { DUP_POINTER_RE, keyOfRow, titleOf } from './plan-task-index.mjs'

export function runSelfTest(R) {
  const cases = []
  const t = (name, cond) =>
    cases.push({
      name,
      pass: cond === true,
      got: typeof cond === 'function' ? 'function(从未求值)' : String(cond),
    })
  const LINE_G1 = '- [ ] G-1 与本例无关的一条已入库登记,标题够长够长够长够长够长。'
  const LINE_A = '- [ ] G-8161 本侧的甲议题,内容与对侧完全不同,标题前缀够长够长够长。'
  const LINE_B = '- [ ] G-8161 对侧的乙议题,内容与本侧完全不同,标题前缀够长够长够长。'
  const LINE_SHORT = '- [ ] G-2 短题'
  // 指针行的**真实形状**取自 HEAD 面 PROJECT_PLAN.md 那一族归并产物(§22c:判据的输入必须逐字取自
  // 真实文件)。要点:键位上挂着本号,而题面被 `**[归并]**` 那一段切成空 ⇒ 它不进 F9 的标题集合,
  // 却占着键位 —— 让号时漏掉它,旧号就仍留在产出面上(自检 ④ 钉的正是这一格)。
  const LINE_PTR =
    '- [x] ✅(2026-09-26) **[归并]** 本行与已完成登记同题(主键 「G-8161」),〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记落账:复测 2026-09-28〕⇒ 只落状态、不删行、不重复计账。'
  const OURS = ['# 台账', LINE_G1, LINE_A, LINE_PTR, LINE_SHORT].join('\n')
  const THEIRS = ['# 台账', LINE_G1, LINE_B].join('\n')
  const BASE_WITHOUT = '# 台账\n' + LINE_G1
  const ARCH = '.ihui-agent/archive/PROJECT_PLAN_yielded-ids-2026-09-29.md'
  const arg = (over) => ({ archivePath: ARCH, jump: 100, taken: new Set(), ...over })

  // ① 反例:本侧待改净的一行(副本指针行)对侧**逐字带着而基底没有** ⇒ 让号必被补回 ⇒ 必须拒。
  //    可达性:活行标题两侧不同才构成新增撞号组,而指针行可以两台机各写一份同形的。
  const OURS1 = ['# 台账', LINE_G1, LINE_A, LINE_PTR, LINE_SHORT].join('\n')
  const THEIRS1 = ['# 台账', LINE_G1, LINE_B, LINE_PTR].join('\n')
  const g1 = R.planGroup(
    { key: 'G-8161' },
    arg({ ours: OURS1, theirs: THEIRS1, base: BASE_WITHOUT, occ: R.occupancy([OURS1, THEIRS1]) }),
  )
  t(
    '①对侧逐字带着待改的指针行而基底没有 ⇒ 拒绝让号(会造第三份副本)',
    g1.kind === 'refuse' && /第三份副本/.test(g1.reason || ''),
  )
  t(
    '①配套:F9 差集把这组算成新增,而单侧都不算',
    R.f9AddedGroups(OURS1 + '\n' + LINE_B, [OURS1, THEIRS1]).some((x) => x.key === 'G-8161') &&
      R.f9AddedGroups(OURS1, [OURS1, THEIRS1]).length === 0,
  )

  // ② 正例:对侧没带、基底有本侧那行 ⇒ 式子说旧行不会被补回 ⇒ 必须**允许**(第一版在此误拒)
  const g2 = R.planGroup(
    { key: 'G-8161' },
    arg({ ours: OURS, theirs: THEIRS, base: OURS, occ: R.occupancy([OURS, THEIRS]) }),
  )
  t(
    '②对侧没带、基底有 ⇒ 允许让号(第一版误把 merge-base 当拒绝条件)',
    g2.kind === 'plan',
    g2.reason || '',
  )

  // ③ 反例:注记插在编号位之后 ⇒ 复合主键被改掉 ⇒ 必须判不过
  const note = '【让号测试注记】'
  const headInsert = '- [ ] G-8161 ' + note + ' 本侧的甲议题,内容与对侧完全不同。'
  t(
    '③注记插在编号位之后 ⇒ assertNoteAtTail 判不过',
    R.assertNoteAtTail('- [ ] G-8161 正文', headInsert, note).ok === false,
  )

  // ④ 反例:产出面上旧号仍有键位行 ⇒ verifyProduced 必须点名
  const fake = [
    {
      key: 'G-8161',
      newId: 'G-8300',
      rowOcc: 1,
      rows: [{ before: LINE_A, after: '- [ ] G-8300 本侧的甲议题', oldText: LINE_A }],
    },
  ]
  t(
    '④产出面旧号仍带键位行 ⇒ verifyProduced 点名',
    /旧号 G-8161 仍有/.test(R.verifyProduced(OURS, OURS, fake).problems.join('\n')),
  )

  // ⑤ 反例:指针行里旧号出现两次 ⇒ 拒绝构造(不猜改哪一处)
  const twicePointer =
    '- [x] ✅(2026-09-28) **[归并]** 本行同题(主键 「G-8161」),〔【归并】重复登记副本〕G-8161 与 G-8161 是同题两条。'
  t(
    '⑤同一行里旧号出现两次 ⇒ renumberLine 拒绝',
    R.renumberLine(twicePointer, 'G-8161', 'G-8300', note, false).ok === false,
  )

  // ⑥ 跳距可被覆写且不写死
  const jumpFromEnv = Number(process.env[R.JUMP_ENV] || R.DEFAULT_JUMP)
  const jA = R.pickId('G', R.occupancy([OURS, THEIRS]), {
    texts: [OURS, THEIRS],
    jump: 100,
    taken: new Set(),
  })
  const jB = R.pickId('G', R.occupancy([OURS, THEIRS]), {
    texts: [OURS, THEIRS],
    jump: 7,
    taken: new Set(),
  })
  t(
    '⑥跳距经 env/参数覆写(7 与 100 起点不同,且不等于内置默认)',
    jA.ok &&
      jB.ok &&
      jA.start - jA.frontier === 100 &&
      jB.start - jB.frontier === 7 &&
      jumpFromEnv > 0 &&
      R.DEFAULT_JUMP !== 100,
  )

  // 成对附加:主键/题面稳定性、指针两族、词边界、引用不进前沿、空族降级、F9 差集两向、豁免自证两向
  t('换号后 keyOfRow 取到新号', g2.kind === 'plan' && keyOfRow(g2.rows[0].after) === g2.newId)
  t(
    '换号后题面只差在编号本身(注记不进题面)',
    g2.kind === 'plan' &&
      g2.rows.every((r) => R.titleStable(r.before, r.after, g2.key, g2.newId).ok),
  )
  t(
    '题面被塞进新散文 ⇒ titleStable 必须判不过(这条是 titleStable 的牙)',
    R.titleStable(
      '- [ ] G-700 标题前缀够长够长够长。',
      '- [ ] G-8300 掺进来的新题面,标题前缀够长够长够长。【让号注记】',
      'G-700',
      'G-8300',
    ).ok === false,
  )
  t(
    '短题行(lenient 口径把编号留在题面)换号后仍判稳定',
    (() => {
      const r = R.renumberLine(LINE_SHORT, 'G-2', 'G-8300', note, true)
      return (
        r.ok === true &&
        titleOf(LINE_SHORT) !== titleOf(r.after) &&
        R.titleStable(LINE_SHORT, r.after, 'G-2', 'G-8300').ok === true
      )
    })(),
  )
  t(
    '键位挂着旧号的副本指针行也跟着让号(否则旧号仍留在产出面)',
    (() => {
      if (g2.kind !== 'plan') return false
      return g2.rows.filter((r) => r.atKey && DUP_POINTER_RE.test(r.before)).length >= 1
    })(),
  )
  t(
    '只在正文里指它的指针行:旧号换净、新号恰好一次、指针族判据仍在',
    (() => {
      const row =
        '- [ ] G-123 另一件活着的登记,它自己的主键与本题无关,只是在行尾指向同题的旧登记 G-555 那一条。〔【归并】重复登记副本(2026-09-28)〕'
      if (keyOfRow(row) !== 'G-123' || R.countToken(row, 'G-555') !== 1) return false
      const r = R.renumberLine(row, 'G-555', 'G-8300', note, false)
      return r.ok && DUP_POINTER_RE.test(r.after) && R.countToken(r.after, 'G-555') === 0
    })(),
  )
  t(
    '归档件占过的号不得再发(取号口径含台账 ⊕ 归档件)',
    (() => {
      const bare = R.pickId('G', R.occupancy([OURS, THEIRS]), {
        texts: [OURS, THEIRS],
        jump: 40,
        taken: new Set(),
      })
      // 让 jump 恰好落在一枚"只在归档件里出现过"的号上 ⇒ 它必须被跳过
      const blocked = bare.ok ? bare.id : ''
      const archText =
        '# 归档\n- [x] ✅(2026-09-20) ' + blocked + ' 归档件里早已占用的登记,标题够长够长够长。\n'
      const wide = R.pickId('G', R.occupancy([OURS, THEIRS, archText]), {
        texts: [OURS, THEIRS],
        jump: 40,
        taken: new Set(),
      })
      return (
        bare.ok && wide.ok && wide.id !== blocked && R.keyedRowsWith(archText, blocked).length === 1
      )
    })(),
  )
  t('词边界:G-9 不得咬穿 G-94', R.countToken('- [ ] G-94 题面', 'G-9') === 0)
  t(
    '行文引用不进取号前沿(非键位号不算 max)',
    (() => {
      const withProse = R.occupancy([
        OURS,
        THEIRS,
        '# 台账\n- [ ] G-1 参见 G-999999 那条已入库登记的处置。',
      ])
      return withProse.maxBy.G < 999999
    })(),
  )
  t(
    '族在面上零条登记 ⇒ 拒绝发号(不猜起点)',
    R.pickId('ZZ', R.occupancy([OURS]), { texts: [OURS], jump: 100, taken: new Set() }).ok ===
      false,
  )
  t(
    'F9 差集:两侧本来就撞的组不得算成新增',
    (() => {
      const both =
        '- [ ] G-700 甲议题,标题前缀够长够长够长够长。\n- [ ] G-700 乙议题,标题前缀够长够长够长够长。'
      return R.f9AddedGroups(both, [both, both]).length === 0
    })(),
  )
  t(
    'F9 差集:两侧都不撞而合并结果撞 ⇒ 必须点名',
    R.f9AddedGroups(OURS + '\n' + LINE_B, [OURS, THEIRS]).some((x) => x.key === 'G-8161'),
  )
  // 「退化面」这一维必须自己说话:theirs 已被本侧包含时,以本侧为脊柱的归并不引入任何对侧行
  // ⇒ F9 差集**结构上恒 0**;拿那个 0 当"没有撞号"的合格证就是本仓最高频的失效型。
  // 四条成对:同 sha ⇒ 点名 / 异 sha ⇒ 不点名 / 任一缺 ⇒ null(不猜) / 前缀相等 ⇒ null(只认逐字全 sha)。
  t(
    '退化面(merge-base == theirs)⇒ 必须点名"这一档量不到东西"',
    (() => {
      const S = 'a'.repeat(40)
      const n = R.degenerateFaceNote(S, S)
      return typeof n === 'string' && /0 组/.test(n) && /合格证/.test(n)
    })(),
  )
  t(
    '真分叉(merge-base != theirs)⇒ 不得误标退化面(那会把可量的面说成不可量)',
    R.degenerateFaceNote('b'.repeat(40), 'c'.repeat(40)) === null,
  )
  t(
    '任一 sha 取不到 ⇒ null(既不猜"退化",也不猜"正常")',
    R.degenerateFaceNote('', 'c'.repeat(40)) === null &&
      R.degenerateFaceNote('b'.repeat(40), null) === null,
  )
  t(
    '前缀相等不得当等值(只比逐字全 sha;短串可能属另一枚提交)',
    R.degenerateFaceNote('a'.repeat(40), 'aaaa') === null,
  )
  t(
    '零损失断言:新号键位行数 ≠ 让号行数 ⇒ 点名',
    (() => {
      const out = OURS.replace(
        LINE_A,
        '- [ ] G-8300 本侧的甲议题,内容与对侧完全不同,标题前缀够长够长够长。',
      )
      const one = [
        {
          key: 'G-8161',
          newId: 'G-8300',
          rowOcc: 9,
          rows: [{ before: LINE_A, after: 'x', oldText: LINE_A }],
        },
      ]
      return /键位行数/.test(R.verifyProduced(OURS, out, one).problems.join('\n'))
    })(),
  )
  t(
    '留痕齐备 ⇒ 门 71 的归档豁免自证通过',
    (() => {
      const arch = '# 留痕\n\n' + LINE_A + '\n'
      return (
        R.proveArchiveExemption([{ key: 'G-8161', rows: [{ oldText: LINE_A }] }], {
          archivePath: ARCH,
          archiveNewText: arch,
          otherBlobs: new Map(),
        }).ok === true
      )
    })(),
  )
  t(
    '留痕缺失 ⇒ 豁免自证判不过(不是静默通过)',
    R.proveArchiveExemption(
      [{ key: 'G-8161', rows: [{ oldText: '- [ ] G-8161 没人留痕的一行原文。' }] }],
      { archivePath: ARCH, archiveNewText: '# 空\n', otherBlobs: new Map() },
    ).ok === false,
  )
  t(
    '归档件名的形状由门 71 那一份判据认(随手编的名字拿不到豁免)',
    (() => {
      const arch = '# 留痕\n\n' + LINE_A + '\n'
      return (
        R.proveArchiveExemption([{ key: 'G-8161', rows: [{ oldText: LINE_A }] }], {
          archivePath: 'notes.md',
          archiveNewText: arch,
          otherBlobs: new Map(),
        }).ok === false
      )
    })(),
  )
  t(
    '归档追加块里每行改前原文都逐字可见(不是摘要)',
    (() => {
      const txt = R.buildArchiveAppend(
        '# 原档\n',
        [
          {
            key: 'G-8161',
            newId: 'G-8300',
            frontier: 1,
            jump: 100,
            tried: 1,
            rows: [{ oldText: LINE_A }],
          },
        ],
        ARCH,
      )
      return txt.includes(LINE_A) && /改前整行原文/.test(txt)
    })(),
  )
  t(
    '让号方案本身可回读:构造面旧号零键位行、新号按份数在位',
    (() => {
      if (g2.kind !== 'plan') return false
      const pairs = g2.rows.map((r) => ({ before: r.before, after: r.after, all: true }))
      const out = OURS.split('\n')
      for (const p of pairs) {
        for (let i = 0; i < out.length; i++) if (out[i] === p.before) out[i] = p.after
      }
      const txt = out.join('\n')
      return (
        R.keyedRowsWith(txt, 'G-8161').length === 0 &&
        R.keyedRowsWith(txt, g2.newId).length === 2 &&
        R.verifyProduced(OURS, txt, [g2]).problems.length === 0
      )
    })(),
  )

  const failed = cases.filter((c) => !c.pass)
  for (const c of cases)
    console.log(
      `${c.pass ? '✅' : '❌'} ${c.name}${c.pass ? '' : ` —— 实得:${String(c.got).slice(0, 160)}`}`,
    )
  console.log(`合计 ${cases.length} 条,通过 ${cases.length - failed.length},失败 ${failed.length}`)
  return failed.length === 0 ? 0 : 1
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
