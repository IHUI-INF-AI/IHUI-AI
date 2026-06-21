import type { RouteRecordRaw } from 'vue-router'
import { safeImport } from '../utils/componentLoader'

/**
 * 课程学习路由(从 G:\code\edu 整合)
 * 13 个页面:首页/列表/详情/播放/地图/专题/专题详情/作业/证书/证书下载/评价/购买确认/支付/支付完成
 */
export const learnRoutes: Array<RouteRecordRaw> = [
  {
    path: '/learn',
    name: 'learnHome',
    component: safeImport(() => import(/* webpackChunkName: "learn-home" */ '@/views/learn/Home.vue'), 'LearnHome'),
    meta: {
      title: 'routes.learnHome',
      description: '课程学习中心 - 浏览 / 报名 / 学习',
      keywords: '课程,学习,在线学习',
      requiresAuth: false,
    },
  },
  {
    path: '/learn/list',
    name: 'learnList',
    component: safeImport(() => import(/* webpackChunkName: "learn-list" */ '@/views/learn/List.vue'), 'LearnList'),
    meta: {
      title: 'routes.learnList',
      description: '课程列表 - 全部分类课程',
      keywords: '课程列表',
      requiresAuth: false,
    },
  },
  {
    path: '/learn/detail/:id',
    name: 'learnDetail',
    component: safeImport(() => import(/* webpackChunkName: "learn-detail" */ '@/views/learn/Detail.vue'), 'LearnDetail'),
    meta: {
      title: 'routes.learnDetail',
      description: '课程详情 - 章节 / 讲师 / 评价',
      keywords: '课程详情',
      requiresAuth: false,
    },
  },
  {
    path: '/learn/detail/:id/play',
    name: 'learnPlay',
    component: safeImport(() => import(/* webpackChunkName: "learn-play" */ '@/views/learn/Play.vue'), 'LearnPlay'),
    meta: {
      title: 'routes.learnPlay',
      description: '课程学习播放',
      keywords: '课程播放',
      requiresAuth: true,
    },
  },
  {
    path: '/learn/map',
    name: 'learnMap',
    component: safeImport(() => import(/* webpackChunkName: "learn-map" */ '@/views/learn/Map.vue'), 'LearnMap'),
    meta: {
      title: 'routes.learnMap',
      description: '学习地图 - 系统化学习路径',
      keywords: '学习地图',
      requiresAuth: false,
    },
  },
  {
    path: '/learn/topic',
    name: 'learnTopic',
    component: safeImport(() => import(/* webpackChunkName: "learn-topic" */ '@/views/learn/Topic.vue'), 'LearnTopic'),
    meta: {
      title: 'routes.learnTopic',
      description: '专题课程 - 主题式学习',
      keywords: '专题课程',
      requiresAuth: false,
    },
  },
  {
    path: '/learn/topic/:id',
    name: 'learnTopicDetail',
    component: safeImport(() => import(/* webpackChunkName: "learn-topic-detail" */ '@/views/learn/TopicDetail.vue'), 'LearnTopicDetail'),
    meta: {
      title: 'routes.learnTopicDetail',
      description: '专题详情',
      keywords: '专题详情',
      requiresAuth: false,
    },
  },
  {
    path: '/learn/homework',
    name: 'learnHomework',
    component: safeImport(() => import(/* webpackChunkName: "learn-homework" */ '@/views/learn/Homework.vue'), 'LearnHomework'),
    meta: {
      title: 'routes.learnHomework',
      description: '我的作业',
      keywords: '作业',
      requiresAuth: true,
    },
  },
  {
    path: '/learn/certificate',
    name: 'learnCertificate',
    component: safeImport(() => import(/* webpackChunkName: "learn-certificate" */ '@/views/learn/Certificate.vue'), 'LearnCertificate'),
    meta: {
      title: 'routes.learnCertificate',
      description: '我的证书',
      keywords: '证书,学习证书',
      requiresAuth: true,
    },
  },
  {
    path: '/learn/certificate/download/:id',
    name: 'learnCertificateDownload',
    component: safeImport(() => import(/* webpackChunkName: "learn-cert-download" */ '@/views/learn/CertificateDownload.vue'), 'LearnCertificateDownload'),
    meta: {
      title: 'routes.learnCertificateDownload',
      description: '证书下载',
      keywords: '证书下载',
      requiresAuth: true,
    },
  },
  {
    path: '/learn/buyconfirm',
    name: 'learnBuyConfirm',
    component: safeImport(() => import(/* webpackChunkName: "learn-buyconfirm" */ '@/views/learn/BuyConfirm.vue'), 'LearnBuyConfirm'),
    meta: {
      title: 'routes.learnBuyConfirm',
      description: '购买确认',
      keywords: '购买课程',
      requiresAuth: true,
    },
  },
  {
    path: '/learn/payment',
    name: 'learnPayment',
    component: safeImport(() => import(/* webpackChunkName: "learn-payment" */ '@/views/learn/Payment.vue'), 'LearnPayment'),
    meta: {
      title: 'routes.learnPayment',
      description: '课程支付',
      keywords: '课程支付',
      requiresAuth: true,
    },
  },
  {
    path: '/learn/payment/confirm',
    name: 'learnPaymentConfirm',
    component: safeImport(() => import(/* webpackChunkName: "learn-payment-confirm" */ '@/views/learn/PaymentConfirm.vue'), 'LearnPaymentConfirm'),
    meta: {
      title: 'routes.learnPaymentConfirm',
      description: '支付成功',
      keywords: '支付成功',
      requiresAuth: true,
    },
  },
]
