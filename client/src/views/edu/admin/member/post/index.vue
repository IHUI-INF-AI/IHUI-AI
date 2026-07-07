<template>
  <div class="app-container">
    <div class="header">
      <el-form :inline="true" :model="searchParam" class="demo-form-inline">
        <el-form-item label="">
          <el-input class="search-input" v-model="searchParam.name" placeholder="请输入关键字"></el-input>
          <el-button class="search-btn" type="primary" @click="search">搜索</el-button>
        </el-form-item>
        <el-form-item v-if="!isComponent">
          <el-button type="primary" @click="add">创建岗位</el-button>
        </el-form-item>
      </el-form>
    </div>
    <div class="content">
      <div class="content-list">
        <el-table v-loading="dataLoading" :data="list" style="width: 100%;" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="45" v-if="isComponent"/>
          <el-table-column label="序号" width="70" type="index"/>
          <el-table-column prop="name" label="名称"/>
          <el-table-column prop="sortOrder" label="排序"/>
          <el-table-column prop="status" label="状态">
            <template #default="scope">
              {{scope.row.status === 'enable' ? '启用' : '禁用'}}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" v-if="!isComponent">
            <template #default="scope">
              <el-button link @click="edit(scope.row)">编辑</el-button>
              <el-button link @click="remove(scope.row)" style="color: red;">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
    <page style="margin-top: 20px;" :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
    <el-dialog title="编辑会员岗位" v-model="showMemberPostFormDialog" :before-close="hideMemberPostForm">
      <el-form :model="memberPost" :rules="memberPostRules" ref="memberPostRef">
        <el-form-item label="名称：" label-width="150px" prop="name">
          <el-input v-model="memberPost.name" placeholder="请输入名称" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="排序：" label-width="150px" prop="sortOrder">
          <el-input v-model="memberPost.sortOrder" placeholder="请输入排序，数值越大越靠前" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="状态：" label-width="150px" prop="status">
          <el-switch active-color="#13ce66" :active-value="'enable'" :inactive-value="'disable'"  v-model="memberPost.status"></el-switch>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="hideMemberPostForm">取 消</el-button>
          <el-button type="primary" @click="submitMemberPost">确 定</el-button>
        </div>
      </template>
    </el-dialog>
    <template v-if="isComponent">
      <div class="dialog-footer" style="text-align: right;margin-top: 30px;">
        <el-button @click="cancelCallback">取 消</el-button>
        <el-button type="primary" @click="selectSelectionChange">确 定</el-button>
      </div>
    </template>
  </div>
</template>

<script>
// @ts-nocheck
  import {ref} from "vue"
  import { memberApi } from '@/api/edu/admin-api'
const { findList, updatePost, savePost, deletePost } = memberApi
  import Page from "@/components/Page/index.vue"
  import {confirm, error, success} from "@/util/tipsUtils";

  export default {
    name: "MemberPost",
    components: {
      Page
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
