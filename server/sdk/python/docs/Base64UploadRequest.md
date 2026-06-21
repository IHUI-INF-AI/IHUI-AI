# Base64UploadRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**file_name** | **str** |  | 
**var_base64** | **str** |  | 

## Example

```python
from zhs_api.models.base64_upload_request import Base64UploadRequest

# TODO update the JSON string below
json = "{}"
# create an instance of Base64UploadRequest from a JSON string
base64_upload_request_instance = Base64UploadRequest.from_json(json)
# print the JSON string representation of the object
print(Base64UploadRequest.to_json())

# convert the object into a dict
base64_upload_request_dict = base64_upload_request_instance.to_dict()
# create an instance of Base64UploadRequest from a dict
base64_upload_request_from_dict = Base64UploadRequest.from_dict(base64_upload_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


