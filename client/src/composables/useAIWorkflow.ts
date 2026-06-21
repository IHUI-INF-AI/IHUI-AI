/**
 * AI 工作流 Composable
 * 提供工作流定义、执行和管理功能
 */

import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getI18nGlobal } from '@/locales'
import { t } from '@/utils/i18n'
import {
  getAIWorkflowOrchestrator,
  type AIWorkflow,
  type WorkflowExecutionState,
} from '@/services/ai-workflow-orchestrator'

/**
 * AI 工作流 Composable
 */
export function useAIWorkflow() {
  const orchestrator = getAIWorkflowOrchestrator()

  // 状态
  const loading = ref(false)
  const currentExecution = ref<WorkflowExecutionState | null>(null)
  const executions = ref<WorkflowExecutionState[]>([])

  /**
   * 执行工作流
   */
  const executeWorkflow = async (
    workflow: AIWorkflow,
    initialInput?: any
  ): Promise<WorkflowExecutionState> => {
    loading.value = true
    try {
      const state = await orchestrator.executeWorkflow(workflow, initialInput)
      currentExecution.value = state
      executions.value.unshift(state)
      ElMessage.success(String(getI18nGlobal().t('messages.workflowSuccess')))
      return state
    } catch (error: any) {
      const err = error as { message?: string }
      ElMessage.error(err?.message || t('common.errors.workflowExecutionFailed'))
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 获取执行状态
   */
  const getExecutionState = (executionId: string) => {
    return orchestrator.getExecutionState(executionId)
  }

  /**
   * 获取所有执行
   */
  const getAllExecutions = () => {
    return orchestrator.getAllExecutions()
  }

  /**
   * 暂停工作流
   */
  const pauseWorkflow = (executionId: string) => {
    orchestrator.pauseWorkflow(executionId)
    ElMessage.info(String(getI18nGlobal().t('messages.workflowPaused')))
  }

  /**
   * 恢复工作流
   */
  const resumeWorkflow = (executionId: string) => {
    orchestrator.resumeWorkflow(executionId)
    ElMessage.info(String(getI18nGlobal().t('messages.workflowResumed')))
  }

  // 计算属性
  const runningExecutions = computed(() =>
    executions.value.filter((e: { status: string }) => e.status === 'running')
  )

  const completedExecutions = computed(() =>
    executions.value.filter((e: { status: string }) => e.status === 'completed')
  )

  const failedExecutions = computed(() =>
    executions.value.filter((e: { status: string }) => e.status === 'failed')
  )

  return {
    // 状态
    loading,
    currentExecution,
    executions,

    // 计算属性
    runningExecutions,
    completedExecutions,
    failedExecutions,

    // 方法
    executeWorkflow,
    getExecutionState,
    getAllExecutions,
    pauseWorkflow,
    resumeWorkflow,
  }
}
