// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// 守门 317 —— ACP agent 方法注册完整性(blocking)。
//
// 设计原理:ACP SDK 对**未注册**的方法回 -32601(Method not found),与「根本没实现」
// 对客户端是同一个错误,调用方无法区分「方法不存在」与「实现了但忘了 .onRequest 注册」。
// 而类级单测直接调 agent.xxx(),结构上完全绕过注册表,发现不了漏注册。
// 所以必须有这道结构级守门:SDK 声明的 session/* 方法必须全部被 .onRequest /
// .onNotification 注册(私有 x.ai/* 扩展方法不在本门射程,本仓自主增减)。
//
// 判定:SDK AGENT_METHODS 声明的 session/* 方法集 与 createAcpAgent() 里实际注册集做差集。
//   - 差集非空 ⇒ exit 1 点名缺注册的方法(apps/cli/src/acp/server.ts 里补 .onRequest/.onNotification)。
//   - 取不到 server.ts 或 SDK 声明 ⇒ exit 2 未判定(§0.3,不记绿也不冒红)。
// 取材:apps/cli/src/acp/server.ts 走 face-reader 的判面 API(head/staged),
//   SDK 声明集硬编码自 @agentclientprotocol/sdk@1.3.0 schema/index.d.ts(源见 SDK_DECL 常量)。
// 判面:默认 head 面,--staged 判索引面,--worktree 仅人工逃生舱。
//
// 退出码:0=pass,1=breach(点名缺注册),2=undetermined(取不到源/SDK)。
//
import { selectFace, catBatch, readWorktreeFile, Undetermined } from './lib/face-reader.mjs'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const SERVER_REL = 'apps/cli/src/acp/server.ts'
// ACP agent 构造函数名。
// 2026-11-12 修正:此前写的是 'createAcpAgent',而 `apps/cli/src/acp/server.ts` 里真实的
// 导出函数是 `buildAcpAgentApp` —— 于是 `extractRegistered` 永远走 fnFound=false 分支、
// 本门常年返回 exit 2「未判定」,**从未真正校验过任何一次注册**。
// 这正是 §0.9「判据必须在真跑它的那一刻才成立」的反例:门在册、跑起来却什么都没判。
const AGENT_FN = 'buildAcpAgentApp'

// SDK AGENT_METHODS 声明的 session/* 方法全集(取自 @agentclientprotocol/sdk@1.3.0
// dist/schema/index.d.ts 的 AGENT_METHODS 导出;SDK 升级若增减 session/*,须同步本表)。
// 逐字对齐 SDK 的 AGENT_METHODS(见 @agentclientprotocol/sdk/dist/schema/index.d.ts 第 2-31 行)。
// 2026-11-12 修正:此前把 `session/request_permission` 与 `session/update` 也列进来,
// 但这两个是 **CLIENT_METHODS**(第 32 行起)—— 由 agent 主动向客户端请求/通知,
// 不该要求 agent 自己 .onRequest 注册。误列会让门永远判红,逼人跳过。
const SDK_DECL = Object.freeze([
  'session/new',
  'session/load',
  'session/set_mode',
  'session/set_config_option',
  'session/prompt',
  'session/cancel',
  'session/list',
  'session/delete',
  'session/fork',
  'session/resume',
  'session/close',
])

// CLIENT_METHODS 里的同名 session/* 方法:只用于"不误判"的排除集,不参与缺注册判定。
const CLIENT_DECL = Object.freeze(['session/request_permission', 'session/update'])

