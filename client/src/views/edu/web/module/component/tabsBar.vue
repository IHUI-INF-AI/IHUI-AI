<template>
  <div class="category-tabs-wrapper">
    <!-- 模块头部 -->
    <div class="module-header">
      <div class="header-left">
        <h2 class="module-title">{{item.name}}</h2>
        <div class="tabs-nav">
          <span 
            v-for="(childItem, index) in item.children" 
            :key="childItem.id"
            :class="['tab-item', { 'active': activeIndex === index }]"
            @click="handleTabClick(index, childItem)"
          >
            {{childItem.name}}
          </span>
        </div>
      </div>
      <router-link :to="{path: '/edu/' + (type || 'learn') + '/list', query: {cid: cid}}" class="more-link">
        更多
      </router-link>
    </div>
    
    <!-- 内容区域 -->
    <div class="module-content">
      <component 
        :is="componentName" 
        :item-list="currentContent" 
        :type="type"
      ></component>
    </div>
  </div>
</template>

<script>
  import {ref, computed} from "vue";
  import rowTabsContent from "./rowTabsContent.vue";
  import twoRowTabsContent from "./bigRowTabsContent.vue";
  export default {
    name: "tabsBar",
    components: {
      rowTabsContent,
      twoRowTabsContent,
    },
    props: {
      componentName: {
        type: String
      },
      item: {
        type: Object,
        required: true
      },
      type: {
        type: String
      }
    },
    setup(props) {
      const activeIndex = ref(0)
      const cid = ref(props.item.id)
      
      const currentContent = computed(() => {
        if (props.item.children && props.item.children[activeIndex.value]) {
          return props.item.children[activeIndex.value].contentList || []
        }
        return []
      })
      
      const handleTabClick = function(index, childItem) {
        activeIndex.value = index
        cid.value = childItem.id
      }
      
      return {
        activeIndex,
        cid,
        currentContent,
        handleTabClick
      }
    }
  }
</script>

<style lang="scss" scoped>
.category-tabs-wrapper {
  width: 100%;
  
  .module-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    height: 56px;
    border-bottom: 1px solid $border-color;
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 20px;
      flex: 1;
      min-width: 0;
      
      .module-title {
        font-size: 18px;
        font-weight: 600;
        color: $text-primary;
        margin: 0;
        flex-shrink: 0;
      }
      
      .tabs-nav {
        display: flex;
        align-items: center;
        gap: 8px;
        overflow-x: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
        
        &::-webkit-scrollbar {
          display: none;
        }
        
        .tab-item {
          padding: 6px 14px;
          font-size: 14px;
          color: $text-secondary;
          cursor: pointer;
          border-radius: 16px;
          white-space: nowrap;
          transition: all 0.2s;
          
          &:hover {
            color: $primary-color;
            background-color: rgba(64,158,255, 0.05);
          }
          
          &.active {
            color: $primary-color;
            font-weight: 500;
            position: relative;
            
            &::after {
              content: '';
              position: absolute;
              bottom: -2px;
              left: 50%;
              transform: translateX(-50%);
              width: 20px;
              height: 2px;
              background-color: $primary-color;
              border-radius: 1px;
            }
          }
        }
      }
    }
    
    .more-link {
      font-size: 14px;
      color: $text-secondary;
      flex-shrink: 0;
      
      &:hover {
        color: $primary-color;
      }
    }
  }
  
  .module-content {
    padding: 20px;
    min-height: 280px;
  }
}
</style>
