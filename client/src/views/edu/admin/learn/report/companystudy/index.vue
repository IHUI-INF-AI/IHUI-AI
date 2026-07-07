<template>
  <div class="report">
    <div class="header">
      <el-form :inline="true" :model="params" class="form-inline">
        <el-form-item label="公司" v-if="memberCompanyList && memberCompanyList.length">
          <el-select v-model="params.companyIdList" clearable multiple filterable @change="search">
            <el-option label="全部" value=""></el-option>
            <el-option v-for="company in memberCompanyList" :label="company.name"  :value="company.id" :key="company.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="年份" class="select">
          <el-input @keydown.enter="search" class="search-input" v-model="params.year" placeholder="请输入年份"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="search()">
            <el-icon style="vertical-align: middle">
              <Search />
            </el-icon>
            <span style="vertical-align: middle">搜索</span>
          </el-button>
          <el-button @click="resetParams()">
            <span style="vertical-align: middle;">重置</span>
          </el-button>
        </el-form-item>
      </el-form>
    </div>
    <div class="report-main">
      <el-table :data="dataList" v-loading="loading">
        <el-table-column label="序号" type="index" :index="customIndexFn"></el-table-column>
        <el-table-column label="公司" prop="companyName"></el-table-column>
        <el-table-column label="年份" prop="year"></el-table-column>
        <el-table-column label="报名会员数" prop="signUpMemberQty"></el-table-column>
        <el-table-column label="报名次数" prop="signUpQty"></el-table-column>
        <el-table-column label="已取得证书的会员数量" prop="certificateMemberQty"></el-table-column>
        <el-table-column label="取得的证书数量" prop="certificateQty"></el-table-column>
<!--        <el-table-column label="公司总会员数" prop="memberQty"></el-table-column>-->
      </el-table>
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
import { memberApi } from '@/api/edu/admin-api'
const { findMemberCompanyList } = memberApi;
export default {
  name: "LearnReportIndex",
  methods: {formatSeconds},
  components: {Search, Page},
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
