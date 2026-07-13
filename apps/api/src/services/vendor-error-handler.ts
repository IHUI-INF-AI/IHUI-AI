/**
 * AI 厂商调用错误处理（R4 重构产物）。
 *
 * 集中管理厂商调用链路上的所有错误响应（reply.status + error(...)）。
 * 原 ai-vendors.ts 中错误处理散落在 requireVendorKey / requireVendorKeys / callVendor 三处。
 *
 * 错误码约定（与 utils/response.ts 的 error() 工厂函数一致）：
 * - 400  不支持的厂商
 * - 502  厂商 API 调用失败 / 厂商 API 调用异常
 * - 503  厂商服务未配置 / 凭据缺失
 */
import type { FastifyReply } from 'fastify'
import { error } from '../utils/response.js'
import type { VendorCredentials } from './vendor-auth-strategies.js'

/** 厂商最小字段集（与 AiVendorConfig 的核心字段保持一致） */
interface VendorMinFields {
  vendorName: string
  keyEnvName?: string | null
  secretKeyEnvName?: string | null
}

export const VendorErrorHandler = {
  /**
   * 处理厂商配置错误（厂商不存在 / 厂商被禁用 / 厂商元数据异常）。
   */
  handleConfigError(reply: FastifyReply, vendorCode: string, message: string): void {
    reply.status(503).send(error(503, `厂商 ${vendorCode} 配置错误: ${message}`))
  },

  /**
   * 处理厂商 API 调用错误（厂商返回非 2xx 响应）。
   */
  handleApiError(
    reply: FastifyReply,
    vendorName: string,
    statusCode: number,
    responseData: unknown,
  ): void {
    const snippet = JSON.stringify(responseData).slice(0, 500)
    reply.status(502).send(error(502, `${vendorName} 调用失败: ${statusCode} ${snippet}`))
  },

  /**
   * 处理网络异常（超时 / 连接失败 / 厂商 DNS 不可达）。
   */
  handleNetworkError(reply: FastifyReply, vendorName: string, err: Error): void {
    const message = err.name === 'AbortError' ? '请求超时' : err.message
    reply.status(502).send(error(502, `${vendorName} 调用异常: ${message}`))
  },

  /**
   * 验证厂商凭据是否完整。缺失时直接 reply 503 并返回 false，调用方应终止后续流程。
   */
  validateCredentials(
    reply: FastifyReply,
    vendor: VendorMinFields,
    credentials: VendorCredentials,
  ): boolean {
    if (!credentials.key && vendor.keyEnvName) {
      this.handleConfigError(reply, vendor.vendorName, `环境变量 ${vendor.keyEnvName} 未配置`)
      return false
    }
    if (!credentials.secret && vendor.secretKeyEnvName) {
      this.handleConfigError(reply, vendor.vendorName, `环境变量 ${vendor.secretKeyEnvName} 未配置`)
      return false
    }
    return true
  },
}
