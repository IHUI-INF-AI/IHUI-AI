<template>
  <div class="content-container">
    <el-row class="row">
      <el-col :span="4">
        <member-menu active="circle"/>
      </el-col>
      <el-col :span="20">
        <div class="question-box" v-if="circleList">
          <el-tabs v-model="activeTabName" @tab-click="tabClickHandle">
            <el-tab-pane label="我的社区" name="first" v-loading="questionLoading">
              <el-empty v-if="!circleList || !circleList.length"/>
              <div class="card joinCircle-item" v-for="item in circleList" :key="item.id">
                <h2 class="title" @click="goto('/edu/circle/detail', item.id)">{{item.name}}</h2>
                <span class="time">{{item.createTime}}</span>
                <div class="content" :class="{'show-more': item.showMore}" @click="toggleMore(item)">
                  <div class="cover" v-if="item.image.trim()">
                    <div class="cover-inner">
                      <img :src="item.image"/>
                    </div>
                  </div>
                  <div class="inner">
                    <div class="rich-text">
                      {{item.introduction}}
                    </div>
                    <el-button link class="more">{{item.showMore ? '收起' : '展开'}}</el-button>
                  </div>
                </div>
                <div class="actions">
                  <el-button link class="action"><el-icon><Pointer /></el-icon> 成员 {{item.memberNum || 0}} </el-button>
                  <el-button link class="action"><el-icon><ChatDotRound /></el-icon> 动{{item.dynamicNum || 0}}</el-button>
                  <el-button link class="action float-right" @click.stop="deleteCircle(item)">解散社区</el-button>
                  <el-button link class="action float-right" @click.stop="edit(item)">编辑</el-button>
                </div>
              </div>
              <page style="padding: 20px;" :page-size="params.size" :total="total" :current-change="currentChange" :size-change="sizeChange"></page>
              <circle-edit :item="selectCircle" v-if="dialogVisible" v-model="dialogVisible" :cancel-callback="cancelCircleDialog" :submit-callback="submitCircle"/>
            </el-tab-pane>
            <el-tab-pane label="加入的社区" name="second" v-loading="joinCircleLoading">
              <el-empty v-if="!joinCircleList || !joinCircleList.length"/>
              <div class="card joinCircle-item" v-for="item in joinCircleList" :key="item.id">
                <h2 class="title" @click="goto('/edu/circle/detail', item.id)">{{item.name}}</h2>
                <span class="time">{{item.createTime}}</span>
                <div class="content" :class="{'show-more': item.showMore}" @click="toggleMore(item)">
                  <div class="cover" v-if="item.image.trim()">
                    <div class="cover-inner">
                      <img :src="item.image"/>
                    </div>
                  </div>
                  <div class="inner">
                    <div class="rich-text">
                      {{item.introduction}}
                    </div>
                    <el-button link class="more">{{item.showMore ? '收起' : '展开'}}</el-button>
                  </div>
                </div>
                <div class="actions">
                  <el-button link class="action"><el-icon><Pointer /></el-icon> 成员 {{item.memberNum || 0}} </el-button>
                  <el-button link class="action"><el-icon><ChatDotRound /></el-icon> 动{{item.dynamicNum || 0}}</el-button>
                  <el-button link class="action float-right" @click.stop="exit(item)">退出社区</el-button>
                </div>
              </div>
              <page style="padding: 20px;" :page-size="params.size" :total="joinCircleTotal" :current-change="joinCircleCurrentChange" :size-change="joinCircleSizeChange"></page>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {inject, ref} from "vue"
import MemberMenu from "@/views/edu/web/member/menu";
import {getMemberCircleList, removeCircle, getMemberJoinCircleList, exitCircle} from "@/api/edu/web/circle";
import CircleEdit from "@/views/edu/web/circle/edit";
import {confirm, success} from "@/util/tipsUtils";
import Page from "@/components/Page";
import router from "@/router";
import {getToken} from "@/util/tokenUtils";
export default {
  name: "MemberCircleIndex",
  components: {
    Page,
    CircleEdit,
    MemberMenu
  },
  setup() {
    const showLoginFlag = inject("showLogin")
    const showLoginClose = inject("showLoginClose")
    if (!getToken()) {
      showLoginFlag.value = true
      showLoginClose.value = false
      return
    }
    const activeTabName = "first"
    const tabClickHandle = (tab, event) => {
    }
    const params = ref({
      current: 1,
      size: 20
    })
    const questionLoading = ref(true)
    const circleList = ref([])
    const total = ref(0)
    const loadCircleList = () => {
      questionLoading.value = true
      getMemberCircleList(params.value, res => {
        circleList.value = res.list
        total.value = res.total
        questionLoading.value = false
      })
    }
    loadCircleList()
    const dialogVisible = ref(false)
    const cancelCircleDialog = () => {
      dialogVisible.value = false
    }
    const submitCircle = () => {
      dialogVisible.value = false
      params.value.current = 1
      loadCircleList();
    }
    const selectCircle = ref({})
    const edit = (item) => {
      selectCircle.value = item
      dialogVisible.value = true
    }
    const deleteCircle = (item) => {
      confirm("确认解散社区 " + item.name + " 吗？", "提示", () => {
        removeCircle({id: item.id}, () => {
          success("解散成功")
          loadCircleList()
        })
      }, () => {
      })
    }
    const currentChange = (currentPage) => {
      params.value.current = currentPage;
      loadCircleList();
    }
    const sizeChange = (s) => {
      params.value.size = s;
      loadCircleList();
    }

    const joinCircleParams = ref({
      current: 1,
      size: 20
    })
    const joinCircleLoading = ref(true)
    const joinCircleList = ref([])
    const joinCircleTotal = ref(0)
    const loadJoinCircleList = () => {
      joinCircleLoading.value = true
      getMemberJoinCircleList(joinCircleParams.value, res => {
        joinCircleList.value = res.list
        joinCircleTotal.value = res.total
        joinCircleLoading.value = false
      })
    }
    loadJoinCircleList()
    const exit = (item) => {
      exitCircle({circleId: item.id}, () => {
        success("退出成功")
        loadJoinCircleList();
      })

    }
    const joinCircleCurrentChange = (currentPage) => {
      joinCircleParams.value.current = currentPage;
      loadJoinCircleList();
    }
    const joinCircleSizeChange = (s) => {
      joinCircleParams.value.size = s;
      loadJoinCircleList();
    }
    const goto = (path, id) => {
      if (id) {
        router.push({ path: path, query: { id: id } })
      } else {
        router.push({ path })
      }
    }
    const toggleMore = (item) => {
      item.showMore = !item.showMore
    }
    return {
      circleList,
      activeTabName,
      params,
      total,
      tabClickHandle,
      questionLoading,
      dialogVisible,
      cancelCircleDialog,
      submitCircle,
      selectCircle,
      edit,
      deleteCircle,
      joinCircleLoading,
      joinCircleList,
      exit,
      currentChange,
      sizeChange,
      joinCircleCurrentChange,
      joinCircleSizeChange,
      joinCircleTotal,
      goto,
      toggleMore
    }
  }
}
</script>

