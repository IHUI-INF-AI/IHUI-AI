# ContextSaveRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**agent_id** | **str** |  | 
**context_key** | **str** |  | 
**context_value** | **str** |  | 
**field_name** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.context_save_request import ContextSaveRequest

# TODO update the JSON string below
json = "{}"
# create an instance of ContextSaveRequest from a JSON string
context_save_request_instance = ContextSaveRequest.from_json(json)
# print the JSON string representation of the object
print(ContextSaveRequest.to_json())

# convert the object into a dict
context_save_request_dict = context_save_request_instance.to_dict()
# create an instance of ContextSaveRequest from a dict
context_save_request_from_dict = ContextSaveRequest.from_dict(context_save_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


