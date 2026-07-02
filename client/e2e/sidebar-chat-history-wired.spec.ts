/**
 * 侧边栏"新建对话"+"对话历史"接入点防回归测试 (2026-07-02)
 *
 * 背景：SidebarChatHistory.vue 组件本体（~480 行，含 demo 数据降级、删除确认、
 *       折叠态隐藏、ElMessage 提示）一直在 working tree 但 Sidebar.vue 里的
 *       接入代码（import + <SidebarChatHistory /> 标签）曾被回滚过，导致
 *       整个对话历史功能在用户侧消失。
 *
 * 防护策略：源码级断言（无需浏览器）。直接读 Sidebar.vue，验证：
 *   1) 必须 import SidebarChatHistory
 *   2) 模板中必须使用 <SidebarChatHistory ... /> 标签
 *   3) 父组件必须实现 handleNewChat 方法（@new-chat 事件依赖）
 *   4) SidebarChatHistory.vue 文件必须存在且非空
 *
 * 该 spec 跑通 = 接入点未丢失；CI 拦截 = 不允许删除任何一处。
 */
import { test, expect } from '@playwright/test'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const SIDEBAR_VUE = join(ROOT, 'src/components/Sidebar.vue')
const CHILD_VUE = join(ROOT, 'src/components/SidebarChatHistory.vue')

test.describe('侧边栏新建对话+对话历史接入点防回归', () => {
  test('1/4 Sidebar.vue 必须 import SidebarChatHistory 组件', () => {
    const src = readFileSync(SIDEBAR_VUE, 'utf-8')
    expect(
      src,
      'Sidebar.vue 缺少 `import SidebarChatHistory from ...`（会导致 <SidebarChatHistory> 模板编译失败）',
    ).toMatch(/import\s+SidebarChatHistory\s+from\s+['"]@\/components\/SidebarChatHistory\.vue['"]/)
  })

  test('2/4 Sidebar.vue 模板中必须使用 <SidebarChatHistory ... /> 标签', () => {
    const src = readFileSync(SIDEBAR_VUE, 'utf-8')
    expect(
      src,
      'Sidebar.vue 模板中缺少 <SidebarChatHistory> 标签（对话历史模块不会渲染）',
    ).toMatch(/<SidebarChatHistory[\s>]/)
    // 必须传入 is-collapsed prop（组件内 v-if 依据此切换渲染）
    expect(
      src,
      '<SidebarChatHistory> 缺少 :is-collapsed 绑定（折叠态无法隐藏）',
    ).toMatch(/<SidebarChatHistory[^>]*:is-collapsed\s*=/)
  })

  test('3/4 Sidebar.vue 必须实现 handleNewChat 方法（@new-chat 事件回调）', () => {
    const src = readFileSync(SIDEBAR_VUE, 'utf-8')
    expect(
      src,
      'Sidebar.vue 缺少 handleNewChat 方法（@new-chat 事件无回调）',
    ).toMatch(/const\s+handleNewChat\s*=/)
  })

  test('4/4 SidebarChatHistory.vue 组件本体必须存在且非空', () => {
    expect(existsSync(CHILD_VUE), 'SidebarChatHistory.vue 不存在').toBe(true)
    const stat = statSync(CHILD_VUE)
    expect(stat.size, `SidebarChatHistory.vue 仅 ${stat.size} 字节，疑似空文件`).toBeGreaterThan(1000)

    const src = readFileSync(CHILD_VUE, 'utf-8')
    // 必须含核心功能块：标题渲染、列表、删除
    expect(src, 'SidebarChatHistory 缺少 chat-history-list 列表').toMatch(/chat-history-list/)
    expect(src, 'SidebarChatHistory 缺少 handleSelect 方法').toMatch(/handleSelect/)
    expect(src, 'SidebarChatHistory 缺少 handleDelete 方法').toMatch(/handleDelete/)
  })
})
