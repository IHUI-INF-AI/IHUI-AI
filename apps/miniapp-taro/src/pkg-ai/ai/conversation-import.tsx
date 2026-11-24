// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 外部会话导入(D28)—— 小程序端薄壳(2026-11-05)
 *
 * 形制 = 直载共享屏 + 注入本端事实,与 ai-chat-detail、ai-assistant 同一条路线:
 * 界面/步骤流/结果区/「用场景分析」弹层的真相源在
 * `packages/app/src/features/conversation-import/ConversationImportScreen.tsx`
 * (RN 端 `apps/mobile-rn/src/screens/ConversationImportScreen.tsx:370` 消费同一份),
 * 本页只出本端事实 —— 取词、主题档,以及 Taro 平台能力(chooseMessageFile / uploadFile)。
 *
 * 平台事实(别按桌面端直觉改回去):
 *   ① 文件选择走 `Taro.chooseMessageFile` —— 微信原生「从会话中选择文件」;
 *   ② `/parse` 走 `Taro.uploadFile` 而不是 api-client 的 parseConversationImport
 *      (后者签名是 Web File + FormData,本端 transport 对 body 做 JSON.parse,FormData 直接抛);
 *   ③ `/commit` 与 `/history` 是纯 JSON,仍走 api-client 唯一出口。
 */
import { useCallback, useRef } from 'react'
import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { commitConversationImport, getConversationImportHistory } from '@ihui/api-client'
import { ConversationImportScreen as SharedConversationImportScreen } from '@ihui/rn-app/features/conversation-import/ConversationImportScreen'
import type {
  ConversationImportHistoryRow,
  ConversationImportScreenProps,
  ImportCommitResult,
  ImportParseResult,
  PickedImportFile as SharedPickedImportFile,
} from '@ihui/rn-app/features/conversation-import/ConversationImportScreen'
import { useTt } from '@/i18n'
import NavBar from '@/components/NavBar'
import { useTheme } from '@/rn-compat/theme'
import {
  IMPORT_SOURCES,
  MAX_IMPORT_FILE_SIZE,
  hasAllowedExtension,
  normalizeParseResult,
  runImportCommit,
  summarizeFailureReasons,
  toDateLabel,
  toHistoryStatus,
  toImportSource,
} from './conversation-import-core'
import { pickImportFile, uploadAndParse } from './conversation-import-transport'
import type { ConversationImportCommitResult, ParsedImportConversation } from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'

