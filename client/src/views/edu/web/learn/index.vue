<template>
  <div class="learn-main">
    <el-breadcrumb :separator-icon="ArrowRight">
      <el-breadcrumb-item>课程</el-breadcrumb-item>
    </el-breadcrumb>
    <div class="banner-menu">
      <div class="submenu" @mouseenter="showSubmenu = true" @mouseleave="showSubmenu = false" :class="{'hide': !showSubmenu}">
        <div class="inner-box">
          <div v-for="item in submenu.children" :key="item.label" class="submenu-module">
            <h2 class="type">
              <router-link target="_blank" :to="{path: '/edu/' + submenu.type + (submenu.type === 'ask' ? '' : '/list'), query: {cid: item.value}}">{{item.label}}</router-link>
            </h2>
            <div class="tag clearfix">
            </div>
            <div class="lore">
              <p class="lore-list clearfix">
                <router-link target="_blank" :to="{path: '/edu/' + submenu.type + (submenu.type === 'ask' || submenu.type === 'article' ? '' : '/list'), query: {cid: subItem.value}}" v-for="subItem in item.children" :key="subItem.label">{{subItem.label}}</router-link>
              </p>
            </div>
          </div>
        </div>
      </div>
      <!-- 目录 -->
      <div class="menu-content">
        <div class="item" v-for="item in menuList" :key="item.title" @mouseenter="categoryHover(item.type)" @mouseleave="showSubmenu = false" :class="{'hover-menu': showSubmenu && showSubmenuType === item.type}">
          <span class="title">{{item.title}}</span>
          <span class="sub-title">{{item.subTitle}}</span>
          <el-icon><ArrowRight /></el-icon>
        </div>
      </div>
      <!-- 轮播放-->
      <Banner class="banner-box" :carousel="carousel" v-loading="carouselLoading"/>
      <div class="learn-record">
        <div v-if="!isLogin" class="not-login">
          <a  @click="showLogin">
            用户未登录，点击登录
          </a>
        </div>
        <div v-else>
          <div class="learn-record-label">最近学</div>
          <div class="learn-record-list">
            <div class="learn-record-item">
              <el-empty v-if="!learnRecordList || !learnRecordList.length"/>
              <div v-else class="record-item" v-for="item in learnRecordList" :key="item.id" @click="gotoLessonDetail(item)">
                <div class="img-box">
                  <img :src="item.image">
                </div>
                <div class="info-box">
                  <div class="info-title">{{item.name}}</div>
                  <div class="info-body">
                    <div class="info-studied">
                      <div class="learn-record-tag" :class="'status-' + item.signUp.status">
                        <span class="status-dot"></span>
                        {{item.signUp.status === "completed" ? "已完成" : item.signUp.status === "cancel_sign_up" ? "已取消" : "进行中"}}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <one-announcement/>
    <!-- 热门推荐 -->
    <hot v-loading="hotDataLoading" :hot-item="hotItem"/>
    <!-- 目录课程 - 只显示有内容的分类 -->
    <row-tabs 
      v-for="item in filteredCategoryLessonList" 
      :key="item.id" 
      :item="item"
    />
  </div>
</template>

