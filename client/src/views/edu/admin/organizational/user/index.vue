<template>
  <div class="user-container">
    <el-row>
      <el-col :span="6">
        <department-tree class="department-tree" @node-click="handleNodeClick"/>
      </el-col>
      <el-col :span="18" class="user-list">
        <div class="head">
          <el-input size="small" v-model="param.keyword" clearable placeholder="输入姓名搜索" class="custom-input" @keyup.enter="search"></el-input>
          <el-button size="small" class="search-btn" :icon="Search" @click="search">搜索</el-button>
          <el-button style="margin-left: 10px;" size="small" @click="add">新增</el-button>
        </div>
        <el-table :data="userList" size="small" style="width: 100%;" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="45" v-if="isComponent"/>
          <el-table-column type="expand">
            <template #default="props">
              <el-card class="box-card" shadow="never">
                <template #header>
                  <div class="clearfix">
                    <span>基础信息</span>
                  </div>
                </template>
                <div class="table-wrapper">
                  <table class="fl-table">
                    <tbody>
                      <tr><td>编号</td><td>{{props.row.code}}</td></tr>
                      <tr><td>账号</td><td>{{props.row.username}}</td></tr>
                      <tr><td>姓名</td><td>{{props.row.name}}</td></tr>
                      <tr><td>性别</td><td>{{props.row.gender}}</td></tr>
                      <tr><td>出生日期</td><td>{{props.row.birthday}}</td></tr>
                      <tr><td>籍贯</td><td>{{props.row.nativePlace}}</td></tr>
                      <tr><td>民族</td><td>{{props.row.nation}}</td></tr>
                      <tr><td>婚姻状态</td><td>{{props.row.maritalStatus}}</td></tr>
                      <tr><td>身份证号</td><td>{{props.row.idCard}}</td></tr>
                      <tr><td>身份证地址</td><td>{{props.row.idCardAddress}}</td></tr>
                    </tbody>
                  </table>
                </div>
              </el-card>
              <el-card class="box-card" shadow="never">
                <template #header>
                  <div class="clearfix">
                    <span>工作信息</span>
                  </div>
                </template>
                <div class="table-wrapper">
                  <table class="fl-table">
                    <tbody>
                      <tr><td>人员状态</td><td>{{stateMap[props.row.status]}}</td></tr>
                      <tr><td>合约开始时间</td><td>{{props.row.contractStartDate}}</td></tr>
                      <tr><td>合约结束时间</td><td>{{props.row.contractEndDate}}</td></tr>
                    </tbody>
                  </table>
                </div>
              </el-card>
              <el-card class="box-card" shadow="never">
                <template #header>
                  <div class="clearfix">
                    <span>通讯信息</span>
                  </div>
                </template>
                <div class="table-wrapper">
                  <table class="fl-table">
                    <tbody>
                      <tr><td>移动电话</td><td>{{props.row.mobile}}</td></tr>
                      <tr><td>办公室电话</td><td>{{props.row.telephone}}</td></tr>
                      <tr><td>电子邮箱</td><td>{{props.row.email}}</td></tr>
                      <tr><td>当前住址</td><td>{{props.row.currentAddress}}</td></tr>
                    </tbody>
                  </table>
                </div>
              </el-card>
            </template>
          </el-table-column>
          <el-table-column prop="username" label="账号"/>
          <el-table-column prop="name" label="姓名"/>
          <el-table-column prop="gender" label="性别"/>
          <el-table-column :show-overflow-tooltip="true" prop="email" label="邮箱"/>
          <el-table-column label="状态" align="center">
            <template #default="scope">
              {{stateMap[scope.row.status]}}
            </template>
          </el-table-column>
          <el-table-column label="操作" align="center" width="100" v-if="!isComponent">
            <template #default="scope">
              <el-button size="small" link @click="editUser(scope.row)">编辑</el-button>
              <edit :data="scope.row"/>
              <el-button size="small" link @click="remove(scope.row)" style="color: red;">删除</el-button>
              <el-button size="small" link @click="resetPassword(scope.row)">重置密码</el-button>
            </template>
          </el-table-column>
        </el-table>
        <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="param.size"/>
      </el-col>
    </el-row>
    <el-dialog v-model="showUserDialog" :title="user.id ? '新增用户' : '编辑用户'" append-to-body width="90%" :before-close="hideUserDialog">
      <el-form :model="user" :rules="userRules" ref="userRef" class="user-form" label-width="150px">
        <el-form-item label="名字：" prop="name">
          <el-input size="small" v-model="user.name" placeholder="请输入名字"></el-input>
        </el-form-item>
        <el-form-item label="账号：" prop="username">
          <el-input size="small" v-model="user.username" placeholder="请输入账号"></el-input>
        </el-form-item>
        <el-form-item label="工号：" prop="code">
          <el-input size="small" v-model="user.code" placeholder="请输入工号"></el-input>
        </el-form-item>
        <el-form-item label="邮箱：" prop="email">
          <el-input size="small" v-model="user.email" placeholder="请输入导语"></el-input>
        </el-form-item>
        <el-form-item label="部门：" prop="departmentId">
          <el-cascader style="width: 100%;"
                       size="small"
                       v-model="selectDepartmentList"
                       :props="{ checkStrictly: true }"
                       :options="departmentOptionList"
                       @change="changeDepartment"></el-cascader>
        </el-form-item>
        <el-form-item label="手机号码：" prop="mobile">
          <el-input size="small" v-model="user.mobile" placeholder="请输入导语"></el-input>
        </el-form-item>
        <el-form-item label="出生日期：" prop="birthday">
          <el-date-picker style="width: 100%;" size="small" v-model="user.birthday" type="date" placeholder="选择出生日期"></el-date-picker>
        </el-form-item>
        <el-form-item label="性别：" prop="gender">
          <el-radio size="small" v-model="user.gender" label="男">男</el-radio>
          <el-radio size="small" v-model="user.gender" label="女">女</el-radio>
        </el-form-item>
        <el-form-item label="籍贯：" prop="nativePlace">
          <el-input size="small" v-model="user.nativePlace" placeholder="请输入籍贯"></el-input>
        </el-form-item>
        <el-form-item label="民族：" prop="nation">
          <el-input size="small" v-model="user.nation" placeholder="请输入民族"></el-input>
        </el-form-item>
        <el-form-item label="婚姻状态：" prop="maritalStatus">
          <el-input size="small" v-model="user.maritalStatus" placeholder="请输入身份证住址"></el-input>
        </el-form-item>
        <el-form-item label="身份证号：" prop="idCard">
          <el-input size="small" v-model="user.idCard" placeholder="请输入身份证号"></el-input>
        </el-form-item>
        <el-form-item label="身份证地址：" prop="idCardAddress">
          <el-input size="small" v-model="user.idCardAddress" placeholder="请输入身份证地址"></el-input>
        </el-form-item>
        <el-form-item label="当前住址：" prop="currentAddress">
          <el-input size="small" v-model="user.currentAddress" placeholder="请输入当前住址"></el-input>
        </el-form-item>
        <el-form-item label="办公电话：" prop="telephone">
          <el-input size="small" v-model="user.telephone" placeholder="请输入导语"></el-input>
        </el-form-item>
        <el-form-item label="合约开始时间：" prop="contractStartDate">
          <el-date-picker style="width: 100%;" size="small" v-model="user.contractStartDate" type="date" placeholder="选择合约开始时间"></el-date-picker>
        </el-form-item>
        <el-form-item label="合约结束时间：" prop="contractEndDate">
          <el-date-picker style="width: 100%;" size="small" v-model="user.contractEndDate" type="date" placeholder="选择合约结束时间"></el-date-picker>
        </el-form-item>
      </el-form>
      <template #footer>
        <div style="text-align: center;">
          <el-button size="small" @click="submit">提交</el-button>
        </div>
      </template>
    </el-dialog>
    <template v-if="isComponent">
      <div class="dialog-footer" style="text-align: right;margin-top: 30px;">
        <el-button size="small" @click="cancelCallback">取 消</el-button>
        <el-button size="small" type="primary" @click="submitSelectionChange">确 定</el-button>
      </div>
    </template>
  </div>
