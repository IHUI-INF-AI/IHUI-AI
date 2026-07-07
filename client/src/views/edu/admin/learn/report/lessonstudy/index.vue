<template>
  <div class="report">
    <div class="header">
      <el-form :inline="true" :model="params" class="form-inline">
        <el-form-item label="课程名称">
          <el-input size="small" @keydown.enter="search" class="search-input" v-model="params.name" placeholder="请输入关键字">
            <template #suffix>
              <el-icon class="el-input__icon search-btn" @click="search"><Search /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="课程状态" class="select">
          <el-select size="small" v-model="params.status" @change="search">
            <el-option label="全部" value=""></el-option>
            <el-option label="未发布" value="unpublished"></el-option>
            <el-option label="已发布" value="published"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="课程分类" class="select">
          <el-cascader size="small" v-model="selectCidList" :options="categoryOptions" :props="{ checkStrictly: true }" @change="search" clearable></el-cascader>
        </el-form-item>
        <el-form-item>
          <el-button size="small" type="primary" @click="search()">
            <el-icon style="vertical-align: middle">
              <Search />
            </el-icon>
            <span style="vertical-align: middle">搜索</span>
          </el-button>
          <el-button size="small" @click="resetParams()">
            <span style="vertical-align: middle">重置</span>
          </el-button>
        </el-form-item>
      </el-form>
    </div>
    <div class="report-main">
      <el-table :data="dataList" v-loading="loading">
        <el-table-column label="序号" type="index" :index="customIndexFn"></el-table-column>
        <el-table-column label="名称" prop="name"></el-table-column>
        <el-table-column label="进行中" prop="progressSignQty"></el-table-column>
        <el-table-column label="已完成" prop="completedSignQty"></el-table-column>
        <el-table-column label="已取消" prop="cancelSignQty"></el-table-column>
        <el-table-column label="报名人数" prop="totalSignMemberQty"></el-table-column>
        <el-table-column label="报名次数" prop="totalSignQty"></el-table-column>
        <el-table-column label="平均报名次数" prop="avgSignQty"></el-table-column>
        <el-table-column label="学习时长" prop="totalLearnTime">
          <template #default="scope">
            {{formatSeconds(scope.row.totalLearnTime) }}
          </template>
        </el-table-column>
        <el-table-column label="平均学习时长" prop="avgLearnTime">
          <template #default="scope">
            {{formatSeconds(scope.row.avgLearnTime) }}
          </template>
        </el-table-column>
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
const { getLessonStudyReport } = learnApi;
import {formatSeconds} from "@/util/dateUtils";
export default {
  name: "LearnReportLessonIndex",
  methods: {formatSeconds},
  components: {Search, Page},
  setup() {
    const loading = ref(true)
    const total = ref(0)
    const dataList = ref([])
    const c = {
      current: 1,
      size: 20
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
      getLessonStudyReport(params.value, res => {
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
    return {
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
