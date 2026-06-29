<template>
  <div class="oauth-apps-container page-container">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">
          <el-icon><Key /></el-icon>
          {{ t('oauthApps.title') }}
        </h1>
        <p class="page-subtitle">{{ t('oauthApps.subtitle') }}</p>
      </div>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        {{ t('oauthApps.createApp') }}
      </el-button>
    </div>

    <div class="oauth-apps-content" v-loading="loading">
      <el-empty v-if="!loading && apps.length === 0" :description="t('oauthApps.noApps')">
        <el-button type="primary" @click="showCreateDialog = true">{{
          t('oauthApps.createFirstApp')
        }}</el-button>
      </el-empty>

      <div v-else class="apps-grid">
        <el-card v-for="app in apps" :key="app.client_id" shadow="hover" class="app-card">
          <template #header>
            <div class="card-header">
              <div class="app-title-group">
                <span class="app-name">{{ app.app_name }}</span>
                <el-tag :type="app.is_active ? 'success' : 'info'" size="small">
                  {{ app.is_active ? t('oauthApps.enabled') : t('oauthApps.disabled') }}
                </el-tag>
              </div>
              <el-dropdown @command="handleCommand">
                <el-icon class="more-icon"><MoreFilled /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :command="{ action: 'view', app }">
                      {{ t('oauthApps.viewDetails') }}
                    </el-dropdown-item>
                    <el-dropdown-item :command="{ action: 'delete', app }" divided>
                      {{ t('oauthApps.delete') }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>

          <div class="app-info">
            <p v-if="app.app_description" class="description">{{ app.app_description }}</p>
            <div class="credentials">
              <div class="credential-item">
                <span class="label">{{ t('oauthApps.clientID') }}</span>
                <el-text copyable>{{ app.client_id }}</el-text>
              </div>
              <div class="credential-item">
                <span class="label">{{ t('oauthApps.clientSecret') }}</span>
                <el-text copyable type="info">{{ t('oauthApps.clickToView') }}</el-text>
              </div>
            </div>
            <div class="meta">
              <span>{{
                t('oauthApps.redirectURICount', { count: app.redirect_uris.length })
              }}</span>
              <span>{{ t('oauthApps.scopes') }}: {{ app.scopes.join(', ') }}</span>
            </div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 创建对话框 -->
    <el-dialog v-model="showCreateDialog" :title="t('oauthApps.createDialog')" width="600px">
      <el-form :model="appForm" :rules="rules" ref="appFormRef" label-width="120px">
        <el-form-item :label="t('oauthApps.appName')" prop="app_name">
          <el-input v-model="appForm.app_name" />
        </el-form-item>
        <el-form-item :label="t('oauthApps.appDescription')">
          <el-input v-model="appForm.app_description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item :label="t('oauthApps.redirectURILabel')" prop="redirect_uris">
          <el-input
            v-model="appForm.redirect_uris_text"
            type="textarea"
            :rows="4"
            :placeholder="t('oauthApps.redirectURIPlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('oauthApps.scopes')">
          <el-checkbox-group v-model="appForm.scopes">
            <el-checkbox label="read">{{ t('oauthApps.scopeRead') }}</el-checkbox>
            <el-checkbox label="write">{{ t('oauthApps.scopeWrite') }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="saving" @click="handleCreate">{{
          t('common.create')
        }}</el-button>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog v-model="showDetailDialog" :title="t('oauthApps.detailDialog')" width="600px">
      <div v-if="selectedApp" class="app-detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item :label="t('oauthApps.appName')">{{
            selectedApp.app_name
          }}</el-descriptions-item>
          <el-descriptions-item :label="t('oauthApps.clientID')">
            <el-text copyable>{{ selectedApp.client_id }}</el-text>
          </el-descriptions-item>
          <el-descriptions-item :label="t('oauthApps.clientSecret')">
            <el-text copyable>{{ selectedApp.client_secret }}</el-text>
          </el-descriptions-item>
          <el-descriptions-item :label="t('oauthApps.redirectURIs')">
            <el-tag v-for="uri in selectedApp.redirect_uris" :key="uri" style="margin-right: 8px">
              {{ uri }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('oauthApps.scopes')">
            <el-tag v-for="scope in selectedApp.scopes" :key="scope" style="margin-right: 8px">
              {{ scope }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('oauthApps.status')">
            <el-tag :type="selectedApp.is_active ? 'success' : 'info'">
              {{ selectedApp.is_active ? t('oauthApps.enabled') : t('oauthApps.disabled') }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="t('oauthApps.createdAt')">{{
            selectedApp.created_at
          }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Key, Plus, MoreFilled } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, FormInstance } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  getOAuthApps,
  createOAuthApp,
  deleteOAuthApp,
  type OAuthApp,
} from '@/api/services/oauthApps.service'
import { useApiError } from '@/composables/useApiError'

const { t } = useI18n()

const { loading, execute: executeApi } = useApiError({ showMessage: true })
const saving = ref(false)
const apps = ref<OAuthApp[]>([])
const showCreateDialog = ref(false)
const showDetailDialog = ref(false)
const selectedApp = ref<OAuthApp | null>(null)
const appFormRef = ref<FormInstance | null>(null)

const appForm = reactive({
  app_name: '',
  app_description: '',
  redirect_uris_text: '',
  scopes: ['read', 'write'],
})

const rules = {
  app_name: [{ required: true, message: t('oauthApps.appNameRequired'), trigger: 'blur' }],
  redirect_uris_text: [
    { required: true, message: t('oauthApps.redirectURIRequired'), trigger: 'blur' },
  ],
}

const loadApps = async () => {
  const data = await executeApi(() => getOAuthApps())
  if (data !== null) {
    const listData = Array.isArray(data) ? data : (typeof data === 'object' && 'list' in data ? (data as { list?: unknown[] }).list : [])
    apps.value = (listData || []) as OAuthApp[]
  }
}

const handleCreate = async () => {
  if (!appFormRef.value) return
  await appFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      saving.value = true
      try {
        const redirectUris = appForm.redirect_uris_text
          .split('\n')
          .map(uri => uri.trim())
          .filter(uri => uri)

        const response = await createOAuthApp({
          app_name: appForm.app_name,
          app_description: appForm.app_description || undefined,
          redirect_uris: redirectUris,
          scopes: appForm.scopes,
        })
        if (response.success && response.data) {
          ElMessage.success(t('oauthApps.createSuccess'))
          selectedApp.value = response.data
          showCreateDialog.value = false
          showDetailDialog.value = true
          loadApps()
          resetForm()
        }
      } catch (_error) {
        ElMessage.error(t('oauthApps.createFailed'))
      } finally {
        saving.value = false
      }
    }
  })
}

