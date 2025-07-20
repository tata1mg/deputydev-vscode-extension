import { BaseClient, BaseWebsocketEndpoint } from './base/baseClient';
import { ForceUpgradeHandler } from './handlerMiddlewares/forceUpgradeHandlerMiddleware';
import { UnauthenticatedHandler } from './handlerMiddlewares/unauthenticatedHandlerMiddleware';

export class BackendClient extends BaseClient {
  // Default endpoints can be set here if needed
  endpointMap: Record<string, string> = {
    QUERY_SOLVER: '/query/solve',
    REVIEW_SOLVER: '/end_user/v1/extension-code-review/run-multi-agent-local-connection',
    POST_PROCESS_SOLVER: '/end_user/v1/extension-code-review/post-process-local-connection',
  };

  // endpoints
  public querySolver!: () => BaseWebsocketEndpoint;
  public codeReviewSolver!: () => BaseWebsocketEndpoint;
  public postProcessSolver!: () => BaseWebsocketEndpoint;

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
    this.codeReviewSolver = this.createWebsocketEndpoint(this.endpointMap['REVIEW_SOLVER'], undefined, [
      ForceUpgradeHandler,
      UnauthenticatedHandler,
    ]);
    this.postProcessSolver = this.createWebsocketEndpoint(this.endpointMap['POST_PROCESS_SOLVER'], undefined, [
      ForceUpgradeHandler,
      UnauthenticatedHandler,
    ]);
  }
}
