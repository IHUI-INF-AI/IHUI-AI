// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/post-merge-ledger-sync.test.mjs —— §22c 镜像:旁路合并落地后自愈唯一出口的判据。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { maskComments } from '../lib/code-mask.mjs'
import {
  postMergeLedgerSync,
  ledgerNoteResidue,
  twinFoldResidue,
  purgeWorkResidue,
} from '../lib/post-merge-ledger-sync.mjs'

const require = createRequire(import.meta.url)

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = (rel) => readFileSync(join(HERE, '..', rel), 'utf8')
const CODE = (rel) => maskComments(SRC(rel))

test('L1 形状锁:派生必须走 process.execPath + 绝对路径 + windowsHide + timeout,裸 node 不得回来', () => {
  const code = CODE('lib/post-merge-ledger-sync.mjs')
  assert.match(code, /process\.execPath/, '必须用 process.execPath(裸 node 依赖 PATH,守护/服务上下文里不通)')
  assert.doesNotMatch(code, /execFileSync\(\s*'node'/, "不得再写裸 'node' 派生")
  assert.doesNotMatch(code, /spawnSync\(\s*'node'/, "不得再写裸 'node' 派生")
  assert.match(code, /windowsHide:\s*true/, '派生控制台程序漏 windowsHide = 用户桌面反复弹窗(§5b)')
  assert.match(code, /timeout:\s*\d+/, '无 timeout 的只读派生可以在共享工作区里挂死整轮收敛(守门 80 那一型)')
  assert.match(code, /resolve\(/, '脚本路径必须由调用方传入的 root 拼绝对路径,不得依赖 cwd')
})

test('L2 装车锁:两条旁路合并落地路径都必须调本出口 —— 只有一条补跑等于该型缺陷一半从未被兜住', () => {
  for (const rel of ['union-converge.mjs', 'git-sync-converge.mjs']) {
    const code = CODE(rel)
    assert.match(
      code,
      /post-merge-ledger-sync\.mjs/,
      `${rel} 没有 import 本出口 ⇒ 旁路合并落地后守门 71 的登记行自愈永不触发`,
    )
    assert.match(code, /postMergeLedgerSync\(/, `${rel} import 了却没调用(判据存在而永不调用 = 没有)`)
  }
})

test('L3 失败臂:自愈没跑成只喊一行,绝不抛、绝不把零丢失自证通过的合并判成失败', () => {
  const heard = []
  const r = postMergeLedgerSync({
    root: 'D:/IHUI-AI',
    log: (s) => heard.push(s),
    readFace: () => '# t\n- [ ] 干净的一行\n', // 注记存量 0 ⇒ 本轮不涉及复清,这一条只测回捞臂
    spawnFn: () => ({ status: 1, stderr: 'boom', stdout: '' }),
  })
  assert.equal(r.ok, false, 'rc!=0 必须如实报 ok:false')
  assert.equal(r.ran, true, "'派生成了但脚本失败' 与 '根本没派生' 是两件事,不得并桶")
  assert.equal(heard.length, 1, `必须喊出来(静默的自愈等于没有自愈),实测 ${JSON.stringify(heard)}`)
  assert.match(heard[0], /不阻断/, '措辞必须写明它不改本轮成败')
})

test('L4 成功臂:点名登记行的那些行必须原样交回调用方,不得吞声', () => {
  const heard = []
  const r = postMergeLedgerSync({
    root: 'D:/IHUI-AI',
    log: (s) => heard.push(s),
    readFace: () => '# t\n- [ ] 干净的一行\n',
    spawnFn: () => ({
      status: 0,
      stdout: '无关行\n✅ 回补 2 条计划登记行\n尾行',
      stderr: '',
    }),
  })
  assert.equal(r.ok, true)
  assert.equal(r.lines.length, 1, `只回读点名登记行的那些行,实测 ${JSON.stringify(r.lines)}`)
  assert.equal(heard.length, 1)
})

test('L5 派生抛错臂:与"跑过而失败"分开计,且同样不抛', () => {
  const heard = []
  const r = postMergeLedgerSync({
    root: 'D:/IHUI-AI',
    log: (s) => heard.push(s),
    readFace: () => '# t\n- [ ] 干净的一行\n',
    spawnFn: () => {
      throw new Error('ENOENT')
    },
  })
  assert.equal(r.ok, false)
  assert.equal(r.ran, false, "'没派生成' 不得被读成 '派生过且没问题'")
  assert.equal(heard.length, 1)
})

test('L6 跳门留痕:union-converge 落合并提交必须写进同一本台账(commit-tree 不跑钩子 ⇒ 不写就永远落进 unknown)', () => {
  const code = CODE('union-converge.mjs')
  assert.match(code, /commit-attestation\.mjs/, '留痕只许用 lib/commit-attestation.mjs 那一份实现')
  assert.match(code, /recordBypassLanding\(/, '必须真调用(注释里提一句不算装车)')
})

/* ══ G-32 复清臂(2026-10-14):旁路合并把已清偿的行带回 ⇒ 同一件器物再过一遍,接在自愈源头 ══
 * 为什么不是"在归并器里折掉它":真档实测带回的那 9 行**带着本侧没有的新取证**
 * (中段插着 `〔真机复核通过@2026-10-14 本席:…〕`),少带 = 丢掉别人刚写的行,不可恢复;
 * 而 `plan-pointer-purge` 的准入闸本来就是干这件事的(逐字承载才删 / 独有段先移植 / 判不准点名交人工)。
 */
const NOTE_FACE = `- [ ] G-9 事甲:持有行正文交代。\n- [ ] G-10 事乙 〔【归并】重复登记副本(2026-09-26):与 G-9 同题,派单以那条为准,本行不再单独派单。〕\n`
const CLEAN_FACE = '# t\n- [ ] 干净的一行\n'

test('L7 存量 0 ⇒ 完全不派生复清(不给每轮收敛加常数成本,也不产生噪声)', () => {
  const seen = []
  const heard = []
  postMergeLedgerSync({
    root: 'X:/fixture',
    log: (s) => heard.push(s),
    readFace: () => CLEAN_FACE,
    spawnFn: (cmd, args) => {
      seen.push(args.join(' '))
      return { status: 0, stdout: '✅ 无登记行丢失', stderr: '' }
    },
  })
  assert.equal(seen.length, 1, `只该派生回捞那一次,实测 ${JSON.stringify(seen)}`)
  assert.doesNotMatch(seen.join('\n'), /plan-pointer-purge/, '存量 0 却派生复清 = 每轮白花几分钟')
})

test('L8 存量 > 0 ⇒ 派生复清,且走 process.execPath + 绝对路径 + --apply(不是只报数)', () => {
  const seen = []
  const heard = []
  const r = postMergeLedgerSync({
    root: 'X:/fixture',
    log: (s) => heard.push(s),
    readFace: () => NOTE_FACE,
    spawnFn: (cmd, args) => {
      seen.push([cmd, args.join(' ')])
      return {
        status: 0,
        stdout: '✅ 回补 0 条计划登记行\n守恒断言 5/5 通过;门 203 同源自校验 0 键\n✅ 落地 abc12345678(父 def) 删 1 行\n',
        stderr: '',
      }
    },
  })
  assert.equal(seen.length, 2, `回捞 + 复清各一次,实测 ${seen.length}`)
  const [cmd, argline] = seen[1]
  assert.equal(cmd, process.execPath, '复清派生必须用 process.execPath(裸 node 依赖 PATH)')
  assert.match(argline, /plan-pointer-purge\.mjs --apply --absorb$/, `必须带 --apply 真复清(10-15 起还须带 --absorb,否则无注记的真副本折不掉),实测 ${argline}`)
  assert.equal(r.purge.residue, 1)
  assert.equal(r.purge.ok, true)
  assert.ok(heard.some((s) => /复清|带回/.test(s)), `必须喊出来,实测 ${JSON.stringify(heard)}`)
})

test('L9 未判定 ⇒ 不派生、必须报名,且绝不读成"已归零"(§0.3)', () => {
  const seen = []
  const heard = []
  const r = postMergeLedgerSync({
    root: 'X:/fixture',
    log: (s) => heard.push(s),
    readFace: () => '', // 面取不到
    spawnFn: () => {
      seen.push(1)
      return { status: 0, stdout: '✅ 回补 0 条计划登记行', stderr: '' }
    },
  })
  assert.equal(seen.length, 1, '未判定不得派生复清')
  assert.equal(r.purge.residue, null, '未判定必须是 null,不是 0')
  assert.equal(r.purge.ok, false)
  assert.ok(heard.some((s) => /未判定/.test(s)), `必须点名"未判定",实测 ${JSON.stringify(heard)}`)
})

test('L10 复清失败臂:只喊一行、不抛,且第一步的 ok/ran/lines 口径不被第二步改写', () => {
  const heard = []
  const r = postMergeLedgerSync({
    root: 'X:/fixture',
    log: (s) => heard.push(s),
    readFace: () => NOTE_FACE,
    spawnFn: (_cmd, args) =>
      String(args.join(' ')).includes('plan-pointer-purge')
        ? { status: 1, stdout: '', stderr: 'boom' }
        : { status: 0, stdout: '✅ 回补 3 条计划登记行', stderr: '' },
  })
  assert.equal(r.ok, true, '第一步成功就是成功 —— 第二步的红并进第一步会把无关的一侧判成失败(§12e)')
  assert.equal(r.lines.length, 1)
  assert.equal(r.purge.ok, false, '第二步必须单独报账')
  assert.equal(r.purge.ran, true)
  assert.ok(heard.some((s) => /不阻断/.test(s)), `复清失败必须写明不改本轮成败,实测 ${JSON.stringify(heard)}`)
})

test('L11 判据同源锁:本层不得自己抄注记正则,计数只许走守门 13d 那一份', () => {
  const code = CODE('lib/post-merge-ledger-sync.mjs')
  assert.doesNotMatch(code, /【归并】|不再单独派单/, '本层出现判据字面 = 第二份实现,必漂(§22c)')
  assert.match(code, /check-plan-dup-pointer-ratchet\.mjs/, '计数必须来自 13d 的 countPointerRows')
  assert.match(code, /countPointerRows\(/, '必须真调用')
})

test('L12 ledgerNoteResidue 三态:有注记 / 无注记 / 面取不到(未判定 ≠ 0)', () => {
  assert.equal(ledgerNoteResidue({ root: 'X:/fixture', readFace: () => NOTE_FACE }), 1)
  assert.equal(ledgerNoteResidue({ root: 'X:/fixture', readFace: () => CLEAN_FACE }), 0)
  assert.equal(ledgerNoteResidue({ root: 'X:/fixture', readFace: () => '' }), null)
  assert.equal(ledgerNoteResidue({ root: 'X:/fixture', readFace: () => { throw new Error('x') } }), null)
})

test('L13 生产形状只读臂:不设 fixture、真取本仓 HEAD 面 ⇒ 必须量出数字(不是 null)', () => {
  // 这一条只证"尺子在这台机上真能装上":git 取面 + 13d 判据 require 成功。
  // 刻意不断言具体条数(台账每几分钟被别人推进,断言条数 = 造一条会自己烂的绿)。
  // 也刻意不跑"临时仓端到端":plan-pointer-purge 的 ROOT 由自身位置推导,在 fixture 仓里
  // 真跑它会把**本仓**当被审面对象空间落地 —— 那是测试冒充端到端的反面教材。
  const n = ledgerNoteResidue({ root: resolve(HERE, '..', '..') })
  assert.equal(typeof n, 'number', `取不到面/判据装不上 ⇒ 复清永远不触发,实测 ${String(n)}`)
  assert.ok(n >= 0)
})

/* ── 触发缺口那一格(2026-10-15 实测立):注记维为 0 不代表活文档没有被带回的副本 ── */

// 同题不同编号的孪生登记:两行题面逐字同形、编号不同 ⇒ 13d 的 foldTwins 应报可折 ≥1。
const TWIN_FACE = '- [ ] G-40 同一件事的题面,持有行正文交代。\n- [ ] G-41 同一件事的题面,持有行正文交代。\n'

test('L14 夹具自证:TWIN_FACE 必须真的"注记 0 而可折 >0",否则下面那条臂是空跑', () => {
  assert.equal(ledgerNoteResidue({ root: 'X:/fixture', readFace: () => TWIN_FACE }), 0, '夹具不得自带注记(要隔离出第二维)')
  const t = twinFoldResidue({ root: 'X:/fixture', readFace: () => TWIN_FACE })
  assert.ok(typeof t === 'number' && t >= 1, `可折维必须量得到(量不到 = 夹具没造出现场,臂就成了假绿),实测 ${String(t)}`)
  assert.equal(twinFoldResidue({ root: 'X:/fixture', readFace: () => CLEAN_FACE }), 0, '干净面必须判得出 0,不是 null')
  assert.equal(twinFoldResidue({ root: 'X:/fixture', readFace: () => '' }), null, '取不到面 ⇒ 未判定,不冒充 0(§0.3)')
})

test('L15 触发缺口已补:注记 0 而可折 >0 ⇒ 仍派生复清,且必须带 absorb 档', () => {
  const seen = []
  const heard = []
  const r = postMergeLedgerSync({
    root: 'X:/fixture',
    log: (s) => heard.push(s),
    readFace: () => TWIN_FACE,
    spawnFn: (cmd, args) => {
      seen.push([cmd, args.join(' ')])
      return { status: 0, stdout: '✅ 回补 0 条计划登记行\n守恒断言 5/5 通过\n✅ 落地 abc12345678(父 def) 删 1 行\n', stderr: '' }
    },
  })
  assert.equal(seen.length, 2, `回捞 + 复清各一次,实测 ${seen.length}`)
  const [cmd, argline] = seen[1]
  assert.equal(cmd, process.execPath, '复清派生必须用 process.execPath')
  assert.match(argline, /plan-pointer-purge\.mjs --apply --absorb$/, `可折维必须带上 absorb 档(只 --apply 折不掉无注记真副本),实测 ${argline}`)
  assert.equal(r.purge.twinResidue >= 1, true, '第二维读数必须如实回传调用方,不得被折进一个布尔')
  assert.equal(r.purge.ok, true)
  assert.ok(heard.some((s) => /可折/.test(s)), `必须点名第二维,实测 ${JSON.stringify(heard)}`)
})

test('L16 反向锁:两维都判得出 0 才叫"无事可做"(一维未判定时 ok 必须 false,不得读成已归零)', () => {
  const heard = []
  const r = postMergeLedgerSync({
    root: 'X:/fixture',
    log: (s) => heard.push(s),
    readFace: () => CLEAN_FACE,
    spawnFn: () => ({ status: 0, stdout: '✅ 回补 0 条计划登记行', stderr: '' }),
  })
  assert.equal(r.purge.ran, false)
  assert.equal(r.purge.ok, true, '两维都是现读 0 ⇒ 这才是"无事"')
  assert.equal(r.purge.twinResidue, 0)
  const heard2 = []
  const r2 = postMergeLedgerSync({
    root: 'X:/fixture',
    log: (s) => heard2.push(s),
    // 注记维取不到(null)而可折维判得出 0 ⇒ 不派生,但 ok 必须 false 并报名
    readFace: (rel) => (rel === 'PROJECT_PLAN.md' ? '' : ''),
    spawnFn: () => ({ status: 0, stdout: '✅ 回补 0 条计划登记行', stderr: '' }),
  })
  assert.equal(r2.purge.ran, false, '未判定不得派生复清')
  assert.equal(r2.purge.ok, false, '「没量到」不等于「已归零」(§0.3)')
  assert.ok(heard2.some((s) => /未判定/.test(s)), `必须点名未判定,实测 ${JSON.stringify(heard2)}`)
})

test('L17 生产形状第二维装车证明:真取本仓 HEAD 面 ⇒ 可折存量必须是数字(不是 null)', () => {
  const t = twinFoldResidue({ root: resolve(HERE, '..', '..') })
  assert.equal(typeof t, 'number', `判据装不上 ⇒ 带回的副本永远不触发复清,实测 ${String(t)}`)
  assert.ok(t >= 0)
})

/**
 * L18(2026-10-24,票「line-loss 的『已收拢』判据缺第三形态」的连带锁):
 * 本层与守门 71 必须是**同一把尺子** —— 而"同一把"的唯一机械保证是本层结构上不判缺失,
 * 只派生门 71 的 `--heal`。一旦这里长出第二份"什么算丢一行"(哪怕只是抄一段 marker 正则),
 * 门判它的收拢、这里判它的丢失,同题组回潮就又只能靠人逐轮盯(§0.6 / §22c)。
 * 同批夹具上的**读数相等**由 `scripts/tests/check-plan-line-loss.test.mjs` 的 T-D3h 端到端钉,
 * 这条钉的是**取材形状**:两条通道之间不得出现第二具判据身体。
 */
test('L18 单源锁:自愈腿只许派生门 71 的 --heal,本层不得长出第二份"什么算丢一行"的判据', () => {
  const code = CODE('lib/post-merge-ledger-sync.mjs')
  assert.match(code, /check-plan-line-loss\.mjs/, '自愈的判据家必须是守门 71')
  assert.match(code, /'--heal',\s*'--commit'/, '派生的必须是那条唯一出口(--heal --commit)')
  // 反向锁:判据字面量出现在本层 = 抄了第二份实现(与 L11 同一条纪律,换的是"丢失/收拢"这一族)
  assert.doesNotMatch(code, /漂移副本|重复副本|missingFrom|resolveRegistrationLoss/, '本层出现丢失/收拢判据的字面 = 第二份实现,必漂(§22c)')
  assert.doesNotMatch(
    code,
    /function\s+(lostMarkers|missingFrom|healLegs|collectedInDriftComment|driftCollectedCorpus)\s*\(/,
    '本层不得自带门 71 那几把尺子的同名函数(哪怕只是"简化版")',
  )
})

/* ══ 触发集 = 处置集(2026-10-25 立,治 73 枚自增提交)══
 * 现场(全部真档实测,不是推断):派生闸读的是三个外围存量维(注记 / 可折 / 同号组),
 * 而复清器真正会动的行由它自己的分层判据(renderLines 前后逐字差)决定。现读 23eadba0af^:
 *   注记=0 / 可折=0 / 同号组=1 / 处置=0 ⇒ 外围和 >0 于是每轮派生,器物空转仍落地,
 *   每枚提交对 PROJECT_PLAN.md 都是 `1 insertion(+), 0 deletions(-)`,插入的是空行,累计 73 枚。
 * 第二半根因在同号组那一腿:`--match-prefix-holder` 是**必须带持有行片段的人工出口**,
 *   自动档没给值 ⇒ 恒 rc=2 ⇒ 该维永不清零 ⇒ 外围和永远 >0。
 */

/** 现场签名夹具:注释/散文/已勾行含字样 + 一组同主键两行(器物一条也动不了)。 */
const LOOP_FACE = [
  '# 标题',
  '<!-- 已折叠:本行写明自己是「重复登记副本」,却仍占一次登记 ⇒ 收成注释。 -->',
  '### G-1 —— 散文里提到 重复登记副本 这个字样',
  '- [x] ✅(2026-10-25/主会话结算) 重复登记副本:已结清的一行。',
  '- [ ] O02 跨端 UI 单一源:甲席登记的持有行正文。',
  '- [ ] （进行中@2026-10-25/乙席） O02 跨端 UI 单一源:乙席补充的第 1 票已落。',
].join('\n')

const sameKeyGroups = (text) => {
  const idx = require('../lib/plan-task-index.mjs')
  const seen = new Map()
  for (const r of idx.parseTaskRows(text).filter((x) => x.state === 'open' && x.key))
    seen.set(r.key, (seen.get(r.key) || 0) + 1)
  let n = 0
  for (const [, c] of seen) if (c > 1) n++
  return n
}

test('L19 夹具自证:纯注释/散文/已勾行不计入触发集,而同号组维必须真的 >0(否则 L20 是空跑)', () => {
  // ① 字样出现 3 行,其中 1 行注释、1 行散文标题、1 行已勾选 ⇒ 触发集一个都不该数它们
  assert.equal(LOOP_FACE.split('\n').filter((l) => l.includes('重复登记副本')).length, 3, '夹具含字样三行')
  // ② 注记维读数必须是 0(判据只认带【归并】前缀的登记行,不是"字样出现")
  assert.equal(ledgerNoteResidue({ root: 'X:/fixture', readFace: () => LOOP_FACE }), 0, '注释/散文不得计入注记维')
  // ③ 循环的真实驱动腿:同号组 >0
  assert.ok(sameKeyGroups(LOOP_FACE) > 0, '夹具必须造出现场的同号组,否则下面那条臂什么都没钉住')
  // ④ 处置维读 0 —— 这一条是"L20 不派生"的充分条件
  assert.equal(purgeWorkResidue({ root: 'X:/fixture', readFace: () => LOOP_FACE }), 0, '器物动不了任何行 ⇒ 触发集必须读 0')
})

test('L20 循环已掐死:外围存量 >0 而处置维 0 ⇒ 一个复清进程都不派生(73 枚自增提交的回归锁)', () => {
  const seen = []
  const heard = []
  const r = postMergeLedgerSync({
    root: 'X:/fixture',
    log: (s) => heard.push(s),
    readFace: () => LOOP_FACE,
    spawnFn: (cmd, args) => {
      seen.push([cmd, args.join(' ')])
      return { status: 0, stdout: '✅ 回补 0 条计划登记行', stderr: '' }
    },
  })
  assert.equal(seen.length, 1, `只该派生回捞那一次,实测 ${JSON.stringify(seen.map((s) => s[1]))}`)
  assert.doesNotMatch(seen.join(' '), /plan-pointer-purge/, '处置维 0 却派生复清 ⇒ 就是那 73 枚空行提交的成因')
  assert.equal(r.purge.ok, true, '外围有账面而器物无事 = 无事,不是失败')
  assert.equal(r.purge.workResidue, 0, '处置维读数必须如实回传,不得被折进布尔')
  // 分歧必须点名(§12f:判据失效的表现永远是安静)—— 但只报数,不派生
  assert.ok(heard.some((s) => /真的动 0 行/.test(s)), `必须点名两把尺的分歧,实测 ${JSON.stringify(heard)}`)
})

test('L21 触发集单源锁:派生闸只许问器物那把处置尺,本层不得自写"有活干"判据', () => {
  const code = CODE('lib/post-merge-ledger-sync.mjs')
  assert.match(code, /plan-pointer-purge\.mjs/, '处置判据的家必须在复清器里')
  assert.match(code, /workResidueCount\(/, '夹具注入面必须真调用器物的判据(注释里提一句不算装车,§0.9)')
  assert.match(code, /purgeWorkResidue\(\{/, '派生闸必须问处置维')
  // 反向锁:本层自己算"渲染前后逐字差"= 第二把尺,必然与器物漂开
  assert.doesNotMatch(code, /renderPurge\(|renderLines\(/, '本层不得自带渲染差判据(§22c)')
})

/**
 * L21b(2026-10-25 第二次实测立,差点把修法做成瞎法):
 * 生产面**不许靠 `require()` 把器物的判据搬进本进程**。真档取证 —— post-commit 的
 * plan-state-heal 那一步(`node scripts/plan-tasks-merge.mjs --heal --commit`)里,
 * `loadRatchet()` 与 `loadPurgeTool()` 双双返回 null,于是账面存量读数恒是
 * 「注记=未判定 / 可折=未判定 / 处置=未判定」而同号组维(走 lib/plan-task-index)读得出 1
 * (见 .ihui-agent/state/hook-logs/post-commit-plan-state-heal.log 2026-10-25T08:27:27Z 那一段)。
 * 若触发闸就长这样,循环确实"停"了 —— 靠的是眼睛瞎了:真副本来了也永不再派生(违 §12e)。
 * 正解 = 子进程问器物 `--work-count`:探针自己就是入口,不依赖父进程模块图走到哪一步。
 * (注:该 null 的确切抛错机制本席未能在不跑真命令(会写台账)的前提下钉死,故这条锁钉的是
 *  **可观测的可靠性边界**,不是一个已证成的因果 —— §0.3「没判」不许写成「判过」。)
 */
test('L21b 生产面取材形状锁:处置维必须走器物子进程探针,不得要求调用方注入面', () => {
  const code = CODE('lib/post-merge-ledger-sync.mjs')
  assert.match(code, /'--work-count'/, '生产面必须派生器物的只读探针档')
  assert.match(code, /PURGE-WORK/, '必须按器物自己那行机器可读结论取数,不自拼判据')
  // 派生闸的调用点**不得**带 readFace —— 带了就等于回到"在本进程里搬器物的尺"
  const gateAt = code.indexOf('purgeWorkResidue({ root, readFace')
  assert.equal(gateAt, -1, '派生闸调用点不得注入面(注入面只许是测试通道),实测仍在本进程 require 器物')
  // 探针派生同样吃 §12g:显式 stdio,否则 Windows 上稳定 EBUSY
  assert.match(code, /stdio:\s*\['ignore',\s*'pipe',\s*'pipe'\]/, '子进程探针必须显式 stdio(§12g)')
})


test('L22 人工出口不得自动派生:同号组维只报数点名交人工,绝不派生恒 rc=2 的那一枚', () => {
  const seen = []
  const heard = []
  postMergeLedgerSync({
    root: 'X:/fixture',
    log: (s) => heard.push(s),
    readFace: () => LOOP_FACE,
    spawnFn: (cmd, args) => {
      seen.push(args.join(' '))
      return { status: 0, stdout: '✅ 回补 0 条计划登记行', stderr: '' }
    },
  })
  assert.doesNotMatch(seen.join(' '), /match-prefix-holder/, '该旗标必须带持有行片段(人工裁决出口),自动派生恒 rc=2 ⇒ 永不清零')
  assert.ok(heard.some((s) => /同号/.test(s) && /人工/.test(s)), `必须点名交人工并给出处路,实测 ${JSON.stringify(heard)}`)
  const code = CODE('lib/post-merge-ledger-sync.mjs')
  assert.doesNotMatch(code, /'--match-prefix-holder'/, '代码里再出现自动派生 = 循环的第二半根因复活')
})

test('L23 器物 rc=3 分流:量时有活而落地时 HEAD 已被推进成无事 ⇒ 记"无需清偿"不记失败', () => {
  const heard = []
  const r = postMergeLedgerSync({
    root: 'X:/fixture',
    log: (s) => heard.push(s),
    readFace: () => NOTE_FACE,
    spawnFn: (_cmd, args) =>
      String(args.join(' ')).includes('plan-pointer-purge')
        ? { status: 3, stdout: 'PURGE-RESULT state=无需清偿', stderr: '' }
        : { status: 0, stdout: '✅ 回补 0 条计划登记行', stderr: '' },
  })
  assert.equal(r.purge.ok, true, 'rc=3 是器物自己的"无事"结论,并进失败臂会把已掐死的循环读成复清报错')
  assert.equal(r.purge.ran, true, '确实派生过,这一维不能抹')
  assert.equal(r.purge.why, '无需清偿')
  assert.doesNotMatch(heard.join('\n'), /复清未完成/, '无事不得喊成失败')
})

test('L24 purgeWorkResidue 三态:有活 / 无事 / 未判定(未判定绝不冒充 0,§0.3)', () => {
  assert.ok(purgeWorkResidue({ root: 'X:/fixture', readFace: () => NOTE_FACE }) > 0)
  assert.equal(purgeWorkResidue({ root: 'X:/fixture', readFace: () => CLEAN_FACE }), 0)
  assert.equal(purgeWorkResidue({ root: 'X:/fixture', readFace: () => '' }), null)
  assert.equal(purgeWorkResidue({ root: 'X:/fixture', readFace: () => { throw new Error('x') } }), null)
  // 生产形状装车证明:真取本仓 HEAD 面必须量出数字(不断言条数,台账每几分钟被别人推进)
  const h = purgeWorkResidue({ root: resolve(HERE, '..', '..') })
  assert.equal(typeof h, 'number', `HEAD 面量不到 ⇒ 触发闸结构性失明,实测 ${String(h)}`)
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
