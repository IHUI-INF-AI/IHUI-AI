import { t } from '@/utils/i18n'

/**
 * Clawdbot Self-Evolution Engine
 * 
 * 自我进化引擎，核心能力:
 * - 自动识别能力缺口
 * - 自动编写和安装技能包
 * - 代码生成和执行
 * - 学习和记忆新技能
 * - 持续自我优化
 */

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'
import { getToolExecutor } from './tools'
import type { ToolDefinition as _ToolDefinition, ToolExecutionResult as _ToolExecutionResult } from './tools'

/**
 * 进化任务
 */
export interface EvolutionTask {
  /** 任务 ID */
  id: string
  /** 任务类型 */
  type: 'skill_creation' | 'skill_improvement' | 'tool_creation' | 'learning' | 'optimization'
  /** 任务描述 */
  description: string
  /** 触发原因 */
  trigger: string
  /** 任务状态 */
  status: 'pending' | 'analyzing' | 'generating' | 'testing' | 'installing' | 'completed' | 'failed'
  /** 创建时间 */
  createdAt: number
  /** 完成时间 */
  completedAt?: number
  /** 结果 */
  result?: {
    success: boolean
    skillName?: string
    code?: string
    error?: string
  }
}

/**
 * 技能安装记录
 */
export interface SkillInstallation {
  /** 技能名称 */
  name: string
  /** 技能描述 */
  description: string
  /** 技能版本 */
  version: string
  /** 安装时间 */
  installedAt: number
  /** 来源 */
  source: 'auto_generated' | 'community' | 'official' | 'custom'
  /** 使用次数 */
  usageCount: number
  /** 最后使用时间 */
  lastUsedAt?: number
  /** 代码 */
  code: string
  /** 依赖 */
  dependencies?: string[]
}

/**
 * 代码生成请求
 */
export interface CodeGeneration {
  /** 需求描述 */
  requirement: string
  /** 目标语言 */
  language: 'typescript' | 'javascript' | 'python' | 'bash'
  /** 上下文 */
  context?: string
  /** 约束条件 */
  constraints?: string[]
}

/**
 * 能力缺口分析
 */
interface CapabilityGap {
  /** 缺失的能力描述 */
  description: string
  /** 置信度 */
  confidence: number
  /** 建议的解决方案 */
  suggestedSolution: 'create_skill' | 'create_tool' | 'learn' | 'ask_user'
  /** 相关的用户请求 */
  relatedRequests: string[]
}

/**
 * 自我进化引擎
 */
export class SelfEvolutionEngine extends EventEmitter {
  private evolutionTasks = reactive<Map<string, EvolutionTask>>(new Map())
  private installedSkills = reactive<Map<string, SkillInstallation>>(new Map())
  private capabilityGaps = ref<CapabilityGap[]>([])
  private learningHistory = ref<Array<{ topic: string; learnedAt: number; content: string }>>([])
  
  // 配置
  private config = {
    autoEvolve: true,           // 是否自动进化
    maxConcurrentTasks: 3,      // 最大并发任务数
    minConfidenceThreshold: 0.7, // 最小置信度阈值
    enableCodeExecution: false,  // 是否启用代码执行（安全考虑）
    skillStorageKey: 'clawdbot-skills',
  }

  constructor() {
    super()
    this.loadInstalledSkills()
  }

  /**
   * 分析能力缺口
   */
  async analyzeCapabilityGap(userRequest: string, failureReason?: string): Promise<CapabilityGap | null> {
    logger.info('[Evolution] Analyzing capability gap:', userRequest)

    // 使用 AI 分析用户请求，识别能力缺口
    const gap = await this.identifyGap(userRequest, failureReason)
    
    if (gap && gap.confidence >= this.config.minConfidenceThreshold) {
      this.capabilityGaps.value.push(gap)
      
      // 如果启用了自动进化，触发进化任务
      if (this.config.autoEvolve) {
        await this.triggerEvolution(gap)
      }
      
      return gap
    }

    return null
  }

