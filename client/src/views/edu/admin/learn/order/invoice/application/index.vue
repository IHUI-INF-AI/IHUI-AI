<template>
  <div class="app-container">
    <div class="header">
      <el-form :inline="true" :model="searchParam" class="form-inline">
        <el-form-item label="">
          <el-input class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字（订单号/公司名称）" clearable></el-input>
        </el-form-item>
        <el-form-item label="状态" class="select">
          <el-select v-model="searchParam.invoiceStatus" @change="search" clearable placeholder="全部">
            <el-option v-for="(item, key) in invoiceStatusMap" :label="item" :value="key" :key="key"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="抬头类型" class="select">
          <el-select v-model="searchParam.titleType" @change="search" clearable placeholder="全部">
            <el-option label="企业单位" :value="1"></el-option>
            <el-option label="个人/非企业单位" :value="2"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search">搜索</el-button>
        </el-form-item>
      </el-form>
    </div>
    <div class="content">
      <el-table :data="list" v-loading="dataLoading" style="width: 100%">
        <el-table-column prop="orderNo" label="订单号" width="180"></el-table-column>
        <el-table-column label="抬头类型" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.titleType === 1 ? 'primary' : 'success'" size="small">
              {{ scope.row.titleType === 1 ? '企业单位' : '个人/非企业' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="companyName" label="发票抬头" min-width="180"></el-table-column>
        <el-table-column prop="companyTaxNumber" label="税号" width="180"></el-table-column>
        <el-table-column label="开票金额" width="120">
          <template #default="scope">
            <span class="price">￥{{ scope.row.invoiceAmount || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="接收邮箱" width="180"></el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusTagType(scope.row.invoiceStatus)" size="small">
              {{ invoiceStatusMap[scope.row.invoiceStatus] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="申请时间" width="180"></el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="viewDetail(scope.row)">详情</el-button>
            <template v-if="scope.row.invoiceStatus === 0">
              <el-button link type="success" @click="handleApprove(scope.row)">通过</el-button>
              <el-button link type="danger" @click="handleReject(scope.row)">驳回</el-button>
            </template>
            <template v-else-if="scope.row.invoiceStatus === 1">
              <el-button link type="warning" @click="handleInvoicing(scope.row)">开票中</el-button>
            </template>
            <template v-else-if="scope.row.invoiceStatus === 3">
              <el-button link type="success" @click="handleInvoiced(scope.row)">已开票</el-button>
            </template>
            <el-button link type="danger" v-if="scope.row.invoiceStatus !== 5" @click="handleCancel(scope.row)">作废</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="发票申请详情" width="600px">
      <el-descriptions :column="2" border v-if="currentItem">
        <el-descriptions-item label="订单号">{{ currentItem.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="申请状态">
          <el-tag :type="getStatusTagType(currentItem.invoiceStatus)" size="small">
            {{ invoiceStatusMap[currentItem.invoiceStatus] }}
          </el-tag>
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
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 驳回原因弹窗 -->
    <el-dialog v-model="rejectVisible" title="驳回原因" width="400px">
      <el-form :model="rejectForm">
        <el-form-item label="驳回原因" required>
          <el-input v-model="rejectForm.reason" type="textarea" :rows="4" placeholder="请输入驳回原因"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmReject">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
// @ts-nocheck
import Page from "@/components/Page/index.vue"
import { ref } from "vue"
import { learnApi } from '@/api/edu/admin-api'
const { getInvoiceApplicationList, approvedInvoiceApplication, rejectedInvoiceApplication, invoicingInvoiceApplication, invoicedInvoiceApplication, canceledInvoiceApplication } = learnApi
import { success as successMsg, warning } from "@/util/tipsUtils"
import { ElMessageBox } from "element-plus"

export default {
  name: "InvoiceApplication",
  components: {
    Page
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
