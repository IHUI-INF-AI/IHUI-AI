<template>
  <div class="member-menu">
    <div
      v-for="group in menuGroups"
      :key="group.key"
      class="menu-group"
    >
      <div class="group-title">{{ group.title }}</div>
      <router-link
        v-for="item in group.children"
        :key="item.key"
        :to="item.url"
        class="menu-item"
        :class="{ active: active === item.key }"
      >
        {{ item.title }}
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    active?: string
  }>(),
  { active: 'personal' }
)

const { t } = useI18n()

interface MenuItem {
  key: string
  title: string
  url: string
}
interface MenuGroup {
  key: string
  title: string
  children: MenuItem[]
}

const menuGroups = computed<MenuGroup[]>(() => [
  {
    key: 'account',
    title: t('my.memberMenu.account'),
    children: [
      { key: 'personal', title: t('my.memberMenu.personal'), url: '/member/personal' },
      { key: 'setting', title: t('my.memberMenu.setting'), url: '/member/setting' },
      { key: 'point', title: t('my.memberMenu.point'), url: '/member/point' },
      { key: 'certificate', title: t('my.memberMenu.certificate'), url: '/member/certificate' },
    ],
  },
  {
    key: 'learn',
    title: t('my.memberMenu.learn'),
    children: [
      { key: 'learn-record', title: t('my.memberMenu.learnRecord'), url: '/member/learn-record' },
      { key: 'homework', title: t('my.memberMenu.homework'), url: '/member/homework' },
    ],
  },
  {
    key: 'exam',
    title: t('my.memberMenu.exam'),
    children: [
      { key: 'exam-sign-up', title: t('my.memberMenu.examSignUp'), url: '/member/exam-sign-up' },
      { key: 'exam-record', title: t('my.memberMenu.examRecord'), url: '/member/exam-record' },
      { key: 'exam-wrong', title: t('my.memberMenu.examWrong'), url: '/member/exam-wrong' },
    ],
  },
  {
    key: 'sns',
    title: t('my.memberMenu.sns'),
    children: [
      { key: 'follow', title: t('my.memberMenu.follow'), url: '/member/follow' },
      { key: 'fans', title: t('my.memberMenu.fans'), url: '/member/fans' },
      { key: 'favorites', title: t('my.memberMenu.favorites'), url: '/member/favorites' },
      { key: 'comment', title: t('my.memberMenu.comment'), url: '/member/comment' },
    ],
  },
  {
    key: 'content',
    title: t('my.memberMenu.content'),
    children: [
      { key: 'circle', title: t('my.memberMenu.circle'), url: '/member/circle' },
      { key: 'ask', title: t('my.memberMenu.ask'), url: '/member/ask' },
      { key: 'article', title: t('my.memberMenu.article'), url: '/member/article' },
      { key: 'resource', title: t('my.memberMenu.resource'), url: '/member/resource' },
    ],
  },
])
</script>

<style lang="scss" scoped>
:where(.member-menu) {
  width: 200px;
  flex-shrink: 0;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 16px 0;
  height: fit-content;
  position: sticky;
  top: 16px;
}

:where(.menu-group) {
  margin-bottom: 16px;
}

:where(.group-title) {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  padding: 0 16px 8px;
}

:where(.menu-item) {
  display: block;
  padding: 8px 16px 8px 24px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  text-decoration: none;
  position: relative;

  &:hover {
    color: var(--el-color-primary);
    background: var(--el-fill-color-lighter);
  }

  &.active {
    color: var(--el-color-primary);
    font-weight: 500;
    background: var(--el-color-primary-light-9);

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: var(--el-color-primary);
    }
  }
}
</style>