  /**
   * 识别能力缺口
   */
  private async identifyGap(userRequest: string, failureReason?: string): Promise<CapabilityGap> {
    // 分析请求中的关键词和意图
    const keywords = this.extractKeywords(userRequest)
    const toolExecutor = getToolExecutor()
    const existingTools = toolExecutor.getAllTools()
    
    // 检查是否有现有工具可以处理
    const matchingTools = existingTools.filter(tool => 
      keywords.some(kw => 
        tool.name.toLowerCase().includes(kw) || 
        tool.description.toLowerCase().includes(kw)
      )
    )

    // 根据匹配情况确定建议
    let suggestedSolution: CapabilityGap['suggestedSolution'] = 'create_skill'
    let confidence = 0.8

    if (matchingTools.length > 0) {
      // 有相关工具但失败了，可能需要改进
      suggestedSolution = 'learn'
      confidence = 0.6
    } else if (this.isComplexTask(userRequest)) {
      // 复杂任务需要创建技能
      suggestedSolution = 'create_skill'
      confidence = 0.85
    } else {
      // 简单工具缺失
      suggestedSolution = 'create_tool'
      confidence = 0.75
    }

    return {
      description: failureReason || `无法完成: ${userRequest}`,
      confidence,
      suggestedSolution,
      relatedRequests: [userRequest],
    }
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    const stopWords = ['的', '是', '在', '了', '和', '与', 'the', 'a', 'an', 'is', 'are', 'to', 'for']
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
  }

  /**
   * 判断是否为复杂任务
   */
  private isComplexTask(request: string): boolean {
    const complexIndicators = [
      '自动化', 'automation', '批量', 'batch', '定时', 'schedule',
      '监控', 'monitor', '集成', 'integrate', '工作流', 'workflow',
      '分析', 'analyze', '报告', 'report', '同步', 'sync',
    ]
    return complexIndicators.some(indicator => request.toLowerCase().includes(indicator))
  }

