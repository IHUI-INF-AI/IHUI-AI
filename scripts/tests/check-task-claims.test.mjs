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
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as claims } from '../check-task-claims.mjs'
import { SIM_THRESHOLD } from '../lib/live-doc-similarity.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = join(REPO, 'scripts', 'check-task-claims.mjs')
const GIT_BIN = resolveGitBin() || 'git'

/** 只对**临时索引**做 plumbing(hash-object -w / update-index),refs / 主索引 / 磁盘零触碰 ——
 *  与守门 90 镜像 ⑩ 同一套"索引≠磁盘"构造法;对象写入与 ⑩ 同性质(GC 自收,不构成 git 写史)。
 *  maxBuffer 由调用方按需放大 —— `show HEAD:PROJECT_PLAN.md` 的正文远超 execFileSync 默认 1MB,
 *  被截断会抛 ENOBUFB(工具失败伪装成"内容没有",与本仓"未判定不得记绿"同一条禁令)。 */
function gitRun(args, opts = {}) {
  return execFileSync(
    GIT_BIN,
    ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', REPO, ...args],
    {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      env: opts.env ?? process.env,
      ...(opts.maxBuffer === undefined ? {} : { maxBuffer: opts.maxBuffer }),
      ...(opts.input === undefined ? {} : { input: opts.input }),
    },
  )
}

/** 主索引的真实路径(.git 可能是指针文件,故问 git 自己而不是拼字符串) */
function resolveGitIndex() {
  const gitdir = gitRun(['rev-parse', '--absolute-git-dir']).trim()
  return join(gitdir, 'index')
}

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
    stdio: ['ignore', 'pipe', 'pipe']
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
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
    // 2026-09-29 现读改窗:真仓 `--json` 扫描档实测 **431s(HEAD 那份)/ 434s(改动后那份)**,
    // 而这里原来给 120s —— 于是 T7 每天红,而且红的是一张**与提交内容无关**的窗(台账只会更大)。
    // 两条各自量过一次才改:同瞬间 A/B 证明时长不是本次改动带来的(见枚 …)。
    // 刻意只改窗口、不改判据:T7 断的全是不变量(可认领 ≤ 未认领、孪生两端状态、自链…),
    // 削判据等于把这条真仓端到端证明关掉。
    timeout: 900000,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
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

test('T12 四对正反例·第4对 向后兼容:真仓的红只可能来自租约形态;存量裸标记只计数(不钉"现值必绿")', () => {
  // 存量不变量(绝不断"当前几条"——那会随别人翻勾变红):
  // 真仓 --check-gate 的红**只可能**来自租约形态(CL1/CL2/CL3 之租约支),
  // 而 legacy 计数必须原样报出且与 violations 无交集。
  const r = runCli(['--check-gate', '--json'])
  assert.ok(r.status === 0 || r.status === 1, `退出码只能是 0/1,实得 ${r.status}`)
  const j = JSON.parse(r.out)
  assert.ok(j.leases.legacy >= 0)
  for (const v of j.violations) assert.ok(['CL1', 'CL2', 'CL3'].includes(v.kind))
  // —— 2026-09-26 收尾:此行原为 `assert.equal(r.status, 0, '真仓 --check-gate 现值应为 0')`,
  //    由上一枚派单会话故意收紧后没来得及处理就停摆。判定:**完成收紧方向的反向动作
  //    (删掉这条"现值必绿"钉)**,理由三条,缺一不可:
  // ① 与被测判据互相打架:门的**存在理由**就是让"租约形态 × [x]"的红持续可见,直到**持有者
  //    自己**去清(AGENTS §1"绝不自动摘除认领"+§16 越权禁令)。而 PROJECT_PLAN.md 是多会话
  //    共写的活文档 —— 任何一枚并发提交都能合法带着一条真实 CL3 进 HEAD(2026-09-26 现读
  //    实测:HEAD blob 的 O10 条目行上挂着 `（进行中@2026-09-26/O10b票,主会话第九批）` 租约,
  //    git grep 于 HEAD 面命中 1 处)。把"此刻必须为 0"钉进测试套件,等于让之后**每一次
  //    `node --test`** 都被别人的在途认领钉红;恒红测试与恒红门同罪 —— 唯一结局是逼人
  //    跳过测试(--no-verify 的测试面同型,§12e)。
  // ② 本用例标题自己的规格就写着"条数按当次实测,不钉死",旧末行却钉 status===0,
  //    是规格与断言自相矛盾,不是仓库欠账 —— 修的是断言,不是判据(判据一个字没改)。
  // ③ "存量裸标记不判红"这条向后兼容**不靠真仓快照证明**:T10 在临时夹具上给出可复现的绿
  //    (裸标记矛盾行只计数),T8/T9/T10 给出可复现的红 —— 夹具才是取证面,活文档不是。
  // 现值必须**如实打印**,免得后来人把"测试绿了"读成"仓库没有红":
  console.log(
    r.status === 0
      ? '  (真仓现值:0 红)'
      : `  (真仓现值:${j.violations.length} 红,形态:${[...new Set(j.violations.map((v) => v.kind))].join('/')} —— 归各行持有者清账,本测试不代裁)`,
  )
})

