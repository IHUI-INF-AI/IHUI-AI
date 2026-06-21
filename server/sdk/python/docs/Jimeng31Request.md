# Jimeng31Request

JiMeng 3.1 generation request.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** | Generation prompt | 

## Example

```python
from zhs_api.models.jimeng31_request import Jimeng31Request

# TODO update the JSON string below
json = "{}"
# create an instance of Jimeng31Request from a JSON string
jimeng31_request_instance = Jimeng31Request.from_json(json)
# print the JSON string representation of the object
print(Jimeng31Request.to_json())

# convert the object into a dict
jimeng31_request_dict = jimeng31_request_instance.to_dict()
# create an instance of Jimeng31Request from a dict
jimeng31_request_from_dict = Jimeng31Request.from_dict(jimeng31_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


