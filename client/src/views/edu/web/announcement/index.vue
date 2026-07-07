<template>
  <div class="content-container">
    <el-breadcrumb :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/'}">首页</el-breadcrumb-item>
      <el-breadcrumb-item>公告</el-breadcrumb-item>
    </el-breadcrumb>
    <div class="question-box" v-loading="listLoading">
      <el-empty v-if="!announcementList || !announcementList.length"/>
      <div class="card joinCircle-item" v-for="item in announcementList" :key="item.id">
        <h2 class="title" @click="goto('/edu/announcement/detail', item.id)">{{item.title}}</h2>
        <span class="time">{{item.createTime}}</span>
        <div class="content" :class="{'show-more': item.showMore}" @click="toggleMore(item)">
          <div class="inner">
            <div class="rich-text" v-html="item.content">
            </div>
            <el-button link class="more">{{item.showMore ? '收起' : '展开'}}</el-button>
          </div>
        </div>
      </div>
      <page v-if="announcementList && announcementList.length" style="padding: 20px;" :page-size="params.size" :total="total" :current-change="currentChange" :size-change="sizeChange"></page>
    </div>
  </div>
</template>

<script>
import { ref, markRaw } from "vue"
import { ArrowRight } from '@/lib/lucide-fallback'
import {getAnnouncementList} from "@/api/edu/web/announcement";
import Page from "@/components/Page";
import router from "@/router";
export default {
  name: "AnnouncementIndex",
  components: {
    Page
  },
  setup() {
    const ArrowRightIcon = markRaw(ArrowRight)
    const activeTabName = "first"
    const tabClickHandle = (tab, event) => {
    }
    const params = ref({
      current: 1,
      size: 20
    })
    const listLoading = ref(true)
    const announcementList = ref([])
    const total = ref(0)
    const loadList = () => {
      listLoading.value = true
      getAnnouncementList(params.value, res => {
        announcementList.value = res.list
        total.value = res.total
        listLoading.value = false
      }).catch(() => {
        listLoading.value = false
      })
    }
    loadList()
    const currentChange = (currentPage) => {
      params.value.current = currentPage;
      loadList();
    }
    const sizeChange = (s) => {
      params.value.size = s;
      loadList();
    }
    const goto = (path, id) => {
      if (id) {
        router.push({ path: path, query: { id: id } })
      } else {
        router.push({ path })
      }
    }
    const toggleMore = (item) => {
      item.showMore = !item.showMore
    }
    return {
      ArrowRight: ArrowRightIcon,
      announcementList,
      activeTabName,
      params,
      total,
      tabClickHandle,
      listLoading,
      currentChange,
      sizeChange,
      goto,
      toggleMore
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
      border-bottom: 1px solid #f0f2f7;
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
        .cover {
          position: relative;
          width: 190px;
          height: 105px;
          margin-top: -2px;
          margin-right: 18px;
          margin-bottom: 4px;
          float: left;
          overflow: hidden;
          background-position: 50%;
          background-size: cover;
          border-radius: 6px;
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
          .cover-inner {
            position: absolute;
            top: 50%;
            left: 0;
            height: 100%;
            width: 100%;
            -webkit-transform: translateY(-50%);
            transform: translateY(-50%);
            overflow: hidden;
            img {
              position: absolute;
              top: 50%;
              left: 50%;
              height: 100%;
              width: 100%;
              -o-object-fit: cover;
              object-fit: cover;
              -webkit-transform: translate3d(-50%,-50%,0);
              transform: translate3d(-50%,-50%,0);
            }
          }
          &:after {
            content: "";
            position: absolute;
            z-index: 1;
            display: block;
            width: 100%;
            height: 100%;
            background: rgba(18,18,18,.02);
          }
        }
        .inner {
          margin-bottom: -4px;
          overflow: hidden;
          max-height: 100px;
          margin-top: 16px;
          .rich-text {
            pointer-events: none;
            line-height: 1.9;
            cursor: pointer;
            display: -webkit-box;
            white-space: normal;
            word-break: break-word;
            -webkit-line-clamp: 4;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .more {
            display: inline-block;
            font-size: 14px;
            text-align: center;
            cursor: pointer;
            margin-left: 4px;
            color: #175199;
            height: auto;
            padding: 0;
            line-height: inherit;
            background-color: transparent;
            border: none;
            border-radius: 0;
          }
          .more {
            float: right;
            margin-top: -26px;
            position: relative;
            background: #fff;
            &::after {
              content: "";
              position: absolute;
              display: block;
              top: 0;
              left: -30px;
              width: 30px;
              height: 100%;
              background: linear-gradient(
                      270deg, #fff, hsla(0, 0%, 100%, .2));
            }
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
      .show-more {
        .inner {
          height: auto;
          max-height: none;
          .rich-text {
            -webkit-line-clamp: inherit;
          }
        }
      }
      .actions {
        align-items: center;
        padding: 10px 20px;
        margin: 0 -20px -10px;
        color: #646464;
        clear: both;
        background: #fff;
        .action {
          margin-left: 24px;
          font-size: 14px;
          color: #646464;
          cursor: text;
          &:first-child {
            margin-left: 0;
          }
        }
        .float-right {
          float: right;
          cursor: pointer;
          &:hover {
            color: var(--el-color-primary);
          }
        }
      }
    }
    .joinCircle-item {
      .content {
        .inner {
          max-height: 58px;
          .rich-text {
            -webkit-line-clamp: 2;
          }
        }
      }
    }
  }
}
</style>
