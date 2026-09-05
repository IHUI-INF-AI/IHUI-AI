// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState } from 'react'
import { Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as FileSystem from 'expo-file-system'
import * as MediaLibrary from 'expo-media-library'
import { fetchApi, resolveFileUrl } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** POST /api/image-gen/generate 响应(对齐 web /image-gen GenResult) */
interface GenResult {
  imageUrl: string
  revisedPrompt?: string
}

const SIZES: ReadonlyArray<{ value: string; labelKey: string }> = [
  { value: '1024x1024', labelKey: 'imageGen.sizeSquare' },
  { value: '1024x1792', labelKey: 'imageGen.sizePortrait' },
  { value: '1792x1024', labelKey: 'imageGen.sizeLandscape' },
]

/**
 * 文生图生成(M3 补齐:web /image-gen 生成页的移动端原生入口)。
 * 数据源:POST /api/image-gen/generate;保存走 FileSystem 下载 + MediaLibrary 入库。
 */
export function ImageGenCreateScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState('1024x1024')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<GenResult | null>(null)
  const [saving, setSaving] = useState(false)

  const dark = resolvedTheme === 'dark'

  const onGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert(t('imageGen.promptRequired'))
      return
    }
    setGenerating(true)
    setResult(null)
    try {
      const res = await fetchApi<GenResult>('/api/image-gen/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt: prompt.trim(), size }),
      })
      if (!res.success || !res.data?.imageUrl) throw new Error(res.error)
      setResult(res.data)
    } catch {
      Alert.alert(t('imageGen.genFailed'))
    } finally {
      setGenerating(false)
    }
  }

  const onSave = async () => {
    if (!result?.imageUrl) return
    setSaving(true)
    try {
      const perm = await MediaLibrary.requestPermissionsAsync()
      if (!perm.granted) {
        Alert.alert(t('imageGen.needPermission'))
        return
      }
      const filename = `imagegen_${Date.now()}.png`
      const destFile = new FileSystem.File(FileSystem.Paths.cache, filename)
      const downloaded = await FileSystem.File.downloadFileAsync(resolveFileUrl(result.imageUrl), destFile, {
        idempotent: true,
      })
      await MediaLibrary.saveToLibraryAsync(downloaded.uri)
      Alert.alert(t('imageGen.saveSuccess'))
    } catch {
      Alert.alert(t('imageGen.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className={`flex-1 ${dark ? 'bg-neutral-900' : 'bg-white'}`}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-sm text-gray-500">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-base font-medium">{t('imageGen.createTitle')}</Text>
        <View className="w-8" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder={t('imageGen.promptPlaceholder')}
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          className="min-h-[96px] rounded-md border border-gray-200 p-3 text-sm dark:border-neutral-700 dark:text-neutral-100"
        />

        {/* 尺寸 chips */}
        <View className="mt-3 flex-row gap-2">
          {SIZES.map((item) => {
            const active = size === item.value
            return (
              <TouchableOpacity
                key={item.value}
                onPress={() => setSize(item.value)}
                className={`rounded-md px-3 py-1.5 ${active ? 'bg-blue-600' : 'bg-gray-100 dark:bg-neutral-800'}`}
              >
                <Text className={`text-xs ${active ? 'text-white' : 'text-gray-600 dark:text-neutral-300'}`}>
                  {t(item.labelKey)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity
          onPress={() => void onGenerate()}
          disabled={generating}
          className={`mt-4 items-center rounded-md py-3 ${generating ? 'bg-blue-400' : 'bg-blue-600'}`}
        >
          <Text className="text-sm font-medium text-white">
            {generating ? t('imageGen.generating') : t('imageGen.generate')}
          </Text>
        </TouchableOpacity>

        {result?.imageUrl ? (
          <View className="mt-4">
            <Image
              source={{ uri: resolveFileUrl(result.imageUrl) }}
              style={{ width: '100%', aspectRatio: 1, borderRadius: 8 }}
              resizeMode="cover"
            />
            {result.revisedPrompt ? (
              <Text className="mt-2 text-xs text-gray-400" numberOfLines={2}>
                {result.revisedPrompt}
              </Text>
            ) : null}
            <TouchableOpacity
              onPress={() => void onSave()}
              disabled={saving}
              className="mt-3 items-center rounded-md border border-gray-200 py-2.5 dark:border-neutral-600"
            >
              <Text className="text-sm text-gray-600 dark:text-neutral-300">
                {saving ? t('common.loading') : t('imageGen.saveToAlbum')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
