/**
 * DramaScriptExcel 增强功能模块
 *
 * 功能：
 * 1. 键盘快捷键系统
 * 2. 撤销/重做系统
 * 3. 智能场景分镜
 * 4. 导出增强
 * 5. 性能优化工具
 */

import { logger } from '@/utils/logger'
import { streamGenerateContent } from '@/api/ai/ai'
import { t } from '@/utils/i18n'
import type { SceneFragment, Character } from './DramaScriptExcel.types'

// ========== 类型定义 ==========

export interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  action: string
  description: string
  category: 'navigation' | 'editing' | 'generation' | 'view' | 'file'
}

export interface HistoryState {
  id: string
  timestamp: string
  action: string
  description: string
  fragments: SceneFragment[]
  characters: Character[]
  selectedIds: string[]
}

export interface SceneBreakdown {
  sceneNumber: number
  title: string
  description: string
  characters: string[]
  location: string
  timeOfDay: string
  mood: string
  duration: number  // 预估时长（秒）
  actions: string[]
  dialogues: Array<{
    character: string
    line: string
    emotion: string
  }>
}

export interface ExportFormat {
  id: string
  name: string
  extension: string
  mimeType: string
  description: string
}

export interface ShareLink {
  id: string
  url: string
  expiresAt: string
  accessCount: number
  maxAccess?: number
  password?: string
}

// ========== 键盘快捷键系统 ==========

/**
 * 快捷键 action 与 i18n key 的映射
 */
const SHORTCUT_KEY_MAP: Record<string, string> = {
  save: 'dramaScript.enhancements.shortcut.save',
  export: 'dramaScript.enhancements.shortcut.export',
  import: 'dramaScript.enhancements.shortcut.import',
  newFragment: 'dramaScript.enhancements.shortcut.newFragment',
  undo: 'dramaScript.enhancements.shortcut.undo',
  redo: 'dramaScript.enhancements.shortcut.redo',
  selectAll: 'dramaScript.enhancements.shortcut.selectAll',
  duplicate: 'dramaScript.enhancements.shortcut.duplicate',
  delete: 'dramaScript.enhancements.shortcut.delete',
  copy: 'dramaScript.enhancements.shortcut.copy',
  paste: 'dramaScript.enhancements.shortcut.paste',
  cut: 'dramaScript.enhancements.shortcut.cut',
  movePrev: 'dramaScript.enhancements.shortcut.movePrev',
  moveNext: 'dramaScript.enhancements.shortcut.moveNext',
  moveFirst: 'dramaScript.enhancements.shortcut.moveFirst',
  moveLast: 'dramaScript.enhancements.shortcut.moveLast',
  search: 'dramaScript.enhancements.shortcut.search',
  goTo: 'dramaScript.enhancements.shortcut.goTo',
  generatePrompt: 'dramaScript.enhancements.shortcut.generatePrompt',
  generateVideo: 'dramaScript.enhancements.shortcut.generateVideo',
  regenerate: 'dramaScript.enhancements.shortcut.regenerate',
  batchGenerate: 'dramaScript.enhancements.shortcut.batchGenerate',
  toggleFullscreen: 'dramaScript.enhancements.shortcut.toggleFullscreen',
  viewTable: 'dramaScript.enhancements.shortcut.viewTable',
  viewTimeline: 'dramaScript.enhancements.shortcut.viewTimeline',
  viewPreview: 'dramaScript.enhancements.shortcut.viewPreview',
  showShortcuts: 'dramaScript.enhancements.shortcut.showShortcuts',
}

/**
 * 获取默认快捷键配置
 */
