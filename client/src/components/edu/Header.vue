<template>
  <div>
    <div class="layout-header-nav-start">
      <div class="logo-wrapper">
        <a :href="indexPath" title="智汇AI教育" class="logo-link">
          <img src="@/assets/edu/header/logo.png" alt="智汇AI教育" class="logo-img">
          <span class="platform-name">智汇AI教育</span>
        </a>
      </div>
      <div class="nav-buttons-wrapper">
        <button class="btn nav-btn" :class="{ 'is-active': isActive('/edu') }" @click="goto('/edu')" style="flex-direction: column;">
          <span class="btn-chinese">首页</span>
          <span class="btn-english">Home</span>
        </button>
        <button class="btn nav-btn" :class="{ 'is-active': isActive('/edu/learn') }" @click="goto('/edu/learn')" style="flex-direction: column;">
          <span class="btn-chinese">课程</span>
          <span class="btn-english">Course</span>
        </button>
        <button class="btn nav-btn" :class="{ 'is-active': isActive('/edu/live') }" @click="goto('/edu/live')" style="flex-direction: column;">
          <span class="btn-chinese">直播</span>
          <span class="btn-english">Live</span>
        </button>
        <button class="btn nav-btn" :class="{ 'is-active': isActive('/edu/exam') }" @click="goto('/edu/exam')" style="flex-direction: column;">
          <span class="btn-chinese">考试</span>
          <span class="btn-english">Exam</span>
        </button>
        <button class="btn nav-btn" :class="{ 'is-active': isActive('/edu/news') }" @click="goto('/edu/news')" style="flex-direction: column;">
          <span class="btn-chinese">资讯</span>
          <span class="btn-english">News</span>
        </button>
        <button class="btn nav-btn" :class="{ 'is-active': isActive('/edu/article') }" @click="goto('/edu/article')" style="flex-direction: column;">
          <span class="btn-chinese">文章</span>
          <span class="btn-english">Article</span>
        </button>
        <button class="btn nav-btn" :class="{ 'is-active': isActive('/edu/ask') }" @click="goto('/edu/ask')" style="flex-direction: column;">
          <span class="btn-chinese">问答</span>
          <span class="btn-english">Q&A</span>
        </button>
        <button class="btn nav-btn" :class="{ 'is-active': isActive('/edu/circle') }" @click="goto('/edu/circle')" style="flex-direction: column;">
          <span class="btn-chinese">社区</span>
          <span class="btn-english">Community</span>
        </button>
        <button class="btn nav-btn" :class="{ 'is-active': isActive('/edu/resource') }" @click="goto('/edu/resource')" style="flex-direction: column;">
          <span class="btn-chinese">知识库</span>
          <span class="btn-english">Knowledge</span>
        </button>
        <button class="btn nav-btn" :class="{ 'is-active': isActive('/edu/announcement') }" @click="goto('/edu/announcement')" style="flex-direction: column;">
          <span class="btn-chinese">公告</span>
          <span class="btn-english">Notice</span>
        </button>
      </div>
      <div class="right-menu">
        <div class="right-menu-item search-item" @click="search">
          <el-icon size="18"><Search /></el-icon>
          <span class="menu-text">搜索</span>
        </div>
        <router-link to="/admin/edu" class="right-menu-item admin-entry" title="管理后台">
          <el-icon size="18"><Setting /></el-icon>
          <span class="menu-text">管理后台</span>
        </router-link>
        <el-dropdown v-if="isLogin" class="avatar-container" trigger="click" popper-class="header-dropdown-popper" :popper-options="{ modifiers: [{ name: 'offset', options: { offset: [0, 0] } }] }">
          <div class="right-menu-item message-item">
            <el-icon size="18"><Notification /></el-icon>
            <span class="menu-text">消息</span>
          </div>
          <template #dropdown>
            <el-dropdown-menu class="user-dropdown">
              <router-link :to="{path: '/edu/message'}" class="color-black">
                <el-dropdown-item>通知</el-dropdown-item>
              </router-link>
              <router-link :to="{path: '/edu/message'}" class="color-black">
                <el-dropdown-item>点赞</el-dropdown-item>
              </router-link>
              <router-link :to="{path: '/edu/message'}" class="color-black">
                <el-dropdown-item>收藏</el-dropdown-item>
              </router-link>
              <router-link :to="{path: '/edu/message'}" class="color-black">
                <el-dropdown-item>评论</el-dropdown-item>
              </router-link>
              <router-link :to="{path: '/edu/message'}" class="color-black">
                <el-dropdown-item>粉丝</el-dropdown-item>
              </router-link>
              <router-link :to="{path: '/edu/message'}" class="color-black">
                <el-dropdown-item>私信</el-dropdown-item>
              </router-link>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown v-if="isLogin" class="avatar-container" trigger="click" popper-class="header-dropdown-popper" :popper-options="{ modifiers: [{ name: 'offset', options: { offset: [0, 0] } }] }">
          <button class="avatar-wrapper-btn">
            <el-avatar 
              v-if="member.avatar" 
              :size="24" 
              :src="member.avatar"
              class="user-avatar"
            />
            <el-avatar 
              v-else 
              :size="24" 
              class="user-avatar"
            >
              {{ member.name ? member.name.charAt(0) : '用' }}
            </el-avatar>
            {{ member.name }}
          </button>
          <template #dropdown>
            <el-dropdown-menu class="user-dropdown">
              <router-link :to="{path: '/edu/member/detail', query: {id: member.id}}" class="color-black">
                <el-dropdown-item>我的主页</el-dropdown-item>
              </router-link>
              <router-link :to="{path: '/edu/member/personal'}" class="color-black">
                <el-dropdown-item>个人中心</el-dropdown-item>
              </router-link>
              <el-dropdown-item divided @click="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <button v-else class="avatar-wrapper-btn login-btn" @click="goToLogin">
          <el-icon size="16"><User /></el-icon>
          <span class="login-text">登录</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, watch } from "vue"
