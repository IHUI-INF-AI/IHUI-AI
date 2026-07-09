<template>
  <div class="oss-container">
    <div class="head">
      <Input
        v-model="searchParam.keyword"
        clearable
        size="small"
        placeholder="输入文件名搜索"
        class="search-input"
        @keyup.enter="search"
      />
      <Button className="search-btn" variant="default" size="sm" @click="search"><Search />搜索</Button>
      <Button variant="default" size="sm" @click="showUploadDialog"><Upload />上传文件</Button>
    </div>
    <div v-if="dataLoading" class="loading">加载中...</div>
    <Table class="text-sm">
      <TableHeader>
        <TableRow>
          <TableHead class="w-[70px]">ID</TableHead>
          <TableHead class="min-w-[220px]">文件名</TableHead>
          <TableHead class="min-w-[260px]">文件路径</TableHead>
          <TableHead class="w-[100px] text-center">文件类型</TableHead>
          <TableHead class="w-[110px] text-center">文件大小</TableHead>
          <TableHead class="w-[160px]">上传时间</TableHead>
          <TableHead class="w-[140px] text-center">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(row, index) in list" :key="row.id ?? index">
          <TableCell>{{ row.id }}</TableCell>
          <TableCell>{{ row.name || row.fileName || row.originalName || '-' }}</TableCell>
          <TableCell>
            <el-link type="primary" :href="row.url || row.path" target="_blank" :underline="false">
              {{ row.url || row.path || '-' }}
            </el-link>
          </TableCell>
          <TableCell class="text-center">
            <Tag size="small" type="info">{{ row.fileType || row.type || getFileType(row) }}</Tag>
          </TableCell>
          <TableCell class="text-center">{{ formatSize(row.size || row.fileSize) }}</TableCell>
          <TableCell>{{ row.createTime }}</TableCell>
          <TableCell class="text-center">
            <Button variant="link" size="sm" @click="copyUrl(row)">复制链接</Button>
            <Button variant="link" size="sm" style="color: red;" @click="remove(row)">删除</Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size" />

    <!-- 上传弹窗 -->
    <Dialog v-model="uploadDialogVisible" :width="'500px'" @close="hideUploadDialog">
      <DialogHeader>
        <DialogTitle>上传文件</DialogTitle>
      </DialogHeader>
      <form @submit.prevent>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">选择文件</label>
          <div>
            <el-upload
              ref="uploadRef"
              :auto-upload="false"
              :limit="1"
              :on-change="handleFileChange"
              :on-exceed="handleExceed"
              drag
            >
              <UploadFilled class="h-4 w-4 el-icon--upload" />
              <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
              <template #tip>
                <div class="el-upload__tip">支持上传任意类型文件，单次上传一个</div>
              </template>
            </el-upload>
          </div>
        </div>
      </form>
      <template #footer>
        <div class="dialog-footer">
          <Button variant="outline" size="sm" @click="hideUploadDialog">取 消</Button>
          <Button variant="default" size="sm" @click="submitUpload">开始上传</Button>
        </div>
      </template>
    </Dialog>
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
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Tag } from '@/components/ui/tag'

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
