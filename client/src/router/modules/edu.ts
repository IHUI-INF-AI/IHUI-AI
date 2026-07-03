/**
 * Edu business domain routes (Phase C — 视图层已完成 2026-07-04)
 *
 * Aggregates 129 endpoints from /api/v1/edu/* into client-side routes.
 * Frontend views use Element Plus components and bind to client/src/api/edu/* axios wrappers.
 *
 * Naming convention:
 * - /edu/* : Student-facing (learn, ask, circle, live, etc.)
 * - /admin/edu/* : Admin panel (course management, user management, etc.)
 *
 * Phase C 完成: 23 个子页面从 NotFound 占位替换为真实 view, 涵盖
 * Learn(4) / Exam(4) / Ask(3) / Circle(3) / Live(2) / Point(1) / Order(2) /
 * Message(1) / Notification(1) / Resource(1) / Search(1).
 */

import type { RouteRecordRaw } from 'vue-router';
import type { Component } from 'vue';
import { loadModule, getCurrentLocale } from '@/locales';

// 2026-06-26: 路由级 i18n 模块预加载辅助函数 (与其他 router 模块保持一致)
function preloadI18n(modules: string[]) {
  return async () => {
    if (modules.length === 0) return
    const locale = getCurrentLocale()
    await Promise.all(modules.map((m) => loadModule(locale, m).catch(() => undefined)))
  }
}

// Lazy import helper: 显式取 default 并断言为 Component (与其他 edu 路由保持一致)
// 用 Promise<any> 接受 Vue SFC 默认导出 (带 defineProps 的 SFC 导出类型为
// { __typeProps: ..., __typeEmits: ... }, 与 Component 类型不兼容, 需用 as Component 断言)
const lazy = (loader: () => Promise<any>): (() => Promise<Component>) =>
  () => loader().then((m) => m.default as Component);

