// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, screen } from '@testing-library/react'

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
