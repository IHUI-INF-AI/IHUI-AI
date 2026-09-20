// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 expo-document-picker + RN FormData 文件对象({uri,type,name}),不适合共享
import { useCallback, useRef } from 'react'
import { View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  commitConversationImport,
  fetchApi,
  getConversationImportHistory,
  type ConversationImportCommitPayload,
  type ConversationImportParseResult,
  type ConversationImportSource,
  type ParsedImportConversation,
} from '@ihui/api-client'
import { ConversationImportScreen as SharedConversationImportScreen } from '@ihui/rn-app'
import type {
  ConversationImportHistoryRow,
  ConversationImportHistoryStatus,
  ConversationImportSourceOption,
  ImportCommitResult,
  ImportParseResult,
  ImportPreviewRow,
  PickedImportFile,
} from '@ihui/rn-app'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ConversationImport'>

/** 客户端预校验上限:与 web 端 / ai-service 解析上限一致 20MB */
const MAX_IMPORT_FILE_SIZE = 20 * 1024 * 1024
/** 解析为同步阻塞调用(ai-service 逐行读导出文件),放宽 fetchApi 默认 30s 超时 */
const PARSE_TIMEOUT_MS = 120_000

/** 来源卡片:label/hint 走 i18n,value 为后端枚举字面量 */
const IMPORT_SOURCES: ReadonlyArray<{
  value: ConversationImportSource
  labelKey: string
  hintKey: string
}> = [
  { value: 'claude_code', labelKey: 'conversationImport.sourceClaudeCode', hintKey: 'conversationImport.sourceClaudeCodeHint' },
  { value: 'codex', labelKey: 'conversationImport.sourceCodex', hintKey: 'conversationImport.sourceCodexHint' },
  { value: 'cursor', labelKey: 'conversationImport.sourceCursor', hintKey: 'conversationImport.sourceCursorHint' },
  { value: 'aider', labelKey: 'conversationImport.sourceAider', hintKey: 'conversationImport.sourceAiderHint' },
]

/** 字符串 → 后端来源枚举(穷举收窄,无 cast / 无 any) */
function toImportSource(value: string): ConversationImportSource | undefined {
  switch (value) {
    case 'claude_code':
    case 'codex':
    case 'cursor':
    case 'aider':
      return value
    default:
      return undefined
  }
}

/** 后端批次状态 → 共享层状态联合(未知状态保留 unknown,由端侧原文展示) */
function toHistoryStatus(status: string): ConversationImportHistoryStatus {
  switch (status) {
    case 'success':
    case 'partial':
    case 'failed':
      return status
    default:
      return 'unknown'
  }
}

/** ISO 时间 → YYYY-MM-DD(不可解析时退化为原串前 10 位,避免抛 Invalid Date) */
function toDateLabel(value?: string | null): string {
  if (!value) return ''
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : parsed.toISOString().slice(0, 10)
}

/**
 * RN 端「外部会话导入」wrapper — 渲染共享 @ihui/rn-app 会话导入屏,
 * 注入平台能力:expo-document-picker 选文件 → fetchApi 拼 RN FormData multipart 解析
 * → commitConversationImport 逐会话串行落库 → getConversationImportHistory 历史。
 *
 * 为什么 parse 不复用 api-client 的 parseConversationImport:该封装签名是 Web `File`,
 * RN/Hermes 无 File 构造能力;此处按 AGENTS.md §3 走 api-client 已导出的底层 fetchApi,
 * 并复用仓库既有 RN multipart 形态(参见 api-client files.ts 的 uploadFileMultipart)。
 */
