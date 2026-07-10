<template>
  <div class="user-container">
    <div class="flex flex-wrap">
      <div class="w-1/4">
        <department-tree class="department-tree" @node-click="handleNodeClick"/>
      </div>
      <div class="w-3/4 user-list">
        <div class="head">
          <Input size="small" v-model="param.keyword" clearable placeholder="输入姓名搜索" class="custom-input" @keyup.enter="search"></Input>
          <Button size="sm" className="search-btn" variant="outline" @click="search"><Search />搜索</Button>
          <Button style="margin-left: 10px;" size="sm" variant="outline" @click="add">新增</Button>
        </div>
        <Table class="text-sm" @selection-change="handleSelectionChange">
          <TableHeader>
            <TableRow>
              <TableHead v-if="isComponent" class="w-[55px]"><input type="checkbox" :checked="allSelected" @change="toggleAll($event)" /></TableHead>
              <TableHead class="w-[70px]"></TableHead>
              <TableHead>账号</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>性别</TableHead>
              <TableHead>邮箱</TableHead>
              <TableHead class="text-center">状态</TableHead>
              <TableHead v-if="!isComponent" class="w-[100px] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-for="(row, index) in userList" :key="row.id ?? index">
              <TableRow>
                <TableCell v-if="isComponent" class="w-[55px]"><input type="checkbox" :checked="multipleSelection.includes(row)" @change="toggleRow(row)" /></TableCell>
                <TableCell><button @click="toggleExpand(index)">{{ expandedRows.has(index) ? '▼' : '▶' }}</button></TableCell>
                <TableCell>{{ row.username }}</TableCell>
                <TableCell>{{ row.name }}</TableCell>
                <TableCell>{{ row.gender }}</TableCell>
                <TableCell>{{ row.email }}</TableCell>
                <TableCell class="text-center">{{stateMap[row.status]}}</TableCell>
                <TableCell v-if="!isComponent" class="text-center">
                  <Button size="sm" variant="link" @click="editUser(row)">编辑</Button>
                  <edit :data="row"/>
                  <Button size="sm" variant="link" @click="remove(row)" style="color: red;">删除</Button>
                  <Button size="sm" variant="link" @click="resetPassword(row)">重置密码</Button>
                </TableCell>
              </TableRow>
              <tr v-if="expandedRows.has(index)">
                <td colspan="99">
                  <Card class="box-card shadow-none">
                    <CardHeader>
                      <div class="clearfix">
                        <span>基础信息</span>
                      </div>
                    </CardHeader>
                  <CardContent>
                    <div class="table-wrapper">
                      <table class="fl-table">
                        <tbody>
                          <tr><td>编号</td><td>{{row.code}}</td></tr>
                          <tr><td>账号</td><td>{{row.username}}</td></tr>
                          <tr><td>姓名</td><td>{{row.name}}</td></tr>
                          <tr><td>性别</td><td>{{row.gender}}</td></tr>
                          <tr><td>出生日期</td><td>{{row.birthday}}</td></tr>
                          <tr><td>籍贯</td><td>{{row.nativePlace}}</td></tr>
                          <tr><td>民族</td><td>{{row.nation}}</td></tr>
                          <tr><td>婚姻状态</td><td>{{row.maritalStatus}}</td></tr>
                          <tr><td>身份证号</td><td>{{row.idCard}}</td></tr>
                          <tr><td>身份证地址</td><td>{{row.idCardAddress}}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                  </Card>
                  <Card class="box-card shadow-none">
                    <CardHeader>
                      <div class="clearfix">
                        <span>工作信息</span>
                      </div>
                    </CardHeader>
                  <CardContent>
                    <div class="table-wrapper">
                      <table class="fl-table">
                        <tbody>
                          <tr><td>人员状态</td><td>{{stateMap[row.status]}}</td></tr>
                          <tr><td>合约开始时间</td><td>{{row.contractStartDate}}</td></tr>
                          <tr><td>合约结束时间</td><td>{{row.contractEndDate}}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                  </Card>
                  <Card class="box-card shadow-none">
                    <CardHeader>
                      <div class="clearfix">
                        <span>通讯信息</span>
                      </div>
                    </CardHeader>
                  <CardContent>
                    <div class="table-wrapper">
                      <table class="fl-table">
                        <tbody>
                          <tr><td>移动电话</td><td>{{row.mobile}}</td></tr>
                          <tr><td>办公室电话</td><td>{{row.telephone}}</td></tr>
                          <tr><td>电子邮箱</td><td>{{row.email}}</td></tr>
                          <tr><td>当前住址</td><td>{{row.currentAddress}}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                  </Card>
                </td>
              </tr>
            </template>
          </TableBody>
        </Table>
        <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="param.size"/>
      </div>
    </div>
    <Dialog v-model="showUserDialog" width="90%" @close="hideUserDialog">
      <DialogHeader>
        <DialogTitle>{{ user.id ? '新增用户' : '编辑用户' }}</DialogTitle>
      </DialogHeader>
      <form ref="userRef" @submit.prevent class="user-form">
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">名字：</label>
          <div>
            <Input size="small" v-model="user.name" placeholder="请输入名字"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">账号：</label>
          <div>
            <Input size="small" v-model="user.username" placeholder="请输入账号"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">工号：</label>
          <div>
            <Input size="small" v-model="user.code" placeholder="请输入工号"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">邮箱：</label>
          <div>
            <Input size="small" v-model="user.email" placeholder="请输入导语"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">部门：</label>
          <div>
            <Select style="width: 100%;"
                    size="small"
                    v-model="selectedDepartment"
                    @change="changeDepartment"
                    clearable>
              <SelectOption v-for="item in flatDepartmentOptions" :key="item.value" :label="item.label" :value="item.value" />
            </Select>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">手机号码：</label>
          <div>
            <Input size="small" v-model="user.mobile" placeholder="请输入导语"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">出生日期：</label>
          <div>
            <Input type="date" style="width: 100%;" size="small" v-model="user.birthday" placeholder="选择出生日期" />
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">性别：</label>
          <div>
            <Radio v-model="user.gender" value="男">男</Radio>
            <Radio v-model="user.gender" value="女">女</Radio>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">籍贯：</label>
          <div>
            <Input size="small" v-model="user.nativePlace" placeholder="请输入籍贯"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">民族：</label>
          <div>
            <Input size="small" v-model="user.nation" placeholder="请输入民族"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">婚姻状态：</label>
          <div>
            <Input size="small" v-model="user.maritalStatus" placeholder="请输入身份证住址"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">身份证号：</label>
          <div>
            <Input size="small" v-model="user.idCard" placeholder="请输入身份证号"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">身份证地址：</label>
          <div>
            <Input size="small" v-model="user.idCardAddress" placeholder="请输入身份证地址"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">当前住址：</label>
          <div>
            <Input size="small" v-model="user.currentAddress" placeholder="请输入当前住址"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">办公电话：</label>
          <div>
            <Input size="small" v-model="user.telephone" placeholder="请输入导语"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">合约开始时间：</label>
          <div>
            <Input type="date" style="width: 100%;" size="small" v-model="user.contractStartDate" placeholder="选择合约开始时间" />
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">合约结束时间：</label>
          <div>
            <Input type="date" style="width: 100%;" size="small" v-model="user.contractEndDate" placeholder="选择合约结束时间" />
          </div>
        </div>
      </form>
      <DialogFooter>
        <div style="text-align: center;">
          <Button size="sm" variant="outline" @click="submit">提交</Button>
        </div>
      </DialogFooter>
    </Dialog>
    <template v-if="isComponent">
      <div class="dialog-footer" style="text-align: right;margin-top: 30px;">
        <Button size="sm" variant="outline" @click="cancelCallback">取 消</Button>
        <Button size="sm" variant="default" @click="submitSelectionChange">确 定</Button>
      </div>
    </template>
  </div>
