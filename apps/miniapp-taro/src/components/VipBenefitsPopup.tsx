// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, t } from '@/i18n'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { getSystemInfoCompat } from '@/utils/system-info'
// 对勾图标(对齐原项目 UserMembershipBenefits.vue 的 pigeona.png)
import pigeonaImg from '@/assets/remote/images/pigeona.png'

/**
 * 会员权益介绍弹窗 — 对齐原项目 introduce-popup 4 个变体
 * - variant='default':默认简化版(本项目原有)
 * - variant='single':对齐 introduce-popup/index.vue(单帜会员权益,"去开通"单按钮,纯色背景)
 * - variant='double':对齐 introduce-popup/indexs.vue(操盘手权益,"加入我们"+"再咨询一下"双按钮,渐变背景)
 * - variant='level':对齐 introduce-popup/levelIndex.vue(会员等级介绍,10 级成长值,iOS 隐藏按钮,渐变背景)
 * - variant='advisory':对齐 introduce-popup/privateAdvisory.vue(私人顾问,5 项权益 + 服务弹窗二维码,72vh,纯色背景)
 */

export interface VipBenefit {
  id: string | number
  /** rich-text 风格的 HTML 内容(支持 <span style="font-weight: bold;"> 加粗) */
  content?: string
  /** 纯文本标题(default variant 用) */
  title?: string
  desc?: string
  /** advisory variant 的每项颜色 */
  color?: string
}

export type VipBenefitsPopupVariant = 'default' | 'single' | 'double' | 'level' | 'advisory'

export interface VipBenefitsPopupProps {
  visible?: boolean
  variant?: VipBenefitsPopupVariant
  /** 权益列表(不传则用 variant 对应的默认数据) */
  benefits?: VipBenefit[]
  /** level variant 顶部 0 级提示文案 */
  levelIntro?: string
  /** level variant 的"更多权益"文案(空字符串则不显示) */
  moreBenefitsText?: string
  /** 用户信息(用于头像显示) */
  userInfo?: { isVIP?: number; identityTypy?: number; avatar?: string }
  /** 主按钮点击(去开通/加入我们) */
  onUpgrade?: () => void
  /** 次按钮点击(再咨询一下) */
  onConsult?: () => void
  /** 关闭弹窗 */
  onClose?: () => void
}

// ===== 4 个变体的默认权益数据(对齐原项目) =====
const SINGLE_BENEFITS: VipBenefit[] = [
  {
    id: 1,
    content: t('VipBenefitsPopup.rich1'),
  },
  {
    id: 2,
    content: t('VipBenefitsPopup.rich2'),
  },
  {
    id: 3,
    content: t('VipBenefitsPopup.rich3'),
  },
  {
    id: 4,
    content: t('VipBenefitsPopup.rich4'),
  },
  {
    id: 5,
    content: t('VipBenefitsPopup.d1'),
  },
  {
    id: 6,
    content: t('VipBenefitsPopup.d2'),
  },
  {
    id: 7,
    content: t('VipBenefitsPopup.rich5'),
  },
  {
    id: 8,
    content: t('VipBenefitsPopup.rich6'),
  },
  { id: 9, content: t('VipBenefitsPopup.d3') },
  { id: 10, content: t('VipBenefitsPopup.d4') },
]

const DOUBLE_BENEFITS: VipBenefit[] = [
  { id: 1, content: t('VipBenefitsPopup.d5') },
  { id: 2, content: t('VipBenefitsPopup.d6') },
  {
    id: 3,
    content: t('VipBenefitsPopup.d7'),
  },
  {
    id: 4,
    content: t('VipBenefitsPopup.rich7'),
  },
  {
    id: 5,
    content: t('VipBenefitsPopup.rich8'),
  },
  { id: 6, content: t('VipBenefitsPopup.d8') },
  {
    id: 7,
    content: t('VipBenefitsPopup.rich9'),
  },
  {
    id: 8,
    content: t('VipBenefitsPopup.rich10'),
  },
  { id: 9, content: t('VipBenefitsPopup.d9') },
  {
    id: 10,
    content: t('VipBenefitsPopup.rich11'),
  },
]

