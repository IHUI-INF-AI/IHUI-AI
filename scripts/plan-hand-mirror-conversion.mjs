#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 器物为 CLI 工具,需 console 输出诊断与台账 */
/**
 * plan-hand-mirror-conversion.mjs —— 把「端内手写镜像页」转成「壳承载形制」的**规划器**(2026-10-27 立)。
 *
 * 为什么要有它(现读):小程序 168 枚在册镜像页里 122 枚已是壳承载形制(渲染就是共享屏本体,
 * 源头改一笔这一页自动跟随),而 **46 枚仍是端内手写、合计 15224 行**。造页器对后者一条都不产 ——
 * `gen-miniapp-mirror.mjs:950`「页面文件已存在且在册 ⇒ skip,不重复造页」,于是这 46 枚永久停在
 * "每改一次源头都要重抄一遍" 那一格,正是目标里"最大化减少开发"要消掉的面。
 *
 * 为什么默认只规划不落地:转换会**删掉端内手写的几百行**。手写页里可能带着共享屏根本没有的
 * 端内能力(微信授权按钮、分享卡、端内组件/私有接口),转成壳承载就把这些能力静默删了 ——
 * 那是能力损失,不是重构。判据一律**相对**取(不手写白名单,§0.6):
 *   这一页用到的 Taro.X 方法 / `useXxx` 钩子 / `@/…` 端内模块,若在「共享屏本体 ∪ RN 壳」里
 *   一个都没出现 ⇒ 它是这一页独有的能力 ⇒ 拒转,并把符号逐条点名(拿不准就是拒,不是放行)。
 * 壳不存在 / 壳不渲染这一屏 ⇒ 同样拒(那两型是承载链本身没建起来,归造页腿与声明链,不归本器)。
 *
 * 用法:
 *   node scripts/plan-hand-mirror-conversion.mjs            # 人读汇总 + 分桶计数
 *   node scripts/plan-hand-mirror-conversion.mjs --json      # 机读(逐条带 reasons)
 *   node scripts/plan-hand-mirror-conversion.mjs --top=20    # 可转清单多列几条
 *   node scripts/plan-hand-mirror-conversion.mjs --self-test # 判据自检(纯内存夹具)
 * 退出码(§0.3):0 判成 / 2 未判定(取不到面、枚举止于 0 行手写页而无台账可读)。
 * 判机器与账面状态 ⇒ 只读,不进提交链;落地腿(改写 + 落 HEAD)由后续一票接,须走对象空间。
 */

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

import { __test__ as fidelity } from './check-miniapp-mirror-fidelity.mjs'
import { __test__ as cov } from './check-cross-end-screen-coverage.mjs'
import { pickCarrierShell, shellTargetRel } from './lib/rn-shell-refs.mjs'
import { __test__ as gen } from './gen-miniapp-mirror.mjs'
import { maskComments, scanLiterals } from './lib/code-mask.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { computeFidelity, batchReadTexts } = fidelity
const { collectMiniapp, rnConsumes } = cov

/**
 * 端内**通用 UI 设施** —— 壳承载页自己也会 import(现读生成模板就带 ThemeRoot),或者纯粹是
 * 取词/日志/图标/状态骨架这类"不产生页面行为"的设施。它们不是"这一页独有的能力":
 * 把 ThemeRoot 算成私有能力会让 99/99 页全部假阻塞(实测拦路频次表被这三个符号顶满),
 * 那样的"经济账"会误导人去补一层根本不需要补的承载。
 * 只收**确证无行为**的少数据;拿不准的一律留在清单外(失效方向=多判需人工)。
 */
export const END_UI_FACILITIES = new Set([
  '@/components/ThemeRoot',
  '@/i18n',
  '@/utils/logger',
  '@/components/LineIcon',
  '@/components/ScreenStates',
  '@/components/ScreenStates.taro',
  'useI18n',
  'useTheme',
  'useTt',
  // React 内置钩子:共享屏本体也在用,与页面行为无关。旧口径把它们算成"页面独有能力"
  // ⇒ privacy/usage-rules 两页仅因 useCallback 被拒(实测),属同一型假阻塞。
  'useState',
  'useEffect',
  'useMemo',
  'useCallback',
  'useRef',
  'useContext',
  'useReducer',
  'useLayoutEffect',
  'useImperativeHandle',
  'useTransition',
  'useDeferredValue',
  'useId',
  'useSyncExternalStore',
  'useDebugValue',
  'useInsertionEffect',
])

/**
 * 页面里的 useDidShow/useDidHide 回调体(括号配对)。用于判"生命周期钩子是不是只做了设标题"。
 * 只认无参箭头形态 `useDidShow(() => { ... })`;其它形态一律不识别(那类页按带私有能力拒)。
 */
