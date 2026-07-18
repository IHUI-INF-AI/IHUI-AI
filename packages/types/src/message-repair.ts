/**
 * 会话历史结构修复(messages 数组自愈)。
 *
 * 参考行业 Agent 框架的 session repair 扩展方法设计,CLI P37 第四次深度审计整合。
 * 跨端共享:CLI(本地 JSON 文件)+ API(/chat/stream 入口)+ ai-service(llm_gateway 兜底)共用同一套规则。
 *
 * 问题:Web/API/ai-service 链路中,messages 数组可能因各种原因出现结构异常,
 * 触发 LLM 400 错误或语义错乱:
 *   - 非法 role(tool/function 残留,Web 端不应传)
 *   - 空 content(输入框未填就发送)
 *   - 连续相同 role(用户连点发送 / 压缩残留)
 *   - 开头是 assistant(history 顺序错乱)
 *   - 末尾无响应的 user(用户发了消息但 AI 还没回)
 *
 * 修复规则(与 CLI repairSessionHistory 完全一致):
 *   1. 过滤非法 role(只保留 system/user/assistant,移除 tool/function/unknown 等)
 *   2. 过滤空 content(空字符串/纯空白)
 *   3. 去重连续相同 role(合并 content,用 \n\n 连接)
 *   4. 确保首条是 system 或 user(丢弃开头的 assistant,无前置 user 的 stale response)
 *   5. 移除末尾无响应的 user 消息(前面有 assistant 响应时才移除,首轮 user 保留)
 *
 * 注意:本函数过滤 tool role。tool role 只在 ai-service 内部 agent_loop
 * (LangGraph 工具调用结果)使用,不应出现在 Web → API 入口的 messages 中。
 * ai-service 内部 agent_loop 不应调用本函数(其 messages 由 LangGraph 管理)。
 */

export interface RepairableMessage {
  role: string
  content: string
}

export interface RepairResult<T extends RepairableMessage = RepairableMessage> {
  repaired: T[]
  removed: number
  reasons: string[]
}

const VALID_ROLES = new Set(['system', 'user', 'assistant'])

/**
 * 修复 messages 数组结构异常。返回修复后的数组 + 移除条数 + 修复原因清单。
 * 不修改原始数组(返回新数组与新对象)。
 */
export function repairMessages<T extends RepairableMessage>(messages: T[]): RepairResult<T> {
  const reasons: string[] = []
  let removed = 0

  // Rule 1+2:过滤非法 role + 空 content
  let cleaned = messages.filter((m) => {
    if (!m || typeof m !== 'object') {
      removed++
      return false
    }
    if (!VALID_ROLES.has(m.role)) {
      reasons.push(`移除非法 role: ${m.role}`)
      removed++
      return false
    }
    if (typeof m.content !== 'string' || m.content.trim() === '') {
      reasons.push(`移除空 content(role=${m.role})`)
      removed++
      return false
    }
    return true
  })

  // Rule 3:去重连续相同 role(合并 content)
  const deduped: T[] = []
  for (const m of cleaned) {
    const last = deduped[deduped.length - 1]
    if (last && last.role === m.role) {
      reasons.push(`合并连续 ${m.role} 消息`)
      last.content = `${last.content}\n\n${m.content}`
    } else {
      deduped.push({ ...m })
    }
  }
  cleaned = deduped

  // Rule 4:确保首条是 system 或 user(丢弃开头的 assistant)
  while (cleaned.length > 0 && cleaned[0]!.role === 'assistant') {
    reasons.push('移除开头的 assistant 消息(无前置 user)')
    cleaned.shift()
    removed++
  }

  // Rule 5:移除末尾无响应的 user 消息(前面有 assistant 响应时才移除,首轮 user 保留)
  if (cleaned.length > 0 && cleaned[cleaned.length - 1]!.role === 'user') {
    const hasAssistant = cleaned.some((m) => m.role === 'assistant')
    if (hasAssistant) {
      reasons.push('移除末尾无 assistant 响应的 user 消息(可能是 interjection 残留)')
      cleaned.pop()
      removed++
    }
  }

  return { repaired: cleaned, removed, reasons }
}
