# DeveloperLinkCreate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**user_id** | **str** |  | 
**coze_account_id** | **str** |  | [optional] 
**coze_account_name** | **str** |  | [optional] 
**status** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.developer_link_create import DeveloperLinkCreate

# TODO update the JSON string below
json = "{}"
# create an instance of DeveloperLinkCreate from a JSON string
developer_link_create_instance = DeveloperLinkCreate.from_json(json)
# print the JSON string representation of the object
print(DeveloperLinkCreate.to_json())

# convert the object into a dict
developer_link_create_dict = developer_link_create_instance.to_dict()
# create an instance of DeveloperLinkCreate from a dict
developer_link_create_from_dict = DeveloperLinkCreate.from_dict(developer_link_create_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


