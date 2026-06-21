<template>
  <div class="course-detail-container">
    <!-- 导航栏 -->
    <div class="nav-bar">
      <el-page-header @back="goBack" :title="t('courseDetail.back')" :content="t('courseDetail.title')" />
    </div>

    <!-- 课程封面 -->
    <div class="course-cover">
      <img :src="courseInfo.coverUrl" alt="cover" />
      <div class="cover-mask">
        <div class="title">{{ courseInfo.title }}</div>
        <div class="subtitle">{{ courseInfo.subtitle }}</div>
      </div>
    </div>

    <!-- 课程信息 -->
    <div class="course-info">
      <div class="info-item">
        <el-icon :size="20" color="var(--color-blue-4080ff)"><User /></el-icon>
        <span class="text">{{ courseInfo.teacher }}</span>
      </div>
      <div class="info-item">
        <el-icon :size="20" color="var(--color-blue-4080ff)"><Clock /></el-icon>
        <span class="text">{{ courseInfo.duration }}</span>
      </div>
      <div class="info-item">
        <el-icon :size="20" color="var(--color-blue-4080ff)"><Medal /></el-icon>
        <span class="text">{{ courseInfo.level }}</span>
      </div>
    </div>

    <!-- 课程简介 -->
    <div class="course-section">
      <div class="section-title">{{ t('courseDetail.courseIntro') }}</div>
      <div class="section-content">{{ courseInfo.description }}</div>
    </div>

    <!-- 课程大纲 -->
    <div class="course-section">
      <div class="section-title">{{ t('courseDetail.courseOutline') }}</div>
      <div class="outline-list">
        <el-collapse v-model="activeOutline">
          <el-collapse-item
            v-for="(item, index) in courseInfo.outline"
            :key="index"
            :name="index"
          >
            <template #title>
              <div class="outline-header">
                <span class="outline-title">{{ item.title }}</span>
                <span class="outline-duration">{{ item.duration }}</span>
              </div>
            </template>
            <div class="outline-content">{{ item.description }}</div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="bottom-bar">
      <div class="price">
        <span class="symbol">¥</span>
        <span class="amount">{{ courseInfo.price }}</span>
      </div>
      <div class="action-buttons">
        <el-button @click="addToCart">
          <el-icon><ShoppingCart /></el-icon>
          {{ t('courseDetail.addToCart') }}
        </el-button>
        <el-button type="primary" @click="buyNow">{{ t('courseDetail.buyNow') }}</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { User, Clock, Medal, ShoppingCart } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const { t } = useI18n()

const activeOutline = ref([0])

const courseInfo = reactive({
  title: '短视频运营实战课程',
  subtitle: t('courseDetail.learnShortVideoFromZero'),
  coverUrl: '/static/images/course-cover.jpg',
  teacher: t('courseDetail.teacherZhang'),
  duration: t('courseDetail.twelveLessons'),
  level: t('courseDetail.beginner'),
  price: 299,
  description: '本课程将带你全面了解短视频运营的核心要素，包括内容策划、拍摄技巧、剪辑方法、运营策略等。通过实战案例，让你快速掌握短视频运营技能。',
  outline: [
    {
      title: '第一章：短视频运营基础',
      duration: t('courseDetail.fortyFiveMin'),
      description: '了解短视频平台特点、运营规则和基本概念'
    },
    {
      title: '第二章：内容策划与选题',
      duration: t('courseDetail.sixtyMin'),
      description: '学习如何选题、策划内容，打造爆款视频'
    },
    {
      title: '第三章：拍摄与剪辑技巧',
      duration: t('courseDetail.ninetyMin'),
      description: '掌握专业的拍摄和剪辑方法，提升视频质量'
    }
  ]
})

function goBack() {
  window.history.back()
}

function addToCart() {
  ElMessage.success(t('courseDetail.addedToCart'))
}

function buyNow() {
  ElMessage.info(t('courseDetail.goCheckout'))
}
</script>

<style lang="scss" scoped>
.course-detail-container {
  min-height: 100vh;
  background-color: var(--color-bg-page);
  padding-bottom: 120px;
}

.nav-bar {
  padding: 12px 16px;
  background-color: var(--color-white);
  border-bottom: var(--unified-border-bottom);
}

.course-cover {
  position: relative;
  height: 200px;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover-mask {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 20px;
    background: linear-gradient(to top, var(--color-black-70), transparent);

    .title {
      font-size: 20px;
      color: var(--color-white);
      font-weight: bold;
      margin-bottom: 4px;
    }

    .subtitle {
      font-size: 14px;
      color: var(--color-white-80);
    }
  }
}

.course-info {
  display: flex;
  padding: 16px;
  background-color: var(--color-white);

  .info-item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;

    .text {
      font-size: 14px;
      color: var(--color-gray-333);
    }
  }
}

.course-section {
  margin-top: 12px;
  padding: 16px;
  background-color: var(--color-white);

  .section-title {
    font-size: 16px;
    font-weight: bold;
    color: var(--color-gray-333);
    margin-bottom: 12px;
  }

  .section-content {
    font-size: 14px;
    color: var(--color-gray-666);
    line-height: 1.8;
  }
}

.outline-list {
  :deep(.el-collapse-item__header) {
    font-size: 14px;
  }
}

.outline-header {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding-right: 12px;

  .outline-title {
    color: var(--color-gray-333);
  }

  .outline-duration {
    color: var(--color-gray-999);
    font-size: 12px;
  }
}

.outline-content {
  font-size: 13px;
  color: var(--color-gray-666);
  line-height: 1.6;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 60px;
  background-color: var(--color-white);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  box-shadow: var(--global-box-shadow);

  .price {
    .symbol {
      font-size: 14px;
      color: var(--color-blue-4080ff);
    }

    .amount {
      font-size: 22px;
      color: var(--color-blue-4080ff);
      font-weight: bold;
    }
  }

  .action-buttons {
    display: flex;
    gap: 10px;
  }
}
</style>
