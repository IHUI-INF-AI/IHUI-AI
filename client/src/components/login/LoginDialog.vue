<!--
  LoginDialog - 全局登录弹窗组件
  使用 el-dialog 包裹 UniversalLogin，实现"弹窗登录"形式。
  状态由 useLoginDialog 单例 composable 全局共享，App.vue 挂载一次即可。
  设计遵循扁平化规范：无 text-shadow、无多余 box-shadow，使用边框分隔。
  遵循 CSS 优先级规范：无 !important，仅用 :deep() 单层选择器覆盖。
-->
<template>
  <el-dialog
    v-if="shouldRender"
    v-model="dialogVisible"
    class="login-dialog"
    width="440px"
    :show-close="false"
    :close-on-click-modal="true"
    :close-on-press-escape="true"
    :destroy-on-close="true"
    :append-to-body="true"
    :align-center="true"
    role="dialog"
    aria-modal="true"
    :aria-label="mode === 'register' ? t('login.register') : t('login.login')"
    @closed="onClosed"
  >
    <!-- 主体：UniversalLogin 组件（header 已移除，关闭按钮独立绝对定位在弹窗右上角） -->
    <div class="login-dialog__body">
      <UniversalLogin
        ref="universalLoginRef"
        :mode="mode"
        :project-selector-props="{
          isMobile,
          currentSource,
          availableProjects,
          selectedProject,
          selectProject,
          selectProjectText: t('login.selectProject'),
        }"
        @close="handleClose"
      />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { useLoginDialog } from '@/composables/useLoginDialog'
import { useLoginProject } from '@/composables/login/useLoginProject'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/logger'
import UniversalLogin from '@/components/login/UniversalLogin.vue'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

// 弹窗状态（单例 composable）
const { visible, mode, close } = useLoginDialog()

// 控制 el-dialog 是否挂载到 DOM。
// 解决：el-dialog 配合 append-to-body 即使 v-model=false 也会在 body 预创建 el-overlay 容器，
// 导致 7 个空 overlay 堆积。用 v-if 在关闭后彻底卸载 el-dialog（含 overlay），打开时再挂载。
// shouldRender 在 visible=true 时立即置 true（挂载），在 @closed（过渡结束后）置 false（卸载）。
const shouldRender = ref(false)
watch(visible, (val) => {
  if (val) shouldRender.value = true
}, { immediate: true })

// 项目切换逻辑（与原 Login.vue 一致）
const {
  currentSource,
  selectedProject,
  availableProjects,
  selectProject,
} = useLoginProject()

// 移动端检测
const isMobile = useMediaQuery('(max-width: 768px)')

// UniversalLogin 组件引用（用于调用 reset 方法清空表单）
// 类型仅约束 reset 方法，避免异步组件类型推断复杂
const universalLoginRef = ref<{ reset?: () => void } | null>(null)

// 统一关闭逻辑：先重置表单，再关闭弹窗
// 这样无论点击关闭按钮、ESC、还是点击遮罩层，都会清空表单（取消登录即清空）
const performClose = (): void => {
  try {
    universalLoginRef.value?.reset?.()
  } catch (e) {
    logger.warn('[LoginDialog] Failed to reset login form:', e)
  }
  close()
}

// 双向绑定：el-dialog 的 v-model 需要 ref<boolean>，这里桥接到 composable 的 visible
// 关闭（点击遮罩层 / ESC）时先 reset 再 close
const dialogVisible = computed({
  get: () => visible.value,
  set: (v: boolean) => {
    if (!v) {
      performClose()
    }
  },
})

// 关闭按钮（由 UniversalLogin 内部点击触发 @close 事件）
const handleClose = (): void => {
  performClose()
}

// 弹窗完全关闭后的清理（此时 destroy-on-close 已销毁子组件，ref 失效）
// @closed 在关闭过渡结束后触发，此时安全卸载 el-dialog（含 overlay），清除 body 中的空 overlay
const onClosed = (): void => {
  shouldRender.value = false
  logger.debug('[LoginDialog] closed, el-dialog unmounted')
}

// 登录/注册成功后自动关闭弹窗
// UniversalLogin 内部会在登录成功后更新 authStore，这里 watch 状态变化
watch(
  () => authStore.isLoggedIn && !!authStore.token && !!authStore.user,
  (loggedIn) => {
    if (loggedIn && visible.value) {
      // 登录成功后跳转到原请求路径（如有）
      try {
        const returnPath = localStorage.getItem('auth-return-path')
        if (returnPath && returnPath !== '/' && returnPath !== '/login' && returnPath !== '/register') {
          localStorage.removeItem('auth-return-path')
          router.push(returnPath)
        }
      } catch (e) {
        logger.warn('[LoginDialog] Failed to read return path:', e)
      }
      // 延迟关闭以让 UniversalLogin 内部完成跳转/提示逻辑
      setTimeout(() => {
        close()
      }, 300)
    }
  },
)
</script>