export function lifecycleBlocks(text) {
  const t = String(text ?? '')
  const out = []
  for (const m of t.matchAll(/useDid(Show|Hide)\s*\(\s*\(\s*\)\s*=>\s*\{/g)) {
    let i = m.index + m[0].length
    let depth = 1
    const start = i
    while (i < t.length && depth > 0) {
      if (t[i] === '{') depth++
      else if (t[i] === '}') depth--
      i++
    }
    out.push({ kind: m[1], body: t.slice(start, i - 1) })
  }
  return out
}

/** 设导航标题的 title 表达式(如 `t('agreement.title')`);取不到返回 null。 */
export function navTitleExpr(text) {
  const m = String(text ?? '').match(/setNavigationBarTitle\s*\(\s*\{\s*title:\s*([^}]+?)\s*\}\s*\)/)
  return m ? m[1].trim() : null
}

/**
 * 全部生命周期钩子都只做 Taro.setNavigationBarTitle ⇒ 不算私有能力:
 * 导航标题是端内事实,壳承载页可以把这 3 行原样保留(生成器 navTitle 通道),行为不丢。
 * 只要有任何一个钩子体里还有别的语句 ⇒ false(那类页可能刷新数据/埋点,必须人工)。
 */
export function titleOnlyLifecycle(text) {
  const blocks = lifecycleBlocks(text)
  if (blocks.length === 0) return false
  return blocks.every((b) => /^Taro\.setNavigationBarTitle\s*\(\s*\{[\s\S]*\}\s*\)\s*;?$/.test(b.body.trim()))
}

/**
 * 页面里的硬编码中文量(**只数字符串字面量**,注释不算)。判"转壳会丢正文"请用
 * `hardcodedCjkNotInMessages` —— 总量本身不是缺口(兜底文案在词包里都有)。
 */
export function hardcodedCjkCount(text) {
  return (maskComments(String(text ?? '')).match(/[\u4e00-\u9fff]/g) || []).length
}

/** 硬编码正文阈值:只看**未在词包里**的中文字符数(正文类页面实测 317/242 字,普通页中位数 0)。 */
export const HARDCODED_TEXT_LIMIT = 100

/** 小程序词包(壳承载后文案的唯一来源) —— 与页面按同一面读。 */
export const MESSAGES_REL = 'packages/i18n/messages/miniapp-taro/zh-CN.json'

/**
 * 页面字符串里**不在词包中**的中文字符数。判据用意:转壳后文案全部来自词包,
 * 若页面的中文片段在词包里找不到 ⇒ 那一段会消失(正文丢失),这才是真阻塞;
 * 而"加载失败/暂无数据/确定"这类兜底文案在词包里都有 ⇒ 删掉不丢东西(实测 98 页里 95 页 ≤50 字、中位数 0)。
 */
export function hardcodedCjkNotInMessages(text, messagesText) {
  const src = maskComments(String(text ?? ''))
  const hay = String(messagesText ?? '')
  let miss = 0
  for (const lit of scanLiterals(src).strings) {
    const body = String(lit.body ?? '')
    if (!/[\u4e00-\u9fff]/.test(body)) continue
    if (hay.includes(body.trim())) continue
    miss += (body.match(/[\u4e00-\u9fff]/g) || []).length
  }
  return miss
}

/** RN 路由名 → 小程序路径的派生表(生成器口径见 gen-rn-compat;本模块只读它,不另立映射)。 */
export const ROUTE_MAP_REL = 'apps/miniapp-taro/src/rn-compat/route-map.generated.ts'

export function routeMapFrom(text) {
  const map = new Map()
  for (const m of String(text ?? '').matchAll(/([A-Za-z0-9_]+):\s*'(\/[^']+)'/g)) map.set(m[2], m[1])
  return map
}

/**
 * 页面的跳转调用是否**全部**被承载壳覆盖:小程序路径经 route-map 反查成 RN 路由名,
 * 该路由名在壳正文里出现 ⇒ 这一跳壳自己会做(页面那份是重复实现)。
 * 含插值的 URL(`${id}`)一律算"未覆盖"——路由名反查不到就不知道壳跳去哪,不猜。
 */
export function coveredNavigation(pageText, shellText, routeMap) {
  const calls = [
    ...String(pageText ?? '').matchAll(
      /Taro\.(navigateTo|redirectTo|switchTab|reLaunch)\s*\(\s*\{\s*url:\s*[`'"]([^`'"]+)/g,
    ),
  ].map((m) => m[2])
  if (calls.length === 0) return { covered: true, missing: [], calls: 0 }
  const missing = []
  for (const url of calls) {
    // query 里的插值不影响路径反查(`.../detail/index?id=${id}` 的静态路径仍可查表);
    // 只有**路径段**含插值才判未覆盖(那时不知道壳跳去哪)。
    const path = url.split('?')[0]
    if (path.includes('${')) {
      missing.push(url)
      continue
    }
    const rn = routeMap.get(path)
    if (!rn || !new RegExp(`\\b${rn}\\b`).test(String(shellText ?? ''))) missing.push(rn ? `${url}(壳无 ${rn})` : url)
  }
  return { covered: missing.length === 0, missing, calls: calls.length }
}

/**
 * 下拉刷新是否由壳承担:壳里出现 RefreshControl / onRefresh / refreshing 任一,就说明
 * "下拉→重取数"这条链壳自己实现了;页面再写 usePullDownRefresh 是重复接线。
 */
export function pullDownCovered(shellText) {
  return /RefreshControl|onRefresh|refreshing/.test(String(shellText ?? ''))
}

/**
 * 生命周期钩子是否**只做"刷新一次数据"**(体里只有一句无参函数调用)。
 * 这类页面的 useDidShow(Show) 与壳的 useEffect+取数 是同一件事的两种写法;
 * 体里还有别的语句(埋点/设置标题以外的东西)一律不算,留给人工。
 */
export function lifecycleOnlyDataRefresh(text) {
  const blocks = lifecycleBlocks(text)
  if (blocks.length === 0) return false
  return blocks.every((b) => /^(?:void\s+)?[A-Za-z_$][\w$]*\s*\(\s*\)\s*;?$/.test(b.body.trim()))
}

/** 壳自己取数(有 api-client 调用) —— 与 lifecycleOnlyDataRefresh 合起来才认"刷新由壳承担"。 */
export function shellFetchesData(shellText) {
  const s = String(shellText ?? '')
  return /@ihui\/api-client/.test(s) && /fetchApi|request\s*\(/.test(s)
}

/** 触底加载:壳用 FlatList 的 onEndReached/onLoadMore,与小程序的 useReachBottom 是同一件事。 */
export function reachBottomCovered(shellText) {
  return /onEndReached|onLoadMore/.test(String(shellText ?? ''))
}

/**
 * 确认弹窗:壳用 RN 的 Alert.alert(现读 10 个屏),与小程序的 Taro.showModal 是同一件事。
 * 另认 `appAlert(title, msg, [{ onPress }])` 形态 —— 带选项的 appAlert 就是确认弹窗
 * (现读 AiSkillScreen 注释即「RN 端 Alert(name/description + 取消/查看详情)」,实现为 appAlert + onPress)。
 */
export function modalCovered(shellText) {
  const s = String(shellText ?? '')
  if (/\bAlert\.(alert|prompt)\b|showConfirm|ConfirmDialog/.test(s)) return true
  return /appAlert\s*\([\s\S]{0,300}?onPress/.test(s)
}

/** 剪贴板:壳用 Clipboard.setString(现读 13 个屏),与小程序的 Taro.setClipboardData 是同一件事。 */
export function clipboardCovered(shellText) {
  return /Clipboard\.setString|Clipboard\.setClipboardData|copyToClipboard/.test(String(shellText ?? ''))
}

/**
 * 端点归一:去 query、插值与数字段折成 :id、去尾斜杠、**去开头的 /api**。
 * 为什么要去 /api:端内 `get('/follows/:id/status')` 走 BASE_URL(已含 /api),而 RN 壳
 * `fetchApi('/api/follows/:id/status')` 写全路径 —— 同一端点两种写法(现读 user-public 页头注即此)。
 */
export function normEndpoint(p) {
  return String(p)
    .split('?')[0]
    .replace(/\$\{[^}]*\}/g, ':id')
    .replace(/\/\d+/g, '/:id')
    .replace(/\/+$/, '')
    .replace(/^\/api(?=\/|$)/, '')
}

const GENERIC_FETCHERS = new Set(['get', 'post', 'put', 'del', 'patch'])

/**
 * 页面**直接**用通用请求器(get/post/put/del/patch)打的端点,是否全部被承载壳覆盖。
 * 判定为真需同时满足:
 *   ① 页面里确实有直接调用,且从 `@/api*` 导入的具名成员**只有**这几个通用请求器
 *      (还有别的业务函数 ⇒ 那些函数的端点解析不出 ⇒ 一律不销账,保守);
 *   ② 每个端点归一后都能在壳的 fetchApi 端点集里找到。
 * 端点重合才有资格说"数据由壳承担";不重合就是真差异(现读 64 页里绝大多数属后者)。
 */
export function apiEndpointsCovered(pageText, shellText) {
  const page = maskComments(String(pageText ?? ''))
  const calls = [
    ...page.matchAll(/\b(?:get|post|put|del|patch)\s*(?:<[^>]*>)?\s*\(\s*[`'"]([^`'"]+)/g),
  ].map((m) => normEndpoint(m[1]))
  if (calls.length === 0) return false
  for (const m of page.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@\/api[^'"]*['"]/g)) {
    for (const piece of m[1].split(',')) {
      const n = piece.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
      if (!n) continue
      if (GENERIC_FETCHERS.has(n)) continue
      if (/^[A-Z]/.test(n)) continue // 类型导入(如 Course/News)
      return false
    }
  }
  const shell = maskComments(String(shellText ?? ''))
  const sp = new Set(
    [
      ...shell.matchAll(/fetchApi\s*(?:<[^>]*>)?\s*\(\s*['"`]([^'"`]+)/g),
      ...shell.matchAll(/fetchApi\s*\(\s*\{[^}]*url:\s*['"`]([^'"`]+)/g),
    ].map((m) => normEndpoint(m[1])),
  )
  return calls.every((p) => sp.has(p))
}

/**
 * 逐个 showToast 调用的**括号配对**文本。不能拿正则截到第一个右花括号:模板串里的插值自带
 * 右花括号,会把调用截断(实测 account-pool 第二处 toast 因此抓不到 key,整页被误判"壳没有这条提示")。
 */
export function toastCallSpans(src) {
  const text = String(src ?? '')
  const out = []
  for (const m of text.matchAll(/Taro\.showToast\s*\(/g)) {
    let i = m.index + m[0].length
    let depth = 1
    const start = i
    while (i < text.length && depth > 0) {
      const ch = text[i]
      if (ch === '(') depth++
      else if (ch === ')') depth--
      i++
    }
    out.push({ start: m.index, text: text.slice(start, i - 1) })
  }
  return out
}

/** 鉴权钩子的页面,其 useDidShow 体若只做 gate.waitUntilReady(...) ⇒ 由 AuthReadyGate 承担。 */
export function authGateCoversDidShow(pageText) {
  if (!needsAuthGate(pageText)) return false
  const blocks = lifecycleBlocks(pageText)
  if (blocks.length === 0) return false
  return blocks.every((b) => /waitUntilReady\s*\(/.test(b.body))
}

/**
 * 提示等价:页面 showToast 引用的 i18n key **全部**在壳正文里出现,且壳自己有提示出口
 * (appAlert / Toast) ⇒ 页面那几处 toast 是重复;壳的提示文案就是同一批词条。
 * 任一 key 在壳里找不到 ⇒ 壳没有这条提示,转壳会丢用户反馈 ⇒ 不销账(现读 67 页里只有 6 页满足)。
 */
export function toastCovered(pageText, shellText) {
  const src = maskComments(String(pageText ?? ''))
  const shell = String(shellText ?? '')
  const keys = new Set()
  for (const call of toastCallSpans(src))
    for (const k of call.text.matchAll(/\btt?\s*\(\s*'([A-Za-z0-9_.]+)'/g)) keys.add(k[1])
  if (keys.size === 0) return false
  if (!/appAlert|\bToast\b|toast\.(show|info|success)/.test(shell)) return false
  return [...keys].every((k) => shell.includes(k))
}

/**
 * 页面的 showToast 是否**全部只在 catch 块内**(错误反馈)。
 * 这类提示与壳的错误态是同一件事的两面:壳的每个 load/act 都有 try/catch 且走 appAlert / setError,
 * 转壳后由壳的错误表达承担。文案可能不同(页面 common.loadFailed vs 壳 common.error + e.message),
 * 但事件同一 ⇒ 不丢用户反馈。只要有任意一处 toast 不在 catch 里(成功提示等)⇒ false。
 */
export function toastOnlyInCatch(pageText) {
  const src = maskComments(String(pageText ?? ''))
  const total = [...src.matchAll(/showToast\s*\(/g)].length
  if (total === 0) return false
  const inCatch = [
    ...src.matchAll(/catch\s*(?:\([^)]*\))?\s*\{[\s\S]{0,800}?showToast\s*\(/g),
  ].length
  return inCatch >= total
}

/** 页面是否用端内鉴权就绪钩子(由生成页包 AuthReadyGate 承担,见该组件头注)。 */
export function needsAuthGate(pageText) {
  return /useAuthReadyGate|@\/hooks\/use-auth-ready-gate/.test(String(pageText ?? ''))
}

/**
 * 页面里的 switchTab 是否**只作为 navigateBack 的失败回落**(`navigateBack(...).catch(() => switchTab(...))`)。
 * 这是小程序特有写法:RN 端 navigation.goBack() 不存在"失败回落首页"这一态,壳不需要它。
 * 只要有任意一处 switchTab 不在该 catch 链里(独立跳 tab)⇒ false,仍算私有能力。
 */
export function backFallbackOnly(pageText) {
  const src = maskComments(String(pageText ?? ''))
  const switches = [...src.matchAll(/Taro\.switchTab\s*\(/g)].length
  if (switches === 0) return false
  const fallbacks = [
    ...src.matchAll(/navigateBack\s*\([\s\S]{0,240}?\.catch\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]{0,240}?Taro\.switchTab/g),
  ].length
  return fallbacks >= switches
}
export function themeCovered(shellText) {
  return /useTheme|colorScheme|resolvedTheme/.test(String(shellText ?? ''))
}

/** 返回:navigateBack ↔ RN 的 navigation.goBack / 壳的 onBack 注入。 */
export function backCovered(shellText) {
  return /goBack|onBack/.test(String(shellText ?? ''))
}

/**
 * 路由参数:`Taro.getCurrentInstance().router.params` 在端内页里拿 query,
 * 而壳里读的是 `route.params` —— rn-compat 的 useRoute 头注写明"小程序的 router.params 即 RN 的
 * route.params"(apps/miniapp-taro/src/rn-compat/navigation.tsx:57),所以参数链路成立。
 * 只认壳里真有 route.params/useRoute 的情形;页面侧也必须真的在读 params(不拿它当事件通道)。
 */
export function routeParamsCovered(pageText, shellText) {
  return (
    /router\??\.params/.test(String(pageText ?? '')) &&
    /useRoute|route\??\.params/.test(String(shellText ?? ''))
  )
}

/** 一页文本里"能力-bearing"的三族标识(方法名 / 钩子 / 端内模块),用于相对取差。 */
export function capabilityTokens(text) {
  const t = String(text ?? '')
  const out = new Set()
  for (const m of t.matchAll(/\bTaro\.([A-Za-z_][A-Za-z0-9_]*)/g)) out.add(`Taro.${m[1]}`)
  for (const m of t.matchAll(/\buse([A-Z][A-Za-z0-9_]*)\b/g)) out.add(`use${m[1]}`)
  for (const m of t.matchAll(/from\s*['"](@\/[^'"]+)['"]/g)) out.add(m[1])
  for (const tok of END_UI_FACILITIES) out.delete(tok)
  return out
}

/**
 * 这一页相对「共享屏本体 ∪ RN 壳」多出来的能力符号。空集 ⇒ 页面没带私有行为,可转。
 * pageTokens/sharedTokens/shellTokens 均为 Set|string(字符串现算)。
 */
export function pageOnlyCapabilities({ pageTokens, sharedText, shellText }) {
  const src = `${sharedText || ''}\n${shellText || ''}`
  const base = pageTokens instanceof Set ? pageTokens : capabilityTokens(pageTokens)
  const out = []
  for (const tok of base) {
    const re = new RegExp(tok.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\b')
    if (!re.test(src)) out.push(tok)
  }
  return out.sort()
}

/** 一枚手写镜像页的转换判定(纯判据,不写盘)。 */
export function judgeConversion({
  spec,
  pageText,
  shellText,
  sharedText,
  shellName = null,
  routeMap = null,
  messagesText = '',
}) {
  const name = String(spec || '')
    .split('/')
    .pop()
    .replace(/\.[jt]sx$/, '')
  if (!pageText) return { spec, kind: 'undetermined', why: '页面正文取不到' }
  if (shellText === null || shellText === undefined)
    return { spec, kind: 'no-shell', why: `${shellTargetRel(name)} 在本面不存在` }
  if (!rnConsumes({ text: shellText }, name))
    return {
      spec,
      kind: 'shell-not-rendering',
      why: `壳 ${name} 未消费共享屏(不带 @ihui/rn-app 取用该符号)`,
    }
  const pageTokens = capabilityTokens(pageText)
  // 硬编码正文闸:转壳后正文来自共享屏词包 ⇒ **词包里没有的**中文片段会消失(不是"未还原",是丢内容)
  const missingCjk = hardcodedCjkNotInMessages(pageText, messagesText)
  if (missingCjk > HARDCODED_TEXT_LIMIT)
    return {
      spec,
      kind: 'page-only-capability',
      why: `这一页带着共享屏/壳没有的能力:硬编码正文 ${missingCjk} 字不在词包(转壳会丢内容)`,
    }
  // "只设导航标题"的生命周期钩子可以由壳承载页原样保留(见 titleOnlyLifecycle),不计私有能力
  if (titleOnlyLifecycle(pageText))
    for (const tok of ['useDidShow', 'useDidHide', 'Taro.setNavigationBarTitle']) pageTokens.delete(tok)
  // 跳转全部被壳覆盖 ⇒ 页面那几处 navigateTo 是重复实现(route-map 反查 + 壳正文出现该路由名)
  if (routeMap) {
    const nav = coveredNavigation(pageText, shellText, routeMap)
    if (nav.covered)
      for (const tok of ['Taro.navigateTo', 'Taro.redirectTo', 'Taro.switchTab', 'Taro.reLaunch'])
        pageTokens.delete(tok)
  }
  // 平台惯用法的等价物由壳承担时,页面那份是重复接线(逐条都要壳里有对应实现才销账):
  if (pullDownCovered(shellText))
    for (const tok of ['usePullDownRefresh', 'onPullDownRefresh', 'Taro.stopPullDownRefresh'])
      pageTokens.delete(tok)
  if (lifecycleOnlyDataRefresh(pageText) && shellFetchesData(shellText))
    for (const tok of ['useDidShow', 'useDidHide']) pageTokens.delete(tok)
  if (reachBottomCovered(shellText)) pageTokens.delete('useReachBottom')
  if (modalCovered(shellText)) pageTokens.delete('Taro.showModal')
  if (clipboardCovered(shellText)) pageTokens.delete('Taro.setClipboardData')
  if (themeCovered(shellText)) for (const tok of ['@/lib/theme', 'useAppTheme']) pageTokens.delete(tok)
  if (backCovered(shellText)) pageTokens.delete('Taro.navigateBack')
  if (routeParamsCovered(pageText, shellText)) pageTokens.delete('Taro.getCurrentInstance')
  // 鉴权就绪:生成页会包 AuthReadyGate(通用外罩),页面的钩子由它承担
  const authGate = needsAuthGate(pageText)
  if (authGate)
    for (const tok of ['useAuthReadyGate', '@/hooks/use-auth-ready-gate']) pageTokens.delete(tok)
  // 带鉴权钩子的页,其 useDidShow 若只做 waitUntilReady(...) ⇒ 由 AuthReadyGate 承担"就绪后再渲染"
  if (authGateCoversDidShow(pageText)) for (const tok of ['useDidShow', 'useDidHide']) pageTokens.delete(tok)
  // 提示等价:key 全在壳里且壳有提示出口才销账(壳没有这条提示就仍算私有)
  if (toastCovered(pageText, shellText)) pageTokens.delete('Taro.showToast')
  // 或:toast 全在 catch 内(错误反馈)+ 壳有错误出口 ⇒ 由壳的错误态承担
  if (!toastCovered(pageText, shellText) && toastOnlyInCatch(pageText) && /appAlert|\bToast\b/.test(String(shellText ?? '')))
    pageTokens.delete('Taro.showToast')
  // switchTab 只做 navigateBack 的失败回落 ⇒ RN 端没有这一态,壳的 goBack 已覆盖
  if (backFallbackOnly(pageText)) pageTokens.delete('Taro.switchTab')
  // 页面直接打的端点全部被壳覆盖 ⇒ 数据由壳承担(端点不重合的一律不销账)
  if (apiEndpointsCovered(pageText, shellText))
    for (const tok of ['@/api', '@/api/index', '@/api/social']) pageTokens.delete(tok)
  const extras = pageOnlyCapabilities({
    pageTokens,
    sharedText,
    shellText,
  })
  if (extras.length > 0)
    return {
      spec,
      kind: 'page-only-capability',
      why: `这一页带着共享屏/壳没有的能力:${extras.slice(0, 8).join(', ')}`,
    }
  const body = gen.buildShellPage({
    spec,
    base: name.replace(/Screen$/, ''),
    shellText,
    shellName,
    navTitle: titleOnlyLifecycle(pageText) ? navTitleExpr(pageText) : null,
    authGate,
  })
  if (body?.error) return { spec, kind: 'undetermined', why: `壳承载出口形态不合:${body.error}` }
  const lines = String(body?.content ?? body ?? '').split('\n').length
  return {
    spec,
    kind: 'convertible',
    why: '',
    shellLines: lines,
    pageLines: String(pageText).split('\n').length,
  }
}

/** 现算整份计划:只判 form==='hand' 的对(承载页无需转;断链页归造页腿)。 */
export function plan({ face = 'head' } = {}) {
  const res = computeFidelity(face)
  const hand = res.rows.filter((r) => r.form === 'hand')
  const miniapp = collectMiniapp(face)
  const byRoute = new Map(miniapp.map((p) => [p.route, p]))
  const specs = [...new Set(hand.map((r) => r.spec))]
  const sharedTexts = batchReadTexts(face, specs)
  // 路由映射与词包按同一面读(缺表/缺词包 ⇒ 判不出 ⇒ 保守:不销账、正文全算缺失)
  const routeMap = routeMapFrom(batchReadTexts(face, [ROUTE_MAP_REL]).get(ROUTE_MAP_REL) ?? '')
  const messagesText = batchReadTexts(face, [MESSAGES_REL]).get(MESSAGES_REL) ?? ''
  // 承载壳候选口径 = lib 单源(pickCarrierShell):同名优先、异名兜底(NewsScreen 渲染 SquareScreen
  // 这类平台薄壳是仓内既有形态)。旧实现只认同名壳 ⇒ 会把"壳叫别的名"的页误判成 no-shell。
  const rnTexts = new Map(
    cov
      .collectRn(face)
      .filter((p) => p.text)
      .map((p) => [p.file, p.text]),
  )
  const rows = []
  for (const r of hand) {
    const page = byRoute.get(r.route)
    const name = String(r.spec)
      .split('/')
      .pop()
      .replace(/\.[jt]sx$/, '')
    const carrier = pickCarrierShell(rnTexts, name)
    rows.push({
      ...judgeConversion({
        spec: r.spec,
        pageText: page?.text ?? null,
        shellText: carrier ? rnTexts.get(carrier.rel) : null,
        sharedText: sharedTexts.get(r.spec) ?? '',
        shellName: carrier?.name ?? null,
        routeMap,
        messagesText,
      }),
      route: r.route,
      shell: carrier?.name ?? null,
      pageLines: String(page?.text ?? '').split('\n').length,
      missingKeys: r.missing.length,
    })
  }
  const bucket = (k) => rows.filter((x) => x.kind === k)
  // 拒转符号的**频次**表:这就是"改一处解锁 N 页"的经济账 —— 每个高频符号只要在共享层/兼容层
  // 补一次承载,对应那批页才可能自动转;没有这张表,转换就只能一页一页人工判(= 目标要消掉的东西)。
  const freq = new Map()
  for (const r of rows)
    for (const tok of String(r.why || '')
      .replace(/^.*能力:/, '')
      .split(', ')) {
      if (!tok || r.kind !== 'page-only-capability') continue
      freq.set(tok, (freq.get(tok) || 0) + 1)
    }
  return {
    face,
    pairs: res.pairs,
    hosted: res.hosted,
    hand: rows.length,
    counts: {
      convertible: bucket('convertible').length,
      'page-only-capability': bucket('page-only-capability').length,
      'no-shell': bucket('no-shell').length,
      'shell-not-rendering': bucket('shell-not-rendering').length,
      undetermined: bucket('undetermined').length,
    },
    // 行数是**按页**算的,而一页可以声明镜像多屏 ⇒ 按行加会把同一页的字节数算几遍
    // (实测按行加读出 30871,而按唯一路由加读出手写面真值)。合计与明细不同基准就是坏账。
    handLines: [...new Map(rows.map((r) => [r.route, r.pageLines || 0])).values()].reduce(
      (a, b) => a + b,
      0,
    ),
    convertibleLinesSaved: bucket('convertible').reduce(
      (a, x) => a + Math.max(0, (x.pageLines || 0) - x.shellLines),
      0,
    ),
    blockers: [...freq.entries()].sort((a, b) => b[1] - a[1]),
    rows,
  }
}

function main(argv) {
  const p = plan({ face: 'head' })
  if (argv.includes('--self-test')) {
    const cases = []
    const P = (name, got, want) =>
      cases.push({ name, pass: JSON.stringify(got) === JSON.stringify(want), got })
    P(
      'S1 相对取差:页面独有的 Taro 调用与端内模块被点名,共享屏也用的不算',
      pageOnlyCapabilities({
        pageTokens: new Set(['Taro.showToast', 'Taro.login', 'useShareAppMessage', '@/api/pay']),
        sharedText: `Taro.showToast(1)\nconst x = t('a.b')`,
        shellText: `Taro.showToast(2)`,
      }),
      ['@/api/pay', 'Taro.login', 'useShareAppMessage'],
    )
    P(
      'S2 无私有能力 ⇒ convertible(壳存在且消费本屏)',
      judgeConversion({
        spec: 'packages/app/src/features/demo/DemoScreen.tsx',
        pageText: `Taro.showToast({ title: 'ok' })`,
        shellText: `import { DemoScreen } from '@ihui/rn-app'\nexport default function DemoScreen(){return null}\nTaro.showToast(1)`,
        sharedText: `Taro.showToast(1)`,
      }).kind,
      'convertible',
    )
    P(
      'S3 壳不在面上 ⇒ no-shell(不猜)',
      judgeConversion({
        spec: 'packages/app/src/features/demo/DemoScreen.tsx',
        pageText: 'x',
        shellText: null,
        sharedText: '',
      }).kind,
      'no-shell',
    )
    P(
      'S4 壳不渲染这一屏 ⇒ shell-not-rendering',
      judgeConversion({
        spec: 'packages/app/src/features/demo/DemoScreen.tsx',
        pageText: 'y',
        shellText: `import { Other } from '@ihui/rn-app'`,
        sharedText: '',
      }).kind,
      'shell-not-rendering',
    )
    P(
      'S5 端内通用 UI 设施(ThemeRoot/i18n/logger)不算私有能力,真业务模块仍算',
      pageOnlyCapabilities({
        pageTokens: capabilityTokens(`
          import ThemeRoot from '@/components/ThemeRoot'
          import { useI18n } from '@/i18n'
          import { logger } from '@/utils/logger'
          import { fetchX } from '@/api'
        `),
        sharedText: '',
        shellText: '',
      }),
      ['@/api'],
    )
    P(
      'S6 硬编码正文超阈值 ⇒ 拒转(转壳后正文来自词包,页面自带正文会丢)',
      judgeConversion({
        spec: 'packages/app/src/features/demo/DemoScreen.tsx',
        pageText: `const body = '${'中'.repeat(300)}'`,
        shellText: `import { DemoScreen } from '@ihui/rn-app'\nexport default function DemoScreen(){return null}`,
        sharedText: '',
      }).kind,
      'page-only-capability',
    )
    P(
      'S6b 同样的正文若词包里已有 ⇒ 不算缺口(兜底文案属重复,删掉不丢东西)',
      judgeConversion({
        spec: 'packages/app/src/features/demo/DemoScreen.tsx',
        pageText: `const body = '${'中'.repeat(300)}'`,
        shellText: `import { DemoScreen } from '@ihui/rn-app'\nexport default function DemoScreen(){return null}`,
        sharedText: '',
        messagesText: `{"demo":{"body":"${'中'.repeat(300)}"}}`,
      }).kind,
      'convertible',
    )
    P(
      'S7 只设导航标题的生命周期钩子不算私有能力(生成页会原样保留)',
      titleOnlyLifecycle(`useDidShow(() => { Taro.setNavigationBarTitle({ title: t('a.b') }) })`),
      true,
    )
    P(
      'S7b 钩子里还有别的语句 ⇒ 仍算(必须人工)',
      titleOnlyLifecycle(`useDidShow(() => { Taro.setNavigationBarTitle({ title: t('a.b') }); refresh() })`),
      false,
    )
    const rm = routeMapFrom(`export const RN_ROUTE_MAP = { Detail: '/pkg-a/detail/index' }`)
    P(
      'S8 页面跳转经 route-map 反查且壳里出现该路由名 ⇒ 不算私有能力',
      judgeConversion({
        spec: 'packages/app/src/features/demo/DemoScreen.tsx',
        pageText: `Taro.navigateTo({ url: '/pkg-a/detail/index?id=1' })`,
        shellText: `import { DemoScreen } from '@ihui/rn-app'\nfunction DemoScreen({ navigation }: any) { navigation.navigate('Detail') }\nexport default DemoScreen`,
        sharedText: '',
        routeMap: rm,
      }).kind,
      'convertible',
    )
    P(
      'S8b 壳里没有这个路由名 ⇒ 仍算私有能力(不猜"大概等价")',
      judgeConversion({
        spec: 'packages/app/src/features/demo/DemoScreen.tsx',
        pageText: `Taro.navigateTo({ url: '/pkg-a/detail/index' })`,
        shellText: `import { DemoScreen } from '@ihui/rn-app'\nfunction DemoScreen() { return null }\nexport default DemoScreen`,
        sharedText: '',
        routeMap: rm,
      }).kind,
      'page-only-capability',
    )
    P('S9 下拉刷新由壳承担:壳有 onRefresh/RefreshControl ⇒ 页面的下拉钩子不算私有能力', [pullDownCovered('onRefresh={() => {}}'), pullDownCovered('const refreshing = false'), pullDownCovered('function S(){ return null }')], [true, true, false])
    P('S9b 生命周期只做一次数据刷新 ⇒ 可与壳的 useEffect 对齐;体里还有别的语句 ⇒ 不算', [lifecycleOnlyDataRefresh('useDidShow(() => { void load() })'), lifecycleOnlyDataRefresh('useDidShow(() => { track(); load() })')], [true, false])
    P('S9c 壳自己取数(api-client + fetchApi)才算"刷新由壳承担"', [shellFetchesData("import { fetchApi } from '@ihui/api-client'\nfetchApi('/x')"), shellFetchesData("import X from 'y'")], [true, false])
    P('S10 触底/确认弹窗/剪贴板:壳有平台等价物才销账', [
      reachBottomCovered('<FlatList onEndReached={loadMore} />'),
      modalCovered('Alert.alert(t("x"), "", [...])'),
      clipboardCovered('Clipboard.setString(v)'),
      reachBottomCovered('return null'),
      clipboardCovered('return null'),
    ], [true, true, true, false, false])
    P('S11 主题/返回/路由参数:壳侧有对应实现才销账;页面没读 params 时 getCurrentInstance 不销', [
      themeCovered("const { resolvedTheme } = useTheme()"),
      backCovered('onBack={() => navigation.goBack()}'),
      routeParamsCovered('Taro.getCurrentInstance().router?.params?.id', 'const route = useRoute(); route.params.id'),
      routeParamsCovered('Taro.getCurrentInstance().eventChannel', 'const route = useRoute()'),
      routeParamsCovered('router?.params?.id', 'return null'),
    ], [true, true, true, false, false])
    P('S12 提示等价与鉴权门:toast 的 key 必须全在壳里;带钩子的页要包 AuthReadyGate', [
      toastCovered("Taro.showToast({ title: tt('checkIn.signSuccess') })", "appAlert(t('checkIn.signSuccess'))"),
      toastCovered("Taro.showToast({ title: tt('x.y') })", "appAlert(t('z.w'))"),
      toastCovered("Taro.showToast({ title: 'x' })", 'appAlert(1)'),
      needsAuthGate("import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'"),
      needsAuthGate('const x = 1'),
    ], [true, false, false, true, false])
    P('S12b switchTab 只作 navigateBack 的失败回落 ⇒ 不算私有;独立切 tab 仍算', [
      backFallbackOnly("Taro.navigateBack({ delta: 1 }).catch(() => { Taro.switchTab({ url: '/pages/index/index' }) })"),
      backFallbackOnly("Taro.switchTab({ url: '/pages/x' })"),
      backFallbackOnly('const x = 1'),
    ], [true, false, false])
    P('S16 确认弹窗:Alert.alert 或带选项的 appAlert(onPress)才算', [
      modalCovered('Alert.alert(t("x"), "", [...])'),
      modalCovered("appAlert(skill.name, skill.description, [{ text: t('ok'), onPress: () => go() }])"),
      modalCovered("appAlert(t('common.failed'))"),
    ], [true, true, false])
    P('S14 错误分支 toast:全部在 catch 内且壳有错误出口才算;成功提示仍在则不算', [
      toastOnlyInCatch("try { await x() } catch { Taro.showToast({ title: t('common.loadFailed') }) }"),
      toastOnlyInCatch("Taro.showToast({ title: t('ok') })"),
      toastOnlyInCatch('const x = 1'),
    ], [true, false, false])
    P('S15 toast 括号配对(模板插值含右花括号也不截断) + 鉴权钩子的 useDidShow 由门承担', [
      toastCallSpans("Taro.showToast({ title: `${t('a.b')}${msg ? `:${msg}` : ''}`, icon: 'none' })").length,
      toastCovered("Taro.showToast({ title: `${t('a.b')}${msg ? `:${msg}` : ''}` })", "appAlert(t('a.b'))"),
      authGateCoversDidShow("import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'\nuseDidShow(() => { gate.waitUntilReady(() => { void load() }) })"),
      authGateCoversDidShow("useDidShow(() => { track() })"),
    ], [1, true, true, false])
    P('S13 端点等价:页面 get/post 的端点须全部在壳 fetchApi 里(/api 前缀与动态段归一);带业务函数或端点不重合都不销', [
      apiEndpointsCovered(
        "import { get, post } from '@/api'\nget(`/follows/${id}/status`)\npost('/messages/conversations')",
        "fetchApi(`/api/follows/${uid}/status`)\nfetchApi('/api/messages/conversations', { method: 'POST' })",
      ),
      apiEndpointsCovered("import { get } from '@/api'\nget('/agents/list')", "fetchApi('/api/agents')"),
      apiEndpointsCovered("import { getX } from '@/api'\nget('/x')", "fetchApi('/api/x')"),
    ], [true, false, false])
    for (const c of cases)
      console.log(
        `${c.pass ? '✔' : '✖'} ${c.name}${c.pass ? '' : ` —— 实测:${JSON.stringify(c.got)}`}`,
      )
    console.log(`SELF-TEST ${cases.filter((c) => c.pass).length}/${cases.length} 通过`)
    return cases.every((c) => c.pass) ? 0 : 1
  }
  const topArg = argv.find((a) => a.startsWith('--top='))
  const top = topArg ? Number(topArg.slice(6)) : 8
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        { ...p, rows: p.rows.filter((r) => r.kind !== 'convertible').slice(0, 400) },
        null,
        2,
      ),
    )
    return 0
  }
  console.log(
    `[plan-hand-mirror-conversion] 面=${p.face} 对=${p.pairs} 已承载=${p.hosted} 手写=${p.hand}(${p.handLines} 行)` +
      ` ⇒ 可转=${p.counts.convertible}(省 ${p.convertibleLinesSaved} 行) ` +
      `带私有能力=${p.counts['page-only-capability']} 无壳=${p.counts['no-shell']} ` +
      `壳不渲染=${p.counts['shell-not-rendering']} 未判定=${p.counts.undetermined}`,
  )
  const conv = p.rows
    .filter((r) => r.kind === 'convertible')
    .sort((a, b) => b.pageLines - a.pageLines)
  for (const r of conv.slice(0, top))
    console.log(
      `   可转 ${r.route} ← ${r.spec}(${r.pageLines} 行 → ${r.shellLines} 行,缺 ${r.missingKeys} 键)`,
    )
  console.log(
    `ℹ️ 拦路符号频次(改一处共享层/兼容层承载 ⇒ 解锁这么多页;这是"值不值得建承载"的经济账):`,
  )
  for (const [tok, n] of p.blockers.slice(0, top))
    console.log(`   ${String(n).padStart(3)} 枚页卡在 ${tok}`)
  for (const r of p.rows
    .filter((x) => x.kind === 'page-only-capability')
    .slice(0, Math.max(0, top - 6)))
    console.log(`   拒转 ${r.route}:${r.why}`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ 未判定(异常):${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  capabilityTokens,
  pageOnlyCapabilities,
  judgeConversion,
  plan,
  lifecycleBlocks,
  navTitleExpr,
  titleOnlyLifecycle,
  hardcodedCjkCount,
  hardcodedCjkNotInMessages,
  routeMapFrom,
  coveredNavigation,
  pullDownCovered,
  lifecycleOnlyDataRefresh,
  shellFetchesData,
  reachBottomCovered,
  modalCovered,
  clipboardCovered,
  themeCovered,
  backCovered,
  routeParamsCovered,
  toastCovered,
  toastCallSpans,
  authGateCoversDidShow,
  toastOnlyInCatch,
  needsAuthGate,
  backFallbackOnly,
  apiEndpointsCovered,
  normEndpoint,
  ROOT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
