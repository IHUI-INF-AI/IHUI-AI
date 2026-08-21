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
 * - 开发者信息(账号/秘密/网址/到期时间 + 续费):后端暂无 getDevInfo 接口,开发者信息区暂隐藏
 * - 非开发者问题区(开发者须知/联系团长):占位卡片
 *
 * 注:历史版本把本路由误实现为「开发者套餐开通订阅页」(FEATURES+plans+微信支付)——
 * 该开通支付语义已由 DevEnterCoverScreen(原 dev_enter/cover.vue)承接,本路由恢复为开发者空间页。
 */
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
            <Text style={styles.entryBtnText}>成为开发者</Text>
          </TouchableOpacity>
        </View>

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
