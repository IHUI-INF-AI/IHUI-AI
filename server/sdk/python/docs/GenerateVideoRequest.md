# GenerateVideoRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** | 视频描述提示 | 
**images** | **List[str]** | 参考图片URL列表 (图生视频) | [optional] 
**model** | **str** | 模型名称 | [optional] 
**aspect_ratio** | **str** | 宽高比 | [optional] 
**enhance_prompt** | **bool** | 是否增强提示词 | [optional] 
**enable_upsample** | **bool** | 是否启用上采样 | [optional] 

## Example

```python
from zhs_api.models.generate_video_request import GenerateVideoRequest

# TODO update the JSON string below
json = "{}"
# create an instance of GenerateVideoRequest from a JSON string
generate_video_request_instance = GenerateVideoRequest.from_json(json)
# print the JSON string representation of the object
print(GenerateVideoRequest.to_json())

# convert the object into a dict
generate_video_request_dict = generate_video_request_instance.to_dict()
# create an instance of GenerateVideoRequest from a dict
generate_video_request_from_dict = GenerateVideoRequest.from_dict(generate_video_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


