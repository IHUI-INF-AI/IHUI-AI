// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 镜像测试:scripts/alert-volume-report.mjs(§22c:只 import 判据,不复制实现)。
//
// 为什么必须有:该工具进不了任何守门(守门 89/118 的候选枚举只认 ^scripts/(check|scan|guard)),
// 所以"被接线门看见"这条路结构上不存在;而它的数字是给人做决策用的。它算错的表现不是报错,
// 而是一张看起来完整的报告 —— 即本仓最高频失效型"判据在、调度器没接"。故第一优先是装车锁。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { after, test } from 'node:test'

import { mkScratch } from '../lib/scratch-dir.mjs'

const SRC = resolve(fileURLToPath(import.meta.url), '../../alert-volume-report.mjs')
const SRC_URL = pathToFileURL(SRC).href
const SRC_TEXT = readFileSync(SRC, 'utf8')
const { __test__ } = await import(SRC_URL)
const {
  scanMailLog,
  ensureFixedWindows,
  parseAttestation,
  loadRegistry,
  readTextTail,
  maskLocalPart,
  asciiFragment,
  renderHuman,
  NOT_COVERED,
  ROOT,
} = __test__

// 非 ASCII 一律用转义写:把 CJK 区间当字面量贴进源码,会撞上"说明性文字也带执行性字符"那一坑。
const HAS_NON_ASCII = /[^\x20-\x7e]/

const made = []
const box = (tag) => {
  const d = mkScratch(`avr-${tag}-`)
  made.push(d)
  return d
}
after(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
})

/**
 * 取 `function NAME(` 的**函数体**。
 * 必须先跳过参数表再找体首的 `{`:直接取"下一个左花括号"会被 `function collect(opts = {}) {`
 * 里那个默认值 `{}` 骗走 —— 于是取出一个几乎为空的"函数体",装车锁看不见任何判据调用。
 * (本测试第一版就是这么红的:不是判据没接,是取函数体的尺子错了。参数表里的括号按深度配平跳掉。)
 */
function bodyOf(name) {
  const at = SRC_TEXT.indexOf(`function ${name}(`)
  assert.ok(at >= 0, `源码里没有 function ${name}( ⇒ 判据被改名或摘除,本测试该红而不是跳过`)
  let i = SRC_TEXT.indexOf('(', at)
  let depth = 0
  let inStr = null
  for (; i < SRC_TEXT.length; i++) {
    const c = SRC_TEXT[i]
    if (inStr) {
      if (c === '\\') i++
      else if (c === inStr) inStr = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c
      continue
    }
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) break
    }
  }
  let b = SRC_TEXT.indexOf('{', i)
  assert.ok(b > 0, `${name} 找不到函数体起始 {`)
  depth = 0
  for (; b < SRC_TEXT.length; b++) {
    const c = SRC_TEXT[b]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return SRC_TEXT.slice(at, b + 1)
    }
  }
  assert.fail(`${name} 大括号没配平 ⇒ 取不出函数体,装车锁无法判(这本身就是红)`)
}

