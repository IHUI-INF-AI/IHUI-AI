# UserPlatformBind


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**platform_id** | **int** |  | 
**account** | **str** |  | [optional] 
**remark** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.user_platform_bind import UserPlatformBind

# TODO update the JSON string below
json = "{}"
# create an instance of UserPlatformBind from a JSON string
user_platform_bind_instance = UserPlatformBind.from_json(json)
# print the JSON string representation of the object
print(UserPlatformBind.to_json())

# convert the object into a dict
user_platform_bind_dict = user_platform_bind_instance.to_dict()
# create an instance of UserPlatformBind from a dict
user_platform_bind_from_dict = UserPlatformBind.from_dict(user_platform_bind_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


