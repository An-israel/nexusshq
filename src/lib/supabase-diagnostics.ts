type SupabaseLikeError = {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
  name?: string | null;
  status?: number | null;
};

interface SupabaseRequestDiagnostic {
  clientRequestId: string;
  durationMs: number;
  method: string;
  ok: boolean;
  occurredAt: string;
  path: string;
  query: string;
  responseBodySnippet: string | null;
  route: string | null;
  status: number;
  statusText: string;
  url: string;
  debugHeaders: Record<string, string>;
}

interface DiagnosticsStore {
  entries: SupabaseRequestDiagnostic[];
  installed: boolean;
}

declare global {
  interface Window {
    __NEXUS_SUPABASE_DIAGNOSTICS__?: DiagnosticsStore;
  }

  var __NEXUS_SUPABASE_DIAGNOSTICS__: DiagnosticsStore | undefined;
}

const DIAGNOSTIC_LIMIT = 40;
const SCHEMA_ERROR_PATTERN = /database error querying schema|schema cache/i;
const DEBUG_HEADER_PATTERN = /request|trace|cf-|x-/i;

function isBrowser() {
  return typeof window !== "undefined";
}

function getStore(): DiagnosticsStore | null {
  if (!isBrowser()) return null;

  const scope = window as Window;
  scope.__NEXUS_SUPABASE_DIAGNOSTICS__ ??= {
    entries: [],
    installed: false,
  };

  return scope.__NEXUS_SUPABASE_DIAGNOSTICS__;
}

function createClientRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `diag-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function isSupabaseRequest(url: string) {
  return /\/rest\/v1\/|\/auth\/v1\/|\/storage\/v1\//.test(url);
}

function toSafeUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl, isBrowser() ? window.location.origin : "https://localhost");
    url.searchParams.delete("apikey");
    return url;
  } catch {
    return null;
  }
}

function extractDebugHeaders(headers: Headers) {
  const debugHeaders: Record<string, string> = {};

  headers.forEach((value, key) => {
    if (DEBUG_HEADER_PATTERN.test(key)) {
      debugHeaders[key] = value;
    }
  });

  return debugHeaders;
}

function normalizeError(error: unknown): SupabaseLikeError {
  if (!error || typeof error !== "object") {
    return { message: error instanceof Error ? error.message : String(error ?? "Unknown error") };
  }

  const candidate = error as SupabaseLikeError;

  return {
    code: candidate.code ?? null,
    details: candidate.details ?? null,
    hint: candidate.hint ?? null,
    message: candidate.message ?? (error instanceof Error ? error.message : null),
    name: candidate.name ?? (error instanceof Error ? error.name : null),
    status: candidate.status ?? null,
  };
}

function isSchemaQueryError(error: SupabaseLikeError) {
  return SCHEMA_ERROR_PATTERN.test(error.message ?? "") || error.status === 500;
}

function rememberDiagnostic(entry: SupabaseRequestDiagnostic) {
  const store = getStore();
  if (!store) return;

  store.entries.unshift(entry);
  if (store.entries.length > DIAGNOSTIC_LIMIT) {
    store.entries.length = DIAGNOSTIC_LIMIT;
  }
}

function getRelatedDiagnostics(matchers: string[]) {
  const store = getStore();
  if (!store) return [] as SupabaseRequestDiagnostic[];

  const loweredMatchers = matchers.map((value) => value.toLowerCase()).filter(Boolean);

  return store.entries
    .filter((entry) => {
      if (!loweredMatchers.length) return true;

      const haystack = `${entry.url} ${entry.path} ${entry.query} ${entry.responseBodySnippet ?? ""}`.toLowerCase();
      return loweredMatchers.some((matcher) => haystack.includes(matcher));
    })
    .slice(0, 5);
}

export function installSupabaseDiagnostics() {
  const store = getStore();
  if (!store || store.installed) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = resolveUrl(input);

    if (!isSupabaseRequest(rawUrl)) {
      return originalFetch(input, init);
    }

    const startedAt = performance.now();
    const clientRequestId = createClientRequestId();

    try {
      const response = await originalFetch(input, init);
      const url = toSafeUrl(rawUrl);
      let responseBodySnippet: string | null = null;

      if (response.status >= 500) {
        try {
          responseBodySnippet = (await response.clone().text()).slice(0, 600);
        } catch {
          responseBodySnippet = null;
        }
      }

      const diagnostic: SupabaseRequestDiagnostic = {
        clientRequestId,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        method: init?.method ?? (input instanceof Request ? input.method : "GET"),
        ok: response.ok,
        occurredAt: new Date().toISOString(),
        path: url?.pathname ?? rawUrl,
        query: url?.search ?? "",
        responseBodySnippet,
        route: window.location.pathname,
        status: response.status,
        statusText: response.statusText,
        url: url?.toString() ?? rawUrl,
        debugHeaders: extractDebugHeaders(response.headers),
      };

      const isRelevantFailure =
        response.status >= 500 ||
        SCHEMA_ERROR_PATTERN.test(responseBodySnippet ?? "") ||
        SCHEMA_ERROR_PATTERN.test(response.statusText);

      if (isRelevantFailure) {
        rememberDiagnostic(diagnostic);
        console.groupCollapsed(
          `%c[Supabase Diagnostic] ${diagnostic.method} ${diagnostic.path}`,
          "color:#fb7185",
        );
        console.error({
          type: "supabase-request-failure",
          ...diagnostic,
          serverRequestId:
            diagnostic.debugHeaders["x-request-id"] ??
            diagnostic.debugHeaders["request-id"] ??
            diagnostic.debugHeaders["cf-ray"] ??
            null,
        });
        console.groupEnd();
      }

      return response;
    } catch (error) {
      const url = toSafeUrl(rawUrl);
      const diagnostic: SupabaseRequestDiagnostic = {
        clientRequestId,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        method: init?.method ?? (input instanceof Request ? input.method : "GET"),
        ok: false,
        occurredAt: new Date().toISOString(),
        path: url?.pathname ?? rawUrl,
        query: url?.search ?? "",
        responseBodySnippet: error instanceof Error ? error.message : String(error),
        route: window.location.pathname,
        status: 0,
        statusText: "FETCH_THROW",
        url: url?.toString() ?? rawUrl,
        debugHeaders: {},
      };

      rememberDiagnostic(diagnostic);
      console.groupCollapsed(
        `%c[Supabase Diagnostic] ${diagnostic.method} ${diagnostic.path}`,
        "color:#fb7185",
      );
      console.error({ type: "supabase-fetch-throw", ...diagnostic, originalError: error });
      console.groupEnd();
      throw error;
    }
  }) as typeof window.fetch;

  store.installed = true;
}

export function logSupabaseClientError({
  error,
  extra,
  matchers = [],
  scope,
}: {
  error: unknown;
  extra?: Record<string, unknown>;
  matchers?: string[];
  scope: string;
}) {
  const normalizedError = normalizeError(error);

  if (!isSchemaQueryError(normalizedError)) {
    return;
  }

  console.groupCollapsed(`%c[Supabase Diagnostic] ${scope}`, "color:#f59e0b");
  console.error({
    type: "supabase-client-error",
    scope,
    route: isBrowser() ? window.location.pathname : null,
    occurredAt: new Date().toISOString(),
    error: normalizedError,
    recentRequests: getRelatedDiagnostics(matchers),
    extra: extra ?? null,
  });
  console.groupEnd();
}