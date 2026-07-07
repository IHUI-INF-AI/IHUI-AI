<template>
  <div class="content-container">
    <el-row class="row">
      <el-col :span="4">
        <member-menu active="learn-record"/>
      </el-col>
      <el-col :span="20">
        <div class="learn-count" v-if="learnCountMap">
          <div class="header-title">学习统计</div>
          <div class="header-content">
            <div class="header-content-item">
              <div class="title">今日学习</div>
              <div class="value">
                <span>{{formatMinute(learnCountMap.todayLearnTime || 0)}}</span>
                <span> 分钟</span>
              </div>
            </div>
            <div class="header-content-item">
              <div class="title">总学习时间</div>
              <div class="value">
                <span>{{formatMinute(learnCountMap.totalLearnTime || 0)}}</span>
                <span> 分钟</span>
              </div>
            </div>
            <div class="header-content-item">
              <div class="title">高于平台</div>
              <div class="value">
                <span>{{learnCountMap.rankPercent || 0}}%</span>
                <span> 学员</span>
              </div>
            </div>
          </div>
        </div>
        <div class="learn-content" v-if="param">
          <div class="learn-content-header">
            <div class="learn-content-header-item" @click="changeTab('')">
              <span :class="{'active': param.status === ''}">全部</span>
            </div>
            <div class="learn-content-header-item" @click="changeTab('signed_up')">
              <span :class="{'active': param.status === 'signed_up'}">进行</span>
            </div>
            <div class="learn-content-header-item" @click="changeTab('completed')">
              <span :class="{'active': param.status === 'completed'}">已完成</span>
            </div>
            <div class="learn-content-header-item" @click="changeTab('cancel_sign_up')">
              <span :class="{'active': param.status === 'cancel_sign_up'}">已取消</span>
            </div>
          </div>
          <el-row class="learn-content-body">
            <el-col :span="6" class="learn-content-menu" v-loading="listLoading">
              <el-empty v-if="!(learnRecordList && learnRecordList.length)"/>
              <div class="learn-record-list" v-else>
                <div class="learn-record-item" @click="itemClick(item.id, item.signUp.id)" :class="{'active': item.id + '_' + item.signUp.id === activeId}" v-for="item in learnRecordList" :key="item.id">
                  <div class="learn-record-tag" :style="item.signUp.status === 'completed' ? 'background: #389d14' : item.signUp.status === 'cancel_sign_up' ? 'background: #666666' : ''">
                    {{item.signUp.status === "completed" ? "已完成" : item.signUp.status === "cancel_sign_up" ? "已取消" : "进行中"}}
                  </div>
                  <p class="learn-record-title" :title="item.name">{{item.name}}</p>
                  <div class="learn-record-date"><span>{{item.endTime}}</span> 到期</div>
                </div>
              </div>
            </el-col>
            <el-col :span="18" v-loading="lessonLoading">
              <div class="learn-content-detail" v-if="lesson.id">
                <div class="learn-content-detail-title">
                  <router-link target="_blank" :to="{path: '/edu/learn/detail', query: {id: lesson.id, signUpId: lesson.signUp.id}}" class="favorites-cover">
                    <div class="learn-content-detail-top-left-text">{{lesson.name}}</div>
                  </router-link>
                </div>
                <div class="learn-content-detail-header">
                  <div class="learn-img">
                    <img :src="lesson.image"/>
                  </div>
                  <div class="learn-content-detail-header-content">
                    <div class="learn-content-detail-top-left">
                      <span>报名时间：{{lesson.signUp.createTime}}</span>
                    </div>
                    <div class="learn-content-detail-top-middle">
                      <div class="learn-content-progress">
                        <span>学习进度条</span>
                        <el-progress :percentage="lesson.signUp.percentage" :text-inside="true" :color="customColors" :stroke-width="15"></el-progress>
                      </div>
                    </div>
                    <div class="learn-content-detail-top-right">
                      <div class="ctrl-item">
                        <el-icon><Pointer /></el-icon>
                        点赞 {{lesson.likeNum || 0}}
                      </div>
                      <div class="ctrl-item before-line">
                        <el-icon><Star /></el-icon>
                        收藏 {{lesson.favoriteNum || 0}}
                      </div>
                      <div class="ctrl-item action-item before-line">
                        <router-link target="_blank" title="点击发表您对本门课程的评论" :to="{path: '/edu/learn/detail', query: {id: lesson.id, position: 'comment'}}" class="favorites-cover">
                          <el-icon><ChatDotSquare /></el-icon>
                          评论 {{lesson.commentNum || 0}}
                        </router-link>
                      </div>
                      <div class="ctrl-item float-right">
                        <span v-if="lesson.signUp.status === 'cancel_sign_up'" style="color: red;font-weight: 500;">
                          已取消报名                        </span>
                        <span @click="cancel" class="action-item" v-else>
                          <el-icon><Delete /></el-icon>
                          取消报名
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h2 class="sections-title">全部章节
                    <span class="section-nums">(共{{totalChapterSection}}</span>
                  </h2>
                  <div class="detail-item">
                    <el-menu v-if="defaultOpenedIndexList && defaultOpenedIndexList.length" class="el-menu-vertical" :default-openeds="defaultOpenedIndexList">
                      <el-sub-menu :index="index + ''" v-for="(lessonChapter, index) in lessonChapterList" :key="lessonChapter.id">
                        <template #title>
                          <div class="slot-title" :title="lessonChapter.title">{{lessonChapter.title}}</div>
                        </template>
                        <el-menu-item @click="learnChapterSection(chapterSection)" :index="index + '-' + i" v-for="(chapterSection, i) in lessonChapter.chapterSectionList" :key="chapterSection.id">
                          <template #title>
                            <div class="message-item-content" :title="chapterSection.title">
                              <el-icon><VideoPlay /></el-icon>
                              {{chapterSection.title}} （{{formatMinutes(chapterSection.totalTime)}}                            </div>
                            <div class="message-item-progress">
                              <el-progress :text-inside="true" :color="customColors" :stroke-width="15" :percentage="chapterSection.percentage"></el-progress>
                            </div>
                          </template>
                        </el-menu-item>
                      </el-sub-menu>
                    </el-menu>
                  </div>
                </div>
              </div>
              <el-empty v-else/>
            </el-col>
          </el-row>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {inject, ref, markRaw} from "vue"
import {ChatDotSquare} from '@/lib/lucide-fallback'
  import router from "@/router"
  import memberMenu from "../menu/index.vue"
  import {getLesson, getLessonChapterList, getRecordLessonList, cancelSignUp, getTotalLearnTime, getTodayLearnTime, getLearnTimeRankPercent} from "@/api/edu/web/learn/lesson"
  import {confirm, success} from "@/util/tipsUtils";
  import {formatMinutes, formatMinute} from "@/util/dateUtils";
import {getToken} from "@/util/tokenUtils";

  export default {
    name: "memberMessage",
    components: {
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
      const learnCountMap = ref({
        totalLearnTime: 0,
        todayLearnTime: 0,
        rankPercent: 0
      })
      getTotalLearnTime(res => {
        learnCountMap.value.totalLearnTime = res || 0
      })
      getTodayLearnTime(res => {
        learnCountMap.value.todayLearnTime = res || 0
      })
      getLearnTimeRankPercent(res => {
        learnCountMap.value.rankPercent = res || 0
      })
      const param = ref({
        current: 1,
        size: 20,
        status: ""
      })
      let activeId = ref(1)
      const learnRecordList = ref([])
      const lesson = ref({})
      const lessonChapterList = ref([])
      const defaultOpenedIndexList = ref([])
      const totalChapterSection = ref(0)
      const customColors = [
        {color: "#f56c6c", percentage: 20},
        {color: "#e6a23c", percentage: 40},
        {color: "#1989fa", percentage: 60},
        {color: "#5cb87a", percentage: 80},
        {color: "#389d14", percentage: 100}
      ]
      const lessonLoading = ref(true)
      const loadLesson = function(id, signUpId) {
        lessonLoading.value = true
        activeId.value = id + "_" + signUpId;
        getLesson({id: id, signUpId: signUpId}, (res) => {
          lesson.value = res
          if (lesson.value && !lesson.value.signUp) {
            lesson.value.signUp = {status: "cancel_sign_up"}
          }
          const recordMap = {}
          if (res.recordList && res.recordList.length) {
            for (const record of res.recordList) {
              recordMap[record.lessonChapterSectionId] = record
            }
          }
          getLessonChapterList({lessonId: res.id}, r => {
            lessonLoading.value = false
            lessonChapterList.value = r.list
            if (r.list && r.list.length) {
              let total = 0
              // 所有章节的总时间数
              let totalTime = 0
              // 未完成章节的总时间数
              let notCompletedTotalTime = 0
              // 未完成章节已学习的时间数
              let notCompletedLearnTime = 0
              for (let i = 0; i < r.list.length; i++) {
                defaultOpenedIndexList.value.push(i + "");
                if (r.list[i].chapterSectionList && r.list[i].chapterSectionList.length) {
                  total += r.list[i].chapterSectionList.length
                  // 进度
                  for (const chapterSection of r.list[i].chapterSectionList) {
                    totalTime += chapterSection.totalTime;
                    const record = recordMap[chapterSection.id]
                    // 观看记录不为空
                    if (record) {
                      if (record.status === "completed") {
                        chapterSection.percentage = 100
                      } else {
                        let maxLearnTime = record.maxProgressTime || 0;
                        if (maxLearnTime > record.learnTime) {
                          maxLearnTime = record.learnTime
                        }
                        notCompletedTotalTime += chapterSection.totalTime;
                        notCompletedLearnTime += maxLearnTime;
                        chapterSection.percentage = parseFloat(parseFloat(maxLearnTime / chapterSection.totalTime * 100).toFixed(2));
                        if (chapterSection.percentage > 100) {
                          chapterSection.percentage = 100
                        }
                      }
                    } else {
                      chapterSection.percentage = 0
                    }
                  }
                }
              }
              totalChapterSection.value = total
              if (totalTime > 0) {
                // 未完成总时间时间与总时间的占比
                const notCompletedPercentage = parseFloat(parseFloat(notCompletedTotalTime / totalTime * 100).toFixed(2))
                // 未完成总时间里已学习的比例
                const learnNotCompletedPercentage = parseFloat(parseFloat(notCompletedLearnTime / notCompletedTotalTime * 100).toFixed(2))
                // 未完成中已学习时间占总时间的比例
                const percentage = learnNotCompletedPercentage * (notCompletedPercentage / 100)
                lesson.value.signUp.percentage = percentage + (100 - notCompletedPercentage)
              } else {
                lesson.value.signUp.percentage = 0
              }
            }
          })
        })
      }
      const itemClick = function(id, signUpId) {
        defaultOpenedIndexList.value = []
        loadLesson(id, signUpId)
      }
      const listLoading = ref(true)
      const load = function() {
        listLoading.value = true;
        getRecordLessonList(param.value, res => {
          listLoading.value = false;
          for (const record of res.list) {
            learnRecordList.value.push(record)
          }
          if (learnRecordList.value && learnRecordList.value.length && !lesson.value.id) {
            loadLesson(res.list[0].id, res.list[0].signUp.id)
          } else {
            lessonLoading.value = false
          }
        })
      }
      load()
      const learnChapterSection = function(chapterSection) {
        router.push({path: "/edu/learn/detail", query: {id: lesson.value.id, sectionId: chapterSection.id}})
      }
      const cancel = () => {
        confirm("确定取消报名?", "提示", () => {
          cancelSignUp({id: lesson.value.signUp.id}, () => {
            success("取消报名成功")
            loadLesson(lesson.value.id, lesson.value.signUp.id)
          })
        }, () => {
        });
      }
      const changeTab = (status) => {
        learnRecordList.value = []
        lesson.value = {}
        param.value.status = status
        load()
      }
      return {
        learnCountMap,
        param,
        activeId,
        learnRecordList,
        lesson,
        lessonChapterList,
        defaultOpenedIndexList,
        totalChapterSection,
        customColors,
        itemClick,
        learnChapterSection,
        cancel,
        changeTab,
        formatMinutes,
        formatMinute,
        lessonLoading,
        listLoading,
        ChatDotSquare: markRaw(ChatDotSquare)
      }
    }
  }
</script>

<style lang="scss" scoped>
  .content-container {
    .row {
      height: 100%;
      .el-col {
        height: 100%;
      }
      .learn-count {
        .header-title {
          margin: 20px 20px 0;
          background: #ffffff;
          border-bottom: 1px solid #f5f5f5;
          padding: 10px;
        }
        .header-content {
          margin: 0 20px;
          display: flex;
          background: #ffffff;
          .header-content-item {
            width: 33.3333%;
            text-align: center;
            margin: 30px 0;
            border-right: 1px solid #f5f5f5;
            &:last-child {
              border-right: 0;
            }
            .title {
              font-size: 16px;
              margin-bottom: 10px;
              color: #333;
              line-height: 2;
              font-weight: 400;
            }
            .value {
              color: #333;
              font-size: 12px;
              display: inline-block;
              vertical-align: middle;
              line-height: 12px;
              margin-bottom: 9px;
              span:first-child {
                line-height: 30px;
                font-size: 30px;
              }
            }
          }
        }
      }
      .learn-content {
        .learn-content-header {
          margin: 20px 20px 0;
          background: #fff;
          border-bottom: 1px solid #f5f5f5;
          .learn-content-header-item {
            padding: 15px 10px;
            display: inline-block;
            cursor: pointer;
            &:hover {
              color: var(--el-color-primary);
            }
            span.active {
              border-bottom: 2px solid var(--el-color-primary);
              padding-bottom: 6px;
              color: var(--el-color-primary);
            }
          }
        }
        .learn-content-body {
          background-color: #FFFFFF;
          margin: 0 20px 20px;
          .learn-content-menu {
            height: 980px;
            overflow-y: scroll;
            &::-webkit-scrollbar {
              display: none;/*隐藏滚动条*/
            }
            .learn-record-list {
              width: 100%;
              .learn-record-item {
                cursor: pointer;
                width: calc(100% - 10px);;
                height: 140px;
                background: #f8f8f8;
                float: left;
                padding: 24px 16px;
                -webkit-box-sizing: border-box;
                box-sizing: border-box;
                border-bottom: 1px solid #f0f0f0;
                position: relative;
                min-width: 220px;
                &:hover {
                  background-color: #f0f0f0;
                }
                &:last-child {
                  border: 0;
                }
              }
              .learn-record-item.active {
                border-color: #ecefff;
                background: #ecefff;
                color: #000000;
                .learn-record-date {
                  display: block;
                }
              }
              .learn-record-item.active:after {
                content: "";
                height: 0;
                width: 0;
                overflow: hidden;
                top: 43%;
                right: -10px;
                position: absolute;
                border-top: 10px dashed transparent;
                border-bottom: 10px dashed transparent;
                border-left: 10px solid #ecefff;
              }
              .learn-record-tag {
                font-size: 12px;
                padding: 2px 10px;
                color: #fff;
                border-radius: 0;
                position: absolute;
                right: 0;
                top: 0;
                background: var(--el-color-primary);
              }
              .learn-record-title {
                font-size: 16px;
                overflow: hidden;
                -o-text-overflow: ellipsis;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                line-height: 34px;
              }
              .learn-record-date {
                color: #777777;
                line-height: 48px;
                font-size: 12px;
              }
              .learn-record-date.active {
                display: block;
              }
            }
          }
          .learn-content-detail {
            background: #fff;
            padding: 10px;
            .learn-content-detail-title {
              .learn-content-detail-top-left-text {
                display: inline-block;
                display: -webkit-box;
                overflow: hidden;
                text-overflow: ellipsis;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                white-space: normal;
                word-break: break-word;
                word-wrap: break-word;
                font-weight: 500;
              }
            }
            .learn-content-detail-header {
              display: flex;
              padding-bottom: 20px;
              padding-top: 10px;
              border-bottom: 1px solid #f5f5f5;
            }
            .learn-img {
              width: 200px;
              height: 120px;
              img {
                width: 100%;
                height: 100%;
                border-radius: 6px;
              }
            }
            .learn-content-detail-header-content {
              padding-left: 15px;
              width: calc(100% - 210px);
            }
            .learn-content-detail-top-left {
              position: relative;
              line-height: 40px;
              display: inline-block;
              box-sizing: content-box;
            }
            .learn-content-detail-top-middle {
              line-height: 40px;
              .learn-content-progress {
                display: flex;
                :deep(.el-progress) {
                  width: 300px;
                  line-height: 40px;
                  .el-progress-bar__outer {
                    background-color: #999999;
                  }
                }
              }
            }
            .learn-content-detail-top-right {
              margin-top: 4px;
              line-height: 40px;
              .float-right {
                float: right;
              }
              .ctrl-item {
                margin-right: 10px;
                line-height: 28px;
                height: 28px;
                color: #333;
                display: inline-block;
              }
              .action-item {
                cursor: pointer;
                &:hover {
                  color: var(--el-color-primary);
                }
              }
              .before-line:before {
                position: relative;
                display: inline-block;
                top: 5px;
                width: 10px;
                height: 20px;
                border-left: 1px solid #ccc;
                content: "";
                vertical-align: top;
              }
            }
            h2 {
              margin: 16px 0;
            }
            .el-menu {
              border: 0;
            }
            .el-menu-item.is-active {
              color: #303133;
            }
            .el-menu-item:focus
            {
              background-color: #ffffff;
            }
            .detail-item-button {
              float: right;
              margin-top: 9px;
            }
            .favorites-cover {
              color: #000000;
              &:hover {
                color: var(--el-color-primary);
              }
            }
            .detail-item {
              :deep(.el-menu-item) {
                display: flex;
                .message-item-content {
                  width: calc(100% - 100px);
                }
                .message-item-progress {
                  width: 100px;
                  .el-progress {
                    line-height: 50px;
                    .el-progress-bar__outer {
                      background-color: #999999;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
</style>
