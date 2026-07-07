<template>
  <div class="resource-section">
    <div class="module-mod-container">
      <div class="module-header">
        <div class="head">
          <h2 class="head-title">
            <div class="title">
              <span class="title-icon">
                <svg-icon name="resource"/>
              </span>
              <router-link :to="{path: 'resource'}">知识库</router-link>
            </div>
          </h2>
        </div>
      </div>
      
      <div class="resource-grid-layout" v-loading="listLoading">
        <el-empty v-if="!itemList || !itemList.length" class="empty-state"/>
        <div v-else class="resource-list">
          <div v-for="item in itemList" :key="item.id" class="resource-card" @click="gotoDetail(item)">
            <div class="image-wrap" v-if="item.image">
              <el-image :src="item.image" fit="cover"></el-image>
            </div>
            <div class="box-content">
              <div class="title">{{item.title}}</div>
              <div class="desc">{{escapeHTML(item.introduction)}}</div>
              <div class="meta-row">
                <span class="time">{{item.createTime}}</span>
                <div class="author" v-if="item.member">
                  <img :src="item.member.avatar || ''" alt="" class="avatar" v-if="item.member.avatar">
                  <span>{{item.member.name || ''}}</span>
                </div>
              </div>
              <div class="stats">
                <span>{{item.downloadNum || 0}} 下载</span>
                <span>收藏 {{item.favoriteNum || 0}}</span>
                <span>点赞 {{item.likeNum || 0}}</span>
                <span>评论 {{item.commentNum || 0}}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {ref} from "vue"
import {getResourceRecommendList} from "@/api/edu/web/resource"
// import {getToken} from "@/util/tokenUtils"  // 暂时注释，直接使用 public-api
import SvgIcon from "@/components/edu/SvgIcon.vue";
import router from "@/router";
export default {
  name: "ResourceIndex",
  components: {
    SvgIcon
  },
  setup() {
    const itemList = ref([])
    const param = ref({
      cid: 0,
      current: 1,
      size: 10,
      type: ""
    })
    const total = ref(0)
    const listLoading = ref(true)
    const load = function() {
      listLoading.value = true
      
      // 直接使用 public-api（避免 auth-api 401 问题）
      getResourceRecommendList({ size: param.value.size, current: param.value.current }, res => {
        itemList.value = (res && res.list) || []
        total.value = (res && res.total) != null ? res.total : 0
        listLoading.value = false
      }).catch(err => {
        console.error('[知识库] public-api 失败:', err)
        listLoading.value = false
      })
    }
    load()
    
    const gotoDetail = (item) => {
      router.push({path: "/edu/resource/detail", query: {id: item.id}})
    }
    
    const escapeHTML = function(untrusted) {
      if (!untrusted) return '';
      return untrusted
          .replace(/<img.*?>/gi, '')
          .replace(/<video.*?>/gi, '')
          .replace(/<.*?>/g, '');
    }
    
    return {
      itemList,
      param,
      total,
      listLoading,
      gotoDetail,
      escapeHTML
    }
  }
}
</script>

<style lang="scss" scoped>
.resource-section {
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
  
  .resource-grid-layout {
    padding: 20px;
    min-height: 180px;
    
    .empty-state {
      padding: 40px 0;
    }
  }
  
  .resource-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    width: 100%;
    box-sizing: border-box;
    
    @media (max-width: 992px) {
      grid-template-columns: 1fr;
    }
  }
  
  .resource-card {
    display: flex;
    gap: 15px;
    padding: 15px;
    background-color: #fff;
    border: 1px solid $border-color;
    border-radius: $border-radius;
    cursor: pointer;
    transition: all 0.2s;
    box-sizing: border-box;
    overflow: hidden;
    
    &:hover {
      background-color: $bg-hover;
      border-color: $primary-color;
      
      .title {
        color: $primary-color;
      }
    }
    
    .image-wrap {
      width: 120px;
      height: 80px;
      flex-shrink: 0;
      border-radius: 4px;
      overflow: hidden;
      background-color: #f5f5f5;
      
      .el-image {
        width: 100%;
        height: 100%;
      }
    }
    
    .box-content {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      
      .title {
        font-size: 15px;
        font-weight: 600;
        color: $text-primary;
        line-height: 1.4;
        margin-bottom: 6px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .desc {
        font-size: 12px;
        color: $text-secondary;
        line-height: 1.5;
        margin-bottom: 8px;
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      
      .meta-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
        
        .time {
          font-size: 12px;
          color: $text-placeholder;
        }
        
        .author {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: $text-secondary;
          
          .avatar {
            width: 18px;
            height: 18px;
            border-radius: 50%;
          }
        }
      }
      
      .stats {
        display: flex;
        gap: 12px;
        font-size: 11px;
        color: $text-placeholder;
        padding-top: 6px;
        border-top: 1px solid $bg-page;
      }
    }
  }
}
</style>
