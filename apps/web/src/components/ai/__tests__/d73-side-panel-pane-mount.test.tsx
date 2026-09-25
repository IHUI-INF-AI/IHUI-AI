// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D73 多任务窗格(G-100)— 宿主挂载契约测试。
 *
 * 本票此前最高频的死码形态就是「件在库、零引用」:`PaneSplitContainer` / `multi-pane` 判定层 /
 * `pane-split` store 全部已入库并通过各自用例,但宿主 `ai-side-panel.tsx` 长期对它们**零引用**,
 * 于是整条链路在结构上不存在。所以本文件**不**测容器行为(那是 pane-split-container.test.tsx 的
 * 职责),而是**反查消费点**:直接对宿主源码做锚点断言 —— 一旦有人把挂载摘掉、退回到只 import
 * 不渲染、或自立一套第二会话承载,这里当场红。
 *
 * 与既有 `pane-split-mount.test.tsx` 的分工:那份把宿主回调逻辑**抄进测试**再对容器跑,
 * 摘掉宿主挂载它照样绿;本份判的是宿主文件本身,两者互补不互替。
 *
 * 判据分组:
 *   M1 消费点在位(容器被渲染 + 两个委托 prop 真的传了)
 *   M2 判定层真接上宿主(具名 import / reason 字面量落在权威集合内 / 树从 store 读)
 *   M3 词包对账(挂载用到的每个 tp('key') 在五语言 ai.pane.multiPane 解析得出 —— 防运行时 MISSING_MESSAGE)
 *   M4 不新建第二套会话承载(主体唯一)
 *   M5 单窗格零回归(未拆分时主体直挂)
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  FORK_FAILURE_REASONS,
  PANE_MULTI_NAMESPACE,
  type ForkFailureReason,
} from '@ihui/shared/chat/multi-pane'

/** 以 apps/web(vitest 进程工作目录)为基准读仓库内文件(与 d27-delivery-contract 同一姿势) */
function readRepo(relPath: string): string {
  return readFileSync(resolve(process.cwd(), relPath), 'utf-8')
}

/**
 * 默认判真实宿主文件;`D73_HOST_PATH` 是**仅供变异取证**的显式测试通道。
 * 为什么必须有:变异取证要喂"摘掉某一行"的宿主副本来证明本文件真的会红,而**不得**为此
 * 临时改写共享工作区的真实宿主 —— 多会话并发下,那个写入窗口就是别人的提交窗口
 * (本会话第一版取证脚本就真的把 1 行改残留过,靠逐字节还原才收口)。
 * 不设该环境变量时行为与不设完全一致。
 */
const HOST_REL = process.env.D73_HOST_PATH ?? 'src/components/ai/ai-side-panel.tsx'
const host = readRepo(HOST_REL)

/** 五语言共享词包(web 端 useTranslations 的 source) */
const SHARED_LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

/** 抽出宿主里 `tp('key')` 用到的全部键名 */
function hostPaneKeys(src: string): string[] {
  return [...src.matchAll(/\btp\('([A-Za-z][A-Za-z0-9]*)'\)/g)].map((m) => m[1] as string)
}

/** 抽出宿主 `d73ForkIntoPane` 返回的 ForkFailureReason 字面量 */
function hostReturnedReasons(src: string): string[] {
  return [...src.matchAll(/return\s+'([A-Za-z]+)'/g)].map((m) => m[1] as string)
}

