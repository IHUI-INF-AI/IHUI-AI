<template>
  <div class="sidebar" v-if="hotList && hotList.length">
    <div class="widget">
      <div class="inner">
        <div class="widget-title">
          <span>热点资讯</span>
        </div>
        <ul class="widget-post-list--withImage" v-loading="dataLoading">
          <li class="widget-post-item--withImage" :class="{'u-block': index === 0}" v-for="(item, index) in hotList" :key="index + ''">
            <div class="img" :class="{'img__large': index === 0, 'hot-img-default': index !== 0}">
              <router-link target="_blank" :to="{path: '/edu/news/detail', query: {id: item.id}}">
                <img v-if="item.image" :src="item.image">
                <img v-else style="height: auto;width: 20px;"/>
              </router-link>
            </div>
            <div class="content">
              <div class="title">
                <router-link target="_blank" :to="{path: '/edu/news/detail', query: {id: item.id}}">
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
  import {findRecommendList} from "@/api/edu/web/content/news";

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
    margin-bottom: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    background-color: #fff;

    .inner {
      padding: 15px;
      .widget-title {
        // border-bottom: 3px solid #eee;
        align-items: center;
        font-size: 18px;
        display: flex;
        line-height: 1;
        span {
          border-bottom: 3px solid #4370f5;
          padding-bottom: 8px;
          transform: translate3d(0,3px,0);
        }
      }
      .widget-post-list--withImage {
        counter-reset: c;
        list-style: none;
        padding: 10px 0 0;
        margin: 0;
        min-height: 200px;
        .widget-post-item--withImage {
          list-style: none;
          display: flex;
          counter-increment: c;
          padding: 5px 0;
          .img {
            flex: 0 0 auto;
            margin-right: 10px;
            position: relative;
            overflow: hidden;
            border-radius: 3px;
            &:before {
              content: counter(c);
              position: absolute;
              top: 0;
              left: 0;
              color: #fff;
              font-size: 12px;
              background-color: #ff5c00;
              line-height: 1;
              padding: 2px 6px;
              border-radius: 0 0 3px 0;
              z-index: 6;
            }
            a {
              display: block;
              img {
                max-width: 100%;
                height: auto;
                border-radius: 3px;
                display: block;
                transition: .5s;
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
                height: 60px;
                width: 100px;
              }
            }
          }
          .content {
            flex: 1 1 auto;
            display: flex;
            justify-content: space-between;
            flex-direction: column;
            .title {
              line-height: 1.3;
              font-size: 14px;
              font-weight: 700;
              transition: .5s;
              a {
                color: #000000;
                &:hover {
                  color: var(--el-color-primary);
                }
              }
            }
            .meta {
              font-size: 12px;
              color: rgba(0,0,0,.65);
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
