<template>
  <div class="sub-nav-menu" :class="{'position-fixed': true}">
    <div class="nav-menu-main">
      <div class="nav-menu-main-box">
        <div class="sub-nav-item">
          <router-link :to="{path: '/edu/learn'}">
            课程首页
          </router-link>
        </div>
        <div class="sub-nav-item">
          <router-link :to="{path: '/edu/learn/list'}">
            课程：          </router-link>
        </div>
        <div class="sub-nav-item">
          <router-link :to="{path: '/edu/learn/topic'}">
            专题课程
          </router-link>
        </div>
        <!--        <div class="nav-item">-->
        <!--          <router-link :to="{path: '/learn/map'}">-->
        <!--            学习地图-->
        <!--          </router-link>-->
        <!--        </div>-->
      </div>
    </div>
  </div>
</template>

<script>
  export default {
    name: "LearnNavMenu",
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
  top: 40px;
  left: 0;
}
.sub-nav-menu {
  display: none;
}
.sub-nav-menu {
  width: 100%;
  height: 40px;
  background: #ffffff;
  border-bottom: 1px solid #f0f0f0;
  padding: 0;
  line-height: 40px;
  .nav-menu-main {
    max-width: 1400px;
    min-width: 960px;
    margin: 0 auto;
    padding: 0 10px;
    .nav-menu-main-box {
      //margin: 0 10px;
      //margin: 0 112px;
      .sub-nav-item {
        display: inline;
        margin-right: 20px;
        a {
          color: #000000;
          &:hover {
            color: var(--el-color-primary);
          }
        }
      }
    }
  }
}
</style>
