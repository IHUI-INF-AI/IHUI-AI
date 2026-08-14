import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { captureRef } from 'react-native-view-shot'
import { Asset, requestPermissionsAsync } from 'expo-media-library'
import Clipboard from '@react-native-clipboard/clipboard'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  DistributionScreen as SharedDistributionScreen,
  type DistributionInfo,
} from '@ihui/rn-app'
import EarningsStatisticsCard from '../components/EarningsStatisticsCard'
import PersonalInformationCard from '../components/PersonalInformationCard'
import { FunctionBlockColumn, type FunctionBlock } from '../components/FunctionBlockColumn'
import CommissionFloatingIcon from '../components/CommissionFloatingIcon'
import { HandPlatePops } from '../components/HandPlatePops'
import { BottomPops } from '../components/BottomPops'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 邀请链接域名(对齐 ProfileScreen WEBSITE_URL 'https://www.aizhs.top') */
const INVITE_BASE_URL = 'https://www.aizhs.top'

export function DistributionScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<DistributionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  // HandPlatePops 提现详情弹层(对齐 Uniapp hand-plate-pups/index.vue)
  const [withdrawDetailVisible, setWithdrawDetailVisible] = useState(false)
  // BottomPops 分享二维码弹层(对齐 Uniapp 分销页分享二维码弹层)
  const [shareQrVisible, setShareQrVisible] = useState<boolean>(false)
  // 二维码 View 引用(react-native-view-shot captureRef 截图保存到相册)
  const qrRef = useRef<View>(null)
  // 保存到相册进行中(禁用按钮防重复点击)
  const [savingQr, setSavingQr] = useState(false)
  // 邀请链接 = 域名/register?inviteCode=user.inviteCode(对齐 Uniapp 分销页分享链接)
  const inviteCode = user?.inviteCode
  const inviteLink = inviteCode
    ? `${INVITE_BASE_URL}/register?inviteCode=${inviteCode}`
    : ''

  /** 复制邀请链接到剪贴板(对齐 Uniapp 分销页 copyInviteLink) */
  const handleCopyInviteLink = useCallback(() => {
    if (!inviteLink) {
      Alert.alert('提示', '暂无邀请码')
      return
    }
    Clipboard.setString(inviteLink)
    Alert.alert('提示', '已复制邀请链接')
  }, [inviteLink])

  /** 保存二维码到相册(view-shot 截图 → expo-media-library 保存) */
  const handleSaveQrToAlbum = useCallback(async () => {
    if (!inviteLink) {
      Alert.alert('提示', '暂无邀请码')
      return
    }
    if (!qrRef.current) {
      Alert.alert('提示', '二维码未就绪,请稍后重试')
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
        Alert.alert('提示', '未获得相册权限,无法保存')
        return
      }
      await Asset.create(localUri)
      Alert.alert('提示', '已保存到相册')
    } catch (err) {
      Alert.alert('保存失败', err instanceof Error ? err.message : '请稍后重试')
    } finally {
      setSavingQr(false)
    }
  }, [inviteLink])

  /** FunctionBlockColumn 分销工具入口(对齐 Uniapp 分销功能块) */
  const functionBlocks: FunctionBlock[] = [
    { id: 'withdraw', title: '提现', icon: '💰', description: '佣金提现到银行卡' },
    { id: 'bankcard', title: '银行卡', icon: '🏦', description: '管理绑定银行卡' },
    { id: 'realname', title: '实名认证', icon: '🪪', description: '完成实名认证' },
    { id: 'income', title: '收入明细', icon: '📊', description: '查看收入记录' },
    { id: 'orders', title: '分销订单', icon: '📦', description: '查看分销订单记录' },
    { id: 'commission', title: '分佣计划', icon: '💰', description: '了解分佣规则与收益' },
  ]

  const onBlockPress = useCallback((id: string) => {
    const routeMap: Record<string, string> = {
      withdraw: 'Withdraw',
      bankcard: 'BankCard',
      realname: 'RealNameAuth',
      income: 'Income',
      orders: 'DistributionOrderList',
      commission: 'EarnCommission',
    }
    const route = routeMap[id]
    if (route) navigation.navigate(route as never)
  }, [navigation])

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const res = await fetchApi<DistributionInfo>('/distribution/overview')
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
    if (!info) return
    if (info.pending < info.withdrawMin) {
      Alert.alert(
        t('distribution.withdrawFailed'),
        t('distribution.withdrawMin', { amount: info.withdrawMin }),
      )
      return
    }
    setWithdrawing(true)
    const res = await fetchApi('/distribution/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amount: info.pending }),
    })
    setWithdrawing(false)
    if (res.success) {
      Alert.alert(t('distribution.withdrawSuccess'))
      void load(true)
    } else {
      Alert.alert(t('distribution.withdrawFailed'))
    }
  }

  return (
    <View style={shellStyles.root}>
      <ScrollView style={shellStyles.scroll} contentContainerStyle={shellStyles.scrollContent}>
        {/* PersonalInformationCard 个人信息卡片(对齐 Uniapp 分销页个人信息) */}
        <View style={shellStyles.personalInfoWrap}>
          <PersonalInformationCard
            avatar={user?.avatar}
            nickname={user?.nickname || user?.username}
            inviteCode={user?.inviteCode}
            level={info ? '分销商' : undefined}
          />
        </View>
        <View style={shellStyles.statsWrap}>
          <EarningsStatisticsCard
            label="分销收益概览"
            title={info?.totalEarnings ?? 0}
            todayAmount={info?.pending ?? 0}
            monthAmount={info?.withdrawn ?? 0}
            totalAmount={info?.totalEarnings ?? 0}
            trend={info ? { direction: 'up', percent: 12.5 } : undefined}
          />
        </View>
        {/* FunctionBlockColumn 分销工具入口(对齐 Uniapp FunctionBlockColumn/index.vue) */}
        <View style={shellStyles.functionBlocksWrap}>
          <FunctionBlockColumn blocks={functionBlocks} onBlockPress={onBlockPress} />
        </View>
        {/* 分享二维码邀请按钮(对齐 Uniapp 分销页分享二维码入口) */}
        <View style={shellStyles.shareBtnWrap}>
          <Pressable
            style={({ pressed }) => [shellStyles.shareBtn, pressed ? shellStyles.pressed : null]}
            onPress={() => setShareQrVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="分享二维码"
          >
            <Text style={shellStyles.shareBtnText}>分享二维码邀请好友</Text>
          </Pressable>
        </View>
        <SharedDistributionScreen
          t={t}
          info={info}
          loading={loading}
          refreshing={refreshing}
          error={error}
          withdrawing={withdrawing}
          onRefresh={() => void load(true)}
          onWithdraw={handleWithdraw}
          onBack={() => navigation.goBack()}
        />
      </ScrollView>
      {/* CommissionFloatingIcon 佣金悬浮按钮(对齐 Uniapp 分销佣金悬浮按钮) */}
      <CommissionFloatingIcon
        amount={info?.pending}
        onPress={() => setWithdrawDetailVisible(true)}
      />
      {/* HandPlatePops 提现详情弹层(对齐 Uniapp hand-plate-pups/index.vue) */}
      <HandPlatePops
        visible={withdrawDetailVisible}
        title="提现详情"
        onClose={() => setWithdrawDetailVisible(false)}
      >
        <View style={shellStyles.withdrawDetailContent}>
          <Text style={shellStyles.withdrawDetailText}>
            可提现金额:¥{info?.pending ?? 0}
          </Text>
          <Text style={shellStyles.withdrawDetailText}>
            已提现金额:¥{info?.withdrawn ?? 0}
          </Text>
          <Text style={shellStyles.withdrawDetailText}>
            最低提现:¥{info?.withdrawMin ?? 0}
          </Text>
        </View>
      </HandPlatePops>
      {/* BottomPops 分享二维码弹层(对齐 Uniapp 分销页分享二维码弹层) */}
      <BottomPops
        visible={shareQrVisible}
        onClose={() => setShareQrVisible(false)}
        title="分享二维码"
      >
        <View style={shellStyles.qrContent}>
          {inviteLink ? (
            <>
              <View
                ref={qrRef}
                collapsable={false}
                style={shellStyles.qrCodeBox}
              >
                <QRCode
                  value={inviteLink}
                  size={176}
                  color={tokens.gray.black}
                  backgroundColor={tokens.surface.light}
                  ecl="M"
                />
              </View>
              <Pressable
                style={({ pressed }) => [
                  shellStyles.qrLinkBtn,
                  pressed ? shellStyles.pressed : null,
                ]}
                onPress={handleCopyInviteLink}
                accessibilityRole="button"
                accessibilityLabel="复制邀请链接"
              >
                <Text style={shellStyles.qrLinkText} numberOfLines={1}>
                  {inviteLink}
                </Text>
              </Pressable>
              <Text style={shellStyles.qrTip}>扫描上方二维码,注册成为会员</Text>
              <Text style={shellStyles.qrTipSub}>您将获得会员费 20% 的佣金收益</Text>
              <Pressable
                style={({ pressed }) => [
                  shellStyles.saveBtn,
                  pressed ? shellStyles.pressed : null,
                  savingQr ? shellStyles.saveBtnDisabled : null,
                ]}
                onPress={handleSaveQrToAlbum}
                disabled={savingQr}
                accessibilityRole="button"
                accessibilityLabel="保存到相册"
              >
                <Text style={shellStyles.saveBtnText}>
                  {savingQr ? '保存中...' : '保存到相册'}
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  shellStyles.copyBtn,
                  pressed ? shellStyles.pressed : null,
                ]}
                onPress={handleCopyInviteLink}
                accessibilityRole="button"
                accessibilityLabel="复制邀请链接"
              >
                <Text style={shellStyles.copyBtnText}>复制邀请链接</Text>
              </Pressable>
            </>
          ) : (
            <View style={shellStyles.qrCodeBox}>
              <Text style={shellStyles.qrPlaceholder}>暂无邀请码</Text>
            </View>
          )}
        </View>
      </BottomPops>
    </View>
  )
}

