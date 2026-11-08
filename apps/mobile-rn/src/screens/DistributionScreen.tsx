// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { useTheme } from '../context/ThemeContext'
import { rnRadius, rnType } from '@ihui/design-tokens'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, Share, Text, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { captureRef } from 'react-native-view-shot'
import { Asset, requestPermissionsAsync } from 'expo-media-library'
import Clipboard from '@react-native-clipboard/clipboard'
import { tokens } from '../theme/active-tokens'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi, getCommissionRates } from '@ihui/api-client'
import {
  DistributionScreen as SharedDistributionScreen,
  type DistributionInfo,
  type DistributionOverviewCard,
  type DistributionEarningsCard,
  type DistributionServiceFloat,
  type DistributionFunctionBlock,
  type DistributionQrSheet,
} from '@ihui/rn-app'
// 图标对齐历史 FunctionBlockColumn/index.vue iconSrc:
// 公司团队/AI团队=tuandui-icon、我的名片=geren-icon、我的二维码=erweima-icon、分销订单=fenxiao-icon
import { Bot, IdCard, Package, QrCode, Users } from 'lucide-react-native'
import { HandPlatePops } from '../components/HandPlatePops'
import { appAlert } from '../components/BottomPops'
import FloatBox, { type FloatBoxType } from '../components/FloatBox'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 收益卡 Tab(注入共享屏 earningsCard;切换只回传 key) */
type EarningsTabKey = 'today' | 'month' | 'total'

/** 邀请链接域名(对齐 ProfileScreen WEBSITE_URL 'https://www.aizhs.top') */
const INVITE_BASE_URL = 'https://www.aizhs.top'

/** 最低提现(分):后端 /distribution/overview 无最低提现配置,按 0 处理 */
const WITHDRAW_MIN = 0

/** 后端金额以「分」存储,换算为元(供收益卡/提现详情展示) */
function fenToYuan(cents: number): number {
  return Number.isFinite(cents) ? cents / 100 : 0
}

