<template>
  <div class="certificate-preview-stub">
    <el-card v-if="certificate && certificate.id" shadow="never">
      <template #header>
        <span>{{ certificate.name || '证书预览' }}</span>
      </template>
      <div class="preview-body" v-html="certificate.content || certificate.template || ''"></div>
      <div v-if="download" class="preview-footer">
        <el-button type="primary" size="small" @click="handleDownload">下载证书</el-button>
      </div>
    </el-card>
    <el-empty v-else description="暂无证书数据" />
  </div>
</template>

<script>
// @ts-nocheck
export default {
  name: 'CertificatePreview',
  props: {
    certificate: { type: Object, default: () => ({}) },
    download: { type: Boolean, default: false }
  },
  setup(props) {
    const handleDownload = () => {
      // 占位实现
    }
    return { handleDownload }
  }
}
</script>
<style scoped lang="scss">
.certificate-preview-stub {
  min-height: 200px;
}
.preview-body {
  min-height: 150px;
  padding: 10px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
}
.preview-footer {
  margin-top: 10px;
  text-align: right;
}
</style>
