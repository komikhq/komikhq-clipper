/**
 * Mozilla Firefox (AMO) Publisher
 *
 * Uses the AMO Addons API v5 for uploading and checking status.
 * Docs: https://addons-server.readthedocs.io/en/latest/topics/api/addons.html
 *
 * Required env vars:
 *   AMO_EXTENSION_ID, AMO_JWT_ISSUER, AMO_JWT_SECRET
 *
 * Note: This implementation uses the REST API directly with JWT auth.
 * The `web-ext sign` CLI is an alternative but is designed for unlisted add-ons.
 * For listed add-ons on AMO, the v5 submissions API is the correct approach.
 */

import fs from 'node:fs';
import crypto from 'node:crypto';
import { BaseStorePublisher, type PublisherConfig, type PublishResult } from './base-publisher.ts';

interface FirefoxCredentials {
  extensionId: string;
  jwtIssuer: string;
  jwtSecret: string;
}

export class FirefoxStorePublisher extends BaseStorePublisher {
  private credentials!: FirefoxCredentials;
  private static readonly AMO_BASE_URL = 'https://addons.mozilla.org/api/v5';

  constructor(config: PublisherConfig) {
    super(config);
  }

  get storeName(): string {
    return 'Mozilla AMO';
  }

  validateCredentials(): void {
    this.credentials = {
      extensionId: this.requireEnv('AMO_EXTENSION_ID'),
      jwtIssuer: this.requireEnv('AMO_JWT_ISSUER'),
      jwtSecret: this.requireEnv('AMO_JWT_SECRET'),
    };
  }

  /**
   * Generate a JWT token for AMO API authentication.
   * AMO uses a custom JWT scheme (HS256) with issuer and issued-at / expiry claims.
   */
  private generateJWT(): string {
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiry = issuedAt + 300; // 5 minutes

    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      iss: this.credentials.jwtIssuer,
      jti: crypto.randomUUID(),
      iat: issuedAt,
      exp: expiry,
    };

    const encodeSegment = (obj: object): string =>
      Buffer.from(JSON.stringify(obj)).toString('base64url');

    const headerB64 = encodeSegment(header);
    const payloadB64 = encodeSegment(payload);
    const signingInput = `${headerB64}.${payloadB64}`;

    const signature = crypto
      .createHmac('sha256', this.credentials.jwtSecret)
      .update(signingInput)
      .digest('base64url');

    return `${signingInput}.${signature}`;
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `JWT ${this.generateJWT()}`,
    };
  }

  async uploadPackage(): Promise<string> {
    const uploadUrl = `${FirefoxStorePublisher.AMO_BASE_URL}/addons/${this.credentials.extensionId}/versions/${this.config.version}/`;
    const zipData = this.readFileAsArrayBuffer(this.config.zipFilePath);
    const sourceData = this.findSourcesZip();

    // AMO v5 uses multipart/form-data for version creation
    const formData = new FormData();
    formData.append('upload', new Blob([zipData], { type: 'application/zip' }), 'extension.zip');

    // Attach sources archive if available (required by some reviewers for bundled code)
    if (sourceData) {
      formData.append('source', new Blob([sourceData], { type: 'application/zip' }), 'sources.zip');
      this.log('Sources archive attached for review.');
    }

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: this.authHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`AMO upload failed: HTTP ${response.status} - ${errorBody}`);
    }

    const data = (await response.json()) as { uuid?: string; version: string; processed?: boolean };
    this.log(`Version ${data.version} uploaded.`);

    return data.uuid || data.version;
  }

  async publish(_operationId: string): Promise<PublishResult> {
    // For listed add-ons, uploading via the v5 API automatically creates
    // the version in a reviewable state. No separate publish call is needed.
    // The add-on goes live after Mozilla's review process.
    return {
      storeName: this.storeName,
      success: true,
      version: this.config.version,
      message: 'Version submitted for review. Will go live after Mozilla approval.',
      itemUrl: `https://addons.mozilla.org/en-US/firefox/addon/${this.credentials.extensionId}/`,
    };
  }

  /**
   * Read a file and return its contents as an ArrayBuffer.
   * ArrayBuffer (not Buffer/Uint8Array) is used to satisfy the BlobPart type
   * constraint without triggering @types/node SharedArrayBuffer issues.
   */
  private readFileAsArrayBuffer(filePath: string): ArrayBuffer {
    const buf = fs.readFileSync(filePath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }

  /**
   * Look for the WXT-generated sources zip in the .output directory.
   * AMO reviewers may require source code when the extension uses a bundler.
   */
  private findSourcesZip(): ArrayBuffer | null {
    const sourcesPath = this.config.zipFilePath.replace(/-firefox\.zip$/, '-sources.zip');
    if (fs.existsSync(sourcesPath)) {
      return this.readFileAsArrayBuffer(sourcesPath);
    }
    return null;
  }
}
