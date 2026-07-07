<template>
  <div class="home-page-wrapper">
    <div class="common-container">
      <!-- 公告 -->
      <one-announcement/>
      <div class="index-menu-section">
        <div class="banner-menu-flex">
          <!-- 目录导航 -->
          <div class="menu-content-wrapper">
            <div class="menu-content">
              <div class="item" v-for="item in menuList" :key="item.title" @mouseenter="categoryHover(item.type)" @mouseleave="showSubmenu = false" :class="{'hover-menu': showSubmenu && showSubmenuType === item.type}">
                <span class="title">{{item.title}}</span>
                <span class="sub-title">{{item.subTitle}}</span>
                <el-icon><ArrowRight /></el-icon>
              </div>
            </div>
            
            <!-- 子菜单 -->
            <div class="submenu" @mouseenter="showSubmenu = true" @mouseleave="showSubmenu = false" :class="{'hide': !showSubmenu}">
              <div class="inner-box">
                <div v-for="item in submenu.children" :key="item.label" class="submenu-module">
                  <h2 class="type">
                    <router-link target="_blank" :to="getSubmenuLink(submenu.type, item.value)">{{item.label}}</router-link>
                  </h2>
                  <div class="lore">
                    <p class="lore-list clearfix">
                      <router-link target="_blank" :to="getSubmenuLink(submenu.type, subItem.value)" v-for="subItem in item.children" :key="subItem.label">{{subItem.label}}</router-link>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 轮播图 -->
          <div class="banner-box-wrapper">
            <Banner :carousel="carousel" class="banner-box"/>
          </div>

          <!-- 个人信息 -->
          <div class="member-wrapper">
            <div class="member">
              <!-- 已登录状态 -->
              <div class="member-bd" v-if="member && member.id">
                <div class="avatar-wrapper">
                  <a class="member-home" @click="goto('/edu/member/personal')" target="_self">
                    <img class="member-avatar" :src="member.avatar" v-if="member.avatar">
                    <div class="default-avatar" v-else>
                      <el-icon><User /></el-icon>
                    </div>
                  </a>
                </div>
                <span class="member-nick-info">
                  <div @click="goto('/edu/member/personal')" class="member-nick" :title="member.name">{{member.name}}</div>
                  <p class="member-level">等级：{{member.level ? member.level.name : "--"}}</p>
                </span>
                <div class="signature" v-if="checkInLog">
                  <span v-if="checkInLog.updateTime">最近签到：{{checkInLog.updateTime}}</span>
                  <span>
                    <a @click="memberCheckIn" class="h" :class="{'hed': checkInLog.isCheckInToday}">
                      <el-icon v-if="!checkInLog.isCheckInToday"><Coin /></el-icon> {{checkInLog.isCheckInToday ? '已签到' : '签到'}}
                    </a>
                  </span>
                </div>
              </div>
              <!-- 未登录状态 -->
              <div class="member-bd not-login" v-else>
                <div class="avatar-wrapper">
                  <div class="member-home default-avatar-large">
                    <el-icon><User /></el-icon>
                  </div>
                </div>
                <span class="member-nick-info no-login">
                  <div class="member-nick login-hint">Hi，欢迎来到学习平台</div>
                  <p class="login-tip">登录后享受更多服务</p>
                </span>
                <div class="login-btn-wrapper">
                  <el-button type="primary" @click="goToSSOLogin" round>立即登录</el-button>
                </div>
              </div>
              <!-- 已登录的统计数据 -->
              <div class="member-ft" v-if="member && member.id">
                <div class="member-login">
                  <div class="member-stats-grid">
                    <a @click="goto('/edu/member/ask')">
                      <strong>{{memberCount.question || 0}}</strong>我的问题
                    </a>
                    <a @click="goto('/edu/member/article')">
                      <strong>{{memberCount.article || 0}}</strong>我的文章
                    </a>
                    <a @click="goto('/edu/member/circle')">
                      <strong>{{memberCount.circle || 0}}</strong>我的社区
                    </a>
                    <a @click="goto('/edu/member/point')">
                      <strong>{{memberCount.point || 0}}</strong>我的积分
                    </a>
                  </div>
                </div>
              </div>
              <!-- 未登录的快捷入口 -->
              <div class="member-ft guest-links" v-else>
                <div class="guest-links-grid">
                  <router-link to="/learn/list">
                    <el-icon><Collection /></el-icon>
                    <span>全部课程</span>
                  </router-link>
                  <router-link to="/article">
                    <el-icon><Document /></el-icon>
                    <span>精选文章</span>
                  </router-link>
                  <router-link to="/ask">
                    <el-icon><ChatDotRound /></el-icon>
                    <span>问答社区</span>
                  </router-link>
                  <router-link to="/circle">
                    <el-icon><Connection /></el-icon>
                    <span>学习圈子</span>
                  </router-link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 下方各个模块 -->
      <div class="home-modules">
        <!-- 课程 -->
        <hot :hot-item="hotItem" type="learn" icon="lesson"/>
        <!-- 直播 -->
        <hot :hot-item="liveHotItem" v-if="liveHotItem.contentList && liveHotItem.contentList.length" type="live" icon="live"/>
        <!-- 考试 -->
        <exam-module/>
        <!-- 资讯 -->
        <custom-content/>
        <!-- 文章 -->
        <custom-article/>
        <!-- 问答 -->
        <question/>
        <!-- 社区 -->
        <custom-circle/>
        <!-- 知识库-->
        <resource/>
      </div>
    </div>
  </div>
