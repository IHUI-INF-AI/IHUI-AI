<template>
  <div class="content-container">
    <h2 class="title">
      消息中心
    </h2>
    <el-tabs v-model="activeTabName" @tab-click="tabChangeHandle">
      <el-tab-pane label="通知" name="notice">
        <member-notice v-if="activeTabName === 'notice'"/>
      </el-tab-pane>
      <el-tab-pane label="点赞" name="like">
        <notice-like v-if="activeTabName === 'like'"/>
      </el-tab-pane>
      <el-tab-pane label="收藏" name="favorite">
        <notice-favorite v-if="activeTabName === 'favorite'"/>
      </el-tab-pane>
      <el-tab-pane label="评论" name="comment">
        <notice-comment v-if="activeTabName === 'comment'"/>
      </el-tab-pane>
      <el-tab-pane label="粉丝" name="fans">
        <notice-fans v-if="activeTabName === 'fans'"/>
      </el-tab-pane>
      <el-tab-pane label="私信" name="private-letter">
        <private-letter v-if="activeTabName === 'private-letter'"/>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
  import {inject, ref, watch} from "vue"
  import {useRoute, useRouter} from "vue-router";
  import PrivateLetter from "@/views/edu/web/message/privateLetter";
  import MemberNotice from "@/views/edu/web/message/notice";
  import NoticeLike from "@/views/edu/web/message/like";
  import NoticeFavorite from "@/views/edu/web/message/favorite";
  import NoticeComment from "@/views/edu/web/message/comment";
  import NoticeFans from "@/views/edu/web/message/fans";
  import {getToken} from "@/util/tokenUtils";

  export default {
    name: "memberMessage",
    components: {
      NoticeFans,
      NoticeComment,
      NoticeFavorite,
      NoticeLike,
      MemberNotice,
      PrivateLetter
    },
    setup() {
      const showLoginFlag = inject("showLogin")
      const showLoginClose = inject("showLoginClose")
      if (!getToken()) {
        showLoginFlag.value = true
        showLoginClose.value = false
        return
      }
      const activeTabName = ref("notice");
      const route = useRoute()
      const validTabs = ["notice", "like", "favorite", "comment", "fans", "private-letter"]
      const resolveTabName = () => {
        const path = route.fullPath.split("?")[0]
        let pathArray = path.split("/")
        const lastSegment = pathArray[pathArray.length - 1]
        if (lastSegment === "message" || validTabs.indexOf(lastSegment) < 0) {
          activeTabName.value = "notice"
        } else {
          activeTabName.value = lastSegment
        }
      }
      resolveTabName()
      watch(() => {return route.fullPath}, () => {
        resolveTabName()
      })
      const router = useRouter();
      const tabChangeHandle = function(tab) {
        router.push({path: "/edu/message/" + tab.paneName})
      }
      let clientHeight = document.documentElement.clientHeight - 50;
      if (clientHeight < 600) {
        clientHeight = 600;
      }
      return {
        activeTabName,
        tabChangeHandle,
        clientHeight
      }
    }
  }
</script>

<style lang="scss" scoped>
.content-container {
  background: #FFFFFF;
  display: flow-root;
  min-height: calc(100% - 40px);
  .title {
    margin: 20px 10px 10px;
  }
  :deep(.el-tabs--top .el-tabs__item.is-top:nth-child(2)) {
    padding-left: 20px;
  }
  :deep(.el-tabs__nav-wrap:after) {
    height: 0;
  }
  :deep(.el-tabs__header) {
    margin: 0;
  }
  :deep(.el-tabs__item:first-child) {
    padding-left: 0;
  }
}
</style>
