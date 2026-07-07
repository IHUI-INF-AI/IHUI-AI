<template>
  <el-breadcrumb style="margin: 20px 10px;" :separator-icon="ArrowRight">
    <el-breadcrumb-item :to="{ path: '/edu/circle' }">社区</el-breadcrumb-item>
    <el-breadcrumb-item>详情</el-breadcrumb-item>
  </el-breadcrumb>
  <div class="circle-details-wrap" v-if="Object.keys(circle).length">
    <div class="left-box">
      <router-link :to="{path: '/edu/circle'}"><h2 class="title">首页</h2></router-link>
      <div class="left-menu">
        <div class="left-menu-item active">
          最新动        </div>
        <!--        <div class="left-menu-item">-->
        <!--          全部关注-->
        <!--        </div>-->
        <!--        <div class="left-menu-item">-->
        <!--          热门话题-->
        <!--        </div>-->
      </div>
    </div>
    <div class="middle-box">
      <div class="send-box" v-if="circleMember && circleMember.id">
        <div class="send-content">
          <el-input type="textarea" :rows="4" v-model="content" placeholder="分享你的乐趣..."></el-input>
        </div>
        <div class="tool-box">
          <el-button type="primary" size="small" @click="submit" :loading="submitLoading">发送</el-button>
        </div>
      </div>
      <div class="middle-menu">
        <div class="menu-item">
          <div class="menu-text active">
            全部
          </div>
        </div>
        <!--        <div class="menu-item">-->
        <!--          <div class="menu-text">-->
        <!--            热门-->
        <!--          </div>-->
        <!--        </div>-->
        <!--        <div class="menu-item">-->
        <!--          <div class="menu-text">-->
        <!--            精华-->
        <!--          </div>-->
        <!--        </div>-->
      </div>
      <div class="dynamic-list" v-loading="listLoading">
        <el-empty v-if="!dynamicList || !dynamicList.length" style="background: #ffffff; margin-top: 10px;border-radius: 6px;"/>
        <div class="dynamic" v-for="item in dynamicList" :key="item.id">
          <div class="dynamic-user-info" v-if="item.member" @click="gotoMemberDetail(item.member.id)">
            <el-image :src="item.member.avatar || ''">
              <template #error>
                <div class="image-slot">
<!--                  <el-icon size="52"><PictureRounded /></el-icon>-->
                </div>
              </template>
            </el-image>
            <div class="user">
              <p class="username">{{item.member.name || ''}}</p>
              <p class="send-time">{{circle.createTime}}</p>
            </div>
          </div>
          <div class="dynamic-content">
            <div class="dynamic-text">{{item.content}}</div>
            <div class="dynamic-image" v-if="item.image">
              <el-image :src="item.image">
                <template #error>
                  <div class="image-slot">
                    <el-icon><Picture /></el-icon>
                  </div>
                </template>
              </el-image>
            </div>
          </div>
          <div class="dynamic-btn-list">
            <div class="dynamic-btn" @click="dynamicLike(item)" title="点赞" :class="{'active': item.like && item.like.status}">
              <el-icon size="14"><Pointer /></el-icon>
              {{item.likeNum || 0}}
            </div>
            <div class="dynamic-btn"  title="评论" :class="{'active': item.showComment}" @click="toggleComment(item)">
              <el-icon size="14"><ChatDotSquare /></el-icon>
              {{item.commentNum || 0}}
            </div>
            <div class="dynamic-btn" @click="dynamicFavorite(item)" title="收藏" :class="{'active': item.favorite && item.favorite.id}">
              <el-icon size="14"><Star /></el-icon>
              {{item.favoriteNum || 0}}
            </div>
          </div>
          <div class="comment" v-show="item.showComment">
            <comment-list topic-type="dynamic" :topic-id="item.id"/>
          </div>
        </div>
      </div>
    </div>
    <div class="right-box">
      <div class="circle-info">
        <div class="board-info">
          <el-image :src="circle.image">
            <template #error>
              <div class="image-slot">
                <el-icon><Picture /></el-icon>
              </div>
            </template>
          </el-image>
          <div class="circle-name">{{circle.name}}</div>
          <div class="circle-introduction">{{circle.introduction}}</div>
          <div style="width: 100%;">
            <el-button class="circle-join" type="primary" @click="join" :loading="joinLoading" v-if="!circleMember || !circleMember.id">加入</el-button>
            <el-button class="circle-exit" style="background: #fafafa;color: #07c160;" @click="exit" :loading="exitLoading" v-else>退款</el-button>
          </div>
        </div>
        <div class="count-bar">
          <div>
            {{dynamicNum || 0}}
            <span>动</span>
          </div>
          <div>
            {{memberNum || 0}}
            <span>成员</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {inject, ref, markRaw} from "vue"
