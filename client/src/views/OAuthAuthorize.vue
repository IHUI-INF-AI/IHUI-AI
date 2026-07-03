<template>
  <div class="oauth-authorize-page">
    <div class="authorize-card">
      <!-- 加载中 -->
      <div v-if="loading" class="loading-state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>正在加载应用信息...</span>
      </div>

      <!-- 错误状态 (参数缺失/应用不存在/应用已禁用) -->
      <div v-else-if="initError" class="error-state">
        <el-result icon="error" :title="initError" sub-title="无法继续授权流程, 请联系应用方">
          <template #extra>
            <el-button type="primary" @click="goHome">返回首页</el-button>
          </template>
        </el-result>
      </div>

      <!-- 授权确认表单 -->
      <div v-else-if="appInfo" class="authorize-content">
        <div class="app-header">
          <div class="app-icon">
            <el-image
              v-if="appInfo.icon"
              :src="appInfo.icon"
              fit="cover"
              class="app-icon-img"
            />
            <el-icon v-else :size="48"><Connection /></el-icon>
          </div>
          <h2 class="app-name">{{ appInfo.name }}</h2>
          <p class="app-hint">请求访问您的智汇AI账户</p>
        </div>

        <el-divider />

        <div class="user-info" v-if="userNickname">
          <span>当前登录用户:</span>
          <strong>{{ userNickname }}</strong>
        </div>

        <div class="scope-section">
          <h3 class="section-title">该应用将获得以下权限:</h3>
          <div v-if="requestedScopes.length" class="scope-list">
            <div v-for="scope in requestedScopes" :key="scope" class="scope-item">
              <el-icon class="scope-icon"><Check /></el-icon>
              <div class="scope-detail">
                <span class="scope-name">{{ scopeDisplayName(scope) }}</span>
                <span class="scope-desc">{{ describeScope(scope) }}</span>
              </div>
            </div>
          </div>
          <div v-else class="scope-empty">
            <span>该应用未请求特定权限范围 (将获得默认访问权限)</span>
          </div>
        </div>

        <el-divider />

        <div class="redirect-section">
          <div class="redirect-label">
            <el-icon><InfoFilled /></el-icon>
            <span>授权后将跳转到:</span>
          </div>
          <code class="redirect-uri">{{ redirectUri }}</code>
        </div>

        <div v-if="pkceEnabled" class="pkce-hint">
          <el-tag type="success" size="small">PKCE 已启用</el-tag>
          <span>公开客户端安全保护 (S256)</span>
        </div>

        <el-divider />

        <div class="authorize-actions">
          <el-button
            size="large"
            :loading="submitting"
            @click="handleDeny"
          >
            拒绝
          </el-button>
          <el-button
            type="primary"
            size="large"
            :loading="submitting"
            @click="handleApprove"
          >
            授权
          </el-button>
        </div>

        <p class="security-note">
          授权后该应用可通过 access_token 访问您授权范围内的资源.
          您可随时在用户中心管理已授权应用.
        </p>
      </div>

      <!-- 授权失败状态 -->
      <div v-else-if="submitError" class="error-state">
        <el-result icon="error" title="授权失败" :sub-title="submitError">
          <template #extra>
            <el-button @click="resetToForm">返回</el-button>
            <el-button type="primary" @click="goHome">返回首页</el-button>
          </template>
        </el-result>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loading, Connection, Check, InfoFilled } from '@element-plus/icons-vue'
import {
  getOAuthAppForAuthorize,
  submitOAuthAuthorize,
  type OAuthAppPublic,
  type OAuthAuthorizeParams,
} from '@/api/oauth-authorize'
import {
  getPublicOAuthScopeMetaList,
  DEFAULT_SCOPE_DESCRIPTIONS,
  type PublicOAuthScopeMeta,
} from '@/api/oauth-scope-meta'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const submitting = ref(false)
const initError = ref('')
const submitError = ref('')
const appInfo = ref<OAuthAppPublic | null>(null)

// Round 29-D: 后端动态读取的 scope 元数据 map (scope → meta)
// 拉取失败 / scope 未配置时, 回退到 DEFAULT_SCOPE_DESCRIPTIONS
const scopeMetaMap = ref<Map<string, PublicOAuthScopeMeta>>(new Map())

// 从 URL 读取 OAuth2 授权参数
const clientId = computed(() => String(route.query.client_id || ''))
const redirectUri = computed(() => String(route.query.redirect_uri || ''))
const state = computed(() => String(route.query.state || ''))
const responseType = computed(() => String(route.query.response_type || 'code'))
const scope = computed(() => String(route.query.scope || ''))
const codeChallenge = computed(() => String(route.query.code_challenge || ''))
const codeChallengeMethod = computed(() =>
  String(route.query.code_challenge_method || '')
)
const pkceEnabled = computed(
  () => !!codeChallenge.value && !!codeChallengeMethod.value
)

// 用户请求的 scope 列表 (空格分隔字符串 → 数组)
const requestedScopes = computed(() => {
  if (!scope.value) {
    // 用户未传 scope, 默认展示应用配置的全部 scope
    return appInfo.value?.scopes || []
  }
  return scope.value.split(/\s+/).filter(Boolean)
})

const userNickname = computed(
  () => authStore.nickname || ''
)

// Round 29-D: 优先用后端动态 scope 元数据, 回退到内置默认描述
function describeScope(scopeKey: string): string {
  const meta = scopeMetaMap.value.get(scopeKey)
  if (meta?.description) return meta.description
  return DEFAULT_SCOPE_DESCRIPTIONS[scopeKey] || '访问您授权范围内的相关资源'
}

