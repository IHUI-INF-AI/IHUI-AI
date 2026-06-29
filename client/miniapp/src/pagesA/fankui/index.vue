<template>
  <view>
    <!-- 导航栏 -->
    <navigationBars 
      :viscosity="true" 
      title="投诉与反馈" 
      :image="'https://file.aizhs.top/sys-mini/default/back.svg'"
      @pack="goBack" 
    />

    <Loading v-if="loading"></Loading>

    <!-- 反馈列表 -->
    <scroll-view 
      v-if="pageType == 'list'" 
      class="scroll_body" 
      :scroll-top="0" 
      scroll-y 
      lower-threshold="50"
      @scrolltolower="scrolltolower"
    >
      <view class="v_b">
        <view class="s_item title m_b" v-for="(item, index) in list" :key="index" @click="toDetail(item)">
          <view class="f_b m_b">
            <text>姓名：{{ item.username || '' }}</text>
            <text>电话：{{ item.phone || '' }}</text>
          </view>
          <view class="m_b">反馈内容：</view>
          <view class="m_b font_nomal">{{ item.context || '' }}</view>
          <view class="imgs" v-if="item.filePath">
            <image 
              class="img_i upload_item m_b" 
              :src="url" 
              v-for="(url) in (item.filePath || '').split(',')" 
              :key="url" 
            />
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 反馈表单 -->
    <view v-else class="fan_kui">
      <view class="f_c font_nomal fankui_text">
        <text>注意:"投诉与反馈"页面是我们系统内建的用户反馈渠道。</text>
      </view>
      <view class="fk_form">
        <view class="title"><text style="color: #f00;">*</text>姓名</view>
        <input 
          class="v_title_f m_b" 
          v-model="formInfo.username" 
          type="text" 
          placeholder="请输入姓名"
          placeholder-class="placeholder_color" 
          :disabled="type != 'add'"
        >

        <view class="title"><text style="color: #f00;">*</text>联系方式</view>
        <input 
          class="v_title_f m_b" 
          v-model="formInfo.phone" 
          type="text" 
          placeholder="请输入联系方式"
          placeholder-class="placeholder_color" 
          :disabled="type != 'add'"
        >

        <view class="title"><text style="color: #f00;">*</text>描述你遇到的问题</view>
        <textarea 
          class="font_nomal text_area" 
          auto-height 
          v-model="formInfo.context"
          placeholder-class="placeholder_color" 
          placeholder="请输入反馈详情" 
          :disabled="type != 'add'"
        ></textarea>

        <view class="title">请在此上传你所遇到问题的截图（最多9张）</view>
        <view class="upload_img_list">
          <view class="upload_item" v-for="(img, index) in (formInfo.filePaths || [])" :key="index">
            <image :src="img" style="width: 140rpx; height: 140rpx;" mode="aspectFill"></image>
            <view class="delete_btn" @click="deleteImage(index)">×</view>
          </view>
          <view class="upload_img" @click="uploadImage" v-if="(formInfo.filePaths || []).length < 9">
            <image 
              src="https://file.aizhs.top/sys-mini/xtk/add_kf.png" 
              style="width: 100rpx; height: 100rpx;" 
              mode="widthFix"
            ></image>
          </view>
        </view>

        <view style="padding: 10rpx 18rpx; color: #d7e1f7; font-size: 24rpx;">
          Tips:您的反馈将用于改进我们的产品与服务，发送后请您耐心等待，我们会有专门的人员为您处理问题...
        </view>

        <view class="fk_btn f_c" v-if="type == 'add'">
          <view class="btn f_c" @click="submit()">
            <text>提交反馈</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import NavigationBars from '@/components/navigation-bars/index.vue'
import { userFeedback, userFeedbackList } from '@/service/study.js'
import Loading from '@/components/loading/index.vue'
import { uploadSinglePicture } from '@/utils/uploadImage.js'

// 状态
const loading = ref(false)
const pageType = ref('item')
const type = ref('add')
const list = ref<any[]>([])
const pageNum = ref(1)

// 表单数据
const formInfo = reactive({
  username: '',
  phone: '',
  title: '',
  context: '',
  file_path: '',
  feedback: '',
  feedback_path: '',
  filePaths: [] as string[],
})

