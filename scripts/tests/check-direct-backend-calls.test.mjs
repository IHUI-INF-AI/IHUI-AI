// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// AGENTS.md §22c:测试直接 import 源脚本导出的 __test__,不复制判据(镜像常量必然漂移)。
// 运行:node --test scripts/tests/check-direct-backend-calls.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-direct-backend-calls.mjs'

const run = (files) => gate.analyzeCorpus(new Map(Object.entries(files)))

/** 注入样本:端内新增 Taro.request({ url: `${BASE_URL}/...` }) —— 必须被判违规 */
const INJECTION = {
  'apps/miniapp-taro/src/utils/api-config.ts': `export const BASE_URL = 'http://localhost:8802/api'\n`,
  'apps/miniapp-taro/src/pages/injected/index.tsx':
    "import Taro from '@tarojs/taro'\nimport { BASE_URL } from '@/utils/api-config'\nexport function send() {\n  return Taro.request({ url: `${BASE_URL}/brand-new-endpoint`, method: 'POST' })\n}\n",
}

test('注入「端内 Taro.request + BASE_URL 拼接」判为绕过(有效性第二证)', () => {
  const { hits } = run(INJECTION)
  assert.equal(hits.length, 1, JSON.stringify(hits.map((h) => `${h.file}:${h.line}`)))
  assert.match(hits[0].file, /pages\/injected\/index\.tsx$/)
  assert.equal(hits[0].line, 4)
  assert.equal(hits[0].kind, 'miniapp-request')
  assert.match(hits[0].evidence, /后端基址符号/)
})

/** 反例:§3 允许的平台 adapter(从 @ihui/api-client import 契约 + 被 setTransport 注册) */
const TRANSPORT = {
  'apps/miniapp-taro/src/utils/api-client-transport.ts':
    "import Taro from '@tarojs/taro'\nimport type { Transport, TransportResponse } from '@ihui/api-client'\nexport function createTaroTransport(): Transport {\n  return (url, init) =>\n    new Promise((resolve) => {\n      Taro.request({ url, method: 'GET', success: (res) => resolve(res) })\n    })\n}\n",
  'apps/miniapp-taro/src/app.tsx':
    "import { setBaseUrl, setTransport } from '@ihui/api-client'\nimport { createTaroTransport } from '@/utils/api-client-transport'\nsetBaseUrl('http://localhost:8802/api')\nsetTransport(createTaroTransport())\n",
}

test('合规 Transport 适配器判为不违规,且豁免理由是 setTransport 注册证据(有效性第三证)', () => {
  const { hits, exempt, transports } = run(TRANSPORT)
  assert.deepEqual(hits.map((h) => h.file), [], `不该有命中: ${JSON.stringify(hits)}`)
  assert.equal(exempt.length, 1)
  assert.match(exempt[0].file, /api-client-transport\.ts$/)
  assert.match(exempt[0].reason, /setTransport\(@ihui\/api-client\) 注册/)
  assert.ok(transports.has('apps/miniapp-taro/src/utils/api-client-transport.ts'))
})

test('豁免判据不吃文件名:同名文件未被 setTransport 注册时,污点 URL 照样判违规', () => {
  const files = {
    'apps/miniapp-taro/src/utils/api-client-transport.ts':
      "import Taro from '@tarojs/taro'\nexport function ping() {\n  return Taro.request({ url: `${'http://localhost:8802/api'}/ping`, method: 'GET' })\n}\n",
  }
  const { hits, exempt } = run(files)
  assert.equal(exempt.length, 0)
  assert.equal(hits.length, 1)
})

test('同名 React useState setTransport 不构成豁免证据(mcp-manager 真实形态)', () => {
  const { exempt } = run(gate.fixtures.fakeTransport)
  assert.equal(exempt.length, 0)
})

/** sse.ts 形态:函数自身不含基址符号,污点从跨文件调用方灌进形参 */
const PARAM_FLOW = {
  'apps/miniapp-taro/src/lib/sse.ts':
    "export async function streamSSE(options) {\n  const { url } = options\n  const res = await fetch(url, { method: 'POST' })\n  return res\n}\n",
  'apps/miniapp-taro/src/api/index.ts':
    "import { streamSSE } from '@/lib/sse'\nimport { BASE_URL } from '@/utils/api-config'\nexport async function chatStream() {\n  await streamSSE({ url: BASE_URL + '/ai/chat/stream', body: {} })\n}\n",
  'apps/miniapp-taro/src/utils/api-config.ts': `export const BASE_URL = 'http://localhost:8802/api'\n`,
}

