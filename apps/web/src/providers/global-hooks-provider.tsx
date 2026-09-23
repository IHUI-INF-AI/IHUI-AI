// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { rnRadius } from '@ihui/design-tokens'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import type { ChatMode } from '@ihui/types'
import { useRouteAnalytics } from '@/hooks/use-route-analytics'
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts'
import { useGlobalNotification } from '@/hooks/use-global-notification'
import { useAuthBootstrap } from '@/hooks/use-auth-bootstrap'
import { useDesktopEvents, useDesktopDeepLink } from '@/hooks/use-desktop'
import { useAgentControl } from '@/hooks/use-agent-control'
import { useUiControlBridge } from '@/hooks/use-ui-control-bridge'
import { useNativePushRegister } from '@/hooks/use-native-push'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { toast } from '@/components/common'
import { useModeStore } from '@/stores/mode'
import { isTopOverlay, popOverlay, pushOverlay } from '@/lib/overlay-stack'

/** 设置页路由。桌面端托盘「打开设置」与 Ctrl+Shift+, 快捷键共用同一入口。 */
const SETTINGS_PATH = '/settings'

/** 浮层层栈 id(见 @/lib/overlay-stack):Ctrl+/ 帮助面板是全页最上层 */
const SHORTCUT_HELP_OVERLAY_ID = 'global-shortcut-help-panel'

const SHORTCUT_ROUTES: Record<string, string> = {
  'global-shortcut:search': '/search',
  'global-shortcut:new-chat': '/chat',
  'global-shortcut:open-drama': '/drama',
  // 2026-07-30 用户规则:"可以做快捷键 组合键 你深度思考分析设计去做好"
  // Ctrl+, 直接打开设置(VS Code 标准,最高频入口,免命令面板搜索)
  'global-shortcut:open-settings': SETTINGS_PATH,
}

/** Ctrl+1/2/3/4 模式切换事件 → ChatMode(与 use-global-shortcuts DEFAULT_SHORTCUTS 对应)
 *
 * 2026-08-27 修复(根因):此前 `global-shortcut:mode-*` 事件由 use-global-shortcuts
 * 全局派发但无任何消费者,实际切换逻辑只在 ai-side-panel 的条件 useEffect 里
 * (仅 AI 面板 open 且深层组件树 hydration 完成后才挂载),导致:
 * - 非 /chat 页面 Ctrl+1-4 被 preventDefault 却无任何功能(劫持浏览器 tab 切换)
 * - /chat 页面 hydration 未完成时按键静默丢失(E2E 偶发失败根因)
 * 现统一在根 Layout 的 Provider 消费事件:根级 hydration 即生效,全页面可用,
 * 与斜杠命令 + AI 关键词自动判断三通道联动(ai-side-panel 的重复监听已移除)。
 */
const MODE_SHORTCUT_EVENTS: Record<string, ChatMode> = {
  'global-shortcut:mode-ask': 'ask',
  'global-shortcut:mode-build': 'build',
  'global-shortcut:mode-plan': 'plan',
  'global-shortcut:mode-review': 'review',
  'global-shortcut:mode-spec': 'spec',
}

/**
 * 快捷键描述 i18n 静态映射(1-6):帮助面板(Ctrl+/)原先展示
 * use-global-shortcuts DEFAULT_SHORTCUTS 的硬编码中文 description,未走 i18n,
 * 现统一经 `shortcutHelp.desc.<key>` 解析(与 DEFAULT_SHORTCUTS 的 key 一一对应)。
 */