// EduLayout: /edu 父级布局，含 el-aside 侧边栏菜单 + el-main router-view
const EduLayout = lazy(() => import('@/views/edu/index.vue'));

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
    beforeEnter: preloadI18n(['edu', 'learn', 'exam', 'member', 'distribution']),
    children: [
      // ----- Learn (course learning) -----
      {
        path: 'learn',
        name: 'EduLearn',
        component: lazy(() => import('@/views/edu/learn/MyCourses.vue')),
        meta: { title: '我的课程', icon: 'Notebook' },
      },
      {
        path: 'learn/detail/:courseId',
        name: 'EduLearnDetail',
        component: lazy(() => import('@/views/edu/learn/CourseDetail.vue')),
        meta: { title: '课程详情', hideInMenu: true },
        props: true,
      },
      {
        path: 'learn/chapter/:chapterId',
        name: 'EduLearnChapter',
        component: lazy(() => import('@/views/edu/learn/ChapterLearn.vue')),
        meta: { title: '章节学习', hideInMenu: true },
        props: true,
      },
      {
        path: 'learn/certificate',
        name: 'EduLearnCertificate',
        component: lazy(() => import('@/views/edu/learn/MyCertificates.vue')),
        meta: { title: '我的证书', icon: 'Medal' },
      },

      // ----- Exam (考试) -----
      {
        path: 'exam',
        name: 'EduExam',
        component: lazy(() => import('@/views/edu/exam/MyExams.vue')),
        meta: { title: '我的考试', icon: 'EditPen' },
      },
      {
        path: 'exam/paper/:paperId',
        name: 'EduExamPaper',
        component: lazy(() => import('@/views/edu/exam/ExamPaper.vue')),
        meta: { title: '试卷', hideInMenu: true },
        props: true,
      },
      {
        path: 'exam/record/:recordId',
        name: 'EduExamRecord',
        component: lazy(() => import('@/views/edu/exam/ExamRecord.vue')),
        meta: { title: '考试记录', hideInMenu: true },
        props: true,
      },
      {
        path: 'exam/wrong-book',
        name: 'EduExamWrongBook',
        component: lazy(() => import('@/views/edu/exam/WrongBook.vue')),
        meta: { title: '错题本', icon: 'Collection' },
      },

      // ----- Ask (Q&A, edu-unique) -----
      {
        path: 'ask',
        name: 'EduAsk',
        component: lazy(() => import('@/views/edu/ask/AskList.vue')),
        meta: { title: '问答', icon: 'ChatLineRound' },
      },
      {
        path: 'ask/detail/:questionId',
        name: 'EduAskDetail',
        component: lazy(() => import('@/views/edu/ask/AskDetail.vue')),
        meta: { title: '问题详情', hideInMenu: true },
        props: true,
      },
      {
        path: 'ask/create',
        name: 'EduAskCreate',
        component: lazy(() => import('@/views/edu/ask/AskCreate.vue')),
        meta: { title: '提问', hideInMenu: true, requiresAuth: true },
      },

      // ----- Circle (community, edu-unique) -----
      {
        path: 'circle',
        name: 'EduCircle',
        component: lazy(() => import('@/views/edu/circle/CircleList.vue')),
        meta: { title: '圈子', icon: 'Connection' },
      },
      {
        path: 'circle/detail/:circleId',
        name: 'EduCircleDetail',
        component: lazy(() => import('@/views/edu/circle/CircleDetail.vue')),
        meta: { title: '圈子详情', hideInMenu: true },
        props: true,
      },
      {
        path: 'circle/post/:postId',
        name: 'EduCirclePost',
        component: lazy(() => import('@/views/edu/circle/CirclePost.vue')),
        meta: { title: '帖子详情', hideInMenu: true },
        props: true,
      },

      // ----- Live -----
      {
        path: 'live',
        name: 'EduLive',
        component: lazy(() => import('@/views/edu/live/LiveList.vue')),
        meta: { title: '直播', icon: 'VideoCamera' },
      },
      {
        path: 'live/room/:roomId',
        name: 'EduLiveRoom',
        component: lazy(() => import('@/views/edu/live/LiveRoom.vue')),
        meta: { title: '直播间', hideInMenu: true },
        props: true,
      },

      // ----- Member (student profile) — 已有实现 -----
      {
        path: 'member',
        name: 'EduMember',
        component: lazy(() => import('@/views/edu/member/Profile.vue')),
        meta: { title: '学员档案', icon: 'User', requiresAuth: true },
      },
      {
        path: 'member/report',
        name: 'EduMemberReport',
        component: lazy(() => import('@/views/edu/member/Report.vue')),
        meta: { title: '学习档案报告', hideInMenu: true, requiresAuth: true },
      },
      {
        path: 'member/notes',
        name: 'EduMemberNotes',
        component: lazy(() => import('@/views/edu/member/Notes.vue')),
        meta: { title: '我的笔记', hideInMenu: true, requiresAuth: true },
      },
      {
        path: 'member/offline-records',
        name: 'EduMemberOfflineRecords',
        component: lazy(() => import('@/views/edu/member/OfflineRecords.vue')),
        meta: { title: '线下学习记录', hideInMenu: true, requiresAuth: true },
      },
      {
        path: 'member/certificates/upload',
        name: 'EduMemberCertUpload',
        component: lazy(() => import('@/views/edu/member/CertUpload.vue')),
        meta: { title: '上传历史证书', hideInMenu: true, requiresAuth: true },
      },
      // PR-E E5：试卷列表 + 上传页
      {
        path: 'member/papers',
        name: 'EduMemberPapers',
        component: lazy(() => import('@/views/edu/member/Papers.vue')),
        meta: { title: '我的试卷', hideInMenu: true, requiresAuth: true },
      },
      {
        path: 'member/papers/upload',
        name: 'EduMemberPaperUpload',
        component: lazy(() => import('@/views/edu/member/PaperUpload.vue')),
        meta: { title: '上传试卷', hideInMenu: true, requiresAuth: true },
      },

      // ----- Point (points) -----
      {
        path: 'point',
        name: 'EduPoint',
        component: lazy(() => import('@/views/edu/point/MyPoints.vue')),
        meta: { title: '积分', icon: 'Coin' },
      },

      // ----- Order -----
      {
        path: 'order',
        name: 'EduOrder',
        component: lazy(() => import('@/views/edu/order/MyOrders.vue')),
        meta: { title: '我的订单', icon: 'List' },
      },
      {
        path: 'order/detail/:orderId',
        name: 'EduOrderDetail',
        component: lazy(() => import('@/views/edu/order/OrderDetail.vue')),
        meta: { title: '订单详情', hideInMenu: true },
        props: true,
      },

      // ----- Message -----
      {
        path: 'message',
        name: 'EduMessage',
        component: lazy(() => import('@/views/edu/message/MessageCenter.vue')),
        meta: { title: '消息中心', icon: 'ChatDotRound' },
      },

      // ----- Notification -----
      {
        path: 'notification',
        name: 'EduNotification',
        component: lazy(() => import('@/views/edu/notification/MyNotifications.vue')),
        meta: { title: '通知', icon: 'Bell' },
      },

      // ----- Resource -----
      {
        path: 'resource',
        name: 'EduResource',
        component: lazy(() => import('@/views/edu/resource/ResourceLibrary.vue')),
        meta: { title: '资源库', icon: 'Folder' },
      },

      // ----- Search -----
      {
        path: 'search',
        name: 'EduSearch',
        component: lazy(() => import('@/views/edu/search/EduSearch.vue')),
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
    component: lazy(() => import('@/views/edu/admin/index.vue')),
    meta: {
      title: '教育后台',
      requiresAuth: true,
      requiresAdmin: true,
      icon: 'Setting',
      hideInMenu: false,
    },
    beforeEnter: preloadI18n(['edu']),
  },
];

export default eduRoutes;
