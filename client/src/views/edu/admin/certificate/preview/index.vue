<template>
  <div class="certificate-preview-stub">
    <Card v-if="certificate && certificate.id" class="shadow-none">
      <CardHeader>
        <span>{{ certificate.name || '证书预览' }}</span>
      </CardHeader>
              <CardContent>
      <div class="preview-body" v-html="certificate.content || certificate.template || ''"></div>
      <div v-if="download" class="preview-footer">
        <Button variant="default" size="sm" @click="handleDownload">下载证书</Button>
      </div>
    </CardContent>
    </Card>
    <Empty v-else description="暂无证书数据" />
  </div>
</template>

<script>
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Empty } from '@/components/ui/empty'
export default {
  name: 'CertificatePreview',
  components: { Card, CardHeader, CardContent, Empty },
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
