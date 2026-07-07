<template>
  <div class="member-container">
    <div class="head">
      <div class="el-form-item-wrap">
        <el-form-item label="会员公司" v-if="memberCompanyList && memberCompanyList.length">
          <el-select clearable filterable v-model="param.companyId" @change="search">
            <el-option label="全部" value=""></el-option>
            <el-option v-for="company in memberCompanyList" :label="company.name"  :value="company.id" :key="company.id"></el-option>
          </el-select>
        </el-form-item>
      </div>
      <el-input v-model="param.keyword" clearable placeholder="输入名称搜索" class="custom-input" @keyup.enter="search"></el-input>
      <el-button class="search-btn" :icon="Search" @click="search">搜索</el-button>

      <el-button type="primary" :icon="Plus" @click="showUserDialog()" v-if="!isComponent">新增</el-button>

      <el-button :icon="Upload" @click="showImportDialog()" v-if="!isComponent">导入</el-button>
    </div>
    <el-table v-loading="dataLoading" :data="memberList" style="width: 100%;" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="45" v-if="isComponent"/>
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
                  <tr><td>真实姓名</td><td>{{props.row.realname}}</td></tr>
                  <tr><td>性别</td><td>{{props.row.gender}}</td></tr>
                  <tr><td>出生日期</td><td>{{props.row.birthday}}</td></tr>
                  <tr><td>人员状态</td><td>{{stateMap[props.row.status]}}</td></tr>
                  <tr><td>注册时间</td><td>{{props.row.createTime}}</td></tr>
                  <tr><td>过期时间</td><td>{{props.row.expireTime}}</td></tr>
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
<!--      <el-table-column prop="username" label="账号"/>-->
      <el-table-column label="序号" width="70" type="index"/>
      <el-table-column prop="name" label="姓名"/>
      <el-table-column prop="mobile" label="手机号码"/>
      <el-table-column prop="realname" label="真实姓名"/>
      <el-table-column prop="companyName" label="公司"  min-width="140"/>
      <el-table-column label="职务">
        <template #default="scope">
          <div v-if="scope.row.memberPostList && scope.row.memberPostList.length">
            <span v-for="(mg, index) in scope.row.memberPostList" :key="mg.id">
              {{mg.name}} {{(index + 1) !== scope.row.memberPostList.length ? "、" : ""}}
            </span>
          </div>
        </template>
      </el-table-column>
