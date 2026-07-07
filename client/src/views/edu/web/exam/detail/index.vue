<template>
  <div class="exam-detail">
    <el-breadcrumb style="margin: 20px 0 16px;" :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/edu/exam' }">考试</el-breadcrumb-item>
      <el-breadcrumb-item>详情</el-breadcrumb-item>
    </el-breadcrumb>
    <div class="exam-detail-header">
      <div class="image-box" v-if="exam.image">
        <img :src="exam.image" alt="">
        <!-- 考试分类标签 -->
        <span class="exam-category-tag" v-if="exam.phrase">{{ extractTag(exam.phrase) }}</span>
      </div>
      <div class="title-box">
        <h3>{{exam.name}}</h3>
        <!-- 简短介绍 -->
        <p class="exam-phrase" v-if="exam.phrase">{{ extractPhrase(exam.phrase) }}</p>
        <!-- 考试关键信息 -->
        <div class="exam-meta">
          <span class="meta-item" v-if="exam.startTime">
            <el-icon><Calendar /></el-icon>
            考试时间：{{ formatExamTime(exam.startTime, exam.endTime) }}
          </span>
        </div>
        <div class="title-footer">
          <div class="price">免费</div>
          <div class="exam-num">{{exam.signUpNum || 0}}人报名</div>
        </div>
      </div>
      <div class="header-right-box">
        <div class="behavior">
          <el-button link class="action" :class="{'active': exam.like && exam.like.status}" @click="examLike(exam)">
            <el-icon><Pointer /></el-icon> 点赞 {{exam.likeNum || 0}}
          </el-button>
          <el-button link class="action" @click="examFavorite(exam)" :class="{'active': exam.favorite && exam.favorite.id}">
            <el-icon><Star /></el-icon> 收藏 {{exam.favoriteNum || 0}}
          </el-button>
        </div>
        <div class="exam-btn">
          <div class="btn">
            <el-button size="small" v-if="exam.signUp && exam.signUp.id" @click="cancelExamSignUp">取消报名</el-button>
            <el-button size="small" type="primary" @click="examSignUp" :loading="examLoading" v-else>报名考试</el-button>
          </div>
        </div>
      </div>
    </div>
    <div class="exam-detail-footer" :style="'min-height:' + clientHeight + 'px'">
      <div class="left-box">
        <el-menu
          :default-active="menuDefaultActive"
          class="el-menu-demo"
          mode="horizontal"
          :ellipsis="false"
          @select="menuSelectHandle">
          <el-menu-item index="1">章节</el-menu-item>
          <el-menu-item index="2">概述</el-menu-item>
          <el-menu-item index="3">评论 {{exam.commentNum || 0}}</el-menu-item>
        </el-menu>
        <div v-if="menuDefaultActive === '2'" class="desc">
          <div class="intro-content" v-html="formatIntroduction(exam.introduction)"></div>
        </div>
        <div v-else-if="menuDefaultActive === '1'" class="chapter">
          <el-menu class="el-menu-vertical" v-if="examChapterList && examChapterList.length" :default-openeds="defaultOpenedIndexList" :default-active="menuDefaultActive">
            <el-sub-menu :index="index.toString()" v-for="(examChapter, index) in examChapterList" :key="index">
              <template #title>
                <div class="slot-title">{{examChapter.title}}</div>
              </template>
              <el-menu-item :key="i" @click="startExam(chapterSection)" :index="index + '-' + i" v-for="(chapterSection, i) in examChapter.chapterSectionList">
                <template #title>
                  <div class="exam-item-content">
                    <el-icon><Tickets /></el-icon>
                    {{chapterSection.title}}
                  </div>
                  <div class="tips">
                    点击开始考试
                  </div>
                </template>
              </el-menu-item>
            </el-sub-menu>
          </el-menu>
        </div>
        <div v-else class="comment">
          <comment-list :topic-id="exam.id" topic-type="exam"/>
        </div>
      </div>
      <div class="right-box">
        <div class="recommend">
          <p class="recommend-title">推荐考试</p>
          <ul class="recommend-ul" v-if="recommendList && recommendList.length">
            <router-link v-for="item in recommendList" :key="item.id" :to="{path: '/edu/exam/detail', query: {id: item.id}}">
              <li>
                <div class="item-cover">
                  <img :src="item.image" alt="">
                </div>
                <div class="title-wrap">
                  <div class="intro" :title="item.name">
                    {{item.name}}
                  </div>
                  <div class="title-footer">
                    <div class="price">免费</div>
                    <div class="exam-num">{{item.signUpNum || 0}}人报名</div>
                  </div>
                </div>
              </li>
            </router-link>
          </ul>
          <el-empty style="background: #ffffff;border-radius: 6px;" v-else/>
        </div>
      </div>
    </div>
    <Login :show="showLoginFlag" @callback="loginCallback" @success="successCallback"/>
  </div>
