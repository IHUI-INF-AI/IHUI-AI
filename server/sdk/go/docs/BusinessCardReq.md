# BusinessCardReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Id** | **string** |  | 
**Card** | **string** |  | 
**FileName** | Pointer to **string** |  | [optional] [default to "card.png"]

## Methods

### NewBusinessCardReq

`func NewBusinessCardReq(id string, card string, ) *BusinessCardReq`

NewBusinessCardReq instantiates a new BusinessCardReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBusinessCardReqWithDefaults

`func NewBusinessCardReqWithDefaults() *BusinessCardReq`

NewBusinessCardReqWithDefaults instantiates a new BusinessCardReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetId

`func (o *BusinessCardReq) GetId() string`

GetId returns the Id field if non-nil, zero value otherwise.

### GetIdOk

`func (o *BusinessCardReq) GetIdOk() (*string, bool)`

GetIdOk returns a tuple with the Id field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetId

`func (o *BusinessCardReq) SetId(v string)`

SetId sets Id field to given value.


### GetCard

`func (o *BusinessCardReq) GetCard() string`

GetCard returns the Card field if non-nil, zero value otherwise.

### GetCardOk

`func (o *BusinessCardReq) GetCardOk() (*string, bool)`

GetCardOk returns a tuple with the Card field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCard

`func (o *BusinessCardReq) SetCard(v string)`

SetCard sets Card field to given value.


### GetFileName

`func (o *BusinessCardReq) GetFileName() string`

GetFileName returns the FileName field if non-nil, zero value otherwise.

### GetFileNameOk

`func (o *BusinessCardReq) GetFileNameOk() (*string, bool)`

GetFileNameOk returns a tuple with the FileName field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFileName

`func (o *BusinessCardReq) SetFileName(v string)`

SetFileName sets FileName field to given value.

### HasFileName

`func (o *BusinessCardReq) HasFileName() bool`

HasFileName returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


