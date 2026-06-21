
# AddAgentRequest


## Properties

Name | Type
------------ | -------------
`agentName` | string
`agentDescription` | string
`connectorUserId` | string
`agentVariables` | { [key: string]: any; }
`agentModel` | string
`agentAvatar` | string

## Example

```typescript
import type { AddAgentRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "agentName": null,
  "agentDescription": null,
  "connectorUserId": null,
  "agentVariables": null,
  "agentModel": null,
  "agentAvatar": null,
} satisfies AddAgentRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AddAgentRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


