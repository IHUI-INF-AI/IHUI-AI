import type { ThemeMode } from '@/stores/darkMode'
import type { ThemePreset } from './themePreset'
import type { ScheduledSwitch } from './themeScheduledSwitch'

export interface ThemePackage {
  version: string
  name: string
  description?: string
  author?: string
  createdAt: number
  themeMode: ThemeMode
  presets: ThemePreset[]
  activePresetId: string | null
  schedules?: ScheduledSwitch[]
  customVariables?: Record<string, string>
}

export interface ExportOptions {
  includePresets: boolean
  includeSchedules: boolean
  includeCustomVariables: boolean
  format: 'json' | 'yaml' | 'toml'
  prettify: boolean
}

export interface ImportResult {
  success: boolean
  imported: {
    presets: number
    schedules: number
    customVariables: number
  }
  errors: string[]
  warnings: string[]
}

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includePresets: true,
  includeSchedules: true,
  includeCustomVariables: true,
  format: 'json',
  prettify: true
}

class ThemeImportExportService {
  private currentVersion = '1.0.0'

  exportThemePackage(
    themeMode: ThemeMode,
    presets: ThemePreset[],
    activePresetId: string | null,
    schedules: ScheduledSwitch[] = [],
    customVariables: Record<string, string> = {},
    options: Partial<ExportOptions> = {}
  ): string {
    const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options }

    const pkg: ThemePackage = {
      version: this.currentVersion,
      name: 'Theme Package',
      createdAt: Date.now(),
      themeMode,
      presets: opts.includePresets ? presets.filter(p => !p.isDefault) : [],
      activePresetId: opts.includePresets ? activePresetId : null,
      schedules: opts.includeSchedules ? schedules : undefined,
      customVariables: opts.includeCustomVariables ? customVariables : undefined
    }

