<template>
  <!-- 仅管理员可见: 全局浮动快捷入口, 跳转管理后台 -->
  <div v-if="isAdmin && showButton" class="admin-quick-access" :class="{ collapsed }">
    <el-button
      class="trigger-btn"
      :type="collapsed ? 'primary' : 'default'"
      circle
      size="large"
      @click="toggle"
    >
      <el-icon><Tools /></el-icon>
    </el-button>

    <transition name="admin-menu-fade">
      <div v-if="!collapsed" class="quick-menu">
        <div class="menu-header">
          <el-icon><Tools /></el-icon>
          <span>{{ t('adminQuick.title', '管理后台') }}</span>
          <el-button class="close-btn" text circle size="small" @click="collapsed = true">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>

        <div class="menu-section">
          <div class="section-title">{{ t('adminQuick.console', '核心控制台') }}</div>
          <el-button class="menu-item" text @click="goTo('/admin-classic')">
            <el-icon><HomeFilled /></el-icon>
            <span>{{ t('adminQuick.adminClassic', '经典后台首页') }}</span>
          </el-button>
          <el-button class="menu-item" text @click="goTo('/admin/rbac-management')">
            <el-icon><User /></el-icon>
            <span>{{ t('adminQuick.rbacMgmt', 'RBAC 权限管理') }}</span>
          </el-button>
          <el-button class="menu-item" text @click="goTo('/admin/auth-management')">
            <el-icon><Lock /></el-icon>
            <span>{{ t('adminQuick.authMgmt', '认证与账户管理') }}</span>
          </el-button>
        </div>

        <div class="menu-section">
          <div class="section-title">{{ t('adminQuick.business', '业务管理') }}</div>
          <el-button class="menu-item" text @click="goTo('/admin/agent-management')">
            <el-icon><Avatar /></el-icon>
            <span>{{ t('adminQuick.agentMgmt', '智能体业务') }}</span>
          </el-button>
          <el-button class="menu-item" text @click="goTo('/admin/ai-capability')">
            <el-icon><MagicStick /></el-icon>
            <span>{{ t('adminQuick.aiMgmt', 'AI 能力') }}</span>
          </el-button>
          <el-button class="menu-item" text @click="goTo('/admin/course-category')">
            <el-icon><Reading /></el-icon>
            <span>{{ t('adminQuick.courseMgmt', '课程与分类') }}</span>
          </el-button>
          <el-button class="menu-item" text @click="goTo('/admin/content-mgmt')">
            <el-icon><Document /></el-icon>
            <span>{{ t('adminQuick.contentMgmt', '内容管理') }}</span>
          </el-button>
          <el-button class="menu-item" text @click="goTo('/admin/dist-mgmt')">
            <el-icon><Present /></el-icon>
            <span>{{ t('adminQuick.distMgmt', '分销与开发者') }}</span>
          </el-button>
          <el-button class="menu-item" text @click="goTo('/admin/business-mgmt')">
            <el-icon><Box /></el-icon>
            <span>{{ t('adminQuick.businessMgmt', '业务综合') }}</span>
          </el-button>
        </div>

        <div class="menu-section">
          <div class="section-title">{{ t('adminQuick.system', '系统工具') }}</div>
          <el-button class="menu-item" text @click="goTo('/admin/tour-permissions')">
            <el-icon><Key /></el-icon>
            <span>{{ t('adminQuick.tourPerm', '旅游平台权限') }}</span>
          </el-button>
          <el-button class="menu-item" text @click="goTo('/admin/utils-admin')">
            <el-icon><Cpu /></el-icon>
            <span>{{ t('adminQuick.utilsTest', '工具函数测试') }}</span>
          </el-button>
        </div>

        <div class="menu-footer">
          <el-tag size="small" type="success">{{ t('adminQuick.adminBadge', '管理员') }}</el-tag>
          <el-button class="collapse-btn" size="small" text @click="toggle">
            {{ t('adminQuick.collapse', '收起') }}
          </el-button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

const collapsed = ref(true)
const showButton = ref(false)

// 从 auth store 推导管理员身份
const isAdmin = computed(() => {
  const role =
    (authStore as any)?.userRole ||
    (authStore as any)?.role ||
    (authStore as any)?.userInfo?.role ||
    (authStore as any)?.userInfo?.userRole
  return role === 'admin' || role === 'super_admin' || role === 'ADMIN' || role === 'SUPER_ADMIN'
})

function toggle() {
  collapsed.value = !collapsed.value
}

function goTo(path: string) {
  router.push(path).then(() => {
    collapsed.value = true
    ElMessage.success(t('adminQuick.navigated', '已跳转') + ': ' + path)
  }).catch((e) => {
    console.error(e)
    ElMessage.error(t('adminQuick.navigateFailed', '跳转失败'))
  })
}

onMounted(() => {
  // 开发环境总是显示, 生产环境仅管理员可见
  showButton.value = import.meta.env.DEV || isAdmin.value
})
</script>

<style scoped lang="scss">
.admin-quick-access {
  position: fixed;
  right: 24px;
  bottom: 80px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;

  .trigger-btn {
    box-shadow: 0 4px 12px rgb(64 158 255 / 0.4);
  }

  .quick-menu {
    width: 280px;
    max-height: 70vh;
    overflow-y: auto;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
    padding: 16px;

    .menu-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--el-border-color-lighter);
      margin-bottom: 12px;

      .close-btn {
        margin-left: auto;
      }
    }

    .menu-section {
      margin-bottom: 12px;

      .section-title {
        font-size: 12px;
        color: var(--el-text-color-secondary);
        margin-bottom: 6px;
        padding-left: 8px;
      }

      .menu-item {
        display: flex;
        width: 100%;
        justify-content: flex-start;
        padding: 8px;
        margin-bottom: 2px;
        border-radius: 6px;

        &:hover {
          background: var(--el-fill-color-light);
        }

        .el-icon {
          margin-right: 8px;
        }
      }
    }

    .menu-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid var(--el-border-color-lighter);
    }
  }
}

.admin-menu-fade-enter-active,
.admin-menu-fade-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.admin-menu-fade-enter-from,
.admin-menu-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>