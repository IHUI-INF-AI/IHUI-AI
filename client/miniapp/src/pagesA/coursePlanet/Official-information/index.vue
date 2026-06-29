/* 官方资讯
*/
<template>
	<view class="main-container" style="color: white">
		<!-- 引入 顶部导航栏 -->
		<navigation-bars color="black" title="官方资讯" :viscosity="true" @pack="packClick" :backgroundColor="color"
			:image="image" />

		<!-- 以下为内容 -->
		<ai-text ref="aiText" :information="detail"></ai-text>
	</view>
</template>

<script setup>
	import { ref, onMounted } from 'vue'
	import { onLoad, onPageScroll } from '@dcloudio/uni-app'
	import NavigationBars from '@/components/navigation-bars/index.vue'
	import aiText from './ai-text.vue'
	import {
		plantInformation
	} from '@/service/index.js'

	const parentId = ref('')
	const id = ref('')
	const type = ref('')
	const color = ref('')
	const image = ref('https://file.aizhs.top/sys-mini/default/back.svg')
	const plantInformationData = ref({
		title: '',
		tag: '',
		view: '',
		date: '',
		img: '',
		content: ''
	})
	const detail = ref({})
	const scrollTop = ref(0)
	const aiTextRef = ref(null)

	onPageScroll((e) => {
		scrollTop.value = e.scrollTop
		color.value = e.scrollTop > 20 ? "white" : "transparent"
	})

	onLoad((options) => {
		postPlantInformation(options.id)
	})

	/**返回 */
	function packClick() {
		uni.navigateBack({
			delta: 1,
		})
	}

	/**查询资讯详情 */
	function postPlantInformation(plantId) {
		plantInformation(plantId)
			.then(res => {
				if (res.data) {
					if (res.data) {
						detail.value = res.data[0]
					}
				}
			})
			.catch(err => {
			})
	}
</script>

<style scoped>
	.main-container {
		min-height: 100vh;
		padding-bottom: 40rpx;
		background-image: url("https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/ai_agent/12071746256773_.pic.jpg");
		background-size: cover;
		background-repeat: no-repeat;
		position: relative;

	}
</style>