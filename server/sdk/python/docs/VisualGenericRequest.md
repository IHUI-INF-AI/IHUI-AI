# VisualGenericRequest

Generic visual proxy request body — supports async submit+poll with token deduction.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** | Generation prompt | 
**images** | **List[str]** | Image URLs for i2v tasks | [optional] 
**user_uuid** | **str** | User UUID | 
**chat_id** | **str** | Chat context ID | [optional] 
**first** | **bool** | Whether first-frame generation | [optional] [default to True]
**zidingyican** | [**List[AppApiV1AiDoubaoRouteCustomParameter]**](AppApiV1AiDoubaoRouteCustomParameter.md) | Custom parameters | [optional] 

## Example

```python
from zhs_api.models.visual_generic_request import VisualGenericRequest

# TODO update the JSON string below
json = "{}"
# create an instance of VisualGenericRequest from a JSON string
visual_generic_request_instance = VisualGenericRequest.from_json(json)
# print the JSON string representation of the object
print(VisualGenericRequest.to_json())

# convert the object into a dict
visual_generic_request_dict = visual_generic_request_instance.to_dict()
# create an instance of VisualGenericRequest from a dict
visual_generic_request_from_dict = VisualGenericRequest.from_dict(visual_generic_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


