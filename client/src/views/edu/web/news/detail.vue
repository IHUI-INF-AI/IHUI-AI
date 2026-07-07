<template>
  <div class="news-detail">
    <el-breadcrumb style="margin: 20px 0;" :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/edu/news' }">资讯</el-breadcrumb-item>
      <el-breadcrumb-item>详情</el-breadcrumb-item>
    </el-breadcrumb>
    <el-row :gutter="20">
      <el-col :span="18">
        <div class="article--wrapper" v-loading="dataLoading">
          <h2 class="article--title">{{news.title}}</h2>
          <div class="stream-list-meta">
            <div class="u-flex0">
            </div>
            <div class="u-flex1">
              <div class="meta--sup">
                <time>{{news.createTime}}</time>
                <div class="meta--sup__right">
                  {{news.watchNum || 0}} 浏览
                  <span class="dot"></span>
                  {{news.favoriteNum || 0}} 收藏
                  <span class="dot"></span>
                  {{news.likeNum || 0}} 点赞
                  <span class="dot"></span>
                  {{news.commentNum || 0}} 评论
                </div>
              </div>
            </div>
          </div>
          <div class="article--content fwb-warp">
            <div class="blockquote">
              <p>{{news.description}}</p>
            </div>
            <div class="fwb-warp-content" v-html="news.content"></div>
          </div>
          <div class="article--actions">
            <div class="taglist" v-if="news.tags">
              <a rel="tag" v-for="tag in news.tags.split(',')" :key="tag">{{tag}}</a>
            </div>
            <div class="article--actions__right">
              <el-button class="button button--toggle" @click="newsFavorite" :class="{'active': news.favorite && news.favorite.id}">
                <span class="active" v-if="news.favorite && news.favorite.id">已收藏</span>
                <span class="default" v-else>收藏</span>
                <span style="margin-left: 5px;">{{news.favoriteNum || 0}}</span>
              </el-button>
              <el-button class="button button--toggle" @click="newsLike" :class="{'active': news.like && news.like.status}">
                <span class="active" v-if="news.like && news.like.status">已赞</span>
                <span class="default" v-else>点赞</span>
                <span style="margin-left: 5px;"> {{news.likeNum || 0}}</span>
              </el-button>
            </div>
          </div>
        </div>
        <div class="comment">
          <div class="title-item">评论</div>
          <comment-list v-if="news.id" topic-type="news" :topic-id="news.id"/>
        </div>
      </el-col>
      <el-col :span="6">
        <hot-news/>
      </el-col>
    </el-row>
  </div>
</template>

<script>
  import {inject, ref, markRaw} from "vue"
  import {ArrowRight} from '@/lib/lucide-fallback'
  import {useRoute} from "vue-router";
  import {getNews} from "@/api/edu/web/content/news";
  import {like} from "@/api/edu/web/comment/like";
  import {favorite} from "@/api/edu/web/comment/favorite";
  import {getCommentList} from "@/api/edu/web/comment";
  import HotNews from "./hotNews.vue";
  import CommentList from "../comment/list.vue";
  import {getToken} from "@/util/tokenUtils";

  export default {
    name: "NewsDetail",
    components: {CommentList, HotNews},
    setup() {
      const ArrowRightIcon = markRaw(ArrowRight)
      const route = useRoute()
      const id = route.query.id
      const dataLoading = ref(true)
      const news = ref({})
      getNews(id, (res) => {
        news.value = res
        dataLoading.value = false
        // 获取评论数量
        getCommentList({topicId: res.id, topicType: 'news', size: 1}, r => {
          if (r && r.total !== undefined) {
            news.value.commentNum = r.total
          }
        })
      }).catch(() => {
        dataLoading.value = false
      })
      const showLogin = inject("showLogin")
      const newsLike = function() {
        if (!getToken()) {
          showLogin.value = true
          return
        }
        like(news.value, "news")
      }
      const newsFavorite = function() {
        if (!getToken()) {
          showLogin.value = true
          return
        }
        favorite(news.value, "news")
      }
      return {
        ArrowRight: ArrowRightIcon,
        dataLoading,
        news,
        newsLike,
        newsFavorite
      };
    }
  }
</script>

<style scoped lang="scss">
  .news-detail {
    padding: 0 0 20px 0;
    margin: 0 10px;
    .article--wrapper {
      padding: 25px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      border-radius: 6px;
      background-color: #fff;
      .article--title {
        font-size: 24px;
        font-weight: 700;
        line-height: 1.2;
        margin: 0;
      }
      .stream-list-meta {
        margin-top: 16px;
        display: flex;
        font-size: 12px;
        color: rgba(0,0,0,.5);
        align-items: center;
        line-height: 1.6;
        img {
          max-width: 100%;
          height: auto;
        }
        .u-flex0 {
          flex: 0 0 auto;
        }
        .u-flex1 {
          flex: 1 1 auto;
          .ui-captionStrong {
            color: rgba(0,0,0,.84);
          }
        }
        .u-flex {
          display: flex;
          align-items: center;
        }
        .avatar {
          border-radius: 100%;
          margin-right: 12px;
          width: 36px;
          height: 36px;
        }
        .meta--sup {
          display: flex;
          .meta--sup__right {
            margin-left: auto;
            display: flex;
          }
          .dot:before {
            content: "·";
            margin-left: .5em;
            margin-right: .5em;
          }
        }
      }
      .fwb-warp {
        word-break: break-all;
        .blockquote {
          background-repeat: no-repeat;
          background-position: left 30px top 20px;
          background-color: #f8f8f8;
          color: rgba(0,0,0,.68);
          margin: 30px 0;
          padding: 30px 30px 20px;
          p {
            margin: 0 0 10px;
          }
        }
      }
      .fwb-warp-content {
        :deep(img) {
          max-width: 100%;
          height: auto;
        }
      }
      .article--actions {
        display: flex;
        align-items: center;
        padding-top: 30px;
        .taglist {
          display: flex;
          padding: 15px 0;
          a {
            background-color: #fafafa;
            font-size: 12px;
            padding: 4px;
            border-radius: 999rem;
            padding-right: 16px;
            display: flex;
            align-items: center;
            line-height: 1.4;
            margin-right: 15px;
            color: #333;
            &:before {
              content: "#";
              color: #e62828;
              border-radius: 100%;
              background-color: #fff;
              width: 20px;
              height: 20px;
              line-height: 20px;
              text-align: center;
              margin-right: 6px;
              font-weight: 700;
            }
          }
        }
        .article--actions__right {
          margin-left: auto;
          display: flex;
          align-items: center;
          .button.active {
            color: var(--el-color-primary);
            border: 1px solid var(--el-color-primary);
          }
          .button {
            margin-left: 10px;
            border: 1px solid #666666;
            background-color: #fff;
            color: #666666;
            border-radius: 999rem;
            padding: 2px 14px;
            transition: .5s;
            &:hover {
              border: 1px solid var(--el-color-primary);
              background-color: var(--el-color-primary);
              color: #FFFFFF;
            }
          }
        }
      }
    }
    .comment {
      margin-top: 30px;
      background: #ffffff;
      padding: 20px;
      .title-item {
        padding: 10px 0;
        font-size: 18px;
        font-weight: 700;
      }
    }
  }
</style>
