<template>
  <div class="creation-card"
    :class="[`creation-card--${creation.type}`, { 'is-liked': creation.isLiked, 'is-favorited': creation.isFavorited }]"
    @click="handleCardClick">
    <!-- 封面区域 -->
    <div class="creation-card__cover">
      <!-- 图片类型 -->
      <img v-if="creation.type === 'image'" :src="creation.coverUrl" :alt="creation.title" class="cover-image"
        loading="lazy" @error="handleImageError" />

      <!-- 视频类型 -->
      <div v-else-if="creation.type === 'video'" class="cover-video">
        <img :src="creation.coverUrl" :alt="creation.title" class="cover-image" loading="lazy"
          @error="handleImageError" />
        <div class="video-play-overlay">
          <el-icon class="play-icon">
            <VideoPlay />
          </el-icon>
        </div>
      </div>

      <!-- 音频/音乐类型 -->
      <div v-else-if="creation.type === 'audio' || creation.type === 'music'" class="cover-audio">
        <img :src="creation.coverUrl" :alt="creation.title" class="cover-image" loading="lazy"
          @error="handleImageError" />
        <div class="audio-overlay">
          <el-icon class="audio-icon">
            <Headphones />
          </el-icon>
          <div class="audio-wave">
            <span v-for="i in 5" :key="i" class="wave-bar" :style="{ animationDelay: `${i * 0.1}s` }"></span>
          </div>
        </div>
      </div>

      <!-- 文章类型 -->
      <div v-else-if="creation.type === 'article'" class="cover-article">
        <img :src="creation.coverUrl" :alt="creation.title" class="cover-image" loading="lazy"
          @error="handleImageError" />
        <div class="article-overlay">
          <el-icon class="article-icon">
            <Document />
          </el-icon>
        </div>
      </div>

      <!-- 代码类型 -->
      <div v-else-if="creation.type === 'code'" class="cover-code">
        <div class="code-preview">
          <div class="code-header">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </div>
          <pre class="code-content">{{ truncatedCode }}</pre>
        </div>
      </div>

      <!-- 默认封面 -->
      <img v-else :src="creation.coverUrl" :alt="creation.title" class="cover-image" loading="lazy"
        @error="handleImageError" />

      <!-- AI来源标签（仅文本、单行） -->
      <div class="ai-source-badge" :class="`ai-source-badge--${creation.aiSource}`">
        <span class="ai-source-badge__text">{{ getAISourceLabel(creation.aiSource) }}</span>
      </div>

      <!-- 类型标签 -->
      <div class="type-badge">
        <component :is="getTypeIcon(creation.type)" class="type-icon" />
      </div>

      <!-- 外部来源标记 -->
      <div v-if="creation.isExternal" class="external-badge">
        <el-icon>
          <Link />
        </el-icon>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="creation-card__content">
      <h3 class="creation-title">{{ creation.title }}</h3>
      <p v-if="showDescription" class="creation-desc">{{ truncatedDescription }}</p>

      <!-- 标签 -->
      <div v-if="creation.tags?.length && showTags" class="creation-tags">
        <span v-for="tag in displayTags" :key="tag" class="tag">{{ tag }}</span>
      </div>
    </div>

    <!-- 底部信息 -->
    <div class="creation-card__footer">
      <!-- 创作者信息 -->
      <div class="creator-info" @click.stop="handleCreatorClick">
        <el-avatar :size="24" :src="creation.creator.avatar">
          {{ creation.creator.nickname?.[0] }}
        </el-avatar>
        <span class="creator-name">
          {{ creation.creator.nickname }}
          <el-icon v-if="creation.creator.isVerified" class="verified-icon">
            <CircleCheck />
          </el-icon>
        </span>
      </div>

      <!-- 互动数据：点赞 | 收藏 | 评论 -->
      <div class="interaction-stats">
        <span
          class="stat-item stat-item--like"
          :class="{ 'is-active': creation.isLiked }"
          title="点赞"
          @click.stop="handleLike"
        >
          <el-icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          </el-icon>
          <span>{{ formatNumber(creation.likesCount) }}</span>
        </span>
        <span
          class="stat-item stat-item--favorite"
          :class="{ 'is-active': creation.isFavorited }"
          title="收藏"
          @click.stop="handleFavorite"
        >
          <el-icon><Star /></el-icon>
          <span>{{ formatNumber(creation.favoritesCount) }}</span>
        </span>
        <span
          class="stat-item stat-item--view"
          title="浏览"
        >
          <el-icon><Eye /></el-icon>
          <span>{{ formatNumber(creation.viewsCount || 0) }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  VideoPlay, Headphones, Document, Star,
  CircleCheck, Link, Image, FileText, Code, Music, Box, Eye
} from '@/lib/lucide-fallback'
import type { AICreation, ContentType, AISource } from '@/api/ai-community'
import { formatNumber } from '@/utils/format'

