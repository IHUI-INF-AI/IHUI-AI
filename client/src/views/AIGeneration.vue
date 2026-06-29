<template>
  <div class="ai-generation-page">
    <div class="page-header">
      <h1>{{ t('aiGeneration.title') }}</h1>
      <p>{{ t('aiGeneration.subtitle') }}</p>
    </div>

    <el-tabs v-model="activeTab" class="generation-tabs">
      <el-tab-pane :label="t('aiGeneration.imageGeneration')" name="image">
        <div class="generation-grid">
          <el-card class="generation-card" @click="selectGenerator('qwen-image')">
            <template #header>
              <div class="card-header">
                <el-icon><Picture /></el-icon>
                <span>{{ t('aiGeneration.qwenImage') }}</span>
              </div>
            </template>
            <p>{{ t('aiGeneration.qwenImageDesc') }}</p>
          </el-card>

          <el-card class="generation-card" @click="selectGenerator('qwen-image-i2i')">
            <template #header>
              <div class="card-header">
                <el-icon><PictureFilled /></el-icon>
                <span>{{ t('aiGeneration.qwenImageI2I') }}</span>
              </div>
            </template>
            <p>{{ t('aiGeneration.qwenImageI2IDesc') }}</p>
          </el-card>

          <el-card class="generation-card" @click="selectGenerator('doubao-image')">
            <template #header>
              <div class="card-header">
                <el-icon><PictureFilled /></el-icon>
                <span>{{ t('aiGeneration.doubaoImage') }}</span>
              </div>
            </template>
            <p>{{ t('aiGeneration.doubaoImageDesc') }}</p>
          </el-card>

          <el-card class="generation-card" @click="selectGenerator('jimeng-image')">
            <template #header>
              <div class="card-header">
                <el-icon><PictureFilled /></el-icon>
                <span>{{ t('aiGeneration.jimengImage') }}</span>
              </div>
            </template>
            <p>{{ t('aiGeneration.jimengImageDesc') }}</p>
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('aiGeneration.videoGeneration')" name="video">
        <div class="generation-grid">
          <el-card class="generation-card" @click="selectGenerator('qwen-video')">
            <template #header>
              <div class="card-header">
                <el-icon><VideoCamera /></el-icon>
                <span>{{ t('aiGeneration.qwenVideo') }}</span>
              </div>
            </template>
            <p>{{ t('aiGeneration.qwenVideoDesc') }}</p>
          </el-card>

          <el-card class="generation-card" @click="selectGenerator('kling-video')">
            <template #header>
              <div class="card-header">
                <el-icon><VideoCamera /></el-icon>
                <span>{{ t('aiGeneration.klingVideo') }}</span>
              </div>
            </template>
            <p>{{ t('aiGeneration.klingVideoDesc') }}</p>
          </el-card>

          <el-card class="generation-card" @click="selectGenerator('oneclick-video')">
            <template #header>
              <div class="card-header">
                <el-icon><VideoCamera /></el-icon>
                <span>{{ t('aiGeneration.oneclickVideo') }}</span>
              </div>
            </template>
            <p>{{ t('aiGeneration.oneclickVideoDesc') }}</p>
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('aiGeneration.model3D')" name="3d">
        <div class="generation-grid">
          <el-card class="generation-card" @click="selectGenerator('hunyuan-3d')">
            <template #header>
              <div class="card-header">
                <el-icon><Box /></el-icon>
                <span>{{ t('aiGeneration.hunyuan3D') }}</span>
              </div>
            </template>
            <p>{{ t('aiGeneration.hunyuan3DDesc') }}</p>
          </el-card>
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('aiGeneration.visionAnalysis')" name="vision">
        <div class="generation-grid">
          <el-card class="generation-card" @click="selectGenerator('vision-analysis')">
            <template #header>
              <div class="card-header">
                <el-icon><View /></el-icon>
                <span>{{ t('aiGeneration.visionAnalysisTitle') }}</span>
              </div>
            </template>
            <p>{{ t('aiGeneration.visionAnalysisDesc') }}</p>
          </el-card>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="showGenerator"
      :title="currentGeneratorTitle"
      width="90%"
      top="5vh"
      destroy-on-close
    >
      <component :is="currentGeneratorComponent" v-if="showGenerator" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineAsyncComponent, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Picture, PictureFilled, VideoCamera, Box, View } from '@element-plus/icons-vue'
