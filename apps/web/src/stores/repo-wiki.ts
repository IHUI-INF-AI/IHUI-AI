// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createPersistConfig } from '@/stores/persist-helpers'

/**
 * Repo Wiki / 知识卡片(W29,2026-09-14 立,对标 Qoder Repo Wiki):
 * - 四类卡片:architecture(架构)/ api(接口)/ pattern(模式)/ pitfall(陷阱)
 * - zustand persist 本地持久化(localStorage key: ihui-repo-wiki)
 * - 自动捕获:autoCapture 开启时,消息收尾(send-message.ts)调用 maybeAutoCaptureWiki,
 *   用 LLM 从「用户问题 + 助手回复」中提取一条知识卡片(失败静默,不打断主链路)
 * - 手动生成:面板「生成卡片」按钮对最近一轮问答触发同一路径
 * - wikiToMarkdown():全部卡片序列化为 Markdown,供复制/导出
 */

export type WikiCategory = 'architecture' | 'api' | 'pattern' | 'pitfall'

export const WIKI_CATEGORIES: WikiCategory[] = ['architecture', 'api', 'pattern', 'pitfall']

export interface WikiCard {
  id: string
  category: WikiCategory
  title: string
  content: string
  conversationId?: string
  createdAt: number
  updatedAt: number
}

/** 自动捕获最低回复长度(过短回复通常无知识密度) */
const AUTO_CAPTURE_MIN_ANSWER = 200

/** 自动捕获的问答上下文截断长度 */
const CAPTURE_SLICE = 4000

interface RepoWikiState {
  cards: WikiCard[]
  autoCapture: boolean
  add: (category: WikiCategory, title: string, content: string, conversationId?: string) => void
  remove: (id: string) => void
  clear: () => void
  toggleAutoCapture: () => void
}

function genWikiId(): string {
  return `wiki-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const useRepoWikiStore = create<RepoWikiState>()(
  persist(
    (set) => ({
      cards: [],
      autoCapture: false,
      add: (category, title, content, conversationId) =>
        set((s) => {
          const t = title.trim()
          const c = content.trim()
          if (!t || !c) return s
          const now = Date.now()
          const card: WikiCard = {
            id: genWikiId(),
            category,
            title: t,
            content: c,
            createdAt: now,
            updatedAt: now,
            ...(conversationId ? { conversationId } : {}),
          }
          return { cards: [...s.cards, card] }
        }),
      remove: (id) => set((s) => ({ cards: s.cards.filter((x) => x.id !== id) })),
      clear: () => set({ cards: [] }),
      toggleAutoCapture: () => set((s) => ({ autoCapture: !s.autoCapture })),
    }),
    createPersistConfig<RepoWikiState>('ihui-repo-wiki'),
  ),
)

/** LLM 返回的卡片草稿(容错解析) */
interface WikiDraft {
  category: WikiCategory
  title: string
  content: string
}

const VALID_CATEGORIES = new Set<WikiCategory>(WIKI_CATEGORIES)

/**
 * 从 JSON 文本容错提取卡片草稿:
 * - 剥离 ```json 围栏 / 前后噪声,取首个 {…} 平衡块
 * - category 不合法时归为 pattern
 */
export function parseWikiDraft(raw: string): WikiDraft | null {
  const start = raw.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let end = -1
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end < 0) return null
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
    const title = typeof obj.title === 'string' ? obj.title.trim() : ''
    const content = typeof obj.content === 'string' ? obj.content.trim() : ''
    if (!title || !content) return null
    const cat = typeof obj.category === 'string' ? (obj.category as WikiCategory) : 'pattern'
    return {
      category: VALID_CATEGORIES.has(cat) ? cat : 'pattern',
      title,
      content,
    }
  } catch {
    return null
  }
}

/**
 * LLM 提取知识卡片(单副本直调):
 * - 无有效草稿(如回答为闲聊)时返回 null
 * - 由调用方决定入兜底类目
 */
export async function extractWikiDraft(
  question: string,
  answer: string,
): Promise<WikiDraft | null> {
  const { runBestOfN } = await import('@/api/best-of-api')
  const prompt = [
    '你是代码知识库管理员。从下面一轮「用户问题 + 助手回答」中提取一条可沉淀的工程知识卡片。',
    '只输出一个 JSON 对象,不要输出其他文字,字段:',
    '{"category":"architecture|api|pattern|pitfall","title":"一行标题(<=30字)","content":"知识正文(Markdown,<=500字,保留关键代码符号/命令)"}',
    'category 含义:architecture=架构/模块关系,api=接口/函数用法,pattern=可复用模式/最佳实践,pitfall=踩坑/限制。',
    '若该轮问答无沉淀价值(寒暄/闲聊/纯状态确认),只输出 {}。',
    '',
    `用户问题:\n${question.slice(0, CAPTURE_SLICE)}`,
    '',
    `助手回答:\n${answer.slice(0, CAPTURE_SLICE)}`,
  ].join('\n')
  const d = await runBestOfN(prompt, 1)
  const raw = d.candidates[0]?.content ?? ''
  return parseWikiDraft(raw)
}

/**
 * 自动捕获入口(W29):send-message.ts 流收尾(成功路径)调用,fire-and-forget。
 * - autoCapture 关闭 / 回答过短时直接跳过
 * - 任何失败静默(不 toast 不抛错,不打断主链路)
 * - 去重:同标题卡片已存在时跳过
 */
export function maybeAutoCaptureWiki(
  question: string,
  answer: string,
  conversationId?: string,
): void {
  const { autoCapture } = useRepoWikiStore.getState()
  if (!autoCapture) return
  if (answer.trim().length < AUTO_CAPTURE_MIN_ANSWER) return
  void (async () => {
    try {
      const draft = await extractWikiDraft(question, answer)
      if (!draft) return
      const dup = useRepoWikiStore.getState().cards.some((c) => c.title === draft.title)
      if (dup) return
      useRepoWikiStore.getState().add(draft.category, draft.title, draft.content, conversationId)
    } catch {
      // 静默:知识捕获属增值能力,失败不影响对话主链路
    }
  })()
}

/**
 * 全部卡片序列化为分组 Markdown(按类目分组,类目顺序固定):
 * # Repo Wiki\n\n## architecture\n\n### title\ncontent\n…
 */
export function wikiToMarkdown(cards: WikiCard[]): string {
  const lines: string[] = ['# Repo Wiki', '']
  for (const cat of WIKI_CATEGORIES) {
    const items = cards.filter((c) => c.category === cat)
    if (items.length === 0) continue
    lines.push(`## ${cat}`, '')
    for (const item of items) {
      lines.push(`### ${item.title}`, '', item.content, '')
    }
  }
  return lines.join('\n')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