<!--      <el-table-column :show-overflow-tooltip="true" prop="email" label="邮箱"/>-->
<!--      <el-table-column label="会员等级">-->
<!--        <template #default="scope">-->
<!--          {{scope.row.level && scope.row.level.name || "无"}}-->
<!--        </template>-->
<!--      </el-table-column>-->
      <el-table-column label="状态" align="center">
        <template #default="scope">
          {{stateMap[scope.row.status]}}
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" min-width="140" v-if="!isComponent">
        <template #default="scope">
          <el-button link @click="showUserDialog(scope.row)">编辑</el-button>
          <el-button link style="color: red;" @click="seal(scope.row)" v-if="scope.row.status === 'normal'">禁用</el-button>
          <el-button link v-if="scope.row.status === 'lock'" @click="unseal(scope.row)">解禁</el-button>
          <el-button link @click="showResetPwdDialog(scope.row)">重置密码</el-button>
          <el-button link @click="batchShowSignUpListDrawer(scope.row)">批量报名</el-button>
          <el-button link @click="remove(scope.row)" style="color: red;">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <!--分页组件-->
    <page :total="total" @size-change="sizeChange" @current-change="currentChange" :page-size="param.size"/>
    <el-dialog v-model="showResetPwdDialogFlag" :title="'重置密码'" append-to-body width="90%" :before-close="hideResetPwdDialog">
      <div style="padding: 10px 0;text-align: center;">
        <div style="margin: 10px;display: inline-block;">新密码：</div>
        <div style="margin: 10px;display: inline-block;width: 300px;">
          <el-input style="height: 40px;" v-model="memberReset.password" placeholder="请输入密码"></el-input>
        </div>
      </div>
      <template #footer>
        <div style="text-align: center;">
          <el-button @click="resetPwdSubmit">提交</el-button>
        </div>
      </template>
    </el-dialog>
    <!-- 编辑 -->
    <el-dialog v-model="showUserDialogFlag" :title="'编辑会员'" append-to-body width="90%" :before-close="hideUserDialog">
      <el-form :model="member" :rules="userRules" ref="userRef" class="user-form" label-width="150px">
        <el-form-item label="名字：" prop="name">
          <el-input v-model="member.name" placeholder="请输入名字"></el-input>
        </el-form-item>
        <el-form-item label="账号：" prop="username">
          <el-input v-model="member.username" placeholder="请输入账号"></el-input>
        </el-form-item>
        <el-form-item label="邮箱：" prop="email">
          <el-input v-model="member.email" placeholder="请输入邮箱"></el-input>
        </el-form-item>
        <el-form-item label="手机号码：" prop="mobile">
          <el-input v-model="member.mobile" placeholder="请输入手机号码"></el-input>
        </el-form-item>
        <el-form-item label="密码：" prop="password" v-if="!member.id">
          <el-input v-model="member.password" placeholder="请输入密码"></el-input>
        </el-form-item>
        <el-form-item label="确认密码：" prop="confirmPassword" v-if="!member.id">
          <el-input v-model="member.confirmPassword" placeholder="请再次输入密码"></el-input>
        </el-form-item>
        <el-form-item label="工号：" prop="code">
          <el-input v-model="member.code" placeholder="请输入工号"></el-input>
        </el-form-item>
        <el-form-item label="出生日期：" prop="birthday">
          <el-date-picker style="width: 100%;" v-model="member.birthday" type="date" placeholder="选择出生日期"></el-date-picker>
        </el-form-item>
        <el-form-item label="性别：" prop="gender">
          <el-radio v-model="member.gender" label="男">男</el-radio>
          <el-radio v-model="member.gender" label="女">女</el-radio>
        </el-form-item>
        <el-form-item label="办公电话：" prop="telephone">
          <el-input v-model="member.telephone" placeholder="请输入电话"></el-input>
        </el-form-item>
        <el-form-item label="过期时间：" prop="contractStartDate">
          <el-date-picker style="width: 100%;" v-model="member.expireTime" type="date" placeholder="过期时间" format="YYYY-MM-DD HH:mm:ss" value-format="YYYY-MM-DD HH:mm:ss"></el-date-picker>
        </el-form-item>
        <el-form-item label="会员公司：" prop="telephone">
          <el-button @click="showMemberCompany">选择</el-button>
          <template v-for="(item, index) in selectMemberCompanyList" :key="item.id">
            <el-input placeholder="请选择公司" v-model="item.name" readonly>
              <template #suffix>
                <span class="delete-btn" @click="deleteSelectMemberCompany(item, index)">
                  <el-icon><Delete/></el-icon>
                </span>
              </template>
            </el-input>
          </template>
          <el-dialog class="custom-dialog" title="选择公司" v-model="memberCompanyDialogFlag" :before-close="hideMemberCompany" width="80%">
            <member-company :cancel-callback="hideMemberCompany" :select-callback="selectMemberCompany" :is-component="true"/>
          </el-dialog>
        </el-form-item>
        <el-form-item label="会员分组：" prop="telephone">
          <el-button @click="showMemberGroup">选择</el-button>
          <template v-for="(item, index) in selectMemberGroupList" :key="item.id">
            <el-input placeholder="请选择分组" v-model="item.name" readonly>
              <template #suffix>
                <span class="delete-btn" @click="deleteSelectMemberGroup(item, index)">
                  <el-icon><Delete/></el-icon>
                </span>
              </template>
            </el-input>
          </template>
          <el-dialog class="custom-dialog" title="选择分组" v-model="memberGroupDialogFlag" :before-close="hideMemberGroup" width="80%">
            <member-group :cancel-callback="hideMemberGroup" :select-callback="selectMemberGroup" :is-component="true"/>
          </el-dialog>
        </el-form-item>
        <el-form-item label="会员岗位：" prop="telephone">
          <el-button @click="showMemberPost">选择</el-button>
          <template v-for="(item, index) in selectMemberPostList" :key="item.id">
            <el-input placeholder="请选择岗位" v-model="item.name" readonly>
              <template #suffix>
                <span class="delete-btn" @click="deleteSelectMemberPost(item, index)">
                  <el-icon><Delete/></el-icon>
                </span>
              </template>
            </el-input>
          </template>
          <el-dialog class="custom-dialog" title="选择岗位" v-model="memberPostDialogFlag" :before-close="hideMemberPost" width="80%">
            <member-post :cancel-callback="hideMemberPost" :select-callback="selectMemberPost" :is-component="true"/>
          </el-dialog>
        </el-form-item>
        <el-form-item label="会员标签：" prop="tag">
          <el-tag :key="tag" v-for="(tag, index) in tags" closable :disable-transitions="false" @close="delTag(index)">{{tag}}</el-tag>
          <el-input class="input-new-tag" v-if="tagsVisible" v-model="tag" ref="tagsRef" @blur="tagsInputConfirm" placeholder="请输入标签" @keydown.enter="tagsInputConfirm"></el-input>
          <el-button v-else class="button-new-tag" @click="showTagsInput">+ 新增标签</el-button>
        </el-form-item>
      </el-form>
      <template #footer>
        <div style="text-align: center;">
          <el-button @click="submit" type="primary">提交</el-button>
          <el-button @click="hideUserDialog">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="showImportDialogFlag" :title="'导入会员'" append-to-body width="90%" :before-close="hideImportDialog">
      <el-form ref="importRef" class="user-form" label-width="150px">
        <el-form-item label="导入文件：" prop="name">
          <input style="min-width: 400px;" type="file" placeholder="请输入选择文件" @change="handleFileChange"/>
        </el-form-item>
      </el-form>
      <template #footer>
        <div style="text-align: center;">
          <el-button @click="submitImport" :loading="uploadingFlag" type="primary">提交</el-button>
          <el-button @click="hideImportDialog">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="showImportResultDialogFlag" style="max-height: 100vh;" top="0" :title="'编辑用户'" append-to-body width="90%" :before-close="hideImportResultDialog">
      <div v-if="importResult" class="result-wrap">
        <div class="result-header">
          <div class="result-header-item">总数量：{{(importResult.successCount || 0) + (importResult.failureCount || 0)}}</div>
          <div class="result-header-item">成功数量：{{importResult.successCount || 0}}</div>
          <div class="result-header-item">失败数量：{{importResult.failureCount || 0}}</div>
        </div>
        <div class="result-main">
          <el-table :data="importResult.resultItemList">
            <el-table-column label="序号" prop="serialNum"></el-table-column>
            <el-table-column label="行号" prop="rowNum"></el-table-column>
            <el-table-column label="结果">
              <template #default="score">
                <span :class="{'result-sccess': score.row.success, 'result-fail': !score.row.success}">
                  {{score.row.success ? '成功' : '失败'}}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="结果描述" prop="message"></el-table-column>
            <el-table-column label="公司名称" prop="companyName"></el-table-column>
            <el-table-column label="学员姓名" prop="memberName"></el-table-column>
            <el-table-column label="手机号" prop="memberMobile"></el-table-column>
            <el-table-column label="职务" prop="postName"></el-table-column>
            <el-table-column label="学习课程" prop="lessonName"></el-table-column>
          </el-table>
        </div>
      </div>
      <template #footer>
        <div style="text-align: center;">
          <el-button @click="hideImportResultDialog">关闭</el-button>
        </div>
      </template>
    </el-dialog>

    <template v-if="isComponent">
      <div class="dialog-footer" style="text-align: right;margin-top: 30px;">
        <el-button @click="cancelCallback">取 消</el-button>
        <el-button type="primary" @click="selectSelectionChange">确 定</el-button>
      </div>
    </template>
    <batch-signup-lesson v-if="batchSignUpDrawer" :drawer-close="batchSignUpDrawerClose" :show-drawer="batchSignUpDrawer" :topic="selectTopic" />
  </div>
</template>

<script>
// @ts-nocheck
  import {ref, markRaw} from "vue"
  import Page from "@/components/Page/index.vue"
  import { memberApi } from '@/api/edu/admin-api'
const { getMemberList, sealMember, unsealMember, updateMember, memberPwdReset, createMember, findMemberCompanyList, batchUploadMember, removeMember } = memberApi;
  import {confirm, error, success} from "@/util/tipsUtils"
  import MemberGroup from "@/views/edu/admin/member/group/index.vue";
  import MemberPost from "@/views/edu/admin/member/post/index.vue";
  import MemberCompany from "@/views/edu/admin/member/company/index.vue";
  import {Delete, Search, Plus, Upload} from '@/lib/lucide-fallback';
  import BatchSignupLesson from "@/views/edu/admin/learn/signup/batchlesson/index.vue";
  export default {
    name: "MemberList",
    components: {
      BatchSignupLesson,
      Delete,
      MemberGroup,
      MemberPost,
      MemberCompany,
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
