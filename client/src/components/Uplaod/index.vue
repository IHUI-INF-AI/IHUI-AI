<template>
  <div>
    <el-upload
      :action="uploadUrl"
      :limit="limit"
      :on-exceed="handleExceed"
      :file-list="files"
      :before-upload="onBeforeUpload"
      :on-error="onError"
      :on-success="onSuccess"
      :on-preview="handlePictureCardPreview"
      :on-remove="onRemove"
      :data="formData"
      :on-change="onChange"
      :class="{ hide: hideUpload || (files && files.length === limit) }"
      :show-file-list="showFileList"
      :headers="headers"
      multiple
      :accept="accept"
      :list-type="listType"
    >
      <el-icon><Plus /></el-icon>
      <span v-if="listType !== 'picture-card'">选择文件</span>
    </el-upload>
    <el-dialog v-model="previewVisible">
      <img alt="" width="100%" :src="previewImageUrl" />
    </el-dialog>
  </div>
</template>

<script>
// @ts-nocheck
import { ossApi } from '@/api/edu/admin-api'
import { getToken } from '@/util/tokenUtils'
import { error } from '@/util/tipsUtils'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import { Plus } from '@/lib/lucide-fallback'

export default {
  name: 'UploadIndex',
  components: { Plus },
  computed: {
    headers() {
      return {
        Authorization: 'Bearer ' + getToken()
      }
    }
  },
  props: {
    uploadUrl: { type: String, required: true },
    limit: { type: Number, default: 1 },
    accept: { type: String, default: 'image/jpeg,image/gif,image/png' },
    files: { type: Array, default: () => [] },
    onBeforeUpload: { type: Function, default: function () {} },
    onUploadSuccess: { type: Function, default: function () {} },
    onUploadRemove: { type: Function, default: function () {} },
    onUploadError: {
      type: Function,
      default: function (res) {
        error('上传失败')
        console.log(res)
      }
    },
    formData: { type: Object, default: () => ({}) },
    showFileList: { type: Boolean, default: true },
    alwaysShowUpload: { type: Boolean, default: false },
    listType: { type: String, default: 'picture-card' }
  },
  setup() {
    return {
      previewImageUrl: ref(''),
      previewVisible: ref(false),
      hideUpload: ref(false)
    }
  },
  methods: {
    handleExceed() {
      error('上传数量超过限制')
    },
    handlePictureCardPreview(file) {
      this.previewImageUrl = file.url
      this.previewVisible = true
    },
    onRemove(file, fileList) {
      if (!this.alwaysShowUpload) {
        this.hideUpload = fileList.length >= this.limit
      }
      let url = file.url
      if (file.response && file.response.data) {
        url = file.response.data
      }
      if (url) {
        ossApi.deleteFile(url, () => {
          ElMessage.success('删除成功')
        })
      }
      this.onUploadRemove(file, fileList)
    },
    onChange(file, fileList) {
      if (!this.alwaysShowUpload) {
        this.hideUpload = fileList.length >= this.limit
      }
    },
    onError(err, file, fileList) {
      if (!this.alwaysShowUpload) {
        this.hideUpload = fileList.length >= this.limit
      }
      this.onUploadError(err, file, fileList)
    },
    onSuccess(res, file, fileList) {
      if (!this.alwaysShowUpload) {
        this.hideUpload = fileList.length >= this.limit
      }
      this.onUploadSuccess(res, file, fileList)
    }
  }
}
</script>

<style>
.hide div.el-upload--picture-card {
  display: none;
}
</style>
