<template>
  <div class="feature-center-header">
    <div class="header-left">
      <h1 class="header-title">{{ t('openPlatform.title') }}</h1>
    </div>
    <div class="header-right">
      <el-input
        v-model="searchKeyword"
        :placeholder="t('openPlatform.searchPlaceholder')"
        clearable
        class="search-input"
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <SearchIcon />
        </template>
      </el-input>
      <el-button @click="goToHome">
        <el-icon><HomeFilled /></el-icon>
        {{ t('openPlatform.backHome') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { HomeFilled } from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'

const { t } = useI18n()
const router = useRouter()

const searchKeyword = ref('')

const handleSearch = () => {
  if (searchKeyword.value) {
    // 可以跳转到搜索结果页
    router.push(`/open/document/center?search=${encodeURIComponent(searchKeyword.value)}`)
  }
}

const goToHome = () => {
  router.push('/')
}
</script>

<style scoped lang="scss">
.feature-center-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--el-bg-color);
  border-bottom: var(--unified-border-bottom);

  .header-left {
    .header-title {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: var(--el-text-color-primary);
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;

    .search-input {
      width: 300px;
    }
  }
}
</style>
