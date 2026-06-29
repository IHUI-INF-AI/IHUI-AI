<template>
  <AdminListPage
    title="OAuth 应用管理"
    description="管理 OAuth2 应用: 创建/列表/详情/删除/重置密钥 (Round 25 新增)"
    :columns="columns"
    :data="apps"
    :total="total"
    :loading="loading"
    :show-add="true"
    :show-selection="false"
    add-text="创建应用"
    @add="handleAdd"
    @refresh="fetchApps"
    @page-change="handlePageChange"
    @size-change="handleSizeChange"
  >
    <template #filters>
      <el-form-item label="状态">
        <el-select v-model="filterActive" placeholder="全部" clearable @change="fetchApps">
          <el-option label="活跃" :value="1" />
          <el-option label="已禁用" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item label="范围">
        <el-switch
          v-model="filterIncludeAll"
          active-text="全部应用"
          inactive-text="我的应用"
          @change="fetchApps"
        />
      </el-form-item>
    </template>

    <template #col-icon="{ row }">
      <el-image
        v-if="row.icon"
        :src="row.icon"
        :preview-src-list="[row.icon]"
        fit="cover"
        class="app-icon-thumb"
        :preview-teleported="true"
      />
      <el-icon v-else class="app-icon-placeholder"><Connection /></el-icon>
    </template>

    <template #col-client_id="{ row }">
      <span class="client-id">{{ row.client_id }}</span>
    </template>

    <template #col-redirect_uris="{ row }">
      <div v-if="row.redirect_uris && row.redirect_uris.length">
        <el-tag v-for="uri in row.redirect_uris" :key="uri" size="small" class="uri-tag">
          {{ uri }}
        </el-tag>
      </div>
      <span v-else-if="row.redirect_uri" class="fallback-uri">{{ row.redirect_uri }}</span>
      <span v-else class="empty">-</span>
    </template>

    <template #col-scopes="{ row }">
      <div v-if="row.scopes && row.scopes.length">
        <el-tag v-for="scope in row.scopes" :key="scope" type="warning" size="small" class="scope-tag">
          {{ scope }}
        </el-tag>
      </div>
      <span v-else class="empty">未配置</span>
    </template>

    <template #col-owner_uuid="{ row }">
      <span v-if="row.owner_uuid" class="owner-uuid">{{ row.owner_uuid }}</span>
      <el-tag v-else type="info" size="small">无主(历史)</el-tag>
    </template>

    <template #col-is_active="{ row }">
      <el-tag :type="row.is_active === 1 ? 'success' : 'info'">
        {{ row.is_active === 1 ? '活跃' : '已禁用' }}
      </el-tag>
    </template>

    <template #actions="{ row }">
      <el-button type="primary" link size="small" @click="viewDetail(row)">
        详情
      </el-button>
      <el-button
        v-if="row.is_active === 1"
        type="warning"
        link
        size="small"
        @click="handleResetSecret(row)"
      >
        重置密钥
      </el-button>
      <el-popconfirm
        v-if="row.is_active === 1"
        title="确认删除? (软删除, 置 is_active=0)"
        @confirm="handleDelete(row)"
      >
        <template #reference>
          <el-button type="danger" link size="small">删除</el-button>
        </template>
      </el-popconfirm>
    </template>
  </AdminListPage>

  <!-- 创建应用对话框 -->
  <el-dialog v-model="createDialogVisible" title="创建 OAuth 应用" width="600px">
    <el-form :model="createForm" label-width="120px">
      <el-form-item label="应用名称" required>
        <el-input v-model="createForm.name" placeholder="如: 我的 OAuth 应用" />
      </el-form-item>
      <el-form-item label="应用图标">
        <div class="icon-upload">
          <div class="icon-preview">
            <el-image
              v-if="createForm.icon"
              :src="createForm.icon"
              fit="cover"
              class="icon-preview-img"
            />
            <el-icon v-else class="icon-preview-placeholder"><Connection /></el-icon>
          </div>
          <div class="icon-actions">
            <el-upload
              :show-file-list="false"
              :before-upload="handleIconBeforeUpload"
              :http-request="handleIconUpload"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            >
              <el-button :loading="iconUploading" size="small" type="primary">
                {{ createForm.icon ? '重新上传' : '上传图标' }}
              </el-button>
            </el-upload>
            <el-button
              v-if="createForm.icon"
              size="small"
              type="danger"
              link
              @click="createForm.icon = ''"
            >
              清除
            </el-button>
            <span class="icon-hint">建议 128×128, 最大 1MB (PNG/JPG/GIF/WebP/SVG)</span>
          </div>
        </div>
      </el-form-item>
      <el-form-item label="单回调 URI">
        <el-input v-model="createForm.redirect_uri" placeholder="https://example.com/cb (可选, 向后兼容)" />
      </el-form-item>
      <el-form-item label="回调白名单">
        <div class="uri-list">
          <div v-for="(uri, idx) in createForm.redirect_uris" :key="idx" class="uri-input-row">
            <el-input v-model="createForm.redirect_uris[idx]" placeholder="https://example.com/cb" />
            <el-button type="danger" link @click="removeUri(idx)">删除</el-button>
          </div>
          <el-button type="primary" link @click="addUri">+ 添加回调 URI</el-button>
        </div>
      </el-form-item>
      <el-form-item label="权限范围">
        <div class="scope-list">
          <div v-for="(scope, idx) in createForm.scopes" :key="idx" class="scope-input-row">
            <el-input v-model="createForm.scopes[idx]" placeholder="如: read:profile" />
            <el-button type="danger" link @click="removeScope(idx)">删除</el-button>
          </div>
          <el-button type="primary" link @click="addScope">+ 添加 Scope</el-button>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="createDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="creating" @click="submitCreate">创建</el-button>
    </template>
  </el-dialog>

  <!-- 创建/重置密钥结果对话框 (展示 client_secret, 仅此一次) -->
  <el-dialog v-model="secretDialogVisible" title="⚠️ 应用密钥 (仅此一次)" width="600px">
    <el-alert
      title="client_secret 仅此一次返回, 请立即保存! 关闭后无法再次查看."
      type="warning"
      :closable="false"
      show-icon
    />
    <div class="secret-display">
      <div class="secret-row">
        <span class="label">client_id:</span>
        <el-input :model-value="secretResult?.client_id" readonly>
          <template #append>
            <el-button @click="copyText(secretResult?.client_id || '')">复制</el-button>
          </template>
        </el-input>
      </div>
      <div class="secret-row">
        <span class="label">client_secret:</span>
        <el-input :model-value="secretResult?.client_secret" readonly>
          <template #append>
            <el-button @click="copyText(secretResult?.client_secret || '')">复制</el-button>
          </template>
        </el-input>
      </div>
    </div>
    <template #footer>
      <el-button type="primary" @click="secretDialogVisible = false">我已保存</el-button>
    </template>
  </el-dialog>

  <!-- 详情对话框 -->
  <el-dialog v-model="detailDialogVisible" title="OAuth 应用详情" width="600px">
    <el-descriptions :column="1" border v-if="detailData">
      <el-descriptions-item label="ID">{{ detailData.id }}</el-descriptions-item>
      <el-descriptions-item label="应用图标">
        <el-image
          v-if="detailData.icon"
          :src="detailData.icon"
          :preview-src-list="[detailData.icon]"
          fit="cover"
          class="detail-icon-img"
          :preview-teleported="true"
        />
        <span v-else class="empty">未设置</span>
      </el-descriptions-item>
      <el-descriptions-item label="client_id">{{ detailData.client_id }}</el-descriptions-item>
      <el-descriptions-item label="名称">{{ detailData.name }}</el-descriptions-item>
      <el-descriptions-item label="单回调 URI">{{ detailData.redirect_uri || '-' }}</el-descriptions-item>
      <el-descriptions-item label="回调白名单">
        <div v-if="detailData.redirect_uris && detailData.redirect_uris.length">
          <div v-for="uri in detailData.redirect_uris" :key="uri">{{ uri }}</div>
        </div>
        <span v-else>-</span>
      </el-descriptions-item>
      <el-descriptions-item label="权限范围">
        <div v-if="detailData.scopes && detailData.scopes.length">
          <el-tag v-for="scope in detailData.scopes" :key="scope" type="warning" size="small" class="scope-tag">
            {{ scope }}
          </el-tag>
        </div>
        <span v-else>未配置</span>
      </el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="detailData.is_active === 1 ? 'success' : 'info'">
          {{ detailData.is_active === 1 ? '活跃' : '已禁用' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="创建者">
        <span v-if="detailData.owner_uuid" class="owner-uuid">{{ detailData.owner_uuid }}</span>
        <el-tag v-else type="info" size="small">无主(历史)</el-tag>
      </el-descriptions-item>
    </el-descriptions>
    <template #footer>
      <el-button @click="detailDialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Connection } from '@element-plus/icons-vue'
import AdminListPage from '@/components/admin/AdminListPage.vue'
import type { TableColumn } from '@/components/admin/AdminListPage.vue'
import {
  getAdminOAuthApps,
  getAdminOAuthAppDetail,
  createAdminOAuthApp,
  deleteAdminOAuthApp,
  resetAdminOAuthAppSecret,
  type AdminOAuthApp,
  type AdminOAuthAppWithSecret,
} from '@/api/admin-oauth-apps'
import { uploadFormFile } from '@/api/file-upload'

const apps = ref<AdminOAuthApp[]>([])
const total = ref(0)
const loading = ref(false)
const filterActive = ref<number | undefined>(undefined)
const filterIncludeAll = ref(false) // Round 31-B: false=仅我的, true=全部
const currentPage = ref(1)
const pageSize = ref(10)

const columns = computed<TableColumn[]>(() => [
  { prop: 'id', label: 'ID', width: 80 },
  { prop: 'icon', label: '图标', width: 80, slot: true },
  { prop: 'client_id', label: 'Client ID', width: 220, slot: true },
  { prop: 'name', label: '应用名称', width: 180 },
  { prop: 'redirect_uris', label: '回调 URI', minWidth: 250, slot: true },
  { prop: 'scopes', label: '权限范围', minWidth: 200, slot: true },
  { prop: 'owner_uuid', label: '创建者', width: 180, slot: true },
  { prop: 'is_active', label: '状态', width: 100, slot: true },
])

// 创建对话框
const createDialogVisible = ref(false)
const creating = ref(false)
const iconUploading = ref(false)
const createForm = ref({
  name: '',
  redirect_uri: '',
  redirect_uris: [] as string[],
  scopes: [] as string[],
  icon: '',
})

// Round 29-A: 图标上传前校验 (类型 + 大小)
function handleIconBeforeUpload(file: File): boolean {
  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ]
  if (!allowedTypes.includes(file.type)) {
    ElMessage.error('图标格式仅支持 PNG/JPG/GIF/WebP/SVG')
    return false
  }
  if (file.size > 1024 * 1024) {
    ElMessage.error('图标大小不能超过 1MB')
    return false
  }
  return true
}

// Round 29-A: 自定义上传 (复用 uploadFormFile)
async function handleIconUpload(options: { file: File }): Promise<void> {
  const { file } = options
  iconUploading.value = true
  try {
    const res = await uploadFormFile(file)
    if (res.success && res.data?.url) {
      createForm.value.icon = res.data.url
      ElMessage.success('图标上传成功')
    } else {
      ElMessage.error(res.message || '图标上传失败')
    }
  } catch (e) {
    ElMessage.error((e as Error)?.message || '图标上传失败')
  } finally {
    iconUploading.value = false
  }
}

// 密钥结果对话框
const secretDialogVisible = ref(false)
const secretResult = ref<AdminOAuthAppWithSecret | null>(null)

// 详情对话框
const detailDialogVisible = ref(false)
const detailData = ref<AdminOAuthApp | null>(null)

async function fetchApps() {
  loading.value = true
  try {
    const res = await getAdminOAuthApps({
      is_active: filterActive.value,
      include_all: filterIncludeAll.value ? 1 : 0,
    })
    if (res.success && res.data) {
      apps.value = res.data
      total.value = res.data.length
    } else {
      ElMessage.error(res.message || '获取列表失败')
    }
  } catch (e) {
    ElMessage.error((e as Error)?.message || '获取列表失败')
  } finally {
    loading.value = false
  }
}

function handleAdd() {
  createForm.value = { name: '', redirect_uri: '', redirect_uris: [], scopes: [], icon: '' }
  createDialogVisible.value = true
}

function addUri() {
  createForm.value.redirect_uris.push('')
}

function removeUri(idx: number) {
  createForm.value.redirect_uris.splice(idx, 1)
}

function addScope() {
  createForm.value.scopes.push('')
}

function removeScope(idx: number) {
  createForm.value.scopes.splice(idx, 1)
}

async function submitCreate() {
  if (!createForm.value.name.trim()) {
    ElMessage.warning('应用名称不能为空')
    return
  }
  creating.value = true
  try {
    const payload = {
      name: createForm.value.name.trim(),
      redirect_uri: createForm.value.redirect_uri.trim() || undefined,
      redirect_uris: createForm.value.redirect_uris.filter((u) => u.trim()).length
        ? createForm.value.redirect_uris.filter((u) => u.trim())
        : undefined,
      scopes: createForm.value.scopes.filter((s) => s.trim()).length
        ? createForm.value.scopes.filter((s) => s.trim())
        : undefined,
      icon: createForm.value.icon.trim() || undefined,
    }
    const res = await createAdminOAuthApp(payload)
    if (res.success && res.data) {
      ElMessage.success('创建成功')
      createDialogVisible.value = false
      secretResult.value = res.data
      secretDialogVisible.value = true
      fetchApps()
    } else {
      ElMessage.error(res.message || '创建失败')
    }
  } catch (e) {
    ElMessage.error((e as Error)?.message || '创建失败')
  } finally {
    creating.value = false
  }
}

async function viewDetail(row: AdminOAuthApp) {
  try {
    const res = await getAdminOAuthAppDetail(row.client_id)
    if (res.success && res.data) {
      detailData.value = res.data
      detailDialogVisible.value = true
    } else {
      ElMessage.error(res.message || '获取详情失败')
    }
  } catch (e) {
    ElMessage.error((e as Error)?.message || '获取详情失败')
  }
}

async function handleDelete(row: AdminOAuthApp) {
  try {
    const res = await deleteAdminOAuthApp(row.client_id)
    if (res.success) {
      ElMessage.success('删除成功 (已禁用)')
      fetchApps()
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch (e) {
    ElMessage.error((e as Error)?.message || '删除失败')
  }
}

async function handleResetSecret(row: AdminOAuthApp) {
  try {
    const res = await resetAdminOAuthAppSecret(row.client_id)
    if (res.success && res.data) {
      ElMessage.success('密钥已重置, 旧 secret 立即失效')
      secretResult.value = res.data
      secretDialogVisible.value = true
    } else {
      ElMessage.error(res.message || '重置密钥失败')
    }
  } catch (e) {
    ElMessage.error((e as Error)?.message || '重置密钥失败')
  }
}

function copyText(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => ElMessage.success('已复制到剪贴板'))
    .catch(() => ElMessage.error('复制失败'))
}

function handlePageChange(page: number) {
  currentPage.value = page
}

function handleSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
}

onMounted(() => {
  fetchApps()
})
</script>

<style scoped>
.client-id {
  font-family: monospace;
  font-size: 12px;
}

.owner-uuid {
  font-family: monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}

.app-icon-thumb {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  border: 1px solid var(--el-border-color-lighter);
}

.app-icon-placeholder {
  font-size: 24px;
  color: var(--el-text-color-placeholder);
}

.icon-upload {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  width: 100%;
}

.icon-preview {
  width: 64px;
  height: 64px;
  border: 1px dashed var(--el-border-color);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  background-color: var(--el-fill-color-light);
}

.icon-preview-img {
  width: 100%;
  height: 100%;
}

.icon-preview-placeholder {
  font-size: 28px;
  color: var(--el-text-color-placeholder);
}

.icon-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.icon-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  line-height: 1.4;
}

.detail-icon-img {
  width: 80px;
  height: 80px;
  border-radius: 4px;
  border: 1px solid var(--el-border-color-lighter);
}

.uri-tag,
.scope-tag {
  margin: 2px;
}

.fallback-uri {
  font-family: monospace;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.empty {
  color: var(--el-text-color-placeholder);
}

.uri-list,
.scope-list {
  width: 100%;
}

.uri-input-row,
.scope-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.secret-display {
  margin-top: 16px;
}

.secret-row {
  margin-bottom: 12px;
}

.secret-row .label {
  display: block;
  margin-bottom: 4px;
  font-weight: bold;
  color: var(--el-text-color-primary);
}
</style>
