// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import {
  AigcPublishScreen,
  type AigcPublishFile,
  type AigcPublishScreenProps,
} from '../AigcPublishScreen'

const t = vi.fn((key: string): string => key)

const files: AigcPublishFile[] = [{ id: 'f-1', url: 'https://cdn.example.com/a.png' }]

/**
 * 测试桩:共享屏只消费调用方解析好的明暗档案(真机值来自 ThemeContext.resolvedTheme);
 * 单测固定浅色,避免组件静默落回形参默认值。
 */
const TEST_COLOR_SCHEME: 'light' | 'dark' = 'light'

function renderScreen(overrides: Partial<AigcPublishScreenProps> = {}) {
  const props: AigcPublishScreenProps = {
    t,
    workType: 'image',
    files,
    textContent: '',
    title: '',
    description: '',
    prompt: '',
    urlInput: '',
    saving: false,
    uploading: false,
    error: '',
    onWorkTypeChange: vi.fn(),
    onTextContentChange: vi.fn(),
    onTitleChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onPromptChange: vi.fn(),
    onUrlInputChange: vi.fn(),
    onAddFileByUrl: vi.fn(),
    onPickImage: vi.fn(),
    onRemoveFile: vi.fn(),
    onSubmit: vi.fn(),
    onBack: vi.fn(),
    onToast: vi.fn(),
    colorScheme: TEST_COLOR_SCHEME,
    ...overrides,
  }
  return render(<AigcPublishScreen {...props} />)
}

afterEach(() => {
  cleanup()
  t.mockClear()
})

/**
 * 上传进度端口 — 共享屏只消费宿主写入的 uploadProgress(0-100)。
 * 有值必须渲染真实百分比与进度条;缺省只能 spinner,禁止出现假进度。
 */
describe('AigcPublishScreen 上传进度端口', () => {
  it('注入 uploadProgress ⇒ 按真实百分比渲染文案与进度条', () => {
    const { container } = renderScreen({ uploading: true, uploadProgress: 37 })

    expect(t).toHaveBeenCalledWith('aigcPublish.uploading', { progress: 37 })
    expect(container.querySelector('[testid="aigc-upload-progress"]')).toBeTruthy()
    expect(
      (container.querySelector('[testid="aigc-upload-progress-fill"]') as HTMLElement | null)?.style
        .width,
    ).toBe('37%')
  })

  it('未注入 uploadProgress ⇒ 只有 spinner,不渲染百分比与进度条', () => {
    const { container } = renderScreen({ uploading: true })

    expect(t).toHaveBeenCalledWith('aigcPublish.uploading')
    expect(t).not.toHaveBeenCalledWith('aigcPublish.uploading', expect.anything())
    expect(container.querySelector('[testid="aigc-upload-progress"]')).toBeNull()
  })

  it('uploadProgress 越界 → 收敛到 0-100', () => {
    const { container } = renderScreen({ uploading: true, uploadProgress: 168 })
    expect(t).toHaveBeenCalledWith('aigcPublish.uploading', { progress: 100 })
    expect(
      (container.querySelector('[testid="aigc-upload-progress-fill"]') as HTMLElement | null)?.style
        .width,
    ).toBe('100%')
  })
})
