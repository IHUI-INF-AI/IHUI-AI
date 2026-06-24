/**
 * Edu business domain routes (Phase C)
 *
 * Aggregates 129 endpoints from /api/v1/edu/* into client-side routes.
 * Frontend views use Element Plus components and bind to client/src/api/edu/* axios wrappers.
 *
 * Naming convention:
 * - /edu/* : Student-facing (learn, ask, circle, live, etc.)
 * - /admin/edu/* : Admin panel (course management, user management, etc.)
 *
 * P1 封版说明: Phase C 视图层尚未完成, 26 个子页面用 NotFound 占位,
 * 路由 + API 客户端 + 后端 API 已就绪, 后续 Phase C 完成时把占位替换为真实 view 即可.
 */

import type { RouteRecordRaw } from 'vue-router';
import type { Component } from 'vue';

// Phase C 视图占位: 所有 edu 子页面在 view 文件建好前统一渲染 NotFound,
// 避免 TS 类型失败, 同时路由可达不报错
// 使用 typed helper: vue-router 的 Lazy<RouteComponent> 期待 Promise<Component>,
// 而 SFC <script setup> 的 import() 默认推断为整个模块, 这里显式取 default 并断言为 Component
const notFoundComponent = (): Promise<Component> =>
  import('@/views/NotFound.vue').then((m) => m.default as Component);
const EduLayout = notFoundComponent;

// ============================================================================
// Student-facing edu routes
// ============================================================================

const eduRoutes: RouteRecordRaw[] = [
  {
    path: '/edu',
    name: 'EduHome',
    component: EduLayout,
    meta: {
      title: '教育中心',
      requiresAuth: true,
      icon: 'Reading',
    },
    children: [
      // ----- Learn (course learning) -----
      {
        path: 'learn',
        name: 'EduLearn',
        component: notFoundComponent,
        meta: { title: '我的课程', icon: 'Notebook' },
      },
      {
        path: 'learn/detail/:courseId',
        name: 'EduLearnDetail',
        component: notFoundComponent,
        meta: { title: '课程详情', hideInMenu: true },
        props: true,
      },
      {
        path: 'learn/chapter/:chapterId',
        name: 'EduLearnChapter',
        component: notFoundComponent,
        meta: { title: '章节学习', hideInMenu: true },
        props: true,
      },
      {
        path: 'learn/certificate',
        name: 'EduLearnCertificate',
        component: notFoundComponent,
        meta: { title: '我的证书', icon: 'Medal' },
      },

      // ----- Exam (考试) -----
      {
        path: 'exam',
        name: 'EduExam',
        component: notFoundComponent,
        meta: { title: '我的考试', icon: 'EditPen' },
      },
      {
        path: 'exam/paper/:paperId',
        name: 'EduExamPaper',
        component: notFoundComponent,
        meta: { title: '试卷', hideInMenu: true },
        props: true,
      },
      {
        path: 'exam/record/:recordId',
        name: 'EduExamRecord',
        component: notFoundComponent,
        meta: { title: '考试记录', hideInMenu: true },
        props: true,
      },
      {
        path: 'exam/wrong-book',
        name: 'EduExamWrongBook',
        component: notFoundComponent,
        meta: { title: '错题本', icon: 'Collection' },
      },

      // ----- Ask (Q&A, edu-unique) -----
      {
        path: 'ask',
        name: 'EduAsk',
        component: notFoundComponent,
        meta: { title: '问答', icon: 'ChatLineRound' },
      },
      {
        path: 'ask/detail/:questionId',
        name: 'EduAskDetail',
        component: notFoundComponent,
        meta: { title: '问题详情', hideInMenu: true },
        props: true,
      },
      {
        path: 'ask/create',
        name: 'EduAskCreate',
        component: notFoundComponent,
        meta: { title: '提问', hideInMenu: true, requiresAuth: true },
      },

      // ----- Circle (community, edu-unique) -----
      {
        path: 'circle',
        name: 'EduCircle',
        component: notFoundComponent,
        meta: { title: '圈子', icon: 'Connection' },
      },
      {
        path: 'circle/detail/:circleId',
        name: 'EduCircleDetail',
        component: notFoundComponent,
        meta: { title: '圈子详情', hideInMenu: true },
        props: true,
      },
      {
        path: 'circle/post/:postId',
        name: 'EduCirclePost',
        component: notFoundComponent,
        meta: { title: '帖子详情', hideInMenu: true },
        props: true,
      },

      // ----- Live -----
      {
        path: 'live',
        name: 'EduLive',
        component: notFoundComponent,
        meta: { title: '直播', icon: 'VideoCamera' },
      },
      {
        path: 'live/room/:roomId',
        name: 'EduLiveRoom',
        component: notFoundComponent,
        meta: { title: '直播间', hideInMenu: true },
        props: true,
      },

      // ----- Member (student profile) -----
      {
        path: 'member',
        name: 'EduMember',
        component: notFoundComponent,
        meta: { title: '学员档案', icon: 'User' },
      },

      // ----- Point (points) -----
      {
        path: 'point',
        name: 'EduPoint',
        component: notFoundComponent,
        meta: { title: '积分', icon: 'Coin' },
      },

      // ----- Order -----
      {
        path: 'order',
        name: 'EduOrder',
        component: notFoundComponent,
        meta: { title: '我的订单', icon: 'List' },
      },
      {
        path: 'order/detail/:orderId',
        name: 'EduOrderDetail',
        component: notFoundComponent,
        meta: { title: '订单详情', hideInMenu: true },
        props: true,
      },

      // ----- Message -----
      {
        path: 'message',
        name: 'EduMessage',
        component: notFoundComponent,
        meta: { title: '消息中心', icon: 'ChatDotRound' },
      },

      // ----- Notification -----
      {
        path: 'notification',
        name: 'EduNotification',
        component: notFoundComponent,
        meta: { title: '通知', icon: 'Bell' },
      },

      // ----- Resource -----
      {
        path: 'resource',
        name: 'EduResource',
        component: notFoundComponent,
        meta: { title: '资源库', icon: 'Folder' },
      },

      // ----- Search -----
      {
        path: 'search',
        name: 'EduSearch',
        component: notFoundComponent,
        meta: { title: '搜索', icon: 'Search' },
      },
    ],
  },

  // ============================================================================
  // Admin-facing edu routes (delegate to existing admin/ subdirs)
  // ============================================================================
  {
    path: '/admin/edu',
    name: 'EduAdminHome',
    component: notFoundComponent,
    meta: {
      title: '教育后台',
      requiresAdmin: true,
      icon: 'Setting',
      hideInMenu: false,
    },
  },
];

export default eduRoutes;