const LEVEL_BENEFITS: VipBenefit[] = [
  {
    id: 1,
    content: t('VipBenefitsPopup.rich12'),
  },
  {
    id: 2,
    content: t('VipBenefitsPopup.rich13'),
  },
  {
    id: 3,
    content: t('VipBenefitsPopup.rich14'),
  },
  {
    id: 4,
    content: t('VipBenefitsPopup.rich15'),
  },
  {
    id: 5,
    content: t('VipBenefitsPopup.rich16'),
  },
  {
    id: 6,
    content: t('VipBenefitsPopup.rich17'),
  },
  {
    id: 7,
    content: t('VipBenefitsPopup.rich18'),
  },
  {
    id: 8,
    content: t('VipBenefitsPopup.rich19'),
  },
  {
    id: 9,
    content: t('VipBenefitsPopup.rich20'),
  },
  {
    id: 10,
    content: t('VipBenefitsPopup.rich21'),
  },
]

const ADVISORY_BENEFITS: VipBenefit[] = [
  {
    id: 1,
    content: t('VipBenefitsPopup.d10'),
    color: 'rgba(255, 79, 79,0.6)',
  },
  {
    id: 2,
    content: t('VipBenefitsPopup.d11'),
    color: 'rgba(255, 79, 79,0.7)',
  },
  {
    id: 3,
    content: t('VipBenefitsPopup.d12'),
    color: 'rgba(255, 79, 79,0.8)',
  },
  {
    id: 4,
    content: t('VipBenefitsPopup.d13'),
    color: 'rgba(255, 79, 79,0.9)',
  },
  {
    id: 5,
    content: t('VipBenefitsPopup.d14'),
    color: 'rgba(255, 79, 79,1)',
  },
]

const DEFAULT_BENEFITS: VipBenefit[] = [
  { id: '1', title: t('vip.details.benefit.chat'), desc: t('VipBenefitsPopup.d15') },
  { id: '2', title: t('VipBenefitsPopup.d16'), desc: t('VipBenefitsPopup.d17') },
  { id: '3', title: t('memberBenefits.d31'), desc: t('VipBenefitsPopup.d19') },
  { id: '4', title: t('VipBenefitsPopup.d20'), desc: t('VipBenefitsPopup.d21') },
]

// 变体配置:高度 + 背景 + 是否显示"更多权益" + 是否显示服务弹窗
const VARIANT_CONFIG: Record<
  Exclude<VipBenefitsPopupVariant, 'default'>,
  {
    height: string
    gradient: boolean
    moreText: string
    showServicePopup: boolean
    primaryText: string
    secondaryText?: string
    showSecondary: boolean
    iosHidePrimary: boolean
  }
> = {
  single: {
    height: '80vh',
    gradient: false,
    moreText: t('VipBenefitsPopup.z1'),
    showServicePopup: false,
    primaryText: t('vip.privilege.goOpen'),
    showSecondary: false,
    iosHidePrimary: false,
  },
  double: {
    height: '80vh',
    gradient: true,
    moreText: t('VipBenefitsPopup.z2'),
    showServicePopup: false,
    primaryText: t('recruitment.defaultTitle'),
    secondaryText: t('VipBenefitsPopup.r1'),
    showSecondary: true,
    iosHidePrimary: false,
  },
  level: {
    height: '80vh',
    gradient: true,
    moreText: '',
    showServicePopup: false,
    primaryText: t('vip.privilege.goOpen'),
    showSecondary: false,
    iosHidePrimary: true,
  },
  advisory: {
    height: '72vh',
    gradient: false,
    moreText: '',
    showServicePopup: true,
    primaryText: t('recruitment.defaultTitle'),
    showSecondary: false,
    iosHidePrimary: false,
  },
}

// rich-text 渲染:解析 <span style="font-weight: bold;[color: #xxx;]">xxx</span> 保留加粗 + 颜色
// 对齐原项目 uni <rich-text :nodes="..."> 的视觉效果(关键数字/关键词加粗高亮)
function renderRichText(html: string, outerColor?: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /<span\s+style="([^"]*)">([^<]+)<\/span>/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      parts.push(html.slice(lastIndex, match.index))
    }
    const spanStyle = match[1] ?? ''
    const spanText = match[2] ?? ''
    const isBold = spanStyle.includes('font-weight: bold')
    const colorMatch = spanStyle.match(/color:\s*(#[0-9a-fA-F]+)/)
    const spanColor = colorMatch ? colorMatch[1] : undefined
    parts.push(
      <Text
        key={`rt-${key++}`}
        style={{
          fontWeight: isBold ? 'bold' : 'normal',
          ...(spanColor ? { color: spanColor } : {}),
        }}
      >
        {spanText}
      </Text>,
    )
    lastIndex = regex.lastIndex
  }
  if (lastIndex < html.length) {
    parts.push(html.slice(lastIndex))
  }

  if (parts.length === 0) {
    return (
      <Text style={outerColor ? { color: outerColor } : undefined}>
        {html.replace(/<[^>]+>/g, '')}
      </Text>
    )
  }

  return <Text style={outerColor ? { color: outerColor } : undefined}>{parts}</Text>
}