describe('M1 D73 消费点:容器在宿主里被真的渲染(拦「件在库零引用」这一本仓最高频死码形态)', () => {
  it('宿主从 @/components/ai/pane-split-container import 了 PaneSplitContainer', () => {
    expect(host).toContain("import { PaneSplitContainer } from '@/components/ai/pane-split-container'")
  })

  it('PaneSplitContainer 在宿主里出现 ≥2 次(import + JSX 渲染位),只 import 不渲染同样判红', () => {
    const hits = host.match(/\bPaneSplitContainer\b/g) ?? []
    expect(hits.length).toBeGreaterThanOrEqual(2)
  })

  it('JSX 渲染位恰好 1 处(不得自立第二份布局壳)', () => {
    expect(host.match(/<PaneSplitContainer\b/g) ?? []).toHaveLength(1)
  })

  it('两个委托 prop 都真的传了(renderPaneContent + onForkConversation)', () => {
    expect(host).toContain('renderPaneContent=')
    expect(host).toContain('onForkConversation=')
  })

  it('渲染点包在宿主给定的定位容器里(data-d73-host 是容器测量分隔条的前提)', () => {
    expect(host).toContain('data-d73-host')
  })
})

describe('M2 D73 判定层:@ihui/shared/chat/multi-pane 真的接进宿主,而不是宿主自立一套词汇', () => {
  it('宿主从 multi-pane 具名 import 了 ROOT_PANE_ID / ForkFailureReason / collectPaneLeaves', () => {
    const block = host.match(/import\s*\{([^}]*)\}\s*from\s*'@ihui\/shared\/chat\/multi-pane'/s)
    expect(block, '宿主必须从判定层(而非端内复制)取这些名字').not.toBeNull()
    const names = (block?.[1] ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^type\s+/, ''))
      .filter(Boolean)
    for (const required of ['ROOT_PANE_ID', 'ForkFailureReason', 'collectPaneLeaves']) {
      expect(names, `multi-pane import 缺少 ${required}`).toContain(required)
    }
  })

  it('宿主窗格树取自 store(单一真相源),不得自己持有第二份布局状态', () => {
    expect(host).toContain("import { usePaneSplitStore } from '@/stores/pane-split'")
    expect(host).toMatch(/usePaneSplitStore\(\(s\)\s*=>\s*s\.tree\)/)
    expect(host).toContain('usePaneSplitStore.getState().tree')
  })

  it('宿主叶数判定走判定层纯函数 collectPaneLeaves,不在端内自己数树', () => {
    expect(host).toContain('collectPaneLeaves(')
    expect(host).not.toMatch(/function\s+\w*[Ll]eaves\b/)
  })

  it('宿主 return 的每个 reason 字面量都在权威 FORK_FAILURE_REASONS 内(判定层是词表唯一真相源)', () => {
    const used = hostReturnedReasons(host).filter((r) =>
      FORK_FAILURE_REASONS.some((allowed) => allowed === r || r.startsWith(allowed)),
    )
    // 至少用到两个真实 reason,否则说明容量/存在性判定被摘了
    expect(used.length).toBeGreaterThanOrEqual(2)
    for (const reason of used) {
      expect(
        (FORK_FAILURE_REASONS as readonly string[]).includes(reason),
        `宿主自造 reason "${reason}" 不在判定层权威集合内`,
      ).toBe(true)
    }
  })

  it('宿主确实声明了返回类型 ForkFailureReason | null(容器据此渲染失败视图,不是靠约定)', () => {
    expect(host).toMatch(/:\s*ForkFailureReason\s*\|\s*null\s*=>/)
  })
})

describe('M3 D73 词包对账:挂载用到的每个键在五语言 ai.pane.multiPane 都解析得出', () => {
  const keys = hostPaneKeys(host)

  it('宿主至少用到 tp() 文案键(拆分入口的 aria-label 走词包,不写死中文)', () => {
    expect(keys.length).toBeGreaterThan(0)
  })

  it.each(SHARED_LOCALES)('%s 的 ai.pane.multiPane 是嵌套对象且含宿主全部键', (locale) => {
    const parsed = JSON.parse(readRepo(`../../packages/i18n/messages/shared/${locale}.json`)) as Record<
      string,
      unknown
    >
    const ns = PANE_MULTI_NAMESPACE.split('.').reduce<unknown>(
      (acc, seg) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[seg] : undefined),
      parsed,
    )
    expect(ns, `${locale} 缺 ${PANE_MULTI_NAMESPACE} 命名空间`).toBeTypeOf('object')
    for (const key of keys) {
      const value = (ns as Record<string, unknown>)[key]
      expect(typeof value, `${locale} 的 ${PANE_MULTI_NAMESPACE}.${key} 缺失/非字符串`).toBe('string')
      expect((value as string).trim().length, `${locale} 的 ${key} 是空串`).toBeGreaterThan(0)
    }
  })

  it('宿主不得用带点的平铺键代替 tp(嵌套键)(check-i18n-keys 对含点键是阻塞项)', () => {
    for (const key of keys) expect(key).not.toContain('.')
  })

  it('拆分入口的 aria-label 与 Tooltip 内容同键(无障碍名与可见文案同源)', () => {
    expect(host).toMatch(/Tooltip content=\{tp\('([A-Za-z]+)'\)\}[\s\S]{0,160}aria-label=\{tp\('\1'\)\}/)
  })
})

