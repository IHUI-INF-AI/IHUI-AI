<template>
  <div class="link-box">
    <div>
      <Radio v-model="itemObj.linkType" value="0" @change="linkTypeChange">无</Radio>
      <Radio v-model="itemObj.linkType" value="1" @change="linkTypeChange">链接</Radio>
    </div>
    <div v-if="itemObj.linkType !== '0'">
      <Input v-model="itemObj.link" class="input" @change="linkChange" placeholder="请输入链接地址"/>
    </div>
  </div>
</template>

<script>
import {computed} from "vue";
import { Input } from '@/components/ui/input'
import { Radio } from '@/components/ui/radio'

export default {
  name: "CarouselChoiceLink",
  components: {
    Radio,
    Input
  },
  props: {
    index: {
      type: Number,
      default: 0
    },
    item: {
      type: Object,
      default: () => {
        return {
          title: "",
          imageUrl: "",
          linkType: "0",
          link: ""
        }
      }
    },
  },
  setup(props, context) {
    const itemObj = computed({
      get() {
        return props.item;
      },
      set(val) {
        context.emit('update:item', val);
      },
    });
    const linkTypeChange = (val) => {
      context.emit("change-link-type", props.index, val)
    }
    const linkChange = (val) => {
      context.emit("change-link", props.index, val)
    }
    return {
      linkTypeChange,
      linkChange,
      itemObj
    }
  }
}
</script>

<style lang="scss" scoped>
.link-box {
  margin: 0 20px 20px 20px;
  box-sizing: border-box;
  font-size: 14px;
  justify-content: space-between;
  .input {
    margin: 20px 0 0 0;
  }
}
</style>
