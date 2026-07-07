<template>
  <div>
    <div class="main-content">
      <el-breadcrumb style="margin: 0 0 20px 0;" :separator-icon="ArrowRight">
        <el-breadcrumb-item :to="{ path: '/edu/article' }">文章</el-breadcrumb-item>
      </el-breadcrumb>
      <el-row :gutter="10">
        <el-col :span="4">
          <div class="menu-box">
            <router-link :to="{path: '/edu/article'}">
              <div class="menu-item" :class="{'active': cid === 0}">最新文章</div>
            </router-link>
            <router-link :to="{path: '/edu/article', query: {cid: item.id}}" :key="item.id" v-for="item in categoryList" v-loading="categoryLoading">
              <div class="menu-item" :class="{'active': cid === item.id}">
                {{item.name}}
              </div>
            </router-link>
          </div>
        </el-col>
        <el-col :span="14">
          <div class="home-list-box">
            <div class="news-list" v-loading="dataLoading">
              <el-empty v-if="!(list && list.length)" style="background: #ffffff;"/>
              <router-link target="_blank" :to="{path: '/edu/article/detail', query: {id: item.id}}" v-for="(item, index) in list" :key="index + ''">
                <div class="item">
                  <div class="post-img" v-if="item.image">
                    <span class="post-cat" v-if="item.tags && item.tags.length">
                      {{item.tags.split(",")[0]}}
                    </span>
                    <img :src="item.image" :alt="item.title">
                  </div>
                  <div class="content">
                    <h2 itemprop="headline" class="post-title">
                      {{item.title}}
                    </h2>
                    <div itemprop="about" class="des">
                      <span v-html="item.content"></span>
                    </div>
                    <div class="stream-list-meta">
                      <div class="u-flex0">
                        <a target="_blank" class="u-flex" v-if="item.member && item.member.avatar">
                          <img :src="item.member.avatar || ''" alt="" height="36" width="36" class="avatar">
                        </a>
                      </div>
                      <div class="u-flex1">
                        <div data-id="1554" class="author  u-flex">
                          <a target="_blank" class="ui-captionStrong" v-if="item.member">{{item.member.name || ''}}</a>
                        </div>
                        <div class="meta--sup">
                          <time itemprop="datePublished">{{item.createTime}}</time>
                          <div class="meta--sup__right">
                            {{item.watchNum || 0}} 浏览
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </router-link>
            </div>
          </div>
          <div v-if="list && list.length" style="margin: 20px 0;">
            <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="params.size"></page>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="nav-box">
            <a class="item" @click="createArticle">
              <svg width="40" height="40" viewBox="0 0 40 40" class="icon" fill="currentColor"><g fill="none" fill-rule="evenodd"><circle cx="20" cy="20" r="20" fill="#F4C807" opacity=".12"></circle><path d="M6 6h28v28H6z"></path><path fill="#F4C807" d="M20.406 11.772l-2.172 2.176h-2.29c-1.438 0-1.875.085-2.322.324-.33.176-.575.422-.751.752-.24.448-.324.886-.324 2.326v7.12c0 1.44.085 1.878.324 2.326.176.33.421.576.75.752.421.225.834.314 2.08.323l7.35.001c1.438 0 1.876-.084 2.323-.324.33-.176.575-.422.751-.752.24-.448.324-.886.324-2.326v-4.905l2.172-2.175v7.08c0 1.94-.202 2.643-.58 3.352a3.95 3.95 0 01-1.643 1.645c-.708.379-1.41.58-3.346.58h-7.108c-1.936 0-2.639-.201-3.347-.58a3.95 3.95 0 01-1.642-1.645c-.378-.71-.58-1.413-.58-3.352v-7.12c0-1.94.202-2.643.58-3.352a3.95 3.95 0 011.642-1.645c.708-.379 1.41-.58 3.347-.58h4.462zm6.908-2.053c.384.116.747.338 1.168.759l.188.189c.42.421.642.785.758 1.17a1.98 1.98 0 010 1.163c-.116.385-.337.749-.758 1.17l-6.9 6.911c-.62.622-.827.81-1.078 1.004-.251.193-.496.34-.784.47-.288.131-.553.226-1.392.48l-1.088.332a1.303 1.303 0 01-1.625-1.629l.33-1.09c.255-.84.35-1.104.48-1.393.13-.29.277-.534.47-.785.193-.252.381-.46 1.001-1.081l6.9-6.911c.42-.421.784-.643 1.168-.76a1.97 1.97 0 011.162 0zm-3.204 4.096l-4.797 4.805c-.547.548-.709.723-.852.91-.112.146-.19.276-.265.443-.097.214-.175.44-.4 1.182l-.094.31.31-.095c.74-.225.965-.303 1.179-.4.167-.076.297-.154.442-.266.187-.143.361-.305.909-.853l4.797-4.805-1.23-1.23zm2.546-2.43c-.109.033-.23.11-.443.324l-.874.875 1.228 1.231.875-.876c.213-.213.29-.334.323-.444a.24.24 0 000-.153c-.033-.11-.11-.23-.323-.445l-.189-.188c-.213-.214-.334-.291-.443-.325a.238.238 0 00-.154 0z" fill-rule="nonzero"></path></g></svg>
              <div class="title">发布文章</div>
            </a>
            <a class="item" href="/member/article">
              <svg width="40" height="40" viewBox="0 0 40 40" class="icon" fill="currentColor"><g fill="#06F" fill-rule="evenodd"><circle cx="20" cy="20" r="20" opacity=".12"></circle><path d="M23.487 10.463c1.896 0 2.583.193 3.277.555a3.824 3.824 0 011.607 1.573c.371.678.569 1.35.569 3.206v8.472c0 1.855-.198 2.527-.569 3.205a3.824 3.824 0 01-1.607 1.573c-.694.363-1.381.556-3.277.556h-6.96c-1.895 0-2.583-.193-3.276-.556a3.824 3.824 0 01-1.608-1.573c-.37-.678-.568-1.35-.568-3.205v-8.472c0-1.855.197-2.528.568-3.206.37-.678.915-1.21 1.608-1.573.693-.362 1.38-.556 3.277-.556h6.959zm0 2.08h-6.96c-1.407 0-1.836.081-2.273.31a1.72 1.72 0 00-.735.72c-.234.427-.317.847-.317 2.224v8.472c0 1.377.083 1.796.317 2.224.172.316.412.551.735.72.437.229.866.31 2.274.31h6.959c1.407 0 1.836-.081 2.274-.31a1.72 1.72 0 00.735-.72c.234-.428.317-.847.317-2.224v-8.472c0-1.377-.083-1.797-.317-2.225a1.72 1.72 0 00-.735-.72c-.438-.228-.867-.309-2.274-.309zm-1.991 9.778v1.873h-5.955V22.32h5.955zm2.977-3.328v1.872h-8.932v-1.872h8.932zm0-3.33v1.873h-8.932v-1.872h8.932z" fill-rule="nonzero"></path></g></svg>
              <div class="title">我的文章</div>
            </a>
          </div>
          <hot-article/>
        </el-col>
      </el-row>
    </div>
    <article-edit v-if="dialogVisible" v-model="dialogVisible" :cancel-callback="cancelArticle" :submit-callback="submitArticle"/>
  </div>