test('跨文件回溯:调用方用 BASE_URL 拼 url 传给导出函数 ⇒ 函数内裸 fetch 判违规', () => {
  const { hits } = run(PARAM_FLOW)
  assert.equal(hits.length, 1, JSON.stringify(hits.map((h) => `${h.file}:${h.line}`)))
  assert.match(hits[0].file, /lib\/sse\.ts$/)
  assert.equal(hits[0].line, 3)
  assert.match(hits[0].evidence, /调用方 .*api\/index\.ts/)
})

test('第三方 IdP 的 https://discord.com/api/v10/... 不判为本仓后端', () => {
  const { hits } = run(gate.fixtures.thirdParty)
  assert.deepEqual(hits.map((h) => h.file), [])
})

test('文档示例模板字符串里的 fetch 不是调用点(SdkExamples 真实误伤回归)', () => {
  const { hits } = run(gate.fixtures.docSample)
  assert.deepEqual(hits.map((h) => `${h.file}:${h.line}`), [], JSON.stringify(hits))
})

test('注释里的 fetch(BASE_URL) 不判命中', () => {
  const { hits } = run({
    'apps/x-app/src/a.ts':
      "import { BASE_URL } from '@/cfg'\n// fetch(`${BASE_URL}/ghost`)\nexport const x = 1\n/* fetch('/api/ghost2') */\n",
    'apps/x-app/src/cfg.ts': `export const BASE_URL = '/api'\n`,
  })
  assert.deepEqual(hits.map((h) => `${h.file}:${h.line}`), [])
})

test('scanCode 保行号:输出与输入等长且换行数相同(命中行号可信的前提)', () => {
  const src = "const a = 1 // c\n/* b\nlock */ const b = 2\n"
  const { code } = gate.scanCode(src)
  assert.equal(code.length, src.length)
  assert.equal((code.match(/\n/g) || []).length, (src.match(/\n/g) || []).length)
  const oneLine = gate.stripComments('fetch(1) // fetch(2)')
  assert.equal(oneLine.length, 'fetch(1) // fetch(2)'.length)
  assert.equal(oneLine.trimEnd(), 'fetch(1)')
})

test('调用点提取:对象式 url 属性 / 简写 / 首位置参数都能取到 URL 表达式', () => {
  const obj = gate.findCallSites("Taro.request({ url: `/api/a`, method: 'GET' })")
  assert.equal(obj.length, 1)
  assert.equal(obj[0].urlExpr, '`/api/a`')
  const short = gate.findCallSites("Taro.request({ url, method: 'GET' })")
  assert.equal(short[0].urlExpr, 'url')
  const pos = gate.findCallSites("fetch(`/api/b`, { method: 'POST' })")
  assert.equal(pos[0].urlExpr, '`/api/b`')
  // fetchApi / 带前缀名不算裸 fetch
  assert.equal(gate.findCallSites('fetchApi(`/api/c`)').length, 0)
  assert.equal(gate.findCallSites('httpClient.fetch(`/api/c`)').length, 1)
})

test('Next 自有路由:apps/web 同源 /api/<seg> 且 app/api/<seg>/route.ts 真实存在时判为自有路由', () => {
  const expr = "`/api/desktop-feed?x=1`"
  const real = gate.surfaceTaint(expr, 'apps/web/src/lib/x.ts', new Set(['desktop-feed']))
  assert.equal(real.tainted, false)
  assert.match(real.evidence, /自有路由/)
  const proxied = gate.surfaceTaint(expr, 'apps/web/src/lib/x.ts', new Set(['other']))
  assert.equal(proxied.tainted, true)
  // 非 web 端不给自有路由豁免(只有 apps/web 有 Next route handler)
  const nonWeb = gate.surfaceTaint(expr, 'apps/cli/src/x.ts', new Set(['desktop-feed']))
  assert.equal(nonWeb.tainted, true)
})

