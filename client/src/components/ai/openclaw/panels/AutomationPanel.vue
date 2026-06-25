<template>
  <div class="openclaw-panel-content">
    <el-tabs v-model="activeTab">
      <el-tab-pane :label="t('floatingChat.openclaw.cronJobs')" name="cron">
        <div class="openclaw-form-section">
          <el-button size="small" @click="showCronForm = !showCronForm">
            {{ showCronForm ? t('common.cancel') : t('floatingChat.openclaw.addCronJob') }}
          </el-button>
          <div v-if="showCronForm" class="openclaw-form">
            <el-input v-model="cronForm.name" size="small" :placeholder="t('floatingChat.openclaw.cronName')" class="openclaw-form__field" />
            <el-input v-model="cronForm.schedule" size="small" :placeholder="t('floatingChat.openclaw.cronSchedule')" class="openclaw-form__field" />
            <el-input v-model="cronForm.task" size="small" :placeholder="t('floatingChat.openclaw.cronTask')" class="openclaw-form__field" />
            <el-button type="primary" size="small" :loading="cronSubmitting" @click="submitCron">{{ t('common.confirm') }}</el-button>
          </div>
        </div>
        <div class="openclaw-loading" v-if="cronLoading">{{ t('common.loading') }}</div>
        <ul v-else class="openclaw-list">
          <li v-for="c in cronList" :key="c.id" class="openclaw-list__item openclaw-list__item--row">
            <div class="openclaw-item-main">
              <span class="openclaw-item-name">{{ c.name }}</span>
              <span class="openclaw-item-meta">{{ c.schedule }} · {{ c.task }}</span>
            </div>
            <div class="openclaw-item-actions">
              <el-switch v-model="c.enabled" size="small" :loading="cronTogglingId === c.id" @change="toggleCron(c)" />
              <el-button type="danger" size="small" link @click="deleteCron(c.id)">{{ t('common.delete') }}</el-button>
            </div>
          </li>
        </ul>
        <p v-if="!cronLoading && cronList.length === 0" class="openclaw-empty">{{ t('floatingChat.openclaw.noCronJobs') }}</p>
      </el-tab-pane>
      <el-tab-pane :label="t('floatingChat.openclaw.webhooks')" name="webhooks">
        <div class="openclaw-form-section">
          <el-button size="small" @click="showWebhookForm = !showWebhookForm">
            {{ showWebhookForm ? t('common.cancel') : t('floatingChat.openclaw.addWebhook') }}
          </el-button>
          <div v-if="showWebhookForm" class="openclaw-form">
            <el-input v-model="webhookForm.name" size="small" :placeholder="t('floatingChat.openclaw.webhookName')" class="openclaw-form__field" />
            <el-input v-model="webhookForm.endpoint" size="small" :placeholder="t('floatingChat.openclaw.webhookEndpoint')" class="openclaw-form__field" />
            <el-input v-model="webhookForm.eventsStr" size="small" :placeholder="t('floatingChat.openclaw.webhookEvents')" class="openclaw-form__field" />
            <el-button type="primary" size="small" :loading="webhookSubmitting" @click="submitWebhook">{{ t('common.confirm') }}</el-button>
          </div>
        </div>
        <div class="openclaw-loading" v-if="webhookLoading">{{ t('common.loading') }}</div>
        <ul v-else class="openclaw-list">
          <li v-for="w in webhookList" :key="w.id" class="openclaw-list__item openclaw-list__item--row">
            <div class="openclaw-item-main">
              <span class="openclaw-item-name">{{ w.name }}</span>
              <span class="openclaw-item-meta">{{ w.endpoint }}</span>
            </div>
            <div class="openclaw-item-actions">
              <el-switch v-model="w.enabled" size="small" :loading="webhookTogglingId === w.id" @change="toggleWebhook(w)" />
              <el-button type="danger" size="small" link @click="deleteWebhook(w.id)">{{ t('common.delete') }}</el-button>
            </div>
          </li>
        </ul>
        <p v-if="!webhookLoading && webhookList.length === 0" class="openclaw-empty">{{ t('floatingChat.openclaw.noWebhooks') }}</p>
      </el-tab-pane>
      <el-tab-pane :label="t('floatingChat.openclaw.hooks')" name="hooks">
        <div class="openclaw-form-section">
          <el-button size="small" @click="showHookForm = !showHookForm">
            {{ showHookForm ? t('common.cancel') : t('floatingChat.openclaw.addHook') }}
          </el-button>
          <div v-if="showHookForm" class="openclaw-form">
            <el-input v-model="hookForm.type" size="small" :placeholder="t('floatingChat.openclaw.hookType')" class="openclaw-form__field" />
            <el-input v-model="hookForm.name" size="small" :placeholder="t('floatingChat.openclaw.hookName')" class="openclaw-form__field" />
            <el-input v-model="hookForm.handler" size="small" :placeholder="t('floatingChat.openclaw.hookHandler')" class="openclaw-form__field" />
            <el-button type="primary" size="small" :loading="hookSubmitting" @click="submitHook">{{ t('common.confirm') }}</el-button>
          </div>
        </div>
        <div class="openclaw-loading" v-if="hooksLoading">{{ t('common.loading') }}</div>
        <ul v-else class="openclaw-list">
          <li v-for="h in hooksList" :key="h.id" class="openclaw-list__item openclaw-list__item--row">
            <div class="openclaw-item-main">
              <span class="openclaw-item-name">{{ h.name }}</span>
              <span class="openclaw-item-meta">{{ h.type }} · {{ h.handler }}</span>
            </div>
            <div class="openclaw-item-actions">
              <el-button type="danger" size="small" link @click="deleteHook(h.id)">{{ t('common.delete') }}</el-button>
            </div>
          </li>
        </ul>
        <p v-if="!hooksLoading && hooksList.length === 0" class="openclaw-empty">{{ t('floatingChat.openclaw.noHooks') }}</p>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getApiErrorMessage } from './utils'
