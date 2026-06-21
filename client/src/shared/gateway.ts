import type { ApiEndpoint, ApiParameter } from './types'

export function validateApiEndpoint(endpoint: Partial<ApiEndpoint>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!endpoint.path || endpoint.path.trim() === '') {
    errors.push('端点路径不能为空')
  } else if (!/^[a-zA-Z0-9/_-]+$/.test(endpoint.path)) {
    errors.push('端点路径格式不正确，只能包含字母、数字、斜杠、下划线和连字符')
  }

  if (!endpoint.method) {
    errors.push('请求方法不能为空')
  }

  if (!endpoint.path?.startsWith('/') && endpoint.path) {
    errors.push('端点路径必须以斜杠开头')
  }

  if (endpoint.parameters) {
    endpoint.parameters.forEach((param, index) => {
      if (!param.name || param.name.trim() === '') {
        errors.push(`参数${index + 1}缺少名称`)
      }
      if (!param.type) {
        errors.push(`参数${index + 1}缺少类型`)
      }
    })
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function validateParameterValue(
  param: ApiParameter,
  value: any
): {
  valid: boolean
  error?: string
} {
  if (param.required && (value === undefined || value === null || value === '')) {
    return {
      valid: false,
      error: `参数"${param.name}"是必填的`,
    }
  }

  if (!param.required && (value === undefined || value === null || value === '')) {
    return { valid: true }
  }

  switch (param.type) {
    case 'string':
      if (typeof value !== 'string') {
        return {
          valid: false,
          error: `参数"${param.name}"必须是字符串类型`,
        }
      }
      break
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return {
          valid: false,
          error: `参数"${param.name}"必须是数字类型`,
        }
      }
      break
    case 'boolean':
      if (typeof value !== 'boolean') {
        return {
          valid: false,
          error: `参数"${param.name}"必须是布尔类型`,
        }
      }
      break
    case 'object':
      if (typeof value !== 'object' || Array.isArray(value) || value === null) {
        return {
          valid: false,
          error: `参数"${param.name}"必须是对象类型`,
        }
      }
      break
    case 'array':
      if (!Array.isArray(value)) {
        return {
          valid: false,
          error: `参数"${param.name}"必须是数组类型`,
        }
      }
      break
  }

  if (param.enum && param.enum.length > 0) {
    if (!param.enum.includes(value)) {
      return {
        valid: false,
        error: `参数"${param.name}"的值必须是以下之一：${param.enum.join(', ')}`,
      }
    }
  }

  if (param.type === 'number') {
    if (param.min !== undefined && typeof value === 'number' && (value as number) < param.min) {
      return {
        valid: false,
        error: `参数"${param.name}"的值不能小于${param.min}`,
      }
    }
    if (param.max !== undefined && typeof value === 'number' && (value as number) > param.max) {
      return {
        valid: false,
        error: `参数"${param.name}"的值不能大于${param.max}`,
      }
    }
  }

  if (param.type === 'string' && param.pattern && typeof value === 'string') {
    const regex = new RegExp(param.pattern)
    if (!regex.test(value as string)) {
      return {
        valid: false,
        error: `参数"${param.name}"的值不符合格式要求`,
      }
    }
  }

  return { valid: true }
}

export function generateApiUrl(
  baseUrl: string,
  endpoint: ApiEndpoint,
  params?: Record<string, unknown>
): string {
  let url = `${baseUrl.replace(/\/$/, '')}/${endpoint.path.replace(/^\//, '')}`

  if (params && endpoint.method === 'GET') {
    const queryString = Object.entries(params)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(String(value as string | number | boolean))}`
      )
      .join('&')
    if (queryString) {
      url += `?${queryString}`
    }
  }

  return url
}

export function transformRequestData(
  endpoint: ApiEndpoint,
  requestData: Record<string, unknown>
): {
  url: string
  method: string
  body?: any
  headers?: Record<string, string>
} {
  const pathParams: Record<string, string> = {}
  const queryParams: Record<string, unknown> = {}
  const bodyParams: Record<string, unknown> = {}

  if (endpoint.parameters) {
    endpoint.parameters.forEach(param => {
      const value = requestData[param.name]

      if (value !== undefined && value !== null) {
        if (endpoint.method === 'GET') {
          queryParams[param.name] = value
        } else {
          bodyParams[param.name] = value
        }
      }
    })
  }

  let url = endpoint.path
  Object.entries(pathParams).forEach(([key, value]) => {
    url = url.replace(`{${key}}`, value)
  })

  return {
    url,
    method: endpoint.method,
    body: Object.keys(bodyParams).length > 0 ? bodyParams : undefined,
    headers: {
      'Content-Type': 'application/json',
    },
  }
}
