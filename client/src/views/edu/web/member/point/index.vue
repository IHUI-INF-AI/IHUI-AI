<template>
  <div class="content-container">
    <el-row class="row">
      <el-col :span="4">
        <member-menu active="point"/>
      </el-col>
      <el-col :span="20">
        <div class="member-point" v-if="params">
          <div class="score-list-board">
            <div class="score-list-board-content">
              <div class="score-time-wrap">
                <div class="score-dashboard-progress">
                  <div class="score-number more-than-2">{{totalPoint || 0}}</div>
                </div>
                <div class="update-time">总积分数量</div>
              </div>
              <div class="rule-text">
                <div class="title">什么是积分页</div>
                <div class="rule-detail">
                  <p>
                    <span>1.积分是用户在平台参与互动性活动与任务时，根据相关规定给予用户的一种奖励</span>
                  </p>
                  <p>
                    <span>2.用户需要注册登录并使用平台完成相关操作，才能参与并积累积分页</span>
                  </p>
                  <p>
                    <span>3.积分是本平台特殊福利系统功能，不存在对外流通、转卖功能</span>
                  </p>
                  <p>
                    <span>4.如何获取积分页</span>
                    <a class="link" href="/agreement/point-rule" target="_blank">
                      查看详细规则 >>
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div class="score-list-content-wrap">
            <div class="title">积分记录</div>
            <div class="tabs">
              <div class="tabs-header" style="transform: translateX(0px);">
                <div class="tabs-header-title" :class="{'active': !params.type}" @click="selectType('')">全部</div>
                <div class="tabs-header-title" :class="{'active': params.type === 'increase'}" @click="selectType('increase')">增加积分</div>
                <div class="tabs-header-title" :class="{'active': params.type === 'decrease'}" @click="selectType('decrease')">消耗积分</div>
                <div class="tabs-header-title" :class="{'active': params.type === 'fallback'}" @click="selectType('fallback')">回退积分</div>
                <div class="tabs-header-title" :class="{'active': params.type === 'recycle'}" @click="selectType('recycle')">回收积分</div>
              </div>
              <div class="tabs-content">
                <el-table v-loading="dataLoading" class="custom-table" ref="multipleTable" :data="recordList" style="width: 100%">
                  <el-table-column prop="createTime" label="变更时间"/>
                  <el-table-column prop="pointNum" label="变更类型">
                    <template #default="scope">
                      <span>{{typeMap[scope.row.type]}}</span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="pointNum" label="变更积分"></el-table-column>
                  <el-table-column prop="remark" label="变更原因"/>
                </el-table>
              </div>
            </div>
            <page :total="total" :page-size="params.size" :current-change="currentChange" :size-change="sizeChange"></page>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {inject, ref} from "vue"
  import memberMenu from "../menu/index.vue"
  import {countMemberPoint, getRecordList} from "@/api/edu/web/point"
  import Page from "@/components/Page";
import {getToken} from "@/util/tokenUtils";
  export default {
    name: "memberPoint",
    components: {
      Page,
      memberMenu
    },
    setup() {
      const showLoginFlag = inject("showLogin")
      const showLoginClose = inject("showLoginClose")
      if (!getToken()) {
        showLoginFlag.value = true
        showLoginClose.value = false
        return
      }
      const typeMap = {
        "increase": "增加积分",
        "decrease": "消耗积分",
        "fallback": "回退积分",
        "recycle": "回收积分",
      }
      const params = ref({
        current: 1,
        size: 20,
        type: ""
      })
      const dataLoading = ref(false)
      const total = ref(0)
      const recordList = ref([])
      const loadRecordList = function() {
        dataLoading.value = true
        getRecordList(params.value, res => {
          recordList.value = res.list
          total.value = res.total
          dataLoading.value = false
        }).catch(() => {
          dataLoading.value = false
        })
      }
      loadRecordList()
      // 页码改变
      const currentChange = (currentPage) => {
        params.value.current = currentPage;
        loadRecordList()
      }
      // 页面显示数量改变
      const sizeChange = (size) => {
        params.value.size = size;
        loadRecordList()
      }
      const selectType = (type) => {
        params.value.type = type;
        loadRecordList()
      }
      const totalPoint = ref(0)
      countMemberPoint(res => {
        totalPoint.value = res
      })
      return {
        typeMap,
        dataLoading,
        total,
        recordList,
        currentChange,
        sizeChange,
        params,
        selectType,
        totalPoint
      }
    }
  }
</script>

<style lang="scss" scoped>
  .member-point {
    background-color: #FFFFFF;
    display: flex;
    flex-direction: column;
    min-height: 705px;
    margin: 20px 0;
    padding: 20px;
    .score-list-board {
      background-color: #fafafa;
      border-radius: 8px;
      overflow: hidden;
      padding: 22px 32px;
      background-size: cover;
      .score-list-board-content {
        display: flex;
        align-items: center;
        .score-time-wrap {
          width: 40%;
          height: 206px;
          position: relative;
          flex-shrink: 0;
          margin: 0 auto;
          text-align: center;
          .score-dashboard-progress {
            padding: 22px;
            .score-number {
              font-size: 80px;
              color: #000000;
            }
          }
          .update-time {
            font-size: 12px;
            color: #666666;
          }
        }
        .rule-text {
          max-width: 533px;
          width: 533px;
          flex: 1;
          padding: 20px 32px 20px 38px;
          background: linear-gradient(180deg,hsla(0,0%,100%,.04) 10.95%,hsla(0,0%,100%,0) 114.14%);
          border-radius: 6px;
          border: 1px solid #cccccc;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          color: #333;
          .title {
            font-size: 20px;
            font-weight: 500;
            line-height: 28px;
          }
          .rule-detail {
            p {
              margin-top: 6px;
              span {
                line-height: 28px;
              }
              a {
                color: #333;
                font-weight: 500;
                &:hover {
                  color: var(--el-color-primary);
                }
              }
            }
          }
        }
      }
    }
    .score-list-content-wrap {
      min-height: calc(100vh - 520px);
      display: flex;
      flex-direction: column;
      flex: 1;
      padding-bottom: 20px;
      .title {
        font-weight: 600;
        font-size: 16px;
        line-height: 24px;
        color: #222;
        margin: 32px 0 -4px;
        flex-shrink: 0;
      }
      .tabs {
        position: relative;
        overflow: hidden;
        padding-top: 24px;
        padding-bottom: 24px;
        background: #fff;
        .tabs-header-nav {
          position: relative;
          background: #fff;
          padding-top: 24px;
          padding-bottom: 24px;
        }
        .tabs-header {
          position: relative;
          display: inline-block;
          transition: transform .3s ease;
          white-space: nowrap;
          .tabs-header-title {
            font-size: 14px;
            margin: 0 0 0 12px;
            height: auto;
            line-height: 20px;
            border: 1px solid transparent;
            border-radius: 26px;
            padding: 3px 11px;
            display: inline-block;
            cursor: pointer;
            &:first-child {
              margin-left: 0;
            }
          }
          .tabs-header-title:hover, .active {
            font-weight: 400;
            color: var(--el-color-primary);
            border-color: var(--el-color-primary);
            border-radius: 26px;
            padding: 3px 11px;
          }
        }
        .tabs-content {
          margin: 10px 0 0;
        }
      }
      .table-wrapper {
        position: relative;
        background-color: #fff;
        .score-list-table {
          margin-top: -8px;
          flex: 1;
        }
      }
    }
  }
</style>
