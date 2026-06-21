# UpdateReviewReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**BotId** | **string** |  | 
**ConnectorId** | **string** |  | 
**AuditStatus** | **int32** |  | 
**Reason** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewUpdateReviewReq

`func NewUpdateReviewReq(botId string, connectorId string, auditStatus int32, ) *UpdateReviewReq`

NewUpdateReviewReq instantiates a new UpdateReviewReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewUpdateReviewReqWithDefaults

`func NewUpdateReviewReqWithDefaults() *UpdateReviewReq`

NewUpdateReviewReqWithDefaults instantiates a new UpdateReviewReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetBotId

`func (o *UpdateReviewReq) GetBotId() string`

GetBotId returns the BotId field if non-nil, zero value otherwise.

### GetBotIdOk

`func (o *UpdateReviewReq) GetBotIdOk() (*string, bool)`

GetBotIdOk returns a tuple with the BotId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBotId

`func (o *UpdateReviewReq) SetBotId(v string)`

SetBotId sets BotId field to given value.


### GetConnectorId

`func (o *UpdateReviewReq) GetConnectorId() string`

GetConnectorId returns the ConnectorId field if non-nil, zero value otherwise.

### GetConnectorIdOk

`func (o *UpdateReviewReq) GetConnectorIdOk() (*string, bool)`

GetConnectorIdOk returns a tuple with the ConnectorId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetConnectorId

`func (o *UpdateReviewReq) SetConnectorId(v string)`

SetConnectorId sets ConnectorId field to given value.


### GetAuditStatus

`func (o *UpdateReviewReq) GetAuditStatus() int32`

GetAuditStatus returns the AuditStatus field if non-nil, zero value otherwise.

### GetAuditStatusOk

`func (o *UpdateReviewReq) GetAuditStatusOk() (*int32, bool)`

GetAuditStatusOk returns a tuple with the AuditStatus field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAuditStatus

`func (o *UpdateReviewReq) SetAuditStatus(v int32)`

SetAuditStatus sets AuditStatus field to given value.


### GetReason

`func (o *UpdateReviewReq) GetReason() string`

GetReason returns the Reason field if non-nil, zero value otherwise.

### GetReasonOk

`func (o *UpdateReviewReq) GetReasonOk() (*string, bool)`

GetReasonOk returns a tuple with the Reason field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetReason

`func (o *UpdateReviewReq) SetReason(v string)`

SetReason sets Reason field to given value.

### HasReason

`func (o *UpdateReviewReq) HasReason() bool`

HasReason returns a boolean if a field has been set.

### SetReasonNil

`func (o *UpdateReviewReq) SetReasonNil(b bool)`

 SetReasonNil sets the value for Reason to be an explicit nil

### UnsetReason
`func (o *UpdateReviewReq) UnsetReason()`

UnsetReason ensures that no value is present for Reason, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


