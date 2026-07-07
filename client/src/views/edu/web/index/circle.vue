<template>
  <div class="circle-section">
    <div class="module-mod-container">
      <div class="module-header">
        <div class="head">
          <h2 class="head-title">
            <div class="title">
              <span class="title-icon">
                <svg-icon name="circle"/>
              </span>
              <router-link :to="{path: 'circle'}">社区</router-link>
            </div>
          </h2>
        </div>
      </div>
      
      <div class="circle-grid-layout" v-loading="dataLoading">
        <el-empty v-if="!(list && list.length)" class="empty-state"/>
        
        <div v-else class="circle-grid">
          <div class="circle-item" v-for="item in list" :key="item.id">
            <router-link :to="{path: '/edu/circle/detail', query: {id: item.id}}" target="_blank" class="circle-card">
              <div class="avatar-box">
                <img v-if="item.image && !item.imageError" 
                     :src="item.image" 
                     alt="" 
                     class="avatar"
                     @error="item.imageError = true">
                <div v-else class="default-avatar">
                  <svg-icon name="circle" class="mini-icon"/>
                </div>
              </div>
              <div class="info">
                <div class="name" :title="item.name">{{item.name}}</div>
                <div class="stats">
                  <span>{{numFormat(item.dynamicNum || 0)}} 动态</span>
                  <span class="dot">•</span>
                  <span>{{numFormat(item.memberNum || 0)}} 成员</span>
                </div>
              </div>
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {ref} from "vue"
import { getCircleHotList } from "@/api/edu/web/circle"
import SvgIcon from "@/components/edu/SvgIcon.vue";
export default {
  name: "customCircle",
  components: {
    SvgIcon
  },
  setup() {
    const dataLoading = ref(true)
    const list = ref([])
    getCircleHotList({size: 14, current: 1}, res => {
      dataLoading.value = false
      list.value = res.list || []
    }).catch(() => {
      dataLoading.value = false
    })
    const numFormat = (num) => {
      if (num > 10000) {
        return parseFloat(num / 10000).toFixed(1) + "w"
      }
      return num;
    }
    return {
      dataLoading,
      list,
      numFormat
    }
  }
}
</script>

<style scoped lang="scss">
.circle-section {
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
  
  .circle-grid-layout {
    padding: 20px;
    min-height: 150px;
    
    .empty-state {
      padding: 40px 0;
    }
  }
  
  .circle-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 15px;
    
    @media (max-width: 1280px) { grid-template-columns: repeat(6, 1fr); }
    @media (max-width: 1024px) { grid-template-columns: repeat(4, 1fr); }
    @media (max-width: 768px) { grid-template-columns: repeat(3, 1fr); }
    @media (max-width: 480px) { grid-template-columns: repeat(2, 1fr); }
  }
  
  .circle-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 15px 10px;
    border-radius: $border-radius;
    transition: all 0.2s;
    border: 1px solid transparent;
    
    &:hover {
      background-color: $bg-hover;
      border-color: $border-color;
      transform: translateY(-2px);
    }
    
    .avatar-box {
      width: 64px;
      height: 64px;
      margin-bottom: 12px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: $shadow-sm;
      background-color: #f5f5f5;
      
      .avatar {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      .default-avatar {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ccc;
        font-size: 24px;
      }
    }
    
    .info {
      width: 100%;
      
      .name {
        font-size: 14px;
        font-weight: 500;
        color: $text-primary;
        margin-bottom: 6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .stats {
        font-size: 11px;
        color: $text-placeholder;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        
        .dot { color: #eee; }
      }
    }
  }
}
</style>