test('T1 装车锁:每条判据都被主流程真的调到(函数在而无人调 = 一路绿灯)', () => {
  const build = bodyOf('buildReport')
  const collectBody = bodyOf('collect')
  for (const fn of ['scanMailLog', 'parseAttestation', 'interpretAlertState', 'interpretDedupe'])
    assert.ok(new RegExp(`\\b${fn}\\(`).test(build), `${fn} 没被 buildReport 调用 ⇒ 它算什么都不进报告`)
  for (const fn of ['readTextTail', 'loadRegistry'])
    assert.ok(new RegExp(`\\b${fn}\\(`).test(collectBody), `${fn} 没被 collect 调用 ⇒ 真实跑时根本不去取数`)
  assert.match(bodyOf('windowStats'), /findStorms\(/, 'windowStats 没调 findStorms ⇒ 风暴判据是死代码')
  // 固定桶装配器必须被**两侧**都调到:只接一侧 = 那一侧诚实、另一侧照旧拿请求窗口冒充 24h。
  assert.match(bodyOf('scanMailLog'), /ensureFixedWindows\(/, 'scanMailLog 没接固定桶 ⇒ 发信面的 *24h 又在装请求窗口')
  assert.match(bodyOf('parseAttestation'), /ensureFixedWindows\(/, 'parseAttestation 没接固定桶 ⇒ 跳门面的 *24h 又在装请求窗口')
  assert.match(bodyOf('loadRegistry'), /parseRegistry\(/, 'loadRegistry 没调 parseRegistry ⇒ 反查根本没做')
  // 反向对照:这条锁不是恒真的 —— 一个不存在的方法名必须进不了检查。
  assert.ok(!/__never_called_sentinel\(/.test(build), '取函数体判据失效(整份源码被当成函数体了)')
})

test('T2 两档共用同一份结论:--json 与人读不得各算一遍', () => {
  assert.match(bodyOf('collect'), /return buildReport\(/, 'collect 没有唯一出口 buildReport ⇒ 某一档会自己另算')
  const cli = SRC_TEXT.slice(SRC_TEXT.indexOf('if (process.argv[1]'))
  assert.match(cli, /collect\(\{ argv/, 'CLI 档没走 collect()')
  assert.ok(!/buildReport\(/.test(cli), 'CLI 直接调 buildReport ⇒ 绕开了装配层')
})

test('T3 import 本模块不得触发取数与打印(§22d 入口守卫)', async () => {
  const t0 = Date.now()
  const mod = await import(SRC_URL + '?again=1')
  assert.ok(mod.__test__, '无 __test__ 导出')
  assert.ok(Date.now() - t0 < 2000, 'import 就跑了真实取数 ⇒ 守卫被摘')
  assert.match(SRC_TEXT, /import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/)
})

test('T4 只读性源码锁:写盘出口只允许存在于 selfTest 内', () => {
  const at = SRC_TEXT.indexOf('async function selfTest(')
  assert.ok(at > 0, '找不到 selfTest ⇒ 写盘锁没有锚点')
  const outside = SRC_TEXT.slice(0, at)
  for (const w of ['writeFileSync', 'appendFileSync', 'mkdirSync', 'rmSync', 'unlinkSync', 'cpFileSync', 'renameSync'])
    assert.ok(!new RegExp(`\\b${w}\\b`).test(outside), `${w} 出现在 selfTest 之前 ⇒ 该工具不再是只读的`)
  assert.ok(!/\brequire\(/.test(SRC_TEXT), 'ESM 里出现裸 require ⇒ 运行期必炸')
})

test('T5 夹具落点:必须走 scratch-dir 唯一出口(§26/§15b:禁 os.tmpdir、禁裸 mkdtempSync)', () => {
  assert.match(SRC_TEXT, /import\(['"]\.\/lib\/scratch-dir\.mjs['"]\)/, '夹具没走 mkScratch 唯一出口(selfTest 里动态 import)')
  assert.ok(!/tmpdir\(/.test(SRC_TEXT), 'os.tmpdir() 可能钉在 C 盘,不得回来')
  assert.ok(!/\bmkdtempSync\(/.test(SRC_TEXT), '裸 mkdtempSync 绕过落点约束')
})

test('T6 门号→脚本只来自现读注册表;不得有硬编码门号清单;真仓必须看得见存量', () => {
  assert.match(bodyOf('buildReport'), /registryMap\.get\(g\.id\)/, '反查没走注册表 map ⇒ 又变手工清单')
  // 锁的是"命令字符串本身只有一处",null 分支只是缺席标记,不构成第二处拼接。
  assert.equal((SRC_TEXT.match(/node scripts\/\$\{/g) || []).length, 1, '复现命令拼接处必须唯一(两处各拼一份必漂移)')
  assert.ok(!/const\s+(GATES|KNOWN_GATES|GATE_IDS)\s*=/.test(SRC_TEXT), '出现门号清单常量 —— 编号清单必然腐烂')
  const r = loadRegistry(ROOT, 'head')
  assert.ok(r.ok, `真仓 HEAD 注册表取不到:${r.reason}`)
  assert.ok(r.entries > 100, `HEAD 面只解析到 ${r.entries} 条 ⇒ 尺子失效,不得据此说"没门"`)
})

test('T7 真实两档端到面:--json 可 parse 且与人读同形(不信自检自己发的合格证)', () => {
  const run = (extra) =>
    execFileSync(process.execPath, [SRC, ...extra], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  const json = JSON.parse(run(['--json']))
  const human = run([])
  assert.ok(json.summary, 'json 档缺 summary')
  for (const [k, v] of Object.entries(json.summary))
    assert.ok(human.includes(`${k}=${v}`), `人读档没原样带出 ${k}=${v} ⇒ 两档可以各说各话`)
  assert.ok(json.coverage.length >= 5, 'coverage 面没报全')
  assert.ok(json.coverage.every((c) => c.state === 'covered' || c.note), '未覆盖的每条必须有原因')
  assert.ok(NOT_COVERED.length >= 5 && human.includes('未覆盖清单'), '射程边界必须报名,不得只报数')
})

test('T8 判据与编码无关:同一份真日志按不同码解,ASCII 判据读数必须一致', () => {
  const f = resolve(ROOT, 'deploy', 'win', 'deploy-loop.log')
  const r = readTextTail(f, 4 << 20)
  if (!r.ok) {
    // 干净检出/别的机器上这份日志可以不存在 —— 那是"未判定",不得让测试替它编数据,也不得算通过。
    assert.match(r.reason, /不存在|读失败|stat 失败/)
    return
  }
  const wide = { nowMs: Date.parse('2030-01-01T00:00:00Z'), hours: 24 * 3650, days: 24 * 3650 }
  const latin = scanMailLog(r.text, wide)
  const utf8 = scanMailLog(Buffer.from(r.text, 'latin1').toString('utf8'), wide)
  assert.ok(latin.mails.length > 0, '真日志一行 MAIL 都没量到 ⇒ 判据对这份日志全盲')
  assert.equal(utf8.mails.length, latin.mails.length, '换一种解码结论就变 ⇒ 判据其实锚在编码上而不是 ASCII 关键字上')
  assert.ok(latin.totals.alertSkipped > 0, 'ALERT 去重一行都没量到 ⇒ 分母会偏')
  for (const e of latin.mails) assert.ok(!HAS_NON_ASCII.test(e.ascii), 'ASCII 片段里漏进了非 ASCII(= 中文/乱码)')
})

test('T9 风暴判据在真数据上也有牙(不只是夹具里绿)', () => {
  const f = resolve(ROOT, 'deploy', 'win', 'deploy-loop.log')
  const r = readTextTail(f, 8 << 20)
  if (!r.ok) return
  const wide = { nowMs: Date.parse('2030-01-01T00:00:00Z'), hours: 24 * 3650, days: 24 * 3650 }
  const res = scanMailLog(r.text, wide)
  const w = res.windows['87600h']
  assert.ok(w, `窗口键名与参数不符:${Object.keys(res.windows)}`)
  // 阳性对照:2026-09-27 那次"凌晨 4 点一小时 16 封"必须被本判据认出来;认不出来就是尺子失效。
  const peak = w.storms[0]
  assert.ok(peak && peak.count >= 8, `真日志里连一小时 8 封的那一簇都没认出来 ⇒ 风暴判据无牙(count=${peak ? peak.count : 'n/a'})`)
  for (const ln of peak.lines) {
    assert.match(ln.ts, /^\d{4}-\d{2}-\d{2}T/)
    assert.equal(ln.keyword, 'MAIL')
  }
})

test('T12 固定桶装配器纯函数契约:缺才补、有则复用、不改入参', () => {
  // 防三件事:① 忘了补 24h/7d(字段 undefined ⇒ 报告要么崩要么伪装成 0);
  // ② 请求窗口恰是 24h 时又重算一遍并覆盖 —— 两桶读数会因取样瞬间不同而自相矛盾;
  // ③ 原地改入参(调用方拿着旧 map 继续用,就拿到了被悄悄动过的表)。
  const build = (label) => ({ bucket: label })
  const input = { '4h': { bucket: 'req-4h' }, '7d': { bucket: 'req-7d' } }
  const out = ensureFixedWindows(input, build)
  assert.deepEqual(out['24h'], { bucket: '24h' }, '24h 桶没补')
  assert.equal(out['7d'], input['7d'], '请求窗口已是 7d 时必须复用那一份,不得重算覆盖')
  assert.deepEqual(Object.keys(out).sort(), ['24h', '4h', '7d'])
  assert.equal(input['24h'], undefined, 'ensureFixedWindows 原地改了入参 ⇒ 调用方手里的旧表被悄悄动过')
  const full = { '24h': { bucket: 'req-24h' }, '7d': { bucket: 'req-7d' } }
  assert.equal(ensureFixedWindows(full, build)['24h'], full['24h'], '默认档(--hours 24)不得把请求桶换成另一份读数')

  // 跳门侧必须真被同一把尺子问过(不只读源码形状):请求 4h 而 24h 内还有旧行时,
  // 两个桶必须给出两个不同的数 —— 拿同一个数当"24h"就是本文件要防的那一型。
  const rows = [
    { ts: '2026-09-27T04:00:00.000Z', kind: 'mine', ranFullBatch: true, failedGates: ['44'] },
    { ts: '2026-09-26T20:00:00.000Z', kind: 'not-ours', ranFullBatch: true, failedGates: ['29'] },
  ]
  const a = parseAttestation(rows.map((r) => JSON.stringify(r)).join('\n') + '\n', { nowMs: Date.parse('2026-09-27T05:00:00Z'), hours: 4, days: 7 })
  assert.equal(a.windows['4h'].skips, 1, '请求窗口 4h 应只认当刻那条')
  assert.equal(a.windows['24h'].skips, 2, '固定 24h 桶应认两条 —— 又拿请求窗口冒充 24h 了')
})

test('T13 名字带 24h/7d 的字段必须从固定桶取,且两侧都真接了装配器(源码级反向锁)', () => {
  // 行为面由自检 S11b 与 T12 管(它们构造"两跨度读数不同"的夹具)。本条防的是另一种失效:
  // 将来有人重构 summary,把固定桶改回 `windows[hKey]` 而不留用例 —— 那时报告照样数字齐全、
  // 照样两档同形,只是标签下的数是别的跨度的。这种漂移只有读源码能稳定问出来。
  const src = SRC_TEXT.replace(/\s+/g, ' ')
  for (const [field, bucket] of [
    ['mailTotal24h', "'24h'"],
    ['mailTotal7d', "'7d'"],
    ['skipTotal24h', "'24h'"],
    ['skipTotal7d', "'7d'"],
    ['stormClusters24h', "'24h'"],
  ]) {
    const re = new RegExp(`${field}:\\s*\\w+\\s*\\?\\s*\\w+\\.windows\\[${bucket}\\]`)
    assert.ok(re.test(src), `${field} 不再从固定桶 ${bucket} 取 ⇒ 字段名又在装请求窗口的数`)
  }
  // 定义 1 处 + 发信侧/跳门侧各 1 处调用;少一处就是"只有半个报告诚实"
  const uses = (src.match(/ensureFixedWindows\(/g) || []).length
  assert.ok(uses >= 3, `ensureFixedWindows 只出现 ${uses} 次(应 ≥3:定义 + 两侧调用)⇒ 有一侧的固定桶没接上`)
})

test('T10 未判定的形状:三个源都取不到时 summary 必须是 null 且报满未判定条数', () => {
  const d = box('miss')
  const miss = readTextTail(resolve(d, 'nope', 'absent'))
  assert.equal(miss.ok, false)
  const rep = __test__.collect({
    nowMs: Date.parse('2026-09-27T03:00:00Z'),
    mailRead: miss,
    mailPath: resolve(d, 'a.log'),
    attRead: miss,
    attPath: resolve(d, 'a.jsonl'),
    alertRaw: null,
    dedupeRaw: null,
    registry: { ok: false, reason: '夹具不提供' },
  })
  for (const [k, v] of Object.entries(rep.summary)) {
    // 数量型字段一律必须为 null;描述窗口本身的(windowHours/windowDays)不是结论,允许有值。
    if (/^(mailTotal|skipTotal|stormClusters|alertSkippedTotal|noBatchTotal)/.test(k))
      assert.equal(v, null, `源都取不到却报出了 ${k}=${v} ⇒ 新增计数字段漏进了"取不到即为 null"的清单`)
  }
  assert.ok(rep.summary.windowHours !== undefined, 'summary 不再声明请求窗口跨度 ⇒ 字段名与跨度的对应关系又没人看守了')
  assert.ok(rep.summary.sourcesUndetermined >= 5, `五个源都没读到却只报 ${rep.summary.sourcesUndetermined} 条未判定`)
  assert.match(renderHuman(rep), /未判定/)
})

test('T11 报告卫生:不泄中文原文、邮箱本地段必须掩码', () => {
  // 真 GBK 字节(现采自代码页 936)混在 ASCII 里:片段必须只剩 ASCII,且地址本地段被掩。
  const gbk = Buffer.from('d3cabcfeb8e6beaf', 'hex').toString('latin1')
  assert.equal(asciiFragment(gbk + ' x@y.example.com'), '***@y.example.com')
  assert.equal(asciiFragment('品牌模型 502319984@qq.com (tag)', 60), '***@qq.com (tag)')
  assert.equal(maskLocalPart('abc@qq.com'), '***@qq.com')
  assert.ok(!HAS_NON_ASCII.test(asciiFragment('中文 mixed ascii 尾')), 'ASCII 片段仍含非 ASCII')
})
