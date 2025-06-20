import { BaseClient, BaseWebsocketEndpoint } from './base/baseClient';
import { ForceUpgradeHandler } from './handlerMiddlewares/forceUpgradeHandlerMiddleware';
import { UnauthenticatedHandler } from './handlerMiddlewares/unauthenticatedHandlerMiddleware';

export class BackendClient extends BaseClient {
  // Default endpoints can be set here if needed
  endpointMap: Record<string, string> = {
    QUERY_SOLVER: '/query/solve',
  };

  // endpoints
  public querySolver!: BaseWebsocketEndpoint;

  constructor(httpHost?: string, wsHost?: string, endpointsMap: Record<string, string> = {}) {
    super(httpHost, wsHost);
    this.endpointMap = { ...this.endpointMap, ...endpointsMap };
    this.initEndpoints();
  }

  initEndpoints() {
    this.querySolver = this.createWebsocketEndpoint(this.endpointMap['QUERY_SOLVER'], undefined, [
      ForceUpgradeHandler,
      UnauthenticatedHandler,
    ]);
  }
}
