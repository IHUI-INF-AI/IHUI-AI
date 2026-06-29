<template>
    <view class="drawer_back" v-if="drawerVisible">
        <view class="drawer_back" style="background-color: rgb(0 0 0 / 0.4);" @click="close_drawer"></view>
        <view class="drawer_border" :class="{ 'drawer-open': drawerVisible }">
            <view class="drawer" :style="{paddingTop:statusBarHeight}">
                <view class="drawer-header">
                    <view class="logobox">
                    <image class="logo" style="height: 66rpx;" src="/static/images/guanlogo.png" mode="widthFix" />
                    <view class="titlebox">
                        <image class="titlebox-image" style="" src="/static/images/loginengtexta.png" mode="widthFix"></image>
                        <image class="titlebox-image1" style="" src="/static/images/loginzhtext.png" mode="widthFix"></image>
                    </view>
                    </view>
                </view>
                <view class="drawer-menu1" v-if="type == 1">
                    <view v-for="(item, index) in drawerList" :key="index" class="menu-item1"
                        @click="handleDrawerClick(item)" :class="{ 'item_selected1': selected.showName == item.showName }">
                        <view class="item_content1">
                            <view class="menu_text">{{ item.showName }}</view>
                        </view>
                    </view>
                </view>
                <view class="drawer-menu2" v-if="type == 2">
                    <view v-for="(item, index) in drawerList" :key="index" class="menu-item2"
                        @click="handleDrawerClick(item)" :class="{ 'item_selected2': selected.code == item.code }">
                        <view class="item_content2">
                            <image v-if="selected.code != item.code && item.code == 'new'" class="drawer_icon"
                                src="/static/images/group_new.png" mode="widthFix" />
                            <image v-if="selected.code == item.code && item.code == 'new'" class="drawer_icon"
                                src="/static/images/group_new_click.png" mode="widthFix" />
                            <image v-if="selected.code != item.code && item.code == 'old'" class="drawer_icon"
                                src="/static/images/group_old.png" mode="widthFix" />
                            <image v-if="selected.code == item.code && item.code == 'old'" class="drawer_icon"
                                src="/static/images/group_old_click.png" mode="widthFix" />
                            <image v-if="item.code != 'old' && item.code != 'new' && selected.code != item.code" class="drawer_icon"
                                :src="item.field1" mode="widthFix" />
                            <image v-if="item.code != 'old' && item.code != 'new' && selected.code == item.code" class="drawer_icon"
                                :src="item.butUrl" mode="widthFix" />
                            <view class="menu_text" :class="{ 'menu_clicked_text': selected.code == item.code }">{{
                                item.showName }}</view>
                        </view>
                    </view>
                </view>

            </view>
        </view>
    </view>
</template>
<script setup>
import { watch } from 'vue'

const props = defineProps({
    drawerVisible: {
        type: Boolean,
        default: false
    },
    drawerList: {
        type: Array,
        default: () => []
    },
    selected: {
        type: Object,
        default: () => ({})
    },
    type: {
        type: Number,
        default: 2
    },
    statusBarHeight: String,
})

const emit = defineEmits(['handleConfigClicka', 'handleDrawerClick'])

watch(() => props.selected, (n) => {
})

function close_drawer() {
    emit('handleConfigClicka')
}

function handleDrawerClick(item) {
    emit('handleDrawerClick', item)
}
</script>
<style lang="scss" scoped>
.drawer_bg {
    position: fixed;
    top: 0;
    left: -300rpx;
    width: 300rpx;
    height: 100%;
    z-index: 999;
    transition: transform 0.3s ease;
    background-image: linear-gradient(307deg,
            rgb(209 158 255 / 0.7) -2%,
            rgb(209 158 255 / 0.7) -2%,
            rgb(209 158 255 / 0.7) -2%,
            rgb(211 161 223 / 0.6389) 32%,
            rgb(206 151 251 / 0.6925) 41%,
            rgb(255 242 0 / 0.21) 88%);
    padding: 0 2rpx 0 0;
    border-width: 0;
    margin: 0;

    .drawer_body {
        border: none;
        margin: none;
        background-color: #fff;
        position: absolute;
        top: 0;
        left: 0;
        height: 100vh;
        width: 300rpx;
    }

    &.drawer-open {
        transform: translateX(300rpx);
    }
}

.drawer-header {
    position: relative;
    height: auto;

    &::after{
        display: block;
        position: absolute;
        bottom: -20rpx;
        border-bottom: 1px solid #f4f4f4;
        width: calc(100% - 30rpx);
        left: 15rpx;
        content: "";
    }

    .drawer-image {
        width: 100rpx;
        height: 100rpx;
        margin: 54rpx auto 0;
        display: block;
    }

    .drawer-image1 {
        width: 100rpx;
        height: 100rpx;
        margin: 10rpx auto 0;
        display: block;
    }

    .drawer-image2 {
        width: 100rpx;
        height: 100rpx;
        margin: 10rpx auto 0;
        display: block;
    }

    .drawer-close {
        position: absolute;
        top: 40rpx;
        right: 40rpx;
        width: 40rpx;
        height: 40rpx;

        .drawer-close-image {
            width: 100%;
            height: 100%;
        }
    }
}