</template>

<script>
// @ts-nocheck
  import {ref, onMounted, nextTick, markRaw} from "vue"
  import Edit from "./edit.vue"
  import DepartmentTree from "./tree.vue"
  import Page from "@/components/Page/index.vue"
  import { organizationalApi } from '@/api/edu/admin-api'
const { getUserList, updateUser, saveUser, resetPwd, deleteUser } = organizationalApi;
  import {error, success, confirm} from "@/util/tipsUtils";
  const { findDepartmentList, toTree, getAllParent } = organizationalApi;
  import {Search} from '@/lib/lucide-fallback'
  export default {
    name: "UserList",
    props: {
      cancelCallback: {
        type: Function,
        default: () => {
        }
      },
      submitCallback: {
        type: Function,
        default: () => {
        }
      },
      isComponent: {
        type: Boolean,
        default: false
      }
    },
    components: {
      Edit,
      Page,
      DepartmentTree
    },
    setup(props) {
      const stateMap = {"trial": "试用", "trial_extension": "试用延期", "official": "正式", "dismissal": "解聘", "separation": "离职"}
      const total = ref(0)
      const userList = ref([])
      const param = ref({
        current: 1,
        size: 20,
        keyword: "",
        departmentId: ""
      })
      const loadUserList = () => {
        getUserList(param.value, res => {
          userList.value = res.list
          total.value = res.total
        })
      }
      loadUserList();
      const handleNodeClick = data => {
        param.value.current = 1
        param.value.departmentId = data.id
        loadUserList()
      }
      // 页码改变
      const currentChange = (currentPage) => {
        param.value.current = currentPage;
        loadUserList()
      }
      // 页面显示数量改变
      const sizeChange = (size) => {
        param.value.size = size;
        loadUserList()
      }
      const search = () => {
        loadUserList()
      }
      const userRef = ref()
      const showUserDialog = ref(false)
      let user = ref({
        id: "",
        name: "",
        email: "",
        birthday: "",
        code: "",
        contractEndDate: "",
        contractStartDate: "",
        currentAddress: "",
        departmentId: "",
        gender: "",
        idCard: "",
        idCardAddress: "",
        maritalStatus: "",
        mobile: "",
        nation: "",
        nativePlace: "",
        telephone: "",
      })
      const userRules = {
        code: [{ required: true, message: "请输入工号", trigger: "blur" }],
        username: [{ required: true, message: "请输入账号", trigger: "blur" }],
        name: [{ required: true, message: "请输入姓名", trigger: "blur" }],
        mobile: [{ required: true, message: "请输入手机号码", trigger: "blur" }],
        email: [{ required: true, message: "请输入邮箱", trigger: "blur" }],
        birthday: [{ required: true, message: "请选择生日", trigger: "change" }],
        contractEndDate: [{ required: true, message: "请选择合约结束日期", trigger: "change" }],
        contractStartDate: [{ required: true, message: "请选择合约开始日期", trigger: "change" }],
        departmentId: [{ required: true, message: "请选择部门", trigger: "change" }]
      }
      const add = () => {
        showUserDialog.value = true;
      }
      const departmentOptionList = ref()
      const selectDepartmentList = ref([])
      findDepartmentList(0, true, res => {
        departmentOptionList.value = toTree(res)
        departmentOptionList.value.splice(0, 1)
      })
      const editUser = (item) => {
        selectDepartmentList.value = getAllParent(departmentOptionList.value, [parseInt(item.departmentId)]);
        if (selectDepartmentList.value && selectDepartmentList.value.length) {
          selectDepartmentList.value = selectDepartmentList.value[0]
        }
        user.value = item
        showUserDialog.value = true;
      }
      const hideUserDialog = () => {
        showUserDialog.value = false;
        userRef.value.resetFields();
        user.value = {}
      }
      // 选择分类
      const changeDepartment = (val) => {
        user.value.departmentId = val[val.length - 1] || ""
      }
      const submit = () => {
        userRef.value.validate((valid) => {
          if (!valid) { return false }
          if (typeof user.value.birthday === "string") {
            user.value.birthday = new Date(user.value.birthday)
          }
          if (typeof user.value.contractEndDate === "string") {
            user.value.contractEndDate = new Date(user.value.contractEndDate)
          }
          if (typeof user.value.contractStartDate === "string") {
            user.value.contractStartDate = new Date(user.value.contractStartDate)
          }
          if (user.value.id) {
            updateUser(user.value, function (res) {
              if (res && res.id) {
                user.value.id = res.id;
                success("编辑成功")
                loadUserList()
                hideUserDialog()
              }
            })
          } else {
            saveUser(user.value, function (res) {
              if (res && res.id) {
                user.value.id = res.id;
                success("新增成功")
                loadUserList()
                hideUserDialog()
              }
            })
          }
        })
      }
      const multipleSelection = ref([])
      const handleSelectionChange = (val) => {
        multipleSelection.value = val;
      }
      const submitSelectionChange = () => {
        if (!multipleSelection.value.length) {
          error("请选择用户")
        }
        props.submitCallback && props.submitCallback(multipleSelection.value)
      }
      const resetPassword = (item) => {
        confirm("确认重置「"+ item.name +"」密码？",  "重置密码",() => {
          resetPwd({id: item.id}, (res) => {
            confirm("重置后密码：" + res.pwd,  "重置密码成功",() => {})
          });
        })
      }
      // 移除el-card的阴影类
      onMounted(() => {
        nextTick(() => {
          const cards = document.querySelectorAll('.box-card .el-card')
          cards.forEach(card => {
            card.classList.remove('is-always-shadow', 'is-hover-shadow')
          })
        })
      })
      
      const remove = (item) => {
        confirm("确认永久删除当前用户？",  "删除用户",() => {
          deleteUser(item.id, () => {
            success("删除成功")
            loadUserList()
          });
        })
      }
      return {
        remove,
        stateMap,
        param,
        total,
        userList,
        handleNodeClick,
        currentChange,
        sizeChange,
        search,
        add,
        editUser,
        user,
        userRef,
        submit,
        showUserDialog,
        hideUserDialog,
        userRules,
        departmentOptionList,
        selectDepartmentList,
        changeDepartment,
        handleSelectionChange,
        submitSelectionChange,
        resetPassword,
        Search: markRaw(Search)
      }
    }
  }