test('resolveSpecifier 必须做存在性校验(@/lib/sse 要落到 .ts,不能返回无扩展名路径)', () => {
  const exists = new Set(['apps/demo/src/lib/sse.ts'])
  assert.equal(
    gate.resolveSpecifier('@/lib/sse', 'apps/demo/src/api/index.ts', (p) => exists.has(p)),
    'apps/demo/src/lib/sse.ts',
  )
  assert.equal(gate.resolveSpecifier('@/lib/sse', 'apps/demo/src/api/index.ts', () => false), null)
  assert.equal(
    gate.resolveSpecifier('@ihui/api-client', 'apps/demo/src/app.tsx', () => true),
    null,
    '外部包名不得被解析成仓内文件',
  )
})

test('扫描面按角色排除:apps/api(后端本体)/ apps/ai-service(Python)/ packages/api-client(通道本身)', () => {
  assert.deepEqual(gate.excludedWorkspaces().sort(), [
    'apps/ai-service',
    'apps/api',
    'packages/api-client',
  ])
})

test('基线指纹对空白不敏感,但换 URL 就换 key(改动既有绕过点必须重新 review)', () => {
  const a = gate.baselineKey('apps/web/src/a.ts', 'fetch', 'fetch(  `/api/a`   )')
  const b = gate.baselineKey('apps/web/src/a.ts', 'fetch', 'fetch( `/api/a` )')
  const c = gate.baselineKey('apps/web/src/a.ts', 'fetch', 'fetch(`/api/b`)')
  assert.equal(a, b)
  assert.notEqual(a, c)
})

test('源脚本内建自检全部通过', () => {
  assert.equal(gate.selfTest(), true)
})

// ──────────────────────────────────────────────────────────────────────────────
// 2026-09-28:`--json` 的取值判据 + stdout 档路由(同形缺陷第二处,口径照第一处 scan-hardcoded-zh)。
// 判据本体不在此复制:取值走 gate.flagValue、路由走 gate.emitHuman、端到面走 gate.main(注入语料)。
// ──────────────────────────────────────────────────────────────────────────────

const SRC = readFileSync(new URL('../check-direct-backend-calls.mjs', import.meta.url), 'utf8')

/** 抓一次调用的 stdout / stderr(node:test 自己的输出不经 console.*,故可安全换钩子) */
const capture = (fn) => {
  const out = []
  const err = []
  const origLog = console.log
  const origErr = console.error
  console.log = (...a) => out.push(a.join(' '))
  console.error = (...a) => err.push(a.join(' '))
  try {
    return { rc: fn(), out: out.join('\n'), err: err.join('\n') }
  } finally {
    console.log = origLog
    console.error = origErr
  }
}

const mainWith = (dir, argvList) =>
  capture(() =>
    gate.main({
      root: dir,
      argv: argvList,
      corpus: new Map(Object.entries(INJECTION)),
    }),
  )

test('flagValue 判据:下一个 token 不存在 / 以 - 开头 ⇒ 不算值;合法值仍算路径(正反成对)', () => {
  // runner 给每道门追加 --staged,所以 `--json --staged` 的"值"必须是 null,否则就在扫描根
  // 写出一个名叫 --staged 的文件(§28 禁止的仓库根非法条目)。
  assert.equal(gate.flagValue(['--json', '--staged'], '--json'), null)
  assert.equal(gate.flagValue(['--json'], '--json'), null)
  assert.equal(gate.flagValue(['--json', '--', 'x.json'], '--json'), null)
  assert.equal(gate.flagValue([], '--json'), null)
  assert.equal(gate.flagValue(['--staged', '--json', 'out.json'], '--json'), 'out.json')
})

test('emitHuman 路由:JSON-stdout 档把人读文本挪出 stdout;其余档 stdout 行为一字未变', () => {
  const asStdoutMode = capture(() => gate.emitHuman(true, '人读文本'))
  assert.equal(asStdoutMode.out, '')
  assert.match(asStdoutMode.err, /人读文本/)
  const asHumanMode = capture(() => gate.emitHuman(false, '人读文本'))
  assert.equal(asHumanMode.err, '')
  assert.match(asHumanMode.out, /人读文本/)
})

test('(a) --json --staged:不产出任何文件 + stdout 单独可 JSON.parse + 说明行走 stderr', () => {
  const dir = mkScratch('dbc-json-flag')
  try {
    const r = mainWith(dir, ['--json', '--staged'])
    assert.equal(existsSync(join(dir, '--staged')), false, '扫描根不得长出名叫 --staged 的文件')
    assert.equal(existsSync(join(process.cwd(), '--staged')), false, '当前工作目录同样不得长出该文件')
    assert.equal(existsSync(join(process.cwd(), 'report.json')), false)
    const parsed = JSON.parse(r.out) // 抛错即证明 stdout 被人读文本污染
    assert.equal(typeof parsed.total, 'number')
    assert.equal(parsed.total, run(INJECTION).hits.length, 'stdout 档的结论必须与判据实算一致')
    assert.match(r.err, /JSON 报告已打到 stdout/)
    assert.match(r.err, /要写文件请用 --json <路径>/)
  } finally {
    rmScratch(dir)
  }
})

