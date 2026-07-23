import { View, Text, Image, Button, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import './index.css'

interface VipPriceData {
  amount: number
}

interface TraderProfile {
  nickname: string
  title: string
  avatar: string
  intro: string
}

const DEFAULT_AMOUNT = 1999
const DEFAULT_AVATAR = '/static/default-avatar.png'

const TRADER_PROFILE: TraderProfile = {
  nickname: 'AI智汇社 操盘手',
  title: '资深市场分析师 / 平台认证',
  avatar: '',
  intro:
    'AI智汇社认证操盘手,10 年 A 股实战经验,擅长技术面与基本面结合分析,曾管理规模超 5 亿的组合。专注趋势策略与风控体系搭建,累计服务超 2000 名学员,以严谨、专业、贴近实战著称。',
}

// 操盘手能力标签(对标任务要求:技术分析/基本面/风控/选股等)
const CAPABILITY_TAGS = [
  { key: 'tech', label: '技术分析' },
  { key: 'fundamental', label: '基本面' },
  { key: 'risk', label: '风控' },
  { key: 'picker', label: '选股' },
  { key: 'quant', label: '量化' },
  { key: 'sentiment', label: '情绪面' },
]

// 操盘手权益(对标原 vip/trader.vue features,精选 8 项)
const TRADER_FEATURES = [
  { icon: '🏅', key: 'distribution_qualification', title: '分销资格', desc: '享受大额分销资格,入驻社区服务商名列' },
  { icon: '🎓', key: 'ai_courses', title: 'AI 课程', desc: 'AI深度认知课/深度商业课/流量全链路打法课程免费观看' },
  { icon: '🤝', key: 'founder_qa', title: '创始人答疑', desc: '创始人一对一随时答疑陪跑' },
  { icon: '🧪', key: 'agent_beta', title: 'Agent 内测', desc: '最新研发 agent 内测资格一年' },
  { icon: '💎', key: 'vip_max_discount', title: '顶级折扣', desc: '会员等级拉满,享受全部最高折扣' },
  { icon: '⚡', key: 'custom_agent_discount', title: '定制优惠', desc: '插队定制独家定制 agent 功能 8 折优惠' },
  { icon: '🚀', key: 'vertical_account_incubation', title: '账号孵化', desc: 'AI+垂类账号孵化优先陪跑机会' },
  { icon: '💡', key: 'free_computing_power', title: '赠送算力', desc: '操盘手赠送 1600W 算力' },
]

// 历史业绩指标(年化收益率/胜率/最大回撤/累计收益)
const PERFORMANCE_METRICS = [
  { key: 'annualReturn', label: '年化收益', value: '+38.6%', tone: 'up' as const },
  { key: 'winRate', label: '胜率', value: '72.4%', tone: 'up' as const },
  { key: 'maxDrawdown', label: '最大回撤', value: '-12.8%', tone: 'down' as const },
  { key: 'totalReturn', label: '累计收益', value: '+186.2%', tone: 'up' as const },
]

// 最近 6 月业绩柱状图(单位 %,纯 CSS 柱状图)
const PERF_BARS = [12, 18, 9, 22, 15, 28]

// 服务包列表(服务名 + 价格 + 服务周期 + 订阅按钮)
const SERVICE_PACKAGES = [
  { id: 'sp1', name: '月度陪跑', price: 999, period: '30 天', highlight: false },
  { id: 'sp2', name: '季度策略', price: 2699, period: '90 天', highlight: true },
  { id: 'sp3', name: '年度会员', price: 8999, period: '365 天', highlight: false },
]

// 用户评价(评分 + 评价内容)
const USER_REVIEWS = [
  { id: 'r1', nickname: '李先生', avatar: '', rating: 5, content: '操盘手老师讲解很到位,策略实操性强,跟着执行确实有收获。' },
  { id: 'r2', nickname: '王女士', avatar: '', rating: 4, content: '一对一答疑很负责,大盘观点对择时帮助很大,推荐。' },
]

export default function VipTraderIndexPage() {
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }, [t])
  const [amount, setAmount] = useState(DEFAULT_AMOUNT)
  const [introExpanded, setIntroExpanded] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get<VipPriceData>('/vip/price')
      if (res && typeof res.amount === 'number' && res.amount > 0) {
        setAmount(res.amount)
      }
    } catch (e) {
      logger.error('vip-trader', '获取操盘手价格', e)
    }
  }, [])

  useDidShow(load)

  const openPopup = useCallback(() => {
    Taro.showModal({
      title: tt('vipTrader.openTitle', '开通会员'),
      content: `${tt('vipTrader.confirmPay', '确认支付')} ¥${amount} ${tt('vipTrader.openTrader', '开通操盘手会员')}?`,
      success: (res) => {
        if (res.confirm) {
          Taro.showToast({ title: tt('vipTrader.opened', '开通成功'), icon: 'success' })
        }
      },
    })
  }, [amount, tt])

  const handleConsult = useCallback(() => {
    Taro.showToast({ title: tt('vipTrader.consultHint', '已为您接通顾问'), icon: 'none' })
  }, [tt])

  const handleSubscribe = useCallback(
    (pkgName: string, pkgPrice: number) => {
      Taro.showModal({
        title: tt('vipTrader.subscribeTitle', '订阅服务包'),
        content: `${tt('vipTrader.subscribeConfirm', '确认订阅')} ${pkgName} ¥${pkgPrice}?`,
        success: (res) => {
          if (res.confirm) {
            Taro.showToast({ title: tt('vipTrader.subscribed', '订阅成功'), icon: 'success' })
          }
        },
      })
    },
    [tt],
  )

  const avatar = TRADER_PROFILE.avatar || DEFAULT_AVATAR

  return (
    <View className="vip-trader-page">
      <ScrollView scrollY className="trader-scroll">
        {/* 操盘手头部:头像 + 姓名 + 头衔 + 认证徽章 + 会员价 */}
        <View className="trader-header">
          <View className="trader-header-main">
            <Image className="trader-avatar" src={avatar} mode="aspectFill" />
            <View className="trader-header-info">
              <View className="trader-name-row">
                <Text className="trader-name">{TRADER_PROFILE.nickname}</Text>
                <View className="trader-badge">
                  <Text className="trader-badge-text">{tt('vipTrader.verified', '认证')}</Text>
                </View>
              </View>
              <Text className="trader-title-text">{TRADER_PROFILE.title}</Text>
              <View className="trader-price-wrap">
                <Text className="trader-price-symbol">¥</Text>
                <Text className="trader-price">{amount}</Text>
                <Text className="trader-price-suffix">
                  {tt('vipTrader.oncePay', '一次性支付,')}
                  {tt('vipTrader.lifetimeUse', '终身使用')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 操盘手简介(展开/收起) */}
        <View className="trader-section">
          <Text className="section-title">{tt('vipTrader.introSection', '操盘手简介')}</Text>
          <Text className={`trader-intro ${introExpanded ? 'trader-intro-expanded' : ''}`}>
            {TRADER_PROFILE.intro}
          </Text>
          <View
            className="trader-intro-toggle"
            onClick={() => setIntroExpanded((v) => !v)}
          >
            <Text className="trader-intro-toggle-text">
              {introExpanded
                ? tt('vipTrader.collapse', '收起')
                : tt('vipTrader.expand', '展开全部')}
            </Text>
          </View>
        </View>

        {/* 核心能力标签 */}
        <View className="trader-section">
          <Text className="section-title">{tt('vipTrader.capabilitySection', '核心能力')}</Text>
          <View className="trader-tags">
            {CAPABILITY_TAGS.map((tag) => (
              <View key={tag.key} className="trader-tag">
                <Text className="trader-tag-text">{tag.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 历史业绩 + 业绩柱状图 */}
        <View className="trader-section">
          <Text className="section-title">{tt('vipTrader.performanceSection', '历史业绩')}</Text>
          <View className="trader-metrics">
            {PERFORMANCE_METRICS.map((m) => (
              <View key={m.key} className="trader-metric">
                <Text
                  className={`trader-metric-value ${m.tone === 'up' ? 'trader-metric-up' : 'trader-metric-down'}`}
                >
                  {m.value}
                </Text>
                <Text className="trader-metric-label">{m.label}</Text>
              </View>
            ))}
          </View>
          <View className="trader-chart">
            {PERF_BARS.map((h, idx) => (
              <View key={idx} className="trader-chart-col">
                <View className="trader-chart-bar" style={{ height: `${h * 2}rpx` }} />
                <Text className="trader-chart-label">M{idx + 1}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 操盘手权益(对标 trader.vue features) */}
        <View className="trader-section">
          <Text className="section-title">{tt('vipTrader.featureSection', '操盘手权益')}</Text>
          <View className="feature-list">
            {TRADER_FEATURES.map((f) => (
              <View key={f.key} className="feature-item">
                <View className="feature-icon">
                  <Text>{f.icon}</Text>
                </View>
                <View className="feature-content">
                  <Text className="feature-title">{f.title}</Text>
                  <Text className="feature-desc">{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 服务包列表 */}
        <View className="trader-section">
          <Text className="section-title">{tt('vipTrader.serviceSection', '服务包')}</Text>
          <View className="trader-packages">
            {SERVICE_PACKAGES.map((pkg) => (
              <View
                key={pkg.id}
                className={`trader-package ${pkg.highlight ? 'trader-package-highlight' : ''}`}
              >
                <View className="trader-package-head">
                  <Text className="trader-package-name">{pkg.name}</Text>
                  {pkg.highlight ? (
                    <View className="trader-package-tag">
                      <Text className="trader-package-tag-text">
                        {tt('vipTrader.recommended', '推荐')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text className="trader-package-period">{pkg.period}</Text>
                <View className="trader-package-price-row">
                  <Text className="trader-package-symbol">¥</Text>
                  <Text className="trader-package-price">{pkg.price}</Text>
                </View>
                <Button
                  className={`trader-package-btn ${pkg.highlight ? 'trader-package-btn-primary' : ''}`}
                  onClick={() => handleSubscribe(pkg.name, pkg.price)}
                >
                  {tt('vipTrader.subscribe', '订阅')}
                </Button>
              </View>
            ))}
          </View>
        </View>

        {/* 用户评价 */}
        <View className="trader-section">
          <Text className="section-title">{tt('vipTrader.reviewsSection', '用户评价')}</Text>
          <View className="trader-reviews">
            {USER_REVIEWS.map((r) => (
              <View key={r.id} className="trader-review">
                <Image
                  className="trader-review-avatar"
                  src={r.avatar || DEFAULT_AVATAR}
                  mode="aspectFill"
                />
                <View className="trader-review-main">
                  <View className="trader-review-head">
                    <Text className="trader-review-name">{r.nickname}</Text>
                    <Text className="trader-review-stars">
                      {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                    </Text>
                  </View>
                  <Text className="trader-review-content">{r.content}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* 底部固定操作栏:立即咨询 + 一键开通 */}
      <View className="trader-footer">
        <Button className="footer-btn footer-btn-ghost" onClick={handleConsult}>
          {tt('vipTrader.consult', '立即咨询')}
        </Button>
        <Button className="footer-btn footer-btn-primary" onClick={openPopup}>
          {tt('vipTrader.openNow', '一键开通会员')}
        </Button>
      </View>
    </View>
  )
}
