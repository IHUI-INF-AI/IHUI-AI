<template>
  <el-breadcrumb :separator-icon="ArrowRight">
    <el-breadcrumb-item v-for="(item, index) in levelList" :key="item.path">
      <span v-if="index === levelList.length - 1" class="no-redirect">{{item.meta.title}}</span>
      <a v-else @click.prevent="handleLink(item)">{{item.meta.title}}</a>
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>

<script>
import * as pathToRegexp from "path-to-regexp"
import router from "@/router";
import { ArrowRight } from '@/lib/lucide-fallback'
import { markRaw } from 'vue'

export default {
  name: "BreadcrumbNav",
  data() {
    return {
      levelList: null,
      ArrowRight: markRaw(ArrowRight)
    }
  },
  watch: {
    $route() {
      this.getBreadcrumb()
    }
  },
  created() {
    this.getBreadcrumb()
  },
  methods: {
    getBreadcrumb() {
      // only show routes with meta.title
      let matched = this.$route.matched.filter(item => item.meta && item.meta.title)
      const first = matched[0]
      if (!this.isIndex(first)) {
        matched = [{ path: "/index", meta: { title: "首页" }}].concat(matched)
      }
      this.levelList = matched.filter(item => item.meta && item.meta.title && item.meta.breadcrumb !== false)
    },
    isIndex(route) {
      const name = route && route.name
      if (!name) {
        return false
      }
      return name.trim().toLocaleLowerCase() === "Index".toLocaleLowerCase()
    },
    pathCompile(path) {
      // To solve this problem https://github.com/PanJiaChen/vue-element-admin/issues/561
      const { params } = this.$route
      const toPath = pathToRegexp.compile(path)
      return toPath(params)
    },
    handleLink(item) {
      const { redirect, path } = item
      console.log(redirect)
      console.log(path)
      if (redirect) {
        router.push(redirect)
        return
      }
      console.log(this.pathCompile(path))
      router.push(this.pathCompile(path))
    }
  }
}
</script>

<style lang="scss" scoped>
.el-breadcrumb {
  display: inline-block;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
  height: auto;
  font-family: 'HarmonyOS Sans SC';

  // 箭头分隔符样式
  :deep(.el-breadcrumb__separator) {
    vertical-align: middle;
    margin: 0 6px;
  }

  // 当前项样  .no-redirect {
    display: inline-block;
    vertical-align: middle;
    color: #333333;
    font-weight: 500;
    line-height: inherit;
  }

  // 链接样式
  a {
    color: #666666;
    text-decoration: none;
    vertical-align: middle;
    line-height: inherit;
    transition: color 0.2s ease;
    
    &:hover {
      color: #07c160;
    }
  }
  
  // 确保 breadcrumb-item 没有额外margin
  :deep(.el-breadcrumb__item) {
    margin: 0;
    padding: 0;
    line-height: inherit;
  }
  
  :deep(.el-breadcrumb__separator) {
    color: #999999;
  }
}
</style>
