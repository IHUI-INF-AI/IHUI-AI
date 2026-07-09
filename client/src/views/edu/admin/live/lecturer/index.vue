<template>
  <div class="app-container">
    <div class="header">
      <form @submit.prevent class="demo-form-inline">
        <div class="mb-4">
          <Input size="small" class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字"></Input>
          <Button size="sm" className="search-btn" variant="default" @click="search">搜索</Button>
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
                <a class="title">{{item.userName}}</a>
                <span class="label create-time">{{item.createTime}}</span>
              </div>
              <div class="abstruct">
                <div class="status" v-if="item.status">{{statusMap[item.status]}}</div>
                <div class="divider" v-if="item.status && item.jobTitle"></div>
                <div class="status" style="background: #07c160;color: #fff;" v-if="item.jobTitle">{{item.jobTitle}}</div>
                <div class="divider" v-if="item.mobile"></div>
                <div class="status" style="background: green;color: #fff;" v-if="item.mobile">{{item.mobile}}</div>
              </div>
              <div class="count-wrapper">
                <ul class="count">
                  <li>直播 {{item.lessonNum || 0}}</li>
                </ul>
                <div class="article-action-list">
                  <span class="icon-label" @click="edit(item.id)">修改</span>
                  <span class="icon-label" @click="remove(item)">删除</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
  </div>
</template>

<script>
// @ts-nocheck
  import {ref} from "vue"
  import router from "@/router"
  import { lecturerApi } from '@/api/edu/admin-api'
const { deleteLecturer, findList } = lecturerApi
  import Page from "@/components/Page/index.vue"
  import {confirm, success} from "@/util/tipsUtils";
  import {Plus} from '@/lib/lucide-fallback';
  import Button from '@/components/ui/Button.vue'
  import { Input } from '@/components/ui/input'
  import { Empty } from '@/components/ui/empty'

  export default {
    name: "LecturerIndex",
    components: {
      Page,
      Plus,
      Button,
      Input,
      Empty,
    },
  setup() {
    const statusMap = {
      "published": "已发布",
      "delete": "已删除"
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
      router.push({path: "/admin/edu/live/lecturer/edit", query: { id : id }})
    }
    // 编辑
    const remove = (item) => {
      confirm("确认删除讲师 " + item.name + " 吗？", "提示", () => {
        deleteLecturer(item.id, () => {
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
    return {
      list,
      total,
      searchParam,
      search,
      edit,
      currentChange,
      sizeChange,
      remove,
      statusMap,
      dataLoading,
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
            width: 108px;
            min-width: 108px;
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
