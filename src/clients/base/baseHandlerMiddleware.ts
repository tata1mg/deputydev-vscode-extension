export class BaseHandlerMiddleware {
  async handleWsMessage(message: any): Promise<void> {
    console.log(`Handling WebSocket message: ${JSON.stringify(message)}`);
  }

  async handleHttpResponse(response: any): Promise<void> {
    console.log(`Handling HTTP response: ${JSON.stringify(response)}`);
  }
}