</template>

<script>
import {inject, ref, watch, markRaw} from "vue"
  import Page from "@/components/Page/index";
  import {findList, findRecommendList} from "@/api/edu/web/content/article";
  import HotArticle from "./hotArticle.vue";
  import {findCategoryList} from "@/api/edu/web/content/category";
  import {useRoute} from "vue-router";
  import {getToken} from "@/util/tokenUtils";
  import ArticleEdit from "@/views/edu/web/article/edit";
  import {ArrowRight} from '@/lib/lucide-fallback';

  export default {
    name: "ArticleIndex",
    components: {ArticleEdit, HotArticle, Page},
    setup() {
      const ArrowRightIcon = markRaw(ArrowRight);
      const params = ref({
        size: 20,
        current: 1,
        cid: 0
      })
      // 加载目录
      const cid = ref(0)
      const route = useRoute();
      if (route.query.cid) {
        cid.value = parseInt(route.query.cid)
        params.value.cid = parseInt(route.query.cid);
      }
      const categoryList = ref([])
      const categoryLoading = ref(true)
      findCategoryList(0, false, res => {
        categoryList.value.push(...res);
        categoryLoading.value = false
      })
      const dataLoading = ref(true)
      const total = ref(0)
      const list = ref([])
      // 加载列表
      const loadList = () => {
        dataLoading.value = true
        // 构建请求参数，cid 为 0 时不传该参数（表示查询全部）
        const requestParams = { ...params.value }
        if (requestParams.cid === 0 || !requestParams.cid) {
          delete requestParams.cid
        }
        findList(requestParams, (res) => {
          dataLoading.value = false
          if (!res) {return;}
          list.value = res.list;
          total.value = res.total;
        }).catch(() => {
          dataLoading.value = false
        })
      }
      loadList();
      watch(() => route.query.cid, (nv) => {
        if (!nv) {
          cid.value = 0
        } else {
          cid.value = parseInt(nv);
        }
        params.value.current = 1;
        params.value.cid = cid.value;
        loadList();
      })
      const currentChange = (currentPage) => {
        params.value.current = currentPage;
        loadList();
      }
      const sizeChange = (s) => {
        params.value.size = s;
        loadList();
      }
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
      // 发布文章
      const dialogVisible = ref(false)
      const showLoginFlag = inject("showLogin")
      const createArticle = () => {
        if (!getToken()) {
          showLoginFlag.value = true
          return;
        }
        dialogVisible.value = true
      }
      // 发布
      const submitArticle = () => {
        dialogVisible.value = false
        params.value.current = 1
        loadList();
      }
      const cancelArticle = () => {
        dialogVisible.value = false
      }
      return {
        total,
        list,
        currentChange,
        sizeChange,
        dataLoading,
        recommendList,
        recommendRightList,
        recommendDataLoading,
        categoryLoading,
        categoryList,
        cid,
        createArticle,
        dialogVisible,
        submitArticle,
        cancelArticle,
        params,
        ArrowRight: ArrowRightIcon
      }
    }
  }
