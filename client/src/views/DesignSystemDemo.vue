<template>
  <div class="design-system-demo">
    <div class="demo-header">
      <h1 class="text-4xl font-bold text-primary mb-lg">{{ t('designSystem.title') }}</h1>
      <p class="text-lg text-secondary">{{ t('designSystem.subtitle') }}</p>
    </div>

    <!-- 颜色系统 -->
    <section class="demo-section">
      <h2 class="text-2xl font-semibold text-primary mb-md">{{ t('designSystem.colorSystem') }}</h2>
      <DesignSystemCard :title="t('designSystem.colorPalette')" radius="15" padding="lg">
        <div class="color-grid">
          <div
            v-for="(color, name) in colorPalette"
            :key="name"
            class="color-item"
            :style="{ backgroundColor: color }"
          >
            <span class="color-name">{{ name }}</span>
            <span class="color-value">{{ color }}</span>
          </div>
        </div>
      </DesignSystemCard>
    </section>

    <!-- 间距系统 -->
    <section class="demo-section">
      <h2 class="text-2xl font-semibold text-primary mb-md">
        {{ t('designSystem.spacingSystem') }}
      </h2>
      <DesignSystemCard :title="t('designSystem.spacingDemo')" radius="15" padding="lg">
        <div class="spacing-demo">
          <div v-for="(size, name) in spacingSizes" :key="name" class="spacing-item">
            <div class="spacing-box" :style="{ padding: size }">
              <span class="spacing-label">{{ name }}: {{ size }}</span>
            </div>
          </div>
        </div>
      </DesignSystemCard>
    </section>

    <!-- 圆角系统 -->
    <section class="demo-section">
      <h2 class="text-2xl font-semibold text-primary mb-md">
        {{ t('designSystem.radiusSystem') }}
      </h2>
      <DesignSystemCard :title="t('designSystem.radiusDemo')" radius="15" padding="lg">
        <div class="radius-demo">
          <div
            v-for="(radius, name) in radiusSizes"
            :key="name"
            class="radius-item"
            :style="{ borderRadius: radius }"
          >
            <span class="radius-label">{{ name }}: {{ radius }}</span>
          </div>
        </div>
      </DesignSystemCard>
    </section>

    <!-- 按钮组件 -->
    <section class="demo-section">
      <h2 class="text-2xl font-semibold text-primary mb-md">
        {{ t('designSystem.buttonComponent') }}
      </h2>
      <DesignSystemCard :title="t('designSystem.buttonVariants')" radius="15" padding="lg">
        <div class="button-demo">
          <div class="button-group">
            <h3 class="text-lg font-medium mb-sm">{{ t('designSystem.variants') }}</h3>
            <div class="button-row">
              <Button variant="primary">{{ t('designSystem.primaryButton') }}</Button>
              <Button variant="secondary">{{ t('designSystem.secondaryButton') }}</Button>
              <Button variant="outline">{{ t('designSystem.outlineButton') }}</Button>
              <Button variant="ghost">{{ t('designSystem.ghostButton') }}</Button>
            </div>
          </div>

          <div class="button-group mt-lg">
            <h3 class="text-lg font-medium mb-sm">{{ t('designSystem.sizes') }}</h3>
            <div class="button-row">
              <Button size="sm">{{ t('designSystem.smallButton') }}</Button>
              <Button size="md">{{ t('designSystem.mediumButton') }}</Button>
              <Button size="lg">{{ t('designSystem.largeButton') }}</Button>
            </div>
          </div>

          <div class="button-group mt-lg">
            <h3 class="text-lg font-medium mb-sm">{{ t('designSystem.status') }}</h3>
            <div class="button-row">
              <Button :loading="true">{{ t('designSystem.loading') }}</Button>
              <Button :disabled="true">{{ t('designSystem.disabled') }}</Button>
            </div>
          </div>
        </div>
      </DesignSystemCard>
    </section>

    <!-- 输入框组件 -->
    <section class="demo-section">
      <h2 class="text-2xl font-semibold text-primary mb-md">
        {{ t('designSystem.inputComponent') }}
      </h2>
      <DesignSystemCard :title="t('designSystem.inputDemo')" radius="15" padding="lg">
        <div class="input-demo">
          <Input
            v-model="inputValue"
            :label="t('designSystem.standardInput')"
            :placeholder="t('designSystem.pleaseEnterContent')"
            class="mb-md"
          />

          <Input
            v-model="inputValue2"
            :label="t('designSystem.requiredInput')"
            :placeholder="t('designSystem.pleaseEnterContent')"
            required
            class="mb-md"
          />

          <Input
            v-model="inputValue3"
            :label="t('designSystem.errorStatus')"
            :placeholder="t('designSystem.pleaseEnterContent')"
            :error-message="t('designSystem.errorMessage')"
            class="mb-md"
          />

          <Input
            v-model="inputValue4"
            :label="t('designSystem.disabledStatus')"
            :placeholder="t('designSystem.disabled')"
            disabled
          />
        </div>
      </DesignSystemCard>
    </section>

    <!-- 工具类演示 -->
    <section class="demo-section">
      <h2 class="text-2xl font-semibold text-primary mb-md">
        {{ t('designSystem.utilitiesDemo') }}
      </h2>
      <DesignSystemCard :title="t('designSystem.utilitiesUsage')" radius="15" padding="lg">
        <div class="utilities-demo">
          <div class="p-md rounded-8 bg-primary mb-md">
            <p class="text-base text-primary">{{ t('designSystem.useUtilities') }}</p>
          </div>

          <div class="p-lg rounded-15 bg-secondary mb-md hover-lift">
            <p class="text-lg font-semibold text-primary">{{ t('designSystem.hoverEffect') }}</p>
          </div>

          <div class="flex-row justify-between align-center p-md rounded-8 bg-tertiary">
            <span class="text-sm text-secondary">{{ t('designSystem.flexboxUtilities') }}</span>
            <Button size="sm">{{ t('designSystem.action') }}</Button>
          </div>
        </div>
      </DesignSystemCard>
    </section>
  </div>
