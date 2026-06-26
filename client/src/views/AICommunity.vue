<template>
  <div class="ai-community-page">
    <!-- 顶部Hero区域 - 高科技工业风 -->
    <section class="hero-section">
      <div class="hero-content scroll-reveal">
        <div class="hero-badge">
          <span class="badge-dot"></span>
          <span class="badge-text font-edix">AI Community</span>
          <span class="badge-dot"></span>
        </div>
        <h1 class="hero-title glitch-text" data-text="{{ t('aiCommunity.heroTitle') }}">
          {{ t('aiCommunity.heroTitle') }}
        </h1>
        <p class="hero-subtitle">{{ t('aiCommunity.heroSubtitle') }}</p>

        <!-- 搜索栏：与 Agent 页完全同构同样式，不用 unified-search 类避免全局样式干扰 -->
        <div class="hero-section__search-wrap">
          <el-input v-model="searchKeyword" :placeholder="t('aiCommunity.searchPlaceholder')" clearable
            class="hero-section__search" @keydown.enter="handleSearch">
            <template #prefix>
              <SearchIcon />
            </template>
            <template #append>
              <button
                type="button"
                class="search-bar-append-btn el-button-reset"
                @click="handleSearch"
              >
                {{ t('common.search') }}
              </button>
            </template>
          </el-input>
        </div>

        <!-- 统计数据 -->
        <div class="hero-stats">
          <div class="stat-item scroll-reveal" style="--delay: 0.1s">
            <div class="stat-glow"></div>
            <span class="stat-value counter-text">{{ formatNumber(stats.creations) }}</span>
            <span class="stat-label">{{ t('aiCommunity.stats.creations') }}</span>
            <div class="stat-bar"></div>
          </div>
          <div class="stat-item scroll-reveal" style="--delay: 0.2s">
            <div class="stat-glow"></div>
            <span class="stat-value counter-text">{{ formatNumber(stats.creators) }}</span>
            <span class="stat-label">{{ t('aiCommunity.stats.creators') }}</span>
            <div class="stat-bar"></div>
          </div>
          <div class="stat-item scroll-reveal" style="--delay: 0.3s">
            <div class="stat-glow"></div>
            <span class="stat-value counter-text">{{ formatNumber(stats.likes) }}</span>
            <span class="stat-label">{{ t('aiCommunity.stats.likes') }}</span>
            <div class="stat-bar"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- 主体内容区域 -->
    <section class="main-section">
      <div class="main-container">
        <!-- 左侧主内容 -->
        <div class="content-area">
          <!-- 主标签页切换：创作广场 / 社区动态 -->
          <div class="main-tabs-wrapper glass-card scroll-reveal">
            <div class="main-tabs-header">
              <div class="news-tabs">
                <button
                  class="news-tabs__item"
                  :class="{ 'news-tabs__item--active': activeMainTab === 'creations' }"
                  @click="activeMainTab = 'creations'"
                >
                  {{ t('aiCommunity.tabs.creations') }}
                </button>
                <button
                  class="news-tabs__item"
                  :class="{ 'news-tabs__item--active': activeMainTab === 'posts' }"
                  @click="activeMainTab = 'posts'"
                >
                  {{ t('aiCommunity.tabs.posts') }}
                </button>
              </div>
            </div>
            <div class="main-tabs-content">
              <!-- 创作广场标签页 -->
              <div v-show="activeMainTab === 'creations'" class="tab-pane">
                <!-- 筛选栏 -->
                <div class="filter-bar">
                  <div class="filter-left">
                    <div class="type-filters">
                      <button v-for="filterType in typeFilters" :key="filterType.value" class="filter-btn ripple-btn"
                        :class="{ 'is-active': activeType === filterType.value }"
                        @click="handleTypeChange(filterType.value)">
                        <el-icon>
                          <component :is="filterType.icon" />
                        </el-icon>
                        <span>{{ filterType.label }}</span>
                      </button>
                    </div>
                  </div>

                  <div class="filter-right">
                    <el-dropdown @command="handleSortChange">
                      <el-button class="sort-btn ripple-btn">
                        {{ sortOptions.find((s: { value: string; label: string }) => s.value === activeSort)?.label }}
                        <el-icon class="el-icon--right">
                          <ArrowDown />
                        </el-icon>
                      </el-button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item v-for="option in sortOptions" :key="option.value" :command="option.value"
                            :class="{ 'is-selected': activeSort === option.value }">
                            {{ option.label }}
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>

                    <el-button type="primary" class="publish-btn ripple-btn" @click="showPublishDialog = true">
                      <el-icon>
                        <Plus />
                      </el-icon>
                      {{ t('aiCommunity.actions.publish') }}
                    </el-button>
                  </div>
                </div>

                <!-- 瀑布流内容展示 -->
                <div v-if="!loading && creations.length > 0" class="creations-grid" ref="gridRef">
                  <div v-for="(creation, index) in creations" :key="creation.id"
                    class="creation-card-wrapper scroll-reveal" :style="{ '--delay': `${(Number(index) % 6) * 0.1}s` }">
                    <CreationCard :creation="creation" @click="handleCreationClick" @like="handleLike"
                      @favorite="handleFavorite" @comment="handleComment" @creator-click="handleCreatorClick" />
                  </div>
                </div>

                <!-- 加载状态 -->
                <div v-if="loading" class="loading-state">
                  <div class="skeleton-card glass-card" v-for="n in 6" :key="n">
                    <div class="skeleton-shimmer"></div>
                  </div>
                </div>

                <!-- 空状态 -->
                <div v-if="!loading && creations.length === 0" class="empty-state glass-card">
                  <el-empty :description="t('aiCommunity.empty.title')">
                    <template #image>
                      <div class="empty-icon pulse-glow">
                        <el-icon size="80">
                          <Sparkles />
                        </el-icon>
                      </div>
                    </template>
                    <el-button type="primary" class="ripple-btn" @click="showPublishDialog = true">
                      {{ t('aiCommunity.actions.publish') }}
                    </el-button>
                  </el-empty>
                </div>

                <!-- 加载更多 -->
                <div v-if="hasMore && !loading" class="load-more">
                  <el-button class="ripple-btn" @click="loadMore" :loading="loadingMore">
                    {{ loadingMore ? t('aiCommunity.loading') : t('aiCommunity.loadMore') }}
                  </el-button>
                </div>

                <!-- 无更多内容 -->
                <div v-if="!hasMore && creations.length > 0" class="no-more">
                  <span class="no-more-line"></span>
                  <span class="no-more-text">{{ t('aiCommunity.noMore') }}</span>
                  <span class="no-more-line"></span>
                </div>
              </div>

              <!-- 社区动态标签页 -->
              <div v-show="activeMainTab === 'posts'" class="tab-pane">
                <!-- 发布动态卡片 -->
                <div v-if="isLoggedIn" class="publish-card glass-card scroll-reveal">
                  <div class="publish-content ripple-btn" @click="showPostDialog = true">
                    <el-avatar :src="currentUserAvatar" :size="48" class="user-avatar">
                      <el-icon>
                        <UserFilled />
                      </el-icon>
                    </el-avatar>
                    <span class="publish-placeholder">{{ t('community.postContent') }}</span>
                    <button class="btn-luxe primary">
                      <el-icon>
                        <Edit />
                      </el-icon>
                      <span>{{ t('community.publishPost') }}</span>
                    </button>
                  </div>
                </div>

                <!-- 动态标签页切换 -->
                <div class="posts-tabs-wrapper">
                  <el-tabs v-model="activePostTab" @tab-change="handlePostTabChange" class="posts-tabs">
                    <el-tab-pane :label="t('community.allPosts')" name="all">
                      <!-- 动态列表 -->
                      <div class="posts-list">
                        <div v-if="postsLoading" class="loading-container">
                          <el-skeleton :rows="5" :show-avatar="true" animated />
                        </div>

                        <div v-else-if="posts.length === 0" class="empty-state glass-card">
                          <el-empty :description="t('community.noPosts')" />
                        </div>

                        <div v-else class="posts-grid">
                          <div v-for="(post, idx) in posts" :key="post.id" class="glass-card post-card scroll-reveal"
                            :data-delay="Number(idx) * 80">
                            <div class="post-header">
                              <el-avatar :src="post.userAvatar" :size="48" class="post-avatar">
                                <el-icon>
                                  <UserFilled />
                                </el-icon>
                              </el-avatar>
                              <div class="post-user-info">
                                <div class="username">{{ post.username }}</div>
                                <div class="post-time">
                                  <el-icon class="time-icon">
                                    <Clock />
                                  </el-icon>
                                  {{ formatTime(post.createTime) }}
                                </div>
                              </div>
                            </div>

                            <div class="post-content">
                              <p>{{ post.content }}</p>
                              <div v-if="post.images && post.images.length > 0" class="post-images">
                                <el-image v-for="(img, index) in post.images" :key="index" :src="img"
                                  :preview-src-list="post.images" fit="cover" :lazy="true" loading="lazy"
                                  :alt="`post-image-${index}`" class="post-image" />
                              </div>
                            </div>

                            <div v-if="post.tags && post.tags.length > 0" class="post-tags">
                              <span v-for="tag in post.tags" :key="tag" class="tag-item" @click="handleTagClick(tag)">
                                #{{ tag }}
                              </span>
                            </div>

                            <div class="post-actions">
                              <button class="action-btn ripple-btn" :class="{ active: post.isLiked }"
                                @click="handlePostLike(post)">
                                <el-icon>
                                  <Star />
                                </el-icon>
                                <span>{{ post.likeCount }}</span>
                              </button>
                              <button class="action-btn ripple-btn" @click="handlePostComment(post)">
                                <el-icon>
                                  <ChatDotRound />
                                </el-icon>
                                <span>{{ post.commentCount }}</span>
                              </button>
                              <button class="action-btn ripple-btn" :class="{ active: post.isFavorited }"
                                @click="handlePostFavorite(post)">
                                <el-icon>
                                  <Collection />
                                </el-icon>
                                <span>{{ t('community.favorite') }}</span>
                              </button>
                              <button class="action-btn ripple-btn" @click="handlePostShare(post)">
                                <el-icon>
                                  <Share />
                                </el-icon>
                                <span>{{ post.shareCount }}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- 分页 -->
                      <div v-if="postsPagination.total > 0" class="pagination-container glass-card">
                        <el-pagination v-model:current-page="postsPagination.page"
                          v-model:page-size="postsPagination.pageSize" :total="postsPagination.total"
                          layout="total, prev, pager, next" @current-change="handlePostPageChange" />
                      </div>
                    </el-tab-pane>

                    <el-tab-pane :label="t('community.following')" name="following">
                      <div class="empty-state glass-card">
                        <el-empty :description="t('community.noFollowingPosts')" />
                      </div>
                    </el-tab-pane>

                    <el-tab-pane :label="t('community.recommended')" name="recommended">
                      <div class="empty-state glass-card">
                        <el-empty :description="t('community.noRecommendedPosts')" />
                      </div>
                    </el-tab-pane>
                  </el-tabs>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧边栏 -->
        <aside class="sidebar">
          <!-- 热门创作者 -->
          <div class="sidebar-section glass-card scroll-reveal" style="--delay: 0.1s">
            <h3 class="section-title">
              <span class="title-indicator"></span>
              {{ t('aiCommunity.sidebar.hotCreators') }}
            </h3>
            <div class="creators-list">
              <div v-for="(creator, index) in hotCreators" :key="creator.id" class="creator-item ripple-btn"
                :style="{ '--delay': `${Number(index) * 0.05}s` }" @click="handleCreatorClick(creator.id)">
                <el-avatar :size="40" :src="creator.avatar" class="creator-avatar">
                  {{ creator.nickname?.[0] }}
                </el-avatar>
                <div class="creator-info">
                  <span class="creator-name">
                    {{ creator.nickname }}
                    <el-icon v-if="creator.isVerified" class="verified">
                      <CircleCheck />
                    </el-icon>
                  </span>
                  <span class="creator-followers">
                    {{ formatNumber(creator.followersCount || 0) }} {{ t('aiCommunity.sidebar.followers') }}
                  </span>
                </div>
                <el-button
                  size="small"
                  round
                  class="follow-btn"
                  :class="{ 'is-following': creator.isFollowing }"
                  @click.stop="handleFollow(creator)"
                >
                  {{ creator.isFollowing ? t('aiCommunity.sidebar.following') : t('aiCommunity.sidebar.follow') }}
                </el-button>
              </div>
            </div>
          </div>

          <!-- 热门话题 -->
          <div class="sidebar-section glass-card scroll-reveal" style="--delay: 0.2s">
            <h3 class="section-title">
              <span class="title-indicator"></span>
              {{ t('community.hotTopics') }}
            </h3>
            <div v-if="hotTopicsLoading" class="loading-container">
              <el-skeleton :rows="5" animated />
            </div>
            <div v-else class="topics-list">
              <div v-for="(topic, idx) in hotTopics" :key="topic.id" class="topic-item ripple-btn"
                @click="handleTopicClick(topic)">
                <span class="topic-rank">{{ String(Number(idx) + 1).padStart(2, '0') }}</span>
                <span class="topic-name">#{{ topic.name }}</span>
                <span class="topic-count">{{ topic.postCount }}</span>
              </div>
              <div v-if="hotTopics.length === 0" class="empty-topics">
                {{ t('community.noTopics') }}
              </div>
            </div>
          </div>

          <!-- 热门标签 -->
          <div class="sidebar-section glass-card scroll-reveal" style="--delay: 0.3s">
            <h3 class="section-title">
              <span class="title-indicator"></span>
              {{ t('aiCommunity.sidebar.hotTags') }}
            </h3>
            <div class="hot-tags">
              <el-tag v-for="tag in hotTags" :key="tag" class="hot-tag ripple-btn"
                :class="{ 'is-active': selectedTags.includes(tag) }" @click="toggleTag(tag)">
                {{ tag }}
              </el-tag>
            </div>
          </div>

          <!-- AI工具推荐 -->
          <div class="sidebar-section ai-tools-section glass-card scroll-reveal" style="--delay: 0.4s">
            <h3 class="section-title">
              <span class="title-indicator"></span>
              {{ t('aiCommunity.tools.hotTools') }}
            </h3>
            <div class="ai-tools-list">
              <div class="ai-tool-item ripple-btn" @click="openTool('https://midjourney.com')">
                <div class="tool-icon midjourney-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L3 20h18L12 2z" fill="var(--el-bg-color)"/>
                    <path d="M12 6l6 12H6l6-12z" fill="var(--color-dark-1a1a2e)"/>
                  </svg>
                </div>
                <div class="tool-info">
                  <span class="tool-name">Midjourney</span>
                  <span class="tool-desc">{{ t('aiCommunity.tools.imageGeneration') }}</span>
                </div>
                <div class="tool-arrow">→</div>
              </div>
              <div class="ai-tool-item ripple-btn" @click="openTool('https://suno.com')">
                <div class="tool-icon suno-icon">
                  <img src="https://api.iconify.design/simple-icons/suno.svg?color=%23ffffff" alt="Suno" loading="lazy" />
                </div>
                <div class="tool-info">
                  <span class="tool-name">Suno</span>
                  <span class="tool-desc">{{ t('aiCommunity.tools.musicCreation') }}</span>
                </div>
                <div class="tool-arrow">→</div>
              </div>
              <div class="ai-tool-item ripple-btn" @click="openTool('https://openai.com/sora')">
                <div class="tool-icon openai-icon">
                  <img src="https://api.iconify.design/simple-icons/openai.svg?color=%23ffffff" alt="Sora" />
                </div>
                <div class="tool-info">
                  <span class="tool-name">Sora</span>
                  <span class="tool-desc">{{ t('aiCommunity.tools.videoGeneration') }}</span>
                </div>
                <div class="tool-arrow">→</div>
              </div>
              <div class="ai-tool-item ripple-btn" @click="openTool('https://claude.ai')">
                <div class="tool-icon claude-icon">
                  <img src="https://api.iconify.design/simple-icons/anthropic.svg" alt="Claude" />
                </div>
                <div class="tool-info">
                  <span class="tool-name">Claude</span>
                  <span class="tool-desc">{{ t('aiCommunity.tools.writingAssistant') }}</span>
                </div>
                <div class="tool-arrow">→</div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>

    <!-- 发布创作弹窗 -->
    <PublishDialog v-model="showPublishDialog" :prefill-data="publishPrefillData" @success="handlePublishSuccess" />

    <!-- 发布动态弹窗 -->
    <el-dialog v-model="showPostDialog" :title="t('community.publishPost')" width="600px" class="premium-dialog">
      <el-form ref="postFormRef" :model="postForm" :rules="postRules" label-width="0">
        <el-form-item prop="content">
          <el-input v-model="postForm.content" type="textarea" :rows="6" :placeholder="t('community.postContent')"
            maxlength="2000" show-word-limit />
        </el-form-item>

        <el-form-item>
          <div class="publish-actions-form">
            <button type="button" class="btn-luxe ghost" @click="handleSelectImages">
              <el-icon>
                <Picture />
              </el-icon>
              <span>{{ t('community.addImage') }}</span>
            </button>
            <el-input v-model="postForm.tagsInput" :placeholder="t('community.addTopic')" maxlength="50"
              class="tags-input" />
          </div>
        </el-form-item>

        <el-form-item v-if="postForm.images && postForm.images.length > 0">
          <div class="selected-images">
            <div v-for="(img, index) in postForm.images" :key="index" class="image-preview">
              <el-image :src="img" fit="cover" :lazy="true" :alt="`selected-image-${index}`" />
              <el-button circle size="small" type="danger"
                :aria-label="t('community.removeImage') + ' ' + (Number(index) + 1)"
                :title="t('community.removeImage')" @click="removeImage(index)">
                <el-icon>
                  <Close />
                </el-icon>
              </el-button>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <button class="btn-luxe ghost" @click="showPostDialog = false">{{ t('common.cancel') }}</button>
        <button class="btn-luxe primary" :disabled="postPublishing" @click="handlePublishPost">
          <span v-if="postPublishing">...</span>
          <span v-else>{{ t('community.publish.title') }}</span>
        </button>
      </template>
    </el-dialog>

    <!-- 评论对话框 -->
    <el-dialog v-model="showCommentDialog" :title="t('community.comment')" width="600px" class="premium-dialog">
      <div v-if="selectedPost" class="comment-post glass-card">
        <div class="comment-post-header">
          <el-avatar :src="selectedPost.userAvatar" :size="40" />
          <div>
            <div class="comment-post-username">{{ selectedPost.username }}</div>
            <div class="comment-post-content">{{ selectedPost.content }}</div>
          </div>
        </div>
      </div>

      <el-input v-model="commentContent" type="textarea" :rows="4" :placeholder="t('community.writeComment')"
        maxlength="500" show-word-limit style="margin-top: 16px" />

      <template #footer>
        <button class="btn-luxe ghost" @click="showCommentDialog = false">{{ t('common.cancel') }}</button>
        <button class="btn-luxe primary" :disabled="commenting" @click="handleSubmitComment">
          <span v-if="commenting">...</span>
          <span v-else>{{ t('community.submitComment') }}</span>
        </button>
      </template>
    </el-dialog>

    <!-- 创作详情弹窗 -->
    <el-dialog v-model="showDetailDialog" :title="selectedCreation?.title" width="800px"
      class="detail-dialog industrial-dialog">
      <div v-if="selectedCreation" class="detail-content">
        <div class="detail-preview glass-card">
          <img v-if="selectedCreation.type === 'image'" :src="selectedCreation.contentUrl" alt="作品预览" class="preview-image" loading="lazy" />
          <video v-else-if="selectedCreation.type === 'video'" :src="selectedCreation.contentUrl" controls preload="none"
            class="preview-video" />
          <audio v-else-if="['audio', 'music'].includes(selectedCreation.type)" :src="selectedCreation.contentUrl"
            controls class="preview-audio" />
          <div v-else-if="selectedCreation.type === 'article'" class="preview-article">
            {{ selectedCreation.description }}
          </div>
          <pre v-else-if="selectedCreation.type === 'code'"
            class="preview-code">{{ selectedCreation.description }}</pre>
        </div>

        <div class="detail-meta glass-card">
          <div class="meta-item">
            <span class="meta-label">{{ t('aiCommunity.detail.model') }}</span>
            <span class="meta-value">{{ selectedCreation.aiModelName || selectedCreation.aiSource }}</span>
          </div>
          <div v-if="selectedCreation.prompt" class="meta-item prompt-item">
            <span class="meta-label">{{ t('aiCommunity.detail.prompt') }}</span>
            <div class="meta-value prompt-value">{{ selectedCreation.prompt }}</div>
          </div>
          <div class="meta-item">
            <span class="meta-label">{{ t('aiCommunity.detail.createdAt') }}</span>
            <span class="meta-value">{{ formatDate(selectedCreation.createdAt) }}</span>
          </div>
        </div>

        <div class="detail-actions">
          <el-button :type="selectedCreation.isLiked ? 'primary' : 'default'" class="action-btn ripple-btn"
            @click="handleLike(selectedCreation)">
            <el-icon>
              <Heart />
            </el-icon>
            {{ selectedCreation.likesCount }}
          </el-button>
          <el-button :type="selectedCreation.isFavorited ? 'primary' : 'default'" class="action-btn ripple-btn"
            @click="handleFavorite(selectedCreation)">
            <el-icon>
              <Star />
            </el-icon>
            {{ selectedCreation.favoritesCount }}
          </el-button>
          <el-button class="action-btn ripple-btn" @click="handleShare(selectedCreation)">
            <el-icon>
              <Share2 />
            </el-icon>
            {{ t('aiCommunity.actions.share') }}
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { markIcon } from '@/utils/markRaw'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  Plus, ArrowDown, Sparkles, CircleCheck, Heart, Star, Share2,
  Image, VideoPlay, Headphones, Music, Document, Code, LayoutGrid,
  UserFilled, Edit, Picture, Close, ChatDotRound, Share, Clock,
  Collection
} from '@/lib/lucide-fallback'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useCommunityPublish } from '@/composables/useCommunityPublish'
import CreationCard from '@/components/community/CreationCard.vue'
import PublishDialog from '@/components/community/PublishDialog.vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import type { FormInstance as ElForm } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import {
  getCreations, getHotCreators, getHotTags as getAIHotTags,
  likeCreation, unlikeCreation, favoriteCreation, unfavoriteCreation,
  type AICreation, type ContentType, type Creator,
} from '@/api/ai/ai-community'
import {
  getPostsList, createPost, likePost, unlikePost, favoritePost, unfavoritePost, createComment, getHotTopics,
  type CommunityPost, type Topic,
} from '@/api/content/community'
import { followDemandUser, unfollowDemandUser } from '@/api/content/xuqiu'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { showSuccess, showError, showWarning } = useOperationFeedback()
const authStore = useAuthStore()

