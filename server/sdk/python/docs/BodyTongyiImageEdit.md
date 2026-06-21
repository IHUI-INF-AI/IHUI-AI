# BodyTongyiImageEdit


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**model** | **str** |  | [optional] [default to 'qwen-image-edit']
**image_url** | **str** |  | [optional] 
**image_base64** | **str** |  | [optional] 
**prompt** | **str** |  | 
**negative_prompt** | **str** |  | [optional] 
**n** | **int** |  | [optional] [default to 1]

## Example

```python
from zhs_api.models.body_tongyi_image_edit import BodyTongyiImageEdit

# TODO update the JSON string below
json = "{}"
# create an instance of BodyTongyiImageEdit from a JSON string
body_tongyi_image_edit_instance = BodyTongyiImageEdit.from_json(json)
# print the JSON string representation of the object
print(BodyTongyiImageEdit.to_json())

# convert the object into a dict
body_tongyi_image_edit_dict = body_tongyi_image_edit_instance.to_dict()
# create an instance of BodyTongyiImageEdit from a dict
body_tongyi_image_edit_from_dict = BodyTongyiImageEdit.from_dict(body_tongyi_image_edit_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


