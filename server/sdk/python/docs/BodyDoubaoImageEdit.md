# BodyDoubaoImageEdit


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**model** | **str** |  | [optional] [default to 'doubao-seededit-3-0-i2i-250628']
**image_url** | **str** |  | [optional] 
**image_base64** | **str** |  | [optional] 
**prompt** | **str** |  | 
**seed** | **int** |  | [optional] [default to -1]
**guidance_scale** | **float** |  | [optional] [default to 5.0]
**watermark** | **bool** |  | [optional] [default to False]

## Example

```python
from zhs_api.models.body_doubao_image_edit import BodyDoubaoImageEdit

# TODO update the JSON string below
json = "{}"
# create an instance of BodyDoubaoImageEdit from a JSON string
body_doubao_image_edit_instance = BodyDoubaoImageEdit.from_json(json)
# print the JSON string representation of the object
print(BodyDoubaoImageEdit.to_json())

# convert the object into a dict
body_doubao_image_edit_dict = body_doubao_image_edit_instance.to_dict()
# create an instance of BodyDoubaoImageEdit from a dict
body_doubao_image_edit_from_dict = BodyDoubaoImageEdit.from_dict(body_doubao_image_edit_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


