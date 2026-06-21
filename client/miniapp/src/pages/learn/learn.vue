<template>
  <view class="container">
    <!-- 学习进度概览 -->
    <view class="progress-overview">
      <view class="progress-item">
        <text class="progress-num">{{ userProgress.totalCourses }}</text>
        <text class="progress-label">总课程数</text>
      </view>
      <view class="progress-item">
        <text class="progress-num">{{ userProgress.completedCourses }}</text>
        <text class="progress-label">已完成</text>
      </view>
      <view class="progress-item">
        <text class="progress-num">{{ userProgress.learningHours }}</text>
        <text class="progress-label">学习时长(小时)</text>
      </view>
    </view>

    <!-- 学习路径 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">学习路径</text>
        <text class="more-link" @tap="navigateTo('/pages/learn/paths')">更多</text>
      </view>
      <scroll-view scroll-x class="path-scroll">
        <view class="path-list">
          <view 
            class="path-card" 
            v-for="(item, index) in learningPaths" 
            :key="index"
            @tap="navigateTo(item.path)"
          >
            <image :src="item.cover" mode="aspectFill" class="path-image"></image>
            <view class="path-info">
              <text class="path-title">{{ item.title }}</text>
              <text class="path-desc">{{ item.description }}</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 课程分类 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">课程分类</text>
        <text class="more-link" @tap="navigateTo('/pages/learn/categories')">更多</text>
      </view>
      <view class="category-grid">
        <view 
          class="category-item" 
          v-for="(item, index) in categories" 
          :key="index"
          @tap="navigateTo(item.path)"
        >
          <image :src="item.icon" mode="aspectFit" class="category-icon"></image>
          <text class="category-name">{{ item.name }}</text>
        </view>
      </view>
    </view>

    <!-- 推荐课程 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">推荐课程</text>
        <text class="more-link" @tap="navigateTo('/pages/learn/recommended')">更多</text>
      </view>
      <view class="course-list">
        <view 
          class="course-card" 
          v-for="(item, index) in recommendedCourses" 
          :key="index"
          @tap="navigateTo(item.path)"
        >
          <image :src="item.cover" mode="aspectFill" class="course-image"></image>
          <view class="course-info">
            <text class="course-title">{{ item.title }}</text>
            <text class="course-desc">{{ item.description }}</text>
            <view class="course-meta">
              <text class="course-level">{{ item.level }}</text>
              <text class="course-duration">{{ item.duration }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive } from 'vue'

// 学习进度
const userProgress = reactive({
  totalCourses: 50,
  completedCourses: 12,
  learningHours: 36,
})

// 学习路径
const learningPaths = ref([
  {
    title: '新手入门',
    description: '从零开始掌握抖音运营',
    cover: '/static/learn/path1.jpg',
    path: '/pages/learn/path-detail?id=1',
  },
  {
    title: '私域运营',
    description: '打造私域流量池',
    cover: '/static/learn/path2.jpg',
    path: '/pages/learn/path-detail?id=2',
  },
])

// 课程分类
const categories = ref([
  { name: '抖音运营', icon: '/static/learn/category1.png', path: '/pages/learn/category?id=1' },
  { name: '私域运营', icon: '/static/learn/category2.png', path: '/pages/learn/category?id=2' },
  { name: '内容创作', icon: '/static/learn/category3.png', path: '/pages/learn/category?id=3' },
  { name: '数据分析', icon: '/static/learn/category4.png', path: '/pages/learn/category?id=4' },
])

// 推荐课程
const recommendedCourses = ref([
  {
    title: '抖音本地推入门课程',
    description: '快速掌握抖音运营基础',
    cover: '/static/learn/course1.jpg',
    level: '入门',
    duration: '2小时',
    path: '/pages/learn/course-detail?id=1',
  },
  {
    title: '私域运营实战课程',
    description: '提升转化率的实用技巧',
    cover: '/static/learn/course2.jpg',
    level: '进阶',
    duration: '3小时',
    path: '/pages/learn/course-detail?id=2',
  },
])

// 导航
function navigateTo(path: string) {
  uni.navigateTo({ url: path })
}
</script>

<style lang="scss" scoped>
.container {
  padding: 0;
}

.progress-overview {
  display: flex;
  justify-content: space-around;
  padding: 40rpx;
  background-color: #fff;
  margin-bottom: 20rpx;

  .progress-item {
    text-align: center;

    .progress-num {
      font-size: 40rpx;
      color: #007aff;
      font-weight: bold;
      display: block;
      margin-bottom: 10rpx;
    }

    .progress-label {
      font-size: 24rpx;
      color: #999;
    }
  }
}

.section {
  background-color: #fff;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.more-link {
  color: #999;
  font-size: 24rpx;
}

.path-scroll {
  white-space: nowrap;
}

.path-list {
  display: inline-flex;
  padding: 20rpx 0;
}

.path-card {
  width: 300rpx;
  margin-right: 20rpx;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.1);

  .path-image {
    width: 100%;
    height: 180rpx;
  }

  .path-info {
    padding: 20rpx;

    .path-title {
      font-size: 28rpx;
      color: #333;
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .path-desc {
      font-size: 24rpx;
      color: #999;
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20rpx;
  padding: 20rpx 0;
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;

  .category-icon {
    width: 80rpx;
    height: 80rpx;
    margin-bottom: 10rpx;
  }

  .category-name {
    font-size: 24rpx;
    color: #333;
  }
}

.course-list {
  .course-card {
    display: flex;
    margin-bottom: 20rpx;
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
    box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.1);

    .course-image {
      width: 200rpx;
      height: 200rpx;
    }

    .course-info {
      flex: 1;
      padding: 20rpx;

      .course-title {
        font-size: 30rpx;
        color: #333;
        margin-bottom: 10rpx;
      }

      .course-desc {
        font-size: 26rpx;
        color: #999;
        margin-bottom: 20rpx;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .course-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .course-level {
          font-size: 22rpx;
          color: #007aff;
          background-color: rgba(0, 122, 255, 0.1);
          padding: 4rpx 12rpx;
          border-radius: 8rpx;
        }

        .course-duration {
          font-size: 22rpx;
          color: #999;
        }
      }
    }
  }
}
</style>
