import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTt } from '@/i18n'
import { icon } from '@/constants/remote-icons'

/**
 * 支付按钮 — 对齐原项目 components/pay_btn.vue
 * 5 种 type 变体(对应原项目图片资源):
 * - 'freevip' = 会员免费(原 free_vip_icon/free_vip.png)
 * - '1' = 免费使用(原 free_use_icon/free_use.png)
 * - '2' = 限时免费(原 free_time_icon/free_time.png)
 * - '3' = 每月付费(原 buymonth_icon/buymonth.png)
 * - '4' = 已购买(原 hasbuy_icon/hasbuy.png)
 *
 * 注:原项目通过图片资源渲染按钮,本组件用 Tailwind 类 + 图标替代以减少资源依赖;
 * 点击 type='3' 触发购买弹窗(对齐 pay_mask + pay_window);
 * 其他 type 仅触发 onClick 回调(无后端调用)。
 */

export type PayButtonType = 'freevip' | '1' | '2' | '3' | '4'

export interface PayButtonProps {
  type: PayButtonType
  /** Agent/商品 ID(传给 onClick) */
  agentId?: string
  /** Agent/商品名称(显示在购买弹窗) */
  agentName?: string
  /** Agent 头像(显示在购买弹窗) */
  agentAvatar?: string
  /** 是否禁用 */
  disabled?: boolean
  onClick?: (type: PayButtonType, agentId?: string) => void
  /** 动态价格获取函数(传入 agentId 返回价格);不传则用默认值 */
  onFetchPrice?: (agentId: string) => Promise<number>
}

interface TypeConfig {
  /** 按钮背景色(空 = 默认) */
  bgClass: string
  /** 按钮文字颜色 */
  textClass: string
  /** 图标资源路径(本地 import 或远程 URL) */
  icon: string
  /** 按钮文字 */
  label: string
  /** 是否显示购买弹窗 */
  showPurchasePopup: boolean
}

const TYPE_CONFIG: Record<PayButtonType, TypeConfig> = {
  freevip: {
    bgClass: 'bg-warning/20',
    textClass: 'text-warning',
    icon: icon('freeVipIcon'),
    label: '会员免费',
    showPurchasePopup: false,
  },
  '1': {
    bgClass: 'bg-primary/20',
    textClass: 'text-primary',
    icon: icon('freeUseIcon'),
    label: '免费使用',
    showPurchasePopup: false,
  },
  '2': {
    bgClass: 'bg-destructive/20',
    textClass: 'text-destructive',
    icon: icon('freeTimeIcon'),
    label: '限时免费',
    showPurchasePopup: false,
  },
  '3': {
    bgClass: 'bg-primary',
    textClass: 'text-white',
    icon: icon('buymonthIcon'),
    label: '每月',
    showPurchasePopup: true,
  },
  '4': {
    bgClass: 'bg-muted',
    textClass: 'text-muted-foreground',
    icon: icon('hasbuyIcon'),
    label: '已购买',
    showPurchasePopup: false,
  },
}

export default function PayButton({
  type,
  agentId,
  agentName = '',
  agentAvatar = '',
  disabled = false,
  onClick,
  onFetchPrice,
}: PayButtonProps) {
  const tt = useTt()
  const [popupVisible, setPopupVisible] = useState(false)
  const [count, setCount] = useState(1)
  const [price, setPrice] = useState<number>(0.01)

  const cfg = TYPE_CONFIG[type]

  const handleClick = () => {
    if (disabled) return
    if (cfg.showPurchasePopup) {
      setPopupVisible(true)
      if (onFetchPrice && agentId) {
        onFetchPrice(agentId).then(setPrice).catch(() => setPrice(0.01))
      }
      return
    }
    onClick?.(type, agentId)
  }

  const handlePay = () => {
    // TODO: 实际接入后端 createPayHistory + 微信 JSAPI pay()
    Taro.showToast({ title: '支付功能待接入后端', icon: 'none' })
    setPopupVisible(false)
    onClick?.(type, agentId)
  }

  const realPrice = (price * count).toFixed(2)

  return (
    <View className="relative">
      <View
        className={`flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium ${cfg.bgClass} ${cfg.textClass} ${
          disabled ? 'opacity-50' : ''
        }`}
        onClick={handleClick}
      >
        <Image className="w-3 h-3 mr-1" src={cfg.icon} mode="aspectFit" />
        <Text>{cfg.label}</Text>
      </View>

      {/* 购买弹窗(仅 type='3' 触发) */}
      {popupVisible && (
        <View
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
          onClick={() => setPopupVisible(false)}
        >
          <View
            className="bg-card rounded-xl mx-6 w-full max-w-sm p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 商品信息 */}
            <View className="flex items-center mb-3">
              {agentAvatar ? (
                <Image className="w-[84rpx] h-[84rpx] rounded-[15rpx] mr-3" src={agentAvatar} mode="aspectFill" />
              ) : (
                <View className="w-[84rpx] h-[84rpx] rounded-[15rpx] mr-3 bg-muted flex items-center justify-center">
                  <Image className="w-8 h-8" src="/static/images/icons/bot.svg" mode="aspectFit" />
                </View>
              )}
              <View className="flex-1">
                <Text className="block text-sm font-medium text-foreground">{agentName || tt('pay.defaultName', 'AI 助手')}</Text>
                <Text className="block text-xs text-muted-foreground">{tt('pay.subscribeTip', '订阅后可无限使用')}</Text>
              </View>
            </View>
            {/* 价格 */}
            <View className="mb-2">
              <Text className="text-xs text-muted-foreground">
                {tt('pay.priceLabel', '价格')}: ¥{price} / {tt('pay.perMonth', '月')}
              </Text>
            </View>
            {/* 数量 */}
            <View className="flex items-center mb-3">
              <Text className="text-xs text-muted-foreground mr-2">{tt('pay.countLabel', '数量')}:</Text>
              <View
                className="w-7 h-7 flex items-center justify-center rounded-md border border-border"
                onClick={() => count > 1 && setCount(count - 1)}
              >
                <Text className="text-sm">−</Text>
              </View>
              <Text className="mx-3 text-sm">{count}</Text>
              <View
                className="w-7 h-7 flex items-center justify-center rounded-md border border-border"
                onClick={() => setCount(count + 1)}
              >
                <Text className="text-sm">+</Text>
              </View>
            </View>
            {/* 立即支付按钮 */}
            <View
              className="w-full py-3 rounded-md text-center bg-primary text-white font-medium"
              onClick={handlePay}
            >
              <Text className="text-sm">{tt('pay.payNow', '立即支付')} ¥{realPrice}</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
