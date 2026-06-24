import type { RouteRecordRaw } from 'vue-router'
import { safeImport } from '../utils/componentLoader'
import { loadModule, getCurrentLocale } from '@/locales'

export const baseRoutes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'home',
    component: safeImport(() => import(/* webpackChunkName: "home" */ '@/views/Home.vue'), 'Home'),
    meta: {
      requiresAuth: false,
      title: 'routes.home',
      description: 'seo.home.desc',
      keywords: 'seo.home.keywords',
      preload: true,
      showFooter: false,
    },
    beforeEnter: async () => {
      // 预加载 home 模块，避免组件渲染时显示 i18n key
      await loadModule(getCurrentLocale(), 'home')
      return true
    },
  },
  {
    path: '/home',
    redirect: '/',
    meta: {
      requiresAuth: false,
    },
  } as RouteRecordRaw,
  {
    path: '/design-system',
    name: 'designSystem',
    component: safeImport(
      () => import(/* webpackChunkName: "design-system" */ '@/views/DesignSystemDemo.vue'),
      'DesignSystemDemo'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.designSystem',
      description: 'seo.designSystem.desc',
      keywords: 'seo.designSystem.keywords',
    },
  },
  {
    path: '/storybook',
    name: 'componentShowcase',
    component: safeImport(
      () => import(/* webpackChunkName: "component-showcase" */ '@/views/ComponentShowcase.vue'),
      'ComponentShowcase'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.componentShowcase',
      description: 'seo.componentShowcase.desc',
      keywords: 'seo.componentShowcase.keywords',
    },
  },
  {
    path: '/business-docs',
    name: 'businessDocs',
    component: safeImport(
      () => import(/* webpackChunkName: "business-docs" */ '@/views/BusinessDocs.vue'),
      'BusinessDocs'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.businessDocs',
      description: 'seo.businessDocs.desc',
      keywords: 'seo.businessDocs.keywords',
    },
  },
  {
    path: '/aizhs-demo',
    name: 'aizhsDemo',
    component: safeImport(
      () => import(/* webpackChunkName: "aizhs-demo" */ '@/views/AizhsDemo.vue'),
      'AizhsDemo'
    ),
    meta: {
      requiresAuth: false,
      title: 'routes.aizhsDemo',
      description: 'seo.aizhsDemo.desc',
    },
  },
  {
    path: '/login',
    name: 'login',
    component: safeImport(() => import(/* webpackChunkName: "auth" */ '@/views/Login.vue'), 'Login'),
    meta: {
      title: 'routes.login',
      description: '登录智汇AI社区 - 支持多种登录方式',
      keywords: '登录,用户登录,账号登录',
    },
  },
  {
    path: '/register',
    name: 'register',
    component: safeImport(
      () => import(/* webpackChunkName: "auth" */ '@/views/Register.vue'),
      'Register'
    ),
    meta: {
      title: 'routes.register',
      description: '注册智汇AI社区账号 - 开始您的AI之旅',
      keywords: '注册,用户注册,账号注册',
    },
  },
  {
    path: '/403',
    name: 'forbidden',
    component: safeImport(() => import(/* webpackChunkName: "forbidden" */ '@/views/Forbidden.vue'), 'Forbidden'),
    meta: {
      requiresAuth: false,
      title: 'routes.forbidden',
      description: 'seo.forbidden.desc',
      keywords: 'seo.forbidden.keywords',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'notFound',
    component: (() =>
      import(/* webpackChunkName: "not-found" */ '@/views/NotFound.vue').catch(() =>
        Promise.resolve({
          name: 'NotFound',
          template: `
            <div class="not-found-container" style="padding:40px; text-align:center;">
              <h1 style="font-size:48px; margin:20px 0; color:var(--el-text-color-primary);">404</h1>
              <p style="font-size:16px; color:var(--el-text-color-secondary); margin:20px 0;">页面未找到</p>
              <button style="padding:10px 16px; background:var(--el-color-primary); color:var(--el-color-white); border:none; border-radius:var(--global-border-radius); cursor:pointer; font-size:14px;" onclick="location.href='/'">返回首页</button>
            </div>
          `,
        } as unknown as import('vue').DefineComponent)
      )) as unknown as import('vue-router').RouteComponent,
    meta: {
      title: 'routes.notFound',
      description: 'seo.notFound.desc',
      keywords: 'seo.notFound.keywords',
    },
  },
]
