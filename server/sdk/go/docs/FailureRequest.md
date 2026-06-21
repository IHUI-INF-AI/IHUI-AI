# FailureRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Reason** | Pointer to **string** | 失败原因 | [optional] [default to ""]
**Actor** | Pointer to **string** | 报告者 | [optional] [default to "api"]

## Methods

### NewFailureRequest

`func NewFailureRequest() *FailureRequest`

NewFailureRequest instantiates a new FailureRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewFailureRequestWithDefaults

`func NewFailureRequestWithDefaults() *FailureRequest`

NewFailureRequestWithDefaults instantiates a new FailureRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetReason

`func (o *FailureRequest) GetReason() string`

GetReason returns the Reason field if non-nil, zero value otherwise.

### GetReasonOk

`func (o *FailureRequest) GetReasonOk() (*string, bool)`

GetReasonOk returns a tuple with the Reason field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetReason

`func (o *FailureRequest) SetReason(v string)`

SetReason sets Reason field to given value.

### HasReason

`func (o *FailureRequest) HasReason() bool`

HasReason returns a boolean if a field has been set.

### GetActor

`func (o *FailureRequest) GetActor() string`

GetActor returns the Actor field if non-nil, zero value otherwise.

### GetActorOk

`func (o *FailureRequest) GetActorOk() (*string, bool)`

GetActorOk returns a tuple with the Actor field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetActor

`func (o *FailureRequest) SetActor(v string)`

SetActor sets Actor field to given value.

### HasActor

`func (o *FailureRequest) HasActor() bool`

HasActor returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