</template>

<script>
import {inject, ref, markRaw, computed, watch} from "vue"
import { useStore } from "@/util/vuexShim"
import { Coin, ArrowRight, User, Collection, Document, ChatDotRound, Connection } from '@/lib/lucide-fallback'
import {getRecommendLesson, getCategory} from "@/api/edu/web/index"
import Banner from "../module/banner.vue"
import hot from "../module/hot.vue";
import CustomContent from "./content.vue";
import Question from "./question.vue";
import CustomCircle from "./circle.vue";
import {getUser} from "@/util/userUtils";
import {getToken} from "@/util/tokenUtils";
import {getCarousel} from "@/api/edu/web/setting/carousel";
import {getCheckIn} from "@/api/edu/web/member";
import router from "@/router";
import {success} from "@/util/tipsUtils";
import {liveList} from "@/api/edu/web/live";
import {checkIn} from "@/api/edu/web/member"
import {countMemberPoint} from "@/api/edu/web/point";
import {countMemberArticle} from "@/api/edu/web/content/article";
import {countMemberQuestion} from "@/api/edu/web/ask";
import {countMemberCircle} from "@/api/edu/web/circle";
import Resource from "@/views/edu/web/index/resource";
import CustomArticle from "@/views/edu/web/index/article";
import OneAnnouncement from "@/views/edu/web/announcement/components/oneannouncement";
import ExamModule from "@/views/edu/web/index/exam";
export default {
  name: "HomeIndex",
  components: {
    OneAnnouncement,
    CustomArticle,
    Resource,
    CustomCircle,
    Question,
    CustomContent,
    hot,
    Banner,
    Coin,
    ArrowRight,
    User,
    Collection,
    Document,
    ChatDotRound,
    Connection,
    ExamModule
  },
  setup() {
    const carousel = ref({})
    getCarousel({}, (res) => {
      const carouselJsonStr = res.carouselJson;
      if (carouselJsonStr) {
        carousel.value = JSON.parse(carouselJsonStr);
      }
    })
    // 课程
    const hotItem = ref({
      id: 0,
      name: "课程",
      contentList: [],
      moduleLinkList: [{id: 0, name: "", href: "javascript:void(0)"}]
    })
    const hotDataLoading = ref(true)
    const loadRecommendLesson = function() {
      hotDataLoading.value = true
      getRecommendLesson({current: 1, size: 10}, res => {
        hotItem.value.contentList = res.list
        hotDataLoading.value = false
      })
    }
    loadRecommendLesson()
    // 直播
    const liveHotItem = ref({
      id: 0,
      name: "直播",
      contentList: [],
      moduleLinkList: [{id: 0, name: "", href: "javascript:void(0)"}]
    })
    const liveHotDataLoading = ref(true)
    liveList({}, res => {
      liveHotItem.value.contentList = res.list
      liveHotDataLoading.value = false
    })
    // 目录
    const showSubmenu = ref(false);
    const categoryList = ref([])
    const categoryIndexMap = ref({})
    const menuList = ref([])
    getCategory( (res) => {
      categoryList.value.push(res)
      categoryIndexMap.value[res.type] = res.value
      const children = res.children;
      let label = "";
      for (let i = 0; i < children.length; i++) {
        label += children[i].label
        if (i === 2) {
          break;
        }
        if (i !== children.length - 1) {
          label += "/";
        }
      }
      menuList.value.push({type: res.type, title: res.label + " ", subTitle: label})
    })
    const submenu = ref({})
    const showSubmenuType = ref("")
    const categoryHover = (type) => {
      submenu.value = categoryList.value[categoryIndexMap.value[type]]
      showSubmenu.value = true
      showSubmenuType.value = type;
    }
    // 会员信息 - 使用 Vuex store 实现响应式
    const store = useStore()
    // 从 store 获取响应式的用户信息
    const storeUserInfo = computed(() => store.getters.getUserInfo)
    
    // 响应式的 member，监听 store 变化
    const member = ref(getUser() && getToken() ? getUser() : { name: "用户未登录，点击登录", avatar: "" })
    
    // 监听 store 中的 userInfo 变化，同步更新 member
    watch(storeUserInfo, (newUserInfo) => {
      if (newUserInfo && newUserInfo.id && getToken()) {
        member.value = newUserInfo;
      } else {
        member.value = { name: "用户未登录，点击登录", avatar: "" };
      }
    }, { immediate: true, deep: true })
    
    const showLoginFlag = inject("showLogin")
    const goto = (url) => {
      if (!member.value.id) {
        showLoginFlag.value = true;
        return;
      }
      router.push({path: url})
    }
    // 获取签到记录
    const checkInLog = ref(null)
    const loadCheckIn = () => {
      getCheckIn((res) => {
        checkInLog.value = res
      })
    }
    loadCheckIn()
    // 签到
    const memberCheckIn = () => {
      if (!member.value.id) {
        showLoginFlag.value = true;
        return;
      }
      if (checkInLog.value && checkInLog.value.isCheckInToday) {
        return;
      }
      checkIn(() => {
        success("签到成功")
        loadCheckIn()
      })
    }
    // 获取会员积分
    const memberCount = ref({
      point: 0,
      article: 0,
      question: 0,
      circle: 0
    })
    countMemberPoint((res) => {
      memberCount.value.point = res
    })
    countMemberArticle((res) => {
      memberCount.value.article = res
    })
    countMemberQuestion({}, (res) => {
      memberCount.value.question = res
    })
    countMemberCircle((res) => {
      memberCount.value.circle = res
    })
    // 获取子菜单链接
    const getSubmenuLink = (type, cid) => {
      // 根据类型返回不同的路由
      const typeRouteMap = {
        'learn': '/learn/list',
        'live': '/live',
        'article': '/edu/article',
        'ask': '/edu/ask',
        'circle': '/edu/circle',
        'resource': '/edu/resource',
        'exam': '/edu/exam',
        'news': '/edu/news'
      }
      const path = typeRouteMap[type] || '/' + type + '/list'
      return { path: path, query: { cid: cid } }
    }
    // 跳转到SSO统一登录页
    const goToSSOLogin = () => {
      const currentUrl = window.location.origin + window.location.pathname
      const encodedRedirect = encodeURIComponent(currentUrl)
      const ssoUrl = import.meta.env.VITE_SSO_LOGIN_URL || 'http://127.0.0.1:8888/login'
      window.location.href = `${ssoUrl}?redirect=${encodedRedirect}`
    }
    return {
      hotItem,
      hotDataLoading,
      liveHotItem,
      liveHotDataLoading,
      showSubmenu,
      categoryList,
      menuList,
      submenu,
      categoryHover,
      member,
      carousel,
      showSubmenuType,
      goto,
      memberCheckIn,
      memberCount,
      checkInLog,
      showLoginFlag,
      getSubmenuLink,
      goToSSOLogin,
      ArrowRight: markRaw(ArrowRight)
    }
  }
}
</script>
<style scoped lang="scss">
.hide {
  display: none;
}