    switch (opts.format) {
      case 'yaml':
        return this.toYAML(pkg, opts.prettify)
      case 'toml':
        return this.toTOML(pkg)
      default:
        return JSON.stringify(pkg, null, opts.prettify ? 2 : 0)
    }
  }

  importThemePackage(content: string, format?: 'json' | 'yaml' | 'toml'): ImportResult {
    const result: ImportResult = {
      success: false,
      imported: { presets: 0, schedules: 0, customVariables: 0 },
      errors: [],
      warnings: []
    }

    try {
      let pkg: ThemePackage

      const detectedFormat = format || this.detectFormat(content)

      switch (detectedFormat) {
        case 'yaml':
          pkg = this.fromYAML(content)
          break
        case 'toml':
          pkg = this.fromTOML(content)
          break
        default:
          pkg = JSON.parse(content)
      }

      if (!pkg.version || !pkg.themeMode) {
        result.errors.push('Invalid theme package: missing required fields')
        return result
      }

      const validModes: ThemeMode[] = ['light', 'dark', 'auto', 'high-contrast-light', 'high-contrast-dark']
      if (!validModes.includes(pkg.themeMode)) {
        result.errors.push(`Invalid theme mode: ${pkg.themeMode}`)
        return result
      }

      if (pkg.presets && Array.isArray(pkg.presets)) {
        for (const preset of pkg.presets) {
          if (!preset.id || !preset.name || !preset.mode) {
            result.warnings.push(`Skipped invalid preset: ${JSON.stringify(preset)}`)
            continue
          }
          if (!validModes.includes(preset.mode)) {
            result.warnings.push(`Skipped preset with invalid mode: ${preset.name}`)
            continue
          }
          result.imported.presets++
        }
      }

      if (pkg.schedules && Array.isArray(pkg.schedules)) {
        for (const schedule of pkg.schedules) {
          if (!schedule.id || !schedule.time || !schedule.mode) {
            result.warnings.push(`Skipped invalid schedule: ${JSON.stringify(schedule)}`)
            continue
          }
          result.imported.schedules++
        }
      }

      if (pkg.customVariables && typeof pkg.customVariables === 'object') {
        result.imported.customVariables = Object.keys(pkg.customVariables).length
      }

      result.success = true
    } catch (error) {
      result.errors.push(`Parse error: ${String(error)}`)
    }

    return result
  }

  private detectFormat(content: string): 'json' | 'yaml' | 'toml' {
    const trimmed = content.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return 'json'
    }
    if (trimmed.includes(' = ') && trimmed.includes('[')) {
      return 'toml'
    }
    return 'yaml'
  }

  private toYAML(pkg: ThemePackage, prettify: boolean): string {
    const lines: string[] = []
    lines.push(`version: "${pkg.version}"`)
    lines.push(`name: "${pkg.name}"`)
    if (pkg.description) lines.push(`description: "${pkg.description}"`)
    if (pkg.author) lines.push(`author: "${pkg.author}"`)
    lines.push(`createdAt: ${pkg.createdAt}`)
    lines.push(`themeMode: ${pkg.themeMode}`)

    if (pkg.presets.length > 0) {
      lines.push('presets:')
      for (const preset of pkg.presets) {
        lines.push(`  - id: ${preset.id}`)
        lines.push(`    name: "${preset.name}"`)
        lines.push(`    mode: ${preset.mode}`)
        if (preset.customColors) {
          lines.push('    customColors:')
          for (const [key, value] of Object.entries(preset.customColors)) {
            lines.push(`      ${key}: "${value}"`)
          }
        }
        lines.push(`    createdAt: ${preset.createdAt}`)
        lines.push(`    updatedAt: ${preset.updatedAt}`)
      }
    }

    if (pkg.activePresetId) {
      lines.push(`activePresetId: ${pkg.activePresetId}`)
    }

    if (pkg.schedules && pkg.schedules.length > 0) {
      lines.push('schedules:')
      for (const schedule of pkg.schedules) {
        lines.push(`  - id: ${schedule.id}`)
        lines.push(`    mode: ${schedule.mode}`)
        lines.push(`    time: "${schedule.time}"`)
        lines.push(`    enabled: ${schedule.enabled}`)
        lines.push(`    days: [${schedule.days.join(', ')}]`)
        lines.push(`    label: "${schedule.label}"`)
      }
    }

    if (pkg.customVariables && Object.keys(pkg.customVariables).length > 0) {
      lines.push('customVariables:')
      for (const [key, value] of Object.entries(pkg.customVariables)) {
        lines.push(`  ${key}: "${value}"`)
      }
    }

    return lines.join(prettify ? '\n' : '\n')
  }

  private fromYAML(content: string): ThemePackage {
    const lines = content.split('\n')
    const pkg: Partial<ThemePackage> = {
      presets: [],
      schedules: [],
      customVariables: {}
    }

    let currentSection = ''
    let currentPreset: Partial<ThemePreset> | null = null
    let currentSchedule: Partial<ScheduledSwitch> | null = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      if (trimmed.startsWith('- ')) {
        if (currentSection === 'presets') {
          if (currentPreset && currentPreset.id) {
            pkg.presets!.push(currentPreset as ThemePreset)
          }
          currentPreset = {}
        }
        if (currentSection === 'schedules') {
          if (currentSchedule && currentSchedule.id) {
            pkg.schedules!.push(currentSchedule as ScheduledSwitch)
          }
          currentSchedule = {}
        }
      }

      if (trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':')
        const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '')

        switch (key.trim()) {
          case 'version':
            pkg.version = value
            break
          case 'name':
            pkg.name = value
            break
          case 'description':
            pkg.description = value
            break
          case 'author':
            pkg.author = value
            break
          case 'createdAt':
            pkg.createdAt = parseInt(value) || Date.now()
            break
          case 'themeMode':
            pkg.themeMode = value as ThemeMode
            break
          case 'activePresetId':
            pkg.activePresetId = value || null
            break
          case 'presets':
            currentSection = 'presets'
            break
          case 'schedules':
            currentSection = 'schedules'
            break
          case 'customVariables':
            currentSection = 'customVariables'
            break
        }
      }
    }

    if (currentPreset && currentPreset.id) {
      pkg.presets!.push(currentPreset as ThemePreset)
    }
    if (currentSchedule && currentSchedule.id) {
      pkg.schedules!.push(currentSchedule as ScheduledSwitch)
    }

    return pkg as ThemePackage
  }

  private toTOML(pkg: ThemePackage): string {
    const lines: string[] = []
    lines.push(`version = "${pkg.version}"`)
    lines.push(`name = "${pkg.name}"`)
    if (pkg.description) lines.push(`description = "${pkg.description}"`)
    if (pkg.author) lines.push(`author = "${pkg.author}"`)
    lines.push(`createdAt = ${pkg.createdAt}`)
    lines.push(`themeMode = "${pkg.themeMode}"`)

    if (pkg.presets.length > 0) {
      lines.push('')
      lines.push('[[presets]]')
      for (const preset of pkg.presets) {
        lines.push(`id = "${preset.id}"`)
        lines.push(`name = "${preset.name}"`)
        lines.push(`mode = "${preset.mode}"`)
        lines.push(`createdAt = ${preset.createdAt}`)
        lines.push(`updatedAt = ${preset.updatedAt}`)
        if (preset.customColors) {
          lines.push('[presets.customColors]')
          for (const [key, value] of Object.entries(preset.customColors)) {
            lines.push(`${key} = "${value}"`)
          }
        }
      }
    }

    if (pkg.activePresetId) {
      lines.push(`activePresetId = "${pkg.activePresetId}"`)
    }

    if (pkg.customVariables && Object.keys(pkg.customVariables).length > 0) {
      lines.push('')
      lines.push('[customVariables]')
      for (const [key, value] of Object.entries(pkg.customVariables)) {
        lines.push(`${key} = "${value}"`)
      }
    }

    return lines.join('\n')
  }

  private fromTOML(content: string): ThemePackage {
    const pkg: Partial<ThemePackage> = {
      presets: [],
      customVariables: {}
    }

    const lines = content.split('\n')
    let currentSection = ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      if (trimmed.startsWith('[') && !trimmed.startsWith('[[')) {
        currentSection = trimmed.slice(1, -1)
      }

      if (trimmed.includes(' = ')) {
        const [key, value] = trimmed.split(' = ')
        const cleanValue = value.replace(/^["']|["']$/g, '')

        if (currentSection === '') {
          switch (key.trim()) {
            case 'version':
              pkg.version = cleanValue
              break
            case 'name':
              pkg.name = cleanValue
              break
            case 'description':
              pkg.description = cleanValue
              break
            case 'author':
              pkg.author = cleanValue
              break
            case 'createdAt':
              pkg.createdAt = parseInt(cleanValue) || Date.now()
              break
            case 'themeMode':
              pkg.themeMode = cleanValue as ThemeMode
              break
            case 'activePresetId':
              pkg.activePresetId = cleanValue || null
              break
          }
        }
      }
    }

    return pkg as ThemePackage
  }

  downloadThemePackage(content: string, filename: string, format: 'json' | 'yaml' | 'toml'): void {
    const mimeTypes: Record<string, string> = {
      json: 'application/json',
      yaml: 'text/yaml',
      toml: 'text/plain'
    }

    const blob = new Blob([content], { type: mimeTypes[format] || 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith(`.${format}`) ? filename : `${filename}.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  async readThemeFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    })
  }
}

export const themeImportExport = new ThemeImportExportService()
