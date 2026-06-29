<template>
  <div class="my-authorized-page">
    <div class="page-header">
      <h1 class="page-title">已授权应用管理</h1>
      <p class="page-desc">
        管理您已授权的第三方 OAuth 应用. 撤销后该应用将无法再代表您发起授权请求.
        (Round 29-B 新增)
      </p>
    </div>

    <div class="content-card">
      <!-- 加载中 -->
      <div v-if="loading" class="loading-state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>正在加载...</span>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!apps.length" class="empty-state">
        <el-empty description="您还没有授权任何第三方应用">
          <el-button type="primary" @click="goHome">返回首页</el-button>
        </el-empty>
      </div>

      <!-- 已授权应用列表 -->
      <div v-else class="app-list">
        <div v-for="app in apps" :key="app.session_id" class="app-item">
          <div class="app-icon">
            <el-image
              v-if="app.app_icon"
              :src="app.app_icon"
              :preview-src-list="[app.app_icon]"
              fit="cover"
              class="app-icon-img"
              :preview-teleported="true"
            />
            <el-icon v-else class="app-icon-placeholder"><Connection /></el-icon>
          </div>

          <div class="app-info">
            <div class="app-info-header">
              <span class="app-name">{{ app.app_name || '(未命名应用)' }}</span>
              <el-tag
                :type="app.app_active === 1 ? 'success' : 'info'"
                size="small"
              >
                {{ app.app_active === 1 ? '应用活跃' : '应用已禁用' }}
              </el-tag>
              <el-tag
                v-if="app.is_used === 1"
                type="primary"
                size="small"
              >
                已换 token
              </el-tag>
              <el-tag v-else type="warning" size="small">
                code 未使用
              </el-tag>
            </div>
            <div class="app-meta">
              <span class="meta-item">
                <span class="meta-label">Client ID:</span>
                <code class="mono-text">{{ app.client_id }}</code>
              </span>
              <span class="meta-item">
                <span class="meta-label">授权时间:</span>
                <span>{{ formatTime(app.created_at) }}</span>
              </span>
              <span class="meta-item">
                <span class="meta-label">code 过期:</span>
                <span>{{ formatTime(app.expires_at) }}</span>
              </span>
            </div>
            <div v-if="scopeListOf(app).length" class="app-scopes">
              <span class="scope-label">授权范围:</span>
              <el-tag
                v-for="scope in scopeListOf(app)"
                :key="scope"
                type="warning"
                size="small"
                class="scope-tag"
              >
                {{ scope }}
              </el-tag>
            </div>
          </div>

          <div class="app-actions">
            <el-popconfirm
              title="确认撤销该应用的授权? 撤销后该应用无法再发起授权请求"
              @confirm="handleRevoke(app)"
            >
              <template #reference>
                <el-button
                  type="danger"
                  size="small"
                  :loading="revokingId === app.session_id"
                >
                  撤销授权
                </el-button>
              </template>
            </el-popconfirm>
          </div>
        </div>
      </div>
    </div>

    <!-- 安全说明 -->
    <div class="security-notes">
      <el-alert type="info" :closable="false" show-icon>
        <template #title>
          <span class="notes-title">安全说明</span>
        </template>
        <ul class="notes-list">
          <li>撤销授权会删除该应用的授权记录 (OAuthSession), 该应用无法再用旧 code 换 token.</li>
          <li>已签发的 access_token 在 TTL (1 小时) 内仍可用, 期满自动失效.</li>
          <li>如需再次使用该应用, 请重新走授权流程 (会生成新的 session 记录).</li>
          <li>所有撤销操作均会记录到 OAuth 审计日志, 供管理员追溯.</li>
        </ul>
      </el-alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Loading, Connection } from '@element-plus/icons-vue'
import {
  getMyAuthorizedApps,
  revokeMyAuthorizedApp,
  type MyAuthorizedApp,
} from '@/api/oauth-my-authorized'

const router = useRouter()

const apps = ref<MyAuthorizedApp[]>([])
const loading = ref(false)
const revokingId = ref<number | null>(null)

async function fetchApps() {
  loading.value = true
  try {
    const res = await getMyAuthorizedApps()
    if (res.success && res.data) {
      apps.value = res.data
    } else {
      ElMessage.error(res.message || '获取已授权应用失败')
      apps.value = []
    }
  } catch (e) {
    ElMessage.error((e as Error)?.message || '获取已授权应用失败')
    apps.value = []
  } finally {
    loading.value = false
  }
}

async function handleRevoke(app: MyAuthorizedApp) {
  revokingId.value = app.session_id
  try {
    const res = await revokeMyAuthorizedApp(app.session_id)
    if (res.success) {
      ElMessage.success('已撤销授权')
      apps.value = apps.value.filter((a) => a.session_id !== app.session_id)
    } else {
      ElMessage.error(res.message || '撤销授权失败')
    }
  } catch (e) {
    ElMessage.error((e as Error)?.message || '撤销授权失败')
  } finally {
    revokingId.value = null
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

// 后端 scope 字段是空格分隔字符串, 前端切分为数组展示
function scopeListOf(app: MyAuthorizedApp): string[] {
  if (!app.scope) return []
  return app.scope.split(/\s+/).filter(Boolean)
}

function goHome() {
  router.push('/')
}

onMounted(() => {
  fetchApps()
})
</script>

<style scoped>
.my-authorized-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 16px;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 8px 0;
}

.page-desc {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 0;
  line-height: 1.6;
}

.content-card {
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 0;
  color: var(--el-text-color-secondary);
}

.loading-state .is-loading {
  font-size: 32px;
}

.empty-state {
  padding: 24px 0;
}

.app-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.app-item {
  display: flex;
  gap: 16px;
  padding: 16px;
  background-color: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  align-items: flex-start;
}

.app-icon {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  background-color: var(--el-bg-color);
}

.app-icon-img {
  width: 100%;
  height: 100%;
}

.app-icon-placeholder {
  font-size: 28px;
  color: var(--el-text-color-placeholder);
}

.app-info {
  flex: 1;
  min-width: 0;
}

.app-info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.app-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.app-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.meta-item {
  display: flex;
  gap: 6px;
  align-items: center;
}

.meta-label {
  color: var(--el-text-color-placeholder);
}

.mono-text {
  font-family: monospace;
  word-break: break-all;
}

.app-scopes {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12px;
}

.scope-label {
  color: var(--el-text-color-placeholder);
}

.scope-tag {
  margin: 2px;
}

.app-actions {
  flex-shrink: 0;
}

.security-notes {
  margin-top: 16px;
}

.notes-title {
  font-weight: 600;
}

.notes-list {
  margin: 8px 0 0 0;
  padding-left: 20px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.7;
}

.notes-list li {
  margin-bottom: 2px;
}
</style>