const SHORTCUT_DESC_KEYS: Record<string, string> = {
  'Ctrl+K': 'desc.ctrlK',
  'Ctrl+P': 'desc.ctrlP',
  'Ctrl+Shift+N': 'desc.ctrlShiftN',
  'Ctrl+/': 'desc.ctrlSlash',
  // 键名跟随 chord:短剧编辑器原为 Ctrl+Shift+D,与 IDE debug 视图撞键后改绑 Ctrl+Alt+D
  // (见 use-global-shortcuts.ts 注释)。i18n 描述键 desc.ctrlShiftD 是标识符,不随 chord 改名。
  'Ctrl+Alt+D': 'desc.ctrlShiftD',
  'Ctrl+Shift+P': 'desc.ctrlShiftP',
  // 2026-09-22:chord 改绑(Ctrl+, → Ctrl+Shift+,,让位 IDE 设置视图),i18n 描述键名
  // desc.ctrlComma 是标识符不随 chord 改名(同 desc.ctrlShiftD 的先例)。
  'Ctrl+Shift+,': 'desc.ctrlComma',
  // 缺键的行会回显 DEFAULT_SHORTCUTS 里硬编码的中文 description(非中文语言下漏翻译),
  // 故注册表新增 chord 必须同时补本表 + 5 语言 desc。
  'Ctrl+Shift+/': 'desc.ctrlShiftSlash',
  'Ctrl+Shift+U': 'desc.ctrlShiftU',
  'Ctrl+Shift+M': 'desc.ctrlShiftM',
  'Ctrl+1': 'desc.ctrl1',
  'Ctrl+2': 'desc.ctrl2',
  'Ctrl+3': 'desc.ctrl3',
  'Ctrl+4': 'desc.ctrl4',
  'Ctrl+5': 'desc.ctrl5',
  'Ctrl+Alt+V': 'desc.ctrlAltV',
  'Ctrl+Alt+B': 'desc.ctrlAltB',
  'Ctrl+Alt+H': 'desc.ctrlAltH',
}

/**
 * 全局 Hooks Provider：在根 Layout 挂载全局副作用 hooks。
 *
 * - useRouteAnalytics：路由变化自动埋点（page_view / page_time / route_change）
 * - useGlobalShortcuts：全局快捷键监听（Ctrl+K 命令面板 / Ctrl+P 搜索 / Ctrl+Shift+N 新对话 / Ctrl+/ 帮助 /
 *   Ctrl+Shift+P 视图切换命令面板 / Ctrl+, 打开设置）
 * - useGlobalNotification：登录后自动连接 WebSocket 通知,写入 notification store(各 UI 组件按需订阅)
 * - 主题跨标签页同步:监听 storage 事件,当其他标签页切换主题时,本标签页通过 next-themes setTheme 跟随
 *
 * 帮助面板（Ctrl+/ 触发）以最简 overlay 呈现，避免引入额外依赖。
 */
