<template>
    <view class="container">
        <nav-bar title="课程详情" />
        
        <!-- 课程封面 -->
        <view class="course-cover">
            <image :src="courseInfo.coverUrl" mode="aspectFill" />
            <view class="cover-mask">
                <view class="title">{{courseInfo.title}}</view>
                <view class="subtitle">{{courseInfo.subtitle}}</view>
            </view>
        </view>
        
        <!-- 课程信息 -->
        <view class="course-info">
            <view class="info-item">
                <text class="iconfont icon-teacher"></text>
                <text class="text">{{courseInfo.teacher}}</text>
            </view>
            <view class="info-item">
                <text class="iconfont icon-time"></text>
                <text class="text">{{courseInfo.duration}}</text>
            </view>
            <view class="info-item">
                <text class="iconfont icon-level"></text>
                <text class="text">{{courseInfo.level}}</text>
            </view>
        </view>
        
        <!-- 课程简介 -->
        <view class="course-section">
            <view class="section-title">课程简介</view>
            <view class="section-content">{{courseInfo.description}}</view>
        </view>
        
        <!-- 课程大纲 -->
        <view class="course-section">
            <view class="section-title">课程大纲</view>
            <view class="outline-list">
                <view 
                    class="outline-item" 
                    v-for="(item, index) in courseInfo.outline" 
                    :key="index"
                >
                    <view class="item-header">
                        <text class="title">{{item.title}}</text>
                        <text class="duration">{{item.duration}}</text>
                    </view>
                    <view class="item-content">{{item.description}}</view>
                </view>
            </view>
        </view>
        
        <!-- 底部操作栏 -->
        <view class="bottom-bar">
            <view class="price">
                <text class="symbol">¥</text>
                <text class="amount">{{courseInfo.price}}</text>
            </view>
            <view class="action-buttons">
                <button class="btn btn-cart" @click="addToCart">
                    <text class="iconfont icon-cart"></text>
                    <text>加入购物车</text>
                </button>
                <button class="btn btn-buy" @click="buyNow">立即购买</button>
            </view>
        </view>
    </view>
</template>

<script setup>
import { reactive } from 'vue'

const courseInfo = reactive({
    title: '短视频运营实战课程',
    subtitle: '从零开始学习短视频运营',
    coverUrl: '/static/images/course-cover.jpg',
    teacher: '张老师',
    duration: '12课时',
    level: '入门',
    price: 299,
    description: '本课程将带你全面了解短视频运营的核心要素，包括内容策划、拍摄技巧、剪辑方法、运营策略等。通过实战案例，让你快速掌握短视频运营技能。',
    outline: [
        {
            title: '第一章：短视频运营基础',
            duration: '45分钟',
            description: '了解短视频平台特点、运营规则和基本概念'
        },
        {
            title: '第二章：内容策划与选题',
            duration: '60分钟',
            description: '学习如何选题、策划内容，打造爆款视频'
        },
        {
            title: '第三章：拍摄与剪辑技巧',
            duration: '90分钟',
            description: '掌握专业的拍摄和剪辑方法，提升视频质量'
        }
    ]
})

function addToCart() {
    uni.showToast({
        title: '已加入购物车',
        icon: 'success'
    })
}

function buyNow() {
    uni.navigateTo({
        url: '/pages/order/confirm'
    })
}
</script>

<style lang="scss">
.container {
    min-height: 100vh;
    background-color: $background-color;
    padding-bottom: 120rpx;
}

.course-cover {
    position: relative;
    height: 400rpx;
    
    image {
        width: 100%;
        height: 100%;
    }
    
    .cover-mask {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        padding: $spacing-large;
        background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
        
        .title {
            font-size: $font-size-xl;
            color: $text-color;
            margin-bottom: $spacing-mini;
        }
        
        .subtitle {
            font-size: $font-size-base;
            color: $text-color-light;
        }
    }
}

.course-info {
    display: flex;
    padding: $spacing-base;
    background-color: $background-color-card;
    
    .info-item {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        
        .iconfont {
            font-size: $font-size-lg;
            color: $primary-color;
            margin-right: $spacing-mini;
        }
        
        .text {
            font-size: $font-size-base;
            color: $text-color;
        }
    }
}

.course-section {
    margin-top: $spacing-large;
    padding: $spacing-base;
    background-color: $background-color-card;
    
    .section-title {
        font-size: $font-size-lg;
        color: $text-color;
        margin-bottom: $spacing-base;
    }
    
    .section-content {
        font-size: $font-size-base;
        color: $text-color-light;
        line-height: 1.6;
    }
    
    .outline-list {
        .outline-item {
            padding: $spacing-base;
            border-bottom: 1px solid $border-color;
            
            &:last-child {
                border-bottom: none;
            }
            
            .item-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: $spacing-mini;
                
                .title {
                    font-size: $font-size-base;
                    color: $text-color;
                }
                
                .duration {
                    font-size: $font-size-sm;
                    color: $text-color-light;
                }
            }
            
            .item-content {
                font-size: $font-size-sm;
                color: $text-color-light;
            }
        }
    }
}

.bottom-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 100rpx;
    background-color: $background-color-card;
    display: flex;
    align-items: center;
    padding: 0 $spacing-base;
    
    .price {
        .symbol {
            font-size: $font-size-base;
            color: $primary-color;
        }
        
        .amount {
            font-size: $font-size-xl;
            color: $primary-color;
            font-weight: bold;
        }
    }
    
    .action-buttons {
        flex: 1;
        display: flex;
        justify-content: flex-end;
        
        .btn {
            height: 80rpx;
            padding: 0 $spacing-large;
            border-radius: $border-radius-base;
            display: flex;
            align-items: center;
            margin-left: $spacing-base;
            
            &.btn-cart {
                background-color: $background-color;
                color: $text-color;
                
                .iconfont {
                    font-size: $font-size-lg;
                    margin-right: $spacing-mini;
                }
            }
            
            &.btn-buy {
                background-color: $primary-color;
                color: $background-color;
            }
        }
    }
}
</style> 
