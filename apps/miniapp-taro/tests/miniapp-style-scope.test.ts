// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 小程序「样式类跨页隔离」守门(2026-11-12 立)。
 *
 * ## 要防的是什么(不是风格问题,是显示事故)
 *
 * 小程序 wxss 按页面打包:每个页面各自产出一份 `<page>.wxss`,页面之间不共享
 * (app.wxss 只装全局基础样式)。实测产物:首页 wxss 里 `question-container` 出现 0 次,
 * AI 聊天页出现 3 次。
 *
 * 而 `ChatMessageItem` 是靠 CSS 类取外观的组件 —— `question-container` /
 * `agent-content-item` / `content_agent_nei` / `action-buttons` / `share-btn` 全在
 * `pkg-ai/ai/chat.css`。于是"把 ChatMessageItem 拿到别的页面渲染"= 一堆没有样式定义的
 * className:消息铺成裸文本(没气泡、没左右对齐、没头像位)。构建不报错、类型不报错、
 * 单测不报错 —— 只有真机能看出来。本仓 2026-11-12 就这么踩过一次(首页对话小窗)。
 *
 * ## 判据(为什么不判"哪个文件可以 import 谁")
 *
 * 判"某页必须 import 某 css"太脆:路径一改就误报。这里判不变量:页面源码里出现
 * ChatMessageItem 的引用 ⇒ 该页必须**自己**引入含这些类定义的样式表。
 *
 * 曾经写宽松过一档("引了适配器也算合规"),实测那一档让"首页误用 ChatMessageItem"
 * 整格放过(假绿)—— 适配器只接平台行为,它不会把 chat.css 带进本页 wxss。故只剩一条路。
 *
 * ## 失效方向
 *
 * 取不到源码时只跳过这一格并计入 unreadable,不把"读不到"记成"合规"。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(__dirname, '..')
const SRC = resolve(ROOT, 'src')

/** ChatMessageItem 取外观所依赖的样式类(取首个即可判定"这份 CSS 是否覆盖它")。 */
const REQUIRED_CLASS = 'question-container'

/** 定义该类的样式表(相对 src)。类若搬迁,这里跟着改 —— 判据仍只有一份。 */
const STYLE_SHEET = 'pkg-ai/ai/chat.css'

/** 页面入口:每个页面目录一个,入口是 index.tsx 或与目录同名的那一个。 */
function collectPageSources(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (name === '__tests__' || name === 'node_modules') continue
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      collectPageSources(full, out)
      continue
    }
    if (!/\.tsx$/.test(name)) continue
    const parts = full.split(/[\\/]/)
    const dirName = parts[parts.length - 2] ?? ''
    if (name === 'index.tsx' || name === `${dirName}.tsx`) out.push(full)
  }
  return out
}

/**
 * 剥掉注释再判 —— 否则**注释里提到 ChatMessageItem** 会被当成真实引用。
 * 这不是理论风险:2026-11-12 首页的说明注释里写了三次 "ChatMessageItem",宽松判定下
 * 这条守门对"实际已改回 ChatMessageItem"的反向验证照样全绿(假绿就是这么来的)。
 */
function stripComments(src: string): string {
  const withoutBlock = src.replace(/\/\*[\s\S]*?\*\//g, '')
  // 行注释:排除 `https://` 这类协议里的双斜杠
  return withoutBlock.replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

function read(p: string): string | null {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return null
  }
}

/** 页面是否自己引入了那份样式表(判据只有这一条)。 */
function importsOwnStyleSheet(src: string): boolean {
  return (
    src.includes(STYLE_SHEET) ||
    src.includes(`from './chat.css'`) ||
    src.includes(`import './chat.css'`) ||
    src.includes('ai/chat.css')
  )
}

describe('小程序样式类跨页隔离守门', () => {
  it('任何页面只要渲染 ChatMessageItem,就必须自己引入该类样式表', () => {
    const pageRoots = [join(SRC, 'pages')]
    for (const name of readdirSync(SRC)) {
      if (name.startsWith('pkg-')) pageRoots.push(join(SRC, name))
    }

    const offenders: string[] = []
    const unreadable: string[] = []
    let scanned = 0

    for (const pageRoot of pageRoots) {
      for (const file of collectPageSources(pageRoot)) {
        const src = read(file)
        if (src === null) {
          unreadable.push(relative(ROOT, file))
          continue
        }
        scanned += 1
        // 判据必须整体落在**剥掉注释后的代码**上:
        // `ChatMessageItem` 出现在说明注释里不算引用;`ai/chat.css` 出现在说明注释里也不算引入。
        // 第一版两个判断都读原文,于是"注释里写着 chat.css"把自己判成了合规 ——
        // 实测 offenders 恒为 0,反向验证(把首页改回 ChatMessageItem)照样全绿。
        const code = stripComments(src)
        if (!/\bChatMessageItem\b/.test(code)) continue
        if (!importsOwnStyleSheet(code)) offenders.push(relative(ROOT, file))
      }
    }

    // 尺子自证:一个页面都没扫到 = 扫描面失效,不得被读成"全都合规"
    expect(scanned, '一个页面入口都没扫到 ⇒ 扫描面失效').toBeGreaterThan(10)
    expect(unreadable, '有页面源码取不到 ⇒ 那一格是未判定,不许记为通过').toEqual([])
    expect(
      offenders,
      `以下页面渲染 ChatMessageItem 却没有自己引入 ${STYLE_SHEET}(样式类跨页不共享 ⇒ 会渲染成无样式裸文本):`,
    ).toEqual([])
  })

  it('反向自证:样式表里确实定义了那个类(否则上一条断言恒真)', () => {
    const css = read(resolve(SRC, STYLE_SHEET))
    expect(css, `${STYLE_SHEET} 读不到 ⇒ 守门的第一条断言失去依据`).not.toBeNull()
    expect(css).toContain(`.${REQUIRED_CLASS}`)
  })
})
