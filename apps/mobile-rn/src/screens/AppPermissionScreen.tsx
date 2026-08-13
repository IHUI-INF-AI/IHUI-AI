/**
 * AppPermissionScreen 应用权限说明页(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/settings/app-permission.vue(原页仅标题,无内容):
 * - 顶部 NavBar(标题「应用权限」+ 返回)
 * - 内容区:权限说明列表(相机/相册/位置/通知/麦克风/存储等),静态文本展示
 * - 浅色优雅风,rnLightTokens;圆角守门;无分割线(用 gap 间距分隔)
 */
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnLightTokens as tk } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

// mobile-rn 端暂无 settings.appPermission 翻译 key(对齐 .vue 硬编码中文),key 就绪后自动切换
const TITLE_KEY = 'settings.appPermission'

interface PermissionItem {
  name: string
  desc: string
}

const PERMISSIONS: PermissionItem[] = [
  {
    name: '相机',
    desc: '用于拍摄照片、录制视频、扫描二维码、AI 图像识别与上传头像等场景。您可随时在系统设置中关闭该权限,关闭后相关功能将无法使用。',
  },
  {
    name: '相册(照片/视频)',
    desc: '用于从相册选择图片或视频进行上传、发布内容、更换头像、AI 创作素材等。您可随时在系统设置中关闭该权限。',
  },
  {
    name: '位置信息',
    desc: '用于提供基于地理位置的附近内容推荐、活动定位、打卡等功能。您可选择仅在使用期间允许或始终拒绝,关闭后不影响其他功能。',
  },
  {
    name: '通知(推送)',
    desc: '用于接收订单状态、系统消息、课程更新、互动提醒等推送通知。您可在系统设置中按类别开启或关闭,关闭后将无法及时收到相关提醒。',
  },
  {
    name: '麦克风',
    desc: '用于语音输入、AI 语音对话、录音、直播连麦等场景。您可随时在系统设置中关闭该权限,关闭后语音相关功能将无法使用。',
  },
  {
    name: '存储(文件读取)',
    desc: '用于读取或保存文件、缓存图片与视频、离线课程资料等。您可随时在系统设置中关闭该权限,关闭后部分离线功能将受限。',
  },
  {
    name: '通讯录',
    desc: '用于查找通讯录中的好友、邀请好友、便捷登录等场景(仅在您主动操作时触发)。您可随时在系统设置中关闭该权限。',
  },
  {
    name: '生物识别(Face ID/指纹)',
    desc: '用于快捷登录、支付验证等安全场景。仅在您主动开启后使用,可在 APP 安全设置中随时关闭。',
  },
]

export function AppPermissionScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const tTitle = t(TITLE_KEY)
  const title = tTitle === TITLE_KEY ? '应用权限' : tTitle

  return (
    <View style={styles.container}>
      <NavBar title={title} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          本 APP 严格遵循最小必要原则申请系统权限,所有权限均由您主动授权,您可随时在手机系统「设置 - 权限管理」中查看、调整或撤回授权。撤回非必要权限不影响 APP 其他功能的正常使用。
        </Text>
        {PERMISSIONS.map((item) => (
          <View key={item.name} style={styles.card}>
            <Text style={styles.permName}>{item.name}</Text>
            <Text style={styles.permDesc}>{item.desc}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tk.surface.muted,
  },
  content: {
    padding: 12,
    paddingBottom: 32,
    gap: 12,
  },
  intro: {
    fontSize: 13,
    color: tk.text.secondary,
    lineHeight: 22,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  card: {
    backgroundColor: tk.surface.light,
    borderRadius: 8,
    padding: 16,
  },
  permName: {
    fontSize: 15,
    fontWeight: '600',
    color: tk.text.primary,
    marginBottom: 8,
  },
  permDesc: {
    fontSize: 13,
    color: tk.text.secondary,
    lineHeight: 22,
  },
})

export default AppPermissionScreen
