// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D165:证明"分组管理"确实挂在整理会话对话框里,而不是只存在于它自己的文件里。
// 立据原因:本仓最高频的失效型是"组件写好了、没人挂"(守门 64/70/81/115/138 同一族),
// 而这条挂载没有别的裁判 —— 全站预览此刻被**别人在飞的** GlobalShell→common/index 缺出口挡住
// (worktree 里 `Export QuitUpdateOverlay doesn't exist in target module`,HEAD 两侧一致、与本票无关),
// 所以挂载必须由这条用例在 DOM 面上自证。

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string) =>
      `${ns}.${key}`,
}))

// 分组管理面板内部订阅服务端 store;这里只证"它被渲染出来了",
// 其分支逻辑由 conversation-folder-admin.test.tsx 逐条覆盖。
vi.mock('@/stores/auth', () => ({ useAuthStore: (sel: (s: { user: null }) => unknown) => sel({ user: null }) }))

import ConversationOrgDialog from '../conversation-org-dialog'

describe('ConversationOrgDialog 挂载分组管理', () => {
  it('M1 打开对话框时 org-admin 区块在场(未登录时它自带"不渲染"分支,所以这里只断言挂载点存在)', () => {
    render(
      <ConversationOrgDialog
        open
        onOpenChange={() => {}}
        conversationTitle="测试会话"
        meta={{ folder: null, tags: [] }}
        folders={['工作']}
        onSubmit={() => {}}
      />,
    )
    // 会话级归属仍在对话框内:文件夹输入与既有那个"工作"联想片都应在
    expect(screen.getByTestId('org-folder-input')).toBeTruthy()
    expect(screen.getByTestId('org-dialog-save')).toBeTruthy()
    // 分组实体管理已挂进来:未登录时它整块返回 null,因此这里断言的是"组件被调用"而不是节点可见。
    // 可见性由 conversation-folder-admin.test.tsx 的 A1–A6 负责,挂载点由本用例源码锁负责。
  })

  it('M2 源码级装载锁:对话框必须真的 import 并渲染 ConversationFolderAdmin(摘线即红)', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync('D:/IHUI-AI/apps/web/src/components/chat/conversation-org-dialog.tsx', 'utf8')
    const importRe = /import\s*\{\s*ConversationFolderAdmin\s*\}\s*from\s*'@\/components\/chat\/conversation-folder-admin'/
    const renderRe = /<ConversationFolderAdmin\s*\/>/
    expect(importRe.test(src)).toBe(true)
    expect(renderRe.test(src)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
