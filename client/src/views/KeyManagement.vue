<template>
  <div class="key-management-page">
    <div class="page-header">
      <h1 class="page-title">{{ t('keyManagement.title') }}</h1>
      <div class="header-actions">
        <a href="#" class="guide-link" @click.prevent="openGuide">
          <el-icon><Document /></el-icon>
          {{ t('keyManagement.guide') }}
        </a>
        <el-button type="primary" :disabled="list.length >= maxKeys" @click="openCreate">
          {{ t('keyManagement.createApiKey') }} ({{ list.length }}/{{ maxKeys }})
        </el-button>
      </div>
    </div>

    <div class="table-wrap">
      <el-table
        v-loading="loading"
        :data="list"
        stripe
        border
        style="width: 100%"
        header-cell-class-name="key-table-header"
      >
        <el-table-column prop="id" label="ID" width="100" align="center" />
        <el-table-column label="API Key" min-width="180">
          <template #default="{ row }">
            <span class="key-cell">
              <code class="key-masked">{{ maskKey(row.key) }}</code>
              <el-icon class="copy-icon" @click="copyKey(row.key)"><CopyDocument /></el-icon>
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="user_uuid" :label="t('keyManagement.account')" min-width="160" show-overflow-tooltip />
        <el-table-column :label="t('keyManagement.createTime')" width="180">
          <template #default="{ row }">
            {{ formatTime(row.created_time) }}
          </template>
        </el-table-column>
        <el-table-column prop="desc" :label="t('keyManagement.desc')" min-width="120" show-overflow-tooltip />
        <el-table-column :label="t('keyManagement.action')" width="140" align="center" fixed="right">
          <template #default="{ row }">
            <el-link type="primary" :underline="false" @click="openEdit(row)">{{ t('common.edit') }}</el-link>
            <el-divider direction="vertical" />
            <el-link type="danger" :underline="false" @click="confirmDelete(row)">{{ t('common.delete') }}</el-link>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 创建 API Key 对话框 -->
    <el-dialog
      v-model="createVisible"
      :title="t('keyManagement.createTitle')"
      width="480px"
      :close-on-click-modal="false"
      @closed="onCreateClosed"
    >
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item :label="t('keyManagement.keyType')" prop="type">
          <el-select v-model="createForm.type" :placeholder="t('keyManagement.pleaseSelect')" style="width: 100%">
            <el-option
              v-for="opt in typeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('keyManagement.maxUsage')" prop="max">
          <el-input-number
            v-model="createForm.max"
            :min="0"
            :max="999999999"
            :placeholder="t('keyManagement.optional')"
            style="width: 100%"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item :label="t('keyManagement.timeout')" prop="out_time">
          <el-date-picker
            v-model="createForm.out_time"
            type="datetime"
            :placeholder="t('keyManagement.optional')"
            style="width: 100%"
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
        <el-form-item :label="t('keyManagement.desc')" prop="desc">
          <el-input
            v-model="createForm.desc"
            type="textarea"
            :rows="2"
            :placeholder="t('keyManagement.descPlaceholder')"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="createLoading" @click="submitCreate">{{ t('common.create') }}</el-button>
      </template>
    </el-dialog>

    <!-- 创建成功：展示完整 key（仅此一次） -->
    <el-dialog
      v-model="newKeyVisible"
      :title="t('keyManagement.createdTitle')"
      width="520px"
      :close-on-click-modal="false"
    >
      <p class="new-key-tip">{{ t('keyManagement.tip') }}</p>
      <div class="new-key-value">
        <code>{{ newKeyValue }}</code>
        <el-button type="primary" text @click="copyKey(newKeyValue)">{{ t('keyManagement.copy') }}</el-button>
      </div>
      <template #footer>
        <el-button type="primary" @click="newKeyVisible = false">{{ t('keyManagement.iKnow') }}</el-button>
      </template>
    </el-dialog>

    <!-- 编辑描述对话框 -->
    <el-dialog
      v-model="editVisible"
      :title="t('keyManagement.editTitle')"
      width="480px"
      :close-on-click-modal="false"
      @closed="editRow = null"
    >
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="80px">
        <el-form-item :label="t('keyManagement.desc')" prop="desc">
          <el-input
            v-model="editForm.desc"
            type="textarea"
            :rows="2"
            :placeholder="t('keyManagement.optional')"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="editLoading" @click="submitEdit">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document, CopyDocument } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { getStoredData } from '@/utils/request'
import { formatTime as _formatTime } from '@/utils/format'

const { t } = useI18n()
import {
  getUserSkList,
  createUserSk,
  deleteUserSk,
  USER_SK_TYPE_OPTIONS,
  type UserSkItem,
  type UserSkCreateRes,
} from '@/api/user/user/userSk'

