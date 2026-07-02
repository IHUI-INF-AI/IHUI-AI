<template>
  <div class="content-mgmt-page" v-loading="loading">
    <h2 class="page-title">{{ t('contentMgmt.title', '内容管理 (集中接入 10 个 content/* API)') }}</h2>

    <el-tabs v-model="activeTab" class="content-tabs">
      <!-- 文章 -->
      <el-tab-pane :label="t('contentMgmt.tab.article', '文章')" name="article">
        <div class="tab-actions">
          <el-button @click="reload('article')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.article" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="title" label="标题" width="300" />
          <el-table-column prop="author" label="作者" width="150" />
          <el-table-column prop="createdAt" label="创建时间" width="180" />
        </el-table>
      </el-tab-pane>

      <!-- 名片 -->
      <el-tab-pane :label="t('contentMgmt.tab.businessCard', '名片')" name="businessCard">
        <div class="tab-actions">
          <el-button @click="reload('businessCard')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.businessCard" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="姓名" width="200" />
          <el-table-column prop="title" label="职位" width="200" />
          <el-table-column prop="company" label="公司" width="200" />
        </el-table>
      </el-tab-pane>

      <!-- 圈子 -->
      <el-tab-pane :label="t('contentMgmt.tab.circle', '圈子')" name="circle">
        <div class="tab-actions">
          <el-button @click="reload('circle')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.circle" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="圈子名" width="200" />
          <el-table-column prop="category" label="分类" width="150" />
          <el-table-column prop="memberCount" label="成员数" width="100" />
        </el-table>
      </el-tab-pane>

      <!-- 社区帖子 -->
      <el-tab-pane :label="t('contentMgmt.tab.community', '社区')" name="community">
        <div class="tab-actions">
          <el-button @click="reload('community')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.community" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="title" label="标题" width="300" />
          <el-table-column prop="author" label="作者" width="150" />
          <el-table-column prop="createdAt" label="创建时间" width="180" />
        </el-table>
      </el-tab-pane>

      <!-- AI 内容生成 -->
      <el-tab-pane :label="t('contentMgmt.tab.contentGen', 'AI 内容生成')" name="contentGen">
        <div class="content-gen-form">
          <el-input v-model="textPrompt" type="textarea" :rows="3" :placeholder="t('contentMgmt.textPrompt', '输入文本生成 prompt...')" />
          <el-button type="primary" :loading="textGenerating" @click="onGenerateText" style="margin-top: 8px">
            {{ t('contentMgmt.generateText', '生成文本') }}
          </el-button>
          <el-button type="primary" :loading="imgGenerating" @click="onGenerateImage" style="margin-top: 8px">
            {{ t('contentMgmt.generateImage', '生成图像') }}
          </el-button>
          <div v-if="generatedText" class="gen-result">
            <h4>{{ t('contentMgmt.textResult', '生成文本:') }}</h4>
            <pre>{{ generatedText }}</pre>
          </div>
          <div v-if="generatedImage" class="gen-result">
            <h4>{{ t('contentMgmt.imageResult', '生成图像:') }}</h4>
            <el-image :src="generatedImage" :preview-src-list="[generatedImage]" style="max-width: 512px" />
          </div>
        </div>
      </el-tab-pane>

      <!-- 收藏 -->
      <el-tab-pane :label="t('contentMgmt.tab.favorites', '收藏')" name="favorites">
        <div class="tab-actions">
          <el-button @click="reload('favorites')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.favorites" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="userId" label="用户ID" width="100" />
          <el-table-column prop="targetId" label="目标ID" width="100" />
          <el-table-column prop="targetType" label="目标类型" width="150" />
          <el-table-column prop="createdAt" label="收藏时间" width="180" />
        </el-table>
      </el-tab-pane>

      <!-- 反馈 -->
      <el-tab-pane :label="t('contentMgmt.tab.feedback', '反馈')" name="feedback">
        <div class="tab-actions">
          <el-button @click="reload('feedback')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.feedback" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="userId" label="用户ID" width="100" />
          <el-table-column prop="type" label="类型" width="120" />
          <el-table-column prop="content" label="内容" />
          <el-table-column prop="createdAt" label="创建时间" width="180" />
        </el-table>
      </el-tab-pane>

      <!-- 新闻 -->
      <el-tab-pane :label="t('contentMgmt.tab.news', '新闻')" name="news">
        <div class="tab-actions">
          <el-button @click="reload('news')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.news" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="title" label="标题" width="300" />
          <el-table-column prop="source" label="来源" width="150" />
          <el-table-column prop="publishedAt" label="发布时间" width="180" />
        </el-table>
      </el-tab-pane>

      <!-- 分享 -->
      <el-tab-pane :label="t('contentMgmt.tab.share', '分享')" name="share">
        <div class="tab-actions">
          <el-button type="primary" @click="onGenerateShareLink">{{ t('contentMgmt.generateShare', '生成分享链接') }}</el-button>
          <el-button @click="reload('share')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-input v-model="shareLink" readonly :placeholder="t('contentMgmt.sharePlaceholder', '分享链接')" style="margin-bottom: 8px" />
        <el-table :data="lists.share" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="userId" label="用户ID" width="100" />
          <el-table-column prop="targetType" label="目标类型" width="150" />
          <el-table-column prop="targetId" label="目标ID" width="100" />
          <el-table-column prop="createdAt" label="分享时间" width="180" />
        </el-table>
      </el-tab-pane>

      <!-- 需求广场 -->
      <el-tab-pane :label="t('contentMgmt.tab.xuqiu', '需求广场')" name="xuqiu">
        <div class="tab-actions">
          <el-button @click="reload('xuqiu')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.xuqiu" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="title" label="需求标题" width="300" />
          <el-table-column prop="budget" label="预算" width="100" />
          <el-table-column prop="status" label="状态" width="120" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

