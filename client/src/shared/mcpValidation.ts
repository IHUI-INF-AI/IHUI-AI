import type { MCPServer } from './types'
import { MCP_PROTOCOLS } from './types'

export function validateMCPServerConfig(server: Partial<MCPServer>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!server.name || server.name.trim() === '') {
    errors.push('服务器名称不能为空')
  }

  if (!server.protocol) {
    errors.push('请选择协议')
  }

  if (!server.url || server.url.trim() === '') {
    errors.push('URL不能为空')
  }

  if (server.protocol && server.url) {
    switch (server.protocol) {
      case 'stdio':
        if (server.url.startsWith('http://') || server.url.startsWith('https://')) {
          errors.push('STDIO协议的URL不应该是HTTP/HTTPS格式')
        }
        break

      case 'sse':
        if (!server.url.startsWith('http://') && !server.url.startsWith('https://')) {
          errors.push('SSE协议的URL必须是HTTP或HTTPS格式')
        }
        break

      case 'websocket':
        if (!server.url.startsWith('ws://') && !server.url.startsWith('wss://')) {
          errors.push('WebSocket协议的URL必须是ws://或wss://格式')
        }
        break
    }
  }

  if (server.protocol === 'stdio' && server.transport) {
    if (!server.transport.command) {
      errors.push('STDIO协议必须配置command')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function validateMCPToolArguments(
  toolSchema: Record<string, unknown>,
  arguments_: Record<string, unknown>
): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!toolSchema.properties) {
    return {
      valid: true,
      errors: [],
    }
  }

  const required = (toolSchema.required || []) as string[]
  required.forEach((param: string) => {
    if (!(param in arguments_) || arguments_[param] === undefined || arguments_[param] === '') {
      errors.push(`参数 ${param} 是必填的`)
    }
  })

  const properties = toolSchema.properties as Record<string, { type: string }>
  Object.keys(properties).forEach(param => {
    if (param in arguments_) {
      const prop = properties[param]
      const value = arguments_[param]

      if (prop.type === 'string' && typeof value !== 'string') {
        errors.push(`参数 ${param} 必须是字符串类型`)
      } else if (prop.type === 'number' && typeof value !== 'number') {
        errors.push(`参数 ${param} 必须是数字类型`)
      } else if (prop.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`参数 ${param} 必须是布尔类型`)
      } else if (prop.type === 'array' && !Array.isArray(value)) {
        errors.push(`参数 ${param} 必须是数组类型`)
      } else if (prop.type === 'object' && typeof value !== 'object') {
        errors.push(`参数 ${param} 必须是对象类型`)
      }
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function generateMCPConnectionString(server: MCPServer): string {
  const parts: string[] = []

  parts.push(`协议: ${MCP_PROTOCOLS[server.protocol]?.name || server.protocol}`)
  parts.push(`URL: ${server.url}`)

  if (server.transport && server.protocol === 'stdio') {
    const command = server.transport.command || ''
    const args = (server.transport.args as string[]) || []
    if (command) {
      parts.push(`命令: ${command} ${args.join(' ')}`)
    }
  }

  return parts.join('\n')
}

export function validateTransportConfig(
  protocol: string,
  transport: Record<string, unknown>
): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (protocol === 'stdio') {
    if (!transport.command) {
      errors.push('STDIO协议必须指定command')
    }

    if (transport.args && !Array.isArray(transport.args)) {
      errors.push('args必须是数组类型')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
