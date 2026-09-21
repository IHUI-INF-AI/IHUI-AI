// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { Button, Dialog, DialogContent, DialogTitle, DialogDescription } from '@ihui/ui-react'
import { useTranslations } from 'next-intl'
import { ExternalLink } from 'lucide-react'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { AuthShell } from '@/components/auth/AuthShell'
import { openExternalUrl } from '@/lib/tauri-bridge'
import { buildSsoLoginUrl, SSO_CLIENT_IDS, WEB_BASE } from '@ihui/shared'
import { useDesktop } from '@/hooks/use-desktop'
import { useIsMobile } from '@/hooks/use-media-query'
import { LoginFormContent } from './LoginFormContent'
import { RegisterFormContent } from './RegisterFormContent'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { LoginWithTurnstile } from './LoginWithTurnstile'

/**
 * 主站统一登录/注册/找回密码弹窗(2026-07-20 重做 / 2026-07-20 修订 / 2026-07-31 优化)
 *
 * 改动:
 * - 复用 AuthShell 共享外壳(顶部 logo + welcome 并排 + 标题 + 副标题)
 * - 与 /sso/login、/sso/register 视觉完全统一
 * - DialogContent 内置 Close(已统一视觉) 负责 onClose,AuthShell 不再渲染关闭按钮
 * - 2026-07-20:恢复 M-66/M-68/M-69 logo+welcome 并排方案,DialogContent max-w 同步 420→460
 * - 2026-07-31:移除 DialogContent 自身 min-[640px]:rounded-xl(AuthShell 内部已 rounded-xl),
 *   避免小屏双层圆角叠加视觉割裂;移除 pointer-events-none [&>div]:pointer-events-auto
 *   旧 Radix 策略(2026 Radix UI 已不需要,新版默认全启用,旧策略会导致子元素事件穿透)
 */
