// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

import { ToolCallCard } from '../tool-call-card'

/**
 * ToolCallCard `repeated` 徽章渲染守门测试 (§17 UI 改动交付前自验降级方案)
 *
 * 验证去重机制跳过提示徽章的渲染逻辑(tool-call-card.tsx line 198-205):
 *   - repeated=true → 渲染 "已跳过" 徽章
 *   - repeated=false/undefined → 不渲染(向后兼容旧数据无 repeated 字段)
 *   - 徽章带 aria-label 提供无障碍说明
 *   - 与 iteration 徽章(第N轮)共存时两者都渲染
 *
 * 降级说明:web dev server 因其他 agent merge conflict 处于非可用状态,
 * 无法 browser_use 实际渲染验证,降级为 vitest 单元测试(AGENTS.md §17 豁免场景 3)。
 *
 * 断言风格:沿用 Switch.test.tsx 的原生 vitest 断言(getAttribute + toBe / toBeTruthy /
 * toBeNull),项目未引入 @testing-library/jest-dom,故不使用 toBeInTheDocument 等 matcher。
 */
describe('ToolCallCard repeated 徽章渲染', () => {
  afterEach(() => cleanup())

  it('repeated=true 时渲染 "已跳过" 徽章', () => {
    render(
      <ToolCallCard
        toolName="search_codebase"
        args={{ query: 'config' }}
        status="success"
        repeated
      />,
    )
    // getByText 找不到会抛错;这里验证返回的元素真实存在
    expect(screen.getByText('已跳过')).toBeTruthy()
  })

  it('repeated=false 时不渲染 "已跳过" 徽章', () => {
    render(
      <ToolCallCard
        toolName="search_codebase"
        args={{ query: 'config' }}
        status="success"
        repeated={false}
      />,
    )
    expect(screen.queryByText('已跳过')).toBeNull()
  })

  it('repeated=undefined 时不渲染 "已跳过" 徽章(向后兼容旧数据)', () => {
    render(
      <ToolCallCard
        toolName="search_codebase"
        args={{ query: 'config' }}
        status="success"
        // 不传 repeated(模拟旧数据无 repeated 字段)
      />,
    )
    expect(screen.queryByText('已跳过')).toBeNull()
  })

  it('repeated 徽章带 aria-label 提供无障碍说明', () => {
    render(
      <ToolCallCard
        toolName="search_codebase"
        args={{ query: 'config' }}
        status="success"
        repeated
      />,
    )
    const badge = screen.getByText('已跳过')
    expect(badge.getAttribute('aria-label')).toBe(
      'LLM 试图重复调用同参数工具,被去重机制跳过',
    )
  })

  it('repeated 徽章与 iteration 徽章共存时都渲染', () => {
    render(
      <ToolCallCard
        toolName="search_codebase"
        args={{ query: 'config' }}
        status="success"
        iteration={3}
        repeated
      />,
    )
    // iteration 徽章(第3轮)+ repeated 徽章(已跳过)都应渲染
    expect(screen.getByText('第3轮')).toBeTruthy()
    expect(screen.getByText('已跳过')).toBeTruthy()
  })
})

/**
 * ToolCallCard image / summary 类型渲染守门测试。
 *
 * 验证 image_generation(summarize_artifacts)工具命中专用渲染分支,
 * 无匹配数据时回退到 JSON args/result 渲染。展开状态由 header button 控制,
 * 默认 collapsed,需 fireEvent.click 触发展开后才校验内容。
 */
