import type { RouteRecordRaw } from 'vue-router'
import { safeImport } from '../utils/componentLoader'

type RedirectTo = { path: string; query: Record<string, string | string[]> }

export const apiRoutes: Array<RouteRecordRaw> = [
  {
    path: '/open',
    name: 'openPlatform',
    component: safeImport(
      () => import(/* webpackChunkName: "open" */ '@/views/OpenPlatform.vue'),
      'OpenPlatform'
    ),
    meta: {
      title: 'routes.openPlatform',
      description: 'seo.openPlatform.desc',
      keywords: 'seo.openPlatform.keywords',
      requiresAuth: false,
    },
  },
  {
    path: '/open/dashboard',
    name: 'openDashboard',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "open" */ '@/open-platform/components/feature-center/Dashboard.vue'
        ),
      'Dashboard'
    ),
    meta: {
      title: 'routes.openPlatformDashboard',
      description: '开放平台功能中心仪表板',
      keywords: '开放平台,仪表板,统计',
      requiresAuth: false,
    },
  },
  {
    path: '/open/sdks',
    name: 'openSDKs',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "open" */ '@/open-platform/components/feature-center/SDKsHub.vue'
        ),
      'SDKsHub'
    ),
    meta: {
      title: 'routes.openPlatformSDKs',
      description: 'SDK 中心 - 下载和管理 SDK',
      keywords: 'SDK,开发工具包,下载',
      requiresAuth: false,
    },
  },
  {
    path: '/open/models',
    name: 'openModels',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "open" */ '@/open-platform/components/feature-center/ModelsHub.vue'
        ),
      'ModelsHub'
    ),
    meta: {
      title: 'routes.openPlatformModels',
      description: '模型中心 - 查看和管理 AI 模型',
      keywords: 'AI模型,模型列表,模型管理',
      requiresAuth: false,
    },
  },
  {
    path: '/open/agents',
    name: 'openAgents',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "open" */ '@/open-platform/components/feature-center/AgentsHub.vue'
        ),
      'AgentsHub'
    ),
    meta: {
      title: 'routes.openPlatformAgents',
      description: '智能体中心 - 浏览和使用智能体',
      keywords: '智能体,AI Agent,智能体市场',
      requiresAuth: false,
    },
  },
  {
    path: '/open/apis',
    name: 'openAPIs',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "open" */ '@/open-platform/components/feature-center/APIsHub.vue'
        ),
      'APIsHub'
    ),
    meta: {
      title: 'routes.openPlatformAPIs',
      description: 'API 中心 - API 文档和接口',
      keywords: 'API,接口文档,API文档',
      requiresAuth: false,
    },
  },
  {
    path: '/open/documents',
    name: 'openDocuments',
    component: safeImport(
      () =>
        import(
          /* webpackChunkName: "open" */ '@/open-platform/components/feature-center/DocumentsHub.vue'
        ),
      'DocumentsHub'
    ),
    meta: {
      title: 'routes.openPlatformDocuments',
      description: '文档中心 - 开发文档和指南',
      keywords: '文档,开发文档,技术文档',
      requiresAuth: false,
    },
  },
  {
    path: '/open/document/center',
    redirect: (to: RedirectTo) => ({ path: '/open/docs', query: to.query }),
  } as RouteRecordRaw,
  {
    path: '/open/docs',
    name: 'openPlatformDocs',
    component: safeImport(
      () => import(/* webpackChunkName: "open" */ '@/views/OpenPlatformDocs.vue'),
      'OpenPlatformDocs'
    ),
    meta: {
      title: 'routes.openPlatformDocs',
      description: 'seo.openPlatform.desc',
      keywords: 'seo.openPlatform.keywords',
      requiresAuth: false,
    },
  },
  {
    path: '/docs',
    name: 'eduDocumentation',
    component: safeImport(
      () => import(/* webpackChunkName: "docs" */ '@/views/EduDocumentation.vue'),
      'EduDocumentation'
    ),
    meta: {
      title: 'routes.eduDoc',
      description: 'iHui AI 数字化教育平台技术文档 - 22 个微服务架构详解',
      keywords: '教育平台,微服务,技术文档,API文档,架构设计',
      requiresAuth: false,
      showFooter: false,
    },
  },
  {
    path: '/edu-docs',
    redirect: (to: RedirectTo) => ({ path: '/docs', query: to.query }),
  } as RouteRecordRaw,
  {
    path: '/files',
    name: 'fileManager',
    component: safeImport(
      () => import(/* webpackChunkName: "files" */ '@/components/FileManager.vue'),
      'FileManager'
    ),
    meta: {
      title: 'routes.fileManager',
      description: '文件管理 - 上传、下载、分享文件',
      keywords: '文件管理,上传,下载,分享',
      requiresAuth: false,
    },
  },
  {
    path: '/permissions',
    name: 'permissionManager',
    component: safeImport(
      () => import(/* webpackChunkName: "permissions" */ '@/components/PermissionManager.vue'),
      'PermissionManager'
    ),
    meta: {
      title: 'routes.permissionManager',
      description: '权限管理 - 角色与权限配置',
      keywords: '权限管理,角色,权限',
      requiresAuth: true,
    },
  },
  {
    path: '/audit',
    name: 'auditLog',
    component: safeImport(
      () => import(/* webpackChunkName: "audit" */ '@/components/AuditLog.vue'),
      'AuditLog'
    ),
    meta: {
      title: 'routes.auditLog',
      description: '审计日志 - 操作记录查询',
      keywords: '审计日志,操作记录',
      requiresAuth: true,
    },
  },
  {
    path: '/document-center',
    name: 'openPlatformDocumentCenter',
    component: safeImport(
      () => import(/* webpackChunkName: "docs" */ '@/open-platform/views/DocumentCenter.vue'),
      'DocumentCenter'
    ),
    meta: {
      title: 'routes.documentCenter',
      description: '文档中心 - 文件上传与管理',
      keywords: '文档中心,文件上传,文件管理',
      requiresAuth: false,
    },
  },
]
