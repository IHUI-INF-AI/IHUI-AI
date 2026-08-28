'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LogIn, User, Settings, Crown, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { useMounted } from '@/hooks/use-mounted'
import { Avatar } from '@/components/data/Avatar'
import { Dropdown } from '@/components/feedback'

/** 侧边栏底部用户区:头像 + 用户名 + 下拉菜单(profile/settings/logout)。未登录态不渲染(Header 已有登录入口)。 */
export function SidebarUserRow({
  collapsed,
  onCloseMobile,
}: {
  collapsed: boolean
  onCloseMobile: () => void
}) {
  const t = useTranslations('nav')
  const tc = useTranslations('common')
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const logout = useAuthStore((s) => s.logout)
  // hydration-safe: 首屏按"未登录"渲染,挂载后才显示真实态,避免 SSR/CSR 不一致
  const mounted = useMounted()
  const showAuthed = mounted && isAuthenticated

  const handleLogout = () => {
    logout()
    useLoginDialogStore.getState().open('login')
  }

  // 未登录态:与已登录态占据同一位置(px-1.5 pb-2 + flex items-center gap-1.5 rounded-md p-1),
  // 渲染为"图标 + 登录文字"单行按钮,折叠态只显图标。
  // 默认黑白背景(bg-foreground text-background):亮色模式黑底白字、暗色模式白底黑字,
  // 居中显示(justify-center 始终生效,展开态文字 + 图标也居中),
  // hover 保持黑白但稍淡 (bg-foreground/90),不切色相避免视觉跳跃。
  if (!showAuthed) {
    return (
      <div className="px-1.5 pb-2">
        <button
          type="button"
          onClick={() => {
            useLoginDialogStore.getState().open('login')
            onCloseMobile()
          }}
          aria-label={tc('login')}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-md p-1 text-sm font-medium transition-colors bg-foreground text-background hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          )}
        >
          <LogIn className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span>{tc('login')}</span>}
        </button>
      </div>
    )
  }

  return (
    <div className="flex justify-center px-1.5 pb-2">
      {/*
        group/row:头像+昵称作为整体悬停单元
        - 2026-07-20 v3 改(根除"文字贴上按钮右侧"问题):
          1) 子容器加 `px-2`(左右各 8px padding):hover 背景覆盖到 padding,
             button 左侧 + span 右侧各有 8px 留白,hover bg 视觉左右对称。
             原方案子容器无 padding,hover bg 紧贴 button 左 + span 右,看起来"贴边"。
          2) gap 从 `gap-1.5`(6px) → `gap-2`(8px):button 跟 span 间距增大,
             "系统管理员"5 字不再贴上 button 右侧,视觉有呼吸感。
          3) inline-flex 让子容器宽度 = padding*2 + button + gap + span 文字宽度,
             内容宽度完全由子内容决定,父 `flex justify-center` 居中 → 左右空白 100% 对称。
          4) 几个字的名称(2-7 字)自适应宽度,row 永远按内容宽度收缩,
             不会出现"文字被截断贴到 button 右侧"的视觉问题。
          5) 只有当 sidebar 拖到极窄(130px 最小)+ 长昵称(8 字+)时,span 才用 `min-w-0 truncate` 截断,
             截断时显示省略号,不会贴到 button(因为有 gap-2 + px-2 双重间距)。
        - 父容器 hover:bg-sidebar-item-hover-bg 出现弱色底(亮色纯白/暗色纯黑),
          与项目内其他导航项(NavLink/二级菜单)hover 行为完全一致,统一 hover 策略
        - 文本 group-hover/row:text-foreground 变亮(默认 text-foreground/70 弱化)
        - 折叠态 trigger button 加 p-1.5(12px) + 内部 Avatar h-6 w-6(24px) = 36×36 命中区,
          解决折叠态下小图标难以点中的体验问题
        - 子容器 h-9 (36px) 严格与 h-9 导航项高度一致,避免比邻项多出 8px 的视觉错位
        - 头像 fallback 加 ring-1 ring-inset ring-border/30,无头像时字符 fallback 有弱边框,
          在白底/灰底上更易辨识
      */}
      {/*
        2026-08-07 v4 改(根除"只有点头像才弹窗"问题):
        旧结构:外层 div(只负责 hover 样式) + Dropdown trigger=button(只包头像) + 外面的 span(用户名)
        → 用户名 span 在 Dropdown 外,点击不弹窗。
        新结构:把整行(row)合并到 Dropdown 的 trigger button 内,button 成为"头像 + 用户名"整体,
        任意位置点击都触发 Radix DropdownMenu 打开。
        - button 继承原外层 div 的所有样式(inline-flex h-9 gap-1.5 rounded-md px-2 hover:bg-sidebar-item-hover-bg
          group/row transition-colors)以保证视觉零回归,只是把 hover bg 从 div 转移到 button。
        - 头像原本在 button(h-7 w-7)内有 2px 留白(28×28 button 套 24×24 Avatar);现在 button 变成 row 容器
          (h-9 高度 + 内边距),用一个内层 span(h-7 w-7 flex items-center justify-center rounded-md)复用
          同样的 28×28 命中区,把 Avatar 居中放在内层 span 里,视觉与旧版一致。
        - 用户名 span 移入 button 内,继续走 group-hover/row:text-foreground 的文字变亮效果。
        - 折叠态(!collapsed=false)只渲染内层 28×28 头像 span,不渲染用户名,行为与旧版一致。
      */}
      <Dropdown
        align="start"
        side="top"
        items={[
          {
            key: 'header',
            label: (
              <div className="flex items-center gap-2 px-1 py-1">
                <Avatar src={user?.avatar ?? undefined} name={user?.nickname ?? 'U'} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{user?.nickname ?? 'User'}</div>
                  {user?.phone && (
                    <div className="truncate text-xs text-muted-foreground">{user.phone}</div>
                  )}
                </div>
              </div>
            ),
          },
          { key: 'div1', divider: true },
          {
            key: 'profile',
            label: t('user'),
            icon: User,
            onSelect: () => {
              router.push('/user/profile')
              onCloseMobile()
            },
          },
          {
            key: 'settings',
            label: t('settings'),
            icon: Settings,
            onSelect: () => {
              router.push('/settings')
              onCloseMobile()
            },
          },
          {
            key: 'vip',
            label: t('vip'),
            icon: Crown,
            onSelect: () => {
              router.push('/vip')
              onCloseMobile()
            },
          },
          { key: 'div2', divider: true },
          {
            key: 'logout',
            label: tc('logout'),
            icon: LogOut,
            danger: true,
            onSelect: handleLogout,
          },
        ]}
        trigger={
          <button
            aria-label={user?.nickname ?? 'User'}
            className={cn(
              // 整行 row 容器样式(继承自旧外层 div):inline-flex + h-9(与 NavLink 行高一致) + gap-2 + 圆角 + padding
              // 2026-08-26 修复:gap-1.5(6px) → gap-2(8px),与 sidebar-visual.spec.ts:562 契约一致
              // (spec 断言 gapBetween ≈ 8px,防的正是间距回归)
              'group/row inline-flex h-9 items-center gap-2 rounded-md px-6 transition-colors hover:bg-sidebar-item-hover-bg',
              // 按钮态样式:outline-none + focus-visible ring 保留键盘可访问性
              'outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {/* 内层 span 复用旧 trigger button 的 28×28 命中区,内含 24×24 Avatar(xs),保留 2px 留白 */}
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
              <Avatar
                src={user?.avatar ?? undefined}
                name={user?.nickname ?? 'U'}
                size="xs"
                className="ring-1 ring-inset ring-border/30"
              />
            </span>
            {!collapsed && (
              <span
                className={cn(
                  'min-w-0 truncate text-sm font-medium text-foreground/70 transition-colors group-hover/row:text-foreground',
                )}
              >
                {user?.nickname ?? 'User'}
              </span>
            )}
          </button>
        }
      />
    </div>
  )
}