// 登录状态
const isLoggedIn = computed(() => !!authStore.user)
const currentUserAvatar = computed(() => {
  const user = authStore.user
  if (user && typeof user === 'object' && 'avatar' in user) {
    return typeof user.avatar === 'string' ? user.avatar : ''
  }
  return ''
})

// ==================== 主标签页 ====================
const activeMainTab = ref<'creations' | 'posts'>('creations')

// ==================== 创作广场状态 ====================
const searchKeyword = ref('')
const activeType = ref<ContentType | 'all'>('all')
const activeSort = ref<'latest' | 'popular' | 'trending'>('latest')
const selectedTags = ref<string[]>([])

const creations = ref<AICreation[]>([])
const hotCreators = ref<Creator[]>([])
const hotTags = ref<string[]>([])

const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(true)
const page = ref(1)
const pageSize = 20

const showPublishDialog = ref(false)
const showDetailDialog = ref(false)
const selectedCreation = ref<AICreation | null>(null)

const { publishPrefillData, clearPrefillData } = useCommunityPublish()

const stats = reactive({
  creations: 125000,
  creators: 8500,
  likes: 2500000,
})

const typeFilters = computed(() => [
  { value: 'all', label: t('aiCommunity.filters.all'), icon: markIcon(LayoutGrid) },
  { value: 'image', label: t('aiCommunity.filters.image'), icon: markIcon(Image) },
  { value: 'video', label: t('aiCommunity.filters.video'), icon: markIcon(VideoPlay) },
  { value: 'music', label: t('aiCommunity.filters.music'), icon: markIcon(Music) },
  { value: 'audio', label: t('aiCommunity.filters.audio'), icon: markIcon(Headphones) },
  { value: 'article', label: t('aiCommunity.filters.article'), icon: markIcon(Document) },
  { value: 'code', label: t('aiCommunity.filters.code'), icon: markIcon(Code) },
])

