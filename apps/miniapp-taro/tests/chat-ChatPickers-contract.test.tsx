// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 块 5 ChatPickers 契约测试。
 *
 * 正例：fixture 渲染后断言论案、顺序与过滤可见性；
 * 阴性对照：未触发交互时回调 0 次；源码不含任何平台 API 字面。
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 共享层按 packages/app 的 React 19 产出元素；测试改用同一实例渲染，避免 18/19 混栈。
vi.mock('react', async () => import('../../../packages/app/node_modules/react'))

import { createElement } from 'react'
import { renderToStaticMarkup } from '../../../packages/app/node_modules/react-dom/server'

import { ChatPickers } from '../../../packages/app/src/features/chat/ChatPickers'

const ZH: Record<string, string> = {
  'chat.selectModel': '选择模型',
  'chat.navAgent': '智能体',
  'common.myCreation': '我的创作',
  'common.close': '关闭',
  'common.delete': '删除',
}

const t = (key: string, options?: Record<string, string | number>): string => {
  const text = ZH[key] ?? key
  return options ? `${text}(${JSON.stringify(options)})` : text
}

const SOURCE = resolve(__dirname, '../../../packages/app/src/features/chat/ChatPickers.tsx')
const src = readFileSync(SOURCE, 'utf8')

describe('ChatPickers 正例：模型列表顺序与高亮', () => {
  const onClose = vi.fn()
  const onModelChange = vi.fn()

  const html = renderToStaticMarkup(
    createElement(ChatPickers, {
      t,
      mode: 'model',
      models: [
        { id: 'm1', name: '模型甲', badge: '新' },
        { id: 'm2', name: '模型乙' },
        { id: 'm3', name: '模型丙' },
      ],
      activeModelId: 'm2',
      onClose,
      onModelChange,
    }),
  )

  it('标题与三项模型文案都在，且按传入顺序渲染', () => {
    expect(html).toContain('选择模型')
    expect(html.indexOf('模型甲')).toBeLessThan(html.indexOf('模型乙'))
    expect(html.indexOf('模型乙')).toBeLessThan(html.indexOf('模型丙'))
    expect(html).toContain('新')
  })

  it('当前模型高亮判据在源码里按 activeModelId 等值（不是下标）', () => {
    expect(src).toContain('const active = model.id === activeModelId')
    expect(src).not.toContain('activeModelIndex')
  })

  it('阴性对照：未触发交互，关闭与选择回调均为 0 次', () => {
    expect(onClose).toHaveBeenCalledTimes(0)
    expect(onModelChange).toHaveBeenCalledTimes(0)
  })
})

describe('ChatPickers 正例：Agent 选中项对勾', () => {
  const html = renderToStaticMarkup(
    createElement(ChatPickers, {
      t,
      mode: 'agent',
      agents: [
        { id: 'a1', name: '助手甲', description: '描述甲' },
        { id: 'a2', name: '助手乙', description: '描述乙' },
      ],
      activeAgentId: 'a2',
      onClose: vi.fn(),
      onAgentChange: vi.fn(),
    }),
  )

  it('标题、名称、描述按传入顺序出现', () => {
    expect(html).toContain('智能体')
    expect(html.indexOf('助手甲')).toBeLessThan(html.indexOf('助手乙'))
    expect(html).toContain('描述甲')
    expect(html).toContain('描述乙')
  })

  it('只有选中项带对勾，且全文恰好一个对勾', () => {
    expect(html).toContain('✓')
    expect(html.match(/✓/g) ?? []).toHaveLength(1)
  })
})

describe('ChatPickers 正例：素材分类 tab 与过滤', () => {
  const html = renderToStaticMarkup(
    createElement(ChatPickers, {
      t,
      mode: 'material',
      categories: [
        { key: 'text', label: '文本' },
        { key: 'image', label: '图片' },
        { key: 'video', label: '视频' },
      ],
      activeCategory: 'image',
      materials: [
        { id: 'x', title: '素材甲', category: 'image', meta: '12:00' },
        { id: 'y', title: '素材乙', category: 'text' },
        { id: 'z', title: '素材丙', category: 'image', meta: '09:00' },
      ],
      onClose: vi.fn(),
      onCategoryChange: vi.fn(),
      onMaterialOpen: vi.fn(),
      onMaterialRemove: vi.fn(),
    }),
  )

  it('分类 tab 顺序不变', () => {
    expect(html.indexOf('文本')).toBeLessThan(html.indexOf('图片'))
    expect(html.indexOf('图片')).toBeLessThan(html.indexOf('视频'))
  })

  it('按 activeCategory 过滤但不过滤顺序：甲在前、丙在后、乙不出现', () => {
    expect(html).toContain('素材甲')
    expect(html).toContain('素材丙')
    expect(html).not.toContain('素材乙')
    expect(html.indexOf('素材甲')).toBeLessThan(html.indexOf('素材丙'))
  })

  it('给了 onMaterialRemove 才渲染删除钮（两条素材各一个）', () => {
    expect(html.match(/>删除</g) ?? []).toHaveLength(2)
  })
})

describe('ChatPickers 阴性对照：结构锁与平台 API 扫描', () => {
  it('mode=none 不渲染，且所有回调 0 次', () => {
    const callbacks = {
      onClose: vi.fn(),
      onModelChange: vi.fn(),
      onAgentChange: vi.fn(),
      onCategoryChange: vi.fn(),
      onMaterialOpen: vi.fn(),
      onMaterialRemove: vi.fn(),
    }
    const html = renderToStaticMarkup(createElement(ChatPickers, { t, mode: 'none', ...callbacks }))
    expect(html).toBe('')
    for (const callback of Object.values(callbacks)) {
      expect(callback).toHaveBeenCalledTimes(0)
    }
  })

  it('源码零平台 API：不出现 Taro / fetch / axios / localStorage / Alert / react-navigation', () => {
    expect(src).not.toMatch(/Taro|fetch\(|axios|localStorage|Alert\.|react-navigation/)
    expect(src).not.toMatch(/from 'apps\//)
    expect(src).not.toMatch(/lucide-react-native/)
  })

  it('组件内不取数：没有请求层 import', () => {
    expect(src).not.toMatch(/@ihui\/api-client|@ihui\/shared\/api|request\(/)
  })
})
