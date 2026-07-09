<template>
  <div class="app-container">
    <div class="header">
      <form @submit.prevent class="demo-form-inline">
        <div class="mb-4">
          <Input class="search-input" v-model="searchParam.name" placeholder="请输入关键字"></Input>
          <Button className="search-btn" variant="default" @click="search">搜索</Button>
        </div>
        <div class="mb-4" v-if="!isComponent">
          <Button variant="default" @click="add">创建岗位</Button>
        </div>
      </form>
    </div>
    <div class="content">
      <div class="content-list">
        <div v-if="dataLoading" class="loading">加载中...</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead v-if="isComponent" class="w-[55px]"><input type="checkbox" :checked="allSelected" @change="toggleAll($event)" /></TableHead>
              <TableHead class="w-[70px]">序号</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>排序</TableHead>
              <TableHead>状态</TableHead>
              <TableHead v-if="!isComponent" class="w-[150px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in list" :key="row.id ?? index">
              <TableCell v-if="isComponent" class="w-[55px]"><input type="checkbox" :checked="multipleSelection.includes(row)" @change="toggleRow(row)" /></TableCell>
              <TableCell>{{ index + 1 }}</TableCell>
              <TableCell>{{ row.name }}</TableCell>
              <TableCell>{{ row.sortOrder }}</TableCell>
              <TableCell>{{row.status === 'enable' ? '启用' : '禁用'}}</TableCell>
              <TableCell v-if="!isComponent">
                <Button variant="link" @click="edit(row)">编辑</Button>
                <Button variant="link" @click="remove(row)" style="color: red;">删除</Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
    <page style="margin-top: 20px;" :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
    <Dialog v-model="showMemberPostFormDialog" @close="hideMemberPostForm">
      <DialogHeader>
        <DialogTitle>编辑会员岗位</DialogTitle>
      </DialogHeader>
      <form ref="memberPostRef" @submit.prevent>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">名称：</label>
          <div>
            <Input v-model="memberPost.name" placeholder="请输入名称" autocomplete="off"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">排序：</label>
          <div>
            <Input v-model="memberPost.sortOrder" placeholder="请输入排序，数值越大越靠前" autocomplete="off"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">状态：</label>
          <div>
            <el-switch active-color="#13ce66" :active-value="'enable'" :inactive-value="'disable'"  v-model="memberPost.status"></el-switch>
          </div>
        </div>
      </form>
      <template #footer>
        <div class="dialog-footer">
          <Button variant="outline" @click="hideMemberPostForm">取 消</Button>
          <Button variant="default" @click="submitMemberPost">确 定</Button>
        </div>
      </template>
    </Dialog>
    <template v-if="isComponent">
      <div class="dialog-footer" style="text-align: right;margin-top: 30px;">
        <Button variant="outline" @click="cancelCallback">取 消</Button>
        <Button variant="default" @click="selectSelectionChange">确 定</Button>
      </div>
    </template>
  </div>
</template>

<script>
// @ts-nocheck
  import {ref, computed} from "vue"
  import { memberApi } from '@/api/edu/admin-api'
const { findList, updatePost, savePost, deletePost } = memberApi
  import Page from "@/components/Page/index.vue"
  import {confirm, error, success} from "@/util/tipsUtils";
  import Button from '@/components/ui/Button.vue'
  import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
  import { Input } from '@/components/ui/input'

  export default {
    name: "MemberPost",
    components: {
      Button,
      Page,
      Table,
      TableHeader,
      TableBody,
      TableRow,
      TableHead,
      TableCell,
      Input
    },
    props: {
      cancelCallback: {
        type: Function,
        default: () => {}
      },
      selectCallback: {
        type: Function,
        default: () => {}
      },
      isComponent: {
        type: Boolean,
        default: false
      }
    },
    setup(props) {
      const list = ref([])
      const total = ref(0)
      const dataLoading = ref(true)
      const searchParam = ref({
        name: "",
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
        }).catch(() => {
          dataLoading.value = false
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
      const memberPostRules = {
        name: [{ required: true, message: "请输入名称", trigger: "blur" }],
      }
      const memberPost = ref({})
      const memberPostRef = ref(null)
      const showMemberPostFormDialog = ref(false)
      const hideMemberPostForm = () => {
        showMemberPostFormDialog.value = false;
        memberPost.value = {}
      }
      const add = () => {
        showMemberPostFormDialog.value = true;
      }
      // 编辑
      const edit = (item) => {
        memberPost.value = item
        showMemberPostFormDialog.value = true;
      }
      //提交
      const submitMemberPost = () => {
        memberPostRef.value.validate(valid => {
          if (!valid) {
            return false;
          }
          if (memberPost.value.id) {
            updatePost(memberPost.value, () => {
              success("修改成功")
              loadList()
              hideMemberPostForm()
            });
          } else {
            savePost(memberPost.value, () => {
              success("新增成功")
              loadList()
              hideMemberPostForm()
            });
          }
        })
      }

      const multipleSelection = ref([])
      const handleSelectionChange = (val) => {
        multipleSelection.value = val;
      }
      const allSelected = computed(() => list.value.length > 0 && list.value.every(item => multipleSelection.value.includes(item)))
      const toggleAll = (event) => {
        if (event.target.checked) {
          multipleSelection.value = [...list.value]
        } else {
          multipleSelection.value = []
        }
      }
      const toggleRow = (row) => {
        const idx = multipleSelection.value.indexOf(row)
        if (idx === -1) {
          multipleSelection.value.push(row)
        } else {
          multipleSelection.value.splice(idx, 1)
        }
      }
      const selectSelectionChange = () => {
        if (!multipleSelection.value.length) {
          error("请至少选择一个")
        }
        props.selectCallback && props.selectCallback(multipleSelection.value)
      }

      const remove = (item) => {
        confirm("确认永久删除吗？", "提示", () => {
          deletePost({id: item.id}, () => {
            success("修改成功")
            loadList()
          })
        }, () => {
        })
      }

      return {
        remove,
        handleSelectionChange,
        selectSelectionChange,
        allSelected,
        toggleAll,
        toggleRow,
        list,
        total,
        searchParam,
        search,
        currentChange,
        sizeChange,
        showMemberPostFormDialog,
        add,
        memberPost,
        memberPostRef,
        edit,
        hideMemberPostForm,
        submitMemberPost,
        memberPostRules,
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
