<template>
  <div class="api-test-page">
    <div class="test-header">
      <h1>{{ t('apiTest.title') }}</h1>
      <div class="test-actions">
        <el-button type="primary" :loading="isRunning" @click="runTests">
          {{ isRunning ? t('apiTest.testing') : t('apiTest.runTests') }}
        </el-button>
        <el-button @click="clearResults">{{ t('apiTest.clearResults') }}</el-button>
      </div>
    </div>

    <div v-if="summary" class="test-summary">
      <el-row :gutter="20">
        <el-col :span="6">
          <div class="stat-card total">
            <div class="stat-value">{{ summary.total }}</div>
            <div class="stat-label">{{ t('apiTest.total') }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card passed">
            <div class="stat-value">{{ summary.passed }}</div>
            <div class="stat-label">{{ t('apiTest.passed') }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card failed">
            <div class="stat-value">{{ summary.failed }}</div>
            <div class="stat-label">{{ t('apiTest.failed') }}</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card duration">
            <div class="stat-value">{{ summary.duration.toFixed(0) }}ms</div>
            <div class="stat-label">{{ t('apiTest.duration') }}</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <div class="test-results">
      <el-table :data="results" stripe>
        <el-table-column prop="category" :label="t('apiTest.category')" width="120" />
        <el-table-column prop="name" :label="t('apiTest.testItem')" min-width="200" />
        <el-table-column prop="status" :label="t('apiTest.status')" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="duration" :label="t('apiTest.duration')" width="100">
          <template #default="{ row }">
            {{ row.duration ? row.duration.toFixed(0) + 'ms' : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="error" :label="t('apiTest.errorInfo')" min-width="200">
          <template #default="{ row }">
            <span v-if="row.error" class="error-text">{{ row.error }}</span>
            <span v-else class="success-text">-</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="test-log">
      <h3>{{ t('apiTest.testLog') }}</h3>
      <pre class="log-content">{{ logContent }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { logger } from '@/utils/logger'

interface TestResult {
  name: string
  category: string
  status: 'pass' | 'fail' | 'skip' | 'pending'
  duration?: number
  error?: string
  response?: any
}

interface TestSummary {
  total: number
  passed: number
  failed: number
  skipped: number
  pending: number
  duration: number
  results: TestResult[]
}

const isRunning = ref(false)
const results = ref<TestResult[]>([])
const summary = ref<TestSummary | null>(null)
const logContent = ref('')

function log(message: string) {
  logContent.value += message + '\n'
  logger.info(message)
}

function getStatusType(status: string) {
  switch (status) {
    case 'pass': return 'success'
    case 'fail': return 'danger'
    case 'skip': return 'info'
    case 'pending': return 'warning'
    default: return 'info'
  }
}

function getStatusText(status: string) {
  switch (status) {
    case 'pass': return t('return.api_test_page.通过')
    case 'fail': return t('return.api_test_page.失败1')
    case 'skip': return t('return.api_test_page.跳过2')
    case 'pending': return t('return.api_test_page.等待3')
    default: return status
  }
}

function clearResults() {
  results.value = []
  summary.value = null
  logContent.value = ''
}

async function runSingleTest(
  name: string,
  category: string,
  testFn: () => Promise<unknown>
): Promise<TestResult> {
  const startTime = performance.now()
  
  try {
    const response = await testFn()
    const duration = performance.now() - startTime
    
    log(`✅ [${category}] ${name} - ${t('apiTestPage.logPass')} (${duration.toFixed(0)}ms)`)
    
    return {
      name,
      category,
      status: 'pass',
      duration,
      response,
    }
  } catch (error) {
    const duration = performance.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    log(`❌ [${category}] ${name} - ${t('apiTestPage.logFail')}: ${errorMessage}`)
    
    return {
      name,
      category,
      status: 'fail',
      duration,
      error: errorMessage,
    }
  }
}

async function runTests() {
  if (isRunning.value) return
  
  isRunning.value = true
  clearResults()
  const startTime = performance.now()
  const allResults: TestResult[] = []
  
  log('========================================')
  log(t('ApiTestPage.startAITest'))
  log('========================================\n')
  
  try {
    // ========== 对话接口测试 ==========
    log(t('apiTest.chatTest'))
    
    // 测试统一聊天服务
    allResults.push(await runSingleTest(t('apiTestPage.testName.unifiedChatImport'), t('apiTestPage.category.chat'), async () => {
      const module = await import('@/api/services/unified-chat.service')
      if (!module.unifiedChatService) throw new Error(t('error.api_test_page.服务未导出'))
      if (!module.sendUnifiedChatMessage) throw new Error(t('error.api_test_page.sendUnif1'))
      return { available: true }
    }))
    
    // 测试FastAPI服务
    allResults.push(await runSingleTest(t('apiTestPage.testName.fastapiImport'), t('apiTestPage.category.chat'), async () => {
      const module = await import('@/api/fastapi')
      if (!module.sendChatCompletion) throw new Error(t('error.api_test_page.sendChat2'))
      if (!module.createTask) throw new Error(t('error.api_test_page.createTa3'))
      return { available: true }
    }))
    
    // 测试Agent服务
    allResults.push(await runSingleTest(t('apiTestPage.testName.agentImport'), t('apiTestPage.category.chat'), async () => {
      const module = await import('@/api/agents')
      if (!module.callAgent) throw new Error(t('error.api_test_page.callAgen4'))
      if (!module.getAgentsList) throw new Error(t('error.api_test_page.getAgent5'))
      return { available: true }
    }))
    
    // 测试MCP服务
    allResults.push(await runSingleTest(t('apiTestPage.testName.mcpImport'), t('apiTestPage.category.chat'), async () => {
      const module = await import('@/api/mcp')
      if (!module.callMCPTool) throw new Error(t('error.api_test_page.callMCPT6'))
      return { available: true }
    }))
    
    // 测试 ihui API 流式服务
    allResults.push(await runSingleTest(t('apiTestPage.testName.ihuiStreamImport'), t('apiTestPage.category.chat'), async () => {
      const module = await import('@/api/services/cozeChatStream.service')
      if (!module.streamChat) throw new Error(t('error.api_test_page.streamCh7'))
      if (!module.chat) throw new Error(t('error.api_test_page.chat未导出8'))
      return { available: true }
    }))
    
    // 测试LLM聊天服务
    allResults.push(await runSingleTest(t('apiTestPage.testName.llmChatImport'), t('apiTestPage.category.chat'), async () => {
      const module = await import('@/api/services/llmChat.service')
      if (!module.createQwenWebSocket) throw new Error(t('error.api_test_page.createQw9'))
      if (!module.createZhipuWebSocket) throw new Error(t('error.api_test_page.createZh10'))
      if (!module.createDeepSeekWebSocket) throw new Error(t('error.api_test_page.createDe11'))
      if (!module.createDoubaoWebSocket) throw new Error(t('error.api_test_page.createDo12'))
      return { available: true }
    }))
    
    // ========== 生成接口测试 ==========
    log(t('apiTest.genTest'))
    
    // 测试统一生成服务
    allResults.push(await runSingleTest(t('apiTestPage.testName.unifiedGenImport'), t('apiTestPage.category.generation'), async () => {
      const module = await import('@/api/services/unified-generation.service')
      if (!module.unifiedGenerationService) throw new Error(t('error.api_test_page.服务未导出13'))
      if (!module.generateContent) throw new Error(t('error.api_test_page.generate14'))
      return { available: true }
    }))
    
    // 测试AI生成服务
    allResults.push(await runSingleTest(t('apiTestPage.testName.aiGenImport'), t('apiTestPage.category.generation'), async () => {
      const module = await import('@/api/services/aiGeneration.service')
      if (!module.generateDashScopeImage) throw new Error(t('error.api_test_page.generate15'))
      if (!module.generateDoubaoImage) throw new Error(t('error.api_test_page.generate16'))
      if (!module.generateJimeng4Image) throw new Error(t('error.api_test_page.generate17'))
      if (!module.createDashScopeVideoWebSocket) throw new Error(t('error.api_test_page.createDa18'))
      if (!module.submitHunyuan3DTask) throw new Error(t('error.api_test_page.submitHu19'))
      return { available: true }
    }))
    
    // 测试AI模型服务
    allResults.push(await runSingleTest(t('apiTestPage.testName.aiModelImport'), t('apiTestPage.category.generation'), async () => {
      const module = await import('@/api/ai-models')
      if (!module.audioStart) throw new Error(t('error.api_test_page.audioSta20'))
      if (!module.aliGenerateTimbre) throw new Error(t('error.api_test_page.aliGener21'))
      if (!module.soraRequest) throw new Error(t('error.api_test_page.soraRequ22'))
      return { available: true }
    }))
    
    // 测试AI生成适配器
    allResults.push(await runSingleTest(t('apiTestPage.testName.aiGenAdapterImport'), t('apiTestPage.category.generation'), async () => {
      const module = await import('@/api/ai-generation')
      if (!module.generateImageQwen) throw new Error(t('error.api_test_page.generate23'))
      if (!module.generateVideoKling) throw new Error(t('error.api_test_page.generate24'))
      if (!module.generate3DModel) throw new Error(t('error.api_test_page.generate25'))
      return { available: true }
    }))
    
    // ========== Composable测试 ==========
    log(t('apiTest.compTest'))
    
    allResults.push(await runSingleTest('useUnifiedAIChat Composable', 'Composable', async () => {
      const module = await import('@/composables/useUnifiedAIChat')
      if (typeof module.useUnifiedAIChat !== 'function') throw new Error(t('error.api_test_page.不是函数26'))
      return { available: true }
    }))
    
    // ========== 类型定义测试 ==========
    log(t('apiTest.typeTest'))
    
    allResults.push(await runSingleTest(t('apiTestPage.testName.aiChatTypeImport'), t('apiTestPage.category.type'), async () => {
      const module = await import('@/api/ai-chat-types')
      if (!module.isFastAPIChatResponse) throw new Error(t('error.api_test_page.类型守卫未导出27'))
      return { available: true }
    }))
    
    // ========== 服务导出测试 ==========
    log(t('apiTest.serviceTest'))
    
    allResults.push(await runSingleTest(t('apiTestPage.testName.serviceUnifiedExport'), t('apiTestPage.category.export'), async () => {
      const module = await import('@/api/services')
      if (!module.unifiedChatService) throw new Error(t('error.api_test_page.unifiedC28'))
      if (!module.unifiedGenerationService) throw new Error(t('error.api_test_page.unifiedG29'))
      if (!module.generateDashScopeImage) throw new Error(t('error.api_test_page.generate30'))
      if (!module.streamChat) throw new Error(t('error.api_test_page.streamCh31'))
      return { available: true }
    }))
    
    const duration = performance.now() - startTime
    
    // 统计结果
    const testSummary: TestSummary = {
      total: allResults.length,
      passed: allResults.filter(r => r.status === 'pass').length,
      failed: allResults.filter(r => r.status === 'fail').length,
      skipped: allResults.filter(r => r.status === 'skip').length,
      pending: allResults.filter(r => r.status === 'pending').length,
      duration,
      results: allResults,
    }
    
    summary.value = testSummary
    results.value = allResults
    
    log('\n========================================')
    log(t('apiTest.testComplete'))
    log('========================================')
    log(t('apiTest.total', { n: testSummary.total }))
    log(t('apiTest.passed', { n: testSummary.passed }))
    log(t('apiTest.failed', { n: testSummary.failed }))
    log(t('apiTestPage.duration', { duration: duration.toFixed(0) }))
    log('========================================')
    
    if (testSummary.failed === 0) {
      ElMessage.success(`${t('apiTest.allTestsPassed')} ${testSummary.total} ${t('apiTest.testsPassed')}`)
    } else {
      ElMessage.warning(`${testSummary.failed} ${t('apiTest.testsFailed')}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log(`\n❌ ${t('apiTest.executionError')}: ${errorMessage}`)
    ElMessage.error(`${t('apiTest.executionError')}: ${errorMessage}`)
  } finally {
    isRunning.value = false
  }
}
</script>

<style scoped>
.api-test-page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.test-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.test-header h1 {
  margin: 0;
  font-size: 24px;
}

.test-summary {
  margin-bottom: 24px;
}

.stat-card {
  padding: 20px;
  border-radius: var(--global-border-radius);
  text-align: center;
  background: var(--el-bg-color);
  border: var(--unified-border);
}

.stat-card.total {
  border-left: var(--el-border-width-primary) solid var(--el-color-primary);
}

.stat-card.passed {
  border-left: 4px solid var(--el-color-success);
}

.stat-card.failed {
  border-left: 4px solid var(--el-color-danger);
}

.stat-card.duration {
  border-left: 4px solid var(--el-color-info);
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.test-results {
  margin-bottom: 24px;
}

.error-text {
  color: var(--el-color-danger);
  font-size: 12px;
}

.success-text {
  color: var(--el-text-color-placeholder);
}

.test-log {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 16px;
}

.test-log h3 {
  margin: 0 0 12px;
  font-size: 16px;
}

.log-content {
  background: var(--color-gray-1e1e1e);
  color: var(--color-neutral-300);
  padding: 16px;
  border-radius: var(--global-border-radius);
  font-family: var(--font-family-mono);
  font-size: 12px;
  line-height: 1.5;
  max-height: 400px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
</style>
