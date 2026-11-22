// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面宿主与 page_* 族的清单/接线对账(2026-09-25 立)
//
// 为什么需要这一条:page_* 族的清单散在五个面(共享契约 / 契约类型 / 服务端注册 / web 携带 /
// 扩展申报),而漂移的症状全是**静默**的 —— 服务端注册了而客户端不带,模型永远看不见;
// 端申报了而服务端没注册,指令发不出去。更要紧的是第二件事:桌面端要不要成为这一族的执行宿主
// 是个已经实测过的问题(见 docs/runtime-capability-disclosure.md 的桌面一节),它的结论是
// "接线三条件当前不成立 ⇒ 桌面不得申报"。没有机器判据时,这个结论要么被重复调研,要么被
// 一个"先挂个壳"的提交悄悄推翻 —— 壳最坏的地方是它让调用方以为能力存在。
// 所以本文件把结论写成**双向不变量**:申报 ⟺ 接线,两个方向各有一条会红的臂。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf-8')

// ---------------------------------------------------------------------------
// 清单提取(每个面一个解析器;解析不到就抛,不静默返回空集 —— 空集会让对账恒绿)
// ---------------------------------------------------------------------------

/** 从 `[...]` / `(...)` 字面量里取字符串成员;取不到成员即抛(防空转)。 */
function stringItems(source, opener, closer, label) {
  const start = source.indexOf(opener)
  if (start < 0) throw new Error(`${label}: 找不到 ${opener}`)
  const rest = source.slice(start + opener.length)
  const end = rest.indexOf(closer)
  if (end < 0) throw new Error(`${label}: ${opener} 未闭合`)
  const items = [...rest.slice(0, end).matchAll(/['"]([a-z_]+)['"]/g)].map((m) => m[1])
  if (items.length === 0) throw new Error(`${label}: 字面量里一个成员都没解析到,判据失效`)
  return items
}

/** 契约真相源:@ihui/dom-actions 的 PAGE_ACTIONS。 */
function contractVerbs() {
  const src = read('packages/dom-actions/src/page-snapshot/contract.ts')
  // 从 `= [` 起切,否则 `readonly PageActionType[]` 里的那个方括号会被当成数组开头
  const at = src.indexOf('export const PAGE_ACTIONS')
  const open = src.indexOf('= [', at)
  if (at < 0 || open < 0) throw new Error('contract.ts: 没有 PAGE_ACTIONS 数组字面量')
  return stringItems(src.slice(open + 2), '[', ']', 'PAGE_ACTIONS')
}

/** 契约类型面:packages/types 的 BrowserPageControlActionType 联合。 */
function typeUnionVerbs() {
  const src = read('packages/types/src/agent-control.ts')
  const at = src.indexOf('export type BrowserPageControlActionType')
  if (at < 0) throw new Error('agent-control.ts: BrowserPageControlActionType 被搬走了')
  // 只取到下一条 export 之前,避免把别处的字符串成员扫进来
  const next = src.indexOf('\nexport ', at + 10)
  return [...src.slice(at, next < 0 ? undefined : next).matchAll(/\|\s*'([a-z_]+)'/g)].map((m) => m[1])
}

/** 服务端注册面:page_control_bridge.py 的 PAGE_CONTROL_VERBS + 工具名前缀。 */
function serverVerbs() {
  const src = read('apps/ai-service/app/services/page_control_bridge.py')
  const at = src.indexOf('PAGE_CONTROL_VERBS')
  const open = src.indexOf('= (', at)
  if (at < 0 || open < 0) throw new Error('page_control_bridge.py: 没有 PAGE_CONTROL_VERBS 元组字面量')
  const verbs = stringItems(src.slice(open + 2), '(', ')', 'PAGE_CONTROL_VERBS')
  const prefix = /_TOOL_NAME_PREFIX\s*=\s*"([^"]+)"/.exec(src)?.[1]
  assert.ok(prefix, 'page_control_bridge.py: _TOOL_NAME_PREFIX 解析不到 ⇒ 工具名面无法对账')
  return { verbs, prefix }
}

/** web 携带面:tool-config.ts 的 BROWSER_PAGE_CONTROL_TOOLS。 */
function webCarriedTools() {
  const src = read('apps/web/src/hooks/use-chat/tool-config.ts')
  const at = src.indexOf('export const BROWSER_PAGE_CONTROL_TOOLS')
  if (at < 0) throw new Error('tool-config.ts: BROWSER_PAGE_CONTROL_TOOLS 被搬走了')
  return stringItems(src.slice(at), '[', ']', 'BROWSER_PAGE_CONTROL_TOOLS')
}

// ---------------------------------------------------------------------------
// 双向差集(纯函数):任一侧多报都必须是红,不是"取交集继续跑"
// ---------------------------------------------------------------------------

/**
 * 两条清单互比。两侧都可能多报,所以两侧都要有牙:
 * - 契约多出来 ⇒ 消费侧没跟上(注册了/带着的名字不对齐,模型看见一个跑不动的工具)
 * - 消费侧多出来 ⇒ 契约里没有这个动词(端侧执行体收不到,或按未知动词 fail)
 */
function diffVerbs(contract, other, otherLabel) {
  const missingOnOther = contract.filter((v) => !other.includes(v))
  const extraOnOther = other.filter((v) => !contract.includes(v))
  const problems = []
  if (missingOnOther.length > 0) problems.push(`${otherLabel} 缺 ${missingOnOther.join(', ')}`)
  if (extraOnOther.length > 0) problems.push(`${otherLabel} 多报 ${extraOnOther.join(', ')}`)
  return problems
}

// ---------------------------------------------------------------------------
// 桌面宿主的接线三条件(按当次源码实测,不抄文档)
// ---------------------------------------------------------------------------

const DESKTOP_ENDPOINT = 'desktop'

/** W1 服务端反向闸是否认桌面端申报(只认 extension 时,桌面申报永远打不开模型可见面)。 */
function gateAcceptsDesktop() {
  const src = read('apps/ai-service/app/services/control_autonomy.py')
  const at = src.indexOf('def _page_family_declared')
  if (at < 0) throw new Error('control_autonomy.py: 找不到 _page_family_declared(闸改名了,须同步本判据)')
  const body = src.slice(at, src.indexOf('\nasync def ', at) > 0 ? src.indexOf('\nasync def ', at) : undefined)
  return body.includes(`"${DESKTOP_ENDPOINT}"`)
}

/** W2 api 择端表:本族所用 category 是否被路由到桌面端。 */
function categoryRoutesToDesktop() {
  const py = read('apps/ai-service/app/services/page_control_bridge.py')
  const category = /_CATEGORY\s*=\s*"([^"]+)"/.exec(py)?.[1]
  assert.ok(category, 'page_control_bridge.py: _CATEGORY 解析不到')
  const api = read('apps/api/src/routes/agent-control.ts')
  const table = api.slice(api.indexOf('const CATEGORY_ENDPOINT'), api.indexOf('CATEGORY_LABEL'))
  const mapped = new RegExp(`\\b${category}\\s*:\\s*'([a-z]+)'`).exec(table)?.[1]
  assert.ok(mapped, `agent-control.ts: CATEGORY_ENDPOINT 里找不到 category '${category}' 的映射`)
  return mapped === DESKTOP_ENDPOINT
}

