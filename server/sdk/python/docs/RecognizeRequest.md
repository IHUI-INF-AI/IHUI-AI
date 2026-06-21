# RecognizeRequest

ASR request body — accepts a URL or base64-encoded audio.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**audio_url** | **str** | 音频文件URL | [optional] 
**audio_base64** | **str** | 音频文件Base64编码 (mp3/wav/pcm) | [optional] 
**model** | **str** | ASR模型: paraformer-v2 / qwen3-asr-flash | [optional] [default to 'paraformer-v2']
**language** | **str** | 语言代码: zh / en 等，留空自动检测 | [optional] 
**sample_rate** | **int** | 采样率 (仅PCM格式需要) | [optional] 

## Example

```python
from zhs_api.models.recognize_request import RecognizeRequest

# TODO update the JSON string below
json = "{}"
# create an instance of RecognizeRequest from a JSON string
recognize_request_instance = RecognizeRequest.from_json(json)
# print the JSON string representation of the object
print(RecognizeRequest.to_json())

# convert the object into a dict
recognize_request_dict = recognize_request_instance.to_dict()
# create an instance of RecognizeRequest from a dict
recognize_request_from_dict = RecognizeRequest.from_dict(recognize_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


