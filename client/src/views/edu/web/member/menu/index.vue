<template>
  <el-menu
    :default-active="activeIndex"
    class="el-menu-vertical"
    :default-openeds="defaultOpenedList"
    @open="handleOpen"
    @close="handleClose">
    <template v-for="(sub) in menuItemList" :key="sub.key">
      <el-sub-menu :index="sub.key" v-if="sub.children && sub.children.length">
        <template #title>
<!--          <i :class="sub.icon"></i>-->
<!--          <el-icon><Component :is="sub.icon" /></el-icon>-->
          <span>{{sub.title}}</span>
        </template>
        <el-menu-item @click="goto(item)" v-for="(item) in sub.children" :index="item.key" :key="item.key">
          <el-icon><Component :is="item.icon" /></el-icon>
          <template #title>
            <span>{{item.title}}</span>
          </template>
        </el-menu-item>
      </el-sub-menu>
      <el-menu-item v-else @click="goto(sub)" :index="sub.key" :key="sub.key">
        <i :class="sub.icon"></i>
        <template #title>
          <span>{{sub.title}}</span>
        </template>
      </el-menu-item>
    </template>
  </el-menu>
</template>

<script>
  import {ref, watch} from "vue"
  import router from "@/router"
  import {useRoute} from "vue-router";
  export default {
    name: "memberMenu",
    props: {
      active: {
        type: String,
        default: "learn-record"
      }
    },
    setup(props) {
      const route = useRoute()
      const menuItemList = [
        {
          key: "personal",
          title: "账号",
          icon: "User",
          url: "/edu/member/personal"
        },
        {
          key: "learn",
          title: "课程",
          icon: "",
          children: [
            {
              key: "learn-record",
              title: "学习记录",
              icon: "Tickets",
              url: "/edu/member/learn-record"
            },
            {
              key: "report",
              title: "学习档案报告",
              icon: "Document",
              url: "/edu/member/report"
            }
          ]
        },
        {
          key: "exam",
          title: "考试",
          icon: "",
          children: [
            {
              key: "exam-sign-up",
              title: "考试记录",
              icon: "Document",
              url: "/edu/member/exam/sign-up"
            },
            {
              key: "exam-record",
              title: "答题记录",
              icon: "DocumentCopy",
              url: "/edu/member/exam/record"
            },
            {
              key: "exam-wrong-question",
              title: "我的错题",
              icon: "CircleClose",
              url: "/edu/member/exam/wrong-question"
            },
          ]
        },
        {
          key: "content",
          title: "作品",
          icon: "",
          children: [
            {
              key: "circle",
              title: "我的社区",
              icon: "School",
              url: "/edu/member/circle"
            },
            {
              key: "ask",
              title: "我的问答",
              icon: "QuestionFilled",
              url: "/edu/member/ask"
            },
            {
              key: "article",
              title: "我的文章",
              icon: "Tickets",
              url: "/edu/member/article"
            },
            {
              key: "resource",
              title: "我的知识",
              icon: "Notebook",
              url: "/edu/member/resource"
            }
          ]
        },
        {
          key: "sns",
          title: "我的",
          icon: "",
          children: [
            {
              key: "favorites",
              title: "我的收藏",
              icon: "Star",
              url: "/edu/member/favorites"
            },
            {
              key: "comment",
              title: "我的评论",
              icon: "ChatLineSquare",
              url: "/edu/member/comment"
            },
            {
              key: "fans",
              title: "我的粉丝",
              icon: "Female",
              url: "/edu/member/fans"
            },
            {
              key: "follow",
              title: "我的关注",
              icon: "Aim",
              url: "/edu/member/follow"
            },
            {
              key: "point",
              title: "我的积分",
              icon: "Coin",
              url: "/edu/member/point"
            },
          ]
        },
        {
          key: "certificate",
          title: "荣誉",
          icon: "",
          children: [
            {
              key: "certificate",
              title: "我的证书",
              icon: "Collection",
              url: "/edu/member/certificate"
            },
          ]
        },
        {
          key: "setting",
          title: "设置",
          icon: "Setting",
          children: [
            {
              key: "setting",
              title: "账号设置",
              icon: "Setting",
              url: "/edu/member/setting"
            },
          ]
        },
      ]
      const defaultOpenedList = ref([])
      // for (const menu of menuItemList) {
      //   defaultOpenedList.value.push(menu.key);
      // }
      const activeIndex = ref("learn-record")
      watch(() => route.fullPath, (nv) => {
        for (const menuItem of menuItemList) {
          if (menuItem.children && menuItem.children.length > 0) {
            for (const item of menuItem.children) {
              if (item.url === nv) {
                activeIndex.value = item.key;
              }
            }
          } else {
            if (menuItem.url === nv) {
              activeIndex.value = menuItem.key;
            }
          }
        }
      })
      const handleOpen = function(key, keyPath) {
      }
      const handleClose = function(key, keyPath) {
      }
      const goto = function(item) {
        activeIndex.value = item.key;
        router.push({path: item.url});
      }
      for (const menuItem of menuItemList) {
        if (menuItem.children && menuItem.children.length > 0) {
          for (const item of menuItem.children) {
            if (item.key === props.active) {
              activeIndex.value = item.key;
            }
          }
        } else {
          if (menuItem.key === props.active) {
            activeIndex.value = menuItem.key;
          }
        }
      }
      return {
        menuItemList,
        activeIndex,
        handleOpen,
        handleClose,
        goto,
        defaultOpenedList
      }
    }
  }
</script>

<style scoped lang="scss">
  .el-menu-vertical {
    border: 1px solid #f0f0f0;
    border-radius: 6px;
    margin: 16px 0;
    height: calc(100% - 32px);
    background: #ffffff;
    overflow: hidden;
    
    :deep(.el-menu-item) {
      height: 44px;
      line-height: 44px;
      font-size: 14px;
      color: #333333;
      transition: all 0.2s ease;
      margin: 4px 8px;
      border-radius: 6px;
      
      &:hover {
        background: #f8f8f8;
        color: var(--el-color-primary);
      }
      
      &.is-active {
        background: rgba(7, 193, 96, 0.1);
        color: var(--el-color-primary);
        font-weight: 500;
      }
    }
    
    :deep(.el-sub-menu__title) {
      height: 44px;
      line-height: 44px;
      font-size: 14px;
      color: #333333;
      font-weight: 500;
      
      &:hover {
        background: #f8f8f8;
      }
    }
    
    :deep(.el-sub-menu .el-menu) {
      background: transparent;
    }
  }
</style>