describe('ToolCallCard image rendering', () => {
  afterEach(() => cleanup())

  it('image_generation 工具 + imageUrl 时渲染 <img>', () => {
    render(
      <ToolCallCard
        toolName="image_generation"
        args={{ prompt: '一只猫' }}
        imageUrl="data:image/png;base64,xxx"
        status="success"
      />,
    )
    // 展开卡片
    fireEvent.click(screen.getByText('image_generation').closest('button')!)
    // img 存在 + alt="一只猫"(jsdom 不触发 onLoad,img 仍在 DOM,只是 opacity-0)
    const img = screen.getByAltText('一只猫')
    expect(img).toBeTruthy()
    expect(img.getAttribute('src')).toBe('data:image/png;base64,xxx')
  })

  it('image_generation 工具无 imageUrl 时回退到 JSON 渲染', () => {
    render(
      <ToolCallCard
        toolName="image_generation"
        args={{ prompt: '一只猫' }}
        status="success"
      />,
    )
    fireEvent.click(screen.getByText('image_generation').closest('button')!)
    // 无 img
    expect(screen.queryByRole('img')).toBeNull()
    // 回退到 JSON args 渲染(参数 label 存在)
    expect(screen.getByText('参数')).toBeTruthy()
  })

  it('非 image_generation 工具 + imageUrl 时不渲染 img', () => {
    render(
      <ToolCallCard
        toolName="read_file"
        args={{}}
        imageUrl="data:image/png;base64,xxx"
        status="success"
      />,
    )
    fireEvent.click(screen.getByText('read_file').closest('button')!)
    // imageUrl 仅对 image_generation 生效,read_file 不渲染 img
    expect(screen.queryByRole('img')).toBeNull()
  })
})

describe('ToolCallCard summary rendering', () => {
  afterEach(() => cleanup())

  it('summarize_artifacts + summaryData 时渲染聚合视图', () => {
    render(
      <ToolCallCard
        toolName="summarize_artifacts"
        args={{}}
        summaryData={{
          plans: [{ id: 'p1', title: 'Plan A', status: 'completed' }],
          sources: [{ type: 'file', ref: 'src/foo.ts' }],
          tool_calls_summary: { total: 5, by_tool: { read_file: 3, write_file: 2 } },
        }}
        status="success"
      />,
    )
    fireEvent.click(screen.getByText('summarize_artifacts').closest('button')!)
    expect(screen.getByText('计划 (1)')).toBeTruthy()
    expect(screen.getByText('引用 (1)')).toBeTruthy()
    expect(screen.getByText('工具调用 (5 次)')).toBeTruthy()
    // by_tool 徽章
    expect(screen.getByText('read_file × 3')).toBeTruthy()
    expect(screen.getByText('write_file × 2')).toBeTruthy()
  })

  it('summarize_artifacts 无 summaryData 时回退到 JSON', () => {
    render(
      <ToolCallCard
        toolName="summarize_artifacts"
        args={{}}
        status="success"
      />,
    )
    fireEvent.click(screen.getByText('summarize_artifacts').closest('button')!)
    // 无聚合视图标题
    expect(screen.queryByText(/^计划/)).toBeNull()
    // 回退到 JSON(参数 label)
    expect(screen.getByText('参数')).toBeTruthy()
  })

  it('summary sources 超过 5 个时显示 "还有 N 个"', () => {
    const sources = Array.from({ length: 7 }, (_, i) => ({ type: 'file', ref: `file${i}.ts` }))
    render(
      <ToolCallCard
        toolName="summarize_artifacts"
        args={{}}
        summaryData={{ sources }}
        status="success"
      />,
    )
    fireEvent.click(screen.getByText('summarize_artifacts').closest('button')!)
    // 前 5 个 ref 渲染 + "... 还有 2 个" 提示
    expect(screen.getByText('file0.ts')).toBeTruthy()
    expect(screen.getByText('file4.ts')).toBeTruthy()
    expect(screen.getByText('... 还有 2 个')).toBeTruthy()
  })

  it('summary plans 状态为 completed 渲染绿色徽章', () => {
    render(
      <ToolCallCard
        toolName="summarize_artifacts"
        args={{}}
        summaryData={{
          plans: [{ id: 'p1', title: 'Plan A', status: 'completed' }],
        }}
        status="success"
      />,
    )
    fireEvent.click(screen.getByText('summarize_artifacts').closest('button')!)
    const badge = screen.getByText('completed')
    expect(badge).toBeTruthy()
    // 绿色徽章类含 green-600
    expect(badge.getAttribute('class')).toContain('green-600')
  })

  it('image 和 summary 都不存在时仍渲染 JSON', () => {
    render(
      <ToolCallCard
        toolName="read_file"
        args={{ path: '/tmp/test.txt' }}
        result={{ content: 'hello' }}
        status="success"
      />,
    )
    fireEvent.click(screen.getByText('read_file').closest('button')!)
    // args/result JSON 渲染(参数 + 结果 label)
    expect(screen.getByText('参数')).toBeTruthy()
    expect(screen.getByText('结果')).toBeTruthy()
  })
})
