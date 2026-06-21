# AppApiV1AiDashscopeRouteImageGenerateBody

Image generation request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** | Text prompt for image generation | 
**negative_prompt** | **str** | Negative prompt | [optional] 
**size** | **str** | Image size, e.g. 1024*1024 | [optional] 
**n** | **int** | Number of images to generate | [optional] 
**style** | **str** | Style preset | [optional] 
**sync** | **bool** | If true, poll until the task completes and return image URLs directly | [optional] [default to False]
**zidingyican** | **List[Dict[str, object]]** | Extra custom parameters as name/value pairs | [optional] 

## Example

```python
from zhs_api.models.app_api_v1_ai_dashscope_route_image_generate_body import AppApiV1AiDashscopeRouteImageGenerateBody

# TODO update the JSON string below
json = "{}"
# create an instance of AppApiV1AiDashscopeRouteImageGenerateBody from a JSON string
app_api_v1_ai_dashscope_route_image_generate_body_instance = AppApiV1AiDashscopeRouteImageGenerateBody.from_json(json)
# print the JSON string representation of the object
print(AppApiV1AiDashscopeRouteImageGenerateBody.to_json())

# convert the object into a dict
app_api_v1_ai_dashscope_route_image_generate_body_dict = app_api_v1_ai_dashscope_route_image_generate_body_instance.to_dict()
# create an instance of AppApiV1AiDashscopeRouteImageGenerateBody from a dict
app_api_v1_ai_dashscope_route_image_generate_body_from_dict = AppApiV1AiDashscopeRouteImageGenerateBody.from_dict(app_api_v1_ai_dashscope_route_image_generate_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