interface Props {
  creation: AICreation
  showDescription?: boolean
  showTags?: boolean
  maxTags?: number
}

const props = withDefaults(defineProps<Props>(), {
  showDescription: true,
  showTags: true,
  maxTags: 3,
})

const emit = defineEmits<{
  (e: 'click', creation: AICreation): void
  (e: 'like', creation: AICreation): void
  (e: 'favorite', creation: AICreation): void
  (e: 'comment', creation: AICreation): void
  (e: 'creator-click', creatorId: string): void
}>()

// 截断描述
const truncatedDescription = computed(() => {
  const desc = props.creation.description || ''
  return desc.length > 80 ? desc.slice(0, 80) + '...' : desc
})

// 截断代码
const truncatedCode = computed(() => {
  const code = props.creation.description || '// No code preview'
  return code.length > 200 ? code.slice(0, 200) + '\n...' : code
})

// 显示的标签
const displayTags = computed(() => {
  return props.creation.tags?.slice(0, props.maxTags) || []
})

// 获取AI来源图标（预留）
const _getAISourceIcon = (source: AISource) => {
  const iconMap: Record<AISource, typeof Image> = {
    'midjourney': Image,
    'stable-diffusion': Image,
    'dall-e': Image,
    'flux': Image,
    'sora': VideoPlay,
    'runway': VideoPlay,
    'pika': VideoPlay,
    'kling': VideoPlay,
    'suno': Music,
    'udio': Music,
    'elevenlabs': Headphones,
    'gpt': FileText,
    'claude': FileText,
    'gemini': FileText,
    'qwen': FileText,
    'doubao': FileText,
    'cursor': Code,
    'copilot': Code,
    'codegeex': Code,
    'ihui-ai': Box,
    'other': Box,
  }
  return iconMap[source] || Box
}

// 获取AI来源标签
const getAISourceLabel = (source: AISource) => {
  const labelMap: Record<AISource, string> = {
    'midjourney': 'Midjourney',
    'stable-diffusion': 'SD',
    'dall-e': 'DALL-E',
    'flux': 'Flux',
    'sora': 'Sora',
    'runway': 'Runway',
    'pika': 'Pika',
    'kling': 'Kling',
    'suno': 'Suno',
    'udio': 'Udio',
    'elevenlabs': 'ElevenLabs',
    'gpt': 'GPT',
    'claude': 'Claude',
    'gemini': 'Gemini',
    'qwen': 'Qwen',
    'doubao': '豆包',
    'cursor': 'Cursor',
    'copilot': 'Copilot',
    'codegeex': 'CodeGeeX',
    'ihui-ai': '智汇AI',
    'other': 'AI',
  }
  return labelMap[source] || source
}

// 获取类型图标
const getTypeIcon = (type: ContentType) => {
  const iconMap: Record<ContentType, typeof Image> = {
    'image': Image,
    'video': VideoPlay,
    'audio': Headphones,
    'music': Music,
    'article': Document,
    'code': Code,
    'model3d': Box,
  }
  return iconMap[type] || Box
}

// 图片加载失败处理
const handleImageError = (e: Event) => {
  const img = e.target as HTMLImageElement
  img.src = '/images/common/placeholder.svg'
}

// 事件处理
const handleCardClick = () => emit('click', props.creation)
const handleLike = () => emit('like', props.creation)
const handleFavorite = () => emit('favorite', props.creation)
const _handleComment = () => emit('comment', props.creation)
const handleCreatorClick = () => emit('creator-click', props.creation.creator.id)
</script>

<style scoped lang="scss">
// 设计令牌 - 工业风科技感
$bg-primary: var(--el-bg-color-page);
$bg-secondary: var(--el-fill-color-darker);
$bg-tertiary: var(--el-fill-color-dark);
$border-subtle: var(--border-unified-color);
$border-medium: var(--border-unified-color-hover);
$text-primary: var(--el-text-color-primary);
$text-secondary: var(--el-text-color-secondary);
$text-muted: var(--el-text-color-placeholder);

