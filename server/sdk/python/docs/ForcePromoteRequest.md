# ForcePromoteRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**actor** | **str** | 操作者 | [optional] [default to 'api']
**reason** | **str** | 强制推进原因 (审计必填) | 

## Example

```python
from zhs_api.models.force_promote_request import ForcePromoteRequest

# TODO update the JSON string below
json = "{}"
# create an instance of ForcePromoteRequest from a JSON string
force_promote_request_instance = ForcePromoteRequest.from_json(json)
# print the JSON string representation of the object
print(ForcePromoteRequest.to_json())

# convert the object into a dict
force_promote_request_dict = force_promote_request_instance.to_dict()
# create an instance of ForcePromoteRequest from a dict
force_promote_request_from_dict = ForcePromoteRequest.from_dict(force_promote_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


