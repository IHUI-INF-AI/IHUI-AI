<template>
    <div class="chat-content-container">
        <h1>{{ t('hardcoded.content.对话区域') }}</h1>
    </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()


</script>

<style scoped>
.chat-content-container {
    grid-area: content;
}
</style>