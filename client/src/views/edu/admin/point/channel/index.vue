<template>
  <div class="app-container">
    <div class="header">
      <el-form :inline="true" :model="searchParam" class="demo-form-inline">
        <el-form-item label="">
          <el-input size="small" class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字"></el-input>
          <el-button size="small" class="search-btn" type="primary" @click="search">搜索</el-button>
        </el-form-item>
        <el-form-item>
          <el-button size="small" type="primary" @click="add">创建积分渠道</el-button>
        </el-form-item>
        <el-form-item>
          <p style="font-size: 10px;padding: 6px;line-height: 14px;background: #e2f7fe;border-radius: 5px;border: 1px solid #d5daf7;">
            <el-icon><WarningFilled /></el-icon>
            温馨提示：建议针对积分渠道设置阈值，不限制将导致损失风险
          </p>
        </el-form-item>
      </el-form>
    </div>
    <div class="content">
      <div class="content-list">
        <el-table v-loading="dataLoading" :data="list" size="small" style="width: 100%;">
          <el-table-column prop="id" label="ID" width="50"/>
          <el-table-column prop="name" label="渠道名称"/>
          <el-table-column prop="status" label="单用户每次发放积分数">
            <template #default="scope">
              {{scope.row.memberReceiveNum || 0}}
            </template>
          </el-table-column>
          <el-table-column label="日发放积分数（已发放/阈值）">
            <template #default="scope">
              {{(scope.row.hasBeenDayIssuedNum || 0) + " / " + (scope.row.dayIssuedNum || "不限制")}}
            </template>
          </el-table-column>
          <el-table-column prop="status" label="单用户日发放积分数">
            <template #default="scope">
              {{scope.row.dayMemberReceiveNum || "不限制"}}
            </template>
          </el-table-column>
          <el-table-column prop="redemptionRatio" label="总发放积分数（已发放/阈值）">
            <template #default="scope">
              {{(scope.row.hasBeenIssuedNum || 0) + " / " + (scope.row.issuedNum || "不限制")}}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="50">
            <template #default="scope">
              <el-button link size="small" @click="edit(scope.row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
    <page style="margin-top: 20px;" :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
    <el-dialog title="新增/编辑积分" v-model="showChannelFormDialog" :before-close="hideChannelForm">
      <el-form :model="pointChannel" :rules="pointChannelRules" ref="pointChannelRef">
        <el-form-item label="名称：" label-width="150px" prop="name">
          <el-input size="small" v-model="pointChannel.name" placeholder="请输入名称" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="会员每次发放积分数：" label-width="150px" prop="memberReceiveNum">
          <el-input size="small" v-model="pointChannel.memberReceiveNum" placeholder="请输入大于0的整数" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="日发放积分数：" label-width="150px" prop="dayIssuedNum">
          <el-input size="small" v-model="pointChannel.dayIssuedNum" placeholder="请输入大于0的整数，等于0则不限制" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="单用户日领取数：" label-width="150px" prop="dayMemberReceiveNum">
          <el-input size="small" v-model="pointChannel.dayMemberReceiveNum" placeholder="请输入大于0的整数，等于0则不限制" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="总发放积分数：" label-width="150px" prop="issuedNum">
          <el-input size="small" v-model="pointChannel.issuedNum" placeholder="请输入大于0的整数，等于0则不限制" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="积分变动提醒：" label-width="150px" prop="changeRemind">
          <el-switch v-model="pointChannel.changeRemind" active-color="#07c160" inactive-color="#cccccc"></el-switch>
        </el-form-item>
        <el-form-item label="增加积分提醒：" label-width="150px" prop="increaseRemindTips">
          <el-input size="small" v-model="pointChannel.increaseRemindTips" placeholder="积分个数用{coin}表示"></el-input>
        </el-form-item>
        <el-form-item label="减少积分提醒：" label-width="150px" prop="decreaseRemindTips">
          <el-input size="small" v-model="pointChannel.decreaseRemindTips" placeholder="积分个数用{coin}表示"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" @click="hideChannelForm">取 消</el-button>
          <el-button size="small" type="primary" @click="submitChannel">确 定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
// @ts-nocheck
  import {ref, markRaw} from "vue"
  import { pointApi } from '@/api/edu/admin-api'
const { findList, updateChannel, saveChannel } = pointApi
  import Page from "@/components/Page/index.vue"
  import {success} from "@/util/tipsUtils";
  import {WarningFilled} from '@/lib/lucide-fallback'

  export default {
    name: "PointChannelIndex",
    components: {
      Page,
      WarningFilled: markRaw(WarningFilled)
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
      const searchParam = ref({
        keyword: "",
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
      const pointChannelRules = {
        name: [{ required: true, message: "请输入名称", trigger: "blur" }],
        memberReceiveNum: [{ required: true, message: "请输入会员每次发放积分数", trigger: "blur" }],
        changeRemind: [{ required: true, message: "请选择积分变动提醒", trigger: "blur" }],
        dayIssuedNum: [{ required: true, message: "请输入日发放积分数", trigger: "blur" }],
        dayMemberReceiveNum: [{ required: true, message: "请输入单用户日领取数", trigger: "blur" }],
        issuedNum: [{ required: true, message: "请输入总发放积分数", trigger: "blur" }],
        increaseRemindTips: [{ required: true, message: "请输入增加积分提醒", trigger: "blur" }],
        decreaseRemindTips: [{ required: true, message: "请输入减少积分提醒", trigger: "blur" }],
      }
      const pointChannel = ref({})
      const pointChannelRef = ref(null)
      const showChannelFormDialog = ref(false)
      const hideChannelForm = () => {
        showChannelFormDialog.value = false;
        pointChannel.value = {}
      }
      const add = () => {
        showChannelFormDialog.value = true;
      }
      // 编辑
      const edit = (item) => {
        pointChannel.value = item
        showChannelFormDialog.value = true;
      }
      //提交
      const submitChannel = () => {
        pointChannelRef.value.validate(valid => {
          if (!valid) {
            return false;
          }
          if (pointChannel.value.id) {
            updateChannel(pointChannel.value, () => {
              success("修改成功")
              loadList()
              hideChannelForm()
            });
          } else {
            saveChannel(pointChannel.value, () => {
              success("新增成功")
              loadList()
              hideChannelForm()
            });
          }
        })
      }
      return {
        list,
        total,
        searchParam,
        search,
        currentChange,
        sizeChange,
        showChannelFormDialog,
        add,
        pointChannel,
        pointChannelRef,
        edit,
        hideChannelForm,
        submitChannel,
        pointChannelRules,
        statusMap,
        dataLoading,
      };
    }
  };
</script>
<style lang="scss">
  .header {
    .el-form {
      .el-form-item {
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
    }
    .search-input {
      width: 242px;
    }
  }
</style>
