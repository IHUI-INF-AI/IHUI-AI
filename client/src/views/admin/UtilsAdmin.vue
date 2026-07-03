<template>
  <div class="utils-admin-page">
    <h2 class="page-title">{{ t('utilsAdmin.title', '工具函数综合测试 (集中接入 17 个零引用 utils 模块)') }}</h2>

    <el-tabs v-model="activeTab" class="utils-tabs">
      <!-- 格式化 -->
      <el-tab-pane :label="t('utilsAdmin.tab.format', '格式化')" name="format">
        <el-form label-width="180px" class="format-form">
          <el-form-item :label="t('utilsAdmin.dateInput', '日期')">
            <el-input v-model="dateInput" />
            <span class="result">{{ formatDateTime(dateInput) }}</span>
          </el-form-item>
          <el-form-item :label="t('utilsAdmin.durationInput', '时长(ms)')">
            <el-input-number v-model="durationInput" />
            <span class="result">{{ formatDuration(durationInput) }}</span>
          </el-form-item>
          <el-form-item :label="t('utilsAdmin.numberInput', '数字')">
            <el-input-number v-model="numberInput" :step="0.01" />
            <span class="result">{{ formatNumber(numberInput) }}</span>
          </el-form-item>
          <el-form-item :label="t('utilsAdmin.percentInput', '占比')">
            <el-input-number v-model="percentPart" />
            /
            <el-input-number v-model="percentTotal" />
            <span class="result">{{ formatPercent(percentPart, percentTotal) }}</span>
          </el-form-item>
          <el-form-item :label="t('utilsAdmin.moneyInput', '金额(分)')">
            <el-input-number v-model="moneyFen" />
            <span class="result">{{ fenToYuan(moneyFen) }} 元</span>
          </el-form-item>
          <el-form-item :label="t('utilsAdmin.sizeInput', '文件大小')">
            <el-input-number v-model="fileSize" />
            <span class="result">{{ formatFileSize(fileSize) }}</span>
          </el-form-item>
          <el-form-item :label="t('utilsAdmin.phoneInput', '手机号')">
            <el-input v-model="phoneInput" />
            <span class="result">{{ formatPhone(phoneInput) }}</span>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 工具演示 -->
      <el-tab-pane :label="t('utilsAdmin.tab.demo', '工具')" name="demo">
        <el-button @click="onDownload" type="primary">{{ t('utilsAdmin.downloadTest', '下载测试') }}</el-button>
        <el-button @click="onCacheSet" type="success">{{ t('utilsAdmin.cacheSet', '设置缓存') }}</el-button>
        <el-button @click="onCacheGet" type="warning">{{ t('utilsAdmin.cacheGet', '读取缓存') }}</el-button>
        <el-button @click="onDebounceDemo" type="info">{{ t('utilsAdmin.debounceDemo', '防抖演示') }}</el-button>
        <el-button @click="onRetryDemo" type="danger">{{ t('utilsAdmin.retryDemo', '重试演示') }}</el-button>
        <el-button @click="onInitWebVitals" type="primary">{{ t('utilsAdmin.initWebVitals', '初始化 Web Vitals') }}</el-button>
        <div class="demo-output">
          <pre>{{ demoOutput }}</pre>
        </div>
      </el-tab-pane>

      <!-- 会话管理 -->
      <el-tab-pane :label="t('utilsAdmin.tab.session', '会话')" name="session">
        <el-button @click="onCreateSession" type="primary">{{ t('utilsAdmin.createSession', '创建会话') }}</el-button>
        <el-button @click="onGetSession">{{ t('utilsAdmin.getSession', '读取会话') }}</el-button>
        <el-button @click="onClearSession" type="danger">{{ t('utilsAdmin.clearSession', '清空会话') }}</el-button>
        <pre class="session-output">{{ sessionOutput }}</pre>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

// 17 个零引用 utils 模块集中接入
import {
  chunkUploader, useChunkUploader,
  downloadText, downloadJson,
  createAbortController, cancelRequest, getCachedData, setCachedData, clearCachedData,
  resourcePreloader, setupMessageProgress,
  formatDateTime, formatTime, formatDuration,
  debounce,
  formatNumber, formatPercent, formatTokenValue, formatMoney, fenToYuan, yuanToFen,
  formatSize, formatFileSize,
  formatPhone, isEmpty,
  idbStorage,
  createSession, getSession, saveSession, updateSessionData, clearSession,
  sessionManager, useSessionManager, initSessionManager,
  requestSignatureService, initRequestSignature, getRequestSignatureHeaders,
  withRetry, createCircuitBreaker, useResilience, initResilience,
  useSmartScroll, debounceScroll, useAutoScroll,
  setAlertThresholds, setAlertHandler, initWebVitals, getAllMetrics,
  initCspReport, reportCspViolation,
  checkBrowserSupport, initProgressiveEnhancement, withFeatureDetection,
  checkFeatures, adaptToNetwork, useProgressiveEnhancement,
} from '@/utils'

