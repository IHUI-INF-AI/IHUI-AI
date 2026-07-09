<template>
  <div class="app-container">
    <div class="header">
      <form @submit.prevent class="form-inline">
        <div class="mb-4">
          <Input class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字（订单号/公司名称）" clearable />
        </div>
        <div class="mb-4 select">
          <label class="mb-1 block text-sm font-medium text-foreground">状态</label>
          <div>
            <Select v-model="searchParam.invoiceStatus" @change="search" clearable placeholder="全部">
              <SelectOption v-for="(item, key) in invoiceStatusMap" :label="item" :value="key" :key="key"></SelectOption>
            </Select>
          </div>
        </div>
        <div class="mb-4 select">
          <label class="mb-1 block text-sm font-medium text-foreground">抬头类型</label>
          <div>
            <Select v-model="searchParam.titleType" @change="search" clearable placeholder="全部">
              <SelectOption label="企业单位" :value="1"></SelectOption>
              <SelectOption label="个人/非企业单位" :value="2"></SelectOption>
            </Select>
          </div>
        </div>
        <div class="mb-4">
          <Button variant="default" @click="search">搜索</Button>
        </div>
      </form>
    </div>
    <div class="content">
      <div v-if="dataLoading" class="loading">加载中...</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[180px]">订单号</TableHead>
            <TableHead class="w-[120px]">抬头类型</TableHead>
            <TableHead class="min-w-[180px]">发票抬头</TableHead>
            <TableHead class="w-[180px]">税号</TableHead>
            <TableHead class="w-[120px]">开票金额</TableHead>
            <TableHead class="w-[180px]">接收邮箱</TableHead>
            <TableHead class="w-[100px]">状态</TableHead>
            <TableHead class="w-[180px]">申请时间</TableHead>
            <TableHead class="w-[200px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in list" :key="row.id ?? index">
            <TableCell>{{ row.orderNo }}</TableCell>
            <TableCell>
              <Tag :type="row.titleType === 1 ? 'primary' : 'success'" size="small">
                {{ row.titleType === 1 ? '企业单位' : '个人/非企业' }}
              </Tag>
            </TableCell>
            <TableCell>{{ row.companyName }}</TableCell>
            <TableCell>{{ row.companyTaxNumber }}</TableCell>
            <TableCell><span class="price">￥{{ row.invoiceAmount || 0 }}</span></TableCell>
            <TableCell>{{ row.email }}</TableCell>
            <TableCell>
              <Tag :type="getStatusTagType(row.invoiceStatus)" size="small">
                {{ invoiceStatusMap[row.invoiceStatus] }}
              </Tag>
            </TableCell>
            <TableCell>{{ row.createTime }}</TableCell>
            <TableCell>
              <Button variant="link" @click="viewDetail(row)">详情</Button>
              <template v-if="row.invoiceStatus === 0">
                <Button variant="link" @click="handleApprove(row)">通过</Button>
                <Button variant="link" @click="handleReject(row)">驳回</Button>
              </template>
              <template v-else-if="row.invoiceStatus === 1">
                <Button variant="link" @click="handleInvoicing(row)">开票中</Button>
              </template>
              <template v-else-if="row.invoiceStatus === 3">
                <Button variant="link" @click="handleInvoiced(row)">已开票</Button>
              </template>
              <Button variant="link" v-if="row.invoiceStatus !== 5" @click="handleCancel(row)">作废</Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>

    <!-- 详情弹窗 -->
    <Dialog v-model="detailVisible" width="600px">
      <DialogHeader>
        <DialogTitle>发票申请详情</DialogTitle>
      </DialogHeader>
      <el-descriptions :column="2" border v-if="currentItem">
        <el-descriptions-item label="订单号">{{ currentItem.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="申请状态">
          <Tag :type="getStatusTagType(currentItem.invoiceStatus)" size="small">
            {{ invoiceStatusMap[currentItem.invoiceStatus] }}
          </Tag>
        </el-descriptions-item>
        <el-descriptions-item label="抬头类型">{{ currentItem.titleType === 1 ? '企业单位' : '个人/非企业单位' }}</el-descriptions-item>
        <el-descriptions-item label="开票金额"><span class="price">￥{{ currentItem.invoiceAmount }}</span></el-descriptions-item>
        <el-descriptions-item label="发票抬头" :span="2">{{ currentItem.companyName }}</el-descriptions-item>
        <el-descriptions-item label="税号" :span="2">{{ currentItem.companyTaxNumber || '-' }}</el-descriptions-item>
        <el-descriptions-item label="公司地址" :span="2">{{ currentItem.companyAddress || '-' }}</el-descriptions-item>
        <el-descriptions-item label="公司电话">{{ currentItem.companyPhone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="手机号码">{{ currentItem.mobilePhone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="开户银行" :span="2">{{ currentItem.bankName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="银行账号" :span="2">{{ currentItem.bankAccount || '-' }}</el-descriptions-item>
        <el-descriptions-item label="接收邮箱" :span="2">{{ currentItem.email || '-' }}</el-descriptions-item>
        <el-descriptions-item label="发票内容" :span="2">{{ currentItem.invoiceContent || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请时间">{{ currentItem.createTime }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ currentItem.updateTime }}</el-descriptions-item>
      </el-descriptions>
      <DialogFooter>
        <Button variant="outline" @click="detailVisible = false">关闭</Button>
      </DialogFooter>
    </Dialog>

    <!-- 驳回原因弹窗 -->
    <Dialog v-model="rejectVisible" width="400px">
      <DialogHeader>
        <DialogTitle>驳回原因</DialogTitle>
      </DialogHeader>
      <form @submit.prevent>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">驳回原因</label>
          <div>
            <Textarea v-model="rejectForm.reason" :rows="4" placeholder="请输入驳回原因" />
          </div>
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="rejectVisible = false">取消</Button>
        <Button variant="default" @click="confirmReject">确认驳回</Button>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script>
// @ts-nocheck
import Page from "@/components/Page/index.vue"
import { ref } from "vue"
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Textarea } from '@/components/ui/textarea'
import { Tag } from '@/components/ui/tag'
import { Select, SelectOption } from '@/components/ui/select'
import { learnApi } from '@/api/edu/admin-api'
const { getInvoiceApplicationList, approvedInvoiceApplication, rejectedInvoiceApplication, invoicingInvoiceApplication, invoicedInvoiceApplication, canceledInvoiceApplication } = learnApi
import { success as successMsg, warning } from "@/util/tipsUtils"
import { ElMessageBox } from "element-plus"

export default {
  name: "InvoiceApplication",
  components: {
    Page,
    Button,
    Dialog,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    Textarea,
    Select,
    SelectOption,
    Tag
  },
  setup() {
    const list = ref([])
    const total = ref(0)
    const dataLoading = ref(true)
    const detailVisible = ref(false)
    const rejectVisible = ref(false)
    const currentItem = ref(null)
    const rejectForm = ref({ reason: '' })
    
    const searchParam = ref({
      keyword: "",
      invoiceStatus: "",
      titleType: "",
      size: 20,
      current: 1
    })

    const invoiceStatusMap = {
      0: "待审核",
      1: "审核通过",
      2: "审核驳回",
      3: "开票中",
      4: "已开票",
      5: "已作废"
    }

    const getStatusTagType = (status) => {
      const typeMap = {
        0: 'warning',
        1: 'success',
        2: 'danger',
        3: 'primary',
        4: 'success',
        5: 'info'
      }
      return typeMap[status] || 'info'
    }

    const loadList = () => {
      dataLoading.value = true
      getInvoiceApplicationList(searchParam.value, (res) => {
        dataLoading.value = false
        if (!res) return
        list.value = res.list || []
        total.value = res.total || 0
      }).catch(() => {
        dataLoading.value = false
      })
    }
    loadList()

    const search = () => {
      searchParam.value.current = 1
      loadList()
    }

    const currentChange = (currentPage) => {
      searchParam.value.current = currentPage
      loadList()
    }

    const sizeChange = (s) => {
      searchParam.value.size = s
      loadList()
    }

    const viewDetail = (row) => {
      currentItem.value = row
      detailVisible.value = true
    }

    const handleApprove = (row) => {
      ElMessageBox.confirm('确定要通过此发票申请吗？', '确认', {
        type: 'warning'
      }).then(() => {
        approvedInvoiceApplication({ id: row.id }, () => {
          successMsg('审核通过成功')
          loadList()
        })
      }).catch(() => {})
    }

    const handleReject = (row) => {
      currentItem.value = row
      rejectForm.value.reason = ''
      rejectVisible.value = true
    }

    const confirmReject = () => {
      if (!rejectForm.value.reason) {
        warning('请输入驳回原因')
        return
      }
      rejectedInvoiceApplication({ 
        id: currentItem.value.id, 
        reason: rejectForm.value.reason 
      }, () => {
        successMsg('驳回成功')
        rejectVisible.value = false
        loadList()
      })
    }

    const handleInvoicing = (row) => {
      ElMessageBox.confirm('确定将此申请状态改为开票中吗？', '确认', {
        type: 'warning'
      }).then(() => {
        invoicingInvoiceApplication({ id: row.id }, () => {
          successMsg('状态更新成功')
          loadList()
        })
      }).catch(() => {})
    }

    const handleInvoiced = (row) => {
      ElMessageBox.confirm('确定此发票已开具完成吗？', '确认', {
        type: 'warning'
      }).then(() => {
        invoicedInvoiceApplication({ id: row.id }, () => {
          successMsg('开票完成')
          loadList()
        })
      }).catch(() => {})
    }

    const handleCancel = (row) => {
      ElMessageBox.confirm('确定要作废此发票申请吗？此操作不可恢复', '警告', {
        type: 'error'
      }).then(() => {
        canceledInvoiceApplication({ id: row.id }, () => {
          successMsg('作废成功')
          loadList()
        })
      }).catch(() => {})
    }

    return {
      list,
      total,
      searchParam,
      dataLoading,
      invoiceStatusMap,
      getStatusTagType,
      search,
      currentChange,
      sizeChange,
      viewDetail,
      detailVisible,
      currentItem,
      handleApprove,
      handleReject,
      rejectVisible,
      rejectForm,
      confirmReject,
      handleInvoicing,
      handleInvoiced,
      handleCancel
    }
  }
}
</script>

<style scoped lang="scss">
.app-container {
  margin: 20px;
  
  .header {
    .form-inline {
      .search-input {
        width: 280px;
      }
    }
  }
  
  .content {
    background-color: #ffffff;
    padding: 20px;
    border-radius: 4px;
  }
  
  .price {
    color: #e6a23c;
    font-weight: 500;
  }
}
</style>