const shellStyles = {
  root: { flex: 1 } as const,
  scroll: { flex: 1 } as const,
  scrollContent: { paddingBottom: 16 } as const,
  personalInfoWrap: { paddingHorizontal: 16, paddingTop: 12 } as const,
  statsWrap: { paddingTop: 12, paddingBottom: 4 } as const,
  functionBlocksWrap: { paddingHorizontal: 16, paddingVertical: 8 } as const,
  withdrawDetailContent: { gap: 10, paddingVertical: 8 } as const,
  withdrawDetailText: { fontSize: 14, color: '#333' } as const,
  shareBtnWrap: { paddingHorizontal: 16, paddingBottom: 4 } as const,
  shareBtn: {
    height: 44,
    borderRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  shareBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.surface.light,
  } as const,
  qrContent: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  } as const,
  qrCodeBox: {
    width: 200,
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.light,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  qrPlaceholder: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.text.tertiary,
  } as const,
  qrLinkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 260,
  } as const,
  qrLinkText: {
    fontSize: 12,
    color: tokens.text.secondary,
    textAlign: 'center',
  } as const,
  saveBtn: {
    height: 44,
    borderRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  } as const,
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.surface.light,
  } as const,
  saveBtnDisabled: {
    opacity: 0.5,
  } as const,
  copyBtn: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: tokens.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  } as const,
  copyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.brand.DEFAULT,
  } as const,
  qrTip: {
    fontSize: 14,
    color: tokens.text.primary,
    textAlign: 'center',
  } as const,
  qrTipSub: {
    fontSize: 12,
    color: tokens.text.secondary,
    textAlign: 'center',
  } as const,
  pressed: { opacity: 0.85 } as const,
}
