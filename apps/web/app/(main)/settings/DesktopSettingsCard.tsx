'use client'

import * as React from 'react'
import { Monitor, Power, Keyboard, RotateCcw, Bell, Minimize, Maximize2, X } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Switch, Button } from '@ihui/ui-react'
import { useDesktop } from '@/hooks/use-desktop'
import { toast } from 'sonner'

/**
 * DesktopSettingsCard — 桌面端独占设置卡片(2026-07-25 立)
 *
 * 仅在 Tauri 桌面端 WebView 中渲染,浏览器环境返回 null。
 *
 * 内容:
 * - 桌面端版本 / 平台信息
 * - 开机自启开关(Switch)
 * - 全局快捷键说明(Ctrl+Shift+I 唤起/隐藏)
 * - 窗口控制快捷入口(最小化/最大化/关闭)
 * - 重置窗口状态按钮
 * - 测试系统通知按钮
 *
 * 样式遵循 AGENTS.md §4:
 * - 圆角守门:rounded-lg / rounded-md,无 rounded-full
 * - 中文+图标垂直对齐由 globals.css 全局 vcenter 规则自动处理
 * - hover 用 subtle bg-accent,无蓝色发光边框
 * - compact 紧凑布局
 *
 * i18n:桌面端独占 UI,中文优先(用户偏好),后续按需补齐 5 语言。
 */
export function DesktopSettingsCard() {
  const {
    isDesktop,
    appInfo,
    isMaximized,
    autostartEnabled,
    loading,
    toggleAutostart,
    resetWindow,
    notify,
    minimize,
    toggleMaximize,
    close,
  } = useDesktop()

  // 浏览器环境不渲染(整张卡片仅桌面端可见)
  if (!isDesktop) return null

  const handleResetWindow = async () => {
    await resetWindow()
    toast.success('窗口状态已重置,下次启动将使用默认尺寸')
  }

  const handleTestNotify = async () => {
    await notify('IHUI AI 桌面端', '这是一条测试通知,确认系统通知功能正常工作。')
    toast.success('通知已发送,请查看系统通知中心')
  }

  const handleMinimize = async () => {
    await minimize()
  }

  const handleToggleMax = async () => {
    await toggleMaximize()
  }

  const handleClose = async () => {
    await close()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Monitor className="h-4 w-4" />
          桌面端
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 版本信息 */}
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">版本</span>
            <span className="font-medium">{appInfo?.version ?? '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">平台</span>
            <span className="font-medium capitalize">{appInfo?.platform ?? '—'}</span>
          </div>
        </div>

        {/* 开机自启开关 */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Power className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">开机自启</p>
              <p className="text-xs text-muted-foreground">登录系统时自动启动并最小化到托盘</p>
            </div>
          </div>
          <Switch
            checked={autostartEnabled}
            onCheckedChange={(checked) => {
              void toggleAutostart()
              toast.success(checked ? '已启用开机自启' : '已关闭开机自启')
            }}
            disabled={loading}
            aria-label="开机自启"
          />
        </div>

        {/* 全局快捷键说明 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            全局快捷键
          </div>
          <div className="grid grid-cols-1 gap-1.5 text-xs">
            <div className="flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-1.5">
              <span className="text-muted-foreground">唤起 / 隐藏主窗口</span>
              <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] shadow-sm">
                Ctrl+Shift+I
              </kbd>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-1.5">
              <span className="text-muted-foreground">打开管理后台</span>
              <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] shadow-sm">
                Ctrl+Shift+A
              </kbd>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-1.5">
              <span className="text-muted-foreground">退出应用</span>
              <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] shadow-sm">
                Ctrl+Q
              </kbd>
            </div>
          </div>
        </div>

        {/* 窗口控制快捷入口 */}
        <div className="space-y-2">
          <p className="text-sm font-medium">窗口控制</p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMinimize}
              className="flex items-center justify-center gap-1.5"
            >
              <Minimize className="h-3.5 w-3.5" />
              <span className="text-xs">最小化</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleMax}
              className="flex items-center justify-center gap-1.5"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="text-xs">{isMaximized ? '还原' : '最大化'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="flex items-center justify-center gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              <span className="text-xs">关闭</span>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            关闭按钮会最小化到系统托盘,真正退出请用托盘菜单"退出"或 Ctrl+Q
          </p>
        </div>

        {/* 高级操作 */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetWindow}
            className="flex items-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="text-xs">重置窗口状态</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTestNotify}
            className="flex items-center gap-1.5"
          >
            <Bell className="h-3.5 w-3.5" />
            <span className="text-xs">测试通知</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
