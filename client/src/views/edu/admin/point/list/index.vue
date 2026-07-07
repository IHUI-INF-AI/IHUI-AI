<template>
  <div class="app-container">
    <div class="header">
      <el-form :inline="true" :model="searchParam" class="demo-form-inline">
        <el-form-item label="">
          <el-input size="small" class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字"></el-input>
          <el-button size="small" class="search-btn" type="primary" @click="search">搜索</el-button>
        </el-form-item>
        <el-form-item class="status">
          <el-select size="small" v-model="searchParam.status" @change="search" placeholder="请选择状态">
            <el-option label="全部" value=""></el-option>
            <el-option label="未生效" value="not_effect"></el-option>
            <el-option label="生效中" value="effect"></el-option>
            <el-option label="已失效" value="expired"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button size="small" class="search-btn" type="primary" @click="add">创建积分</el-button>
        </el-form-item>
      </el-form>
    </div>
    <div class="content">
      <div class="content-list">
        <el-table v-loading="dataLoading" :data="list" size="small" style="width: 100%;">
          <el-table-column prop="id" label="ID" width="50"/>
          <el-table-column prop="name" label="积分名称"/>
          <el-table-column label="有效期">
            <template #default="scope">
              {{scope.row.startDate + " 至 " + scope.row.endDate}}
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100">
            <template #default="scope">
              <div :class="scope.row.status">{{statusMap[scope.row.status]}}</div>
            </template>
          </el-table-column>
          <el-table-column prop="redemptionRatio" label="兑换比例" width="130">
            <template #default="scope">
              1元RMB={{scope.row.redemptionRatio || 0}}积分
            </template>
          </el-table-column>
          <el-table-column prop="issuedNum" label="总发放个数" width="120">
            <template #default="scope">
              {{scope.row.issuedNum || 0}}
            </template>
          </el-table-column>
          <el-table-column prop="consumedNum" label="总消耗个数" width="120">
            <template #default="scope">
              {{scope.row.consumedNum || 0}}
            </template>
          </el-table-column>
          <el-table-column label="操作">
            <template #default="scope">
              <el-button link size="small" @click="edit(scope.row)">编辑</el-button>
              <el-button link size="small" @click="editPointChannel(scope.row.id)">管理积分渠道</el-button>
              <el-button link size="small" @click="gotoRecord(scope.row.id)">积分记录</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
    <page style="margin-top: 20px;" :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
    <el-dialog title="新增/编辑积分" v-model="showPointFormDialog" :before-close="hidePointForm">
      <el-form :model="point" :rules="pointRules" ref="pointRef">
        <el-form-item label="名称：" label-width="120px" prop="name">
          <el-input size="small" v-model="point.name" placeholder="请输入名称" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="有效期：" label-width="120px" prop="startDate">
          <el-date-picker size="small" v-model="datetime" @change="datetimeChange" type="datetimerange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期"></el-date-picker>
        </el-form-item>
        <el-form-item label="兑换比例：" label-width="120px" prop="redemptionRatio">
          <el-input size="small" v-model="point.redemptionRatio" placeholder="请输入兑换比例，1元可以兑换多少积分"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" @click="hidePointForm">取 消</el-button>
          <el-button size="small" type="primary" @click="submitPoint">确 定</el-button>
        </div>
      </template>
    </el-dialog>
    <el-dialog title="管理积分渠道" v-model="showPointChannelFormDialog" :before-close="hidePointChannelForm">
      <el-form :model="pointChannel" ref="pointChannelRef">
        <el-form-item label="积分渠道：" label-width="120px" prop="name">
          <el-cascader size="small" v-model="pointChannel.channelIdList" :options="channelOptions" :props="{ checkStrictly: true, multiple: true }" clearable></el-cascader>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" @click="hidePointChannelForm">取 消</el-button>
          <el-button size="small" type="primary" @click="submitPointChannel">确 定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
// @ts-nocheck
  import {ref} from "vue"
  import { pointApi } from '@/api/edu/admin-api'
const { findList, updatePoint, savePoint, findPointChannelRelationList, updatePointChannel, findPointChannelList } = pointApi
  import Page from "@/components/Page/index.vue"
  import {success, error} from "@/util/tipsUtils";
  import router from "@/router";

  export default {
    name: "PointListIndex",
  components: {
    Page
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
    const datetime = ref(null)
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
    const pointRef = ref(null)
    const showPointFormDialog = ref(false)
    const datetimeChange = (value) => {
      if (value && value.length) {
        point.value.startDate = value[0]
        point.value.endDate = value[1]
      }
    }
    const hidePointForm = () => {
      showPointFormDialog.value = false;
      point.value = {}
      datetime.value = null
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
    const pointChannelRef = ref(null)
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
            pointChannel.value.channelIdList.push([listElement.channelId])
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
        const idList = []
        for (const channelIdListElement of pointChannel.value.channelIdList) {
          idList.push(channelIdListElement[0])
        }
        pointChannel.value.channelIdList = idList
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

<style lang="scss">
  .header {
    .el-form {
      .el-form-item {
        .el-form-item__label {
          line-height: 28px;
        }
        .el-form-item__content {
          line-height: 28px;
          .search-btn {
            &:hover {
              color: var(--el-color-primary);
            }
          }
        }
      }
    }
  }
</style>
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
