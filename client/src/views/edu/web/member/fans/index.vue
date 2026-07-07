<template>
  <div class="content-container">
    <el-row class="row">
      <el-col :span="4">
        <member-menu active="fans"/>
      </el-col>
      <el-col :span="20">
        <div class="msg-list" v-loading="listLoading" v-if="list">
          <el-empty v-if="!(list && list.length)"/>
          <el-row :gutter="24" v-else>
            <template v-for="item in list" :key="item.id">
              <el-col :span="6" v-if="item.member">
                <div class="msg-item">
                  <a class="msg-item-avatar" target="_blank">
                    <img :src="item.member.avatar || ''" class="msg-item-avatar-item" v-if="item.member.avatar">
                  </a>
                  <div class="user-name">
                    {{item.member.name || ''}}
                  </div>
                  <div class="button-group">
                    <el-button @click="follow(item)">{{item.each ? '互相关注' : '关注'}}</el-button>
                    <el-button @click="privateLetter(item)">私信</el-button>
                  </div>
                </div>
              </el-col>
            </template>
          </el-row>
          <page :total="total" :page-size="params.size" :current-change="currentChange" :size-change="sizeChange"></page>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {inject, ref} from "vue"
import {followMember, getFollowFansMemberList, unfollowMember} from "@/api/edu/web/member";
import MemberMenu from "@/views/edu/web/member/menu";
import Page from "@/components/Page";
import {success} from "@/util/tipsUtils";
import router from "@/router";
import {getToken} from "@/util/tokenUtils";

export default {
  name: "noticeFans",
  components: {Page, MemberMenu},
  setup() {
    const showLoginFlag = inject("showLogin")
    const showLoginClose = inject("showLoginClose")
    if (!getToken()) {
      showLoginFlag.value = true
      showLoginClose.value = false
      return
    }
    const params = ref({
      current: 1,
      size: 2,
      keyword: ""
    })
    const list = ref([])
    const total = ref(0)
    const listLoading = ref(true)
    const loadList = function() {
      listLoading.value = true
      getFollowFansMemberList(params.value, res => {
        list.value = res.list;
        total.value = res.total;
        listLoading.value = false
      }).catch(() => {
        listLoading.value = false
      })
    }
    loadList()
    const follow = (item) => {
      if (item.each) {
        unfollowMember(item.member.id, () => {
          success("取消关注成功")
          loadList()
        })
      } else {
        followMember(item.member.id, () => {
          success("关注成功")
          loadList()
        })
      }
    }
    const privateLetter = (item) => {
      router.push({path: "/edu/message/private-letter", query: {memberId: item.member.id}})
    }
    const currentChange = (c) => {
      params.value.current = c;
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
      follow,
      privateLetter,
      currentChange,
      sizeChange,
      params
    }
  }
}
</script>

<style lang="scss" scoped>
.content-container {
  .msg-list {
    background: #FFFFFF;
    margin: 20px 0;
    padding: 20px;
    .msg-item {
      display: inline-block;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      margin-bottom: 24px;
      border-radius: 6px;
      border: 1px solid #f0f0f0;
      cursor: pointer;
      transition: all .3s;
      width: calc(100% - 24px);
      flex: 0 0 calc(100% - 24px);
      padding: 32px 12px;
      text-align: center;
      &:hover {
        box-shadow: 0 2px 25px rgb(0 0 0 / 15%);
      }
      .msg-item-avatar {
        width: 80px;
        height: 80px;
        display: block;
        margin: 0 auto;
        .msg-item-avatar-item {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 1px solid #f0f0f0;
          font-size: 80px;
        }
        img {
          width: 100%;
          height: 100%;
        }
      }
      .user-name {
        margin-top: 16px;
        font-size: 16px;
        color: #505050;
        text-align: center;
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .button-group {
        display: flex;
        justify-content: center;
        align-items: center;
        margin-top: 24px;
        .el-button {
          &:not(:last-child) {
            margin-right: 20px;
          }
        }
      }
    }
  }
}
</style>
