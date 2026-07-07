<template>
  <div class="news-wrapper">
    <el-breadcrumb style="margin: 0 0 20px 10px;" :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/edu/news' }">资讯</el-breadcrumb-item>
    </el-breadcrumb>
    <div class="banner-box" v-if="recommendList && recommendList.length || recommendRightList && recommendRightList.length">
      <el-row :gutter="20">
        <el-col :span="18">
          <el-row :gutter="16">
            <el-col :span="16">
              <banner v-if="carousel.carouselList && carousel.carouselList.length" :carousel="carousel" :height="340" v-loading="topDataLoading" class="slider"/>
            </el-col>
            <el-col :span="8">
              <div class="small-slider" v-loading="recommendDataLoading" :class="{'not-data': !(recommendList && recommendList.length)}">
                <div class="small-slider-item u-shadowed" v-for="item in recommendList" :key="item.id">
                  <router-link target="_blank" :to="{path: '/edu/news/detail', query: {id: item.id}}" :title="item.title">
                    <img :src="item.image" :alt="item.title" class="small-slider-img">
                    <i class="mask"></i>
                    <div class="title">{{item.title}}</div>
                  </router-link>
                </div>
              </div>
            </el-col>
          </el-row>
        </el-col>
        <el-col :span="6">
          <div class="small-slider" v-loading="recommendDataLoading" :class="{'not-data': !(recommendRightList && recommendRightList.length)}">
            <div class="small-slider-item u-shadowed" v-for="item in recommendRightList" :key="item.id">
              <router-link target="_blank" :to="{path: '/edu/news/detail', query: {id: item.id}}" :title="item.title">
                <img :src="item.image" :alt="item.title" class="small-slider-img">
                <i class="mask"></i>
                <div class="title">{{item.title}}</div>
              </router-link>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>
    <div class="main-content">
      <el-row :gutter="20">
        <el-col :span="18">
          <div class="home-list-box">
            <div class="tabs" :style="!(list && list.length) ? 'margin-bottom: 0;' : ''">
              <span class="is-active">最新资讯</span>
            </div>
            <div class="news-list" v-loading="dataLoading">
              <el-empty v-if="!(list && list.length)" style="background: #ffffff;"/>
              <div class="item" v-for="(item, index) in list" :key="index + ''">
                <div class="post-img">
                  <span class="post-cat" v-if="item.tags && item.tags.length">
                    {{item.tags.split(",")[0]}}
                  </span>
                  <router-link target="_blank" :to="{path: '/edu/news/detail', query: {id: item.id}}" :title="item.title">
                    <img :src="item.image" :alt="item.title">
                  </router-link>
                </div>
                <div class="content">
                  <h2 itemprop="headline" class="post-title">
                    <router-link target="_blank" :to="{path: '/edu/news/detail', query: {id: item.id}}" :title="item.title">
                      {{item.title}}
                    </router-link>
                  </h2>
                  <div itemprop="about" class="des">
                    {{item.description}}
                  </div>
                  <div class="stream-list-meta">
                    <div class="u-flex0">
                      <a target="_blank" class="u-flex">
                      </a>
                    </div>
                    <div class="u-flex1">
                      <div data-id="1554" class="author  u-flex">
                        <a target="_blank" class="ui-captionStrong"></a>
                      </div>
                      <div class="meta--sup">
                        <time itemprop="datePublished">{{item.createTime}}</time>
                        <div class="meta--sup__right">
                          <div class="behavior">点赞 {{item.likeNum || 0}}</div>
                          <div class="behavior">评论 {{item.commentNum || 0}}</div>
                          <div class="behavior">收藏 {{item.favoriteNum || 0}}</div>
                          <div class="behavior">浏览 {{item.viewNum || item.watchNum || 0}}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="list && list.length" style="margin: 20px 0;">
            <page :total="total" :page-size="params.size" :current-change="currentChange" :size-change="sizeChange"></page>
          </div>
        </el-col>
        <el-col :span="6">
          <hot-news/>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script>
  import {ref, markRaw} from "vue"
  import {ArrowRight} from '@/lib/lucide-fallback'
  import Banner from "../module/banner.vue";
  import Page from "@/components/Page/index";
  import {findList, findTopList, findRecommendList} from "@/api/edu/web/content/news";
  import HotNews from "./hotNews.vue";

  export default {
    name: "NewsIndex",
    components: {HotNews, Page, Banner},
    setup() {
      const ArrowRightIcon = markRaw(ArrowRight)
      const params = ref({
        status: "published",
        size: 20,
        current: 1
      })
      const dataLoading = ref(true)
      const total = ref(0)
      const list = ref([])
      // 加载列表
      const loadList = () => {
        dataLoading.value = true
        findList(params.value, (res) => {
          dataLoading.value = false
          if (!res) {return;}
          list.value = res.list;
          total.value = res.total;
        }).catch(() => {
          dataLoading.value = false
        })
      }
      loadList();
      const currentChange = (currentPage) => {
        params.value.current = currentPage;
        loadList();
      }
      const sizeChange = (s) => {
        params.value.size = s;
        loadList();
      }
      const carousel = ref({})
      const topDataLoading = ref(true)
      findTopList({size: 5, current: 1}, res => {
        topDataLoading.value = false;
        if (!res) {return;}
        const topList = []
        for (const listElement of res.list) {
          topList.push({title: listElement.title, link: "/news/detail?id=" + listElement.id, imageUrl: listElement.image, linkType: 1})
        }
        carousel.value = {
          interval: 8,
          carouselList: topList
        }
      }).catch(() => {
        topDataLoading.value = false
      })
      const recommendList = ref([])
      const recommendRightList = ref([])
      const recommendDataLoading = ref(true)
      findRecommendList({size: 4, current: 1}, res => {
        recommendDataLoading.value = false;
        if (!res) {return;}
        let split = 2;
        if (res.list.length < split) {
          split = res.list.length
        }
        recommendList.value = res.list.slice(0, split);
        if (res.list.length > 2) {
          split = res.list.length
          recommendRightList.value = res.list.slice(2, split);
        }
      }).catch(() => {
        recommendDataLoading.value = false
      })
      return {
        ArrowRight: ArrowRightIcon,
        total,
        list,
        currentChange,
        sizeChange,
        dataLoading,
        carousel,
        topDataLoading,
        recommendList,
        recommendRightList,
        recommendDataLoading,
        params
      }
    }
  }
