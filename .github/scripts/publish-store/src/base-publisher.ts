/**
 * Base interfaces and abstract class for all store publishers.
 * Implements the Template Method pattern for a consistent publish pipeline.
 */

export interface PublisherConfig {
  /** Path to the .zip file to upload */
  zipFilePath: string;
  /** Extension version string (e.g., "2.0.0") */
  version: string;
}

export interface PublishResult {
  storeName: string;
  success: boolean;
  version: string;
  message: string;
  itemUrl?: string;
}

export abstract class BaseStorePublisher {
  protected config: PublisherConfig;

  constructor(config: PublisherConfig) {
    this.config = config;
  }

  /** Human-readable store name for logging */
  abstract get storeName(): string;

  /** Validate that all required credentials/env vars are present */
  abstract validateCredentials(): void;

  /** Upload the ZIP package to the store. Returns an operation/upload ID if applicable. */
  abstract uploadPackage(): Promise<string>;

  /** Publish/submit the uploaded package for review. */
  abstract publish(operationId: string): Promise<PublishResult>;

  /**
   * Template Method: executes the full pipeline in order.
   * Subclasses override the individual steps, not this method.
   */
  public async executePipeline(): Promise<PublishResult> {
    try {
      this.log('Validating credentials...');
      this.validateCredentials();

      this.log(`Uploading package: ${this.config.zipFilePath}`);
      const operationId = await this.uploadPackage();
      this.log(`Upload complete. Operation ID: ${operationId || 'N/A'}`);

      this.log('Submitting for publish...');
      const result = await this.publish(operationId);

      if (result.success) {
        this.log(`[OK] Published successfully (v${result.version})`);
      } else {
        this.log(`[FAIL] Publish failed: ${result.message}`);
      }

      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`[FAIL] Pipeline error: ${message}`);
      return {
        storeName: this.storeName,
        success: false,
        version: this.config.version,
        message,
      };
    }
  }

  protected log(msg: string): void {
    console.log(`[${this.storeName}] ${msg}`);
  }

  protected requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  }
}
