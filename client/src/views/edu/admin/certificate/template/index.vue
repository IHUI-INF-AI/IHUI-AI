<template>
  <div class="certificate-template-list-stub">
    <div v-if="isComponent" class="component-mode">
      <el-table :data="tableData" border style="width: 100%">
        <el-table-column prop="name" label="证书名称" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleSelect(row)">选择</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="footer-actions">
        <el-button @click="handleCancel">取消</el-button>
      </div>
    </div>
    <el-empty v-else description="证书模板管理（占位组件，待完整迁移）" />
  </div>
</template>

<script>
// @ts-nocheck
import { ref, onMounted } from 'vue'
import { certificateApi } from '@/api/edu/admin-api'
export default {
  name: 'CertificateTemplateList',
  props: {
    isComponent: { type: Boolean, default: false },
    cancelCallback: { type: Function, default: () => {} },
    selectCallback: { type: Function, default: () => {} }
  },
  setup(props) {
    const tableData = ref([])
    const loadData = async () => {
      try {
        const res = await certificateApi.findList({ page: 1, size: 20 })
        if (res && res.records) {
          tableData.value = res.records
        } else if (Array.isArray(res)) {
          tableData.value = res
        }
      } catch (e) {
        // 静默失败
      }
    }
    const handleSelect = (row) => {
      props.selectCallback && props.selectCallback(row)
    }
    const handleCancel = () => {
      props.cancelCallback && props.cancelCallback()
    }
    onMounted(() => {
      if (props.isComponent) loadData()
    })
    return { tableData, handleSelect, handleCancel }
  }
}
</script>
<style scoped lang="scss">
.certificate-template-list-stub {
  min-height: 200px;
}
.footer-actions {
  margin-top: 10px;
  text-align: right;
}
</style>
