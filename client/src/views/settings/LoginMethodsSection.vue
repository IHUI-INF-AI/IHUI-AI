<!--
  LoginMethodsSection - 我的登录方式 section 内容
  嵌入 Settings.vue 的"我的登录方式"卡片中，集中展示手机/邮箱/密码/微信/Google/Apple 等登录方式
-->
<template>
  <div class="login-methods-list" :class="{ 'is-loading': loading }">
    <!-- 手机号 -->
    <div class="login-method-row">
      <div class="method-icon-box">
        <PhoneIcon class="method-icon-svg" :size="20" />
      </div>
      <div class="method-info">
        <div class="method-name">{{ t('settings.loginMethods.phone') }}</div>
        <div class="method-detail">
          <template v-if="phoneMasked">
            {{ phoneMasked }}
          </template>
          <template v-else>
            {{ t('settings.loginMethods.noPhone') }}
          </template>
        </div>
      </div>
      <span :class="['status-tag', phoneMasked ? 'bound' : 'unbound']">
        {{ phoneMasked ? t('settings.loginMethods.bound') : t('settings.loginMethods.unbound') }}
      </span>
      <div class="method-actions">
        <button
          v-if="phoneMasked"
          type="button"
          class="bind-btn"
          @click="handleChangePhone"
        >
          {{ t('settings.loginMethods.change') }}
        </button>
        <button v-else type="button" class="bind-btn primary" @click="handleBindPhone">
          {{ t('settings.loginMethods.bind') }}
        </button>
      </div>
    </div>

    <!-- 邮箱 -->
    <div class="login-method-row">
      <div class="method-icon-box">
        <MailIcon class="method-icon-svg" :size="20" />
      </div>
      <div class="method-info">
        <div class="method-name">{{ t('settings.loginMethods.email') }}</div>
        <div class="method-detail">
          <template v-if="userInfo?.email">
            {{ maskEmail(userInfo.email) }}
          </template>
          <template v-else>
            {{ t('settings.loginMethods.noEmail') }}
          </template>
        </div>
      </div>
      <span :class="['status-tag', userInfo?.email ? 'bound' : 'unbound']">
        {{ userInfo?.email ? t('settings.loginMethods.bound') : t('settings.loginMethods.unbound') }}
      </span>
      <div class="method-actions">
        <button
          v-if="userInfo?.email"
          type="button"
          class="bind-btn"
          @click="handleChangeEmail"
        >
          {{ t('settings.loginMethods.change') }}
        </button>
        <button v-else type="button" class="bind-btn primary" @click="handleBindEmail">
          {{ t('settings.loginMethods.bind') }}
        </button>
      </div>
    </div>

    <!-- 密码 -->
    <div class="login-method-row">
      <div class="method-icon-box">
        <LockIcon class="method-icon-svg" :size="20" />
      </div>
      <div class="method-info">
        <div class="method-name">{{ t('settings.loginMethods.password') }}</div>
        <div class="method-detail">••••••••</div>
      </div>
      <span class="status-tag bound">{{ t('settings.loginMethods.set') }}</span>
      <div class="method-actions">
        <button
          type="button"
          class="bind-btn"
          @click="handleChangePassword"
        >
          {{ t('settings.loginMethods.changePassword') }}
        </button>
      </div>
    </div>

    <!-- 第三方平台分隔 -->
    <div class="platforms-divider">
      <span class="divider-line"></span>
      <span class="divider-text">{{ t('settings.loginMethods.thirdPartyDivider') }}</span>
      <span class="divider-line"></span>
    </div>

    <!-- 微信 -->
    <div v-for="platform in PLATFORMS" :key="platform.key" class="login-method-row">
      <div class="method-icon-box platform-icon-box">
        <img
          :src="platform.iconUrl"
          :alt="platform.name"
          class="platform-icon-img"
          loading="lazy"
          @error="handleIconError(platform.key, $event)"
        />
      </div>
      <div class="method-info">
        <div class="method-name">{{ platform.name }}</div>
        <div class="method-detail">
          <template v-if="getBoundAccount(platform.key)">
            {{ t('settings.loginMethods.boundAs', { nickname: getBoundAccount(platform.key)!.platformUsername }) }}
          </template>
          <template v-else>
            {{ t('settings.loginMethods.unbound') }}
          </template>
        </div>
      </div>
      <span :class="['status-tag', getBoundAccount(platform.key) ? 'bound' : 'unbound']">
        {{ getBoundAccount(platform.key) ? t('settings.loginMethods.bound') : t('settings.loginMethods.unbound') }}
      </span>
      <div class="method-actions">
        <button
          v-if="getBoundAccount(platform.key)"
          type="button"
          class="bind-btn danger"
          @click="handleUnbindThirdParty(platform.key, platform.name)"
        >
          {{ t('settings.loginMethods.unbind') }}
        </button>
        <button v-else type="button" class="bind-btn primary" @click="handleBindThirdParty(platform.key, platform.name)">
          {{ t('settings.loginMethods.bind') }}
        </button>
      </div>
    </div>

    <!-- 移动端显示错误 -->
    <div v-if="loadError" class="load-error">{{ loadError }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import {
  getUserThirdPartyAccounts,
  unbindThirdPartyAccount,
  type UserThirdPartyAccount,
} from '@/api/user'
import { PhoneIcon, MailIcon, LockIcon } from '@/components/login/icons/login-icons'
import { logger } from '@/utils/logger'

interface Props {
  userInfo?: { phone?: string; email?: string; username?: string; hasPassword?: boolean }
}

const props = withDefaults(defineProps<Props>(), {
  userInfo: () => ({}),
})

const emit = defineEmits<{ refresh: [] }>()

const { t } = useI18n()

// 第三方平台配置
const PLATFORMS = [
  { key: 'wechat', name: 'WeChat', iconUrl: '/images/loginSANFANG/微信.svg' },
  { key: 'google', name: 'Google', iconUrl: '/images/loginSANFANG/谷歌.svg' },
  { key: 'apple', name: 'Apple', iconUrl: '/images/loginSANFANG/apple.svg' },
  { key: 'github', name: 'GitHub', iconUrl: '/images/loginSANFANG/Github.svg' },
] as const

// 第三方账号列表
const thirdPartyList = ref<UserThirdPartyAccount[]>([])
const loading = ref(false)
const loadError = ref('')
const iconErrors = ref<Record<string, boolean>>({})

// 手机号脱敏
const phoneMasked = computed(() => {
  const phone = props.userInfo?.phone?.trim()
  if (!phone) return ''
  if (phone.length < 7) return phone
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
})

// 邮箱脱敏
const maskEmail = (email: string): string => {
  if (!email) return ''
  const [user, domain] = email.split('@')
  if (!user || !domain) return email
  const maskedUser = user.length <= 2 ? user[0] + '*' : `${user.slice(0, 2)}***`
  return `${maskedUser}@${domain}`
}

// 加载第三方账号
const loadThirdParty = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const res = await getUserThirdPartyAccounts()
    thirdPartyList.value = (res as unknown as { data: UserThirdPartyAccount[] })?.data || []
  } catch (err) {
    logger.error('[LoginMethodsSection] load third-party accounts failed', err)
    loadError.value = t('settings.loginMethods.loadingError')
  } finally {
    loading.value = false
  }
}

