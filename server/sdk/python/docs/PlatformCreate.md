# PlatformCreate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**code** | **str** |  | 
**name** | **str** |  | 
**domain** | **str** |  | [optional] 
**remark** | **str** |  | [optional] 
**binding** | **str** |  | [optional] 
**file_path** | **str** |  | [optional] 
**type** | **int** |  | [optional] 
**status** | **int** |  | [optional] [default to 1]
**sort** | **int** |  | [optional] [default to 0]

## Example

```python
from zhs_api.models.platform_create import PlatformCreate

# TODO update the JSON string below
json = "{}"
# create an instance of PlatformCreate from a JSON string
platform_create_instance = PlatformCreate.from_json(json)
# print the JSON string representation of the object
print(PlatformCreate.to_json())

# convert the object into a dict
platform_create_dict = platform_create_instance.to_dict()
# create an instance of PlatformCreate from a dict
platform_create_from_dict = PlatformCreate.from_dict(platform_create_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


