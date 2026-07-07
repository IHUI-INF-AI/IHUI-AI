<template>
  <div class="sidebar" v-if="hotList && hotList.length">
    <div class="widget">
      <div class="inner">
        <div class="widget-title">
          <span>热点文章</span>
        </div>
        <ul class="widget-post-list--withImage" v-loading="dataLoading">
          <li class="widget-post-item--withImage" :class="{'u-block': index === 0}" v-for="(item, index) in hotList" :key="index + ''">
            <div class="img" :class="{'img__large': index === 0, 'hot-img-default': index !== 0}">
              <router-link target="_blank" :to="{path: '/edu/article/detail', query: {id: item.id}}">
                <img v-if="item.image" :src="item.image">
                <img v-else style="height: auto;width: 20px;"/>
              </router-link>
            </div>
            <div class="content">
              <div class="title">
                <router-link target="_blank" :to="{path: '/edu/article/detail', query: {id: item.id}}">
                  {{item.title}}
                </router-link>
              </div>
              <div class="meta">{{item.createTime}}</div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
  import {ref} from "vue";
  import {findRecommendList} from "@/api/edu/web/content/article";

  export default {
    name: "hotNews",
    setup() {
      const params = ref({
        size: 20,
        current: 1
      })
      const dataLoading = ref(true)
      const hotList = ref([])
      // 加载列表
      const loadList = () => {
        dataLoading.value = true
        findRecommendList(params.value, (res) => {
          dataLoading.value = false
          if (!res) {return;}
          hotList.value = res.list;
        }).catch(() => {
          dataLoading.value = false
        })
      }
      loadList();
      return {
        hotList,
        dataLoading
      }
    }
  }
</script>

<style scoped lang="scss">
  .sidebar {
    border-radius: 6px;
    margin-bottom: 16px;
    background-color: #ffffff;
    border: 1px solid #f0f0f0;
    overflow: hidden;
    
    .inner {
      padding: 16px;
      
      .widget-title {
        align-items: center;
        font-size: 16px;
        font-weight: 600;
        display: flex;
        line-height: 1;
        color: #333333;
        font-family: 'EDIX', 'HarmonyOS Sans SC';
        padding-bottom: 12px;
        border-bottom: 1px solid #f0f0f0;
        margin-bottom: 12px;
        
        span {
          border-bottom: 2px solid var(--el-color-primary);
          padding-bottom: 10px;
          transform: translate3d(0, 11px, 0);
        }
      }
      
      .widget-post-list--withImage {
        counter-reset: c;
        list-style: none;
        padding: 0;
        margin: 0;
        min-height: 160px;
        
        .widget-post-item--withImage {
          list-style: none;
          display: flex;
          counter-increment: c;
          padding: 10px 0;
          border-bottom: 1px solid #f0f0f0;
          transition: all 0.2s ease;
          
          &:last-child {
            border-bottom: none;
          }
          
          .img {
            flex: 0 0 auto;
            margin-right: 12px;
            position: relative;
            overflow: hidden;
            border-radius: 6px;
            
            &:before {
              content: counter(c);
              position: absolute;
              top: 0;
              left: 0;
              color: #ffffff;
              font-size: 12px;
              font-weight: 500;
              background-color: var(--el-color-primary);
              line-height: 1;
              padding: 4px 8px;
              border-radius: 6px 0 6px 0;
              z-index: 6;
            }
            
            a {
              display: block;
              
              img {
                max-width: 100%;
                height: auto;
                border-radius: 6px;
                display: block;
                transition: transform 0.3s ease;
              }
            }
          }
          
          .img__large {
            width: 100%;
            margin-bottom: 10px;
          }
          
          .hot-img-default {
            a {
              img {
                height: 64px;
                width: 100px;
                object-fit: cover;
              }
            }
          }
          
          .content {
            flex: 1 1 auto;
            display: flex;
            justify-content: space-between;
            flex-direction: column;
            
            .title {
              line-height: 1.4;
              font-size: 14px;
              font-weight: 500;
              transition: color 0.2s ease;
              
              a {
                color: #333333;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
                
                &:hover {
                  color: var(--el-color-primary);
                }
              }
            }
            
            .meta {
              font-size: 12px;
              color: #999999;
              margin-top: 4px;
            }
          }
          
          &:hover {
            .img a img {
              transform: scale(1.05);
            }
            
            .content .title a {
              color: var(--el-color-primary);
            }
          }
        }
        
        .u-block {
          display: block;
        }
      }
    }
  }
</style>
