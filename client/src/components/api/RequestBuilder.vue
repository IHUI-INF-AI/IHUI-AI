<template>
  <div class="request-builder">
    <el-form :model="requestData" label-width="100px">
      <el-form-item :label="t('apiService.debug.method')">
        <el-select v-model="requestData.method" style="width: 120px">
          <el-option label="GET" value="GET" />
          <el-option label="POST" value="POST" />
          <el-option label="PUT" value="PUT" />
          <el-option label="DELETE" value="DELETE" />
        </el-select>
      </el-form-item>

      <el-form-item :label="t('apiService.debug.url')">
        <el-input
          v-model="requestData.url"
          :placeholder="t('apiService.debug.urlPlaceholder')"
        />
      </el-form-item>

      <el-form-item :label="t('apiService.debug.headers')">
        <div class="headers-editor">
          <div
            v-for="(header, index) in requestData.headers"
            :key="index"
            class="header-item"
          >
            <el-input
              v-model="header.key"
              :placeholder="t('apiService.debug.headerKey')"
              style="width: 200px"
            />
            <el-input
              v-model="header.value"
              :placeholder="t('apiService.debug.headerValue')"
              style="flex: 1; margin-left: 8px"
            />
            <el-button
              link
              type="danger"
              @click="removeHeader(index)"
              style="margin-left: 8px"
            >
              {{ t('common.delete') }}
            </el-button>
          </div>
          <el-button link type="primary" @click="addHeader">
            <el-icon><Plus /></el-icon>
            {{ t('apiService.debug.addHeader') }}
          </el-button>
        </div>
      </el-form-item>

      <el-form-item
        v-if="requestData.method === 'POST' || requestData.method === 'PUT'"
        :label="t('apiService.debug.body')"
      >
        <el-input
          v-model="requestData.body"
          type="textarea"
          :rows="10"
          :placeholder="t('apiService.debug.bodyPlaceholder')"
        />
        <div class="body-actions">
          <el-button link size="small" @click="formatBody">
            {{ t('apiService.debug.format') }}
          </el-button>
          <el-button link size="small" @click="clearBody">
            {{ t('common.clear') }}
          </el-button>
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus } from '@element-plus/icons-vue'

defineOptions({
  name: 'RequestBuilder',
  inheritAttrs: false,
})

const { t } = useI18n()

export interface RequestData {
  method: string
  url: string
  headers: Array<{ key: string; value: string }>
  body: string
}

const props = defineProps<{
  modelValue: RequestData
}>()

const emit = defineEmits<{
  'update:modelValue': [value: RequestData]
}>()

const requestData = ref<RequestData>({
  method: 'POST',
  url: '',
  headers: [
    { key: 'Content-Type', value: 'application/json' },
    { key: 'Authorization', value: 'Bearer YOUR_API_KEY' },
  ],
  body: '',
})

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      requestData.value = { ...newVal }
    }
  },
  { immediate: true, deep: true }
)

watch(
  requestData,
  (newVal) => {
    emit('update:modelValue', { ...newVal })
  },
  { deep: true }
)

const addHeader = () => {
  requestData.value.headers.push({ key: '', value: '' })
}

const removeHeader = (index: number) => {
  requestData.value.headers.splice(index, 1)
}

const formatBody = () => {
  try {
    const parsed = JSON.parse(requestData.value.body)
    requestData.value.body = JSON.stringify(parsed, null, 2)
  } catch {
    // 如果不是有效的JSON，不做处理
  }
}

const clearBody = () => {
  requestData.value.body = ''
}
</script>

<style scoped lang="scss">
.request-builder {
  .headers-editor {
    .header-item {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
    }
  }

  .body-actions {
    margin-top: 8px;
    display: flex;
    gap: 8px;
  }
}
</style>
