import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'

/**
 * FloatBox 浮动组件 — 对齐原项目 FloatBox.vue
 * - 固定定位右下角，白色圆角矩形
 * - 默认展开（isOpen=true），内容可见，box 在 right: 20rpx
 * - 收起时（isOpen=false），box 推到 right: -240rpx，箭头留在左侧可见
 * - 含 3 个按钮：赚米（红色）、客服、反馈
 */
export interface FloatBoxProps {
  /** 分享按钮点击回调（默认提示） */
  onShare?: () => void
  /** 客服按钮点击回调（默认提示） */
  onService?: () => void
  /** 反馈按钮点击回调（默认跳转 /pages/feedback/index） */
  onFeedback?: () => void
}

export default function FloatBox({ onShare, onService, onFeedback }: FloatBoxProps) {
  const [isOpen, setIsOpen] = useState(true)

  const handleShare = () => {
    if (onShare) {
      onShare()
    } else {
      Taro.showToast({ title: '分享功能', icon: 'none' })
    }
  }

  const handleService = () => {
    if (onService) {
      onService()
    } else {
      Taro.showToast({ title: '客服功能暂未开放', icon: 'none' })
    }
  }

  const handleFeedback = () => {
    if (onFeedback) {
      onFeedback()
    } else {
      Taro.navigateTo({ url: '/pages/feedback/index' }).catch(() => {
        Taro.showToast({ title: '反馈功能暂未开放', icon: 'none' })
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
          bottom: '9%',
          width: '118rpx',
          minHeight: '340rpx',
          backgroundColor: '#fff',
          borderRadius: '30rpx',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          transition: 'right 0.35s cubic-bezier(0.4, 1.3, 0.6, 1)',
          zIndex: 1005,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* 展开/收起箭头 — 对齐原项目 float-arrow */}
        <View
          style={{
            position: 'absolute',
            left: isOpen ? '-161rpx' : '-37rpx',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '40rpx',
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
        >
          <Text
            style={{
              fontSize: '36rpx',
              color: '#333',
              fontWeight: 'bold',
            }}
          >
            {isOpen ? '‹' : '›'}
          </Text>
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
            {/* 赚米按钮 — 红色文字 */}
            <View
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                margin: '5rpx 0',
                background: 'none',
                border: 'none',
                padding: 0,
              }}
              onClick={handleShare}
            >
              <Text style={{ fontSize: '36rpx', marginBottom: '6rpx' }}>💰</Text>
              <Text
                style={{
                  fontSize: '28rpx',
                  fontWeight: 'bold',
                  color: '#ff0000',
                  letterSpacing: '2rpx',
                }}
              >
                赚 米
              </Text>
            </View>

            {/* 客服按钮 */}
            <View
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                margin: '5rpx 0',
                background: 'none',
                border: 'none',
                padding: 0,
              }}
              onClick={handleService}
            >
              <Text style={{ fontSize: '36rpx', marginBottom: '6rpx' }}>📞</Text>
              <Text
                style={{
                  fontSize: '28rpx',
                  fontWeight: 'bold',
                  color: '#222',
                  letterSpacing: '2rpx',
                }}
              >
                客 服
              </Text>
            </View>

            {/* 反馈按钮 */}
            <View
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                margin: '5rpx 0',
                background: 'none',
                border: 'none',
                padding: 0,
              }}
              onClick={handleFeedback}
            >
              <Text style={{ fontSize: '36rpx', marginBottom: '6rpx' }}>✉️</Text>
              <Text
                style={{
                  fontSize: '28rpx',
                  fontWeight: 'bold',
                  color: '#222',
                  letterSpacing: '2rpx',
                }}
              >
                反 馈
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </>
  )
}