</script>
<style lang="scss">
  .banner-box {
    .banner {
      img {
        height: 100%;
      }
    }
  }
</style>
<style scoped lang="scss">
.news-wrapper {
  padding-top: 20px;
  padding-left: 20px; // 整体内容向右移动
  padding-right: 20px;
  max-width: 1400px;
  margin: 0 auto;
}
.banner-box {
  // margin: 0 10px; // 移除这里的 margin，由 wrapper 统一控制

  :deep(.slider) {
    background: #ffffff;
    a {
      width: 100%;
    }
  }
  .small-slider {
    .small-slider-item {
      margin-bottom: 20px;
      position: relative;
      overflow: hidden;
      border-radius: 10px;
      a {
        display: flex;
        position: relative;
        &:active, &:hover {
          outline: 0;
          img {
            transform: scale(1.1);
          }
        }
        img {
          transition: .5s;
          max-width: 100%;
          width: 100%;
          height: 160px;
        }
        .mask {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(180deg,rgba(0,0,0,.05) 5%,rgba(0,0,0,.65));
          transition: .5s;
        }
        .title {
          position: absolute;
          bottom: 10px;
          color: #fff;
          line-height: 1.4;
          left: 10px;
          right: 10px;
        }
      }
    }
    .u-shadowed {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
  }
  .not-data {
    background: #ffffff;
    min-height: 300px;
    border-radius: 6px;
  }
}
.main-content {
  padding-top: 20px;
  // margin: 0 10px; // 移除 margin
  .home-list-box {
    .tabs {
      background-color: #fff;
      height: 50px;
      line-height: 50px;
      font-size: 16px;
      display: flex;
      margin-bottom: 10px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      border-radius: 6px;
      padding-left: 16px; // 增加内部间距，不让文字贴边
      span {
        position: relative;
        //margin: 0 15px;
        height: 50px;
        box-sizing: border-box;
        cursor: pointer;
        overflow: hidden;
      }
      span.is-active:before {
        background-color: var(--el-color-primary);
        content: "";
        height: 3px;
        left: 0;
        position: absolute;
        bottom: 0;
        right: 0;
      }
    }
    .news-list {
      .item {
        display: flex;
        margin-bottom: 15px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        border-radius: 6px;
        background-color: #fff;
        padding-left: 16px; // 增加卡片内部左侧间距
        .post-img {
          width: 236px;
          height: 143px;
          flex: 0 0 auto;
          padding: 15px 15px 15px 0;
          position: relative;
          .post-cat {
            position: absolute;
            top: 20px;
            left: 12px;
            z-index: 10;
            padding: 4px 12px;
            font-size: 12px;
            font-weight: 500;
            color: #ffffff;
            line-height: 1;
            background-color: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.8);
            border-radius: 4px;
            backdrop-filter: blur(4px);
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
            pointer-events: none;
          }
          a {
            display: block;
            overflow: hidden;
            border: 1px solid #f0f0f0;
            border-radius: 6px;
            img {
              transition: .5s;
              display: block;
              max-width: 100%;
              width: 236px;
              height: 143px;
            }
          }
        }
        .content {
          flex: 1 1 auto;
          padding: 15px 15px 15px 0;
          display: flex;
          flex-direction: column;
          h2 {
            display: block;
            font-size: 1.5em;
            margin-block-start: 0.83em;
            margin-block-end: 0.83em;
            margin-inline-start: 0px;
            margin-inline-end: 0px;
            font-weight: bold;
          }
          .post-title {
            font-size: 20px;
            line-height: 1.4;
            margin: 0 0 5px;
            transition: .5s;
            a {
              color: rgba(0,0,0);
              &:hover {
                color: var(--el-color-primary);
              }
            }
          }
          .des {
            font-size: 14px;
            color: rgba(0,0,0,.6);
            text-align: justify;
            margin: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
          .stream-list-meta {
            margin-top: auto;
            display: flex;
            font-size: 12px;
            color: rgba(0,0,0,.5);
            align-items: center;
            line-height: 1.6;
          }
          .u-flex0 {
            flex: 0 0 auto;
            .u-flex {
              display: flex;
              align-items: center;
            }
            img {
              max-width: 100%;
              height: auto;
              border-radius: 100%;
              margin-right: 12px;
            }
          }
          .u-flex1 {
            flex: 1 1 auto;
            .u-flex {
              display: flex;
              align-items: center;
            }
            .ui-captionStrong {
              color: rgba(0,0,0,.84);
            }
            .meta--sup {
              display: flex;
            }
            .meta--sup__right {
              margin-left: auto;
              display: flex;
              .behavior {
                margin-left: 10px;
              }
            }
          }
        }
      }
    }
  }
}
</style>
