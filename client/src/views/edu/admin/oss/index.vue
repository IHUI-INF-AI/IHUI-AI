<template>
  <div class="oss-container">
    <div class="head">
      <el-input
        v-model="searchParam.keyword"
        clearable
        size="small"
        placeholder="输入文件名搜索"
        class="search-input"
        @keyup.enter="search"
      />
      <el-button class="search-btn" size="small" type="primary" :icon="Search" @click="search">搜索</el-button>
      <el-button size="small" type="primary" :icon="Upload" @click="showUploadDialog">上传文件</el-button>
    </div>
    <el-table v-loading="dataLoading" :data="list" size="small" style="width: 100%;">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="文件名" min-width="220" :show-overflow-tooltip="true">
        <template #default="scope">
          {{ scope.row.name || scope.row.fileName || scope.row.originalName || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="文件路径" min-width="260" :show-overflow-tooltip="true">
        <template #default="scope">
          <el-link type="primary" :href="scope.row.url || scope.row.path" target="_blank" :underline="false">
            {{ scope.row.url || scope.row.path || '-' }}
          </el-link>
        </template>
      </el-table-column>
      <el-table-column label="文件类型" width="100" align="center">
        <template #default="scope">
          <el-tag size="small" type="info">{{ scope.row.fileType || scope.row.type || getFileType(scope.row) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="文件大小" width="110" align="center">
        <template #default="scope">{{ formatSize(scope.row.size || scope.row.fileSize) }}</template>
      </el-table-column>
      <el-table-column prop="createTime" label="上传时间" width="160" />
      <el-table-column label="操作" align="center" width="140" fixed="right">
        <template #default="scope">
          <el-button link size="small" @click="copyUrl(scope.row)">复制链接</el-button>
          <el-button link size="small" style="color: red;" @click="remove(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size" />

    <!-- 上传弹窗 -->
    <el-dialog v-model="uploadDialogVisible" title="上传文件" width="500px" :before-close="hideUploadDialog">
      <el-form label-width="90px">
        <el-form-item label="选择文件">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            :on-change="handleFileChange"
            :on-exceed="handleExceed"
            drag
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
            <template #tip>
              <div class="el-upload__tip">支持上传任意类型文件，单次上传一个</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" @click="hideUploadDialog">取 消</el-button>
          <el-button size="small" type="primary" :loading="uploading" @click="submitUpload">开始上传</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref } from 'vue'
import Page from '@/components/Page/index.vue'
import { ossApi } from '@/api/edu/admin-api'
import { confirm, success, error } from '@/util/tipsUtils'
import { Search, Upload, UploadFilled } from '@/lib/lucide-fallback'
import { ElMessage } from 'element-plus'

const { findFileList, uploadOssFile, deleteOssFile } = ossApi

const list = ref<any[]>([])
const total = ref(0)
const dataLoading = ref(true)
const searchParam = ref({
  keyword: '',
  size: 20,
  current: 1
})

// 加载列表
const loadList = () => {
  dataLoading.value = true
  findFileList(searchParam.value, (res: any) => {
    dataLoading.value = false
    if (!res) return
    list.value = res.list || []
    total.value = res.total || 0
  }).catch(() => {
    dataLoading.value = false
  })
}
loadList()

const currentChange = (currentPage: number) => {
  searchParam.value.current = currentPage
  loadList()
}
const sizeChange = (size: number) => {
  searchParam.value.size = size
  loadList()
}
const search = () => {
  searchParam.value.current = 1
  loadList()
}

// 工具方法：格式化文件大小
const formatSize = (size: any) => {
  if (!size) return '-'
  const num = Number(size)
  if (isNaN(num)) return '-'
  if (num < 1024) return num + ' B'
  if (num < 1024 * 1024) return (num / 1024).toFixed(2) + ' KB'
  if (num < 1024 * 1024 * 1024) return (num / 1024 / 1024).toFixed(2) + ' MB'
  return (num / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

// 工具方法：获取文件类型
const getFileType = (row: any) => {
  const name = row.name || row.fileName || row.originalName || row.url || row.path || ''
  const ext = name.split('.').pop()
  return ext && ext !== name ? ext.toUpperCase() : '-'
}

// 复制链接
const copyUrl = (row: any) => {
  const url = row.url || row.path
  if (!url) {
    error('未找到文件链接')
    return
  }
  navigator.clipboard
    .writeText(url)
    .then(() => {
      success('链接已复制到剪贴板')
    })
    .catch(() => {
      ElMessage.warning('复制失败，请手动复制：' + url)
    })
}

// 上传
const uploadDialogVisible = ref(false)
const uploading = ref(false)
const uploadRef = ref<any>(null)
const currentFile = ref<any>(null)

const showUploadDialog = () => {
  currentFile.value = null
  uploadDialogVisible.value = true
}
const hideUploadDialog = () => {
  uploadDialogVisible.value = false
  currentFile.value = null
  uploadRef.value && uploadRef.value.clearFiles()
}
const handleFileChange = (file: any) => {
  currentFile.value = file.raw
}
const handleExceed = () => {
  error('一次只能上传一个文件，请先移除已选文件')
}
const submitUpload = () => {
  if (!currentFile.value) {
    error('请先选择要上传的文件')
    return
  }
  if (uploading.value) return
  uploading.value = true
  const formData = new FormData()
  formData.append('file', currentFile.value)
  uploadOssFile(formData, (res: any) => {
    uploading.value = false
    success('上传成功')
    hideUploadDialog()
    searchParam.value.current = 1
    loadList()
  }).catch(() => {
    uploading.value = false
    error('上传失败')
  })
}

// 删除
const remove = (item: any) => {
  confirm('确认删除该文件【' + (item.name || item.fileName || item.id) + '】？', '提示', () => {
    deleteOssFile(item.id, () => {
      success('删除成功')
      loadList()
    })
  })
}
</script>

<style scoped lang="scss">
.oss-container {
  margin: 20px;
  .head {
    margin-bottom: 10px;
    .search-input {
      width: 280px;
    }
  }
}
</style>
