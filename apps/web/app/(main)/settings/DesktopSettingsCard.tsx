// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useTranslations } from 'next-intl'
import {
  Monitor,
  Power,
  Pin,
  Keyboard,
  Cloud,
  RotateCcw,
  Bell,
  Minimize,
  Maximize2,
  X,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button } from '@ihui/ui-react'
import { useDesktop } from '@/hooks/use-desktop'
import { DesktopPrefsSection, SwitchRow } from './DesktopPrefsSection'
import type { DesktopPrefsPatch } from '@/lib/desktop-prefs-bridge'
import { useDesktopPrefsSync } from '@/lib/desktop-prefs-sync'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'sonner'

/**
 * DesktopSettingsCard — 客户端独占设置卡片(2026-07-25 立,2026-09-28 补托盘/关闭偏好)。
 *
 * 仅在 Tauri 客户端 WebView 中渲染,浏览器环境返回 null。
 * 内容:版本/平台 · 开机自启 · 托盘常驻 · 托盘与关闭偏好(拆给 DesktopPrefsSection)·
 * 全局快捷键 · 窗口控制 · 高级操作。
 *
 * 三条样式硬约束(AGENTS.md §4):文案全走 `useTranslations('settings')`(此前整张卡是硬编码中文,
 * 缺的键由语言包那次提交补齐);图标与文字分开摆、按钮文字交给 ui-react Button 内置的
 * wrapRawTextChildren;圆角只用档位名,不自写任意值。
 *
 * 偏好的**有效值只认宿主回传的那一份**:互斥组合由宿主规范化(`showTrayIcon=false` ⇒
 * `closeBehavior` 不可能是 `'hide'`),前端不自己推 —— 见 useDesktop().updateDesktopPrefs。
 */
