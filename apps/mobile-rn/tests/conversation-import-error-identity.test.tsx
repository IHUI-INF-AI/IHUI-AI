// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 导入屏错误身份对账(「错误身份收口」第三格)
 *
 * 钉的是 ConversationImportScreen wrapper 两处失败出口:
 *  - onParse(fetchApi /parse)返回失败时 `ImportParseResult.error` 的文案;
 *  - onLoadHistory(getConversationImportHistory)失败时抛给共享渲染器的 Error message。
 * 两处都曾经直取 `res.error` —— 身份(status/errorCode)不参与判序,401 的
 * 「Invalid or expired token」要么裸串上屏,要么被文案正则错判成「提交的信息有误」。
 *
 * 判序本身在守门 135 / 第五十三波的出口单测里;这里钉的是**这两站把 res 整体交给了
 * 唯一出口**(注入带 status 的 401,屏幕必须显出「重新登录」类文案),并用「同一消息、
 * 不带 status」作对照 —— 对照支显出「提交的信息有误」才证明判别的正是 status,
 * 而不是这条测试恰好写死了一个答案。
 *
 * 夹具沿用同目录 conversation-import.test.tsx(@ihui/rn-app 由 vitest alias 走真实共享
 * 渲染器,测的是真联动;给它写 mock 就等于测 mock)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { rnMocks } = vi.hoisted(() => ({
  rnMocks: {
    getDocumentAsync: vi.fn(),
    fetchApi: vi.fn(),
    commitConversationImport: vi.fn(),
    getConversationImportHistory: vi.fn(),
    goBack: vi.fn(),
  },
}))

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: rnMocks.getDocumentAsync,
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: rnMocks.fetchApi,
  commitConversationImport: rnMocks.commitConversationImport,
  getConversationImportHistory: rnMocks.getConversationImportHistory,
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: rnMocks.goBack, navigate: vi.fn() }),
}))

vi.mock('../src/i18n', () => ({
  // 带 { error } 的模板把插值拼进返回值 —— 历史失败的到端文案只能这样断言
  useI18n: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options && typeof options.error === 'string' ? `${key}|${options.error}` : key,
  }),
}))

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

vi.mock('../src/components/NavBar', async () => {
  const { createElement } = await import('react')
  return {
    NavBar: ({ title, onBack }: { title?: string; onBack?: () => void }) =>
      createElement(
        'div',
        null,
        createElement('button', { onClick: onBack }, 'back'),
        createElement('span', null, title ?? ''),
      ),
  }
})

import { ConversationImportScreen } from '../src/screens/ConversationImportScreen'

const HISTORY_OK = {
  success: true as const,
  data: { list: [], total: 0 },
}

function mockPickedFile(): void {
  rnMocks.getDocumentAsync.mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: 'file:///cache/export.jsonl',
        name: 'export.jsonl',
        mimeType: 'application/jsonl',
        size: 2048,
      },
    ],
  })
}

beforeEach(() => {
  rnMocks.getConversationImportHistory.mockReset()
  rnMocks.getConversationImportHistory.mockResolvedValue(HISTORY_OK)
  rnMocks.fetchApi.mockReset()
})

async function renderAndPick(): Promise<void> {
  mockPickedFile()
  render(<ConversationImportScreen />)
  await waitFor(() => expect(rnMocks.getConversationImportHistory).toHaveBeenCalled())
  fireEvent.click(screen.getByText('conversationImport.sourceClaudeCode'))
  fireEvent.click(screen.getByText('conversationImport.pickFile'))
  await waitFor(() => expect(rnMocks.fetchApi).toHaveBeenCalledTimes(1))
}

describe('ConversationImport 错误身份(解析 / 历史两站)', () => {
  it('解析 401:页面显示「重新登录」类文案,不显示「提交的信息有误」也不裸显英文', async () => {
    rnMocks.fetchApi.mockResolvedValue({
      success: false,
      error: 'Invalid or expired token',
      status: 401,
    })
    await renderAndPick()

    await waitFor(() => expect(screen.getByText('登录已过期,请重新登录')).toBeTruthy())
    expect(screen.queryByText('提交的信息有误,请检查后重试')).toBeNull()
    expect(screen.queryByText('Invalid or expired token')).toBeNull()
  })

  it('对照(同一消息、不带 status):只能落到参数类文案 —— 证明上一条判别的正是 status', async () => {
    rnMocks.fetchApi.mockResolvedValue({
      success: false,
      error: 'Invalid or expired token',
    })
    await renderAndPick()

    await waitFor(() => expect(screen.getByText('提交的信息有误,请检查后重试')).toBeTruthy())
    expect(screen.queryByText('登录已过期,请重新登录')).toBeNull()
  })

  it('对照(服务端中文文案):按原判序原样上屏,不被出口改写成通用文案', async () => {
    rnMocks.fetchApi.mockResolvedValue({
      success: false,
      error: '导出文件内容不符合所选来源格式',
    })
    await renderAndPick()

    await waitFor(() => expect(screen.getByText('导出文件内容不符合所选来源格式')).toBeTruthy())
  })

  it('历史加载 401:抛出前身份已判序,共享渲染器插值出「重新登录」类文案', async () => {
    rnMocks.getConversationImportHistory.mockResolvedValue({
      success: false,
      error: 'Invalid or expired token',
      status: 401,
    })
    render(<ConversationImportScreen />)

    await waitFor(() =>
      expect(screen.getByText(/conversationImport\.historyFailed\|登录已过期/)).toBeTruthy(),
    )
    expect(screen.queryByText(/提交的信息有误/)).toBeNull()
  })

  it('对照(历史加载、不带 status):同一 message 落「提交的信息有误」—— 判别的仍是 status', async () => {
    rnMocks.getConversationImportHistory.mockResolvedValue({
      success: false,
      error: 'Invalid or expired token',
    })
    render(<ConversationImportScreen />)

    await waitFor(() =>
      expect(screen.getByText(/conversationImport\.historyFailed\|提交的信息有误/)).toBeTruthy(),
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