const handleCommand = async ({ action, app }: { action: string; app: OAuthApp }) => {
  if (action === 'view') {
    selectedApp.value = app
    showDetailDialog.value = true
  } else if (action === 'delete') {
    try {
      await ElMessageBox.confirm(t('oauthApps.confirmDelete'), t('oauthApps.confirmDeleteTitle'), {
        type: 'warning',
      })
      const response = await deleteOAuthApp(app.client_id)
      if (response.success) {
        ElMessage.success(t('oauthApps.deleteSuccess'))
        loadApps()
      }
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error(t('oauthApps.deleteFailed'))
      }
    }
  }
}

const resetForm = () => {
  appForm.app_name = ''
  appForm.app_description = ''
  appForm.redirect_uris_text = ''
  appForm.scopes = ['read', 'write']
}

onMounted(() => {
  loadApps()
})
</script>

<style scoped lang="scss">
.oauth-apps-container {
  padding: 32px;
  width: 100%;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;

  .header-content {
    .page-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 28px;
      font-weight: 600;
      margin: 0 0 8px;
    }

    .page-subtitle {
      color: var(--el-text-color-secondary);
      margin: 0;
    }
  }
}

.apps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 24px;
}

.app-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .app-title-group {
      display: flex;
      align-items: center;
      gap: 12px;

      .app-name {
        font-weight: 600;
        font-size: 16px;
      }
    }

    .more-icon {
      cursor: pointer;
      padding: 4px;
      border-radius: var(--global-border-radius);
      transition: background 0.2s;

      &:hover {
        background: var(--el-fill-color-light);
      }
    }
  }

  .app-info {
    .description {
      color: var(--el-text-color-regular);
      margin-bottom: 16px;
      line-height: 1.6;
    }

    .credentials {
      margin-bottom: 16px;

      .credential-item {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;

        .label {
          font-weight: 500;
          min-width: 120px;
        }
      }
    }

    .meta {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 14px;
      color: var(--el-text-color-secondary);
    }
  }
}
</style>
