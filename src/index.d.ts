import type { IncomingMessage } from 'http';
import type { Request, RequestHandler, ErrorRequestHandler } from 'express';

export interface BugTrackConfig {
  enabled?: boolean;
  url?: string;
  key?: string;
  environment?: string;
  ignore?: Array<string | (new (...args: any[]) => Error)>;
  connectTimeoutMs?: number;
  timeoutMs?: number;
  rootPath?: string;
}

export interface BugTrackUser {
  id?: string | number;
  _id?: string | number;
  email?: string;
}

export interface ReportContext {
  req?: IncomingMessage | Request;
  user?: BugTrackUser | null;
}

export const VERSION: string;

export function init(options?: BugTrackConfig): Required<BugTrackConfig>;
export function getConfig(): Required<BugTrackConfig>;
export function setConfig(patch?: BugTrackConfig): Required<BugTrackConfig>;
export function report(error: unknown, context?: ReportContext): Promise<void>;

export function errorHandler(options?: {
  getUser?: (req: Request) => BugTrackUser | null | undefined;
}): ErrorRequestHandler;

export function requestHandler(): RequestHandler;
export function captureProcessErrors(): void;

declare global {
  namespace Express {
    interface Request {
      bugtrack?: {
        report(error: unknown, extra?: ReportContext): Promise<void>;
      };
    }
  }
}
