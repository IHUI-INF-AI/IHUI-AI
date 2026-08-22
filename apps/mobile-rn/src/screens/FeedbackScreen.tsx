/**
 * RN 端 Feedback 包装器 — 注入 t + onBack(navigation.goBack)+ onSubmit(fetchApi)+ onPickImages(选图上传)。
 * 渲染共享 FeedbackScreen(@ihui/rn-app),平台无关 UI 由共享层负责。
 *
 * 问题截图(对齐 Uniapp fankui「最多9张」):
 * - 选图:expo-image-picker 相册多选(剩余数量)
 * - 上传:uploadFileMultipart 拿 CDN URL(对齐原 fankui 选图后 request 上传)
 * - 提交:payload.filePath = images.join(',')(对齐原 submitData.filePath = filePaths.join(','))
 *   注:后端 POST /feedbacks 尚未接收 filePath 字段(schema 无 additionalProperties:false,
 *   未知字段被 fastify 忽略,不报错);后端 feedbacks 表加 file_path 字段后即可持久化。
 */
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as ImagePicker from 'expo-image-picker'
import { FeedbackScreen as SharedFeedbackScreen } from '@ihui/rn-app'
import { fetchApi, uploadFileMultipart } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { FeedbackSubmitPayload } from '@ihui/rn-app'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 问题截图最多张数(对齐 Uniapp fankui「最多9张」) */
const MAX_IMAGES = 9

export function FeedbackScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const handleSubmit = async (payload: FeedbackSubmitPayload): Promise<boolean> => {
    try {
      const body: Record<string, string | undefined> = {
        type: payload.type,
        content: payload.content,
        contact: payload.contact,
        // 对齐原 submitData.filePath = filePaths.join(',');后端加 file_path 字段后持久化
        filePath:
          payload.images && payload.images.length > 0 ? payload.images.join(',') : undefined,
      }
      const res = await fetchApi('/feedbacks', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return res.success
    } catch {
      return false
    }
  }

  /** 选图并上传(对齐 Uniapp fankui uploadImage:chooseImage → request 上传 → push filePaths) */
  const handlePickImages = async (): Promise<string[]> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return []
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES,
      quality: 0.8,
    })
    if (result.canceled) return []
    const urls: string[] = []
    for (const asset of result.assets) {
      try {
        const up = await uploadFileMultipart({
          uri: asset.uri,
          type: asset.mimeType ?? 'image/jpeg',
          name: asset.fileName ?? `feedback-${Date.now()}.jpg`,
        })
        if (up.success && up.data?.path) urls.push(up.data.path)
      } catch {
        // 单张上传失败跳过,不阻塞其余
      }
    }
    return urls
  }

  return (
    <SharedFeedbackScreen
      t={t}
      onSubmit={handleSubmit}
      onBack={() => navigation.goBack()}
      onPickImages={handlePickImages}
      colorScheme={resolvedTheme}
    />
  )
}
