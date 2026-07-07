<template>
  <el-empty v-if="!itemList || !itemList.length" description="暂无数据" class="empty-state-inner"></el-empty>
  <div v-for="item in itemList" :key="item.id" class="content-item" @click="gotoDetail(item)">
    <div class="image-wrap" v-if="item.image">
      <el-image :src="item.image" fit="cover"></el-image>
    </div>
    <div class="box-content">
      <div class="title" v-html="item.title"></div>
      <div class="desc" v-html="escapeHTML(item.introduction)"></div>
      <div class="meta-row">
        <div class="meta-left">
          <span class="time">{{item.createTime}}</span>
          <div class="tags" v-if="tagsFormat(item.tags) && tagsFormat(item.tags).length">
            <span class="tag" v-for="t in tagsFormat(item.tags)" :key="t">{{t}}</span>
          </div>
        </div>
        <div class="meta-right">
          <div class="author" v-if="item.member">
            <img :src="item.member.avatar || ''" alt="" class="avatar" v-if="item.member.avatar">
            <span>{{item.member.name || ''}}</span>
          </div>
        </div>
      </div>
      <div class="bottom-row">
        <div class="stats">
          <span>{{item.downloadNum || 0}} 下载</span>
          <span>收藏 {{item.favoriteNum || 0}}</span>
          <span>点赞 {{item.likeNum || 0}}</span>
          <span>评论 {{item.commentNum || 0}}</span>
        </div>
        <div class="actions" v-if="editable">
          <el-button type="primary" link @click.stop="showForm(item)">编辑</el-button>
          <el-button type="danger" link @click.stop="remove(item)">删除</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {ref} from "vue";
import router from "@/router";
import {confirm, success} from "@/util/tipsUtils";
import {deleteResource} from "@/api/edu/web/resource";
export default {
  name: "ResourceItem",
  props: {
    itemList: {
      type: Array
    },
    editable: {
      type: Boolean,
      default: false
    },
    showMember: {
      type: Boolean,
      default: true
    },
    callback: {
      type: Function,
      default: () => {}
    }
  },
  setup(props) {
    const gotoDetail = (item) => {
      router.push({path: "/edu/resource/detail", query: {id: item.id}})
    }
    const editItem = ref();
    const showForm = (item) => {
      editItem.value = item
      router.push({path: "/edu/resource/edit", query: {id: item.id, topath: '/edu/member/resource'}})
    }
    const remove = (item) => {
      confirm("确认删除该条资源吗？", "提示", () => {
        deleteResource({id: item.id}, () => {
          success("删除成功")
          props.callback && props.callback()
        })
      }, () => {
      })
    }
    const escapeHTML = function(untrusted) {
      if (!untrusted) return '';
      return untrusted
          .replace(/<img.*?>/gi, '')
          .replace(/<video.*?>/gi, '')
          .replace(/<.*?>/g, ''); // 移除所有 HTML 标签
    }
    const tagsFormat = function (tags) {
      if (tags && tags.length) {
        return tags.split(",")
      }
      return []
    }
    return {
      gotoDetail,
      showForm,
      remove,
      editItem,
      escapeHTML,
      tagsFormat
    }
  }
}
</script>

<style lang="scss" scoped>
.empty-state-inner {
  background: #fff;
  width: 100%;
  margin: 10px 0;
  border-radius: $border-radius;
}

.content-item {
  background-color: #FFFFFF;
  display: flex;
  gap: 15px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    .title {
      color: $primary-color;
    }
  }

  .image-wrap {
    width: 140px;
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
      margin-bottom: 10px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      
      .meta-left {
        display: flex;
        align-items: center;
        gap: 10px;
        
        .time {
          font-size: 12px;
          color: $text-placeholder;
        }
        
        .tags {
          display: flex;
          gap: 5px;
          .tag {
            font-size: 10px;
            padding: 1px 6px;
            background-color: $bg-hover;
            color: $text-secondary;
            border-radius: 4px;
          }
        }
      }
      
      .meta-right {
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
    }

    .bottom-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 8px;
      border-top: 1px solid $bg-page;
      
      .stats {
        display: flex;
        gap: 12px;
        font-size: 11px;
        color: $text-placeholder;
      }
      
      .actions {
        display: flex;
        gap: 8px;
      }
    }
  }
}
</style>
