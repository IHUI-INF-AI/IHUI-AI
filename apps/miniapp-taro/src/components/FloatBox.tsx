// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { t as tStatic } from '@/i18n'
import { View } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { rnRadius, TARO_RPX_PER_PX } from '@ihui/design-tokens'
import { FLOAT_BOX_ICON_SIZE_PX } from '@ihui/shared/ui/float-box-spec'
import { rpx } from '@/utils/rpx'
import { onToast } from '@/host/on-toast'
import { useTt } from '@/i18n'

/**
 * FloatBox 浮动组件 — 对齐原项目 FloatBox.vue
 * - 固定定位右下角，白色圆角矩形
 * - 默认展开（isOpen=true），内容可见，box 在 right: 20rpx
 * - 收起时（isOpen=false），box 推到 right: -240rpx，箭头留在左侧可见
 * - 含 3 个**纯图标**按钮：赚米（分享/推广）、客服、反馈
 *   （2026-11-23 用户定档：按钮下方不再带功能说明文字，语义只由 ariaLabel 承担）
 */
export interface FloatBoxProps {
  /** 分享按钮点击回调（默认提示） */
  onShare?: () => void
  /** 客服按钮点击回调（默认提示） */
  onService?: () => void
  /** 反馈按钮点击回调（默认跳转 /pages/feedback/index） */
  onFeedback?: () => void
}

/// 与 RN 端同语义档(收起箭头墨迹)的唯一源在 @ihui/shared/ui/float-box-spec;本文件只做 rpx 换算 + 挂 Taro 原语。
/// 本端按钮组载体几何(盒宽 118rpx、minHeight 340rpx、收起位移、箭头命中块、按钮内衬等)在 RN 端
/// 没有对应元素,原样留在下方内联样式 —— 登记见该 spec 文末第 2)条。
const toUnit = (px: number) => rpx(px * TARO_RPX_PER_PX)
/// 收起箭头仍取共享档 18px(36rpx),与 toast 状态图标同档
const ARROW_GLYPH_SIZE = toUnit(FLOAT_BOX_ICON_SIZE_PX)
/// 功能按钮已去掉文字标签(2026-11-23),图标单独承重:放大到 36px(72rpx),
/// 与 RN GlobalFloatBox 的 ICON_SIZE=36dp 同物理尺寸;不再取 spec 的 18(那一档只喂箭头/toast)
const ICON_SIZE = rpx(72)
/// 纯图标按钮的可点区:图标 72rpx + 上下内衬 24rpx = 96rpx(48dp),对齐 RN 端同一档
const ITEM_PADDING_Y = '12rpx'
const ITEM_PADDING_X = '16rpx'

export default function FloatBox({ onShare, onService, onFeedback }: FloatBoxProps) {
  const [isOpen, setIsOpen] = useState(true)
  const tt = useTt()

  const handleShare = () => {
    if (onShare) {
      onShare()
    } else {
      onToast(tt('toastFallback.shareFeature', '分享功能'), { kind: 'info' })
    }
  }

  const handleService = () => {
    if (onService) {
      onService()
    } else {
      onToast(tt('toastFallback.serviceUnavailable', '客服功能暂未开放'), { kind: 'error' })
    }
  }

  const handleFeedback = () => {
    if (onFeedback) {
      onFeedback()
    } else {
      // 反馈页在 pkg-user 分包(user/feedback);/pages/feedback/index 从未存在过,点了必死
      Taro.navigateTo({ url: '/pkg-user/user/feedback' }).catch(() => {
        onToast(tt('toastFallback.feedbackUnavailable', '反馈功能暂未开放'), { kind: 'error' })
      })
    }
  }

  return (
    <>
      {/* 展开时显示透明遮罩，点击空白处收起 */}
      {!isOpen ? (
        <View
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1004,
            background: 'transparent',
          }}
          onClick={() => setIsOpen(true)}
        />
      ) : null}

      {/* FloatBox 主体 — 对齐原项目 float-box */}
      <View
        style={{
          position: 'fixed',
          right: isOpen ? '20rpx' : '-240rpx',
          bottom: 'calc(110rpx + env(safe-area-inset-bottom))',
          width: '118rpx',
          minHeight: '340rpx',
          backgroundColor: 'var(--color-card)',
          borderRadius: rnRadius['2xl'],
          boxShadow: '0 1px 3px var(--color-black-6)',
          transition: 'right 0.35s cubic-bezier(0.4, 1.3, 0.6, 1)',
          zIndex: 1005,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* 展开/收起箭头 — 对齐原项目 float-arrow */}
        <View
          ariaRole="button"
          ariaLabel={isOpen ? tt('a11y.collapse', '折叠') : tt('a11y.expand', '展开')}
          style={{
            position: 'absolute',
            left: isOpen ? '-161rpx' : '-37rpx',
            top: '50%',
            transform: 'translateY(-50%)',
            width: 'var(--spacing-xl)',
            height: '100rpx',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            zIndex: 10000,
            transition: 'left 0.3s',
          }}
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen(!isOpen)
          }}
          hoverClass="opacity-60"
        >
          {isOpen ? (
            <LineIcon name="chevron-left" size={ARROW_GLYPH_SIZE} color="var(--color-foreground)" />
          ) : (
            <LineIcon
              name="chevron-right"
              size={ARROW_GLYPH_SIZE}
              color="var(--color-foreground)"
            />
          )}
        </View>

        {/* 悬浮内容 — 对齐原项目 float-content */}
        {isOpen ? (
          <View
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '14rpx 0',
              boxSizing: 'border-box',
              justifyContent: 'center',
            }}
          >
            {/* 赚米按钮(分享/推广)— 纯图标,无文字标签 */}
            <View
              ariaRole="button"
              ariaLabel={tStatic('uiText.earnMoney')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '5rpx 0',
                background: 'none',
                border: 'none',
                padding: `${ITEM_PADDING_Y} ${ITEM_PADDING_X}`,
              }}
              onClick={handleShare}
              hoverClass="opacity-60"
            >
              <LineIcon name="wallet" size={ICON_SIZE} color="var(--color-destructive)" />
            </View>

            {/* 客服按钮 — 纯图标,无文字标签 */}
            <View
              ariaRole="button"
              ariaLabel={tStatic('uiText.customerService')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '5rpx 0',
                background: 'none',
                border: 'none',
                padding: `${ITEM_PADDING_Y} ${ITEM_PADDING_X}`,
              }}
              onClick={handleService}
              hoverClass="opacity-60"
            >
              <LineIcon name="phone" size={ICON_SIZE} color="var(--color-foreground)" />
            </View>

            {/* 反馈按钮 — 纯图标,无文字标签 */}
            <View
              ariaRole="button"
              ariaLabel={tStatic('uiText.feedback')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '5rpx 0',
                background: 'none',
                border: 'none',
                padding: `${ITEM_PADDING_Y} ${ITEM_PADDING_X}`,
              }}
              onClick={handleFeedback}
              hoverClass="opacity-60"
            >
              <LineIcon name="mail" size={ICON_SIZE} color="var(--color-muted-foreground)" />
            </View>
          </View>
        ) : null}
      </View>
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
