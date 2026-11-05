// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端级联编排器的镜像测试(§22c:全部 import 源出口 __test__,本文件零复算判据)。
//
// 钉死五件事:
//   A1 器物在位锁:STAGES 每段脚本真实存在(§0.8 出路必须真跑得通;S8 同一出口,这里再成对锁一次);
//   A2 判序不变量:derive < land < declare/converge/create/convert < rebuild < verify(倒序=下游拿中间态);
//   A3 写盘闸门:缺省档任何 write 段都不得被放行(一键级联的"默认只读"是机主安全底线);
//   A4 三态分离:red(验尺 rc≠0)与 failed(器物败)与 unjudged(起不动)互不并桶(§0.3);
//   A5 摘要如实:多行 JSON 的收尾 "}" 不得被当结论读数(2026-11-01 实测失真型,回归锁);
//   A10 --only=<stageId> 对全部段严格只跑指定段(选择器失效型回归锁;段数从 STAGES 派生,不写死);
//   A11 未知 stageId / 空 --only 当场 exit 2 并列出可用 id(不静默空跑);
//   A12 第 16 段段注门号 = 237(与实际守门一致,防"文档写 131"再腐化)。
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { __test__ as C } from '../sync-cross-end-cascade.mjs'

const SCRIPTS = join(import.meta.dirname, '..')

test('A1 器物在位锁:每段脚本都在 scripts/ 下真实存在', () => {
  for (const s of C.STAGES) {
    assert.ok(existsSync(join(SCRIPTS, s.script)), `${s.name} 指向的 ${s.script} 不在位`)
  }
})

test('A2 判序不变量:派生最先、校验压轴、重建排在校验前', () => {
  const kinds = C.STAGES.map((s) => s.kind)
  assert.equal(kinds[0], 'derive')
  assert.ok(kinds.indexOf('land') > kinds.indexOf('derive'))
  assert.ok(kinds.indexOf('rebuild') > kinds.lastIndexOf('land'))
  assert.ok(kinds.indexOf('rebuild') < kinds.indexOf('verify'))
  assert.equal(kinds.at(-1), 'verify')
  // 三端落档内部也要 web→RN→小程序(与 guardian 主轮次同序);按器物名筛非色档三枚,
  // 不把"land 档只有这三枚"写死(色轴落档 rn-color 也是 land 档)。
  const tierLands = C.STAGES.filter((s) => s.kind === 'land' && /-style-tiers$/.test(s.script.replace(/\.mjs$/, ''))).map((s) => s.name)
  assert.deepEqual(tierLands, ['land-web', 'land-rn', 'land-miniapp'])
  const lands = C.STAGES.filter((s) => s.kind === 'land').map((s) => s.name)
  assert.ok(lands.includes('rn-color'), 'RN 色轴落档必须在链里(色档不在链里 = 一键链只跟非色档)')
  assert.ok(
    lands.indexOf('rn-color') < lands.indexOf('land-miniapp'),
    '色轴落档必须排在小程序落档之前(源改值 ⇒ RN 先跟随 ⇒ 小程序再跟随 RN)',
  )
  assert.ok(
    C.STAGE_IDS.indexOf('rn-token-pairs') < C.STAGE_IDS.indexOf('rn-color'),
    '色档入表必须早于色值落档(先有档可走,才谈得上把字面量换成取用)',
  )
})

