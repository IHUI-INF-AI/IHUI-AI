// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端更新提示横幅(2026-11-13 立,与 RN/Web 同一版式语义)。
 *
 * 版式口径:web 的 UpdateNoticeCard / RN 的 UpdatePrompt 同源 —— 顶部下滑横幅,
 * 图标锚点 + 标题 + 正文 + [更新] 主钮 + 关闭 X,文案走 appUpdate 命名空间(逐字同值)。
 * 位置:position fixed; top:0 —— 小程序用原生导航栏,固定定位的视口顶即导航栏下沿,
 * 横幅正好挂在页面内容区最上方,不会被原生导航栏遮挡。
 *
 * 动画:挂载后从屏外上方下滑入场(translateY -110% → 0,300ms);关闭时上滑退场后再卸载。
 * 职责边界:本组件只负责呈现;就绪/关闭/应用全在 lib/app-update.ts 的 store 里。
 */

import { View, Text } from '@tarojs/components'
import { useEffect, useState, type CSSProperties } from 'react'
import { useLaunch } from '@tarojs/taro'
import { useI18n } from '@/i18n'
import {
  applyAppUpdate,
  dismissAppUpdate,
  initAppUpdateManager,
  useAppUpdateReady,
} from '@/lib/app-update'

const SLIDE_MS = 300

export function AppUpdateBanner() {
  const { t } = useI18n()
  const visible = useAppUpdateReady()
  const [mounted, setMounted] = useState(false)
  const [entered, setEntered] = useState(false)
  const [closing, setClosing] = useState(false)
  const [starting, setStarting] = useState(false)

  // 进入可见态才挂载并播放入场;关闭走 closing 退场动画,结束再卸载(否则看不到"滑回去")
  useEffect(() => {
    if (visible) {
      setMounted(true)
      const id = setTimeout(() => setEntered(true), 16)
      return () => clearTimeout(id)
    }
  }, [visible])

  if (!mounted) return null

  const handleUpdate = () => {
    if (starting) return
    setStarting(true)
    // 让"已点按"的禁用态先画出来,再冷重启(小程序 applyUpdate 即原生重启,无 overlay 机会)
    setTimeout(() => applyAppUpdate(), 300)
  }

  const handleClose = () => {
    dismissAppUpdate()
    setClosing(true)
    setTimeout(() => setMounted(false), SLIDE_MS)
  }

  const wrapStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1100,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: '12px 16px',
    backgroundColor: 'var(--color-surface-card, #ffffff)',
    borderBottom: '1px solid var(--color-border-medium, rgba(0, 0, 0, 0.08))',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    transform: entered && !closing ? 'translateY(0)' : 'translateY(-110%)',
    transition: `transform ${SLIDE_MS}ms ease`,
    boxSizing: 'border-box',
  }

  const headerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  }
  const iconBadgeStyle: CSSProperties = {
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-brand-accent-light, rgba(99, 102, 241, 0.12))',
  }
  const titleWrapStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  }
  const titleStyle: CSSProperties = {
    color: 'var(--color-text-primary, #111111)',
    fontSize: 15,
    fontWeight: 600,
  }
  const bodyStyle: CSSProperties = {
    color: 'var(--color-text-secondary, #666666)',
    fontSize: 12,
    lineHeight: '18px',
  }
  const closeBtnStyle: CSSProperties = {
    width: 28,
    height: 28,
    flexShrink: 0,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-surface-muted, rgba(0, 0, 0, 0.05))',
  }
  const footerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  }
  const actionBtnStyle: CSSProperties = {
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 8,
    backgroundColor: 'var(--color-primary, #4f46e5)',
    borderWidth: 1,
    borderColor: 'var(--color-border-medium, rgba(0, 0, 0, 0.08))',
  }
  const actionTextStyle: CSSProperties = {
    color: 'var(--color-primary-foreground, #ffffff)',
    fontSize: 14,
    fontWeight: 600,
  }

  return (
    <View style={wrapStyle}>
      <View style={headerStyle}>
        <View style={iconBadgeStyle}>
          <Text style={{ fontSize: 18, color: 'var(--color-brand-accent-deep, #4338ca)' }}>↑</Text>
        </View>
        <View style={titleWrapStyle}>
          <Text style={titleStyle}>{t('appUpdate.title')}</Text>
          <Text style={bodyStyle}>{t('appUpdate.readyBody')}</Text>
        </View>
        <View style={closeBtnStyle} onClick={handleClose}>
          <Text style={{ fontSize: 16, color: 'var(--color-text-secondary, #666666)' }}>×</Text>
        </View>
      </View>
      <View style={footerStyle}>
        <View style={actionBtnStyle} onClick={handleUpdate}>
          <Text style={actionTextStyle}>{t('appUpdate.action')}</Text>
        </View>
      </View>
    </View>
  )
}

/**
 * 装配出口:在 I18nProvider 之内渲染一次即可。
 * 用 useLaunch 挂 getUpdateManager 监听(幂等),再渲染横幅。
 * (与 app.tsx 内 NetworkStatusHandler / MemoryWarningHandler 同型,launch 回调里挂监听)
 */
export function AppUpdateRoot() {
  useLaunch(() => {
    initAppUpdateManager()
  })
  return <AppUpdateBanner />
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