.creation-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: hsl(var(--card));
  border-radius: var(--global-border-radius);
  overflow: clip;
  cursor: pointer;
  transition: all 0.15s ease;
  border: var(--unified-border);

  :global(html.dark) & {
    border-color: $border-subtle;
  }

  &:hover {
    border: 2px solid var(--border-unified-color-hover);

    :global(html.dark) & {
      border-color: $border-medium;
    }

    .cover-image {
      transform: scale(1.02);
    }

    .video-play-overlay,
    .audio-overlay,
    .article-overlay {
      opacity: 1;
    }
  }

  // 封面区域 - 固定比例避免代码类卡片撑高
  &__cover {
    position: relative;
    flex-shrink: 0;
    overflow: hidden;
    aspect-ratio: 4 / 3;
    background: var(--el-fill-color-light);
    border-radius: var(--global-border-radius) var(--global-border-radius) 0 0;

    :global(html.dark) & {
      background: $bg-secondary;
    }

    .cover-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.3s ease;
    }

    // 视频封面 - 填满封面区
    :where(.cover-video) {
      position: absolute;
      inset: 0;

      .video-play-overlay {
        position: absolute;
        inset: 0;
        background: var(--color-black-40);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s ease;

        .play-icon {
          font-size: 40px;
          color: var(--el-bg-color-page);
        }
      }
    }

    // 音频封面 - 填满封面区
    :where(.cover-audio) {
      position: absolute;
      inset: 0;

      .audio-overlay {
        position: absolute;
        inset: 0;
        background: var(--color-black-50);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        padding-bottom: 16px;
        opacity: 0.8;
        transition: opacity 0.2s ease;

        .audio-icon {
          font-size: 28px;
          color: var(--el-bg-color-page);
          margin-bottom: 8px;
        }

        :where(.audio-wave) {
          display: flex;
          gap: 2px;
          align-items: flex-end;
          height: 16px;

          .wave-bar {
            width: 3px;
            background: var(--el-bg-color-page);
            border-radius: var(--global-border-radius);
            animation: wave 0.8s ease-in-out infinite;

            @for $i from 1 through 5 {
              &:nth-child(#{$i}) {
                height: #{8 + ($i * 2)}px;
              }
            }
          }
        }
      }
    }

    // 文章封面 - 填满封面区
    :where(.cover-article) {
      position: absolute;
      inset: 0;

      .article-overlay {
        position: absolute;
        inset: 0;
        background: var(--color-black-50);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s ease;

        .article-icon {
          font-size: 40px;
          color: var(--el-bg-color-page);
        }
      }
    }

    // 代码封面 - 固定高度内展示，与图片类统一 4:3 比例
    :where(.cover-code) {
      position: absolute;
      inset: 0;

      :where(.code-preview) {
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        background: $bg-primary;
        padding: 16px;
        overflow: hidden;
        display: flex;
        flex-direction: column;

        :where(.code-header) {
          display: flex;
          gap: 6px;
          margin-bottom: 12px;
          flex-shrink: 0;

          .dot {
            width: 8px;
            height: 8px;
            border-radius: var(--global-border-radius);
            background: $border-medium;

            &.red {
              background: var(--el-text-color-secondary);
            }

            &.yellow {
              background: var(--el-text-color-secondary);
            }

            &.green {
              background: var(--el-text-color-secondary);
            }
          }
        }

        .code-content {
          flex: 1;
          min-height: 0;
          font-family: var(--font-family-mono);
          font-size: 11px;
          line-height: 1.5;
          color: $text-secondary;
          margin: 0;
          white-space: pre-wrap;
          word-break: break-all;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 6;
          -webkit-box-orient: vertical;
        }
      }
    }

    // AI来源标签 - 仅文本、单行、磨砂毛玻璃
    .ai-source-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      display: flex;
      align-items: center;
      max-width: calc(100% - 48px);
      padding: 4px 10px;
      background: var(--color-black-40);
      backdrop-filter: blur(12px) saturate(160%);
      -webkit-backdrop-filter: blur(12px) saturate(160%);
      border-radius: var(--global-border-radius);
      color: $text-primary;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      &__text {
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    // 类型标签 - 磨砂毛玻璃，背景更透、图标缩小，容器尺寸不变
    .type-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 28px;
      height: 28px;
      background: var(--color-white-45);
      backdrop-filter: blur(12px) saturate(160%);
      -webkit-backdrop-filter: blur(12px) saturate(160%);
      border-radius: var(--global-border-radius);
      display: flex;
      align-items: center;
      justify-content: center;

      :global(html.dark) & {
        background: var(--color-gradient-dark-9);
      }

      .type-icon {
        width: 12px;
        height: 12px;
        font-size: 12px;
        color: var(--el-text-color-primary);

        :global(html.dark) & {
          color: $text-primary;
        }
      }
    }

    // 外部来源标记 - 磨砂毛玻璃，背景更透、图标略小
    .external-badge {
      position: absolute;
      bottom: 12px;
      right: 12px;
      width: 22px;
      height: 22px;
      background: var(--color-white-45);
      backdrop-filter: blur(12px) saturate(160%);
      -webkit-backdrop-filter: blur(12px) saturate(160%);
      border-radius: var(--global-border-radius);
      display: flex;
      align-items: center;
      justify-content: center;

      :global(html.dark) & {
        background: var(--color-gradient-dark-9);
      }

      .el-icon {
        font-size: 9px;
        color: var(--el-text-color-secondary);

        :global(html.dark) & {
          color: $text-muted;
        }
      }
    }
  }

  // 内容区域 - 允许收缩，保证等高时底部对齐
  &__content {
    flex: 1;
    min-height: 0;
    padding: 16px 16px 6px;
    display: flex;
    flex-direction: column;

    .creation-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin: 0 0 8px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;

      :global(html.dark) & {
        color: $text-primary;
      }
    }

    .creation-desc {
      font-size: 13px;
      color: var(--el-text-color-secondary);
      line-height: 1.5;
      margin: 0 0 12px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;

      :global(html.dark) & {
        color: $text-muted;
      }
    }

    .creation-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;

      .tag {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        background: var(--el-fill-color);
        color: var(--el-text-color-secondary);
        border-radius: var(--global-border-radius);
        font-size: 11px;
        line-height: 1;

        :global(html.dark) & {
          background: $bg-secondary;
          color: $text-muted;
        }
      }
    }
  }

  // 底部信息 - 不收缩
  :where(&__footer) {
    flex-shrink: 0;
    height: 32px;
    padding: 0 10px;
    margin: 0 16px 10px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-sizing: border-box;

    :global(html.dark) & {
      border-color: $border-subtle;
    }

    .creator-info {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      min-width: 0;

      :deep(.el-avatar) {
        border: var(--unified-border);
        flex-shrink: 0;

        :global(html.dark) & {
          border-color: $border-subtle;
        }
      }

      &:hover .creator-name {
        color: var(--el-text-color-primary);

        :global(html.dark) & {
          color: $text-primary;
        }
      }

      .creator-name {
        font-size: 12px;
        color: var(--el-text-color-secondary);
        display: flex;
        align-items: center;
        gap: 4px;
        transition: color 0.15s ease;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;

        :global(html.dark) & {
          color: $text-muted;
        }

        .verified-icon {
          font-size: 12px;
          color: var(--el-color-success);
          flex-shrink: 0;
        }
      }
    }

    :where(.interaction-stats) {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;

      :where(.stat-item) {
        display: flex;
        align-items: center;
        gap: 2px;
        font-size: 12px;
        cursor: pointer;

        :global(html.dark) & {
          color: $text-muted;
        }

        .el-icon {
          font-size: 14px;
        }

        /* 点赞-心形：未激活描边，激活时实心红 */
        &.stat-item--like .el-icon {
          color: var(--el-text-color-secondary);
        }

        &.stat-item--like .el-icon svg {
          fill: none;
          stroke: currentcolor;
        }

        &.stat-item--like:hover .el-icon,
        &.stat-item--like.is-active .el-icon {
          color: var(--el-color-danger);
        }

        &.stat-item--like.is-active .el-icon svg {
          fill: currentcolor;
          stroke: currentcolor;
        }

        :global(html.dark) &.stat-item--like .el-icon {
          color: $text-muted;
        }

        :global(html.dark) &.stat-item--like:hover .el-icon,
        :global(html.dark) &.stat-item--like.is-active .el-icon {
          color: var(--el-color-danger-light-3);
        }

        /* 收藏-星形：未激活时偏黄/金，激活时高亮 */
        &.stat-item--favorite .el-icon {
          color: var(--el-text-color-secondary);
        }

        &.stat-item--favorite:hover .el-icon,
        &.stat-item--favorite.is-active .el-icon {
          color: var(--el-color-warning);
        }

        :global(html.dark) &.stat-item--favorite .el-icon {
          color: $text-muted;
        }

        :global(html.dark) &.stat-item--favorite:hover .el-icon,
        :global(html.dark) &.stat-item--favorite.is-active .el-icon {
          color: var(--el-color-warning-light-3);
        }

        /* 评论-气泡：保持中性色 */
        &.stat-item--comment .el-icon {
          color: var(--el-text-color-secondary);
        }

        :global(html.dark) &.stat-item--comment .el-icon {
          color: $text-muted;
        }

        &:hover {
          color: var(--el-text-color-primary);

          :global(html.dark) & {
            color: $text-primary;
          }
        }

        &.is-active {
          color: var(--el-text-color-primary);

          :global(html.dark) & {
            color: $text-primary;
          }
        }
      }
    }
  }
}

// 动画
@keyframes wave {
  0%,
  100% {
    transform: scaleY(0.5);
  }

  50% {
    transform: scaleY(1);
  }
}
</style>