.home-page-wrapper {
  background-color: $bg-page;
  min-height: 100vh;
  padding-bottom: 40px;
}

.index-menu-section {
  margin-top: 8px;
  margin-bottom: 20px;
  background: #ffffff;
  border-radius: $border-radius;
  border: 1px solid $border-color;
  box-shadow: $shadow-sm;
  overflow: visible;
  position: relative;
}

.banner-menu-flex {
  display: flex;
  min-height: 320px;
  position: relative;
  
  @media (max-width: 1024px) {
    flex-direction: column;
  }
}

.menu-content-wrapper {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid $border-color;
  position: relative;
  z-index: 10;

  @media (max-width: 1024px) {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid $border-color;
  }
}

.menu-content {
  max-height: 300px; // 最多显示6个菜单项
  overflow-y: auto;
  padding: 10px 0;
  
  // 自定义滚动条样式
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #ddd;
    border-radius: 2px;
    
    &:hover {
      background: #ccc;
    }
  }
  
  .item {
    padding: 0 20px;
    height: 50px;
    display: flex;
    align-items: baseline;
    justify-content: flex-start;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 14px;
    color: $text-primary;
    line-height: 50px;

    .title {
      font-weight: 500;
      flex-shrink: 0;
    }

    .sub-title {
      font-size: 12px;
      color: $text-placeholder;
      margin-left: 8px;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    i, .el-icon {
      color: #ccc;
      font-size: 14px;
      flex-shrink: 0;
      margin-left: auto;
      line-height: inherit;
    }

    &:hover, &.hover-menu {
      background-color: rgba(64,158,255, 0.05);
      color: $primary-color;
      
      i, .el-icon {
        color: $primary-color;
      }
    }
  }
}

