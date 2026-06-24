<template>
  <div class="quick-start">
    <h2 class="section-title">{{ t('apiService.home.quickStart.title') }}</h2>
    <p class="section-subtitle">{{ t('apiService.home.quickStart.subtitle') }}</p>
    
    <el-steps :active="currentStep" finish-status="success" align-center class="steps-container">
      <el-step
        v-for="(step, index) in steps"
        :key="index"
        :title="step.title"
        :description="step.description"
        :icon="step.icon"
      />
    </el-steps>
    
    <div class="steps-content">
      <el-card v-show="currentStep === 0" class="step-card" shadow="never">
        <h3>{{ steps[0].title }}</h3>
        <p>{{ t('apiService.home.quickStart.step1.content') }}</p>
        <el-button type="primary" @click="goToTokens">
          {{ t('apiService.home.quickStart.step1.button') }}
        </el-button>
      </el-card>
      
      <el-card v-show="currentStep === 1" class="step-card" shadow="never">
        <h3>{{ steps[1].title }}</h3>
        <p>{{ t('apiService.home.quickStart.step2.content') }}</p>
        <div class="code-example">
          <pre><code>{{ codeExample }}</code></pre>
          <el-button link size="small" @click="copyCode">
            {{ t('common.copy') }}
          </el-button>
        </div>
      </el-card>
      
      <el-card v-show="currentStep === 2" class="step-card" shadow="never">
        <h3>{{ steps[2].title }}</h3>
        <p>{{ t('apiService.home.quickStart.step3.content') }}</p>
        <el-button type="primary" @click="goToDocs">
          {{ t('apiService.home.quickStart.step3.button') }}
        </el-button>
      </el-card>
    </div>
    
    <div class="actions">
      <el-button v-if="currentStep > 0" @click="prevStep">
        {{ t('common.previous') }}
      </el-button>
      <el-button v-if="currentStep < steps.length - 1" type="primary" @click="nextStep">
        {{ t('common.next') }}
      </el-button>
      <el-button v-else type="success" @click="goToConsole">
        {{ t('apiService.home.quickStart.startUsing') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Key,
  Document,
  Connection,
} from '@element-plus/icons-vue'

defineOptions({
  name: 'QuickStart',
  inheritAttrs: false,
})

const { t } = useI18n()
const router = useRouter()

const currentStep = ref(0)

const steps = [
  {
    title: t('apiService.home.quickStart.step1.title'),
    description: t('apiService.home.quickStart.step1.description'),
    icon: Key,
  },
  {
    title: t('apiService.home.quickStart.step2.title'),
    description: t('apiService.home.quickStart.step2.description'),
    icon: Document,
  },
  {
    title: t('apiService.home.quickStart.step3.title'),
    description: t('apiService.home.quickStart.step3.description'),
    icon: Connection,
  },
]

const codeExample = computed(() => {
  const baseUrl = window.location.origin
  return `curl ${baseUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`
})

const nextStep = () => {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
  }
}

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(codeExample.value)
    ElMessage.success(t('common.copySuccess'))
  } catch {
    ElMessage.error(t('common.copyFailed'))
  }
}

const goToTokens = () => {
  router.push('/key-management')
}

const goToDocs = () => {
  router.push('/open/docs')
}

const goToConsole = () => {
  router.push('/open/apis')
}
</script>

<style scoped lang="scss">
.quick-start {
  padding: 40px 0;
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
  margin: 40px 0;
  
  .section-title {
    font-size: 32px;
    font-weight: 600;
    text-align: center;
    margin-bottom: 12px;
    color: var(--el-text-color-primary);
  }
  
  .section-subtitle {
    font-size: 16px;
    text-align: center;
    color: var(--el-text-color-secondary);
    margin-bottom: 40px;
  }
  
  .steps-container {
    margin: 40px 0;
    padding: 0 20px;
  }
  
  .steps-content {
    min-height: 200px;
    margin: 40px 0;
    padding: 0 20px;
    
    .step-card {
      text-align: center;
      padding: 32px;
      border-radius: var(--global-border-radius);
      
      h3 {
        font-size: 20px;
        font-weight: 600;
        margin-bottom: 16px;
        color: var(--el-text-color-primary);
      }
      
      p {
        font-size: 14px;
        color: var(--el-text-color-secondary);
        line-height: 1.8;
        margin-bottom: 24px;
      }
      
      .code-example {
        background: var(--color-gray-1e1e1e);
        border-radius: var(--global-border-radius);
        padding: 16px;
        margin: 16px 0;
        position: relative;
        
        pre {
          margin: 0;
          overflow-x: auto;
          
          code {
            font-family: var(--font-family-mono);
            font-size: 13px;
            line-height: 1.6;
            color: var(--color-neutral-300);
          }
        }
        
        .el-button {
          position: absolute;
          top: 8px;
          right: 8px;
          color: var(--el-bg-color);
        }
      }
    }
  }
  
  .actions {
    display: flex;
    justify-content: center;
    gap: 16px;
    padding: 0 20px 20px;
  }
}

@media (width <= 768px) {
  .quick-start {
    padding: 24px 0;
    margin: 24px 0;
    
    .section-title {
      font-size: 24px;
    }
    
    .steps-container {
      margin: 24px 0;
      padding: 0 12px;
    }
    
    .steps-content {
      margin: 24px 0;
      padding: 0 12px;
      
      .step-card {
        padding: 20px;
      }
    }
  }
}
</style>
