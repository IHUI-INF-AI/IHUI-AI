// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback } from 'react'
import { Linking } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import {
  pdfServiceResultUrl,
  processPdfMerge,
  processPdfSplit,
  processPdfWatermark,
  uploadFileBase64,
} from '@ihui/api-client'
import { PdfToolsHubScreen as SharedPdfToolsHubScreen } from '@ihui/rn-app'
import type { PdfPickedFile, PdfProcessOutcome, PdfProcessPayload, PdfToolTab } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { appAlert } from '../components/BottomPops'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PDF_MIME = 'application/pdf'
/** 与 PdfToolsScreen(convert-markdown)同档:/files/upload/base64 服务端上限 10MB。 */
const MAX_SIZE = 10 * 1024 * 1024

/**
 * RN 端「PDF 工具台」薄壳 —— 承载 web /tools/pdf/{merge,split,watermark} 三路由
 * (一屏三入口,参照 Wave1 legal hub 先例)。渲染全部委托共享屏
 * `packages/app/src/features/tools/pdf/PdfToolsHubScreen.tsx`,本文件只管平台侧链路:
 * DocumentPicker 选 PDF → base64 读取 → POST /files/upload/base64 拿 fileId →
 * POST /api/pdf-service/{merge,split,watermark}(JSON 契约,见 api-client pdf-service.ts)→
 * Linking 打开 GET /api/pdf-service/result/:taskId 下载。
 *
 * 与 web 同口径:web 的 useProcessApi 发 FormData(files) 与后端 JSON fileIds/fileId 契约
 * 不匹配,提交恒失败落 NotAvailableAlert;RN 侧走真链路,失败(含 every/bookmarks 拆分
 * 这类后端未实现分支)仍回 ok=false,由共享屏落同一条「功能开发中」提示。
 */
export function PdfToolsHubScreen() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const params = route.params as { tab?: PdfToolTab } | undefined

  const onPickFiles = useCallback(
    async (opts: { multiple: boolean }): Promise<PdfPickedFile[]> => {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [PDF_MIME],
        multiple: opts.multiple,
        copyToCacheDirectory: true,
      })
      if (picked.canceled || picked.assets.length === 0) return []
      const out: PdfPickedFile[] = []
      for (const asset of picked.assets) {
        if (asset.size !== undefined && asset.size > MAX_SIZE) {
          appAlert(t('pdfToolsPage.tooLarge'))
          continue
        }
        try {
          // next-gen FS API:File.base64() 返回 Promise<string>(与 PdfToolsScreen 同法)
          const file = new FileSystem.File(asset.uri)
          const base64 = await file.base64()
          const upload = await uploadFileBase64({
            base64,
            filename: asset.name,
            mime: PDF_MIME,
          })
          if (!upload.success || !upload.data?.file?.id) {
            appAlert(t('pdfToolsPage.uploadFailed'))
            continue
          }
          out.push({ id: upload.data.file.id, name: asset.name, size: asset.size ?? 0 })
        } catch {
          appAlert(t('pdfToolsPage.pickFailed'))
        }
      }
      return out
    },
    [t],
  )

  const onProcess = useCallback(
    async (tab: PdfToolTab, payload: PdfProcessPayload): Promise<PdfProcessOutcome> => {
      try {
        const res =
          tab === 'merge'
            ? await processPdfMerge({ fileIds: payload.fileIds ?? [] })
            : tab === 'split'
              ? await processPdfSplit({
                  fileId: payload.fileId ?? '',
                  ranges: payload.ranges ?? '',
                })
              : await processPdfWatermark({
                  fileId: payload.fileId ?? '',
                  text: payload.text,
                  fontSize: payload.fontSize,
                  opacity: payload.opacity,
                  rotation: payload.rotation,
                })
        if (!res.success || !res.data?.taskId) return { ok: false }
        return { ok: true, taskId: res.data.taskId }
      } catch {
        return { ok: false }
      }
    },
    [],
  )

  const onDownload = useCallback(
    (taskId: string) => {
      void Linking.openURL(pdfServiceResultUrl(taskId)).catch(() =>
        appAlert(t('pdfToolsPage.downloadFailed')),
      )
    },
    [t],
  )

  return (
    <SharedPdfToolsHubScreen
      t={t}
      colorScheme={resolvedTheme}
      initialTab={params?.tab ?? 'merge'}
      onBack={() => navigation.goBack()}
      onPickFiles={onPickFiles}
      onProcess={onProcess}
      onDownload={onDownload}
    />
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
