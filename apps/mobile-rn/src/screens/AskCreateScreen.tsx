// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { Linking } from 'react-native'
import * as ImagePicker from '@/platform/picker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTheme } from '../context/ThemeContext'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { AsyncKvPort, MediaAsset, MediaPort } from '@ihui/types'
import { createAsk } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import { AskCreateScreen as SharedAskCreateScreen } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useHostPorts } from '../host/use-host-ports'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 选图宿主实现:expo-image-picker(与 useChatInput.ts:163 同一库同一选项)。
 * 共享面只经 `MediaPort.pickImages` 调到这里,RN 端内不再出现第二套选图逻辑。
 */
async function pickFromLibrary(count: number): Promise<readonly MediaAsset[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: count > 1,
    selectionLimit: count,
    quality: 0.8,
  })
  if (result.canceled) return []
  return (result.assets ?? [])
    .filter((asset) => Boolean(asset.uri))
    .slice(0, count)
    .map((asset) => ({ uri: asset.uri }))
}

/**
 * 草稿存储宿主实现:AsyncStorage(与 ThemeContext.tsx:19 同一库)。
 * key / 结构由共享钩子决定,端内只在 get 时做 JSON 解析。
 */
function useDraftPort(): AsyncKvPort {
  return useMemo<AsyncKvPort>(
    () => ({
      get: async <T,>(key: string): Promise<T | null> => {
        const raw = await AsyncStorage.getItem(key)
        if (!raw) return null
        try {
          return JSON.parse(raw) as T
        } catch {
          return null
        }
      },
      set: async (key: string, value: unknown): Promise<void> => {
        await AsyncStorage.setItem(key, JSON.stringify(value))
      },
      remove: async (key: string): Promise<void> => {
        await AsyncStorage.removeItem(key)
      },
    }),
    [],
  )
}

function useMediaPort(): MediaPort {
  return useMemo<MediaPort>(
    () => ({
      pickImage: async () => {
        const assets = await pickFromLibrary(1)
        return assets[0] ?? null
      },
      pickImages: async (options) => pickFromLibrary(Math.max(1, options?.count ?? 1)),
      /**
       * RN 没有内置图片查看器:预览降级为交给系统打开该 URL(与 ChatDisclosure 同法)。
       * 当前共享 AskImageField 不触发预览,故这里只保证端口契约完整、不静默留空实现。
       */
      previewImage: async (urls, index = 0) => {
        const uri = urls[index]
        if (!uri) return
        await Linking.openURL(uri)
      },
    }),
    [],
  )
}

export function AskCreateScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const media = useMediaPort()
  const draft = useDraftPort()

  const onSubmit = async () => {
    if (!title.trim()) {
      setError(t('askCreate.titleRequired'))
      return
    }
    setSaving(true)
    setError('')
    const res = await createAsk({
      title: title.trim(),
      content: content.trim(),
      tags: tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    })
    setSaving(false)
    if (res.success && res.data) navigation.replace('AskDetail', { id: res.data.id })
    else if (!res.success) setError(apiFailureToText(res, t('askCreate.saveFailed')))
  }

  const { onToast } = useHostPorts()

  return (
    <SharedAskCreateScreen
      t={t}
      title={title}
      content={content}
      tags={tags}
      saving={saving}
      error={error}
      onTitleChange={setTitle}
      onContentChange={setContent}
      onTagsChange={setTags}
      onSubmit={onSubmit}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
      onToast={onToast}
      media={media}
      draft={draft}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
