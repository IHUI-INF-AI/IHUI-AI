<template>
  <div class="content-container" v-loading="listLoading">
    <div class="msg-list">
      <el-empty v-if="!(list && list.length)"/>
      <div v-else class="msg-item" v-for="item in list" :key="item.id">
        <a class="msg-item-avatar" target="_blank">
          <el-icon class="msg-item-avatar-item"><Bell /></el-icon>
        </a>
        <div class="msg-item-content">
          <div class="msg-item-header">
            <span class="msg-item-nickname">
              <a target="_blank">系统通知</a>
            </span>
          </div>
          <div class="msg-item-body">
            <div v-html="item.topic.content"></div>
          </div>
          <div class="msg-item-footer">
            <div class="btn-wrap">
              <span class="time">{{item.createTime}}</span>
            </div>
          </div>
        </div>
      </div>
      <div style="margin: 20px 10px 0;">
        <page :total="total" :page-size="params.size" :current-change="currentChange" :size-change="sizeChange"></page>
      </div>
    </div>
  </div>
</template>

<script>
import {ref} from "vue"
import {getNoticeList} from "@/api/edu/web/message";
import Page from "@/components/Page";
import { Bell } from '@/lib/lucide-fallback';

export default {
  name: "memberNotice",
  components: {Page, Bell},
  setup() {
    const params = ref({
      current: 1,
      size: 20,
      keyword: "",
      type: "system"
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
    const currentChange = (p) => {
      params.value.current = p;
      loadList();
    }
    const sizeChange = (s) => {
      params.value.size = s;
      loadList();
    }
    return {
      listLoading,
      list,
      total,
      params,
      currentChange,
      sizeChange
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
      &:last-child {
        box-shadow: none;
      }
      .msg-item-avatar {
        flex: 0 0 auto;
        width: 20px;
        height: 20px;
        margin-right: 16px;
        position: relative;
        display: block;
        .msg-item-avatar-item {
          width: 100%;
          height: 100%;
          border: 1px solid #f0f0f0;
          border-radius: 50%;
          position: absolute;
          font-size: 20px;
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
