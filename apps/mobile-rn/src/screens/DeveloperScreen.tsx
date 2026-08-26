/**
 * DeveloperScreen 开发者空间/详情页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/plaza/developer.vue(1018 行,标题「开发者详情」):
 * - 导航栏「开发者详情」+ 返回
 * - header_card:头像 + 昵称 + (非开发者)「成为开发者」入口 → DevEnterCover(开通封面)
 * - dev_list 三功能入口(图标竖排):
 *   ① 我的智能体 → DevEnter(原 /pagesA/dev_enter/index)
 *   ② 智能体收入 → ModelIncome(原 /pagesA/dev_enter/model_income)
 *   ③ n8n智能体   → N8nModel(原 /pagesA/dev_enter/nbn_model)
 * - 开发者信息(账号/API密钥/网址/到期时间 + 续费):后端无 getDevInfo 接口,由
 *   getDeveloperSubscription + getDeveloperApiKeys + 登录用户信息拼装;
 *   网址字段暂无数据源(users 表无 website),显示 '—'
 * - 非开发者问题区(开发者须知/联系团长):占位卡片
 *
 * 注:历史版本把本路由误实现为「开发者套餐开通订阅页」(FEATURES+plans+微信支付)——
 * 该开通支付语义已由 DevEnterCoverScreen(原 dev_enter/cover.vue)承接,本路由恢复为开发者空间页。
 */
import { useEffect, useState } from 'react'
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getDeveloperApiKeys,
  getDeveloperInfo,
  getDeveloperSubscription,
  type DeveloperApiKeyItem,
  type DeveloperInfo,
  type DeveloperSubscriptionInfo,
} from '@ihui/api-client'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 原 dev_list 三入口图标(CDN,与 Uniapp 一致) */
const ICON_MY_MODEL = 'https://file.aizhs.top/sys-mini/xtk/my_model.png'
const ICON_INCOME = 'https://file.aizhs.top/sys-mini/xtk/my_input.png'
const ICON_N8N = 'https://file.aizhs.top/sys-mini/default/n8n.png'
const ICON_BUSINESS_CARD = 'https://file.aizhs.top/sys-mini/geren-icon.png'
const DEFAULT_LOGO = 'https://file.aizhs.top/sys-mini/xtk/devlogo.png'

/** 非开发者问题解答卡(对齐 Uniapp problems 数据) */
const PROBLEMS: readonly { title: string; context: string; btn: string; url: string }[] = [
  {
    title: '开发者激励计划',
    context: '发布 AI 智能体,获取分成收益',
    btn: '查看详情',
    url: 'https://blurb.kou.aizhs.top/',
  },
  {
    title: '上架指南',
    context: '创建智能体、配置模型、提交审核',
    btn: '去了解',
    url: 'https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncryrmnIh',
  },
]

