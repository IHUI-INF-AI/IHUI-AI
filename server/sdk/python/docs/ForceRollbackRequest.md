# ForceRollbackRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**actor** | **str** | 操作者 | [optional] [default to 'api']
**reason** | **str** | 强制回滚原因 (审计必填) | 

## Example

```python
from zhs_api.models.force_rollback_request import ForceRollbackRequest

# TODO update the JSON string below
json = "{}"
# create an instance of ForceRollbackRequest from a JSON string
force_rollback_request_instance = ForceRollbackRequest.from_json(json)
# print the JSON string representation of the object
print(ForceRollbackRequest.to_json())

# convert the object into a dict
force_rollback_request_dict = force_rollback_request_instance.to_dict()
# create an instance of ForceRollbackRequest from a dict
force_rollback_request_from_dict = ForceRollbackRequest.from_dict(force_rollback_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


