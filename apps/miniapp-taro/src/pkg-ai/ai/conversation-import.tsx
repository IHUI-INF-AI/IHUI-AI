// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 外部会话导入(D28)—— 小程序端页面。
 *
 * 四步流:选来源 → 从微信会话里选导出文件 → 解析预览(会话数/消息数/warnings/truncated)
 * → 逐会话串行 commit → 刷新导入历史。
 *
 * 两个平台事实(决定了本文件的写法,别按桌面端的直觉改回去):
 *   ① 文件选择走 `Taro.chooseMessageFile` —— 微信原生「从会话中选择文件」,
 *      在微信生态里导微信聊天记录(.zip/.txt)这是最顺手的路径,端内 InputArea /
 *      ModelConfigDialog / ai-chat-detail 三处已在用同一口径。
 *   ② `/parse` 走 `Taro.uploadFile` 而**不是** api-client 的 parseConversationImport:
 *      后者签名是 Web `File` + `FormData`,而本端 transport(createTaroTransport)
 *      对 body 做 `JSON.parse`,FormData 会在传输层直接抛;小程序也没有 File 构造器。
 *      `/commit` 与 `/history` 是纯 JSON,仍走 api-client 唯一出口。
 *
 * 错误与截断一律上屏:解析失败带服务端原文、truncated 与 warnings 逐条列出、
 * commit 失败原因去重后展示 —— 不做静默吞掉(§5e「失败必须响」)。
 *
 * 分层:判序在 conversation-import-core、平台传输在 conversation-import-transport、
 * 展示块在 conversation-import-parts;本文件只做「取词 + 编排 + 持有页面状态」。
 */
