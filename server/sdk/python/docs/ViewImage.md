# ViewImage


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**view** | **str** | 视角: left / right / back | 
**image_base64** | **str** |  | [optional] 
**image_url** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.view_image import ViewImage

# TODO update the JSON string below
json = "{}"
# create an instance of ViewImage from a JSON string
view_image_instance = ViewImage.from_json(json)
# print the JSON string representation of the object
print(ViewImage.to_json())

# convert the object into a dict
view_image_dict = view_image_instance.to_dict()
# create an instance of ViewImage from a dict
view_image_from_dict = ViewImage.from_dict(view_image_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