/** W3 桌面消费端是否真的把这一族交给共享包执行(而不是自己拼一份)。 */
function desktopExecutesPageFamily() {
  const src = read('apps/web/src/hooks/use-agent-control.ts')
  return /@ihui\/dom-actions/.test(src) && /\brunPageAction\b|\bexecuteDomAction\b/.test(src)
}

/** 申报面:桌面 capability 里是否出现 browserPageActions。 */
function desktopDeclaresPageFamily() {
  return /browserPageActions/.test(read('apps/web/src/hooks/use-agent-control.ts'))
}

// ===========================================================================
// 用例
// ===========================================================================

test('判据本身有牙:两侧任一多报都判红(契约多报不能只被"忽略")', () => {
  const contract = ['page_snapshot', 'page_click']
  assert.deepEqual(diffVerbs(contract, contract, 'same'), [])
  assert.deepEqual(diffVerbs(contract, ['page_snapshot'], '少一侧'), ['少一侧 缺 page_click'])
  assert.deepEqual(diffVerbs(contract, [...contract, 'page_zoom'], '多一侧'), [
    '多一侧 多报 page_zoom',
  ])
  // 契约加一条而消费侧没跟上 ⇒ 必须红(这正是历史上"注册了但没人执行"的形状)
  assert.deepEqual(diffVerbs([...contract, 'page_new'], ['page_snapshot', 'page_click'], '消费侧'), [
    '消费侧 缺 page_new',
  ])
})

