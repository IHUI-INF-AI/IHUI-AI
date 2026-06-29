 
/**
 * Login 项目切换工具 Composable
 *
 * 处理登录页项目切换逻辑
 *
 * @packageDocumentation
 */

import { ref, computed, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'

const protocol = window.location.protocol
const hostname = window.location.hostname
const currentPort = window.location.port || '8888'
const buildProjectUrl = (port: string | number | null, path = ''): string => {
  const portValue = port === null || port === '' ? '' : String(port)
  const portPart = portValue ? `:${portValue}` : ''
  const normalizedPath = path ? (path.startsWith('/') ? path : `/${path}`) : ''
  return `${protocol}//${hostname}${portPart}${normalizedPath}`
}
const currentOrigin = buildProjectUrl(currentPort || null)

/**
 * 项目信息接口
 */
export interface ProjectInfo {
  key: string
  name: string
  url: string
}

/**
 * 项目信息映射（包含所有可能的项目）
 * 统一使用 8888 端口
 *
 * 登录方式 source 说明：
 * - admin: 管理端登录，登录完成后跳转管理端平台
 * - user: 账号密码登录，普通用户
 * - sms: 手机号短信登录，验证码
 */
const PROJECT_INFO_MAP: Record<string, { name: string; url: string }> = {
  main: { name: 'Main project', url: currentOrigin },
  open: { name: 'Open project', url: `${currentOrigin}/open` },
  admin: { name: 'Ruoyi admin', url: buildProjectUrl(8888) },
  user: { name: 'Website user', url: currentOrigin },
  sms: { name: 'SMS login', url: currentOrigin },
  // 2026-06-26: 教育平台源码已迁移到项目内, 直接使用项目内路由
  'edu-web': {
    name: 'Education user',
    url: '/edu',
  },
  'edu-admin': {
    name: 'Education admin',
    url: '/admin/edu',
  },
}

/**
 * useLoginProject 配置选项
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UseLoginProjectOptions {
  // 注意：isMobile 参数已移除，因为未使用
}

/**
 * Login 项目切换工具 Composable
 *
 * @param options - 配置选项（目前未使用，保证兼容 API 一致性）
 * @returns 返回项目切换状态和方法
 */
export function useLoginProject(_options: UseLoginProjectOptions = {}) {
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n()

  // 当前来源
  const currentSource = computed(() => {
    const source = route.query.source as string | undefined
    return source || null
  })

  // 选中的项目
  const selectedProject = ref<string | null>(currentSource.value)

  // 来源信息
  const sourceInfo = computed(() => {
    if (!currentSource.value) return null
    const projectInfo = PROJECT_INFO_MAP[currentSource.value]
    if (!projectInfo) return null

    // 使用翻译函数获取项目名称
    const getText = (key: string): string => {
      try {
        return t(key) || projectInfo.name
      } catch {
        return projectInfo.name
      }
    }

    const nameKey = `login.project.${currentSource.value}` as const
    return {
      name: getText(nameKey) || projectInfo.name,
      url: projectInfo.url,
    }
  })

  // 可用项目列表（不含项目选择按钮）
  // 统一使用 8888 端口
  const availableProjects = computed(() => {
    const getText = (key: string): string => {
      try {
        return t(key) || ''
      } catch {
        return ''
      }
    }
    return [
      {
        key: 'admin',
        name: getText('login.project.admin') || 'Ruoyi admin',
        url: buildProjectUrl(8888),
      },
      // 2026-06-26: 教育平台源码已迁移到项目内, url 直接用项目内路由
      {
        key: 'edu-web',
        name: getText('login.project.eduWeb') || '智慧AI教育平台',
        url: '/edu',
      },
      {
        key: 'edu-admin',
        name: getText('login.project.eduAdmin') || '教育管理后台',
        url: '/admin/edu',
      },
    ]
  })

  /**
   * 获取登录中文案
   */
  const getLoggingInText = (projectName: string): string => {
    try {
      return t('login.crossProject.loggingIn', { project: projectName })
    } catch {
      return `正在登录 ${projectName}...`
    }
  }

  /**
   * 切换项目（支持 admin/user 切换，远程教育系统）
   */
  const switchProject = (targetSource: 'admin' | 'user'): void => {
    try {
      const currentQuery = { ...route.query }
      const currentSource = route.query.source as string
      const currentRedirect = route.query.redirect as string

      logger.info('[LoginProject] switchProject called', {
        targetSource,
        currentSource,
        currentRedirect,
      })

      // 判断是否是教育系统（根据 source 判断）
      // 2026-06-26: 教育平台已迁移到项目内, 不再检查外部域名
      const isEduSystem =
        currentSource === 'edu-web' ||
        currentSource === 'edu-admin'

      logger.info('[LoginProject] isEduSystem judgment', {
        isEduSystem,
        currentSource,
        currentRedirect,
      })

      // 设置新的 source
      if (isEduSystem) {
        // 教育系统：edu-web 和 edu-admin 之间切换
        currentQuery.source = targetSource === 'admin' ? 'edu-admin' : 'edu-web'
      } else {
        // 普通系统：admin 和 user 之间切换
        currentQuery.source = targetSource
      }

      // 处理 redirect 参数 - 统一使用 8888 端口
      if (!currentQuery.redirect) {
        // 如果没有 redirect，根据目标项目设置默认 redirect
        if (isEduSystem) {
          // 教育系统
          currentQuery.redirect = encodeURIComponent(buildProjectUrl(8888, '/index'))
        } else {
          // 普通系统
          if (targetSource === 'admin') {
            currentQuery.redirect = encodeURIComponent(buildProjectUrl(8888, '/index'))
          } else {
            currentQuery.redirect = encodeURIComponent(currentOrigin)
          }
        }
      } else {
        // 如果有 redirect，根据项目 source 修改 redirect 中的端口
        try {
          let decodedRedirect = currentQuery.redirect as string
          // 循环解码，直到不再变化（避免多次编码导致问题）
          let prevDecoded = ''
          while (decodedRedirect !== prevDecoded) {
            prevDecoded = decodedRedirect
            try {
              decodedRedirect = decodeURIComponent(decodedRedirect)
            } catch {
              break
            }
          }
          if (isEduSystem) {
            // 教育系统：统一使用 8888 端口，不需要替换
            currentQuery.redirect = encodeURIComponent(decodedRedirect)
          }
        } catch (e) {
          // 解码失败，保留原 redirect
          if (import.meta.env.DEV) {
            logger.debug('[LoginProject] Failed to process redirect URL, keeping original value', e)
          }
        }
      }

      logger.info('[LoginProject] Preparing to switch route', {
        path: '/login',
        query: currentQuery,
        isEduSystem,
      })

      router
        .replace({
          path: '/login',
          query: currentQuery,
        } as RouteLocationRaw)
        .then(() => {
          logger.info('[LoginProject] Route switch successful', { query: currentQuery })
        })
        .catch((error: unknown) => {
          if (
            error &&
            typeof error === 'object' &&
            'name' in error &&
            ((error as { name: string }).name === 'NavigationDuplicated' || (error as { name: string }).name === 'NavigationRedirected')
          ) {
            logger.info('[LoginProject] Route switch: NavigationDuplicated/Redirected (normal)')
            return
          }
          logger.error('[LoginProject] Failed to switch project:', error)
        })
    } catch (err) {
      logger.error('[LoginProject] Failed to switch project:', err)
    }
  }

  /**
   * 选择项目（含项目选择按钮）
   * 如果已选中的按钮，取消选择
   */
  const selectProject = (projectKey: string): void => {
    // 如果点击的是当前已选中的项目，取消选择
    if (selectedProject.value === projectKey) {
      selectedProject.value = null
      // 更新路由中的 source 参数，同时清理可能存在的 redirect
      const currentQuery = { ...route.query }
      delete currentQuery.source
      router
        .replace({
          path: '/login',
          query: currentQuery,
        } as RouteLocationRaw)
        .catch((error: unknown) => {
          if (
            error &&
            typeof error === 'object' &&
            'name' in error &&
            ((error as { name: string }).name === 'NavigationDuplicated' || (error as { name: string }).name === 'NavigationRedirected')
          ) {
            return
          }
          logger.error('[LoginProject] Failed to cancel project selection:', error)
        })
      return
    }

    // 点击切换项目
    selectedProject.value = projectKey
    const project = availableProjects.value.find(p => p.key === projectKey)
    if (project) {
      // 2026-06-26: 教育平台已迁移到项目内, edu-web/edu-admin 直接用项目内路由作为 redirect;
      // 其他项目保持 ${project.url}/index
      const isEduProject = projectKey === 'edu-web' || projectKey === 'edu-admin'
      const redirectUrl = isEduProject ? project.url : `${project.url}/index`

      router
        .replace({
          path: '/login',
          query: {
            source: projectKey,
            redirect: encodeURIComponent(redirectUrl),
          },
        } as RouteLocationRaw)
        .catch((error: unknown) => {
          if (
            error &&
            typeof error === 'object' &&
            'name' in error &&
            ((error as { name: string }).name === 'NavigationDuplicated' || (error as { name: string }).name === 'NavigationRedirected')
          ) {
            return
          }
          logger.error('[LoginProject] Failed to select project:', error)
        })
    }
  }

  // 监听路由变化，更新 selectedProject
  watch(
    () => route.query.source,
    source => {
      if (source) {
        selectedProject.value = source as string
      } else {
        // 无 source 参数时，也清空 selectedProject
        selectedProject.value = null
      }
    },
    { immediate: true }
  )

  return {
    // 状态
    currentSource,
    selectedProject,
    sourceInfo,
    availableProjects,

    // 方法
    getLoggingInText,
    switchProject,
    selectProject,
  }
}
