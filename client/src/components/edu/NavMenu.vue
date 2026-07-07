<template>
  <div class="nav-menu sub-nav-menu" :class="{'position-fixed': false}">
    <div class="nav-menu-main">
      <div class="nav-menu-main-box">
        <div class="nav-item">
          <router-link :to="{path: '/learn'}">
            课程
          </router-link>
          <learn-nav-menu/>
        </div>
        <div class="nav-item">
          <router-link :to="{path: '/live'}">
            直播
          </router-link>
        </div>
        <div class="nav-item">
          <router-link :to="{path: '/exam'}">
            考试
          </router-link>
        </div>
        <div class="nav-item">
          <router-link :to="{path: '/news'}">
            资讯
          </router-link>
        </div>
        <div class="nav-item">
          <router-link :to="{path: '/article'}">
            文章
          </router-link>
        </div>
        <div class="nav-item">
          <router-link :to="{path: '/ask'}">
            问答
          </router-link>
        </div>
        <div class="nav-item">
          <router-link :to="{path: '/circle'}">
            社区
          </router-link>
        </div>
        <div class="nav-item">
          <router-link :to="{path: '/resource'}">
            知识库          </router-link>
        </div>
        <div class="nav-item">
          <router-link :to="{path: '/announcement'}">
            公告
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import LearnNavMenu from "@/views/learn/navMenu";
export default {
  name: "NavMenu",
  components: {
    LearnNavMenu
  },
  setup() {
    return {
    }
  }
}
</script>
<style scoped lang="scss">
.position-fixed {
  position: fixed;
  z-index: 2001;
  top: 58px;
  left: 0;
}
.nav-menu {
  width: 100%;
  height: 58px;
  background: #ffffff;
  line-height: 58px;
  .nav-menu-main {
    display: inline-flex;
    align-items: center;
    margin: 0 auto;
    padding: 0;
    color: #333333;
    background: transparent;
    height: 58px;
    .nav-menu-main-box {
      display: inline-flex;
      align-items: center;
      margin: 0;
      height: 100%;
      .nav-item {
        display: inline-flex;
        align-items: center;
        height: 100%;
        position: relative;
        a {
          display: inline-flex;
          align-items: center;
          padding: 0 16px;
          color: #333333;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          height: 100%;
          transition: all 0.2s ease;
          border-bottom: 2px solid transparent;
          &:hover {
            color: var(--el-color-primary);
          }
          &.router-link-active {
            color: var(--el-color-primary);
            border-bottom-color: var(--el-color-primary);
          }
        }
        &:hover {
          .sub-nav-menu {
            display: block;
          }
        }
      }
    }
  }
}
</style>
