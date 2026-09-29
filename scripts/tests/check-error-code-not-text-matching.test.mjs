// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:G-710 的守门 `check-error-code-not-text-matching`。
//
// 这里刻意**不 import 判据函数再抄一份规则**(那只会复读实现)。分工是:
//  - 判据行为:用构造面喂输入输出对(T2/T3/T9 —— 形状锁证明不了判定行为,守门 103 那一课);
//  - 取材面 / 遮罩单源 / 接线一致性:用源码级反向锁(T5/T6/T7 —— 这些是"行为在别的文件里"
//    的东西,只能按形状钉,且必须是**反向**钉:写法漂回去即红);
//  - CLI 语义:真派生脚本跑一次(T4/T10),因为退出码不是判据函数能替它决定的。
//
// 夹具一律走 `scripts/lib/scratch-dir.mjs`(§26:不得往 os.tmpdir() 写)。

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const GATE = resolve(ROOT, 'scripts/check-error-code-not-text-matching.mjs')
const EXPIRY = resolve(ROOT, 'scripts/check-exemption-expiry.mjs')
const RUNNER = resolve(ROOT, 'scripts/guardian-runner.mjs')

// Windows 上绝对路径不能直接给 import():必须走 pathToFileURL(本仓 §22d 记过同一对陷阱的反方向)
const gate = await import(pathToFileURL(GATE).href)
const T = gate.__test__

/** 本门的行内豁免族与它的寿命档(与守门 108 的登记表必须同形)。 */
const FAMILY = 'error-code-exempt'
const FAMILY_DAYS = 30

test('T1 判据的算子集合与预筛串集合同源(预筛漏一个算子 = 门对该算子整型失明)', () => {
  assert.equal(T.PRESCREEN.length, T.TEXT_OPS.length)
  T.TEXT_OPS.forEach((op, i) => assert.equal(T.PRESCREEN[i], `.${op}(`))
  // 宿主形态只认三个能接正则当判据的算子,那张子集仍必须是总表的子集(漂出去就是第二份清单)
  const receiverOps = ['test', 'match', 'search']
  assert.ok(receiverOps.every((op) => T.TEXT_OPS.includes(op)), 'RECEIVER_OPS 漂出 TEXT_OPS')
})

test('T2 构造面:硬编码文本决定分支必须点名,四种书写形态各一条', () => {
  const cases = [
    ["if (err.message.includes('429')) retry()", 'status-as-text'],
    ["if (msg.includes('rate limit')) backoff()", 'literal-in-text-op'],
    ['const t = errorMsg.search(/\\b5\\d{2}\\b/) >= 0', 'regex-in-text-op'],
    ["if (/permission denied/i.test(String(err))) deny()", 'regex-receiver-on-text'],
  ]
  for (const [line, kind] of cases) assert.equal(T.classifyLine(line), kind, `漏判:${line}`)
})

test('T3 构造面:同一条判据的两类正当写法不得被吞掉(注释 / 结构化集合)', () => {
  // 注释遮蔽住在 findTextMatching(整源等长遮),classifyLine 是**逐行分型器**、按定义不看上下文 ——
  // 拿注释行喂它会测到一个从未存在的契约。所以这一格走生产入口 findTextMatching,
  // 并自带"去掉注释就必须命中"的对照:否则"遮噪声称生效"与"判据根本看不见这一型"两种情况
  // 在只测注释的断言上长得一模一样(恒绿尺子)。
  const commented = "// 旧写法:if (err.message.includes('429')) retry()"
  assert.equal(T.findTextMatching(commented).hits.length, 0, '注释里的该形态不得计入违规')
  assert.equal(T.findTextMatching(commented.slice(3)).hits.length, 1, '同一形态去掉注释必须命中(证明上一条不是空转)')
  assert.equal(T.classifyLine('if (RETRYABLE_CODES.includes(code)) retry()'), null)
  assert.equal(T.classifyLine("if (list.includes(userInput)) show()"), null)
  // 注释遮蔽必须是**等长**的:行号漂了就会把下一行的违规指到上一行
  const src = "// 说明\nconst a = 1\nif (err.message.includes('429')) retry()\n"
  const r = T.findTextMatching(src)
  assert.equal(r.hits.length, 1)
  assert.equal(r.hits[0].line, 3, '遮注释后行号必须与原文对齐')
})

