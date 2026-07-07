<template>
  <div class="content-container">
    <el-row class="row">
      <el-col :span="4">
        <member-menu active="personal"/>
      </el-col>
      <el-col :span="20">
        <div class="personal-container" v-if="member">
          <div class="personal-item">
            <div class="personal-item-wrapper">
              <div class="personal-item-label">姓名</div>
              <div class="personal-item-content">
                <div>{{member.name}}</div>
                <el-button link class="personal-item-button" @click="nameDialogVisible = true">编辑</el-button>
              </div>
            </div>
            <el-dialog title="修改姓名" v-model="nameDialogVisible" width="30%" :before-close="hideNameDialog">
              <div>
                <el-input placeholder="姓名" v-model="memberName"/>
              </div>
              <template #footer>
                <span class="dialog-footer">
                  <el-button @click="hideNameDialog">取消</el-button>
                  <el-button type="primary" @click="submitName">确定</el-button>
                </span>
              </template>
            </el-dialog>
          </div>
          <div class="personal-item avatar-item">
            <div class="personal-item-wrapper">
              <div class="personal-item-label">用户头像</div>
              <div class="personal-item-content">
                <div class="byte-spin">
                  <div class="byte-spin-container">
                    <div class="byte-spin-content">
                      <div style="display: flex; align-items: center;">
                        <img style="width: 200px;" :src="member.avatar"/>
                      </div>
                    </div>
                  </div>
                </div>
                <el-button link class="personal-item-button" @click="imageDialogVisible = true">修改</el-button>
              </div>
            </div>
            <el-dialog title="修改头像" v-model="imageDialogVisible" width="30%" :before-close="hideImageDialog">
              <div>
                <upload-image
                  :limit="1"
                  :files="uploadData.files"
                  :on-upload-success="onUploadSuccess"
                  :on-upload-remove="onUploadRemove"
                  :upload-url="uploadData.url"
                  accept="image/jpeg,image/gif,image/png"/>
                <span style="font-size: 12px;color: #cccccc;">*tips: 图片删除无需确认</span>
              </div>
              <template #footer>
                <span class="dialog-footer">
                  <el-button @click="hideImageDialog">取消</el-button>
                  <el-button type="primary" @click="submitImage">确定</el-button>
                </span>
              </template>
            </el-dialog>
          </div>
          <div class="personal-item">
            <div class="personal-item-wrapper">
              <div class="personal-item-label">会员等级</div>
              <div class="personal-item-content">{{member && member.level ? member.level.name : "--"}}</div>
            </div>
          </div>
          <div class="personal-item">
            <div class="personal-item-wrapper">
              <div class="personal-item-label">会员</div>
              <div class="personal-item-content">{{member.code}}</div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {inject, ref} from "vue"
  import memberMenu from "../menu/index.vue"
  import uploadImage from "@/components/Uplaod"
  import {updateName, updateAvatar, getMember} from "@/api/edu/web/member"
  import {getMemberInfo} from "@/api/edu/web/member";
  import {success} from "@/util/tipsUtils";
import {getToken} from "@/util/tokenUtils";
  export default {
    name: "memberPersonal",
    components: {
      memberMenu,
      uploadImage
    },
    setup() {
      const showLoginFlag = inject("showLogin")
      const showLoginClose = inject("showLoginClose")
      if (!getToken()) {
        showLoginFlag.value = true
        showLoginClose.value = false
        return
      }
      const member = ref({})
      const imageDialogVisible = ref(false)
      const uploadData = ref({
        url: '/api/v1/edu' + "/oss/member/personal/image",
        files: []
      })
      const nameDialogVisible = ref(false)
      const memberName = ref("")
      const load = function() {
        getMemberInfo(res => {
          member.value = res
          memberName.value = member.value.name
          uploadData.value.files = [{name: "头像", url: member.value.avatar}]
        })
      }
      load()
      const hideImageDialog = function() {
        imageDialogVisible.value = false
      }
      // 上传图片成功
      const onUploadSuccess = function(res) {
        member.value.avatar = res.data
      }
      // 删除图片
      const onUploadRemove = function() {
        member.value.avatar = ""
        uploadData.value.files = []
      }
      const submitImage = function() {
        updateAvatar({id: member.value.id, avatar: member.value.avatar}, () => {
          success("修改成功");
          imageDialogVisible.value = false
          getMember()
        })
      }
      const hideNameDialog = function() {
        nameDialogVisible.value = false
      }
      const submitName = function() {
        updateName({id: member.value.id, name: memberName.value}, () => {
          success("修改成功");
          member.value.name = memberName.value
          nameDialogVisible.value = false
          getMember()
        })
      }
      return {
        member,
        imageDialogVisible,
        uploadData,
        nameDialogVisible,
        memberName,
        hideImageDialog,
        onUploadSuccess,
        onUploadRemove,
        submitImage,
        hideNameDialog,
        submitName
      }
    }
  }
</script>

<style lang="scss" scoped>
  .personal-container {
    background-color: #ffffff;
    margin: 16px;
    padding: 20px 32px;
    display: flex;
    flex-direction: column;
    flex: 1;
    border: 1px solid #f0f0f0;
    border-radius: 6px;
    
    .personal-item:last-child {
      border: 0;
    }
    
    .personal-item {
      padding: 20px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      line-height: 22px;
      border-bottom: 1px solid #f0f0f0;
      
      .personal-item-wrapper {
        flex: 1;
        display: flex;
        
        .personal-item-label {
          flex: none;
          width: 120px;
          display: flex;
          align-items: center;
          font-weight: 500;
          color: #333333;
        }
        
        .personal-item-content {
          flex: 1;
          color: #666666;
          display: flex;
          justify-content: space-between;
          word-break: break-all;
        }
        
        .personal-item-button {
          padding: 0;
          line-height: 20px;
          margin-left: 12px;
          color: var(--el-color-primary);
          
          &:hover {
            color: $primary-hover;
          }
        }
      }
    }
    
    .avatar-item {
      img {
        border-radius: 6px;
        border: 1px solid #f0f0f0;
      }
    }
  }
  
  .row {
    height: 100%;
    
    .el-col {
      height: 100%;
    }
  }
  
  .el-menu-item {
    height: 80px;
    
    .el-icon-close {
      display: none;
      position: absolute;
      right: 5px;
      top: 50%;
      transform: translateY(-50%);
      color: #999999;
    }
  }
  
  .el-menu-item:focus,
  .el-menu-item:hover {
    height: 80px;
    
    em {
      display: none;
    }
    
    .el-icon-close {
      display: block;
    }
  }
  
  .el-menu-item:focus {
    em {
      display: block;
    }
    
    .el-icon-close {
      display: none;
    }
  }
</style>
<style>
  body {
    background-color: #fafafa;
    height: 100%;
  }
</style>
