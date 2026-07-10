<template>
  <div class="app-container">
    <div class="header">
      <form class="flex flex-wrap items-end gap-4" @submit.prevent>
        <div>
          <Input size="small" class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字"></Input>
          <Button size="sm" className="search-btn" variant="default" @click="search">搜索</Button>
        </div>
        <div class="status">
          <Select size="small" v-model="searchParam.status" @change="search" placeholder="请选择状态">
            <SelectOption label="全部" value=""></SelectOption>
            <SelectOption label="未生效" value="not_effect"></SelectOption>
            <SelectOption label="生效中" value="effect"></SelectOption>
            <SelectOption label="已失效" value="expired"></SelectOption>
          </Select>
        </div>
        <div>
          <Button size="sm" className="search-btn" variant="default" @click="add">创建积分</Button>
        </div>
      </form>
    </div>
    <div class="content">
      <div class="content-list">
        <div v-if="dataLoading" class="loading-div">加载中...</div>
        <Table class="text-sm" style="width: 100%">
          <TableHeader>
            <TableRow>
              <TableHead class="w-[50px]">ID</TableHead>
              <TableHead>积分名称</TableHead>
              <TableHead>有效期</TableHead>
              <TableHead class="w-[100px]">状态</TableHead>
              <TableHead class="w-[130px]">兑换比例</TableHead>
              <TableHead class="w-[120px]">总发放个数</TableHead>
              <TableHead class="w-[120px]">总消耗个数</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in list" :key="row.id ?? index">
              <TableCell>{{ row.id }}</TableCell>
              <TableCell>{{ row.name }}</TableCell>
              <TableCell>{{ row.startDate + " 至 " + row.endDate }}</TableCell>
              <TableCell><div :class="row.status">{{ statusMap[row.status] }}</div></TableCell>
              <TableCell>1元RMB={{ row.redemptionRatio || 0 }}积分</TableCell>
              <TableCell>{{ row.issuedNum || 0 }}</TableCell>
              <TableCell>{{ row.consumedNum || 0 }}</TableCell>
              <TableCell>
                <Button variant="link" size="sm" @click="edit(row)">编辑</Button>
                <Button variant="link" size="sm" @click="editPointChannel(row.id)">管理积分渠道</Button>
                <Button variant="link" size="sm" @click="gotoRecord(row.id)">积分记录</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
    <page style="margin-top: 20px;" :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
    <Dialog v-model="showPointFormDialog" @close="hidePointForm">
      <DialogHeader>
        <DialogTitle>新增/编辑积分</DialogTitle>
      </DialogHeader>
      <form ref="pointRef" @submit.prevent class="space-y-4">
        <div class="flex items-center gap-2">
          <label class="w-28 text-sm text-right">名称：</label>
          <Input size="small" v-model="point.name" placeholder="请输入名称" autocomplete="off"></Input>
        </div>
        <div class="flex items-center gap-2">
          <label class="w-28 text-sm text-right">有效期：</label>
          <div class="flex items-center gap-2">
            <Input type="datetime-local" size="small" v-model="datetime[0]" placeholder="开始日期" @change="datetimeChange" />
            <span class="text-muted-foreground">至</span>
            <Input type="datetime-local" size="small" v-model="datetime[1]" placeholder="结束日期" @change="datetimeChange" />
          </div>
        </div>
        <div class="flex items-center gap-2">
          <label class="w-28 text-sm text-right">兑换比例：</label>
          <Input size="small" v-model="point.redemptionRatio" placeholder="请输入兑换比例，1元可以兑换多少积分"></Input>
        </div>
      </form>
      <template #footer>
        <div class="dialog-footer">
          <Button size="sm" variant="outline" @click="hidePointForm">取 消</Button>
          <Button size="sm" variant="default" @click="submitPoint">确 定</Button>
        </div>
      </template>
    </Dialog>
    <Dialog v-model="showPointChannelFormDialog" @close="hidePointChannelForm">
      <DialogHeader>
        <DialogTitle>管理积分渠道</DialogTitle>
      </DialogHeader>
      <form ref="pointChannelRef" @submit.prevent class="space-y-4">
        <div class="flex items-center gap-2">
          <label class="w-28 text-sm text-right">积分渠道：</label>
          <Select size="small" v-model="pointChannel.channelIdList" multiple clearable placeholder="请选择积分渠道">
            <SelectOption v-for="item in channelOptions" :key="item.value" :label="item.label" :value="item.value" />
          </Select>
        </div>
      </form>
      <template #footer>
        <div class="dialog-footer">
          <Button size="sm" variant="outline" @click="hidePointChannelForm">取 消</Button>
          <Button size="sm" variant="default" @click="submitPointChannel">确 定</Button>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script>
  import { useFormRef } from '@/composables/useFormRef'
  import {ref} from "vue"
  import { pointApi } from '@/api/edu/admin-api'
