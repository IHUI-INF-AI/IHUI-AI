<template>
  <div class="wang-editor-show" v-html="content"></div>
</template>

<script>
// @ts-nocheck
export default {
  name: 'WangEditorShow',
  props: {
    content: { type: String, default: '' }
  }
}
</script>

<style scoped lang="scss">
.wang-editor-show {
  width: 100%;
  line-height: 1.8;
  word-break: break-word;
  :deep(img) {
    max-width: 100%;
    height: auto;
  }
  :deep(p) {
    margin: 0 0 12px;
  }
  :deep(h1),
  :deep(h2),
  :deep(h3) {
    margin: 16px 0 8px;
  }
  :deep(table) {
    width: 100%;
    border-collapse: collapse;
  }
  :deep(td),
  :deep(th) {
    border: 1px solid #ddd;
    padding: 6px 10px;
  }
}
</style>
