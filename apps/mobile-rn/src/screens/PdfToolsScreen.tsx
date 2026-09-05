// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState } from 'react'
import { Alert, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { convertFileToMarkdown, uploadFileBase64 } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 服务端白名单内、convert-markdown 可转换的类型(pdf/docx/xlsx/pptx/txt/csv) */
const MIME_BY_EXT: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  txt: 'text/plain',
  csv: 'text/csv',
}

const MAX_SIZE = 10 * 1024 * 1024

function extOf(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ''
}

/**
 * PDF/文档转 Markdown(M3 补齐:web 文件转换能力的移动端原生入口)。
 * 流程:系统文档选择器 → base64 读取 → POST /files/upload/base64(白名单+10MB)
 * → POST /files/:id/convert-markdown → 结果可分享/复制。
 */
export function PdfToolsScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [fileName, setFileName] = useState('')
  const [converting, setConverting] = useState(false)
  const [markdown, setMarkdown] = useState('')
  const [outName, setOutName] = useState('')

  const dark = resolvedTheme === 'dark'

  const onPick = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: Object.values(MIME_BY_EXT),
      copyToCacheDirectory: true,
    })
    if (picked.canceled || picked.assets.length === 0) return
    const asset = picked.assets[0]
    if (!asset) return
    const ext = extOf(asset.name)
    const mime = MIME_BY_EXT[ext]
    if (!mime) {
      Alert.alert(t('pdfTools.unsupportedType'))
      return
    }
    if (asset.size !== undefined && asset.size > MAX_SIZE) {
      Alert.alert(t('pdfTools.tooLarge'))
      return
    }

    setFileName(asset.name)
    setMarkdown('')
    setConverting(true)
    try {
      // next-gen FS API:File.base64() 返回 Promise<string>
      const file = new FileSystem.File(asset.uri)
      const base64 = await file.base64()

      const upload = await uploadFileBase64({ base64, filename: asset.name, mime })
      if (!upload.success || !upload.data?.file?.id) {
        throw new Error(upload.error || t('pdfTools.uploadFailed'))
      }

      const converted = await convertFileToMarkdown(upload.data.file.id)
      if (!converted.success || !converted.data) {
        throw new Error(converted.error || t('pdfTools.convertFailed'))
      }
      setMarkdown(converted.data.markdown)
      setOutName(converted.data.fileName)
    } catch (e) {
      Alert.alert(e instanceof Error ? e.message : t('pdfTools.convertFailed'))
    } finally {
      setConverting(false)
    }
  }

  const onShare = () => {
    if (markdown) void Share.share({ message: markdown })
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
        <Text className="text-base font-medium">{t('pdfTools.title')}</Text>
        <View className="w-8" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Text className="text-xs text-gray-500 dark:text-neutral-400">
          {t('pdfTools.hint')}
        </Text>

        <TouchableOpacity
          onPress={() => void onPick()}
          disabled={converting}
          className={`mt-3 items-center rounded-md py-3 ${converting ? 'bg-blue-400' : 'bg-blue-600'}`}
        >
          <Text className="text-sm font-medium text-white">
            {converting ? t('pdfTools.converting') : t('pdfTools.pick')}
          </Text>
        </TouchableOpacity>

        {fileName ? (
          <Text className="mt-2 text-center text-xs text-gray-400" numberOfLines={1}>
            {fileName}
          </Text>
        ) : null}

        {markdown ? (
          <View className="mt-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-medium text-gray-500 dark:text-neutral-400" numberOfLines={1}>
                {outName}
              </Text>
              <TouchableOpacity onPress={onShare} hitSlop={{ top: 6, bottom: 6 }}>
                <Text className="text-xs text-blue-600 dark:text-blue-400">
                  {t('pdfTools.share')}
                </Text>
              </TouchableOpacity>
            </View>
            <View className="mt-2 rounded-md bg-gray-50 p-3 dark:bg-neutral-800">
              <Text selectable className="text-xs leading-4 text-gray-700 dark:text-neutral-200">
                {markdown}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
