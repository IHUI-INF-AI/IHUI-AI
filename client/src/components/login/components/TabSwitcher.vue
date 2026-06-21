<template>
  <div class="tab-switcher">
    <!-- 登录/注册模式切换 -->
    <div class="mode-switcher">
      <h2 class="form-title">
        {{ isRegisterMode ? t('login.mode.userRegister') : t('login.mode.userLogin') }}
      </h2>
      <el-button type="primary" link @click="toggleMode" class="mode-toggle-btn">
        {{ isRegisterMode ? t('login.mode.hasAccount') : t('login.mode.noAccount') }}
      </el-button>
    </div>

    <!-- 登录方式切换标签 -->
    <el-tabs v-model="currentTab" class="login-tabs" @tab-change="handleTabChange">
      <el-tab-pane :label="t('login.tabs.account')" name="account" class="tab-pane">
        <template #label>
          <div class="tab-label">
            <el-icon><User /></el-icon>
            <span>{{
              isRegisterMode ? t('login.tabs.accountRegister') : t('login.tabs.account')
            }}</span>
          </div>
        </template>
      </el-tab-pane>

      <el-tab-pane :label="t('login.tabs.phone')" name="phone" class="tab-pane">
        <template #label>
          <div class="tab-label">
            <el-icon><Phone /></el-icon>
            <span>{{
              isRegisterMode ? t('login.tabs.phoneRegister') : t('login.tabs.phone')
            }}</span>
          </div>
        </template>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { User, Phone } from '@element-plus/icons-vue'

const { t } = useI18n()

interface TabSwitcherProps {
  activeTab: 'account' | 'phone'
  isRegisterMode: boolean
}

interface TabSwitcherEmits {
  'update:activeTab': [tab: 'account' | 'phone']
  'update:registerMode': [mode: boolean]
}

const props = defineProps<TabSwitcherProps>()
const emit = defineEmits<TabSwitcherEmits>()

const currentTab = computed({
  get: () => props.activeTab,
  set: (value: string) => emit('update:activeTab', value),
})

const handleTabChange = (tabName: string) => {
  emit('update:activeTab', tabName as 'account' | 'phone')
}

const toggleMode = () => {
  emit('update:registerMode', !props.isRegisterMode)
}
</script>

<style scoped lang="scss">
.tab-switcher {
  margin-bottom: 24px;
}

.mode-switcher {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  .form-title {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .mode-toggle-btn {
    font-size: 14px;
    padding: 0;
    height: auto;
  }
}

.login-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 24px;
  }

  :deep(.el-tabs__nav-wrap::after) {
    background-color: var(--el-border-color-light);
  }

  :deep(.el-tabs__item) {
    font-size: 16px;
    font-weight: 500;
    padding: 0 20px;

    &.is-active {
      color: var(--el-color-primary);
    }
  }
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 8px;

  .el-icon {
    font-size: 16px;
  }
}

@media (width <= 768px) {
  .mode-switcher {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;

    .form-title {
      font-size: 20px;
    }
  }

  .login-tabs {
    :deep(.el-tabs__item) {
      font-size: 14px;
      padding: 0 16px;
    }
  }

  .tab-label span {
    font-size: 14px;
  }
}
</style>