import {ArrowRight} from '@/lib/lucide-fallback'
import { useRoute } from "vue-router"
import { getCircle, joinCircle, exitCircle, getCircleMemberNum, getCircleMember } from "@/api/edu/web/circle"
import { getDynamicList, createDynamic, getCircleDynamicNum } from "@/api/edu/web/circle/dynamic"
import {error, success} from "@/util/tipsUtils";
import {like} from "@/api/edu/web/comment/like";
import {favorite} from "@/api/edu/web/comment/favorite";
import CommentList from "@/views/edu/web/comment/list";
import {getToken} from "@/util/tokenUtils";
import {gotoMemberDetail} from "@/api/edu/web/member";
export default {
  name: "CircleDetail",
  methods: {gotoMemberDetail},
  components: { CommentList},
  setup() {
    const ArrowRightIcon = markRaw(ArrowRight)
    const route = useRoute()
    const showLoginFlag = inject("showLogin")
    const id = route.query.id
    const circle = ref({})
    getCircle({id}, res => {
      circle.value = res
    })
    const params = ref({
      size: 10,
      current: 1,
      circleId: id
    })
    const dynamicList = ref([])
    const listLoading = ref(true)
    const loadDynamicList = () => {
      listLoading.value = true
      getDynamicList(params.value, res => {
        for (const item of res.list) {
          item.showComment = false
        }
        dynamicList.value.push(...res.list);
        listLoading.value = false
      }).catch(() => {
        listLoading.value = false
      })
    }
    loadDynamicList()
    const dynamicNum = ref(0)
    const loadCircleDynamicNum = () => {
      getCircleDynamicNum(id, res => {
        if (res) {
          dynamicNum.value = res
        }
      })
    }
    loadCircleDynamicNum()
    const submitLoading = ref(false)
    const content = ref("")
    const submit = () => {
      if (!content.value) {
        error("请输入分享内容")
        return
      }
      submitLoading.value = true
      createDynamic({content: content.value, circleId: circle.value.id}, () => {
        submitLoading.value = false
        success("发布成功");
        params.value.current = 1;
        dynamicList.value = []
        loadDynamicList();
        loadCircleDynamicNum();
      }).catch(() => {
        submitLoading.value = false
      })
    }
    const dynamicLike = function(item) {
      if (!getToken()) {
        showLoginFlag.value = true
        return;
      }
      like(item, "dynamic")
    }
    const dynamicFavorite = function(item) {
      if (!getToken()) {
        showLoginFlag.value = true
        return;
      }
      favorite(item, "dynamic")
    }
    const toggleComment = (item) => {
      item.showComment = !item.showComment;
    }
    const memberNum = ref(0)
    const loadCircleMemberNum = () => {
      getCircleMemberNum(id, res => {
        if (res) {
          memberNum.value = res
        }
      })
    }
    loadCircleMemberNum()
    const circleMember = ref(null)
    const joinLoading = ref(false)
    const join = () => {
      if (!getToken()) {
        showLoginFlag.value = true
        return;
      }
      joinLoading.value = true
      joinCircle({circleId: circle.value.id}, (res) => {
        success("加入社区成功");
        loadCircleMemberNum()
        circleMember.value = res;
        joinLoading.value = false
      }).catch(() => {
        joinLoading.value = false
      })
    }
    const exitLoading = ref(false)
    const exit = () => {
      if (!getToken()) {
        showLoginFlag.value = true
        return;
      }
      exitLoading.value = true
      exitCircle({circleId: circle.value.id}, () => {
        success("退出社区成功");
        loadCircleMemberNum()
        circleMember.value = null;
        exitLoading.value = false
      }).catch(() => {
        exitLoading.value = false
      })
    }
    getCircleMember(id, res => {
      if (res) {
        circleMember.value = res
      }
    })
    return {
      ArrowRight: ArrowRightIcon,
      listLoading,
      dynamicList,
      content,
      circle,
      submit,
      submitLoading,
      dynamicLike,
      dynamicFavorite,
      toggleComment,
      joinLoading,
      join,
      exitLoading,
      exit,
      dynamicNum,
      memberNum,
      circleMember
    }
  }
}
</script>

