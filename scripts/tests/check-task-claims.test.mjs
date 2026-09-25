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
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as claims } from '../check-task-claims.mjs'
import { SIM_THRESHOLD } from '../lib/live-doc-similarity.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'scripts', 'check-task-claims.mjs')

/**
 * 租约判据(CL1/CL2/CL3, 2026-09-25 A9 扩)的 T8-T16 一律在 **mkScratch 临时夹具**上跑。
 * ⚠ 绝不允许为做"正向对照"往真 PROJECT_PLAN.md 写自测行 —— 它是多会话共写的活文档,
 * 写进去就可能被别人的提交带走或造成误读(任务书明令)。被测脚本的目标路径经
 * `--plan <file>` 注入,这正是判据可取证化的必需通道。
 */
function runCli(args, opts = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: opts.cwd ?? REPO,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    env: opts.env ?? process.env,
  })
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}
const isoDay = (offsetDays = 0) =>
  new Date(Date.now() - offsetDays * 3600000 * 24).toISOString().slice(0, 10)

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

// ---------- 以下 T8-T16:租约三要素(CL1/CL2/CL3)扩判据,2026-09-25 A9 ----------

test('T8 四对正反例·第1对 CL1 过期租约:临时夹具上过期必红并点名,新鲜同文必绿', () => {
  const dir = mkScratch('claims-t8')
  try {
    const stale = join(dir, 'stale.md')
    writeFileSync(
      stale,
      `- [ ]（进行中@2020-01-01/tester）自测行:被 agent 死后的认领永久留在台账\n`,
    )
    const r1 = runCli(['--check-gate', '--plan', stale])
    assert.equal(r1.status, 1, `过期租约必须 exit 1,实得 ${r1.status}:${r1.out}`)
    assert.match(r1.out, /CL1/, '未点名判据类别')
    assert.match(r1.out, /tester/, '未点名持有者')
    assert.match(r1.out, /L1/, '未点名行号')
    const fresh = join(dir, 'fresh.md')
    writeFileSync(fresh, `- [ ]（进行中@${isoDay(1)}/tester）同一件事但日期新鲜\n`)
    assert.equal(runCli(['--check-gate', '--plan', fresh]).status, 0, '新鲜租约竟被判红')
  } finally {
    rmScratch(dir)
  }
})

test('T9 四对正反例·第2对 CL2 半个租约:有 @日期 无 /持有者 必红,补齐即绿', () => {
  const dir = mkScratch('claims-t9')
  try {
    const half = join(dir, 'half.md')
    writeFileSync(half, `- [ ]（进行中@${isoDay(0)}）有日期没名字 —— 到期了都不知道找谁续租\n`)
    const r = runCli(['--check-gate', '--plan', half])
    assert.equal(r.status, 1)
    assert.match(r.out, /CL2/)
    const full = join(dir, 'full.md')
    writeFileSync(full, `- [ ]（进行中@${isoDay(0)}/qa）三要素齐备\n`)
    assert.equal(runCli(['--check-gate', '--plan', full]).status, 0)
  } finally {
    rmScratch(dir)
  }
})

test('T10 四对正反例·第3对 CL3 三态矛盾:租约标记×[x] 必红;正常翻勾绿,存量裸标记矛盾只报数', () => {
  const dir = mkScratch('claims-t10')
  try {
    const bad = join(dir, 'bad.md')
    writeFileSync(
      bad,
      `- [x]（进行中@${isoDay(0)}/qa）勾了却没摘认领牌\n- [ ]（进行中@${isoDay(0)}/qa）正文里混进 [x]\n`,
    )
    const r = runCli(['--check-gate', '--plan', bad])
    assert.equal(r.status, 1)
    assert.match(r.out, /CL3/)
    const good = join(dir, 'good.md')
    writeFileSync(good, `- [x] ✅(${isoDay(0)}) 正常闭环,标记已摘\n- [ ] 无人认领\n`)
    assert.equal(runCli(['--check-gate', '--plan', good]).status, 0)
    // 向后兼容钉死:真仓 HEAD 里存在"裸（进行中）残留 × [x]"的存量双态行(立项实测 4 行),
    // 判红即恒红门 → 逼人 --no-verify。该形态必须**只计数不判红**,由 legacyContradictions 如实报出。
    const legacy = join(dir, 'legacy.md')
    writeFileSync(legacy, `- [x] ✅(2026-09-25)（进行中）旧协议留下的双态行\n`)
    const rj = runCli(['--check-gate', '--plan', legacy, '--json'])
    assert.equal(rj.status, 0, `存量裸标记矛盾行不得判红:${rj.out}`)
    assert.equal(JSON.parse(rj.out).leases.legacyContradictions, 1, '矛盾行必须如实报数,不得静默')
  } finally {
    rmScratch(dir)
  }
})

