<template>
  <div class="live-detail" v-loading="channelLoading">
    <el-breadcrumb style="margin: 20px 0 0;" :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/edu/live' }">直播</el-breadcrumb-item>
      <el-breadcrumb-item>详情</el-breadcrumb-item>
    </el-breadcrumb>
    <div class="live-detail-header">
      <div class="image-box">
        <img v-if="channel.image" :src="channel.image" alt="">
      </div>
      <div class="title-box">
        <h3>{{channel.name}}</h3>
        <div class="title-footer">
          <div class="price">免费</div>
          <div class="learn-num">{{channel.learnNum || 0}}人在线</div>
          <div class="learn-num">{{channel.subscribeNum || 0}}人订单</div>
        </div>
      </div>
      <div class="header-right-box">
        <div class="behavior">
          <el-button link @click="subscribe" :loading="learnLoading">
            <el-icon><CollectionTag /></el-icon> 订阅
          </el-button>
          <el-button link class="action" :class="{'active': channel.like && channel.like.status}" @click="channelLike(channel)">
            <el-icon><Pointer /></el-icon> 点赞 {{channel.likeNum || 0}}
          </el-button>
          <el-button link class="action" @click="channelFavorite(channel)" :class="{'active': channel.favorite && channel.favorite.id}">
            <el-icon><Star /></el-icon> 收藏 {{channel.favoriteNum || 0}}
          </el-button>
        </div>
        <div class="learn-btn">
          <div class="btn">
            <el-button type="primary" @click="learn" :loading="learnLoading">观看直播</el-button>
          </div>
        </div>
      </div>
    </div>
    <div class="live-detail-footer">
      <div class="left-box">
        <el-menu
          :default-active="tabIndex"
          class="el-menu-demo"
          mode="horizontal"
          :ellipsis="false"
          @select="handleSelect">
          <el-menu-item index="1">概述</el-menu-item>
          <!--          <el-menu-item index="2">章节</el-menu-item>-->
          <el-menu-item index="3">评论 {{channel.commentNum || 0}}</el-menu-item>
        </el-menu>
        <div v-if="tabIndex === '1'" class="desc">
          <div v-html="channel.introduction"></div>
        </div>
        <div v-else-if="tabIndex === '2'" class="chapter">
          章节
        </div>
        <div v-else class="comment">
          <comment-list :topic-id="channel.id" topic-type="channel"/>
        </div>
      </div>
      <div class="right-box">
        <div class="board-info" v-if="channel.lecturer">
          <el-image :src="channel.lecturer.image">
            <template #error>
              <div class="image-slot">
                <el-icon><Picture /></el-icon>
              </div>
            </template>
          </el-image>
          <div class="circle-name">{{channel.lecturer.userName}}</div>
          <div class="circle-introduction">{{channel.lecturer.description}}</div>
        </div>
        <div class="recommend">
          <p class="recommend-title">推荐直播</p>
          <ul class="recommend-ul">
            <router-link v-for="item in recommendList" :key="item.id" :to="{path: '/edu/live/detail', query: {id: item.id}}">
              <li>
                <div class="item-cover">
                  <img :src="item.image" alt="">
                </div>
                <div class="title-wrap">
                  <div class="intro" :title="item.name">
                    {{item.name}}
                  </div>
                  <div class="title-footer">
                    <div class="price">免费</div>
                    <div class="learn-num">{{channel.learnNum || 0}}人在线</div>
                  </div>
                </div>
              </li>
            </router-link>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {ref, watch, inject, markRaw} from "vue"
import { ArrowRight } from '@/lib/lucide-fallback'
import { getChannel, liveList, subscribeChannel } from "@/api/edu/web/live"
import { useRoute } from "vue-router"
import {like} from "@/api/edu/web/comment/like";
import {favorite} from "@/api/edu/web/comment/favorite";
import {getCommentList} from "@/api/edu/web/comment";
import CommentList from "@/views/edu/web/comment/list";
import router from "@/router";
import {success} from "@/util/tipsUtils";
import {getToken} from "@/util/tokenUtils";
export default {
  name: "LiveDetail",
  components: {CommentList},
  setup() {
    const ArrowRightIcon = markRaw(ArrowRight)
    const route = useRoute()
    watch(() => route.query.id, () => {
      window.location.reload();
    })
    let liveId = route.query.id
    let tabIndex = ref("1")
    const handleSelect = num => {
      tabIndex.value = num
    }
    // 推荐直播
    const recommendList = ref([])
    const getInactiveArr = () => {
      liveList({
        current: 1,
        size: 6,
        status: "inactive"
      }, res => {
        res.list.forEach(item => {
          if(item.id !== Number(liveId) && !recommendList.value.find((v) => {
                return v.id === item.id
              })
          ) {
            recommendList.value.push(item)
          }
        })
      })
    }
    getInactiveArr()
    // 加载直播
    const channel = ref({})
    const channelLoading = ref(true)
    const loadChannel = () => {
      channelLoading.value = true
      getChannel({id: liveId}, data => {
        channel.value = data
        channelLoading.value = false
        // 获取评论数量
        getCommentList({topicId: data.id, topicType: 'channel', size: 1}, r => {
          if (r && r.total !== undefined) {
            channel.value.commentNum = r.total
          }
        })
      })
    }
    loadChannel()
    const showLogin = inject("showLogin")
    const channelLike = function() {
      if (!getToken()) {
        showLogin.value = true
        return
      }
      like(channel.value, "channel")
    }
    const channelFavorite = function() {
      if (!getToken()) {
        showLogin.value = true
        return
      }
      favorite(channel.value, "channel")
    }
    const learnLoading = ref(false)
    const learn = () => {
      // 如未报名，先报名，如未购买先购买
      if (!getToken()) {
        showLogin.value = true
        return
      }
      router.push({path: "/edu/live/play", query: {id: liveId}})
    }
    const subscribe = () => {
      subscribeChannel({channelId: channel.value.id}, () => {
        success("订阅成功")
        loadChannel()
      })
    }
    return {
      ArrowRight: ArrowRightIcon,
      tabIndex,
      handleSelect,
      recommendList,
      channelLike,
      channelFavorite,
      channel,
      learnLoading,
      learn,
      channelLoading,
      subscribe
    }
  }
}
</script>