test('T4 一跳别名必须被看见(本票立项那条原文就是这个形状)—— 有牙证明', () => {
  const withAlias = "const e = (error ?? '').toLowerCase()\nif (e.includes('429')) retry()\n"
  const without = "const e = payload.kind.toLowerCase()\nif (e.includes('429')) retry()\n"
  assert.equal(T.findTextMatching(withAlias).hits.length, 1, '别名那一跳不得失明')
  assert.equal(T.findTextMatching(without).hits.length, 0, '别名来源不是文本时必须放过(否则满天假阳)')
  // 反向锁:把 collectAliases 摘掉(等价于别名档不存在),第一份必须变绿 ——
  // 不测这一半,"别名其实没生效"就与"仓库没有这种写法"在账面上长得一模一样。
  const aliases = T.collectAliases(withAlias.split('\n'))
  assert.ok(aliases.has('e'), 'collectAliases 没抓到那条别名')
})

test('T5 豁免:必须带原因才放行,且放行后仍被点名(只报数)', () => {
  const withReason = `if (err.message.includes('already exists')) ignore() // ${FAMILY}: 上游驱动未提供错误码,只能匹配其文本`
  const bare = `if (err.message.includes('already exists')) ignore() // ${FAMILY}:`
  const onPrevLine = `// ${FAMILY}: 上游是第三方 CLI,没有码可用\nif (err.message.includes('already exists')) ignore()`
  const r1 = T.findTextMatching(withReason)
  assert.equal(r1.hits.length, 0)
  assert.equal(r1.exempted.length, 1)
  const r2 = T.findTextMatching(bare)
  assert.equal(r2.hits.length, 1, '裸标记(无原因)不得放行')
  const r3 = T.findTextMatching(onPrevLine)
  assert.equal(r3.hits.length, 0, '标记写在紧邻上一纯注释行必须生效(否则按直觉写的人永远解不了红)')
  assert.equal(r3.exempted.length, 1)
})

test('T6 真仓 HEAD 阳性对照:看不见存量就不算通过', () => {
  const r = T.analyze('head')
  assert.ok(r.total > 0, `HEAD 面必须看得见既有文本判分支(实得 ${r.total})`)
  assert.notEqual(r.exit, 1, '全量档不得因存量判红(锚点是该文件 HEAD 自身)')
  assert.equal(r.emptyScan, false)
  assert.equal(r.unreadable.length, 0, `有候选取不到内容:${r.unreadable.slice(0, 3).join(', ')}`)
})

test('T7 唯一出口必须是数据驱动的表,不得被本门判成违规(门不得产出自己判红的形态)', () => {
  const outletText = readFileSync(resolve(ROOT, 'apps/cli/src/tools/index.ts'), 'utf8')
  const hits = T.findTextMatching(outletText).hits
  assert.equal(
    hits.length,
    0,
    `兜底出口里出现被禁形态(应改为表驱动):${hits.map((h) => `L${h.line}:${h.text}`).join(' | ')}`,
  )
  assert.equal(T.detectOutlet(outletText), 'ok', '出口三件套必须真的被递出')
  const stripped = outletText.replace(/export\s+(?:const|function|class)\s+/g, '__gone ').replace(/export\s*\{[^}]*\}\s*from[^\n]*/g, '__gone')
  assert.equal(T.detectOutlet(stripped), 'stripped', '出口被摘线必须判 stripped,而不是"看起来没有违规"')
})