export function getDefaultShortcuts(): KeyboardShortcut[] {
  const shortcuts: Array<Omit<KeyboardShortcut, 'description'> & { action: string }> = [
    // 文件操作
    { key: 's', ctrlKey: true, action: 'save', category: 'file' },
    { key: 'e', ctrlKey: true, action: 'export', category: 'file' },
    { key: 'o', ctrlKey: true, action: 'import', category: 'file' },
    { key: 'n', ctrlKey: true, action: 'newFragment', category: 'file' },

    // 编辑操作
    { key: 'z', ctrlKey: true, action: 'undo', category: 'editing' },
    { key: 'y', ctrlKey: true, action: 'redo', category: 'editing' },
    { key: 'z', ctrlKey: true, shiftKey: true, action: 'redo', category: 'editing' },
    { key: 'a', ctrlKey: true, action: 'selectAll', category: 'editing' },
    { key: 'd', ctrlKey: true, action: 'duplicate', category: 'editing' },
    { key: 'Delete', action: 'delete', category: 'editing' },
    { key: 'Backspace', action: 'delete', category: 'editing' },
    { key: 'c', ctrlKey: true, action: 'copy', category: 'editing' },
    { key: 'v', ctrlKey: true, action: 'paste', category: 'editing' },
    { key: 'x', ctrlKey: true, action: 'cut', category: 'editing' },

    // 导航
    { key: 'ArrowUp', action: 'movePrev', category: 'navigation' },
    { key: 'ArrowDown', action: 'moveNext', category: 'navigation' },
    { key: 'Home', ctrlKey: true, action: 'moveFirst', category: 'navigation' },
    { key: 'End', ctrlKey: true, action: 'moveLast', category: 'navigation' },
    { key: 'f', ctrlKey: true, action: 'search', category: 'navigation' },
    { key: 'g', ctrlKey: true, action: 'goTo', category: 'navigation' },

    // 生成操作
    { key: 'Enter', ctrlKey: true, action: 'generatePrompt', category: 'generation' },
    { key: 'Enter', ctrlKey: true, shiftKey: true, action: 'generateVideo', category: 'generation' },
    { key: 'r', ctrlKey: true, action: 'regenerate', category: 'generation' },
    { key: 'b', ctrlKey: true, action: 'batchGenerate', category: 'generation' },

    // 视图
    { key: 'F11', action: 'toggleFullscreen', category: 'view' },
    { key: '1', ctrlKey: true, action: 'viewTable', category: 'view' },
    { key: '2', ctrlKey: true, action: 'viewTimeline', category: 'view' },
    { key: '3', ctrlKey: true, action: 'viewPreview', category: 'view' },
    { key: '/', ctrlKey: true, action: 'showShortcuts', category: 'view' },
  ]

  return shortcuts.map(item => ({
    ...item,
    description: SHORTCUT_KEY_MAP[item.action] ? t(SHORTCUT_KEY_MAP[item.action]) : '',
  })) as KeyboardShortcut[]
}

/**
 * 快捷键管理器
 */
export class ShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map()
  private handlers: Map<string, () => void> = new Map()
  private enabled: boolean = true
  private boundHandler: (e: KeyboardEvent) => void

  constructor() {
    this.boundHandler = this.handleKeyDown.bind(this)
    this.loadShortcuts()
  }

  private loadShortcuts(): void {
    const shortcuts = getDefaultShortcuts()
    shortcuts.forEach(shortcut => {
      const key = this.getShortcutKey(shortcut)
      this.shortcuts.set(key, shortcut)
    })
  }

  private getShortcutKey(shortcut: KeyboardShortcut): string {
    const parts: string[] = []
    if (shortcut.ctrlKey) parts.push('ctrl')
    if (shortcut.shiftKey) parts.push('shift')
    if (shortcut.altKey) parts.push('alt')
    if (shortcut.metaKey) parts.push('meta')
    parts.push(shortcut.key.toLowerCase())
    return parts.join('+')
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.enabled) return

    // 忽略在输入框中的快捷键
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // 只允许Escape和特定组合键
      if (e.key !== 'Escape' && !(e.ctrlKey || e.metaKey)) {
        return
      }
    }

    const key = this.getShortcutKey({
      key: e.key,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      action: '',
      description: '',
      category: 'editing',
    })

    const shortcut = this.shortcuts.get(key)
    if (shortcut) {
      const handler = this.handlers.get(shortcut.action)
      if (handler) {
        e.preventDefault()
        e.stopPropagation()
        handler()
      }
    }
  }

  /**
   * 注册快捷键处理器
   */
  registerHandler(action: string, handler: () => void): void {
    this.handlers.set(action, handler)
  }

  /**
   * 批量注册处理器
   */
  registerHandlers(handlers: Record<string, () => void>): void {
    Object.entries(handlers).forEach(([action, handler]) => {
      this.registerHandler(action, handler)
    })
  }

  /**
   * 启用快捷键
   */
  enable(): void {
    if (!this.enabled) {
      this.enabled = true
      document.addEventListener('keydown', this.boundHandler)
    }
  }

  /**
   * 禁用快捷键
   */
  disable(): void {
    if (this.enabled) {
      this.enabled = false
      document.removeEventListener('keydown', this.boundHandler)
    }
  }

  /**
   * 挂载到文档
   */
  mount(): void {
    document.addEventListener('keydown', this.boundHandler)
  }

  /**
   * 从文档卸载
   */
  unmount(): void {
    document.removeEventListener('keydown', this.boundHandler)
  }

  /**
   * 获取所有快捷键（按分类）
   */
  getShortcutsByCategory(): Record<string, KeyboardShortcut[]> {
    const result: Record<string, KeyboardShortcut[]> = {}
    this.shortcuts.forEach(shortcut => {
      if (!result[shortcut.category]) {
        result[shortcut.category] = []
      }
      result[shortcut.category].push(shortcut)
    })
    return result
  }

  /**
   * 格式化快捷键显示
   */
  formatShortcut(shortcut: KeyboardShortcut): string {
    const parts: string[] = []
    if (shortcut.ctrlKey) parts.push('Ctrl')
    if (shortcut.shiftKey) parts.push('Shift')
    if (shortcut.altKey) parts.push('Alt')
    if (shortcut.metaKey) parts.push('⌘')

    let key = shortcut.key
    if (key === 'ArrowUp') key = '↑'
    else if (key === 'ArrowDown') key = '↓'
    else if (key === 'ArrowLeft') key = '←'
    else if (key === 'ArrowRight') key = '→'
    else if (key === 'Delete') key = 'Del'
    else if (key === 'Backspace') key = '⌫'
    else if (key === 'Enter') key = '↵'
    else if (key === 'Escape') key = 'Esc'
    else key = key.toUpperCase()

    parts.push(key)
    return parts.join(' + ')
  }
}