<style scoped lang="scss">
.content-container{
  .question-box {
    background-color: #FFFFFF;
    margin: 20px;
    :deep(.el-tabs__nav-scroll) {
      padding: 0 20px;
    }
    :deep(.el-tabs__nav-wrap:after) {
      height: 0;
    }
    .card {
      background: #fff;
      box-sizing: border-box;
      border-radius: 0;
      overflow: visible;
      overflow: initial;
      position: relative;
      padding: 20px;
      margin-bottom: 0;
      -webkit-box-shadow: none;
      box-shadow: none;
      border-bottom: 1px solid #f0f2f7;
      &:first-child {
        padding-top: 0;
        .time {
          top: 0;
        }
      }
      .title {
        font-size: 18px;
        font-weight: 600;
        line-height: 1.9;
        color: #121212;
        margin-top: -4px;
        margin-bottom: -4px;
        cursor: pointer;
        width: calc(100% - 142px);
        &:hover {
          color: var(--el-color-primary);
        }
      }
      .time {
        position: absolute;
        top: 20px;
        right: 20px;
        color: #999;
      }
      .content {
        cursor: pointer;
        transition: color .14s ease-out;
        line-height: 1.97;
        .cover {
          position: relative;
          width: 190px;
          height: 105px;
          margin-top: -2px;
          margin-right: 18px;
          margin-bottom: 4px;
          float: left;
          overflow: hidden;
          background-position: 50%;
          background-size: cover;
          border-radius: 6px;
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
          .cover-inner {
            position: absolute;
            top: 50%;
            left: 0;
            height: 100%;
            width: 100%;
            -webkit-transform: translateY(-50%);
            transform: translateY(-50%);
            overflow: hidden;
            img {
              height: 100%;
              width: 100%;
            }
          }
          &:after {
            content: "";
            position: absolute;
            z-index: 1;
            display: block;
            width: 100%;
            height: 100%;
            background: rgba(18,18,18,.02);
          }
        }
        .inner {
          margin-bottom: -4px;
          overflow: hidden;
          max-height: 100px;
          margin-top: 16px;
          .rich-text {
            pointer-events: none;
            line-height: 1.9;
            cursor: pointer;
            display: -webkit-box;
            white-space: normal;
            word-break: break-word;
            -webkit-line-clamp: 4;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .more {
            display: inline-block;
            font-size: 14px;
            text-align: center;
            cursor: pointer;
            margin-left: 4px;
            color: #175199;
            height: auto;
            padding: 0;
            line-height: inherit;
            background-color: transparent;
            border: none;
            border-radius: 0;
          }
          .more {
            float: right;
            margin-top: -26px;
            position: relative;
            background: #fff;
            &::after {
              content: "";
              position: absolute;
              display: block;
              top: 0;
              left: -30px;
              width: 30px;
              height: 100%;
              background: linear-gradient(
                      270deg, #fff, hsla(0, 0%, 100%, .2));
            }
          }
        }
        &:hover {
          .inner {
            .more {
              color: var(--el-color-primary);
            }
          }
        }
      }
      .show-more {
        .inner {
          height: auto;
          max-height: none;
          .rich-text {
            -webkit-line-clamp: inherit;
          }
        }
      }
      .actions {
        align-items: center;
        padding: 10px 20px;
        margin: 0 -20px -10px;
        color: #646464;
        clear: both;
        background: #fff;
        .action {
          margin-left: 24px;
          font-size: 14px;
          color: #646464;
          cursor: text;
          &:first-child {
            margin-left: 0;
          }
        }
        .float-right {
          float: right;
          cursor: pointer;
          &:hover {
            color: var(--el-color-primary);
          }
        }
      }
    }
    .joinCircle-item {
      .content {
        .inner {
          max-height: 52px;
          .rich-text {
            -webkit-line-clamp: 2;
          }
        }
      }
    }
  }
}
</style>
