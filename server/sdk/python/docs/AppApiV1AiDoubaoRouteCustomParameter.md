# AppApiV1AiDoubaoRouteCustomParameter

Custom parameter model for image/video generation.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **str** | Parameter name | 
**desc** | **str** | Parameter description | 
**value** | **object** |  | 

## Example

```python
from zhs_api.models.app_api_v1_ai_doubao_route_custom_parameter import AppApiV1AiDoubaoRouteCustomParameter

# TODO update the JSON string below
json = "{}"
# create an instance of AppApiV1AiDoubaoRouteCustomParameter from a JSON string
app_api_v1_ai_doubao_route_custom_parameter_instance = AppApiV1AiDoubaoRouteCustomParameter.from_json(json)
# print the JSON string representation of the object
print(AppApiV1AiDoubaoRouteCustomParameter.to_json())

# convert the object into a dict
app_api_v1_ai_doubao_route_custom_parameter_dict = app_api_v1_ai_doubao_route_custom_parameter_instance.to_dict()
# create an instance of AppApiV1AiDoubaoRouteCustomParameter from a dict
app_api_v1_ai_doubao_route_custom_parameter_from_dict = AppApiV1AiDoubaoRouteCustomParameter.from_dict(app_api_v1_ai_doubao_route_custom_parameter_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


