// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getEduPointChannels,
  getMyEduPoints,
  getPointsMallGoods,
  redeemPointsMallGoods,
  type EduPointChannel,
  type PointsMallGoods,
} from '@ihui/api-client'
import {
  EduPointsScreen as SharedEduPointsScreen,
  type EduPointsChannelView,
  type EduPointsGoodsView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'eduPointsPage'

function toChannelView(row: EduPointChannel): EduPointsChannelView {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? null,
    description: row.description ?? null,
  }
}

function toGoodsView(row: PointsMallGoods): EduPointsGoodsView {
  return {
    id: row.id,
    name: row.name,
    cover: row.cover ?? null,
    cost: row.pointsCost ?? 0,
    soldOut: row.stock !== null && row.stock !== undefined && row.stock <= 0,
  }
}

/**
 * RN 端「教育积分」薄壳 —— 承载 web /edu-points。渲染全部委托共享屏,本文件只管:
 * 取数(GET /api/edu-points/channels、/api/edu-points/my-points、/api/points/mall/redeem,
 * 契约见 packages/api-client/src/endpoints/edu-points.ts 头注)、兑换 POST 与刷新、
 * 登录门(web useAuthGate 同口径:未登录不发注定 401 的请求,显登录引导)。
 * 口径差已登记:后端 channels 端点挂在需登录插件下(point.ts:156-158),与 web「公开配置不门」
 * 的假设不一致;RN 未登录整页只显登录引导,不用空列表谎报「暂无渠道」。
 */
export function EduPointsScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [channels, setChannels] = useState<EduPointsChannelView[]>([])
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [channelsError, setChannelsError] = useState<string | null>(null)

  const [myPoints, setMyPoints] = useState<number | null>(null)

  const [goods, setGoods] = useState<EduPointsGoodsView[]>([])
  const [goodsLoading, setGoodsLoading] = useState(false)
  const [goodsError, setGoodsError] = useState<string | null>(null)

  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null)
  const [redeemError, setRedeemError] = useState<string | null>(null)

  const loadChannels = useCallback(async () => {
    if (!user) return
    setChannelsLoading(true)
    try {
      const res = await getEduPointChannels()
      if (!res.success) {
        setChannelsError(res.error ?? t('common.loadFailed'))
        return
      }
      setChannelsError(null)
      setChannels((res.data?.list ?? []).map(toChannelView))
    } catch {
      setChannelsError(t('common.loadFailed'))
    } finally {
      setChannelsLoading(false)
    }
  }, [user, t])

  const loadMyPoints = useCallback(async () => {
    if (!user) return
    try {
      const res = await getMyEduPoints()
      setMyPoints(res.success ? (res.data?.points ?? 0) : null)
    } catch {
      setMyPoints(null)
    }
  }, [user])

  const loadGoods = useCallback(async () => {
    if (!user) return
    setGoodsLoading(true)
    try {
      const res = await getPointsMallGoods()
      if (!res.success) {
        setGoodsError(res.error ?? t('common.loadFailed'))
        return
      }
      setGoodsError(null)
      setGoods((res.data?.list ?? []).map(toGoodsView))
    } catch {
      setGoodsError(t('common.loadFailed'))
    } finally {
      setGoodsLoading(false)
    }
  }, [user, t])

  useEffect(() => {
    void loadChannels()
    void loadMyPoints()
    void loadGoods()
  }, [loadChannels, loadMyPoints, loadGoods])

  const onRedeem = useCallback(
    async (id: string) => {
      setRedeemingId(id)
      setRedeemMessage(null)
      setRedeemError(null)
      try {
        const res = await redeemPointsMallGoods(id)
        if (!res.success) {
          setRedeemError(res.error ?? t('common.loadFailed'))
          return
        }
        setRedeemMessage(`${t(`${NS}.myPoints`)}: ${res.data?.points ?? 0}`)
        void loadMyPoints()
        void loadGoods()
      } catch {
        setRedeemError(t('common.loadFailed'))
      } finally {
        setRedeemingId(null)
      }
    },
    [t, loadMyPoints, loadGoods],
  )

  return (
    <SharedEduPointsScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      myPoints={myPoints}
      channelsLoading={channelsLoading}
      channelsError={channelsError}
      channels={channels}
      goodsLoading={goodsLoading}
      goodsError={goodsError}
      goods={goods}
      redeemingId={redeemingId}
      redeemMessage={redeemMessage}
      redeemError={redeemError}
      onRedeem={(id) => {
        if (!redeemingId) void onRedeem(id)
      }}
      onRefresh={() => {
        void loadChannels()
        void loadMyPoints()
        void loadGoods()
      }}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