.submenu {
  position: absolute;
  left: 100%;
  top: 0;
  width: 600px;
  height: 100%;
  background: #ffffff;
  z-index: 100;
  box-shadow: 10px 0 20px rgba(0,0,0,0.05);
  border-left: 1px solid $border-color;
  overflow-y: auto;
  
  @media (max-width: 1200px) {
    width: 400px;
  }

  @media (max-width: 1024px) {
    left: 0;
    top: 100%;
    width: 100%;
    height: auto;
    max-height: 400px;
    overflow-y: auto;
  }

  .inner-box {
    padding: 20px 30px;
    
    .submenu-module {
      margin-bottom: 20px;
      
      .type {
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 12px;
        border-bottom: 1px solid $border-color;
        padding-bottom: 8px;
        line-height: 1.5;
        
        a {
          color: $text-primary;
          line-height: inherit;
          &:hover {
            color: $primary-color;
          }
        }
      }
      
      .lore-list {
        display: flex;
        flex-wrap: wrap;
        gap: 12px 20px;
        align-items: baseline;
        
        a {
          font-size: 13px;
          color: $text-secondary;
          line-height: 1.8;
          display: inline-block;
          vertical-align: baseline;
          &:hover {
            color: $primary-color;
          }
        }
      }
    }
  }
}

.banner-box-wrapper {
  flex: 1;
  min-width: 0; // 防止 flex 溢出
  padding: 15px;
  
  .banner-box {
    width: 100%;
    height: 100%;
    border-radius: $border-radius;
    overflow: hidden;
  }
}