test('T13 未知 CLI 开关不得静默落进默认分支(白名单 + exit 2);面旗必须被接受(接受≠判据绿)', () => {
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
  // --staged / --worktree 必须被接受(runner 在 staged 模式对**所有**脚本统一追加 --staged;
  // 不认它 = 接线当天全红)。2026-09-26 收尾:旧版这两条写成 `assert.equal(..., 0)`,把
  // "开关被识别"与"真仓此刻无红"混成同一件事 —— 而 --check-gate 读真 HEAD 时,别人一枚在途
  // 租约就能让它合法地红(见 T12 ①)。"不认它"的失败形态是 **exit 2**,所以断言按失败形态
  // 分流:只需断"不是 2"。旧措辞"--staged 竟被判未知"本身就是这次归因事故的现场:
  // 实得 1(真账红)被读成了"白名单不认识",方向整个反了。
  assert.notEqual(runCli(['--check-gate', '--staged']).status, 2, '--staged 被白名单拒绝了')
  assert.notEqual(runCli(['--check-gate', '--worktree']).status, 2, '--worktree 被白名单拒绝了')
  // 两面旗同给必须判死(互斥面,取哪一面都会让另一面成为假绿)。
  assert.equal(
    runCli(['--check-gate', '--staged', '--worktree']).status,
    2,
    '两面旗同给竟选出了一个面',
  )
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
      '  ℹ check-task-claims 尚未接入 runner/package.json —— **待接线**(编号由主会话按当次空闲号取,本测试不钉编号)',
    )
    return
  }
  // 按**脚本名**定位注册块，不按编号 —— 编号是并发抢占资源(本仓门 80/93 记过撞号与
  // "按硬写编号找块 ⇒ 别人的块被当自己的断言"两型)，钉编号会让本测试替别人红或替别人绿。
  const at = runnerSrc.indexOf("script: 'check-task-claims.mjs'")
  assert.ok(at > 0, '已登记却按脚本名解析不到本门注册块(接线了但形状不认识,必须人工核对)')
  const start = runnerSrc.lastIndexOf('  {', at)
  const end = runnerSrc.indexOf('\n  },', at)
  assert.ok(start >= 0 && end > at, '注册块边界解析不到')
  const block = runnerSrc.slice(start, end + 5)
  const idInBlock = /id:\s*'([0-9]+)'/.exec(block)?.[1]
  assert.ok(idInBlock, '注册块里没有数字编号')
  assert.equal(
    [...runnerSrc.matchAll(new RegExp(`id:\\s*'${idInBlock}'`, 'g'))].length,
    1,
    `编号 ${idInBlock} 在 runner 里不唯一(撞号会串 skipEnv 与失败归属)`,
  )
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