// ========== 撤销/重做系统 ==========

/**
 * 历史记录管理器
 */
export class HistoryManager {
  private history: HistoryState[] = []
  private currentIndex: number = -1
  private maxHistory: number = 50
  private lastSaveTime: number = 0
  private saveDebounce: number = 500  // 500ms内的连续操作合并

  /**
   * 记录状态
   */
  pushState(
    action: string,
    description: string,
    fragments: SceneFragment[],
    characters: Character[],
    selectedIds: string[] = []
  ): void {
    const now = Date.now()

    // 如果距离上次保存时间很短，且是同类操作，则更新而不是新增
    if (
      now - this.lastSaveTime < this.saveDebounce &&
      this.currentIndex >= 0 &&
      this.history[this.currentIndex].action === action
    ) {
      this.history[this.currentIndex] = {
        id: this.history[this.currentIndex].id,
        timestamp: new Date().toISOString(),
        action,
        description,
        fragments: JSON.parse(JSON.stringify(fragments)),
        characters: JSON.parse(JSON.stringify(characters)),
        selectedIds: [...selectedIds],
      }
      this.lastSaveTime = now
      return
    }

    // 如果当前不在历史末尾，删除后面的记录
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1)
    }

    // 添加新状态
    const state: HistoryState = {
      id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      action,
      description,
      fragments: JSON.parse(JSON.stringify(fragments)),
      characters: JSON.parse(JSON.stringify(characters)),
      selectedIds: [...selectedIds],
    }

    this.history.push(state)
    this.currentIndex = this.history.length - 1
    this.lastSaveTime = now

    // 限制历史记录数量
    if (this.history.length > this.maxHistory) {
      this.history.shift()
      this.currentIndex--
    }
  }

  /**
   * 撤销
   */
  undo(): HistoryState | null {
    if (!this.canUndo()) return null

    this.currentIndex--
    return this.history[this.currentIndex]
  }

  /**
   * 重做
   */
  redo(): HistoryState | null {
    if (!this.canRedo()) return null

    this.currentIndex++
    return this.history[this.currentIndex]
  }

  /**
   * 是否可以撤销
   */
  canUndo(): boolean {
    return this.currentIndex > 0
  }

  /**
   * 是否可以重做
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1
  }

  /**
   * 获取当前状态
   */
  getCurrentState(): HistoryState | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.history.length) {
      return null
    }
    return this.history[this.currentIndex]
  }

  /**
   * 获取历史记录列表
   */
  getHistory(): HistoryState[] {
    return [...this.history]
  }

  /**
   * 获取撤销栈描述
   */
  getUndoStack(): string[] {
    return this.history.slice(0, this.currentIndex + 1).map(s => s.description).reverse()
  }

  /**
   * 获取重做栈描述
   */
  getRedoStack(): string[] {
    return this.history.slice(this.currentIndex + 1).map(s => s.description)
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.history = []
    this.currentIndex = -1
  }

  /**
   * 跳转到指定状态
   */
  goToState(stateId: string): HistoryState | null {
    const index = this.history.findIndex(s => s.id === stateId)
    if (index === -1) return null

    this.currentIndex = index
    return this.history[index]
  }
}

