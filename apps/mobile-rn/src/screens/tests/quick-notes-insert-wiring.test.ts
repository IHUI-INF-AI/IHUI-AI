// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D03 插入对话接线断言(mobile-rn 面)
 *
 * 钉一件事:ChatScreen 必须把 QuickNotesOverlay 的 onInsert 真正接进既有输入框通道
 * (setPrompt + composeInsertText 单源拼接),面板入口必须存在。
 * 反向对照:同判据跑在「不接线」的夹具上必须判 false —— 判据不是恒绿。
 *
 * 说明:两端均无 @testing-library/react-native(RN 组件级 RTL 结构性缺位),
 * 本切片的 UI 行为面由共享层真值表(quick-notes-store.test.ts)+ 本接线断言覆盖;
 * 真机观感验证归后续批(交付报告如实登记)。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

/** jsdom 环境下 import.meta.url 非 file scheme,回退包内 cwd(包测试脚本恒在包根跑) */
function resolveChatScreenPath(): string {
  try {
    return fileURLToPath(new URL('../ChatScreen.tsx', import.meta.url))
  } catch {
    return resolve(process.cwd(), 'src/screens/ChatScreen.tsx')
  }
}

const chatScreenPath = resolveChatScreenPath()

export interface WiringCheckResult {
  ok: boolean
  missing: string[]
}

/** 接线判据(正反两面对同一实现) */
export function detectQuickNotesWiring(src: string): WiringCheckResult {
  const missing: string[] = []
  if (!src.includes("import { QuickNotesOverlay } from './QuickNotesScreen'")) {
    missing.push('import QuickNotesOverlay')
  }
  if (!src.includes('<QuickNotesOverlay')) missing.push('mount QuickNotesOverlay')
  if (!src.includes('onInsert={(note) => {')) missing.push('onInsert handler')
  if (!src.includes('setPrompt((p) => composeInsertText(p, text))')) {
    missing.push('insert into setPrompt channel')
  }
  if (!src.includes('setQuickNotesVisible(true)')) missing.push('panel entry opens overlay')
  return { ok: missing.length === 0, missing }
}

describe('ChatScreen 快捷笔记插入接线', () => {
  it('正向:面板挂载 + onInsert 接入 setPrompt 通道 + 入口存在', () => {
    const src = readFileSync(chatScreenPath, 'utf8')
    const result = detectQuickNotesWiring(src)
    expect(result.missing).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('反向对照:不接线时判据必须红(missing 非空)', () => {
    const unwired = `
import { NotesPanel } from '../components/chat/NotesPanel'
const [notesVisible, setNotesVisible] = useState(false)
<NotesPanel visible={notesVisible} onInsertNote={(note) => { setPrompt('x') }} />
`
    const result = detectQuickNotesWiring(unwired)
    expect(result.ok).toBe(false)
    expect(result.missing).toHaveLength(5)
  })

  it('反向对照:挂载但漏接 setPrompt 通道也必须红(半接线拦截)', () => {
    const halfWired = `
import { QuickNotesOverlay } from './QuickNotesScreen'
<QuickNotesOverlay visible onClose={() => {}} onInsert={(note) => { void note }} />
setQuickNotesVisible(true)
`
    const result = detectQuickNotesWiring(halfWired)
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('insert into setPrompt channel')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