export function LoginDialog() {
  const t = useTranslations('auth')
  const router = useRouter()
  const isOpen = useLoginDialogStore((s) => s.isOpen)
  const mode = useLoginDialogStore((s) => s.mode)
  const close = useLoginDialogStore((s) => s.close)
  const setMode = useLoginDialogStore((s) => s.setMode)

  const { isDesktop } = useDesktop()
  // 2026-09-06 立:App/移动端(<1024px)登录/注册/找回密码改为独立全屏页形态,桌面保留居中弹窗。
  // 判定复用 useIsMobile()(max-width:1023px),与 useDesktop() 的 768px 阈值无重叠冲突。
  const isMobile = useIsMobile()

  const showDesktopSso = isDesktop

  const handleDesktopSso = React.useCallback(async () => {
    // Dev: desktop webview loads from http://localhost:8801 → 外部浏览器可访问同一 dev server
    // Prod: desktop webview loads from tauri://localhost → 用 WEB_BASE (https://aizhs.top)
    const webBase =
      typeof window !== 'undefined' &&
      (window.location.origin.startsWith('http://') ||
        window.location.origin.startsWith('https://'))
        ? window.location.origin
        : WEB_BASE
    const ssoUrl = buildSsoLoginUrl(webBase, 'ihui://sso', SSO_CLIENT_IDS.DESKTOP)
    await openExternalUrl(ssoUrl)
  }, [])

  const handleLoginSuccess = React.useCallback(() => {
    const redirectUrl = useLoginDialogStore.getState().redirectUrl
    close()
    // 2026-09-18:路由跳转推迟到弹窗遮罩淡出(~150ms)结束后(250ms 余量),
    // 根治"登录成功后灰→亮渐渐显示且卡顿"(用户反馈):router.push 触发的
    // RSC 拉取 + 新页面树渲染是主线程长任务,原实现与遮罩淡出同窗口执行,
    // 淡出动画逐帧掉队。token 写入与弹窗关闭不受影响,仅延后跳转本身。
    if (redirectUrl && redirectUrl !== window.location.pathname + window.location.search) {
      setTimeout(() => {
        router.push(redirectUrl)
      }, 250)
    }
  }, [close, router])

  const title =
    mode === 'login'
      ? t('loginTitle')
      : mode === 'register'
        ? t('registerTitle')
        : t('forgotPassword')
  const subtitle =
    mode === 'login'
      ? t('loginSubtitle')
      : mode === 'register'
        ? t('registerSubtitle')
        : t('forgotSubtitle')

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
      <DialogContent
        data-testid="login-dialog"
        hideCloseButton
        className={
          isMobile
            ? // 移动/App:全屏全出血(背景 surface,无圆角/阴影/边框),登录/注册/找回三态统一
              // 必须显式 left-0 top-0 translate-x-0 translate-y-0 抵消 DialogContent 基类
              // 的 left-[50%] top-[50%] translate-x/y-[-50%] 居中,否则全屏盒被平移出屏只露左上角。
              'fixed left-0 top-0 translate-x-0 translate-y-0 h-dvh w-full max-w-none max-h-none overflow-y-auto gap-0 p-0 border-0 bg-background rounded-none shadow-none'
            : // 桌面:保持原居中卡片。content 的 open/closed 淡入淡出实测为 animate-in/out 自带的
              // 150ms(tw-animate-css 默认;基类 duration-(--duration-unified) 对 animation-duration
              // 并不生效,勿再试图用 duration-* 同步),远快于卡片 500ms pop → 底座瞬间到位,
              // 卡片弹出不受半透明拖累,视觉由 login-dialog-pop 主导,无需任何干预。
              /* 2026-09-18:overflow-y-auto → overflow-visible(用户反馈"翻转的时候卡片超出容器后被裁剪了边缘"):
                 翻转动画中卡片绕 Y 轴旋转,perspective(800px) 会放大转出屏幕方向的边缘,
                 投影宽度超过 460px 容器,overflow-y-auto(隐含 overflow-x 也 auto)把超出部分裁掉。
                 2026-09-19:恢复滚动能力但挪到内层 AuthShell 卡片自身(用户反馈"账号分类登录页上下都超出屏幕")——
                 账号登录 tab(桌面 SSO 按钮 + 8 个第三方登录)高度超 95vh,DialogContent overflow-visible
                 且居中定位导致超出部分从上下两端溢出屏幕且无滚动条。滚动放在 AuthShell 上:
                 元素自身 overflow 不裁自身的翻转投影(外层 DialogContent 仍 overflow-visible),
                 9-18 的翻转动效裁边修复不受影响;内容超高时卡片内部出滚动条,静止态完全容纳。
                 同日第二轮(用户要求"禁止滚动、内容必须完整显示"):配合 AuthShell/LoginForm
                 紧凑化(卡片 padding pb-6→pb-3、welcome 32px、表单 space-y-3、第三方 4 列),
                 账号 tab 总高 732→约 515px,常规视口(≥540px 高)完全容纳不出滚动条;
                 overflow-y-auto 降级为极端矮窗的安全兜底。 */
              'gap-0 p-0 max-w-[460px] w-[calc(100%-2rem)] max-h-[95vh] overflow-visible border-0 bg-transparent shadow-none'
        }
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{subtitle}</DialogDescription>

        {isMobile ? (
          // 移动/App 全屏形态:垂直居中 + 安全区 padding + 透明全出血 AuthShell
          <div className="flex min-h-full flex-col justify-center px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
            <AuthShell
              onClose={close}
              hideCloseButton
              className="w-full max-w-none rounded-none border-0 bg-transparent p-3 shadow-none"
            >
              {mode === 'login' ? (
                <LoginWithTurnstile>
                  <LoginFormContent
                    tabs={['email', 'phone', 'password']}
                    onSuccess={handleLoginSuccess}
                  />
                </LoginWithTurnstile>
              ) : mode === 'register' ? (
                <RegisterFormContent onSuccess={() => setMode('login')} />
              ) : (
                <ForgotPasswordForm />
              )}
            </AuthShell>
          </div>
        ) : (
          // 2026-09-18 卡片翻转入场:Y 轴 3D 全周翻转(360°)+ 弹性过冲
          // (@keyframes login-dialog-flip,globals.css)。
          // 加在内层卡片而非 DialogContent——Content 的居中 translate 不能被关键帧
          // transform 碰(dialog.tsx 2026-07-28 残留 bug 教训)。移动全屏页/SSO 独立页不套用。
          // 2026-09-19:max-h-[inherit](继承 DialogContent 的 max-h-[95vh])+ overflow-y-auto
          // ——滚动放卡片自身,超高内容在卡片内滚动,不再上下溢出屏幕(见上方 DialogContent 注释);
          // 元素自身 overflow 裁子内容、不裁自身投影,翻转动画放大出的边缘仍由外层
          // overflow-visible 放行,9-18 裁边修复不受影响。
          <AuthShell
            onClose={close}
            className="max-h-[inherit] animate-login-dialog-flip overflow-y-auto"
          >
            {showDesktopSso && mode === 'login' && (
              <div className="pb-3">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full px-4"
                  onClick={handleDesktopSso}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  <span>{t('loginInBrowser')}</span>
                </Button>
              </div>
            )}
            {mode === 'login' ? (
              <LoginWithTurnstile>
                <LoginFormContent onSuccess={handleLoginSuccess} />
              </LoginWithTurnstile>
            ) : mode === 'register' ? (
              <RegisterFormContent onSuccess={() => setMode('login')} />
            ) : (
              <ForgotPasswordForm />
            )}
          </AuthShell>
        )}
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
