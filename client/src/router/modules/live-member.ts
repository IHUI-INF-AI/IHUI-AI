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
 * 直播路由(从 G:\code\edu 整合) — 3 个页面
 */
export const liveRoutes: Array<RouteRecordRaw> = [
  {
    path: '/live',
    name: 'liveList',
    component: safeImport(() => import(/* webpackChunkName: "live-list" */ '@/views/live/List.vue'), 'LiveList'),
    meta: {
      title: 'routes.liveList',
      description: '直播列表 - 实时直播 / 预告 / 回放',
      keywords: '直播,在直播间',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['live']),
  },
  {
    path: '/live/:id',
    name: 'liveDetail',
    component: safeImport(() => import(/* webpackChunkName: "live-detail" */ '@/views/live/Detail.vue'), 'LiveDetail'),
    meta: {
      title: 'routes.liveDetail',
      description: '直播详情',
      keywords: '直播详情',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['live']),
  },
  {
    path: '/live/:id/play',
    name: 'livePlay',
    component: safeImport(() => import(/* webpackChunkName: "live-play" */ '@/views/live/Play.vue'), 'LivePlay'),
    meta: {
      title: 'routes.livePlay',
      description: '直播播放 - 弹幕 / 礼物 / 互动',
      keywords: '直播播放',
      requiresAuth: false,
    },
    beforeEnter: preloadI18n(['live']),
  },
]

/**
 * 会员中心路由(从 G:\code\edu 整合) — 17 个子页面
 */
export const memberRoutes: Array<RouteRecordRaw> = [
  {
    path: '/member/personal',
    name: 'memberPersonal',
    component: safeImport(() => import(/* webpackChunkName: "member-personal" */ '@/views/member/Personal.vue'), 'MemberPersonal'),
    meta: {
      title: 'routes.memberPersonal',
      description: '个人资料',
      keywords: '个人资料',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberPersonal']),
  },
  {
    path: '/member/setting',
    name: 'memberSetting',
    component: safeImport(() => import(/* webpackChunkName: "member-setting" */ '@/views/member/Setting.vue'), 'MemberSetting'),
    meta: {
      title: 'routes.memberSetting',
      description: '账号设置 - 密码 / 手机 / 邮箱 / 通知',
      keywords: '账号设置',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberSetting']),
  },
  {
    path: '/member/point',
    name: 'memberPoint',
    component: safeImport(() => import(/* webpackChunkName: "member-point" */ '@/views/member/Point.vue'), 'MemberPoint'),
    meta: {
      title: 'routes.memberPoint',
      description: '我的积分 - 余额 / 明细 / 签到',
      keywords: '我的积分',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberPoint']),
  },
  {
    path: '/member/certificate',
    name: 'memberCertificate',
    component: safeImport(() => import(/* webpackChunkName: "member-certificate" */ '@/views/member/Certificate.vue'), 'MemberCertificate'),
    meta: {
      title: 'routes.memberCertificate',
      description: '我的证书',
      keywords: '我的证书',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberCertificate']),
  },
  {
    path: '/member/learn-record',
    name: 'memberLearnRecord',
    component: safeImport(() => import(/* webpackChunkName: "member-learn-record" */ '@/views/member/LearnRecord.vue'), 'MemberLearnRecord'),
    meta: {
      title: 'routes.memberLearnRecord',
      description: '学习记录 - 时长 / 进度',
      keywords: '学习记录',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberLearnRecord']),
  },
  {
    path: '/member/homework',
    name: 'memberHomework',
    component: safeImport(() => import(/* webpackChunkName: "member-homework" */ '@/views/member/Homework.vue'), 'MemberHomework'),
    meta: {
      title: 'routes.memberHomework',
      description: '我的作业',
      keywords: '我的作业',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberHomework']),
  },
  {
    path: '/member/exam-sign-up',
    name: 'memberExamSignUp',
    component: safeImport(() => import(/* webpackChunkName: "member-exam-sign-up" */ '@/views/member/ExamSignUp.vue'), 'MemberExamSignUp'),
    meta: {
      title: 'routes.memberExamSignUp',
      description: '考试报名记录',
      keywords: '考试报名',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberExamSignUp']),
  },
  {
    path: '/member/exam-record',
    name: 'memberExamRecord',
    component: safeImport(() => import(/* webpackChunkName: "member-exam-record" */ '@/views/member/ExamRecord.vue'), 'MemberExamRecord'),
    meta: {
      title: 'routes.memberExamRecord',
      description: '答题记录',
      keywords: '答题记录',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberExamRecord']),
  },
  {
    path: '/member/exam-wrong',
    name: 'memberExamWrong',
    component: safeImport(() => import(/* webpackChunkName: "member-exam-wrong" */ '@/views/member/ExamWrong.vue'), 'MemberExamWrong'),
    meta: {
      title: 'routes.memberExamWrong',
      description: '错题本',
      keywords: '错题本',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberExamWrong']),
  },
  {
    path: '/member/follow',
    name: 'memberFollow',
    component: safeImport(() => import(/* webpackChunkName: "member-follow" */ '@/views/member/Follow.vue'), 'MemberFollow'),
    meta: {
      title: 'routes.memberFollow',
      description: '我的关注',
      keywords: '我的关注',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberFollow']),
  },
  {
    path: '/member/fans',
    name: 'memberFans',
    component: safeImport(() => import(/* webpackChunkName: "member-fans" */ '@/views/member/Fans.vue'), 'MemberFans'),
    meta: {
      title: 'routes.memberFans',
      description: '我的粉丝',
      keywords: '我的粉丝',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberFans']),
  },
  {
    path: '/member/favorites',
    name: 'memberFavorites',
    component: safeImport(() => import(/* webpackChunkName: "member-favorites" */ '@/views/member/Favorites.vue'), 'MemberFavorites'),
    meta: {
      title: 'routes.memberFavorites',
      description: '我的收藏',
      keywords: '我的收藏',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberFavorites']),
  },
  {
    path: '/member/comment',
    name: 'memberComment',
    component: safeImport(() => import(/* webpackChunkName: "member-comment" */ '@/views/member/Comment.vue'), 'MemberComment'),
    meta: {
      title: 'routes.memberComment',
      description: '我的评论',
      keywords: '我的评论',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberComment']),
  },
  {
    path: '/member/circle',
    name: 'memberCircle',
    component: safeImport(() => import(/* webpackChunkName: "member-circle" */ '@/views/member/Circle.vue'), 'MemberCircle'),
    meta: {
      title: 'routes.memberCircle',
      description: '我的圈子',
      keywords: '我的圈子',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberCircle']),
  },
  {
    path: '/member/ask',
    name: 'memberAsk',
    component: safeImport(() => import(/* webpackChunkName: "member-ask" */ '@/views/member/Ask.vue'), 'MemberAsk'),
    meta: {
      title: 'routes.memberAsk',
      description: '我的问答',
      keywords: '我的问答',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberAsk']),
  },
  {
    path: '/member/article',
    name: 'memberArticle',
    component: safeImport(() => import(/* webpackChunkName: "member-article" */ '@/views/member/Article.vue'), 'MemberArticle'),
    meta: {
      title: 'routes.memberArticle',
      description: '我的文章',
      keywords: '我的文章',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberArticle']),
  },
  {
    path: '/member/resource',
    name: 'memberResource',
    component: safeImport(() => import(/* webpackChunkName: "member-resource" */ '@/views/member/Resource.vue'), 'MemberResource'),
    meta: {
      title: 'routes.memberResource',
      description: '我的资源',
      keywords: '我的资源',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['memberResource']),
  },
]
