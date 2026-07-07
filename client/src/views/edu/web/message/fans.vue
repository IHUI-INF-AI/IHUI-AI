<template>
  <div class="content-container" v-loading="listLoading">
    <div class="msg-list">
      <el-empty v-if="!(list && list.length)"/>
      <template v-else v-for="item in list" :key="item.id">
        <div class="msg-item" v-if="item.member">
          <a class="msg-item-avatar" target="_blank">
            <img :src="item.member.avatar || ''" class="msg-item-avatar-item" v-if="item.member.avatar"/>
          </a>
          <div class="msg-item-content">
            <div class="msg-item-header">
              <span class="msg-item-nickname">
                <a target="_blank">{{item.member.name || ''}}</a>
              </span>
              <span class="msg-item-action">关注了我</span>
            </div>
            <div class="msg-item-footer">
              <div class="btn-wrap">
                <span class="time">{{item.createTime}}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import {ref} from "vue"
import {getNoticeList} from "@/api/edu/web/message";

export default {
    name: "noticeFans",
    setup() {
      const params = ref({
        current: 1,
        size: 2,
        keyword: "",
        type: "fans"
      })
      const list = ref([])
      const total = ref(0)
      const listLoading = ref(true)
      const loadList = function() {
        listLoading.value = true
        getNoticeList(params.value, res => {
          list.value = res.list;
          total.value = res.total;
          listLoading.value = false
        }).catch(() => {
          listLoading.value = false
        })
      }
      loadList()
      return {
        listLoading,
        list,
        total,
      }
    }
  }
</script>

<style lang="scss" scoped>
.content-container {
  .msg-list {
    .msg-item {
      display: flex;
      align-items: stretch;
      padding: 24px 0;
      font-size: 14px;
      line-height: 20px;
      box-shadow: inset 0 -1px 0 #f0f0f0;
      min-width: 0;
      flex: 1 0 calc(100% - 24px);
      margin: 0 12px;
      transition: all .3s;
      &:last-child {
        box-shadow: none;
      }
      .msg-item-avatar {
        flex: 0 0 auto;
        width: 40px;
        height: 40px;
        margin-right: 16px;
        position: relative;
        display: block;
        .msg-item-avatar-item {
          width: 100%;
          height: 100%;
          border: 1px solid #f0f0f0;
          border-radius: 50%;
          position: absolute;
          font-size: 40px;
        }
      }
      .msg-item-content {
        flex: 1 1 0;
        min-width: 0;
        .msg-item-header {
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          white-space: nowrap;
          .msg-item-nickname {
            text-overflow: ellipsis;
            overflow-x: hidden;
            flex-shrink: 1;
            margin-right: 8px;
          }
          .msg-item-action {
            flex-shrink: 0;
            color: #666;
            margin-right: 8px;
          }
        }
        .msg-item-body {
          font-size: 16px;
          line-height: 24px;
          margin-bottom: 12px;
          word-break: break-all;
          .msg-item-body {
            font-size: 16px;
            line-height: 24px;
            margin-bottom: 12px;
            word-break: break-all;
          }
          .msg-item-source {
            background: #fafafa;
            margin: 12px 0;
            .msg-related-work-ref-text {
              margin-bottom: 4px;
              color: #666;
              font-size: 12px;
            }
          }
          .msg-related-work {
            border-radius: 6px;
            display: flex;
            align-items: stretch;
            color: #222;
            font-size: 14px;
            line-height: 20px;
            flex: 1;
            min-width: 0;
            .small-cover {
              position: relative;
              overflow: hidden;
              border-radius: 6px;
              border: 1px solid #f0f0f0;
              flex-shrink: 0;
              cursor: pointer;
              width: 48px;
              height: 48px;
              margin-right: -2px;
              .small-cover-filter{
                position: absolute;
                width: 100%;
                height: 100%;
                left: 0;
                filter: blur(12px);
                background-position: 50%;
                background-size: cover;
              }
              .small-cover-img {
                -o-object-fit: contain;
                object-fit: contain;
                position: relative;
                left: 50%;
                transform: translateX(-50%);
                z-index: 1;
                width: auto;
                transition: all .5s ease-out .1s;
                height: 100%;
              }
              .small-cover-play {
                position: absolute;
                left: 50%;
                top: 50%;
                height: 20px;
                width: 20px;
                transform: translate(-50%,-50%);
                background: rgba(0,0,0,.6);
                border-radius: 50%;
                color: #fff;
                font-size: 7px;
                display: flex;
                justify-content: center;
                align-items: center;
                pointer-events: none;
                z-index: 99;
              }
            }
            .msg-related-work-content {
              display: flex;
              flex-direction: column;
              justify-content: space-around;
              white-space: nowrap;
              min-width: 0;
              padding: 14px 16px;
              flex: 1;
              >p {
                overflow-x: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                .msg-related-work-tag-text {
                  color: #666;
                }
              }
            }
          }
        }
        .msg-item-footer {
          margin-top: 12px;
          .btn-wrap {
            display: flex;
            white-space: nowrap;
            .time {
              overflow-x: hidden;
              text-overflow: ellipsis;
              min-width: 0;
              margin-right: 16px;
              color: #666;
              flex: 1 0 0;
            }
          }
        }
      }
    }
  }
}
</style>
