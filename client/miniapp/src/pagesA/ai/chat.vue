/**
 * 
 * @description: AI文案创作页面，二级页面
 * @author: tgg
 * @date: 2025-04-14 17:16:32
 * 
 */


<template>
	<view class="chat-container">
		<!-- 顶部导航栏 -->
		<view class="nav-bar">
			<view class="left-icon" @click="goBack">
				<!-- <image class="back-icon" src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/right.png" mode="aspectFit"></image> -->
			</view>
		</view>
		
		<!-- 搜索框 -->
		<view class="search-bar" @click="navigateToChat">
			<view class="search-input">
				<text>有什么问题请尽管问我</text>
				<text class="arrow-icon">></text>
			</view>
		</view>
		
		<!-- 机器人提示 -->
		<view class="robot-prompt">
			<view class="robot-avatar">
				<image class="robot-img" src="https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/jiqiren.png" mode="aspectFit"></image>
			</view>
			<text class="prompt-text">请选择文案赛道</text>
		</view>
		
		<!-- 分类标题 -->
		<view class="category-header">
			<text>垂直行业赛道</text>
		</view>
		
		<!-- 行业类型网格 -->
		<view class="industry-grid">
			<view 
				v-for="(item, index) in industries" 
				:key="index" 
				class="industry-item"
				:class="{ 'selected': selectedIndustry === index }"
				@click="selectIndustry(index, item)"
			>
				<image class="industry-icon" :src="item.icon" mode="aspectFit"></image>
				<view class="separator"></view> <!-- 添加横线 -->
				<text class="industry-name">{{ item.name }}</text>
			</view>
		</view>
		
		<!-- 细分功能标题 -->
		<view class="category-header">
			<text>细分功能赛道</text>
		</view>
		
		<!-- 细分功能网格 -->
		<view class="industry-grid">
			<view 
				v-for="(item, index) in subIndustries" 
				:key="index" 
				class="industry-item"
				@click="selectIndustry(index + industries.length, item)"
			>
				<image class="industry-icon" :src="item.icon" mode="aspectFit"></image>
				<view class="separator"></view> <!-- 添加横线 -->
				<text class="industry-name">{{ item.name }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref } from 'vue'

const selectedIndustry = ref(-1)

const industries = ref([
	{ 
		name: '教育类型', 
		icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/title.png',
		 
	},
	{ 
		name: '电商类型', 
		icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/title.png',
		
	},
	{ 
		name: '美妆护肤', 
		icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/title.png'
	},
	{ 
		name: '大健康类', 
		icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/title.png',
		
	},
	{ 
		name: '金融财政', 
		icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/title.png',
	},
	{ 
		name: '本地生活', 
		icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/title.png',
		
	}
])

const subIndustries = ref([
	{ 
		name: '科技数码', 
		icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/title.png',
		
	},
	{ 
		name: '母婴亲子', 
		icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/title.png',
		
	},
	{ 
		name: '三农类型', 
		icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/title.png',
		
	},
	{ 
		name: '职场技能', 
		icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/title.png',
		
	},
	{ 
		name: '汽车领域', 
		icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/title.png',
		
	},
	{ 
		name: '情感心理', 
		icon: 'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/home/second/title.png',
		
	}
])

function goBack() {
	uni.navigateBack();
}

function navigateToChat() {
	uni.navigateTo({
		url: '/pages/ai/chat-detail'
	});
}

function selectIndustry(index, industry) {
	selectedIndustry.value = index;
	
	uni.setStorageSync('selectedIndustry', industry);
	
	setTimeout(() => {
		uni.navigateTo({
			url: '/pages/ai/chat-detail'
		});
	}, 300);
}

onLoad(() => {});
</script>

<style lang="scss">
.chat-container {
	min-height: 100vh;
	background: linear-gradient(180deg, #93D2F3, #93D2E2, #9bd1d1);
	padding: 10rpx 30rpx;
}

/* 搜索框 */
.search-bar {
	margin: 20rpx 0;
	
	.search-input {
		height: 80rpx;
		background-color: #ffffff;
		border-radius: 30rpx;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 30rpx;
		color: #999;
		font-size: 28rpx;
		
		.arrow-icon {
			color: #b3e5fc;
			font-weight: bold;
		}
	}
}

/* 机器人提示 */
.robot-prompt {
	display: flex;
	align-items: center;
	justify-content: flex-start;
	margin: 20rpx 0 40rpx;
	
	.robot-avatar {
		width: 150rpx;
		height: 150rpx;
		border-radius: 30rpx;
		margin-right: 20rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		
		.robot-img {
			width: 150rpx;
			height: 150rpx;
		}
	}
	
	.prompt-text {
		font-size: 40rpx;
		color: #000000;
		font-weight: bold; 
	}
}

/* 分类标题 */
.category-header {
	font-size: 30rpx;
	font-weight: bold;
	color: #333;
	margin: 30rpx 0 20rpx;
	position: relative;
	padding-left: 20rpx;
	
	&:before {
		content: '';
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
		width: 6rpx;
		height: 30rpx;
		background-color: #b3e5fc;
		border-radius: 8rpx;
	}
}

/* 行业网格 */
.industry-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 20rpx;
	margin-bottom: 30rpx;
	
	.industry-item {
		background-color: #e3eee5;
		border-radius: 15rpx;
		padding: 20rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		box-shadow: 0 0 5rpx rgba(0, 0, 0, 0.05);
		
		&.selected {
			border: 2rpx solid #b3e5fc;
			background-color: rgba(179, 229, 252, 0.1);
		}
		
		
		.separator {
			width: 100%;
			height: 2rpx;
			background-color: #ddd;
			margin: 10rpx 0;
		}
		
		.industry-icon {
			width: 70rpx;
			height: 70rpx;
			margin-bottom: 0;
			}
			
		.industry-name {
			font-size: 24rpx;
			color: #333;
			margin-top: 10rpx;
		}
	}
}
</style>
