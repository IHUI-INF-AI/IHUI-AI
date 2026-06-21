# UpdateReviewResp


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**success** | **bool** |  | 
**message** | **str** |  | 
**data** | **Dict[str, object]** |  | [optional] 

## Example

```python
from zhs_api.models.update_review_resp import UpdateReviewResp

# TODO update the JSON string below
json = "{}"
# create an instance of UpdateReviewResp from a JSON string
update_review_resp_instance = UpdateReviewResp.from_json(json)
# print the JSON string representation of the object
print(UpdateReviewResp.to_json())

# convert the object into a dict
update_review_resp_dict = update_review_resp_instance.to_dict()
# create an instance of UpdateReviewResp from a dict
update_review_resp_from_dict = UpdateReviewResp.from_dict(update_review_resp_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


