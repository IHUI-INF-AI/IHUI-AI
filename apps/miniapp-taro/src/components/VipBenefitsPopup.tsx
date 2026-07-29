import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useI18n } from '@/i18n'

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
  { id: 1, content: '限时优惠<span style="font-weight: bold;">588</span>元,<span style="font-weight: bold;">8</span>月<span style="font-weight: bold;">8</span>日恢复<span style="font-weight: bold;">1288</span>元' },
  { id: 2, content: '赠送<span style="font-weight: bold;">800</span>万算力,爽用独家<span style="font-weight: bold;">Agent</span>' },
  { id: 3, content: '获得分销权益,用<span style="font-weight: bold;">AI</span>降本增效<span style="font-weight: bold;">100</span>倍赚米' },
  { id: 4, content: '私人<span style="font-weight: bold;">AI</span>客服定制权,拥有只属于自己的私密<span style="font-weight: bold;">AI</span>' },
  { id: 5, content: '无限次查看<span style="font-weight: bold;">垂类赛道</span>每日整理资讯,远超他人认知' },
  { id: 6, content: '创始人排队咨询资格,<span style="font-weight: bold;">AI</span>创业项目获取资格' },
  { id: 7, content: '多对一答疑陪跑:<span style="font-weight: bold;">AI</span>教学/自媒体账号搭建/<span style="font-weight: bold;">AI</span>+全域流量陪跑/<span style="font-weight: bold;">MCN</span>超级个人<span style="font-weight: bold;">IP</span>孵化权' },
  { id: 8, content: '免费<span style="font-weight: bold;">AI</span>导航站,<span style="font-weight: bold;">AI</span>服务成本价,不用再被<span style="font-weight: bold;">割</span>韭菜' },
  { id: 9, content: '最新研发<span style="font-weight: bold;">Agentic</span>内测使用资格一个月' },
  { id: 10, content: '升级系统增加算力充值/课程开通/服务开通折扣' },
]

const DOUBLE_BENEFITS: VipBenefit[] = [
  { id: 1, content: '享受大额分销资格,<span style="font-weight: bold;">入驻</span>社区服务商名列' },
  { id: 2, content: '会员等级拉满,享受<span style="font-weight: bold;">全部</span>满级折扣等权益' },
  { id: 3, content: '二级分销权益,快速扩张<span style="font-weight: bold;">团队</span>及收益,创办一人公司' },
  { id: 4, content: '最新研发前沿<span style="font-weight: bold;">agentic</span>内测免费使用资格<span style="font-weight: bold;">一年</span>' },
  { id: 5, content: '插队定制独家定制<span style="font-weight: bold;">agent</span>功能<span style="font-weight: bold;">8</span>折优惠' },
  { id: 6, content: '创始人<span style="font-weight: bold;">一对一</span>随时答疑陪跑' },
  { id: 7, content: '<span style="font-weight: bold;">AI</span>深度认知课/<span style="font-weight: bold;">AI</span>专家一对一陪跑教学/升维课程/深度商业课/流量全链路打法课程/免费观看' },
  { id: 8, content: '<span style="font-weight: bold;">AI</span>+垂类账号孵化优先陪跑机会/加入<span style="font-weight: bold;">MCN</span>机会' },
  { id: 9, content: '公司总部入驻及线下学习实操机会' },
  { id: 10, content: '插队<span style="font-weight: bold;">AI</span>分身/<span style="font-weight: bold;">AI</span>客服定制开通' },
]

