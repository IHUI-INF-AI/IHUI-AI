<template>
  <div class="app-container">
    <div class="header">
      <form @submit.prevent class="demo-form-inline">
        <div class="mb-4">
          <Input size="small" class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字"></Input>
          <Button size="sm" className="search-btn" variant="default" @click="search">搜索</Button>
        </div>
        <div class="mb-4 status">
          <label class="mb-1 block text-sm font-medium text-foreground">状态</label>
          <div>
            <Select size="small" v-model="searchParam.status" @change="search">
              <SelectOption label="全部" value=""></SelectOption>
              <SelectOption label="草稿" value="draft"></SelectOption>
              <SelectOption label="已发布" value="published"></SelectOption>
            </Select>
          </div>
        </div>
        <div class="mb-4">
          <Button size="sm" variant="default" @click="edit()">
            <Plus />
            新增
          </Button>
        </div>
      </form>
    </div>
    <div class="content" v-loading="dataLoading">
      <div class="content-list">
        <Empty v-if="!list || !list.length"/>
        <div class="content-item" v-for="item in list" :key="item.id + ''">
          <div class="content-item-warp">
            <a class="image">
              <img :src="item.image">
            </a>
            <div class="article-card-bone">
              <div class="title-wrap">
                <a class="title">{{item.title}}</a>
                <span class="label create-time">{{item.createTime}}</span>
              </div>
              <div class="abstruct">
                <div class="status" :class="item.status">{{statusMap[item.status]}}</div>
                <div class="divider" v-if="item.top"></div>
                <div class="status" style="background: #07c160;color: #fff;" v-if="item.top">已置顶</div>
                <div class="divider" v-if="item.recommend"></div>
                <div class="status" style="background: green;color: #fff;" v-if="item.recommend">已推荐</div>
                <div class="divider"></div>
                <div class="icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" tabindex="0">
                    <g fill="none" fill-rule="evenodd">
                      <path fill="#666" fill-rule="nonzero" d="M10.218 12.852H8.977l-.401-1.226H6.635l-.393 1.226H5L6.957 7.5H8.3l1.917 5.352zm-1.91-2.106L7.704 8.89a2.072 2.072 0 01-.086-.464h-.031a2.253 2.253 0 01-.095.456l-.613 1.87h1.43v-.007zm2.146 2.106V7.508H12.3c1.901 0 2.852.872 2.852 2.609 0 .825-.267 1.493-.801 1.988-.535.503-1.218.755-2.06.755h-1.838v-.008zm1.14-4.417v3.482h.62c.542 0 .967-.165 1.273-.488.307-.322.464-.762.464-1.312 0-.534-.165-.943-.487-1.242-.323-.298-.74-.448-1.258-.448h-.613v.008z"></path>
                      <path stroke="#FFF" stroke-width="2.5" d="M16.667 3.333L3.333 16.667"></path>
                      <path stroke="#666" stroke-width="1.5" d="M16.667 3.333L3.333 16.667"></path>
                      <path stroke="#666" stroke-linejoin="round" stroke-width="1.5" d="M4.333 3.333h11.334a1 1 0 011 1v11.334a1 1 0 01-1 1H4.333a1 1 0 01-1-1V4.333a1 1 0 011-1z"></path>
                    </g>
                  </svg>
                </div>
              </div>
              <div class="count-wrapper">
                <ul class="count">
                  <li>阅读 {{item.watchNum || 0}}</li>
                  <li>点赞 {{item.likeNum || 0}}</li>
                  <li>收藏 {{item.favoriteNum || 0}}</li>
                  <li>评论 {{item.commentNum || 0}}</li>
                </ul>
                <div class="article-action-list">
                  <span class="icon-label" @click="top(item)">{{item.top ? "取消置顶" : "置顶"}}</span>
                  <span class="icon-label" @click="recommend(item)">{{item.recommend ? "取消推荐" : "推荐"}}</span>
                  <span class="icon-label" @click="commentView(item)">查看评论</span>
                  <span class="icon-label" @click="edit(item.id)">修改</span>
                  <span class="icon-label" @click="remove(item)">删除</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <comment-drawer :topic="selectTopic" :show-drawer="drawer" topic-type="news" :drawer-close="drawerClose"/>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
  </div>
</template>

<script>
// @ts-nocheck
  import {ref} from "vue"
  import router from "@/router"
  import { contentApi } from '@/api/edu/admin-api'