describe('M4 D73 边界 1:主体唯一 —— 禁止新建第二套会话承载', () => {
  // 1 / 2 是宿主挂载前(HEAD 基线)自身的实测值:<MessageInput> 有两处是既有形态 ——
  // 一处在**浮窗态**面板(ai-side-panel.tsx 的 float 分支,自带输入框但无 MessageList),
  // 一处在主体会话区。本票的纪律是"挂载不得再加一套",所以断言锚回基线计数而非硬写 1。
  it('宿主里 <MessageList 恰好 1 处(与基线同数;窗格只套布局壳,不再多一套消息流)', () => {
    expect(host.match(/<MessageList\b/g) ?? []).toHaveLength(1)
  })

  it('宿主里 <MessageInput 恰好 2 处(浮窗态 + 主体,与基线同数;本票未新增输入区)', () => {
    expect(host.match(/<MessageInput\b/g) ?? []).toHaveLength(2)
  })

  it('非根窗格只给承载标记,不渲染主体(data-pane-marker 是这一诚实降级的唯一出口)', () => {
    expect(host).toContain('data-pane-marker=')
    expect(host).toMatch(/paneId === ROOT_PANE_ID\s*\?\s*\(\s*[\s\S]{0,120}?d73ConversationBody\(/)
    // 承载标记分支里不得混进主体件(只显窗格 id / 会话 id 两行文本)
    const markerBranch = host.match(/data-pane-marker=\{paneId\}[\s\S]{0,400}?\)/)
    expect(markerBranch, '找不到承载标记分支').not.toBeNull()
    expect(markerBranch?.[0] ?? '').not.toMatch(/<MessageList\b|<MessageInput\b|d73ConversationBody\(/)
  })
})

describe('M5 D73 零回归:未拆分时主体直挂,观感与挂载前一致', () => {
  it('展开判定存在,且未展开分支直接渲染主体(不套容器)', () => {
    expect(host).toMatch(/d73Expanded\s*\?/)
    expect(host).toMatch(/\)\s*:\s*\(\s*\n?\s*d73ConversationBody\(/)
  })

  it('展开态由判定层叶数决定,不由宿主自造的布尔 state 决定', () => {
    expect(host).toMatch(/const d73Expanded = collectPaneLeaves\([^)]*\)\.length > 1/)
    expect(host).not.toMatch(/setD73Expanded|d73Expanded,\s*setD73Expanded/)
  })

  it('拆分入口在收起态才出现(已展开时不得再给重复的拆分钮)', () => {
    expect(host).toMatch(/!d73Expanded && \(/)
  })

  it('窗格承载上限留在宿主(布局层容量决策),且判定层词表仍由 multi-pane 提供', () => {
    const maxMatch = host.match(/D73_MAX_PANES = (\d+)/)
    expect(maxMatch, '宿主必须声明窗格承载上限').not.toBeNull()
    expect(Number(maxMatch?.[1])).toBeGreaterThan(1)
    const reason: ForkFailureReason = 'capacityFull'
    expect(FORK_FAILURE_REASONS).toContain(reason)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
