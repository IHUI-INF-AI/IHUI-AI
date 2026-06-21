# OverrideResumeRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**actor** | **str** | 操作者 | [optional] [default to 'api']
**reason** | **str** | 恢复原因 (审计可选) | [optional] [default to '']

## Example

```python
from zhs_api.models.override_resume_request import OverrideResumeRequest

# TODO update the JSON string below
json = "{}"
# create an instance of OverrideResumeRequest from a JSON string
override_resume_request_instance = OverrideResumeRequest.from_json(json)
# print the JSON string representation of the object
print(OverrideResumeRequest.to_json())

# convert the object into a dict
override_resume_request_dict = override_resume_request_instance.to_dict()
# create an instance of OverrideResumeRequest from a dict
override_resume_request_from_dict = OverrideResumeRequest.from_dict(override_resume_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


