import { t } from '@/utils/i18n'

/**
 * API服务管理接口
 * 用于用户API令牌管理、使用统计、计费等功能
 */

import request from '@/utils/request'
import { logger } from '@/utils/logger'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { API_USER_PATHS, API_MODELS_PATHS, API_SERVICE_PATHS } from '@/config/backend-paths'
import type {
  ApiToken,
  ApiTokenStatus,
  CreateApiTokenParams,
  UpdateApiTokenParams,
  ApiCallLog,
  ApiUsageStats,
  ApiPricing,
  ModelApiInfo,
  ApiServiceConfig,
  UserApiBalance,
  ApiRechargeRecord,
} from '@/types/api-service'
import { ApiProtocolType, BillingType } from '@/types/api-service'

// ==================== API令牌管理 ====================

/**
 * 获取用户的API令牌列表
 * ⚠️ 注意：此接口在Swagger文档中未找到，可能不在文档中或需要确认
 */
export async function getApiTokens(
  params?: PaginationParams & {
    status?: ApiTokenStatus
    appId?: string // 按应用筛选
  }
): Promise<ApiResponse<PaginationResponse<ApiToken>>> {
  try {
    // ⚠️ 注意：此接口在Swagger文档中未找到，可能不在文档中或需要确认
    const response = await request.get(API_USER_PATHS.apiTokens, { params })
    return {
      code: 200,
      success: true,
      message: t('api.api_service.获取成功'),
      data: response.data || { list: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to fetch API token list:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.api_service.获取令牌列表失败'),
      data: { list: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      timestamp: Date.now(),
    }
  }
}

/**
 * 获取单个API令牌详情
 */
export async function getApiTokenDetail(tokenId: string): Promise<ApiResponse<ApiToken>> {
  try {
    // ⚠️ 注意：此接口在Swagger文档中未找到，可能不在文档中或需要确认
    const response = await request.get(API_USER_PATHS.apiTokenById(tokenId))
    return {
      code: 200,
      success: true,
      message: t('api.api_service.获取成功1'),
      data: response.data,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to fetch API token detail:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.api_service.获取令牌详情失败'),
      data: {} as ApiToken,
      timestamp: Date.now(),
    }
  }
}

/**
 * 创建新的API令牌
 */
export async function createApiToken(params: CreateApiTokenParams): Promise<ApiResponse<ApiToken>> {
  try {
    // ⚠️ 注意：此接口在Swagger文档中未找到，可能不在文档中或需要确认
    const response = await request.post(API_USER_PATHS.apiTokens, params)
    return {
      code: 200,
      success: true,
      message: t('api.api_service.创建成功2'),
      data: response.data,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to create API token:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.api_service.创建令牌失败'),
      data: {} as ApiToken,
      timestamp: Date.now(),
    }
  }
}

/**
 * 更新API令牌
 */
export async function updateApiToken(
  tokenId: string,
  params: UpdateApiTokenParams
): Promise<ApiResponse<ApiToken>> {
  try {
    // ⚠️ 注意：此接口在Swagger文档中未找到，可能不在文档中或需要确认
    const response = await request.put(API_USER_PATHS.apiTokenById(tokenId), params)
    return {
      code: 200,
      success: true,
      message: t('api.api_service.更新成功3'),
      data: response.data,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to update API token:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.api_service.更新令牌失败'),
      data: {} as ApiToken,
      timestamp: Date.now(),
    }
  }
}

/**
 * 删除API令牌
 */
export async function deleteApiToken(tokenId: string): Promise<ApiResponse<boolean>> {
  try {
    // ⚠️ 注意：此接口在Swagger文档中未找到，可能不在文档中或需要确认
    await request.delete(API_USER_PATHS.apiTokenById(tokenId))
    return {
      code: 200,
      success: true,
      message: t('api.api_service.删除成功4'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to delete API token:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.api_service.删除令牌失败'),
      data: false,
      timestamp: Date.now(),
    }
  }
}

/**
 * 重新生成API令牌密钥
 */
export async function regenerateApiToken(tokenId: string): Promise<ApiResponse<{ token: string }>> {
  try {
    // ⚠️ 注意：此接口在Swagger文档中未找到，可能不在文档中或需要确认
    const response = await request.post(API_USER_PATHS.apiTokenRegenerate(tokenId))
    return {
      code: 200,
      success: true,
      message: t('api.api_service.重新生成成功5'),
      data: response.data,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to regenerate API token:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.api_service.重新生成令牌失败'),
      data: { token: '' },
      timestamp: Date.now(),
    }
  }
}

// ==================== API使用统计 ====================

/**
 * 获取API使用统计
 */
export async function getApiUsageStats(params: {
  tokenId?: string
  startDate: string
  endDate: string
  modelId?: string
}): Promise<ApiResponse<ApiUsageStats>> {
  try {
    // ⚠️ 注意：此接口在Swagger文档中未找到，可能不在文档中或需要确认
    const response = await request.get(API_USER_PATHS.apiUsageStats, { params })
    return {
      code: 200,
      success: true,
      message: t('api.api_service.获取成功6'),
      data: response.data,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to fetch API usage stats:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.api_service.获取使用统计失败'),
      data: {} as ApiUsageStats,
      timestamp: Date.now(),
    }
  }
}

/**
 * 获取API调用日志
 */
export async function getApiCallLogs(
  params?: PaginationParams & {
    tokenId?: string
    appId?: string // 按应用筛选
    modelId?: string
    status?: 'success' | 'error' | 'timeout' | 'rate_limited'
    startDate?: string
    endDate?: string
  }
): Promise<ApiResponse<PaginationResponse<ApiCallLog>>> {
  try {
    // ⚠️ 注意：此接口在Swagger文档中未找到，可能不在文档中或需要确认
    const response = await request.get(API_USER_PATHS.apiUsageLogs, { params })
    return {
      code: 200,
      success: true,
      message: t('api.api_service.获取成功7'),
      data: response.data || { list: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to fetch API call logs:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.api_service.获取调用日志失败'),
      data: { list: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      timestamp: Date.now(),
    }
  }
}

/**
 * 获取API调用日志详情（包含完整请求/响应信息）
 */
export async function getApiCallLogDetail(
  logId: string
): Promise<ApiResponse<ApiCallLog>> {
  try {
    // ⚠️ 注意：此接口在Swagger文档中未找到，可能不在文档中或需要确认
  const response = await request.get(API_USER_PATHS.apiUsageLogById(logId))
    return {
      code: 200,
      success: true,
      message: t('api.api_service.获取成功8'),
      data: response.data,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to fetch API call log detail:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.api_service.获取日志详情失败'),
      data: {} as ApiCallLog,
      timestamp: Date.now(),
    }
  }
}

/**
 * 导出API调用日志
 */
export async function exportApiCallLogs(
  params?: {
    tokenId?: string
    appId?: string
    modelId?: string
    status?: 'success' | 'error' | 'timeout' | 'rate_limited'
    startDate?: string
    endDate?: string
    format?: 'excel' | 'csv'
  }
): Promise<Blob> {
  // ⚠️ 注意：此接口在Swagger文档中未找到，可能不在文档中或需要确认
  const response = await request.get(API_USER_PATHS.apiUsageLogsExport, {
    params,
    responseType: 'blob',
  })
  return response as unknown as Blob
}

// ==================== 模型API信息 ====================

/**
 * 获取模型的API对接信息
 */
export async function getModelApiInfo(modelId: string): Promise<ApiResponse<ModelApiInfo>> {
  try {
    const response = await request.get(API_MODELS_PATHS.apiInfo(modelId))
    return {
      code: 200,
      success: true,
      message: t('api.api_service.获取成功9'),
      data: response.data,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to fetch model API info:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.api_service.获取模型信息失败'),
      data: {} as ModelApiInfo,
      timestamp: Date.now(),
    }
  }
}

/**
 * 获取所有模型的API定价信息
 */
export async function getModelPricingList(): Promise<ApiResponse<ApiPricing[]>> {
  try {
    const response = await request.get(API_MODELS_PATHS.pricing)
    return {
      code: 200,
      success: true,
      message: t('api.api_service.获取成功10'),
      data: response.data || [],
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to fetch model pricing list:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.api_service.获取定价列表失败'),
      data: [],
      timestamp: Date.now(),
    }
  }
}

// ==================== API服务配置 ====================

/**
 * 获取API服务配置
 */
export async function getApiServiceConfig(): Promise<ApiResponse<ApiServiceConfig>> {
  try {
    const response = await request.get(API_SERVICE_PATHS.config)
    return {
      code: 200,
      success: true,
      message: t('api.api_service.获取成功11'),
      data: response.data,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to fetch API service config:', error)
    // 返回默认配置
    const defaultConfig: ApiServiceConfig = {
      baseUrl: window.location.origin + '/v1',
      version: 'v1',
      defaultLimits: {
        maxQuota: -1,
        usedQuota: 0,
        maxRequestsPerMinute: 60,
        maxRequestsPerDay: 10000,
        maxTokensPerRequest: 128000,
      },
      supportedProtocols: [ApiProtocolType.OPENAI, ApiProtocolType.ANTHROPIC],
      supportedCapabilities: ['chat', 'image', 'video', 'audio', 'embedding', 'completion'],
      billingType: BillingType.TOKEN,
      minRechargeAmount: 10,
      documentationUrl: '/docs/api',
      sdkUrls: {
        python: 'https://pypi.org/project/openai/',
        nodejs: 'https://www.npmjs.com/package/openai',
      },
    }
    return {
      code: 200,
      success: true,
      message: t('api.api_service.使用默认配置12'),
      data: defaultConfig,
      timestamp: Date.now(),
    }
  }
}

// ==================== 用户余额管理 ====================

/**
 * 获取用户API余额
 */
export async function getUserApiBalance(): Promise<ApiResponse<UserApiBalance>> {
  try {
    // ⚠️ 注意：此接口在Swagger文档中未找到，可能不在文档中或需要确认
    const response = await request.get(API_USER_PATHS.apiBalance)
    return {
      code: 200,
      success: true,
      message: t('api.api_service.获取成功13'),
      data: response.data,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to fetch user API balance:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.api_service.获取余额失败'),
      data: {} as UserApiBalance,
      timestamp: Date.now(),
    }
  }
}

/**
 * 获取充值记录
 */
export async function getApiRechargeRecords(
  params?: PaginationParams & {
    status?: 'pending' | 'success' | 'failed' | 'refunded'
    startDate?: string
    endDate?: string
  }
): Promise<ApiResponse<PaginationResponse<ApiRechargeRecord>>> {
  try {
    // ⚠️ 注意：此接口在Swagger文档中未找到，可能不在文档中或需要确认
    const response = await request.get(API_USER_PATHS.apiRechargeRecords, { params })
    return {
      code: 200,
      success: true,
      message: t('api.api_service.获取成功14'),
      data: response.data || { list: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('Failed to fetch recharge records:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || t('api.api_service.获取充值记录失败'),
      data: { list: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
      timestamp: Date.now(),
    }
  }
}

// ==================== 工具函数 ====================

/**
 * 生成API调用示例代码
 */
export function generateApiExample(params: {
  modelId: string
  protocol: ApiProtocolType
  baseUrl: string
  apiKey: string
  language: 'python' | 'nodejs' | 'curl' | 'java'
}): string {
  const { modelId, protocol, baseUrl, apiKey, language } = params

  if (language === 'curl') {
    if (protocol === 'openai') {
      return `curl ${baseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "model": "${modelId}",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ]
  }'`
    } else if (protocol === 'anthropic') {
      return `curl ${baseUrl}/messages \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey}" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{
    "model": "${modelId}",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'`
    }
  }

  if (language === 'python') {
    if (protocol === 'openai') {
      return `from openai import OpenAI

client = OpenAI(
    api_key="${apiKey}",
    base_url="${baseUrl}"
)

response = client.chat.completions.create(
    model="${modelId}",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)`
    } else if (protocol === 'anthropic') {
      return `import anthropic

client = anthropic.Anthropic(
    api_key="${apiKey}",
    base_url="${baseUrl}"
)

message = client.messages.create(
    model="${modelId}",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(message.content[0].text)`
    }
  }

  if (language === 'nodejs') {
    if (protocol === 'openai') {
      return `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: '${apiKey}',
  baseURL: '${baseUrl}'
});

async function main() {
  const response = await client.chat.completions.create({
    model: '${modelId}',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' }
    ]
  });
  
  logger.info('API response:', response.choices[0].message.content);
}

main();`
    } else if (protocol === 'anthropic') {
      return `import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: '${apiKey}',
  baseURL: '${baseUrl}'
});

async function main() {
  const message = await client.messages.create({
    model: '${modelId}',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: 'Hello!' }
    ]
  });

  logger.info('Message content:', message.content[0].text);
}

main();`
    }
  }

  if (language === 'java') {
    return `// Using OkHttp library
OkHttpClient client = new OkHttpClient();

String json = """
    {
        "model": "${modelId}",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello!"}
        ]
    }
    """;

Request request = new Request.Builder()
    .url("${baseUrl}/chat/completions")
    .addHeader("Content-Type", "application/json")
    .addHeader("Authorization", "Bearer ${apiKey}")
    .post(RequestBody.create(json, MediaType.parse("application/json")))
    .build();

Response response = client.newCall(request).execute();
System.out.println(response.body().string());`
  }

  return t('text.api_service.暂不支持该语言的15')
}

/**
 * 格式化Token数量
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return tokens.toString()
  if (tokens < 1000000) return (tokens / 1000).toFixed(1) + 'K'
  return (tokens / 1000000).toFixed(2) + 'M'
}

/**
 * 格式化费用
 */
export function formatCost(cost: number, currency: string = 'CNY'): string {
  const symbol = currency === 'CNY' ? '¥' : '$'
  if (cost < 0.01) return symbol + cost.toFixed(4)
  if (cost < 1) return symbol + cost.toFixed(3)
  return symbol + cost.toFixed(2)
}

/**
 * 计算Token费用
 */
export function calculateTokenCost(
  inputTokens: number,
  outputTokens: number,
  pricing: ApiPricing
): number {
  const inputCost = (inputTokens / pricing.unit) * pricing.inputPrice
  const outputCost = (outputTokens / pricing.unit) * pricing.outputPrice
  let totalCost = inputCost + outputCost
  
  if (pricing.discount && pricing.discount > 0 && pricing.discount < 1) {
    totalCost = totalCost * pricing.discount
  }
  
  return totalCost
}
