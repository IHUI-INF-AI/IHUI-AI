<template>
  <div class="app-container">
    <div class="header">
      <form @submit.prevent class="demo-form-inline">
        <div class="mb-4">
          <Input class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字"></Input>
          <Button className="search-btn" variant="default" @click="search">搜索</Button>
        </div>
        <div class="mb-4">
          <Button variant="default" @click="add">创建会员等级</Button>
        </div>
      </form>
    </div>
    <div class="content">
      <div class="content-list">
        <div v-if="dataLoading" class="loading">加载中...</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-[70px]">序号</TableHead>
              <TableHead class="w-[50px]">ID</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>达成条件</TableHead>
              <TableHead class="w-[150px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in list" :key="row.id ?? index">
              <TableCell>{{ index + 1 }}</TableCell>
              <TableCell>{{ row.id }}</TableCell>
              <TableCell>{{ row.name }}</TableCell>
              <TableCell>{{ row.description }}</TableCell>
              <TableCell>{{row.conditions || 0}} 积分</TableCell>
              <TableCell>
                <Button variant="link" @click="edit(row)">编辑</Button>
                <Button variant="link" @click="remove(row)" style="color: red;">删除</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
    <page style="margin-top: 20px;" :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
    <Dialog v-model="showMemberLevelFormDialog" @close="hideMemberLevelForm">
      <DialogHeader>
        <DialogTitle>新增/编辑积分</DialogTitle>
      </DialogHeader>
      <form ref="memberLevelRef" @submit.prevent>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">名称：</label>
          <div>
            <Input v-model="memberLevel.name" placeholder="请输入名称" autocomplete="off"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">描述：</label>
          <div>
            <Input v-model="memberLevel.description" placeholder="请输入描述" autocomplete="off"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">达成条件：</label>
          <div>
            <Input v-model="memberLevel.conditions" placeholder="请输入大于0的整数" autocomplete="off"></Input>
          </div>
        </div>
      </form>
      <template #footer>
        <div class="dialog-footer">
          <Button variant="outline" @click="hideMemberLevelForm">取 消</Button>
          <Button variant="default" @click="submitMemberLevel">确 定</Button>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script>
// @ts-nocheck
  import {ref} from "vue"
  import { memberApi } from '@/api/edu/admin-api'
const { findList, updateLevel, saveLevel, deleteLevel } = memberApi
  import Page from "@/components/Page/index.vue"
  import {confirm, success} from "@/util/tipsUtils";
  import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
  import Button from '@/components/ui/Button.vue'
  import { Input } from '@/components/ui/input'

  export default {
    name: "MemberLevelIndex",
    components: {
      Page,
      Table,
      TableHeader,
      TableBody,
      TableRow,
      TableHead,
      TableCell,
      Button,
      Input
    },
    setup() {
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
      const memberLevelRules = {
        name: [{ required: true, message: "请输入名称", trigger: "blur" }],
        description: [{ required: true, message: "请输入描述", trigger: "blur" }],
        conditions: [{ required: true, message: "请输入达成条件", trigger: "blur" }],
      }
      const memberLevel = ref({})
      const memberLevelRef = ref(null)
      const showMemberLevelFormDialog = ref(false)
      const hideMemberLevelForm = () => {
        showMemberLevelFormDialog.value = false;
        memberLevel.value = {}
      }
      const add = () => {
        showMemberLevelFormDialog.value = true;
      }
      // 编辑
      const edit = (item) => {
        memberLevel.value = item
        showMemberLevelFormDialog.value = true;
      }
      //提交
      const submitMemberLevel = () => {
        memberLevelRef.value.validate(valid => {
          if (!valid) {
            return false;
          }
          if (memberLevel.value.id) {
            updateLevel(memberLevel.value, () => {
              success("修改成功")
              loadList()
              hideMemberLevelForm()
            });
          } else {
            saveLevel(memberLevel.value, () => {
              success("新增成功")
              loadList()
              hideMemberLevelForm()
            });
          }
        })
      }
      const remove = (item) => {
        confirm("确认永久删除吗？", "提示", () => {
          deleteLevel({id: item.id}, () => {
            success("修改成功")
            loadList()
          })
        }, () => {
        })
      }
      return {
        remove,
        list,
        total,
        searchParam,
        search,
        currentChange,
        sizeChange,
        showMemberLevelFormDialog,
        add,
        memberLevel,
        memberLevelRef,
        edit,
        hideMemberLevelForm,
        submitMemberLevel,
        memberLevelRules,
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
