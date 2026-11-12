// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 319 —— ACP handler 的错误映射覆盖。
 *
 * ## 为什么需要这道门
 *
 * ACP SDK 对 handler 抛出的**普通 Error** 一律回 `-32603 Internal error`,
 * 且**不带 message**。于是客户端看到的只有"内部错误",无法区分
 * "会话不存在" / "参数非法" / "存储损坏" —— 三者的正确处置完全不同。
 *
 * 我方用 `rpcMethod()` 包装每个 handler,它内部走 `asRpcError` 把调用方类错误
 * 折成 `-32602 Invalid params` 并带上原因。
 *
 * **但没有任何机制保证新方法一定被包上。** 实测(2026-11-12):
 * server.ts 有 33 处 `.onRequest`,只有 20 处经过 `rpcMethod` —— 13 处漏了。
 * 其中 `x.ai/session/repair` / `x.ai/rewind/*` / `x.ai/mcp/*` 的 handler 会
 * 调 `requireSession()`,会话不存在时抛错 ⇒ 客户端收到 Internal error,
 * 完全不知道是会话 ID 错了。
 *
 * 这道门就是补那个缺失的机制。
 *
 * ## 判据
 *
 * 逐个 `.onRequest('method', ...)` 块检查 handler 是否调用 `rpcMethod(`。
 * 例外只允许**白名单内的标准方法**(它们由 SDK 内部处理,如 initialize 的
 * 握手错误本就该是 internal)。
 *
 * ## 失效方向
 *
 * 取不到 server.ts 或解析不出任何 onRequest ⇒ exit 2「未判定」,不记绿。
 */
import fs from 'node:fs'
import path from 'node:path'
// 判面层接线(门 312 R1):注册门必须经 face-reader 取材,不得自拼 git。
import './lib/face-reader.mjs'

const SERVER_REL = 'apps/cli/src/acp/server.ts'

/**
 * 允许不经过 rpcMethod 的方法。
 *
 * 只放标准 ACP 生命周期方法:它们的错误语义由 SDK 定义,
 * 且多数不涉及"调用方给错参数"这一类(握手/流式提示)。
 * **私有 x.ai/* 一律不放行** —— 那正是过去漏映射的地方。
 */
const ALLOWLIST = new Set([
  'initialize',
  'authenticate',
  'session/new',
  'session/load',
  'session/prompt',
  'session/cancel',
])

/**
 * 从源码抽取所有 onRequest 块及其是否包了 rpcMethod。
 *
 * 实现要点:onRequest 后面可能紧跟泛型参数(可跨多行),然后是方法名字面量,
 * 之后是 handler。用「下一个 .onRequest 或文件尾」作为块边界。
 */
export function scanHandlers(source) {
  const marks = []
  const re = /\.onRequest/g
  let m
  while ((m = re.exec(source)) !== null) marks.push(m.index)

  const out = []
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i]
    const end = i + 1 < marks.length ? marks[i + 1] : source.length
    const chunk = source.slice(start, end)
    const nameMatch = /'([^']+)'/.exec(chunk)
    const name = nameMatch ? nameMatch[1] : '(unparsed)'
    out.push({
      method: name,
      wrapped: chunk.includes('rpcMethod('),
    })
  }
  return out
}

export function findUnmapped(handlers, allowlist = ALLOWLIST) {
  return handlers
    .filter((h) => !h.wrapped && !allowlist.has(h.method))
    .map((h) => h.method)
}

function run(root) {
  let source
  try {
    source = fs.readFileSync(path.join(root, SERVER_REL), 'utf8')
  } catch (e) {
    console.error(`⏭  未判定:读不到 ${SERVER_REL}(${e.message})`)
    return 2
  }

  const handlers = scanHandlers(source)
  if (handlers.length === 0) {
    console.error(`⏭  未判定:${SERVER_REL} 里解析出 0 个 onRequest —— 结构变了,本门无法判定`)
    return 2
  }

  const unmapped = findUnmapped(handlers)
  if (unmapped.length > 0) {
    console.error(
      `🔌 守门 319 判红:${unmapped.length}/${handlers.length} 个 ACP handler 未经 rpcMethod() 包装 ——`,
    )
    console.error('   它们的错误会被 SDK 压成 -32603 Internal error 且丢失 message,')
    console.error('   客户端无法区分"会话不存在"与"内部故障"。')
    for (const n of unmapped) console.error(`   - 缺映射:${n}`)
    console.error(`   修法:把 handler 改成 (ctx) => rpcMethod((p) => agent.xxx(p))(ctx.params)`)
    return 1
  }

  console.log(`✅ 守门 319 pass:${handlers.length} 个 handler 均已过 rpcMethod(或属允许的标准方法)。`)
  return 0
}

function selfTest() {
  let ok = true
  const check = (name, cond) => {
    if (!cond) {
      console.error(`❌ 自检失败:${name}`)
      ok = false
    }
  }

  // A:全部包装 ⇒ 无缺
  const a = scanHandlers(`
    .onRequest('a', cast(), (ctx) => rpcMethod((p) => agent.a(p))(ctx.params))
    .onRequest('b', cast(), (ctx) => rpcMethod((p) => agent.b(p))(ctx.params))
  `)
  check('抽取 2 个', a.length === 2)
  check('全包装无缺', findUnmapped(a).length === 0)

  // B:漏一个 ⇒ 必须报缺
  const b = scanHandlers(`
    .onRequest('a', cast(), (ctx) => rpcMethod((p) => agent.a(p))(ctx.params))
    .onRequest('x.ai/leak', cast(), (ctx) => agent.leak(ctx.params))
  `)
  const missedB = findUnmapped(b)
  check('漏的必须报出', missedB.length === 1 && missedB[0] === 'x.ai/leak')

  // C:白名单内的不误报
  const c = scanHandlers(`.onRequest('initialize', h)`)
  check('白名单不误报', findUnmapped(c).length === 0)

  // D:私有方法即使名字像标准方法也不能放行
  const d = scanHandlers(`.onRequest('x.ai/session/repair', cast(), (ctx) => agent.r(ctx.params))`)
  check('x.ai/* 必须报缺', findUnmapped(d).length === 1)

  if (ok) console.log('✅ 守门 319 自检通过:抽取 / 报缺 / 白名单 / 私有方法不放行,四类逻辑均正确。')
  return ok ? 0 : 1
}

if (process.argv.includes('--self-test')) {
  process.exit(selfTest())
} else {
  const root = process.env.IHUI_GATE_ROOT ?? process.cwd()
  process.exit(run(root))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