// ========== 智能场景分镜 ==========

/**
 * 将剧本文本拆分为场景
 */
export function parseScriptToScenes(
  scriptText: string,
  characters: Character[]
): Promise<SceneBreakdown[]> {
  return new Promise((resolve) => {
    if (!scriptText.trim()) {
      resolve([])
      return
    }

    const characterNames = characters.map(c => c.name).join(', ')

    const prompt = `${t('dramaScript.enhancements.scriptParse.promptAsScreenwriter')}

${t('dramaScript.enhancements.scriptParse.promptScriptContent')}
${scriptText}

${t('dramaScript.enhancements.scriptParse.promptAvailableCharacters')}
${characterNames || t('dramaScript.enhancements.scriptParse.promptNotSpecified')}

${t('dramaScript.enhancements.scriptParse.promptSplitRequest')}
{
  "${t('dramaScript.enhancements.scriptParse.promptSceneNumber')}": 场景序号,
  "${t('dramaScript.enhancements.scriptParse.promptTitle')}": "场景标题",
  "${t('dramaScript.enhancements.scriptParse.promptDescription')}",
  "${t('dramaScript.enhancements.scriptParse.promptCharacters')}": ["出场角色"],
  "${t('dramaScript.enhancements.scriptParse.promptLocation')}",
  "${t('dramaScript.enhancements.scriptParse.promptTimeOfDay')}",
  "${t('dramaScript.enhancements.scriptParse.promptMood')}",
  "${t('dramaScript.enhancements.scriptParse.promptDuration')},
  "${t('dramaScript.enhancements.scriptParse.promptActions')}": ["动作描述"],
  "${t('dramaScript.enhancements.scriptParse.promptDialogues')}": [{"${t('dramaScript.enhancements.scriptParse.promptDialogueCharacter')}", "${t('dramaScript.enhancements.scriptParse.promptDialogueLine')}", "${t('dramaScript.enhancements.scriptParse.promptDialogueEmotion')}"}]
}

${t('dramaScript.enhancements.scriptParse.promptReturnJson')}`

    let generatedContent = ''

    void streamGenerateContent(
      {
        prompt,
        modelId: 'gpt-4',
        type: 'text',
        parameters: { temperature: 0.5, maxTokens: 4000 },
      },
      (chunk: string) => {
        generatedContent += chunk
      },
      () => {
        try {
          const jsonMatch = generatedContent.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const scenes = JSON.parse(jsonMatch[0]) as SceneBreakdown[]
            resolve(scenes)
          } else {
            resolve([])
          }
        } catch (error) {
          logger.error('Failed to parse scene:', error)
          resolve([])
        }
      },
      (error) => {
        logger.error('Scene storyboarding failed:', error)
        resolve([])
      }
    )
  })
}

/**
 * 从场景分镜创建片段
 */
