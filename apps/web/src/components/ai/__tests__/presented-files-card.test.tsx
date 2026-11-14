// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 2026-11-14(对标 DSH dsh-client-ui-deliverables):present_files 成功结果不再裸 dump JSON,
// 而是交付清单卡:文件名 + 说明 + 点击在当前 IDE 打开;失败/未收尾/超过 8 个按契约收口。
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

vi.mock('next-intl', () => {
  const ZH: Record<string, string> = {
    toolPresentFiles: '交付文件',
    presentedTitle: '已交付 {count} 个文件',
    argsLabel: '参数',
    resultLabel: '结果',
    errorLabel: '错误',
    statusRunning: '执行中',
    statusSuccess: '已完成',
    statusFailed: '执行失败',
    unitFiles: '{n} 个文件',
    addedCount: '+{n}',
    removedCount: '-{n}',
  }
  const translate = (key: string, params?: Record<string, number>) => {
    const template = ZH[key] ?? key
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (_m, name) => String(params[name] ?? ''))
  }
  return { useTranslations: () => translate }
})

import { ToolCallCard, parsePresentedFiles } from '../tool-call-card'
import { useIDEWorkspace } from '@/stores/ide-workspace'

function setWorkspace() {
  const openFile = vi.fn()
  const setActiveTopTab = vi.fn()
  useIDEWorkspace.setState({
    workspacePath: '/ws',
    openFile,
    setActiveTopTab,
    revealAt: null,
  })
  return { openFile, setActiveTopTab }
}

async function expand(toolName: string) {
  fireEvent.click(screen.getByTestId(`tool-call-row-${toolName}`))
}

afterEach(() => {
  cleanup()
  useIDEWorkspace.setState({ workspacePath: '', revealAt: null })
})

describe('parsePresentedFiles', () => {
  it('优先服务端 presented;大小写去重;上限 8', () => {
    const presented = Array.from({ length: 10 }, (_, i) => ({ path: `out/f${i}.pdf` }))
    presented.push({ path: 'OUT/F0.PDF' })
    const files = parsePresentedFiles(undefined, { presented })
    expect(files).toHaveLength(8)
    expect(files[0]?.path).toBe('out/f0.pdf')
  })

  it('result 缺失/非法 JSON 时退回 args.files,并保留说明', () => {
    const files = parsePresentedFiles(
      { files: [{ path: 'out/report.docx', description: '季度报告' }] },
      'not-json',
    )
    expect(files).toEqual([{ path: 'out/report.docx', description: '季度报告' }])
  })

  it('空路径/非字符串条目被丢弃,不产生死行', () => {
    const files = parsePresentedFiles(undefined, {
      presented: [{ path: '  ' }, { path: 42 }, { path: 'out/a.pdf' }],
    })
    expect(files).toEqual([{ path: 'out/a.pdf' }])
  })
})

describe('交付清单卡', () => {
  it('成功时渲染行并可点开 IDE,原始 JSON 不再展示', async () => {
    const { openFile, setActiveTopTab } = setWorkspace()
    render(
      <ToolCallCard
        toolName="present_files"
        args={{ files: [{ path: 'out/report.pdf', description: '季度报告' }] }}
        result={JSON.stringify({
          tool: 'present_files',
          ok: true,
          presented: [{ path: 'out/report.pdf', description: '季度报告' }],
        })}
        status="success"
      />,
    )
    await expand('present_files')
    expect(screen.getByText('已交付 1 个文件')).toBeTruthy()
    expect(screen.getByText('季度报告')).toBeTruthy()
    fireEvent.click(screen.getByTestId('presented-file-row'))
    expect(openFile).toHaveBeenCalledTimes(1)
    expect(openFile.mock.calls[0]?.[0]).toMatchObject({ path: 'out/report.pdf' })
    expect(setActiveTopTab).toHaveBeenCalledWith('editor')
    expect(screen.queryByTestId('tool-call-result')).toBeNull()
  })

  it('失败态不冒充交付清单(保持原始错误/结果路径)', async () => {
    setWorkspace()
    render(
      <ToolCallCard
        toolName="present_files"
        args={{ files: [{ path: 'out/report.pdf' }] }}
        result={{ ok: false, errorCode: 'INVALID_PATH' }}
        status="error"
        error="INVALID_PATH"
      />,
    )
    await expand('present_files')
    expect(screen.queryByTestId('tool-call-presented-files')).toBeNull()
  })
})