const { findList, updatePoint, savePoint, findPointChannelRelationList, updatePointChannel, findPointChannelList } = pointApi
  import Page from "@/components/Page/index.vue"
  import {success, error} from "@/util/tipsUtils";
  import router from "@/router";
  import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
  import Button from '@/components/ui/Button.vue'
  import { Input } from '@/components/ui/input'
  import { Select, SelectOption } from '@/components/ui/select'

  export default {
    name: "PointListIndex",
    components: {
      Page,
      Button,
      Input,
      Select,
      SelectOption,
      Table, TableHeader, TableBody, TableRow, TableHead, TableCell
    },
  setup() {
    const statusMap = {
      "not_effect": "未生效",
      "effect": "生效中",
      "expired": "已失效"
    }
    const list = ref([])
    const total = ref(0)
    const dataLoading = ref(true)
    const datetime = ref([null, null])
    const searchParam = ref({
      keyword: "",
      status: "",
      size: 20,
      current: 1
    })
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
    const pointRules = {
      name: [{ required: true, message: "请输入名称", trigger: "blur" }],
      startDate: [{ required: true, message: "请选择有效期", trigger: "blur" }],
      redemptionRatio: [{ required: true, message: "请输入兑换比例", trigger: "blur" }],
    }
    const point = ref({})
    const pointRef = useFormRef()
    const showPointFormDialog = ref(false)
    const datetimeChange = () => {
      if (datetime.value[0]) {
        point.value.startDate = datetime.value[0]
      }
      if (datetime.value[1]) {
        point.value.endDate = datetime.value[1]
      }
    }
    const hidePointForm = () => {
      showPointFormDialog.value = false;
      point.value = {}
      datetime.value = [null, null]
    }
    const add = () => {
      showPointFormDialog.value = true;
    }
    // 编辑
    const edit = (item) => {
      datetime.value = [item.startDate, item.endDate]
      point.value = item
      showPointFormDialog.value = true;
    }
    //提交
    const submitPoint = () => {
      pointRef.value.validate(valid => {
        if (!valid) {
          return false;
        }
        if (point.value.id) {
          if (typeof point.value.startDate === "string") {
            point.value.startDate = new Date(point.value.startDate)
            point.value.endDate = new Date(point.value.endDate)
          }
          updatePoint(point.value, () => {
            success("修改成功")
            loadList()
            hidePointForm()
          });
        } else {
          savePoint(point.value, () => {
            success("新增成功")
            loadList()
            hidePointForm()
          });
        }
      })
    }
    // 管理积分渠道
    const showPointChannelFormDialog = ref(false)
    const pointChannel = ref({})
    const pointChannelRef = useFormRef()
    const hidePointChannelForm = () => {
      showPointChannelFormDialog.value = false;
      pointChannel.value = {}
    }
    const channelOptions = ref([])
    findPointChannelList({}, (res) => {
      if (res && res.length) {
        for (const listElement of res) {
          channelOptions.value.push({label: listElement.name, value: listElement.id})
        }
      }
    })
    // 编辑
    const editPointChannel = (id) => {
      findPointChannelRelationList({pointId: id}, (res) => {
        if (res && res.length) {
          for (const listElement of res) {
            if (!pointChannel.value.channelIdList) {
              pointChannel.value.channelIdList = []
            }
            pointChannel.value.channelIdList.push(listElement.channelId)
          }
        }
      })
      pointChannel.value.pointId = id
      showPointChannelFormDialog.value = true;
    }
    //提交
    const submitPointChannel = () => {
      pointChannelRef.value.validate(valid => {
        if (!valid) {
          return false;
        }
        if (!pointChannel.value.channelIdList || !pointChannel.value.channelIdList.length) {
          error("积分渠道为必填项")
          return;
        }
        updatePointChannel(pointChannel.value, () => {
          success("管理积分渠道成功")
          hidePointChannelForm()
        })
      })
    }
    const gotoRecord = (id) => {
      router.push({path: "/admin/edu/point/record", query: {pointId: id}})
    }
    return {
      list,
      total,
      searchParam,
      search,
      currentChange,
      sizeChange,
      showPointFormDialog,
      add,
      point,
      pointRef,
      edit,
      hidePointForm,
      submitPoint,
      pointRules,
      statusMap,
      dataLoading,
      datetime,
      datetimeChange,
      pointChannel,
      pointChannelRef,
      showPointChannelFormDialog,
      hidePointChannelForm,
      editPointChannel,
      submitPointChannel,
      channelOptions,
      gotoRecord
    }
  }
}
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
      .not_effect {
        border-color: #999999;
        color: #999999;
      }
      .effect {
        border-color: greenyellow;
        color: greenyellow;
      }
      .expired {
        border-color: red;
        color: red;
      }
    }
    .search-input {
      width: 242px;
    }
  }
</style>
