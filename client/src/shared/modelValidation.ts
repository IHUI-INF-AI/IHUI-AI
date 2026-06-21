import { t } from '@/utils/i18n'

import type { AIModel } from './types'
import { MODEL_PROVIDERS } from './types'

export function validateModelConfig(model: Partial<AIModel>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!model.type) {
    errors.push('请选择模型提供商')
    return { valid: false, errors }
  }

  const provider = MODEL_PROVIDERS[model.type]
  if (!provider) {
    errors.push('无效的模型提供商')
    return { valid: false, errors }
  }

  const requiredFields = provider.requiredFields || []
  requiredFields.forEach(field => {
    if (field === 'apiKey' && (!model.apiKey || model.apiKey.trim() === '')) {
      errors.push('请输入API密钥')
    } else if (field === 'secretKey') {
      const secretKey = model.apiKey || model.config?.secretKey
      if (!secretKey || String(secretKey).trim() === '') {
        errors.push('请输入Secret密钥')
      }
    } else if (field === 'secretId') {
      const secretId = model.config?.secretId
      if (!secretId || String(secretId).trim() === '') {
        errors.push('请输入Secret ID')
      }
    } else if (field === 'baseUrl' && (!model.baseUrl || model.baseUrl.trim() === '')) {
      errors.push('请输入基础URL')
    } else if (field === 'modelId' && (!model.modelId || model.modelId.trim() === '')) {
      errors.push('请输入模型ID')
    }
  })

  if (model.baseUrl && model.baseUrl.trim() !== '') {
    try {
      new URL(model.baseUrl)
    } catch {
      errors.push('基础URL格式不正确')
    }
  }

  if (!model.modelId || model.modelId.trim() === '') {
    errors.push('请输入模型ID')
  }

  if (model.maxTokens !== undefined) {
    if (model.maxTokens < 1) {
      errors.push('最大Token数必须大于0')
    } else if (model.maxTokens > 1000000) {
      errors.push('最大Token数不能超过1000000')
    }
  }

  if (model.temperature !== undefined) {
    if (model.temperature < 0 || model.temperature > 2) {
      errors.push('温度参数必须在0-2之间')
    }
  }

  if (!model.name || model.name.trim() === '') {
    errors.push('请输入模型名称')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function validateApiKeyFormat(apiKey: string, providerType: string): boolean {
  if (!apiKey || apiKey.trim() === '') {
    return false
  }

  switch (providerType) {
    case 'openai':
      return apiKey.startsWith('sk-') && apiKey.length > 20
    case 'anthropic':
      return apiKey.startsWith('sk-ant-') && apiKey.length > 20
    case 'google':
      return apiKey.length > 20
    case 'coze':
      return apiKey.length > 10
    case 'dashscope':
      return apiKey.length > 10
    default:
      return apiKey.length > 0
  }
}

export function validateBaseUrl(baseUrl: string): boolean {
  if (!baseUrl || baseUrl.trim() === '') {
    return false
  }

  try {
    const url = new URL(baseUrl)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function validateModelConnection(model: AIModel): {
  canConnect: boolean
  message: string
} {
  if (!model.enabled) {
    return {
      canConnect: false,
      message: t('api.model_validation.模型未启用请先启'),
    }
  }

  if (!model.type) {
    return {
      canConnect: false,
      message: t('api.model_validation.模型类型未配置1'),
    }
  }

  const provider = MODEL_PROVIDERS[model.type]
  if (!provider) {
    return {
      canConnect: false,
      message: t('api.model_validation.无效的模型提供商2'),
    }
  }

  const requiredFields = provider.requiredFields || []
  const missingFields: string[] = []

  requiredFields.forEach(field => {
    if (field === 'apiKey' && (!model.apiKey || model.apiKey.trim() === '')) {
      missingFields.push('API密钥')
    } else if (field === 'secretKey') {
      const secretKey = model.apiKey || model.config?.secretKey
      if (!secretKey || String(secretKey).trim() === '') {
        missingFields.push('Secret密钥')
      }
    } else if (field === 'secretId') {
      const secretId = model.config?.secretId
      if (!secretId || String(secretId).trim() === '') {
        missingFields.push('Secret ID')
      }
    } else if (field === 'baseUrl' && (!model.baseUrl || model.baseUrl.trim() === '')) {
      missingFields.push('基础URL')
    } else if (field === 'modelId' && (!model.modelId || model.modelId.trim() === '')) {
      missingFields.push('模型ID')
    }
  })

  if (missingFields.length > 0) {
    return {
      canConnect: false,
      message: `缺少必填字段：${missingFields.join('、')}`,
    }
  }

  if (model.baseUrl && model.baseUrl.trim() !== '') {
    try {
      new URL(model.baseUrl)
    } catch {
      return {
        canConnect: false,
        message: t('api.model_validation.基础URL格式不3'),
      }
    }
  }

  if (!model.modelId || model.modelId.trim() === '') {
    return {
      canConnect: false,
      message: t('api.model_validation.模型ID未配置4'),
    }
  }

  return {
    canConnect: true,
    message: t('api.model_validation.模型配置有效可以5'),
  }
}

export function formatModelConfigForDisplay(model: Partial<AIModel>): string {
  if (!model) {
    return t('text.model_validation.无配置信息6')
  }

  const config: Record<string, unknown> = {
    名称: model.name || '未设置',
    类型: model.type || '未设置',
    提供商: model.provider || '未设置',
    模型ID: model.modelId || '未设置',
    基础URL: model.baseUrl || '未设置',
    启用状态: model.enabled ? '已启用' : '未启用',
    最大Token数: model.maxTokens ?? '未设置',
    温度参数: model.temperature ?? '未设置',
  }

  if (model.apiKey) {
    const apiKey = String(model.apiKey)
    config.API密钥 =
      apiKey.length > 8
        ? `${apiKey.substring(0, 4)}****${apiKey.substring(apiKey.length - 4)}`
        : '****'
  }

  if (model.config) {
    if (model.config.secretKey) {
      const secretKey = String(model.config.secretKey)
      config.Secret密钥 =
        secretKey.length > 8
          ? `${secretKey.substring(0, 4)}****${secretKey.substring(secretKey.length - 4)}`
          : '****'
    }
    if (model.config.secretId) {
      const secretId = String(model.config.secretId)
      config.Secret_ID =
        secretId.length > 8
          ? `${secretId.substring(0, 4)}****${secretId.substring(secretId.length - 4)}`
          : '****'
    }
  }

  return JSON.stringify(config, null, 2)
}
