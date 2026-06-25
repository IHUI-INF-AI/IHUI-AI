<template>
  <nav class="admin-menu">
    <div v-for="g in groups" :key="g.key" class="menu-group">
      <div class="group-title">{{ g.title }}</div>
      <router-link
        v-for="m in g.children"
        :key="m.path"
        :to="m.path"
        class="menu-item"
        :class="{ active: $route.path === m.path || $route.path.startsWith(m.path + '/') }"
        @click="onMenuClick(m)"
      >
        <el-icon v-if="m.icon" :size="16"><component :is="m.icon" /></el-icon>
        <span>{{ m.title }}</span>
        <!-- 站内信未读红点 (P1 封版 + 增强) -->
        <span
          v-if="m.badgeKey === 'notify' && unreadCount > 0"
          class="menu-badge"
          :class="{
            // > 100 降级为纯红点 (无数字), 避免菜单拥挤
            'menu-badge-dot': unreadCount > 100,
            'menu-badge-num': unreadCount <= 100,
          }"
          :title="`${unreadCount} 条未读`"
        >{{ unreadCount > 999 ? '999+' : unreadCount > 100 ? '' : unreadCount }}</span>
      </router-link>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  User, Reading, EditPen, VideoCamera, ChatDotRound, Connection, Document,
  Collection, ShoppingCart, Trophy, Medal, Histogram, Lock, Setting, Search,
  OfficeBuilding, Promotion, ChatLineSquare, Bell, Picture, Key, Monitor,
  DataAnalysis,
} from '@element-plus/icons-vue'
import { useNotifyBadge } from '@/composables/useNotifyBadge'

interface MenuItem { path: string; title: string; icon?: unknown; badgeKey?: 'notify' }
interface MenuGroup { key: string; title: string; children: MenuItem[] }

const { t } = useI18n()

// 站内信红点 (P1 封版: 每 30s 轮询一次)
const { unreadCount, refresh } = useNotifyBadge()

/** 菜单点击钩子: 点击通知中心菜单时立即拉取一次 (不必等 30s 轮询). */
function onMenuClick(m: MenuItem) {
  if (m.badgeKey === 'notify') {
    void refresh()
  }
}

