# DeveloperLinkUpdate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **int** |  | 
**user_id** | **str** |  | [optional] 
**coze_account_id** | **str** |  | [optional] 
**coze_account_name** | **str** |  | [optional] 
**status** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.developer_link_update import DeveloperLinkUpdate

# TODO update the JSON string below
json = "{}"
# create an instance of DeveloperLinkUpdate from a JSON string
developer_link_update_instance = DeveloperLinkUpdate.from_json(json)
# print the JSON string representation of the object
print(DeveloperLinkUpdate.to_json())

# convert the object into a dict
developer_link_update_dict = developer_link_update_instance.to_dict()
# create an instance of DeveloperLinkUpdate from a dict
developer_link_update_from_dict = DeveloperLinkUpdate.from_dict(developer_link_update_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


