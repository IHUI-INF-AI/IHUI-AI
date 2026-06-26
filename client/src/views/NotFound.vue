<template>
  <div class="not-found-container radius-auto" role="main" aria-labelledby="not-found-heading">
    <div class="not-found-content radius-auto">
      <div class="not-found-code-wrap">
        <h1 id="not-found-heading" class="not-found-code">404</h1>
      </div>
      <p class="not-found-message">{{ t('routes.notFound') }}</p>
      <div class="not-found-actions">
        <button
          type="button"
          class="nf-btn nf-btn-primary"
          :aria-label="t('errorBoundary.goHome')"
          @click="goHome"
        >
          <span class="nf-btn-text">{{ t('errorBoundary.goHome') }}</span>
        </button>
        <button
          type="button"
          class="nf-btn nf-btn-secondary"
          :aria-label="t('common.back')"
          @click="goBack"
        >
          <span class="nf-btn-text">{{ t('common.back') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

// 2026-06-25 修复 ESLint: useRoute / logger 引入后未在 setup 中实际使用,
// 删除无意义的 import 与变量, 避免 no-unused-vars. 保留 navigation hook.
import { useI18n } from 'vue-i18n'
import { onMounted } from 'vue'
import { useNavigation } from '@/utils/navigation'

const { t } = useI18n()
const { goHome, goBack } = useNavigation()

onMounted(() => {
  // 404 页面正常展示，不触发 ErrorEvent 避免被 ErrorBoundary 拦截
})
</script>

<style scoped lang="scss">
/* 2026-06-26 修复: 移除 Element Plus 组件, 改用原生 HTML 按钮
 * 根因: <el-button> 在 vite pre-bundled chunk 中触发 Vue 3.5 renderSlot 读取 null,
 * 抛出 "Cannot read properties of null (reading 'ce')". 同样问题已在 ErrorBoundary
 * 修复 (移除所有 el-* 组件). 同步处理 NotFound 避免再被 ErrorBoundary 二次捕获.
 * 设计: 半透明卡片 + 扁平化边框, 与 ErrorBoundary 风格保持一致. */
.not-found-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: calc(100vh - 60px);
  padding: 40px 20px;
  background: var(--el-bg-color);
}

.not-found-content {
  text-align: center;
  width: 100%;
  max-width: 520px;
  padding: 48px 32px;
  background: var(--color-white-90);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.not-found-code-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.not-found-code {
  margin: 0;
  font-size: 96px;
  font-weight: 700;
  line-height: 1;
  color: var(--el-color-primary);
  letter-spacing: -2px;
}

.not-found-message {
  font-size: 18px;
  color: var(--el-text-color-regular);
  margin: 0 0 32px;
  line-height: 1.6;
}

.not-found-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 12px;
  justify-content: center;
  align-items: center;
  width: 100%;
}

/* 2026-06-26 修复: 按钮 min-width + white-space: nowrap,
 * 防止中文字符被强制换行导致垂直堆叠. */
.nf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 0 0 auto;
  min-width: 132px;
  height: 40px;
  padding: 0 24px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  user-select: none;
  border-radius: var(--global-border-radius);
  border: 1px solid transparent;
  cursor: pointer;
  outline: none;
  box-sizing: border-box;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;
}

.nf-btn-text {
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nf-btn-primary {
  background-color: #409eff;
  color: #fff;
  border-color: #409eff;
}

.nf-btn-primary:hover {
  background-color: #66b1ff;
  border-color: #66b1ff;
}

.nf-btn-primary:active {
  background-color: #337ecc;
  border-color: #337ecc;
}

.nf-btn-secondary {
  background-color: #fff;
  color: #606266;
  border-color: #dcdfe6;
}

.nf-btn-secondary:hover {
  color: #409eff;
  border-color: #c0dfff;
  background-color: #ecf5ff;
}

.nf-btn-secondary:active {
  color: #337ecc;
  border-color: #337ecc;
}

:where(html.dark) .not-found-content {
  background-color: var(--color-white-10);
  border: var(--unified-border);
}

@media (width <= 768px) {
  .not-found-content {
    padding: 36px 24px;
  }

  .not-found-code {
    font-size: 72px;
  }

  .not-found-message {
    font-size: 16px;
    margin-bottom: 24px;
  }

  .not-found-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .nf-btn {
    width: 100%;
  }
}
</style>
