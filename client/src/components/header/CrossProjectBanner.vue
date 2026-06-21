<template>
  <!-- 跨项目切换横幅（移动端显示） -->
  <div v-if="showCrossProjectBanner" class="header-cross-project-banner">
    <!-- 左侧：您正在登录文字 -->
    <el-icon class="banner-icon">
      <ArrowLeftRight />
    </el-icon>
    <span class="banner-text">{{ crossProjectText }}</span>

    <!-- 右侧：切换到 + 按钮 -->
    <div class="switch-section">
      <span class="switch-label">{{ t('hardcoded.cross.project.banner.切换?) }}</span>
      <el-button v-if="currentSource === 'admin' || currentSource === 'edu-admin'" size="small" type="primary" plain
        @click="switchProject('user')" class="switch-btn">{{ t('hardcoded.cross.project.banner.用户?) }}</el-button>
      <el-button v-if="currentSource === 'user' || currentSource === 'edu-web'" size="small" type="primary" plain
        @click="switchProject('admin')" class="switch-btn">{{ t('hardcoded.cross.project.banner.总管理端') }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowLeftRight } from '@/lib/lucide-fallback'
import { logger } from '@/utils/logger'
import { useCleanup } from '@/composables/useCleanup'

const route = useRoute()
const router = useRouter()
// 使用全局作用域，因为 Header ?Teleport 中会失去父级作用?
interface UseI18nOptions {
  useScope?: 'global' | 'local'
}
const { t } = (useI18n as (options?: UseI18nOptions) => ReturnType<typeof useI18n>)({ useScope: 'global' })

const protocol = window.location.protocol
const hostname = window.location.hostname
const currentPort = window.location.port
const buildProjectUrl = (port: string | number | null, path = ''): string => {
  const portValue = port === null || port === '' ? '' : String(port)
  const portPart = portValue ? `:${portValue}` : ''
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''
  return `${protocol}//${hostname}${portPart}${normalizedPath}`
}
const currentOrigin = buildProjectUrl(currentPort || null)

// 响应式窗口宽度检?
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

// 跨项目切换相?logic
const currentSource = computed(() => {
  return (route.query.source as string) || null
})

const sourceInfo = computed(() => {
  try {
    const source = route.query.source as string
    if (!source) return null

    // 统一使用8888端口
    const projectInfoMap: Record<string, { name: string; url: string }> = {
      main: { name: t('login.project.main'), url: currentOrigin },
      open: { name: t('login.project.open'), url: `${currentOrigin}/open` },
      admin: { name: t('login.project.admin'), url: buildProjectUrl(8888) },
      'edu-web': {
        name: t('login.project.eduWeb'),
        url: buildProjectUrl(8888),
      },
      'edu-admin': {
        name: t('login.project.eduAdmin'),
        url: buildProjectUrl(8888),
      },
      user: { name: t('login.project.user'), url: buildProjectUrl(8888) },
    }

    return projectInfoMap[source] || null
  } catch (_error) {
    return null
  }
})

const crossProjectText = computed(() => {
  if (!sourceInfo.value) return ''
  try {
    return (
      t('login.crossProject.loggingIn', { project: sourceInfo.value.name }) ||
      `您正在登录${sourceInfo.value.name}`
    )
  } catch {
    return `您正在登录${sourceInfo.value.name}`
  }
})

const showCrossProjectBanner = computed(() => {
  // 只在移动端且存在sourceInfo时显示
  return windowWidth.value < 768 && !!sourceInfo.value
})

const switchProject = (targetSource: 'admin' | 'user') => {
  try {
    const current = currentSource.value
    if (!current) return

    // 构建新的URL
    const newQuery = { ...route.query }
    if (targetSource === 'admin') {
      // 从用户端切换到管理端
      if (current === 'user') {
        newQuery.source = 'admin'
      } else if (current === 'edu-web') {
        newQuery.source = 'edu-admin'
      }
    } else {
      // 从管理端切换到用户端
      if (current === 'admin') {
        newQuery.source = 'user'
      } else if (current === 'edu-admin') {
        newQuery.source = 'edu-web'
      }
    }

    // 跳转到新的URL
     
    router.push({ path: route.path, query: newQuery } as any)
  } catch (error) {
    logger.error('Failed to switch project:', error)
  }
}
</script>

<style scoped lang="scss">
// 跨项目切换横幅 - 完全重构，简化结构
.header-cross-project-banner {
  display: none;

  @media (width <= 767px) {
    // 定位：从左侧（菜单栏按钮右侧）延伸到右侧（贴近顶部菜单栏右侧边缘）
    position: absolute;
    left: 48px; // 菜单栏按钮宽度48px + 间距12px = 48px，避免与按钮重合
    right: 12px; // glass-header的padding-right: 8px + 安全边距4px = 12px，确保不超出边距
    top: 50%;
    transform: translateY(-50%);

    // 宽度：使用left和right自动计算，延伸到更右
    width: auto;
    max-width: none;
    min-width: 200px;

    // 布局：水平排列，左右分布
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    // 样式
    padding: 6px 12px;
    background-color: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    z-index: calc(var(--z-base) + 9);
    box-sizing: border-box;

    // 图标
    .banner-icon {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      color: inherit;
    }

    // 左侧文字
    .banner-text {
      font-size: 12px;
      white-space: nowrap;
      overflow: visible;
      text-overflow: clip;
      color: var(--el-text-color-primary);
      flex: 1 1 auto; // 允许占据可用空间
      min-width: 0;
      max-width: none; // 不限制最大宽度，允许完整显示
    }

    // 右侧切换区域
    .switch-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;

      // "切换"标签
      .switch-label {
        font-size: 10px;
        color: var(--el-text-color-regular);
        line-height: 1.2;
      }

      // 按钮
      .switch-btn {
        font-size: 11px;
        padding: 4px 8px;
        height: auto;
        border-radius: var(--global-border-radius);
        border: none;
        background-color: transparent;
        color: var(--el-text-color-primary);
        width: auto;
        min-width: auto;
        transition: all 0.2s ease;

        &:hover {
          background-color: var(--el-fill-color-light);
        }

        &:active {
          background-color: var(--el-color-primary);
          color: var(--el-bg-color-page);
        }
      }
    }
  }
}

// 暗色模式 - 统一使用html.dark选择器
:global(html.dark) .header-cross-project-banner,
:global(.glass-header.dark-mode) .header-cross-project-banner {
  @media (width <= 767px) {
    background-color: var(--el-bg-color);
    border-color: var(--el-border-color);

    .banner-text {
      color: var(--el-text-color-primary);
    }

    .switch-section {
      .switch-label {
        color: var(--el-text-color-secondary);
      }

      .switch-btn {
        color: var(--el-text-color-primary);

        &:hover {
          background-color: var(--el-bg-color-hover);
        }

        &:active {
          background-color: var(--el-color-primary);
          color: var(--el-bg-color-page);
        }
      }
    }
  }
}
</style>
