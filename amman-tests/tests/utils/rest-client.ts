import { AmmanRequest, RelayReply } from '@metaplex-foundation/amman-client'
import {
  AmmanRelayRoutes,
  ammanRelayRoutes,
} from '@metaplex-foundation/amman/src/relay/routes'

import axios from 'axios'

export class RestClient {
  constructor(readonly routes: AmmanRelayRoutes) {}

  async request<T>(req: AmmanRequest): Promise<RelayReply<T>> {
    const { method, url } = this.routes.urlAndMethodForRequest(req)
    return (await axios(url, { method })).data
  }
}

export async function restClient(routes = ammanRelayRoutes()) {
  return new RestClient(routes)
}