export default function ConversationImportPage() {
  const tt = useTt()
  const { resolvedTheme } = useTheme()

  /**
   * 解析结果正文只留在 ref 里:预览行只是元信息,提交时按 id 取回。
   * 与 RN 的 parsedRef 同一分工(共享屏不持有正文)。
   */
  const conversationsRef = useRef<ParsedImportConversation[]>([])
  /** 本次选中的文件名:commit 的 fileName 由它来,共享屏只管 id 列表 */
  const pickedRef = useRef<{ name: string } | null>(null)

  /** 共享屏 t:签名是 (key, params),本端 useTt 是 (key, fallback, params) */
  const tScreen = useCallback<ConversationImportScreenProps['t']>(
    (key, params) => tt(key, key, params),
    [tt],
  )

  const sources = IMPORT_SOURCES.map((s) => ({
    value: s.value,
    label: tt(s.labelKey, s.value),
    hint: tt(s.hintKey, ''),
  }))

  /** 历史:api-client 唯一出口;失败抛原文,由共享屏在历史卡里点名 */
  const loadHistory = useCallback(async (): Promise<ConversationImportHistoryRow[]> => {
    const res = await getConversationImportHistory()
    if (!res.success) throw new Error(res.error || `HTTP ${res.status ?? '?'}`)
    const list = Array.isArray(res.data.list) ? res.data.list : []
    return list.map((item) => {
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
        statusLabel: statusKey ? tt(statusKey, item.status) : item.status,
        parsedCount: item.parsedCount,
        importedCount: item.importedCount,
        importedAt: toDateLabel(item.importedAt),
      }
    })
  }, [tt])

  /**
   * 选文件:微信原生选择器 + 本端预校验(后缀白名单 / 20MiB 上限)。
   * 取消 ⇒ null(共享屏静默);预校验失败抛本地化原文(由共享屏接进错误条)。
   */
  const onPickFile = useCallback(
    async (sourceValue: string): Promise<SharedPickedImportFile | null> => {
      const spec = IMPORT_SOURCES.find((s) => s.value === sourceValue)
      const picked = await pickImportFile({
        extensions: spec?.extensions ?? [],
        choose: () =>
          Taro.chooseMessageFile({
            count: 1,
            type: 'file',
            extension: [...(spec?.extensions ?? [])],
          }) as unknown as Promise<unknown>,
      })
      if (picked.error === 'no-file') {
        throw new Error(
          tt('conversationImport.errorNoFile', '未选择到文件,请重新选择该来源的导出文件'),
        )
      }
      if (picked.error) throw new Error(picked.error)
      const f = picked.file
      if (!f) return null // 用户取消:什么都不改
      const src = spec?.value
      if (!src || !hasAllowedExtension(f.name, src)) {
        throw new Error(
          tt('conversationImport.errorFileType', '所选文件类型不支持,请选择该来源的导出文件'),
        )
      }
      if (f.size > MAX_IMPORT_FILE_SIZE) {
        throw new Error(tt('conversationImport.fileTooLarge', '文件超过 20MB 限制,请拆分后重试'))
      }
      pickedRef.current = { name: f.name }
      return { name: f.name, uri: f.path, mimeType: '', size: f.size }
    },
    [tt],
  )

  /** 解析:/parse 走 Taro.uploadFile;正文留在 ref,预览行交给共享屏 */
  const onParse = useCallback(
    async (file: SharedPickedImportFile, sourceValue: string): Promise<ImportParseResult> => {
      const src = toImportSource(sourceValue)
      if (!src) {
        return { ok: false, error: tt('conversationImport.errorNoSource', '请先选择会话来源') }
      }
      try {
        const raw = await uploadAndParse({
          file: { path: file.uri, name: file.name, size: file.size ?? 0 },
          source: src,
          networkErrorText: tt('common.failed', '加载失败'),
        })
        const parsed = normalizeParseResult(raw)
        conversationsRef.current = parsed.conversations
        pickedRef.current = { name: file.name }
        return {
          ok: true,
          rows: parsed.rows,
          truncated: parsed.truncated,
          warnings: parsed.warnings,
        }
      } catch (e) {
        conversationsRef.current = []
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    },
    [tt],
  )

  /**
   * 逐会话串行提交:共享屏只把选中的 id 交过来,编排与失败原因仍由本端 core 判序。
   * 有失败时把文案挂在结果对象上(errorMessage),让共享屏同时显示结果区与红字。
   */
  const onCommit = useCallback(
    async (
      sourceValue: string,
      rowIds: readonly number[],
      reportProgress: (progress: { done: number; total: number }) => void,
    ): Promise<ImportCommitResult | string> => {
      const src = toImportSource(sourceValue)
      if (!src) return tt('conversationImport.errorNoSource', '请先选择会话来源')
      const outcome = await runImportCommit({
        source: src,
        fileName: pickedRef.current?.name,
        conversations: conversationsRef.current,
        rowIds,
        commit: (payload) =>
          commitConversationImport(payload) as Promise<ApiResult<ConversationImportCommitResult>>,
        emptyContentReason: tt('conversationImport.noValidContent', '无可导入的有效内容'),
        onProgress: reportProgress,
      })
      if (outcome.failed > 0) {
        // 失败必须响:点名成功/失败条数 + 去重后的原因,不让用户只看到一个数字
        const reasons = summarizeFailureReasons(outcome.failureReasons)
        return {
          imported: outcome.imported,
          failed: outcome.failed,
          committed: outcome.committed,
          errorMessage: tt('conversationImport.commitFailed', '导入失败:{error}', {
            error: `${tt(
              'conversationImport.commitDone',
              '导入完成:成功 {imported},失败 {failed}',
              { imported: outcome.imported, failed: outcome.failed },
            )} ${reasons.join('; ')}`,
          }),
        }
      }
      // 导入完成后刷新历史列表(不刷新 = 用户看不到自己刚导的记录)
      await loadHistory()
      return {
        imported: outcome.imported,
        failed: outcome.failed,
        committed: outcome.committed,
      }
    },
    [tt, loadHistory],
  )

  /** 「打开会话」:既有唯一出口(url 传 sessionId,见 chat.tsx 的 routeSessionId) */
  const onOpenConversation = useCallback((conversationId: string) => {
    Taro.navigateTo({ url: `/pkg-ai/ai/chat?sessionId=${encodeURIComponent(conversationId)}` })
  }, [])

  /**
   * 「用场景分析」:跳聊天页带 prompt,由聊天页在回放该会话落定后作为下一条用户消息发出
   * (不新造 LLM 调用链)。prompt 走 url query —— 小程序页面间只有这一条既有数据通道。
   */
  const onAnalyze = useCallback(
    (params: { conversationId: string; source: unknown; prompt: string }) => {
      Taro.navigateTo({
        url:
          `/pkg-ai/ai/chat?sessionId=${encodeURIComponent(params.conversationId)}` +
          `&prompt=${encodeURIComponent(params.prompt)}`,
      })
    },
    [],
  )

  return (
    <View className="flex flex-col h-screen bg-background">
      <NavBar
        title={tt('conversationImport.pageTitle', '外部会话导入')}
        showBack
        onBack={() => Taro.navigateBack()}
      />
      <SharedConversationImportScreen
        t={tScreen}
        colorScheme={resolvedTheme}
        sources={sources}
        onPickFile={onPickFile}
        onParse={onParse}
        onCommit={onCommit}
        onLoadHistory={loadHistory}
        onOpenConversation={onOpenConversation}
        onAnalyze={onAnalyze}
      />
    </View>
  )
}
// PLACEHOLDER-TAIL
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
