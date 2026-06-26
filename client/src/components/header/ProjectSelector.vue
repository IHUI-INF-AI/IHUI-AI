<template>
  <!-- 项目选择器（移动端显示，当没有source参数时） -->
  <div v-if="showProjectSelector" class="header-project-selector">
    <el-icon class="selector-icon"><ArrowLeftRight /></el-icon>
    <span class="selector-title">{{ t('login.selectProject') }}</span>
    <div class="project-buttons">
      <el-button
        v-for="project in limitedProjects"
        :key="project.key"
        size="small"
        :type="selectedProject === project.key ? 'primary' : 'default'"
        plain
        @click="selectProject(project.key)"
        class="project-btn"
      >
        {{ project.name }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeftRight } from '@/lib/lucide-fallback'
import { useCleanup } from '@/composables/useCleanup'

const route = useRoute()
const router = useRouter()
// 使用全局作用域，因为 Header 在 Teleport 中会失去父级作用域
interface UseI18nOptions {
  useScope?: 'global' | 'local'
}
const { t } = (useI18n as (options?: UseI18nOptions) => ReturnType<typeof useI18n>)({ useScope: 'global' })

const protocol = window.location.protocol
const hostname = window.location.hostname
const _currentPort = window.location.port
const buildProjectUrl = (port: string | number | null, path = ''): string => {
  const portValue = port === null || port === '' ? '' : String(port)
  const portPart = portValue ? `:${portValue}` : ''
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''
  return `${protocol}//${hostname}${portPart}${normalizedPath}`
}

// 窗口宽度检测
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)

let resizeRafId: number | null = null
const handleResize = () => {
  if (typeof window !== 'undefined') {
    if (resizeRafId !== null) return
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = null
      windowWidth.value = window.innerWidth
    })
  }
}

const cleanup = useCleanup()
cleanup.add(() => {
  if (resizeRafId !== null) {
    cancelAnimationFrame(resizeRafId)
    resizeRafId = null
  }
})

onMounted(() => {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth
    cleanup.addEventListener(window, 'resize', handleResize as EventListener)
  }
})

// 判断是否为登录页面 (Logic from Header.vue)
const isLoginPage = computed(() => {
  const routeName = (route as { name?: string | symbol }).name
  return route.path === '/login' || routeName === 'login'
})

const currentSource = computed(() => {
  return (route.query.source as string) || null
})

// 项目选择器逻辑
const selectedProject = ref<string | null>(null)

const availableProjects = computed(() => {
  return [
    {
      key: 'admin',
      name: t('login.project.admin'),
      url: buildProjectUrl(81),
    },
    {
      key: 'edu-web',
      name: t('login.project.eduWeb'),
      url: buildProjectUrl(8100),
    },
    {
      key: 'edu-admin',
      name: t('login.project.eduAdmin'),
      url: buildProjectUrl(8200),
    },
  ]
})

// 限制显示的项目数量
const limitedProjects = computed(() => {
  return availableProjects.value.slice(0, 2)
})

const showProjectSelector = computed(() => {
  // 只在移动端、登录页、且没有currentSource时显示
  return windowWidth.value < 768 && isLoginPage.value && !currentSource.value
})

const selectProject = (projectKey: string) => {
  // 如果点击的是当前已选中的项目，则取消选中
  if (selectedProject.value === projectKey) {
    selectedProject.value = null
    // 清除路由中的 source 参数
    const routerWithQuery = router as {
      replace: (to: { path: string; query?: Record<string, string> }) => Promise<void>
    }
    const currentQuery = { ...route.query } as Record<string, string>
    delete currentQuery.source
    routerWithQuery.replace({
      path: '/login',
      query: currentQuery,
    })
    return
  }

  // 否则正常切换项目
  selectedProject.value = projectKey
  const project = availableProjects.value.find(p => p.key === projectKey)
  if (project) {
    const routerWithQuery = router as {
      replace: (to: { path: string; query?: Record<string, string> }) => Promise<void>
    }
    routerWithQuery.replace({
      path: '/login',
      query: {
        source: projectKey,
        redirect: encodeURIComponent(project.url + '/index'),
      },
    })
  }
}

// 初始化选中的项目
watch(
  () => route.query.source,
  source => {
    if (!source && isLoginPage.value) {
      selectedProject.value = 'admin'
    } else if (source) {
      selectedProject.value = source as string
    }
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
// ============================================
// ProjectSelector 组件样式
// 重构：移除不必要的 ，使用 CSS 变量
// 采用 Mobile First 设计模式
// ============================================

// 组件级 CSS 变量
.header-project-selector {
  // CSS 变量定义
  --selector-bg: var(--el-bg-color);
  --selector-border: var(--unified-border);
  --selector-radius: 6px;
  --selector-padding: 4px 8px;
  --selector-gap: 8px;
  --icon-size: 16px;
  --title-size: 12px;
  --btn-size: 12px;
  --btn-padding: 4px 10px;
  --btn-radius: 6px;

  // 默认隐藏
  display: none;
}

// 移动端样式（Mobile First - 基础样式）
@media (width <= 767px) {
  .header-project-selector {
    // 定位
    position: absolute;
    left: 48px;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    z-index: calc(var(--z-base) + 9);

    // 尺寸
    width: auto;
    max-width: none;
    min-width: 0;
    box-sizing: border-box;
    overflow: hidden;

    // 布局
    display: flex;
    flex-flow: row nowrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--selector-gap);

    // 样式
    padding: var(--selector-padding);
    background-color: var(--selector-bg);
    border: var(--selector-border);
    border-radius: var(--selector-radius);
  }

  // 图标
  .selector-icon {
    width: var(--icon-size);
    height: var(--icon-size);
    flex-shrink: 0;
    color: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
    line-height: 1;
    margin: 0;
    padding: 0;

    svg {
      display: block;
      vertical-align: middle;
      margin: 0;
      padding: 0;
    }
  }

  // 标题文字
  .selector-title {
    font-size: var(--title-size);
    white-space: nowrap;
    overflow: visible;
    text-overflow: clip;
    color: var(--el-text-color-primary);
    display: inline-block;
    vertical-align: middle;
    line-height: 1.2;
    margin: 0;
    padding: 0;
    flex-shrink: 0;
  }

  // 按钮容器
  .project-buttons {
    display: flex;
    flex-flow: row nowrap;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    flex: 1 1 auto;
    flex-shrink: 1;
    flex-grow: 0;
    overflow: hidden;
    min-width: 0;
    max-width: 100%;
    margin-left: auto;
  }

  // 按钮
  .project-btn {
    font-size: var(--btn-size);
    padding: var(--btn-padding);
    height: auto;
    border-radius: var(--btn-radius);
    border: none;
    background-color: transparent;
    color: var(--el-text-color-primary);
    width: auto;
    min-width: auto;
    max-width: none;
    transition: background-color 0.2s ease, color 0.2s ease;
    white-space: nowrap;
    flex-shrink: 0;
    flex-grow: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background-color: var(--el-fill-color-light);
    }

    &:active,
    &.el-button--primary {
      background-color: var(--el-color-primary);
      color: var(--el-bg-color-page);
    }
  }
}

// 暗色模式 - 使用 CSS 变量自动适应，无需额外覆盖
// 因为所有颜色都使用了 CSS 变量，暗色模式会自动生效
</style>
