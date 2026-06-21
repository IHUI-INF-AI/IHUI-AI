# AudioRecognizeRequest

Audio recognition request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**audio_url** | **str** | 音频文件URL | 
**model** | **str** | 语音识别模型名称 | [optional] [default to 'qwen3-asr-flash']
**language** | **str** | 音频语言代码，如 zh / en；留空自动检测 | [optional] 
**enable_lid** | **bool** | 启用语言检测 | [optional] [default to True]
**enable_itn** | **bool** | 启用逆文本标准化 | [optional] [default to False]
**system_prompt** | **str** | 系统提示词 | [optional] [default to '']
**user_uuid** | **str** | 用户UUID（兼容字段） | [optional] 
**user_id** | **str** | 用户ID（兼容字段） | [optional] 
**chat_id** | **str** | 对话ID | [optional] 
**conversation_id** | **str** | 对话ID（兼容字段） | [optional] 
**asr_options** | **Dict[str, object]** | ASR选项（兼容字段，优先于 enable_lid/enable_itn/language） | [optional] 

## Example

```python
from zhs_api.models.audio_recognize_request import AudioRecognizeRequest

# TODO update the JSON string below
json = "{}"
# create an instance of AudioRecognizeRequest from a JSON string
audio_recognize_request_instance = AudioRecognizeRequest.from_json(json)
# print the JSON string representation of the object
print(AudioRecognizeRequest.to_json())

# convert the object into a dict
audio_recognize_request_dict = audio_recognize_request_instance.to_dict()
# create an instance of AudioRecognizeRequest from a dict
audio_recognize_request_from_dict = AudioRecognizeRequest.from_dict(audio_recognize_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


