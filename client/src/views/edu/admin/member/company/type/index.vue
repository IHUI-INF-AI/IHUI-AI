<template>
  <div class="app-container">
    <div class="header">
      <el-form :inline="true" :model="searchParam" class="demo-form-inline">
        <el-form-item label="">
          <el-input class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字"></el-input>
          <el-button class="search-btn" type="primary" @click="search">搜索</el-button>
        </el-form-item>
        <el-form-item v-if="!isComponent">
          <el-button type="primary" @click="add">创建公司类型</el-button>
        </el-form-item>
      </el-form>
    </div>
    <div class="content">
      <div class="content-list">
        <el-table v-loading="dataLoading" :data="list" style="width: 100%;" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="45" v-if="isComponent"/>
          <el-table-column label="序号" width="70" type="index"/>
          <el-table-column prop="name" label="名称"/>
          <el-table-column prop="memberMaximum" label="最大会员数量"/>
          <el-table-column prop="sortOrder" label="排序"/>
          <el-table-column prop="status" label="状态">
            <template #default="scope">
              {{scope.row.status === 'enable' ? '启用' : '禁用'}}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" v-if="!isComponent">
            <template #default="scope">
              <el-button link @click="edit(scope.row)">编辑</el-button>
              <el-button link style="color:red;" @click="remove(scope.row)">删除</el-button>
              <el-button link style="color:orange;" v-if="scope.row.status === 'enable'" @click="disable(scope.row)">禁用</el-button>
              <el-button link style="color:#0d9bff;" v-if="scope.row.status === 'disable'" @click="enable(scope.row)">启用</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
    <page style="margin-top: 20px;" :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
    <el-dialog title="编辑会员公司类型" v-model="showMemberCompanyFormDialog" :before-close="hideMemberCompanyForm">
      <el-form :model="memberCompanyType" :rules="memberCompanyTypeRules" ref="memberCompanyTypeRef">
        <el-form-item label="名称：" label-width="150px" prop="name">
          <el-input v-model="memberCompanyType.name" placeholder="请输入名称" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="最大会员数量：" label-width="150px" prop="memberMaximum">
          <el-input v-model="memberCompanyType.memberMaximum" placeholder="最大会员数量，公司最多拥有的会员数量" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="排序：" label-width="150px" prop="sortOrder">
          <el-input v-model="memberCompanyType.sortOrder" placeholder="请输入排序，数值越大越靠前" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="状态：" label-width="150px" prop="status">
          <el-switch active-color="#13ce66" :active-value="'enable'" :inactive-value="'disable'"  v-model="memberCompanyType.status"></el-switch>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="hideMemberCompanyForm">取 消</el-button>
          <el-button type="primary" @click="submitMemberCompany">确 定</el-button>
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
const { findTypeList, updateCompanyType, saveCompanyType, deleteCompanyType, enableCompanyType, disableCompanyType } = memberApi
  import Page from "@/components/Page/index.vue"
  import {confirm, error, success} from "@/util/tipsUtils";

  export default {
    name: "MemberCompany",
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
        findTypeList(searchParam.value, (res) => {
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
      const memberCompanyTypeRules = {
        name: [{ required: true, message: "请输入名称", trigger: "blur" }],
      }
      const memberCompanyType = ref({})
      const memberCompanyTypeRef = ref(null)
      const showMemberCompanyFormDialog = ref(false)
      const hideMemberCompanyForm = () => {
        showMemberCompanyFormDialog.value = false;
        memberCompanyType.value = {}
      }
      const add = () => {
        showMemberCompanyFormDialog.value = true;
      }
      // 编辑
      const edit = (item) => {
        memberCompanyType.value = item
        showMemberCompanyFormDialog.value = true;
      }
      //提交
      const submitMemberCompany = () => {
        memberCompanyTypeRef.value.validate(valid => {
          if (!valid) {
            return false;
          }
          if (memberCompanyType.value.id) {
            updateCompanyType(memberCompanyType.value, () => {
              success("修改成功")
              loadList()
              hideMemberCompanyForm()
            });
          } else {
            saveCompanyType(memberCompanyType.value, () => {
              success("新增成功")
              loadList()
              hideMemberCompanyForm()
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
        confirm("确认删除公司类型【" + item.name + "】吗？", "提示", () => {
          deleteCompanyType({id: item.id}, () => {
            success("删除成功")
            loadList()
          })
        }, () => {
        })
      }

      const enable = (item) => {
        confirm("确认启用公司类型【" + item.name + "】吗？", "提示", () => {
          enableCompanyType({id: item.id}, () => {
            success("启用成功")
            loadList()
          })
        }, () => {
        })
      }

      const disable = (item) => {
        confirm("确认禁用公司类型【" + item.name + "】吗？", "提示", () => {
          disableCompanyType({id: item.id}, () => {
            success("禁用成功")
            loadList()
          })
        }, () => {
        })
      }

      return {
        enable,
        disable,
        remove,
        handleSelectionChange,
        selectSelectionChange,
        list,
        total,
        searchParam,
        search,
        currentChange,
        sizeChange,
        showMemberCompanyFormDialog,
        add,
        memberCompanyType,
        memberCompanyTypeRef,
        edit,
        hideMemberCompanyForm,
        submitMemberCompany,
        memberCompanyTypeRules,
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
