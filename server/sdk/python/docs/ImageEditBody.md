# ImageEditBody

Image edit request body (standard, with optional mask).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**base_image_url** | **str** | URL of the base image to edit | 
**mask_image_url** | **str** | URL of the mask image (white &#x3D; area to edit) | [optional] 
**prompt** | **str** | Editing instruction | 
**model** | **str** | Model name, e.g. wanx-v1, wanx2.1-image-edit | [optional] [default to 'wanx-v1']

## Example

```python
from zhs_api.models.image_edit_body import ImageEditBody

# TODO update the JSON string below
json = "{}"
# create an instance of ImageEditBody from a JSON string
image_edit_body_instance = ImageEditBody.from_json(json)
# print the JSON string representation of the object
print(ImageEditBody.to_json())

# convert the object into a dict
image_edit_body_dict = image_edit_body_instance.to_dict()
# create an instance of ImageEditBody from a dict
image_edit_body_from_dict = ImageEditBody.from_dict(image_edit_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


