# FileUploadBody


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**file_name** | **str** |  | 
**file_path** | **str** |  | 
**file_size** | **int** |  | [optional] 
**file_type** | **str** |  | [optional] 
**bucket** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.file_upload_body import FileUploadBody

# TODO update the JSON string below
json = "{}"
# create an instance of FileUploadBody from a JSON string
file_upload_body_instance = FileUploadBody.from_json(json)
# print the JSON string representation of the object
print(FileUploadBody.to_json())

# convert the object into a dict
file_upload_body_dict = file_upload_body_instance.to_dict()
# create an instance of FileUploadBody from a dict
file_upload_body_from_dict = FileUploadBody.from_dict(file_upload_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