const groups = computed<MenuGroup[]>(() => [
  {
    key: 'dashboard', title: t('adminCommon.menu.group.dashboard'), children: [
      { path: '/admin/home', title: t('adminCommon.menu.item.home'), icon: Histogram },
    ],
  },
  {
    key: 'user', title: t('adminCommon.menu.group.user'), children: [
      { path: '/admin/member/list', title: t('adminCommon.menu.item.memberList'), icon: User },
      { path: '/admin/member/unaudited', title: t('adminCommon.menu.item.memberUnaudited'), icon: EditPen },
      { path: '/admin/member/group', title: t('adminCommon.menu.item.memberGroup'), icon: Connection },
      { path: '/admin/member/level', title: t('adminCommon.menu.item.memberLevel'), icon: Medal },
      { path: '/admin/member/post', title: t('adminCommon.menu.item.memberPost'), icon: Promotion },
      { path: '/admin/member/tag', title: t('adminCommon.menu.item.memberTag'), icon: Collection },
    ],
  },
  {
    key: 'org', title: t('adminCommon.menu.group.org'), children: [
      { path: '/admin/org/user', title: t('adminCommon.menu.item.orgUser'), icon: User },
      { path: '/admin/org/department', title: t('adminCommon.menu.item.orgDepartment'), icon: OfficeBuilding },
    ],
  },
  {
    key: 'learn', title: t('adminCommon.menu.group.learn'), children: [
      { path: '/admin/learn/lesson', title: t('adminCommon.menu.item.learnLesson'), icon: Reading },
      { path: '/admin/learn/category', title: t('adminCommon.menu.item.learnCategory'), icon: Connection },
      { path: '/admin/learn/map', title: t('adminCommon.menu.item.learnMap'), icon: Histogram },
      { path: '/admin/learn/topic', title: t('adminCommon.menu.item.learnTopic'), icon: Document },
      { path: '/admin/learn/order', title: t('adminCommon.menu.item.learnOrder'), icon: ShoppingCart },
      { path: '/admin/learn/signup', title: t('adminCommon.menu.item.learnSignup'), icon: EditPen },
      { path: '/admin/learn/report', title: t('adminCommon.menu.item.learnReport'), icon: Histogram },
    ],
  },
  {
    key: 'exam', title: t('adminCommon.menu.group.exam'), children: [
      { path: '/admin/exam/list', title: t('adminCommon.menu.item.examList'), icon: EditPen },
      { path: '/admin/exam/category', title: t('adminCommon.menu.item.examCategory'), icon: Connection },
      { path: '/admin/exam/paper', title: t('adminCommon.menu.item.examPaper'), icon: Document },
      { path: '/admin/exam/question', title: t('adminCommon.menu.item.examQuestion'), icon: Collection },
      { path: '/admin/exam/answer', title: t('adminCommon.menu.item.examAnswer'), icon: EditPen },
    ],
  },
  {
    key: 'live', title: t('adminCommon.menu.group.live'), children: [
      { path: '/admin/live/channel', title: t('adminCommon.menu.item.liveChannel'), icon: VideoCamera },
      { path: '/admin/live/lecturer', title: t('adminCommon.menu.item.liveLecturer'), icon: User },
      { path: '/admin/live/category', title: t('adminCommon.menu.item.liveCategory'), icon: Connection },
    ],
  },
  {
    key: 'community', title: t('adminCommon.menu.group.community'), children: [
      { path: '/admin/ask/question', title: t('adminCommon.menu.item.askQuestion'), icon: ChatDotRound },
      { path: '/admin/ask/category', title: t('adminCommon.menu.item.askCategory'), icon: Connection },
      { path: '/admin/circle/list', title: t('adminCommon.menu.item.circleList'), icon: Connection },
      { path: '/admin/circle/dynamic', title: t('adminCommon.menu.item.circleDynamic'), icon: ChatLineSquare },
      { path: '/admin/article/content', title: t('adminCommon.menu.item.articleContent'), icon: Document },
      { path: '/admin/article/category', title: t('adminCommon.menu.item.articleCategory'), icon: Connection },
      { path: '/admin/comment/list', title: t('adminCommon.menu.item.commentList'), icon: ChatLineSquare },
      { path: '/admin/comment/sensitive', title: t('adminCommon.menu.item.commentSensitive'), icon: Lock },
    ],
  },
  {
    key: 'content', title: t('adminCommon.menu.group.content'), children: [
      { path: '/admin/news/content', title: t('adminCommon.menu.item.newsContent'), icon: Document },
      { path: '/admin/resource/list', title: t('adminCommon.menu.item.resourceList'), icon: Collection },
      { path: '/admin/resource/category', title: t('adminCommon.menu.item.resourceCategory'), icon: Connection },
      { path: '/admin/resource/tag', title: t('adminCommon.menu.item.resourceTag'), icon: Collection },
    ],
  },
  {
    key: 'point', title: t('adminCommon.menu.group.point'), children: [
      { path: '/admin/point/list', title: t('adminCommon.menu.item.pointList'), icon: Trophy },
      { path: '/admin/point/channel', title: t('adminCommon.menu.item.pointChannel'), icon: Promotion },
      { path: '/admin/point/record', title: t('adminCommon.menu.item.pointRecord'), icon: Document },
      { path: '/admin/certificate/template', title: t('adminCommon.menu.item.certificateTemplate'), icon: Medal },
    ],
  },
  {
    key: 'message', title: t('adminCommon.menu.group.message'), children: [
      { path: '/admin/notification', title: t('adminCommon.menu.item.notification'), icon: Bell, badgeKey: 'notify' },
      { path: '/admin/message/announcement', title: t('adminCommon.menu.item.messageAnnouncement'), icon: Bell },
    ],
  },
  {
    key: 'auth', title: t('adminCommon.menu.group.auth'), children: [
      { path: '/admin/auth/role', title: t('adminCommon.menu.item.authRole'), icon: Key },
      { path: '/admin/auth/authority', title: t('adminCommon.menu.item.authAuthority'), icon: Lock },
    ],
  },
  {
    key: 'setting', title: t('adminCommon.menu.group.setting'), children: [
      { path: '/admin/setting/index', title: t('adminCommon.menu.item.settingIndex'), icon: Setting },
      { path: '/admin/setting/carousel', title: t('adminCommon.menu.item.settingCarousel'), icon: Picture },
      { path: '/admin/setting/agreement', title: t('adminCommon.menu.item.settingAgreement'), icon: Document },
      { path: '/admin/search/hot', title: t('adminCommon.menu.item.searchHot'), icon: Search },
      { path: '/admin/aiworld/site', title: t('adminCommon.menu.item.aiworldSite'), icon: Connection },
      { path: '/admin/backend-health', title: t('adminCommon.menu.item.backendHealth'), icon: Monitor },
      { path: '/admin/migration', title: t('adminCommon.menu.item.migration'), icon: DataAnalysis },
    ],
  },
])
</script>

<style scoped lang="scss">
:where(.admin-menu) {
  flex: 1; padding: 12px 0; overflow-y: auto;
  .menu-group { margin-bottom: 8px; }

  .group-title {
    padding: 8px 20px; font-size: 12px;
    color: var(--color-white-40);
    text-transform: uppercase; letter-spacing: 0.5px;
  }

  .menu-item {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 20px; margin: 2px 8px;
    color: var(--color-white-70);
    text-decoration: none; font-size: 13px;
    border-radius: var(--global-border-radius);
    transition: all 0.2s;
    &:hover { color: var(--color-on-primary); background: var(--color-white-8); }
    &.active { color: var(--color-on-primary); background: var(--el-color-primary); }
  }

  /* 站内信未读红点 (P1 封版) -- 扁平化, 纯背景色 + 边框 */
  .menu-badge {
    margin-left: auto;
    min-width: 18px; height: 18px;
    padding: 0 5px;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 9px;
    font-size: 11px; font-weight: 600;
    line-height: 1;
    background: var(--el-color-danger);
    color: var(--el-bg-color);
    border: 1px solid var(--el-color-danger);
  }
  .menu-badge-dot {
    min-width: 8px; width: 8px; height: 8px;
    padding: 0; border-radius: 50%;
  }
  .menu-badge-num {
    /* 数字徽章, 维持长方形药丸 */
  }
}
</style>