<script>
import {inject, ref, markRaw, computed} from "vue"
  import {getRecommendLesson} from "@/api/edu/web/index"
  import {ArrowRight} from '@/lib/lucide-fallback'
  import {findCategoryList, toTree} from "@/api/edu/web/learn/category"
  import Banner from "../module/banner.vue"
  import hot from "../module/hot.vue";
  import rowTabs from "../module/rowTabs.vue";
  import {getCarousel} from "@/api/edu/web/setting/carousel";
  import OneAnnouncement from "@/views/edu/web/announcement/components/oneannouncement";
  import {getToken} from "@/util/tokenUtils";
  import {getRecordLessonList, getLessonList} from "@/api/edu/web/learn/lesson";
  import router from "@/router";
  export default {
    name: "LearnIndex",
    components: {
      OneAnnouncement,
      rowTabs,
      hot,
      Banner
    },
    setup() {
      const ArrowRightIcon = markRaw(ArrowRight);
      const isLogin = getToken();
      // 目录
      const showSubmenu = ref(false);
      const categoryList = ref([])
      const categoryIndexMap = ref({})
      const menuList = ref([])
      const loadCategoryMenu = (treeList) => {
        let i = 0;
        for (const e of treeList) {
          const res = {value: e.value, type: e.value, label: e.label, children: e.children}
          categoryList.value.push({value: e.value, type: "learn", label: e.label, children: [res]})
          categoryIndexMap.value[res.type] = i++
          const children = res.children;
          let label = "";
          if (children && children.length) {
            for (let i = 0; i < children.length; i++) {
              label += children[i].label
              if (i === 1) {
                break;
              }
              if (i !== children.length - 1) {
                label += "/";
              }
            }
          }
          menuList.value.push({type: res.type, title: res.label + " ", subTitle: label})
        }
      }
      const submenu = ref({})
      const showSubmenuType = ref("")
      const categoryHover = (type) => {
        submenu.value = categoryList.value[categoryIndexMap.value[type]]
        showSubmenu.value = true
        showSubmenuType.value = type;
      }
      // 导航
      const carouselLoading = ref(true)
      const carousel = ref({})
      getCarousel({}, (res) => {
        const carouselJsonStr = res.carouselJson;
        if (carouselJsonStr) {
          carousel.value = JSON.parse(carouselJsonStr);
        }
        carouselLoading.value = false
      }).catch(() => {
        carouselLoading.value = false
      })
      // 热门推荐
      const hotItem = ref({
        id: 0,
        name: "热门课程",
        contentList: [],
        moduleLinkList: []
      })
      const hotDataLoading = ref(true)
      const loadRecommendLesson = function() {
        hotDataLoading.value = true
        getRecommendLesson({current:1, size:10}, res => {
          hotItem.value.contentList = res.list
          hotDataLoading.value = false
        })
      }
      loadRecommendLesson();
      // 分类推荐
      const categoryLessonList = ref([])
      
      const loadCategory = async function() {
        try {
          // 获取主分类列表
          const categoryRes = await findCategoryList(0, false, () => {})
          if (!categoryRes || !categoryRes.length) return
          
          const categoryList = toTree(categoryRes)
          loadCategoryMenu(categoryList)
          
          // 第一步：立即创建所有分类的框架并显示
          const initialData = categoryList.map(category => ({
            name: category.label,
            id: category.value,
            children: [{ name: "最新", id: category.value, contentList: [] }]
          }))
          categoryLessonList.value = initialData
          
          // 第二步：并行加载所有分类的课程内容（核心优化）
          const loadCategoryLessons = async (categoryIndex, category) => {
            // 并行加载主分类课程和子分类列表
            const [lessonRes, subRes] = await Promise.all([
              getLessonList({cid: category.value, current: 1, size: 10}, () => {}).catch(() => null),
              findCategoryList(category.value, false, () => {}).catch(() => null)
            ])
            
            // 更新主分类课程
            if (lessonRes && lessonRes.list) {
              categoryLessonList.value[categoryIndex].children[0].contentList = lessonRes.list
            }
            
            // 并行加载所有子分类的课程
            if (subRes && subRes.length) {
              const subLessonPromises = subRes.map(sub => 
                getLessonList({cid: sub.id, current: 1, size: 10}, () => {})
                  .then(res => ({ sub, list: res?.list || [] }))
                  .catch(() => ({ sub, list: [] }))
              )
              
              const subResults = await Promise.all(subLessonPromises)
              
              // 批量添加子分类
              for (const { sub, list } of subResults) {
                categoryLessonList.value[categoryIndex].children.push({
                  name: sub.name,
                  id: sub.id,
                  contentList: list
                })
              }
            }
          }
          
          // 并行加载所有主分类（关键优化：所有分类同时加载）
          await Promise.all(
            categoryList.map((category, index) => loadCategoryLessons(index, category))
          )
          
          // 最后只触发一次更新
          categoryLessonList.value = [...categoryLessonList.value]
          
        } catch (error) {
          console.error('加载分类失败:', error)
        }
      }
      loadCategory();
      const showLoginFlag = inject("showLogin")
      const showLogin = function() {
        // 没登录显示登陆框
        if (!getToken()) {
          showLoginFlag.value = true
          isLogin.value = false
        } else {
          showLoginFlag.value = false
          isLogin.value = true
        }
      }
      const listLoading = ref(true)
      const learnRecordList = ref([])
      
      // 模拟数据 - 用于开发测试
      const mockLearnRecordData = [
        {
          id: 1001,
          name: 'Vue3 从入门到精通实战教程',
          image: 'https://picsum.photos/seed/vue3/200/120',
          signUp: { status: 'in_progress' }
        },
        {
          id: 1002,
          name: 'TypeScript 高级编程指南',
          image: 'https://picsum.photos/seed/ts/200/120',
          signUp: { status: 'completed' }
        },
        {
          id: 1003,
          name: 'Node.js 后端开发实战',
          image: 'https://picsum.photos/seed/node/200/120',
          signUp: { status: 'in_progress' }
        }
      ]
      
      const loadRecordLessonList = function() {
        listLoading.value = true;
        const param = ref({
          current: 1,
          size: 3
        })
        getRecordLessonList(param.value, res => {
          listLoading.value = false;
          if (res && res.list && res.list.length > 0) {
            for (const lesson of res.list) {
              if (lesson && lesson.signUp && lesson.signUp.status === 'cancel_sign_up') {
                continue;
              }
              learnRecordList.value.push(lesson)
            }
          } else {
            // API 返回空数据时使用模拟数据
            learnRecordList.value = mockLearnRecordData
          }
        }).catch(() => {
          listLoading.value = false;
          // API 请求失败时使用模拟数据
          learnRecordList.value = mockLearnRecordData
        })
      }
      // 只有登录用户才请求学习记录
      if (isLogin) {
        loadRecordLessonList()
      }
      const gotoLessonDetail = function (item) {
        router.push({ name: "learnDetail", query: { id: item.id } })
      }
      // 判断分类模块是否有内容（任意子分类有课程即显示）
      const hasContent = function (item) {
        if (!item || !item.children || !item.children.length) return false
        return item.children.some(child => child.contentList && child.contentList.length > 0)
      }
      
      // 过滤掉没有内容的分类模块（使用计算属性确保响应式更新）
      const filteredCategoryLessonList = computed(() => {
        return categoryLessonList.value.filter(item => hasContent(item))
      })
      
      return {
        hotItem,
        hotDataLoading,
        categoryLessonList,
        filteredCategoryLessonList,
        carousel,
        carouselLoading,
        showSubmenu,
        categoryList,
        menuList,
        submenu,
        categoryHover,
        showSubmenuType,
        isLogin,
        showLogin,
        learnRecordList,
        gotoLessonDetail,
        hasContent,
        ArrowRight: ArrowRightIcon
      }
    }
  }
