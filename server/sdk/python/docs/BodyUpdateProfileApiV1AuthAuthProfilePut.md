# BodyUpdateProfileApiV1AuthAuthProfilePut


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**nickname** | **str** |  | [optional] 
**email** | **str** |  | [optional] 
**gender** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.body_update_profile_api_v1_auth_auth_profile_put import BodyUpdateProfileApiV1AuthAuthProfilePut

# TODO update the JSON string below
json = "{}"
# create an instance of BodyUpdateProfileApiV1AuthAuthProfilePut from a JSON string
body_update_profile_api_v1_auth_auth_profile_put_instance = BodyUpdateProfileApiV1AuthAuthProfilePut.from_json(json)
# print the JSON string representation of the object
print(BodyUpdateProfileApiV1AuthAuthProfilePut.to_json())

# convert the object into a dict
body_update_profile_api_v1_auth_auth_profile_put_dict = body_update_profile_api_v1_auth_auth_profile_put_instance.to_dict()
# create an instance of BodyUpdateProfileApiV1AuthAuthProfilePut from a dict
body_update_profile_api_v1_auth_auth_profile_put_from_dict = BodyUpdateProfileApiV1AuthAuthProfilePut.from_dict(body_update_profile_api_v1_auth_auth_profile_put_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


