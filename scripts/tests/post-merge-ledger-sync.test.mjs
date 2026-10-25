// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/post-merge-ledger-sync.test.mjs —— §22c 镜像:旁路合并落地后自愈唯一出口的判据。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { maskComments } from '../lib/code-mask.mjs'
import { postMergeLedgerSync, ledgerNoteResidue, twinFoldResidue } from '../lib/post-merge-ledger-sync.mjs'

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