</script>
<style scoped lang="scss">
.learn-main {
  padding-top: 0;
  :deep(.el-breadcrumb) {
    margin: 20px 0 0 10px;
  }
}
.hide {
  display: none;
}
.banner-menu {
  display: flex;
  position: relative;
  min-height: 300px;
  //box-shadow: 0 2px 4px rgb(100 100 100 / 10%);
  padding: 16px 0;
  border: 1px solid #f5f5f5;
  border-radius: 6px;
  margin: 20px 10px 0 10px;
  .banner-box {
    width: calc(100% - 600px);
    min-width: calc(100% - 600px);
    border-radius: 6px;
    .banner {
      border-radius: 6px;
    }
  }
  .submenu {
    position: absolute;
    left: 300px;
    width: calc(100% - 600px);
    height: 100%;
    background: #FFFFFF;
    z-index: 3;
    box-sizing: border-box;
    .inner-box {
      height: 100%;
      padding: 0 36px;
      box-sizing: border-box;
      overflow: auto;
      .submenu-module {
        padding-top: 20px;
      }
      .type {
        margin-bottom: 10px;
        font-size: 16px;
        color: #1C1F21;
        line-height: 22px;
        font-weight: bold;
        a {
          color: #000000;
          &:hover {
            color: var(--el-color-primary);
          }
        }
      }
      .tag {
        margin-bottom: 12px;
      }
      .lore {
        font-size: 12px;
        line-height: 24px;
        color: #6D7278;
        margin-bottom: 8px;
        display: -webkit-box;
        display: -ms-flexbox;
        display: -webkit-flex;
        display: flex;
        .title {
          color: #1C1F21;
          font-weight: bold;
        }
        .lore-list {
          width: 0;
          flex: 1;
          a {
            float: left;
            color: #6D7278;
            margin-right: 24px;
            &:hover {
              color: var(--el-color-primary);
            }
          }
        }
      }
    }
  }
}
.menu-content {
  position: relative;
  float: left;
  z-index: 2;
  box-sizing: border-box;
  background: #fff;
  font-weight: 400;
  width: 300px;
  overflow: auto;
  height: 300px;
  .item {
    line-height: 50px;
    cursor: pointer;
    position: relative;
    background: #fff;
    padding: 0 20px 0 20px;
    height: 50px;
    transition: all .1s;
    font-size: 14px;
    background-size: cover;
    white-space: nowrap;
    text-overflow: ellipsis;
    width: calc(100% - 40px);
    overflow: hidden;
    .title {
      color: #000;
      font-weight: 500;
    }
    i {
      font-size: 16px;
      position: absolute;
      right: 10px;
      top: 34%;
      color: #cccccc;
    }
    &:hover {
      color: var(--el-color-primary);
      background: #ECF4FC;
      i {
        color: var(--el-color-primary);
      }
    }
    &:before{
      display: inline-block;
      content: "";
      height: 100%;
      vertical-align: middle;
    }
  }
  .hover-menu {
    color: var(--el-color-primary);
    background: #ECF4FC;
    i {
      color: var(--el-color-primary);
    }
  }
}
.learn-record {
  width: 280px;
  padding: 0 10px;
  .not-login {
    line-height: 300px;
    text-align: center;
  }
  .learn-record-label {
    font-size: 16px;
    font-weight: 500;
  }
  .learn-record-list {
    .learn-record-item {
      .record-item {
        display: flex;
        align-items: flex-start;
        margin: 10px 0;
        height: 82px;
        &:last-child {
          margin-bottom: 0;
        }
        .img-box {
          width: 120px;
          min-width: 120px;
          height: 100%;
          flex-shrink: 0;
          border-radius: 6px;
          overflow: hidden;
          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        }
        .info-box {
          flex: 1;
          padding-left: 10px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
          .info-title {
            display: -webkit-box;
            overflow: hidden;
            line-height: 22px;
            font-size: 14px;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            margin-bottom: 4px;
          }
          .info-body {
            .info-studied {
              font-size: 12px;
              color: #ec5c5c;
              
              /* 状态标签 - 现代精美设计 */
              .learn-record-tag {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                padding: 4px 10px;
                font-size: 11px;
                font-weight: 500;
                letter-spacing: 0.3px;
                border-radius: 6px;
                transition: all 0.2s ease;
                
                .status-dot {
                  width: 6px;
                  height: 6px;
                  border-radius: 50%;
                  animation: pulse 2s ease-in-out infinite;
                }
                
                /* 已完成状态 - 翡翠绿渐变 */
                &.status-completed {
                  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
                  color: #047857;
                  border: 1px solid rgba(16, 185, 129, 0.2);
                  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.1);
                  
                  .status-dot {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
                  }
                }
                
                /* 进行中状态 - 活力蓝渐变 */
                &.status-in_progress {
                  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
                  color: #1d4ed8;
                  border: 1px solid rgba(59, 130, 246, 0.2);
                  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.1);
                  
                  .status-dot {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    box-shadow: 0 0 6px rgba(59, 130, 246, 0.4);
                    animation: pulse 1.5s ease-in-out infinite;
                  }
                }
                
                /* 已取消状态 - 优雅灰 */
                &.status-cancel_sign_up {
                  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
                  color: #6b7280;
                  border: 1px solid rgba(107, 114, 128, 0.15);
                  
                  .status-dot {
                    background: #9ca3af;
                    animation: none;
                  }
                }
                
                &:hover {
                  transform: translateY(-1px);
                  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
                }
              }
              
              @keyframes pulse {
                0%, 100% {
                  opacity: 1;
                  transform: scale(1);
                }
                50% {
                  opacity: 0.7;
                  transform: scale(0.9);
                }
              }
            }
          }
        }
        &:hover {
          cursor: pointer;
          .info-title {
            color: var(--el-color-primary);
          }
        }
      }
    }
  }
}
</style>
