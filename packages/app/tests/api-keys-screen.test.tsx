// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ApiKeys 共享屏注入面锁。
//
// 判据落在 props 与渲染结果上(不做端判断):
//   ① 空列表 ⇒ 空态
//   ② 新建成功 ⇒ onCreate 收到 name/permissions/rateLimit(默认 60)
//   ③ 复制 ⇒ onCopy 收到 (text, kind),平台件本身不在屏内
//   ④ 吊销确认取消 ⇒ onConfirm 返回 false 时 onDelete 不被调用
//   ⑤ 轮换确认 ⇒ onRotate 被调用
//   ⑥ 一次性 secret 的 2 秒关闭冷却 ⇒ 2 秒内点击无效、2 秒后生效(裁决 1)

import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiKeysScreen } from '../src/features/api-keys/ApiKeysScreen'
import type { ApiKeyInfo } from '@ihui/types'

vi.mock('react-native', () => ({
  View: (p: { children?: unknown }) => createElement('div', null, p.children as never),
  Text: (p: { children?: unknown }) => createElement('span', null, p.children as never),
  ScrollView: (p: { children?: unknown }) => createElement('div', null, p.children as never),
  TextInput: (p: { children?: unknown }) => createElement('input', null, p.children as never),
  ActivityIndicator: () => createElement('i', { 'data-spinner': '' }),
  TouchableOpacity: (p: { children?: unknown; onPress?: () => void; disabled?: boolean }) =>
    createElement('button', { disabled: p.disabled, onClick: p.onPress }, p.children as never),
  StyleSheet: { create: (o: unknown) => o },
}))

vi.mock('lucide-react-native', () => ({
  ChevronDown: () => createElement('i', { 'data-icon': 'chevron-down' }),
  ChevronUp: () => createElement('i', { 'data-icon': 'chevron-up' }),
  Copy: () => createElement('i', { 'data-icon': 'copy' }),
  Eye: () => createElement('i', { 'data-icon': 'eye' }),
  EyeOff: () => createElement('i', { 'data-icon': 'eye-off' }),
  KeyRound: () => createElement('i', { 'data-icon': 'key' }),
  Plus: () => createElement('i', { 'data-icon': 'plus' }),
  Trash2: () => createElement('i', { 'data-icon': 'trash' }),
}))

vi.mock('../src/components/TextField', () => ({
  TextField: (p: {
    value: string
    onChangeText: (v: string) => void
    placeholder?: string
    editable?: boolean
  }) =>
    createElement('input', {
      'data-textfield': '',
      value: p.value,
      placeholder: p.placeholder,
      disabled: p.editable === false,
      onChange: (e: { target: { value: string } }) => p.onChangeText(e.target.value),
    }),
}))

vi.mock('../src/theme/tokens', () => ({
  getTokens: () => ({
    surface: { bg: '#fff', card: '#fff', muted: '#eee' },
    text: { primary: '#111', secondary: '#555', tertiary: '#999' },
    border: { light: '#ddd', medium: '#ccc' },
    brand: { cta: '#1677ff', ctaForeground: '#fff' },
    brandAccent: { deep: '#1677ff', light: '#e6f0ff', foreground: '#1677ff' },
    danger: { DEFAULT: '#f00' },
    success: { DEFAULT: '#0a0' },
  }),
}))

vi.mock('@ihui/design-tokens', () => ({
  rnSpacing: { '2xs': 2, xs: 4, 'xs-loose': 6, sm: 8, 'sm-loose': 10, md: 12, lg: 16, '3xl': 32 },
  rnType: {
    badge: { size: 10 },
    caption: { size: 11 },
    label: { size: 12 },
    bodySm: { size: 13 },
    body: { size: 14 },
    strong: { size: 15 },
    title: { size: 16 },
    heading: { size: 20 },
  },
  rnRadius: { sm: 6, md: 10, lg: 14 },
}))

const t = ((key: string, vars?: Record<string, unknown>) =>
  vars && Object.keys(vars).length > 0 ? `${key}:${JSON.stringify(vars)}` : key) as never

