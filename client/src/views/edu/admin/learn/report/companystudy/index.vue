<template>
  <div class="report">
    <div class="header">
      <form @submit.prevent class="form-inline">
        <div class="mb-4" v-if="memberCompanyList && memberCompanyList.length">
          <label class="mb-1 block text-sm font-medium text-foreground">公司</label>
          <div>
            <Select v-model="params.companyIdList" clearable multiple @change="search">
              <SelectOption label="全部" value=""></SelectOption>
              <SelectOption v-for="company in memberCompanyList" :label="company.name"  :value="company.id" :key="company.id"></SelectOption>
            </Select>
          </div>
        </div>
        <div class="mb-4 select">
          <label class="mb-1 block text-sm font-medium text-foreground">年份</label>
          <div>
            <Input @keydown.enter="search" class="search-input" v-model="params.year" placeholder="请输入年份"></Input>
          </div>
        </div>
        <div class="mb-4">
          <Button variant="default" @click="search()">
            <Search class="h-4 w-4" style="vertical-align: middle" />
            <span style="vertical-align: middle">搜索</span>
          </Button>
          <Button variant="outline" @click="resetParams()">
            <span style="vertical-align: middle;">重置</span>
          </Button>
        </div>
      </form>
    </div>
    <div class="report-main">
      <div v-if="loading">加载中...</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>序号</TableHead>
            <TableHead>公司</TableHead>
            <TableHead>年份</TableHead>
            <TableHead>报名会员数</TableHead>
            <TableHead>报名次数</TableHead>
            <TableHead>已取得证书的会员数量</TableHead>
            <TableHead>取得的证书数量</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in dataList" :key="index">
            <TableCell>{{ customIndexFn(index) }}</TableCell>
            <TableCell>{{ row.companyName }}</TableCell>
            <TableCell>{{ row.year }}</TableCell>
            <TableCell>{{ row.signUpMemberQty }}</TableCell>
            <TableCell>{{ row.signUpQty }}</TableCell>
            <TableCell>{{ row.certificateMemberQty }}</TableCell>
            <TableCell>{{ row.certificateQty }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <page :total="total" :size-change="sizeChange" :current-change="currentChange" :page-size="params.size"/>
    </div>
  </div>
</template>

<script>
// @ts-nocheck
import {ref} from "vue"
import Page from "@/components/Page/index.vue";
import {Search} from '@/lib/lucide-fallback';
import { learnApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree } = learnApi;
const { getCompanyStudyReport } = learnApi;
import {formatSeconds} from "@/util/dateUtils";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
import { memberApi } from '@/api/edu/admin-api'
const { findMemberCompanyList } = memberApi;
export default {
  name: "LearnReportIndex",
  methods: {formatSeconds},
  components: {Search, Page, Button, Input, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Select, SelectOption},
  setup() {
    const loading = ref(true)
    const total = ref(0)
    const dataList = ref([])
    const c = {
      current: 1,
      size: 20,
      companyIdList: [],
      year: ''
    }
    const params = ref(c)
    const selectCidList = ref([])
    const categoryOptions = ref([])
    // 加载分类
    const loadCategory = () => {
      findCategoryList(0, true, (res) => {if (res) { categoryOptions.value = toTree(res);}})
    }
    loadCategory();

    const loadList = () => {
      loading.value = true
      getCompanyStudyReport(params.value, res => {
        dataList.value = res.list
        total.value = res.total
        loading.value = false
      }).catch(() => {
        loading.value = false
      })
    }
    loadList()
    const currentChange = (c) => {
      params.value.current = c;
      loadList();
    }
    const sizeChange = (s) => {
      params.value.size = s;
      loadList();
    }
    const search = () => {
      if (selectCidList.value && selectCidList.value.length > 0) {
        params.value.cid = selectCidList.value[selectCidList.value.length - 1];
      }
      params.value.current = 1
      loadList()
    }
    const resetParams = () => {
      params.value = c
    }
    const customIndexFn = (index) => {
      return (params.value.current - 1) * params.value.size + index + 1;
    }
    const memberCompanyList = ref([])
    findMemberCompanyList({current: 1, size: 10000}, resp => {
      memberCompanyList.value = resp.list
    })
    return {
      memberCompanyList,
      customIndexFn,
      loading,
      dataList,
      selectCidList,
      categoryOptions,
      params,
      total,
      currentChange,
      sizeChange,
      search,
      resetParams
    };
  }
};
</script>

<style scoped lang="scss">
.report {
  margin: 20px;
  font-size: 12px;
  .report-main {
    :deep(.el-table){
      font-size: 12px;
      .el-table__empty-block {
        line-height: 400px;
        .el-table__empty-text {
          line-height: 400px;
        }
      }
      th, td {
        padding: 6px 0;
      }
    }
  }
}
</style>
