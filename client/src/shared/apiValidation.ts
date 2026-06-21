import type { DeveloperAPI, ApiMethod } from './types'

export function validateAPIConfig(api: Partial<DeveloperAPI>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!api.name || api.name.trim() === '') {
    errors.push('API名称不能为空')
  }

  if (!api.path || api.path.trim() === '') {
    errors.push('API路径不能为空')
  }

  if (!api.method) {
    errors.push('请选择请求方法')
  }

  if (!api.version || api.version.trim() === '') {
    errors.push('API版本不能为空')
  }

  if (!api.description || api.description.trim() === '') {
    errors.push('API描述不能为空')
  }

  if (api.path) {
    if (api.path.startsWith('/')) {
      errors.push('路径不应以/开头')
    }

    if (!/^[a-zA-Z0-9\-_/]+$/.test(api.path)) {
      errors.push('路径只能包含字母、数字、-、_、/')
    }
  }

  if (api.requestParams) {
    api.requestParams.forEach((param, index) => {
      if (!param.name || param.name.trim() === '') {
        errors.push(`请求参数${index + 1}的名称不能为空`)
      }

      if (!param.type) {
        errors.push(`请求参数${index + 1}的类型不能为空`)
      }
    })
  }

  if (api.rateLimit) {
    if (api.rateLimit.requests < 1) {
      errors.push('限流请求数必须大于0')
    }

    if (!api.rateLimit.period || !['1m', '1h', '1d'].includes(api.rateLimit.period)) {
      errors.push('限流周期格式不正确')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function checkAPIPathConflict(
  path: string,
  method: ApiMethod,
  existingAPIs: DeveloperAPI[],
  currentAPIId?: string
): boolean {
  return existingAPIs.some(
    api => api.id !== currentAPIId && api.path === path && api.method === method && api.enabled
  )
}

export function suggestAPIPath(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function validateResponseSchema(schema: Record<string, unknown>): {
  valid: boolean
  error?: string
} {
  if (!schema || typeof schema !== 'object') {
    return {
      valid: false,
      error: 'Schema必须是JSON对象',
    }
  }

  const schemaType = schema.type
  if (
    schemaType &&
    typeof schemaType === 'string' &&
    !['object', 'array', 'string', 'number', 'boolean', 'null'].includes(schemaType)
  ) {
    return {
      valid: false,
      error: 'Schema类型无效',
    }
  }

  return {
    valid: true,
  }
}

export function generateAPIDocPreview(api: DeveloperAPI): string {
  const lines: string[] = []

  lines.push(`# ${api.name}`)
  lines.push(`\n${api.description}\n`)
  lines.push(`**请求方法:** ${api.method}`)
  lines.push(`**路径:** \`/api/v1/${api.path}\``)
  lines.push(`**版本:** ${api.version}\n`)

  if (api.authRequired) {
    lines.push('**认证:** 需要API密钥\n')
  }

  if (api.requestParams && api.requestParams.length > 0) {
    lines.push('## 请求参数\n')
    lines.push('| 参数名 | 类型 | 必填 | 描述 |')
    lines.push('|--------|------|------|------|')
    api.requestParams.forEach(param => {
      lines.push(
        `| ${param.name} | ${param.type} | ${param.required ? '是' : '否'} | ${param.description || ''} |`
      )
    })
    lines.push('')
  }

  return lines.join('\n')
}
