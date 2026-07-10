<template>
  <div class="report">
    <div class="header">
      <form @submit.prevent class="form-inline">
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">课程名称</label>
          <div>
            <Input size="small" @keydown.enter="search" class="search-input" v-model="params.name" placeholder="请输入关键字" />
          </div>
        </div>
        <div class="mb-4 select">
          <label class="mb-1 block text-sm font-medium text-foreground">课程状态</label>
          <div>
            <Select size="small" v-model="params.status" @change="search">
              <SelectOption label="全部" value=""></SelectOption>
              <SelectOption label="未发布" value="unpublished"></SelectOption>
              <SelectOption label="已发布" value="published"></SelectOption>
            </Select>
          </div>
        </div>
        <div class="mb-4 select">
          <label class="mb-1 block text-sm font-medium text-foreground">课程分类</label>
          <div>
            <Select size="small" v-model="selectedCid" @change="search" clearable>
              <SelectOption v-for="item in flatCategoryOptions" :key="item.value" :label="item.label" :value="item.value" />
            </Select>
          </div>
        </div>
        <div class="mb-4">
          <Button size="sm" variant="default" @click="search()">
            <Search class="h-4 w-4" style="vertical-align: middle" />
            <span style="vertical-align: middle">搜索</span>
          </Button>
          <Button size="sm" variant="outline" @click="resetParams()">
            <span style="vertical-align: middle">重置</span>
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
            <TableHead>名称</TableHead>
            <TableHead>进行中</TableHead>
            <TableHead>已完成</TableHead>
            <TableHead>已取消</TableHead>
            <TableHead>报名人数</TableHead>
            <TableHead>报名次数</TableHead>
            <TableHead>平均报名次数</TableHead>
            <TableHead>学习时长</TableHead>
            <TableHead>平均学习时长</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in dataList" :key="index">
            <TableCell>{{ customIndexFn(index) }}</TableCell>
            <TableCell>{{ row.name }}</TableCell>
            <TableCell>{{ row.progressSignQty }}</TableCell>
            <TableCell>{{ row.completedSignQty }}</TableCell>
            <TableCell>{{ row.cancelSignQty }}</TableCell>
            <TableCell>{{ row.totalSignMemberQty }}</TableCell>
            <TableCell>{{ row.totalSignQty }}</TableCell>
            <TableCell>{{ row.avgSignQty }}</TableCell>
            <TableCell>{{ formatSeconds(row.totalLearnTime) }}</TableCell>
            <TableCell>{{ formatSeconds(row.avgLearnTime) }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <page :total="total" :size-change="sizeChange" :current-change="currentChange" :page-size="params.size"/>
    </div>
  </div>
</template>

<script>
import {ref, computed} from "vue"
import Page from "@/components/Page/index.vue";
import {Search} from '@/lib/lucide-fallback';
import { learnApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree } = learnApi;
const { getLessonStudyReport } = learnApi;
import {formatSeconds} from "@/util/dateUtils";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
export default {
  name: "LearnReportLessonIndex",
  methods: {formatSeconds},
  components: {Search, Page, Button, Input, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Select, SelectOption},
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
    const flatCategoryOptions = computed(() => {
      const result = []
      const flatten = (nodes, parentPath = '') => {
        for (const node of nodes) {
          const label = parentPath ? `${parentPath} / ${node.label || node.name}` : (node.label || node.name)
          result.push({ label, value: node.value || node.id })
          if (node.children && node.children.length) { flatten(node.children, label) }
        }
      }
      flatten(categoryOptions.value || [])
      return result
    })
    const selectedCid = computed({
      get: () => { const arr = selectCidList.value; return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : '' },
      set: (val) => { selectCidList.value = [val] }
    })
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
      flatCategoryOptions,
      selectedCid,
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
  }
}
</style>
