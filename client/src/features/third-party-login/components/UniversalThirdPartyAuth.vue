<template>
  <div class="universal-third-party-auth">
    <!-- 快速登录标题 -->
    <div class="auth-header">
      <h3>{{ t('login.thirdParty.quickLogin') }}</h3>
      <p>{{ t('login.thirdParty.selectPreferred') }}</p>
    </div>

    <!-- 登录方式选择 -->
    <div class="auth-methods">
      <div
        v-for="method in allMethods"
        :key="method.key"
        class="auth-method-card"
        :class="{
          active: activeMethod === method.key,
          disabled: !method.enabled,
        }"
        @click="selectMethod(method.key)"
      >
        <div class="method-icon" :class="method.key">
          <component :is="method.iconComponent" v-if="method.iconComponent" class="platform-icon" />
          <svg v-else-if="method.iconPath" viewBox="0 0 24 24" class="platform-icon">
            <path
              v-for="(path, index) in method.iconPath"
              :key="index"
              :d="path.d"
              :fill="path.fill"
            />
          </svg>
        </div>
        <div class="method-info">
          <h4>{{ method.name }}</h4>
          <p>{{ method.description }}</p>
        </div>
        <div class="method-status">
          <el-icon v-if="method.enabled"><Check /></el-icon>
          <el-icon v-else><X /></el-icon>
        </div>
      </div>
    </div>

    <!-- 登录组件显示区域 -->
    <div class="auth-content" v-if="activeMethod">
      <el-card class="auth-card" shadow="hover">
        <component
          :is="getMethodComponent(activeMethod)"
          :auto-start="true"
          mode="button"
          :auto-load="true"
          @login-success="handleLoginSuccess"
          @login-error="handleLoginError"
          @switch-method="handleSwitchMethod"
          @close="handleX"
        />
      </el-card>
    </div>

    <!-- 其他登录选项 -->
    <div class="other-options">
      <el-divider>
        <span class="divider-text">{{ t('login.thirdParty.otherMethods') }}</span>
      </el-divider>

      <div class="option-buttons">
        <el-button
          type="primary"
          plain
          @click="$emit('switch-method', 'account')"
          class="option-btn"
        >
          <el-icon><User /></el-icon>{{ t('login.thirdParty.accountLogin') }}</el-button>

        <el-button type="success" plain @click="$emit('switch-method', 'phone')" class="option-btn">
          <el-icon><Phone /></el-icon>{{ t('login.thirdParty.phoneLogin') }}</el-button>

        <el-button
          type="info"
          plain
          @click="$emit('switch-method', 'email')"
          class="option-btn"
          disabled
        >
          <el-icon><MessageSquare /></el-icon>{{ t('login.thirdParty.emailLogin') }}<el-tag size="small" type="info" class="coming-soon">{{ t('login.thirdParty.comingSoon') }}</el-tag>
        </el-button>
      </div>
    </div>

    <!-- 安全提示 -->
    <div class="security-notice">
      <el-alert
        :title="t('universalThirdPartyAuth.securityTip')"
        type="info"
        :closable="false"
        show-icon
      >
        <template #default>
          <p>{{ t('login.thirdParty.securityNotice1') }}</p>
          <p>{{ t('login.thirdParty.securityNotice2') }}</p>
          <p>{{ t('login.thirdParty.securityNotice3') }}</p>
        </template>
      </el-alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, X, User, Phone, MessageSquare } from '@/lib/lucide-fallback'
import { logger } from '@/utils/logger'

import GoogleLogin from './GoogleLogin.vue'


import AppleLogin from './AppleLogin.vue'
import { FEISHU_AUTH_URL } from '@/constants/feishu'

interface AuthMethod {
  key: string
  name: string
  description: string
  enabled: boolean
  component: any
  iconComponent?: any
  iconPath?: { d: string; fill: string }[]
}

interface Emits {
  (
    e: 'login-success',
    data: { token: string; user: Record<string, unknown>; loginType: string }
  ): void
  (e: 'login-error', error: any): void
  (e: 'switch-method', method: string): void
}

const emit = defineEmits<Emits>()

// 状态管理
const activeMethod = ref<string>('')

