<template>
  <learn-nav-menu/>
  <div class="learn-detail" v-loading="lessonLoading">
    <el-breadcrumb :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/'}">首页</el-breadcrumb-item>
      <el-breadcrumb-item :to="{ path: '/edu/learn'}">课程</el-breadcrumb-item>
      <el-breadcrumb-item>{{lesson.name || '详情'}}</el-breadcrumb-item>
    </el-breadcrumb>
    <div v-if="!(lesson.signUp && lesson.signUp.status && lesson.signUp.status !== 'cancel_sign_up')" class="course-info">
      <div class="info-wrap">
        <div class="title-box">
          <h1>{{lesson.name}}</h1>
        </div>
      </div>
      <div class="fixed-wrap bigactivity" style="bottom:-64px">
        <!-- 大活动倒计-->
        <div class="timeout-bigactivity js-timeout-bigactivity" data-endtime="1636732799" data-time="1635347453"></div>
        <div class="con">
          <!-- 只在未购买和已购买正常转状态显-->
          <div class="time-price clearfix">
            <div class="no-discount clearfix l">
              <!-- 没有任何活动 -->
              <div class="ori-price l" v-if="lesson.price">
                ￥{{formatPrice(lesson.price)}}
                <div style="font-size: 14px;color: #999999; display: inline-block; text-decoration:line-through;">
                  ￥{{formatPrice(lesson.originalPrice)}}
                </div>
              </div>
              <div class="ori-price l" v-else>
                免费
              </div>
            </div>
          </div>

          <div class="info-bar clearfix" style="margin-top:0px">
            <span>点赞</span>
            <span class="nodistance">{{lesson.likeCount || 0}}</span>
            <i class="imv2-dot_samll"></i>
            <span>收藏</span>
            <span class="nodistance">{{lesson.favoriteCount || 0}}</span>
            <i class="imv2-dot_samll"></i>
            <span>学习人数</span>
            <span class="nodistance">{{lesson.learnNum || 0}}</span>
          </div>
          <div class="btns js-btns " data-pay="0">
            <div class="btn-box js-bigactivity-btns can-use-coupon">
              <a @click="startLearn" href="javascript:;" class="js-addcart btn-buy" data-cid="542" data-type="1">
                立即学习
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="player-container" v-else>
      <div class="player-header">
        <h1 :title="lesson.name" class="video-title">
          <span class="title">{{lesson.name}}</span>
        </h1>
        <div class="video-data">
          <span :title="(lesson.learnNum || 0) + ' 人在线'" class="video-data-item">{{lesson.learnNum || 0}} 人在线</span>
          <span title="收藏：" class="video-data-item">{{lesson.favoriteCount ? lesson.favoriteCount : 0}} 收藏</span>
          <span class="video-data-item">{{lesson.startTime}}</span>
        </div>
      </div>
      <div class="player-content">
        <div class="player-content-header">
          <el-row class="row">
            <el-col class="left" :span="showListBox ? 18 : 24">
              <div class="player" v-if="videoLink">
                <video-player :player-play="playerPlay" :player-pause="playerPause" :player-ended="playerEnded" :player-playing="playerPlaying" :player-timeupdate="playerTimeupdate" style="height: 100%;width: 100%;" :src="videoLink"/>
              </div>
              <div class="sign-up-layer" v-else>
                <div class="sign-up-play">
                  <div class="sign-up-button-cnt">
                    <div class="sign-up-play-tips" v-if="isLogin && currentChapterSection">
                      <div class="tips-item" v-if="lesson.signUp && lesson.signUp.status && lesson.signUp.status !== 'cancel_sign_up'">
                        <span class="tips-item-text">当前章节：{{currentChapterSection.title || ''}}</span>
                        <span class="tips-item-button" v-if="playEnded">
                          <el-button link @click="playAgain">重新观看</el-button>
                        </span>
                      </div>
                      <div class="tips-item" v-if="playEnded">
                        <span class="tips-item-text">下一章节：{{nextChapterSection.title || ''}}</span>
                        <span class="tips-item-button">
                          <el-button link @click="playNext">下一题</el-button>
                        </span>
                      </div>
                    </div>
                    <div class="sign-up-button" v-if="!isLogin">
                      <el-button @click="startLearn" class="button">
                        <el-icon><VideoPlay /></el-icon>
                        <span>开始学习</span>
                      </el-button>
                    </div>
                    <div class="sign-up-button" v-else>
                      <el-button v-if="!playEnded" @click="startLearn" class="button">
                        <el-icon><VideoPlay /></el-icon>
                        {{lesson.signUp && lesson.signUp.id ? "继续学习" : "开始学习"}}
                      </el-button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="unfold" @click="listBoxArrow">
                <div class="arrow-wrap" :title="showListBox ? '收起列表' : '展开列表'">
                  <div class="arrow">
                    <el-icon v-if="showListBox"><ArrowRight /></el-icon>
                    <el-icon v-if="!showListBox"><ArrowLeft /></el-icon>
                  </div>
                </div>
              </div>
            </el-col>
            <el-col class="right" :span="6" v-if="showListBox">
              <div class="scroll-area">
                <div class="anthology-content-scroll">
                  <div class="anthology-content">
                    <div class="detail-item">
                      <el-menu class="el-menu-vertical" v-if="lessonChapterList && lessonChapterList.length" :default-openeds="defaultOpenedIndexList" :default-active="menuDefaultActive">
                        <el-sub-menu :index="index.toString()" v-for="(lessonChapter, index) in lessonChapterList" :key="index">
                          <template #title>
                            <div class="slot-title" :title="lessonChapter.title">{{lessonChapter.title}}</div>
                          </template>
                          <el-menu-item :key="i" @click="videoChange(chapterSection)" :index="index + '-' + i" v-for="(chapterSection, i) in lessonChapter.chapterSectionList">
                            <template #title>
                              <div class="message-item-content" :title="chapterSection.title">
                                <el-icon><VideoPlay /></el-icon>{{chapterSection.title}}
                              </div>
                            </template>
                          </el-menu-item>
                        </el-sub-menu>
                      </el-menu>
                    </div>
                  </div>
                </div>
              </div>
            </el-col>
          </el-row>
        </div>
        <div class="player-content-bottom">
          <ul class="play-fn">
            <li class="play-fn-li">
              <a href="javascript:void(0);" @click="memberLike" :class="{'custom-active': lesson.like && lesson.like.status}">
                <el-icon><Pointer /></el-icon>
                点赞 <span style="color: #cccccc;">{{lesson.likeCount || 0}}</span>
              </a>
            </li>
            <li class="play-fn-li">
              <a href="javascript:void(0);" @click="memberFavorite" :class="{'custom-active': lesson.favorite && lesson.favorite.id}">
                <el-icon><Star /></el-icon>
                收藏 <span style="color: #cccccc;">{{lesson.favoriteCount || 0}}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <div class="learn-desc">
      <div class="topic-detail-nav">
        <el-menu
          :default-active="activeIndex"
          class="el-menu-demo"
          mode="horizontal"
          :ellipsis="false"
          @select="handleSelect">
          <el-menu-item index="1">概览</el-menu-item>
          <el-menu-item index="2">评论</el-menu-item>
          <el-menu-item index="3" v-if="lesson.homework">作业</el-menu-item>
          <el-menu-item index="4">评分</el-menu-item>
          <el-menu-item index="5" v-if="lesson.certificate">证书</el-menu-item>
        </el-menu>
      </div>
      <div v-show="activeIndex === '1'">
        <el-row class="row">
          <el-col :span="showListBox ? 18 : 24">
            <div style="line-height: 28px;">
              <WangEditorShowIndex v-if="lesson.introduction" :content="lesson.introduction"/>
            </div>
          </el-col>
        </el-row>
      </div>
      <div class="comment" v-show="activeIndex === '2'">
        <comment-list topic-type="lesson" :topic-id="lesson.id"/>
      </div>
      <div class="comment" v-show="activeIndex === '3'">
        <homework :lesson="lesson"/>
      </div>
      <div class="comment" v-show="activeIndex === '4'">
        <rate-index topic-type="lesson" :topic-id="lesson.id"/>
      </div>
      <div class="comment" v-show="activeIndex === '5'" style="min-width: 1163px; min-height: 854px;">
        <div class="certificate-tips-wrap">
          <div class="certificate-tips-main">学习通过后将获得下面的证书</div>
        </div>
        <div class="certificate-title">证书示例</div>
        <certificate v-if="lesson.certificate" :certificate="lesson.certificate" :lesson="lesson"/>
      </div>
    </div>
  </div>
