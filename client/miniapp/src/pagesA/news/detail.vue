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

    <!-- 评论区弹层 -->
    <view class="comment-mask" v-if="commentVisible" @click="closeComment">
      <view class="comment-popup" @click.stop>
        <view class="comment-header">
          <text class="comment-title">评论 ({{ commentList.length }})</text>
          <text class="comment-close" @click="closeComment">×</text>
        </view>
        <scroll-view class="comment-scroll" scroll-y>
          <view v-if="commentLoading" class="comment-loading">加载中...</view>
          <view v-else-if="commentList.length === 0" class="comment-empty">暂无评论</view>
          <view v-else class="comment-item" v-for="(item, index) in commentList" :key="item.id || index">
            <view class="comment-content">{{ item.content }}</view>
            <view class="comment-time">{{ item.time || '' }}</view>
          </view>
        </scroll-view>
        <view class="comment-input-bar">
          <input
            class="comment-input"
            type="text"
            v-model="commentText"
            placeholder="写评论..."
            placeholder-style="color: #999;"
            confirm-type="send"
            @confirm="submitComment"
          />
          <view class="comment-send" @click="submitComment">发送</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { plantInformation } from '@/service/index.js'
import { getArticleComments } from '@/service/news.js'

// 数据
const isLiked = ref(false)
const articleId = ref('')

// 评论区相关
const commentVisible = ref(false)
const commentLoading = ref(false)
const commentList = ref<any[]>([])
const commentText = ref('')
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
    articleId.value = options.id
    loadArticle(options.id)
  }
})

// 加载文章
async function loadArticle(id: string) {
  try {
    const res = await plantInformation(id)
    if (res && res.data) {
      // plantInformation 返回 data 为数组，取第一条；兼容对象结构
      const d: any = Array.isArray(res.data) ? res.data[0] : res.data
      if (d) {
        article.title = d.title || article.title
        article.time = d.time || d.createTime || d.createdAt || article.time
        article.author = d.author || d.nickname || d.source || article.author
        article.views = d.views || d.viewCount || d.readCount || article.views
        article.likes = d.likes || d.likeCount || d.praiseCount || article.likes
        article.comments = d.comments || d.commentCount || article.comments
        article.content = d.content || d.richText || d.text || article.content
        if (Array.isArray(d.related) && d.related.length > 0) {
          article.related = d.related
        }
      }
    }
  } catch (error) {
    console.error('加载文章失败:', error)
    uni.showToast({ title: '加载文章失败', icon: 'none' })
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
async function handleComment() {
  // 展开评论区并加载评论列表
  commentVisible.value = true
  commentLoading.value = true
  commentList.value = []
  try {
    const res = await getArticleComments(articleId.value, 1, 20)
    if (res && (res.code === 0 || res.code === 200 || res.code === undefined)) {
      commentList.value = Array.isArray(res.data) ? res.data : (res.data && res.data.list) || []
    }
  } catch (error) {
    console.error('加载评论失败:', error)
    uni.showToast({ title: '加载评论失败', icon: 'none' })
  } finally {
    commentLoading.value = false
  }
}

// 关闭评论区
function closeComment() {
  commentVisible.value = false
}

// 提交评论（本地追加，发送接口未提供时仅展示）
function submitComment() {
  const text = commentText.value.trim()
  if (!text) {
    uni.showToast({ title: '请输入评论内容', icon: 'none' })
    return
  }
  commentList.value.unshift({
    id: Date.now(),
    content: text,
    time: '刚刚',
  })
  article.comments++
  commentText.value = ''
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

/* 评论区弹层 */
.comment-mask {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.5);
  z-index: 300;
  display: flex;
  align-items: flex-end;
}

.comment-popup {
  width: 100%;
  max-height: 80vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 30rpx;
  border-bottom: 1rpx solid #f0f0f0;

  .comment-title {
    font-size: 30rpx;
    font-weight: bold;
    color: #333;
  }

  .comment-close {
    font-size: 40rpx;
    color: #999;
  }
}

.comment-scroll {
  flex: 1;
  max-height: 60vh;
  padding: 0 30rpx;
}

.comment-loading,
.comment-empty {
  text-align: center;
  padding: 60rpx 0;
  color: #999;
  font-size: 26rpx;
}

.comment-item {
  padding: 24rpx 0;
  border-bottom: 1rpx solid #f5f5f5;

  .comment-content {
    font-size: 28rpx;
    color: #333;
    line-height: 1.5;
    margin-bottom: 8rpx;
  }

  .comment-time {
    font-size: 22rpx;
    color: #999;
  }
}

.comment-input-bar {
  display: flex;
  align-items: center;
  padding: 16rpx 30rpx;
  border-top: 1rpx solid #f0f0f0;
  background: #fff;

  .comment-input {
    flex: 1;
    height: 64rpx;
    background: #f5f5f5;
    border-radius: 32rpx;
    padding: 0 24rpx;
    font-size: 26rpx;
    color: #333;
  }

  .comment-send {
    margin-left: 20rpx;
    padding: 0 24rpx;
    height: 64rpx;
    line-height: 64rpx;
    background: #007aff;
    color: #fff;
    font-size: 26rpx;
    border-radius: 32rpx;
  }
}
</style>
