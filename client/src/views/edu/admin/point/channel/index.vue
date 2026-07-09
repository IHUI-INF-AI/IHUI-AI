<template>
  <div class="app-container">
    <div class="header">
      <el-form :inline="true" :model="searchParam" class="demo-form-inline">
        <el-form-item label="">
          <Input size="small" class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字"></Input>
          <Button size="sm" className="search-btn" variant="default" @click="search">搜索</Button>
        </el-form-item>
        <el-form-item>
          <Button size="sm" variant="default" @click="add">创建积分渠道</Button>
        </el-form-item>
        <el-form-item>
          <p style="font-size: 10px;padding: 6px;line-height: 14px;background: #e2f7fe;border-radius: 5px;border: 1px solid #d5daf7;">
            <WarningFilled class="h-4 w-4" />
            温馨提示：建议针对积分渠道设置阈值，不限制将导致损失风险
          </p>
        </el-form-item>
      </el-form>
    </div>
    <div class="content">
      <div class="content-list">
        <div v-if="dataLoading" class="loading-div">加载中...</div>
        <Table class="text-sm" style="width: 100%">
          <TableHeader>
            <TableRow>
              <TableHead class="w-[50px]">ID</TableHead>
              <TableHead>渠道名称</TableHead>
              <TableHead>单用户每次发放积分数</TableHead>
              <TableHead>日发放积分数（已发放/阈值）</TableHead>
              <TableHead>单用户日发放积分数</TableHead>
              <TableHead>总发放积分数（已发放/阈值）</TableHead>
              <TableHead class="w-[50px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in list" :key="row.id ?? index">
              <TableCell>{{ row.id }}</TableCell>
              <TableCell>{{ row.name }}</TableCell>
              <TableCell>{{ row.memberReceiveNum || 0 }}</TableCell>
              <TableCell>{{ (row.hasBeenDayIssuedNum || 0) + " / " + (row.dayIssuedNum || "不限制") }}</TableCell>
              <TableCell>{{ row.dayMemberReceiveNum || "不限制" }}</TableCell>
              <TableCell>{{ (row.hasBeenIssuedNum || 0) + " / " + (row.issuedNum || "不限制") }}</TableCell>
              <TableCell>
                <Button variant="link" size="sm" @click="edit(row)">编辑</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
    <page style="margin-top: 20px;" :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
    <Dialog v-model="showChannelFormDialog" @close="hideChannelForm">
      <DialogHeader>
        <DialogTitle>新增/编辑积分</DialogTitle>
      </DialogHeader>
      <el-form :model="pointChannel" :rules="pointChannelRules" ref="pointChannelRef">
        <el-form-item label="名称：" label-width="150px" prop="name">
          <Input size="small" v-model="pointChannel.name" placeholder="请输入名称" autocomplete="off"></Input>
        </el-form-item>
        <el-form-item label="会员每次发放积分数：" label-width="150px" prop="memberReceiveNum">
          <Input size="small" v-model="pointChannel.memberReceiveNum" placeholder="请输入大于0的整数" autocomplete="off"></Input>
        </el-form-item>
        <el-form-item label="日发放积分数：" label-width="150px" prop="dayIssuedNum">
          <Input size="small" v-model="pointChannel.dayIssuedNum" placeholder="请输入大于0的整数，等于0则不限制" autocomplete="off"></Input>
        </el-form-item>
        <el-form-item label="单用户日领取数：" label-width="150px" prop="dayMemberReceiveNum">
          <Input size="small" v-model="pointChannel.dayMemberReceiveNum" placeholder="请输入大于0的整数，等于0则不限制" autocomplete="off"></Input>
        </el-form-item>
        <el-form-item label="总发放积分数：" label-width="150px" prop="issuedNum">
          <Input size="small" v-model="pointChannel.issuedNum" placeholder="请输入大于0的整数，等于0则不限制" autocomplete="off"></Input>
        </el-form-item>
        <el-form-item label="积分变动提醒：" label-width="150px" prop="changeRemind">
          <Switch v-model="pointChannel.changeRemind" />
        </el-form-item>
        <el-form-item label="增加积分提醒：" label-width="150px" prop="increaseRemindTips">
          <Input size="small" v-model="pointChannel.increaseRemindTips" placeholder="积分个数用{coin}表示"></Input>
        </el-form-item>
        <el-form-item label="减少积分提醒：" label-width="150px" prop="decreaseRemindTips">
          <Input size="small" v-model="pointChannel.decreaseRemindTips" placeholder="积分个数用{coin}表示"></Input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <Button size="sm" variant="outline" @click="hideChannelForm">取 消</Button>
          <Button size="sm" variant="default" @click="submitChannel">确 定</Button>
        </div>
      </template>
    </Dialog>
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
  import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
  import Button from '@/components/ui/Button.vue'
  import { Input } from '@/components/ui/input'
  import { Switch } from '@/components/ui/switch'

  export default {
    name: "PointChannelIndex",
    components: {
      Page,
      Button,
      Input,
      Switch,
      WarningFilled: markRaw(WarningFilled),
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
              color: hsl(var(--primary));
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