const sortOptions = computed(() => [
  { value: 'latest', label: t('aiCommunity.sort.latest') },
  { value: 'popular', label: t('aiCommunity.sort.popular') },
  { value: 'trending', label: t('aiCommunity.sort.trending') },
])

// ==================== 社区动态状态 ====================
const posts = ref<CommunityPost[]>([])
const hotTopics = ref<Topic[]>([])
const postsLoading = ref(false)
const hotTopicsLoading = ref(false)
const activePostTab = ref('all')
const selectedTopicId = ref<string | undefined>(undefined)
const showPostDialog = ref(false)
const showCommentDialog = ref(false)
const selectedPost = ref<CommunityPost | null>(null)
const commentContent = ref('')
const postPublishing = ref(false)
const commenting = ref(false)

const postFormRef = ref<ElForm>()
const postForm = reactive({
  content: '',
  images: [] as string[],
  tags: [] as string[],
  tagsInput: '',
})

const postRules = {
  content: [
    { required: true, message: t('community.contentRequired'), trigger: 'blur' },
    { min: 1, max: 2000, message: t('community.contentLength'), trigger: 'blur' },
  ],
}

const postsPagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

// ==================== 创作广场方法 ====================
const loadCreations = async (reset = true) => {
  if (reset) {
    page.value = 1
    creations.value = []
    hasMore.value = true
  }

  loading.value = reset
  loadingMore.value = !reset

  try {
    const res = await getCreations({
      page: page.value,
      pageSize,
      type: activeType.value,
      sort: activeSort.value,
      search: searchKeyword.value || undefined,
      tags: selectedTags.value.length ? selectedTags.value : undefined,
    })

    if (res.success && res.data) {
      if (reset) {
        creations.value = res.data.list
      } else {
        creations.value.push(...res.data.list)
      }
      hasMore.value = creations.value.length < res.data.total
    }
  } catch (_err) {
    showError(t('common.loadFailed'))
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMore = () => {
  page.value++
  loadCreations(false)
}

const loadHotCreatorsData = async () => {
  try {
    const res = await getHotCreators()
    if (res.success && res.data) {
      hotCreators.value = res.data
    }
  } catch {
    // 静默失败
  }
}

const loadHotTagsData = async () => {
  try {
    const res = await getAIHotTags()
    if (res.success && res.data) {
      hotTags.value = res.data
    }
  } catch {
    // 静默失败
  }
}

const handleSearch = () => {
  loadCreations()
}

const handleTypeChange = (type: ContentType | 'all') => {
  activeType.value = type
  loadCreations()
}

const handleSortChange = (sort: string) => {
  activeSort.value = sort as 'latest' | 'popular' | 'trending'
  loadCreations()
}

const toggleTag = (tag: string) => {
  const index = selectedTags.value.indexOf(tag)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tag)
  }
  loadCreations()
}