test('T8 源码级反向锁:取材只走 face-reader 的 catBatch,遮噪只走 code-mask 那一份', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '未从 face-reader 取面')
  assert.match(src, /catBatch\(/, '内容必须走 catBatch(逐文件散写 git show 会在并行推进时产出自洽却错位的尺子)')
  assert.match(src, /from '\.\/lib\/code-mask\.mjs'/, '遮噪必须走 code-mask 那一份实现')
  assert.doesNotMatch(src, /\bmaskCommentsAndStrings\s*\(/, '本门判据需要看到字符串字面量,不得用连字符串一起抹的那档')
  assert.doesNotMatch(src, /function\s+(?:mask|strip|blank)Comments/, '不得在门体里再写一份遮噪状态机')
  assert.doesNotMatch(src, /process\.cwd\(\)/, 'ROOT 不得由 cwd 推导(扫哪棵树由调用者站哪决定 —— 守门 70 那一型)')
})

test('T9 跨文件锁:豁免族必须登记进守门 108 的存活期表且取 30 天', async () => {
  const mod = await import(pathToFileURL(EXPIRY).href)
  const table = mod.__test__?.FAMILY_LIFETIME_DAYS ?? mod.FAMILY_LIFETIME_DAYS
  assert.ok(table, '取不到守门 108 的 FAMILY_LIFETIME_DAYS(它改名了就要同步本锁)')
  assert.equal(
    Object.prototype.hasOwnProperty.call(table, FAMILY),
    true,
    `${FAMILY} 没进 FAMILY_LIFETIME_DAYS ⇒ 走默认档,而"没有到期档的豁免出口"等于无人看管的出口`,
  )
  assert.equal(table[FAMILY], FAMILY_DAYS, `${FAMILY} 的寿命档被改成了 ${table[FAMILY]},与本门头注不一致`)
})

test('T10 CLI 语义:两面旗同给判死;--self-test 跑完不得留残留', () => {
  const contradiction = spawnSync(process.execPath, [GATE, '--staged', '--worktree'], { encoding: 'utf8', timeout: 180000 })
  assert.equal(contradiction.status, 2, '两面旗同时给出必须 exit 2,而不是随便挑一面')
  const scratch = mkScratch('gate-cli')
  try {
    const self = spawnSync(process.execPath, [GATE, '--self-test'], { encoding: 'utf8', timeout: 300000, cwd: ROOT })
    assert.equal(self.status, 0, `--self-test 必须跑完且全绿:\n${self.stdout?.slice(-2500)}${self.stderr?.slice(-800)}`)
    assert.match(self.stdout, /--self-test: 全部通过/)
  } finally {
    rmScratch(scratch)
  }
})

test('T11 接线一致性:runner 里没这条注册时,门体头注不得声称已接提交链(守门 89 那一型)', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  const wired = runner.includes('check-error-code-not-text-matching.mjs')
  const src = readFileSync(GATE, 'utf8')
  if (!wired) {
    // 由主会话统一接线之前,本门不得在头注里写"已接 pre-commit / 第 N 项"——
    // 那是一句跑不通的出路,也正是守门 89 的 R1/R2 要拦的形态。
    assert.doesNotMatch(
      src,
      /(已接|已接入|挂在)\s*(pre-commit|pre-push|guardian)/,
      '门体声称已接线,但 guardian-runner 里没有这条注册',
    )
  } else {
    const entry = src.slice(0, 0) // 占位:真正接线的断言在下面按 runner 取条目
    assert.ok(entry !== null)
    const idx = runner.indexOf('check-error-code-not-text-matching.mjs')
    const around = runner.slice(Math.max(0, idx - 600), idx + 600)
    assert.match(around, /mode:\s*'blocking'/, '既已接线,定级就必须是 blocking(warn 的代价是"门判对了也没人被打断")')
    assert.match(around, /HUSKY_SKIP_ERROR_CODE_TEXT_MATCHING/, '接线必须带与本门头注一致的应急跳过变量')
    assert.match(around, /stagedTriggers/, '接线必须带 stagedTriggers,否则"只改文档的提交"根本不唤起本门')
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
