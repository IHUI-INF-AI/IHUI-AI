/**
* TONG - 04/09
* 课程星球
* 点击 查看更多 跳转至 课程星球 详情页
*
*/
<template>
	<view class="main-container">
		
		<!-- 主内容滚动区域 -->
		<CommissionFloatingIcon></CommissionFloatingIcon>
		<scroll-view scroll-y class="page-scroll" :enhanced="true" :show-scrollbar="false" :bounce="true"
			:fast-deceleration="true">
			<Carousel @item-click="onCarouselItemClick" />
			<ToolBar />
			<PopularCourses />
			<KnowledgePlanet />
			<BottomFigure />
		</scroll-view>
	</view>
</template>

<script setup>
import CommissionFloatingIcon from '@/pages/tools/components/CommissionFloatingIcon/index.vue'
import Carousel from '@/components/Carousel/index.vue'
import ToolBar from '@/components/Toolbar/index.vue'
import PopularCourses from '@/components/PopularCourses/index.vue'
import KnowledgePlanet from '@/components/KnowledgePlanet/index.vue'
import BottomFigure from '@/components/BottomFigure/index.vue'

function onCarouselItemClick(item) {
}

function handleFeatureClick(type) {
	uni.vibrateShort()

	if (type === 'ai-copywriting') {
		uni.navigateTo({ url: '/pages/ai/chat' })
		return
	}
	
	if (type === 'ai-image') {
		uni.navigateTo({ url: '/pages/tools/ai_photo' })
		return
	}
	
	if (type === 'marketing') {
		uni.navigateTo({ url: '/pages/tools/ai-marketing' })
		return
	}

	uni.showToast({ title: '功能开发中', icon: 'none' })
}

function handleCourseClick(course) {
	uni.vibrateShort()
	uni.showToast({ title: '课程详情开发中', icon: 'none' })
}

function handleNewsClick(news) {
	uni.vibrateShort()
	uni.showToast({ title: '资讯详情开发中', icon: 'none' })
}

function handleViewAll(type) {
	uni.vibrateShort()
	uni.showToast({ title: '更多内容开发中', icon: 'none' })
}
</script>