.drawer-menu1 {
    margin: 60rpx 0;
    padding-left: 40rpx;
    height: calc(100vh - 300rpx);
    overflow-y: scroll;
    box-sizing: border-box;
    border-width: 0 6rpx 0 0;
    border-style: solid;
    border-image: linear-gradient(307deg,
            rgb(209 158 255 / 0.7) -2%,
            rgb(209 158 255 / 0.7) -2%,
            rgb(209 158 255 / 0.7) -2%,
            rgb(211 161 223 / 0.6389) 32%,
            rgb(206 151 251 / 0.6925) 41%,
            rgb(255 242 0 / 0.21) 88%) 4 4 4 4;

    .menu-item1 {
        display: flex;
        align-items: center;
        padding: 2rpx 0 2rpx 2rpx;
        box-sizing: border-box;
        border-style: solid;
        border-radius: 15px 0 0 15px;
        overflow: hidden;
        margin: 0 !important;

        .item_content1 {
            width: 100%;
            height: 100%;
            background-color: #fff;
            padding: 30rpx;
            border-radius: 20rpx 0 0 20rpx;
        }

        &.item_selected1 {
            background-image: linear-gradient(307deg,
                    rgb(209 158 255 / 0.7) -2%,
                    rgb(209 158 255 / 0.7) -2%,
                    rgb(209 158 255 / 0.7) -2%,
                    rgb(211 161 223 / 0.6389) 32%,
                    rgb(206 151 251 / 0.6925) 41%,
                    rgb(255 242 0 / 0.21) 88%);
        }
    }

}

.drawer-menu2 {
    margin: 30rpx 0;
    height: calc(100vh - 250rpx);
    overflow-y: scroll;
    box-sizing: border-box;
    border: none;

    .menu-item2 {
        display: flex;
        align-items: center;
        padding: 2rpx 0 2rpx 2rpx;
        border-radius: 15px 0 0 15px;
        position: relative;
        border-width: 0;
        width: 100%;
        height: 85rpx;
        margin-left: 40rpx;
        box-sizing: border-box;

        .item_content2 {
            width: 100%;
            height: 100%;
            background-color: #fff;
            padding: 10rpx 20rpx;
            border-radius: 30rpx 0 0 30rpx;
            display: flex;
            align-items: center;
            box-sizing: border-box;
        }

        &.item_selected2 {
            background-image: linear-gradient(307deg,
                    rgb(209 158 255 / 0.7) -2%,
                    rgb(209 158 255 / 0.7) -2%,
                    rgb(209 158 255 / 0.7) -2%,
                    rgb(211 161 223 / 0.6389) 32%,
                    rgb(206 151 251 / 0.6925) 41%,
                    rgb(255 242 0 / 0.21) 88%);
            width: calc(100% + 4rpx) !important;

            .item_content2{
                background-color: #ebebeb;
            }
        }

    }

}

.drawer_icon {
    width: 40rpx;
    height: 40rpx;
    margin-right: 15rpx;
}

.menu_text {
    font-size: 24rpx;
    color: #333;
    font-weight: 500;
    font-family: AlimamaFangYuanTi !important;
}

.menu_clicked_text {
    color: #8389FF !important;
    font-weight: bold;
}


.logobox {
  padding-top: 40rpx;
  display: flex;
  justify-content: center;
  align-items: center;
}

.logo {
  width: 110rpx;
  height: 160rpx;
}

.input-wbox {
  width: 100%;
  display: flex;
  justify-content: center;
}


.titlebox {
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;
}

.titlebox-image {
  margin-top: 0;
  width: 110rpx;
  height: 37rpx;
}

.titlebox-image1 {
  margin-top: 18rpx;
  width: 112rpx;
  height: 66rpx;
}

.top_box {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding-top: 30%;
}

.drawer-header{
  .logobox {
    padding: 9rpx 0;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .logo {
    width: 66rpx;
    height: 66rpx;
    margin-right: 12rpx;
  }

  .input-wbox {
    width: 100%;
    display: flex;
    justify-content: center;
  }


  .titlebox {
    display: flex;
    justify-content: center;
    flex-direction: column;
    align-items: center;
  }

  .titlebox-image {
    margin-top: 0;
    width: 160rpx;
    height: 37rpx;
  }

  .titlebox-image1 {
    margin-top: 8rpx;
    width: 162rpx;
    height: 66rpx;
  }

  .top_box {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding-top: 30%;
  }

}

.drawer_back{
	position: fixed;
	inset: 0;
	z-index: 1005;
}

.drawer_border{
	position: fixed;
	top: 6rpx;
	bottom: 6rpx;
	left: -500rpx;
	width: 274rpx;
	z-index: 1006;
	transition: transform 0.3s ease;
	padding: 0;
	box-sizing: border-box;
	border-radius: 30rpx;

	&.drawer-open {
		transform: translateX(506rpx);
	}
}

.drawer {
	background-color: #fff;
	border-radius: 30rpx;
	height: calc(100%);
	width: calc(100%);
	padding: 0;
	box-sizing: border-box;
	position: relative;
    border: 4rpx solid #7d83fd;
}
</style>