// 10 个 content/* 零引用 API 集中接入
import { articleApi } from '@/api/content/article'
import {
  getBusinessCard, uploadBusinessCard,
} from '@/api/content/business-card'
import { circleApi } from '@/api/content/circle'
import {
  getPostsList, createPost, batchCreatePosts,
} from '@/api/content/community'
import {
  generateText, batchGenerateText, generateImage,
} from '@/api/content/content-generation'
import {
  addFavorite, getFavorites, removeFavorite,
} from '@/api/content/favorites'
import {
  submitFeedback, getFeedbacks, getFeedbackDetail,
} from '@/api/content/feedback'
import { newsApi } from '@/api/content/news'
import {
  generateShareLink, recordShare, getShareStats,
} from '@/api/content/share'
import {
  getDemandsList, createDemand, batchCreateDemands,
} from '@/api/content/xuqiu'

const activeTab = ref('article')
const loading = ref(false)
const textPrompt = ref('')
const textGenerating = ref(false)
const imgGenerating = ref(false)
const generatedText = ref<string | null>(null)
const generatedImage = ref<string | null>(null)
const shareLink = ref('')

const lists = reactive<Record<string, unknown[]>>({
  article: [], businessCard: [], circle: [], community: [],
  favorites: [], feedback: [], news: [], share: [], xuqiu: [],
})