<style scoped lang="scss">
.live-detail {
  margin: 20px 10px;
  .live-detail-header {
    background: #fff;
    padding: 20px 0;
    border-radius: 6px;
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
    min-height: 80px;
    .image-box {
      width: 270px;
      height: 148px;
      margin-right: 20px;
      background: #fafafa;
      img {
        border-radius: 5px;
        width: 100%;
        height: 100%;
      }
    }
    .title-box {
      flex: 1;
      position: relative;
      h3 {
        font-size: 18px;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
        line-height: 40px;
      }
      .title-footer {
        position: absolute;
        bottom: 0;
        left: 0;
        .price {
          margin-top: 10px;
          color: #19be6b;
          display: inline-block;
          &:after {
            margin-left: 16px;
            content: "·";
            color: #999999;
          }
        }
        .time {
          color: #999999;
          display: inline-block;
          margin-left: 10px;
        }
        .learn-num {
          margin-left: 10px;
          display: inline-block;
          color: #999999;
          &:not(:last-child) {
            &:after {
              margin-left: 16px;
              content: "·";
              color: #999999;
            }
          }
        }
      }
    }
    .header-right-box {
      position: relative;
      width: 282px;
      margin-left: 20px;
      text-align: right;
      .behavior {
        :deep(.el-button--text) {
          color: rgba(0,0,0,.6);
        }
        .el-button {
          margin-left: 20px;
          &:hover {
            color: var(--el-color-primary);
          }
        }
        .el-button.active {
          color: var(--el-color-primary);
        }
      }
      .learn-btn {
        position: absolute;
        bottom: 0;
        right: 0;
        display: inline-flex;
        div {
          float: left;
        }
        .learn-num {
          margin-right: 10px;
          line-height: 40px;
        }
        .el-button {
          width: 150px;
        }
      }
    }
  }
  .live-detail-footer {
    display: flex;
    .left-box {
      float: left;
      width: calc(100% - 302px);
      padding: 5px 0 20px;
      background-color: #fff;
      margin-right: 20px;
      box-sizing: border-box;
      .desc {
        margin-top: 20px;
        line-height: 30px;
        :deep(img) {
          width: 100%;
          height: 100%;
        }
      }
      .chapter {
        margin-top: 20px;
      }
      .comment {
        margin-top: 20px;
      }
    }
    .right-box {
      width: 282px;
      float: right;
      box-sizing: border-box;
      .board-info {
        background: #fff;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        width: 100%;
        position: relative;
        overflow: hidden;
        padding: 15px 20px;
        box-sizing: border-box;
        margin-bottom: 20px;
        border-radius: 6px;
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
      .recommend {
        .recommend-title {
          color: rgb(85, 85, 85);
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 20px;
        }
        .recommend-ul {
          li {
            margin-bottom: 20px;
            cursor: pointer;
            .item-cover {
              display: block;
              width: 100%;
              height: 180px;
              border-radius: 6px;
              img {
                height: 100%;
                width: 100%;
                border-radius: 6px;
              }
            }
            .title-wrap {
              .intro {
                color: #555;
                font-size: 14px;
                margin-top: 5px;
                cursor: pointer;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 28px;
                display: -webkit-box;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 2;
                &:hover {
                  color: var(--el-color-primary);
                }
              }
              .title-footer {
                .price {
                  color: #19be6b;
                  display: inline-block;
                  line-height: 28px;
                  &:after {
                    margin-left: 16px;
                    content: "·";
                    color: #999999;
                  }
                }
                .time {
                  color: #999999;
                  display: inline-block;
                  margin-left: 10px;
                  line-height: 28px;
                }
                .learn-num {
                  margin-left: 10px;
                  display: inline-block;
                  color: #999999;
                  line-height: 28px;
                }
              }
            }
            &:hover {
              .title-wrap {
                .intro {
                  color: var(--el-color-primary);
                }
              }
            }
          }
        }
      }
    }
  }
}
</style>
