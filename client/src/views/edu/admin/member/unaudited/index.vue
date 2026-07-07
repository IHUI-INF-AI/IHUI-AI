<template>
  <div class="member-container">
    <div class="head">
      <el-input v-model="param.keyword" clearable placeholder="输入名称搜索" class="custom-input" @keyup.enter="search"></el-input>
      <el-button class="search-btn" :icon="Search" @click="search">搜索</el-button>
    </div>
    <el-table v-loading="dataLoading" :data="memberList" style="width: 100%;">
      <el-table-column type="expand">
        <template #default="props">
          <el-card class="box-card">
            <template #header>
              <div>
                <span>基础信息</span>
              </div>
            </template>
            <div class="table-wrapper">
              <table class="fl-table">
                <tbody>
                  <tr><td>编号</td><td>{{props.row.code}}</td></tr>
                  <tr><td>姓名</td><td>{{props.row.name}}</td></tr>
                  <tr><td>性别</td><td>{{props.row.gender}}</td></tr>
                  <tr><td>出生日期</td><td>{{props.row.birthday}}</td></tr>
                  <tr><td>人员状态</td><td>{{stateMap[props.row.status]}}</td></tr>
                  <tr><td>注册时间</td><td>{{props.row.createTime}}</td></tr>
                  <tr><td>到期时间</td><td>{{props.row.expireTime}}</td></tr>
                  <tr><td>手机电话</td><td>{{props.row.mobile}}</td></tr>
                  <tr><td>座机号码</td><td>{{props.row.telephone}}</td></tr>
                  <tr><td>电子邮箱</td><td>{{props.row.email}}</td></tr>
                  <tr><td>会员等级</td><td>{{props.row.level && props.row.level.name || "无"}}</td></tr>
                </tbody>
              </table>
            </div>
          </el-card>
        </template>
      </el-table-column>
      <el-table-column label="序号" width="70" type="index"/>
      <el-table-column prop="username" label="账号"/>
      <el-table-column prop="name" label="姓名"/>
      <el-table-column prop="mobile" label="手机号码"/>
      <el-table-column :show-overflow-tooltip="true" prop="email" label="邮箱"/>
      <el-table-column label="会员等级">
        <template #default="scope">
          {{scope.row.level && scope.row.level.name || "无"}}
        </template>
      </el-table-column>
      <el-table-column label="状态" align="center">
        <template #default="scope">
          {{stateMap[scope.row.status]}}
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center">
        <template #default="scope">
          <el-button link @click="reject(scope.row.id)">拉黑</el-button>
          <el-button link @click="approved(scope.row.id)">通过</el-button>
          <el-button link @click="remove(scope.row)" style="color: red;">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <!--分页组件-->
    <page :total="total" @size-change="sizeChange" @current-change="currentChange" :page-size="param.size"/>
  </div>
</template>

<script>
// @ts-nocheck
  import {ref, markRaw} from "vue"
  import Page from "@/components/Page/index.vue"
  import { memberApi } from '@/api/edu/admin-api'
const { getMemberUnauditedList, approvedMember, rejectMember, removeMember } = memberApi;
  import {confirm, success} from "@/util/tipsUtils";
  import {Search} from '@/lib/lucide-fallback'
  export default {
    name: "MemeberUnauditedList",
    components: {
      Page
    },
    setup() {
      const stateMap = {"normal": "正常", "active": "激活", "black": "黑名单", "lock": "锁定", "deleted": "注销", "unaudited": "待审核"}
      const total = ref(0)
      const memberList = ref([])
      const dataLoading = ref(true)
      const param = ref({
        current: 1,
        size: 20,
        keyword: ""
      })
      const loadMemberList = () => {
        dataLoading.value = true
        getMemberUnauditedList(param.value, res => {
          dataLoading.value = false
          memberList.value = res.list
          total.value = res.total
        })
      }
      loadMemberList();
      // 页码改变
      const currentChange = (currentPage) => {
        param.value.current = currentPage;
        loadMemberList()
      }
      // 页面显示数量改变
      const sizeChange = (size) => {
        param.value.size = size;
        loadMemberList()
      }
      const search = () => {
        loadMemberList()
      }
      const approved = function (id) {
        confirm("确认通过审批？",  "审批通过", () => {
          approvedMember({id: id}, res => {
            success("审批通过")
            loadMemberList();
          })
        })
      }
      const reject = function (id) {
        confirm("确认将该会员加入黑名单？",  "拉黑", () => {
          rejectMember({id: id}, res => {
            success("加入黑名单成功")
            loadMemberList();
          })
        })
      }
      const remove = (item) => {
        confirm("确认永久删除该会员？",  "提示", () => {
          removeMember({id: item.id}, () => {
            success("删除成功")
            loadMemberList();
          })
        })
      }
      return {
        remove,
        stateMap,
        param,
        total,
        memberList,
        currentChange,
        sizeChange,
        search,
        dataLoading,
        approved,
        reject,
        Search: markRaw(Search)
      }
    }
  }
</script>

<style scoped lang="scss">
  .member-container {
    margin: 20px;
    .head {
      margin-bottom: 10px;
      .custom-input {
        width: 50%;
        min-width: 300px;
        max-width: 400px;
      }
      .custom-btn {
        &:hover {
          color: var(--el-color-primary);
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
</style>
