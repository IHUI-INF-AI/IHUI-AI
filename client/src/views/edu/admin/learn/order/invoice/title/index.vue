<template>
  <div class="app-container">
    <div class="header">
      <el-form :inline="true" :model="searchParam" class="form-inline">
        <el-form-item label="">
          <el-input class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字（公司名称/税号）" clearable></el-input>
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
        <el-form-item>
          <el-button type="success" @click="handleAdd">
            <el-icon><Plus /></el-icon>
            添加抬头
          </el-button>
        </el-form-item>
      </el-form>
    </div>
    <div class="content">
      <el-table :data="list" v-loading="dataLoading" style="width: 100%">
        <el-table-column label="会员" width="150">
          <template #default="scope">
            <span v-if="scope.row.member">{{ scope.row.member.name || scope.row.member.mobile }}</span>
            <span v-else class="text-gray">-</span>
          </template>
        </el-table-column>
        <el-table-column label="抬头类型" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.titleType === 1 ? 'primary' : 'success'" size="small">
              {{ scope.row.titleType === 1 ? '企业单位' : '个人/非企业' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="companyName" label="发票抬头" min-width="200">
          <template #default="scope">
            <span>{{ scope.row.companyName }}</span>
            <el-tag v-if="scope.row.defaultFlag" type="warning" size="small" style="margin-left: 8px">默认</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="companyTaxNumber" label="税号" width="180">
          <template #default="scope">
            {{ scope.row.companyTaxNumber || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="email" label="接收邮箱" width="200">
          <template #default="scope">
            {{ scope.row.email || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="mobilePhone" label="手机号码" width="130">
          <template #default="scope">
            {{ scope.row.mobilePhone || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="180"></el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="handleEdit(scope.row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>

    <!-- 添加/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑发票抬头' : '添加发票抬头'" width="600px">
      <el-form :model="formData" :rules="formRules" ref="formRef" label-width="100px">
        <el-form-item label="选择会员" prop="userId" v-if="!isEdit">
          <el-select
            v-model="formData.userId"
            filterable
            remote
            reserve-keyword
            placeholder="请输入会员手机号/姓名搜索"
            :remote-method="searchMember"
            :loading="memberLoading"
            style="width: 100%"
          >
            <el-option
              v-for="member in memberOptions"
              :key="member.id"
              :label="`${member.name || member.mobile} (${member.mobile})`"
              :value="member.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="会员" v-if="isEdit">
          <span>{{ formData.memberName || '-' }}</span>
        </el-form-item>
        <el-form-item label="抬头类型" prop="titleType">
          <el-radio-group v-model="formData.titleType">
            <el-radio :label="1">企业单位</el-radio>
            <el-radio :label="2">个人/非企业单位</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="formData.titleType === 1 ? '公司名称' : '个人姓名'" prop="companyName">
          <el-input v-model="formData.companyName" :placeholder="formData.titleType === 1 ? '请输入公司名称' : '请输入个人姓名'"></el-input>
        </el-form-item>
        <el-form-item label="税号" :prop="formData.titleType === 1 ? 'companyTaxNumber' : ''" v-if="formData.titleType === 1">
          <el-input v-model="formData.companyTaxNumber" placeholder="请输入公司税号"></el-input>
        </el-form-item>
        <el-form-item label="公司地址" v-if="formData.titleType === 1">
          <el-input v-model="formData.companyAddress" placeholder="请输入公司地址（选填）"></el-input>
        </el-form-item>
        <el-form-item label="公司电话" v-if="formData.titleType === 1">
          <el-input v-model="formData.companyPhone" placeholder="请输入公司电话（选填）"></el-input>
        </el-form-item>
        <el-form-item label="开户银行" v-if="formData.titleType === 1">
          <el-input v-model="formData.bankName" placeholder="请输入开户银行（选填）"></el-input>
        </el-form-item>
        <el-form-item label="银行账号" v-if="formData.titleType === 1">
          <el-input v-model="formData.bankAccount" placeholder="请输入银行账号（选填）"></el-input>
        </el-form-item>
        <el-form-item label="接收邮箱" prop="email">
          <el-input v-model="formData.email" placeholder="请输入接收电子发票的邮箱"></el-input>
        </el-form-item>
        <el-form-item label="手机号码">
          <el-input v-model="formData.mobilePhone" placeholder="请输入手机号码（选填）"></el-input>
        </el-form-item>
        <el-form-item label="设为默认">
          <el-switch v-model="formData.defaultFlag"></el-switch>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
// @ts-nocheck
import Page from "@/components/Page/index.vue"
import { ref, reactive } from "vue"
import { learnApi } from '@/api/edu/admin-api'
const { getInvoiceTitleList, createInvoiceTitle, updateInvoiceTitle, removeInvoiceTitle } = learnApi
import { memberApi } from '@/api/edu/admin-api'
const { getMemberList } = memberApi
import { success as successMsg } from "@/util/tipsUtils"
import { ElMessageBox } from "element-plus"
import { Plus } from '@/lib/lucide-fallback'

export default {
  name: "InvoiceTitle",
  components: {
    Page,
    Plus
  },
  setup() {
    const list = ref([])
    const total = ref(0)
    const dataLoading = ref(true)
    const dialogVisible = ref(false)
    const isEdit = ref(false)
    const submitting = ref(false)
    const formRef = ref(null)
    
    const searchParam = ref({
      keyword: "",
      titleType: "",
      size: 20,
      current: 1
    })

    const defaultFormData = {
      id: null,
      userId: null,
      memberName: '',
      titleType: 1,
      companyName: '',
      companyTaxNumber: '',
      companyAddress: '',
      companyPhone: '',
      bankName: '',
      bankAccount: '',
      email: '',
      mobilePhone: '',
      defaultFlag: false
    }
    
    const formData = ref({ ...defaultFormData })
    const memberOptions = ref([])
    const memberLoading = ref(false)
    
    // 搜索会员
    const searchMember = (query) => {
      if (!query || query.length < 2) {
        memberOptions.value = []
        return
      }
      memberLoading.value = true
      getMemberList({ keyword: query, size: 20, current: 1 }, (res) => {
        memberLoading.value = false
        if (res && res.list) {
          memberOptions.value = res.list
        }
      }).catch(() => {
        memberLoading.value = false
      })
    }

    const formRules = reactive({
      userId: [{ required: true, message: '请选择会员', trigger: 'change' }],
      titleType: [{ required: true, message: '请选择抬头类型', trigger: 'change' }],
      companyName: [{ required: true, message: '请输入名称', trigger: 'blur' }],
      companyTaxNumber: [{ required: true, message: '请输入税号', trigger: 'blur' }],
      email: [
        { required: true, message: '请输入接收邮箱', trigger: 'blur' },
        { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
      ]
    })

    const loadList = () => {
      dataLoading.value = true
      getInvoiceTitleList(searchParam.value, (res) => {
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

    const handleAdd = () => {
      isEdit.value = false
      formData.value = { ...defaultFormData }
      memberOptions.value = []
      dialogVisible.value = true
    }

    const handleEdit = (row) => {
      isEdit.value = true
      formData.value = { 
        ...row,
        memberName: row.member ? (row.member.name || row.member.mobile) : '-'
      }
      dialogVisible.value = true
    }

    const submitForm = () => {
      formRef.value.validate((valid) => {
        if (!valid) return
        
        submitting.value = true
        const api = isEdit.value ? updateInvoiceTitle : createInvoiceTitle
        
        api(formData.value, () => {
          successMsg(isEdit.value ? '编辑成功' : '添加成功')
          dialogVisible.value = false
          submitting.value = false
          loadList()
        }).catch(() => {
          submitting.value = false
        })
      })
    }

    const handleDelete = (row) => {
      ElMessageBox.confirm('确定要删除此发票抬头吗？', '确认删除', {
        type: 'warning'
      }).then(() => {
        removeInvoiceTitle({ id: row.id }, () => {
          successMsg('删除成功')
          loadList()
        })
      }).catch(() => {})
    }

    return {
      list,
      total,
      searchParam,
      dataLoading,
      search,
      currentChange,
      sizeChange,
      dialogVisible,
      isEdit,
      formData,
      formRules,
      formRef,
      submitting,
      handleAdd,
      handleEdit,
      submitForm,
      handleDelete,
      memberOptions,
      memberLoading,
      searchMember
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
}
</style>