</template>

<script>
  import {inject, ref, markRaw} from "vue"
  import { getToken } from "@/util/tokenUtils"
  import {getLesson, getLessonChapterList, saveSignUp, saveRecord, updateRecord} from "@/api/edu/web/learn/lesson"
  import videoPlayer from "@/components/edu/Video/index.vue"
  import CommentList from "@/views/edu/web/comment/list"
  import {like, getMemberLikeList, getLikeCountList} from "@/api/edu/web/comment/like"
  import {favorite, getMemberFavoriteList, getFavoriteCountList} from "@/api/edu/web/comment/favorite"
  import {useRoute} from "vue-router";
  import {error} from "@/util/tipsUtils";
  import LearnNavMenu from "@/views/edu/web/learn/navMenu";
  import router from "@/router";
  import {ArrowLeft, ArrowRight, Pointer, Star, VideoPlay} from '@/lib/lucide-fallback';
  import WangEditorShowIndex from "@/components/WangEditor/show.vue";
  import Homework from "@/views/edu/web/learn/homework/index.vue";
  import Certificate from "@/views/edu/web/learn/certificate/index.vue";
  import RateIndex from "@/views/edu/web/learn/rate/index.vue";
  export default {
    name: "learnDetail",
    components: {
      RateIndex,
      WangEditorShowIndex,
      Star,
      Pointer,
      VideoPlay,
      ArrowLeft,
      LearnNavMenu,
      videoPlayer,
      CommentList,
      ArrowRight,
      Homework,
      Certificate
    },
    setup() {
      const ArrowRightIcon = markRaw(ArrowRight)
      const lesson = ref({
        code: "",
        endTime: "",
        id: 0,
        image: "",
        introduction: "",
        isShow: true,
        name: "",
        phrase: "",
        startTime: ""
      })
      const lessonChapterList = ref([])
      const showListBox = ref(true)
      const videoLink = ref("")
      const defaultOpenedIndexList = ref([])
      const showLoginFlag = inject("showLogin")
      const recordIntervalObj = ref()
      const currentChapterSection = ref({})
      const isLogin = ref(getToken())
      const menuDefaultActive = ref("")
      const route = useRoute()

      const position = function() {
        const position = route.query.position
        // 页面内定
        if (position && position === "comment") {
          const anchor = undefined// $el.querySelector(".comment");
          setTimeout(function () {
            document.body.scrollTop = anchor.offsetTop
            document.documentElement.scrollTop = anchor.offsetTop
          }, 500)
        }
      }
      const nextChapterSection = ref({});
      let nextChapterSectionIndex = "";
      const getNextChapter = () => {
        let currentSection;
        let chapterIndex = 0;
        let chapterSectionIndex;
        for (const lessonChapter of lessonChapterList.value) {
          chapterSectionIndex = 0;
          if(lessonChapter.chapterSectionList) {
            for (const chapterSection of lessonChapter.chapterSectionList) {
              if (currentSection) {
                nextChapterSection.value = chapterSection;
                break;
              }
              if (currentChapterSection.value.id === chapterSection.id) {
                nextChapterSection.value = {}
                currentSection = chapterSection;
              }
              chapterSectionIndex++;
            }
          }
          if (currentSection && nextChapterSection.value && nextChapterSection.value.id) {
            break
          }
          chapterIndex++;
        }
        nextChapterSectionIndex = chapterIndex + "-" + chapterSectionIndex
      }
      const getRecordChapterSection = function() {
        // 已学习章
        let recordChapterSectionIdList = []
        if (lesson.value.recordList && lesson.value.recordList.length) {
          for (const record of lesson.value.recordList) {
            if (recordChapterSectionIdList.indexOf(record.lessonChapterSectionId) === -1) {
              recordChapterSectionIdList.push(record.lessonChapterSectionId)
            }
          }
        }
        let section
        let chapterIndex = 0;
        let chapterSectionIndex;
        for (const lessonChapter of lessonChapterList.value) {
          chapterSectionIndex = 0
          if(lessonChapter.chapterSectionList) {
            for (const chapterSection of lessonChapter.chapterSectionList) {
              // 第一个没有学习的章节
              if (recordChapterSectionIdList.indexOf(chapterSection.id) === -1) {
                section = chapterSection
                break;
              }
              chapterSectionIndex++
            }
          }
          if (section) {
            break
          }
          chapterIndex++
        }
        // 全部章节都已经学习，那么选择第一个章
        if (!section) {
          if(lessonChapterList.value[0] && lessonChapterList.value[0].chapterSectionList) {
            section = lessonChapterList.value[0].chapterSectionList[0]
          }
          chapterIndex = 0
          chapterSectionIndex = 0
        }
        menuDefaultActive.value = chapterIndex + "-" + chapterSectionIndex
        if (section) {
          currentChapterSection.value = section
        } else {
          if(lessonChapterList.value[0] && lessonChapterList.value[0].chapterSectionList) {
            currentChapterSection.value = lessonChapterList.value[0].chapterSectionList[0]
          }
        }
        getNextChapter()
      }
      const loadLike = function() {
        getLikeCountList({topicIdList: lesson.value.id, topicType: "lesson"}, res => {
          if (res && res.length) {
            lesson.value.likeCount = res[0].num;
          } else {
            lesson.value.likeCount = ""
          }
        })
        if(getToken()) {
          getMemberLikeList({topicIdList: lesson.value.id, topicType: "lesson"}, res => {
            if (res && res.length) {
              lesson.value.like = res[0];
            } else {
              lesson.value.like = null
            }
          })
        }
      }
      const loadFavorite = function() {
        getFavoriteCountList({topicIdList: lesson.value.id, topicType: "lesson"}, res => {
          if (res && res.length) {
            lesson.value.favoriteCount = res[0].num;
          } else {
            lesson.value.favoriteCount = ""
          }
        })
        if(getToken()) {
          getMemberFavoriteList({topicIdList: lesson.value.id, topicType: "lesson"}, res => {
            if (res && res.length) {
              lesson.value.favorite = res[0];
            } else {
              lesson.value.favorite = null
            }
          })
        }
      }
      const lessonLoading = ref(true)
      const load = function() {
        lessonLoading.value = true
        const id = route.query.id
        lesson.value.id = id ? parseInt(id) : 0;
        if (id) {
          getLesson({id: id, signUpId: route.query.signUpId}, (res) => {
            res.likeCount = ""
            res.like = {}
            res.favorite = {}
            lesson.value = res
            getLessonChapterList({lessonId: res.id}, r => {
              if (r.list && r.list.length) {
                for (let i = 0; i < r.list.length; i++) {
                 defaultOpenedIndexList.value.push(i + "");
                }
              }
              lessonChapterList.value = r.list || []
              // 获取当前学习到的课程
              getRecordChapterSection()
              position()
              lessonLoading.value = false
            }).catch(() => {lessonLoading.value = false})
            // 加载点赞信息
            loadLike()
            // 加载收藏信息
            loadFavorite()
          }).catch(() => {lessonLoading.value = false})
        }
      }
      load()
      const listBoxArrow = function() {
        showListBox.value = !showListBox.value;
      }
      const signUp = function(success) {
        if (!getToken()) {
          showLoginFlag.value = true
          return
        }
        saveSignUp({lessonId: lesson.value.id}, res => {
          lesson.value.signUp = res
          success && success(res)
        })
      }
      let maxProgressTime = 0;
      const record = function(learnTime) {
        if (currentChapterSection.value) {
          const param = {
            lessonId: lesson.value.id,
            lessonChapterSectionId: currentChapterSection.value.id,
            signUpId: lesson.value.signUp.id,
            learnTime: learnTime,
            maxProgressTime: maxProgressTime
          }
          // 判断是否已经存在学习记录
          let existsRecord = undefined;
          let existsRecordIndex = 0;
          if (lesson.value.recordList) {
            for (const record of lesson.value.recordList) {
              if (record.lessonId === param.lessonId
                      && record.lessonChapterSectionId === param.lessonChapterSectionId
                      && record.signUpId === param.signUpId) {
                existsRecord = record;
                break
              }
              existsRecordIndex++
            }
          }
          // 修改学习记录
          if (existsRecord) {
            param.id = existsRecord.id;
            updateRecord(param, res => {
              lesson.value.recordList[existsRecordIndex] = res
            })
          }
          // 新增学习记录
          else {
            saveRecord(param, res => {
              if (!lesson.value.recordList || !lesson.value.recordList.length) {
                lesson.value.recordList = []
              }
              lesson.value.recordList.push(res)
            })
          }
        }
      }
      let recordTime = 0;
      let recordUploadInterval;
      // 清除学习记录定时间
      const clearRecordInterval = function() {
        // 上传学习记录
        record(recordTime)
        // 学习记录
        recordTime = 0;
        if (recordIntervalObj.value) {
          clearInterval(recordIntervalObj.value)
        }
        if (recordUploadInterval) {
          clearInterval(recordUploadInterval)
        }
      }
      // 定时上传学习记录
      const recordInterval = function() {
        clearRecordInterval()
        // 一秒一次
        recordIntervalObj.value = setInterval(() => {
          recordTime += 1
        }, 1000);
        // 5秒定时上传一次
        recordUploadInterval = setInterval(() => {
          // 上传学习记录
          record(recordTime)
          // 学习记录
          recordTime = 0;
        }, 5000);
      }
      const videoChange = function(chapterSection) {
        if (lesson.value.signUp && lesson.value.signUp.status === "cancel_sign_up") {
          error("该报名记录已取消");
          return
        }
        // 改变视频，先上传之前的视频记录
        clearRecordInterval()
        // 没有登录
        if (!getToken()) {
          showLoginFlag.value = true
          return
        }
        // 没有报名记录，报名并开始学习
        if (!lesson.value.signUp || !lesson.value.signUp.id) {
          // 报名
          signUp(() => {
            currentChapterSection.value = chapterSection;
            // 当前播放的章节
            videoLink.value = currentChapterSection.value.url
          })
        } else {
          currentChapterSection.value = chapterSection;
          // 当前播放的章节
          videoLink.value = currentChapterSection.value.url;
        }
        getNextChapter()
      }
      const startLearn = function() {
        // 没有登录
        if (!getToken()) {
          showLoginFlag.value = true
          return
        }
        if (lesson.value.signUp && lesson.value.signUp.status === "cancel_sign_up") {
          error("该报名记录已取消");
          return
        }
        if(lessonChapterList.value.length === 0) {
          error("该课程不存在或已删除");
          return
        }
        // 没有报名记录，报名并开始学习
        if (!lesson.value.signUp || !lesson.value.signUp.id) {
          // 报名
          signUp(() => {
            // 当前播放的章节
            if (lessonChapterList.value[0] && lessonChapterList.value[0].chapterSectionList) {
              currentChapterSection.value = lessonChapterList.value[0].chapterSectionList[0]
            }
            if (currentChapterSection.value) {
              videoLink.value = currentChapterSection.value.url
            }
          })
        }
        // 继续学习
        else {
          getRecordChapterSection()
          videoLink.value = currentChapterSection.value.url
        }
      }
      const playEnded = ref(false)
      const playerPlay = function() {
        playEnded.value = false
        // 开始上传记录
        // 开启定时器
        recordInterval();
      }
      const playerPause = function() {
        // 暂停上传记录
        clearRecordInterval()
      }
      const playerEnded = function() {
        playEnded.value = true
        videoLink.value = ""
        // 暂停上传记录
        clearRecordInterval()
      }
      const playerPlaying = function () {
        // 开启定时器
        recordInterval();
      }
      const playerTimeupdate = (player) => {
        maxProgressTime = parseInt(player.currentTarget.currentTime)
      }
      const playAgain = () => {
        // 重新播放
        videoLink.value = currentChapterSection.value.url
      }
      const playNext = () => {
        // 播放下一节视频
        if (nextChapterSection.value && nextChapterSection.value.id) {
          currentChapterSection.value = nextChapterSection.value;
          videoLink.value = nextChapterSection.value.url
          menuDefaultActive.value = nextChapterSectionIndex;
        }
        getNextChapter()
      }
      const memberLike = function() {
        // 没有登录
        if (!getToken()) {
          showLoginFlag.value = true
          return
        }
        like(lesson.value, "lesson", (p) => {
          lesson.value.likeCount = p.likeNum
        })
      }
      const memberFavorite = function() {
        // 没有登录
        if (!getToken()) {
          showLoginFlag.value = true
          return
        }
        favorite(lesson.value, "lesson", (p) => {
          lesson.value.favoriteCount = p.favoriteNum
        })
      }
      const buyNow = () => {
        // 没有登录
        if (!getToken()) {
          showLoginFlag.value = true
          return
        }
        // 跳转购买
        router.push({path: "/edu/learn/buyconfirm", query: {ids: lesson.value.id}});
      }
      const formatPrice = (p) => {
        if (!p) {
          p = 0
        }
        return p.toFixed(2);
      }
      const activeIndex = ref("1");
      const handleSelect = (key, keyPath) => {
        activeIndex.value = key
      }
      return {
        ArrowRight: ArrowRightIcon,
        lesson,
        lessonChapterList,
        showListBox,
        videoLink,
        defaultOpenedIndexList,
        recordIntervalObj,
        currentChapterSection,
        isLogin,
        menuDefaultActive,
        listBoxArrow,
        videoChange,
        playAgain,
        playNext,
        playerPlay,
        playerPause,
        playerEnded,
        playerPlaying,
        playerTimeupdate,
        memberLike,
        memberFavorite,
        startLearn,
        playEnded,
        nextChapterSection,
        lessonLoading,
        buyNow,
        formatPrice,
        activeIndex,
        handleSelect
      }
    }
  }
