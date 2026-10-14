// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-1121552(P1)RN 端首页滚动失效 —— 重测接线回归
//
// 缺陷事实(2026-10 真机实测;本任务现读复跑确认结构,未照抄票面行号):
//   RN Android 首页滑不动:严格位移判据(只比 y=600..1500)连滑 8 次差异恒为 0;同设备
//   「我的」页可滚;旋屏一次后首页可滚 ⇒ 父 ScrollView 的 contentSize 未随异步内容更新。
//   根因:apps/mobile-rn/src/screens/HomeScreen.tsx 首页父 ScrollView 内「AI 应用商店」区段
//   = MoreTitles + 嵌套 AgentShopList(scrollEnabled={false} ⇒ 内部 FlatList 不自滚),
//   agentItems 由 loadAgentList 异步到位 ⇒ 嵌套内容长高而父级不重新测量(Android 已知型:
//   旋屏强制全量重测即恢复,坐实判据)。影响面:Toolbar「独家开发 AI Agent 应用」与六格宫格
//   在该列表之后、首屏之外 ⇒ 滚不动即结构性不可达。
//
// 修法判定(两个候选里选 (a),理由):
//   (b) 父级 FlatList + ListHeaderComponent 要把整个首页(轮播/工具栏/十余区段/
//       SharedHomeScreen)拆栈重装,动虚拟化与下拉刷新语义,违背「最小改动、不动视觉与交互」;
//       且 AgentShopList 虽可保留 props,父级数据面全变,回归面非最小。
//   (a) 只改 HomeScreen:父 ScrollView 增挂 onContentSizeChange ⇒ requestAnimationFrame 内
//       做一次 scrollTo 逼 Android 重测。AgentShopList 零改,props/API 原样保留。
//       iOS 防回退细化:onContentSizeChange 在 iOS 上本就会触发,若钉 y:0 会把正在下滑的
//       用户拽回顶 ⇒ scrollTo 目标取**当前 offset**(scrollOffsetRef 跟踪),两平台均为
//       零位移空操作,只重测。
//
// 为什么按源码钉而不做渲染级:本屏 2.5k 行、挂 FlatList + 十余 provider,端内 HomeScreen
// 零渲染用例(挂载即 TypeError 的先例已记在 tool-approval-rn-wiring.test.tsx 文件头);
// 本票要钉的是「重测接线存在且语义正确」,源码级判据 + 变异有牙正是本仓 wiring 回归的
// 既定范式(chat-stream-execution-wiring / d135-seam-wiring / agent-collect-thumbs-paths 同型)。
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

const RN_HOME = 'apps/mobile-rn/src/screens/HomeScreen.tsx'
const HANDLER = 'handleContentSizeChange'
const OFFSET_REF = 'scrollOffsetRef'

/** 剥注释留代码(保留缩进与串内容):「名字出现在注释里」不算接线。
 *  与 tests/tool-approval-rn-wiring.test.tsx 的 codeLines 同一手法。 */
function codeLines(src: string): string[] {
  const out: string[] = []
  let inBlock = false
  for (const raw of src.split('\n')) {
    let line = ''
    let str: '' | '"' | "'" | '`' = ''
    for (let i = 0; i < raw.length; i += 1) {
      const c = raw[i]!
      const n = raw[i + 1] ?? ''
      if (inBlock) {
        if (c === '*' && n === '/') {
          inBlock = false
          i += 1
        }
        continue
      }
      if (str !== '') {
        line += c
        if (c === '\\') {
          line += n
          i += 1
        } else if (c === str) {
          str = ''
        }
        continue
      }
      if (c === '/' && n === '/') break
      if (c === '/' && n === '*') {
        inBlock = true
        i += 1
        continue
      }
      if (c === '"' || c === "'" || c === '`') str = c
      line += c
    }
    out.push(line)
  }
  return out
}

/** 取 `const <name> = useCallback(...)` 的函数体(到配平的 `}, [` 行为止;不靠行号,append 不挪尺)。 */
function callbackBody(lines: string[], name: string): string {
  const start = lines.findIndex((l) => l.includes(`const ${name} = useCallback(`))
  if (start < 0) return ''
  const body: string[] = []
  for (let i = start + 1; i < lines.length; i += 1) {
    body.push(lines[i]!)
    if (/^\s*\}, \[/.test(lines[i]!)) break
  }
  return body.join('\n')
}

/** 取首页那个父 ScrollView 的 JSX 开标签:按认领属性 contentContainerStyle={shellStyles.scrollContent}
 *  提取,不靠行号。不能直接找第一个 `<ScrollView` —— `useRef<ScrollView>(null)` 的类型参数
 *  长得一样,按属性认领才不会认错(认领失败即判「形态已变」)。 */
function homeScrollViewOpenTag(code: string): string {
  for (const m of code.matchAll(/<ScrollView[\s>]/g)) {
    const end = code.indexOf('>', m.index)
    if (end < 0) continue
    const tag = code.slice(m.index, end + 1)
    if (/contentContainerStyle=\{shellStyles\.scrollContent\}/.test(tag)) return tag
  }
  return ''
}

