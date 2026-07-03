<template>
  <!--
    LearningProfileEntryCard.vue — 学员档案入口卡（PR-F F1）
    在 UserCenter 首页展示，点击跳转 /edu/member
    玻璃态风格与 UserCenter 保持一致
  -->
  <div
    ref="cardRef"
    class="learning-profile-entry-card lp-entry-reveal"
    :class="{ 'lp-entry-reveal--visible': visible }"
    role="button"
    tabindex="0"
    :aria-label="t('edu.profile.entryCardTitle')"
    @click="goToProfile"
    @keydown.enter.prevent="goToProfile"
    @keydown.space.prevent="goToProfile"
  >
    <div class="entry-glow"></div>
    <div class="entry-inner">
      <div class="entry-icon-wrap">
        <el-icon :size="36" class="entry-icon"><Document /></el-icon>
      </div>
      <div class="entry-text">
        <h3 class="entry-title">{{ t('edu.profile.entryCardTitle') }}</h3>
        <p class="entry-desc">{{ t('edu.profile.entryCardDesc') }}</p>
      </div>
      <el-icon class="entry-arrow"><ArrowRight /></el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Document, ArrowRight } from '@element-plus/icons-vue'

const router = useRouter()
const { t } = useI18n()

const cardRef = ref<HTMLElement | null>(null)
const visible = ref(false)
let observer: IntersectionObserver | null = null

function goToProfile() {
  router.push('/edu/member')
}

onMounted(() => {
  // 入场动画：进入视口即显示
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visible.value = true
          observer?.disconnect()
        }
      })
    },
    { threshold: 0.1 }
  )
  // nextTick 后观察自身
  nextTick(() => {
    if (cardRef.value) observer?.observe(cardRef.value)
  })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<style lang="scss" scoped>
.learning-profile-entry-card {
  position: relative;
  background: var(--el-fill-color-lighter);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 20px 24px;
  cursor: pointer;
  overflow: hidden;
  transition:
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--color-white-2);
    pointer-events: none;
  }

  &:hover {
    border-color: var(--border-unified-color-hover);
    transform: translateY(-2px);

    .entry-arrow {
      transform: translateX(4px);
      color: var(--el-color-primary);
    }

    .entry-icon {
      color: var(--el-color-primary);
    }
  }

  &:focus-visible {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 2px var(--el-color-primary-light-7);
  }
}

.entry-glow {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 1px;
  background: var(--color-white-8);
}

.entry-inner {
  position: relative;
  z-index: var(--z-base);
  display: flex;
  align-items: center;
  gap: 16px;
}

.entry-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-light);
  flex-shrink: 0;
  transition: background 0.3s ease;
}

.entry-icon {
  color: var(--el-text-color-regular);
  transition: color 0.3s ease;
}

.entry-text {
  flex: 1;
  min-width: 0;
}

.entry-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  letter-spacing: 0.02em;
}

.entry-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.entry-arrow {
  flex-shrink: 0;
  font-size: 18px;
  color: var(--el-text-color-secondary);
  transition:
    transform 0.3s ease,
    color 0.3s ease;
}

// 滚动入场动画（独立类名，避免与 UserCenter 的 uc-scroll-reveal observer 冲突）
.lp-entry-reveal {
  opacity: 0;
  transform: translateY(30px);
  transition:
    opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);

  &--visible {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (width <= 480px) {
  .learning-profile-entry-card {
    padding: 16px 18px;
  }

  .entry-icon-wrap {
    width: 48px;
    height: 48px;
  }

  .entry-title {
    font-size: 15px;
  }

  .entry-desc {
    font-size: 12px;
  }
}
</style>