test('A3 写盘闸门:缺省档只放行零写预演段,无零写档的点名跳;--apply 全放行;--skip 必跳', () => {
  const dry = C.parseArgs([])
  const applied = C.parseArgs(['--apply'])
  let previewed = 0
  let skippedNoPreview = 0
  for (const s of C.STAGES) {
    const d = C.stageDisposition(s, dry)
    if (!s.write) {
      assert.equal(d, null, `${s.name} 只读段不得被缺省跳过`)
    } else if (s.preview) {
      previewed += 1
      assert.equal(d, null, `${s.name} 有零写档却在缺省档被跳 ⇒ 预演面少一维,读数会假称"没活"`)
      assert.deepEqual(C.stageArgv(s, dry), [...s.preview], `${s.name} 缺省档必须装配该段自己的零写 argv`)
    } else {
      skippedNoPreview += 1
      assert.equal(d?.state, 'skipped', `${s.name} 无零写档却缺省放行 = 越权写盘`)
      assert.match(d.detail, /无零写预演档/, '跳过必须点名原因')
      assert.match(d.detail, /不等于"无待落"/, '点名跳过不得被读成"预演过且没活"(§0.3)')
    }
    assert.equal(C.stageDisposition(s, applied), null, `${s.name} --apply 档必须放行`)
  }
  // 覆盖面自证:预演必须真有其段 —— 否则本例全绿而链条退回"整段跳过"的旧形态(2026-11-05 之前的病)
  assert.ok(previewed >= 14, `缺省档真预演的写段只有 ${previewed} 枚 ⇒ 一键链又变回"只校验不预演"`)
  // 无零写档的段必须**逐段具名**:新增一段"悄悄预演不了"要在这里登记,不许靠计数蒙过。
  // 2026-11-05 两枚原有段(miniapp-pages / derive-tokens)都补出了零写档 ⇒ 现读空集;
  // 空集是**地板不是天花板** —— 有人把写腿挪回判路,本例立刻红并要求重新具名。
  assert.deepEqual(
    C.STAGES.filter((s) => s.write && !s.preview).map((s) => s.name),
    [],
    '无零写档的段集合与登记不符 ⇒ 要么有人新加了一段没交代,要么某段已能做零写档却没翻正',
  )
  assert.equal(
    previewed + skippedNoPreview,
    C.STAGES.filter((s) => s.write).length,
    '每一枚写盘段都要在"真预演 / 具名跳过"两桶里各归其一 ⇒ 有段两样都没登记就是静默漏维',
  )
  const sk = C.parseArgs(['--apply', '--skip=land-rn'])
  assert.equal(
    C.stageDisposition(
      C.STAGES.find((x) => x.name === 'land-rn'),
      sk,
    ).state,
    'skipped',
  )
  // --apply 档的 argv 装配不变:base + 该段写旗(预演改造不得动落盘面)
  const css = C.STAGES.find((x) => x.name === 'verify-css-tokens')
  assert.deepEqual(C.stageArgv(css, applied), [...css.base, ...css.apply])
})

test('A4 态分离并互斥:done/red/failed/pending/unjudged/skipped 不并桶', () => {
  const V = { kind: 'verify', redOnFail: true }
  const W = { kind: 'land' }
  const P = { kind: 'create', write: true, pendingRc: [1] }
  assert.equal(C.classifyStage(V, { ran: true, rc: 0, spawnable: true }), 'done')
  assert.equal(C.classifyStage(V, { ran: true, rc: 1, spawnable: true }), 'red')
  assert.equal(C.classifyStage(W, { ran: true, rc: 1, spawnable: true }), 'failed')
  // pending 只在预演档、且只在该段自己登记的码上生效;写盘档同码仍是 failed(不得反向洗白真败)
  assert.equal(C.classifyStage(P, { ran: true, rc: 1, spawnable: true, preview: true }), 'pending')
  assert.equal(C.classifyStage(P, { ran: true, rc: 1, spawnable: true, preview: false }), 'failed')
  assert.equal(C.classifyStage(P, { ran: true, rc: 2, spawnable: true, preview: true }), 'unjudged')
  assert.equal(C.classifyStage(P, { ran: true, rc: 3, spawnable: true, preview: true }), 'failed')
  assert.equal(C.classifyStage(W, { ran: true, rc: null, spawnable: false }), 'unjudged')
  assert.equal(C.classifyStage(W, { ran: false, rc: null, spawnable: false }), 'skipped')
  // pending 不顶退出码:预演看见活 ≠ 这条链坏了(顶红会把人逼去跳门,§12e)
  assert.equal(C.chainExit(['done', 'pending']), 0)
  assert.equal(C.chainExit(['pending', 'unjudged']), 2)
  assert.equal(C.chainExit(['pending', 'failed']), 1)
})