export function createFragmentsFromScenes(
  scenes: SceneBreakdown[],
  characters: Character[]
): SceneFragment[] {
  return scenes.map((scene, index) => {
    // 找到匹配的角色
    const mainCharacter = scene.characters[0] || ''
    const character = characters.find(c =>
      c.name.toLowerCase() === mainCharacter.toLowerCase()
    )

    // 构建描述
    let description = scene.description
    if (scene.dialogues.length > 0) {
      const dialogueText = scene.dialogues
        .map(d => `${d.character}(${d.emotion}): "${d.line}"`)
        .join('\n')
      description += `\n\n${t('dramaScript.enhancements.scriptParse.dialogueLabel')}：\n${dialogueText}`
    }

    return {
      id: `fragment-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      sequence: index + 1,
      character: mainCharacter,
      scene: `${scene.location} - ${scene.timeOfDay}`,
      description,
      firstFramePrompt: '',
      videoPrompt: '',
      characterAppearance: {
        characterId: character?.id,
        imageUrl: character?.appearance?.imageUrl,
        description: character?.appearance?.description || '',
      },
      voice: {
        characterId: character?.id,
        voiceId: character?.voice?.voiceId,
        description: character?.voice?.description || '',
      },
      usePreviousLastFrame: index > 0,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })
}

// ========== 导出增强 ==========

/**
 * 导出格式 id 与 i18n key 的映射
 */
const EXPORT_FORMAT_KEY_MAP: Record<string, { nameKey: string; descriptionKey: string }> = {
  json: {
    nameKey: 'dramaScript.enhancements.exportFormat.json.name',
    descriptionKey: 'dramaScript.enhancements.exportFormat.json.description',
  },
  xlsx: {
    nameKey: 'dramaScript.enhancements.exportFormat.xlsx.name',
    descriptionKey: 'dramaScript.enhancements.exportFormat.xlsx.description',
  },
  csv: {
    nameKey: 'dramaScript.enhancements.exportFormat.csv.name',
    descriptionKey: 'dramaScript.enhancements.exportFormat.csv.description',
  },
  markdown: {
    nameKey: 'dramaScript.enhancements.exportFormat.markdown.name',
    descriptionKey: 'dramaScript.enhancements.exportFormat.markdown.description',
  },
  txt: {
    nameKey: 'dramaScript.enhancements.exportFormat.txt.name',
    descriptionKey: 'dramaScript.enhancements.exportFormat.txt.description',
  },
  html: {
    nameKey: 'dramaScript.enhancements.exportFormat.html.name',
    descriptionKey: 'dramaScript.enhancements.exportFormat.html.description',
  },
}

/**
 * 获取支持的导出格式
 */
export function getExportFormats(): ExportFormat[] {
  const formats: Array<{ id: string; extension: string; mimeType: string }> = [
    { id: 'json', extension: 'json', mimeType: 'application/json' },
    { id: 'xlsx', extension: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    { id: 'csv', extension: 'csv', mimeType: 'text/csv' },
    { id: 'markdown', extension: 'md', mimeType: 'text/markdown' },
    { id: 'txt', extension: 'txt', mimeType: 'text/plain' },
    { id: 'html', extension: 'html', mimeType: 'text/html' },
  ]

  return formats.map(format => {
    const keys = EXPORT_FORMAT_KEY_MAP[format.id]
    return {
      ...format,
      name: keys ? t(keys.nameKey) : format.id,
      description: keys ? t(keys.descriptionKey) : '',
    }
  })
}

/**
 * 导出为Markdown
 */
export function exportToMarkdown(
  fragments: SceneFragment[],
  characters: Character[],
  projectName: string = t('dramaScript.enhancements.defaultProjectName')
): string {
  let md = `# ${projectName}\n\n`
  md += `> ${t('dramaScript.enhancements.markdown.generationTime')}: ${new Date().toLocaleString()}\n\n`

  // 角色列表
  if (characters.length > 0) {
    md += `## ${t('dramaScript.enhancements.markdown.characterList')}\n\n`
    characters.forEach(char => {
      md += `### ${char.name}\n`
      md += `- ${t('dramaScript.enhancements.markdown.appearance')}: ${char.appearance?.description || t('dramaScript.enhancements.markdown.notSet')}\n`
      md += `- ${t('dramaScript.enhancements.markdown.voice')}: ${char.voice?.description || t('dramaScript.enhancements.markdown.notSet')}\n\n`
    })
  }

  // 场景列表
  md += `## ${t('dramaScript.enhancements.markdown.sceneList')}\n\n`
  md += `${t('dramaScript.enhancements.markdown.totalScenes')} ${fragments.length} ${t('dramaScript.enhancements.markdown.scenesUnit')}\n\n`

  fragments.forEach((fragment, _index) => {
    md += `---\n\n`
    md += `### ${t('dramaScript.enhancements.markdown.sceneLabel')} ${fragment.sequence}: ${fragment.scene || t('dramaScript.enhancements.markdown.unnamedScene')}\n\n`
    md += `**${t('dramaScript.enhancements.markdown.character')}**: ${fragment.character || t('dramaScript.enhancements.markdown.notSpecified')}\n\n`
    md += `**${t('dramaScript.enhancements.markdown.description')}**:\n${fragment.description || t('dramaScript.enhancements.markdown.noDescription')}\n\n`

    if (fragment.videoPrompt) {
      md += `**${t('dramaScript.enhancements.markdown.videoPrompt')}**:\n\`\`\`\n${fragment.videoPrompt}\n\`\`\`\n\n`
    }

    md += `**${t('dramaScript.enhancements.markdown.status')}**: ${getStatusText(fragment.status)}\n`
    if (fragment.qualityScore !== undefined) {
      md += `**${t('dramaScript.enhancements.markdown.qualityScore')}**: ${fragment.qualityScore}/100\n`
    }
    md += '\n'
  })

  return md
}

/**
 * 导出为HTML预览
 */
export function exportToHTML(
  fragments: SceneFragment[],
  characters: Character[],
  projectName: string = t('dramaScript.enhancements.defaultProjectName')
): string {
  const styles = `
    <style>
      :root { --global-border-radius: 8px; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--el-bg-color-page, var(--color-neutral-100)); color: var(--el-text-color-primary, var(--el-text-color-primary)); line-height: 1.6; }
      .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
      h1 { text-align: center; color: var(--el-text-color-primary, var(--color-dark-1a1a2e)); margin-bottom: 10px; }
      .meta { text-align: center; color: var(--el-text-color-secondary, var(--el-text-color-secondary)); margin-bottom: 40px; }
      .section { background: var(--el-bg-color, white); border-radius: var(--global-border-radius, 8px); padding: 24px; margin-bottom: 24px; }
      .section h2 { color: var(--el-text-color-primary, var(--color-dark-1a1a2e)); border-bottom: 2px solid var(--border-unified-color, var(--color-gray-333)); padding-bottom: 10px; margin-bottom: 20px; }
      .character-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; }
      .character-card { background: var(--el-fill-color-lighter, var(--color-gray-f8f9fa)); border-radius: var(--global-border-radius, 8px); padding: 16px; }
      .character-name { font-weight: 600; color: var(--el-text-color-primary, var(--color-gray-333)); margin-bottom: 8px; }
      .scene-card { border-left: 4px solid var(--border-unified-color, var(--color-gray-333)); padding-left: 20px; margin-bottom: 24px; }
      .scene-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .scene-number { background: var(--el-text-color-primary, var(--color-gray-333)); color: var(--el-bg-color-page, white); padding: 4px 12px; border-radius: var(--global-border-radius, 8px); font-size: 14px; }
      .scene-title { font-size: 18px; font-weight: 600; }
      .scene-meta { color: var(--el-text-color-secondary, var(--el-text-color-secondary)); font-size: 14px; margin-bottom: 12px; }
      .scene-desc { background: var(--el-fill-color-lighter, var(--color-gray-f8f9fa)); padding: 16px; border-radius: var(--global-border-radius, 8px); margin-bottom: 12px; }
      .prompt-box { background: var(--dark-bg-2, var(--color-dark-1a1a2e)); color: var(--el-text-color-secondary, var(--el-text-color-primary)); padding: 16px; border-radius: var(--global-border-radius, 8px); font-family: monospace; font-size: 13px; overflow-x: auto; }
      .status { display: inline-block; padding: 4px 12px; border-radius: var(--global-border-radius, 8px); font-size: 12px; }
      .status-completed { background: var(--el-color-success-light-7, var(--el-text-color-primary)); color: var(--el-color-success-dark-2, var(--el-text-color-primary)); }
      .status-pending { background: var(--el-color-warning-light-7, var(--el-text-color-primary)); color: var(--el-color-warning-dark-2, var(--el-text-color-primary)); }
      .status-failed { background: var(--el-color-danger-light-7, var(--el-text-color-primary)); color: var(--el-color-danger-dark-2, var(--el-text-color-primary)); }
      .video-preview { width: 100%; max-width: 400px; border-radius: var(--global-border-radius, 8px); margin-top: 12px; }
    </style>
  `

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName}</title>
  ${styles}
</head>
<body>
  <div class="container">
    <h1>${projectName}</h1>
    <p class="meta">${t('dramaScript.enhancements.html.generationTime')}: ${new Date().toLocaleString()} | ${t('dramaScript.enhancements.html.totalScenes')} ${fragments.length} ${t('dramaScript.enhancements.html.scenesUnit')}</p>
`

  // 角色部分
  if (characters.length > 0) {
    html += `
    <div class="section">
      <h2>${t('dramaScript.enhancements.html.characterList')}</h2>
      <div class="character-grid">
`
    characters.forEach(char => {
      html += `
        <div class="character-card">
          <div class="character-name">${char.name}</div>
          <div>${t('dramaScript.enhancements.html.appearance')}: ${char.appearance?.description || t('dramaScript.enhancements.html.notSet')}</div>
          <div>${t('dramaScript.enhancements.html.voice')}: ${char.voice?.description || t('dramaScript.enhancements.html.notSet')}</div>
        </div>
`
    })
    html += `
      </div>
    </div>
`
  }

  // 场景部分
  html += `
    <div class="section">
      <h2>${t('dramaScript.enhancements.html.sceneList')}</h2>
`

  fragments.forEach(fragment => {
    const statusClass = fragment.status === 'completed' ? 'status-completed'
      : fragment.status === 'failed' ? 'status-failed' : 'status-pending'

    html += `
      <div class="scene-card">
        <div class="scene-header">
          <span class="scene-number">${t('dramaScript.enhancements.html.sceneLabel')} ${fragment.sequence}</span>
          <span class="scene-title">${fragment.scene || t('dramaScript.enhancements.html.unnamed')}</span>
          <span class="status ${statusClass}">${getStatusText(fragment.status)}</span>
        </div>
        <div class="scene-meta">${t('dramaScript.enhancements.html.character')}: ${fragment.character || t('dramaScript.enhancements.html.notSpecified')}</div>
        <div class="scene-desc">${fragment.description || t('dramaScript.enhancements.html.noDescription')}</div>
`
    if (fragment.videoPrompt) {
      html += `
        <div class="prompt-box">${escapeHtml(fragment.videoPrompt)}</div>
`
    }
    if (fragment.videoUrl) {
      html += `
        <video class="video-preview" controls src="${fragment.videoUrl}"></video>
`
    }
    html += `
      </div>
`
  })

  html += `
    </div>
  </div>
</body>
</html>`

  return html
}

/**
 * 状态与 i18n key 的映射
 */
const STATUS_KEY_MAP: Record<string, string> = {
  pending: 'dramaScript.enhancements.status.pending',
  generating: 'dramaScript.enhancements.status.generating',
  completed: 'dramaScript.enhancements.status.completed',
  failed: 'dramaScript.enhancements.status.failed',
}

/**
 * 获取状态文本
 */
function getStatusText(status: string): string {
  const key = STATUS_KEY_MAP[status]
  return key ? t(key) : status
}

/**
 * HTML转义
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// ========== 性能优化工具 ==========

export { debounce, throttle } from '@/utils/format'

/**
 * 虚拟滚动计算
 */
export function calculateVirtualScroll(
  totalItems: number,
  itemHeight: number,
  containerHeight: number,
  scrollTop: number,
  overscan: number = 3
): {
  startIndex: number
  endIndex: number
  offsetTop: number
  visibleCount: number
} {
  const visibleCount = Math.ceil(containerHeight / itemHeight)
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(totalItems - 1, startIndex + visibleCount + overscan * 2)
  const offsetTop = startIndex * itemHeight

  return {
    startIndex,
    endIndex,
    offsetTop,
    visibleCount,
  }
}

/**
 * 缓存管理器
 */
export class CacheManager<T> {
  private cache: Map<string, { data: T; timestamp: number }> = new Map()
  private maxSize: number
  private ttl: number  // 生存时间（毫秒）

  constructor(maxSize: number = 100, ttl: number = 5 * 60 * 1000) {
    this.maxSize = maxSize
    this.ttl = ttl
  }

  get(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    // 检查是否过期
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.data
  }

  set(key: string, data: T): void {
    // 如果缓存已满，删除最旧的项
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    })
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

/**
 * 图片预加载
 */
export function preloadImages(urls: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(
    urls.map(url => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = url
      })
    })
  )
}

/**
 * 延迟执行
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
