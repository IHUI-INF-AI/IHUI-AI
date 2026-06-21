<template>
  <view class="container">
    <!-- 导航栏 -->
    <nav-bar title="新闻详情" />

    <!-- 文章头部 -->
    <view class="article-header">
      <view class="title">{{ article.title }}</view>
      <view class="meta">
        <text class="time">{{ article.time }}</text>
        <text class="author">{{ article.author }}</text>
        <text class="views">{{ article.views }}阅读</text>
      </view>
    </view>

    <!-- 文章内容 -->
    <view class="article-content">
      <rich-text :nodes="article.content"></rich-text>
    </view>

    <!-- 相关推荐 -->
    <view class="related-section">
      <view class="section-title">相关推荐</view>
      <view class="related-list">
        <view 
          class="related-item" 
          v-for="(item, index) in article.related" 
          :key="index"
          @click="navigateTo(item.id)"
        >
          <image :src="item.coverUrl" mode="aspectFill" />
          <view class="info">
            <view class="title">{{ item.title }}</view>
            <view class="meta">
              <text class="time">{{ item.time }}</text>
              <text class="views">{{ item.views }}阅读</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view class="bottom-bar">
      <view class="action-item" @click="handleLike">
        <text class="iconfont" :class="isLiked ? 'icon-like-filled' : 'icon-like'"></text>
        <text class="count">{{ article.likes }}</text>
      </view>
      <view class="action-item" @click="handleComment">
        <text class="iconfont icon-comment"></text>
        <text class="count">{{ article.comments }}</text>
      </view>
      <view class="action-item" @click="handleShare">
        <text class="iconfont icon-share"></text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'

// 数据
const isLiked = ref(false)
const article = reactive({
  title: 'AI技术如何改变短视频创作？',
  time: '2024-03-20 10:30',
  author: 'AI智汇社',
  views: 1234,
  likes: 88,
  comments: 32,
  content: `
    <div style="font-size: 28rpx; line-height: 1.6; color: #333;">
      <p>随着人工智能技术的快速发展，短视频创作领域正在经历一场革命性的变革。本文将深入探讨AI技术如何改变短视频创作的方式和效率。</p>
      
      <h3>1. 内容创作效率提升</h3>
      <p>AI技术能够帮助创作者快速生成创意内容，包括文案、标题、标签等。通过自然语言处理技术，AI可以分析热点话题，提供创作建议。</p>
      
      <h3>2. 视频制作智能化</h3>
      <p>AI剪辑工具可以自动识别精彩片段，智能剪辑视频。同时，AI特效生成器可以为视频添加独特的视觉效果。</p>
      
      <h3>3. 个性化推荐</h3>
      <p>AI算法能够根据用户喜好，精准推荐相关内容，提高内容曝光率和用户粘性。</p>
    </div>
  `,
  related: [
    {
      id: 1,
      title: 'AI绘画技术在电商领域的应用',
      time: '2024-03-19',
      views: 856,
      coverUrl: '/static/images/news1.jpg',
    },
    {
      id: 2,
      title: '智能客服如何提升用户体验',
      time: '2024-03-18',
      views: 654,
      coverUrl: '/static/images/news2.jpg',
    },
  ],
})

onLoad((options: any) => {
  if (options.id) {
    loadArticle(options.id)
  }
})

// 加载文章
async function loadArticle(id: string) {
  try {
    // TODO: 调用 API 加载文章详情
  } catch (error) {
    console.error('加载文章失败:', error)
  }
}

// 跳转页面
function navigateTo(id: number) {
  uni.navigateTo({
    url: `/pagesA/news/detail?id=${id}`,
  })
}

// 点赞
function handleLike() {
  isLiked.value = !isLiked.value
  if (isLiked.value) {
    article.likes++
  } else {
    article.likes--
  }
}

// 评论
function handleComment() {
  // TODO: 打开评论区
  uni.showToast({ title: '评论功能开发中', icon: 'none' })
}

// 分享
function handleShare() {
  // 分享功能由小程序原生支持
}
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: #fff;
  padding-bottom: 120rpx;
}

.article-header {
  padding: 30rpx;
  border-bottom: 1rpx solid #f0f0f0;

  .title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333;
    line-height: 1.4;
    margin-bottom: 16rpx;
  }

  .meta {
    display: flex;
    align-items: center;
    font-size: 24rpx;
    color: #999;

    text {
      margin-right: 20rpx;
    }
  }
}

.article-content {
  padding: 30rpx;
  font-size: 28rpx;
  color: #333;
  line-height: 1.8;
}

.related-section {
  padding: 30rpx;
  border-top: 16rpx solid #f5f5f5;

  .section-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    margin-bottom: 24rpx;
  }
}

.related-item {
  display: flex;
  margin-bottom: 24rpx;

  image {
    width: 200rpx;
    height: 150rpx;
    border-radius: 12rpx;
    margin-right: 20rpx;
  }

  .info {
    flex: 1;

    .title {
      font-size: 28rpx;
      color: #333;
      line-height: 1.4;
      margin-bottom: 12rpx;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .meta {
      font-size: 22rpx;
      color: #999;

      text {
        margin-right: 16rpx;
      }
    }
  }
}

.bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100rpx;
  background: #fff;
  border-top: 1rpx solid #f0f0f0;
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 40rpx;
}

.action-item {
  display: flex;
  align-items: center;

  .iconfont {
    font-size: 40rpx;
    color: #666;
    margin-right: 8rpx;
  }

  .count {
    font-size: 24rpx;
    color: #999;
  }
}
</style>
