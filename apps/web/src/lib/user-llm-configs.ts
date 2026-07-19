/**
 * 用户 LLM 配置 API 客户端
 *
 * 2026-07-19 临时 stub:此文件缺失导致 dev server 编译失败(MODULE_NOT_FOUND),
 * 先用空数据 stub 让 build 通过,后续 PR 补全真实实现(api-client 拉取 user_llm_configs 表)。
 */

export interface UserLlmConfig {
  id: string
  providerCode: string
  enabled: boolean
  [key: string]: unknown
}

export interface FetchConfigsResult {
  list: UserLlmConfig[]
}

export async function fetchConfigs(): Promise<FetchConfigsResult> {
  // stub:未登录或网络异常时返回空列表,model-selector 的 configuredTemplateCodes 会是空集
  return { list: [] }
}