import {
  getCronJobs,
  createCronJob,
  updateCronJob,
  deleteCronJob,
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook as apiDeleteWebhook,
  getHooks,
  registerHook,
  deleteHook as apiDeleteHook,
} from '@/api/tools/openclaw'
import type { CronJob, WebhookConfig, HookConfig } from '@/api/tools/openclaw'

const { t } = useI18n()

const activeTab = ref('cron')
const cronList = ref<CronJob[]>([])
const webhookList = ref<WebhookConfig[]>([])
const hooksList = ref<HookConfig[]>([])
const cronLoading = ref(false)
const webhookLoading = ref(false)
const hooksLoading = ref(false)
const showCronForm = ref(false)
const showWebhookForm = ref(false)
const cronSubmitting = ref(false)
const webhookSubmitting = ref(false)
const cronTogglingId = ref<string | null>(null)
const webhookTogglingId = ref<string | null>(null)
const cronForm = ref({ name: '', schedule: '', task: '' })
const webhookForm = ref({ name: '', endpoint: '', eventsStr: '' })
const showHookForm = ref(false)
const hookForm = ref({ type: '', name: '', handler: '' })
const hookSubmitting = ref(false)

async function loadCron() {
  cronLoading.value = true
  try {
    const res = await getCronJobs()
    cronList.value = (res.data as CronJob[]) ?? []
  } catch {
    cronList.value = []
  } finally {
    cronLoading.value = false
  }
}

async function loadWebhooks() {
  webhookLoading.value = true
  try {
    const res = await getWebhooks()
    webhookList.value = (res.data as WebhookConfig[]) ?? []
  } catch {
    webhookList.value = []
  } finally {
    webhookLoading.value = false
  }
}

async function loadHooks() {
  hooksLoading.value = true
  try {
    const res = await getHooks()
    hooksList.value = (res.data as HookConfig[]) ?? []
  } catch {
    hooksList.value = []
  } finally {
    hooksLoading.value = false
  }
}

async function deleteCron(id: string) {
  try {
    await ElMessageBox.confirm(
      t('floatingChat.openclaw.confirmDeleteCron'),
      t('common.confirm'),
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await deleteCronJob(id)
    ElMessage.success(t('common.deleteSuccess'))
    loadCron()
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, t('common.requestFailed')))
  }
}

