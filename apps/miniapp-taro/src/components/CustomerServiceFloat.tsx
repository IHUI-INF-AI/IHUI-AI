import { View, Button, Text } from '@tarojs/components'
import { useState, useEffect, useRef, type CSSProperties } from 'react'
import Taro from '@tarojs/taro'
import { useTt } from '@/i18n'

export interface CustomerServiceFloatProps {
  visible?: boolean
  /** 'default' = 客服浮标(当前);'commission' = 分佣浮标(对齐 CommissionFloatingIcon) */
  variant?: 'default' | 'commission'
  /** commission variant:佣金金额 */
  commissionAmount?: number
  /** commission variant:点击跳转回调 */
  onCommissionClick?: () => void
  /** 是否可拖拽(默认 true,对齐原项目) */
  draggable?: boolean
  /** 位置本地存储 key(默认 'float-position-default'/'float-position-commission') */
  storageKey?: string
}

interface FloatPosition {
  x: number
  y: number
}

interface TouchPoint {
  clientX: number
  clientY: number
}

interface TouchEventLike {
  touches: TouchPoint[]
  changedTouches: TouchPoint[]
}

const FLOAT_BTN_SIZE = 48
const DRAG_THRESHOLD = 5

/** 读取本地存储的位置,无则返回右下角默认值 */
function readPosition(key: string): FloatPosition {
  try {
    const info = Taro.getSystemInfoSync()
    const saved: unknown = Taro.getStorageSync(key)
    if (saved) {
      const parsed: unknown = typeof saved === 'string' ? JSON.parse(saved) : saved
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>
        const xVal = obj.x
        const yVal = obj.y
        if (typeof xVal === 'number' && typeof yVal === 'number') {
          return { x: xVal, y: yVal }
        }
      }
    }
    return { x: info.windowWidth - 80, y: info.windowHeight - 200 }
  } catch {
    return { x: 200, y: 400 }
  }
}

export default function CustomerServiceFloat({
  visible = true,
  variant = 'default',
  commissionAmount,
  onCommissionClick,
  draggable = true,
  storageKey,
}: CustomerServiceFloatProps) {
  const [show, setShow] = useState(false)
  const tt = useTt()

  const posKey = storageKey || `float-position-${variant}`
  const [pos, setPos] = useState<FloatPosition>(() => readPosition(posKey))
  const [dragging, setDragging] = useState(false)

  const screenSize = useRef({ width: 375, height: 667 })
  const dragStart = useRef<{ touchX: number; touchY: number; posX: number; posY: number } | null>(null)
  const moved = useRef(false)

  useEffect(() => {
    try {
      const info = Taro.getSystemInfoSync()
      screenSize.current = { width: info.windowWidth, height: info.windowHeight }
    } catch {
      // keep defaults
    }
  }, [])

  useEffect(() => {
    if (!visible) {
      setShow(false)
      return
    }
    const currentPage = Taro.getCurrentInstance().router?.path || ''
    const tabBarPaths = [
      'pages/index/index',
      'pages/course/list',
      'pages/live/list',
      'pages/ai/chat',
      'pages/user/index',
    ]
    const normalized = currentPage.startsWith('/') ? currentPage.slice(1) : currentPage
    setShow(!tabBarPaths.includes(normalized))
  }, [visible])

  if (!show) return null

  // Non-draggable default variant: keep original markup (backward compat)
  if (!draggable && variant === 'default') {
    return (
      <View className="cs-float">
        <Button
          className="cs-float-btn"
          openType="contact"
          sessionFrom="global_float"
          showMessageCard
          sendMessageTitle={tt('common.customerService', '客服咨询')}
          sendMessagePath="/pages/index/index"
        >
          <Text className="cs-float-icon">💬</Text>
          <Text className="cs-float-label">{tt('common.consult', '咨询')}</Text>
        </Button>
      </View>
    )
  }

  const handleTouchStart = (e: unknown) => {
    if (!draggable) return
    const evt = e as TouchEventLike
    const touch = evt.touches[0]
    if (!touch) return
    dragStart.current = {
      touchX: touch.clientX,
      touchY: touch.clientY,
      posX: pos.x,
      posY: pos.y,
    }
    moved.current = false
    setDragging(true)
  }

  const handleTouchMove = (e: unknown) => {
    if (!draggable || !dragStart.current) return
    const evt = e as TouchEventLike
    const touch = evt.touches[0]
    if (!touch) return
    const dx = touch.clientX - dragStart.current.touchX
    const dy = touch.clientY - dragStart.current.touchY
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      moved.current = true
    }
    let nx = dragStart.current.posX + dx
    let ny = dragStart.current.posY + dy
    nx = Math.max(0, Math.min(nx, screenSize.current.width - FLOAT_BTN_SIZE))
    ny = Math.max(0, Math.min(ny, screenSize.current.height - FLOAT_BTN_SIZE))
    setPos({ x: nx, y: ny })
  }

  const handleTouchEnd = () => {
    if (!draggable || !dragStart.current) return
    dragStart.current = null
    setDragging(false)
    // 未拖动(点击)— commission variant 触发跳转回调
    if (!moved.current) {
      if (variant === 'commission' && onCommissionClick) {
        onCommissionClick()
      }
      return
    }
    // 边界吸附:贴左/贴右(根据 x 是否超过屏幕中点)
    const midX = screenSize.current.width / 2
    setPos((prev) => {
      const snappedX =
        prev.x + FLOAT_BTN_SIZE / 2 > midX
          ? screenSize.current.width - FLOAT_BTN_SIZE
          : 0
      const next = { x: snappedX, y: prev.y }
      try {
        Taro.setStorageSync(posKey, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  const handleTouchCancel = () => {
    dragStart.current = null
    setDragging(false)
    moved.current = false
  }

  const containerStyle: CSSProperties = {
    position: 'fixed',
    left: `${pos.x}px`,
    top: `${pos.y}px`,
    zIndex: 1000,
    opacity: dragging ? 0.85 : 1,
  }

  if (variant === 'commission') {
    return (
      <View
        style={containerStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <View
          className="flex flex-col items-center justify-center bg-warning rounded-xl shadow-lg"
          style={{ width: `${FLOAT_BTN_SIZE}px`, height: `${FLOAT_BTN_SIZE}px` }}
        >
          <Text style={{ fontSize: '16px', lineHeight: 1 }}>💰</Text>
          {typeof commissionAmount === 'number' && (
            <Text
              className="text-warning-foreground"
              style={{ fontSize: '9px', lineHeight: 1, marginTop: '2px' }}
            >
              ¥{commissionAmount.toFixed(2)}
            </Text>
          )}
          <Text
            className="text-warning-foreground"
            style={{ fontSize: '9px', lineHeight: 1, marginTop: '1px' }}
          >
            {tt('common.commission', '分佣')}
          </Text>
        </View>
      </View>
    )
  }

  // Draggable default variant
  return (
    <View
      style={containerStyle}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <Button
        className="cs-float-btn"
        openType="contact"
        sessionFrom="global_float"
        showMessageCard
        sendMessageTitle={tt('common.customerService', '客服咨询')}
        sendMessagePath="/pages/index/index"
      >
        <Text className="cs-float-icon">💬</Text>
        <Text className="cs-float-label">{tt('common.consult', '咨询')}</Text>
      </Button>
    </View>
  )
}
