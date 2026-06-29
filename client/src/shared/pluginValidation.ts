import { t } from '@/utils/i18n'

import type { Plugin, PluginType } from './types'

export function validatePluginConfig(plugin: Partial<Plugin>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!plugin.name || plugin.name.trim() === '') {
    errors.push('插件名称不能为空')
  }

  if (!plugin.type) {
    errors.push('请选择插件类型')
  }

  if (!plugin.version || plugin.version.trim() === '') {
    errors.push('插件版本不能为空')
  }

  if (!plugin.description || plugin.description.trim() === '') {
    errors.push('插件描述不能为空')
  }

  if (plugin.version && !/^\d+\.\d+\.\d+/.test(plugin.version)) {
    errors.push('版本号格式不正确，应为 x.y.z 格式')
  }

  if (plugin.apiEndpoint && plugin.apiEndpoint.trim() !== '') {
    try {
      new URL(plugin.apiEndpoint)
    } catch {
      errors.push('API端点URL格式不正确')
    }
  }

  if (plugin.webhookUrl && plugin.webhookUrl.trim() !== '') {
    try {
      new URL(plugin.webhookUrl)
    } catch {
      errors.push('Webhook URL格式不正确')
    }
  }

  if (plugin.manifest) {
    if (typeof plugin.manifest !== 'object') {
      errors.push('插件清单必须是JSON对象')
    } else {
      if (!plugin.manifest.name) {
        errors.push('插件清单必须包含name字段')
      }
      if (!plugin.manifest.version) {
        errors.push('插件清单必须包含version字段')
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function validatePluginManifest(manifest: unknown): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!manifest || typeof manifest !== 'object') {
    errors.push('插件清单必须是JSON对象')
    return { valid: false, errors }
  }

  const manifestTyped = manifest as { name?: string; version?: string }
  if (!manifestTyped.name) {
    errors.push('缺少必需字段: name')
  }

  if (!manifestTyped.version) {
    errors.push('缺少必需字段: version')
  }

  if (manifestTyped.name && typeof manifestTyped.name !== 'string') {
    errors.push('name必须是字符串')
  }

  if (manifestTyped.version && !/^\d+\.\d+\.\d+/.test(manifestTyped.version)) {
    errors.push('version格式不正确，应为 x.y.z 格式')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function generatePluginManifestTemplate(
  name: string,
  version: string,
  type: PluginType
): Record<string, unknown> {
  return {
    name,
    version,
    type,
    description: '',
    author: '',
    entry: './index.js',
    permissions: [],
    config: {},
    api: {
      endpoints: [],
    },
  }
}

export function canPublishPlugin(plugin: Plugin): {
  canPublish: boolean
  reasons: string[]
} {
  const reasons: string[] = []

  if (!plugin.name || plugin.name.trim() === '') {
    reasons.push('插件名称不能为空')
  }

  if (!plugin.description || plugin.description.trim() === '') {
    reasons.push('插件描述不能为空')
  }

  if (!plugin.version || plugin.version.trim() === '') {
    reasons.push('插件版本不能为空')
  }

  if (!plugin.icon) {
    reasons.push('建议添加插件图标')
  }

  if (!plugin.manifest || !plugin.manifest.name) {
    reasons.push('插件清单配置不完整')
  }

  if (plugin.type === 'integration' && !plugin.apiEndpoint) {
    reasons.push('集成插件必须配置API端点')
  }

  return {
    canPublish: reasons.length === 0,
    reasons,
  }
}

export function checkVersionUpdate(
  oldVersion: string,
  newVersion: string
): {
  isValid: boolean
  updateType: 'major' | 'minor' | 'patch' | 'invalid'
  message: string
} {
  const oldParts = oldVersion.split('.').map(Number)
  const newParts = newVersion.split('.').map(Number)

  if (oldParts.length !== 3 || newParts.length !== 3) {
    return {
      isValid: false,
      updateType: 'invalid',
      message: t('api.plugin_validation.版本号格式不正确'),
    }
  }

  for (let i = 0; i < 3; i++) {
    if (newParts[i] > oldParts[i]) {
      if (i === 0) {
        return {
          isValid: true,
          updateType: 'major',
          message: t('api.plugin_validation.主版本号更新破坏1'),
        }
      } else if (i === 1) {
        return {
          isValid: true,
          updateType: 'minor',
          message: t('api.plugin_validation.次版本号更新新增2'),
        }
      } else {
        return {
          isValid: true,
          updateType: 'patch',
          message: t('api.plugin_validation.补丁版本号更新B3'),
        }
      }
    } else if (newParts[i] < oldParts[i]) {
      return {
        isValid: false,
        updateType: 'invalid',
        message: t('api.plugin_validation.新版本号不能小于4'),
      }
    }
  }

  return {
    isValid: false,
    updateType: 'invalid',
    message: t('api.plugin_validation.版本号未更改5'),
  }
}
