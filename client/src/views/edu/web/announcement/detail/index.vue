<template>
  <div class="content-container">
    <el-breadcrumb :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/'}">首页</el-breadcrumb-item>
      <el-breadcrumb-item :to="{ path: '/edu/announcement'}">公告</el-breadcrumb-item>
      <el-breadcrumb-item>公告详情</el-breadcrumb-item>
    </el-breadcrumb>
    <div class="question-box" v-loading="dataLoading">
      <el-empty v-if="!(announcement && announcement.id)"/>
      <div v-else class="card joinCircle-item">
        <h2 class="title">{{announcement.title}}</h2>
        <span class="time">{{announcement.createTime}}</span>
        <div class="content">
          <div class="inner">
            <div class="rich-text" v-html="announcement.content">
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, markRaw } from "vue"
import { ArrowRight } from '@/lib/lucide-fallback'
import {getAnnouncement} from "@/api/edu/web/announcement";
import {useRoute} from "vue-router";
export default {
  name: "announcementDetail",
  components: {
  },
  setup() {
    const ArrowRightIcon = markRaw(ArrowRight)
    const route = useRoute()
    const dataLoading = ref(true)
    const announcement = ref({})
    if (route.query.id) {
      getAnnouncement({id: route.query.id}, res => {
        announcement.value = res
        dataLoading.value = false
      }).catch(() => {
        dataLoading.value = false
      })
    }
    return {
      ArrowRight: ArrowRightIcon,
      dataLoading,
      announcement
    }
  }
}
</script>

<style scoped lang="scss">
.content-container{
  padding-top: 20px;
  :deep(.el-breadcrumb) {
    margin: 10px 10px 10px 20px;
  }
  .question-box {
    background-color: #FFFFFF;
    :deep(.el-tabs__nav-scroll) {
      padding: 0 20px;
    }
    .card {
      background: #fff;
      box-sizing: border-box;
      border-radius: 0;
      overflow: visible;
      overflow: initial;
      position: relative;
      padding: 20px;
      margin-bottom: 0;
      -webkit-box-shadow: none;
      box-shadow: none;
      .title {
        font-size: 18px;
        font-weight: 600;
        line-height: 1.9;
        color: #121212;
        margin-top: -4px;
        margin-bottom: -4px;
        cursor: pointer;
        width: calc(100% - 142px);
        &:hover {
          color: var(--el-color-primary);
        }
      }
      .time {
        position: absolute;
        top: 20px;
        right: 20px;
        color: #999;
      }
      .content {
        cursor: pointer;
        transition: color .14s ease-out;
        line-height: 1.97;
        .inner {
          margin-top: 16px;
          .rich-text {
            pointer-events: none;
            line-height: 1.9;
          }
        }
        &:hover {
          .inner {
            .more {
              color: var(--el-color-primary);
            }
          }
        }
      }
    }
  }
}
</style>
