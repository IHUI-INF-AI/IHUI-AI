<template>
  <div class="app-container">
    <div class="header">
      <form @submit.prevent class="form-inline">
        <div class="mb-4">
          <Input class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字（公司名称/税号）" clearable />
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
        <div class="mb-4">
          <Button variant="default" @click="handleAdd">
            <Plus class="h-4 w-4" />
            添加抬头
          </Button>
        </div>
      </form>
    </div>
    <div class="content">
      <div v-if="dataLoading">加载中...</div>
      <Table class="w-full">
        <TableHeader>
          <TableRow>
            <TableHead class="w-[150px]">会员</TableHead>
            <TableHead class="w-[120px]">抬头类型</TableHead>
            <TableHead class="min-w-[200px]">发票抬头</TableHead>
            <TableHead class="w-[180px]">税号</TableHead>
            <TableHead class="w-[200px]">接收邮箱</TableHead>
            <TableHead class="w-[130px]">手机号码</TableHead>
            <TableHead class="w-[180px]">创建时间</TableHead>
            <TableHead class="w-[150px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in list" :key="row.id ?? index">
            <TableCell>
              <span v-if="row.member">{{ row.member.name || row.member.mobile }}</span>
              <span v-else class="text-gray">-</span>
            </TableCell>
            <TableCell>
              <Tag :type="row.titleType === 1 ? 'primary' : 'success'" size="small">
                {{ row.titleType === 1 ? '企业单位' : '个人/非企业' }}
              </Tag>
            </TableCell>
            <TableCell>
              <span>{{ row.companyName }}</span>
              <Tag v-if="row.defaultFlag" type="warning" size="small" style="margin-left: 8px">默认</Tag>
            </TableCell>
            <TableCell>{{ row.companyTaxNumber || '-' }}</TableCell>
            <TableCell>{{ row.email || '-' }}</TableCell>
            <TableCell>{{ row.mobilePhone || '-' }}</TableCell>
            <TableCell>{{ row.createTime }}</TableCell>
            <TableCell>
              <Button variant="link" @click="handleEdit(row)">编辑</Button>
              <Button variant="link" @click="handleDelete(row)">删除</Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>

    <!-- 添加/编辑弹窗 -->
    <Dialog v-model="dialogVisible" width="600px">
      <DialogHeader>
        <DialogTitle>{{ isEdit ? '编辑发票抬头' : '添加发票抬头' }}</DialogTitle>
      </DialogHeader>
      <form ref="formRef" @submit.prevent>
        <div class="mb-4" v-if="!isEdit">
          <label class="mb-1 block text-sm font-medium text-foreground">选择会员</label>
          <div>
            <Select
              v-model="formData.userId"
              placeholder="请输入会员手机号/姓名搜索"
              style="width: 100%"
            >
              <SelectOption
                v-for="member in memberOptions"
                :key="member.id"
                :label="`${member.name || member.mobile} (${member.mobile})`"
                :value="member.id"
              />
            </Select>
          </div>
        </div>
        <div class="mb-4" v-if="isEdit">
          <label class="mb-1 block text-sm font-medium text-foreground">会员</label>
          <div>
            <span>{{ formData.memberName || '-' }}</span>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">抬头类型</label>
          <div>
              <Radio v-model="formData.titleType" :value="1">企业单位</Radio>
              <Radio v-model="formData.titleType" :value="2">个人/非企业单位</Radio>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">{{ formData.titleType === 1 ? '公司名称' : '个人姓名' }}</label>
          <div>
            <Input v-model="formData.companyName" :placeholder="formData.titleType === 1 ? '请输入公司名称' : '请输入个人姓名'" />
          </div>
        </div>
        <div class="mb-4" v-if="formData.titleType === 1">
          <label class="mb-1 block text-sm font-medium text-foreground">税号</label>
          <div>
            <Input v-model="formData.companyTaxNumber" placeholder="请输入公司税号" />
          </div>
        </div>
        <div class="mb-4" v-if="formData.titleType === 1">
          <label class="mb-1 block text-sm font-medium text-foreground">公司地址</label>
          <div>
            <Input v-model="formData.companyAddress" placeholder="请输入公司地址（选填）" />
          </div>
        </div>
        <div class="mb-4" v-if="formData.titleType === 1">
          <label class="mb-1 block text-sm font-medium text-foreground">公司电话</label>
          <div>
            <Input v-model="formData.companyPhone" placeholder="请输入公司电话（选填）" />
          </div>
        </div>
        <div class="mb-4" v-if="formData.titleType === 1">
          <label class="mb-1 block text-sm font-medium text-foreground">开户银行</label>
          <div>
            <Input v-model="formData.bankName" placeholder="请输入开户银行（选填）" />
          </div>
        </div>
        <div class="mb-4" v-if="formData.titleType === 1">
          <label class="mb-1 block text-sm font-medium text-foreground">银行账号</label>
          <div>
            <Input v-model="formData.bankAccount" placeholder="请输入银行账号（选填）" />
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">接收邮箱</label>
          <div>
            <Input v-model="formData.email" placeholder="请输入接收电子发票的邮箱" />
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">手机号码</label>
          <div>
            <Input v-model="formData.mobilePhone" placeholder="请输入手机号码（选填）" />
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">设为默认</label>
          <div>
            <Switch v-model="formData.defaultFlag" />
          </div>
        </div>
      </form>
      <DialogFooter>
        <Button variant="outline" @click="dialogVisible = false">取消</Button>
        <Button variant="default" @click="submitForm">确定</Button>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script>
// @ts-nocheck
import Page from "@/components/Page/index.vue"
import { ref, reactive } from "vue"
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Radio } from '@/components/ui/radio'
import { Switch } from '@/components/ui/switch'
import { Tag } from '@/components/ui/tag'
import { Select, SelectOption } from '@/components/ui/select'
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
    Radio,
    Page,
    Button,
    Plus,
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
    Input,
    Tag,
    Select,
    SelectOption,
    Switch
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
