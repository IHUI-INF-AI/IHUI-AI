# GenerateMusicRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** | 音乐描述 / 歌词提示 | 
**mv** | **str** | 模型版本, e.g. v3.5, v4 | [optional] 
**style** | **str** | 音乐风格, e.g. pop, rock, jazz | [optional] 
**title** | **str** | 歌曲标题 | [optional] 
**duration** | **int** | 时长(秒) | [optional] 
**instrumental** | **bool** | 是否纯音乐(无人声) | [optional] 

## Example

```python
from zhs_api.models.generate_music_request import GenerateMusicRequest

# TODO update the JSON string below
json = "{}"
# create an instance of GenerateMusicRequest from a JSON string
generate_music_request_instance = GenerateMusicRequest.from_json(json)
# print the JSON string representation of the object
print(GenerateMusicRequest.to_json())

# convert the object into a dict
generate_music_request_dict = generate_music_request_instance.to_dict()
# create an instance of GenerateMusicRequest from a dict
generate_music_request_from_dict = GenerateMusicRequest.from_dict(generate_music_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


