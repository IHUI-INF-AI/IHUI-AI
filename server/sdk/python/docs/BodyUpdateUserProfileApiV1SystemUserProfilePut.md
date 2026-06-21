# BodyUpdateUserProfileApiV1SystemUserProfilePut


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**nick_name** | **str** |  | [optional] 
**email** | **str** |  | [optional] 
**phone** | **str** |  | [optional] 
**sex** | **str** | 0&#x3D;男 1&#x3D;女 2&#x3D;未知 | [optional] 
**remark** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.body_update_user_profile_api_v1_system_user_profile_put import BodyUpdateUserProfileApiV1SystemUserProfilePut

# TODO update the JSON string below
json = "{}"
# create an instance of BodyUpdateUserProfileApiV1SystemUserProfilePut from a JSON string
body_update_user_profile_api_v1_system_user_profile_put_instance = BodyUpdateUserProfileApiV1SystemUserProfilePut.from_json(json)
# print the JSON string representation of the object
print(BodyUpdateUserProfileApiV1SystemUserProfilePut.to_json())

# convert the object into a dict
body_update_user_profile_api_v1_system_user_profile_put_dict = body_update_user_profile_api_v1_system_user_profile_put_instance.to_dict()
# create an instance of BodyUpdateUserProfileApiV1SystemUserProfilePut from a dict
body_update_user_profile_api_v1_system_user_profile_put_from_dict = BodyUpdateUserProfileApiV1SystemUserProfilePut.from_dict(body_update_user_profile_api_v1_system_user_profile_put_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