const handleCreationClick = (creation: AICreation) => {
  selectedCreation.value = creation
  showDetailDialog.value = true
}

const handleLike = async (creation: AICreation) => {
  try {
    if (creation.isLiked) {
      await unlikeCreation(creation.id)
      creation.isLiked = false
      creation.likesCount--
    } else {
      await likeCreation(creation.id)
      creation.isLiked = true
      creation.likesCount++
    }
  } catch {
    showError(t('common.operationFailed'))
  }
}

const handleFavorite = async (creation: AICreation) => {
  try {
    if (creation.isFavorited) {
      await unfavoriteCreation(creation.id)
      creation.isFavorited = false
      creation.favoritesCount--
    } else {
      await favoriteCreation(creation.id)
      creation.isFavorited = true
      creation.favoritesCount++
    }
  } catch {
    showError(t('common.operationFailed'))
  }
}

const handleComment = (creation: AICreation) => {
  selectedCreation.value = creation
  showDetailDialog.value = true
}

// 2026-06-25 修复 ESLint: creatorId 参数未使用, 按规则改为 _creatorId
const handleCreatorClick = (_creatorId: string) => {
  router.push(`/user`).catch(() => {})
}

const handleFollow = async (creator: Creator) => {
  const prevIsFollowing = creator.isFollowing
  try {
    creator.isFollowing = !creator.isFollowing

    const result = creator.isFollowing
      ? await followDemandUser(creator.id)
      : await unfollowDemandUser(creator.id)

    if (result.success) {
      if (creator.isFollowing) {
        creator.followersCount = (creator.followersCount || 0) + 1
        showSuccess(t('aiCommunity.sidebar.followSuccess'))
      } else {
        creator.followersCount = Math.max((creator.followersCount || 0) - 1, 0)
        showSuccess(t('aiCommunity.sidebar.unfollowSuccess'))
      }
    } else {
      creator.isFollowing = prevIsFollowing
      showError(result.message || t('common.operationFailed'))
    }
  } catch (_error) {
    creator.isFollowing = !creator.isFollowing
    showError(t('common.operationFailed'))
  }
}

const handleShare = (creation: AICreation) => {
  const url = `${window.location.origin}/ai-community/${creation.id}`
  navigator.clipboard.writeText(url)
  showSuccess(t('common.copySuccess'))
}

const handlePublishSuccess = () => {
  clearPrefillData()
  loadCreations()
}

// ==================== 社区动态方法 ====================
const loadPosts = async () => {
  postsLoading.value = true
  try {
    const result = await getPostsList({
      page: postsPagination.page,
      pageSize: postsPagination.pageSize,
      sortBy: 'createTime',
      topicId: selectedTopicId.value,
    })

    if (result && result.data) {
      posts.value = result.data.list || []
      postsPagination.total = result.data.pagination?.total || 0
    } else {
      posts.value = []
      postsPagination.total = 0
    }
  } catch (_error) {
    posts.value = []
    postsPagination.total = 0
  } finally {
    postsLoading.value = false
  }
}

const loadHotTopicsData = async () => {
  hotTopicsLoading.value = true
  try {
    const response = await getHotTopics(10)
    if (response.code === 200 || response.success) {
      hotTopics.value = response.data || []
    }
  } catch (_error) {
    // 静默失败
  } finally {
    hotTopicsLoading.value = false
  }
}

const handlePostTabChange = (_tab: string) => {
  postsPagination.page = 1
  loadPosts()
}

const handlePublishPost = async () => {
  if (!postFormRef.value) return
  try {
    await postFormRef.value.validate()
    postPublishing.value = true

    const tags = postForm.tagsInput
      ? postForm.tagsInput.split(/\s+|，|,|、/).filter(t => t.trim())
      : []

    const result = await createPost({
      content: postForm.content,
      images: postForm.images,
      type: (postForm.images?.length ?? 0) > 0 ? 'image' : 'text',
      tags,
    })

    if (result.success) {
      showSuccess(t('community.publishSuccess'))
      showPostDialog.value = false
      postForm.content = ''
      postForm.images = []
      postForm.tagsInput = ''
      loadPosts()
    } else {
      showError(result.message || t('community.publishFailed'))
    }
  } catch (error: any) {
    if (error !== false) {
      showError((error instanceof Error ? error.message : String(error)) || t('community.publishFailed'))
    }
  } finally {
    postPublishing.value = false
  }
}