// Round 29-D: scope 展示名 (优先用元数据中的中文名, 回退到 scope 标识符本身)
function scopeDisplayName(scopeKey: string): string {
  const meta = scopeMetaMap.value.get(scopeKey)
  if (meta?.name) return `${meta.name} (${scopeKey})`
  return scopeKey
}

// Round 29-D: 拉取 scope 元数据 (失败不阻塞授权流程, 回退到默认描述)
async function loadScopeMeta() {
  try {
    const res = await getPublicOAuthScopeMetaList()
    if (res.success && res.data) {
      const map = new Map<string, PublicOAuthScopeMeta>()
      res.data.forEach((m) => map.set(m.scope, m))
      scopeMetaMap.value = map
    }
  } catch {
    // 静默失败, 授权页回退到 DEFAULT_SCOPE_DESCRIPTIONS
  }
}

onMounted(async () => {
  await initAuthorize()
})

async function initAuthorize() {
  loading.value = true
  initError.value = ''

  // 参数校验
  if (!clientId.value) {
    initError.value = '缺少 client_id 参数'
    loading.value = false
    return
  }
  if (!redirectUri.value) {
    initError.value = '缺少 redirect_uri 参数'
    loading.value = false
    return
  }
  if (!state.value) {
    initError.value = '缺少 state 参数 (CSRF 防护必需)'
    loading.value = false
    return
  }
  if (responseType.value !== 'code') {
    initError.value = `不支持的 response_type: ${responseType.value} (仅支持 code)`
    loading.value = false
    return
  }
  // PKCE 参数校验: 传 code_challenge 必须 method=S256
  if (codeChallenge.value && codeChallengeMethod.value !== 'S256') {
    initError.value = 'PKCE code_challenge_method 必须为 S256 (不支持 plain)'
    loading.value = false
    return
  }

  // Round 29-D: 并行拉取应用信息 + scope 元数据 (scope 元数据失败不阻塞)
  const [res] = await Promise.all([
    getOAuthAppForAuthorize(clientId.value),
    loadScopeMeta(),
  ])
  if (!res.success || !res.data) {
    initError.value = res.message || '应用不存在或已禁用'
    loading.value = false
    return
  }
  if (res.data.is_active !== 1) {
    initError.value = '该应用已被禁用, 无法授权'
    loading.value = false
    return
  }
  appInfo.value = res.data
  loading.value = false
}

async function handleApprove() {
  submitting.value = true
  submitError.value = ''
  const params: OAuthAuthorizeParams = {
    client_id: clientId.value,
    redirect_uri: redirectUri.value,
    state: state.value,
    response_type: responseType.value,
  }
  if (scope.value) params.scope = scope.value
  if (codeChallenge.value) {
    params.code_challenge = codeChallenge.value
    params.code_challenge_method = codeChallengeMethod.value
  }

  const res = await submitOAuthAuthorize(params)
  submitting.value = false

  if (!res.success || !res.data) {
    submitError.value = res.message || '授权失败, 请稍后重试'
    return
  }

  // 授权成功, 跳转 redirect_uri?code=xxx&state=yyy
  const result = res.data
  // 校验后端返回的 state 与传入一致 (CSRF 防护)
  if (result.state !== state.value) {
    submitError.value = 'state 不匹配 (CSRF 校验失败)'
    return
  }
  const cbUrl = buildCallbackUrl(redirectUri.value, {
    code: result.code,
    state: result.state,
  })
  window.location.replace(cbUrl)
}

function handleDeny() {
  // 用户拒绝, 跳转 redirect_uri?error=access_denied&state=yyy
  const cbUrl = buildCallbackUrl(redirectUri.value, {
    error: 'access_denied',
    error_description: 'user_denied',
    state: state.value,
  })
  window.location.replace(cbUrl)
}

function buildCallbackUrl(base: string, params: Record<string, string>): string {
  try {
    const url = new URL(base)
    Object.entries(params).forEach(([k, v]) => {
      url.searchParams.set(k, v)
    })
    return url.toString()
  } catch {
    // base 不是绝对 URL, 用查询字符串拼接
    const sep = base.includes('?') ? '&' : '?'
    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
    return `${base}${sep}${qs}`
  }
}

function resetToForm() {
  submitError.value = ''
}

function goHome() {
  router.push('/')
}
</script>

<style scoped>
.oauth-authorize-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--el-bg-color-page);
  padding: 24px;
}

.authorize-card {
  width: 100%;
  max-width: 520px;
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 32px;
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

.error-state {
  padding: 16px 0;
}

.app-header {
  text-align: center;
  margin-bottom: 8px;
}

.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  margin-bottom: 12px;
  overflow: hidden;
}

.app-icon-img {
  width: 100%;
  height: 100%;
}

.app-name {
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 4px;
}

.app-hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 0;
}

.user-info {
  text-align: center;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.user-info strong {
  color: var(--el-text-color-primary);
  margin-left: 4px;
}

.scope-section {
  margin: 16px 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0 0 12px;
}

.scope-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scope-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
}

.scope-icon {
  color: var(--el-color-success);
  margin-top: 2px;
  flex-shrink: 0;
}

.scope-detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.scope-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-family: monospace;
}

.scope-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.scope-empty {
  padding: 12px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.redirect-section {
  margin: 16px 0;
}

.redirect-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}

.redirect-uri {
  display: block;
  padding: 8px 10px;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 12px;
  color: var(--el-text-color-primary);
  word-break: break-all;
  font-family: monospace;
}

.pkce-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.authorize-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin: 16px 0;
}

.authorize-actions .el-button {
  min-width: 120px;
}

.security-note {
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin: 12px 0 0;
  line-height: 1.5;
}
</style>
