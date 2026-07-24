/**
 * Token 对跨端共享类型契约。
 *
 * 4 端统一引用(extension / web / api),取代各端本地重复定义。
 * refreshToken / expiresIn 设为可选(最宽松),兼容所有消费端用法;
 * 需要必填版本的端(如 api token-service)用 `Required<TokenPair>` 收窄。
 */
export interface TokenPair {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}