const handleSelectImages = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = true
  input.onchange = (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader()
        reader.onload = event => {
          if (event.target?.result) {
            postForm.images.push(event.target.result as string)
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }
  input.click()
}

const removeImage = (index: number) => {
  postForm.images.splice(index, 1)
}

const handlePostLike = async (post: CommunityPost) => {
  if (!isLoggedIn.value) {
    showWarning(t('community.loginRequired'))
    return
  }

  const previousLiked = post.isLiked
  const previousCount = post.likeCount

  if (post.isLiked) {
    post.isLiked = false
    post.likeCount = Math.max(0, post.likeCount - 1)
  } else {
    post.isLiked = true
    post.likeCount++
  }

  try {
    if (post.isLiked) {
      await likePost(post.id)
    } else {
      await unlikePost(post.id)
    }
  } catch {
    post.isLiked = previousLiked
    post.likeCount = previousCount
  }
}

const handlePostFavorite = async (post: CommunityPost) => {
  if (!isLoggedIn.value) {
    showWarning(t('community.loginRequired'))
    return
  }

  const previousFavorited = post.isFavorited

  if (post.isFavorited) {
    post.isFavorited = false
  } else {
    post.isFavorited = true
  }

  try {
    if (post.isFavorited) {
      await favoritePost(post.id)
      showSuccess(t('community.favoriteSuccess'))
    } else {
      await unfavoritePost(post.id)
      showSuccess(t('community.unfavoriteSuccess'))
    }
  } catch {
    post.isFavorited = previousFavorited
    showError(t('community.operationFailed'))
  }
}

const handlePostComment = (post: CommunityPost) => {
  if (!isLoggedIn.value) {
    showWarning(t('community.loginRequired'))
    return
  }
  selectedPost.value = post
  showCommentDialog.value = true
  commentContent.value = ''
}

const handleSubmitComment = async () => {
  if (!selectedPost.value) return
  if (!commentContent.value.trim()) {
    showWarning(t('community.commentContentRequired'))
    return
  }

  commenting.value = true
  try {
    const result = await createComment({
      postId: selectedPost.value.id,
      content: commentContent.value,
    })

    if (result.success) {
      showSuccess(t('community.commentSuccess'))
      showCommentDialog.value = false
      commentContent.value = ''
      if (selectedPost.value) {
        selectedPost.value.commentCount++
      }
    } else {
      showError(result.message || t('community.commentFailed'))
    }
  } finally {
    commenting.value = false
  }
}

const handlePostShare = (post: CommunityPost) => {
  const url = `${window.location.origin}/community/posts/${post.id}`
  navigator.clipboard.writeText(url).then(
    () => {
      showSuccess(t('community.linkCopied'))
      post.shareCount++
    },
    () => {
      showError(t('community.copyFailed'))
    }
  )
}

const handleTagClick = (tag: string) => {
  router.push({
    path: '/community/topic',
    query: { name: tag },
  }).catch(() => {})
}

const handleTopicClick = (topic: Topic) => {
  selectedTopicId.value = topic.id
  activePostTab.value = 'topic'
  postsPagination.page = 1
  loadPosts()
}

const openTool = (url: string) => {
  if (!/^https?:\/\//i.test(url)) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

const handlePostPageChange = (page: number) => {
  postsPagination.page = page
  loadPosts()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ==================== 工具函数 ====================
const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const formatTime = (time: string | number | Date | null | undefined): string => {
  if (!time) return '-'
  const date = time instanceof Date ? time : new Date(time)
  if (isNaN(date.getTime())) return '-'
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return t('community.justNow')
  if (minutes < 60) return t('community.minutesAgo', { minutes })
  if (hours < 24) return t('community.hoursAgo', { hours })
  if (days < 7) return t('community.daysAgo', { days })
  return date.toLocaleDateString()
}

// ==================== 监听和初始化 ====================
watch(() => route.query, (query) => {
  if (query.type) {
    activeType.value = query.type as ContentType | 'all'
  }
  if (query.search) {
    searchKeyword.value = query.search as string
  }
  loadCreations()
}, { immediate: false })

watch(() => publishPrefillData.value, (data) => {
  if (data) {
    showPublishDialog.value = true
  }
}, { immediate: true })

onMounted(() => {
  document.title = t('aiCommunity.title') + ' - 智汇AI'
  loadCreations()
  loadHotCreatorsData()
  loadHotTagsData()
  loadPosts()
  loadHotTopicsData()
})
</script>

<style scoped lang="scss">
// ============================================
// 高科技工业风设计系统 - Industrial Tech Design
// 支持明暗主题切换
// ============================================

// 动画时间变量
$transition-fast: 0.15s;
$transition-base: 0.25s;
$transition-slow: 0.4s;
$ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
$ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1);

// ============================================
// CSS 变量定义 - 支持明暗主题
// ============================================

:root {
  --ai-community-bg-void: var(--el-bg-color-page);
  --ai-community-bg-primary: var(--el-fill-color-lighter);
  --ai-community-bg-secondary: var(--el-fill-color-light);
  --ai-community-bg-tertiary: var(--el-fill-color);
  --ai-community-bg-elevated: var(--el-bg-color);
  --ai-community-border-subtle: var(--border-unified-color);
  --ai-community-border-medium: var(--border-unified-color);
  --ai-community-border-strong: var(--border-unified-color);
  --ai-community-text-primary: var(--el-text-color-primary);
  --ai-community-text-secondary: var(--el-text-color-regular);
  --ai-community-text-muted: var(--el-text-color-secondary);
  --ai-community-glass-bg: var(--color-white-40);
  --ai-community-glass-bg-hover: color-mix(in srgb, var(--el-color-primary) 58%, transparent);
  --ai-community-glow-color: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  --ai-community-grid-color: var(--el-fill-color-darker);
  --ai-community-accent: var(--el-color-primary);
  --ai-community-accent-soft: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
  --ai-community-card-shadow: none;
  --ai-community-card-hover-shadow: none;
  --ai-community-btn-primary-bg: var(--el-text-color-primary);
  --ai-community-btn-primary-color: var(--el-color-white);
  --ai-community-btn-primary-hover-bg: var(--el-text-color-regular);
}

:root.dark,
:where(html.dark) {
  --ai-community-bg-void: var(--el-bg-color);
  --ai-community-bg-primary: var(--el-fill-color-darker);
  --ai-community-bg-secondary: var(--el-fill-color-dark);
  --ai-community-bg-tertiary: var(--el-fill-color);
  --ai-community-bg-elevated: var(--el-bg-color-page);
  --ai-community-border-subtle: var(--border-unified-color);
  --ai-community-border-medium: var(--border-unified-color);
  --ai-community-border-strong: var(--border-unified-color);
  --ai-community-text-primary: var(--el-text-color-primary);
  --ai-community-text-secondary: var(--el-text-color-regular);
  --ai-community-text-muted: var(--el-text-color-secondary);
  --ai-community-glass-bg: var(--color-white-8);
  --ai-community-glass-bg-hover: var(--color-white-14);
  --ai-community-glow-color: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
  --ai-community-grid-color: var(--el-fill-color-light);
  --ai-community-accent: var(--el-color-primary-light-3);
  --ai-community-accent-soft: color-mix(in srgb, var(--el-color-primary) 15%, transparent);
  --ai-community-card-shadow: none;
  --ai-community-card-hover-shadow: none;
  --ai-community-btn-primary-bg: var(--el-bg-color);
  --ai-community-btn-primary-color: var(--el-text-color-primary);
  --ai-community-btn-primary-hover-bg: var(--el-fill-color-light);
}

.ai-community-page {
  --bg-void: var(--ai-community-bg-void);
  --bg-primary: var(--ai-community-bg-primary);
  --bg-secondary: var(--ai-community-bg-secondary);
  --bg-tertiary: var(--ai-community-bg-tertiary);
  --bg-elevated: var(--ai-community-bg-elevated);
  --border-subtle: var(--ai-community-border-subtle);
  --border-medium: var(--ai-community-border-medium);
  --border-strong: var(--ai-community-border-strong);
  --text-primary: var(--ai-community-text-primary);
  --text-secondary: var(--ai-community-text-secondary);
  --text-muted: var(--ai-community-text-muted);
  --glass-bg: var(--ai-community-glass-bg);
  --glass-bg-hover: var(--ai-community-glass-bg-hover);
  --glow-color: var(--ai-community-glow-color);
  --grid-color: var(--ai-community-grid-color);
  --card-shadow: var(--ai-community-card-shadow);
  --card-hover-shadow: var(--ai-community-card-hover-shadow);
  --btn-primary-bg: var(--ai-community-btn-primary-bg);
  --btn-primary-color: var(--ai-community-btn-primary-color);
  --btn-primary-hover-bg: var(--ai-community-btn-primary-hover-bg);
  --accent: var(--ai-community-accent);
  --accent-soft: var(--ai-community-accent-soft);
}

// ============================================
// 全局动画关键帧
// ============================================

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulseGlow {

  0%,
  100% {
    opacity: 0.4;
    transform: scale(1);
  }

  50% {
    opacity: 0.7;
    transform: scale(1.05);
  }
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

@keyframes floatOrb {

  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }

  25% {
    transform: translate(50px, -30px) scale(1.1);
  }

  50% {
    transform: translate(20px, 20px) scale(0.95);
  }

  75% {
    transform: translate(-30px, 10px) scale(1.05);
  }
}

@keyframes ripple {
  0% {
    transform: scale(0);
    opacity: 0.5;
  }

  100% {
    transform: scale(4);
    opacity: 0;
  }
}

@keyframes glitch {

  0%,
  90%,
  100% {
    transform: translate(0);
  }

  92% {
    transform: translate(-2px, 1px);
  }

  94% {
    transform: translate(2px, -1px);
  }

  96% {
    transform: translate(-1px, -1px);
  }

  98% {
    transform: translate(1px, 1px);
  }
}

@keyframes barGrow {
  from {
    transform: scaleX(0);
  }

  to {
    transform: scaleX(1);
  }
}

// ============================================
// 基础页面结构
// ============================================

.ai-community-page {
  position: relative;
  min-height: 100vh;
  background: var(--bg-void);
  overflow-x: hidden;
  transition: background-color $transition-base;
}

// ============================================
// 磨砂毛玻璃卡片通用样式
// ============================================

.glass-card {
  background: var(--glass-bg);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  position: relative;
  overflow: hidden;

  &:hover {
    background: var(--glass-bg-hover);
    border-color: var(--border-medium);
  }
}

// ============================================
// 涟漪点击效果
// ============================================

.ripple-btn {
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    top: 50%;
    left: 50%;
    pointer-events: none;
    background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
    transition: none;
  }

  &:active::after {
    animation: ripple 0.6s ease-out;
  }
}

// ============================================
// 滚动动画
// ============================================

.scroll-reveal {
  opacity: 0;
  transform: translateY(30px);
  animation: fadeInUp 0.8s $ease-out-expo forwards;
  animation-delay: var(--delay);
}

// ============================================
// Hero区域 - 高科技工业风
// ============================================

  :where(.hero-section) {
  position: relative;
  padding: 48px 24px 12px;
  overflow: hidden;
  z-index: var(--z-base);

  :where(.hero-content) {
    position: relative;
    max-width: 800px;
    margin: 0 auto;
    text-align: center;
    z-index: calc(var(--z-base) + 1);

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 18px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.18em;
      color: var(--accent);
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      margin-bottom: 16px;
      font-family: var(--font-family-mono);
      background: var(--accent-soft);
      backdrop-filter: blur(20px) saturate(160%);
      -webkit-backdrop-filter: blur(20px) saturate(160%);

      .badge-dot {
        width: 5px;
        height: 5px;
        background: var(--accent);
        border-radius: var(--global-border-radius);
        animation: pulseGlow 2s ease-in-out infinite;
      }
    }

    .hero-title {
      font-size: clamp(40px, 6vw, 72px);
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.08;
      color: var(--text-primary);
      margin: 0 0 10px;
      position: relative;

      &:hover {
        animation: glitch 0.3s ease-in-out;
      }
    }

    .hero-subtitle {
      font-size: 16px;
      font-weight: 400;
      color: var(--text-secondary);
      margin: 0 0 18px;
      line-height: 1.5;
      max-width: 500px;
      margin-left: auto;
      margin-right: auto;
    }

    // 与 Agent 页 agents-square-list__search-wrap / agents-square-list__search 完全一致（同结构、同样式来源）
    .hero-section__search-wrap {
      margin-bottom: 12px;
    }

    :where(.hero-section__search) {
      max-width: 400px;
      margin: 0 auto;

      :deep(.el-input__wrapper) {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
        background-color: var(--el-fill-color-light);
        border: var(--unified-border);
        box-shadow: none;
        min-height: 44px;
      }

      /* append 容器与按钮由 _search-bar-append.scss 统一提供 */
    }

    .hero-stats {
      display: flex;
      justify-content: center;
      gap: 24px;

      .stat-item {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 14px 20px;
        background: var(--glass-bg);
        backdrop-filter: blur(20px) saturate(160%);
        -webkit-backdrop-filter: blur(20px) saturate(160%);
        border: var(--unified-border);
        border-radius: var(--global-border-radius);
        transition: background-color $transition-base $ease-out-expo, border-color $transition-base $ease-out-expo;

        &:hover {
          background: var(--glass-bg-hover);
          border-color: var(--border-medium);

          .stat-glow {
            opacity: 1;
          }

          .stat-bar {
            animation: barGrow 0.6s $ease-out-expo forwards;
          }
        }

        .stat-glow {
          position: absolute;
          inset: -1px;
          background: color-mix(in srgb, var(--el-color-primary) 8%, transparent);
          border-radius: inherit;
          opacity: 0;
          transition: opacity $transition-base;
          pointer-events: none;
        }

        .stat-value {
          font-size: 30px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--text-primary);
          font-family: var(--font-family-edix);
        }

        .stat-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-muted);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-family: var(--font-family-chinese);
        }

        .stat-bar {
          position: absolute;
          bottom: 0;
          left: 20%;
          right: 20%;
          height: 2px;
          background: var(--accent);
          transform: scaleX(0);
          transform-origin: center;
        }
      }
    }
  }
}

