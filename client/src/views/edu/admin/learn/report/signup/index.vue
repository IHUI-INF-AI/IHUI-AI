<template>
  <div class="report">
    <div class="header">
      <form @submit.prevent class="form-inline">
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">课程名称：</label>
          <div>
            <Input
                size="small"
                @keydown.enter="search"
                class="search-input"
                v-model="params.name"
                placeholder="请输入关键字"
                style="width: 300px;"
            />
          </div>
        </div>
        <div class="mb-4 select">
          <label class="mb-1 block text-sm font-medium text-foreground">课程状态：</label>
          <div>
            <el-select
                size="small"
                v-model="params.status"
                @change="search"
                style="width: 300px;"
            >
              <el-option label="全部" value=""></el-option>
              <el-option label="未发布" value="unpublished"></el-option>
              <el-option label="已发布" value="published"></el-option>
            </el-select>
          </div>
        </div>
        <div class="mb-4 select">
          <label class="mb-1 block text-sm font-medium text-foreground">课程分类：</label>
          <div>
            <el-cascader
                size="small"
                v-model="selectCidList"
                :options="categoryOptions"
                :props="{ checkStrictly: true }"
                @change="search"
                clearable
                style="width: 300px;"
            ></el-cascader>
          </div>
        </div>
        <div class="mb-4">
          <Button size="sm" variant="default" @click="search()">
            <Search class="h-4 w-4" style="vertical-align: middle; margin-right: 4px;" />
            <span style="vertical-align: middle;">搜索</span>
          </Button>
          <Button size="sm" variant="outline" @click="resetParams()">重置</Button>
        </div>
      </form>
    </div>
    <div class="report-main">
      <div v-if="loading" class="loading-overlay">加载中...</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>序号</TableHead>
            <TableHead>名称</TableHead>
            <TableHead>今日报名人数</TableHead>
            <TableHead>今日报名次数</TableHead>
            <TableHead>总报名人数</TableHead>
            <TableHead>总报名次数</TableHead>
            <TableHead>取消报名数</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in dataList" :key="row.id ?? index">
            <TableCell>{{ customIndexFn(index) }}</TableCell>
            <TableCell>{{ row.name }}</TableCell>
            <TableCell>{{ row.todaySignMemberQty }}</TableCell>
            <TableCell>{{ row.todaySignQty }}</TableCell>
            <TableCell>{{ row.totalSignMemberQty }}</TableCell>
            <TableCell>{{ row.totalSignQty }}</TableCell>
            <TableCell>{{ row.cancelSignQty }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div style="width: 100%; text-align: center;"><page :total="total" :size-change="sizeChange" :current-change="currentChange" :page-size="params.size"/></div>
    </div>
  </div>
</template>

<script>
// @ts-nocheck
import { ref } from "vue"
import Page from "@/components/Page/index.vue";
import { Search } from '@/lib/lucide-fallback';
import { learnApi } from '@/api/edu/admin-api'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
const { findCategoryList, toTree } = learnApi;
const { getLessonSignReport } = learnApi;
export default {
  name: "LearnSignUpReport",
  components: { Search, Page, Button, Input, Table, TableHeader, TableBody, TableRow, TableHead, TableCell },
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
      findCategoryList(0, true, (res) => {
        if (res) {
          categoryOptions.value = toTree(res);
        }
      })
    }
    loadCategory();

    const loadList = () => {
      loading.value = true
      getLessonSignReport(params.value, res => {
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

  .header {
    // 关键：通过 Flex 布局强制表单项在同一行
    :deep(.form-inline){
      display: flex;
      flex-wrap: nowrap; // 禁止换行，强制一行显示
      align-items: center; // 垂直居中对齐
      gap: 15px; // 表单项之间的间距（比 margin 更简洁）
      width: 100%; // 确保容器宽度足够容纳所有项
      overflow-x: auto; // 当屏幕过窄时，允许横向滚动避免挤压
      padding-bottom: 10px; // 滚动条预留空间
    }

    // 统一表单项内部组件样式，确保垂直对齐
    :deep(.el-form-item){
      margin: 0; // 清除默认 margin 干扰
      white-space: nowrap; // 防止标签和组件换行

      .el-input,
      .el-select,
      .el-cascader {
        height: 32px; // 统一高度（small 尺寸默认高度）
        vertical-align: middle;
      }
    }
  }

  .report-main {
    :deep(.el-table){
      font-size: 12px;
      // 斑马纹样式
      tbody tr:nth-child(even) {
        background-color: #D9DBFE;
      }
      tbody tr:nth-child(odd) {
        background-color: #ffffff;
      }
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