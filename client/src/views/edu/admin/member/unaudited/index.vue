<template>
  <div class="member-container">
    <div class="head">
      <Input v-model="param.keyword" clearable placeholder="输入名称搜索" class="custom-input" @keyup.enter="search"></Input>
      <Button className="search-btn" variant="outline" @click="search"><Search />搜索</Button>
    </div>
    <div v-if="dataLoading" class="loading">加载中...</div>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-[70px]"></TableHead>
          <TableHead class="w-[70px]">序号</TableHead>
          <TableHead>账号</TableHead>
          <TableHead>姓名</TableHead>
          <TableHead>手机号码</TableHead>
          <TableHead>邮箱</TableHead>
          <TableHead>会员等级</TableHead>
          <TableHead class="text-center">状态</TableHead>
          <TableHead class="text-center">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <template v-for="(row, index) in memberList" :key="row.id ?? index">
          <TableRow>
            <TableCell><button @click="toggleExpand(index)">{{ expandedRows.has(index) ? '▼' : '▶' }}</button></TableCell>
            <TableCell>{{ index + 1 }}</TableCell>
            <TableCell>{{ row.username }}</TableCell>
            <TableCell>{{ row.name }}</TableCell>
            <TableCell>{{ row.mobile }}</TableCell>
            <TableCell>{{ row.email }}</TableCell>
            <TableCell>{{row.level && row.level.name || "无"}}</TableCell>
            <TableCell class="text-center">{{stateMap[row.status]}}</TableCell>
            <TableCell class="text-center">
              <Button variant="link" @click="reject(row.id)">拉黑</Button>
              <Button variant="link" @click="approved(row.id)">通过</Button>
              <Button variant="link" @click="remove(row)" style="color: red;">删除</Button>
            </TableCell>
          </TableRow>
          <tr v-if="expandedRows.has(index)">
            <td colspan="99">
              <Card class="box-card">
                <CardHeader>
                  <div>
                    <span>基础信息</span>
                  </div>
                </CardHeader>
                  <CardContent>
                <div class="table-wrapper">
                  <table class="fl-table">
                    <tbody>
                      <tr><td>编号</td><td>{{row.code}}</td></tr>
                      <tr><td>姓名</td><td>{{row.name}}</td></tr>
                      <tr><td>性别</td><td>{{row.gender}}</td></tr>
                      <tr><td>出生日期</td><td>{{row.birthday}}</td></tr>
                      <tr><td>人员状态</td><td>{{stateMap[row.status]}}</td></tr>
                      <tr><td>注册时间</td><td>{{row.createTime}}</td></tr>
                      <tr><td>到期时间</td><td>{{row.expireTime}}</td></tr>
                      <tr><td>手机电话</td><td>{{row.mobile}}</td></tr>
                      <tr><td>座机号码</td><td>{{row.telephone}}</td></tr>
                      <tr><td>电子邮箱</td><td>{{row.email}}</td></tr>
                      <tr><td>会员等级</td><td>{{row.level && row.level.name || "无"}}</td></tr>
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
  import { Card, CardHeader, CardContent } from '@/components/ui/card'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
  import Button from '@/components/ui/Button.vue'
  import { Input } from '@/components/ui/input'
export default {
    name: "MemeberUnauditedList",
    components: {
    Card,
    CardHeader,
    CardContent,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    Button,
    Search,
      Page,
      Input
    },
    setup() {
      const stateMap = {"normal": "正常", "active": "激活", "black": "黑名单", "lock": "锁定", "deleted": "注销", "unaudited": "待审核"}
      const total = ref(0)
      const memberList = ref([])
      const dataLoading = ref(true)
      const expandedRows = ref(new Set())
      const toggleExpand = (index) => {
        if (expandedRows.value.has(index)) {
          expandedRows.value.delete(index)
        } else {
          expandedRows.value.add(index)
        }
      }
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
        expandedRows,
        toggleExpand,
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
          color: hsl(var(--primary));
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