// ============================================
// 主体区域
// ============================================

.main-section {
  position: relative;
  padding: 16px 24px;
  z-index: var(--z-base);

  .main-container {
    max-width: 1440px;
    margin: 0 auto;
    display: flex;
    gap: 48px;
    /* 本页该容器不设描边与背景 */
    background: none;
    border: none;
    border-radius: 0;
  }
}

.content-area {
  flex: 1;
  min-width: 0;
}

// ============================================
// 主标签页样式
// ============================================

.main-tabs-wrapper {
  background: var(--glass-bg);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);

  .main-tabs-header {
    display: flex;
    justify-content: center;
    padding: 16px;
    background: var(--bg-secondary);
    border-bottom: var(--unified-border-bottom);
    border-radius: var(--global-border-radius) var(--global-border-radius) 0 0;
  }

  .news-tabs {
    display: inline-flex;
    gap: 4px;
    padding: 4px;
    background: hsl(var(--muted));
    border-radius: var(--global-border-radius);
    --tab-item-hover-bg: hsl(var(--background));
    --tab-item-active-bg: hsl(var(--background));
    --tab-item-active-border: var(--border-unified-color);

    :where(html.dark) & {
      background: hsl(0 0% 12%);
      --tab-item-hover-bg: hsl(0 0% 18%);
      --tab-item-active-bg: hsl(0 0% 18%);
      --tab-item-active-border: hsl(0 0% 25%);
    }

    &__item {
      padding: 10px 24px;
      font-size: 14px;
      font-weight: 500;
      color: var(--el-text-color-secondary);
      background: transparent;
      border: none;
      border-radius: var(--global-border-radius);
      cursor: pointer;
      transition: color 0.2s ease, background-color 0.2s ease, border-color 0.2s ease;
      white-space: nowrap;

      :where(html.dark) & {
        color: hsl(var(--muted-foreground));
      }

      &:hover:not(:where(&--active)) {
        color: var(--el-text-color-primary);
        background: var(--tab-item-hover-bg);

        :where(html.dark) & {
          color: hsl(var(--foreground));
        }
      }

      &--active {
        color: var(--el-text-color-primary);
        background: var(--tab-item-active-bg);
        border: var(--unified-border);

        :where(html.dark) & {
          color: hsl(var(--foreground));
          border-color: var(--tab-item-active-border);
        }
      }
    }
  }

  .main-tabs-content {
    padding: 24px;
  }

  .tab-pane {
    min-height: 400px;
  }
}

// ============================================
// 筛选栏
// ============================================

:where(.filter-bar) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  padding: 16px 24px;
  background: var(--glass-bg);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);

  :where(.filter-left) {
    :where(.type-filters) {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;

      :where(.filter-btn) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 41px;
        min-width: 88px;
        padding: 10px 18px;
        border: var(--unified-border);
        border-radius: var(--global-border-radius);
        background: transparent;
        color: var(--text-secondary);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color $transition-base $ease-out-expo, color $transition-base $ease-out-expo, border-color $transition-base $ease-out-expo;

        .el-icon {
          font-size: 16px;
        }

        &:hover {
          background: var(--glass-bg-hover);
          color: var(--text-primary);
          border-color: var(--border-unified-color);
        }

        &.is-active {
          background: var(--el-fill-color-light);
          color: var(--text-primary);
          border-color: var(--border-unified-color);

          &:hover {
            background: var(--el-fill-color);
            border-color: var(--border-unified-color);
          }
        }
      }
    }
  }

  .filter-right {
    display: flex;
    gap: 12px;
    align-items: center;

    .sort-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 41px;
      height: 41px;
      min-width: 88px;
      padding: 10px 18px;
      border-radius: var(--global-border-radius);
      background: var(--glass-bg);
      border: var(--unified-border);
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
      line-height: 1;
      transition: background-color $transition-base $ease-out-expo, border-color $transition-base $ease-out-expo, color $transition-base $ease-out-expo;

      &:hover {
        background: var(--glass-bg-hover);
        border-color: var(--border-unified-color);
        color: var(--text-primary);
      }
    }

    .publish-btn {
      border-radius: var(--global-border-radius);
      font-size: 13px;
      font-weight: 600;
      padding: 10px 24px;
      height: auto;
      line-height: 1;
      background: var(--btn-primary-bg);
      border: none;
      color: var(--btn-primary-color);
      transition: background-color $transition-base $ease-out-expo;

      &:hover {
        background: var(--btn-primary-hover-bg);
      }
    }
  }
}

// ============================================
// 瀑布流网格
// ============================================

.creations-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  align-items: stretch;

  .creation-card-wrapper {
    display: flex;
    min-height: 0;
    overflow: visible;

    :deep(.creation-card) {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      width: 100%;
      background: hsl(var(--card));
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      overflow: visible;
      transition: border-color $transition-base $ease-out-expo;

      &:hover {
        border-color: var(--border-medium);
      }
    }
  }
}

// ============================================
// 加载状态 - 骨架屏
// ============================================

.loading-state {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;

  .skeleton-card {
    height: 280px;
    position: relative;
    overflow: hidden;

    .skeleton-shimmer {
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg,
          transparent 0%,
          var(--border-subtle) 50%,
          transparent 100%);
      animation: shimmer 1.5s infinite;
    }
  }
}

// ============================================
// 空状态
// ============================================

.empty-state {
  padding: 120px 24px;
  text-align: center;

  .empty-icon {
    color: var(--text-muted);
    margin-bottom: 24px;

    &.pulse-glow {
      animation: pulseGlow 3s ease-in-out infinite;
    }
  }

  :deep(.el-empty__description) {
    color: var(--text-secondary);
    font-size: 15px;
  }

}

// ============================================
// 加载更多
// ============================================

.load-more {
  text-align: center;
  padding: 60px 0;

  :deep(.el-button) {
    border-radius: var(--global-border-radius);
    font-size: 14px;
    font-weight: 500;
    padding: 12px 40px;
    background: var(--glass-bg);
    border-color: var(--border-subtle);
    color: var(--text-secondary);
    transition: background-color $transition-base $ease-out-expo, border-color $transition-base $ease-out-expo, color $transition-base $ease-out-expo;

    &:hover {
      background: var(--glass-bg-hover);
      border-color: var(--border-medium);
      color: var(--text-primary);
    }
  }
}

.no-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 60px 0;
  color: var(--text-muted);
  font-size: 13px;
  letter-spacing: 0.05em;

  .no-more-line {
    width: 60px;
    height: 1px;
    background: var(--border-medium);
  }

  .no-more-text {
    text-transform: uppercase;
  }
}