.member-wrapper {
  width: 280px;
  flex-shrink: 0;
  padding: 15px;
  display: flex;
  flex-direction: column;

  @media (max-width: 1280px) {
    width: 240px;
  }

  @media (max-width: 1024px) {
    width: 100%;
    border-top: 1px solid $border-color;
  }
}

.member {
  text-align: center;
  height: 100%;
  display: flex;
  flex-direction: column;
  
  .member-bd {
    padding: 15px 0;
    
    .avatar-wrapper {
      margin-bottom: 12px;
      
      .member-home {
        display: inline-block;
        width: 64px;
        height: 64px;
        border-radius: 12px;
        border: 3px solid #fff;
        box-shadow: $shadow-sm;
        overflow: hidden;
        cursor: pointer;
        // 抗锯齿优化
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
        -webkit-mask-image: -webkit-radial-gradient(white, black);
        isolation: isolate;
      }
      
      .member-avatar {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
      }
      
      .default-avatar {
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, $primary-color 0%, #35e683 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 28px;
      }
      
      .default-avatar-large {
        display: inline-flex;
        width: 72px;
        height: 72px;
        border-radius: 12px;
        background: linear-gradient(135deg, #e0e0e0 0%, #f5f5f5 100%);
        align-items: center;
        justify-content: center;
        color: #bbb;
        font-size: 36px;
        border: 3px solid #fff;
        box-shadow: $shadow-sm;
        // 抗锯齿优化
        -webkit-transform: translateZ(0);
        transform: translateZ(0);
        -webkit-backface-visibility: hidden;
        backface-visibility: hidden;
        -webkit-mask-image: -webkit-radial-gradient(white, black);
        isolation: isolate;
      }
    }
    
    .member-nick-info {
      display: block;
      margin-bottom: 12px;
      
      .member-nick {
        font-size: 16px;
        font-weight: 600;
        color: $text-primary;
        margin-bottom: 4px;
        cursor: pointer;
        
        &:hover {
          color: $primary-color;
        }
      }
      
      .member-level {
        font-size: 12px;
        color: $text-placeholder;
      }
      
      &.no-login {
        .login-hint {
          font-size: 15px;
          color: $text-primary;
          cursor: default;
        }
        
        .login-tip {
          font-size: 13px;
          color: $text-placeholder;
          margin-top: 4px;
        }
      }
    }
    
    .login-btn-wrapper {
      margin-top: 15px;
      
      .el-button {
        padding: 10px 40px;
      }
    }
    
    .signature {
      font-size: 12px;
      color: $text-secondary;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
      
      .h {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 18px;
        border-radius: 20px;
        border: 1px solid $primary-color;
        color: $primary-color;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 13px;
        
        &:hover {
          background-color: $primary-color;
          color: #fff;
        }
        
        &.hed {
          border-color: $border-color;
          color: $text-placeholder;
          cursor: default;
          &:hover {
            background: none;
            color: $text-placeholder;
          }
        }
      }
    }
    
    &.not-login {
      padding-top: 25px;
    }
  }
  
  .member-ft {
    margin-top: auto;
  }
  
  .member-stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1px;
    background-color: $border-color;
    border: 1px solid $border-color;
    border-radius: $border-radius;
    overflow: hidden;
    
    a {
      background-color: #fff;
      padding: 12px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: $text-secondary;
      transition: background-color 0.2s;
      
      strong {
        font-size: 18px;
        color: $primary-color;
        font-weight: 600;
      }
      
      &:hover {
        background-color: $bg-hover;
      }
    }
  }
  
  .guest-links {
    .guest-links-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      
      a {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 12px 8px;
        background-color: $bg-page;
        border-radius: $border-radius;
        color: $text-secondary;
        font-size: 12px;
        transition: all 0.2s;
        
        .el-icon {
          font-size: 22px;
          color: $primary-color;
        }
        
        &:hover {
          background-color: rgba(64,158,255, 0.1);
          color: $primary-color;
        }
      }
    }
  }
}

.home-modules {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-top: 10px;
}
</style>