<style scoped lang="scss">
.circle-details-wrap {
  display: flex;
  margin: 20px 10px;
  box-sizing: border-box;
  .left-box {
    width: 182px;
    background: #FFFFFF;
    border-radius: 6px;
    .title {
      margin: 0;
      padding: 10px 16px;
      line-height: 26px;
      font-size: 22px;
      font-weight: 500;
      color: #000000;
    }
    .left-menu {
      .left-menu-item {
        position: relative;
        padding: 8px 16px;
        border-radius: 2px;
        cursor: pointer;
        align-items: center;
        -webkit-box-align: center;
        display: flex;
        &:hover {
          color: var(--el-color-primary);
          background-color: rgba(65,95,255, .1);
        }
      }
      .left-menu-item.active {
        color: var(--el-color-primary);
        font-weight: 700;
      }
    }
  }
  .middle-box {
    flex: 1;
    margin: 0 10px;
    box-sizing: border-box;
    .send-box {
      padding: 20px 20px 10px;
      margin-bottom: 10px;
      background: #fff;
      border-radius: 6px;
      .send-content {
        margin-bottom: 10px;
        :deep(textarea) {
          padding: 10px;
        }
      }
      .tool-box {
        display: flow-root;
        button {
          float: right;
        }
      }
    }
    .middle-menu {
      background: #fff;
      border-radius: 6px;
      .menu-item {
        vertical-align: top;
        width: 12.5%;
        display: inline-block;
        font-size: 1rem;
        height: 44px;
        .menu-text {
          width: 100%;
          padding: 5px;
          line-height: 34px;
          text-align: center;
          cursor: pointer;
          font-size: 14px;
          color: #333;
          text-overflow: ellipsis;
          white-space: nowrap;
          &:hover {
            color: var(--el-color-primary);
            background-color: rgba(65,95,255, .1);
          }
        }
        .menu-text.active {
          color: var(--el-color-primary);
          font-weight: 700;
        }
      }
    }
    .dynamic-list {
      min-height: 300px;
      .dynamic {
        box-sizing: border-box;
        border-radius: 6px;
        margin: 10px 0;
        background: #FFFFFF;
        padding: 20px 20px 0;
        border-bottom: 1px solid #f0f0f0;
        &:last-child {
          border-bottom: 0;
        }
        .dynamic-user-info {
          width: 100%;
          display: flex;
          cursor: pointer;
          &:hover {
            .username {
              color: var(--el-color-primary);
            }
          }
          .el-image {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            &:before {
              border: 1px solid rgba(0,0,0,.05);
              border-radius: 50%;
              bottom: 0;
              content: "";
              left: 0;
              position: absolute;
              right: 0;
              top: 0;
              z-index: 9;
            }
          }
          .user {
            margin-left: 10px;
            .username {
              margin-bottom: 4px;
              margin-top: 4px;
              font-weight: bolder;
            }
            .send-time {
              font-size: 12px;
              color: #999;
            }
          }
        }
        .dynamic-content {
          width: calc(100% - 60px);
          padding-left: 60px;
          .dynamic-text {
            word-wrap: break-word;
          }
          .dynamic-image {
            margin-top: 10px;
            .el-image {
              flex-grow: 0;
              width: 33.33333%;
              border-radius: 8px;
              min-width: 132px;
              min-height: 132px;
              img {
                padding-left: 0.25rem;
                padding-top: 0.25rem;
              }
            }
          }
        }
        .dynamic-btn-list {
          background: #FFFFFF;
          text-align: center;
          .dynamic-btn {
            width: 33.3333%;
            display: inline-block;
            justify-content: center;
            align-items: center;
            text-align: center;
            padding: 0;
            color: grey;
            line-height: 40px;
            height: auto;
            cursor: pointer;
            &:hover {
              color: var(--el-color-primary);
            }
          }
          .active {
            color: var(--el-color-primary);
          }
        }
        .comment {
          padding-bottom: 1px;
          padding-top: 10px;
          padding-left: 60px;
        }
      }
    }
  }
  .right-box {
    border-radius: 6px;
    width: 282px;
    min-height: 300px;
    .circle-info {
      background: #fff;
      margin-bottom: 10px;
      width: 100%;
      border-radius: 6px;
      .board-info {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        width: 100%;
        position: relative;
        overflow: hidden;
        padding: 15px 20px;
        box-sizing: border-box;
        .el-image {
          font-size: 86px;
          width: 86px;
          height: 86px;
          border-radius: 18px;
          overflow: hidden;
          display: flex;
          position: relative;
          align-items: center;
          justify-content: center;
          object-fit: cover;
          margin: 10px 30px 15px;
          img {
            height: 100%;
            width: 100%;
          }
        }
        .circle-name {
          width: 100%;
          text-align: center;
          font-size: 18px;
          font-weight: 700;
          z-index: 1;
          padding: 0 20px;
        }
        .circle-introduction {
          font-size: 15px;
          margin: 10px 0;
          color: rgba(0,0,0,.45);
        }
        .el-button {
          display: block;
          margin: 10px auto 0;
          width: 120px;
          height: 40px;
          border-radius: 20px;
          font-size: 16px;
          color: #fff;
          text-align: center;
          border: none;
          text-shadow: unset;
          box-shadow: unset;
        }
      }
      .count-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        div {
          padding-top: 3px;
          text-align: center;
          width: 45%;
          font-size: 24px;
          color: rgba(0,0,0,.8);
          line-height: 20px;
          span {
            margin-top: 7px;
            font-size: 14px;
            color: rgba(0,0,0,.5);
            display: block;
          }
        }
      }
    }
  }
}
</style>
<style lang="scss">
.send-content {
  textarea {
    padding: 10px;
  }
}
</style>