// ============================================
// 社区动态样式
// ============================================

.posts-tabs-wrapper {
  :deep(.el-tabs__header) {
    margin-bottom: 24px;
  }

  :deep(.el-tabs__nav-wrap::after) {
    display: none;
  }

  :deep(.el-tabs__item) {
    font-weight: 700;
    font-size: 15px;

    &.is-active {
      color: var(--btn-primary-bg);
    }
  }

  :deep(.el-tabs__active-bar) {
    background: var(--btn-primary-bg);
    height: 3px;
    border-radius: var(--global-border-radius);
  }
}

// 发布卡片
.publish-card {
  padding: 24px 28px;
  margin-bottom: 24px;

  .publish-content {
    display: flex;
    align-items: center;
    gap: 16px;
    cursor: pointer;

    .user-avatar {
      flex-shrink: 0;
      border: 2px solid var(--border-subtle);
    }

    .publish-placeholder {
      flex: 1;
      color: var(--text-secondary);
      font-size: 15px;
      font-weight: 500;
    }
  }
}

// 帖子列表
.posts-list {
  .loading-container {
    padding: 60px 0;
  }
}

.posts-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

// 帖子卡片
.post-card {
  padding: 28px;

  :where(.post-header) {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;

    .post-avatar {
      flex-shrink: 0;
      border: 2px solid var(--border-subtle);
    }

    :where(.post-user-info) {
      flex: 1;

      .username {
        font-size: 16px;
        font-weight: 800;
        color: var(--text-primary);
        margin-bottom: 4px;
      }

      :where(.post-time) {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--text-secondary);

        .time-icon {
          font-size: 14px;
        }
      }
    }
  }

  :where(.post-content) {
    margin-bottom: 20px;

    p {
      font-size: 15px;
      color: var(--text-primary);
      line-height: 1.8;
      margin: 0 0 16px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    :where(.post-images) {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;

      .post-image {
        width: 100%;
        height: 180px;
        border-radius: var(--global-border-radius);
        cursor: pointer;
        overflow: hidden;

        &:hover {
          transform: scale(1.02);
        }
      }
    }
  }

  :where(.post-tags) {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 20px;

    .tag-item {
      display: inline-block;
      font-size: 13px;
      font-weight: 700;
      padding: 6px 14px;
      background: var(--color-black-8);
      color: var(--text-primary);
      border-radius: var(--global-border-radius);
      cursor: pointer;
      transition: background-color 0.3s, color 0.3s;

      &:hover {
        background: var(--btn-primary-bg);
        color: var(--el-bg-color);
      }
    }
  }

  :where(.post-actions) {
    display: flex;
    gap: 12px;
    padding-top: 20px;
    border-top: var(--unified-border);

    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      border-radius: var(--global-border-radius);
      background: var(--color-black-5);
      border: none;
      font-size: 13px;
      font-weight: 700;
      color: var(--text-secondary);
      cursor: pointer;
      transition: background-color 0.3s, color 0.3s;

      &:hover {
        background: var(--color-black-12);
        color: var(--text-primary);
      }

      &.active {
        background: var(--color-black-15);
        color: var(--btn-primary-bg);
      }
    }
  }
}

// 分页
.pagination-container {
  margin-top: 28px;
  padding: 20px;
  display: flex;
  justify-content: center;
}

// 热门话题列表
.topics-list {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .topic-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: var(--global-border-radius);
    cursor: pointer;
    transition: background-color 0.3s;

    &:hover {
      background: var(--color-black-8);

      .topic-name {
        color: var(--btn-primary-bg);
      }
    }

    .topic-rank {
      font-family: var(--font-family-mono);
      font-size: 12px;
      font-weight: 900;
      color: var(--btn-primary-bg);
      opacity: 0.5;
    }

    .topic-name {
      flex: 1;
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
      transition: color 0.3s;
    }

    .topic-count {
      font-size: 12px;
      font-weight: 800;
      color: var(--text-secondary);
      background: var(--color-black-8);
      padding: 4px 10px;
      border-radius: var(--global-border-radius);
    }
  }

  .empty-topics {
    text-align: center;
    color: var(--text-secondary);
    padding: 40px 20px;
    font-size: 14px;
  }
}

// ============================================
// 侧边栏 - 工业风玻璃态
// ============================================

:where(.sidebar) {
  width: 300px;
  flex-shrink: 0;

  .sidebar-section {
    padding: 24px;
    margin-bottom: 24px;

    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin: 0 0 20px;

      .title-indicator {
        width: 3px;
        height: 12px;
        background: var(--text-muted);
        border-radius: var(--global-border-radius);
      }
    }
  }

  :where(.creators-list) {
    display: flex;
    flex-direction: column;
    gap: 4px;

    :where(.creator-item) {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      padding: 12px;
      margin: 0 -12px;
      border-radius: var(--global-border-radius);
      transition: background-color $transition-base $ease-out-expo;

      &:hover {
        background: var(--glass-bg-hover);

        .creator-avatar {
          transform: scale(1.05);
          border-color: var(--border-medium);
        }
      }

      .creator-avatar {
        border: 2px solid var(--border-subtle);
        transition: transform $transition-base $ease-out-expo, border-color $transition-base $ease-out-expo;
      }

      :where(.creator-info) {
        flex: 1;
        min-width: 0;

        :where(.creator-name) {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary);

          .verified {
            font-size: 14px;
            color: var(--text-secondary);
          }
        }

        .creator-followers {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
        }
      }

      .follow-btn {
        font-size: 12px;
        padding: 6px 14px;
        border-radius: var(--global-border-radius);
        background: transparent;
        border: var(--unified-border);
        color: var(--text-secondary);
        transition: background-color $transition-fast, border-color $transition-fast, color $transition-fast;

        &:hover {
          background: var(--btn-primary-bg);
          border-color: var(--btn-primary-bg);
          color: var(--btn-primary-color);
        }

        &.is-following {
          background: var(--el-fill-color-light);
          border-color: var(--border-unified-color);
          color: var(--text-primary);

          &:hover {
            background: var(--el-fill-color);
            border-color: var(--border-unified-color);
            color: var(--text-primary);
          }
        }
      }
    }
  }

  :where(.hot-tags) {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;

    :where(.hot-tag) {
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      padding: 8px 14px;
      border-radius: var(--global-border-radius);
      background: var(--glass-bg);
      border: var(--unified-border);
      color: var(--text-secondary);
      transition: background-color $transition-base $ease-out-expo, border-color $transition-base $ease-out-expo, color $transition-base $ease-out-expo;
      box-shadow: none;

      :deep(.el-tag__content) {
        color: inherit;
      }

      &:hover {
        background: var(--glass-bg-hover);
        border-color: var(--border-unified-color);
        color: var(--text-primary);
      }

      &.is-active {
        background: var(--el-fill-color-light);
        color: var(--text-primary);
        border-color: var(--border-unified-color);
      }
    }
  }

  .hot-tags :deep(.el-tag) {
    --el-tag-border-color: var(--border-unified-color);
    --el-tag-bg-color: var(--glass-bg);
    --el-tag-text-color: var(--text-secondary);
    border: var(--unified-border);
    background-color: var(--glass-bg);
    color: var(--text-secondary);
  }

  .hot-tags :deep(.el-tag:hover) {
    border: var(--unified-border);
    background-color: var(--glass-bg-hover);
    color: var(--text-primary);
  }

  .hot-tags :deep(.el-tag.is-active) {
    border: var(--unified-border);
    background-color: var(--el-fill-color-light);
    color: var(--text-primary);
  }

  :where(html.dark) .hot-tags :deep(.el-tag) {
    border: var(--unified-border);
    background-color: var(--glass-bg);
    color: var(--text-secondary);
  }

  :where(html.dark) .hot-tags :deep(.el-tag:hover) {
    border: var(--unified-border);
    background-color: var(--glass-bg-hover);
    color: var(--text-primary);
  }

  :where(html.dark) .hot-tags :deep(.el-tag.is-active) {
    border: var(--unified-border);
    background-color: var(--el-fill-color-light);
    color: var(--text-primary);
  }

  :where(.ai-tools-section) {
    :where(.ai-tools-list) {
      display: flex;
      flex-direction: column;
      gap: 8px;

      :where(.ai-tool-item) {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 16px;
        border-radius: var(--global-border-radius);
        cursor: pointer;
        background: var(--glass-bg);
        border: var(--unified-border);
        transition: background-color $transition-base $ease-out-expo, border-color $transition-base $ease-out-expo, transform $transition-base $ease-out-expo;

        &:hover {
          background: var(--glass-bg-hover);
          border-color: var(--border-medium);
          transform: translateX(4px);

          .tool-arrow {
            opacity: 1;
            transform: translateX(4px);
          }
        }

        :where(.tool-icon) {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--border-subtle);
          border-radius: var(--global-border-radius);
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          font-family: var(--font-family-mono);
          letter-spacing: -0.02em;
          overflow: hidden;
          flex-shrink: 0;

          svg {
            width: 100%;
            height: 100%;
            border-radius: var(--global-border-radius);
          }

          img {
            width: 22px;
            height: 22px;
            object-fit: contain;
          }

          &.midjourney-icon {
            background: var(--el-fill-color-darker);
          }

          &.suno-icon {
            background: var(--el-fill-color-darker);
          }

          &.openai-icon {
            background: var(--el-fill-color-darker);
          }

          &.claude-icon {
            background: var(--el-fill-color-dark);
          }
        }

        :where(.tool-info) {
          flex: 1;

          .tool-name {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: var(--text-primary);
          }

          .tool-desc {
            display: block;
            font-size: 12px;
            color: var(--text-muted);
            margin-top: 2px;
          }
        }

        .tool-arrow {
          font-size: 14px;
          color: var(--text-muted);
          opacity: 0;
          transition: opacity $transition-base $ease-out-expo, transform $transition-base $ease-out-expo;
        }
      }
    }
  }
}