</script>

<style lang="scss" scoped>
  .learn-detail {
    width: calc(100% - 20px);
    margin: 0 auto;
    padding-top: 0;
    :deep(.el-breadcrumb) {
      margin: 20px 0;
    }
  }
  .player-container {
    position: relative;
    margin: 20px auto;
    background: #ffffff;
    border-radius: 6px;
    .player-header {
      border: 0;
      font-size: 100%;
      vertical-align: baseline;
      height: 70px;
      box-sizing: border-box;
      margin-top: 0;
      .video-title {
        padding: 0;
        border: 0;
        vertical-align: baseline;
        font-size: 18px;
        font-weight: 500;
        color: #212121;
        height: 26px;
        margin: 0 0 8px 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        .title {
          margin: 0;
          padding: 0;
          border: 0;
          font-size: 100%;
          vertical-align: middle;
        }
      }
      .video-data {
        margin: 0;
        padding: 0;
        border: 0;
        vertical-align: baseline;
        font-size: 12px;
        height: 16px;
        color: #999;
        display: -ms-flexbox;
        display: flex;
        -ms-flex-align: center;
        align-items: center;
        text-overflow: ellipsis;
        white-space: nowrap;
        .video-data-item {
          padding: 0;
          border: 0;
          font-size: 100%;
          vertical-align: baseline;
          display: inline-block;
          height: 16px;
          margin-right: 12px;
        }
        .video-data-item:last-child {
          margin: 0;
        }
      }
    }
    .player-content {
      position: relative;
      width: calc(100% - 10px);
      .player-content-header {
        .left {
          .player {
            background-color: #ccc;
            //height: 100%;
            height: 560px;
          }
          .sign-up-layer {
            width: 100%;
            background-color: #000;
            position: relative;
            height: 560px;
            .sign-up-play {
              position: absolute;
              width: 100%;
              height: 100%;
              z-index: 99;
              background: rgba(0, 0, 0, .7);
              .sign-up-button-cnt {
                position: absolute;
                left: 50%;
                top: calc(50% - 25px);
                transform: translate(-50%,-50%);
                .sign-up-play-tips {
                  color: #ffffff;
                  width: auto;
                  text-align: center;
                  .tips-item {
                    .tips-item-text {
                    }
                    .tips-item-button {
                      margin-left: 10px;
                    }
                  }
                }
                .sign-up-button {
                  width: auto;
                  color: var(--el-color-primary);
                  text-align: center;
                  z-index: 1;
                  cursor: pointer;
                  margin: 10px 0;
                  .button {
                    font-size: 14px;
                    color: #fff;
                    background-color: var(--el-color-primary);
                    border: 0;
                    padding: 8px 10px;
                  }
                }
              }
            }
          }
          .unfold {
            position: absolute;
            z-index: 1;
            width: 20px;
            height: 40px;
            top: 40%;
            right: -20px;
            background: #fafafa;
            border-radius: 0 111.11px 111.11px 0;
            cursor: pointer;
            .arrow-wrap {
              display: block;
              height: 100%;
              position: relative;
              .arrow {
                margin-top: 10px;
                color: #999999;
              }
            }
          }
        }
        .right {
          position: relative;
          .anthology-wrap {
            height: 100%;
            background-color: #1e1e24;
          }
          .slot-title{
            text-overflow: ellipsis;
            white-space: nowrap;
            overflow: hidden;
            width: calc(100% - 15px);
          }
          .message-item-content {
            text-overflow: ellipsis;
            white-space: nowrap;
            overflow: hidden;
            color: #000000;
            &:hover {
              color: var(--el-color-primary);
            }
          }
          .scroll-area {
            float: left;
            width: 100%;
            scrollbar-track-color: #1f1f1f;
            scrollbar-arrow-color: #1f1f1f;
            scrollbar-base-color: #1f1f1f;
            scrollbar-face-color: #979797;
            scrollbar-3dlight-color: #979797;
            scrollbar-highlight-color: #979797;
            scrollbar-shadow-color: #979797;
            height: 100%;
            position: absolute;
            overflow: auto;
            top: 0;
            right: 0;
            background-color: #fafafa;
            .anthology-content-scroll {
              width: 100%;
              margin: 0 auto;
              .anthology-content {

              }
            }
          }
        }
      }
      .player-content-bottom {
        height: 56px;
        display: inline-block;
        width: 100%;
        .play-fn {
          position: relative;
          z-index: 1000;
          height: 56px;
          line-height: 56px;
          padding: 0;
          float: left;
          width: 360px;
          li {
            list-style: none;
            display: inline-block;
            position: relative;
            margin-right: 12px;
            color: hsla(0,0%,100%,.6);
            font-size: 14px;
            height: 32px;
            line-height: 32px;
            border-radius: 16px;
            padding: 0 12px;
            a {
              cursor: pointer;
              color: #2a2a32;
              text-decoration: none;
              display: block;
            }
          }
          .play-fn-li {
            a:hover {
              color: var(--el-color-primary);
            }
            .custom-active {
              color: var(--el-color-primary);
              i {
                color: var(--el-color-primary);
              }
            }
          }
        }
      }
    }
  }
  .course-info {
    width: 100%;
    position: relative;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    .info-wrap {
      width: 100%;
      margin: 0 auto;
      padding-top: 20px;
      padding-bottom: 100px;
      position: relative;
      background-color: #ffffff;
      border-radius: 6px;
      .title-box {
        width: 100%;
        margin: 0 auto;
        h1 {
          // text-align: center;
          font-size: 40px;
          color: #000;
          line-height: 48px;
          //text-shadow: 0 2px 4px rgb(28 31 33 / 60%);
        }
        h2 {
          text-align: center;
          font-size: 16px;
          color: #000;
          line-height: 24px;
          //text-shadow: 0 2px 4px rgb(28 31 33 / 60%);
          margin-top: 8px;
        }
      }
    }
    .fixed-wrap {
      width: 100%;
      min-height: 128px;
      position: absolute;
      bottom: -30px;
      //background-image: url(/static/module/img/fixed_bg.png);
      background-repeat: no-repeat;
      background-size: cover;
      background-position: center;
      border-radius: 6px;
      //box-shadow: 0 8px 16px 0 rgb(28 31 33 / 10%);
      .con {
        position: relative;
        width: 100%;
        height: 100%;
        padding: 32px 18px;
        box-sizing: border-box;
        background-color: #fafafa;
        .time-price {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          .no-discount {
            .ori-price {
              font-size: 32px;
              color: #f01414;
              line-height: 32px;
              font-weight: 700;
            }
          }
        }
        .l {
          float: left;
        }
        .info-bar {
          margin-top: 0;
          span {
            font-size: 12px;
            color: #545c63;
            line-height: 24px;
            font-weight: 700;
            padding-right: 8px;
          }
          .nodistance {
            padding-right: 0;
            font-weight: 400;
          }
          i {
            font-size: 16px;
            color: #545c63;
            line-height: 16px;
            padding: 0 10px;
            vertical-align: middle;
          }
          .imv2-dot_samll {
            &:before {
              content: "·";
            }
          }
        }
        .btns {
          position: absolute;
          font-size: 0;
          bottom: 40px;
          right: 18px;
          left: auto;
          top: auto;
          .btn-box {
            width: 140px;
            height: 48px;
            display: -webkit-box;
            display: -moz-box;
            display: -webkit-flex;
            display: -moz-flex;
            display: -ms-flexbox;
            display: flex;
            justify-content: flex-end;
            .btn-buy {
              width: 140px;
              height: 48px;
              text-align: center;
              line-height: 48px;
              background: var(--el-color-primary);
              border-radius: 6px;
              font-size: 16px;
              color: #fff;
              font-weight: 700;
              cursor: pointer;
              position: relative;
              display: inline-block;
            }
          }
        }
      }
    }
    .bigactivity {
      height: 169px;
      //background-image: url(/static/module/img/fixed_bg_20211111.png?t=1);
      bottom: -64px;
      padding-top: 36px;
      box-sizing: border-box;
      //box-shadow: 0 16px 16px 0 rgb(28 31 33 / 10%);
    }
  }
  .learn-desc {
    margin: 20px 0;
    background: #fff;
    padding: 20px 0;
    border-radius: 6px;
    .title-item {
      font-size: 20px;
      line-height: 24px;
      height: 24px;
      margin-bottom: 16px;
      color: #000000;
    }
    .row {
      padding: 20px 0;
    }
  }
  .comment {
    background: #fff;
    padding: 20px 0;
    border-radius: 6px;
    .title-item {
      font-size: 20px;
      line-height: 24px;
      height: 24px;
      margin-bottom: 16px;
      color: #000000;
    }
  }
  .certificate-tips-wrap {
    background: #f0f0f0;
    border-radius: 6px;
    .certificate-tips-main {
      padding: 10px;
    }
  }
  .certificate-title {
    margin: 20px 0;
    font-weight: 500;
  }
</style>
<style lang="scss">
  .detail-item {
    .el-menu {
      border: 0;
      .el-sub-menu__title, .el-menu-item {
        background: #fafafa;
      }
      .el-sub-menu {
        background: #fafafa;
      }
    }
  }
</style>
