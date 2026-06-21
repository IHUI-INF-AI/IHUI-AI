# OAuthAppCreateBody


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **str** |  | 
**redirect_uri** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.o_auth_app_create_body import OAuthAppCreateBody

# TODO update the JSON string below
json = "{}"
# create an instance of OAuthAppCreateBody from a JSON string
o_auth_app_create_body_instance = OAuthAppCreateBody.from_json(json)
# print the JSON string representation of the object
print(OAuthAppCreateBody.to_json())

# convert the object into a dict
o_auth_app_create_body_dict = o_auth_app_create_body_instance.to_dict()
# create an instance of OAuthAppCreateBody from a dict
o_auth_app_create_body_from_dict = OAuthAppCreateBody.from_dict(o_auth_app_create_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


