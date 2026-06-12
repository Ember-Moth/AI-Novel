const naturalCollator = new Intl.Collator("zh-Hans-CN", {
  numeric: true,
  sensitivity: "base",
});

type NaturalToken =
  | { type: "number"; value: bigint; raw: string }
  | { type: "text"; value: string; raw: string };

const CHINESE_DIGIT_VALUES = new Map<string, number>([
  ["零", 0],
  ["〇", 0],
  ["一", 1],
  ["二", 2],
  ["两", 2],
  ["三", 3],
  ["四", 4],
  ["五", 5],
  ["六", 6],
  ["七", 7],
  ["八", 8],
  ["九", 9],
]);

const CHINESE_SMALL_UNITS = new Map<string, number>([
  ["十", 10],
  ["百", 100],
  ["千", 1000],
]);

const CHINESE_LARGE_UNITS = new Map<string, number>([
  ["万", 10_000],
  ["亿", 100_000_000],
]);

const CHINESE_NUMERAL_PATTERN = /^[零〇一二两三四五六七八九十百千万亿]+$/u;
const CHINESE_NUMERAL_CHAR_PATTERN = /[零〇一二两三四五六七八九十百千万亿]/u;
const ASCII_DIGIT_PATTERN = /[0-9]/;
const CHINESE_NUMERAL_SUFFIX_PATTERN = /[章章节卷回集幕部号篇话页]/u;
const SORT_BOUNDARY_PATTERN = /[\s()[\]{}.,，。:：;；_\-+~!！?？/\\|"'“”‘’]/u;

function normalizeSortText(value: string) {
  return value.normalize("NFKC");
}

function isAsciiDigit(char: string | undefined) {
  return char != null && ASCII_DIGIT_PATTERN.test(char);
}

function isChineseNumeralChar(char: string | undefined) {
  return char != null && CHINESE_NUMERAL_CHAR_PATTERN.test(char);
}

function isSortBoundary(char: string | undefined) {
  return char == null || SORT_BOUNDARY_PATTERN.test(char);
}

function shouldReadChineseNumeral(normalized: string, start: number, end: number) {
  const previous = start > 0 ? normalized[start - 1] : undefined;
  const next = normalized[end];

  return (
    previous === "第" || isSortBoundary(next) || CHINESE_NUMERAL_SUFFIX_PATTERN.test(next ?? "")
  );
}

function parsePlainChineseDigits(value: string) {
  let parsed = 0n;

  for (const char of value) {
    const digit = CHINESE_DIGIT_VALUES.get(char);
    if (digit == null) {
      return null;
    }
    parsed = parsed * 10n + BigInt(digit);
  }

  return parsed;
}

function parseChineseNumeral(value: string) {
  if (!CHINESE_NUMERAL_PATTERN.test(value)) {
    return null;
  }

  const plainDigits = parsePlainChineseDigits(value);
  if (plainDigits != null) {
    return plainDigits;
  }

  let total = 0;
  let section = 0;
  let number = 0;

  for (const char of value) {
    const digit = CHINESE_DIGIT_VALUES.get(char);
    if (digit != null) {
      number = digit;
      continue;
    }

    const smallUnit = CHINESE_SMALL_UNITS.get(char);
    if (smallUnit != null) {
      section += (number || 1) * smallUnit;
      number = 0;
      continue;
    }

    const largeUnit = CHINESE_LARGE_UNITS.get(char);
    if (largeUnit != null) {
      section += number;
      total += (section || 1) * largeUnit;
      section = 0;
      number = 0;
    }
  }

  return BigInt(total + section + number);
}

function readDigitToken(normalized: string, start: number): { token: NaturalToken; end: number } {
  let end = start;
  while (isAsciiDigit(normalized[end])) {
    end += 1;
  }

  const raw = normalized.slice(start, end);
  return {
    token: {
      type: "number",
      value: BigInt(raw),
      raw,
    },
    end,
  };
}

function readChineseNumeralToken(
  normalized: string,
  start: number,
): { token: NaturalToken; end: number } | null {
  let end = start;
  while (isChineseNumeralChar(normalized[end])) {
    end += 1;
  }

  if (!shouldReadChineseNumeral(normalized, start, end)) {
    return null;
  }

  const raw = normalized.slice(start, end);
  const value = parseChineseNumeral(raw);
  if (value == null) {
    return null;
  }

  return {
    token: {
      type: "number",
      value,
      raw,
    },
    end,
  };
}

function readTextToken(normalized: string, start: number): { token: NaturalToken; end: number } {
  let end = start + 1;

  while (end < normalized.length) {
    if (isAsciiDigit(normalized[end])) {
      break;
    }

    if (isChineseNumeralChar(normalized[end])) {
      const candidateEnd = (() => {
        let next = end;
        while (isChineseNumeralChar(normalized[next])) {
          next += 1;
        }
        return next;
      })();

      if (shouldReadChineseNumeral(normalized, end, candidateEnd)) {
        break;
      }
    }

    end += 1;
  }

  const raw = normalized.slice(start, end);
  return {
    token: {
      type: "text",
      value: raw,
      raw,
    },
    end,
  };
}

function tokenizeNaturalSortText(value: string) {
  const normalized = normalizeSortText(value);
  const tokens: NaturalToken[] = [];
  let index = 0;

  while (index < normalized.length) {
    if (isAsciiDigit(normalized[index])) {
      const result = readDigitToken(normalized, index);
      tokens.push(result.token);
      index = result.end;
      continue;
    }

    if (isChineseNumeralChar(normalized[index])) {
      const result = readChineseNumeralToken(normalized, index);
      if (result) {
        tokens.push(result.token);
        index = result.end;
        continue;
      }
    }

    const result = readTextToken(normalized, index);
    tokens.push(result.token);
    index = result.end;
  }

  return tokens;
}

function compareNaturalToken(left: NaturalToken, right: NaturalToken) {
  if (left.type === "number" && right.type === "number") {
    if (left.value < right.value) {
      return -1;
    }
    if (left.value > right.value) {
      return 1;
    }
    return 0;
  }

  if (left.type === "text" && right.type === "text") {
    return naturalCollator.compare(left.value, right.value);
  }

  return naturalCollator.compare(left.raw, right.raw);
}

export function compareNaturalSortText(left: string, right: string) {
  const leftTokens = tokenizeNaturalSortText(left);
  const rightTokens = tokenizeNaturalSortText(right);
  const tokenCount = Math.min(leftTokens.length, rightTokens.length);

  for (let index = 0; index < tokenCount; index += 1) {
    const result = compareNaturalToken(leftTokens[index]!, rightTokens[index]!);
    if (result !== 0) {
      return result;
    }
  }

  if (leftTokens.length !== rightTokens.length) {
    return leftTokens.length - rightTokens.length;
  }

  return naturalCollator.compare(left, right) || left.localeCompare(right);
}
