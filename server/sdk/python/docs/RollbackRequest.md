# RollbackRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**actor** | **str** | 操作者 | [optional] [default to 'api']
**reason** | **str** | 原因 | [optional] [default to '']
**auto** | **bool** | 是否自动回滚 | [optional] [default to False]

## Example

```python
from zhs_api.models.rollback_request import RollbackRequest

# TODO update the JSON string below
json = "{}"
# create an instance of RollbackRequest from a JSON string
rollback_request_instance = RollbackRequest.from_json(json)
# print the JSON string representation of the object
print(RollbackRequest.to_json())

# convert the object into a dict
rollback_request_dict = rollback_request_instance.to_dict()
# create an instance of RollbackRequest from a dict
rollback_request_from_dict = RollbackRequest.from_dict(rollback_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


