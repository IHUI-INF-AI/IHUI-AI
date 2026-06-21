import { cozeZhsApiDashscopeImageGenerate, dashscopeImageEditSimple } from "@/service/aiModels.js"

export default {
    methods: {
        handleQwenImage(idstring, zidingyican) {
            const param = {
                ...this.modelConfigChangeData,
                user_uuid: this.userinfo.uuid,
                prompt: this.prompt,
                async_mode: true,
                chat_id: idstring,
                ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
            };

            cozeZhsApiDashscopeImageGenerate(param, this.remark).then(res => {
                this.setImgsList([]);
                if (res && res.image_url) {
                    res.actual_prompt = '';
                    const datas = res;
                    this.pushData(datas);
                    this.agent_content_list.push({
                        content: this.agent_content,
                        content1: this.agent_content1,
                        imgUrlList: [datas.image_url],
                        total_tokens: res.total_tokens || 0,
                        isHaveSikao: false
                    });
                    this.clearInput();
                } else if (res && res.data && res.data.output && res.data.output.results && res.data.output.results.length > 0) {
                    const datas = res.data.output.results[0];
                    this.pushData(datas);
                    this.agent_content_list.push({
                        content: this.agent_content,
                        content1: this.agent_content1,
                        imgUrlList: [datas.url],
                        total_tokens: 0
                    });
                    this.clearInput();
                } else {
                    this.agent_content_list.push({
                        content: '图片生成失败，请重试',
                        content1: '',
                        imgUrlList: [],
                        total_tokens: 0,
                        isHaveSikao: false
                    });
                    this.clearInput();
                }
            }).catch(error => {
                this.agent_content_list.push({
                    content: '图片生成失败，请重试',
                    content1: '',
                    imgUrlList: [],
                    total_tokens: 0,
                    isHaveSikao: false
                });
                this.clearInput();
            });
        },

        handleQwenImageEdit(idstring, zidingyican) {
            if (this.imgsList.length > 1) {
                uni.showToast({
                    title: '该模型只支持修改一张图片',
                    icon: 'none'
                });
            }
            const url = this.imgsList[0].imgUrl;
            const param = {
                images: url,
                image_url: url,
                prompt: this.prompt,
                edit_instruction: this.prompt,
                watermark: false,
                user_uuid: this.userinfo.uuid,
                model: this.modelNameEN,
                chat_id: idstring,
                ...(zidingyican && zidingyican.length > 0 ? { zidingyican } : {})
            };

            dashscopeImageEditSimple(param, this.remark).then(res => {
                this.setImgsList([]);
                this.thinkingProgress = 100;
                if (res && res.data && res.data.image) {
                    const newIndex = this.agent_content_list.length;
                    if (newIndex > 0) {
                        this.agent_content_list.splice(newIndex - 1, 1);
                    }
                    this.agent_content_list.push({
                        content: '',
                        content1: '',
                        imgUrlList: [res.data.image],
                        total_tokens: 0,
                        isHaveSikao: false
                    });
                    this.displayedTexts[newIndex] = '';
                    this.typeWriterAgentContent1('', '', newIndex, false);
                    this.clearInput();
                } else {
                    this.agent_content_list.push({
                        content: '图片编辑失败，请重试',
                        content1: '',
                        imgUrlList: [],
                        total_tokens: 0,
                        isHaveSikao: false
                    });
                    this.clearInput();
                }
            }).catch(error => {
                this.agent_content_list.push({
                    content: '图片编辑失败，请重试',
                    content1: '',
                    imgUrlList: [],
                    total_tokens: 0,
                    isHaveSikao: false
                });
                this.clearInput();
            });
        }
    }
}
