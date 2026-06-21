# ModelSearchReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**user_uuid** | **str** |  | 
**content** | **str** |  | 

## Example

```python
from zhs_api.models.model_search_req import ModelSearchReq

# TODO update the JSON string below
json = "{}"
# create an instance of ModelSearchReq from a JSON string
model_search_req_instance = ModelSearchReq.from_json(json)
# print the JSON string representation of the object
print(ModelSearchReq.to_json())

# convert the object into a dict
model_search_req_dict = model_search_req_instance.to_dict()
# create an instance of ModelSearchReq from a dict
model_search_req_from_dict = ModelSearchReq.from_dict(model_search_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


