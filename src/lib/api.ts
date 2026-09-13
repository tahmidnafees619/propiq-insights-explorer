/**
 * Typed API client for the PropIQ backend.
 *
 * Two behaviours matter here:
 *
 * 1. Errors are normalised. The backend returns every failure in the same
 *    `{ error: { code, message, details } }` envelope, so `ApiError` carries
 *    field-level validation messages straight through to the form that
 *    produced them.
 * 2. Requests time out. A hung fetch would otherwise leave a chart spinning
 *    forever; an aborted one falls back to the bundled demo data instead.
 */

export const API_BASE_URL: string =
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "http://localhost:8000";

const DEFAULT_TIMEOUT_MS = 10_000;

/** One field-level validation failure, as returned by the API. */
export interface ApiErrorDetail {
  field: string;
  message: string;
  type: string;
}

/** A structured failure from the API, or a transport-level problem. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];
  readonly requestId?: string;

  constructor(
    message: string,
    options: { status: number; code: string; details?: ApiErrorDetail[]; requestId?: string },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details ?? [];
    this.requestId = options.requestId;
  }

  /** True when the API could not be reached at all. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** True when the server rejected the input rather than failing internally. */
  get isValidationError(): boolean {
    return this.status === 422;
  }

  /** A message suitable for display next to a form. */
  get displayMessage(): string {
    if (this.isNetworkError) {
      return "Could not reach the PropIQ API. Showing demo data instead.";
    }
    if (this.isValidationError && this.details.length > 0) {
      return this.details.map((detail) => detail.message).join(" ");
    }
    return this.message;
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; details?: ApiErrorDetail[]; request_id?: string };
}

async function toApiError(response: Response): Promise<ApiError> {
  let code = "http_error";
  let message = `Request failed with status ${response.status}`;
  let details: ApiErrorDetail[] = [];
  let requestId: string | undefined;

  try {
    const body = (await response.json()) as ErrorEnvelope;
    if (body?.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      details = body.error.details ?? [];
      requestId = body.error.request_id;
    }
  } catch {
    // A non-JSON error body (a proxy timeout page, say) leaves the defaults.
  }

  return new ApiError(message, { status: response.status, code, details, requestId });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...init?.headers },
    });

    if (!response.ok) {
      throw await toApiError(response);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    const aborted = error instanceof DOMException && error.name === "AbortError";
    throw new ApiError(
      aborted ? "The API did not respond in time." : "Could not reach the PropIQ API.",
      { status: 0, code: aborted ? "timeout" : "network_error" },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Build a query string, omitting empty values. */
export function toQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
