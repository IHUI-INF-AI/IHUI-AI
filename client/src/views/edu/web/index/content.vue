<template>
  <div class="news-section">
    <div class="module-mod-container">
      <div class="module-header">
        <div class="head">
          <h2 class="head-title">
            <div class="title">
              <span class="title-icon">
                <svg-icon name="news"/>
              </span>
              <router-link :to="{path: '/edu/news'}">资讯</router-link>
            </div>
          </h2>
        </div>
      </div>
      
      <div class="news-grid-layout" v-loading="topDataLoading || recommendDataLoading || articleRecommendDataLoading">
        <el-empty v-if="!(recommendList && recommendList.length && newsList && newsList.length)" class="empty-state"/>
        
        <div v-else class="news-flex-container">
          <!-- 左侧：置顶资讯卡片 -->
          <div class="news-left-column">
            <div class="news-card-grid">
              <a target="_blank" class="news-top-item" :class="{'nodata': !item.id}" @click="gotoDetail(item.id)" :title="item.title" v-for="(item, index) in topList" :key="index">
                <div class="img-wrapper">
                  <img :src="item.image" v-if="item.image" class="item-img">
                  <div class="title-overlay" v-if="item.title">
                    <div class="title-text">{{item.title}}</div>
                  </div>
                </div>
              </a>
            </div>
          </div>

          <!-- 中间：推荐资讯列表 -->
          <div class="news-middle-column">
            <div class="recommend-list">
              <router-link class="recommend-item" v-for="(item, index) in recommendList" :key="index" :to="{path: '/edu/news/detail', query: {id: item.id}}" target="_blank">
                <div class="item-header">
                  <span class="news-tag" :class="index < 2 ? 'tag-hot' : 'tag-normal'"></span>
                  <span class="item-title" :title="item.title">{{item.title}}</span>
                </div>
                <div class="item-desc" :title="item.description">{{item.description}}</div>
              </router-link>
            </div>
            <div class="normal-list">
              <router-link class="normal-item" v-for="(item, index) in recommendBottomList" :key="index" :to="{path: '/edu/news/detail', query: {id: item.id}}" target="_blank">
                <span class="dot">•</span>
                <span class="item-title" :title="item.title">{{item.title}}</span>
              </router-link>
            </div>
          </div>

          <!-- 右侧：侧边资讯列表 -->
          <div class="news-right-column">
            <div class="sidebar-list">
              <router-link class="sidebar-item" :to="{path: '/edu/news/detail', query: {id: item.id}}" target="_blank" v-for="(item, index) in newsList" :key="item.id">
                <div class="sidebar-card">
                  <div class="item-img-box">
                    <img :src="item.image" :alt="item.title" class="item-img">
                    <span class="item-rank" :class="'rank-' + (index + 1)">{{index + 1}}</span>
                  </div>
                  <div class="item-info">
                    <div class="item-title" :title="item.title">{{item.title}}</div>
                    <div class="item-meta">
                      <span>浏览：{{item.watchNum || 0}}</span>
                    </div>
                  </div>
                </div>
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
  import {ref} from "vue";
  import {findRecommendList, findTopList, findList} from "@/api/edu/web/content/news";
  import router from "@/router";
  import SvgIcon from "@/components/edu/SvgIcon.vue";

  export default {
    name: "ContentIndex",
    components: {SvgIcon},
    setup() {
      const topList = ref([{image: ""}, {image: ""}, {image: ""}])
      const topDataLoading = ref(true)
      findTopList({size: 4, current: 1}, res => {
        topDataLoading.value = false;
        if (!res) {return;}
        for (let i = 0; i < res.list.length; i++) {
          topList.value[i] = res.list[i];
        }
      }).catch(() => {
        topDataLoading.value = false;
      })
      const recommendList = ref([])
      const recommendBottomList = ref([])
      const recommendDataLoading = ref(true)
      findRecommendList({size: 8, current: 1}, res => {
        recommendDataLoading.value = false;
        if (!res) {return;}
        let split = 3;
        if (res.list.length < split) {
          split = res.list.length
        }
        recommendList.value = res.list.slice(0, split);
        if (res.list.length > 3) {
          split = res.list.length
          recommendBottomList.value = res.list.slice(3, split);
        }
      }).catch(() => {
        recommendDataLoading.value = false;
      })
      const articleRecommendDataLoading = ref(true)
      const newsList = ref([])
      findList({size: 5, current: 1}, res => {
        articleRecommendDataLoading.value = false;
        if (!res) {return;}
        newsList.value = res.list
      }).catch(() => {
        articleRecommendDataLoading.value = false;
      })
      const gotoDetail = (id) => {
        if (!id) {
          return;
        }
        router.push({path: "/edu/news/detail", query: {id: id}})
      }
      return {
        topList,
        topDataLoading,
        recommendList,
        recommendBottomList,
        recommendDataLoading,
        articleRecommendDataLoading,
        newsList,
        gotoDetail
      }
    }
  }