</script>
<style scoped lang="scss">
.main-content {
  padding-top: 20px;
  padding-left: 20px; // 整体内容向右移动，解决贴边问题
  padding-right: 20px;
  margin: 0 auto;
  max-width: 1400px; // 限制最大宽度，避免超大屏下两边太散
  
  .menu-box {
    background: #ffffff;
    width: 100%;
    margin-bottom: 16px;
    border: 1px solid #f0f0f0;
    border-radius: 6px;
    overflow: hidden;
    
    .menu-item {
      padding: 14px 16px;
      text-align: center;
      font-size: 14px;
      cursor: pointer;
      color: #333333;
      border-bottom: 1px solid #f0f0f0;
      transition: all 0.2s ease;
      
      &:last-child {
        border-bottom: none;
      }
      
      &:hover {
        background: #f8f8f8;
        color: var(--el-color-primary);
      }
    }
    
    .active {
      background: rgba(0, 0, 0, 0.04);
      color: #1a1a1a;
      font-weight: 500;
      position: relative;
      
      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 60%;
        background: #1a1a1a;
        border-radius: 0 2px 2px 0;
      }
    }
  }
  
  .home-list-box {
    border-top: none;
    
    .news-list {
      padding: 0 16px; // 增加左右内边距，解决内容贴边问题

      .item {
        display: flex;
        margin-bottom: 12px;
        border: 1px solid #f0f0f0;
        border-radius: 6px;
        background-color: #ffffff;
        transition: all 0.2s ease;
        overflow: hidden;
        margin-left: 4px; // 微调，使其不紧贴左侧边缘
        
        &:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          border-color: transparent;
          
          .content h2 {
            color: var(--el-color-primary);
          }
          
          .post-img img {
            transform: scale(1.05);
          }
        }
        
        .post-img {
          width: 236px;
          height: 143px;
          flex: 0 0 auto;
          padding: 16px 0 16px 16px;
          position: relative;
          overflow: hidden;
          
          .post-cat {
            position: absolute;
            top: 20px;
            left: 20px;
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
            border-radius: 6px;
          }
          
          img {
            transition: transform 0.3s ease;
            display: block;
            max-width: 100%;
            width: 236px;
            height: 143px;
            border-radius: 6px;
            object-fit: cover;
          }
        }
        
        .content {
          flex: 1 1 auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          width: calc(100% - 286px);
          
          h2 {
            display: block;
            font-size: 1.5em;
            margin-block-start: 0.5em;
            margin-block-end: 0.5em;
            margin-inline-start: 0px;
            margin-inline-end: 0px;
            font-weight: 600;
          }
          
          .post-title {
            font-size: 18px;
            line-height: 1.4;
            margin: 0 0 8px;
            transition: color 0.2s ease;
            color: #333333;
            font-family: 'HarmonyOS Sans SC';
          }
          
          .des {
            font-size: 14px;
            color: #666666;
            text-align: justify;
            margin: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            line-height: 1.6;
          }
          
          .stream-list-meta {
            margin-top: auto;
            display: flex;
            font-size: 12px;
            color: #999999;
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
              border-radius: 50%;
              margin-right: 12px;
              width: 32px;
              height: 32px;
              border: 2px solid #ffffff;
              box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
            }
          }
          
          .u-flex1 {
            flex: 1 1 auto;
            
            .u-flex {
              display: flex;
              align-items: center;
            }
            
            .ui-captionStrong {
              color: #333333;
              font-weight: 500;
            }
            
            .meta--sup {
              display: flex;
              color: #999999;
            }
            
            .meta--sup__right {
              margin-left: auto;
              display: flex;
            }
          }
        }
      }
    }
  }
  
  .nav-box {
    position: relative;
    padding: 20px 16px;
    border: 1px solid #f0f0f0;
    margin-bottom: 12px;
    background: #ffffff;
    border-radius: 6px;
    display: flex;
    gap: 16px;
    
    .item {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      flex: 1;
      padding: 12px;
      border-radius: 6px;
      transition: all 0.2s ease;
      
      &:hover {
        background: #f8f8f8;
        
        .title {
          color: var(--el-color-primary);
        }
      }
      
      .icon {
        margin: 0 auto 12px;
        color: #8590a6;
      }
      
      .title {
        font-size: 13px;
        line-height: 1;
        text-align: center;
        color: #333333;
        transition: color 0.2s ease;
      }
    }
  }
}
</style>
