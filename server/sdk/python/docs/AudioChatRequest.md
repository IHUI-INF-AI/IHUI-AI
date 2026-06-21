# AudioChatRequest

Audio chat request — voice or text input, returns text + audio.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**text** | **str** | 文本输入（可选，与audio_base64二选一） | [optional] 
**audio_base64** | **str** | 音频Base64编码（可选，与text二选一） | [optional] 
**audio_url** | **str** | 音频URL（可选） | [optional] 
**bot_id** | **str** | Coze机器人ID（可选，不提供则使用默认AI） | [optional] 
**voice_id** | **str** | 回复音色ID | [optional] [default to 'longxiaochun']
**model** | **str** | 对话模型名称 | [optional] [default to 'qwen-turbo']
**language** | **str** | 语言 | [optional] [default to 'zh-CN']
**system_prompt** | **str** | 系统提示词 | [optional] 

## Example

```python
from zhs_api.models.audio_chat_request import AudioChatRequest

# TODO update the JSON string below
json = "{}"
# create an instance of AudioChatRequest from a JSON string
audio_chat_request_instance = AudioChatRequest.from_json(json)
# print the JSON string representation of the object
print(AudioChatRequest.to_json())

# convert the object into a dict
audio_chat_request_dict = audio_chat_request_instance.to_dict()
# create an instance of AudioChatRequest from a dict
audio_chat_request_from_dict = AudioChatRequest.from_dict(audio_chat_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


