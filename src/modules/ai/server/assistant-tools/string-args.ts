export function normalizeRequiredString(value: unknown, label: string) {
  if (typeof value !== "string") {
    throw new Error(`${label}必须是字符串。`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label}不能为空。`);
  }
  return normalized;
}

export function normalizeOptionalString(value: unknown, label: string) {
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${label}必须是字符串。`);
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

export function requireNonEmptyString(value: string | null | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${label}不能为空。`);
  }
  return normalized;
}

export function normalizeOptionalNonEmptyString(value: string | null | undefined, label: string) {
  if (value == null) {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label}不能为空。`);
  }
  return normalized;
}

export function normalizeOptionalStringToNull(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
