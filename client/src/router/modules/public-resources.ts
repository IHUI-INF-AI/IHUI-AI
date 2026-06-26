import type { RouteRecordRaw } from 'vue-router'
import { safeImport } from '../utils/componentLoader'
import { loadModule, getCurrentLocale } from '@/locales'

// 2026-06-26: 路由级 i18n 模块预加载辅助函数
function preloadI18n(modules: string[]) {
  return async () => {
    if (modules.length === 0) return
    const locale = getCurrentLocale()
    await Promise.all(modules.map((m) => loadModule(locale, m).catch(() => undefined)))
  }
}

/**
 * 公共资源路由(从 G:\code\edu 整合) — 6 个公共资源页
 * 资讯(news) + 文章(article) + 资源(resource) 各 2 页
 */
export const publicResourceRoutes: Array<RouteRecordRaw> = [
  // 资讯
  {
    path: '/news',
    name: 'newsList',
    component: safeImport(() => import(/* webpackChunkName: "news-list" */ '@/views/news/List.vue'), 'NewsList'),
    meta: {
      title: 'routes.newsList',
      description: '资讯中心 - 最新教育动态',
      keywords: '资讯,新闻,教育动态',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['newsList']),
  },
  {
    path: '/news/:id',
    name: 'newsDetail',
    component: safeImport(() => import(/* webpackChunkName: "news-detail" */ '@/views/news/Detail.vue'), 'NewsDetail'),
    meta: {
      title: 'routes.newsDetail',
      description: '资讯详情',
      keywords: '资讯详情',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['newsList']),
  },
  // 文章
  {
    path: '/article',
    name: 'articleList',
    component: safeImport(() => import(/* webpackChunkName: "article-list" */ '@/views/article/List.vue'), 'ArticleList'),
    meta: {
      title: 'routes.articleList',
      description: '精选文章 - 深度好文',
      keywords: '文章,精选,深度',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['articleList']),
  },
  {
    path: '/article/:id',
    name: 'articleDetail',
    component: safeImport(() => import(/* webpackChunkName: "article-detail" */ '@/views/article/Detail.vue'), 'ArticleDetail'),
    meta: {
      title: 'routes.articleDetail',
      description: '文章详情',
      keywords: '文章详情',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['articleList']),
  },
  // 资源
  {
    path: '/resource',
    name: 'resourceList',
    component: safeImport(() => import(/* webpackChunkName: "resource-list" */ '@/views/resource/List.vue'), 'ResourceList'),
    meta: {
      title: 'routes.resourceList',
      description: '资源中心 - 课件工具文档',
      keywords: '资源,下载,课件',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['resourceList']),
  },
  {
    path: '/resource/:id',
    name: 'resourceDetail',
    component: safeImport(() => import(/* webpackChunkName: "resource-detail" */ '@/views/resource/Detail.vue'), 'ResourceDetail'),
    meta: {
      title: 'routes.resourceDetail',
      description: '资源详情',
      keywords: '资源详情,下载',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['resourceList']),
  },
]

/**
 * 首页整合路由(edu 风格) — 1 个首页
 * 用 /index 而非 /home,避免与 base.ts 中已存在的 /home 路由冲突
 */
export const indexRoutes: Array<RouteRecordRaw> = [
  {
    path: '/index',
    name: 'homeIndex',
    component: safeImport(() => import(/* webpackChunkName: "home-index" */ '@/views/index/Index.vue'), 'HomeIndex'),
    meta: {
      title: 'routes.homeIndex',
      description: '在线学习平台首页',
      keywords: '学习平台,课程,直播,考试',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['homeIndex']),
  },
]
