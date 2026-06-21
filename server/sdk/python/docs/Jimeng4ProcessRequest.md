# Jimeng4ProcessRequest

JiMeng 4.0 CVProcess direct proxy request.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**req_key** | **str** |  | 

## Example

```python
from zhs_api.models.jimeng4_process_request import Jimeng4ProcessRequest

# TODO update the JSON string below
json = "{}"
# create an instance of Jimeng4ProcessRequest from a JSON string
jimeng4_process_request_instance = Jimeng4ProcessRequest.from_json(json)
# print the JSON string representation of the object
print(Jimeng4ProcessRequest.to_json())

# convert the object into a dict
jimeng4_process_request_dict = jimeng4_process_request_instance.to_dict()
# create an instance of Jimeng4ProcessRequest from a dict
jimeng4_process_request_from_dict = Jimeng4ProcessRequest.from_dict(jimeng4_process_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


