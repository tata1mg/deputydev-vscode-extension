import * as vscode from 'vscode';
import { ReferenceService } from '../services/references/ReferenceService';
import { v4 as uuidv4 } from 'uuid';
import { SaveUrlRequest } from '../types';

export class ReferenceManager {
  onStarted: () => void = () => {};
  onError: (error: Error) => void = () => {};
  private referenceService = new ReferenceService();

  constructor(
    private context: vscode.ExtensionContext,
    private outputChannel: vscode.LogOutputChannel,
  ) {}

  async start() {
    this.outputChannel.info('Starting deputydev code reference service...');
  }

  restart() {
    this.outputChannel.info('Restarting deputydev code reference service...');
  }

  stop() {
    this.outputChannel.info('Stopping deputydev code reference service...');
  }

  async keywordSearch(payload: object, sendMessage: (message: object) => void) {
    const repo_path = this.context.workspaceState.get<string>('activeRepo');
    payload = { ...payload, repo_path };
    this.outputChannel.info('keywordSearch', payload);
    const response = await this.referenceService.keywordSearch(payload);
    this.outputChannel.info('keywordSearch-response', response);
    sendMessage({
      id: uuidv4(),
      command: 'keyword-search-response',
      data: response.data,
    });
  }

  async keywordTypeSearch(payload: object, sendMessage: (message: object) => void) {
    const repo_path = this.context.workspaceState.get<string>('activeRepo');
    payload = { ...payload, repo_path };
    this.outputChannel.info('keywordTypeSearch', payload);
    const response = await this.referenceService.keywordTypeSearch(payload);
    this.outputChannel.info('keywordTypeSearch-response', response);
    sendMessage({
      id: uuidv4(),
      command: 'keyword-type-search-response',
      data: response.data,
    });
  }

  async getSavedUrls(data: { isSettings?: boolean }, sendMessage: (message: object) => void) {
    const response = await this.referenceService.getSavedUrls(data.isSettings);
    this.outputChannel.info('getSavedUrls-response', response);
    sendMessage({
      id: uuidv4(),
      command: data.isSettings ? 'get-saved-urls-response-settings' : 'get-saved-urls-response',
      data: response.urls,
    });
  }

  async saveUrl(payload: SaveUrlRequest, sendMessage: (message: object) => void) {
    const response = await this.referenceService.saveUrl(payload);
    this.outputChannel.info('saveUrl-response', response);
    sendMessage({
      id: uuidv4(),
      command: payload.isSettings ? 'get-saved-urls-response-settings' : 'get-saved-urls-response',
      data: response.urls,
    });
  }

  async deleteSavedUrl(data: { id: string; isSettings?: boolean }, sendMessage: (message: object) => void) {
    const response = await this.referenceService.deleteSavedUrl(data);
    this.outputChannel.info('deleteSavedUrl-response', response);
    sendMessage({
      id: uuidv4(),
      command: data.isSettings ? 'get-saved-urls-response-settings' : 'get-saved-urls-response',
      data: response.urls,
    });
  }

  async updateSavedUrl(
    payload: { id: string; name: string; isSettings?: boolean },
    sendMessage: (message: object) => void,
  ) {
    const response = await this.referenceService.updateSavedUrl(payload);
    this.outputChannel.info('updateSavedUrl-response', response);
    sendMessage({
      id: uuidv4(),
      command: payload.isSettings ? 'get-saved-urls-response-settings' : 'get-saved-urls-response',
      data: response.urls,
    });
  }

  async urlSearch(payload: { keyword: string; isSettings?: boolean }, sendMessage: (message: object) => void) {
    const response = await this.referenceService.urlSearch(payload);
    this.outputChannel.info('urlSearch-response', response);
    sendMessage({
      id: uuidv4(),
      command: payload.isSettings ? 'get-saved-urls-response-settings' : 'get-saved-urls-response',
      data: response.urls,
    });
  }

  async uploadFileToS3(
    payload: { name: string; type: string; size: number; content: number[] },
    sendMessage: (message: object) => void,
  ) {
    const onProgress = (percent: number) => {
      sendMessage({
        id: uuidv4(),
        command: 'image-upload-progress',
        data: { progress: percent },
      });
    };
    const buffer = Buffer.from(payload.content);
    const newPayload = {
      ...payload,
      content: buffer,
    };
    const response = await this.referenceService.uploadFileToS3(newPayload, onProgress);
    sendMessage({
      id: uuidv4(),
      command: 'uploaded-image-key',
      data: response,
    });
  }

  async deleteImage(payload: { key: string }) {
    const response = await this.referenceService.deleteImage(payload);
    return response;
  }

  async downloadImageFile(payload: { key: string }) {
    const response = await this.referenceService.downloadImageFile(payload);
    return response;
  }
}