export function DistributionScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<DistributionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  // 分佣比例真值(GET /distribution/commission-rates 的 key→value 原样映射;取不到保持空数组)
  const [rates, setRates] = useState<{ level: string; rate: string }[]>([])
  // HandPlatePops 提现详情弹层(对齐 Uniapp hand-plate-pups/index.vue)
  const [withdrawDetailVisible, setWithdrawDetailVisible] = useState(false)
  // 收益卡 Tab(注入共享屏 earningsCard;点按只改本端 key)
  const [earningsTab, setEarningsTab] = useState<EarningsTabKey>('total')
  // 分享二维码弹层显隐(注入共享屏 qrSheet;对齐 Uniapp 分销页分享二维码弹层)
  const [shareQrVisible, setShareQrVisible] = useState<boolean>(false)
  // 二维码 View 引用(react-native-view-shot captureRef 截图保存到相册)
  const qrRef = useRef<View>(null)
  // 保存到相册进行中(禁用按钮防重复点击)
  const [savingQr, setSavingQr] = useState(false)
  // 提现同步锁(state 在闭包中不同步,二次点击仍会读到旧值;用 ref 做入口级互斥)
  const withdrawLockRef = useRef(false)
  // FloatBox 悬浮提示(对齐 Uniapp uni.showToast 非阻断式反馈)
  const [floatVisible, setFloatVisible] = useState(false)
  const [floatMessage, setFloatMessage] = useState('')
  const [floatType, setFloatType] = useState<FloatBoxType>('info')
  const showFloat = useCallback((message: string, type: FloatBoxType = 'info') => {
    setFloatMessage(message)
    setFloatType(type)
    setFloatVisible(true)
  }, [])
  // 邀请链接 = 域名/register?inviteCode=user.inviteCode(对齐 Uniapp 分销页分享链接)
  const inviteCode = user?.inviteCode
  const inviteLink = inviteCode ? `${INVITE_BASE_URL}/register?inviteCode=${inviteCode}` : ''

  /** 复制邀请链接到剪贴板(对齐 Uniapp 分销页 copyInviteLink,非阻断 Toast 反馈) */
  const handleCopyInviteLink = useCallback(() => {
    if (!inviteLink) {
      showFloat(t('dist.noInviteCode'), 'warning')
      return
    }
    try {
      Clipboard.setString(inviteLink)
      showFloat(t('dist.linkCopied'), 'success')
    } catch {
      showFloat(t('profile.copyFailRetry'), 'warning')
    }
  }, [inviteLink, showFloat, t])

  /** 分享给好友(对齐 Uniapp <button open-type="share">,RN 用 Share API 跨平台分享) */
  const handleShareToFriend = useCallback(async () => {
    if (!inviteLink) {
      showFloat(t('dist.noInviteCode'), 'warning')
      return
    }
    try {
      const result = await Share.share({
        title: t('dist.inviteTitle'),
        message: inviteLink,
      })
      if (result.action === Share.sharedAction) {
        showFloat(t('dist.shared'), 'success')
      }
    } catch {
      showFloat(t('dist.shareFail'), 'warning')
    }
  }, [inviteLink, showFloat, t])

  /** 保存二维码到相册(view-shot 截图 → expo-media-library 保存) */
  const handleSaveQrToAlbum = useCallback(async () => {
    if (!inviteLink) {
      showFloat(t('dist.noInviteCode'), 'warning')
      return
    }
    if (!qrRef.current) {
      showFloat(t('dist.qrNotReady'), 'warning')
      return
    }
    setSavingQr(true)
    try {
      const localUri = await captureRef(qrRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      })
      const { status } = await requestPermissionsAsync()
      if (status !== 'granted') {
        appAlert(t('home.pubTip'), t('dist.needAlbum'))
        return
      }
      await Asset.create(localUri)
      showFloat(t('dist.savedAlbum'), 'success')
    } catch (err) {
      showFloat(err instanceof Error ? err.message : t('dist.saveFail'), 'warning')
    } finally {
      setSavingQr(false)
    }
  }, [inviteLink, showFloat, t])

  /**
   * FunctionBlockColumn 分销功能块(逐项对齐历史 FunctionBlockColumn/index.vue
   * functionList 行 39-104 的 5 个未注释项,名称/副标题/图标/跳转一一对应):
   * 1. 公司团队  查看我的公司团队   → /pages/distribution_personnel_list/index(RN: Team,
   *    TeamScreen 已对齐 distribution_personnel_list,见其 load() 注释)
   * 2. AI团队    查看智能体团队     → /pages/tools/ai_group/index(RN: AiGroup)
   * 3. 我的名片  查看我的个人信息   → /pagesA/business-card/index(RN: BusinessCard)
   * 4. 我的二维码 推广专属二维码     → 历史 navigateTo 对「我的二维码」特殊处理
   *    ($emit('pack') 打开 bottom-pops 分享二维码弹层,RN: shareQrVisible BottomPops)
   * 5. 分销订单  查看我的分销订单   → /pages/distribution_order_list/index(RN: DistributionOrderList)
   * 历史中被注释掉的「我的收入/公司业绩/领取企业资料/产品调查」不在对齐范围。
   * 5 项目标路由在 RN RootStack 均已注册,无需「功能开发中」降级。
   */
  const onBlockPress = useCallback(
    (id: string) => {
      // 我的二维码:对齐历史 FunctionBlockColumn navigateTo 行 109「$emit pack」→ 打开二维码弹层
      if (id === 'my_qrcode') {
        setShareQrVisible(true)
        return
      }
      const routeMap: Record<string, string> = {
        company_team: 'Team',
        ai_team: 'AiGroup',
        business_card: 'BusinessCard',
        distribution_orders: 'DistributionOrderList',
      }
      const route = routeMap[id]
      if (route) navigation.navigate(route as never)
      else showFloat(t('dist.devSoon'), 'warning')
    },
    [navigation, showFloat, t],
  )

  /**
   * 功能宫格(注入共享屏 functionBlocks):图标节点 + 文案 + 点击,5 项与历史
   * FunctionBlockColumn/index.vue functionList 行 39-104 的未注释项一一对应。
   * 图标走 lucide 节点(iconNode),共享屏只负责网格渲染,不感知路由。
   */
  const functionBlocks: DistributionFunctionBlock[] = [
    {
      key: 'company_team',
      label: t('dist.teamCompany'),
      description: t('dist.teamCompanyD'),
      iconNode: <Users size={22} color={tokens.text.medium} />,
      onPress: () => onBlockPress('company_team'),
    },
    {
      key: 'ai_team',
      label: t('dist.teamAi'),
      description: t('dist.teamAiD'),
      iconNode: <Bot size={22} color={tokens.text.medium} />,
      onPress: () => onBlockPress('ai_team'),
    },
    {
      key: 'business_card',
      label: t('dist.card'),
      description: t('dist.cardD'),
      iconNode: <IdCard size={22} color={tokens.text.medium} />,
      onPress: () => onBlockPress('business_card'),
    },
    {
      key: 'my_qrcode',
      label: t('dist.qr'),
      description: t('dist.qrD'),
      iconNode: <QrCode size={22} color={tokens.text.medium} />,
      onPress: () => onBlockPress('my_qrcode'),
    },
    {
      key: 'distribution_orders',
      label: t('dist.orders'),
      description: t('dist.ordersD'),
      iconNode: <Package size={22} color={tokens.text.medium} />,
      onPress: () => onBlockPress('distribution_orders'),
    },
  ]

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const [res, ratesRes] = await Promise.all([
        fetchApi<DistributionInfo>('/distribution/overview'),
        // 分佣比例独立取数:失败只清空列表(共享屏给空态),不影响主信息块
        getCommissionRates(),
      ])
      setRates(
        ratesRes.success
          ? Object.entries(ratesRes.data.rates ?? {}).map(([level, rate]) => ({
              level,
              rate: String(rate ?? ''),
            }))
          : [],
      )
      if (!res.success) {
        setError(t('distribution.loadFailed'))
        setLoading(false)
        setRefreshing(false)
        return
      }
      setInfo(res.data ?? null)
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handleWithdraw = async () => {
    if (!info || withdrawLockRef.current) return
    if (info.availableCommission <= 0 || info.availableCommission < WITHDRAW_MIN) {
      // 金额不足带详情,保留 Alert 展示具体金额(后端无最低提现配置,恒不触发,保留结构)
      appAlert(
        t('distribution.withdrawFailed'),
        t('distribution.withdrawMin', { amount: fenToYuan(WITHDRAW_MIN) }),
      )
      return
    }
    // 入口即刻置锁(ref 同步生效),再进入异步边界:两次快速点击不得并发提交提现(防重复出款)。
    withdrawLockRef.current = true
    setWithdrawing(true)
    try {
      // 实名校验(对齐 Uniapp 个人信息卡组件的 withdrawalClick):
      // 未实名(后端 authStatus !== 'approved')→ 弹「提现前请先实名认证!」并引导去实名,不放行。
      // 说明:AuthUser 用户模型无 realName 字段,实名状态以 /auth/realname/my 接口为准。
      try {
        const realnameRes = await fetchApi<{ authStatus?: string }>('/auth/realname/my')
        if (!realnameRes.success || realnameRes.data?.authStatus !== 'approved') {
          appAlert(
            t('distribution.withdrawNeedRealname'),
            t('distribution.withdrawNeedRealnameHint'),
            [
              { text: t('distribution.withdrawRealnameCancel'), style: 'cancel' },
              {
                text: t('distribution.withdrawRealnameGo'),
                onPress: () => navigation.navigate('RealNameAuth' as never),
              },
            ],
          )
          return
        }
      } catch {
        // 实名状态接口异常:按未实名拦截(与原项目「无认证信息则拦截」语义一致,fail-safe)
        appAlert(
          t('distribution.withdrawNeedRealname'),
          t('distribution.withdrawNeedRealnameHint'),
          [
            { text: t('distribution.withdrawRealnameCancel'), style: 'cancel' },
            {
              text: t('distribution.withdrawRealnameGo'),
              onPress: () => navigation.navigate('RealNameAuth' as never),
            },
          ],
        )
        return
      }
      // 提现只能用可提现余额(availableCommission),待结算佣金不可提。
      const res = await fetchApi('/distribution/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount: info.availableCommission }),
      })
      if (res.success) {
        showFloat(t('distribution.withdrawSuccess'), 'success')
        void load(true)
      } else {
        showFloat(t('distribution.withdrawFailed'), 'warning')
      }
    } finally {
      withdrawLockRef.current = false
      setWithdrawing(false)
    }
  }

  // 收益卡三段(注入共享屏 earningsCard):仅「累计」Tab 有真实后端数据,
  // 后端 /distribution/overview 无日/月佣金拆分,今日/本月 Tab 保持 0(不伪造)。
  const earningsTabs = [
    { key: 'today', label: t('earn.tabToday') },
    { key: 'month', label: t('earn.tabMonth') },
    { key: 'total', label: t('earn.tabTotal') },
  ]
  const earningsStat =
    earningsTab === 'total'
      ? {
          amount: info ? fenToYuan(info.totalCommission) : 0,
          pending: info ? fenToYuan(info.pendingCommission) : 0,
          settled: info ? fenToYuan(info.withdrawnCommission) : 0,
          orders: info?.orderCount ?? 0,
          teamNew: info?.invitedCount ?? 0,
          withdrawn: info ? fenToYuan(info.withdrawnCommission) : 0,
        }
      : { amount: 0, pending: 0, settled: 0, orders: 0, teamNew: 0, withdrawn: 0 }
  const earningsTabLabel = t(
    earningsTab === 'today'
      ? 'earn.tabDayShort'
      : earningsTab === 'month'
        ? 'earn.tabMonthShort'
        : 'earn.tabTotalShort',
  )
  const earningsCard: DistributionEarningsCard = {
    tabs: earningsTabs,
    activeTab: earningsTab,
    onSelectTab: (key) => setEarningsTab(key as EarningsTabKey),
    items: [
      { label: '收益', value: `¥${earningsStat.amount.toFixed(2)}`, tone: 'primary' },
      { label: '待结算', value: `¥${earningsStat.pending.toFixed(2)}` },
      { label: '已结算', value: `¥${earningsStat.settled.toFixed(2)}` },
    ],
    footerItems: [
      {
        label: t('earn.promoOrders', { tab: earningsTabLabel }),
        value: String(earningsStat.orders),
      },
      { label: t('earn.teamNew', { tab: earningsTabLabel }), value: String(earningsStat.teamNew) },
      {
        label: t('earn.withdrawAmount', { tab: earningsTabLabel }),
        value: `¥${earningsStat.withdrawn.toFixed(2)}`,
      },
    ],
  }

  // 分销总览(注入共享屏 overviewCard):用户资料 + 分销身份,真值优先
  const overviewCard: DistributionOverviewCard = {
    avatar: user?.avatar || null,
    nickname: user?.nickname || user?.username || '',
    identity: info ? t('dist.dealer') : undefined,
  }

  // 分佣浮标(注入共享屏 serviceFloat):金额取 availableCommission(分→元),点击开提现详情
  const serviceFloat: DistributionServiceFloat = {
    amount: info ? fenToYuan(info.availableCommission) : 0,
    label: t('commission.myLabel'),
    onPress: () => setWithdrawDetailVisible(true),
  }

  /**
   * 分享二维码弹层(注入共享屏 qrSheet):二维码节点由本端注入(保存相册需 ref 截图),
   * 弹层壳/标题/链接/提示/按钮由共享屏渲染;分享走 RN Share API,小程序改注入微信按钮。
   */
  const qrSheet: DistributionQrSheet = {
    visible: shareQrVisible,
    title: t('dist.shareQrA11y'),
    qrNode: inviteLink ? (
      <View ref={qrRef} collapsable={false} style={shellStyles.qrNodeBox}>
        <QRCode
          value={inviteLink}
          size={176}
          color={tokens.gray.black}
          backgroundColor={tokens.surface.light}
          ecl="M"
        />
      </View>
    ) : null,
    emptyText: inviteLink ? undefined : '暂无邀请码',
    linkText: inviteLink || undefined,
    tips: ['扫描上方二维码,注册成为会员', '您将获得会员费 20% 的佣金收益'],
    saveLabel: t('dist.saveQrA11y'),
    savingLabel: t('dist.saving'),
    saving: savingQr,
    shareLabel: '分享给好友',
    copyLabel: '复制邀请链接',
    onClose: () => setShareQrVisible(false),
    onSave: () => void handleSaveQrToAlbum(),
    onShare: () => void handleShareToFriend(),
    onCopy: handleCopyInviteLink,
  }

  return (
    <View style={shellStyles.root}>
      <ScrollView style={shellStyles.scroll} contentContainerStyle={shellStyles.scrollContent}>
        {/* 分享二维码邀请按钮(对齐 Uniapp 分销页分享二维码入口)
            守门 131 改型:shareBtn 无边距定高自含 ⇒ 外层不设 style(父 wrap 默认拉伸,
            命中盒 = 原 Pressable 盒),可视盒 + pressed 淡出落内层数组形态。 */}
        <View style={shellStyles.shareBtnWrap}>
          <Pressable
            onPress={() => setShareQrVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('dist.shareQrA11y')}
          >
            {({ pressed }) => (
              <View style={[shellStyles.shareBtn, pressed ? shellStyles.pressed : null]}>
                <Text style={shellStyles.shareBtnText}>分享二维码邀请好友</Text>
              </View>
            )}
          </Pressable>
        </View>
        <SharedDistributionScreen
          t={t}
          info={info}
          loading={loading}
          refreshing={refreshing}
          error={error}
          withdrawing={withdrawing}
          rates={rates}
          onRefresh={() => void load(true)}
          onWithdraw={handleWithdraw}
          onBack={() => navigation.goBack()}
          onRetry={() => {
            void load()
          }}
          colorScheme={resolvedTheme}
          overviewCard={overviewCard}
          earningsCard={earningsCard}
          serviceFloat={info ? serviceFloat : undefined}
          functionBlocks={functionBlocks}
          qrSheet={qrSheet}
        />
      </ScrollView>
      {/* HandPlatePops 提现详情弹层(对齐 Uniapp hand-plate-pups/index.vue) */}
      <HandPlatePops
        visible={withdrawDetailVisible}
        title={t('dist.withdrawDetail')}
        onClose={() => setWithdrawDetailVisible(false)}
      >
        <View style={shellStyles.withdrawDetailContent}>
          <Text style={shellStyles.withdrawDetailText}>
            可提现金额:¥{info ? fenToYuan(info.availableCommission) : 0}
          </Text>
          <Text style={shellStyles.withdrawDetailText}>
            已提现金额:¥{info ? fenToYuan(info.withdrawnCommission) : 0}
          </Text>
          <Text style={shellStyles.withdrawDetailText}>最低提现:¥{fenToYuan(WITHDRAW_MIN)}</Text>
        </View>
      </HandPlatePops>
      {/* FloatBox 非阻断悬浮提示(对齐 Uniapp uni.showToast) */}
      <FloatBox
        visible={floatVisible}
        type={floatType}
        message={floatMessage}
        onHide={() => setFloatVisible(false)}
      />
    </View>
  )
}

const shellStyles = {
  root: { flex: 1 } as const,
  scroll: { flex: 1 } as const,
  scrollContent: { paddingBottom: rpx(32) } as const,
  withdrawDetailContent: { gap: rpx(20), paddingVertical: rpx(16) } as const,
  withdrawDetailText: { fontSize: rnType.body.size, color: tokens.text.medium } as const,
  shareBtnWrap: { paddingHorizontal: rpx(32), paddingBottom: rpx(8) } as const,
  shareBtn: {
    height: 44,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  shareBtnText: {
    fontSize: rnType.body.size,
    fontWeight: '600',
    color: tokens.brand.ctaForeground,
  } as const,
  // 共享屏 qrSheet 的二维码节点容器(保存相册 captureRef 的截图范围)
  qrNodeBox: {
    width: 200,
    height: 200,
    borderRadius: rnRadius.xl,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  pressed: { opacity: 0.85 } as const,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
