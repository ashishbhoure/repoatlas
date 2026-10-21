/**
 * Application error taxonomy. Every error that crosses a service boundary is an AppError,
 * so route handlers and pages can map it to a safe, consistent response without leaking
 * internals. `userMessage` is safe to show; `cause`/`details` are for server logs only.
 */
export type AppErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_INVALID_QUERY"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_BAD_RESPONSE"
  | "FEATURE_DISABLED"
  | "INTERNAL";

const STATUS: Record<AppErrorCode, number> = {
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UPSTREAM_RATE_LIMITED: 503,
  UPSTREAM_INVALID_QUERY: 422,
  UPSTREAM_UNAVAILABLE: 502,
  UPSTREAM_BAD_RESPONSE: 502,
  FEATURE_DISABLED: 501,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly userMessage: string;
  /** Seconds the client should wait before retrying, when known. */
  readonly retryAfter?: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    userMessage: string,
    opts: { cause?: unknown; retryAfter?: number; details?: Record<string, unknown> } = {},
  ) {
    super(userMessage, { cause: opts.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.userMessage = userMessage;
    this.retryAfter = opts.retryAfter;
    this.details = opts.details;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

export function toAppError(e: unknown): AppError {
  if (isAppError(e)) return e;
  return new AppError("INTERNAL", "Something went wrong on our side. Please try again.", {
    cause: e,
  });
}

/** Wire format for every API error response. */
export interface ApiErrorBody {
  error: { code: AppErrorCode; message: string; retryAfter?: number };
}

export function toApiErrorBody(e: AppError): ApiErrorBody {
  return {
    error: {
      code: e.code,
      message: e.userMessage,
      ...(e.retryAfter !== undefined ? { retryAfter: e.retryAfter } : {}),
    },
  };
}