test('page_* 清单:契约 ↔ 类型 ↔ 服务端 ↔ web 携带面逐字同(含前缀换算)', () => {
  const contract = contractVerbs()
  assert.deepEqual(typeUnionVerbs(), contract, 'packages/types 的联合与契约不同形')

  const { verbs, prefix } = serverVerbs()
  assert.deepEqual(verbs, contract, 'page_control_bridge.py 的动词清单与契约不同形')
  assert.deepEqual(
    contract.map((v) => `${prefix}${v}`),
    webCarriedTools(),
    `web 携带的 ${prefix}* 工具名与服务端注册名不同形`,
  )
  assert.equal(contract.length, 7, '契约动词数变了要同步本条与披露文档的桌面一节')
})

test('申报面与执行面同源:扩展不得手抄第二份清单,也不得自拼注入表达式', () => {
  const bridge = read('apps/extension/lib/agent-control-bridge.ts')
  assert.match(
    bridge,
    /const BROWSER_PAGE_ACTIONS: BrowserPageControlActionType\[\] = \[\.\.\.PAGE_ACTIONS\]/,
    '扩展申报面必须逐字派生自 PAGE_ACTIONS,不得回退成手抄清单',
  )
  const adapter = read('apps/extension/lib/page-snapshot-adapter.ts')
  assert.match(
    adapter,
    /export \{ buildPageApiInstallExpression \}/,
    '注入表达式只能 re-export 共享包的唯一装配入口',
  )
  for (const [file, src] of [
    ['apps/extension/lib/page-snapshot-adapter.ts', adapter],
    ['apps/extension/lib/agent-control-bridge.ts', bridge],
    ['apps/web/src/hooks/use-agent-control.ts', read('apps/web/src/hooks/use-agent-control.ts')],
  ]) {
    assert.ok(
      !/\(\s*pageApiInstallerSource\(\)\s*\)\s*\(/.test(src),
      `${file}: 端内不得把安装函数源直接拼成表达式 —— 必须走 buildPageApiInstallExpression()`,
    )
  }
})

test('桌面宿主:申报 ⟺ 接线三条件,两个方向都会红(不为凑票挂壳,也不让闸开了没人接)', () => {
  const declared = desktopDeclaresPageFamily()
  const w1 = gateAcceptsDesktop()
  const w2 = categoryRoutesToDesktop()
  const w3 = desktopExecutesPageFamily()
  const wired = w1 && w2 && w3

  if (declared && !wired) {
    assert.fail(
      `桌面申报了 browserPageActions 但接线未齐(闸认端=${w1} / category→desktop=${w2} / 端内执行体=${w3})` +
        ` —— 壳会让调用方以为能力存在,而实际只会换来 TARGET_NOT_CONNECTED`,
    )
  }
  if (wired && !declared) {
    assert.fail(
      '桌面接线三条件已全部成立却仍未申报/未接执行体 —— 能力造好没装车,请补申报与宿主 adapter',
    )
  }
  // 未接线时,披露文档必须把桌面写成"未开启"(文档与机器判据不得各说一套)
  const doc = read('docs/runtime-capability-disclosure.md')
  if (!wired) {
    assert.match(doc, /桌面[^\n]*page_[^\n]*(未开启|不开启)|page_[^\n]*在桌面[^\n]*(未开启|不开启)/, '披露文档未如实登记桌面 page_* 状态')
  }
  assert.ok(
    !read('apps/web/src/hooks/use-agent-control.ts').includes('browserPageActions'),
    '当前实测:桌面端不申报这一族(接线未齐,见披露文档桌面一节)',
  )
})

test('桌面注入通道与回执通道都在位(可行性实测的静态侧证)', () => {
  const rust = read('apps/desktop/src-tauri/src/auto_refresh.rs')
  assert.match(rust, /\.eval\(/, 'Rust→页面的注入通道(eval)是本 app 生产在用的路径,必须仍在')
  const caps = JSON.parse(read('apps/desktop/src-tauri/capabilities/default.json'))
  assert.ok(
    (caps.remote?.urls ?? []).some((u) => String(u).startsWith('https://aizhs.top')),
    '桌面把 IPC 授给了加载的线上域名;若这条被摘,注入后拿不到回执通道',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
