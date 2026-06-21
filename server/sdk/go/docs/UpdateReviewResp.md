# UpdateReviewResp

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Success** | **bool** |  | 
**Message** | **string** |  | 
**Data** | Pointer to **map[string]interface{}** |  | [optional] 

## Methods

### NewUpdateReviewResp

`func NewUpdateReviewResp(success bool, message string, ) *UpdateReviewResp`

NewUpdateReviewResp instantiates a new UpdateReviewResp object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewUpdateReviewRespWithDefaults

`func NewUpdateReviewRespWithDefaults() *UpdateReviewResp`

NewUpdateReviewRespWithDefaults instantiates a new UpdateReviewResp object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetSuccess

`func (o *UpdateReviewResp) GetSuccess() bool`

GetSuccess returns the Success field if non-nil, zero value otherwise.

### GetSuccessOk

`func (o *UpdateReviewResp) GetSuccessOk() (*bool, bool)`

GetSuccessOk returns a tuple with the Success field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSuccess

`func (o *UpdateReviewResp) SetSuccess(v bool)`

SetSuccess sets Success field to given value.


### GetMessage

`func (o *UpdateReviewResp) GetMessage() string`

GetMessage returns the Message field if non-nil, zero value otherwise.

### GetMessageOk

`func (o *UpdateReviewResp) GetMessageOk() (*string, bool)`

GetMessageOk returns a tuple with the Message field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMessage

`func (o *UpdateReviewResp) SetMessage(v string)`

SetMessage sets Message field to given value.


### GetData

`func (o *UpdateReviewResp) GetData() map[string]interface{}`

GetData returns the Data field if non-nil, zero value otherwise.

### GetDataOk

`func (o *UpdateReviewResp) GetDataOk() (*map[string]interface{}, bool)`

GetDataOk returns a tuple with the Data field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetData

`func (o *UpdateReviewResp) SetData(v map[string]interface{})`

SetData sets Data field to given value.

### HasData

`func (o *UpdateReviewResp) HasData() bool`

HasData returns a boolean if a field has been set.

### SetDataNil

`func (o *UpdateReviewResp) SetDataNil(b bool)`

 SetDataNil sets the value for Data to be an explicit nil

### UnsetData
`func (o *UpdateReviewResp) UnsetData()`

UnsetData ensures that no value is present for Data, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


