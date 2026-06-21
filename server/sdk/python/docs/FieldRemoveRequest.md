# FieldRemoveRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**agent_id** | **str** |  | 
**field_name** | **str** |  | 

## Example

```python
from zhs_api.models.field_remove_request import FieldRemoveRequest

# TODO update the JSON string below
json = "{}"
# create an instance of FieldRemoveRequest from a JSON string
field_remove_request_instance = FieldRemoveRequest.from_json(json)
# print the JSON string representation of the object
print(FieldRemoveRequest.to_json())

# convert the object into a dict
field_remove_request_dict = field_remove_request_instance.to_dict()
# create an instance of FieldRemoveRequest from a dict
field_remove_request_from_dict = FieldRemoveRequest.from_dict(field_remove_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


