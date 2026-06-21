<template>
  <div class="support-tickets">
    <h2>{{ t('supportTickets.title') }}</h2>
    <p>{{ t('supportTickets.merged') }}</p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
defineOptions({ name: 'SupportTickets' })
const { t } = useI18n()
</script>
