<template>
  <div class="product-advantages">
    <h2 class="section-title">{{ t('apiService.home.advantages.title') }}</h2>
    <p class="section-subtitle">{{ t('apiService.home.advantages.subtitle') }}</p>
    
    <el-row :gutter="24" class="advantages-grid">
      <el-col
        v-for="(advantage, index) in advantages"
        :key="advantage.key"
        :xs="24"
        :sm="12"
        :md="8"
        :lg="6"
      >
        <el-card class="advantage-card" shadow="hover" @click="handleCardClick(advantage)">
          <div class="advantage-content">
            <div class="advantage-icon">
              <el-icon :size="48">
                <component :is="advantage.icon" />
              </el-icon>
            </div>
            <h3 class="advantage-title">{{ advantage.title }}</h3>
            <p class="advantage-description">{{ advantage.description }}</p>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { markIcon } from '@/utils/markRaw'
import { useI18n } from 'vue-i18n'
import { logger } from '@/utils/logger'
import {
  Connection,
  Location,
  Lock,
  Lightning,
  Timer,
  Wallet,
} from '@element-plus/icons-vue'

defineOptions({
  name: 'ProductAdvantages',
  inheritAttrs: false,
})

const { t } = useI18n()

interface Advantage {
  title: string
  description: string
  icon: string | (() => Promise<{ default: any }>)
  key: string
}

const advantages = computed<Advantage[]>(() => [
  {
    title: t('apiService.home.advantages.noProxy'),
    description: t('apiService.home.advantages.noProxyDesc'),
    icon: markIcon(Location),
    key: 'noProxy',
  },
  {
    title: t('apiService.home.advantages.globalDirect'),
    description: t('apiService.home.advantages.globalDirectDesc'),
    icon: markIcon(Connection),
    key: 'globalDirect',
  },
  {
    title: t('apiService.home.advantages.noBan'),
    description: t('apiService.home.advantages.noBanDesc'),
    icon: markIcon(Lock),
    key: 'noBan',
  },
  {
    title: t('apiService.home.advantages.fastConnection'),
    description: t('apiService.home.advantages.fastConnectionDesc'),
    icon: markIcon(Lightning),
    key: 'fastConnection',
  },
  {
    title: t('apiService.home.advantages.lowLatency'),
    description: t('apiService.home.advantages.lowLatencyDesc'),
    icon: markIcon(Timer),
    key: 'lowLatency',
  },
  {
    title: t('apiService.home.advantages.payAsYouGo'),
    description: t('apiService.home.advantages.payAsYouGoDesc'),
    icon: markIcon(Wallet),
    key: 'payAsYouGo',
  },
])

const handleCardClick = (advantage: Advantage) => {
  // 可以添加点击事件处理，比如跳转到详情页
  logger.info('Clicked advantage card:', advantage.key)
}
</script>

<style scoped lang="scss">
.product-advantages {
  padding: 40px 0;
  
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
  
  .advantages-grid {
    margin-top: 32px;
  }
  
  .advantage-card {
    height: 100%;
    cursor: pointer;
    transition: all 0.3s ease;
    border-radius: var(--global-border-radius);
    
    &:hover {
      transform: translateY(-4px);
      }
    
    .advantage-content {
      text-align: center;
      padding: 8px;
      
      .advantage-icon {
        margin-bottom: 16px;
        color: var(--el-color-primary);
      }
      
      .advantage-title {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--el-text-color-primary);
      }
      
      .advantage-description {
        font-size: 14px;
        color: var(--el-text-color-secondary);
        line-height: 1.6;
        margin: 0;
      }
    }
  }
}

@media (width <= 768px) {
  .product-advantages {
    padding: 24px 0;
    
    .section-title {
      font-size: 24px;
    }
    
    .advantages-grid {
      margin-top: 24px;
    }
  }
}
</style>