test('(b) --json <真路径>:文件真写出且可 parse,人读 stdout 未被删掉', () => {
  const dir = mkScratch('dbc-json-file')
  try {
    const r = mainWith(dir, ['--json', 'report.json'])
    const p = join(dir, 'report.json')
    assert.equal(existsSync(p), true, '文件档必须仍然落盘(不得为修 stdout 档而删掉文件档)')
    const parsed = JSON.parse(readFileSync(p, 'utf8'))
    assert.equal(parsed.total, run(INJECTION).hits.length)
    assert.equal(parsed.scannedFiles, Object.keys(INJECTION).length)
    assert.match(r.err, /JSON 报告已写入文件/)
    // 文件档的 stdout 与改动前同形:仍是人读汇总 + 结论行,不含 JSON 正文
    assert.match(r.out, /扫了 \d+ 个源文件/)
    assert.doesNotMatch(r.out, /scannedFiles/)
  } finally {
    rmScratch(dir)
  }
})

test('(d) 非法值不得静默回落:与合法值档成对,且 stdout 档自己报名', () => {
  const dir = mkScratch('dbc-json-pair')
  try {
    const legal = mainWith(dir, ['--json', 'x.json'])
    assert.equal(existsSync(join(dir, 'x.json')), true)
    assert.doesNotMatch(legal.err, /JSON 报告已打到 stdout/)
    // 值是另一个旗标 ⇒ 既不写文件,也不"什么都不说":必须点名自己走的是 stdout 档
    const illegal = mainWith(dir, ['--json', '--json'])
    assert.equal(existsSync(join(dir, '--json')), false)
    assert.equal(existsSync(join(dir, 'y.json')), false)
    assert.doesNotMatch(illegal.out, /x\.json/)
    JSON.parse(illegal.out)
    assert.match(illegal.err, /JSON 报告已打到 stdout/)
  } finally {
    rmScratch(dir)
  }
})

test('(c) 源码形状锁:jsonOut 不得回到裸 argv[indexOf+1] 形态,且共享出口真被两处调用', () => {
  // 形状锁判的是**代码面**:本文件头注里"旧写法长什么样"的说明也带那几个执行性字符,
  // 按原文判就是把解释自己的散文判成违规(守门 131 / JSONC 注释同型坑)。
  const LOCK_RE = /localArgv\[localArgv\.indexOf\('--json'\) \+ 1\]/
  const codeOnly = gate.stripComments(SRC)
  const oldShapeLine = "    jsonOut: localArgv[localArgv.indexOf('--json') + 1] ?? null,"
  assert.match(oldShapeLine, LOCK_RE) // 锁有牙:旧形态确实会被点名,否则这条断言永远绿
  // 只判代码面 ⇒ 头注里那句"旧写法是 …"(SRC 第 1006 行附近)不参与判定,不会被误判成违规。
  assert.doesNotMatch(codeOnly, LOCK_RE)
  assert.match(codeOnly, /const jsonOut = flagValue\(localArgv, '--json'\)/)
  assert.match(codeOnly, /const jsonStdout = flags\.has\('--json'\) && jsonOut === null/)
  // 定义 1 + 调用 2:早退与主报告各调一次。只留函数不接线 = 门对该形态全盲(守门 70/76/81 同型)。
  const emitCalls = (SRC.match(/emitJsonReport\(/g) || []).length
  assert.ok(emitCalls >= 3, `emitJsonReport 应至少"1 定义 + 2 调用",现测 ${emitCalls}`)
  const payloadCalls = (SRC.match(/buildJsonPayload\(/g) || []).length
  assert.ok(payloadCalls >= 3, `buildJsonPayload 应至少"1 定义 + 2 调用",现测 ${payloadCalls}`)
  const routed = (SRC.match(/\n\s+jsonStdout,/g) || []).length
  assert.ok(routed >= 2, `两处 report() 调用点都要带上 jsonStdout,现测 ${routed}`)
})