/** 判据尺子:返回违规清单(空数组 = 接线存在且语义正确、结构未拆栈)。 */
function violations(src: string): string[] {
  const code = codeLines(src).join('\n')
  const out: string[] = []

  // ① 重测回调存在且语义正确: rAF 内 scrollTo,animated:false,目标为当前 offset,不硬编码 y:0
  const body = callbackBody(codeLines(src), HANDLER)
  if (!body) {
    out.push(`${HANDLER} 回调不存在或被摘线`)
  } else {
    if (!/requestAnimationFrame\(/.test(body)) {
      out.push('重测未走 requestAnimationFrame(同帧测量会读到旧布局)')
    }
    if (!/scrollRef\.current\?\.scrollTo\(/.test(body)) out.push('重测缺 scrollTo 调用')
    if (!/animated:\s*false/.test(body)) out.push('scrollTo 未钉 animated:false(会引入重测抖动)')
    if (!new RegExp(`y:\\s*${OFFSET_REF}\\.current`).test(body)) {
      out.push('scrollTo 目标不是当前 offset')
    }
    if (/y:\s*0(?![.\d])/.test(body)) out.push('scrollTo 硬编码 y:0(iOS 上会把下滑用户拽回顶)')
  }

  // ② offset 有源头: handleScroll 必须持续写 scrollOffsetRef.current
  const scrollBody = callbackBody(codeLines(src), 'handleScroll')
  if (!new RegExp(`${OFFSET_REF}\\.current\\s*=`).test(scrollBody)) {
    out.push('scrollOffsetRef 无写入方(offset 恒 0,语义退化为钉顶)')
  }

  // ③ 接线: 首页父 ScrollView 必须挂 onContentSizeChange
  const tag = homeScrollViewOpenTag(code)
  if (!tag) {
    out.push(
      '读不到首页父 ScrollView 开标签(认领属性 contentContainerStyle={shellStyles.scrollContent} 不在任何 ScrollView 上)',
    )
  } else if (!new RegExp(`onContentSizeChange=\\{${HANDLER}\\}`).test(tag)) {
    out.push('首页 ScrollView 未挂 onContentSizeChange(重测不会触发)')
  }

  // ④ 结构未拆栈: 嵌套形态原样(不走 ListHeaderComponent 改栈), AgentShopList 调用点 props 不变
  const shopIdx = code.indexOf('<AgentShopList')
  const closeIdx = code.indexOf('</ScrollView>', shopIdx >= 0 ? shopIdx : 0)
  if (shopIdx < 0 || closeIdx < 0) {
    out.push('AgentShopList 嵌套区段读不到了(结构已变)')
  } else {
    const seg = code.slice(shopIdx, closeIdx)
    if (!/scrollEnabled=\{false\}/.test(seg)) {
      out.push('AgentShopList 不再以 scrollEnabled={false} 嵌套(父级滚动语义被改)')
    }
    if (!/onItemClick=\{handleAgentPress\}/.test(seg)) out.push('AgentShopList 调用点 props 被改')
  }

  return out
}

describe('G-1121552 首页滚动重测接线(onContentSizeChange ⇒ rAF 内 scrollTo)', () => {
  const src = read(RN_HOME)

  it('尺子自证:提取面非空(回调、offset 写入方、ScrollView 标签都读得到)', () => {
    expect(callbackBody(codeLines(src), HANDLER).length).toBeGreaterThan(0)
    expect(callbackBody(codeLines(src), 'handleScroll').length).toBeGreaterThan(0)
    expect(homeScrollViewOpenTag(codeLines(src).join('\n'))).toContain('contentContainerStyle')
  })

  it('现读源码零违规:重测接线存在且语义正确', () => {
    expect(violations(src)).toEqual([])
  })

  it('变异有牙①:摘掉 onContentSizeChange 接线,同一把尺子必须当场读出', () => {
    const tampered = src.replace(`onContentSizeChange={${HANDLER}}`, '')
    expect(tampered).not.toBe(src)
    expect(violations(tampered)).toContain('首页 ScrollView 未挂 onContentSizeChange(重测不会触发)')
  })

  it('变异有牙②:scrollTo 目标退回硬编码 y:0(iOS 拽顶),必须当场读出', () => {
    const tampered = src.replace(
      `scrollRef.current?.scrollTo({ y: ${OFFSET_REF}.current, animated: false })`,
      'scrollRef.current?.scrollTo({ y: 0, animated: false })',
    )
    expect(tampered).not.toBe(src)
    const v = violations(tampered)
    expect(v).toContain('scrollTo 目标不是当前 offset')
    expect(v).toContain('scrollTo 硬编码 y:0(iOS 上会把下滑用户拽回顶)')
  })

  it('变异有牙③:回调里删掉 scrollTo(只剩 rAF 空壳),必须当场读出', () => {
    const tampered = src.replace(
      `      scrollRef.current?.scrollTo({ y: ${OFFSET_REF}.current, animated: false })\n`,
      '',
    )
    expect(tampered).not.toBe(src)
    expect(violations(tampered)).toContain('重测缺 scrollTo 调用')
  })

  it('变异有牙④:AgentShopList 被打开内部滚动/拆栈,必须当场读出', () => {
    // 带缩进上下文:注释里也出现过 scrollEnabled={false}(票面根因描述),不能误中注释
    const tampered = src.replace(
      '\n            scrollEnabled={false}',
      '\n            scrollEnabled={true}',
    )
    expect(tampered).not.toBe(src)
    expect(violations(tampered)).toContain(
      'AgentShopList 不再以 scrollEnabled={false} 嵌套(父级滚动语义被改)',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
