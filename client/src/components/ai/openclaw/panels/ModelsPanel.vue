<template>
  <div class="openclaw-panel-content">
    <div class="openclaw-toolbar">
      <el-button link size="small" :loading="loading" @click="loadModels">{{ t('common.refresh') }}</el-button>
    </div>
    <div class="openclaw-loading" v-if="loading">{{ t('common.loading') }}</div>
    <ul v-else class="openclaw-list">
      <li v-for="m in modelList" :key="m.id" class="openclaw-list__item openclaw-list__item--row">
        <div class="openclaw-item-main">
          <span class="openclaw-item-name">{{ m.name }}</span>
          <span class="openclaw-item-meta">{{ m.provider }} · {{ m.type || 'talk' }}</span>
        </div>
        <div class="openclaw-item-actions">
          <el-tag v-if="m.enabled" type="success" size="small">{{ t('floatingChat.openclaw.enabled') }}</el-tag>
          <el-tag v-else type="info" size="small">{{ t('common.disabled') }}</el-tag>
        </div>
      </li>
    </ul>
    <p v-if="!loading && modelList.length === 0" class="openclaw-empty">{{ t('floatingChat.openclaw.noModels') }}</p>
    <p class="openclaw-hint">{{ t('floatingChat.openclaw.modelsHint') }}</p>
    <el-button type="primary" size="small" class="openclaw-goto-btn" @click="router.push('/settings').catch(() => { /* NavigationDuplicated 错误，无需处理 */ })">
      {{ t('floatingChat.goToSystemSettings') }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { getModelsList } from '@/api/models'
import type { AIModel } from '@/api/models'

const { t } = useI18n()
const router = useRouter()

const modelList = ref<AIModel[]>([])
const loading = ref(false)

async function loadModels() {
  loading.value = true
  try {
    const res = await getModelsList({ page: 1, pageSize: 50 })
    const data = res.data as { list?: AIModel[] }
    modelList.value = data?.list ?? []
  } catch {
    modelList.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadModels)
</script>

<style lang="scss" scoped>
/* 共用样式见 styles/_openclaw-panels.scss */
.openclaw-item-meta {
  display: block;
  margin-top: 2px;
}

.openclaw-hint {
  margin-top: 18px;
  margin-bottom: 0;
}

.openclaw-goto-btn {
  margin-top: 16px;
}
</style>