const { deleteNews, findList, saveNewsTop, deleteNewsTop, saveNewsRecommend, deleteNewsRecommend } = contentApi
  import Page from "@/components/Page/index.vue"
  import {confirm, success} from "@/util/tipsUtils";
  import CommentDrawer from "@/views/edu/admin/comment/commentDrawer.vue";
  import {Plus} from '@/lib/lucide-fallback';
  import Button from '@/components/ui/Button.vue'
  import { Input } from '@/components/ui/input'
  import { Select, SelectOption } from '@/components/ui/select'
  import { Empty } from '@/components/ui/empty'

  export default {
    name: "NewsContentIndex",
    components: {
      CommentDrawer,
      Page,
      Plus,
      Button,
      Input,
      Select,
      SelectOption,
      Empty,
    },
  setup() {
    const statusMap = {
      "draft": "草稿",
      "published": "已发布",
      "deleted": "已删除"
    }
    const list = ref([])
    const total = ref(0)
    const dataLoading = ref(true)
    const searchParam = ref({
      keyword: "",
      status: "",
      size: 20,
      current: 1
    })
    // 加载列表
    const loadList = () => {
      dataLoading.value = true
      findList(searchParam.value, (res) => {
        dataLoading.value = false
        if (!res) {return;}
        list.value = res.list;
        total.value = res.total;
      })
    }
    loadList();
    // 搜索
    const search = () => {
      loadList();
    }
    // 编辑
    const edit = (id) => {
      router.push({path: "/admin/edu/news/edit", query: { id : id }})
    }
    // 编辑
    const remove = (item) => {
      confirm("确认删除新闻 " + item.title + " 吗？", "提示", () => {
        deleteNews(item.id, () => {
          success("删除成功")
          loadList()
        })
      }, () => {
      })
    }
    const currentChange = (currentPage) => {
      searchParam.value.current = currentPage;
      loadList();
    }
    const sizeChange = (s) => {
      searchParam.value.size = s;
      loadList();
    }
    const selectTopic = ref({})
    const drawer = ref(false)
    const drawerClose = (done) => {
      drawer.value = false
      done()
    }
    const commentView = (item) => {
      drawer.value = true
      selectTopic.value = item
    }
    const top = (item) => {
      if (item.top) {
        deleteNewsTop(item.id, () => {
          success("取消置顶成功")
          loadList()
        })
      } else {
        saveNewsTop(item.id, () => {
          success("置顶成功")
          loadList()
        })
      }
    }
    const recommend = (item) => {
      if (item.recommend) {
        deleteNewsRecommend(item.id, () => {
          success("取消推荐成功")
          loadList()
        })
      } else {
        saveNewsRecommend(item.id, () => {
          success("推荐成功")
          loadList()
        })
      }
    }
    return {
      list,
      total,
      searchParam,
      search,
      edit,
      currentChange,
      sizeChange,
      remove,
      commentView,
      selectTopic,
      drawer,
      drawerClose,
      statusMap,
      dataLoading,
      top,
      recommend
    };
  }
};
</script>

<style scoped lang="scss">
  .app-container {
    margin: 20px;
    .content-list {
      margin: 0;
      padding: 0;
      border: 0;
      font: inherit;
      vertical-align: baseline;
      .content-item {
        padding: 24px 12px;
        line-height: 1;
        font-size: 14px;
        color: #666;
        border-bottom: 1px solid #e8e8e8;
        position: relative;
        background: #ffffff;
        &:last-child {
          border-bottom: 0;
        }
        .content-item-warp {
          position: relative;
          display: flex;
          .image {
            width: 168px;
            min-width: 168px;
            height: 108px;
            margin-right: 24px;
            position: relative;
            overflow: hidden;
            border-radius: 4px;
            border: 1px solid #e8e8e8;
            cursor: default;
            img {
              width: 100%;
              height: 100%;
              transition: all .5s ease-out .1s;
              -o-object-fit: cover;
              object-fit: cover;
              -o-object-position: center;
              object-position: center;
              &:hover {
                transform: matrix(1.04,0,0,1.04,0,0);
                -webkit-backface-visibility: hidden;
                backface-visibility: hidden;
              }
            }
          }
          .article-card-bone {
            width: 100%;
            display: flex;
            flex-direction: column;
            min-width: 0;
            .title-wrap {
              display: flex;
              justify-content: space-between;
              margin-top: 0;
              .title {
                font-size: 16px;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                line-height: 24px;
                font-weight: 600;
                display: block;
                color: #222;
                cursor: text;
              }
              .create-time {
                color: #999;
                line-height: 24px;
                margin-left: 12px;
                flex-shrink: 0;
              }
            }
            .abstruct {
              line-height: 20px;
              margin-top: 20px;
              height: 20px;
              display: flex;
              align-items: flex-end;
              .status {
                color: #999;
                border: none;
                background-color: #f5f5f5;
                padding: 0 8px;
                line-height: 20px;
                font-size: 12px;
                border-radius: 2px;
                white-space: nowrap;
                display: inline-block;
                box-sizing: border-box;
                transition: all .3s;
                margin-right: 8px;
              }
              .published {
                background-color: #000000;
                color: #FFFFFF;
              }
              .deleted {
                background-color: #ff5000;
                color: #FFFFFF;
              }
              .article-card .byte-tag-simple {
                margin-right: 8px;
              }
              .divider {
                width: 1px;
                height: 12px;
                margin: 4px 10px 4px 4px;
                background: #bfbfbf;
              }
              .icon {
                margin-right: 8px;
                svg {
                  vertical-align: bottom;
                  &:focus {
                    outline: none;
                  }
                }
              }
            }
            .count-wrapper {
              margin-top: 24px;
              display: flex;
              justify-content: space-between;
              .count {
                line-height: 20px;
                position: relative;
                li {
                  display: inline-block;
                  margin-right: 24px;
                  &:after {
                    content: "\ff65";
                    font-size: 20px;
                    margin: 0 8px;
                    line-height: 0;
                    position: absolute;
                    top: 10px;
                    color: #666;
                  }
                  &:last-child:after {
                    content: ""
                  }
                }
              }
              .article-action-list {
                display: flex;
                line-height: 20px;
                flex: 1 0 auto;
                justify-content: flex-end;
                .icon-label {
                  cursor: pointer;
                  font-size: 14px;
                  line-height: 20px;
                  display: flex;
                  color: #222;
                  font-weight: 400;
                  margin-left: 24px;
                  &:first-child {
                    margin-left: 0;
                  }
                  &:hover {
                    color: hsl(var(--primary));
                  }
                }
              }
            }
          }
        }
      }
    }
    .search-input {
      width: 242px;
    }
  }
</style>