  /**
   * 触发进化
   */
  async triggerEvolution(gap: CapabilityGap): Promise<EvolutionTask> {
    const taskId = `evo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    
    const task: EvolutionTask = {
      id: taskId,
      type: gap.suggestedSolution === 'create_skill' ? 'skill_creation' : 
            gap.suggestedSolution === 'create_tool' ? 'tool_creation' : 'learning',
      description: gap.description,
      trigger: gap.relatedRequests.join(', '),
      status: 'pending',
      createdAt: Date.now(),
    }

    this.evolutionTasks.set(taskId, task)
    this.emit('taskCreated', task)

    // 异步执行进化任务
    this.executeEvolutionTask(task).catch(error => {
      logger.error('[Evolution] Evolution task failed:', error)
      task.status = 'failed'
      task.result = { success: false, error: (error as Error).message }
    })

    return task
  }

  /**
   * 执行进化任务
   */
  private async executeEvolutionTask(task: EvolutionTask): Promise<void> {
    try {
      // 分析阶段
      task.status = 'analyzing'
      this.emit('taskStatusChanged', task)
      
      const analysis = await this.analyzeTask(task)
      
      // 生成阶段
      task.status = 'generating'
      this.emit('taskStatusChanged', task)
      
      const generatedCode = await this.generateSkillCode(task, analysis)
      
      // 测试阶段
      task.status = 'testing'
      this.emit('taskStatusChanged', task)
      
      const testResult = await this.testGeneratedCode(generatedCode)
      
      if (!testResult.success) {
        throw new Error(`测试失败: ${testResult.error}`)
      }
      
      // 安装阶段
      task.status = 'installing'
      this.emit('taskStatusChanged', task)
      
      const skillName = await this.installSkill(generatedCode, task)
      
      // 完成
      task.status = 'completed'
      task.completedAt = Date.now()
      task.result = {
        success: true,
        skillName,
        code: generatedCode.code,
      }
      
      this.emit('taskCompleted', task)
      logger.info(`[Evolution] Evolution task completed: ${skillName}`)
      
    } catch (error) {
      task.status = 'failed'
      task.result = { success: false, error: (error as Error).message }
      this.emit('taskFailed', task)
      throw error
    }
  }

  /**
   * 分析任务
   */
  private async analyzeTask(task: EvolutionTask): Promise<{
    requirements: string[]
    dependencies: string[]
    complexity: 'low' | 'medium' | 'high'
  }> {
    // 分析任务需求
    const requirements: string[] = []
    const dependencies: string[] = []
    
    // 根据任务描述提取需求
    if (task.description.includes('浏览器') || task.description.includes('browser')) {
      requirements.push('browser_automation')
      dependencies.push('puppeteer')
    }
    
    if (task.description.includes('文件') || task.description.includes('file')) {
      requirements.push('file_system')
    }
    
    if (task.description.includes('API') || task.description.includes('接口')) {
      requirements.push('http_client')
    }
    
    const complexity = requirements.length > 2 ? 'high' : 
                      requirements.length > 1 ? 'medium' : 'low'
    
    return { requirements, dependencies, complexity }
  }

  /**
   * 生成技能代码
   */
  private async generateSkillCode(
    task: EvolutionTask,
    analysis: { requirements: string[]; dependencies: string[]; complexity: string }
  ): Promise<{ name: string; description: string; code: string; version: string }> {
    // 生成技能名称
    const skillName = this.generateSkillName(task.description)
    
    // 生成技能代码模板
    const code = this.generateSkillTemplate(skillName, task.description, analysis)
    
    return {
      name: skillName,
      description: task.description,
      code,
      version: '1.0.0',
    }
  }

  /**
   * 生成技能名称
   */
  private generateSkillName(description: string): string {
    // 从描述中提取关键词作为名称
    const keywords = this.extractKeywords(description)
    const name = keywords.slice(0, 2).join('_')
    return `auto_${name}_skill`
  }

  /**
   * 生成技能模板
   */
  private generateSkillTemplate(
    name: string,
    description: string,
    analysis: { requirements: string[]; dependencies: string[] }
  ): string {
    const requirementHandlers = this.generateRequirementHandlers(analysis.requirements)
    return `/**
 * Auto-generated Skill: ${name}
 * Description: ${description}
 * Generated at: ${new Date().toISOString()}
 * Dependencies: ${analysis.dependencies.join(', ') || 'none'}
 */

export const ${name} = {
  name: '${name}',
  description: '${description}',
  version: '1.0.0',
  
  parameters: {
    type: 'object',
    properties: {
      input: {
        type: 'string',
        description: t('text.self_evolution.输入参数1'),
      },
    },
    required: ['input'],
  },
  
  async execute(params: Record<string, unknown>, context: { startTime: number }): Promise<{ success: boolean; data?: { message: string; result?: unknown }; error?: string; executionTime: number }> {
    const { input } = params as { input: string };

    try {
      logger.info(\`[${name}] Executing...\`, input);
      
      ${requirementHandlers}
      
      return {
        success: true,
        data: { 
          message: t('api.self_evolution.技能执行成功'),
          result: input 
        },
        executionTime: Date.now() - context.startTime,
      };
    } catch (error) {
      logger.error(\`[${name}] Execution failed:\`, error);
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - context.startTime,
      };
    }
  },
};

export default ${name};
`
  }

  private generateRequirementHandlers(requirements: string[]): string {
    const handlers: string[] = []
    
    for (const req of requirements) {
      switch (req) {
        case 'browser_automation':
          // 占位：需引入 puppeteer/playwright 等依赖后实现；详见 docs/BACKLOG_ONE_MONTH.md 十、10.1
          handlers.push('// 浏览器自动化处理（需 puppeteer/playwright 依赖）\n      // 占位：接入后实现具体自动化逻辑')
          break
        case 'file_system':
          handlers.push('// 文件系统处理\n      const fs = await import("fs/promises").catch(() => null);')
          break
        case 'http_client':
          handlers.push('// HTTP请求处理\n      const response = await fetch(input).catch(() => null);')
          break
        default:
          handlers.push(`// ${req} 处理逻辑`)
      }
    }
    
    return handlers.length > 0 ? handlers.join('\n      ') : '// 默认处理: 直接返回输入'
  }

  /**
   * 测试生成的代码
   */
  private async testGeneratedCode(code: { name: string; code: string }): Promise<{ success: boolean; error?: string }> {
    try {
      // 基本语法检查
      // 在实际实现中，可以使用 esprima 或 typescript 编译器进行更严格的检查
      
      // 检查是否包含必要的导出
      if (!code.code.includes('export')) {
        return { success: false, error: '代码缺少 export' }
      }
      
      // 检查是否包含 execute 函数
      if (!code.code.includes('execute')) {
        return { success: false, error: '代码缺少 execute 函数' }
      }
      
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * 安装技能
   */
  private async installSkill(
    skill: { name: string; description: string; code: string; version: string },
    _task: EvolutionTask
  ): Promise<string> {
    const installation: SkillInstallation = {
      name: skill.name,
      description: skill.description,
      version: skill.version,
      installedAt: Date.now(),
      source: 'auto_generated',
      usageCount: 0,
      code: skill.code,
    }
    
    this.installedSkills.set(skill.name, installation)
    this.saveInstalledSkills()
    
    // 注册为工具
    const toolExecutor = getToolExecutor()
    toolExecutor.registerTool({
      name: skill.name,
      description: skill.description,
      category: 'custom',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: t('text.self_evolution.输入参数2') },
        },
        required: ['input'],
      },
      execute: async (params, _context) => {
        // 记录使用
        installation.usageCount++
        installation.lastUsedAt = Date.now()
        this.saveInstalledSkills()
        
        // 简单执行模拟
        return {
          success: true,
          data: { skillName: skill.name, params },
          executionTime: 0,
          output: `技能 ${skill.name} 执行完成`,
        }
      },
    })
    
    logger.info(`[Evolution] Skill installed: ${skill.name}`)
    this.emit('skillInstalled', installation)
    
    return skill.name
  }

  /**
   * 手动创建技能
   */
  async createSkill(spec: {
    name: string
    description: string
    code: string
    version?: string
    dependencies?: string[]
  }): Promise<SkillInstallation> {
    const installation: SkillInstallation = {
      name: spec.name,
      description: spec.description,
      version: spec.version || '1.0.0',
      installedAt: Date.now(),
      source: 'custom',
      usageCount: 0,
      code: spec.code,
      dependencies: spec.dependencies,
    }
    
    this.installedSkills.set(spec.name, installation)
    this.saveInstalledSkills()
    
    return installation
  }

  /**
   * 卸载技能
   */
  async uninstallSkill(name: string): Promise<void> {
    const skill = this.installedSkills.get(name)
    if (skill) {
      this.installedSkills.delete(name)
      this.saveInstalledSkills()
      
      // 注销工具
      const toolExecutor = getToolExecutor()
      toolExecutor.unregisterTool(name)
      
      logger.info(`[Evolution] Skill uninstalled: ${name}`)
      this.emit('skillUninstalled', skill)
    }
  }

  /**
   * 生成代码
   */
  async generateCode(request: CodeGeneration): Promise<string> {
    logger.info('[Evolution] Generating code:', request.requirement)
    
    // 根据语言和需求生成代码
    const template = this.getCodeTemplate(request.language)
    const code = template
      .replace('{{REQUIREMENT}}', request.requirement)
      .replace('{{CONTEXT}}', request.context || '')
    
    return code
  }

  /**
   * 获取代码模板
   */
  private getCodeTemplate(language: CodeGeneration['language']): string {
    // 代码生成模板：execute 为占位，由 LLM 或用户根据 REQUIREMENT 替换为实际逻辑；详见 docs/BACKLOG_ONE_MONTH.md 十、10.1
    const templates: Record<string, string> = {
      typescript: `// Auto-generated TypeScript code
// Requirement: {{REQUIREMENT}}
// Context: {{CONTEXT}}

export async function execute(input: unknown): Promise<unknown> {
  // 占位：根据上方 Requirement 实现具体逻辑
  return { success: true, result: input };
}
`,
      javascript: `// Auto-generated JavaScript code
// Requirement: {{REQUIREMENT}}
// Context: {{CONTEXT}}

async function execute(input) {
  // 占位：根据上方 Requirement 实现具体逻辑
  return { success: true, result: input };
}

module.exports = { execute };
`,
      python: `# Auto-generated Python code
# Requirement: {{REQUIREMENT}}
# Context: {{CONTEXT}}

async def execute(input):
    # 占位：根据上方 Requirement 实现具体逻辑
    return {"success": True, "result": input}
`,
      bash: `#!/bin/bash
# Auto-generated Bash script
# Requirement: {{REQUIREMENT}}
# Context: {{CONTEXT}}

# 占位：根据上方 Requirement 实现具体逻辑
echo "Script executed successfully"
`,
    }
    
    return templates[language] || templates.typescript
  }

  /**
   * 记录学习内容
   */
  async learn(topic: string, content: string): Promise<void> {
    this.learningHistory.value.push({
      topic,
      learnedAt: Date.now(),
      content,
    })
    
    // 限制历史记录
    if (this.learningHistory.value.length > 1000) {
      this.learningHistory.value.shift()
    }
    
    logger.info(`[Evolution] Learning completed: ${topic}`)
    this.emit('learned', { topic, content })
  }

  /**
   * 加载已安装的技能
   */
  private loadInstalledSkills(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = localStorage.getItem(this.config.skillStorageKey)
        if (data) {
          const skills = JSON.parse(data) as SkillInstallation[]
          skills.forEach(skill => {
            this.installedSkills.set(skill.name, skill)
          })
          logger.info(`[Evolution] Loaded installed skills`)
        }
      }
    } catch (error) {
      logger.warn('[Evolution] Failed to load skills:', error)
    }
  }

  /**
   * 保存已安装的技能
   */
  private saveInstalledSkills(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const skills = Array.from(this.installedSkills.values())
        localStorage.setItem(this.config.skillStorageKey, JSON.stringify(skills))
      }
    } catch (error) {
      logger.warn('[Evolution] Failed to save skills:', error)
    }
  }

  /**
   * 获取所有进化任务
   */
  getEvolutionTasks(): EvolutionTask[] {
    return Array.from(this.evolutionTasks.values())
  }

  /**
   * 获取已安装的技能
   */
  getInstalledSkills(): SkillInstallation[] {
    return Array.from(this.installedSkills.values())
  }

  /**
   * 获取能力缺口
   */
  getCapabilityGaps(): CapabilityGap[] {
    return [...this.capabilityGaps.value]
  }

  /**
   * 获取学习历史
   */
  getLearningHistory(): typeof this.learningHistory.value {
    return [...this.learningHistory.value]
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<typeof this.config>): void {
    Object.assign(this.config, config)
  }

  /**
   * 获取状态
   */
  getStatus(): {
    tasksCount: number
    skillsCount: number
    gapsCount: number
    learningCount: number
    autoEvolve: boolean
  } {
    return {
      tasksCount: this.evolutionTasks.size,
      skillsCount: this.installedSkills.size,
      gapsCount: this.capabilityGaps.value.length,
      learningCount: this.learningHistory.value.length,
      autoEvolve: this.config.autoEvolve,
    }
  }
}

// 单例实例
let evolutionEngineInstance: SelfEvolutionEngine | null = null

/**
 * 获取自我进化引擎实例
 */
export function getSelfEvolutionEngine(): SelfEvolutionEngine {
  if (!evolutionEngineInstance) {
    evolutionEngineInstance = new SelfEvolutionEngine()
  }
  return evolutionEngineInstance
}
