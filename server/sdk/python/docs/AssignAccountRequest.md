# AssignAccountRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **str** |  | 
**coze_id** | **str** |  | 

## Example

```python
from zhs_api.models.assign_account_request import AssignAccountRequest

# TODO update the JSON string below
json = "{}"
# create an instance of AssignAccountRequest from a JSON string
assign_account_request_instance = AssignAccountRequest.from_json(json)
# print the JSON string representation of the object
print(AssignAccountRequest.to_json())

# convert the object into a dict
assign_account_request_dict = assign_account_request_instance.to_dict()
# create an instance of AssignAccountRequest from a dict
assign_account_request_from_dict = AssignAccountRequest.from_dict(assign_account_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