onMounted(loadThirdParty)

// 获取已绑定的某平台账号
const getBoundAccount = (platform: string): UserThirdPartyAccount | undefined => {
  return thirdPartyList.value.find((a) => a.platform === platform && a.status === 1)
}

// 图标加载失败 → 隐藏
const handleIconError = (platformKey: string, ev: Event) => {
  iconErrors.value[platformKey] = true
  const img = ev.target as HTMLImageElement
  img.style.display = 'none'
}

// 绑定手机号
const handleBindPhone = () => {
  ElMessage.info(t('settings.loginMethods.bindThirdPartyHint', { platform: t('settings.loginMethods.phone') }))
  // TODO: 接入 PhoneBindingDialog
}

// 更换手机号
const handleChangePhone = () => {
  handleBindPhone()
}

// 绑定邮箱
const handleBindEmail = () => {
  ElMessage.info(t('settings.loginMethods.bindThirdPartyHint', { platform: t('settings.loginMethods.email') }))
  // TODO: 接入 AccountBindDialog
}

// 更换邮箱
const handleChangeEmail = () => {
  handleBindEmail()
}

// 修改密码（跳转至现有 changePassword 流程）
const handleChangePassword = () => {
  // 通过事件通知父组件触发 withSensitiveVerification
  emit('refresh')
  ElMessage.info(t('settings.actions.changePassword'))
}

// 绑定第三方平台
const handleBindThirdParty = (platformKey: string, platformName: string) => {
  ElMessage.info(t('settings.loginMethods.bindThirdPartyHint', { platform: platformName }))
  // TODO: 接入微信扫码 / Google OAuth / Apple Sign-In
}