test('A5 摘要如实:多行 JSON 不读成"}";判据行优先;空输出不冒充', () => {
  assert.equal(C.summarize(''), '无输出')
  const jsonish = ['{"face":"head"', '"state":"clean"', '  "applied": 0', '}']
  assert.match(C.summarize(jsonish.join('\n')), /clean/, 'JSON 段必须收成判据读数,不能再落 "}"')
  assert.doesNotMatch(
    C.summarize(jsonish.join('\n')),
    /^\}$/,
    '收尾花括号当结论 = 2026-11-01 实测失真型',
  )
  assert.match(C.summarize('noise line\n结论:LAND-TIERS state=applied files=99'), /state=applied/)
})

test('A6 退出码判序:red 优先于 unjudged,"没判过"不得冒充 0', () => {
  assert.equal(C.chainExit(['done', 'skipped']), 0)
  assert.equal(C.chainExit(['done', 'unjudged']), 2)
  assert.equal(C.chainExit(['unjudged', 'failed']), 1)
  assert.equal(C.chainExit(['red', 'unjudged']), 1)
})

test('A7 旗标闸:两面旗同给/未知旗标/--only 打错字 一律 usageError(当场拒绝,不静默空跑)', () => {
  assert.match(C.parseArgs(['--apply', '--dry-run']).usageError, /互斥/)
  assert.match(C.parseArgs(['--wat']).usageError, /未知旗标/)
  assert.match(C.parseArgs(['--only=nope']).usageError, /未知令牌/)
  assert.equal(C.parseArgs(['--only=verify']).usageError, null)
})

test('A8 一键入口在位自证:根 package.json 必须真挂着 sync:cross-end 两条(§0.9 接线不得只写在文档里)', () => {
  let pkg = null
  try {
    pkg = JSON.parse(readFileSync(join(SCRIPTS, '..', 'package.json'), 'utf8'))
  } catch {
    assert.fail('package.json 读不到/坏了 ⇒ 在位性未判定,不得记绿(§0.3)')
  }
  assert.equal(pkg.scripts?.['sync:cross-end'], 'node scripts/sync-cross-end-cascade.mjs')
  assert.equal(
    pkg.scripts?.['sync:cross-end:apply'],
    'node scripts/sync-cross-end-cascade.mjs --apply',
  )
})

test('A9 css-tokens 写腿:--apply 档实派 argv 恰为 ["--write"],且排在所有派生腿之前(2026-11-01 断链格)', () => {
  const stage = C.STAGES.find((s) => s.name === 'verify-css-tokens')
  assert.ok(stage, 'verify-css-tokens 登记条不存在')
  assert.equal(stage.script, 'sync-css-tokens.mjs')
  assert.equal(stage.write, true, '未标 write:true ⇒ --apply 档不会追加写旗,升级未落地')
  // 断言参数数组本身(stageArgv = runStage 消费的唯一装配出口),不是登记册散文
  const argv = C.stageArgv(stage, C.parseArgs(['--apply']))
  assert.deepEqual(argv, ['--write'])
  assert.ok(
    !argv.includes('--check'),
    '--check 与 --write 同给会被器物互斥闸 exit 2,装配层不得拼出',
  )
  // 顺序:tokens.css 受管块生成必须在拿它当源的下游腿之前(倒序 = 下游派生旧面)
  const idx = C.STAGES.indexOf(stage)
  for (const dep of ['derive-tokens', 'land-web', 'land-rn', 'land-miniapp']) {
    const j = C.STAGES.findIndex((s) => s.name === dep)
    assert.ok(j > idx, `${dep} 排在 css-tokens 生成腿之前 = 拿到旧 tokens.css 派生(中间态)`)
  }
})

