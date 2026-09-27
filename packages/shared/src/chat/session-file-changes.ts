// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D117 /diff 会话级改动审查(G-231)纯聚合逻辑:从消息流的 toolCalls 里收集
// 「带 diffInfo 的文件编辑工具调用」,按文件聚合为改动总览。
// 判据单一:凡携带 diffInfo 的 toolCall 即计入(不维护第二份"文件写类工具名清单"
// —— 工具名清单的唯一源在 ai-service,这里按数据形状判定,新增编辑类工具自动纳入)。
// 零平台依赖:web / 小程序 / RN 三端共用本文件。

/** 最小消息形态(duck typing:各端 ChatMessage 的 toolCalls 都满足本形状) */
export interface SessionChangeSourceMessage {
  toolCalls?: ReadonlyArray<{
    toolName?: string
    status?: string
    isError?: boolean
    diffInfo?: {
      file_path?: string
      old_content?: string
      new_content?: string
      is_new_file?: boolean
      applyStatus?: 'pending' | 'applied' | 'rejected'
    } | null
  }> | null
}

/** 单文件的会话改动聚合结果 */
export interface SessionFileChange {
  /** 文件路径(diffInfo.file_path) */
  filePath: string
  /** 是否新文件(diffInfo.is_new_file) */
  isNewFile: boolean
  /** 最近一次改动所用的工具名 */
  toolName: string
  /** 该文件在会话内被编辑的次数(同文件多次编辑合并为一条,取最后一次 diff) */
  changedCount: number
  /** 最近一次改动的 Apply 状态(pending/applied/rejected;未知时为 undefined) */
  applyStatus?: 'pending' | 'applied' | 'rejected'
  /** 最近一次改动前的内容(新文件为空串) */
  oldContent: string
  /** 最近一次改动后的内容 */
  newContent: string
}

/**
 * 收集会话内所有文件改动(按文件聚合,同文件取最后一次 diff + 计次数)。
 *
 * - 只认 `diffInfo`(数据形状判据,见文件头);error/cancelled 的调用其 diffInfo
 *   通常未生成,天然不进结果 —— 无需额外按状态过滤;
 * - 返回顺序 = 文件首次出现顺序(稳定,不按时间重排);
 * - 不改入参(immutable)。
 */
export function collectSessionFileChanges(
  messages: readonly SessionChangeSourceMessage[],
): SessionFileChange[] {
  const byPath = new Map<string, SessionFileChange>()
  for (const msg of messages) {
    for (const tc of msg.toolCalls ?? []) {
      const diff = tc.diffInfo
      if (!diff || typeof diff.file_path !== 'string' || !diff.file_path) continue
      const prev = byPath.get(diff.file_path)
      if (prev) {
        prev.changedCount += 1
        prev.toolName = tc.toolName ?? prev.toolName
        // applyStatus 缺省(数据未回填)时保留上一次的已知状态,不得把"已应用"抹成未知
        if (diff.applyStatus) prev.applyStatus = diff.applyStatus
        prev.oldContent = diff.old_content ?? ''
        prev.newContent = diff.new_content ?? ''
        prev.isNewFile = diff.is_new_file ?? prev.isNewFile
      } else {
        byPath.set(diff.file_path, {
          filePath: diff.file_path,
          isNewFile: diff.is_new_file ?? false,
          toolName: tc.toolName ?? '',
          changedCount: 1,
          applyStatus: diff.applyStatus,
          oldContent: diff.old_content ?? '',
          newContent: diff.new_content ?? '',
        })
      }
    }
  }
  return Array.from(byPath.values())
}