</template>

<script>
import {ref, watch, markRaw} from "vue"
import { ArrowRight, Tickets, Calendar } from '@/lib/lucide-fallback'
import {cancelSignUp, getExam, getExamChapterList, getExamList, saveSignUp, checkSubmitted} from "@/api/edu/web/exam"
import { useRoute } from "vue-router"
import {getMemberLikeList, like} from "@/api/edu/web/comment/like";
import {favorite, getMemberFavoriteList} from "@/api/edu/web/comment/favorite";
import {getCommentList} from "@/api/edu/web/comment";
import CommentList from "@/views/edu/web/comment/list";
import Login from "@/components/edu/Login/index.vue";
import {confirm, error} from "@/util/tipsUtils";
import router from "@/router";
import {getToken} from "@/util/tokenUtils";

export default {
  name: "ExamDetailIndex",
  components: { CommentList, Login },
  setup() {
    const ArrowRightIcon = markRaw(ArrowRight)
    const TicketsIcon = markRaw(Tickets)
    const CalendarIcon = markRaw(Calendar)
    
    // 从phrase中提取标签
    const extractTag = (phrase) => {
      if (!phrase) return ''
      const parts = phrase.split('|')
      if (parts.length > 0) {
        return parts[0].trim()
      }
      return ''
    }
    
    // 从phrase中提取简介
    const extractPhrase = (phrase) => {
      if (!phrase) return ''
      const parts = phrase.split('|')
      if (parts.length > 1) {
        return parts[1].trim()
      }
      return ''
    }
    
    // 格式化考试时间
    const formatExamTime = (startTime, endTime) => {
      if (!startTime) return '待定'
      const start = new Date(startTime)
      const end = endTime ? new Date(endTime) : null
      const formatDate = (d) => {
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
      }
      if (end && start.getTime() !== end.getTime()) {
        return `${formatDate(start)} - ${formatDate(end)}`
      }
      return formatDate(start)
    }
    
    // 格式化introduction，将标题和列表转换为HTML格式
    const formatIntroduction = (text) => {
      if (!text) return ''
      // 将标题转换为h4标签
      let html = text
        .replace(/【([^】]+)】/g, '</div><h4 class="intro-title">$1</h4><div class="intro-section">')
        .replace(/•/g, '<span class="intro-bullet">•</span> ')
        .replace(/\n/g, '<br>')
      
      // 移除开头多余的div
      html = html.replace(/^<\/div>/, '')
      // 确保最后有闭合
      if (!html.endsWith('</div>')) {
        html += '</div>'
      }
      
      return '<div class="intro-section">' + html
    }
    // 监听路由变化
    const route = useRoute()
    watch(() => route.query.id, () => {
      window.location.reload();
    })
    let menuDefaultActive = ref("1")
    const menuSelectHandle = (menuIndex) => {
      menuDefaultActive.value = menuIndex
    }
    // 推荐考试
    let examId = route.query.id
    const recommendList = ref([])
    const loadRecommendList = () => {
      getExamList({current: 1, size: 10}, res => {
        res.list.forEach(item => {
          if(item.id !== Number(examId) && !recommendList.value.find((v) => {return v.id === item.id})) {
            recommendList.value.push(item)
          }
        })
      })
    }
    loadRecommendList()
    // 加载考试
    const exam = ref({})
    const examChapterList = ref([])
    const defaultOpenedIndexList = ref([])
    const loadBehavior = () => {
      if(getToken()) {
        getMemberLikeList({topicIdList: exam.value.id, topicType: "exam"}, res => {
          if (res && res.length) {
            exam.value.like = res[0];
          } else {
            exam.value.like = null
          }
        })
        getMemberFavoriteList({topicIdList: exam.value.id, topicType: "exam"}, res => {
          if (res && res.length) {
            exam.value.favorite = res[0];
          } else {
            exam.value.favorite = null
          }
        })
      }
    }
    const loadExam = () => {
      getExam({id: examId}, data => {
        exam.value = data
        loadBehavior()
        // 获取评论数量
        getCommentList({topicId: exam.value.id, topicType: 'exam', size: 1}, r => {
          if (r && r.total !== undefined) {
            exam.value.commentNum = r.total
          }
        })
        getExamChapterList({examId: exam.value.id}, r => {
          if (r.list && r.list.length) {
            for (let i = 0; i < r.list.length; i++) {
              defaultOpenedIndexList.value.push(i + "");
            }
          }
          examChapterList.value = r.list || []
        })
      })
    }
    loadExam()
    // 报名考试
    const showLoginFlag = ref(false)
    const examLoading = ref(false)
    const examSignUp = () => {
      examLoading.value = true
      if (!getToken()) {
        showLoginFlag.value = true
        examLoading.value = false
        return
      }
      saveSignUp({examId: exam.value.id}, res => {
        exam.value.signUp = res
        examLoading.value = false
      })
    }
    const cancelExamSignUp = () => {
      examLoading.value = true
      confirm("确定取消报名?", "提示", () => {
        cancelSignUp({id: exam.value.signUp.id}, () => {
          exam.value.signUp = {}
          examLoading.value = false
        })
      }, () => {
        examLoading.value = false
      })
    }
    // 开始考试
    const startExam = (chapterSection) => {
      if (!getToken()) {
        showLoginFlag.value = true
        return
      }
      if (!(exam.value.signUp && exam.value.signUp.id)) {
        error("请先报名考试")
        return
      }
      checkSubmitted({examId: exam.value.id, examChapterSectionId: chapterSection.id, signUpId: exam.value.signUp.id}, () => {
        const { href } = router.resolve({path: "/edu/exam/paper", query: {examId: exam.value.id, examChapterSectionId: chapterSection.id, signUpId: exam.value.signUp.id, paperId: chapterSection.paperId}});
        window.open(href, "_blank");
      })
    }
    // 点赞收藏
    const examLike = function() {
      like(exam.value, "exam")
    }
    const examFavorite = function() {
      favorite(exam.value, "exam")
    }
    const loginCallback = function() {
      showLoginFlag.value = false
    }
    const successCallback = function() {
      showLoginFlag.value = false
    }
    let clientHeight = document.documentElement.clientHeight - 306;
    if (clientHeight < 500) {
      clientHeight = 500;
    }
    return {
      ArrowRight: ArrowRightIcon,
      Tickets: TicketsIcon,
      Calendar: CalendarIcon,
      menuDefaultActive,
      menuSelectHandle,
      recommendList,
      exam,
      examLoading,
      examChapterList,
      defaultOpenedIndexList,
      startExam,
      examLike,
      examFavorite,
      clientHeight,
      examSignUp,
      loginCallback,
      successCallback,
      showLoginFlag,
      cancelExamSignUp,
      extractTag,
      extractPhrase,
      formatExamTime,
      formatIntroduction
    }
  }
}
</script>

