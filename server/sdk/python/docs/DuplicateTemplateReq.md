# DuplicateTemplateReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**template_id** | **str** |  | 
**workspace_id** | **str** |  | 
**name** | **str** |  | 

## Example

```python
from zhs_api.models.duplicate_template_req import DuplicateTemplateReq

# TODO update the JSON string below
json = "{}"
# create an instance of DuplicateTemplateReq from a JSON string
duplicate_template_req_instance = DuplicateTemplateReq.from_json(json)
# print the JSON string representation of the object
print(DuplicateTemplateReq.to_json())

# convert the object into a dict
duplicate_template_req_dict = duplicate_template_req_instance.to_dict()
# create an instance of DuplicateTemplateReq from a dict
duplicate_template_req_from_dict = DuplicateTemplateReq.from_dict(duplicate_template_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