test('A10 --only=<stageId> 对全部段严格只跑指定段;段类选择不扩成全量', () => {
  // 段数不写死:写死过一次(20)而实际 21,自检与镜像测试双双先炸,炸的形态与"选择器失效"同形。
  // 改为下限守卫 + 全量遍历,新增段天然被覆盖,误删段会撞下限。
  assert.ok(C.STAGES.length >= 20, `段数坍缩到 ${C.STAGES.length} ⇒ 链条被误删`)
  for (const s of C.STAGES) {
    const sel = C.selectStages(C.STAGES, C.parseArgs([`--only=${s.name}`]))
    assert.deepEqual(
      sel.map((x) => x.name),
      [s.name],
      `--only=${s.name} 未恰好命中该段(选择器失效型)`,
    )
  }
  const land = C.selectStages(C.STAGES, C.parseArgs(['--only=land']))
  // 段类档数同样不写死(2026-11-05 补色轴腿后 land 档由 3 变 4,写死 3 的形态与"选择器少选一段"同形)
  assert.equal(land.length, C.STAGES.filter((s) => s.kind === 'land').length, '段类选择必须恰好等于该段类全集')
  assert.ok(land.length >= 3, 'land 档数异常坍缩')
  assert.ok(land.every((s) => s.kind === 'land'))
  const createSel = C.selectStages(C.STAGES, C.parseArgs(['--only=create']))
  assert.ok(createSel.length > 0 && createSel.every((s) => s.kind === 'create'), '段类之间不得串味')
  assert.notDeepEqual(createSel.map((s) => s.name), land.map((s) => s.name), '反向对照:两种段类选出同一集合 = 选择器失灵')
})

test('A11 未知 stageId / 空 --only 一律 usageError 并列出可用 id,不静默空跑', () => {
  const bad = C.parseArgs(['--only=reconcile']).usageError
  assert.match(bad, /未知令牌/)
  assert.match(bad, /可用 stageId=/)
  assert.match(bad, /portal-converge/, '报错必须给出真实段 id 清单,不能只报段类')
  assert.match(C.parseArgs(['--only=']).usageError, /没有段 id/)
  assert.match(C.parseArgs(['--only=']).usageError, /可用 stageId=/)
  assert.equal(C.parseArgs(['--only=verify-ui-parity']).usageError, null)
})

test('A13 判红理由:stdout 空时落到 stderr,不得用"无输出"盖掉真红因', () => {
  // 门 285 现读即此型(结论打 stderr、stdout 空):旧式 summarize(out) || errText 恒短路。
  assert.match(C.redReason('', '❌ 映射表体检失败 3 处'), /映射表体检失败 3 处/)
  assert.match(C.redReason('', ''), /未写 stdout/)
  assert.match(C.redReason('结论:state=clean', 'noise'), /state=clean/)
})

test('A12 覆盖段段注门号与实际守门一致(237,不是 131)', () => {
  const s = C.STAGES.find((x) => x.name === 'verify-screen-coverage')
  assert.ok(s, 'verify-screen-coverage 登记条不存在')
  assert.match(s.desc, /门 237/)
  assert.doesNotMatch(s.desc, /门 131/)
})

test('A14 land-web 写腿安全锁:--apply 档必须锁字重 + 补继承钉,绝不裸 --apply', () => {
  // 2026-11-04:该段原为 apply: ['--apply'],比守护少两枚旗 ⇒ 一键链会把无 font-* 伴随的
  // text-xl→text-heading 从 400 顶到 700(落档器头注的编译取证反例),且与自愈腿口径分叉。
  const stage = C.STAGES.find((x) => x.name === 'land-web')
  assert.ok(stage, 'land-web 段读不到')
  const argv = C.stageArgv(stage, C.parseArgs(['--apply']))
  assert.ok(argv.includes('--only-weight-locked'), '缺锁档旗 ⇒ 静默改全站字重')
  assert.ok(argv.includes('--pin-inherit-weight'), '缺继承钉 ⇒ 该腿恒报 files=0 changes=0')
  assert.ok(argv.includes('--limit'), '共享工作区必须小批落盘')
  // 反向对照:把段打回裸 --apply,同一判据必须翻红(形状锁不能空转)。
  const naked = C.stageArgv({ ...stage, apply: ['--apply'] }, C.parseArgs(['--apply']))
  assert.ok(!naked.includes('--only-weight-locked'), '形状锁没有牙:裸 --apply 也被判成通过')
  assert.ok(!naked.includes('--pin-inherit-weight'), '形状锁没有牙:裸 --apply 也被判成通过')
})