export default function VipBenefitsPopup({
  visible = false,
  variant = 'default',
  benefits,
  levelIntro = t('VipBenefitsPopup.z3'),
  moreBenefitsText,
  userInfo,
  onUpgrade,
  onConsult,
  onClose,
}: VipBenefitsPopupProps) {
  const tt = useTt()
  const [servicePopupVisible, setServicePopupVisible] = useState(false)
  // iOS 检测(level variant 用,对齐原项目 uni.getSystemInfoSync().osName == 'ios')
  // iOS 隐藏"去开通"按钮(App Store 支付合规)。useState 必须在所有条件 return 之前调用。
  const [isIOS] = useState(() => {
    try {
      return getSystemInfoCompat().platform === 'ios'
    } catch {
      return false
    }
  })
  // userInfo 保留供未来扩展(头像显示/VIP 徽章等),当前 variant 用默认数据
  void userInfo

  if (!visible) return null

  // default variant 走原有简化版
  if (variant === 'default') {
    const list = benefits ?? DEFAULT_BENEFITS
    return (
      <View className="fixed inset-0 z-[2000] flex items-end" onClick={onClose}>
        <View className="absolute inset-0 bg-black/50" />
        <View
          className="relative bg-card rounded-t-2xl w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <View className="flex items-center justify-between px-4 py-3">
            <Text className="text-base font-medium text-warning">
              {tt('vip.benefitsTitle', '会员权益')}
            </Text>
            <Text className="text-sm text-muted-foreground" onClick={onClose}>
              {tt('common.close', '关闭')}
            </Text>
          </View>
          <ScrollView scrollY className="" style={{ maxHeight: '50vh' }}>
            <View className="px-4 py-2">
              {list.map((b) => (
                <View key={b.id} className="flex items-start py-3 mb-2">
                  <View className="flex items-center justify-center w-8 h-8 mr-3 rounded-lg bg-yellow-50">
                    <Image src={pigeonaImg} mode="aspectFit" className="w-4 h-4" />
                  </View>
                  <View className="flex-1">
                    <Text className="block text-sm font-medium text-foreground">{b.title}</Text>
                    {b.desc && (
                      <Text className="block text-xs text-muted-foreground mt-0.5">{b.desc}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
          <View className="px-4 py-3">
            <View
              className="w-full py-3 rounded-md text-center"
              style={{ background: 'linear-gradient(90deg, #fbbf24, var(--color-warning))' }}
              onClick={onUpgrade}
            >
              <Text className="text-sm text-white font-medium">
                {tt('vip.upgradeNow', '立即升级')}
              </Text>
            </View>
          </View>
        </View>
      </View>
    )
  }

  // 4 个对齐变体
  const cfg = VARIANT_CONFIG[variant]
  const list =
    benefits ??
    (variant === 'single'
      ? SINGLE_BENEFITS
      : variant === 'double'
        ? DOUBLE_BENEFITS
        : variant === 'level'
          ? LEVEL_BENEFITS
          : ADVISORY_BENEFITS)
  const finalMoreText = moreBenefitsText !== undefined ? moreBenefitsText : cfg.moreText

  // iOS 检测(level variant 用,对齐原项目 uni.getSystemInfoSync().osName == 'ios')
  // iOS 隐藏"去开通"按钮(App Store 支付合规)
  // isIOS useState 已提前到组件顶部(所有条件 return 之前),这里直接使用
  const showPrimary = !(cfg.iosHidePrimary && isIOS)

  const handlePrimary = () => {
    if (cfg.showServicePopup) {
      setServicePopupVisible(true)
    } else {
      onUpgrade?.()
    }
  }

  const handleSecondary = () => {
    onConsult?.()
    onClose?.()
  }

  // 弹窗背景:gradient=true 用渐变,false 用纯色
  const popupBg = cfg.gradient
    ? 'linear-gradient(to bottom right, rgba(205, 208, 255, 0.7) 0%, rgba(253, 255, 225, 0.7) 100%)'
    : 'var(--color-muted)'

  return (
    <View className="fixed inset-0 z-[9999] flex items-end" onClick={onClose}>
      <View className="absolute inset-0 bg-black/50" />
      <View
        className="relative w-full overflow-hidden"
        style={{
          height: cfg.height,
          borderRadius: '20rpx',
          background: popupBg,
          boxShadow:
            '0 5px 15px rgba(0, 0, 0, 0.2), inset 0 -1px 2px rgba(255, 255, 255, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <View
          className="w-full h-full flex flex-col relative"
          style={{ padding: '40rpx 30rpx', boxSizing: 'border-box' }}
        >
          {/* level variant 顶部 0 级提示(对齐原项目 levelIndex.vue:level-text 在 benefits-list 之前) */}
          {variant === 'level' && (
            <Text style={{ color: 'var(--color-brand)', fontSize: '24rpx', marginBottom: '10rpx' }}>
              {levelIntro}
            </Text>
          )}

          {/* 权益列表 */}
          <ScrollView scrollY className="flex-1 mb-5" style={{ WebkitOverflowScrolling: 'touch' }}>
            <View className="flex flex-col" style={{ gap: '12rpx' }}>
              {list.map((b) => (
                <View
                  key={b.id}
                  className="flex items-start"
                  style={{
                    border: '1px solid var(--color-border)',
                    padding: '8rpx',
                    borderRadius: '15rpx',
                    fontSize: '28rpx',
                    color: 'var(--color-foreground)',
                  }}
                >
                  {variant !== 'advisory' && (
                    <Text className="font-bold" style={{ paddingRight: '8rpx' }}>
                      {typeof b.id === 'number' ? b.id : b.id}.
                    </Text>
                  )}
                  <View className="flex-1">
                    {renderRichText(b.content ?? b.title ?? '', b.color)}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* 更多权益 */}
          {finalMoreText && (
            <View
              className="text-center"
              style={{ fontSize: '26rpx', color: 'var(--color-destructive)' }}
            >
              {renderRichText(finalMoreText)}
            </View>
          )}

          {/* 版权信息 */}
          <View
            className="text-center"
            style={{
              fontSize: '18rpx',
              color: 'var(--color-muted-foreground)',
              marginTop: '10rpx',
            }}
          >
            COPYRIGHT © 2024 IKUIINE-AI ALL RIGHTS RESERVED.
          </View>

          {/* 底部按钮 */}
          <View className="flex justify-center" style={{ gap: cfg.showSecondary ? '20rpx' : '0' }}>
            {showPrimary && (
              <View
                className="flex justify-center items-center"
                style={{
                  width: '356rpx',
                  height: '80rpx',
                  borderRadius: '30rpx',
                  margin: '20rpx auto',
                  fontSize: '30rpx',
                  fontWeight: 500,
                  color: 'var(--color-foreground)',
                  border: '1rpx solid rgba(255, 255, 255, 0.8)',
                  background: 'linear-gradient(to bottom, var(--color-card), var(--color-muted))',
                  boxShadow:
                    '0 4rpx 10rpx rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 1)',
                }}
                onClick={handlePrimary}
              >
                <Text>{cfg.primaryText}</Text>
              </View>
            )}
            {cfg.showSecondary && (
              <View
                className="flex justify-center items-center"
                style={{
                  width: '356rpx',
                  height: '80rpx',
                  borderRadius: '30rpx',
                  margin: '20rpx auto',
                  fontSize: '30rpx',
                  fontWeight: 500,
                  color: 'var(--color-card)',
                  border: '1rpx solid var(--color-foreground)',
                  background: 'var(--color-foreground)',
                  boxShadow: '0 4rpx 10rpx rgba(0, 0, 0, 0.25)',
                }}
                onClick={handleSecondary}
              >
                <Text>{cfg.secondaryText}</Text>
              </View>
            )}
          </View>
        </View>

        {/* advisory variant:服务弹窗(二维码) */}
        {cfg.showServicePopup && servicePopupVisible && (
          <View
            className="fixed inset-0 flex justify-center items-center"
            style={{
              zIndex: 99999,
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
            }}
            onClick={() => setServicePopupVisible(false)}
          >
            <View
              className="relative"
              style={{
                padding: '20rpx',
                borderRadius: '30rpx',
                background: 'rgba(255, 255, 255, 0.4)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0px 6px 6px 0px rgba(169, 165, 255, 0.6)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <View className="flex flex-col items-center">
                {/* 服务弹窗内容:名片 + 二维码(用占位图,实际使用时替换为真实资源) */}
                <Image
                  className="block mx-auto"
                  style={{
                    width: '100%',
                    height: '411rpx',
                    borderRadius: '30rpx',
                    marginBottom: '16rpx',
                  }}
                  src="/static/images/default/mingpian.png"
                  mode="aspectFill"
                />
                <Image
                  className="block mx-auto"
                  style={{ width: '100%', borderRadius: '8rpx' }}
                  src="/static/images/erweima.png"
                  mode="widthFix"
                  showMenuByLongpress
                />
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