export function ConversationImportScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  /** 解析结果正文只留内存:预览行仅元信息,提交时按 id 取回 */
  const parsedRef = useRef<Map<number, ParsedImportConversation>>(new Map())
  const pickedRef = useRef<PickedImportFile | null>(null)

  const sources: ConversationImportSourceOption[] = IMPORT_SOURCES.map((s) => ({
    value: s.value,
    label: t(s.labelKey),
    hint: t(s.hintKey),
  }))

  const onPickFile = useCallback(async (): Promise<PickedImportFile | null> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    })
    if (result.canceled || result.assets.length === 0) return null
    const asset = result.assets[0]
    if (!asset) return null
    return {
      name: asset.name ?? 'conversation-export',
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      size: asset.size,
    }
  }, [])

  const onParse = useCallback(
    async (picked: PickedImportFile, sourceValue: string): Promise<ImportParseResult> => {
      const source = toImportSource(sourceValue)
      if (!source) return { ok: false, error: t('conversationImport.errorNoSource') }
      if (picked.size !== undefined && picked.size > MAX_IMPORT_FILE_SIZE) {
        return { ok: false, error: t('conversationImport.fileTooLarge') }
      }

      const formData = new FormData()
      formData.append('source', source)
      // RN FormData 的文件部分为 { uri, type, name } 对象(既有 RN 上传链路同形态);
      // 标准库 append 签名不含该形态,用 as never 绕过(平台特性,非 any 兜底)。
      formData.append('file', { uri: picked.uri, type: picked.mimeType, name: picked.name } as never)

      const res = await fetchApi<ConversationImportParseResult>(
        '/api/user/conversation-import/parse',
        { method: 'POST', body: formData, timeoutMs: PARSE_TIMEOUT_MS },
      )
      if (!res.success) return { ok: false, error: res.error }

      const rows: ImportPreviewRow[] = []
      const parsed = new Map<number, ParsedImportConversation>()
      res.data.conversations.forEach((conv, index) => {
        rows.push({
          id: index,
          title: conv.title?.trim() ?? '',
          messageCount: conv.messages.length,
          model: conv.model?.trim() ?? '',
          createdAt: toDateLabel(conv.sourceCreatedAt ?? conv.sourceUpdatedAt),
        })
        parsed.set(index, conv)
      })
      parsedRef.current = parsed
      pickedRef.current = picked
      return {
        ok: true,
        rows,
        truncated: res.data.truncated,
        warnings: res.data.warnings,
      }
    },
    [t],
  )

  /** 串行提交:单会话失败只计数,不中断其余导入 */
  const onCommit = useCallback(
    async (
      sourceValue: string,
      rowIds: readonly number[],
      reportProgress: (progress: { done: number; total: number }) => void,
    ): Promise<ImportCommitResult | string> => {
      const source = toImportSource(sourceValue)
      if (!source) return t('conversationImport.errorNoSource')

      const total = rowIds.length
      let done = 0
      let imported = 0
      let failed = 0
      reportProgress({ done, total })

      for (const id of rowIds) {
        const conv = parsedRef.current.get(id)
        const messages = (conv?.messages ?? [])
          .filter((m) => typeof m.content === 'string' && m.content.trim().length > 0)
          .map((m) => ({ role: m.role, content: m.content, createdAt: m.createdAt }))
        // api 侧校验 messages 非空:空会话直接计失败,不发请求
        if (messages.length === 0) {
          failed += 1
          reportProgress({ done: ++done, total })
          continue
        }
        const title = conv?.title?.trim()
        const model = conv?.model?.trim()
        const payload: ConversationImportCommitPayload = {
          source,
          fileName: pickedRef.current?.name,
          title: title ? title.slice(0, 255) : undefined,
          model: model ? model.slice(0, 64) : undefined,
          createdAt: conv?.sourceCreatedAt ?? conv?.sourceUpdatedAt ?? undefined,
          messages,
        }
        const res = await commitConversationImport(payload)
        if (res.success) imported += 1
        else failed += 1
        reportProgress({ done: ++done, total })
      }
      return { imported, failed }
    },
    [t],
  )

  const onLoadHistory = useCallback(async (): Promise<ConversationImportHistoryRow[]> => {
    const res = await getConversationImportHistory()
    if (!res.success) throw new Error(res.error)
    return res.data.list.map((item) => {
      const status = toHistoryStatus(item.status)
      const statusKey =
        status === 'success'
          ? 'conversationImport.statusSuccess'
          : status === 'partial'
            ? 'conversationImport.statusPartial'
            : status === 'failed'
              ? 'conversationImport.statusFailed'
              : ''
      return {
        id: item.id,
        fileName: item.fileName ?? '',
        status,
        statusLabel: statusKey ? t(statusKey) : item.status,
        parsedCount: item.parsedCount,
        importedCount: item.importedCount,
        importedAt: toDateLabel(item.importedAt),
      }
    })
  }, [t])

  return (
    <View style={{ flex: 1 }}>
      <NavBar
        title={t('conversationImport.pageTitle')}
        onBack={() => navigation.goBack()}
      />
      <SharedConversationImportScreen
        t={t}
        colorScheme={resolvedTheme}
        sources={sources}
        onPickFile={onPickFile}
        onParse={onParse}
        onCommit={onCommit}
        onLoadHistory={onLoadHistory}
      />
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
