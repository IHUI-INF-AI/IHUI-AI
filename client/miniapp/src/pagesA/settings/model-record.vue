<template>
    <view class="settings-page">
        <SettingsPageLayout title="模型备案">
            <view class="content-inner">
                <view class="card-wrap">
                    <image
                        v-for="(img, index) in imageList"
                        :key="index"
                        class="record-image"
                        :src="img"
                        mode="widthFix"
                        @click="previewImages(index)"
                    />
                </view>
            </view>
        </SettingsPageLayout>
    </view>
</template>

<script setup>
import { ref } from 'vue'
import SettingsPageLayout from './common/SettingsPageLayout.vue'

const imageList = ref([
    '/static/images/modelRecord1.png',
    '/static/images/modelRecord2.png',
    '/static/images/modelRecord3.png',
    '/static/images/modelRecord4.png'
])

function previewImages(current) {
    uni.previewImage({
        urls: imageList.value,
        current: imageList.value[current]
    })
}
</script>

<style lang="scss" scoped>
.settings-page {
    min-height: 100vh;
    background-color: #f5f5f5;
}

.content-inner {
    padding: 24rpx 24rpx 48rpx;
}

.card-wrap {
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
    padding: 24rpx;
    box-sizing: border-box;
}

.record-image {
    width: 100%;
    display: block;
    border-radius: 8rpx;
    margin-bottom: 24rpx;

    &:last-child {
        margin-bottom: 0;
    }
}
</style>