async function deleteWebhook(id: string) {
  try {
    await ElMessageBox.confirm(
      t('floatingChat.openclaw.confirmDeleteWebhook'),
      t('common.confirm'),
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await apiDeleteWebhook(id)
    ElMessage.success(t('common.deleteSuccess'))
    loadWebhooks()
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, t('common.requestFailed')))
  }
}

async function deleteHook(id: string) {
  try {
    await ElMessageBox.confirm(
      t('floatingChat.openclaw.confirmDeleteHook'),
      t('common.confirm'),
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await apiDeleteHook(id)
    ElMessage.success(t('common.deleteSuccess'))
    loadHooks()
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, t('common.requestFailed')))
  }
}

async function submitCron() {
  const { name, schedule, task } = cronForm.value
  if (!name.trim() || !schedule.trim() || !task.trim()) {
    ElMessage.warning(t('floatingChat.openclaw.fillCronFields'))
    return
  }
  cronSubmitting.value = true
  try {
    await createCronJob({ name: name.trim(), schedule: schedule.trim(), task: task.trim(), enabled: true })
    ElMessage.success(t('common.addSuccess'))
    showCronForm.value = false
    cronForm.value = { name: '', schedule: '', task: '' }
    loadCron()
  } catch {
    ElMessage.error(t('common.requestFailed'))
  } finally {
    cronSubmitting.value = false
  }
}

async function submitWebhook() {
  const { name, endpoint, eventsStr } = webhookForm.value
  if (!name.trim() || !endpoint.trim()) {
    ElMessage.warning(t('floatingChat.openclaw.fillWebhookFields'))
    return
  }
  const events = eventsStr.trim() ? eventsStr.split(',').map(e => e.trim()).filter(Boolean) : ['message']
  webhookSubmitting.value = true
  try {
    await createWebhook({ name: name.trim(), endpoint: endpoint.trim(), events, enabled: true })
    ElMessage.success(t('common.addSuccess'))
    showWebhookForm.value = false
    webhookForm.value = { name: '', endpoint: '', eventsStr: '' }
    loadWebhooks()
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, t('common.requestFailed')))
  } finally {
    webhookSubmitting.value = false
  }
}

async function toggleCron(c: CronJob) {
  cronTogglingId.value = c.id
  const next = c.enabled
  try {
    await updateCronJob(c.id, { enabled: next })
    ElMessage.success(next ? t('floatingChat.openclaw.turnedOn') : t('floatingChat.openclaw.turnedOff'))
  } catch (e) {
    c.enabled = !c.enabled
    ElMessage.error(getApiErrorMessage(e, t('common.requestFailed')))
  } finally {
    cronTogglingId.value = null
  }
}

async function toggleWebhook(w: WebhookConfig) {
  webhookTogglingId.value = w.id
  const next = w.enabled
  try {
    await updateWebhook(w.id, { enabled: next })
    ElMessage.success(next ? t('floatingChat.openclaw.turnedOn') : t('floatingChat.openclaw.turnedOff'))
  } catch (e) {
    w.enabled = !w.enabled
    ElMessage.error(getApiErrorMessage(e, t('common.requestFailed')))
  } finally {
    webhookTogglingId.value = null
  }
}

function loadForTab(tab: string) {
  if (tab === 'cron') loadCron()
  else if (tab === 'webhooks') loadWebhooks()
  else if (tab === 'hooks') loadHooks()
}

async function submitHook() {
  const { type, name, handler } = hookForm.value
  if (!type.trim() || !name.trim() || !handler.trim()) {
    ElMessage.warning(t('floatingChat.openclaw.fillHookFields'))
    return
  }
  hookSubmitting.value = true
  try {
    await registerHook({ type: type.trim(), name: name.trim(), handler: handler.trim(), enabled: true })
    ElMessage.success(t('common.addSuccess'))
    showHookForm.value = false
    hookForm.value = { type: '', name: '', handler: '' }
    loadHooks()
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, t('common.requestFailed')))
  } finally {
    hookSubmitting.value = false
  }
}

watch(() => activeTab.value, loadForTab)
onMounted(() => loadForTab(activeTab.value))
</script>

<style lang="scss" scoped>
/* 共用样式见 styles/_openclaw-panels.scss */
.openclaw-item-meta { display: block; margin-top: 2px; }
</style>