import { useRoute } from "vue-router"
import { useStore } from "@/util/vuexShim"
import router from "@/router"
import { getToken, removeToken } from "@/util/tokenUtils"
import { getUser, deleteUser } from "@/util/userUtils"
import { Search, Bell as Notification, User, Setting } from '@/lib/lucide-fallback'

// SSO 统一登录地址（支持环境变量配置，默认本地开发）
const SSO_LOGIN_URL = import.meta.env.VITE_SSO_LOGIN_URL || 'http://127.0.0.1:8888/login'

export default {
  name: "CustomHeader",
  components: {
    Search,
    Notification,
    User,
    Setting
  },
  setup() {
    const route = useRoute()
    const store = useStore()
    const isLogin = ref(!!getToken())
    
    // 从 Vuex store 响应式获取用户信息
    const storeUserInfo = computed(() => store.getters.getUserInfo)
    
    // 本地 member 状态
    const member = ref(getUser() || { name: "未登录", avatar: "" })
    
    // 监听 Vuex store 中的用户信息变化，自动同步到本地 member
    watch(storeUserInfo, (newUserInfo) => {
      if (newUserInfo && newUserInfo.id && getToken()) {
        member.value = newUserInfo
        isLogin.value = true
      } else if (!getToken()) {
        member.value = { name: "未登录", avatar: "" }
        isLogin.value = false
      }
    }, { immediate: true, deep: true })

    // 刷新用户信息
    const refreshUserInfo = () => {
      isLogin.value = !!getToken()
      const loginMember = getUser()
      if (loginMember && getToken()) {
        member.value = loginMember
        // 同步更新 Vuex store
        store.dispatch('updateUserInfo', loginMember)
      } else {
        member.value = {
          name: "未登录",
          avatar: ""
        }
        // 同步清空 Vuex store
        store.dispatch('updateUserInfo', {})
      }
    }

    const logout = function () {
      removeToken()
      deleteUser()
      isLogin.value = false
      member.value = { name: "未登录", avatar: "" }
      // 同步更新 Vuex store，通知其他组件登录状态已变化
      store.dispatch('updateUserInfo', {})
      router.push({ path: "/edu" })
    }

    const search = function () {
      router.push({ path: "/edu/search" })
    }

    const goto = (path) => {
      router.push({ path: path })
    }

    // 判断路由是否激活
    const isActive = (path) => {
      if (path === '/edu') {
        return route.path === '/edu' || route.path === '/'
      }
      return route.path.startsWith(path)
    }

    const indexPath = '/edu'

    // 跳转到 SSO 统一登录页
    const goToLogin = () => {
      const currentUrl = window.location.href
      const encodedRedirect = encodeURIComponent(currentUrl)
      window.location.href = `${SSO_LOGIN_URL}?redirect=${encodedRedirect}`
    }

    // 组件挂载时刷新用户信息
    onMounted(() => {
      refreshUserInfo()
    })

    return {
      indexPath,
      isLogin,
      member,
      logout,
      search,
      goto,
      isActive,
      refreshUserInfo,
      goToLogin
    }
  }
}
</script>