const LEVEL_BENEFITS: VipBenefit[] = [
  { id: 1, content: '1.限时消费<span style="font-weight: bold;color: #FF0000;">588</span>开通会员,获赠<span style="font-weight: bold;color: #FF0000;">588</span>点成长值,达到<span style="font-weight: bold;color: #FF0000;">1级:算法萌芽</span>' },
  { id: 2, content: '2.达到<span style="font-weight: bold;color: #FF0000;">1500</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">2级:数智启源</span>,享受<span style="font-weight: bold;color: #FF0000;">588</span>点成长值,达到<span style="font-weight: bold;color: #FF0000;">9.8</span>折' },
  { id: 3, content: '3.达到<span style="font-weight: bold;color: #FF0000;">3000</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">3级:模型初阶</span>,享受<span style="font-weight: bold;color: #FF0000;">588</span>点成长值,达到<span style="font-weight: bold;color: #FF0000;">9.5</span>折' },
  { id: 4, content: '4.达到<span style="font-weight: bold;color: #FF0000;">4500</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">4级:智探先驱</span>,享受<span style="font-weight: bold;color: #FF0000;">588</span>点成长值,达到<span style="font-weight: bold;color: #FF0000;">9.2</span>折' },
  { id: 5, content: '5.达到<span style="font-weight: bold;color: #FF0000;">6000</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">5级:算构初阶</span>,享受<span style="font-weight: bold;color: #FF0000;">588</span>点成长值,达到<span style="font-weight: bold;color: #FF0000;">8.9</span>折' },
  { id: 6, content: '6.达到<span style="font-weight: bold;color: #FF0000;">7500</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">6级:数据专家</span>,享受<span style="font-weight: bold;color: #FF0000;">588</span>点成长值,达到<span style="font-weight: bold;color: #FF0000;">8.6</span>折' },
  { id: 7, content: '7.达到<span style="font-weight: bold;color: #FF0000;">9000</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">7级:智垒中枢</span>,享受<span style="font-weight: bold;color: #FF0000;">588</span>点成长值,达到<span style="font-weight: bold;color: #FF0000;">8.3</span>折' },
  { id: 8, content: '8.达到<span style="font-weight: bold;color: #FF0000;">10500</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">8级:智能领航</span>,享受<span style="font-weight: bold;color: #FF0000;">588</span>点成长值,达到<span style="font-weight: bold;color: #FF0000;">8</span>折' },
  { id: 9, content: '9.达到<span style="font-weight: bold;color: #FF0000;">12000</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">9级:量子智脑</span>,享受<span style="font-weight: bold;color: #FF0000;">588</span>点成长值,达到<span style="font-weight: bold;color: #FF0000;">7.7</span>折' },
  { id: 10, content: '10.达到<span style="font-weight: bold;color: #FF0000;">18888</span>智汇力达到<span style="font-weight: bold;color: #FF0000;">10级:超维先知</span>,享受<span style="font-weight: bold;color: #FF0000;">588</span>点成长值,达到<span style="font-weight: bold;color: #FF0000;">7</span>折' },
]

const ADVISORY_BENEFITS: VipBenefit[] = [
  { id: 1, content: '<span style="font-weight: bold;">权益一:顶流人脉资源圈链接机会</span>', color: 'rgba(255, 79, 79,0.6)' },
  { id: 2, content: '<span style="font-weight: bold;">权益二:优质创业项目分享</span>', color: 'rgba(255, 79, 79,0.7)' },
  { id: 3, content: '<span style="font-weight: bold;">权益三:对接资本权益</span>', color: 'rgba(255, 79, 79,0.8)' },
  { id: 4, content: '<span style="font-weight: bold;">权益四:AI圈技术大佬交流学习机会</span>', color: 'rgba(255, 79, 79,0.9)' },
  { id: 5, content: '<span style="font-weight: bold;">权益五:AI开源技术共享</span>', color: 'rgba(255, 79, 79,1)' },
]

const DEFAULT_BENEFITS: VipBenefit[] = [
  { id: '1', title: '无限 AI 对话', desc: '畅享 GPT-4 等顶级模型' },
  { id: '2', title: '高清视频生成', desc: '4K 质量无水印' },
  { id: '3', title: '专属客服', desc: '7×24 小时服务' },
  { id: '4', title: '会员专属内容', desc: '解锁全部付费课程' },
]

// 变体配置:高度 + 背景 + 是否显示"更多权益" + 是否显示服务弹窗
const VARIANT_CONFIG: Record<
  Exclude<VipBenefitsPopupVariant, 'default'>,
  { height: string; gradient: boolean; moreText: string; showServicePopup: boolean; primaryText: string; secondaryText?: string; showSecondary: boolean; iosHidePrimary: boolean }
> = {
  single: {
    height: '80vh',
    gradient: false,
    moreText: '............约 <span style="font-weight: bold;">20</span> 项权益, 且持续增加 ↑',
    showServicePopup: false,
    primaryText: '去开通',
    showSecondary: false,
    iosHidePrimary: false,
  },
  double: {
    height: '80vh',
    gradient: true,
    moreText: '............约 <span style="font-weight: bold;">20</span> 项权益, 且持续增加 ↑',
    showServicePopup: false,
    primaryText: '加入我们',
    secondaryText: '再咨询一下',
    showSecondary: true,
    iosHidePrimary: false,
  },
  level: {
    height: '80vh',
    gradient: true,
    moreText: '',
    showServicePopup: false,
    primaryText: '去开通',
    showSecondary: false,
    iosHidePrimary: true,
  },
  advisory: {
    height: '72vh',
    gradient: false,
    moreText: '',
    showServicePopup: true,
    primaryText: '加入我们',
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
      </Text>
    )
    lastIndex = regex.lastIndex
  }
  if (lastIndex < html.length) {
    parts.push(html.slice(lastIndex))
  }

  if (parts.length === 0) {
    return <Text style={outerColor ? { color: outerColor } : undefined}>{html.replace(/<[^>]+>/g, '')}</Text>
  }

  return <Text style={outerColor ? { color: outerColor } : undefined}>{parts}</Text>
}

