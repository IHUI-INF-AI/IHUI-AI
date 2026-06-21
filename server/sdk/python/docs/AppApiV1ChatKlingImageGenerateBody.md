# AppApiV1ChatKlingImageGenerateBody

Text-to-image generation request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** |  | 
**model_name** | **str** |  | [optional] [default to 'kling-v1']
**n** | **int** |  | [optional] [default to 1]
**aspect_ratio** | **str** |  | [optional] [default to '1:1']
**negative_prompt** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.app_api_v1_chat_kling_image_generate_body import AppApiV1ChatKlingImageGenerateBody

# TODO update the JSON string below
json = "{}"
# create an instance of AppApiV1ChatKlingImageGenerateBody from a JSON string
app_api_v1_chat_kling_image_generate_body_instance = AppApiV1ChatKlingImageGenerateBody.from_json(json)
# print the JSON string representation of the object
print(AppApiV1ChatKlingImageGenerateBody.to_json())

# convert the object into a dict
app_api_v1_chat_kling_image_generate_body_dict = app_api_v1_chat_kling_image_generate_body_instance.to_dict()
# create an instance of AppApiV1ChatKlingImageGenerateBody from a dict
app_api_v1_chat_kling_image_generate_body_from_dict = AppApiV1ChatKlingImageGenerateBody.from_dict(app_api_v1_chat_kling_image_generate_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