// 所有支持的登录方式
const allMethods: AuthMethod[] = [
  {
    key: 'google',
    name: t('data.universal_third_party_auth.Google登录'),
    description: t('data.universal_third_party_auth.全球通用登录1'),
    enabled: true,
    component: GoogleLogin,
    iconPath: [
      {
        d: 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z',
        fill: 'var(--el-text-color-primary)',
      },
      {
        d: 'M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z',
        fill: 'var(--el-text-color-primary)',
      },
      {
        d: 'M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z',
        fill: 'var(--el-text-color-primary)',
      },
      {
        d: 'M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z',
        fill: 'var(--el-text-color-primary)',
      },
    ],
  },
  {
    key: 'apple',
    name: t('data.universal_third_party_auth.Apple登录2'),
    description: t('data.universal_third_party_auth.使用AppleI3'),
    enabled: true,
    component: AppleLogin,
    iconPath: [
      {
        d: 'M17.052 14.764c-.118 1.341-.726 2.523-1.797 3.304-.917.674-2.07 1.058-3.242 1.086-1.165.028-2.324-.308-3.221-.942-.912-.644-1.523-1.579-1.74-2.656-.217-1.077-.065-2.204.423-3.178.488-.974 1.275-1.761 2.249-2.249.974-.488 2.101-.64 3.178-.423 1.077.217 2.012.828 2.656 1.74-.726.423-1.201 1.178-1.201 2.039 0 .861.475 1.616 1.201 2.039zm-3.159-10.368c.889 1.016-.245 2.498-1.37 2.498s-2.259-1.482-1.37-2.498c.889-1.016 2.251-1.016 2.74 0z',
        fill: 'var(--el-text-color-primary)',
      },
    ],
  },
  {
    key: 'feishu',
    name: t('data.universal_third_party_auth.飞书登录4'),
    description: t('data.universal_third_party_auth.使用飞书账号登录5'),
    enabled: true,
    component: null,
    iconPath: [
      {
        d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
        fill: 'var(--color-brand-blue-2)',
      },
    ],
  },
]

// 获取方法组件
const getMethodComponent = (methodKey: string) => {
  const method = allMethods.find(m => m.key === methodKey)
  // 确保返回的是有效的组件
  return method ? method.component : null
}

// 选择登录方式
const selectMethod = (method: string) => {
  if (method === 'feishu') {
    window.location.href = FEISHU_AUTH_URL
    return
  }

  const selectedMethod = allMethods.find(m => m.key === method)

  logger.info('[UniversalThirdPartyAuth] Selected login method', {
    method,
    selectedMethod: selectedMethod?.name,
    enabled: selectedMethod?.enabled,
  })

  if (!selectedMethod?.enabled) {
    ElMessage.warning(`${selectedMethod?.name || method}暂时不可用`)
    return
  }

  activeMethod.value = method
}

// 处理登录成功
const handleLoginSuccess = (data: { token: string; user: Record<string, unknown> }) => {
  emit('login-success', {
    ...data,
    loginType: activeMethod.value,
  })
}

// 处理登录错误
const handleLoginError = (error: any) => {
  emit('login-error', error)
}

// 处理切换登录方式
const handleSwitchMethod = (method: string) => {
  if (method === 'account' || method === 'phone' || method === 'email') {
    emit('switch-method', method)
  } else {
    selectMethod(method)
  }
}

// 监听activeMethod变化，如果当前选中的登录方式被禁用，则切换到第一个启用的方式
watch(
  () => activeMethod.value,
  (newMethod: string) => {
    const method = allMethods.find(m => m.key === newMethod)
    if (method && !method.enabled) {
      const firstEnabledMethod = allMethods.find(m => m.enabled)
      if (firstEnabledMethod) {
        activeMethod.value = firstEnabledMethod.key
      }
    }
  },
  { immediate: false }
)

// 监听所有方法的启用状态变化，确保当前选中的方法始终是启用的
const enabledMethods = computed(() => allMethods.filter(m => m.enabled))
watch(
  () => enabledMethods.value,
  (newEnabledMethods: AuthMethod[]) => {
    // 如果当前选中的方法被禁用，切换到第一个启用的方法
    const currentMethod = allMethods.find(m => m.key === activeMethod.value)
    if (currentMethod && !currentMethod.enabled && newEnabledMethods.length > 0) {
      activeMethod.value = newEnabledMethods[0].key
    }
    // 如果没有启用的方法，清空选择
    else if (newEnabledMethods.length === 0) {
      activeMethod.value = ''
    }
  },
  { immediate: false }
)

