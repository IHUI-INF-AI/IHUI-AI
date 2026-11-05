// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/distribution/DistributionScreen.tsx
// 批 5 薄壳化:个人信息卡 / 收益卡 / 分佣浮标 / 功能宫格 / 二维码弹层均以显式 props 注入共享屏;
// 分佣比例卡、佣金概览子组件、分销数据列三处重复段已删,源码锁见测试。
// 仅小程序消费的实名验证弹层与微信 open-type=share 分享按钮下沉 host-overlays(宿主能力节点)。
import { useTt, useI18n } from '@/i18n'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { useUserStore } from '@/stores/user'
import { aizhsUrl, bspappUrl } from '@/constants/icon-urls'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import './index.css'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { onToast } from '@/host/on-toast'
import { renderVerifySheet, renderWxShareButton } from './host-overlays'
import {
  DistributionScreen as SharedDistributionScreen,
  type DistributionInfo,
  type DistributionOverviewCard,
  type DistributionEarningsCard,
  type DistributionServiceFloat,
  type DistributionFunctionBlock,
  type DistributionQrSheet,
} from '@ihui/rn-app/features/distribution/DistributionScreen'

interface OperatorStats {
  dayEarnings?: number
  dayOrders?: number
  dayInvites?: number
  monthEarnings?: number
  monthOrders?: number
  monthInvites?: number
  sumEarnings?: number
  sumOrders?: number
  sumInvites?: number
}

interface OperatorData {
  avatar?: string
  nickname?: string
  identity?: string
  companyName?: string
  verified?: boolean
  stats?: OperatorStats
}

type StatsTab = 'day' | 'month' | 'sum'

/** 分佣比例行 —— 真值接 GET /distribution/commission-rates(与分佣计划页同一端点,
 *  档位/比例全部取自后端在册配置;不做硬编兜底,未配置时如实渲染空态)。 */
interface RateRow {
  level: string
  rate: string
}

