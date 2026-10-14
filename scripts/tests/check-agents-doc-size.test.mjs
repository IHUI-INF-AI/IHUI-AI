// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/check-agents-doc-size.mjs(§22c:只 import 生产判据,不在测试里复制阈值/算法)。
//
// 为什么必须有:本门判的是"每轮注入面有多大"这种只有数字的东西,算错的表现不是报错,
// 而是一行看起来正常的 `✅ … 字节(预算 …)` —— 即本仓最高频失效型"数字在、口径错"。
// 三条最容易静默失效的口径在此钉死:①按 UTF-8 字节而不是字符(CJK 1 字符=3 字节,按字符计
// 会把 1.26 MB 的巨型文件量成"四折"预算内);②取不到面必须返回 null 让调用方 exit 2,
// 绝不返回 over:false 冒充判绿(§0.3);③注册条目一旦存在,mode 与 skipEnv 必须成套
// (声明了跳过变量却没接进 runner = 假逃生舱,本仓 44/30a 两枚门都踩过)。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const SRC = resolve(fileURLToPath(import.meta.url), '../../check-agents-doc-size.mjs')
const SRC_TEXT = readFileSync(SRC, 'utf8')
const { __test__ } = await import(pathToFileURL(SRC).href)

test('判据出口齐备(镜像只 import,不复制实现)', () => {
  assert.equal(typeof __test__.judgeSize, 'function')
  assert.equal(__test__.FILE, 'AGENTS.md')
  assert.equal(typeof __test__.BUDGET_BYTES, 'number')
  assert.ok(__test__.BUDGET_BYTES > 0)
})

test('预算内判绿 / 超限判红', () => {
  assert.equal(__test__.judgeSize('a'.repeat(10), 'head', 100).over, false)
  assert.equal(__test__.judgeSize('a'.repeat(101), 'head', 100).over, true)
  assert.equal(__test__.judgeSize('a'.repeat(100), 'head', 100).over, false, '恰好等于预算不得算超')
})

test('按 UTF-8 字节量纲,不按字符数(CJK 每字 3 字节)', () => {
  const v = __test__.judgeSize('啊'.repeat(34), 'head', 100)
  assert.equal(v.bytes, 102, '34 个 CJK 字符 = 102 字节,不是 34')
  assert.equal(v.over, true, '若按字符量纲这里会被错判成预算内')
})

test('取不到面 ⇒ null(不冒充"判过",更不记绿)', () => {
  for (const missing of [null, undefined, 0, '']) {
    if (missing === '') continue
    assert.equal(__test__.judgeSize(missing, 'head'), null, `收到 ${String(missing)} 必须判不出`)
  }
  assert.equal(__test__.judgeSize('', 'head').bytes, 0, '空字符串是取得到的面,判 0 字节')
})

test('头注与注册面成套:未注册不谎称已接,已注册则 mode+skipEnv 齐备(§22c 形态锁)', () => {
  // 装车证明**必须读 HEAD 面 runner**,不能读工作树副本 —— 注册走 object-space-land 时只推进
  // HEAD+索引、从不写盘,盘上那份实测会滞后到某个祖先形态;按盘上判就把"已接线"读成"没接线",
  // 于是本断言反向指着一份真实合规的头注报假红(AGENTS §22c 形态锁原话点名的就是这一格)。
  const runnerText = execFileSync('git', ['show', 'HEAD:scripts/guardian-runner.mjs'], {
    encoding: 'utf8',
    maxBuffer: 2e8,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const registered = runnerText.includes("script: 'check-agents-doc-size.mjs'")
  if (!registered) {
    assert.doesNotMatch(SRC_TEXT, /已接提交链/, '未注册的头注不能宣称已接线(守门 89 R1/R2)')
    assert.doesNotMatch(SRC_TEXT, /跳过 `?HUSKY_SKIP_[A-Z_]+/, '未注册时不得承诺一个 runner 里不存在的跳过变量(假逃生舱)')
  } else {
    const i = runnerText.indexOf("script: 'check-agents-doc-size.mjs'")
    const entry = runnerText.slice(i - 200, i + 400)
    assert.match(entry, /mode: '(warn|blocking)'/, '注册条目必须定级')
    assert.match(entry, /skipEnv: '[A-Z_]+/, '注册条目必须声明成套的跳过变量')
    assert.match(entry, /args: \[\]/, '注册条目必须带 args —— 执行循环是 [...check.args] 展开,缺它 runner 当场 TypeError')
    assert.match(entry, /id: '207'/, '注册条目必须带单引号 id(双引号形态对按单引号解析的判据隐身)')
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
