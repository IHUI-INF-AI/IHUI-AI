import { useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type { AppPermissionScreenProps } from '../../types'

export type { AppPermissionScreenProps }

interface PermissionItem {
  name: string
  desc: string
}

const PERMISSIONS: PermissionItem[] = [
  {
    name: '相机',
    desc: '用于拍摄照片、录制视频、扫描二维码、AI 图像识别与上传头像等场景。您可随时在系统设置中关闭该权限，关闭后相关功能将无法使用。',
  },
  {
    name: '相册(照片/视频)',
    desc: '用于从相册选择图片或视频进行上传、发布内容、更换头像、AI 创作素材等。您可随时在系统设置中关闭该权限。',
  },
  {
    name: '位置信息',
    desc: '用于提供基于地理位置的附近内容推荐、活动定位、打卡等功能。您可选择仅在使用期间允许或始终拒绝，关闭后不影响其他功能。',
  },
  {
    name: '通知(推送)',
    desc: '用于接收订单状态、系统消息、课程更新、互动提醒等推送通知。您可在系统设置中按类别开启或关闭，关闭后将无法及时收到相关提醒。',
  },
  {
    name: '麦克风',
    desc: '用于语音输入、AI 语音对话、录音、直播连麦等场景。您可随时在系统设置中关闭该权限，关闭后语音相关功能将无法使用。',
  },
  {
    name: '存储(文件读取)',
    desc: '用于读取或保存文件、缓存图片与视频、离线课程资料等。您可随时在系统设置中关闭该权限，关闭后部分离线功能将受限。',
  },
  {
    name: '通讯录',
    desc: '用于查找通讯录中的好友、邀请好友、便捷登录等场景（仅在您主动操作时触发）。您可随时在系统设置中关闭该权限。',
  },
  {
    name: '生物识别(Face ID/指纹)',
    desc: '用于快捷登录、支付验证等安全场景。仅在您主动开启后使用，可在 APP 安全设置中随时关闭。',
  },
]

export function AppPermissionScreen({
  t,
  onBack,
  colorScheme = 'light',
}: AppPermissionScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings.appPermission', { fallback: '应用权限' })}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          {t('appPermission.intro', {
            fallback:
              '本 APP 严格遵循最小必要原则申请系统权限，所有权限均由您主动授权，您可随时在手机系统「设置 - 权限管理」中查看、调整或撤回授权。撤回非必要权限不影响 APP 其他功能的正常使用。',
          })}
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

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
      gap: 12,
    },
    backText: { fontSize: 16, color: tk.text.medium },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    body: { padding: 14, paddingBottom: 32, gap: 12 },
    intro: {
      fontSize: 14,
      color: tk.text.secondary,
      lineHeight: 22,
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    card: {
      backgroundColor: tk.surface.light,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    permName: { fontSize: 16, fontWeight: '600', color: tk.text.primary, marginBottom: 8 },
    permDesc: { fontSize: 14, color: tk.text.secondary, lineHeight: 22 },
  })
}