export default function DistributionIndex() {
  const tt = useTt()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const gate = useAuthReadyGate()
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // 分佣比例档位(对齐 RN DistributionScreen 的 ratesCard;空数组 ⇒ 空态)
  const [rateRows, setRateRows] = useState<RateRow[]>([])
  // 共享屏数据腿 GET /distribution/overview(原佣金概览子组件的取数,上收到父页)
  const [info, setInfo] = useState<DistributionInfo | null>(null)
  const [infoLoading, setInfoLoading] = useState(true)
  const [infoError, setInfoError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
    // 分佣比例(对齐 RN ratesCard 的取数):失败按空态处理,不编造比例
    try {
      const res = await api.get<{ rates?: Record<string, string> }>(
        '/distribution/commission-rates',
      )
      setRateRows(
        Object.entries(res?.rates ?? {}).map(([level, rate]) => ({
          level,
          rate: String(rate ?? ''),
        })),
      )
    } catch {
      setRateRows([])
    }
    try {
      setInfoLoading(true)
      setInfoError('')
      const res = await api.get<DistributionInfo>('/distribution/overview')
      setInfo(res ?? null)
    } catch {
      setInfoError(tt('distribution.team.error', '加载失败'))
    } finally {
      setInfoLoading(false)
    }
  }, [tt])

  // G-933 冷启动抢跑门控(范式同 pages/distribution/plan/index.tsx:36-62):load() 里的三发请求
  // 都挂在 distributionRoutes 的统一 preHandler 之下 ——
  //   · getOperatorDataCardData → GET /operator/data-card(注册点 apps/api/src/routes/distribution.ts:104)
  //   · GET /distribution/commission-rates(注册点同文件 :315)
  //   · GET /distribution/overview(注册点同文件 :42)
  // 而该 preHandler(addHook('preHandler', authenticate),同文件 :32-39)对本插件全部路由生效,
  // 无票即 authenticate 抛 401。冷启动未落定/未登录时照发,只会换来 401 被下面的 catch
  // 吞成"暂无数据"的假空态。故三发整块挡到门后。
  useDidShow(() => {
    gate.waitUntilReady(() => {
      load()
    })
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }, [load])

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      onToast(tt('distribution.index.qrLoadFail', '二维码加载失败'), { kind: 'error' })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      onToast(tt('distribution.index.qrLoading', '二维码生成中'), { kind: 'info' })
      return
    }
    try {
      await saveImageToPhotosAlbum(qrCode)
    } catch {
      // saveImageToPhotosAlbum 内部已处理
    }
  }, [qrCode, tt])

  const onSaveUserInfo = useCallback(async () => {
    if (!idNum.trim() || !idName.trim()) {
      onToast(tt('distribution.index.fillInfo', '请填写完整信息'), { kind: 'info' })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      onToast(tt('distribution.index.verifyOk', '验证成功'), { kind: 'success' })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      onToast(tt('distribution.index.verifyFail', '验证失败'), { kind: 'error' })
    } finally {
      setSubmitting(false)
    }
  }, [idNum, idName, submitting, tt])

  const menuItems: Array<{
    icon: string
    label: string
    url?: string
    action?: 'qrcode'
  }> = [
    {
      icon: aizhsUrl('sys-mini/tuandui-icon.png'),
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: aizhsUrl('sys-mini/fenxiao-icon.png'),
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: bspappUrl('tabbar/home/xia/commission.png'),
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: aizhsUrl('sys-mini/tixian.jpg'),
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: bspappUrl('tabbar/home/zhongxia/king.png'),
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: aizhsUrl('sys-mini/erweima-icon.png'),
      label: tt('distribution.index.menuQrCode', '我的二维码'),
      action: 'qrcode',
    },
  ]

  const onMenuClick = (item: (typeof menuItems)[number]) => {
    if (item.action === 'qrcode') {
      onGetQrCode()
    } else if (item.url) {
      Taro.navigateTo({ url: item.url }).catch(() => {
        Taro.switchTab({ url: item.url! }).catch(() => {})
      })
    }
  }

  const statsMap: Record<StatsTab, { earnings: number; orders: number; invites: number }> = {
    day: {
      earnings: data.stats?.dayEarnings ?? 0,
      orders: data.stats?.dayOrders ?? 0,
      invites: data.stats?.dayInvites ?? 0,
    },
    month: {
      earnings: data.stats?.monthEarnings ?? 0,
      orders: data.stats?.monthOrders ?? 0,
      invites: data.stats?.monthInvites ?? 0,
    },
    sum: {
      earnings: data.stats?.sumEarnings ?? 0,
      orders: data.stats?.sumOrders ?? 0,
      invites: data.stats?.sumInvites ?? 0,
    },
  }
  const stats = statsMap[statsTab]

  const tabLabel = (tab: StatsTab) =>
    tab === 'day'
      ? tt('distribution.index.tabDay', '日')
      : tab === 'month'
        ? tt('distribution.index.tabMonth', '月')
        : tt('distribution.index.tabSum', '总')

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  // 分销总览(个人信息卡变体)—— 显式 prop,RN 容器同样传 user/info 真值
  const overviewCard: DistributionOverviewCard = {
    avatar: avatar || null,
    nickname,
    identity: data.identity || tt('distribution.index.operator', '操盘手'),
    companyName: data.companyName || undefined,
  }

  // 收益卡(日/月/总 Tab)—— 显式 prop,点击只回传 key
  const earningsCard: DistributionEarningsCard = {
    tabs: (['day', 'month', 'sum'] as StatsTab[]).map((key) => ({ key, label: tabLabel(key) })),
    activeTab: statsTab,
    onSelectTab: (key) => setStatsTab(key as StatsTab),
    items: [
      {
        label: tt('distribution.index.earnings', '收益'),
        value: `¥${stats.earnings.toFixed(2)}`,
        tone: 'primary',
      },
      {
        label: tt('distribution.index.orders', '订单数'),
        value: String(stats.orders),
      },
      {
        label: tt('distribution.index.invites', '邀请人数'),
        value: String(stats.invites),
      },
    ],
  }

  // 分佣浮标 —— 金额取后端 availableCommission(分,与 RN 同口径;formatPrice 统一换算)
  const serviceFloat: DistributionServiceFloat = {
    amount: info?.availableCommission ?? 0,
    label: tt('commission.myLabel', '我的佣金'),
    onPress: () => {
      void Taro.navigateTo({ url: '/pkg-shop/wallet/commission/index' })
    },
  }

  // 功能宫格(注入共享屏 functionBlocks):图标 URL + 文案 + 点击,条目清单由本端注入
  const functionBlocks: DistributionFunctionBlock[] = menuItems.map((item, idx) => ({
    key: item.url ?? item.action ?? String(idx),
    label: item.label,
    iconUrl: item.icon,
    onPress: () => onMenuClick(item),
  }))

  // 分享二维码弹层(注入共享屏 qrSheet):二维码图片由本端取数;分享按钮注入微信 open-type=share
  const qrSheet: DistributionQrSheet = {
    visible: showQrCode,
    title: tt('distribution.index.qrTitle', '我的分享二维码'),
    imageUrl: qrCode || null,
    emptyText: tt('distribution.index.qrLoading', '二维码生成中'),
    copyright: 'COPYRIGHT © 2025-2035 IHUIINF AGI ALL RIGHTS RESERVED.',
    saveLabel: tt('distribution.index.saveAlbum', '保存到相册'),
    shareAction: renderWxShareButton(tt('distribution.index.share', '分享给好友')),
    onClose: () => setShowQrCode(false),
    onSave: onSaveQr,
  }

  // 实名验证弹层 —— 仅小程序消费(不上收共享屏),由宿主模块产出节点
  const verifySheetNode = showVerify
    ? renderVerifySheet({
        title: tt('distribution.index.verifyTitle', '身份信息验证'),
        avatar,
        initial,
        idPlaceholder: tt('distribution.index.idPlaceholder', '请输入身份证号码'),
        namePlaceholder: tt('distribution.index.namePlaceholder', '请输入姓名'),
        idValue: idNum,
        nameValue: idName,
        copyright: 'Copright © 2025-2035 iHuiInf AGI All Rights Reserved.',
        confirmLabel: tt('distribution.index.confirm', '确认'),
        onInputId: setIdNum,
        onInputName: setIdName,
        onConfirm: onSaveUserInfo,
      })
    : null

  /**
   * 批 5 薄壳:直载 distribution/DistributionScreen 共享屏;个人信息卡 / 收益卡 /
   * 分佣浮标 / 功能宫格 / 二维码弹层以显式 props 注入。实名弹层仅小程序消费,留宿主模块。
   */
  return (
    <ThemeRoot className="dist-page">
      <SharedDistributionScreen
        t={t}
        info={info}
        loading={infoLoading && !info}
        refreshing={refreshing}
        error={infoError}
        withdrawing={false}
        rates={rateRows}
        onRefresh={() => void onRefresh()}
        onWithdraw={() => void Taro.navigateTo({ url: '/pages/distribution/withdraw' })}
        onBack={() => void Taro.navigateBack()}
        onRetry={() => void load()}
        colorScheme={resolvedTheme}
        overviewCard={overviewCard}
        earningsCard={earningsCard}
        serviceFloat={serviceFloat}
        functionBlocks={functionBlocks}
        qrSheet={qrSheet}
      />
      {verifySheetNode}
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
