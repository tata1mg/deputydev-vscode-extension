import {BaseClient} from './base/baseClient';


export class BackendClient extends BaseClient {
  constructor(
    httpHost: string,
    wsHost: string
  ) {
    super(httpHost, wsHost);
  }

  querySolver = this.createWebsocketEndpoint('/query/solve');

}