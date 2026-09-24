// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/check-task-claims.mjs 的镜像测试(此前**根本没有** —— `ls scripts/tests | grep task-claims` 零命中)。
 *
 * 立因:该工具只看行首 `- [ ]` 分类,而 §1 的翻勾写法是「改前缀 + 追加取证」,旧副本会留在同文件;
 * 并集合并也留孪生。于是**一件已闭环的事被数成"无人认领"**,照清单派活的人(和 agent)会重做它 ——
 * 本会话 2026-09-25 实测就被「7 个脚本的 --self-test 走 os.tmpdir()」那一对带偏一次。
 *
 * 判据取向(T1-T7):每条正向判据都配一条**反向对照**(无关的绝不许判成孪生、只出现一次的绝不许报重复组),
 * 并把"必须用整行而不是 120 字展示串"这一条单独钉死 —— 用截断串判孪生的代价是**藏掉真活**,
 * 比多报一条危险得多。真仓那条只断**不变量**,绝不断"当前几条"(那会随别人勾票变红)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as claims } from '../check-task-claims.mjs'
import { SIM_THRESHOLD } from '../lib/live-doc-similarity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'scripts', 'check-task-claims.mjs')

const LONG_A = '把语音笔记的九键词条补齐到 web 五语言包并让守门 74 逐键能解析'
const LONG_B = '把桌面端安装器的五档 DPI 位图重新导出并在卸载器里复核一遍'

test('T1 正向:已闭环 [x] 行的未勾孪生必须被识别', () => {
  const doc = [
    `- [ ] ${LONG_A}。`,
    `- [x] ✅(2026-09-25) ${LONG_A}。取证:两枚提交已回读,五语言包键数一致。`,
  ].join('\n')
  const { unclaimed, completed } = claims.scanTasks(doc)
  const twins = claims.findClosedTwins(unclaimed, completed)
  assert.equal(twins.length, 1, `应判出 1 条孪生,实得 ${twins.length}`)
  assert.equal(twins[0].line, 1, '未勾行号错')
  assert.equal(twins[0].twinLine, 2, '指向的已勾行号错')
})

test('T2 反向:同一前缀、尾部讲另一件事的两条**绝不许**判成孪生(否则藏掉真活)', () => {
  // 共用前缀必须**长过 120 字展示串**,否则两条的 text 本来就不一样,这条对照是空的
  // (写第一版时就踩空过一次:尾巴从第 40 字就分叉,判据换成截断串它照样绿)。
  const head =
    '把跨端词条补齐与安装器位图重导出这两件事按登记口径各做一遍并留下可复跑取证,包含键表对称性校验、' +
    '离线包重生成、五语言 parity、守门逐键解析、以及安装器五档 DPI 在真机上的 A/B 复核流程说明,' +
    '并要求每一步都给出命令与退出码而不是结论行,以免下一轮只能照抄本行文字'
  assert.ok(head.length > 130, `夹具失效:共用前缀只有 ${head.length} 字,压不过 120 字截断`)
  // 尾部要**足够长且互不相干**。两条反例都是当场量出来的:
  //  ① 用 `'甲'.repeat(200)` 堆长度 → 重复字符只贡献 1 个二元组,整行 J 反而 0.94,测不到危害;
  //  ② 尾部只多十几字 → 整行 J 仍 0.85,那是在罚一条本来就该判孪生的近亲。
  // 现夹具实测:**整行 J=0.502(两件事)/ 截断串 J=0.870(会被误判)** —— 两头都要踩住。
  const tailA =
    '此外还要把语音笔记的九键词条补进 web 五语言包,并按守门逐键解析复核录音权限、无设备、启动失败、' +
    '转写为空四类错误提示的措辞一致性,顺带核对离线包解码后键数与源包相等'
  const tailB =
    '另一件是把 NSIS 卸载页主题宏重新登记一次,并复核卸载器不弹原生语言框、静默开关不被宏参数泄漏影响,' +
    '以及安装目录残留清理在只读介质上不报错'
  const doc = [`- [ ] ${head};${tailA}`, `- [x] ✅(2026-09-25) ${head};${tailB}`].join('\n')
  const { unclaimed, completed } = claims.scanTasks(doc)
  assert.ok(
    unclaimed[0].full.length > unclaimed[0].text.length,
    'scanTasks 丢了整行(full 未长于 text)⇒ 判据只能吃到 120 字截断串',
  )
  // 先证明**这条对照本身有牙**:把判据改喂展示串(截断 120 字),这一对就必须被判成孪生 ——
  // 若不判,说明夹具没做出"前缀相同、尾部不同"的形状,那 T2 就是一条空断言(第一版正是空的)。
  const 喂截断串 = claims.findClosedTwins(
    unclaimed.map((r) => ({ ...r, full: r.text })),
    completed.map((r) => ({ ...r, full: r.text })),
  )
  assert.equal(喂截断串.length, 1, '对照为空:连 120 字截断串都不误判 ⇒ 这条测不出"藏掉真活"的危害')
  assert.equal(
    claims.findClosedTwins(unclaimed, completed).length,
    0,
    '两条讲的是不同事却判了孪生 ⇒ 会把真活从"可认领"里摘掉',
  )
})

