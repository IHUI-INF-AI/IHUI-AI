# StockAnalyseRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**prompt** | **str** | stock analyse question | 
**user_uuid** | **str** | user UUID | 
**chat_id** | **str** | chat ID | [optional] 
**model** | **str** | model name | [optional] 
**zidingyican** | **str** | custom param | [optional] 
**page_num** | **int** | page number | [optional] 
**page_size** | **int** | page size | [optional] 

## Example

```python
from zhs_api.models.stock_analyse_request import StockAnalyseRequest

# TODO update the JSON string below
json = "{}"
# create an instance of StockAnalyseRequest from a JSON string
stock_analyse_request_instance = StockAnalyseRequest.from_json(json)
# print the JSON string representation of the object
print(StockAnalyseRequest.to_json())

# convert the object into a dict
stock_analyse_request_dict = stock_analyse_request_instance.to_dict()
# create an instance of StockAnalyseRequest from a dict
stock_analyse_request_from_dict = StockAnalyseRequest.from_dict(stock_analyse_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