export default function VipBenefitsPopup({
  visible = false,
  variant = 'default',
  benefits,
  levelIntro = '0级:智域访客,升级会员享受折扣包含全部课程/算力/自动化智能体/知识库/定制服务等,持续增加功能',
  moreBenefitsText,
  userInfo,
  onUpgrade,
  onConsult,
  onClose,
}: VipBenefitsPopupProps) {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const [servicePopupVisible, setServicePopupVisible] = useState(false)
  // iOS 检测(level variant 用,对齐原项目 uni.getSystemInfoSync().osName == 'ios')
  // iOS 隐藏"去开通"按钮(App Store 支付合规)。useState 必须在所有条件 return 之前调用。
  const [isIOS] = useState(() => {
    try {
      return Taro.getSystemInfoSync().platform === 'ios'
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
        <View className="relative bg-card rounded-t-2xl w-full" onClick={(e) => e.stopPropagation()}>
          <View className="flex items-center justify-between px-4 py-3">
            <Text className="text-base font-medium text-warning">{tt('vip.benefitsTitle', '会员权益')}</Text>
            <Text className="text-sm text-muted-foreground" onClick={onClose}>
              关闭
            </Text>
          </View>
          <ScrollView scrollY className="" style={{ maxHeight: '50vh' }}>
            <View className="px-4 py-2">
              {list.map((b) => (
                <View key={b.id} className="flex items-start py-3 mb-2">
                  <View className="flex items-center justify-center w-8 h-8 mr-3 rounded-lg bg-yellow-50">
                    <Text className="text-base">★</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="block text-sm font-medium text-foreground">{b.title}</Text>
                    {b.desc && <Text className="block text-xs text-muted-foreground mt-0.5">{b.desc}</Text>}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
          <View className="px-4 py-3">
            {/* TODO: custom color: #fbbf24 VIP 品牌金色渐变起始色,无对应 token,保留原值 */}
            <View
              className="w-full py-3 rounded-md text-center"
              style={{ background: 'linear-gradient(90deg, #fbbf24, var(--color-warning))' }}
              onClick={onUpgrade}
            >
              <Text className="text-sm text-white font-medium">{tt('vip.upgradeNow', '立即升级')}</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }

  // 4 个对齐变体
  const cfg = VARIANT_CONFIG[variant]
  const list = benefits ?? (variant === 'single' ? SINGLE_BENEFITS : variant === 'double' ? DOUBLE_BENEFITS : variant === 'level' ? LEVEL_BENEFITS : ADVISORY_BENEFITS)
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
          boxShadow: '0 5px 15px rgba(0, 0, 0, 0.2), inset 0 -1px 2px rgba(255, 255, 255, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <View className="w-full h-full flex flex-col relative" style={{ padding: '40rpx 30rpx', boxSizing: 'border-box' }}>
          {/* level variant 顶部 0 级提示(对齐原项目 levelIndex.vue:level-text 在 benefits-list 之前) */}
          {variant === 'level' && (
            <Text style={{ color: 'var(--color-brand)', fontSize: '24rpx', marginBottom: '10rpx' }}>{levelIntro}</Text>
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
                  <View className="flex-1">{renderRichText(b.content ?? b.title ?? '', b.color)}</View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* 更多权益 */}
          {finalMoreText && (
            <View className="text-center" style={{ fontSize: '26rpx', color: 'var(--color-destructive)' }}>
              {renderRichText(finalMoreText)}
            </View>
          )}

          {/* 版权信息 */}
          <View className="text-center" style={{ fontSize: '18rpx', color: 'var(--color-muted-foreground)', marginTop: '10rpx' }}>
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
                  boxShadow: '0 4rpx 10rpx rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 1)',
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
            style={{ zIndex: 99999, backgroundColor: 'rgba(255, 255, 255, 0.3)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
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
                  style={{ width: '100%', height: '411rpx', borderRadius: '30rpx', marginBottom: '16rpx' }}
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