export function DesktopSettingsCard() {
  const t = useTranslations('settings')
  const {
    isDesktop,
    appInfo,
    isMaximized,
    autostartEnabled,
    trayAlwaysVisible,
    loading,
    desktopPrefs,
    desktopPrefsLoading,
    toggleAutostart,
    toggleTrayAlwaysVisible,
    updateDesktopPrefs,
    resetWindow,
    notify,
    minimize,
    toggleMaximize,
    close,
  } = useDesktop()

  // 跨设备漫游(G-301):未登录时整条链不启动 —— 拿 401 当“没开同步”是错的读法。
  // 必须在 “if (!isDesktop) return null” **之前**调用:放到早退之后就是条件调用 hook,
  // 浏览器环境会直接踩 React 的 hooks 规则(lint 与运行时各红一次)。
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const sync = useDesktopPrefsSync({
    prefs: desktopPrefs,
    available: isDesktop,
    authenticated: isAuthenticated,
    applyRemote: (remote) => updateDesktopPrefs(remote),
  })

  // 浏览器环境不渲染(整张卡片仅客户端可见)
  if (!isDesktop) return null

  /** 偏好初值到位前一律禁用:否则用户能在"还不知道宿主怎么想"的窗口里连点两次。 */
  const busy = loading || desktopPrefsLoading

  /** 写偏好 ⇒ 只把宿主回传的有效值落进状态;失败保留旧值并点名(不静默吞)。 */
  const commit = async (patch: DesktopPrefsPatch): Promise<void> => {
    const effective = await updateDesktopPrefs(patch)
    if (!effective) {
      toast.error(t('desktopSaveFailed'))
      return
    }
    toast.success(t('desktopSaved'))
  }
  const onPatch = (patch: DesktopPrefsPatch): void => {
    void commit(patch)
  }

  const handleResetWindow = async () => {
    await resetWindow()
    toast.success(t('desktopResetWindowDone'))
  }

  const handleTestNotify = async () => {
    await notify(t('desktopNotifyTestTitle'), t('desktopNotifyTestBody'))
    toast.success(t('desktopNotifySent'))
  }

  const closeNote =
    desktopPrefs.closeBehavior === 'hide'
      ? t('desktopCloseNoteHide')
      : desktopPrefs.closeBehavior === 'quit'
        ? t('desktopCloseNoteQuit')
        : t('desktopCloseNoteAsk')

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">{t('desktopCardTitle')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 版本信息 */}
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                {t('desktopVersion')}
              </span>
              <span className="truncate font-medium tabular-nums">{appInfo?.version ?? '—'}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-sm">
              <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                {t('desktopPlatform')}
              </span>
              <span className="truncate font-medium capitalize">{appInfo?.platform ?? '—'}</span>
            </div>
          </div>

          <SwitchRow
            icon={Power}
            title={t('desktopAutostartTitle')}
            desc={t('desktopAutostartDesc')}
            checked={autostartEnabled}
            disabled={loading}
            onCheckedChange={(checked) => {
              void toggleAutostart()
              toast.success(checked ? t('desktopAutostartOn') : t('desktopAutostartOff'))
            }}
          />

          <SwitchRow
            icon={Pin}
            title={t('desktopTrayPromoteTitle')}
            desc={t('desktopTrayPromoteDesc')}
            checked={trayAlwaysVisible}
            disabled={loading}
            onCheckedChange={() => {
              void toggleTrayAlwaysVisible().then((next) => {
                toast.success(next ? t('desktopTrayPromoteOn') : t('desktopTrayPromoteOff'))
              })
            }}
          />

          {/* 托盘与关闭偏好(六行 + 两种行控件都在 DesktopPrefsSection,受 §4 行数上限所拆) */}
          <DesktopPrefsSection prefs={desktopPrefs} disabled={busy} onPatch={onPatch} />

          {/* 跨设备同步(G-301):本机值永远是执行真相,这里只负责“拉来后经宿主写回”。 */}
          <SwitchRow
            icon={Cloud}
            title={t('desktopSyncTitle')}
            desc={sync.state === 'unknown' ? t('desktopSyncUnknown') : t('desktopSyncDesc')}
            checked={sync.state === 'on'}
            disabled={busy || sync.busy || !isAuthenticated}
            onCheckedChange={(next) => {
              void sync.setEnabled(next).then((ok) => {
                if (!ok) {
                  toast.error(t('desktopSyncFailed'))
                  return
                }
                toast.success(next ? t('desktopSyncOn') : t('desktopSyncOff'))
              })
            }}
          />

          {/* 全局快捷键说明 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Keyboard className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="whitespace-nowrap">{t('desktopShortcutsTitle')}</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 text-xs">
              <div className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {t('desktopShortcutToggleWindow')}
                </span>
                <kbd className="shrink-0 rounded bg-background px-1.5 py-0.5 font-mono text-[10px] shadow-sm">
                  Ctrl+Shift+I
                </kbd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {t('desktopShortcutQuit')}
                </span>
                <kbd className="shrink-0 rounded bg-background px-1.5 py-0.5 font-mono text-[10px] shadow-sm">
                  Ctrl+Q
                </kbd>
              </div>
            </div>
          </div>

          {/* 窗口控制快捷入口 */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('desktopWindowTitle')}</p>
            <div className="grid grid-cols-2 min-[640px]:grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void minimize()
                }}
                className="flex shrink-0 flex-nowrap items-center justify-center gap-1.5"
              >
                <Minimize className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap text-xs">{t('desktopWindowMinimize')}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void toggleMaximize()
                }}
                className="flex shrink-0 flex-nowrap items-center justify-center gap-1.5"
              >
                <Maximize2 className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap text-xs">
                  {isMaximized ? t('desktopWindowRestore') : t('desktopWindowMaximize')}
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void close()
                }}
                className="flex shrink-0 flex-nowrap items-center justify-center gap-1.5"
              >
                <X className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap text-xs">{t('desktopWindowClose')}</span>
              </Button>
            </div>
            {/* 同一句话有三种说法,按**有效**档位说 —— 宿主把 hide 纠正成 quit 后这里跟着变,
                否则设置页会替宿主撒一个它已经不做了的谎 */}
            <p className="line-clamp-2 text-[11px] text-muted-foreground">{closeNote}</p>
          </div>

          {/* 高级操作 */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void handleResetWindow()
              }}
              className="flex shrink-0 flex-nowrap items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap text-xs">{t('desktopResetWindow')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void handleTestNotify()
              }}
              className="flex shrink-0 flex-nowrap items-center gap-1.5"
            >
              <Bell className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap text-xs">{t('desktopTestNotify')}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
