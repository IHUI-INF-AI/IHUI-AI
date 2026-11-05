// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/conversation-import/ConversationImportScreen.tsx

/**
 * 外部会话导入(D28)—— 小程序端页面(共享屏薄壳)。
 *
 * UI 单源:packages/app/src/features/conversation-import/ConversationImportScreen.tsx
 *   RN 消费点:apps/mobile-rn/src/screens/ConversationImportScreen.tsx:20
 * 端内只留平台注入:微信会话选文件(chooseMessageFile)、/parse 的 uploadFile、
 * commit / history 的 api-client 出口、聊天页导航。共享屏内零 Taro、零平台 API。
 *
 * 交互变化(向 RN/web 对齐,如实披露):选文件 + 解析由旧页的两步合成一步;
 * 后缀/20MB 预校验移到 onParse,失败仍落在共享屏错误条(比旧 toast 更持久)。
 *
 * 分层:判序在 conversation-import-core、平台传输在 conversation-import-transport;
 * 本文件只做「取词 + 平台注入 + 导航」。
 */
import { useCallback, useMemo, useRef } from 'react'
import Taro from '@tarojs/taro'
import {
  commitConversationImport,
  getConversationImportHistory,
  type ConversationImportCommitResult,
  type ParsedImportConversation,
} from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'
import type { ImportSource } from '@ihui/shared/import-analysis'
import { useI18n } from '@/i18n'
import ThemeRoot from '@/components/ThemeRoot'
import NavBar from '@/components/NavBar'
import {
  ConversationImportScreen,
  type ConversationImportHistoryRow,
} from '@ihui/rn-app/features/conversation-import/ConversationImportScreen'
import type {
  ImportCommitResult,
  ImportParseResult,
  PickedImportFile as SharedPickedImportFile,
} from '@ihui/rn-app/features/conversation-import/ConversationImportScreen'
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

export default function ConversationImportPage() {
  const { t } = useI18n()
  // 解析结果正文只留端内内存:预览行只是元信息,提交时按 id 取回
  const parsedRef = useRef<{
    conversations: ParsedImportConversation[]
    fileName?: string
  }>({ conversations: [] })

  const sources = useMemo(
    () =>
      IMPORT_SOURCES.map((s) => ({
        value: s.value,
        label: t(s.labelKey),
        hint: t(s.hintKey),
      })),
    [t],
  )

  /** 选文件:微信原生「从会话中选择文件」;取消给明确反馈,不静默吞掉 */
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
        Taro.showToast({ title: t('conversationImport.errorNoFile'), icon: 'none' })
        return null
      }
      if (picked.error) {
        Taro.showToast({ title: `${t('common.failed')}(${picked.error})`, icon: 'none' })
        return null
      }
      const f = picked.file
      if (!f) {
        // 用户取消不是错误,但必须给一次明确反馈
        Taro.showToast({ title: t('common.cancel'), icon: 'none' })
        return null
      }
      return { name: f.name, uri: f.path, mimeType: 'text/plain', size: f.size }
    },
    [t],
  )

  /** 上传并解析:后缀/体积预校验在此收口,失败由共享屏错误条常驻展示 */
  const onParse = useCallback(
    async (file: SharedPickedImportFile, sourceValue: string): Promise<ImportParseResult> => {
      const source = toImportSource(sourceValue)
      if (!source) return { ok: false, error: t('conversationImport.errorNoSource') }
      if (!hasAllowedExtension(file.name, source)) {
        return { ok: false, error: t('conversationImport.errorFileType') }
      }
      if (file.size !== undefined && file.size > MAX_IMPORT_FILE_SIZE) {
        return { ok: false, error: t('conversationImport.fileTooLarge') }
      }
      const raw = await uploadAndParse({
        file: { path: file.uri, name: file.name, size: file.size ?? 0 },
        source,
        // 沿用端内既有 common.failed 档(不另造 networkError 键)
        networkErrorText: t('common.failed'),
      })
      const parsed = normalizeParseResult(raw)
      parsedRef.current = { conversations: parsed.conversations, fileName: file.name }
      return {
        ok: true,
        rows: parsed.rows,
        truncated: parsed.truncated,
        warnings: parsed.warnings,
      }
    },
    [t],
  )

  /** 逐会话串行提交:部分失败时结果区照常回带,同时把去重原因交给错误条 */
  const onCommit = useCallback(
    async (
      sourceValue: string,
      rowIds: readonly number[],
      reportProgress: (progress: { done: number; total: number }) => void,
    ): Promise<ImportCommitResult | string> => {
      const source = toImportSource(sourceValue)
      if (!source) return t('conversationImport.errorNoSource')
      const outcome = await runImportCommit({
        source,
        fileName: parsedRef.current.fileName,
        conversations: parsedRef.current.conversations,
        rowIds,
        commit: (payload) =>
          commitConversationImport(payload) as Promise<ApiResult<ConversationImportCommitResult>>,
        emptyContentReason: t('conversationImport.noValidContent'),
        onProgress: reportProgress,
      })
      const result: ImportCommitResult = {
        imported: outcome.imported,
        failed: outcome.failed,
        // 判序层用的是后端枚举全集,共享屏载荷只吃 ImportSource;与 RN 同口径显式收窄
        committed: outcome.committed.map((c) => ({
          conversationId: c.conversationId,
          title: c.title,
          messageCount: c.messageCount,
          source: c.source as ImportSource,
        })),
      }
      if (outcome.failed > 0) {
        // 失败必须响:点名成功/失败条数 + 去重后的原因,不只报一个数字
        const reasons = summarizeFailureReasons(outcome.failureReasons)
        return {
          ...result,
          error: t('conversationImport.commitFailed', {
            error: `${t('conversationImport.commitDone', {
              imported: outcome.imported,
              failed: outcome.failed,
            })} ${reasons.join('; ')}`,
          }),
        }
      }
      return result
    },
    [t],
  )

  /** 导入历史:失败原文经 thrown Error 交给共享屏历史卡(不假装"从没导过") */
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
        failedCount: item.failedCount,
        errorMessage: item.errorMessage ?? undefined,
      }
    })
  }, [t])

  /** 「打开会话」:既有唯一出口(chat 页 routeSessionId),不新造深链 */
  const onOpenConversation = useCallback((conversationId: string) => {
    Taro.navigateTo({ url: `/pkg-ai/ai/chat?sessionId=${encodeURIComponent(conversationId)}` })
  }, [])

  /** 「用场景分析」:prompt 走 url query,由聊天页在回放落定后作为下一条用户消息发出 */
  const onAnalyze = useCallback((params: { conversationId: string; prompt: string }) => {
    Taro.navigateTo({
      url:
        `/pkg-ai/ai/chat?sessionId=${encodeURIComponent(params.conversationId)}` +
        `&prompt=${encodeURIComponent(params.prompt)}`,
    })
  }, [])

  return (
    <ThemeRoot className="flex flex-col h-screen bg-background">
      <NavBar
        title={t('conversationImport.pageTitle')}
        showBack
        onBack={() => Taro.navigateBack()}
      />
      <ConversationImportScreen
        t={t}
        sources={sources}
        onPickFile={onPickFile}
        onParse={onParse}
        onCommit={onCommit}
        onLoadHistory={onLoadHistory}
        onOpenConversation={onOpenConversation}
        onAnalyze={onAnalyze}
      />
    </ThemeRoot>
  )
}

// PLACEHOLDER-TAIL
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