<style scoped lang="scss">
.exam-detail {
  margin: 20px 10px;
  .exam-detail-header {
    background: #fff;
    padding: 20px;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
    min-height: 80px;
    .image-box {
      width: 270px;
      height: 148px;
      margin-right: 20px;
      position: relative;
      img {
        border-radius: 5px;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .exam-category-tag {
        position: absolute;
        top: 10px;
        left: 10px;
        background: linear-gradient(135deg, var(--el-color-primary), #05a54d);
        color: #ffffff;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }
    }
    .title-box {
      flex: 1;
      position: relative;
      h3 {
        font-size: 20px;
        font-weight: 600;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
        line-height: 1.4;
        margin: 0 0 8px;
        color: #333;
      }
      .exam-phrase {
        font-size: 14px;
        color: #666;
        margin: 0 0 10px;
        line-height: 1.5;
      }
      .exam-meta {
        margin-bottom: 10px;
        .meta-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: #888;
          margin-right: 20px;
          .el-icon {
            font-size: 14px;
            color: var(--el-color-primary);
          }
        }
      }
      .title-footer {
        position: absolute;
        bottom: 0;
        left: 0;
        .price {
          margin-top: 10px;
          color: #19be6b;
          display: inline-block;
          font-weight: 600;
          &:after {
            margin-left: 16px;
            content: "·";
            color: #999999;
          }
        }
        .time {
          color: #999999;
          display: inline-block;
          margin-left: 10px;
        }
        .exam-num {
          margin-left: 10px;
          display: inline-block;
          color: #999999;
          &:not(:last-child) {
            &:after {
              margin-left: 16px;
              content: "·";
              color: #999999;
            }
          }
        }
      }
    }
    .header-right-box {
      position: relative;
      width: 282px;
      margin-left: 20px;
      text-align: right;
      .behavior {
        :deep(.el-button--text) {
          color: rgba(0,0,0,.6);
        }
        .el-button {
          margin-left: 20px;
          &:hover {
            color: var(--el-color-primary);
          }
        }
        .el-button.active {
          color: var(--el-color-primary);
        }
      }
      .exam-btn {
        position: absolute;
        bottom: 0;
        right: 0;
        display: inline-flex;
        div {
          float: left;
        }
        .exam-num {
          margin-right: 10px;
          line-height: 40px;
        }
        .el-button {
          width: 150px;
        }
      }
    }
  }
  .exam-detail-footer {
    display: flex;
    .left-box {
      float: left;
      width: calc(100% - 302px);
      padding: 5px 20px 20px;
      background-color: #fff;
      margin-right: 20px;
      box-sizing: border-box;
      border-radius: 6px;
      .desc {
        margin-top: 20px;
        
        :deep(img) {
          width: 100%;
          height: 100%;
        }
        
        .intro-content {
          line-height: 1.8;
          color: #333;
          font-size: 14px;
          
          :deep(.intro-title) {
            font-size: 16px;
            font-weight: 600;
            color: var(--el-color-primary);
            margin: 24px 0 12px;
            padding: 10px 16px;
            background: linear-gradient(135deg, rgba(var(--el-color-primary), 0.08), rgba(var(--el-color-primary), 0.02));
            border-left: 4px solid var(--el-color-primary);
            border-radius: 0 6px 6px 0;
            
            &:first-child {
              margin-top: 0;
            }
          }
          
          :deep(.intro-section) {
            padding: 0 16px;
            color: #555;
          }
          
          :deep(.intro-bullet) {
            color: var(--el-color-primary);
            font-weight: bold;
            margin-right: 4px;
          }
        }
      }
      .chapter {
        margin-top: 20px;
      }
      .comment {
        margin-top: 20px;
      }
      .el-menu-vertical {
        border: 0;
        .el-menu-item {
          .exam-item-content {
            width: calc(100% - 80px);
            text-overflow: ellipsis;
            -webkit-line-clamp: 1;
            overflow: hidden;
          }
          .tips {
            position: absolute;
            top: 0;
            right: 45px;
            color: #999999;
            font-size: 12px;
            display: none;
          }
          &:hover {
            .tips {
              display: block;
            }
          }
        }
      }
    }
    .right-box {
      width: 282px;
      float: right;
      box-sizing: border-box;
      .board-info {
        background: #fff;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        width: 100%;
        position: relative;
        overflow: hidden;
        padding: 15px 20px;
        box-sizing: border-box;
        margin-bottom: 20px;
        border-radius: 6px;
        .el-image {
          font-size: 86px;
          width: 86px;
          height: 86px;
          border-radius: 18px;
          overflow: hidden;
          display: flex;
          position: relative;
          align-items: center;
          justify-content: center;
          object-fit: cover;
          margin: 10px 30px 15px;
          img {
            height: 100%;
            width: 100%;
          }
        }
        .circle-name {
          width: 100%;
          text-align: center;
          font-size: 18px;
          font-weight: 700;
          z-index: 1;
          padding: 0 20px;
        }
        .circle-introduction {
          font-size: 15px;
          margin: 10px 0;
          color: rgba(0,0,0,.45);
        }
        .el-button {
          display: block;
          margin: 10px auto 0;
          width: 120px;
          height: 40px;
          border-radius: 20px;
          font-size: 16px;
          color: #fff;
          text-align: center;
          border: none;
          text-shadow: unset;
          box-shadow: unset;
        }
      }
      .recommend {
        .recommend-title {
          color: rgb(85, 85, 85);
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 20px;
        }
        .recommend-ul {
          li {
            margin-bottom: 20px;
            cursor: pointer;
            .item-cover {
              display: block;
              width: 100%;
              height: 180px;
              border-radius: 6px;
              img {
                height: 100%;
                width: 100%;
                border-radius: 6px;
              }
            }
            .title-wrap {
              .intro {
                color: #555;
                font-size: 14px;
                margin-top: 5px;
                cursor: pointer;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 28px;
                display: -webkit-box;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 2;
                &:hover {
                  color: var(--el-color-primary);
                }
              }
              .title-footer {
                .price {
                  color: #19be6b;
                  display: inline-block;
                  line-height: 28px;
                  &:after {
                    margin-left: 16px;
                    content: "·";
                    color: #999999;
                  }
                }
                .time {
                  color: #999999;
                  display: inline-block;
                  margin-left: 10px;
                  line-height: 28px;
                }
                .exam-num {
                  margin-left: 10px;
                  display: inline-block;
                  color: #999999;
                  line-height: 28px;
                }
              }
            }
            &:hover {
              .title-wrap {
                .intro {
                  color: var(--el-color-primary);
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
