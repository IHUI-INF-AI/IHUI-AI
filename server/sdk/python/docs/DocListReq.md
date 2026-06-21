# DocListReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**dataset_id** | **str** |  | 
**limit** | **int** |  | [optional] 
**offset** | **int** |  | [optional] 

## Example

```python
from zhs_api.models.doc_list_req import DocListReq

# TODO update the JSON string below
json = "{}"
# create an instance of DocListReq from a JSON string
doc_list_req_instance = DocListReq.from_json(json)
# print the JSON string representation of the object
print(DocListReq.to_json())

# convert the object into a dict
doc_list_req_dict = doc_list_req_instance.to_dict()
# create an instance of DocListReq from a dict
doc_list_req_from_dict = DocListReq.from_dict(doc_list_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