import { useCallback, useState } from 'react'
import { View, Text, Button, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { commitConversationImport, getConversationImportHistory } from '@ihui/api-client'
import { useTt } from '@/i18n'
import NavBar from '@/components/NavBar'
import LineIcon from '@/components/LineIcon'
import ThemeRoot from '@/components/ThemeRoot'
import { ImportHistoryList, ImportPreviewList } from './conversation-import-parts'
import {
  IMPORT_SOURCES,
  MAX_IMPORT_FILE_SIZE,
  hasAllowedExtension,
  normalizeParseResult,
  runImportCommit,
  summarizeFailureReasons,
  toImportSource,
  type ImportPreviewRow,
} from './conversation-import-core'
import {
  pickImportFile,
  uploadAndParse,
  type PickedImportFile,
} from './conversation-import-transport'
import type {
  ConversationImportCommitResult,
  ConversationImportHistoryItem,
  ConversationImportSource,
  ParsedImportConversation,
} from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'

export default function ConversationImportPage() {
  const tt = useTt()
  const [source, setSource] = useState<ConversationImportSource | ''>('')
  const [file, setFile] = useState<PickedImportFile | null>(null)
  const [rows, setRows] = useState<ImportPreviewRow[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [truncated, setTruncated] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')
  const [history, setHistory] = useState<ConversationImportHistoryItem[]>([])
  // 解析结果正文只留在 state 里:预览行只是元信息,提交时按 id 取回
  const [conversations, setConversations] = useState<ParsedImportConversation[]>([])

  const loadHistory = useCallback(async () => {
    try {
      const res = await getConversationImportHistory()
      setHistory(res.success && Array.isArray(res.data.list) ? res.data.list : [])
    } catch {
      // 历史取不到不阻断导入主流程,但不能假装"从没导过" —— 页面会显示为空态
      setHistory([])
    }
  }, [])

  useDidShow(() => {
    void loadHistory()
  })

  /** 换文件/换来源即丢弃上一份预览,免得对着旧预览提交 */
  const resetPreview = useCallback(() => {
    setFile(null)
    setRows([])
    setConversations([])
    setSelected([])
    setTruncated(false)
    setWarnings([])
    setError('')
  }, [])

  const onPick = useCallback(async () => {
    if (!source) {
      setError(tt('conversationImport.errorNoSource', '请先选择会话来源'))
      return
    }
    const spec = IMPORT_SOURCES.find((s) => s.value === source)
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
      setError(tt('conversationImport.errorNoFile', '未选择到文件,请重新选择该来源的导出文件'))
      return
    }
    if (picked.error) {
      resetPreview()
      setError(tt('conversationImport.parseFailed', '解析失败:{error}', { error: picked.error }))
      return
    }
    const f = picked.file
    if (!f) return // 用户取消:什么都不改
    if (!hasAllowedExtension(f.name, source)) {
      resetPreview()
      setError(tt('conversationImport.errorFileType', '所选文件类型不支持,请选择该来源的导出文件'))
      return
    }
    if (f.size > MAX_IMPORT_FILE_SIZE) {
      resetPreview()
      setError(tt('conversationImport.fileTooLarge', '文件超过 20MB 限制,请拆分后重试'))
      return
    }
    setError('')
    setFile(f)
    setRows([])
    setConversations([])
    setSelected([])
    setTruncated(false)
    setWarnings([])
  }, [source, tt, resetPreview])

  const onParse = useCallback(async () => {
    const src = toImportSource(source)
    if (!src || !file) {
      setError(tt('conversationImport.errorNoFile', '未选择文件'))
      return
    }
    setParsing(true)
    setError('')
    try {
      const raw = await uploadAndParse({
        file,
        source: src,
        // 沿用端内既有 common.failed 档(不另造 networkError 键)
        networkErrorText: tt('common.failed', '加载失败'),
      })
      const parsed = normalizeParseResult(raw)
      setRows(parsed.rows)
      setConversations(parsed.conversations)
      setSelected(parsed.rows.map((r) => r.id))
      setTruncated(parsed.truncated)
      setWarnings(parsed.warnings)
      if (parsed.rows.length === 0) {
        setError(tt('conversationImport.parseEmpty', '未在文件中解析出任何会话'))
      }
    } catch (e) {
      setRows([])
      setConversations([])
      setSelected([])
      setTruncated(false)
      setWarnings([])
      setError(
        tt('conversationImport.parseFailed', '解析失败:{error}', {
          error: e instanceof Error ? e.message : String(e),
        }),
      )
    } finally {
      setParsing(false)
    }
  }, [source, file, tt])

  const onCommit = useCallback(async () => {
    const src = toImportSource(source)
    if (!src || selected.length === 0) return
    setCommitting(true)
    setError('')
    setProgress({ done: 0, total: selected.length })
    const outcome = await runImportCommit({
      source: src,
      fileName: file?.name,
      conversations,
      rowIds: selected,
      commit: (payload) =>
        commitConversationImport(payload) as Promise<ApiResult<ConversationImportCommitResult>>,
      emptyContentReason: tt('conversationImport.noValidContent', '会话内没有有效内容'),
      onProgress: setProgress,
    })
    setCommitting(false)

    if (outcome.failed > 0) {
      // 失败必须响:点名成功/失败条数 + 去重后的原因,不让用户只看到一个数字
      const reasons = summarizeFailureReasons(outcome.failureReasons)
      setError(
        tt('conversationImport.commitFailed', '导入失败:{error}', {
          error: `${tt('conversationImport.commitDone', '导入完成:成功 {imported},失败 {failed}', {
            imported: outcome.imported,
            failed: outcome.failed,
          })} ${reasons.join('; ')}`,
        }),
      )
    } else {
      Taro.showToast({
        title: tt('conversationImport.commitDone', '导入完成:成功 {imported},失败 {failed}', {
          imported: outcome.imported,
          failed: outcome.failed,
        }),
        icon: 'none',
      })
    }
    resetPreview()
    await loadHistory()
  }, [source, selected, file, conversations, tt, loadHistory, resetPreview])

  const toggle = useCallback((id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.length === rows.length ? [] : rows.map((r) => r.id)))
  }, [rows])

  return (
    <View className="flex flex-col h-screen bg-background">
      <NavBar
        title={tt('conversationImport.pageTitle', '外部会话导入')}
        showBack
        onBack={() => Taro.navigateBack()}
      />

      <ScrollView className="flex-1 h-0" scrollY>
        <View className="py-[24rpx] px-[32rpx] pb-[80rpx]">
          <Text className="block text-[length:24rpx] text-muted-foreground mb-[24rpx]">
            {tt(
              'conversationImport.desc',
              '将 Claude Code / Codex / Cursor / Aider / 微信等外部工具的会话记录导入为平台会话',
            )}
          </Text>

          {/* 错误条:解析失败 / 类型不支持 / 超限 / commit 失败,一律可见不静默 */}
          {error ? (
            <ThemeRoot className="flex items-start gap-[12rpx] p-[20rpx] mb-[24rpx] bg-card rounded-lg">
              <View className="flex-shrink-0 mt-[4rpx]">
                <LineIcon name="triangle-alert" size={28} color="var(--color-destructive)" />
              </View>
              <Text className="flex-1 text-[length:24rpx] text-destructive">{error}</Text>
            </ThemeRoot>
          ) : null}

          {/* Step 1 来源 */}
          <Text className="block text-[length:28rpx] text-foreground font-semibold mb-[16rpx]">
            {tt('conversationImport.sourcesTitle', '选择会话来源')}
          </Text>
          <View className="flex flex-wrap gap-[12rpx] mb-[16rpx]">
            {IMPORT_SOURCES.map((s) => {
              const active = source === s.value
              return (
                <View
                  key={s.value}
                  className={`flex flex-col py-[12rpx] px-[20rpx] rounded-md flex-shrink-0 ${
                    active ? 'bg-primary' : 'bg-card'
                  }`}
                  onClick={() => {
                    setSource(s.value)
                    resetPreview()
                  }}
                  hoverClass="opacity-60"
                >
                  <Text
                    className={`text-[length:26rpx] ${
                      active ? 'text-foreground font-semibold' : 'text-foreground'
                    }`}
                  >
                    {tt(s.labelKey, s.value)}
                  </Text>
                  <Text className="text-[length:20rpx] text-muted-foreground mt-[4rpx]">
                    {tt(s.hintKey, '')}
                  </Text>
                </View>
              )
            })}
          </View>

          {/* Step 2 选文件(微信原生「从会话中选择文件」)+ 解析 */}
          {source ? (
            <View className="mb-[32rpx]">
              <Button
                className="h-[88rpx] leading-[88rpx] bg-card text-foreground rounded-md text-[length:28rpx]"
                onClick={() => void onPick()}
              >
                {tt('conversationImport.pickFile', '从微信会话中选择导出文件')}
              </Button>
              <Text className="block text-[length:22rpx] text-muted-foreground mt-[12rpx]">
                {tt(
                  'conversationImport.uploadHint',
                  '支持文本导出格式(zip 压缩包 / txt 纯文本),单文件不超过 20MB',
                )}
              </Text>
              {file ? (
                <Text className="block text-[length:24rpx] text-foreground mt-[12rpx]">
                  {tt('conversationImport.fileSelected', '已选择:{name}', { name: file.name })}
                </Text>
              ) : null}
              <Button
                className="mt-[20rpx] h-[88rpx] leading-[88rpx] bg-primary text-[length:28rpx] rounded-md"
                disabled={!file || parsing}
                onClick={() => void onParse()}
              >
                {parsing
                  ? tt('conversationImport.parsing', '处理中...')
                  : tt('conversationImport.parse', '解析')}
              </Button>
            </View>
          ) : null}

          {/* Step 3 预览 + 逐会话导入 */}
          <ImportPreviewList
            rows={rows}
            selected={selected}
            truncated={truncated}
            warnings={warnings}
            committing={committing}
            progress={progress}
            tt={tt}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onCommit={() => void onCommit()}
          />

          {/* Step 4 导入历史 */}
          <ImportHistoryList items={history} tt={tt} />
        </View>
      </ScrollView>
    </View>
  )
}
// PLACEHOLDER-TAIL
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