<style scoped lang="scss">
.layout-header-nav-start {
  color: #333333;
  height: 58px;
  box-sizing: border-box;
  width: 100%;
  display: flex;
  align-items: center;
  z-index: 99999;
  margin: 0;
  padding: 0 20px;
  justify-content: flex-start;
  gap: 12px;
  background: #ffffff;
  border-bottom: 1px solid #f0f0f0;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;

  .logo-wrapper {
    display: flex;
    align-items: center;
    height: 45px;
    margin-right: 20px;
    flex-shrink: 0;
    position: relative;
    z-index: 1;
  }

  .logo-link {
    display: flex;
    align-items: center;
    height: 45px;
    text-decoration: none;
    gap: 12px;
  }

  .logo-img {
    width: 45px;
    height: 45px;
    object-fit: contain;
    display: block;
    flex-shrink: 0;
  }

  .platform-name {
    font-size: 18px;
    font-weight: 600;
    color: #333333;
    white-space: nowrap;
    line-height: 45px;
    font-family: 'HarmonyOS Sans SC', sans-serif;
    display: inline-block;
    margin: 0;
    padding: 0;
  }

  .nav-buttons-wrapper {
    display: flex;
    align-items: center;
    height: 100%;
    flex: 1 1 auto;
    min-width: 0;
    justify-content: center;
    flex-wrap: nowrap;
  }

  .btn {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    margin: 0 2px;
    white-space: nowrap;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0;

    &:hover {
      color: var(--el-color-primary);
    }
  }

  // 导航按钮样式
  .btn.nav-btn {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: none;
    outline: none;
    box-shadow: none;
    border-radius: 4px;
    padding: 4px 10px;
    margin: 4px 2px;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 50px;
    width: auto;
    height: auto;
    min-height: 40px;
    border: 1px solid transparent;
    box-sizing: border-box;

    .btn-chinese {
      font-size: 14px;
      font-weight: 500;
      color: #333;
      line-height: 1.2;
      margin-bottom: 2px;
      white-space: nowrap;
    }

    .btn-english {
      font-size: 9px;
      color: #999;
      line-height: 1.2;
      white-space: nowrap;
      font-family: 'EDIX', 'HarmonyOS Sans SC';
      text-transform: uppercase;
    }

    &:hover,
    &:focus {
      border: 1px solid transparent;
      outline: none;
      background-color: rgba(7, 193, 96, 0.05);

      .btn-chinese {
        color: var(--el-color-primary);
      }

      .btn-english {
        color: rgba(7, 193, 96, 0.7);
      }
    }

    &.is-active {
      border: 1px solid rgba(7, 193, 96, 0.2);
      background-color: rgba(7, 193, 96, 0.08);

      .btn-chinese {
        color: var(--el-color-primary);
        font-weight: 600;
      }

      .btn-english {
        color: rgba(7, 193, 96, 0.8);
      }
    }
  }

  .right-menu {
    display: flex;
    align-items: center;
    height: 100%;
    flex-shrink: 0;
    gap: 8px;

    .right-menu-item {
      display: flex;
      align-items: center;
      padding: 6px 12px;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s ease;
      color: #333;

      .menu-text {
        margin-left: 4px;
        font-size: 14px;
      }

      &:hover {
        background: #f5f5f5;
        color: var(--el-color-primary);
      }
    }

    .avatar-container {
      display: inline-block;
      vertical-align: top;
    }

    .avatar-wrapper-btn {
      background: transparent;
      border: none;
      border-radius: 4px;
      padding: 6px 8px;
      font-size: 14px;
      color: #333333;
      cursor: pointer;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      box-sizing: border-box;
      outline: none;
      line-height: 1;
      gap: 6px;

      &:hover {
        background: rgba(0, 0, 0, 0.04);
      }

      &.login-btn {
        color: #ffffff;
        background: $primary-color;
        border: none;
        padding: 8px 20px;
        border-radius: 8px;
        font-weight: 500;
        margin-left: 12px;
        transition: all 0.2s ease;

        .login-text {
          margin-left: 4px;
          font-size: 14px;
          letter-spacing: 1px;
        }

        &:hover {
          background: $primary-hover;
        }

        &:active {
          transform: scale(0.98);
        }
      }

      .user-avatar {
          --el-avatar-bg-color: #{var(--el-color-primary)};
          --el-avatar-text-color: #fff;
          --el-avatar-size: 24px;
          width: 24px;
          height: 24px;
          line-height: 24px;
          font-size: 12px;
          border-radius: 6px;
          overflow: hidden;
          box-sizing: border-box;
          padding: 0;
          margin: 0;
          border: none;
          background-color: var(--el-color-primary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          vertical-align: middle;
          flex-shrink: 0;
          // 抗锯齿优化
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          -webkit-mask-image: -webkit-radial-gradient(white, black);
          isolation: isolate;

          :deep(img) {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            border-radius: 0;
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
          }
        }
      }
    }
  }

.user-dropdown {
  padding: 4px;
  
  :deep(.el-dropdown-menu__item) {
    font-size: 14px;
    line-height: 36px;
    height: 36px;
    padding: 0 12px;
    margin: 2px 0;
    border-radius: 6px;
    color: #333;

    &:hover {
      background-color: #f5f5f5;
      color: var(--el-color-primary);
    }
  }
}

.color-black {
  color: #333333;
  text-decoration: none;
}

</style>

<style lang="scss">
// 全局下拉菜单悬浮样式（popper 渲染在 body 下，需要全局样式）
// 使用高优先级选择器替代 !important
body .header-dropdown-popper.el-popper.el-dropdown__popper {
  z-index: 100000;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  box-shadow: none;
  overflow: visible;
  background: #fff;
  
  .el-dropdown-menu {
    padding: 4px;
    border: none;
    box-shadow: none;
    background: transparent;
  }
  
  // 所有菜单项的通用样式
  .el-dropdown-menu__item {
    font-size: 14px;
    line-height: 36px;
    height: 36px;
    padding: 0 12px;
    margin: 2px 0;
    border-radius: 6px;
    color: #333;
    
    &:hover {
      background-color: #f5f5f5;
      color: #07c160;
    }
    
    &.is-disabled:hover {
      background-color: transparent;
    }
  }
  
  .el-dropdown-menu__item--divided {
    margin-top: 4px;
    border-top: none;
    
    &::before {
      display: none;
    }
  }
  
  .el-popper__arrow {
    display: none;
  }
}
</style>
