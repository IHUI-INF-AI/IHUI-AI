# ContactIn


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **str** |  | [optional] 
**content** | **str** |  | [optional] 
**sort_order** | **int** |  | [optional] 
**status** | **str** |  | [optional] 
**remark** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.contact_in import ContactIn

# TODO update the JSON string below
json = "{}"
# create an instance of ContactIn from a JSON string
contact_in_instance = ContactIn.from_json(json)
# print the JSON string representation of the object
print(ContactIn.to_json())

# convert the object into a dict
contact_in_dict = contact_in_instance.to_dict()
# create an instance of ContactIn from a dict
contact_in_from_dict = ContactIn.from_dict(contact_in_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