export default function DeveloperScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const { user } = useAuth()
  // 开发者订阅 + API 密钥(对齐原 developer_info 区:账号/密钥/网址/到期时间 + 续费)
  const [subscription, setSubscription] = useState<DeveloperSubscriptionInfo | null>(null)
  const [apiKeys, setApiKeys] = useState<DeveloperApiKeyItem[]>([])
  // 开发者申请信息(2026-08-26:GET /api/developer/info 死代码路由已恢复注册)
  const [devInfo, setDevInfo] = useState<DeveloperInfo | null>(null)
  const [infoLoaded, setInfoLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [subRes, keyRes, infoRes] = await Promise.all([
          getDeveloperSubscription(),
          getDeveloperApiKeys().catch(() => null),
          getDeveloperInfo().catch(() => null),
        ])
        if (cancelled) return
        if (subRes.success) setSubscription(subRes.data.subscription)
        if (keyRes?.success) setApiKeys(keyRes.data.list)
        if (infoRes?.success) setDevInfo(infoRes.data)
      } catch {
        // 订阅/密钥/信息加载失败不阻塞页面
      } finally {
        if (!cancelled) setInfoLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** 首个可用(active 且含公开 key)的 API 密钥,供"秘密"行展示与复制 */
  const firstApiKey: DeveloperApiKeyItem | null =
    apiKeys.find((k) => k.status === 'active' && k.key.length > 0) ?? null

  /** 复制文本(对齐原 copyText) */
  const handleCopy = (text: string): void => {
    if (!text) return
    try {
      Clipboard.setString(text)
      Alert.alert(t('common.hint'), '已复制')
    } catch {
      Alert.alert(t('common.hint'), '复制失败')
    }
  }

  const handleOpenCover = (): void => {
    // 成为开发者 → 开通封面(选套餐 + 一键开通支付)
    navigation.navigate('DevEnterCover')
  }

  const handleOpenWeb = (url: string): void => {
    try {
      Clipboard.setString(url)
      Alert.alert(t('common.hint'), '链接已复制,请在浏览器中打开')
    } catch {
      Alert.alert(t('common.hint'), '复制失败,请重试')
    }
  }

  const handleContactLeader = (): void => {
    // 原 showCode → 展示团长二维码;APP 端引导联系客服
    navigation.navigate('CustomerService')
  }

  return (
    <View style={styles.shell}>
      <NavBar title="开发者详情" onBack={() => navigation.goBack()} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* header_card 用户信息卡(对齐 Uniapp header_card:头像 + 昵称 + 成为开发者) */}
        <View style={styles.headerCard}>
          <View style={styles.logoBody}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.logo} resizeMode="cover" />
            ) : (
              <Image source={{ uri: DEFAULT_LOGO }} style={styles.logo} resizeMode="cover" />
            )}
          </View>
          <Text style={styles.userName} numberOfLines={1}>
            {user?.nickname ?? user?.username ?? '未登录'}
          </Text>
          <TouchableOpacity style={styles.entryBtn} onPress={handleOpenCover} activeOpacity={0.8}>
            <Text style={styles.entryBtnText}>{subscription ? '续费' : '成为开发者'}</Text>
          </TouchableOpacity>
        </View>

        {/* 开发者信息区(对齐原 developer_info_body:账号/密钥/网址/到期时间 + 续费;
         *  数据源 getDeveloperSubscription + getDeveloperApiKeys + 登录用户信息,仅在有效订阅时展示;
         *  secret 后端仅创建时返回一次,此处展示密钥概览并复制公开 key;网址数据源 developer_applications.website) */}
        {infoLoaded && subscription ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>开发者信息</Text>
            {/* 开发者名称/简介/申请状态(2026-08-26:GET /api/developer/info 死代码路由已恢复注册) */}
            {devInfo ? (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>名称</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {devInfo.name || '-'}
                  </Text>
                </View>
                {devInfo.description ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>简介</Text>
                    <Text style={styles.infoValue} numberOfLines={2}>
                      {devInfo.description}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>申请状态</Text>
                  <Text style={styles.infoValue} numberOfLines={1}>
                    {devInfo.status === 1 ? '已通过' : devInfo.status === 2 ? '已拒绝' : '待审核'}
                  </Text>
                </View>
              </>
            ) : null}
            {/* 账号 = 邮箱/手机号,兜底昵称/用户名 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>账号</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {user?.email ?? user?.phone ?? user?.nickname ?? user?.username ?? '-'}
              </Text>
            </View>
            {/* 秘密 = API 密钥概览(明文 secret 不可回取;复制公开 key) */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>API 密钥</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {apiKeys.length > 0 ? `已创建 ${apiKeys.length} 个` : '未创建'}
              </Text>
              {firstApiKey ? (
                <TouchableOpacity onPress={() => handleCopy(firstApiKey.key)} hitSlop={8}>
                  <Text style={styles.infoCopy}>复制</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {/* 网址:数据源 developer_applications.website(GET /api/developer/info),无值时占位 '—' */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>网址</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {devInfo?.website || '—'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: '#FF7272' }]}>到期时间</Text>
              <Text style={[styles.infoValue, { color: '#FF7272' }]} numberOfLines={1}>
                {subscription.endTime ? new Date(subscription.endTime).toLocaleDateString() : '-'}
              </Text>
              <TouchableOpacity onPress={handleOpenCover} hitSlop={8}>
                <Text style={styles.infoRenew}>续费</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* dev_list 三功能入口(对齐 Uniapp dev_list:我的智能体/智能体收入/n8n智能体) */}
        <View style={styles.devList}>
          <TouchableOpacity
            style={styles.devItem}
            onPress={() => navigation.navigate('DevEnter')}
            activeOpacity={0.7}
          >
            <View style={styles.iconBody}>
              <Image source={{ uri: ICON_MY_MODEL }} style={styles.devIcon} resizeMode="contain" />
            </View>
            <Text style={styles.devItemText}>我的智能体</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.devItem}
            onPress={() => navigation.navigate('ModelIncome', { agentId: undefined })}
            activeOpacity={0.7}
          >
            <View style={styles.iconBody}>
              <Image source={{ uri: ICON_INCOME }} style={styles.devIcon} resizeMode="contain" />
            </View>
            <Text style={styles.devItemText}>智能体收入</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.devItem}
            onPress={() => navigation.navigate('N8nModel')}
            activeOpacity={0.7}
          >
            <View style={styles.iconBody}>
              <Image source={{ uri: ICON_N8N }} style={styles.devIcon} resizeMode="contain" />
            </View>
            <Text style={styles.devItemText}>n8n智能体</Text>
          </TouchableOpacity>
          {/* 创客名片入口(孤儿路由修复:BusinessCard 注册无入口,开发者空间补挂) */}
          <TouchableOpacity
            style={styles.devItem}
            onPress={() => navigation.navigate('BusinessCard', {})}
            activeOpacity={0.7}
          >
            <View style={styles.iconBody}>
              <Image
                source={{ uri: ICON_BUSINESS_CARD }}
                style={styles.devIcon}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.devItemText}>创客名片</Text>
          </TouchableOpacity>
        </View>

        {/* 非开发者问题区(对齐 Uniapp un_developer:问题解答卡 + 联系团长) */}
        <View style={styles.unDeveloper}>
          <Text style={styles.unTitle}>相关开发者的一系列问题解答?</Text>
          {PROBLEMS.map((p) => (
            <TouchableOpacity
              key={p.title}
              style={styles.problemCard}
              onPress={() => handleOpenWeb(p.url)}
              activeOpacity={0.8}
            >
              <Text style={styles.problemTitle}>{p.title}</Text>
              <Text style={styles.problemContext}>{p.context}</Text>
              <View style={styles.problemBtn}>
                <Text style={styles.problemBtnText}>{p.btn}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.bigBtn}
            onPress={handleContactLeader}
            activeOpacity={0.85}
          >
            <Text style={styles.bigBtnTop}>其他问题?</Text>
            <Text style={styles.bigBtnBot}>咨询客服,获得多对一在线答疑</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  } as ViewStyle,
  scroll: {
    flex: 1,
  } as ViewStyle,
  scrollContent: {
    padding: rpx(20),
    paddingBottom: rpx(48),
  } as ViewStyle,
  headerCard: {
    backgroundColor: tokens.surface.card,
    borderRadius: 12,
    padding: rpx(28),
    alignItems: 'center',
    marginBottom: rpx(20),
  } as ViewStyle,
  logoBody: {
    marginBottom: rpx(16),
  } as ViewStyle,
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
  } as ImageStyle,
  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: tokens.text.primary,
    marginBottom: rpx(16),
  } as TextStyle,
  entryBtn: {
    paddingHorizontal: rpx(40),
    paddingVertical: rpx(10),
    borderRadius: 8,
    backgroundColor: tokens.brand.DEFAULT,
  } as ViewStyle,
  entryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.surface.light,
  } as TextStyle,
  // ── 开发者信息区 ──
  infoCard: {
    backgroundColor: tokens.surface.card,
    borderRadius: 12,
    padding: rpx(24),
    marginBottom: rpx(20),
  } as ViewStyle,
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.text.primary,
    marginBottom: rpx(12),
  } as TextStyle,
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: rpx(8),
  } as ViewStyle,
  infoLabel: {
    width: 76,
    fontSize: 13,
    color: tokens.text.secondary,
  } as TextStyle,
  infoValue: {
    flex: 1,
    fontSize: 13,
    color: tokens.text.primary,
  } as TextStyle,
  infoCopy: {
    fontSize: 12,
    color: tokens.brand.DEFAULT,
    paddingHorizontal: 4,
  } as TextStyle,
  infoRenew: {
    fontSize: 12,
    color: '#FF7272',
    fontWeight: '600',
    paddingHorizontal: 4,
  } as TextStyle,
  devList: {
    flexDirection: 'row',
    backgroundColor: tokens.surface.card,
    borderRadius: 12,
    paddingVertical: rpx(24),
    marginBottom: rpx(20),
  } as ViewStyle,
  devItem: {
    flex: 1,
    alignItems: 'center',
    gap: rpx(8),
  } as ViewStyle,
  iconBody: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  devIcon: {
    width: 28,
    height: 28,
  } as ImageStyle,
  devItemText: {
    fontSize: 13,
    color: tokens.text.primary,
  } as TextStyle,
  unDeveloper: {
    gap: rpx(16),
  } as ViewStyle,
  unTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.text.primary,
    marginBottom: rpx(8),
  } as TextStyle,
  problemCard: {
    backgroundColor: tokens.surface.card,
    borderRadius: 12,
    padding: rpx(24),
  } as ViewStyle,
  problemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.text.primary,
    marginBottom: rpx(8),
  } as TextStyle,
  problemContext: {
    fontSize: 13,
    color: tokens.text.secondary,
    marginBottom: rpx(16),
  } as TextStyle,
  problemBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(8),
    borderRadius: 6,
    backgroundColor: tokens.brand.DEFAULT,
  } as ViewStyle,
  problemBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: tokens.surface.light,
  } as TextStyle,
  bigBtn: {
    backgroundColor: tokens.surface.card,
    borderRadius: 12,
    padding: rpx(24),
    alignItems: 'center',
  } as ViewStyle,
  bigBtnTop: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.text.primary,
  } as TextStyle,
  bigBtnBot: {
    fontSize: 12,
    color: tokens.text.secondary,
    marginTop: rpx(6),
  } as TextStyle,
})
