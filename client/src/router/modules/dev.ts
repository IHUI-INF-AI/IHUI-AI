import type { RouteRecordRaw } from 'vue-router'
import { safeImport } from '../utils/componentLoader'

/**
 * 开发态路由：仅在 `import.meta.env.DEV === true` 时由 router/index.ts 注册。
 * 生产构建会通过 tree-shaking 完全剔除这些路由（动态 import 在条件分支里不被使用）。
 *
 * 包含：
 *  - /dev                       演示中心导航（DevHub）
 *  - /dev/design-system         设计系统演示（DesignSystemDemo）
 *  - /dev/storybook             组件实时预览（ComponentShowcase）
 *  - /dev/business-docs         业务文档（BusinessDocs）
 *  - /dev/aizhs-demo            AIZHS 组件迁移示例
 *  - /dev/project-selector      项目选择器组件演示（ProjectSelectorDemo）
 */
export const devRoutes: Array<RouteRecordRaw> = [
  {
    path: '/dev',
    name: 'devHub',
    component: safeImport(
      () => import(/* webpackChunkName: "dev-hub" */ '@/views/dev/DevHub.vue'),
      'DevHub'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.devHub',
      description: 'seo.devHub.desc',
      keywords: 'seo.devHub.keywords',
      devOnly: true,
    },
  },
  {
    path: '/dev/design-system',
    name: 'devDesignSystem',
    component: safeImport(
      () => import(/* webpackChunkName: "dev-design-system" */ '@/views/DesignSystemDemo.vue'),
      'DesignSystemDemo'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.designSystem',
      description: 'seo.designSystem.desc',
      keywords: 'seo.designSystem.keywords',
      devOnly: true,
    },
  },
  {
    path: '/dev/storybook',
    name: 'devStorybook',
    component: safeImport(
      () => import(/* webpackChunkName: "dev-storybook" */ '@/views/ComponentShowcase.vue'),
      'ComponentShowcase'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.componentShowcase',
      description: 'seo.componentShowcase.desc',
      keywords: 'seo.componentShowcase.keywords',
      devOnly: true,
    },
  },
  {
    path: '/dev/business-docs',
    name: 'devBusinessDocs',
    component: safeImport(
      () => import(/* webpackChunkName: "dev-business-docs" */ '@/views/BusinessDocs.vue'),
      'BusinessDocs'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.businessDocs',
      description: 'seo.businessDocs.desc',
      keywords: 'seo.businessDocs.keywords',
      devOnly: true,
    },
  },
  {
    path: '/dev/aizhs-demo',
    name: 'devAizhsDemo',
    component: safeImport(
      () => import(/* webpackChunkName: "dev-aizhs-demo" */ '@/views/AizhsDemo.vue'),
      'AizhsDemo'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.aizhsDemo',
      description: 'seo.aizhsDemo.desc',
      keywords: 'seo.aizhsDemo.keywords',
      devOnly: true,
    },
  },
  {
    path: '/dev/project-selector',
    name: 'devProjectSelector',
    component: safeImport(
      () => import(/* webpackChunkName: "dev-project-selector" */ '@/components/demo/ProjectSelectorDemo.vue'),
      'ProjectSelectorDemo'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.devProjectSelector',
      description: 'seo.devProjectSelector.desc',
      keywords: 'seo.devProjectSelector.keywords',
      devOnly: true,
    },
  },
]