// 从 server.ts 源码抽取 createAcpAgent 函数体,收集其中注册的方法名。
function extractRegistered(txt) {
  // 允许 `export function` / `async function` / 前导注释等形态,不写死前缀。
  // 用字面量拼接而非模板正则:模板里 `\s` 会被当成普通字符 s(实测踩过),
  // 结果是构造出 `exports+` 这种永不匹配的表达式 —— 门会静默失效。
  const fnRe = new RegExp('(?:export\\s+)?(?:async\\s+)?function\\s+' + AGENT_FN + '\\s*\\(')
  const m = fnRe.exec(txt)
  if (!m) return { fnFound: false, registered: [] }
  const fnIdx = m.index
  // 取到函数体真实结尾(括号配平),不再用固定 4000 字符窗口 ——
  // 那个窗口只覆盖到注册链前段,后面新增的方法会被静默漏看。
  let depth = 0
  let started = false
  let end = txt.length
  for (let i = fnIdx; i < txt.length; i++) {
    const c = txt[i]
    if (c === '{') {
      depth++
      started = true
    } else if (c === '}') {
      depth--
      if (started && depth === 0) {
        end = i + 1
        break
      }
    }
  }
  const body = txt.slice(fnIdx, end)
  const registered = new Set()
  // 形态一:.onRequest('method', ...) / .onNotification('method', ...) —— 方法名紧跟
  const simple = /\.(onRequest|onNotification)\(\s*['"]([^'"]+)['"]/g
  for (const m of body.matchAll(simple)) registered.add(m[2])
  // 形态二:.onRequest<...>('method', ...) —— 泛型参数在方法名前(可跨行)
  const generic = /\.on(?:Request|Notification)<[^>]*>\(\s*['"]([^'"]+)['"]/g
  for (const m of body.matchAll(generic)) registered.add(m[1])
  return { fnFound: true, registered: [...registered] }
}

async function readSource(root, face, rel) {
  if (face === 'worktree') {
    const txt = await readWorktreeFile(root, rel)
    if (txt === null || txt === undefined) throw new Undetermined(`${rel}:worktree 面读不到`)
    return txt
  }
  const spec = face === 'head' ? `HEAD:${rel}` : `:${rel}`
  const out = await catBatch(root, [spec])
  const txt = out.get(spec)
  if (txt === null || txt === undefined) throw new Undetermined(`${rel}:${face} 面读不到`)
  return txt
}

// 纯断言核心(供 self-test 复用):声明集 vs 注册集 → 缺注册数组
export function missingRegistrations(decl, registered) {
  const have = new Set(registered)
  return decl.filter((m) => !have.has(m))
}

async function run(root, face) {
  let serverTxt
  try {
    serverTxt = await readSource(root, face, SERVER_REL)
  } catch (e) {
    console.error(`⏭  未判定:${e.message} —— 不记绿也不冒红(§0.3)`)
    return 2
  }
  const { fnFound, registered } = extractRegistered(serverTxt)
  if (!fnFound) {
    console.error(`⏭  未判定:${SERVER_REL} 里找不到 function ${AGENT_FN}() —— 结构变了,本门无法判定`)
    return 2
  }
  const missing = missingRegistrations(SDK_DECL, registered)
  if (missing.length) {
    console.error('🔌 守门 317 判红:ACP SDK 声明的 session/* 方法未全部注册 —— 未注册者对客户端回 -32601:')
    for (const m of missing) console.error(`   - 缺注册:${m}`)
    console.error(`   修法:在 ${SERVER_REL} 的 ${AGENT_FN}() 里补对应 .onRequest('${missing[0]}', ...) / .onNotification(...);`)
    console.error('   实现方法与注册是两件事,缺一不可(类级单测绕注册表发现不了漏注册)。')
    return 1
  }
  console.log(`✅ 守门 317 pass:SDK 声明的 session/* ${SDK_DECL.length} 个方法已全部在 ${AGENT_FN}() 注册。`)
  return 0
}

// —— 自检:用临时夹具验证「声明-注册差集」逻辑,不依赖真实文件。——
export function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g317-selftest-'))
  try {
    let ok = true
    if (missingRegistrations(['a', 'b'], ['a', 'b', 'c']).length !== 0) {
      console.error('❌ 自检 A 失败:全集已注册被误判有缺口'); ok = false
    }
    const miss = missingRegistrations(['a', 'b', 'c'], ['a', 'b'])
    if (miss.length !== 1 || miss[0] !== 'c') {
      console.error('❌ 自检 B 失败:缺注册未正确识别', miss); ok = false
    }
    const fake = `function ${AGENT_FN}(o){return acp.agent({}).onRequest('session/new',h).onRequest<Foo,Bar>(\n  'session/list',\n  cast(),h\n).onNotification('session/cancel',h)}`
    const r = extractRegistered(fake)
    if (!r.fnFound || !r.registered.includes('session/new') || !r.registered.includes('session/list') || !r.registered.includes('session/cancel')) {
      console.error('❌ 自检 C 失败:函数体抽取未同时识别简单与泛型两形态', r); ok = false
    }
    // 自检 D:函数体扫描必须覆盖**长函数体**,不能用固定字符窗口。
    // 2026-11-12 实测教训:原实现只取函数起始 4000 字符,而真实 server.ts 的注册链
    // 在 1800+ 行之后 —— 尾部新增的方法会被静默漏看(门判绿,实际漏注册)。
    const tailMarker = 'session/list'
    const longBody =
      `function ${AGENT_FN}(o){return acp.agent({})` +
      `.onRequest('session/new',h)` +
      // 中间塞 6000 字符的填充,把后面的注册推到原 4000 窗口之外
      `/*${'x'.repeat(6000)}*/` +
      `.onRequest('${tailMarker}',h)}`
    const longRes = extractRegistered(longBody)
    if (!longRes.registered.includes(tailMarker)) {
      console.error('❌ 自检 D 失败:函数体扫描未覆盖长函数体(固定窗口会漏掉尾部注册)'); ok = false
    }

    // 自检 E:函数名不符时必须**判未判定**(而不是静默判绿)。
    const wrongName = extractRegistered(`function createAcpAgent(o){return x}`)
    if (wrongName.fnFound !== false) {
      console.error('❌ 自检 E 失败:函数名不符却报告找到了'); ok = false
    }

    // 自检 F:CLIENT_METHODS 的 session/* 不得进入缺注册判定(否则门永远红、逼人跳过)。
    const clientLeak = CLIENT_DECL.filter((m) => SDK_DECL.includes(m))
    if (clientLeak.length !== 0) {
      console.error('❌ 自检 F 失败:client 侧方法被混进 agent 声明集', clientLeak); ok = false
    }

    if (ok) console.log('✅ 守门 317 自检通过:差集 / 长函数体抽取 / 函数名不符判未判定 / client 方法不误判,四类逻辑均正确。')
    return ok ? 0 : 1
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  let root
  try {
    root = process.cwd()
    await catBatch(root, [])
  } catch (e) {
    console.error(`⏭  未判定:定位仓库根失败(${e.message})`)
    return 2
  }
  let face = 'head'
  try {
    const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
    if (picked.error) { console.error(`⏭  ${picked.error} —— 两面同给 = 判死`); return 2 }
    face = picked.face
  } catch (e) {
    console.error(`⏭  未判定:判面选择失败(${e.message})`)
    return 2
  }
  return run(root, face)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main(process.argv.slice(2)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