// ── A15–A19「有待落退 0」正文探针层(2026-11-05 立)───────────────────────────────
// 立因:旧 classifyStage 对 rc=0 无条件记 done,而 land-rn / heal-stale-dist / plan-rn-token-pairing
// 这些器物把"本轮有待落"写在自述结论正文里、退出码照退 0 —— 实测 RN 字号待落 2 处与
// @ihui/types dist 落后都被级联读成"判过了"。一键入口看不见缺口 = 机主要的全自动同步不成立。
const stageOf = (name) => {
  const s = C.STAGES.find((x) => x.name === name)
  assert.ok(s, `${name} 段读不到`)
  return s
}

test('A15 通道覆盖锁:每个写盘段至少有一条"有待落"通道(pendingRc 或正文探针),verify 段不得挂探针', () => {
  const writes = C.STAGES.filter((s) => s.write)
  assert.ok(writes.length >= 10, '写盘段数异常(登记表被洗?)')
  const noChannel = writes.filter((s) => !s.pendingProbe && !Array.isArray(s.pendingRc))
  assert.deepEqual(
    noChannel.map((s) => s.name),
    [],
    '这些写盘段既无 pendingRc 也无正文探针 ⇒ rc=0 会把待落读成 done(假绿)',
  )
  // 反向对照:摘掉一枚段的通道,同一判据必须翻红(形状锁不能空转)。
  const first = writes[0].name
  const crippled = writes.map((s) => ({ ...s, pendingProbe: undefined, pendingRc: s.name === first ? undefined : s.pendingRc }))
  const hit = crippled.filter((s) => !s.pendingProbe && !Array.isArray(s.pendingRc))
  assert.ok(hit.length >= 1, '反向对照失效:摘掉通道后判据仍判不出')
  const verifyWithProbe = C.STAGES.filter((s) => !s.write && s.pendingProbe)
  assert.deepEqual(verifyWithProbe.map((s) => s.name), [], 'verify 段的红由 rc 判,不该挂正文探针')
})

test('A16 rc=0 而正文有待落 ⇒ pending(land-rn 数组形 / heal-stale-dist state 形 / 计数形各一例)', () => {
  // 形态取自 2026-11-05 实测 stdout,不自己发明字段。
  const rn = C.pendingFromBody(stageOf('land-rn'), {
    scanned: 893,
    changedFiles: [{ file: 'apps/mobile-rn/src/components/Carousel.tsx', changes: 2 }],
    totalChanges: 2,
    held: [],
  })
  assert.equal(rn.state, 'pending', `land-rn 正文有 2 处待落必须报 pending,实读 ${JSON.stringify(rn)}`)
  assert.match(rn.detail, /changedFiles=1/, 'pending 结论要能指出是哪一维有活')

  const dist = C.pendingFromBody(stageOf('rebuild-dist'), {
    state: 'pending',
    targets: [{ pkg: '@ihui/types', fix: 'pnpm --filter @ihui/types build' }],
    healed: [],
    still: [],
    refused: [],
  })
  assert.equal(dist.state, 'pending', 'dist 落后(state=pending)不得记 done')

  const web = C.pendingFromBody(stageOf('land-web'), { scanned: 3643, changedFiles: 4, changes: 4, held: 0 })
  assert.equal(web.state, 'pending', '计数形 changedFiles=4 也必须认出来')

  // 判定层同批验:rc=0 + bodyState=pending ⇒ 段态 pending;--apply 档(非 preview)不受探针影响。
  assert.equal(C.classifyStage(stageOf('land-rn'), { ran: true, rc: 0, spawnable: true, preview: true, bodyState: 'pending' }), 'pending')
  assert.equal(C.classifyStage(stageOf('land-rn'), { ran: true, rc: 0, spawnable: true, preview: false, bodyState: 'pending' }), 'done')
})