export function GlobalHooksProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const t = useTranslations('chat')
  // 性能修复(2026-07-25):useRouteAnalytics 现在是纯副作用 hook,不再返回 currentPath,
  // 避免本 Provider 因路由变化重渲染导致 <CommandPalette> + help panel 连锁重渲染。
  useRouteAnalytics()
  const { showHelpPanel, toggleHelpPanel, shortcuts } = useGlobalShortcuts()
  const tHelp = useTranslations('shortcutHelp')
  // 1-6:帮助面板 Esc 关闭(原先只能点击外部关闭)
  // 2026-09-22:接入浮层层栈 —— Ctrl+/ 面板是全页最上层,打开时下层的弹层(权限弹层/
  // context ring 等)不得一起被一次 Esc 关掉。
  React.useEffect(() => {
    if (!showHelpPanel) return
    pushOverlay(SHORTCUT_HELP_OVERLAY_ID)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isTopOverlay(SHORTCUT_HELP_OVERLAY_ID)) return
        e.preventDefault()
        toggleHelpPanel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      popOverlay(SHORTCUT_HELP_OVERLAY_ID)
      window.removeEventListener('keydown', onKey)
    }
  }, [showHelpPanel, toggleHelpPanel])
  // 激活全局通知 WS 连接 + 通知 store(未登录时自动 no-op,登录后自动连接)
  useGlobalNotification()
  // 应用启动时从 Cookie 恢复登录态(modal 模式 + mock cookie + 真后端 token 三种路径)
  // ready 仅供子组件读 useAuthBootstrap().ready 用,这里只是触发副作用
  useAuthBootstrap()
  // 桌面端事件监听:托盘菜单 + 系统级快捷键(浏览器端 no-op,仅在 Tauri 环境注册监听)
  useDesktopEvents()
  // 桌面端 deep-link 监听:ihui:// scheme 回调,自动完成 SSO 闭环(浏览器端 no-op)
  useDesktopDeepLink()
  // 桌面端 agent-control 桥:上报 computer 能力 + 消费 agent.action 推送(浏览器端 no-op)
  useAgentControl()
  // Web 端 UI 控制桥:上报 endpoint:'web' 能力 + 消费 agent.action(category:'ui')指令,
  // 让 AI 经 web_ui_* 工具操作本站页面(Tauri 端 no-op,让位 useAgentControl)
  useUiControlBridge()
  // App 端(Capacitor 壳)推送令牌注册:登录后监听 FCM registration 并上报设备注册表
  // (浏览器端 no-op,window.Capacitor 不存在;详见 use-native-push.ts)
  useNativePushRegister()
  const { resolvedTheme, setTheme } = useTheme()
  const [showCommandPalette, setShowCommandPalette] = React.useState(false)

  // 主题跨标签页同步:其他标签页修改 localStorage('theme')时,通过 setTheme 跟随
  // next-themes 自带 localStorage 持久化但不监听 storage 事件,需手动桥接。
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'theme' || !e.newValue) return
      setTheme(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [setTheme])

  React.useEffect(() => {
    const openChatHandler = () => setShowCommandPalette(true)
    window.addEventListener('global-shortcut:open-chat', openChatHandler)

    // 2026-09-09 1-6 键盘优先交互统一:Ctrl+Shift+P(open-plus)不再打开
    // GlobalTopBar Plus 九宫格弹窗,而是打开统一 CommandPalette(命令注册表单一事实源,
    // 21 项命令 + MRU)。Plus 按钮的鼠标点击弹窗保留(GlobalTopBar 内部状态)。
    window.addEventListener('global-shortcut:open-plus', openChatHandler)

    // Ctrl+1/2/3/4 模式切换(2026-08-27 根因修复,见 MODE_SHORTCUT_EVENTS 注释):
    // use-global-shortcuts 统一做按键匹配 + preventDefault 后派发事件,这里消费。
    const MODE_LABEL_KEYS: Record<ChatMode, string> = {
      ask: 'modeAsk',
      build: 'modeBuild',
      plan: 'modePlan',
      review: 'modeReview',
      spec: 'modeSpec',
    }
    const modeHandlers: Array<[string, () => void]> = Object.entries(MODE_SHORTCUT_EVENTS).map(
      ([event, mode]) => {
        const handler = () => {
          const label = t(MODE_LABEL_KEYS[mode])
          const modeStore = useModeStore.getState()
          if (modeStore.currentMode === mode) {
            toast.info(t('modeAlreadyActive', { mode: label }))
            return
          }
          modeStore.setMode(mode)
          toast.success(t('modeSwitched', { mode: label }))
        }
        window.addEventListener(event, handler)
        return [event, handler]
      },
    )

    // inline-edit 兜底:若收到事件时焦点已离开 Monaco(竞态),回退到命令面板
    const inlineEditFallback = () => {
      const active = document.activeElement
      if (!active?.closest('.monaco-editor')) {
        window.dispatchEvent(new CustomEvent('global-shortcut:open-chat'))
      }
    }
    window.addEventListener('global-shortcut:inline-edit', inlineEditFallback)

    const handlers: Array<[string, () => void]> = Object.entries(SHORTCUT_ROUTES).map(
      ([event, path]) => {
        const handler = () => {
          if (window.location.pathname === path) return
          router.push(path)
        }
        window.addEventListener(event, handler)
        return [event, handler]
      },
    )
    return () => {
      window.removeEventListener('global-shortcut:open-chat', openChatHandler)
      window.removeEventListener('global-shortcut:open-plus', openChatHandler)
      window.removeEventListener('global-shortcut:inline-edit', inlineEditFallback)
      for (const [event, handler] of handlers) {
        window.removeEventListener(event, handler)
      }
      for (const [event, handler] of modeHandlers) {
        window.removeEventListener(event, handler)
      }
    }
  }, [router, t])

  // 桌面端托盘菜单「切换主题 / 打开设置」的消费点(2026-09-22 修复)
  //
  // 根因(全仓 grep 实证):use-desktop.ts 的 useDesktopEvents 把 Rust emit 的
  // `desktop-tray-action` 转成 5 个 CustomEvent,其中 3 个有消费者:
  //   new_chat     → global-shortcut:new-chat → SHORTCUT_ROUTES(本文件)
  //   check_update → desktop-check-update     → use-updater.ts
  //   quit         → desktop-quit-request     → use-quit-update-guard.ts
  // 唯独 `desktop-theme-toggle` 与 `desktop-open-settings` 全仓零 addEventListener:
  // dispatch 成功但无副作用 → 用户侧表现为"点击完全没反应"。Rust 侧
  // `let _ = window.emit(...)` 又把错误吞掉,日志也查不到。
  //
  // 落点选在根 Provider(与 MODE_SHORTCUT_EVENTS 同一模式):根级 hydration 即生效,
  // 不依赖 ai-side-panel 等深层组件挂载 —— 后者曾导致 global-shortcut:mode-* 在
  // 非 /chat 页面或 hydration 未完成时按键静默丢失(见上方注释),此处不再重蹈。
  React.useEffect(() => {
    const onToggleTheme = () => {
      // 承继 SidebarUserRow.handleToggleTheme 的底层加固:以 <html>.dark class 为
      // 事实源取对立面,规避 system 主题尚未解析完成(resolvedTheme === undefined)
      // 时"首次点击切错方向 / 要点两次"的时序问题。
      const isDarkNow =
        document.documentElement.classList.contains('dark') || resolvedTheme === 'dark'
      setTheme(isDarkNow ? 'light' : 'dark')
    }
    const onOpenSettings = () => {
      // 已在设置页时无需重复 push:Rust 侧已完成 show + set_focus,窗口会被唤起。
      if (window.location.pathname === SETTINGS_PATH) return
      router.push(SETTINGS_PATH)
    }
    window.addEventListener('desktop-theme-toggle', onToggleTheme)
    window.addEventListener('desktop-open-settings', onOpenSettings)
    return () => {
      window.removeEventListener('desktop-theme-toggle', onToggleTheme)
      window.removeEventListener('desktop-open-settings', onOpenSettings)
    }
  }, [router, resolvedTheme, setTheme])

  return (
    <>
      {children}
      <CommandPalette open={showCommandPalette} onOpenChange={setShowCommandPalette} />
      {showHelpPanel && (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) toggleHelpPanel()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') toggleHelpPanel()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 'var(--z-notification)',
            background: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={tHelp('title')}
            style={{
              background: 'var(--color-background, #fff)',
              color: 'var(--color-foreground, #000)',
              borderRadius: rnRadius.xl,
              padding: '24px 32px',
              minWidth: 320,
              maxWidth: 480,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>{tHelp('title')}</h3>
            <ul className="m-0 grid list-none gap-2 p-0">
              {shortcuts
                .filter((s) => s.active)
                .map((s) => {
                  const descKey = SHORTCUT_DESC_KEYS[s.key]
                  return (
                    <li key={s.key} className="flex justify-between gap-6" style={{ fontSize: 14 }}>
                      <span style={{ opacity: 0.7 }}>
                        {descKey ? tHelp(descKey) : (s.description ?? s.key)}
                      </span>
                      <code style={{ fontSize: 12, opacity: 0.9 }}>{s.key}</code>
                    </li>
                  )
                })}
            </ul>
            <p style={{ margin: '16px 0 0', fontSize: 12, opacity: 0.5, textAlign: 'center' }}>
              {tHelp('closeHint')}
            </p>
          </div>
        </div>
      )}
      {/* 性能修复:删除 debug span(data-current-path=currentPath),
          原本仅用于调试,却是 usePathname 订阅链路的唯一消费点,触发整 provider 重渲染。 */}
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