<style lang="scss" scoped>
	.main-container {
		height: 100vh;
		background: linear-gradient(180deg, #93D2F3, #93D2E2, #9bd1d1);
	}

	.page-scroll {
		height: 100vh;
		position: relative;
		width: 95%;
		margin: 0 auto;
	}

	.container {
		min-height: 100vh;
		padding-bottom: 40rpx;
	}

	/* 欢迎区域样式 */
	.welcome {
		position: relative;
		padding: 160rpx 30rpx 40rpx;
	}

	.glass-panel {
		background: rgba(15, 15, 20, 0.7);
		backdrop-filter: blur(10px);
		border-radius: 30rpx;
		padding: 40rpx;
		box-shadow: 0 0 32rpx rgba(0, 0, 0, 0.3);
		border: 1px solid rgba(0, 242, 255, 0.2);
		z-index: 10;
		position: relative;
		overflow: hidden;

		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 1px;
			background: linear-gradient(90deg,
					transparent,
					rgba(0, 242, 255, 0.5),
					rgba(139, 92, 246, 0.5),
					transparent);
			filter: blur(1px);
		}

		&::after {
			content: '';
			position: absolute;
			top: 1px;
			left: 0;
			width: 100%;
			height: 100%;
			background: linear-gradient(180deg,
					rgba(0, 242, 255, 0.1),
					transparent 20%);
			opacity: 0.5;
		}
	}

	.welcome-panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.welcome-title {
		font-size: 48rpx;
		font-weight: 700;
		background: linear-gradient(135deg, #00F2FF, #8B5CF6, #00F2FF);
		background-size: 200% 100%;
		animation: gradientFlow 6s linear infinite;
		-webkit-background-clip: text;
		color: transparent;
		margin-bottom: 16rpx;
		text-shadow: 0 0 30rpx rgba(0, 242, 255, 0.6);
	}

	.welcome-subtitle {
		font-size: 32rpx;
		color: rgba(255, 255, 255, 0.9);
		text-shadow: 0 0 20rpx rgba(0, 242, 255, 0.4);
	}

	/* 板块容器 */
	.section-container {
		padding: 30rpx;
		margin-bottom: 20rpx;
		background: rgba(15, 15, 20, 0.7);
		backdrop-filter: blur(10px);
		border-radius: 30rpx;
		margin: 0 30rpx 30rpx;
		border: 1px solid rgba(0, 242, 255, 0.1);
		box-shadow: 0 0 32rpx rgba(0, 0, 0, 0.3);
		position: relative;
		overflow: hidden;

		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 1px;
			background: linear-gradient(90deg,
					transparent,
					rgba(0, 242, 255, 0.3),
					transparent);
		}
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24rpx;
	}

	.section-title {
		display: flex;
		align-items: center;
		font-size: 32rpx;
		font-weight: 600;
		color: #00F2FF;
		margin-bottom: 24rpx;
		text-shadow: 0 0 15rpx rgba(0, 242, 255, 0.4);
		position: relative;

		.title-icon {
			margin-right: 12rpx;
			font-size: 36rpx;
		}

		&::after {
			content: '';
			position: absolute;
			left: -20rpx;
			top: 50%;
			transform: translateY(-50%);
			width: 6rpx;
			height: 36rpx;
			background: linear-gradient(180deg, #00F2FF, #8B5CF6);
			border-radius: 8rpx;
			box-shadow: 0 0 20rpx rgba(0, 242, 255, 0.6);
		}
	}

	.view-all {
		display: flex;
		align-items: center;
		color: rgba(255, 255, 255, 0.7);
		font-size: 26rpx;

		.arrow-icon {
			margin-left: 6rpx;
			font-size: 22rpx;
		}
	}

	/* 功能区样式 */
	.feature-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 20rpx;
	}

	.feature-item {
		background-color: rgba(20, 20, 30, 0.7);
		border-radius: 20rpx;
		padding: 28rpx;
		box-shadow: 0 0 30rpx rgba(0, 0, 0, 0.2);
		transition: transform 0.2s, box-shadow 0.2s;
		overflow: hidden;
		position: relative;
		border: 1px solid rgba(0, 242, 255, 0.1);

		&::after {
			content: '';
			position: absolute;
			width: 120rpx;
			height: 120rpx;
			border-radius: 50%;
			background: linear-gradient(135deg, rgba(0, 242, 255, 0.05), rgba(139, 92, 246, 0.05));
			right: -40rpx;
			bottom: -40rpx;
			z-index: 0;
		}

		&:active {
			transform: scale(0.98);
			box-shadow: 0 0 15rpx rgba(0, 0, 0, 0.03);
			background: rgba(0, 242, 255, 0.08);
		}

		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			width: 70%;
			height: 1px;
			background: linear-gradient(to right, rgba(0, 242, 255, 0.5), transparent);
		}
	}

	.feature-item-icon {
		width: 80rpx;
		height: 80rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 15rpx;
		margin-bottom: 16rpx;
		font-size: 36rpx;
		position: relative;

		&::after {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), transparent);
			border-radius: inherit;
			opacity: 0.6;
		}

		&.copywriting-icon {
			background: linear-gradient(135deg, rgba(255, 235, 59, 0.2), rgba(255, 193, 7, 0.2));
			color: #ffc107;
			box-shadow: 0 0 12rpx rgba(255, 193, 7, 0.2);
			border: 1px solid rgba(255, 193, 7, 0.3);
		}

		&.image-icon {
			background: linear-gradient(135deg, rgba(255, 152, 0, 0.2), rgba(255, 87, 34, 0.2));
			color: #ff9800;
			box-shadow: 0 0 12rpx rgba(255, 87, 34, 0.2);
			border: 1px solid rgba(255, 87, 34, 0.3);
		}

		&.video-icon {
			background: linear-gradient(135deg, rgba(244, 67, 54, 0.2), rgba(233, 30, 99, 0.2));
			color: #e91e63;
			box-shadow: 0 0 12rpx rgba(233, 30, 99, 0.2);
			border: 1px solid rgba(233, 30, 99, 0.3);
		}

		&.marketing-icon {
			background: linear-gradient(135deg, rgba(3, 169, 244, 0.2), rgba(3, 155, 229, 0.2));
			color: #03a9f4;
			box-shadow: 0 0 12rpx rgba(3, 169, 244, 0.2);
			border: 1px solid rgba(3, 169, 244, 0.3);
		}
	}

	.feature-item-content {
		display: flex;
		flex-direction: column;
	}

	.feature-item-name {
		font-size: 30rpx;
		font-weight: 600;
		color: #fff;
		margin-bottom: 8rpx;
		text-shadow: 0 0 15rpx rgba(0, 242, 255, 0.3);
	}

	.feature-item-desc {
		font-size: 24rpx;
		color: rgba(255, 255, 255, 0.7);
	}

	/* 课程区域样式 */
	.course-scroll {
		height: calc(100vh - 90rpx);
		width: 100%;
		white-space: nowrap;
	}

	.course-list {
		display: inline-flex;
		padding: 8rpx 0;
		gap: 20rpx;
	}

	.course-card {
		background: rgba(20, 20, 30, 0.7);
		border-radius: 20rpx;
		overflow: hidden;
		box-shadow: 0 0 30rpx rgba(0, 0, 0, 0.2);
		margin-right: 20rpx;
		width: 400rpx;
		flex-shrink: 0;
		transition: transform 0.2s;
		position: relative;
		border: 1px solid rgba(0, 242, 255, 0.1);

		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 3px;
			background: linear-gradient(90deg, rgba(0, 242, 255, 0.7), rgba(139, 92, 246, 0.7));
		}

		&:active {
			transform: scale(0.98);
		}
	}

	.course-card-content {
		padding: 24rpx;
	}

	.course-card-title {
		font-size: 30rpx;
		font-weight: 600;
		color: #fff;
		margin-bottom: 12rpx;
		white-space: normal;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-overflow: ellipsis;
		height: 84rpx;
		text-shadow: 0 0 10rpx rgba(0, 242, 255, 0.3);
	}

	.course-card-info {
		display: flex;
		justify-content: space-between;
		font-size: 24rpx;

		.course-lessons {
			color: #00F2FF;
			text-shadow: 0 0 10rpx rgba(0, 242, 255, 0.3);
		}

		.course-students {
			color: rgba(255, 255, 255, 0.7);
		}
	}

	/* 资讯区域样式 */
	.news-list {
		display: flex;
		flex-direction: column;
		gap: 20rpx;
	}

	.news-item {
		background: rgba(20, 20, 30, 0.7);
		border-radius: 20rpx;
		padding: 24rpx;
		display: flex;
		align-items: center;
		gap: 20rpx;
		transition: transform 0.2s;
		box-shadow: 0 0 30rpx rgba(0, 0, 0, 0.2);
		border: 1px solid rgba(0, 242, 255, 0.1);

		&:active {
			transform: scale(0.98);
			background: rgba(0, 242, 255, 0.08);
		}

		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			width: 70%;
			height: 1px;
			background: linear-gradient(to right, rgba(0, 242, 255, 0.5), transparent);
		}
	}

	.news-item-badge {
		width: 80rpx;
		height: 80rpx;
		background: rgba(20, 20, 30, 0.8);
		border-radius: 15rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 36rpx;
		flex-shrink: 0;
		border: 1px solid rgba(0, 242, 255, 0.1);
		box-shadow: 0 0 15rpx rgba(0, 242, 255, 0.2);
	}

	.news-item-content {
		flex: 1;
		min-width: 0;
	}

	.news-item-title {
		font-size: 28rpx;
		font-weight: 500;
		color: #fff;
		margin-bottom: 12rpx;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-overflow: ellipsis;
		text-shadow: 0 0 10rpx rgba(0, 242, 255, 0.3);
	}

	.news-item-meta {
		display: flex;
		justify-content: space-between;
		font-size: 24rpx;
		color: rgba(255, 255, 255, 0.7);
	}

	@keyframes gradientFlow {
		0% {
			background-position: 0% 50%;
		}

		50% {
			background-position: 100% 50%;
		}

		100% {
			background-position: 0% 50%;
		}
	}
</style>
