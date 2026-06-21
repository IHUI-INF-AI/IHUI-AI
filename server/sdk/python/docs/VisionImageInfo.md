# VisionImageInfo

Single image entry for vision chat.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**image_url** | **str** | 图片URL | 
**width** | **int** |  | [optional] 
**height** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.vision_image_info import VisionImageInfo

# TODO update the JSON string below
json = "{}"
# create an instance of VisionImageInfo from a JSON string
vision_image_info_instance = VisionImageInfo.from_json(json)
# print the JSON string representation of the object
print(VisionImageInfo.to_json())

# convert the object into a dict
vision_image_info_dict = vision_image_info_instance.to_dict()
# create an instance of VisionImageInfo from a dict
vision_image_info_from_dict = VisionImageInfo.from_dict(vision_image_info_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


