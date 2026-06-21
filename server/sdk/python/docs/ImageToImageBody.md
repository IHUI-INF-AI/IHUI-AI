# ImageToImageBody

Image-to-image transformation request body.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**input_image_url** | **str** | URL of the input image | 
**prompt** | **str** | Text prompt guiding the transformation | 
**model** | **str** | Model name | [optional] [default to 'wanx-v1']

## Example

```python
from zhs_api.models.image_to_image_body import ImageToImageBody

# TODO update the JSON string below
json = "{}"
# create an instance of ImageToImageBody from a JSON string
image_to_image_body_instance = ImageToImageBody.from_json(json)
# print the JSON string representation of the object
print(ImageToImageBody.to_json())

# convert the object into a dict
image_to_image_body_dict = image_to_image_body_instance.to_dict()
# create an instance of ImageToImageBody from a dict
image_to_image_body_from_dict = ImageToImageBody.from_dict(image_to_image_body_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