</script>

<style scoped lang="scss">
  .user-container {
    margin: 20px;
    .department-tree {
      padding: 0 10px 0 0;
    }
    .user-list {
      padding: 0 0 0 10px;
      .head {
        margin-bottom: 10px;
        .custom-input {
          width: 50%;
          min-width: 300px;
        }
        .custom-btn {
          &:hover {
            color: var(--el-color-primary);
          }
        }
      }
    }
  }
  .box-card {
    max-width: 500px;
    
    :deep(.el-card),
    :deep(.el-card.is-always-shadow),
    :deep(.el-card.is-hover-shadow) {
      box-shadow: unset;
      -webkit-box-shadow: unset;
      -moz-box-shadow: unset;
      border: 1px solid transparent;
      transition: all 0.3s ease;
    }
    
    :deep(.el-card:hover),
    :deep(.el-card.is-always-shadow:hover),
    :deep(.el-card.is-hover-shadow:hover) {
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      border: 1px solid #f0f0f0;
    }
  }
  .fl-table {
    border-radius: 5px;
    font-size: 12px;
    font-weight: normal;
    border: none;
    border-collapse: collapse;
    width: 100%;
    background-color: white;
  }
  .fl-table td {
    border: 1px solid #f8f8f8;
    font-size: 12px;
    padding: 12px;
  }
  .fl-table tr td:nth-child(1) {
    background: #F8F8F8;
    width: 30%;
    min-width: 100px;
  }
  .user-form {
    display: inline-block;
    .el-form-item {
      width: 50%;
      float: left;
    }
  }
</style>
