import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'
import './index.css'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  return (
    <View className="dist-page">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="dist-content">
        {/* PersonalInformationCard */}
        <View className="dist-card dist-person">
          <View className="dist-person-avatar">
            {avatar ? (
              <Image className="dist-person-img" src={avatar} mode="aspectFill" />
            ) : (
              <View className="dist-person-img dist-person-placeholder">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="dist-person-info">
            <Text className="dist-person-name">{nickname}</Text>
            <Text className="dist-person-identity">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="dist-person-company">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="dist-card dist-stats">
          <View className="dist-stats-tabs">
            {(['day', 'month', 'sum'] as StatsTab[]).map((tab) => (
              <View
                key={tab}
                className={`dist-stats-tab ${statsTab === tab ? 'active' : ''}`}
                onClick={() => setStatsTab(tab)}
              >
                <Text>
                  {tab === 'day'
                    ? tt('distribution.index.tabDay', '日')
                    : tab === 'month'
                      ? tt('distribution.index.tabMonth', '月')
                      : tt('distribution.index.tabSum', '总')}
                </Text>
              </View>
            ))}
          </View>
          <View className="dist-stats-body">
            <View className="dist-stats-item">
              <Text className="dist-stats-num">¥{stats.earnings.toFixed(2)}</Text>
              <Text className="dist-stats-label">
                {tt('distribution.index.earnings', '收益')}
              </Text>
            </View>
            <View className="dist-stats-item">
              <Text className="dist-stats-num">{stats.orders}</Text>
              <Text className="dist-stats-label">
                {tt('distribution.index.orders', '订单数')}
              </Text>
            </View>
            <View className="dist-stats-item">
              <Text className="dist-stats-num">{stats.invites}</Text>
              <Text className="dist-stats-label">
                {tt('distribution.index.invites', '邀请人数')}
              </Text>
            </View>
          </View>
        </View>

        {/* FunctionBlockColumn */}
        <View className="dist-card dist-menu">
          {menuItems.map((item, idx) => (
            <View key={idx} className="dist-menu-item" onClick={() => onMenuClick(item)}>
              <Text className="dist-menu-icon">{item.icon}</Text>
              <Text className="dist-menu-label">{item.label}</Text>
              <Text className="dist-menu-arrow">›</Text>
            </View>
          ))}
        </View>
      </View>

      {/* BottomPops 二维码弹窗 */}
      {showQrCode ? (
        <View className="dist-mask">
          <View className="dist-qrpop">
            <View className="dist-qrpop-header">
              <Text className="dist-qrpop-title">
                {tt('distribution.index.qrTitle', '我的分享二维码')}
              </Text>
              <Text className="dist-qrpop-close" onClick={() => setShowQrCode(false)}>
                ×
              </Text>
            </View>
            <View className="dist-qrpop-qr">
              {qrCode ? (
                <Image className="dist-qrpop-img" src={qrCode} mode="aspectFit" />
              ) : (
                <View className="dist-qrpop-loading">
                  <Text>{tt('distribution.index.qrLoading', '二维码生成中')}</Text>
                </View>
              )}
            </View>
            <Text className="dist-qrpop-copyright">
              COPYRIGHT © 2025-2035 IHUIINF AGI ALL RIGHTS RESERVED.
            </Text>
            <View className="dist-qrpop-actions">
              <Button
                className="dist-qrpop-btn"
                openType="share"
              >
                {tt('distribution.index.share', '分享给好友')}
              </Button>
              <Text className="dist-qrpop-link" onClick={onSaveQr}>
                {tt('distribution.index.saveAlbum', '保存到相册')}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* showVerify 身份验证弹窗 */}
      {showVerify ? (
        <View className="dist-mask">
          <View className="dist-verify">
            <View className="dist-verify-header">
              <Text className="dist-verify-title">
                {tt('distribution.index.verifyTitle', '身份信息验证')}
              </Text>
            </View>
            <View className="dist-verify-avatar">
              {avatar ? (
                <Image className="dist-verify-avatar-img" src={avatar} mode="aspectFill" />
              ) : (
                <View className="dist-verify-avatar-img dist-person-placeholder">
                  <Text>{initial}</Text>
                </View>
              )}
            </View>
            <Input
              className="dist-verify-input"
              placeholder={tt('distribution.index.idPlaceholder', '请输入身份证号码')}
              value={idNum}
              onInput={(e) => setIdNum(e.detail.value)}
            />
            <Input
              className="dist-verify-input"
              placeholder={tt('distribution.index.namePlaceholder', '请输入姓名')}
              value={idName}
              onInput={(e) => setIdName(e.detail.value)}
            />
            <Text className="dist-verify-copyright">
              Copright © 2025-2035 iHuiInf AGI All Rights Reserved.
            </Text>
            <View className="dist-verify-btn" onClick={onSaveUserInfo}>
              <Text>{tt('distribution.index.confirm', '确认')}</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
import { View, Text, Image, Input, Button } from '@tarojsimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } fromimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

interface OperatorStats {
  dayEarnings?: number
  dayOrders?: number
  dayInvites?: number
  monthimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

interface OperatorStats {
  dayEarnings?: number
  dayOrders?: number
  dayInvites?: number
  monthEarnings?: number
  monthOrders?: number
  monthInvites?: number
  sumimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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
  statsimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

type StatsTab = 'import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>(import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNumimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    tryimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!resimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
      return
    }
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
      return
    }
    try {
      await saveImageToPhotosAlbum(qrCode)
    } catch {
      // saveImageToPhotosAlbum 内部已处理
    }
  }, [qrCode, tt])

  const onSaveUserInfo = useCallback(async () => {
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
      return
    }
    try {
      await saveImageToPhotosAlbum(qrCode)
    } catch {
      // saveImageToPhotosAlbum 内部已处理
    }
  }, [qrCode, tt])

  const onSaveUserInfo = useCallback(async () => {
    if (!idNum.trim() || !idNameimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoadingimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
    } finally {
      setSubmitting(false)
    }
  }, [idNum, idName, submitting, tt])

  constimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', 'import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
      label: tt('distribution.index.menuQrCode', '我的二维码'),
      action: 'qrcode',
    },
  ]

  const onMenuClick = (item: (typeof menuItems)[number]) => {
    if (item.action === 'qrcode') {
      onGetQrCode()
    } else if (import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const statsMap: Record<StatsTab, { earnings: number; orders: number; invites:import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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
  constimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  constimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semiboldimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primaryimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {dataimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foregroundimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="flex bg-muted rounded-[12rpx] p-[4rpx] mb-[32rpx]">
            {(['day', 'month', 'sum'] as Statsimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="flex bg-muted rounded-[12rpx] p-[4rpx] mb-[32rpx]">
            {(['day', 'month', 'sum'] as StatsTab[]).map((tab) => (
              <View
                key={tab}
                className={statsTabClass(tab)}
                onClick={() => setStatsTab(tab)}
              >
                <Textimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="flex bg-muted rounded-[12rpx] p-[4rpx] mb-[32rpx]">
            {(['day', 'month', 'sum'] as StatsTab[]).map((tab) => (
              <View
                key={tab}
                className={statsTabClass(tab)}
                onClick={() => setStatsTab(tab)}
              >
                <Text>
                  {tab === 'day'
                    ? tt('distribution.index.tabDay', '日')
                    : tab === 'month'
                      ? ttimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="flex bg-muted rounded-[12rpx] p-[4rpx] mb-[32rpx]">
            {(['day', 'month', 'sum'] as StatsTab[]).map((tab) => (
              <View
                key={tab}
                className={statsTabClass(tab)}
                onClick={() => setStatsTab(tab)}
              >
                <Text>
                  {tab === 'day'
                    ? tt('distribution.index.tabDay', '日')
                    : tab === 'month'
                      ? tt('distribution.index.tabMonth', '月')
                      : tt('distribution.index.tabSum', '总import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="flex bg-muted rounded-[12rpx] p-[4rpx] mb-[32rpx]">
            {(['day', 'month', 'sum'] as StatsTab[]).map((tab) => (
              <View
                key={tab}
                className={statsTabClass(tab)}
                onClick={() => setStatsTab(tab)}
              >
                <Text>
                  {tab === 'day'
                    ? tt('distribution.index.tabDay', '日')
                    : tab === 'month'
                      ? tt('distribution.index.tabMonth', '月')
                      : tt('distribution.index.tabSum', '总')}
                </Text>
              </View>
            ))}
          </View>
          <View className="flex">
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foregroundimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="flex bg-muted rounded-[12rpx] p-[4rpx] mb-[32rpx]">
            {(['day', 'month', 'sum'] as StatsTab[]).map((tab) => (
              <View
                key={tab}
                className={statsTabClass(tab)}
                onClick={() => setStatsTab(tab)}
              >
                <Text>
                  {tab === 'day'
                    ? tt('distribution.index.tabDay', '日')
                    : tab === 'month'
                      ? tt('distribution.index.tabMonth', '月')
                      : tt('distribution.index.tabSum', '总')}
                </Text>
              </View>
            ))}
          </View>
          <View className="flex">
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">¥{stats.earnings.toFixed(2)}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mtimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="flex bg-muted rounded-[12rpx] p-[4rpx] mb-[32rpx]">
            {(['day', 'month', 'sum'] as StatsTab[]).map((tab) => (
              <View
                key={tab}
                className={statsTabClass(tab)}
                onClick={() => setStatsTab(tab)}
              >
                <Text>
                  {tab === 'day'
                    ? tt('distribution.index.tabDay', '日')
                    : tab === 'month'
                      ? tt('distribution.index.tabMonth', '月')
                      : tt('distribution.index.tabSum', '总')}
                </Text>
              </View>
            ))}
          </View>
          <View className="flex">
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">¥{stats.earnings.toFixed(2)}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.earnings', '收益')}
              </Text>
            </View>
            <Viewimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="flex bg-muted rounded-[12rpx] p-[4rpx] mb-[32rpx]">
            {(['day', 'month', 'sum'] as StatsTab[]).map((tab) => (
              <View
                key={tab}
                className={statsTabClass(tab)}
                onClick={() => setStatsTab(tab)}
              >
                <Text>
                  {tab === 'day'
                    ? tt('distribution.index.tabDay', '日')
                    : tab === 'month'
                      ? tt('distribution.index.tabMonth', '月')
                      : tt('distribution.index.tabSum', '总')}
                </Text>
              </View>
            ))}
          </View>
          <View className="flex">
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">¥{stats.earnings.toFixed(2)}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.earnings', '收益')}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">{stats.orders}</Textimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="flex bg-muted rounded-[12rpx] p-[4rpx] mb-[32rpx]">
            {(['day', 'month', 'sum'] as StatsTab[]).map((tab) => (
              <View
                key={tab}
                className={statsTabClass(tab)}
                onClick={() => setStatsTab(tab)}
              >
                <Text>
                  {tab === 'day'
                    ? tt('distribution.index.tabDay', '日')
                    : tab === 'month'
                      ? tt('distribution.index.tabMonth', '月')
                      : tt('distribution.index.tabSum', '总')}
                </Text>
              </View>
            ))}
          </View>
          <View className="flex">
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">¥{stats.earnings.toFixed(2)}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.earnings', '收益')}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">{stats.orders}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="flex bg-muted rounded-[12rpx] p-[4rpx] mb-[32rpx]">
            {(['day', 'month', 'sum'] as StatsTab[]).map((tab) => (
              <View
                key={tab}
                className={statsTabClass(tab)}
                onClick={() => setStatsTab(tab)}
              >
                <Text>
                  {tab === 'day'
                    ? tt('distribution.index.tabDay', '日')
                    : tab === 'month'
                      ? tt('distribution.index.tabMonth', '月')
                      : tt('distribution.index.tabSum', '总')}
                </Text>
              </View>
            ))}
          </View>
          <View className="flex">
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">¥{stats.earnings.toFixed(2)}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.earnings', '收益')}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">{stats.orders}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.orders', '订单数')}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">{stats.invites}</Text>
              <Text className="block text-[24rpximport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="flex bg-muted rounded-[12rpx] p-[4rpx] mb-[32rpx]">
            {(['day', 'month', 'sum'] as StatsTab[]).map((tab) => (
              <View
                key={tab}
                className={statsTabClass(tab)}
                onClick={() => setStatsTab(tab)}
              >
                <Text>
                  {tab === 'day'
                    ? tt('distribution.index.tabDay', '日')
                    : tab === 'month'
                      ? tt('distribution.index.tabMonth', '月')
                      : tt('distribution.index.tabSum', '总')}
                </Text>
              </View>
            ))}
          </View>
          <View className="flex">
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">¥{stats.earnings.toFixed(2)}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.earnings', '收益')}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">{stats.orders}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.orders', '订单数')}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">{stats.invites}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.invites', '邀请人数')}
              </Text>
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="flex bg-muted rounded-[12rpx] p-[4rpx] mb-[32rpx]">
            {(['day', 'month', 'sum'] as StatsTab[]).map((tab) => (
              <View
                key={tab}
                className={statsTabClass(tab)}
                onClick={() => setStatsTab(tab)}
              >
                <Text>
                  {tab === 'day'
                    ? tt('distribution.index.tabDay', '日')
                    : tab === 'month'
                      ? tt('distribution.index.tabMonth', '月')
                      : tt('distribution.index.tabSum', '总')}
                </Text>
              </View>
            ))}
          </View>
          <View className="flex">
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">¥{stats.earnings.toFixed(2)}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.earnings', '收益')}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">{stats.orders}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.orders', '订单数')}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">{stats.invites}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.invites', '邀请人数')}
              </Text>
            </View>
          </View>
        </View>

        {/* FunctionBlockColumn */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[16rpx] flex flex-col gap-[12rpx]">
          {menuItems.mapimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="flex bg-muted rounded-[12rpx] p-[4rpx] mb-[32rpx]">
            {(['day', 'month', 'sum'] as StatsTab[]).map((tab) => (
              <View
                key={tab}
                className={statsTabClass(tab)}
                onClick={() => setStatsTab(tab)}
              >
                <Text>
                  {tab === 'day'
                    ? tt('distribution.index.tabDay', '日')
                    : tab === 'month'
                      ? tt('distribution.index.tabMonth', '月')
                      : tt('distribution.index.tabSum', '总')}
                </Text>
              </View>
            ))}
          </View>
          <View className="flex">
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">¥{stats.earnings.toFixed(2)}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.earnings', '收益')}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">{stats.orders}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.orders', '订单数')}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">{stats.invites}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.invites', '邀请人数')}
              </Text>
            </View>
          </View>
        </View>

        {/* FunctionBlockColumn */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[16rpx] flex flex-col gap-[12rpx]">
          {menuItems.map((item, idx) => (
            <View key={idx} className="flex items-center p-[24rpx] bg-muted rounded-[12import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="flex bg-muted rounded-[12rpx] p-[4rpx] mb-[32rpx]">
            {(['day', 'month', 'sum'] as StatsTab[]).map((tab) => (
              <View
                key={tab}
                className={statsTabClass(tab)}
                onClick={() => setStatsTab(tab)}
              >
                <Text>
                  {tab === 'day'
                    ? tt('distribution.index.tabDay', '日')
                    : tab === 'month'
                      ? tt('distribution.index.tabMonth', '月')
                      : tt('distribution.index.tabSum', '总')}
                </Text>
              </View>
            ))}
          </View>
          <View className="flex">
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">¥{stats.earnings.toFixed(2)}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.earnings', '收益')}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">{stats.orders}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.orders', '订单数')}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">{stats.invites}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.invites', '邀请人数')}
              </Text>
            </View>
          </View>
        </View>

        {/* FunctionBlockColumn */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[16rpx] flex flex-col gap-[12rpx]">
          {menuItems.map((item, idx) => (
            <View key={idx} className="flex items-center p-[24rpx] bg-muted rounded-[12rpx] active:opacity-70" onClick={() => onMenuClick(item)}>
              <Textimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="flex bg-muted rounded-[12rpx] p-[4rpx] mb-[32rpx]">
            {(['day', 'month', 'sum'] as StatsTab[]).map((tab) => (
              <View
                key={tab}
                className={statsTabClass(tab)}
                onClick={() => setStatsTab(tab)}
              >
                <Text>
                  {tab === 'day'
                    ? tt('distribution.index.tabDay', '日')
                    : tab === 'month'
                      ? tt('distribution.index.tabMonth', '月')
                      : tt('distribution.index.tabSum', '总')}
                </Text>
              </View>
            ))}
          </View>
          <View className="flex">
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">¥{stats.earnings.toFixed(2)}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.earnings', '收益')}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">{stats.orders}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.orders', '订单数')}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">{stats.invites}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.invites', '邀请人数')}
              </Text>
            </View>
          </View>
        </View>

        {/* FunctionBlockColumn */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[16rpx] flex flex-col gap-[12rpx]">
          {menuItems.map((item, idx) => (
            <View key={idx} className="flex items-center p-[24rpx] bg-muted rounded-[12rpx] active:opacity-70" onClick={() => onMenuClick(item)}>
              <Text className="text-[36rpx] mr-[24rpx] flex-shrink-0">{item.icon}</Text>
              <Text className="flex-1 text-[28rpx] text-foreground">{item.label}</Text>
              <Text className="text-[36rpx] text-muted-foreground leading-none flex-shrink-0">›</Text>
            </View>
          ))}
        </View>
      </View>

      {/* BottomPops 二维码弹窗 */}
      {showQrCode ? (
        <View className="fixed inset-0 bg-[rgba(0,0,0,0.7)] z-[1000] flex items-center justify-centerimport { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { useUserStore } from '@/stores/user'
import { saveImageToPhotosAlbum } from '@/utils/save-album'
import NavBar from '@/components/NavBar'

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

export default function DistributionIndex() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const user = useUserStore((s) => s.user)
  const [data, setData] = useState<OperatorData>({})
  const [statsTab, setStatsTab] = useState<StatsTab>('day')
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [showVerify, setShowVerify] = useState(false)
  const [idNum, setIdNum] = useState('')
  const [idName, setIdName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await api.getOperatorDataCardData({})) as unknown as OperatorData
      setData(res || {})
      if (!res?.verified) setShowVerify(true)
    } catch {
      // ignore
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const onGetQrCode = useCallback(async () => {
    try {
      const res = (await api.getWxCode({})) as unknown as { url?: string; qrCode?: string }
      setQrCode(res?.url || res?.qrCode || '')
      setShowQrCode(true)
    } catch {
      Taro.showToast({
        title: tt('distribution.index.qrLoadFail', '二维码加载失败'),
        icon: 'none',
      })
    }
  }, [tt])

  const onSaveQr = useCallback(async () => {
    if (!qrCode) {
      Taro.showToast({
        title: tt('distribution.index.qrLoading', '二维码生成中'),
        icon: 'none',
      })
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
      Taro.showToast({
        title: tt('distribution.index.fillInfo', '请填写完整信息'),
        icon: 'none',
      })
      return
    }
    if (submitting) return
    setSubmitting(true)
    Taro.showLoading({ title: tt('distribution.index.verifying', '验证中') })
    try {
      await api.realNameAuth({ realName: idName.trim(), idCard: idNum.trim() })
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyOk', '验证成功'),
        icon: 'success',
      })
      setShowVerify(false)
      setData((prev) => ({ ...prev, verified: true }))
    } catch {
      Taro.hideLoading()
      Taro.showToast({
        title: tt('distribution.index.verifyFail', '验证失败'),
        icon: 'none',
      })
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
      icon: '👥',
      label: tt('distribution.index.menuTeam', '我的团队'),
      url: '/pages/distribution/team',
    },
    {
      icon: '📦',
      label: tt('distribution.index.menuOrders', '分销订单'),
      url: '/pages/distribution/order-list/index',
    },
    {
      icon: '🎯',
      label: tt('distribution.index.menuPlan', '分佣计划'),
      url: '/pages/distribution/plan/index',
    },
    {
      icon: '💸',
      label: tt('distribution.index.menuWithdraw', '申请提现'),
      url: '/pages/distribution/withdraw',
    },
    {
      icon: '📊',
      label: tt('distribution.index.menuRank', '推广排行'),
      url: '/pages/distribution/rank',
    },
    {
      icon: '💬',
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

  const avatar = data.avatar || user?.avatar || ''
  const nickname = data.nickname || user?.nickname || tt('distribution.index.defaultName', '操盘手')
  const initial = nickname.charAt(0) || 'U'

  const statsTabClass = (tab: StatsTab) =>
    `flex-1 text-center py-[16rpx] text-[26rpx] rounded-[10rpx]${
      statsTab === tab ? ' bg-card text-primary font-semibold' : ' text-muted-foreground'
    }`

  return (
    <View className="min-h-screen bg-background">
      <NavBar
        title={tt('distribution.index.title', '我的公司')}
        bgColor="#1a1a23"
        textColor="#ffffff"
      />

      <View className="pt-[96rpx] px-[24rpx] pb-[48rpx]">
        {/* PersonalInformationCard */}
        <View className="flex items-center bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="w-[96rpx] h-[96rpx] mr-[24rpx] flex-shrink-0">
            {avatar ? (
              <Image className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted" src={avatar} mode="aspectFill" />
            ) : (
              <View className="w-[96rpx] h-[96rpx] rounded-[12rpx] bg-muted flex items-center justify-center text-muted-foreground text-[36rpx] font-semibold">
                <Text>{initial}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <Text className="block text-[32rpx] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{nickname}</Text>
            <Text className="block text-[24rpx] text-primary mt-[8rpx]">
              {data.identity || tt('distribution.index.operator', '操盘手')}
            </Text>
            {data.companyName ? (
              <Text className="block text-[24rpx] text-muted-foreground mt-[8rpx] overflow-hidden text-ellipsis whitespace-nowrap">{data.companyName}</Text>
            ) : null}
          </View>
        </View>

        {/* EarningsStatisticsCard */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[32rpx]">
          <View className="flex bg-muted rounded-[12rpx] p-[4rpx] mb-[32rpx]">
            {(['day', 'month', 'sum'] as StatsTab[]).map((tab) => (
              <View
                key={tab}
                className={statsTabClass(tab)}
                onClick={() => setStatsTab(tab)}
              >
                <Text>
                  {tab === 'day'
                    ? tt('distribution.index.tabDay', '日')
                    : tab === 'month'
                      ? tt('distribution.index.tabMonth', '月')
                      : tt('distribution.index.tabSum', '总')}
                </Text>
              </View>
            ))}
          </View>
          <View className="flex">
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">¥{stats.earnings.toFixed(2)}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.earnings', '收益')}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">{stats.orders}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.orders', '订单数')}
              </Text>
            </View>
            <View className="flex-1 text-center">
              <Text className="block text-[36rpx] font-bold text-foreground">{stats.invites}</Text>
              <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
                {tt('distribution.index.invites', '邀请人数')}
              </Text>
            </View>
          </View>
        </View>

        {/* FunctionBlockColumn */}
        <View className="bg-card border border-border rounded-[16rpx] mb-[24rpx] p-[16rpx] flex flex-col gap-[12rpx]">
          {menuItems.map((item, idx) => (
            <View key={idx} className="flex items-center p-[24rpx] bg-muted rounded-[12rpx] active:opacity-70" onClick={() => onMenuClick(item)}>
              <Text className="text-[36rpx] mr-[24rpx] flex-shrink-0">{item.icon}</Text>
              <Text className="flex-1 text-[28rpx] text-foreground">{item.label}</Text>
              <Text className="text-[36rpx] text-muted-foreground leading-none flex-shrink-0">›</Text>
            </View>
          ))}
        </View>
      </View>

      {/* BottomPops 二维码弹窗 */}
      {showQrCode ? (
        <View className="fixed inset-0 bg-[rgba(0,0,0,0.7)] z-[1000] flex items-center justify-center p-[48rpx]">
          <View className="bg-card border border-border rounded-[16rpx] p-[32rpx] w-full max-w-[600rpx]">
            <View className="flex items-center justify-between mb-[24rpx]">
              <Text className="text-[32rpx] font-semibold text-foreground">
                {tt('distribution.index.qrTitle', '我的分享二维码')}
              </