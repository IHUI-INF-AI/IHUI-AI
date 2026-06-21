# BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**uuid** | **str** | User UUID | 
**platform** | **str** | Platform name (wechat, google, alipay, feishu) | 

## Example

```python
from zhs_api.models.body_remove_by_platform_api_v1_auth_auth_bindings_remove_post import BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost

# TODO update the JSON string below
json = "{}"
# create an instance of BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost from a JSON string
body_remove_by_platform_api_v1_auth_auth_bindings_remove_post_instance = BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost.from_json(json)
# print the JSON string representation of the object
print(BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost.to_json())

# convert the object into a dict
body_remove_by_platform_api_v1_auth_auth_bindings_remove_post_dict = body_remove_by_platform_api_v1_auth_auth_bindings_remove_post_instance.to_dict()
# create an instance of BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost from a dict
body_remove_by_platform_api_v1_auth_auth_bindings_remove_post_from_dict = BodyRemoveByPlatformApiV1AuthAuthBindingsRemovePost.from_dict(body_remove_by_platform_api_v1_auth_auth_bindings_remove_post_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


