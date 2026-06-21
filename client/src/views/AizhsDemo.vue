<template>
  <div class="min-h-screen flex items-center justify-center bg-background">
    <div class="text-center space-y-6">
      <div>
        <h1 class="text-4xl font-bold text-foreground mb-2">AIZHS</h1>
        <p class="text-muted-foreground">{{ t('hardcoded.aizhs.demo.Vue3TypeSc') }}</p>
      </div>
      <div class="space-y-4">
        <p class="text-lg">
          count is <span class="font-semibold text-primary">{{ count }}</span>
        </p>
        <div class="flex gap-4 justify-center">
          <Button @click="increment">Increment</Button>
          <Button variant="outline" @click="reset">Reset</Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

import { ref } from 'vue'
import Button from '@/components/ui/Button.vue'

const count = ref(0)

const increment = () => {
  count.value++
}

const reset = () => {
  count.value = 0
}
</script>

<style scoped>
/* 样式由 Tailwind CSS 处理 */
</style>