</template>

<script setup lang="ts">
 
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSEO } from '@/composables/useSEO'
import { useDesignSystem } from '@/composables/useDesignSystem'
import DesignSystemCard from '@/components/design-system/DesignSystemCard.vue'
import Button from '@/components/design-system/Button.vue'
import Input from '@/components/design-system/Input.vue'

const { t } = useI18n()

// SEO 配置
useSEO({
  title: t('designSystem.title') + ' - AI智汇社',
  description: t('designSystem.subtitle'),
  keywords: t('designSystemDemo.designSystemMeta'),
})

// 设计系统
const { colors, spacing, radius } = useDesignSystem()

// 颜色调色板
const colorPalette = {
  [t('designSystem.primaryColor')]: colors.value.primary,
  [t('designSystem.secondaryColor')]: colors.value.secondary,
  [t('designSystem.textPrimary')]: colors.value.text.primary,
  [t('designSystem.textSecondary')]: colors.value.text.secondary,
  [t('designSystem.bgPrimary')]: colors.value.background.primary,
  [t('designSystem.bgSecondary')]: colors.value.background.secondary,
  [t('designSystem.bgHover')]: colors.value.background.hover,
}

// 间距尺寸
const spacingSizes = {
  xs: spacing.xs,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
  xl: spacing.xl,
  '2xl': spacing['2xl'],
}

// 圆角尺寸
const radiusSizes = {
  '2': radius['2'],
  '4': radius['4'],
  '8': radius['8'],
  '15': radius['15'],
  '30': radius['30'],
  '60': radius['60'],
}

// 输入框值
const inputValue = ref('')
const inputValue2 = ref('')
const inputValue3 = ref('')
const inputValue4 = ref(t('designSystem.disabledContent'))
</script>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;
@use '@/styles/utilities.scss' as *;

.design-system-demo {
  width: 100%;
  margin: 0 auto;
  padding: $spacing-xl;

  .demo-header {
    text-align: center;
    margin-bottom: $spacing-2xl;
  }

  .demo-section {
    margin-bottom: $spacing-2xl;
  }
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: $spacing-md;

  .color-item {
    padding: $spacing-md;
    border-radius: $radius-8;
    color: var(--el-color-white);
    min-height: 100px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    .color-name {
      font-weight: $font-weight-semibold;
    }

    .color-value {
      font-size: $font-size-sm;
      opacity: 0.9;
    }
  }
}

.spacing-demo {
  .spacing-item {
    margin-bottom: $spacing-md;

    .spacing-box {
      background-color: $bg-secondary;
      border: var(--unified-border);
      border-radius: $radius-4;

      .spacing-label {
        font-size: $font-size-sm;
        color: $text-secondary;
      }
    }
  }
}

.radius-demo {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-md;

  .radius-item {
    width: 120px;
    height: 120px;
    background-color: $bg-secondary;
    border: var(--unified-border);
    display: flex;
    align-items: center;
    justify-content: center;

    .radius-label {
      font-size: $font-size-xs;
      color: $text-secondary;
      text-align: center;
    }
  }
}

.button-demo {
  .button-group {
    .button-row {
      display: flex;
      gap: $spacing-md;
      flex-wrap: wrap;
    }
  }
}

.input-demo {
  width: 100%;
}

.utilities-demo {
  .flex-row {
    display: flex;
  }
}
</style>