onMounted(() => {
  loadFeedbackList()
})

// 加载反馈列表
async function loadFeedbackList() {
  loading.value = true
  try {
    const res: any = await userFeedbackList({ pageNum: pageNum.value })
    if (res && res.data) {
      list.value = res.data.list || []
    }
  } catch (error) {
    console.error('加载反馈列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 提交反馈
async function submit() {
  if (!formInfo.username) {
    uni.showToast({ title: '请输入姓名', icon: 'none' })
    return
  }
  if (!formInfo.phone) {
    uni.showToast({ title: '请输入联系方式', icon: 'none' })
    return
  }
  if (!formInfo.context) {
    uni.showToast({ title: '请输入反馈内容', icon: 'none' })
    return
  }

  loading.value = true
  try {
    await userFeedback({
      username: formInfo.username,
      phone: formInfo.phone,
      context: formInfo.context,
      filePath: formInfo.filePaths.join(','),
    })
    uni.showToast({ title: '提交成功', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  } catch (error) {
    uni.showToast({ title: '提交失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 上传图片
async function uploadImage() {
  try {
    const res = await uni.chooseImage({
      count: 9 - (formInfo.filePaths || []).length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
    })

    if (res.tempFilePaths) {
      for (const filePath of res.tempFilePaths) {
        const uploadRes = await uploadSinglePicture(filePath)
        if (uploadRes && uploadRes.url) {
          formInfo.filePaths.push(uploadRes.url)
        }
      }
      uni.showToast({ title: '上传成功', icon: 'success' })
    }
  } catch (error) {
    console.error('上传图片失败:', error)
    uni.showToast({ title: '上传图片失败', icon: 'none' })
  }
}

// 删除图片
function deleteImage(index: number) {
  formInfo.filePaths.splice(index, 1)
}

// 查看详情
function toDetail(item: any) {
  type.value = 'detail'
  formInfo.username = item.username
  formInfo.phone = item.phone
  formInfo.context = item.context
  formInfo.filePaths = (item.filePath || '').split(',').filter(Boolean)
}

// 滚动加载
function scrolltolower() {
  pageNum.value++
  loadFeedbackList()
}

// 返回上一页
function goBack() {
  if (type.value === 'detail') {
    type.value = 'add'
    formInfo.username = ''
    formInfo.phone = ''
    formInfo.context = ''
    formInfo.filePaths = []
  } else {
    uni.navigateBack()
  }
}
</script>

<style lang="scss" scoped>
.scroll_body {
  height: calc(100vh - 100rpx);
  padding: 20rpx;
}

.s_item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.f_b {
  display: flex;
  justify-content: space-between;
}

.m_b {
  margin-bottom: 16rpx;
}

.font_nomal {
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
}

.imgs {
  display: flex;
  flex-wrap: wrap;
}

.img_i {
  width: 140rpx;
  height: 140rpx;
  margin-right: 16rpx;
}

.fan_kui {
  padding: 20rpx;
}

.fankui_text {
  background: #fff3cd;
  padding: 20rpx;
  border-radius: 10rpx;
  margin-bottom: 20rpx;
}

.fk_form {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
}

.title {
  font-size: 28rpx;
  color: #333;
  margin-bottom: 16rpx;
}

.v_title_f {
  border: 1rpx solid #eee;
  border-radius: 10rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.text_area {
  border: 1rpx solid #eee;
  border-radius: 10rpx;
  padding: 20rpx;
  min-height: 200rpx;
  margin-bottom: 20rpx;
}

.upload_img_list {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 20rpx;
}

.upload_item {
  position: relative;
  margin-right: 16rpx;
  margin-bottom: 16rpx;
}

.delete_btn {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  width: 40rpx;
  height: 40rpx;
  background: #ff3b30;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
}

.upload_img {
  width: 100rpx;
  height: 100rpx;
  border: 1rpx dashed #ddd;
  border-radius: 10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fk_btn {
  margin-top: 40rpx;
}

.btn {
  background: #007aff;
  color: #fff;
  padding: 24rpx;
  border-radius: 12rpx;
  font-size: 32rpx;
  text-align: center;
}

.f_c {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
