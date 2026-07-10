<template>
  <div class="app-container">
    <div class="header">
      <form class="flex flex-wrap items-end gap-4" @submit.prevent>
        <div>
          <div class="flex items-center gap-2">
            <Input type="datetime-local" size="small" v-model="datetime[0]" placeholder="开始日期" @change="datetimeChange" />
            <span class="text-muted-foreground">至</span>
            <Input type="datetime-local" size="small" v-model="datetime[1]" placeholder="结束日期" @change="datetimeChange" />
          </div>
        </div>
        <div>
          <Input size="small" class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字"></Input>
          <Button size="sm" className="search-btn" variant="default" @click="search">搜索</Button>
        </div>
        <div>
          <Select size="small" v-model="searchParam.type" @change="search" placeholder="请选择类型">
            <SelectOption label="全部" value=""></SelectOption>
            <SelectOption label="增加积分" value="increase"></SelectOption>
            <SelectOption label="消耗积分" value="decrease"></SelectOption>
            <SelectOption label="回退积分" value="fallback"></SelectOption>
            <SelectOption label="回收积分" value="recycle"></SelectOption>
          </Select>
        </div>
      </form>
    </div>
    <div class="content">
      <div class="content-list">
        <div v-if="dataLoading" class="loading-div">加载中...</div>
        <Table class="text-sm" style="width: 100%">
          <TableHeader>
            <TableRow>
              <TableHead class="w-[60px]">积分ID</TableHead>
              <TableHead>积分个数</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>会员ID</TableHead>
              <TableHead>手机号</TableHead>
              <TableHead>发放/消耗时间</TableHead>
              <TableHead>发放/消耗原因</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in list" :key="row.id ?? index">
              <TableCell>{{ row.pointId }}</TableCell>
              <TableCell>{{ row.pointNum }}</TableCell>
              <TableCell>{{ typeMap[row.type] }}</TableCell>
              <TableCell>{{ row.memberId }}</TableCell>
              <TableCell>{{ row.mobile }}</TableCell>
              <TableCell>{{ row.createTime }}</TableCell>
              <TableCell>{{ row.remark }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
    <page style="margin-top: 20px;" :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
  </div>
</template>

<script>
  import {ref} from "vue"
  import { pointApi } from '@/api/edu/admin-api'
const { findList } = pointApi
  import Page from "@/components/Page/index.vue"
  import {formatDate} from "@/util/dateUtils";
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
  import Button from '@/components/ui/Button.vue'
  import { Input } from '@/components/ui/input'
  import { Select, SelectOption } from '@/components/ui/select'

  export default {
    name: "PointRecordIndex",
    components: {
      Page,
      Button,
      Input,
      Select,
      SelectOption,
      Table, TableHeader, TableBody, TableRow, TableHead, TableCell
    },
    setup() {
      const typeMap = {
        increase: "增加积分",
        decrease: "消耗积分",
        fallback: "回退积分",
        recycle: "回收积分"
      }
      const list = ref([])
      const total = ref(0)
      const datetime = ref([null, null])
      const dataLoading = ref(true)
      const searchParam = ref({
        startDate: "",
        endDate: "",
        keyword: "",
        type: "",
        size: 20,
        current: 1
      })
      const datetimeChange = () => {
        if (datetime.value[0]) {
          searchParam.value.startDate = formatDate(datetime.value[0])
        } else {
          searchParam.value.startDate = null
        }
        if (datetime.value[1]) {
          searchParam.value.endDate = formatDate(datetime.value[1])
        } else {
          searchParam.value.endDate = null
        }
        loadList();
      }
      // 加载列表
      const loadList = () => {
        dataLoading.value = true
        findList(searchParam.value, (res) => {
          dataLoading.value = false
          if (!res) {return;}
          list.value = res.list;
          total.value = res.total;
        })
      }
      loadList();
      const currentChange = (currentPage) => {
        searchParam.value.current = currentPage;
        loadList();
      }
      const sizeChange = (s) => {
        searchParam.value.size = s;
        loadList();
      }
      // 搜索
      const search = () => {
        loadList();
      }
      return {
        list,
        total,
        searchParam,
        search,
        currentChange,
        sizeChange,
        typeMap,
        dataLoading,
        datetime,
        datetimeChange
      };
    }
  };
</script>

<style scoped lang="scss">
  .app-container {
    margin: 20px;
    .content-list {
      margin: 0;
      padding: 0;
      border: 0;
      font: inherit;
      vertical-align: baseline;
    }
    .search-input {
      width: 242px;
    }
  }
</style>
