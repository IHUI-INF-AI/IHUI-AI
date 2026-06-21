# ImageToVideoBody

Image-to-video generation request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**model_name** | **str** |  | [optional] [default to 'kling-v1']
**image** | **str** | Image URL or base64 | 
**prompt** | **str** |  | [optional] 
**negative_prompt** | **str** |  | [optional] 
**duration** | **str** |  | [optional] [default to '5']
**mode** | **str** |  | [optional] [default to 'std']
**cfg_scale** | **float** |  | [optional] [default to 0.5]

## Example

```python
from zhs_api.models.image_to_video_body import ImageToVideoBody

# TODO update the JSON string below
json = "{}"
# create an instance of ImageToVideoBody from a JSON string
image_to_video_body_instance = ImageToVideoBody.from_json(json)
# print the JSON string representation of the object
print(ImageToVideoBody.to_json())

# convert the object into a dict
image_to_video_body_dict = image_to_video_body_instance.to_dict()
# create an instance of ImageToVideoBody from a dict
image_to_video_body_from_dict = ImageToVideoBody.from_dict(image_to_video_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