test('T11 全角括号可选性正反例 —— `（进行中）?` 陷阱的装车证明', () => {
  // 本仓记过的坑:`（进行中）?` 里的 `?` **只作用于最后一个全角字符 `）`**,
  // 于是"可选标记"判据静默退化成"必须含字面前缀 `（进行中`"。
  const bare = '- [ ] 没有标记的任务行'
  const lease = '- [ ]（进行中@2026-09-25/qa）带租约的任务行'
  // 正例:整组包住的可选形态,对裸行与租约行都真的"可选"(剥完只剩正文)。
  assert.equal(
    bare.replace(claims.CLAIM_MARKER_OPTIONAL_RE, ''),
    '没有标记的任务行',
    '可选形态漏掉裸行',
  )
  assert.equal(
    lease.replace(claims.CLAIM_MARKER_OPTIONAL_RE, ''),
    '带租约的任务行',
    '可选形态漏掉租约行',
  )
  // 反例(对照必须"有牙"):naive `（进行中）?` 在租约行上只吃到 `（进行中`,残留 `@日期/qa）` ——
  // 若这条对照哪天"意外通过",说明夹具失效,本测试就退化成空断言。
  const naive = /^- \[ \]（进行中）?\s*/
  assert.notEqual(
    lease.replace(naive, ''),
    '带租约的任务行',
    'naive 形态竟也正确 ⇒ 夹具失去鉴别力,本对照是空的',
  )
  // 真实判据不受其害:分类 + text + bodyOf 三处都剥净整段租约标记。
  const s = claims.scanTasks(`${bare}\n${lease}\n- [ ]（进行中）旧裸标记行\n`)
  assert.equal(s.unclaimed.length, 1, '裸行被当成有认领 ⇒ 可选分支失效')
  assert.equal(s.inProgress.length, 2)
  assert.equal(s.inProgress[0].text, '带租约的任务行', 'text 残留租约载荷')
  assert.equal(claims.bodyOf({ full: lease }), '带租约的任务行')
  assert.equal(claims.bodyOf({ full: '- [x]（进行中）foo' }), 'foo')
})

test('T12 四对正反例·第4对 向后兼容:真仓存量裸标记全绿(只计数不判红;条数按当次实测,不钉死)', () => {
  // 存量不变量(绝不断"当前几条"——那会随别人翻勾变红):
  // 真仓 --check-gate 的红**只可能**来自租约形态(CL1/CL2/CL3 之租约支),
  // 而 legacy 计数必须原样报出且与 violations 无交集。
  const r = runCli(['--check-gate', '--json'])
  assert.ok(r.status === 0 || r.status === 1, `退出码只能是 0/1,实得 ${r.status}`)
  const j = JSON.parse(r.out)
  assert.ok(j.leases.legacy >= 0)
  for (const v of j.violations) assert.ok(['CL1', 'CL2', 'CL3'].includes(v.kind))
  // 当前真仓快照下必须为绿(立项实测:全部进行中都是旧格式;若这行变红,
  // 说明有人留下了过期/半个租约 —— 那是**真红**,不是本测试的假阳)。
  assert.equal(r.status, 0, `真仓 --check-gate 现值应为 0:${r.out}`)
})

