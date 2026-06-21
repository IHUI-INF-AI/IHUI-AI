/**
 * useSkills Composable
 * 提供技能相关的组合式函数
 */

import { ref, computed } from 'vue'
import { getSkillsManager } from '@/services/skills-manager'
import type { SkillContent, SkillMatch, SkillMatchOptions } from '@/types/skills'
import { logger } from '@/utils/logger'

export function useSkills() {
  const skillsManager = getSkillsManager()
  const isInitialized = ref(false)
  const activeSkills = ref<SkillContent[]>([])
  const loading = ref(false)

  /**
   * 初始化技能管理器
   */
  async function initialize() {
    if (isInitialized.value) return

    loading.value = true
    try {
      await skillsManager.initialize()
      isInitialized.value = true
      
      // 加载已激活的技能到本地状态
      const activeSkillNames = skillsManager.getActiveSkills()
      for (const skillName of activeSkillNames) {
        try {
          const skill = await skillsManager.loadSkill(skillName)
          if (skill && !activeSkills.value.find(s => s.metadata.name === skillName)) {
            activeSkills.value.push(skill)
          }
        } catch (error) {
          logger.warn(`Failed to load active skill ${skillName}:`, error)
        }
      }
      
      logger.info('Skills manager initialized')
    } catch (error) {
      logger.error('Failed to initialize skills manager:', error)
    } finally {
      loading.value = false
    }
  }

  /**
   * 匹配用户消息到相关技能
   */
  async function matchSkills(
    userMessage: string,
    options?: SkillMatchOptions
  ): Promise<SkillMatch[]> {
    if (!isInitialized.value) {
      logger.warn('Skills manager not initialized, initializing now...')
      await initialize()
    }
    return skillsManager.matchSkills(userMessage, options)
  }

  /**
   * 获取所有技能的metadata
   */
  function getAllSkills() {
    if (!isInitialized.value) {
      return []
    }
    return skillsManager.getAllSkillsMetadata()
  }

  /**
   * 构建包含技能的system prompt
   */
  async function buildSystemPromptWithSkills(
    userMessage: string,
    baseSystemPrompt?: string
  ): Promise<string> {
    if (!isInitialized.value) {
      await initialize()
    }
    return skillsManager.buildSystemPromptWithSkills(userMessage, baseSystemPrompt)
  }

  /**
   * 激活技能（加载完整内容）
   */
  async function activateSkill(skillName: string): Promise<SkillContent | null> {
    if (!isInitialized.value) {
      await initialize()
    }

    loading.value = true
    try {
      const skill = await skillsManager.loadSkill(skillName)
      if (skill) {
        // 在管理器中激活技能
        skillsManager.activateSkill(skillName)
        
        // 更新本地状态
        if (!activeSkills.value.find(s => s.metadata.name === skillName)) {
          activeSkills.value.push(skill)
        }
      }
      return skill
    } catch (error) {
      logger.error(`Failed to activate skill ${skillName}:`, error)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * 停用技能
   */
  function deactivateSkill(skillName: string): void {
    // 在管理器中停用技能
    skillsManager.deactivateSkill(skillName)
    
    // 更新本地状态
    activeSkills.value = activeSkills.value.filter(
      s => s.metadata.name !== skillName
    )
  }

  /**
   * 检查技能是否激活
   */
  function isSkillActive(skillName: string): boolean {
    return skillsManager.isSkillActive(skillName)
  }

  /**
   * 获取激活的技能名称列表
   */
  function getActiveSkillNames(): string[] {
    return skillsManager.getActiveSkills()
  }

  /**
   * 获取技能使用统计
   */
  function getSkillUsageStats(skillName?: string) {
    return skillsManager.getSkillUsageStats(skillName)
  }

  /**
   * 获取最常用的技能（用于推荐）
   */
  function getMostUsedSkills(limit: number = 5) {
    return skillsManager.getMostUsedSkills(limit)
  }

  /**
   * 清除所有激活的技能
   */
  function clearActiveSkills(): void {
    activeSkills.value = []
  }

  /**
   * 获取技能管理器状态
   */
  function getManagerState() {
    return skillsManager.getInitializationState()
  }

  return {
    // 状态
    isInitialized: computed(() => isInitialized.value),
    activeSkills: computed(() => activeSkills.value),
    loading: computed(() => loading.value),

    // 方法
    initialize,
    matchSkills,
    getAllSkills,
    buildSystemPromptWithSkills,
    activateSkill,
    deactivateSkill,
    clearActiveSkills,
    getManagerState,
    isSkillActive,
    getActiveSkillNames,
    getSkillUsageStats,
    getMostUsedSkills,
  }
}
