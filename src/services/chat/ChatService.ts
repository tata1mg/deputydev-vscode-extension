// file: webview-ui/src/services/querySolverService.ts
import { createParser, type EventSourceMessage } from 'eventsource-parser';
import { v4 as uuidv4 } from 'uuid';
import { API_ENDPOINTS } from '../api/endpoints';
import {api} from '../api/axios';

export class QuerySolverService {
public async querySolver(payload: unknown): Promise<AsyncIterableIterator<{ content: string }>> {
    return new Promise(async (resolve, reject) => {
      try {
        const response = await api({
          url: API_ENDPOINTS.QUERY_SOLVER,
          method: 'get',
          headers: {
            'Content-Type': 'application/json',
            'X-REQUEST-ID': uuidv4(),
            'Accept': 'text/event-stream',
          },
          data: payload,
          responseType: 'stream',
        });

        const stream = response.data;
        let streamDone = false;
        const eventsQueue: { content: string }[] = [];

        const parser = createParser({
          onEvent: (event: EventSourceMessage) => {
            try {
              console.log('[DEBUG] Raw SSE Data:', event.data);
              const sanitizedData = event.data.replace(/'/g, '"');
              const parsedData = JSON.parse(sanitizedData);
              if (parsedData.type === 'TEXT_DELTA' && typeof parsedData.content === 'string') {
                eventsQueue.push({ content: parsedData.content });
              }
            } catch (error) {
              console.warn('SSE Parsing Error:', error);
            }
          },
          onRetry: (interval: number) => {
            console.warn(`SSE: Server requested retry after ${interval}ms`);
          },
          onError: (error: Error) => {
            console.error('SSE Parser Error:', error);
            streamDone = true;
          },
          onComment: (comment: string) => {
            console.debug('SSE Comment:', comment);
          },
        });

        stream.on('data', (chunk: Buffer) => {
          parser.feed(chunk.toString());
        });
        stream.on('end', () => {
          streamDone = true;
        });
        stream.on('error', (err: any) => {
          streamDone = true;
          reject(err);
        });

        async function* eventGenerator() {
          while (!streamDone || eventsQueue.length > 0) {
            if (eventsQueue.length > 0) {
              yield eventsQueue.shift()!;
            } else {
              await new Promise((resolve) => setTimeout(resolve, 50));
            }
          }
        }

        resolve(eventGenerator());
      } catch (error) {
        console.error('Error in querySolver:', error);
        reject(error);
      }
    });
  }
}