test('T13 未知 CLI 开关不得静默落进默认分支(白名单 + exit 2)', () => {
  // 前例:`sync-lost-commit-tags.mjs` 的 `--push` 拼错掉进 `--check` 还 exit 0。
  for (const bad of [
    ['--nope'],
    ['--plan'],
    ['--ttl-hours', 'abc'],
    ['--ttl-hours', '0'],
    ['positional'],
  ]) {
    const r = runCli(bad)
    assert.equal(r.status, 2, `${bad.join(' ')} 应 exit 2(无法判定),实得 ${r.status}`)
  }
  // --staged 必须被接受(runner 在 staged 模式对**所有**脚本统一追加;不认它 = 接线当天全红)。
  assert.equal(runCli(['--check-gate', '--staged']).status, 0, '--staged 竟被判未知')
})

test('T14 租约阈值可调:--ttl-hours 与 IHUI_CLAIM_LEASE_TTL_HOURS 各生效一次', () => {
  const dir = mkScratch('claims-t14')
  try {
    const f = join(dir, 'ttl.md')
    writeFileSync(f, `- [ ]（进行中@${isoDay(4)}/qa）四天前认领,72h 阈值下已过期\n`)
    assert.equal(runCli(['--check-gate', '--plan', f]).status, 1, '默认 72h 应红')
    assert.equal(
      runCli(['--check-gate', '--plan', f, '--ttl-hours', '240']).status,
      0,
      '放宽到 240h 应绿',
    )
    assert.equal(
      runCli(['--check-gate', '--plan', f], {
        env: { ...process.env, IHUI_CLAIM_LEASE_TTL_HOURS: '240' },
      }).status,
      0,
      'env 放宽应绿',
    )
    assert.equal(
      runCli(['--check-gate', '--plan', f, '--ttl-hours', '240'], {
        env: { ...process.env, IHUI_CLAIM_LEASE_TTL_HOURS: '1' },
      }).status,
      0,
      '显式 --ttl-hours 必须压过 env,而不是两处各说各话',
    )
  } finally {
    rmScratch(dir)
  }
})

test('T15 接线条件不变量:本门**若**已被 runner/package.json 登记,则 mode/skipEnv/stagedTriggers 必须与规格一致;未登记则打印"待接线"不判失败', () => {
  // 既不许恒红(未接线期就断言"必须在 runner 里"会把本测试钉死),也不许接线后被摘线无人知。
  const runnerSrc = readFileSync(join(REPO, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const pkgSrc = readFileSync(join(REPO, 'package.json'), 'utf8')
  const wired = runnerSrc.includes('check-task-claims') || pkgSrc.includes('check-task-claims')
  if (!wired) {
    console.log(
      '  ℹ check-task-claims 尚未接入 runner/package.json —— **待接线**(建议 id 106,主会话统一改注册表)',
    )
    return
  }
  const m = runnerSrc.match(/id:\s*'106',[\s\S]*?\n  \},/)
  assert.ok(m, '已登记却解析不到本门注册块(接线了但形状不认识,必须人工核对)')
  const block = m[0]
  assert.match(block, /mode:\s*'blocking'/, '接线档位必须是 blocking(存量恒绿,红点只来自新租约)')
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_TASK_CLAIM_LEASE'/, '紧急跳过通道键名不符规格')
  assert.match(
    block,
    /stagedTriggers:\s*\[[^\]]*PROJECT_PLAN\.md/,
    'stagedTriggers 必须含 PROJECT_PLAN.md,否则改计划不唤起本门',
  )
  assert.match(block, /--check-gate/, 'args 必须显式带 --check-gate(默认分支只报数不判红)')
})

test('T16 与守门 71 互不遮蔽:runner 跑完再汇总(说明性断言,防 fail-fast 回潮)', () => {
  // 规格要求登记:"71 与 106 对同一枚提交的结论互不遮蔽"。结构性保证 = 执行器不再
  // fail-fast,而是跑完全部门后汇总失败清单(逃生舱 GUARDIAN_STOP_ON_FIRST 反证该设计)。
  const runnerSrc = readFileSync(join(REPO, 'scripts', 'guardian-runner.mjs'), 'utf8')
  assert.match(
    runnerSrc,
    /GUARDIAN_STOP_ON_FIRST/,
    'fail-fast 逃生舱标识消失 ⇒ 可能回潮成首错即停,遮蔽其余门的结论',
  )
  assert.match(runnerSrc, /id:\s*'71'/, '守门 71 注册块消失属另一类事故,顺手钉住邻门在场')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
