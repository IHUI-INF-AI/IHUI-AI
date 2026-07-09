<template>
  <div class="member-container">
    <div class="head">
      <div class="el-form-item-wrap">
        <div class="mb-4" v-if="memberCompanyList && memberCompanyList.length">
          <label class="mb-1 block text-sm font-medium text-foreground">会员公司</label>
          <div>
            <Select clearable v-model="param.companyId" @change="search">
              <SelectOption label="全部" value=""></SelectOption>
              <SelectOption v-for="company in memberCompanyList" :label="company.name"  :value="company.id" :key="company.id"></SelectOption>
            </Select>
          </div>
        </div>
      </div>
      <Input v-model="param.keyword" clearable placeholder="输入名称搜索" class="custom-input" @keyup.enter="search"></Input>
      <Button className="search-btn" variant="outline" @click="search"><Search />搜索</Button>

      <Button variant="default" @click="showUserDialog()" v-if="!isComponent"><Plus />新增</Button>

      <Button variant="outline" @click="showImportDialog()" v-if="!isComponent"><Upload />导入</Button>
    </div>
    <div v-if="dataLoading" class="loading">加载中...</div>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead v-if="isComponent" class="w-[55px]"><input type="checkbox" :checked="allSelected" @change="toggleAll($event)" /></TableHead>
          <TableHead class="w-[70px]"></TableHead>
          <TableHead class="w-[70px]">序号</TableHead>
          <TableHead>姓名</TableHead>
          <TableHead>手机号码</TableHead>
          <TableHead>真实姓名</TableHead>
          <TableHead class="min-w-[140px]">公司</TableHead>
          <TableHead>职务</TableHead>
          <TableHead class="text-center">状态</TableHead>
          <TableHead v-if="!isComponent" class="min-w-[140px] text-center">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <template v-for="(row, index) in memberList" :key="row.id ?? index">
          <TableRow>
            <TableCell v-if="isComponent" class="w-[55px]"><input type="checkbox" :checked="multipleSelection.includes(row)" @change="toggleRow(row)" /></TableCell>
            <TableCell><button @click="toggleExpand(index)">{{ expandedRows.has(index) ? '▼' : '▶' }}</button></TableCell>
            <TableCell>{{ index + 1 }}</TableCell>
            <TableCell>{{ row.name }}</TableCell>
            <TableCell>{{ row.mobile }}</TableCell>
            <TableCell>{{ row.realname }}</TableCell>
            <TableCell>{{ row.companyName }}</TableCell>
            <TableCell>
              <div v-if="row.memberPostList && row.memberPostList.length">
                <span v-for="(mg, mIndex) in row.memberPostList" :key="mg.id">
                  {{mg.name}} {{(mIndex + 1) !== row.memberPostList.length ? "、" : ""}}
                </span>
              </div>
            </TableCell>
            <TableCell class="text-center">{{stateMap[row.status]}}</TableCell>
            <TableCell v-if="!isComponent" class="text-center">
              <Button variant="link" @click="showUserDialog(row)">编辑</Button>
              <Button variant="link" style="color: red;" @click="seal(row)" v-if="row.status === 'normal'">禁用</Button>
              <Button variant="link" v-if="row.status === 'lock'" @click="unseal(row)">解禁</Button>
              <Button variant="link" @click="showResetPwdDialog(row)">重置密码</Button>
              <Button variant="link" @click="batchShowSignUpListDrawer(row)">批量报名</Button>
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
                      <tr><td>真实姓名</td><td>{{row.realname}}</td></tr>
                      <tr><td>性别</td><td>{{row.gender}}</td></tr>
                      <tr><td>出生日期</td><td>{{row.birthday}}</td></tr>
                      <tr><td>人员状态</td><td>{{stateMap[row.status]}}</td></tr>
                      <tr><td>注册时间</td><td>{{row.createTime}}</td></tr>
                      <tr><td>过期时间</td><td>{{row.expireTime}}</td></tr>
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
    <Dialog v-model="showResetPwdDialogFlag" width="90%" @close="hideResetPwdDialog">
      <DialogHeader>
        <DialogTitle>重置密码</DialogTitle>
      </DialogHeader>
      <div style="padding: 10px 0;text-align: center;">
        <div style="margin: 10px;display: inline-block;">新密码：</div>
        <div style="margin: 10px;display: inline-block;width: 300px;">
          <Input style="height: 40px;" v-model="memberReset.password" placeholder="请输入密码"></Input>
        </div>
      </div>
      <DialogFooter>
        <div style="text-align: center;">
          <Button variant="outline" @click="resetPwdSubmit">提交</Button>
        </div>
      </DialogFooter>
    </Dialog>
    <!-- 编辑 -->
    <Dialog v-model="showUserDialogFlag" width="90%" @close="hideUserDialog">
      <DialogHeader>
        <DialogTitle>编辑会员</DialogTitle>
      </DialogHeader>
      <form ref="userRef" @submit.prevent class="user-form">
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">名字：</label>
          <div>
            <Input v-model="member.name" placeholder="请输入名字"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">账号：</label>
          <div>
            <Input v-model="member.username" placeholder="请输入账号"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">邮箱：</label>
          <div>
            <Input v-model="member.email" placeholder="请输入邮箱"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">手机号码：</label>
          <div>
            <Input v-model="member.mobile" placeholder="请输入手机号码"></Input>
          </div>
        </div>
        <div class="mb-4" v-if="!member.id">
          <label class="mb-1 block text-sm font-medium text-foreground">密码：</label>
          <div>
            <Input v-model="member.password" placeholder="请输入密码"></Input>
          </div>
        </div>
        <div class="mb-4" v-if="!member.id">
          <label class="mb-1 block text-sm font-medium text-foreground">确认密码：</label>
          <div>
            <Input v-model="member.confirmPassword" placeholder="请再次输入密码"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">工号：</label>
          <div>
            <Input v-model="member.code" placeholder="请输入工号"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">出生日期：</label>
          <div>
            <el-date-picker style="width: 100%;" v-model="member.birthday" type="date" placeholder="选择出生日期"></el-date-picker>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">性别：</label>
          <div>
            <Radio v-model="member.gender" value="男">男</Radio>
            <Radio v-model="member.gender" value="女">女</Radio>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">办公电话：</label>
          <div>
            <Input v-model="member.telephone" placeholder="请输入电话"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">过期时间：</label>
          <div>
            <el-date-picker style="width: 100%;" v-model="member.expireTime" type="date" placeholder="过期时间" format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss"></el-date-picker>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">会员公司：</label>
          <div>
            <Button variant="outline" @click="showMemberCompany">选择</Button>
            <template v-for="(item, index) in selectMemberCompanyList" :key="item.id">
              <div class="flex">
                <Input placeholder="请选择公司" v-model="item.name" readonly />
                <span class="delete-btn" @click="deleteSelectMemberCompany(item, index)">
                  <Delete class="h-4 w-4" />
                </span>
              </div>
            </template>
            <Dialog class="custom-dialog" v-model="memberCompanyDialogFlag" width="80%" @close="hideMemberCompany">
              <DialogHeader>
                <DialogTitle>选择公司</DialogTitle>
              </DialogHeader>
              <member-company :cancel-callback="hideMemberCompany" :select-callback="selectMemberCompany" :is-component="true"/>
            </Dialog>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">会员分组：</label>
          <div>
            <Button variant="outline" @click="showMemberGroup">选择</Button>
            <template v-for="(item, index) in selectMemberGroupList" :key="item.id">
              <div class="flex">
                <Input placeholder="请选择分组" v-model="item.name" readonly />
                <span class="delete-btn" @click="deleteSelectMemberGroup(item, index)">
                  <Delete class="h-4 w-4" />
                </span>
              </div>
            </template>
            <Dialog class="custom-dialog" v-model="memberGroupDialogFlag" width="80%" @close="hideMemberGroup">
              <DialogHeader>
                <DialogTitle>选择分组</DialogTitle>
              </DialogHeader>
              <member-group :cancel-callback="hideMemberGroup" :select-callback="selectMemberGroup" :is-component="true"/>
            </Dialog>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">会员岗位：</label>
          <div>
            <Button variant="outline" @click="showMemberPost">选择</Button>
            <template v-for="(item, index) in selectMemberPostList" :key="item.id">
              <div class="flex">
                <Input placeholder="请选择岗位" v-model="item.name" readonly />
                <span class="delete-btn" @click="deleteSelectMemberPost(item, index)">
                  <Delete class="h-4 w-4" />
                </span>
              </div>
            </template>
            <Dialog class="custom-dialog" v-model="memberPostDialogFlag" width="80%" @close="hideMemberPost">
              <DialogHeader>
                <DialogTitle>选择岗位</DialogTitle>
              </DialogHeader>
              <member-post :cancel-callback="hideMemberPost" :select-callback="selectMemberPost" :is-component="true"/>
            </Dialog>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">会员标签：</label>
          <div>
            <Tag :key="tag" v-for="(tag, index) in tags" closable @close="delTag(index)">{{tag}}</Tag>
            <Input class="input-new-tag" v-if="tagsVisible" v-model="tag" ref="tagsRef" @blur="tagsInputConfirm" placeholder="请输入标签" @keydown.enter="tagsInputConfirm"></Input>
            <Button v-else className="button-new-tag" variant="outline" @click="showTagsInput">+ 新增标签</Button>
          </div>
        </div>
      </form>
      <DialogFooter>
        <div style="text-align: center;">
          <Button variant="default" @click="submit">提交</Button>
          <Button variant="outline" @click="hideUserDialog">关闭</Button>
        </div>
      </DialogFooter>
    </Dialog>

    <Dialog v-model="showImportDialogFlag" width="90%" @close="hideImportDialog">
      <DialogHeader>
        <DialogTitle>导入会员</DialogTitle>
      </DialogHeader>
      <form ref="importRef" @submit.prevent class="user-form">
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">导入文件：</label>
          <div>
            <input style="min-width: 400px;" type="file" placeholder="请输入选择文件" @change="handleFileChange"/>
          </div>
        </div>
      </form>
      <DialogFooter>
        <div style="text-align: center;">
          <Button variant="default" @click="submitImport">提交</Button>
          <Button variant="outline" @click="hideImportDialog">关闭</Button>
        </div>
      </DialogFooter>
    </Dialog>

    <Dialog v-model="showImportResultDialogFlag" style="max-height: 100vh;" top="0" width="90%" @close="hideImportResultDialog">
      <DialogHeader>
        <DialogTitle>编辑用户</DialogTitle>
      </DialogHeader>
      <div v-if="importResult" class="result-wrap">
        <div class="result-header">
          <div class="result-header-item">总数量：{{(importResult.successCount || 0) + (importResult.failureCount || 0)}}</div>
          <div class="result-header-item">成功数量：{{importResult.successCount || 0}}</div>
          <div class="result-header-item">失败数量：{{importResult.failureCount || 0}}</div>
        </div>
        <div class="result-main">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>序号</TableHead>
                <TableHead>行号</TableHead>
                <TableHead>结果</TableHead>
                <TableHead>结果描述</TableHead>
                <TableHead>公司名称</TableHead>
                <TableHead>学员姓名</TableHead>
                <TableHead>手机号</TableHead>
                <TableHead>职务</TableHead>
                <TableHead>学习课程</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, index) in importResult.resultItemList" :key="row.id ?? index">
                <TableCell>{{ row.serialNum }}</TableCell>
                <TableCell>{{ row.rowNum }}</TableCell>
                <TableCell>
                  <span :class="{'result-sccess': row.success, 'result-fail': !row.success}">
                    {{row.success ? '成功' : '失败'}}
                  </span>
                </TableCell>
                <TableCell>{{ row.message }}</TableCell>
                <TableCell>{{ row.companyName }}</TableCell>
                <TableCell>{{ row.memberName }}</TableCell>
                <TableCell>{{ row.memberMobile }}</TableCell>
                <TableCell>{{ row.postName }}</TableCell>
                <TableCell>{{ row.lessonName }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
      <DialogFooter>
        <div style="text-align: center;">
          <Button variant="outline" @click="hideImportResultDialog">关闭</Button>
        </div>
      </DialogFooter>
    </Dialog>

    <template v-if="isComponent">
      <div class="dialog-footer" style="text-align: right;margin-top: 30px;">
        <Button variant="outline" @click="cancelCallback">取 消</Button>
        <Button variant="default" @click="selectSelectionChange">确 定</Button>
      </div>
    </template>
    <batch-signup-lesson v-if="batchSignUpDrawer" :drawer-close="batchSignUpDrawerClose" :show-drawer="batchSignUpDrawer" :topic="selectTopic" />
  </div>
</template>

<script>
// @ts-nocheck
  import {ref, markRaw, computed} from "vue"
  import Page from "@/components/Page/index.vue"
  import { memberApi } from '@/api/edu/admin-api'
const { getMemberList, sealMember, unsealMember, updateMember, memberPwdReset, createMember, findMemberCompanyList, batchUploadMember, removeMember } = memberApi;
  import {confirm, error, success} from "@/util/tipsUtils"
  import MemberGroup from "@/views/edu/admin/member/group/index.vue";
  import MemberPost from "@/views/edu/admin/member/post/index.vue";
  import MemberCompany from "@/views/edu/admin/member/company/index.vue";
  import {Delete, Search, Plus, Upload} from '@/lib/lucide-fallback';
  import BatchSignupLesson from "@/views/edu/admin/learn/signup/batchlesson/index.vue";
  import { Card, CardHeader, CardContent } from '@/components/ui/card'
  import Button from '@/components/ui/Button.vue'
  import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
  import { Input } from '@/components/ui/input'
  import { Radio } from '@/components/ui/radio'
  import { Tag } from '@/components/ui/tag'
  import { Select, SelectOption } from '@/components/ui/select'
export default {
    name: "MemberList",
    components: {
    Radio,
    Button,
    Card,
    CardHeader,
    CardContent,
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
      BatchSignupLesson,
      Delete,
      Search,
      Plus,
      Upload,
      MemberGroup,
      MemberPost,
      MemberCompany,
      Page,
      Input,
      Tag,
      Select,
      SelectOption
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
      const showResetPwdDialogFlag = ref(false)
      const showUserDialogFlag = ref(false)
      const stateMap = {"normal": "正常", "active": "激活", "black": "黑名单", "lock": "锁定", "deleted": "注销", "unaudited": "待审核"}
      const total = ref(0)
      const memberList = ref([])
      const dataLoading = ref(true)
      const param = ref({
        current: 1,
        size: 20,
        keyword: "",
      })
      const member = ref({})
      const loadMemberList = () => {
        dataLoading.value = true
        if (param.value.companyId) {
          param.value.memberCompanyIdList = [param.value.companyId]
        } else {
          param.value.memberCompanyIdList = null
        }
        getMemberList(param.value, res => {
          dataLoading.value = false
          memberList.value = res.list
          total.value = res.total
        }).catch(() => {
          dataLoading.value = false
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
      const seal = function (item) {
        confirm("确认禁用该会员【"+ item.name +"】",  "禁用", () => {
          sealMember({id: item.id}, () => {
            success("禁用成功")
            loadMemberList()
          })
        })
      }
      const unseal = function (item) {
        confirm("确认解禁该会员【"+ item.name +"】",  "解禁", () => {
          unsealMember({id: item.id}, () => {
            success("解禁成功")
            loadMemberList()
          })
        })
      }
      const showUserDialog = function (item) {
        if (item) {
          selectMemberGroupList.value = item.memberGroupList
          selectMemberCompanyList.value = item.memberCompanyList
          selectMemberPostList.value = item.memberPostList
          tags.value = item.memberTagNameList
        } else {
          selectMemberGroupList.value = []
          selectMemberCompanyList.value = []
          selectMemberPostList.value = []
          tags.value = []
        }
        showUserDialogFlag.value = true
        member.value = item || {}
        if (member.value && member.value.id) {
          // 越过校验
          member.value.password = "123456"
          member.value.confirmPassword = "123456"
        } else {
          member.value.password = ""
          member.value.confirmPassword = ""
        }
      }
      const hideUserDialog = function () {
        showUserDialogFlag.value = false
      }
      const userRef = ref(null)
      const userRules = ref({
        name: [{ required: true, message: "请输入名字", trigger: "blur" }],
        username: [{ required: true, message: "请输入账号", trigger: "blur" }],
        mobile: [{ required: true, message: "请输入手机号码", trigger: "blur" }],
        // email: [{ required: true, message: "请输入邮箱", trigger: "blur" }],
        password: [{ required: true, message: "请输入密码", trigger: "blur" }],
        confirmPassword: [{ required: true, message: "请再次输入密码", trigger: "blur" }],
      })
      const submit = function () {
        userRef.value.validate((valid) => {
          if (!valid) {
            return false
          }
          // 标签
          member.value.memberTagNameList = tags.value;
          if (member.value.password !== member.value.confirmPassword) {
            return error("两次密码不一致")
          }
          member.value.createTime = null
          member.value.updateTime = null
          if (member.value && member.value.id) {
            member.value.password = null
            member.value.confirmPassword = null
            updateMember(member.value, () => {
              success("更新成功")
              loadMemberList();
              hideUserDialog()
            })
          } else {
            createMember(member.value, () => {
              success("创建成功")
              param.value.current = 1
              loadMemberList();
              hideUserDialog()
            })
          }
        })
      }
      const memberReset = ref({
        id: "",
        password: ""
      })
      const showResetPwdDialog = function (item) {
        showResetPwdDialogFlag.value = true
        memberReset.value.id = item.id
      }
      const hideResetPwdDialog = function () {
        showResetPwdDialogFlag.value = false
      }
      const resetPwdSubmit = function () {
        memberPwdReset(memberReset.value, (res) => {
          success("重置成功")
          hideResetPwdDialog()
        })
      }

      const selectMemberGroupList = ref([])
      const memberGroupDialogFlag = ref(false)
      const showMemberGroup = () => {
        memberGroupDialogFlag.value = true
      }
      const hideMemberGroup = () => {
        memberGroupDialogFlag.value = false
      }
      const selectMemberGroup = (val) => {
        if (!member.value.memberGroupIdList) {
          member.value.memberGroupIdList = []
          selectMemberGroupList.value = []
        }
        for (const v of val) {
          if (member.value.memberGroupIdList.indexOf(v.id) === -1) {
            member.value.memberGroupIdList.push(v.id)
            selectMemberGroupList.value.push(v)
          }
        }
        hideMemberGroup()
      }
      const deleteSelectMemberGroup = (item, index) => {
        selectMemberGroupList.value.splice(index, 1);
        member.value.memberGroupIdList.splice(member.value.memberGroupIdList.indexOf(item.id), 1);
      }

      const selectMemberPostList = ref([])
      const memberPostDialogFlag = ref(false)
      const showMemberPost = () => {
        memberPostDialogFlag.value = true
      }
      const hideMemberPost = () => {
        memberPostDialogFlag.value = false
      }
      const selectMemberPost = (val) => {
        if (!member.value.memberPostIdList) {
          member.value.memberPostIdList = []
          selectMemberPostList.value = []
        }
        for (const v of val) {
          if (member.value.memberPostIdList.indexOf(v.id) === -1) {
            member.value.memberPostIdList.push(v.id)
            selectMemberPostList.value.push(v)
          }
        }
        hideMemberPost()
      }
      const deleteSelectMemberPost = (item, index) => {
        selectMemberPostList.value.splice(index, 1);
        member.value.memberPostIdList.splice(member.value.memberPostIdList.indexOf(item.id), 1);
      }

      const selectMemberCompanyList = ref([])
      const memberCompanyDialogFlag = ref(false)
      const showMemberCompany = () => {
        memberCompanyDialogFlag.value = true
      }
      const hideMemberCompany = () => {
        memberCompanyDialogFlag.value = false
      }
      const selectMemberCompany = (val) => {
        if (val.length > 1) {
          error("只能选择一个公司")
          return;
        }
        if (!member.value.memberCompanyIdList) {
          member.value.memberCompanyIdList = []
          selectMemberCompanyList.value = []
        }
        for (const v of val) {
          if (member.value.memberCompanyIdList.indexOf(v.id) === -1) {
            member.value.memberCompanyIdList.push(v.id)
            selectMemberCompanyList.value.push(v)
          }
        }
        hideMemberCompany()
      }
      const deleteSelectMemberCompany = (item, index) => {
        selectMemberCompanyList.value.splice(index, 1);
        member.value.memberCompanyIdList.splice(member.value.memberCompanyIdList.indexOf(item.id), 1);
      }

      const tags = ref([])
      const tag = ref("")
      const tagsVisible = ref(false)
      const tagsRef = ref(null)
      const showTagsInput = () => {
        tagsVisible.value = true
      }
      const tagsInputConfirm = () => {
        if (!tags.value) {
          tags.value = []
        }
        if (tag.value) {
          tags.value.push(tag.value)
          tag.value = ""
        }
        tagsVisible.value = false
      }
      const delTag = (index) => {
        tags.value.splice(index, 1)
      }

      const multipleSelection = ref([])
      const handleSelectionChange = (val) => {
        multipleSelection.value = val;
      }
      const allSelected = computed(() => memberList.value.length > 0 && memberList.value.every(item => multipleSelection.value.includes(item)))
      const toggleAll = (event) => {
        if (event.target.checked) {
          multipleSelection.value = [...memberList.value]
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
      const selectSelectionChange = () => {
        if (!multipleSelection.value.length) {
          error("请至少选择一个")
        }
        props.selectCallback && props.selectCallback(multipleSelection.value)
      }

      const batchSignUpDrawer = ref(false)
      const batchSignUpDrawerClose = (done) => {
        batchSignUpDrawer.value = false
        done()
      }
      const selectTopic = ref(null)
      const batchShowSignUpListDrawer = (item) => {
        batchSignUpDrawer.value = true
        selectTopic.value = item
      }

      const memberCompanyList = ref(null);
      findMemberCompanyList({current: 1, size: 10000}, resp => {
        memberCompanyList.value = resp.list
      })

      const showImportDialogFlag = ref(false)
      const showImportDialog = () => {
        showImportDialogFlag.value = true
      }
      const hideImportDialog = function () {
        showImportDialogFlag.value = false
      }

      const submitImport = () => {
        uploadFile()
      }

      const showImportResultDialogFlag = ref(null)

      const showImportResultDialog = function () {
        showImportResultDialogFlag.value = true
      }
      const hideImportResultDialog = function () {
        showImportResultDialogFlag.value = false
      }

      const file = ref(null);  // 用于存储选择的文件
      const importResult = ref(null);  // 存储导入结果

      // 处理文件选择
      const handleFileChange = (event) => {
        const selectedFile = event.target.files[0];
        if (selectedFile) {
          file.value = selectedFile;
        }
      };
      const uploadingFlag = ref(false)
      // 上传文件并获取导入结果
      const uploadFile = async () => {
        if (uploadingFlag.value) {
          error('正在导入会员，请等待...');
          return;
        }
        uploadingFlag.value = true
        if (!file.value) {
          error('请选择导入文件');
          return;
        }

        const formData = new FormData();
        formData.append('file', file.value);

        batchUploadMember(formData, (res) => {
          importResult.value = res
          showImportResultDialog()
          uploadingFlag.value = false
        }).catch(() => {
          error("导入会员失败")
          uploadingFlag.value = false
        })
      };
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
        uploadingFlag,
        showImportResultDialogFlag,
        showImportResultDialog,
        hideImportResultDialog,
        importResult,
        file,
        handleFileChange,
        showImportDialogFlag,
        showImportDialog,
        hideImportDialog,
        submitImport,
        memberCompanyList,
        selectTopic,
        batchSignUpDrawer,
        batchShowSignUpListDrawer,
        batchSignUpDrawerClose,
        handleSelectionChange,
        selectSelectionChange,
        allSelected,
        toggleAll,
        toggleRow,
        expandedRows,
        toggleExpand,
        tags,
        tag,
        tagsVisible,
        tagsRef,
        showTagsInput,
        tagsInputConfirm,
        delTag,
        selectMemberGroupList,
        memberGroupDialogFlag,
        showMemberGroup,
        hideMemberGroup,
        selectMemberGroup,
        deleteSelectMemberGroup,

        selectMemberCompanyList,
        memberCompanyDialogFlag,
        showMemberCompany,
        hideMemberCompany,
        selectMemberCompany,
        deleteSelectMemberCompany,

        selectMemberPostList,
        memberPostDialogFlag,
        showMemberPost,
        hideMemberPost,
        selectMemberPost,
        deleteSelectMemberPost,

        userRef,
        userRules,
        stateMap,
        param,
        total,
        memberList,
        currentChange,
        sizeChange,
        search,
        dataLoading,
        seal,
        unseal,
        showUserDialogFlag,
        showUserDialog,
        hideUserDialog,
        member,
        submit,
        showResetPwdDialogFlag,
        showResetPwdDialog,
        hideResetPwdDialog,
        resetPwdSubmit,
        memberReset,
        Search: markRaw(Search),
        Plus: markRaw(Plus),
        Upload: markRaw(Upload)
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
  .user-form {
    display: inline-block;
    .el-form-item {
      width: 50%;
      float: left;
    }
  }
  .delete-btn {
    cursor: pointer;
  }
  :deep(.sign-up-drawer){
    width: calc(100% - 210px);
    .topic-list-wrapper {
      padding: 10px;
    }
  }
  .el-form-item-wrap {
    display: inline-block;
  }

  .result-header {
    display: flex;
    align-items: center;
  }

  .result-header-item {
    margin-right: 10px;
  }

  .result-wrap {
    display: flex;
    flex-flow: column;
  }

  .result-main {
    overflow: auto;
    height: 80vh;
  }

  .result-fail {
    color: red;
  }

  .result-success {
    color: green;
  }
</style>