// 组件挂载
onMounted(() => {
  // 默认选中第一个启用的登录方式
  const firstEnabledMethod = allMethods.find(method => method.enabled)
  if (firstEnabledMethod) {
    activeMethod.value = firstEnabledMethod.key
  }
})

const handleX = () => {
  activeMethod.value = ''
}
</script>

<style lang="scss" scoped>
.universal-third-party-auth {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px;

  .auth-header {
    text-align: left;
    margin-bottom: 32px;

    h3 {
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 600;
      color: var(--el-text-color-primary);
    }

    p {
      margin: 0;
      font-size: 14px;
      color: var(--el-text-color-regular);
    }
  }

  .auth-methods {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    margin-bottom: 24px;

    .auth-method-card {
      display: flex;
      align-items: center;
      padding: 16px;
      border: none;
      border-radius: var(--global-border-radius);
      cursor: pointer;
      transition: background-color 0.2s ease, opacity 0.2s ease, outline 0.2s ease;
      background: var(--el-bg-color-page);

      &:hover:not(.disabled) {
        background-color: var(--el-bg-color-page);
        outline: none;
      }

      &.active {
        border: none;
        outline: none;
        background: var(--el-bg-color);

        .method-status .el-icon {
          color: var(--el-color-black);
        }
      }

      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: var(--el-bg-color-page);

        .method-status .el-icon {
          color: var(--el-text-color-placeholder);
        }
      }

      .method-icon {
        width: 48px;
        height: 48px;
        border-radius: var(--global-border-radius);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 16px;
        flex-shrink: 0;
        border: none;

        .platform-icon {
          width: 32px;
          height: 32px;
        }

        // 极简黑白灰风格 - 所有图标使用灰色背景
        &.google {
          background: var(--el-bg-color-page);
          border: none;
        }

        &.apple {
          background: var(--el-bg-color-page);
          border: none;
        }

        &.feishu {
          background: var(--el-color-info);
        }
      }

      .method-info {
        flex: 1;

        h4 {
          margin: 0 0 4px;
          font-size: 16px;
          font-weight: 500;
          color: var(--el-text-color-primary);
        }

        p {
          margin: 0;
          font-size: 12px;
          color: var(--el-text-color-regular);
        }
      }

      .method-status {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;

        .el-icon {
          font-size: 18px;
          color: var(--el-text-color-primary);
        }
      }
    }
  }

  .auth-content {
    margin-bottom: 32px;

    .auth-card {
      border-radius: var(--global-border-radius);
      border: none;
      box-shadow: none;
      background: transparent;

      :deep(.el-card__body) {
        padding: 24px 0;
      }
    }
  }

  .other-options {
    margin-bottom: 24px;

    .divider-text {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      padding: 0 16px;
      background: var(--el-bg-color);
    }

    .option-buttons {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 16px;

      .option-btn {
        height: 40px;
        border-radius: var(--global-border-radius);
        font-size: 14px;
        position: relative;
        border: none;
        background-color: var(--el-bg-color-page);
        color: var(--el-text-color-primary);

        &:hover:not(:disabled) {
          background-color: var(--el-bg-color-page);
          outline: none;
        }

        &:focus {
          outline: none;
        }

        .coming-soon {
          position: absolute;
          top: -8px;
          right: -8px;
          font-size: 12px;
        }
      }
    }
  }

  .security-notice {
    :deep(.el-alert) {
      border-radius: var(--global-border-radius);
      background: var(--el-bg-color-page);
      border: none;

      .el-alert__title {
        color: var(--el-text-color-primary);
      }

      .el-alert__content {
        p {
          margin: 2px 0;
          font-size: 12px;
          color: var(--el-text-color-regular);
        }
      }
    }
  }
}

@media (width <= 640px) {
  .universal-third-party-auth {
    padding: 16px;

    .auth-methods {
      .auth-method-card {
        .method-icon {
          width: 40px;
          height: 40px;
          margin-right: 12px;

          .platform-icon {
            width: 24px;
            height: 24px;
          }
        }

        .method-info {
          h4 {
            font-size: 14px;
          }

          p {
            font-size: 12px;
          }
        }
      }
    }

    .other-options {
      .option-buttons {
        grid-template-columns: 1fr;
      }
    }
  }
}
</style>