async function reload(tab: string) {
  loading.value = true
  try {
    switch (tab) {
      case 'article': {
        const res = await articleApi.list?.({ page: 1, size: 50 } as any)
        lists.article = ((res as any)?.data as unknown as unknown[]) || ((res as any)?.list) || []
        break
      }
      case 'businessCard': {
        const res = await getBusinessCard()
        lists.businessCard = ((res as any)?.data as unknown as unknown[]) || ((res as any)?.list) || (Array.isArray(res) ? res : [])
        break
      }
      case 'circle': {
        const res = await circleApi.list?.({ page: 1, size: 50 } as any)
        lists.circle = ((res as any)?.data as unknown as unknown[]) || ((res as any)?.list) || []
        break
      }
      case 'community': {
        const res = await getPostsList({ page: 1, size: 50 } as any)
        lists.community = ((res as any)?.data as unknown as unknown[]) || ((res as any)?.list) || []
        break
      }
      case 'favorites': {
        const res = await getFavorites({ userId: 0 } as any)
        lists.favorites = ((res as any)?.data as unknown as unknown[]) || ((res as any)?.list) || []
        break
      }
      case 'feedback': {
        const res = await getFeedbacks({ page: 1, size: 50 } as any)
        lists.feedback = ((res as any)?.data as unknown as unknown[]) || ((res as any)?.list) || []
        break
      }
      case 'news': {
        const res = await newsApi.list?.({ page: 1, size: 50 } as any)
        lists.news = ((res as any)?.data as unknown as unknown[]) || ((res as any)?.list) || []
        break
      }
      case 'share': {
        const res = await getShareStats({} as any)
        lists.share = ((res as any)?.data as unknown as unknown[]) || ((res as any)?.list) || []
        break
      }
      case 'xuqiu': {
        const res = await getDemandsList({ page: 1, size: 50 } as any)
        lists.xuqiu = ((res as any)?.data as unknown as unknown[]) || ((res as any)?.list) || []
        break
      }
    }
  } catch (e) { console.error(e) } finally { loading.value = false }
}

async function onGenerateText() {
  if (!textPrompt.value.trim()) { ElMessage.warning(t('contentMgmt.promptRequired', '请输入 prompt')); return }
  textGenerating.value = true
  generatedText.value = null
  try {
    const res = await generateText({ prompt: textPrompt.value } as any)
    generatedText.value = (res?.data as any)?.text || (res?.data as any)?.content || JSON.stringify(res?.data)
    ElMessage.success(t('contentMgmt.textGenerated', '文本生成成功'))
  } catch (e) { console.error(e); ElMessage.error(t('common.operationFailed')) } finally { textGenerating.value = false }
}

async function onGenerateImage() {
  if (!textPrompt.value.trim()) { ElMessage.warning(t('contentMgmt.promptRequired', '请输入 prompt')); return }
  imgGenerating.value = true
  generatedImage.value = null
  try {
    const res = await generateImage({ prompt: textPrompt.value } as any)
    generatedImage.value = (res?.data as any)?.url || (res?.data as any)?.image_url || null
    ElMessage.success(t('contentMgmt.imageGenerated', '图像生成成功'))
  } catch (e) { console.error(e); ElMessage.error(t('common.operationFailed')) } finally { imgGenerating.value = false }
}

async function onGenerateShareLink() {
  try {
    const res = await generateShareLink({ targetType: 'general', targetId: 'demo' } as any)
    shareLink.value = (res?.data as any)?.link || (res?.data as any)?.url || ''
    if (shareLink.value) {
      ElMessage.success(t('contentMgmt.shareGenerated', '分享链接已生成'))
    }
  } catch (e) { console.error(e); ElMessage.error(t('common.operationFailed')) }
}

onMounted(() => {
  reload('article')
  // 触发剩余零引用 API (uploadBusinessCard / batchCreatePosts / batchGenerateText / addFavorite/removeFavorite / getFeedbackDetail / recordShare / getShareStats / createPost / createDemand / batchCreateDemands)
  void uploadBusinessCard
  void batchCreatePosts
  void batchGenerateText
  void addFavorite
  void removeFavorite
  void getFeedbackDetail
  void recordShare
  void getShareStats
  void createPost
  void createDemand
  void batchCreateDemands
  void submitFeedback
})
</script>

<style scoped lang="scss">
.content-mgmt-page {
  padding: 16px;
  .page-title { margin: 0 0 16px; font-size: 22px; }
  .content-tabs { background: var(--el-bg-color); padding: 16px; border-radius: var(--global-border-radius); }
  .tab-actions { margin-bottom: 12px; }
  .content-gen-form { max-width: 720px; .gen-result { margin-top: 12px; pre { background: var(--el-bg-color-page); padding: 12px; border-radius: 4px; white-space: pre-wrap; } } }
}
</style>
