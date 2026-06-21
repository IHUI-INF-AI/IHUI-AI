# StockAnalyseRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Prompt** | **string** | stock analyse question | 
**UserUuid** | **string** | user UUID | 
**ChatId** | Pointer to **NullableString** | chat ID | [optional] 
**Model** | Pointer to **NullableString** | model name | [optional] 
**Zidingyican** | Pointer to **NullableString** | custom param | [optional] 
**PageNum** | Pointer to **NullableInt32** | page number | [optional] 
**PageSize** | Pointer to **NullableInt32** | page size | [optional] 

## Methods

### NewStockAnalyseRequest

`func NewStockAnalyseRequest(prompt string, userUuid string, ) *StockAnalyseRequest`

NewStockAnalyseRequest instantiates a new StockAnalyseRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewStockAnalyseRequestWithDefaults

`func NewStockAnalyseRequestWithDefaults() *StockAnalyseRequest`

NewStockAnalyseRequestWithDefaults instantiates a new StockAnalyseRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPrompt

`func (o *StockAnalyseRequest) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *StockAnalyseRequest) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *StockAnalyseRequest) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetUserUuid

`func (o *StockAnalyseRequest) GetUserUuid() string`

GetUserUuid returns the UserUuid field if non-nil, zero value otherwise.

### GetUserUuidOk

`func (o *StockAnalyseRequest) GetUserUuidOk() (*string, bool)`

GetUserUuidOk returns a tuple with the UserUuid field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserUuid

`func (o *StockAnalyseRequest) SetUserUuid(v string)`

SetUserUuid sets UserUuid field to given value.


### GetChatId

`func (o *StockAnalyseRequest) GetChatId() string`

GetChatId returns the ChatId field if non-nil, zero value otherwise.

### GetChatIdOk

`func (o *StockAnalyseRequest) GetChatIdOk() (*string, bool)`

GetChatIdOk returns a tuple with the ChatId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChatId

`func (o *StockAnalyseRequest) SetChatId(v string)`

SetChatId sets ChatId field to given value.

### HasChatId

`func (o *StockAnalyseRequest) HasChatId() bool`

HasChatId returns a boolean if a field has been set.

### SetChatIdNil

`func (o *StockAnalyseRequest) SetChatIdNil(b bool)`

 SetChatIdNil sets the value for ChatId to be an explicit nil

### UnsetChatId
`func (o *StockAnalyseRequest) UnsetChatId()`

UnsetChatId ensures that no value is present for ChatId, not even an explicit nil
### GetModel

`func (o *StockAnalyseRequest) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *StockAnalyseRequest) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *StockAnalyseRequest) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *StockAnalyseRequest) HasModel() bool`

HasModel returns a boolean if a field has been set.

### SetModelNil

`func (o *StockAnalyseRequest) SetModelNil(b bool)`

 SetModelNil sets the value for Model to be an explicit nil

### UnsetModel
`func (o *StockAnalyseRequest) UnsetModel()`

UnsetModel ensures that no value is present for Model, not even an explicit nil
### GetZidingyican

`func (o *StockAnalyseRequest) GetZidingyican() string`

GetZidingyican returns the Zidingyican field if non-nil, zero value otherwise.

### GetZidingyicanOk

`func (o *StockAnalyseRequest) GetZidingyicanOk() (*string, bool)`

GetZidingyicanOk returns a tuple with the Zidingyican field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetZidingyican

`func (o *StockAnalyseRequest) SetZidingyican(v string)`

SetZidingyican sets Zidingyican field to given value.

### HasZidingyican

`func (o *StockAnalyseRequest) HasZidingyican() bool`

HasZidingyican returns a boolean if a field has been set.

### SetZidingyicanNil

`func (o *StockAnalyseRequest) SetZidingyicanNil(b bool)`

 SetZidingyicanNil sets the value for Zidingyican to be an explicit nil

### UnsetZidingyican
`func (o *StockAnalyseRequest) UnsetZidingyican()`

UnsetZidingyican ensures that no value is present for Zidingyican, not even an explicit nil
### GetPageNum

`func (o *StockAnalyseRequest) GetPageNum() int32`

GetPageNum returns the PageNum field if non-nil, zero value otherwise.

### GetPageNumOk

`func (o *StockAnalyseRequest) GetPageNumOk() (*int32, bool)`

GetPageNumOk returns a tuple with the PageNum field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPageNum

`func (o *StockAnalyseRequest) SetPageNum(v int32)`

SetPageNum sets PageNum field to given value.

### HasPageNum

`func (o *StockAnalyseRequest) HasPageNum() bool`

HasPageNum returns a boolean if a field has been set.

### SetPageNumNil

`func (o *StockAnalyseRequest) SetPageNumNil(b bool)`

 SetPageNumNil sets the value for PageNum to be an explicit nil

### UnsetPageNum
`func (o *StockAnalyseRequest) UnsetPageNum()`

UnsetPageNum ensures that no value is present for PageNum, not even an explicit nil
### GetPageSize

`func (o *StockAnalyseRequest) GetPageSize() int32`

GetPageSize returns the PageSize field if non-nil, zero value otherwise.

### GetPageSizeOk

`func (o *StockAnalyseRequest) GetPageSizeOk() (*int32, bool)`

GetPageSizeOk returns a tuple with the PageSize field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPageSize

`func (o *StockAnalyseRequest) SetPageSize(v int32)`

SetPageSize sets PageSize field to given value.

### HasPageSize

`func (o *StockAnalyseRequest) HasPageSize() bool`

HasPageSize returns a boolean if a field has been set.

### SetPageSizeNil

`func (o *StockAnalyseRequest) SetPageSizeNil(b bool)`

 SetPageSizeNil sets the value for PageSize to be an explicit nil

### UnsetPageSize
`func (o *StockAnalyseRequest) UnsetPageSize()`

UnsetPageSize ensures that no value is present for PageSize, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


