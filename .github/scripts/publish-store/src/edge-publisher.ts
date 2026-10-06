/**
 * Microsoft Edge Add-ons Publisher
 *
 * Uses the Microsoft Edge Add-ons API (v1) via Partner Center.
 * Docs: https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/api/using-addons-api
 *
 * Required env vars:
 *   EDGE_PRODUCT_ID, EDGE_CLIENT_ID, EDGE_API_KEY
 */

import fs from 'node:fs';
import { BaseStorePublisher, type PublisherConfig, type PublishResult } from './base-publisher.ts';

interface EdgeCredentials {
  productId: string;
  clientId: string;
  apiKey: string;
}

export class EdgeStorePublisher extends BaseStorePublisher {
  private credentials!: EdgeCredentials;

  constructor(config: PublisherConfig) {
    super(config);
  }

  get storeName(): string {
    return 'Edge Add-ons';
  }

  validateCredentials(): void {
    this.credentials = {
      productId: this.requireEnv('EDGE_PRODUCT_ID'),
      clientId: this.requireEnv('EDGE_CLIENT_ID'),
      apiKey: this.requireEnv('EDGE_API_KEY'),
    };
  }

  private get authHeaders(): Record<string, string> {
    return {
      Authorization: `ApiKey ${this.credentials.apiKey}`,
      'X-ClientID': this.credentials.clientId,
    };
  }

  async uploadPackage(): Promise<string> {
    const zipBuffer = fs.readFileSync(this.config.zipFilePath);

    const uploadUrl = `https://api.addons.microsoftedge.microsoft.com/v1/products/${this.credentials.productId}/submissions/draft/package`;

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...this.authHeaders,
        'Content-Type': 'application/zip',
      },
      body: zipBuffer,
    });

    if (!response.ok && response.status !== 202) {
      const errorBody = await response.text();
      throw new Error(`Edge upload failed: HTTP ${response.status} - ${errorBody}`);
    }

    // Edge returns 202 Accepted with an operationId in the Location header
    const operationUrl = response.headers.get('location') || '';
    this.log(`Upload accepted. Operation: ${operationUrl || 'inline'}`);

    // Poll for upload status completion
    if (operationUrl) {
      await this.pollOperationStatus(operationUrl);
    }

    return 'ok';
  }

  private async pollOperationStatus(operationIdOrUrl: string): Promise<void> {
    const maxAttempts = 15;
    const delayMs = 5000;

    const pollUrl = operationIdOrUrl.startsWith('http')
      ? operationIdOrUrl
      : `https://api.addons.microsoftedge.microsoft.com/v1/products/${this.credentials.productId}/submissions/draft/package/operations/${operationIdOrUrl}`;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.log(`Polling upload status (attempt ${attempt}/${maxAttempts})...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      const response = await fetch(pollUrl, {
        headers: this.authHeaders,
      });

      if (!response.ok) continue;

      const data = (await response.json()) as { status: string; message?: string; errorCode?: string };

      if (data.status === 'Succeeded') {
        this.log('Upload processing succeeded.');
        return;
      }

      if (data.status === 'Failed') {
        throw new Error(`Edge upload processing failed: ${data.errorCode || data.message || 'Unknown error'}`);
      }

      // status === 'InProgress' -> keep polling
    }

    throw new Error('Edge upload processing timed out after polling.');
  }

  async publish(): Promise<PublishResult> {
    const publishUrl = `https://api.addons.microsoftedge.microsoft.com/v1/products/${this.credentials.productId}/submissions`;

    const response = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        ...this.authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok && response.status !== 202) {
      const errorBody = await response.text();
      throw new Error(`Edge publish failed: HTTP ${response.status} - ${errorBody}`);
    }

    return {
      storeName: this.storeName,
      success: true,
      version: this.config.version,
      message: `Submission created (HTTP ${response.status}). Under review.`,
      itemUrl: `https://microsoftedge.microsoft.com/addons/detail/${this.credentials.productId}`,
    };
  }
}