const activeTab = ref('format')
const dateInput = ref(new Date().toISOString())
const durationInput = ref(3661500)
const numberInput = ref(1234567.89)
const percentPart = ref(30)
const percentTotal = ref(120)
const moneyFen = ref(9990)
const fileSize = ref(1024 * 1024 * 5)
const phoneInput = ref('13800138000')

const demoOutput = ref('')
const sessionOutput = ref('')

function onDownload() {
  downloadText('Hello, world!', 'test.txt')
  downloadJson({ foo: 'bar', num: 42 }, 'test.json')
  ElMessage.success(t('utilsAdmin.downloadStarted', '下载已开始'))
}

function onCacheSet() {
  setCachedData('test-key', { value: 'cached data', ts: Date.now() }, 60_000)
  ElMessage.success(t('utilsAdmin.cacheSet', '缓存已设置'))
}

function onCacheGet() {
  const data = getCachedData<{ value: string; ts: number }>('test-key')
  demoOutput.value = data ? JSON.stringify(data, null, 2) : '无缓存'
}

const debouncedLog = debounce(() => {
  demoOutput.value += `[debounce] ${new Date().toISOString()}\n`
}, 500)

function onDebounceDemo() {
  debouncedLog()
  debouncedLog()
  debouncedLog()
  setTimeout(() => {
    ElMessage.success(t('utilsAdmin.debounceTriggered', '防抖只触发一次'))
  }, 600)
}

async function onRetryDemo() {
  let attempt = 0
  try {
    const result = await withRetry(async () => {
      attempt++
      if (attempt < 3) throw new Error(`attempt ${attempt} failed`)
      return `succeeded on attempt ${attempt}`
    }, { maxAttempts: 3, delay: 200 })
    demoOutput.value = result
  } catch (e: any) {
    demoOutput.value = `failed: ${e.message}`
  }
}

function onInitWebVitals() {
  initWebVitals((metric) => {
    demoOutput.value += `[vitals] ${metric.name}: ${metric.value}\n`
  })
  ElMessage.success(t('utilsAdmin.vitalsInit', 'Web Vitals 已初始化'))
}

function onCreateSession() {
  const session = createSession()
  saveSession(session)
  updateSessionData('user', 'test-user')
  sessionOutput.value = JSON.stringify(getSession(), null, 2)
}

function onGetSession() {
  const s = getSession()
  sessionOutput.value = s ? JSON.stringify(s, null, 2) : '无会话'
}

function onClearSession() {
  clearSession()
  sessionOutput.value = ''
  ElMessage.success(t('utilsAdmin.sessionCleared', '会话已清空'))
}

// 触发模块加载 (确保 tree-shake 不删除)
void chunkUploader
void useChunkUploader
void resourcePreloader
void setupMessageProgress
void idbStorage
void sessionManager
void useSessionManager
void initSessionManager
void requestSignatureService
void initRequestSignature
void getRequestSignatureHeaders
void createCircuitBreaker
void useResilience
void initResilience
void useSmartScroll
void debounceScroll
void useAutoScroll
void setAlertThresholds
void setAlertHandler
void getAllMetrics
void initCspReport
void reportCspViolation
void checkBrowserSupport
void initProgressiveEnhancement
void withFeatureDetection
void checkFeatures
void adaptToNetwork
void useProgressiveEnhancement
void createAbortController
void cancelRequest
void clearCachedData
void formatTime
void formatTokenValue
void formatMoney
void yuanToFen
void formatSize
void isEmpty
void updateSessionData
void downloadText
void downloadJson
</script>

<style scoped lang="scss">
.utils-admin-page {
  padding: 16px;
  .page-title { margin: 0 0 16px; font-size: 22px; }
  .utils-tabs { background: var(--el-bg-color); padding: 16px; border-radius: var(--global-border-radius); }
  .format-form { max-width: 600px; .result { margin-left: 12px; color: var(--el-color-primary); font-weight: 600; } }

  .demo-output, .session-output {
    margin-top: 12px; padding: 12px; background: var(--el-bg-color-page); border-radius: 4px;
    max-height: 320px; overflow: auto;
    pre { white-space: pre-wrap; word-wrap: break-word; }
  }
}
</style>