const typeOptions = USER_SK_TYPE_OPTIONS
const maxKeys = 20
const list = ref<UserSkItem[]>([])
const loading = ref(false)
const createVisible = ref(false)
const createLoading = ref(false)
const createFormRef = ref<FormInstance>()
const createForm = ref<{ type: number; max?: number; out_time?: string; desc: string }>({
  type: 1,
  max: undefined,
  out_time: undefined,
  desc: '',
})
const createRules: FormRules = {}

const newKeyVisible = ref(false)
const newKeyValue = ref('')

const editVisible = ref(false)
const editLoading = ref(false)
const editRow = ref<UserSkItem | null>(null)
const editFormRef = ref<FormInstance>()
const editForm = ref({ desc: '' })
const editRules: FormRules = {}

function maskKey(key?: string) {
  if (!key) return '-'
  if (key.length <= 8) return key
  return key.slice(0, 3) + '****' + key.slice(-4)
}

function formatTime(t?: string) {
  return t ? _formatTime(t) : '-'
}

function copyKey(key?: string) {
  if (!key) return
  navigator.clipboard.writeText(key).then(() => {
    ElMessage.success(t('keyManagement.copySuccess'))
  }).catch(() => {
    ElMessage.error(t('keyManagement.copyFailed'))
  })
}

function openGuide() {
  ElMessage.info(t('keyManagement.guideLink'))
}

function loadList() {
  loading.value = true
  getUserSkList()
    .then((data) => {
      list.value = data || []
    })
    .catch(() => {
      ElMessage.error(t('keyManagement.loadFailed'))
    })
    .finally(() => {
      loading.value = false
    })
}

function openCreate() {
  createForm.value = { type: 1, max: undefined, out_time: undefined, desc: '' }
  createVisible.value = true
}

function onCreateClosed() {
  createFormRef.value?.resetFields()
}

function submitCreate() {
  createLoading.value = true
  const stored = getStoredData() as { uuid?: string } | null
  const payload = {
    user_uuid: stored?.uuid,
    type: createForm.value.type,
    max: createForm.value.max,
    out_time: createForm.value.out_time || undefined,
    desc: createForm.value.desc || undefined,
  }
  createUserSk(payload)
    .then((res: UserSkCreateRes) => {
      createVisible.value = false
      const fullKey = (res as { key?: string }).key
      if (fullKey) {
        newKeyValue.value = fullKey
        newKeyVisible.value = true
      }
      loadList()
      ElMessage.success(t('keyManagement.createSuccess'))
    })
    .catch(() => {
      ElMessage.error(t('keyManagement.createFailed'))
    })
    .finally(() => {
      createLoading.value = false
    })
}

function openEdit(row: UserSkItem) {
  editRow.value = row
  editForm.value.desc = row.desc || ''
  editVisible.value = true
}

function submitEdit() {
  if (!editRow.value) return
  ElMessage.info(t('keyManagement.updateTip'))
  editVisible.value = false
  editLoading.value = false
}

function confirmDelete(row: UserSkItem) {
  ElMessageBox.confirm(
    t('keyManagement.deleteConfirm', { id: row.id }),
    t('keyManagement.deleteTitle'),
    {
      confirmButtonText: t('keyManagement.delete'),
      cancelButtonText: t('keyManagement.cancel'),
      type: 'warning',
    }
  ).then(() => {
    return deleteUserSk(row.id)
  }).then(() => {
    ElMessage.success(t('keyManagement.deleted'))
    loadList()
  }).catch((e: any) => {
    if (e !== 'cancel') ElMessage.error(t('keyManagement.deleteFailed'))
  })
}

onMounted(() => {
  loadList()
})
</script>

<style scoped lang="scss">
.key-management-page {
  min-height: 100vh;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  padding: 24px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;

  .page-title {
    font-size: 22px;
    font-weight: 700;
    margin: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 16px;

    .guide-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--el-text-color-regular);
      text-decoration: none;
      font-size: 14px;

      &:hover {
        color: var(--el-color-primary);
      }
    }
  }
}

.table-wrap {
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  overflow: auto hidden;
  -webkit-overflow-scrolling: touch;

  :deep(.key-table-header) {
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
    font-weight: 600;
  }

  .key-cell {
    display: inline-flex;
    align-items: center;
    gap: 8px;

    .key-masked {
      font-family: ui-monospace, monospace;
      font-size: 13px;
      color: var(--el-text-color-regular);
    }

    .copy-icon {
      cursor: pointer;
      color: var(--el-text-color-secondary);

      &:hover {
        color: var(--el-color-primary);
      }
    }
  }
}

.new-key-tip {
  color: var(--el-text-color-secondary);
  margin-bottom: 12px;
  font-size: 14px;
}

.new-key-value {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--el-fill-color-light);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);

  code {
    flex: 1;
    word-break: break-all;
    font-size: 13px;
  }
}

html.dark .key-management-page {
  background: var(--el-bg-color-page);
}
</style>
