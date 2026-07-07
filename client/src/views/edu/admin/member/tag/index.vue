<template>
  <div class="app-container">
    <div class="header">
      <el-form :inline="true" :model="searchParam" class="demo-form-inline">
        <el-form-item label="">
          <el-input class="search-input" v-model="searchParam.name" placeholder="请输入关键字"></el-input>
          <el-button class="search-btn" type="primary" @click="search">搜索</el-button>
        </el-form-item>
        <el-form-item v-if="!isComponent">
          <el-button type="primary" @click="add">创建标签</el-button>
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
    <el-dialog title="编辑会员标签" v-model="showMemberTagFormDialog" :before-close="hideMemberTagForm">
      <el-form :model="memberTag" :rules="memberTagRules" ref="memberTagRef">
        <el-form-item label="名称：" label-width="150px" prop="name">
          <el-input v-model="memberTag.name" placeholder="请输入名称" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="排序：" label-width="150px" prop="description">
          <el-input v-model="memberTag.sortOrder" placeholder="请输入排序，数值越大排序越前" autocomplete="off"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="hideMemberTagForm">取 消</el-button>
          <el-button type="primary" @click="submitMemberTag">确 定</el-button>
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
const { findList, updateTag, saveTag, deleteTag } = memberApi
  import Page from "@/components/Page/index.vue"
  import {confirm, error, success} from "@/util/tipsUtils";

  export default {
    name: "MemberTag",
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
      const memberTagRules = {
        name: [{ required: true, message: "请输入名称", trigger: "blur" }],
      }
      const memberTag = ref({})
      const memberTagRef = ref(null)
      const showMemberTagFormDialog = ref(false)
      const hideMemberTagForm = () => {
        showMemberTagFormDialog.value = false;
        memberTag.value = {}
      }
      const add = () => {
        showMemberTagFormDialog.value = true;
      }
      // 编辑
      const edit = (item) => {
        memberTag.value = item
        showMemberTagFormDialog.value = true;
      }
      //提交
      const submitMemberTag = () => {
        memberTagRef.value.validate(valid => {
          if (!valid) {
            return false;
          }
          if (memberTag.value.id) {
            updateTag(memberTag.value, () => {
              success("修改成功")
              loadList()
              hideMemberTagForm()
            });
          } else {
            saveTag(memberTag.value, () => {
              success("新增成功")
              loadList()
              hideMemberTagForm()
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
          deleteTag({id: item.id}, () => {
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
        showMemberTagFormDialog,
        add,
        memberTag,
        memberTagRef,
        edit,
        hideMemberTagForm,
        submitMemberTag,
        memberTagRules,
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
