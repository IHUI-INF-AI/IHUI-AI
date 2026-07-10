<template>
  <div class="certificate-template-list-stub">
    <div v-if="isComponent" class="component-mode">
      <Table class="border">
        <TableHeader>
          <TableRow>
            <TableHead>证书名称</TableHead>
            <TableHead class="w-[120px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in tableData" :key="row.id ?? index">
            <TableCell>{{ row.name }}</TableCell>
            <TableCell>
              <Button variant="default" size="sm" @click="handleSelect(row)">选择</Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div class="footer-actions">
        <Button variant="outline" @click="handleCancel">取消</Button>
      </div>
    </div>
    <Empty v-else description="证书模板管理（占位组件，待完整迁移）" />
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { certificateApi } from '@/api/edu/admin-api'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Empty } from '@/components/ui/empty'
export default {
  name: 'CertificateTemplateList',
  components: { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Button, Empty },
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