// ============================================
// 对话框样式
// ============================================

.premium-dialog {
  :deep(.el-dialog) {
    border-radius: var(--global-border-radius);
    overflow: hidden;
    background: var(--bg-elevated);
    border: var(--unified-border);
  }

  :deep(.el-dialog__header) {
    padding: 24px 28px 0;

    .el-dialog__title {
      font-weight: 800;
      font-size: 20px;
      color: var(--text-primary);
    }
  }

  :deep(.el-dialog__body) {
    padding: 24px 28px;
  }

  :deep(.el-dialog__footer) {
    padding: 0 28px 24px;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }
}

.btn-luxe {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  padding: 0 24px;
  border-radius: var(--global-border-radius);
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: none;
  white-space: nowrap;

  &.primary {
    background: var(--btn-primary-bg);
    color: var(--el-color-white);

    &:hover {
      background-color: var(--el-fill-color-light);
    }
  }

  &.ghost {
    background: transparent;
    border: var(--unified-border);
    color: var(--text-primary);

    &:hover {
      background: var(--color-black-5);
      border-color: var(--btn-primary-bg);
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
}

:where(html.dark) .btn-luxe {
  &.primary {
    background: var(--el-color-white);
    color: var(--btn-primary-bg);
  }

  &.ghost {
    background: transparent;
    border-color: var(--border-subtle);
    color: var(--el-color-white);

    &:hover {
      background: var(--color-white-10);
    }
  }
}

.publish-actions-form {
  display: flex;
  gap: 16px;
  align-items: center;

  .tags-input {
    flex: 1;
  }
}

.selected-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;

  .image-preview {
    position: relative;
    width: 100%;
    height: 100px;
    border-radius: var(--global-border-radius);
    overflow: hidden;

    :deep(.el-image) {
      width: 100%;
      height: 100%;
    }

    .el-button {
      position: absolute;
      top: 6px;
      right: 6px;
    }
  }
}

.comment-post {
  padding: 20px;
  border-radius: var(--global-border-radius);

  .comment-post-header {
    display: flex;
    gap: 14px;

    .comment-post-username {
      font-weight: 800;
      font-size: 15px;
      color: var(--text-primary);
      margin-bottom: 6px;
    }

    .comment-post-content {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.6;
    }
  }
}

// ============================================
// 详情弹窗 - 工业风
// ============================================

:where(.detail-dialog.industrial-dialog) {
  :deep(.el-dialog) {
    border-radius: var(--global-border-radius);
    background: var(--bg-tertiary);
    border: var(--unified-border);
  }

  :deep(.el-dialog__header) {
    padding: 24px 28px 0;

    .el-dialog__title {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
    }
  }

  :deep(.el-dialog__body) {
    padding: 28px;
  }
}

:where(.detail-content) {
  .detail-preview {
    margin-bottom: 24px;
    padding: 0;
    overflow: hidden;

    .preview-image {
      max-width: 100%;
      border-radius: var(--global-border-radius);
      border: var(--unified-border);
    }

    .preview-video {
      width: 100%;
      border-radius: var(--global-border-radius);
      background: var(--bg-primary);
    }

    .preview-audio {
      width: 100%;
    }

    .preview-article {
      padding: 24px;
      background: var(--glass-bg);
      border-radius: var(--global-border-radius);
      line-height: 1.8;
      font-size: 15px;
      color: var(--text-secondary);
      border: var(--unified-border);
    }

    .preview-code {
      padding: 24px;
      background: var(--bg-primary);
      color: var(--text-secondary);
      border-radius: var(--global-border-radius);
      font-family: var(--font-family-mono);
      font-size: 13px;
      line-height: 1.7;
      overflow-x: auto;
      border: var(--unified-border);
    }
  }

  :where(.detail-meta)
 {
    padding: 24px;
    margin-bottom: 24px;

    :where(.meta-item) {
      display: flex;
      margin-bottom: 18px;

      &:last-child {
        margin-bottom: 0;
      }

      .meta-label {
        width: 90px;
        font-size: 13px;
        font-weight: 500;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .meta-value {
        flex: 1;
        font-size: 14px;
        color: var(--text-primary);
      }

      &.prompt-item {
        flex-direction: column;
        gap: 12px;

        .prompt-value {
          padding: 18px;
          background: var(--glass-bg);
          border: var(--unified-border);
          border-radius: var(--global-border-radius);
          font-size: 13px;
          line-height: 1.7;
          font-family: var(--font-family-mono);
          color: var(--text-secondary);
        }
      }
    }
  }

  :where(.detail-actions) {
    display: flex;
    gap: 12px;

    :where(.action-btn) {
      border-radius: var(--global-border-radius);
      font-size: 13px;
      font-weight: 500;
      background: var(--glass-bg);
      border-color: var(--border-subtle);
      color: var(--text-secondary);
      transition: background-color $transition-base $ease-out-expo, border-color $transition-base $ease-out-expo, color $transition-base $ease-out-expo;

      &:hover {
        background: var(--glass-bg-hover);
        border-color: var(--border-medium);
        color: var(--text-primary);
      }

      &.el-button--primary {
        background: var(--btn-primary-bg);
        border-color: var(--btn-primary-bg);
        color: var(--btn-primary-color);
      }
    }
  }
}

// ============================================
// 响应式设计
// ============================================

@media (width <= 1200px) {
  .main-section .main-container {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;

    .sidebar-section {
      margin-bottom: 0;
    }
  }
}

@media (width <= 768px) {
  .hero-section {
    padding: 40px 20px 28px;

    .hero-content {
      .hero-badge {
        font-size: 12px;
        padding: 6px 14px;
        gap: 8px;
      }

      .hero-title {
        font-size: clamp(32px, 8vw, 48px);
      }

      .hero-section__search {
        :deep(.el-input__wrapper) {
          flex-wrap: wrap;
          height: auto;
          min-height: 44px;
          padding: 8px 12px;
          align-items: center;
        }

        :deep(.el-input-group__append) {
          align-items: center;
        }
      }

      .hero-stats {
        flex-direction: column;
        gap: 8px;

        .stat-item {
          padding: 10px 16px;

          .stat-value {
            font-size: 24px;
          }
        }
      }
    }
  }

  .main-section {
    padding: 40px 16px;
  }

  .filter-bar {
    flex-direction: column;
    gap: 16px;
    padding: 16px;

    .filter-left .type-filters {
      width: 100%;
      overflow-x: auto;
      padding-bottom: 8px;
      flex-wrap: nowrap;

      &::-webkit-scrollbar {
        height: 3px;
      }

      &::-webkit-scrollbar-thumb {
        background: var(--border-medium);
        border-radius: var(--global-border-radius);
      }

      .filter-btn {
        flex-shrink: 0;
      }
    }

    .filter-right {
      width: 100%;
      justify-content: space-between;
    }
  }

  .creations-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .sidebar {
    grid-template-columns: 1fr;
  }

  .post-card {
    padding: 20px;

    .post-actions {
      flex-wrap: wrap;

      .action-btn {
        flex: 1;
        min-width: 80px;
        justify-content: center;
      }
    }
  }

  .publish-actions-form {
    flex-direction: column;

    .tags-input {
      width: 100%;
    }
  }
}

// ============================================
// Element Plus 组件覆盖
// ============================================

:deep(.el-dropdown-menu) {
  background: var(--bg-elevated);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);

  .el-dropdown-menu__item {
    color: var(--text-secondary);
    transition: background-color $transition-fast, color $transition-fast;

    &:hover {
      background: var(--glass-bg-hover);
      color: var(--text-primary);
    }

    &.is-selected {
      color: var(--text-primary);
      font-weight: 500;
    }
  }
}

:deep(.el-tabs__content) {
  overflow: visible;
}
</style>