test('T3 反向:短行一律不判(容器下界在满屏清单里必然互含)', () => {
  const doc = ['- [ ] 修 A', '- [x] ✅ 修 A'].join('\n')
  const { unclaimed, completed } = claims.scanTasks(doc)
  assert.equal(claims.findClosedTwins(unclaimed, completed).length, 0)
})

test('T4 前缀剥离是判据的地基:不剥 ✅(…) 就会漏判', () => {
  const doc = [
    `- [ ] ${LONG_A}。`,
    `- [x] ✅(2026-09-25 复测已闭环,完整取证记在下方同条) ${LONG_A}。`,
  ].join('\n')
  const { unclaimed, completed } = claims.scanTasks(doc)
  assert.equal(
    claims.bodyOf(unclaimed[0]),
    claims.bodyOf(completed[0]),
    '剥完前缀后两条骨架必须逐字相同 —— 不相同就说明剥法没覆盖仓库的翻勾写法,孪生会漏判',
  )
  assert.equal(claims.findClosedTwins(unclaimed, completed).length, 1)
})

test('T5 逐字重复的未勾行要成组报出,且只出现一次时不得报', () => {
  const dup = ['- [ ] ' + LONG_B, '- [ ] ' + LONG_B, '- [ ] ' + LONG_A].join('\n')
  const { unclaimed } = claims.scanTasks(dup)
  const groups = claims.findDuplicateGroups(unclaimed)
  assert.equal(groups.length, 1, `应报 1 组重复,实得 ${groups.length}`)
  assert.deepEqual(groups[0], [1, 2])
  assert.equal(claims.findDuplicateGroups(claims.scanTasks('- [ ] ' + LONG_B).unclaimed).length, 0)
})

test('T6 单一实现:相似度判据必须 import lib,不得本地重定义第二份', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(src, /from '\.\/lib\/live-doc-similarity\.mjs'/, '没有 import 那把共享尺子')
  for (const name of ['function tokenize', 'function jaccard', 'const SIM_THRESHOLD']) {
    assert.ok(!src.includes(name), `本地又定义了一份 ${name} ⇒ 两处真相,迟早分叉`)
  }
})

test('T7 真仓:只断不变量,绝不断"当前几条"', () => {
  const out = execFileSync(process.execPath, [SCRIPT, '--json'], {
    cwd: REPO,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 64 * 1024 * 1024,
  })
  const j = JSON.parse(out)
  assert.ok(Array.isArray(j.closedTwins), '--json 未输出 closedTwins')
  assert.ok(typeof j.totals.claimable === 'number', '缺 claimable 口径')
  assert.ok(j.totals.claimable <= j.totals.unclaimed, '可认领数怎么可能大于未认领总数')
  const kinds = new Map()
  for (const r of [...j.unclaimed, ...j.inProgress, ...j.completed]) kinds.set(r.line, r)
  for (const t of j.closedTwins) {
    assert.ok(
      t.score >= SIM_THRESHOLD || t.via === 'contain',
      `L${t.line} 的配对不满足任一通道判据:${JSON.stringify(t)}`,
    )
    assert.notEqual(t.line, t.twinLine, '自链')
    const src = kinds.get(t.line)
    const dst = kinds.get(t.twinLine)
    assert.ok(src && dst, `孪生指向了不存在的行 L${t.line}/L${t.twinLine}`)
    assert.ok(
      /^- \[x\]/.test(dst.full || ''),
      `孪生的对方 L${t.twinLine} 必须是已勾 [x] 行,实得:${(dst.full || '').slice(0, 30)}`,
    )
    assert.ok(/^- \[ \]/.test(src.full || ''), `孪生本体 L${t.line} 必须是未勾行`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
