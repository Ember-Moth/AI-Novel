export type AssistantToolSuccess<T> = {
  ok: true;
  truncated: boolean;
  data: T;
};

export type AssistantToolError = {
  ok: false;
  error: string;
  context?: AssistantToolErrorContext;
};

export type AssistantToolEnvelope<T> = AssistantToolSuccess<T> | AssistantToolError;

export type AssistantToolErrorContextValue =
  | string
  | number
  | boolean
  | null
  | AssistantToolErrorContextValue[]
  | {
      [key: string]: AssistantToolErrorContextValue | undefined;
    };

export type AssistantToolErrorContext = Record<string, AssistantToolErrorContextValue | undefined>;

type MaybePromise<T> = T | Promise<T>;

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "工具执行失败。";
}

function cleanErrorContext(
  context: AssistantToolErrorContext | undefined,
): AssistantToolErrorContext | undefined {
  if (!context) {
    return undefined;
  }

  const cleaned = Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined),
  );
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

export function failure(
  error: unknown,
  context?: AssistantToolErrorContext | (() => AssistantToolErrorContext),
): AssistantToolError {
  const resolvedContext =
    typeof context === "function" ? cleanErrorContext(context()) : cleanErrorContext(context);
  const result: AssistantToolError = {
    ok: false,
    error: getErrorMessage(error),
  };
  if (resolvedContext) {
    result.context = resolvedContext;
  }
  return result;
}

function isPromiseLike<T>(value: MaybePromise<T>): value is Promise<T> {
  return typeof value === "object" && value !== null && "then" in value;
}

export function withEnvelope<T>(
  execute: () => AssistantToolSuccess<T>,
  getContext?: () => AssistantToolErrorContext,
): AssistantToolEnvelope<T>;
export function withEnvelope<T>(
  execute: () => Promise<AssistantToolSuccess<T>>,
  getContext?: () => AssistantToolErrorContext,
): Promise<AssistantToolEnvelope<T>>;
export function withEnvelope<T>(
  execute: () => MaybePromise<AssistantToolSuccess<T>>,
  getContext?: () => AssistantToolErrorContext,
): MaybePromise<AssistantToolEnvelope<T>> {
  try {
    const result = execute();
    if (isPromiseLike(result)) {
      return result.catch((error) => failure(error, getContext));
    }
    return result;
  } catch (error) {
    return failure(error, getContext);
  }
}