test('T17 判定面装车:同一棵仓,索引≠磁盘/HEAD 时必须各按各的面出结论(旧磁盘读法在 A 臂失明)', () => {
  // 2026-09-26 收口的直接证明:此前 main() 无条件 `readFileSync(PLAN_PATH)` —— --staged 只是
  // 被 parseArgs 收下的**惰性开关**(accepted but inert),暂存区里放了什么都不影响结论。
  // 本例用临时 GIT_INDEX_FILE 造"只有索引里有、磁盘与 HEAD 都没有"的探针行,三面三答:
  //   A --staged(索引含探针) ⇒ 必红并点名探针  —— 旧实现读磁盘,这一臂会判**绿**(假绿);
  //   B --staged(索引放干净文档) ⇒ 必绿        —— 证明 A 的红来自面,不是"永远红";
  //   C 默认 head 面(同一枚临时索引在场) ⇒ 绝不许出现探针字样 —— 证明默认面没借索引凑内容;
  //   D --worktree 磁盘面 ⇒ 同样绝不许出现探针 —— 三面互不串门。
  const dir = mkScratch('claims-t17')
  try {
    const tmpIndex = join(dir, 'probe-index')
    copyFileSync(resolveGitIndex(), tmpIndex)
    const env = { ...process.env, GIT_INDEX_FILE: tmpIndex }
    const probe = `- [x] ✅(2026-09-20) ZQ-FACE-PROBE 只活在临时索引里的探针（进行中@${isoDay(0)}/faceprobe） 探针载荷\n`
    const clean = '- [ ] 干净任务,无认领无矛盾\n'
    const putInIndex = (doc) => {
      const sha = gitRun(['hash-object', '-w', '--stdin'], { input: doc, env }).trim()
      gitRun(['update-index', '--add', '--cacheinfo', `100644,${sha},PROJECT_PLAN.md`], { env })
    }
    const diskBefore = readFileSync(join(REPO, 'PROJECT_PLAN.md'), 'utf8')

    // A 臂
    putInIndex(probe)
    const a = runCli(['--check-gate', '--staged', '--json'], { env })
    assert.equal(a.status, 1, `A 臂(索引含探针)必须判红,实得 ${a.status}:${a.out}`)
    assert.match(a.out, /faceprobe/, 'A 臂必须点名索引里那条探针(证明读的是索引 blob)')
    assert.match(a.out, /"face": "索引 blob/, 'A 臂 JSON 必须如实报面')

    // B 臂:同一临时索引换成干净文档 ⇒ 必绿(旧磁盘读法在这一臂与 A 臂同答,两臂就分不出面了)
    putInIndex(clean)
    const b = runCli(['--check-gate', '--staged', '--json'], { env })
    assert.equal(b.status, 0, `B 臂(索引干净)必须判绿,否则 A 的红是"永远红"而不是面:\n${b.out}`)
    assert.doesNotMatch(b.out, /faceprobe/, 'B 臂不得再残留探针(索引确实被换掉了)')

    // C/D 臂:探针回到索引里,默认 head 面与 --worktree 磁盘面都必须看不见它
    putInIndex(probe)
    const c = runCli(['--check-gate', '--json'], { env })
    assert.doesNotMatch(c.out, /faceprobe/, '默认面竟读到临时索引内容 ⇒ head/index 两面串门')
    assert.match(c.out, /"face": "HEAD blob/, '默认面必须自称 HEAD blob')
    const d = runCli(['--check-gate', '--worktree', '--json'], { env })
    assert.doesNotMatch(d.out, /faceprobe/, '--worktree 竟读到临时索引内容 ⇒ 磁盘面失守')
    assert.match(d.out, /"face": "工作树/, '--worktree 必须自称工作树档')

    // 全程零副作用:磁盘那份计划文档一个字节都没动
    assert.equal(
      readFileSync(join(REPO, 'PROJECT_PLAN.md'), 'utf8'),
      diskBefore,
      '本例不得改磁盘计划文档',
    )
  } finally {
    rmScratch(dir)
  }
})

test('T18 形状锁:计划文档必须经 face-reader 按面取,不得再回磁盘直读', () => {
  // 与守门 118 的 half-wired 档同族:"引了层、内容却仍自己从磁盘取"按文件整体分类看不见,
  // 只能由本锁在**源码形态**上钉死。判"代码位"先剥整行注释 —— 本文件多处注释在描述
  // 被推翻的旧写法,不剥就会让门替旧写法背书(守门 57⑤同族)。
  const src = readFileSync(SCRIPT, 'utf8')
  const code = src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l))
    .join('\n')
  assert.match(code, /function pickPlanFace\(/, '四态面选择不在位')
  assert.match(code, /pickPlanFace\(parsed\.flags\)/, 'main 未经 pickPlanFace 选面')
  assert.match(code, /catBatch\(ROOT, \[spec\]/, 'git 面未经 face-reader 的读取入口取正文')
  assert.match(code, /readWorktreeFile\(ROOT, PLAN_REL\)/, '--worktree 档未经 readWorktreeFile')
  assert.match(
    code,
    /const spec = `\$\{face === 'index' \? '' : 'HEAD'\}:\$\{PLAN_REL\}`/,
    '规格组装漂移(冒号必须在三元**外**,index 面才产出 `:path`)',
  )
  // 反向锁(旧缺陷本体):内置计划文档不得再被磁盘直读 —— `--plan` 注入通道读的是显式文件,
  // 形态是 readFileSync(planPath…),与本锁无涉。
  assert.ok(
    !/readFileSync\(PLAN_PATH/.test(code),
    '内置计划文档又回到 readFileSync(磁盘) —— 并发会话未提交行即可改写在飞提交的结论',
  )
  // 反向锁:两面旗同给必须判死(不许"顺手挑一个面")。
  assert.match(code, /if \(picked\.error\)[\s\S]*?process\.exit\(2\)/, '面旗冲突未折成 exit 2')
})

// ---------- T19-T21:CL3 的「结构位 vs 反引号叙述」维(2026-09-28 修假阳) ----------
// 立因:HEAD 面"裸标记×[x] 矛盾行 5"里真牌 0 枚 —— 5 行全是**用反引号引用「（进行中）」
// 这个形态本身**的叙述行(S13 当年把"叙述不算状态"只应用到 `[x]` 半边)。
// 三条锁的分工:T19 = 夹具四对正反(CLI 端到端),T20 = **真仓 HEAD 逐字输入**的成对牙齿
// (§22c:判据的对象是真实文件的形态时,必须拿真行喂,不能全用自造夹具),T21 = 源码形状锁
// ("判不出"档必须**计入+打印**成对在位 —— 静默放过就是把真敞口洗成绿)。

test('T19 反引号叙述不计 / 剥掉包裹必计 / 判不出保守计入并打印(--plan 夹具端到端)', () => {
  const dir = mkScratch('claims-t19')
  try {
    const readJ = (f) => JSON.parse(runCli(['--check-gate', '--plan', f, '--json']).out)
    // ① 两行叙述(取任务书原形,反引号成对)⇒ 计 0、不红、不落"判不出"档
    const narr = join(dir, 'narrative.md')
    writeFileSync(
      narr,
      [
        '- [x] ✅(2026-09-25) **同一台"双态行制造机"的第二条成因**:`merge-live-doc` 的容器短路只比"整行逐字包含",而本仓翻勾**必然改行首状态**(`- [ ]（进行中）` → `- [x] ✅(日期)`…)',
        '- [x] ✅(2026-09-26) **更正** 上面第二格说"18 条翻勾 + 2 条租约摘牌",枚数抄错:`9147d9f4847` 是 **19 行翻勾(其中 2 行同时带 `（进行中）` 标记被一并摘掉)**',
      ].join('\n') + '\n',
    )
    const r1 = runCli(['--check-gate', '--plan', narr])
    assert.equal(r1.status, 0, `叙述行不该判红:${r1.out}`)
    assert.match(r1.out, /裸标记×\[x\] 矛盾行 0/, '报数面仍把叙述计成矛盾行')
    const j1 = readJ(narr)
    assert.equal(j1.leases.legacyContradictions, 0)
    assert.equal(j1.leases.contradictions, 0)
    assert.equal(j1.leases.undeterminedCode, 0, '反引号成对的行不该落"判不出"档')
    // ② 控制测量(不可省):同一真形状**剥掉全部反引号** ⇒ 标记全落结构位 ⇒ 必须计 2。
    //    只报"矛盾行 0"不构成证据 —— 判据失明和仓库干净在账面上长得一模一样。
    const struct = join(dir, 'structural.md')
    writeFileSync(struct, readFileSync(narr, 'utf8').replace(/`/g, ''))
    const j2 = readJ(struct)
    assert.equal(j2.leases.legacyContradictions, 2, '剥掉包裹后就是真牌而不计 ⇒ (①) 的 0 来自判据失明')
    assert.match(runCli(['--check-gate', '--plan', struct]).out, /裸标记×\[x\] 矛盾行 2/)
    // ③ 判不出(奇数反引号,截断长行的真实形态)⇒ **保守计入** + undeterminedCode 点名并打印
    const odd = join(dir, 'odd.md')
    writeFileSync(odd, '- [x] ✅(2026-09-26) 这行被截断:前面有个 `（进行中） 后面没有闭引号\n')
    const j3 = readJ(odd)
    assert.equal(j3.leases.undeterminedCode, 1, '配不成对必须计入 undeterminedCode,不得静默')
    assert.equal(j3.leases.legacyContradictions, 1, '判不出必须按"计入"处置 —— 放过就是把真敞口洗成绿')
    assert.match(runCli(['--check-gate', '--plan', odd]).out, /反引号配不对的行 1 处/, '判不出档必须打印')
    // ④ 叙述里的**租约形态示例**不红;同文剥掉反引号(= 真挂牌)必红 —— 同一夹具两向对拆
    const leaseNarr = join(dir, 'lease-narrative.md')
    writeFileSync(
      leaseNarr,
      '- [x] ✅(2026-09-26) 协议叙述:`- [ ]（进行中）` 的新写法是 `（进行中@2026-09-26/qa）`,已完成行不得再挂\n',
    )
    assert.equal(runCli(['--check-gate', '--plan', leaseNarr]).status, 0, '码段内租约示例不该 CL3 红')
    const leaseReal = join(dir, 'lease-structural.md')
    writeFileSync(leaseReal, readFileSync(leaseNarr, 'utf8').replace(/`/g, ''))
    const r4 = runCli(['--check-gate', '--plan', leaseReal])
    assert.equal(r4.status, 1, '剥掉包裹后的租约牌必须 CL3 红(不放过真牌)')
    assert.match(r4.out, /CL3/)
    // ⑤ 双反引号码段(CommonMark 闭合串须等长)同属叙述
    const dbl = join(dir, 'double.md')
    writeFileSync(dbl, '- [x] 样例见 ``（进行中@2026-09-26/qa）`` 这种写法,不该算牌\n')
    assert.equal(runCli(['--check-gate', '--plan', dbl]).status, 0)
  } finally {
    rmScratch(dir)
  }
})

test('T20 真仓 HEAD 逐字输入:叙述行不计的**理由**必须可复核,剥掉反引号必计(尺子的牙长在真形态上)', () => {
  // §22c:判据的对象是真实文件的形态 ⇒ 输入逐字取自真实文件(这里取 HEAD 面,
  // 全部用内容锚点筛行,不锚行号 —— 行号在任何一次 append 后都会挪位)。
  // 〔夹具重构@2026-10-16〕旧版把夹具输入钉死在「HEAD 面存在 `- [x]`×`（进行中` 行」这一形态,
  // 而机主 2026-10-16「完成即删」令已把该形态**合法清零**(现读 HEAD blob:含标记行 229,
  // 其中勾选态 0)⇒ 夹具自锁,不是判源缺陷(判源一字未动,红因取证见本次提交信息)。
  // 拆成两格,两格都吃真行:
  //  格①(真文档,零改动):含标记行逐行可复核 + 整篇 vs 逐行守恒(跨行串扰锁)——若 [x]×标记
  //    形态回潮,该臂连同"剥掉包裹必计"的阳性对照自动复活;
  //  格②(夹具正反例):从真 HEAD **逐字抽取**「标记整个落在成对反引号码段内」的叙述行,
  //    仅把行首勾选框翻成 `- [x]` 以武装矛盾判据(正文一字不动,锚点仍在真实文件)⇒
  //    断言"成对反引号内不计且理由可复核 / 同文剥掉包裹必计且整篇==逐行合计"。
  //    抽取归零 ⇒ 当场判死,不得静默空转。
  const head = gitRun(['show', 'HEAD:PROJECT_PLAN.md'], { maxBuffer: 1 << 29 })
  const lines = head.split('\n').map((l) => l.trimStart())
  const markerLines = lines.filter((t) => /^- \[[xX]\]/.test(t) && t.includes('（进行中'))

  // —— 格①:真文档逐行可复核 + 守恒不变量(排除跨行串扰);只断相等,不钉"当前几条"
  let counted = 0
  for (const t of markerLines) {
    const asIs = claims.findContradictions(t)
    const aCount = asIs.contradictions.length + asIs.legacyContradictions
    const bare = t.match(/（进行中[^）]*）/g) ?? []
    if (aCount > 0) {
      counted++
      // 被计的行必须给得出理由:undetermined(保守计入)或存在结构位标记
      if (asIs.undeterminedCode === 0) {
        const { spans } = claims.codeSpanRangesOf(t)
        assert.ok(
          bare.some((m) => {
            const at = t.indexOf(m)
            return !claims.insideCodeSpan(spans, at, m.length)
          }),
          `计了矛盾却找不到结构位标记:${t.slice(0, 60)}`,
        )
      }
    } else if (bare.length > 0 && asIs.undeterminedCode === 0) {
      // 未计且反引号配得上对 ⇒ 每个标记必须**确实**落在已配对码段内(排除整行短路)
      const { spans } = claims.codeSpanRangesOf(t)
      for (const m of t.matchAll(/（进行中[^）]*）/g))
        assert.ok(
          claims.insideCodeSpan(spans, m.index, m[0].length),
          `未计但标记不在码段内 ⇒ 误判方向反了:${t.slice(0, 60)}`,
        )
    }
    // 阳性对照:剥掉全部反引号后标记全落结构位 —— 含闭合标记的真行必须被计
    if (bare.length > 0) {
      const u = claims.findContradictions(t.replace(/`/g, ''))
      assert.ok(
        u.contradictions.length + u.legacyContradictions >= 1,
        `剥掉包裹仍不计 ⇒ 判据对真形态失明:${t.slice(0, 60)}`,
      )
    }
  }
  const whole = claims.findContradictions(head)
  assert.equal(
    whole.contradictions.length + whole.legacyContradictions,
    counted,
    '整篇计数 ≠ 逐行合计 ⇒ 判据被相邻行串扰',
  )

  // —— 格②:夹具正反例,取材逐字来自真 HEAD(只翻行首勾选框武装判据,正文零改动)
  const narr = []
  for (const t of lines) {
    if (!t.includes('（进行中')) continue
    if ((t.match(/（进行中[^）]*）/g) ?? []).length === 0) continue
    const armed = t.startsWith('- [ ]') ? '- [x]' + t.slice(5) : t
    if (!armed.startsWith('- [x]')) continue // 非勾选框行(散文/列表嵌套)翻不出可判形态,不抽
    const r = claims.findContradictions(armed)
    if (r.contradictions.length + r.legacyContradictions === 0 && r.undeterminedCode === 0) {
      // 入选条件本身要复核:每个标记都**确实**整体落在成对码段内
      const { spans } = claims.codeSpanRangesOf(armed)
      const allIn = [...armed.matchAll(/（进行中[^）]*）/g)].every((m) =>
        claims.insideCodeSpan(spans, m.index, m[0].length),
      )
      if (allIn) narr.push(armed)
    }
  }
  assert.ok(
    narr.length > 0 || markerLines.length > 0 || lines.some((t) => t.includes('（进行中')),
    'HEAD 面连一行含标记的登记行都没有 ⇒ 格①与格②同时失去底材,本夹具需整体重设计,不得静默空转',
  )
  if (narr.length === 0) {
    // 〔夹具重构③@2026-10-26〕「标记落在成对反引号码段内」的叙述形态已在真仓合法清零
    // (本日结清批把最后一批带标记行摘走,格②的"捡现成"取材自锁)。阳性对照改由**真行合成**:
    // 底材仍逐字取自 HEAD 登记行,只把首个标记包进成对反引号 —— 测的还是同一把尺对同一形态,
    // 形态从"捡到"变"造出",尺子的牙不变。
    const seed = lines.find((t) => /^- \[[xX ]\]/.test(t) && t.includes('（进行中'))
    assert.ok(seed, 'HEAD 面找不到可作底材的含标记登记行 ⇒ 本夹具需整体重设计')
    const armed = (seed.startsWith('- [x]') || seed.startsWith('- [X]') ? seed : '- [x]' + seed.slice(5)).replace(
      /（进行中[^）]*）/,
      (m) => '`' + m + '`',
    )
    assert.ok(
      /`（进行中[^）]*）`/.test(armed),
      `合成失败,底材形态不合预期:${seed.slice(0, 60)}`,
    )
    narr.push(armed)
  }
  const fixtureDoc = narr.join('\n') + '\n'
  // 反向臂:叙述形态逐字来自真行 ⇒ 不计,且不落"判不出"档(反引号是配过对的)
  const jAsIs = claims.findContradictions(fixtureDoc)
  assert.equal(
    jAsIs.contradictions.length + jAsIs.legacyContradictions,
    0,
    '真行反引号叙述被计成矛盾 ⇒ S16 修掉的假阳回潮',
  )
  assert.equal(jAsIs.undeterminedCode, 0, '成对反引号的真行竟判不出 ⇒ 码段测量对真形态失明')
  // 阳性臂:同文剥掉全部反引号 ⇒ 标记全落结构位,逐行必计,且整篇==逐行合计
  let bareSum = 0
  for (const t of narr) {
    const u = claims.findContradictions(t.replace(/`/g, ''))
    assert.ok(
      u.contradictions.length + u.legacyContradictions >= 1,
      `剥掉包裹仍不计 ⇒ 判据对真形态失明:${t.slice(0, 60)}`,
    )
    bareSum += u.contradictions.length + u.legacyContradictions
  }
  const jBare = claims.findContradictions(fixtureDoc.replace(/`/g, ''))
  assert.equal(
    jBare.contradictions.length + jBare.legacyContradictions,
    bareSum,
    '夹具整篇剥皮计数 ≠ 逐行合计 ⇒ 判据被相邻行串扰',
  )
  console.log(
    `  (真仓现读:含标记的勾选行 ${markerLines.length} 条(仍计 ${counted} 条)/ 抽作夹具的码段内叙述真行 ${narr.length} 条 —— 数字随台账在途变化,本测试不钉死)`,
  )
})

test('T21 形状锁:"判不出"档必须计入+打印成对在位;不得退化成整行放过', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.match(src, /if \(undetermined\) undeterminedCode\+\+/, 'undeterminedCode 不再在判不出档累加')
  assert.match(
    src,
    /const structural = undetermined\s*\n\s*\? matches/,
    '判不出必须**保守计入**(全部标记按结构位算)—— 改成放过就是把真敞口洗成绿',
  )
  assert.match(
    src,
    /gate\.summary\.undeterminedCode > 0[\s\S]{0,80}console\.log/,
    '判不出档必须打印(判据失效的表现永远是安静)',
  )
  // 反向锁:旧写法"判不出 ⇒ continue(整行放过)"不得回来 —— 那比误判更糟,它不喊。
  assert.doesNotMatch(
    src,
    /if \(undetermined\) \{[\s\S]{0,140}?\bcontinue\b/,
    '判不出又退化成静默放过整行',
  )
  // 反向锁:标记筛选不得绕开码段判据回到"整行 match"(被推翻的旧本体)。
  assert.doesNotMatch(
    src,
    /const markers = t\.match\(\/（进行中\[\^）\]\*）\/g\)/,
    '旧的整行 match 写法回来 ⇒ 叙述行又会被计成矛盾',
  )
})

// ---------- T22-T25:--claim-age 现读读数档(2026-10-29 立) ----------
// 立因(只读取证席实测原话):「`check-task-claims.mjs` 不报 CL1 计数,超龄牌类票无法机器定性」。
// 实测否证旧账面:`--json` 的 `leases` 只有 `ttlHours,legacy,unknown,holderNoDate` 四个键,
// 超龄这一维**在整个默认档里不存在**,唯一能读到 CL1 枚数的 `--check-gate` 是判红面
// (违规 exit 1、按 HEAD 存量棘轮分桶、点名只给行号)⇒ 台账里"此刻有几枚超龄牌"那类票只能人肉数。
// 本组测试的分工:T22 = 端到端读数与纯函数**同出一源**;T23 = 三态(判死/未判定/互斥);
// T24 = 既有各档输出形态兼容(只加不改);T25 = 形状锁(读数档不得写第二把尺子、不得写盘)。
const READOUT_FIXTURE =
  [
    '- [ ]（进行中@2020-01-01/qa） G-771 超龄租约甲的题面:把台账读数补齐',
    '- [ ]（进行中@2020-01-02/dev） G-772 超龄租约乙的题面,另一件事',
    `- [ ]（进行中@${isoDay(0)}/fresh） G-773 新鲜租约的题面`,
    '- [ ]（进行中） G-774 裸标记的题面',
    '- [ ]（进行中@2020-03-03/solo）',
    `- [ ]（进行中@${isoDay(0)}） G-776 有日期无持有者`,
    '- [ ] G-777 无人认领的题面',
    '- [x] ✅(2026-10-20) G-778 已闭环的题面',
  ].join('\n') + '\n'

test('T22 --claim-age 端到端:枚数现读 + 逐条复合主键点名,且与纯函数读的是同一把尺', () => {
  const dir = mkScratch('claims-t22')
  try {
    const f = join(dir, 'plan.md')
    writeFileSync(f, READOUT_FIXTURE)
    const r = runCli(['--claim-age', '--plan', f])
    assert.equal(r.status, 0, `读数档成立时不得非零:${r.out}`)
    assert.match(r.out, /超龄完整租约牌\(年龄 > 72h\): 3 枚/, '超龄枚数(本票要的那一格)读错')
    assert.match(r.out, /裸「（进行中）」标记\(无日期无持有者\): 1 枚/, '裸标记枚数读错')
    assert.match(r.out, /有效租约\(未超龄\) 1 枚/, '新鲜租约被算进超龄 ⇒ 会把人推向"干脆不挂牌"')
    assert.match(r.out, /半个租约\(有日期无持有者\) 1 枚/, '半个租约桶读数错')
    // 点名给内容锚点(复合主键 编号 + 标题原文),不是行号
    assert.match(r.out, /G-771#超龄租约甲的题面/, '超龄牌没按复合主键点名')
    assert.match(r.out, /G-772#/, '第二枚超龄牌没点名')
    assert.match(r.out, /刻意不给行号/, '报名必须自称锚点形态,否则下一位又拿行号当证据')
    // 给不出主键的那一枚必须**仍在场上**(静默丢行 = 把"这一枚没人点名"写成"没有这一枚")
    assert.match(r.out, /（进行中@2020-03-03\/solo）/, '整行只剩一枚牌的行被静默丢了')
    assert.match(r.out, /编号与题面都给不出/, '兜底锚点必须自称不精确,不得冒充复合主键')
    // 逐条点名行一律不得以行号开头(§1:证据指针禁止行号)
    for (const line of r.out.split('\n').filter((l) => /^\s+· /.test(l)))
      assert.equal(
        /^\s+· L\d+/.test(line),
        false,
        `读数档里出现行号锚点(行号一次 append 就挪位):${line.slice(0, 60)}`,
      )
    // 同一瞬间与纯函数对账:CLI 打的数**必须**就是那份实现算出来的数(测试里也不许再数一遍)
    const json = runCli(['--claim-age', '--plan', f, '--json'])
    assert.equal(json.status, 0, json.out)
    const j = JSON.parse(json.out)
    const pure = claims.buildClaimAgeReadout(readFileSync(f, 'utf8'), {
      nowMs: Date.now(),
      ttlHours: 72,
    })
    assert.deepEqual(j.totals, pure.totals, 'CLI 读数 ≠ 纯函数读数 ⇒ 打印面自己偷偷算了一遍')
    assert.deepEqual(
      j.buckets.staleLease.map((v) => v.anchor),
      pure.buckets.staleLease.map((v) => v.anchor),
      '逐条锚点两面不同形',
    )
    assert.equal(j.face.includes('注入文件'), true, 'JSON 档必须如实报判定面')
    assert.equal(j.undetermined.length, 0, `夹具健全却判未判定:${j.undetermined.join(' / ')}`)
    for (const rows of Object.values(j.buckets))
      for (const item of rows)
        assert.equal(
          'line' in item,
          false,
          `读数项里携带 line 字段 ⇒ 迟早被当锚用:${JSON.stringify(item).slice(0, 60)}`,
        )
    // 阳性对照:阈值收到 1h ⇒ 那枚今天的牌也进超龄(证明"超龄"这一维真有牙,不是恒 0)
    const tight = JSON.parse(runCli(['--claim-age', '--plan', f, '--ttl-hours', '1', '--json']).out)
    assert.equal(tight.totals.staleLease, 4, '阈值收紧必须多计 ⇒ 否则超龄维是假的')
  } finally {
    rmScratch(dir)
  }
})

test('T23 读数档三态:面上无条目行 / 输入取不到 / 与判红档同给 —— 全部 exit 2 且点名原因', () => {
  const dir = mkScratch('claims-t23')
  try {
    // ① 散文文档(读得到,但枚举到 0 条目行)⇒ **未判定**,绝不把"判不出"写成"超龄 0 枚"
    const prose = join(dir, 'prose.md')
    writeFileSync(prose, '这只是一段散文,没有任何登记行。\n')
    const a = runCli(['--claim-age', '--plan', prose])
    assert.equal(a.status, 2, `枚举到 0 条目行必须判未判定(exit 2),实得 ${a.status}:${a.out}`)
    assert.match(a.out, /未判定/, '未判定必须显式喊出来,不得记绿也不冒红')
    assert.match(a.out, /不记绿也不冒红/, '§0.3 口径必须在场')
    // ② 输入取不到 ⇒ exit 2(不回落另一个面)
    const b = runCli(['--claim-age', '--plan', join(dir, 'no-such-file.md')])
    assert.equal(b.status, 2, '取不到注入文档竟不判死')
    assert.match(b.out, /无法判定/)
    // ③ 读数档与判红档同给 ⇒ 当场判死(谁决定退出码没有答案)
    const clash = runCli(['--claim-age', '--check-gate', '--plan', join(dir, 'x.md')])
    assert.equal(clash.status, 2, '--claim-age 与 --check-gate 同给竟被放过')
    assert.match(clash.out, /互斥/)
    for (const other of claims.READOUT_EXCLUSIVE.slice(1)) {
      const r = runCli(['--claim-age', other])
      assert.equal(r.status, 2, `--claim-age 与 ${other} 同给必须判死`)
    }
    // ④ 反面对照:读数档**本身**在真仓 HEAD 面上必须出得来(恒 2 = 又一堵拦路的死门)
    const real = runCli(['--claim-age'])
    assert.equal(real.status, 0, `真仓 HEAD 面读数判死:${real.out}`)
    assert.match(real.out, /超龄完整租约牌\(年龄 > 72h\): \d+ 枚/)
    assert.match(real.out, /HEAD blob/, '默认面必须自称 HEAD blob')
  } finally {
    rmScratch(dir)
  }
})

test('T24 向后兼容:既有各档的输出形态一字未改,新读数只做附加', () => {
  const dir = mkScratch('claims-t24')
  try {
    const f = join(dir, 'plan.md')
    writeFileSync(f, READOUT_FIXTURE)
    // --json(默认档):旧键一个不少,新键只是往上加
    const j = JSON.parse(runCli(['--plan', f, '--json']).out)
    for (const k of ['unclaimed', 'inProgress', 'completed', 'closedTwins', 'totals'])
      assert.ok(k in j, `默认 JSON 少了既有键 ${k}`)
    for (const k of ['ttlHours', 'legacy', 'unknown', 'holderNoDate'])
      assert.ok(k in j.leases, `leases 的既有键 ${k} 被改动`)
    assert.equal(typeof j.leases.stale, 'number', '新增的超龄枚数必须是数')
    assert.equal(j.leases.stale, 3, '默认 JSON 档此前根本没有超龄这一维 ⇒ 补上后必须读得出')
    // --check-gate(判红档):形态与退出码语义不得被读数档改动
    const g = runCli(['--check-gate', '--plan', f, '--json'])
    assert.equal(g.status, 1, '夹具含过期租约,判红档必须仍 exit 1')
    const gj = JSON.parse(g.out)
    for (const k of ['checkGate', 'exit', 'ttlHours', 'face', 'leases', 'cl1', 'cl3', 'violations'])
      assert.ok(k in gj, `--check-gate JSON 少了既有键 ${k}`)
    assert.ok(gj.violations.every((v) => ['CL1', 'CL2', 'CL3', 'CL4'].includes(v.kind)))
    // --in-progress:首行形态不变,读数行是**插入**的第二行
    const ip = runCli(['--in-progress', '--plan', f])
    assert.match(ip.out.split('\n')[0], /^进行中任务 \(\d+\):$/, '--in-progress 首行形态被改')
    assert.match(ip.out.split('\n')[1], /^  读数:超龄完整租约牌 \d+ 枚/, '附加读数行缺位')
    // 默认汇总档:既有四行原样在场
    const d = runCli(['--plan', f])
    for (const re of [
      /^  无人认领:  \d+/m,
      /^  进行中:    \d+\(旧格式无租约/m,
      /^  已完成:    \d+/m,
      /^  合计:      \d+/m,
    ])
      assert.match(d.out, re, `默认汇总的既有行被改动:${re}`)
    assert.match(d.out, /^  认领牌年龄现读:超龄完整租约牌 \d+ 枚/m, '默认档的附加读数行缺位')
    // 全程零副作用:夹具文件逐字未变,真计划文档字节未动
    assert.equal(readFileSync(f, 'utf8'), READOUT_FIXTURE, '读数档写了注入文件')
    assert.match(runCli(['--twins', '--plan', f]).out, /判定面:注入文件/, '--twins 档不受影响但必须仍可用')
  } finally {
    rmScratch(dir)
  }
})

/** 从源码里按大括号配平抠出一个函数体(形状锁要用**函数自己的**射程,整篇匹配会漏判/误判)。
 *  ⚠ 起点必须是**函数体**那一枚花括号:参数是解构形态(`(content, { nowMs, ttlHours })`)时,
 *  从"第一个 {"数起会在那个参数的 `}` 上就归零 —— 抠出来的射程只剩函数签名,形状锁当场
 *  在"import 了自己的判据"这一臂上误判红(本测试第一版即此型)。 */
function sliceFunction(src, marker) {
  const start = src.indexOf(marker)
  assert.notEqual(start, -1, `源码里找不到 ${marker} ⇒ 读数档被整块删掉了`)
  // 先配平参数表那一对圆括号,再取紧随其后的函数体花括号
  let i = src.indexOf('(', start)
  assert.notEqual(i, -1, `${marker} 没有参数表`)
  let pd = 0
  for (; i < src.length; i++) {
    if (src[i] === '(') pd++
    else if (src[i] === ')' && --pd === 0) break
  }
  let depth = 0
  let seen = false
  for (let j = src.indexOf('{', i); j < src.length; j++) {
    if (src[j] === '{') {
      depth++
      seen = true
    } else if (src[j] === '}') {
      depth--
      if (seen && depth === 0) return src.slice(start, j + 1)
    }
  }
  assert.fail(`${marker} 的花括号不配平,抠不出射程`)
}

test('T25 形状锁:读数档零复算、零写盘 —— 年龄只问 analyzeLeases,锚点只问 plan-task-index', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  const body = sliceFunction(src, 'export function buildClaimAgeReadout(')
  // ① 年龄这一维**必须**是问既有判据要的答案,不得在读数档里重算(§0.6/§22c:两份公式必漂)
  assert.match(body, /analyzeLeases\(inProgress/, '读数档没走 analyzeLeases ⇒ 过期语义又有了第二份实现')
  assert.match(body, /scanTasks\(content/, '读数档必须复用三态分类,不得自带一份"什么算挂牌"')
  for (const banned of ['HOUR_MS', 'Date.parse', 'ttlHours -', '> ttlHours', 'ageHours ='])
    assert.ok(
      !body.includes(banned),
      `读数档里出现了 ${banned} ⇒ 年龄公式被复算第二遍(超龄枚数与判红枚数迟早两个数)`,
    )
  // ② 锚点必须来自 lib 的单源出口,且 import 面确实在场
  const anchorBody = sliceFunction(src, 'export function claimAnchorOf(')
  for (const fn of ['compositeKeyOf(', 'keyOfRow(', 'titleOf('])
    assert.match(anchorBody, new RegExp(fn.replace('(', '\\(')), `锚点没问 ${fn} ⇒ 主键形态与全仓漂开`)
  assert.match(src, /compositeKeyOf,[\s\S]{0,200}keyOfRow,[\s\S]{0,200}titleOf,\s*\} from '\.\/lib\/plan-task-index\.mjs'/, '三个主键出口不是从 lib import 的')
  // ③ 只读:读数档不得写盘、不得摘牌、不得动 HEAD(摘牌是 strip-stale-claim-marks 的职权)
  const printBody = sliceFunction(src, 'function runClaimAgeReadout(')
  for (const banned of ['writeFileSync', 'execFileSync', 'spawnSync', 'update-ref', 'commit-tree'])
    assert.ok(
      !body.includes(banned) && !printBody.includes(banned),
      `读数档里出现 ${banned} ⇒ 它越出了"只读数"这一步`,
    )
  // ④ 读数档不得顺手判红(§12e:把别人欠的旧账做成判红面 = 恒红门 = 逼人跳门)
  assert.equal(
    /violations/.test(body) || /process\.exit\(1\)/.test(printBody),
    false,
    '读数档里冒出判红动作 ⇒ 与 --check-gate 的分工被打穿',
  )
  // ⑤ 判死那一维必须**打印**(判据失效的表现永远是安静):undetermined 既进 JSON 也进人类档
  assert.match(printBody, /ro\.undetermined\.length > 0 \? 2 : 0/, '未判定没落到 exit 2')
  assert.match(printBody, /undetermined[\s\S]{0,120}console\.log|console\.log[\s\S]{0,120}undetermined/, '未判定原因必须逐条打印')
})
