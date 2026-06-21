# UpdateReviewReq


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**bot_id** | **str** |  | 
**connector_id** | **str** |  | 
**audit_status** | **int** |  | 
**reason** | **str** |  | [optional] 

## Example

```python
from zhs_api.models.update_review_req import UpdateReviewReq

# TODO update the JSON string below
json = "{}"
# create an instance of UpdateReviewReq from a JSON string
update_review_req_instance = UpdateReviewReq.from_json(json)
# print the JSON string representation of the object
print(UpdateReviewReq.to_json())

# convert the object into a dict
update_review_req_dict = update_review_req_instance.to_dict()
# create an instance of UpdateReviewReq from a dict
update_review_req_from_dict = UpdateReviewReq.from_dict(update_review_req_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


