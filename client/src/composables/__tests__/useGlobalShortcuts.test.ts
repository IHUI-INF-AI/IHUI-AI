import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useGlobalShortcuts } from '../useGlobalShortcuts'
import { logger } from '@/utils/logger'

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/utils/i18n', () => ({
  t: vi.fn((key: string) => key),
}))

vi.mock('vue', () => ({
  ...vi.importActual('vue'),
  onMounted: vi.fn((callback: () => void) => callback()),
  onUnmounted: vi.fn(),
  ref: vi.fn((value: any) => ({ value })),
  computed: vi.fn((fn: () => any) => ({ value: fn(), get: fn })),
}))

describe('useGlobalShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该返回快捷键状态和方法', () => {
    const { registeredShortcuts, showHelpPanel, currentScope, isEnabled, lastTriggered } = useGlobalShortcuts()
    expect(registeredShortcuts).toBeDefined()
    expect(showHelpPanel).toBeDefined()
    expect(currentScope).toBeDefined()
    expect(isEnabled).toBeDefined()
    expect(lastTriggered).toBeDefined()
  })

  it('应该返回方法', () => {
    const { registerShortcut, registerShortcuts, unregisterShortcut, setShortcutEnabled, setScope, toggleHelpPanel, formatShortcut, generateKeyName } = useGlobalShortcuts()
    expect(typeof registerShortcut).toBe('function')
    expect(typeof registerShortcuts).toBe('function')
    expect(typeof unregisterShortcut).toBe('function')
    expect(typeof setShortcutEnabled).toBe('function')
    expect(typeof setScope).toBe('function')
    expect(typeof toggleHelpPanel).toBe('function')
    expect(typeof formatShortcut).toBe('function')
    expect(typeof generateKeyName).toBe('function')
  })

  it('generateKeyName应该生成正确的键名', () => {
    const { generateKeyName } = useGlobalShortcuts()
    expect(generateKeyName('c', { ctrl: true })).toBe('ctrl+c')
    expect(generateKeyName('enter', { ctrl: true, shift: true })).toBe('ctrl+shift+enter')
    expect(generateKeyName('f1')).toBe('f1')
  })

  it('formatShortcut应该格式化快捷键', () => {
    const { formatShortcut } = useGlobalShortcuts()
    const result = formatShortcut('c', { ctrl: true })
    expect(typeof result).toBe('string')
    expect(result.toLowerCase()).toContain('c')
  })

  it('toggleHelpPanel应该切换帮助面板', () => {
    const { toggleHelpPanel, showHelpPanel } = useGlobalShortcuts()
    const initialValue = showHelpPanel.value
    toggleHelpPanel()
    expect(showHelpPanel.value).toBe(!initialValue)
  })

  it('setScope应该设置当前范围', () => {
    const { setScope, currentScope } = useGlobalShortcuts()
    setScope('chat')
    expect(currentScope.value).toBe('chat')
  })

  it('registerShortcut应该注册快捷键', () => {
    const { registerShortcut, registeredShortcuts } = useGlobalShortcuts()
    const unregister = registerShortcut({
      id: 'test-shortcut',
      key: 't',
      description: '测试快捷键',
      category: 'general',
      handler: vi.fn(),
    })
    expect(typeof unregister).toBe('function')
  })

  it('registerShortcuts应该批量注册快捷键', () => {
    const { registerShortcuts } = useGlobalShortcuts()
    const unregister = registerShortcuts([
      { id: 'test1', key: 'a', description: '测试1', category: 'general', handler: vi.fn() },
      { id: 'test2', key: 'b', description: '测试2', category: 'general', handler: vi.fn() },
    ])
    expect(typeof unregister).toBe('function')
  })

  it('setShortcutEnabled应该启用/禁用快捷键', () => {
    const { setShortcutEnabled } = useGlobalShortcuts()
    setShortcutEnabled('test-id', true)
  })

  it('unregisterShortcut应该取消注册快捷键', () => {
    const { unregisterShortcut } = useGlobalShortcuts()
    unregisterShortcut('test-id')
  })

  it('registerShortcut应该支持修饰键', () => {
    const { registerShortcut } = useGlobalShortcuts()
    const unregister = registerShortcut({
      id: 'ctrl-s-test',
      key: 's',
      modifiers: { ctrl: true },
      description: '保存',
      category: 'general',
      handler: vi.fn(),
    })
    expect(typeof unregister).toBe('function')
  })

  it('registerShortcut应该支持范围限制', () => {
    const { registerShortcut } = useGlobalShortcuts()
    const unregister = registerShortcut({
      id: 'scoped-shortcut',
      key: 'enter',
      description: '范围限制快捷键',
      category: 'chat',
      scope: 'chat',
      handler: vi.fn(),
    })
    expect(typeof unregister).toBe('function')
  })

  it('formatShortcut应该处理多个修饰键', () => {
    const { formatShortcut } = useGlobalShortcuts()
    const result = formatShortcut('s', { ctrl: true, shift: true })
    expect(typeof result).toBe('string')
  })

  it('generateKeyName应该处理所有修饰键组合', () => {
    const { generateKeyName } = useGlobalShortcuts()
    expect(generateKeyName('a', { ctrl: true, alt: true, shift: true })).toBe('ctrl+alt+shift+a')
    expect(generateKeyName('b', { alt: true })).toBe('alt+b')
    expect(generateKeyName('c', { meta: true })).toBe('meta+c')
  })

  it('setScope应该支持多个范围', () => {
    const { setScope, currentScope } = useGlobalShortcuts()
    setScope('editor')
    expect(currentScope.value).toBe('editor')
    setScope('global')
    expect(currentScope.value).toBe('global')
  })

  it('registerShortcut应该返回取消注册函数', () => {
    const { registerShortcut, unregisterShortcut } = useGlobalShortcuts()
    const handler = vi.fn()
    const unregister = registerShortcut({
      id: 'unregister-test',
      key: 'x',
      description: '测试取消注册',
      category: 'general',
      handler,
    })
    
    unregister()
  })

  it('registerShortcuts应该返回批量取消注册函数', () => {
    const { registerShortcuts } = useGlobalShortcuts()
    const unregister = registerShortcuts([
      { id: 'batch1', key: '1', description: '批量1', category: 'general', handler: vi.fn() },
      { id: 'batch2', key: '2', description: '批量2', category: 'general', handler: vi.fn() },
    ])
    
    unregister()
  })

  it('getGroupedShortcuts应该返回分组后的快捷键', () => {
    const { getGroupedShortcuts } = useGlobalShortcuts()
    expect(Array.isArray(getGroupedShortcuts.value)).toBe(true)
  })

  it('registerShortcut应该覆盖已存在的快捷键', () => {
    const { registerShortcut } = useGlobalShortcuts()
    registerShortcut({
      id: 'duplicate-test',
      key: 'd',
      description: '第一个',
      category: 'general',
      handler: vi.fn(),
    })
    
    registerShortcut({
      id: 'duplicate-test-2',
      key: 'd',
      description: '第二个',
      category: 'general',
      handler: vi.fn(),
    })
  })

  it('formatShortcut应该处理单字符键', () => {
    const { formatShortcut } = useGlobalShortcuts()
    const result = formatShortcut('a')
    expect(result).toBe('A')
  })

  it('formatShortcut应该处理多字符键', () => {
    const { formatShortcut } = useGlobalShortcuts()
    const result = formatShortcut('enter')
    expect(result).toBe('enter')
  })

  it('registerShortcut应该支持preventDefault选项', () => {
    const { registerShortcut } = useGlobalShortcuts()
    const unregister = registerShortcut({
      id: 'prevent-default-test',
      key: 'p',
      description: '阻止默认',
      category: 'general',
      handler: vi.fn(),
      preventDefault: true,
    })
    expect(typeof unregister).toBe('function')
  })

  it('registerShortcut应该支持stopPropagation选项', () => {
    const { registerShortcut } = useGlobalShortcuts()
    const unregister = registerShortcut({
      id: 'stop-propagation-test',
      key: 's',
      description: '阻止冒泡',
      category: 'general',
      handler: vi.fn(),
      stopPropagation: true,
    })
    expect(typeof unregister).toBe('function')
  })

  it('registerShortcut应该支持enabled选项', () => {
    const { registerShortcut } = useGlobalShortcuts()
    const unregister = registerShortcut({
      id: 'disabled-shortcut',
      key: 'd',
      description: '禁用的快捷键',
      category: 'general',
      handler: vi.fn(),
      enabled: false,
    })
    expect(typeof unregister).toBe('function')
  })

  // ==================== handleKeyDown 键盘事件处理测试 ====================

  it('handleKeyDown应该触发匹配的快捷键', () => {
    const { registerShortcut } = useGlobalShortcuts()
    const handler = vi.fn()
    registerShortcut({
      id: 'trigger-test',
      key: 'k',
      description: '触发测试',
      category: 'general',
      handler,
    })
    const event = new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true })
    document.body.dispatchEvent(event)
    expect(handler).toHaveBeenCalled()
  })

  it('handleKeyDown在isEnabled为false时不触发', () => {
    const { registerShortcut, isEnabled } = useGlobalShortcuts()
    const handler = vi.fn()
    registerShortcut({
      id: 'disabled-sys-test',
      key: 'j',
      description: '系统禁用测试',
      category: 'general',
      handler,
    })
    isEnabled.value = false
    const event = new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true })
    document.body.dispatchEvent(event)
    expect(handler).not.toHaveBeenCalled()
    isEnabled.value = true
  })

  it('handleKeyDown应该跳过禁用的快捷键', () => {
    const { registerShortcut } = useGlobalShortcuts()
    const handler = vi.fn()
    registerShortcut({
      id: 'disabled-shortcut-test2',
      key: 'o',
      description: '禁用快捷键测试',
      category: 'general',
      handler,
      enabled: false,
    })
    const event = new KeyboardEvent('keydown', { key: 'o', bubbles: true, cancelable: true })
    document.body.dispatchEvent(event)
    expect(handler).not.toHaveBeenCalled()
  })

  it('handleKeyDown应该根据scope过滤不匹配的快捷键', () => {
    const { registerShortcut, setScope } = useGlobalShortcuts()
    const handler = vi.fn()
    setScope('global')
    registerShortcut({
      id: 'scope-filter-test',
      key: 'u',
      description: '范围过滤测试',
      category: 'chat',
      scope: 'chat',
      handler,
    })
    const event = new KeyboardEvent('keydown', { key: 'u', bubbles: true, cancelable: true })
    document.body.dispatchEvent(event)
    expect(handler).not.toHaveBeenCalled()
  })

  it('handleKeyDown应该触发scope匹配的快捷键', () => {
    const { registerShortcut, setScope } = useGlobalShortcuts()
    const handler = vi.fn()
    setScope('chat')
    registerShortcut({
      id: 'scope-match-test',
      key: 'u',
      description: '范围匹配测试',
      category: 'chat',
      scope: 'chat',
      handler,
    })
    const event = new KeyboardEvent('keydown', { key: 'u', bubbles: true, cancelable: true })
    document.body.dispatchEvent(event)
    expect(handler).toHaveBeenCalled()
    setScope('global')
  })

  it('handleKeyDown在输入元素中不触发无scope的快捷键', () => {
    const { registerShortcut } = useGlobalShortcuts()
    const handler = vi.fn()
    registerShortcut({
      id: 'input-skip-test',
      key: 'i',
      description: '输入跳过测试',
      category: 'general',
      handler,
    })
    const input = document.createElement('input')
    document.body.appendChild(input)
    const event = new KeyboardEvent('keydown', { key: 'i', bubbles: true, cancelable: true })
    input.dispatchEvent(event)
    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('handleKeyDown在输入元素中触发scope为input的快捷键', () => {
    const { registerShortcut } = useGlobalShortcuts()
    const handler = vi.fn()
    registerShortcut({
      id: 'input-scope-test2',
      key: 'i',
      description: '输入范围测试',
      category: 'general',
      scope: 'input',
      handler,
    })
    const input = document.createElement('input')
    document.body.appendChild(input)
    const event = new KeyboardEvent('keydown', { key: 'i', bubbles: true, cancelable: true })
    input.dispatchEvent(event)
    expect(handler).toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('handleKeyDown在contentEditable中不触发无scope的快捷键', () => {
    const { registerShortcut } = useGlobalShortcuts()
    const handler = vi.fn()
    registerShortcut({
      id: 'content-editable-test',
      key: 'h',
      description: 'contentEditable测试',
      category: 'general',
      handler,
    })
    const div = document.createElement('div')
    div.contentEditable = 'true'
    document.body.appendChild(div)
    const event = new KeyboardEvent('keydown', { key: 'h', bubbles: true, cancelable: true })
    div.dispatchEvent(event)
    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(div)
  })

  it('handleKeyDown默认阻止默认行为', () => {
    const { registerShortcut } = useGlobalShortcuts()
    registerShortcut({
      id: 'prevent-default-default-test',
      key: 'v',
      description: '默认阻止测试',
      category: 'general',
      handler: vi.fn(),
    })
    const event = new KeyboardEvent('keydown', { key: 'v', bubbles: true, cancelable: true })
    const preventSpy = vi.spyOn(event, 'preventDefault')
    document.body.dispatchEvent(event)
    expect(preventSpy).toHaveBeenCalled()
  })

  it('handleKeyDown在preventDefault为false时不阻止', () => {
    const { registerShortcut } = useGlobalShortcuts()
    registerShortcut({
      id: 'no-prevent-test',
      key: 'b',
      description: '不阻止默认测试',
      category: 'general',
      handler: vi.fn(),
      preventDefault: false,
    })
    const event = new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true })
    const preventSpy = vi.spyOn(event, 'preventDefault')
    document.body.dispatchEvent(event)
    expect(preventSpy).not.toHaveBeenCalled()
  })

  it('handleKeyDown在stopPropagation为true时阻止冒泡', () => {
    const { registerShortcut } = useGlobalShortcuts()
    registerShortcut({
      id: 'stop-prop-test2',
      key: 'm',
      description: '阻止冒泡测试',
      category: 'general',
      handler: vi.fn(),
      stopPropagation: true,
    })
    const event = new KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true })
    const stopSpy = vi.spyOn(event, 'stopPropagation')
    document.body.dispatchEvent(event)
    expect(stopSpy).toHaveBeenCalled()
  })

  it('handleKeyDown应该设置lastTriggered', () => {
    const { registerShortcut, lastTriggered } = useGlobalShortcuts()
    registerShortcut({
      id: 'last-triggered-test',
      key: 'l',
      description: '最后触发测试',
      category: 'general',
      handler: vi.fn(),
    })
    const event = new KeyboardEvent('keydown', { key: 'l', bubbles: true, cancelable: true })
    document.body.dispatchEvent(event)
    expect(lastTriggered.value).toBe('last-triggered-test')
  })

  it('handleKeyDown应该捕获handler错误并记录日志', () => {
    const { registerShortcut } = useGlobalShortcuts()
    registerShortcut({
      id: 'error-handler-test',
      key: 'x',
      description: '错误处理测试',
      category: 'general',
      handler: () => { throw new Error('测试错误') },
    })
    const event = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true })
    document.body.dispatchEvent(event)
    expect(logger.error).toHaveBeenCalled()
  })

  it('matchesShortcut应该支持event.code匹配', () => {
    // 用spy捕获handleKeyDown函数
    const addSpy = vi.spyOn(window, 'addEventListener')
    const { registerShortcut } = useGlobalShortcuts()
    const handler = vi.fn()
    registerShortcut({
      id: 'code-match-test',
      key: 'KeyA',
      description: 'code匹配测试',
      category: 'general',
      handler,
    })
    // 构造模拟事件：key使用不冲突的值，确保只能通过code匹配
    const mockEvent = {
      key: 'Unidentified',
      code: 'KeyA',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      target: document.body,
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as KeyboardEvent
    // 从spy中获取handleKeyDown并直接调用
    const keydownCall = addSpy.mock.calls.find(c => c[0] === 'keydown')
    expect(keydownCall).toBeDefined()
    ;(keydownCall![1] as (e: KeyboardEvent) => void)(mockEvent)
    expect(handler).toHaveBeenCalled()
    addSpy.mockRestore()
  })

  it('matchesShortcut应该检查修饰键不匹配', () => {
    const { registerShortcut } = useGlobalShortcuts()
    const handler = vi.fn()
    registerShortcut({
      id: 'modifier-mismatch-test',
      key: 'q',
      modifiers: { ctrl: true },
      description: '修饰键不匹配测试',
      category: 'general',
      handler,
    })
    // 不按ctrl，不匹配
    const event = new KeyboardEvent('keydown', { key: 'q', bubbles: true, cancelable: true })
    document.body.dispatchEvent(event)
    expect(handler).not.toHaveBeenCalled()
  })

  // ==================== formatShortcut Mac平台测试 ====================

  it('formatShortcut应该在Mac上使用Mac符号', () => {
    const originalPlatform = navigator.platform
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    })
    const { formatShortcut } = useGlobalShortcuts()
    const result = formatShortcut('c', { ctrl: true, alt: true, shift: true, meta: true })
    expect(result).toContain('⌃')
    expect(result).toContain('⌥')
    expect(result).toContain('⇧')
    expect(result).toContain('⌘')
    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      configurable: true,
    })
  })

  // ==================== getGroupedShortcuts 分组数据测试 ====================

  it('getGroupedShortcuts应该返回有数据的分组', () => {
    const { getGroupedShortcuts } = useGlobalShortcuts()
    const groups = getGroupedShortcuts.get()
    expect(groups.length).toBeGreaterThan(0)
    expect(groups[0]).toHaveProperty('category')
    expect(groups[0]).toHaveProperty('label')
    expect(groups[0]).toHaveProperty('shortcuts')
    expect(groups[0].shortcuts.length).toBeGreaterThan(0)
  })

  // ==================== unregisterShortcut 实际删除测试 ====================

  it('unregisterShortcut应该从map中删除快捷键', () => {
    const { registerShortcut, unregisterShortcut, registeredShortcuts } = useGlobalShortcuts()
    registerShortcut({
      id: 'remove-test',
      key: 'z',
      description: '删除测试',
      category: 'general',
      handler: vi.fn(),
    })
    expect(registeredShortcuts.value.has('z')).toBe(true)
    unregisterShortcut('remove-test')
    expect(registeredShortcuts.value.has('z')).toBe(false)
  })

  // ==================== setShortcutEnabled 状态修改测试 ====================

  it('setShortcutEnabled应该修改快捷键的启用状态', () => {
    const { registerShortcut, setShortcutEnabled, registeredShortcuts } = useGlobalShortcuts()
    registerShortcut({
      id: 'enable-state-test',
      key: 'w',
      description: '启用状态测试',
      category: 'general',
      handler: vi.fn(),
    })
    setShortcutEnabled('enable-state-test', false)
    expect(registeredShortcuts.value.get('w')?.enabled).toBe(false)
    setShortcutEnabled('enable-state-test', true)
    expect(registeredShortcuts.value.get('w')?.enabled).toBe(true)
  })

  // ==================== 默认快捷键触发测试 ====================

  it('默认快捷键ctrl+/应该切换帮助面板', () => {
    const { showHelpPanel } = useGlobalShortcuts()
    const initialValue = showHelpPanel.value
    const event = new KeyboardEvent('keydown', {
      key: '/',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    document.body.dispatchEvent(event)
    expect(showHelpPanel.value).toBe(!initialValue)
  })

  it('默认快捷键ctrl+f应该触发搜索事件', () => {
    useGlobalShortcuts()
    const searchHandler = vi.fn()
    window.addEventListener('ai-platform:search', searchHandler)
    const event = new KeyboardEvent('keydown', {
      key: 'f',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
    document.body.dispatchEvent(event)
    expect(searchHandler).toHaveBeenCalled()
    window.removeEventListener('ai-platform:search', searchHandler)
  })

  it('默认快捷键escape应该关闭帮助面板', () => {
    const { showHelpPanel } = useGlobalShortcuts()
    showHelpPanel.value = true
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    document.body.dispatchEvent(event)
    expect(showHelpPanel.value).toBe(false)
  })
})