test('A17 正向对照:正文自述为零 ⇒ done(探针不得把无活段顶成 pending)', () => {
  for (const [name, clean] of [
    ['land-rn', { scanned: 893, changedFiles: [], totalChanges: 0, held: [] }],
    ['land-web', { scanned: 3643, changedFiles: 0, changes: 0, held: 0 }],
    ['rebuild-dist', { state: 'clean', targets: [], healed: [], still: [], refused: [] }],
    ['message-pack', { state: 'clean', planned: 0, pendingLanding: 0, namespaces: [], explicitKeys: [] }],
    ['derive-tokens', { state: 'clean', pending: 0, pendingPaths: [], unjudged: 0 }],
  ]) {
    const r = C.pendingFromBody(stageOf(name), clean)
    assert.equal(r.state, 'done', `${name} 零待落必须判绿,实读 ${JSON.stringify(r)}`)
    assert.equal(C.classifyStage(stageOf(name), { ran: true, rc: 0, spawnable: true, preview: true, bodyState: r.state }), 'done')
  }
})

test('A18 探针登记了却拿不到输入 ⇒ unjudged(§0.3 "没判"不得冒充"判过")', () => {
  const s = stageOf('land-rn')
  assert.equal(C.pendingFromBody(s, null).state, 'unjudged', '器物输出不是 JSON ⇒ 未判定')
  const missing = C.pendingFromBody(s, { scanned: 893, held: [] })
  assert.equal(missing.state, 'unjudged', '必填探针字段缺失(器物改了结论形状)⇒ 未判定,不是绿')
  assert.match(missing.detail, /changedFiles/)
  assert.equal(
    C.classifyStage(s, { ran: true, rc: 0, spawnable: true, preview: true, bodyState: 'unjudged' }),
    'unjudged',
    '未判定必须进整体退出码 2,不能被 rc=0 洗成 0',
  )
  // optional 字段取不到不顶未判定(它是附加读数,不是必读数);必填字段读得出即照常判。
  const opt = C.pendingFromBody(stageOf('land-web'), { changedFiles: 3 })
  assert.equal(opt.state, 'pending', 'changes 缺席是可选读数,changedFiles=3 仍须判有待落')
  assert.match(opt.detail, /changedFiles=3/)
  // 可落集为空而只有归因维(歧义/源无等值)⇒ done:那些维结构上没有可自动落的形态,
  // 算成 pending 会让链永远读不出绿;它们归对账门与台账管,不归级联。
  const onlyAttribution = C.pendingFromBody(stageOf('rn-token-pairs'), {
    pairs: [],
    ambiguous: [{ rn: 'surface.inputBg' }],
    noSource: [{ rn: 'brand.dark' }],
  })
  assert.equal(onlyAttribution.state, 'done', '歧义/源无等值不得算成级联待落')
  assert.equal(C.pendingFromBody(stageOf('rn-token-pairs'), { pairs: [{ rn: 'x', css: '--y' }] }).state, 'pending')
})

