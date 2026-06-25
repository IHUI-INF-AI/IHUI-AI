<template>
  <div class="openclaw-panel-content">
    <div class="openclaw-toolbar">
      <el-button link size="small" :loading="loading" @click="loadChannels">{{ t('common.refresh') }}</el-button>
    </div>
    <div class="openclaw-form-section">
      <el-button size="small" @click="showAddForm = !showAddForm">
        {{ showAddForm ? t('common.cancel') : t('floatingChat.openclaw.addChannel') }}
      </el-button>
      <div v-if="showAddForm" class="openclaw-form">
        <el-select v-model="newChannel.type" size="small" :placeholder="t('floatingChat.openclaw.channelType')" class="openclaw-form__field">
          <el-option v-for="ct in supportedChannels" :key="ct.type" :label="ct.name" :value="ct.type" />
        </el-select>
        <el-input v-model="newChannel.name" size="small" :placeholder="t('floatingChat.openclaw.channelName')" class="openclaw-form__field" />
        <el-button type="primary" size="small" :loading="submitting" :disabled="!newChannel.type || !newChannel.name.trim()" @click="submitChannel">
          {{ t('common.confirm') }}
        </el-button>
      </div>
    </div>
    <div class="openclaw-loading" v-if="loading">{{ t('common.loading') }}</div>
    <ul v-else class="openclaw-list">
      <li v-for="ch in channelList" :key="ch.id" class="openclaw-list__item openclaw-list__item--row">
        <div class="openclaw-item-main">
          <span class="openclaw-item-name">{{ ch.name }}</span>
          <span class="openclaw-item-meta">{{ ch.type }} · {{ ch.messageCount }} {{ t('floatingChat.openclaw.messages') }}</span>
        </div>
        <div class="openclaw-item-actions">
          <el-button
            v-if="ch.connected"
            type="warning"
            size="small"
            link
            :loading="disconnectingId === ch.id"
            @click="disconnect(ch.id)"
          >
            {{ t('floatingChat.openclaw.disconnect') }}
          </el-button>
          <el-button
            v-else
            type="success"
            size="small"
            link
            :loading="connectingId === ch.id"
            @click="connect(ch.id)"
          >
            {{ t('floatingChat.openclaw.connect') }}
          </el-button>
          <el-button type="danger" size="small" link :loading="deletingId === ch.id" @click="deleteChannel(ch.id)">
            {{ t('common.delete') }}
          </el-button>
        </div>
      </li>
    </ul>
    <p v-if="!loading && channelList.length === 0" class="openclaw-empty">{{ t('floatingChat.openclaw.noChannels') }}</p>
    <p class="openclaw-hint">{{ t('floatingChat.openclaw.integrationsHint') }}</p>
    <el-button type="primary" size="small" class="openclaw-goto-btn" @click="router.push('/settings').catch(() => { /* NavigationDuplicated 错误，无需处理 */ })">
      {{ t('floatingChat.goToSystemSettings') }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getApiErrorMessage } from './utils'
import {
  getChannels,
  getSupportedChannels,
  createChannel,
  connectChannel,
  disconnectChannel,
  deleteChannel as apiDeleteChannel,
} from '@/api/tools/openclaw'
import type { ChannelConfig, ChannelType } from '@/api/tools/openclaw'

const { t } = useI18n()
const router = useRouter()

const channelList = ref<ChannelConfig[]>([])
const supportedChannels = ref<ChannelType[]>([])
const loading = ref(false)
const showAddForm = ref(false)
const submitting = ref(false)
const connectingId = ref<string | null>(null)
const disconnectingId = ref<string | null>(null)
const deletingId = ref<string | null>(null)
const newChannel = ref({ type: '', name: '' })

async function loadChannels() {
  loading.value = true
  try {
    const res = await getChannels()
    channelList.value = (res.data as ChannelConfig[]) ?? []
  } catch {
    channelList.value = []
  } finally {
    loading.value = false
  }
}

async function loadSupported() {
  try {
    const res = await getSupportedChannels()
    supportedChannels.value = (res.data as ChannelType[]) ?? []
  } catch {
    supportedChannels.value = []
  }
}

async function submitChannel() {
  const { type, name } = newChannel.value
  if (!type || !name.trim()) return
  submitting.value = true
  try {
    await createChannel({ type, name: name.trim() })
    ElMessage.success(t('common.addSuccess'))
    showAddForm.value = false
    newChannel.value = { type: '', name: '' }
    loadChannels()
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, t('common.requestFailed')))
  } finally {
    submitting.value = false
  }
}

async function connect(id: string) {
  connectingId.value = id
  try {
    await connectChannel(id)
    ElMessage.success(t('floatingChat.openclaw.connected'))
    loadChannels()
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, t('common.requestFailed')))
  } finally {
    connectingId.value = null
  }
}

async function disconnect(id: string) {
  disconnectingId.value = id
  try {
    await disconnectChannel(id)
    ElMessage.success(t('floatingChat.openclaw.disconnected'))
    loadChannels()
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, t('common.requestFailed')))
  } finally {
    disconnectingId.value = null
  }
}

async function deleteChannel(id: string) {
  try {
    await ElMessageBox.confirm(
      t('floatingChat.openclaw.confirmDeleteChannel'),
      t('common.confirm'),
      { type: 'warning' }
    )
  } catch {
    return
  }
  deletingId.value = id
  try {
    await apiDeleteChannel(id)
    ElMessage.success(t('common.deleteSuccess'))
    loadChannels()
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, t('common.requestFailed')))
  } finally {
    deletingId.value = null
  }
}

onMounted(() => {
  loadChannels()
  loadSupported()
})
</script>

<style lang="scss" scoped>
/* 共用样式见 styles/_openclaw-panels.scss */
.openclaw-hint {
  margin-top: 18px;
  margin-bottom: 0;
}

.openclaw-goto-btn {
  margin-top: 16px;
}
</style>