const baseKey: ApiKeyInfo = {
  id: 'k1',
  name: '生产密钥',
  key: 'sk-1234567890abcdefgh',
  permissions: ['chat:write'],
  status: 'active',
  rateLimit: 60,
  lastUsedAt: null,
  createdAt: '2026-11-01T09:00:00Z',
  updatedAt: '2026-11-01T09:00:00Z',
  expiresAt: null,
  allowedIps: null,
  allowedModels: null,
  maxTokensPerReq: null,
} as ApiKeyInfo

const permissionOptions = [{ value: 'chat:write' as const, label: 'chat:write' }]

function baseProps(over: Record<string, unknown> = {}) {
  return {
    t,
    colorScheme: 'light' as const,
    list: [] as ApiKeyInfo[],
    loading: false,
    error: null,
    onReload: vi.fn(),
    permissionOptions,
    defaultPermissions: ['chat:write' as never],
    onCreate: vi.fn(),
    creating: false,
    createError: null,
    secret: null,
    onCloseSecret: vi.fn(),
    onRotate: vi.fn(),
    onDelete: vi.fn(),
    rotatingId: null,
    deletingId: null,
    onLoadUsage: vi.fn(),
    onCopy: vi.fn(),
    onConfirm: vi.fn(async () => true),
    ...over,
  }
}

describe('ApiKeysScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('空列表渲染空态', () => {
    render(createElement(ApiKeysScreen, baseProps()))
    expect(screen.getByText('apiKeys.emptyTitle')).toBeTruthy()
  })

  it('新建成功:onCreate 收到 name/permissions/rateLimit=60', async () => {
    const onCreate = vi.fn(async () => {})
    render(createElement(ApiKeysScreen, baseProps({ onCreate })))
    fireEvent.change(screen.getByPlaceholderText('apiKeys.namePlaceholder'), {
      target: { value: '  测试密钥  ' },
    })
    await act(async () => {
      fireEvent.click(screen.getByText('apiKeys.createButton'))
    })
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate).toHaveBeenCalledWith({
      name: '测试密钥',
      permissions: ['chat:write'],
      rateLimit: 60,
    })
  })

  it('复制回调触发(secret 与列表 key 两个入口)', () => {
    const onCopy = vi.fn()
    render(
      createElement(
        ApiKeysScreen,
        baseProps({
          onCopy,
          list: [baseKey],
          secret: { value: 'sk-secret-once', source: 'create' },
        }),
      ),
    )
    fireEvent.click(screen.getByText('apiKeys.copySecret'))
    expect(onCopy).toHaveBeenCalledWith('sk-secret-once', 'secret')
    const copyIcon = screen.getAllByText((_, el) => el?.getAttribute('data-icon') === 'copy')
    fireEvent.click(copyIcon[0].closest('button') as HTMLElement)
    expect(onCopy).toHaveBeenCalledWith(baseKey.key, 'key')
  })

  it('吊销确认取消:onConfirm 返回 false ⇒ onDelete 不调用', async () => {
    const onDelete = vi.fn()
    const onConfirm = vi.fn(async () => false)
    render(createElement(ApiKeysScreen, baseProps({ list: [baseKey], onDelete, onConfirm })))
    await act(async () => {
      fireEvent.click(screen.getByText('apiKeys.delete'))
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('轮换确认 ⇒ onRotate 收到 id', async () => {
    const onRotate = vi.fn()
    render(createElement(ApiKeysScreen, baseProps({ list: [baseKey], onRotate })))
    await act(async () => {
      fireEvent.click(screen.getByText('apiKeys.rotate'))
    })
    expect(onRotate).toHaveBeenCalledWith('k1')
  })

  it('secret 关闭冷却:2 秒内无效,2 秒后生效', async () => {
    const onCloseSecret = vi.fn()
    render(
      createElement(
        ApiKeysScreen,
        baseProps({
          onCloseSecret,
          secret: { value: 'sk-secret-once', source: 'create' },
        }),
      ),
    )
    const done = screen.getByText('apiKeys.secretDone').closest('button') as HTMLButtonElement
    expect(done.disabled).toBe(true)
    fireEvent.click(done)
    expect(onCloseSecret).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(1999)
    })
    expect(done.disabled).toBe(true)
    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    fireEvent.click(done)
    expect(onCloseSecret).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