// 解绑第三方平台
const handleUnbindThirdParty = async (platformKey: string, platformName: string) => {
  const account = getBoundAccount(platformKey)
  if (!account) return

  try {
    await ElMessageBox.confirm(
      t('settings.loginMethods.unbindConfirm', { name: platformName }),
      t('settings.loginMethods.unbindTitle'),
      {
        type: 'warning',
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        customClass: 'login-methods-unbind-dialog',
      },
    )
  } catch {
    return
  }

  try {
    await unbindThirdPartyAccount(account.id)
    ElMessage.success(t('settings.loginMethods.unbindSuccess', { name: platformName }))
    await loadThirdParty()
    emit('refresh')
  } catch (err) {
    logger.error('[LoginMethodsSection] unbind failed', err)
  }
}
</script>

<style scoped lang="scss">
.login-methods-list {
  display: flex;
  flex-direction: column;
  padding: 8px 4px;
}

.login-method-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: var(--global-border-radius);
  background-color: transparent;
  transition: background-color 0.2s ease;
  min-height: 68px;

  &:hover {
    background-color: var(--el-fill-color-light);
  }

  & + .login-method-row {
    margin-top: 2px;
  }
}

.method-icon-box {
  width: 40px;
  height: 40px;
  border-radius: var(--global-border-radius);
  border: 1px solid var(--border-unified-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-primary);
  flex-shrink: 0;
  background-color: var(--el-bg-color);
  transition: border-color 0.2s ease;

  .login-method-row:hover & {
    border-color: var(--border-unified-color-hover);
  }
}

.method-icon-svg {
  color: var(--el-text-color-primary);
}

.platform-icon-box {
  padding: 8px;
}

.platform-icon-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  display: block;
}

.method-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.method-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.4;
}

.method-detail {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
}

.status-tag {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: var(--global-border-radius);
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;

  &.bound {
    background-color: var(--el-color-success-light-9);
    color: var(--el-color-success);
  }

  &.unbound {
    background-color: var(--el-fill-color);
    color: var(--el-text-color-secondary);
  }
}

.method-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.bind-btn {
  border: 1px solid var(--border-unified-color);
  color: var(--el-text-color-primary);
  background: transparent;
  border-radius: var(--global-border-radius);
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
  white-space: nowrap;
  min-width: 64px;
  line-height: 1.4;

  &:hover {
    border-color: var(--border-unified-color-hover);
    background-color: var(--el-fill-color-light);
  }

  &.primary {
    border-color: var(--el-text-color-primary);
    color: var(--el-text-color-primary);
    font-weight: 600;

    &:hover {
      /* 2026-07-05 修复: 禁背景 token 作文字色硬约束, 反相配对重构为 #ffffff + html.dark #1a1a1a */
      background-color: var(--el-text-color-primary);
      color: #ffffff;
    }
  }

  &.danger {
    color: var(--el-color-danger);
    border-color: var(--el-color-danger-light-5);

    &:hover {
      border-color: var(--el-color-danger);
      background-color: var(--el-color-danger-light-9);
    }
  }
}

.platforms-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0 8px;
  padding: 0 16px;

  .divider-line {
    flex: 1;
    height: 1px;
    background-color: var(--el-border-color-lighter);
  }

  .divider-text {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    letter-spacing: 0.05em;
    padding: 4px 12px;
    background-color: var(--el-fill-color-light);
    border-radius: var(--global-border-radius);
  }
}

.load-error {
  margin-top: 12px;
  padding: 8px 16px;
  font-size: 12px;
  color: var(--el-color-danger);
  background-color: var(--el-color-danger-light-9);
  border-radius: var(--global-border-radius-sm, 4px);
  text-align: center;
}

/* 暗色模式 */
html.dark {
  .platform-icon-box {
    background-color: var(--el-bg-color);
  }

  .bind-btn.primary:hover {
    background-color: #ffffff;
    color: #1a1a1a;
  }
}

/* 移动端 */
@media (width <= 768px) {
  .login-method-row {
    flex-wrap: wrap;
    gap: 10px;
    padding: 12px;
    min-height: 0;
  }

  .method-info {
    flex: 1 1 calc(100% - 60px);
  }

  .status-tag {
    margin-left: auto;
  }

  .method-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .bind-btn {
    flex: 1;
    max-width: 100px;
  }
}
</style>