test('A19 结论取面:整段 JSON / 前置人读日志行 / 空输出 三形都能取(且空输出解不出 ⇒ 走 A18)', () => {
  assert.deepEqual(C.extractConclusion('{"state":"clean","targets":[]}'), { state: 'clean', targets: [] })
  const mixed = C.extractConclusion(
    'AUTO-REGISTER-PORTAL face=head state=off candidates=0 applied=0\nAUTO-REGISTER-RENDER face=head state=off 改判=0\n{\n  "face": "head",\n  "portalConverge": { "candidates": 0 }\n}\n',
  )
  assert.equal(mixed.portalConverge.candidates, 0, '前置日志行不得挡住 JSON 结论')
  // 机读行夹在人读行**中间**(fix-rn-color-literals 实测形态:报告行 ⇒ {"summary":…} ⇒ "只读档"尾行)。
  // 旧实现从候选起点一直取到文末 ⇒ 尾部散文一起进 JSON.parse ⇒ 恒解不出 ⇒ 本段被判 unjudged:
  // 那是把看得见的结论读成看不见,不是保守(§0.3 的反向失效)。
  const middle = C.extractConclusion(
    '[fix-color-literals] 面=head 覆盖面档 174 枚;命中 5 处 ⇒ 可直接改写 0\n  歧义 HomeScreen.tsx:347 "#FFFFFF" 命中 11 档\n{"summary":{"face":"head","hits":5,"safe":0,"needsTheme":0,"ambiguous":5,"files":0}}\n[fix-color-literals] 只读档(未写盘)。加 --apply 改写盘上 0 处 landing=0 skipLanded=0\n',
  )
  assert.equal(middle?.summary?.safe, 0, '夹在中间的机读行必须解出')
  assert.equal(C.pendingFromBody(stageOf('rn-color'), middle).state, 'done', '解出后即按正文判,不得回落 unjudged')
  assert.equal(C.extractConclusion(''), null)
  assert.equal(C.extractConclusion('PLAN-RN-PAIRING face=head 未登记色档 10'), null)
})

test('A20 盲区覆盖锁:守护 runCrossEndApplyLeg 派发的每一枚跨端写盘腿都必须在级联里(2026-11-05 补色轴/兼容面)', () => {
  // 立因:守护节拍与一键级联是两条派发面。腿只在守护里挂 ⇒ 改完一笔要等 30-60 分钟节拍或人敲;
  // 本次实测抓到两枚缺席(fix-rn-color-literals 色轴、gen-rn-compat 小程序兼容面)并已补进链。
  const guardian = readFileSync(join(SCRIPTS, 'git-guardian.mjs'), 'utf8')
  const legs = [...new Set([...guardian.matchAll(/scriptName:\s*'([^']+\.mjs)'/g)].map((m) => m[1]))]
  // 阳性对照:抽取器必须真量到守护的腿集(读出 0 枚 = 尺子坏了,不是"没有盲区")
  assert.ok(legs.length >= 4, `守护 scriptName 腿集只量到 ${legs.length} 枚 ⇒ 抽取式失效,本锁等同空转`)
  const stageScripts = new Set(C.STAGES.map((s) => s.script))
  const missing = legs.filter((l) => !stageScripts.has(l))
  assert.deepEqual(missing, [], `这些守护在跑的跨端写盘腿不在一键级联里(一键链有盲区):${missing.join(', ')}`)
  // 反向对照:把级联清单换成一枚已知不含守护腿的假清单,同一判据必须翻红(形状锁不能空转)
  const crippled = new Set(['sync-css-tokens.mjs'])
  assert.ok(legs.filter((l) => !crippled.has(l)).length > 0, '反向对照失效:假清单也被判成覆盖')
})

test('A21 色轴段两形:summary.safe>0 ⇒ pending;safe=0 而 hits≠0(同值歧义)⇒ done 不冒活', () => {
  const color = stageOf('rn-color')
  assert.equal(C.pendingFromBody(color, { summary: { face: 'head', hits: 5, safe: 2, ambiguous: 3, files: 2 } }).state, 'pending')
  // 2026-11-05 现读形态:hits=5 / safe=0 / ambiguous=5 —— 歧义面器物自己不猜,级联也不得据此报有待落
  assert.equal(C.pendingFromBody(color, { summary: { face: 'head', hits: 5, safe: 0, needsTheme: 0, ambiguous: 5, files: 0 } }).state, 'done')
  assert.equal(C.pendingFromBody(color, null).state, 'unjudged', '登记了探针却拿不到结论 ⇒ 不冒充绿')
  // 兼容面腿:零写档 --check 缺名字退 1,必须由 pendingRc 接住(而不是被判成器物坏)
  const compat = stageOf('rn-compat')
  assert.deepEqual(compat.pendingRc, [1])
  assert.equal(C.classifyStage(compat, { ran: true, rc: 1, spawnable: true, preview: true }), 'pending')
  assert.equal(C.classifyStage(compat, { ran: true, rc: 2, spawnable: true, preview: true }), 'unjudged')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
