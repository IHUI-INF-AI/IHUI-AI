<template>
  <el-container>
    <el-header class="el-header" height="58px" style="padding: 0;">
      <custom-header/>
    </el-header>
    <el-main class="main" :style="'min-height:' + clientHeight + 'px'">
      <router-view v-slot="{ Component }">
        <transition>
          <component :is="Component"/>
        </transition>
      </router-view>
      <!-- 登录弹窗已移除，改为跳转到SSO统一登录页 -->
      <!-- 美化后的返回顶部按钮 -->
      <el-backtop :right="24" :bottom="24" class="custom-backtop">
        <div class="backtop-inner">
          <svg viewBox="0 0 24 24" class="backtop-icon" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L12 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M5 11L12 4L19 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="backtop-text">TOP</span>
        </div>
      </el-backtop>
    </el-main>
    <custom-footer/>
  </el-container>
</template>

<script>
import CustomHeader from "./Header.vue";
import CustomFooter from "./Footer.vue";
import { useStore } from "@/util/vuexShim";
import {ref, provide} from "vue";

export default {
  name: "LayoutIndex",
  components: {
    CustomHeader,
    CustomFooter
  },
  setup() {
    const store = useStore();
    let clientHeight = document.documentElement.clientHeight - 58;
    if (clientHeight < 500) {
      clientHeight = 500;
    }
    store.commit("setMainHeight", clientHeight)
    // showLoginFlag 仍然提供给子组件使用（但不再显示弹窗，而是跳转到SSO登录页）
    const showLoginFlag = ref(false)
    const showLoginClose = ref(true)
    provide("showLogin", showLoginFlag)
    provide("showLoginClose", showLoginClose)
    return {
      clientHeight,
      showLoginFlag,
      showLoginClose
    }
  }
};
</script>

<style scoped>
.el-container{
  height:100%;
  position: relative;
  background-color: #fafafa;
}
.el-header, .el-footer, .el-main {
  padding: 0;
}
.main {
  min-height: 942px;
  position: relative;
  margin: 0 auto;
  width: 100%;
  background-color: #fafafa;
}
.main::-webkit-scrollbar{
  width: 0;
  height: 0;
}
/* 当页面宽度大900px */
@media screen and (min-width:1900px) {
  .main,
  :deep(.position-fixed .nav-menu-main),
  :deep(.header-container .header-contain .container) {
    max-width: 1400px;
    min-width: 1400px;
    width: 1400px;
  }
}
/* 当页面宽度在1500px900px之间 */
@media screen and (min-width:1500px) and (max-width:1900px) {
  .main,
  :deep(.position-fixed .nav-menu-main),
  :deep(.header-container .header-contain .container) {
    max-width: 1400px;
    min-width: 1400px;
    width: 1400px;
  }
}
/* 当页面宽度在1300px500px之间 */
@media screen and (min-width:1300px) and (max-width:1500px) {
  .main,
  :deep(.position-fixed .nav-menu-main),
  :deep(.header-container .header-contain .container) {
    max-width: 1200px;
    min-width: 1200px;
    width: 1200px;
  }
}
/* 当页面宽度在1100px300px之间 */
@media screen and (min-width:1100px) and (max-width:1300px){
  .main,
  :deep(.position-fixed .nav-menu-main),
  :deep(.header-container .header-contain .container) {
    max-width: 1080px;
    min-width: 1080px;
    width: 1080px;
  }
}
/* 当页面宽度在980px100px之间 */
@media screen and (min-width:980px) and (max-width:1100px){
  .main,
  :deep(.position-fixed .nav-menu-main),
  :deep(.header-container .header-contain .container) {
    max-width: 1080px;
    min-width: 1080px;
    width: 1080px;
  }
}
/* 当页面宽度小60px */
@media screen and (max-width:960px){
  .main,
  :deep(.position-fixed .nav-menu-main),
  :deep(.header-container .header-contain .container) {
    max-width: 1080px;
    min-width: 1080px;
    width: 1080px;
  }
}

/* Footer 全宽显示 */
:deep(.footer-container .footer-main) {
  max-width: 100%;
  min-width: 100%;
  width: 100%;
}

/* =============================================
   返回顶部按钮美化样式
   设计理念：玻璃拟态 + 主题色点缀 + 微交互
   ============================================= */
:deep(.custom-backtop) {
  /* 重置 Element Plus 默认样式 */
  width: auto;
  height: auto;
  background: none;
  box-shadow: none;
  border: none;
  
  .backtop-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    /* 玻璃拟态背景 */
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    /* 精致边框 */
    border: 1px solid rgba(7, 193, 96, 0.15);
    /* 多层阴影营造深度 */
    box-shadow: 
      0 4px 16px rgba(0, 0, 0, 0.08),
      0 2px 4px rgba(0, 0, 0, 0.04),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
    /* 平滑过渡 */
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    position: relative;
    overflow: hidden;
    
    /* 底部渐变光效 */
    &::before {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 24px;
      height: 3px;
      background: linear-gradient(90deg, transparent, #07c160, transparent);
      border-radius: 2px;
      opacity: 0.6;
      transition: all 0.3s ease;
    }
    
    /* 悬浮光晕效果 */
    &::after {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 16px;
      background: linear-gradient(135deg, rgba(7, 193, 96, 0.3), transparent 60%);
      opacity: 0;
      transition: opacity 0.3s ease;
      z-index: -1;
    }
  }
  
  .backtop-icon {
    width: 18px;
    height: 18px;
    color: #07c160;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
  }
  
  .backtop-text {
    font-size: 9px;
    font-weight: 600;
    color: #07c160;
    letter-spacing: 1px;
    margin-top: 2px;
    font-family: 'EDIX', 'HarmonyOS Sans SC', sans-serif;
    transition: all 0.3s ease;
  }
  
  /* 悬浮状态 */
  &:hover .backtop-inner {
    transform: translateY(-3px);
    border-color: rgba(7, 193, 96, 0.35);
    box-shadow: 
      0 8px 24px rgba(7, 193, 96, 0.2),
      0 4px 8px rgba(0, 0, 0, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
    
    &::before {
      width: 32px;
      opacity: 1;
    }
    
    &::after {
      opacity: 1;
    }
  }
  
  &:hover .backtop-icon {
    transform: translateY(-2px);
    color: #06ad56;
  }
  
  &:hover .backtop-text {
    color: #06ad56;
  }
  
  /* 点击状态 */
  &:active .backtop-inner {
    transform: translateY(-1px) scale(0.97);
    box-shadow: 
      0 4px 12px rgba(7, 193, 96, 0.15),
      0 2px 4px rgba(0, 0, 0, 0.06),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
  }
}

/* 深色模式适配（如果项目后续支持） */
@media (prefers-color-scheme: dark) {
  :deep(.custom-backtop) {
    .backtop-inner {
      background: rgba(30, 30, 30, 0.85);
      border-color: rgba(7, 193, 96, 0.25);
      box-shadow: 
        0 4px 16px rgba(0, 0, 0, 0.3),
        0 2px 4px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }
  }
}

/* 响应式适配 - 移动端稍小一点 */
@media screen and (max-width: 768px) {
  :deep(.custom-backtop) {
    .backtop-inner {
      width: 44px;
      height: 44px;
      border-radius: 12px;
    }
    
    .backtop-icon {
      width: 16px;
      height: 16px;
    }
    
    .backtop-text {
      font-size: 8px;
    }
  }
}
</style>
