<template>
    <view class="empty">
        <image 
            class="empty-image" 
            :src="image" 
            mode="aspectFit"
        />
        <text class="empty-text">{{text}}</text>
        <view class="empty-action" v-if="showAction">
            <slot name="action">
                <button class="action-btn" @click="handleAction">
                    {{actionText}}
                </button>
            </slot>
        </view>
    </view>
</template>

<script setup>
const props = defineProps({
    image: {
        type: String,
        default: '/static/images/empty.png'
    },
    text: {
        type: String,
        default: '暂无数据'
    },
    showAction: {
        type: Boolean,
        default: false
    },
    actionText: {
        type: String,
        default: '重新加载'
    }
})

const emit = defineEmits(['action'])

function handleAction() {
    emit('action')
}
</script>

<style lang="scss">
.empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: $spacing-xlarge;
    
    .empty-image {
        width: 200rpx;
        height: 200rpx;
        margin-bottom: $spacing-large;
    }
    
    .empty-text {
        font-size: $font-size-base;
        color: $text-color-light;
        margin-bottom: $spacing-large;
    }
    
    .empty-action {
        .action-btn {
            padding: $spacing-base $spacing-large;
            background-color: $primary-color;
            color: $background-color;
            border-radius: $border-radius-base;
            font-size: $font-size-base;
        }
    }
}
</style> 