</template>

<script>
  import {ref, markRaw, computed} from "vue"
  import { useFormRef } from '@/composables/useFormRef'
  import Edit from "./edit.vue"
  import DepartmentTree from "./tree.vue"
  import Page from "@/components/Page/index.vue"
  import { organizationalApi } from '@/api/edu/admin-api'
const { getUserList, updateUser, saveUser, resetPwd, deleteUser } = organizationalApi;
  import {error, success, confirm} from "@/util/tipsUtils";
  const { findDepartmentList, toTree, getAllParent } = organizationalApi;
  import {Search} from '@/lib/lucide-fallback'
  import { Card, CardHeader, CardContent } from '@/components/ui/card'
  import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
  import Button from '@/components/ui/Button.vue'
  import { Input } from '@/components/ui/input'
  import { Radio } from '@/components/ui/radio'
  import { Select, SelectOption } from '@/components/ui/select'
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
    Radio,
    Card,
    CardHeader,
    CardContent,
    Button,
    Input,
    Dialog,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
      Edit,
      Page,
      DepartmentTree,
      Select,
      SelectOption
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
      const userRef = useFormRef()
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
      const flatDepartmentOptions = computed(() => {
        const result = []
        const flatten = (nodes, parentPath = '') => {
          for (const node of nodes) {
            const label = parentPath ? `${parentPath} / ${node.label || node.name}` : (node.label || node.name)
            result.push({ label, value: node.value || node.id })
            if (node.children && node.children.length) { flatten(node.children, label) }
          }
        }
        flatten(departmentOptionList.value || [])
        return result
      })
      const selectedDepartment = computed({
        get: () => { const arr = selectDepartmentList.value; return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : '' },
        set: (val) => { selectDepartmentList.value = [val] }
      })
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
        user.value.departmentId = val || ""
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
      const allSelected = computed(() => userList.value.length > 0 && userList.value.every(item => multipleSelection.value.includes(item)))
      const toggleAll = (event) => {
        if (event.target.checked) {
          multipleSelection.value = [...userList.value]
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
      const expandedRows = ref(new Set())
      const toggleExpand = (index) => {
        if (expandedRows.value.has(index)) {
          expandedRows.value.delete(index)
        } else {
          expandedRows.value.add(index)
        }
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
        flatDepartmentOptions,
        selectedDepartment,
        changeDepartment,
        handleSelectionChange,
        submitSelectionChange,
        allSelected,
        toggleAll,
        toggleRow,
        expandedRows,
        toggleExpand,
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
            color: hsl(var(--primary));
          }
        }
      }
    }
  }
  .box-card {
    max-width: 500px;
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
  }
</style>