</script>

<style scoped lang="scss">
  .news-section {
    margin-bottom: 24px;
    
    .module-mod-container {
      background: #ffffff;
      border-radius: $border-radius;
      border: 1px solid $border-color;
      overflow: hidden;
      box-shadow: $shadow-sm;
    }
    
    .module-header {
      padding: 0 20px;
      height: 56px;
      display: flex;
      align-items: center;
      border-bottom: 1px solid $border-color;
      
      .head-title {
        font-size: 18px;
        margin: 0;
        .title {
          display: flex;
          align-items: center;
          gap: 8px;
          .title-icon {
            display: flex;
            align-items: center;
            font-size: 20px;
            color: $primary-color;
          }
          a {
            color: $text-primary;
            font-weight: 600;
            &:hover { color: $primary-color; }
          }
        }
      }
    }
    
    .news-grid-layout {
      padding: 20px;
      min-height: 200px;
      
      .empty-state {
        padding: 40px 0;
      }
    }
    
    .news-flex-container {
      display: flex;
      gap: 20px;
      
      @media (max-width: 1024px) {
        flex-direction: column;
      }
    }
    
    .news-left-column {
      flex: 2;
      min-width: 0;
      
      .news-card-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        height: 100%;
      }
      
      .news-top-item {
        position: relative;
        border-radius: $border-radius;
        overflow: hidden;
        aspect-ratio: 16 / 9;
        cursor: pointer;
        
        .img-wrapper {
          width: 100%;
          height: 100%;
          position: relative;
          background-color: #f5f5f5;
          
          .item-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.3s;
          }
          
          .title-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 20px 15px 10px;
            background: linear-gradient(transparent, rgba(0,0,0,0.8));
            
            .title-text {
              color: #fff;
              font-size: 14px;
              font-weight: 500;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }
        }
        
        &:hover .item-img {
          transform: scale(1.05);
        }
      }
    }
    
    .news-middle-column {
      flex: 1.5;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 15px;
      
      .recommend-item {
        display: block;
        padding-bottom: 12px;
        border-bottom: 1px dashed $border-color;
        margin-bottom: 12px;
        
        &:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }
        
        .item-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
          
          .news-tag {
            width: 36px;
            height: 16px;
            flex-shrink: 0;
            background-size: contain;
            background-repeat: no-repeat;
            
            &.tag-hot { background-image: url(@/assets/edu/hot.png); }
            &.tag-normal { background-image: url(@/assets/edu/news.png); }
          }
          
          .item-title {
            font-size: 15px;
            font-weight: 600;
            color: $text-primary;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
        
        .item-desc {
          font-size: 13px;
          color: $text-secondary;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        &:hover .item-title { color: $primary-color; }
      }
      
      .normal-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        
        .normal-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: $text-secondary;
          
          .dot { color: #ccc; }
          .item-title {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          
          &:hover { color: $primary-color; }
        }
      }
    }
    
    .news-right-column {
      flex: 1.5;
      min-width: 0;
      
      .sidebar-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .sidebar-card {
        display: flex;
        gap: 12px;
        
        .item-img-box {
          position: relative;
          width: 100px;
          height: 60px;
          flex-shrink: 0;
          border-radius: 4px;
          overflow: hidden;
          background-color: #f5f5f5;
          
          .item-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          .item-rank {
            position: absolute;
            top: 0;
            left: 0;
            padding: 2px 6px;
            font-size: 10px;
            color: #fff;
            background: rgba(0,0,0,0.5);
            border-bottom-right-radius: 4px;
            
            &.rank-1 { background: #ff5249; }
            &.rank-2 { background: #ff7f29; }
            &.rank-3 { background: #fcc54e; }
          }
        }
        
        .item-info {
          flex: 1;
          min-width: 0;
          
          .item-title {
            font-size: 14px;
            font-weight: 500;
            color: $text-primary;
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            margin-bottom: 4px;
          }
          
          .item-meta {
            font-size: 12px;
            color: $text-placeholder;
          }
        }
        
        &:hover .item-title { color: $primary-color; }
      }
    }
  }
</style>
