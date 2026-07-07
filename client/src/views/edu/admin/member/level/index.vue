<template>
  <div class="app-container">
    <div class="header">
      <el-form :inline="true" :model="searchParam" class="demo-form-inline">
        <el-form-item label="">
          <el-input class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字"></el-input>
          <el-button class="search-btn" type="primary" @click="search">搜索</el-button>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="add">创建会员等级</el-button>
        </el-form-item>
      </el-form>
    </div>
    <div class="content">
      <div class="content-list">
        <el-table v-loading="dataLoading" :data="list" style="width: 100%;">
          <el-table-column label="序号" width="70" type="index"/>
          <el-table-column prop="id" label="ID" width="50"/>
          <el-table-column prop="name" label="名称"/>
          <el-table-column prop="description" label="描述"/>
          <el-table-column prop="conditions" label="达成条件">
            <template #default="scope">
              {{scope.row.conditions || 0}} 积分
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150">
            <template #default="scope">
              <el-button link @click="edit(scope.row)">编辑</el-button>
              <el-button link @click="remove(scope.row)" style="color: red;">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
    <page style="margin-top: 20px;" :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
    <el-dialog title="新增/编辑积分" v-model="showMemberLevelFormDialog" :before-close="hideMemberLevelForm">
      <el-form :model="memberLevel" :rules="memberLevelRules" ref="memberLevelRef">
        <el-form-item label="名称：" label-width="150px" prop="name">
          <el-input v-model="memberLevel.name" placeholder="请输入名称" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="描述：" label-width="150px" prop="description">
          <el-input v-model="memberLevel.description" placeholder="请输入描述" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="达成条件：" label-width="150px" prop="conditions">
          <el-input v-model="memberLevel.conditions" placeholder="请输入大于0的整数" autocomplete="off"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="hideMemberLevelForm">取 消</el-button>
          <el-button type="primary" @click="submitMemberLevel">确 定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
// @ts-nocheck
  import {ref} from "vue"
  import { memberApi } from '@/api/edu/admin-api'
const { findList, updateLevel, saveLevel, deleteLevel } = memberApi
  import Page from "@/components/Page/index.vue"
  import {confirm, success} from "@/util/tipsUtils";

  export default {
    name: "MemberLevelIndex",
    components: {
      Page
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