<style lang="scss">
/* ============ 弹窗外壳样式（non-scoped） ============
 * el-dialog 使用 append-to-body=true，DOM 挂载到 <body>，
 * 脱离 LoginDialog 的 scoped 上下文，:deep() 无法匹配。
 * 因此 .el-dialog 相关样式必须放在 non-scoped 块中。
 * 类名 .login-dialog 足够独特，不会污染全局。
 */

.el-dialog.login-dialog {
  // 扁平化：去除默认 box-shadow，改用边框
  box-shadow: none;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--global-border-radius, 12px);
  background: var(--el-bg-color);
  // 关键：align-center 模式下 element-plus 会给 .el-overlay-dialog 设置 display:flex
  // (见 element-plus dialog use-dialog.mjs: overlayDialogStyle -> { display: 'flex' })
  // 默认 align-items: stretch 会把 .el-dialog 拉伸到 100vh，需要 align-self: center
  // 让弹窗垂直居中，max-height 限制高度。
  align-self: center;
  max-height: 90vh;
  height: auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  // margin: auto 是 align-center 模式下的关键：让弹窗在 flex 容器 .el-overlay-dialog
  // 中水平垂直居中（因为父容器 top/right/bottom/left 都被 fixed 锁定了，
  // auto margin 会在所有方向上平分剩余空间）。原 margin: 0 auto 丢失垂直居中。
  margin: auto;
  // 关键：清零 el-dialog 默认 padding-primary (20px)，
  // 弹窗内边距由 .login-dialog__body / .login-content 控制。
  // 避免弹窗自身 padding 在动画中产生视觉异常。
  padding: 0;
}

.el-dialog.login-dialog .el-dialog__header {
  display: none; // 使用自定义头部
}

.el-dialog.login-dialog .el-dialog__body {
  padding: 0;
  flex: 1;
  overflow-y: auto;
  // 关键：显式设置 overflow-x: hidden
  // 原因：Webkit 浏览器当 overflow-y: auto 时会强制 overflow-x: visible -> auto，
  // 配合全局 *:hover::-webkit-scrollbar { height: 6px }，弹窗打开时鼠标 hover
  // 会让 .el-dialog__body 内部出现 6px 高的水平滚动条占位，弹窗底部显示为白线。
  // 弹窗内容不会水平溢出，显式 hidden 即可防止滚动条占位变化。
  overflow-x: hidden;
  // 移除项目全局 .el-dialog .el-dialog__body { max-height: 70vh } 的限制，
  // 让 .el-dialog 的 max-height: 90vh 统一控制弹窗总高度，
  // .el-dialog__body 用 flex: 1 + overflow-y: auto 自动滚动。
  max-height: none;
}

.el-dialog.login-dialog .el-dialog__footer {
  display: none;
}

// ============ 遮罩层扁平化（无 backdrop-filter，仅纯色半透明） ============
.el-overlay:has(.login-dialog) {
  background-color: rgba(0, 0, 0, 0.45);
}

// ============ 响应式：移动端弹窗撑满 ============
@media (max-width: 480px) {
  .el-dialog.login-dialog {
    width: 92vw;
    max-width: 92vw;
    max-height: 88vh;
  }
}

// ============ 暗色模式适配（不依赖 :where()，使用具体类名以确保覆盖 Element Plus 默认样式） ============
// 注意：必须使用具体的 `html.dark` 选择器（非 :where）才能覆盖 Element Plus 在 vendor 层的
// `html.dark .el-overlay .el-dialog { background: var(--el-bg-color) }` 默认样式。
// Element Plus 的暗色主题可能因 CSS 变量循环引用（--el-text-color-primary: var(--el-bg-color)），
// 导致 --el-bg-color 在某些上下文中被解析为浅色。所以这里使用更可靠的具体色值兜底。
html.dark .el-dialog.login-dialog {
  background-color: var(--el-bg-color);
  background: var(--el-bg-color);
  border-color: var(--el-border-color);
}

html.dark .el-dialog.login-dialog .el-dialog__body {
  background-color: var(--el-bg-color);
  background: var(--el-bg-color);
}
</style>

<style lang="scss" scoped>
// ============ 扁平化设计变量 ============
$dialog-bg: var(--el-bg-color);

// ============ 主体：UniversalLogin 容器 ============
.login-dialog__body {
  // 复用原 Login.vue 的 CSS 变量，确保 UniversalLogin 内部样式正常
  --ulogin-content-width: 100%;
  --ulogin-content-min-width: auto;
  --ulogin-content-max-width: 100%;
  --ulogin-right-spacing: 0;
  --ulogin-spacing: 20px;
  --ulogin-header-height: 0;
  --ulogin-content-min-height: auto;
  --login-spacing: 20px;
  --login-header-height: 0;

  // padding 改为 0：header 现已移入 login-content 内部，
  // 由 login-content 自身的 padding 控制内容边距，header 用负 margin 贴边
  padding: 0;
  background: $dialog-bg;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: stretch;
}

:where(html.dark) .login-dialog__body {
  background: var(--el-bg-color);
}
</style>