// 同步导入 LoadingState 作为异步组件的占位符，避免打开生成器弹窗时出现「白条」
import LoadingState from '@/components/common/LoadingState.vue'

const { t } = useI18n()

const activeTab = ref('image')
const showGenerator = ref(false)
const currentGenerator = ref('')

// 所有生成器组件均配置 loadingComponent=LoadingState，避免首次打开弹窗时出现「白条」
// 辅助函数：因 vue@3.5 的 defineAsyncComponent 联合类型重载在传入对象字面量时
// 会被优先匹配到函数签名，固使用 unknown 中转确保走 options 分支。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asyncComponent(loader: () => Promise<unknown>): any {
  return defineAsyncComponent({
    loader,
    loadingComponent: LoadingState,
    delay: 100,
  } as unknown as Parameters<typeof defineAsyncComponent>[0])
}
const generatorComponents: Record<string, Component> = {
  'qwen-image': asyncComponent(() => import('@/components/ai-generation/ImageGenQwen.vue')),
  'qwen-image-i2i': asyncComponent(() => import('@/components/ai-generation/ImageGenQwenI2I.vue')),
  'qwen-image-edit': asyncComponent(() => import('@/components/ai-generation/ImageEditQwen.vue')),
  'doubao-image': asyncComponent(() => import('@/components/ai-generation/ImageGenDoubao.vue')),
  'jimeng-image': asyncComponent(() => import('@/components/ai-generation/ImageGenJimeng.vue')),
  'qwen-video': asyncComponent(() => import('@/components/ai-generation/VideoGenQwen.vue')),
  'kling-video': asyncComponent(() => import('@/components/ai-generation/VideoGenKling.vue')),
  'oneclick-video': asyncComponent(() => import('@/components/ai-generation/VideoGenOneClick.vue')),
  'hunyuan-3d': asyncComponent(() => import('@/components/ai-generation/Model3DGenHunyuan.vue')),
  'vision-analysis': asyncComponent(() => import('@/components/ai-generation/VisionAnalysis.vue')),
}

const generatorTitles: Record<string, string> = {
  'qwen-image': 'aiGeneration.qwenImage',
  'qwen-image-i2i': 'aiGeneration.qwenImageI2I',
  'qwen-image-edit': 'aiGeneration.qwenImageEdit',
  'doubao-image': 'aiGeneration.doubaoImage',
  'jimeng-image': 'aiGeneration.jimengImage',
  'qwen-video': 'aiGeneration.qwenVideo',
  'kling-video': 'aiGeneration.klingVideo',
  'oneclick-video': 'aiGeneration.oneclickVideo',
  'hunyuan-3d': 'aiGeneration.hunyuan3D',
  'vision-analysis': 'aiGeneration.visionAnalysisTitle',
}

const currentGeneratorComponent = computed(() => {
  return generatorComponents[currentGenerator.value] || null
})

const currentGeneratorTitle = computed(() => {
  return t(generatorTitles[currentGenerator.value] || 'aiGeneration.selectGenerator')
})

function selectGenerator(type: string) {
  currentGenerator.value = type
  showGenerator.value = true
}
</script>

<style scoped>
.ai-generation-page {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  text-align: center;
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
}

.page-header p {
  font-size: 16px;
  color: var(--el-text-color-secondary);
}

.generation-tabs {
  margin-bottom: 24px;
}

.generation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  padding: 16px 0;
}

.generation-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: var(--unified-border);
}

.generation-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--global-box-shadow);
  border-color: var(--el-color-primary-light-5);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.card-header .el-icon {
  font-size: 20px;
  color: var(--el-color-primary);
}

.generation-card p {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin: 0;
}

:deep(.el-dialog__body) {
  max-height: 80vh;
  overflow-y: auto;
}
</style>
