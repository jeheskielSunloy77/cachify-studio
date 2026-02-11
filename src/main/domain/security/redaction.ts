const REDACTION_MASK = '[REDACTED]';

export const REDACTION_POLICY = {
  id: 'safe-default-redaction',
  version: '1.0.0',
  summary: 'Masks JWT, bearer tokens, sensitive key/value pairs, and high-entropy tokens.',
} as const;

export type RedactionMetadata = {
  policyId: string;
  policyVersion: string;
  policySummary: string;
  redactedSegments: number;
  redactionApplied: boolean;
};

type RedactionResult = {
  value: string;
  metadata: RedactionMetadata;
};

const SENSITIVE_KEY_VALUE_REGEX =
  /(["']?)(password|passwd|pwd|secret|api[_-]?key|token|access[_-]?token|refresh[_-]?token|client[_-]?secret)\1(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;}{\]]+)/gi;
const JWT_REGEX = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const BEARER_TOKEN_REGEX = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi;
const HIGH_ENTROPY_TOKEN_REGEX = /\b[A-Za-z0-9+/_=-]{32,}\b/g;

export const buildRedactionMetadata = (redactedSegments: number): RedactionMetadata => ({
  policyId: REDACTION_POLICY.id,
  policyVersion: REDACTION_POLICY.version,
  policySummary: REDACTION_POLICY.summary,
  redactedSegments,
  redactionApplied: redactedSegments > 0,
});

const replaceWithCounter = (
  source: string,
  regex: RegExp,
  replacer: (...args: (string | number)[]) => string,
) => {
  let replacements = 0;
  const value = source.replace(regex, (...args: (string | number)[]) => {
    replacements += 1;
    return replacer(...args);
  });
  return {
    value,
    replacements,
  };
};

const shouldMaskAsHighEntropy = (candidate: string) => {
  if (candidate.includes(REDACTION_MASK)) {
    return false;
  }
  if (/^[0-9]+$/.test(candidate)) {
    return false;
  }
  if (/^([A-Za-z0-9+/_=-])\1+$/.test(candidate)) {
    return false;
  }
  const hasLower = /[a-z]/.test(candidate);
  const hasUpper = /[A-Z]/.test(candidate);
  const hasDigit = /\d/.test(candidate);
  return hasLower && hasUpper && hasDigit;
};

const redactSensitiveKeyValues = (value: string) =>
  replaceWithCounter(
    value,
    SENSITIVE_KEY_VALUE_REGEX,
    (
      _match: string | number,
      keyQuoteToken: string | number,
      key: string | number,
      separator: string | number,
      rawValue: string | number,
    ) => {
    const rawText = String(rawValue);
    const valueQuote = rawText.startsWith('"') || rawText.startsWith("'") ? rawText[0] : '';
    const maskedValue = valueQuote ? `${valueQuote}${REDACTION_MASK}${valueQuote}` : REDACTION_MASK;
    const keyQuote = String(keyQuoteToken);
    return `${keyQuote}${key}${keyQuote}${separator}${maskedValue}`;
  },
  );

const redactJwtTokens = (value: string) =>
  replaceWithCounter(value, JWT_REGEX, () => REDACTION_MASK);

const redactBearerTokens = (value: string) =>
  replaceWithCounter(value, BEARER_TOKEN_REGEX, () => `Bearer ${REDACTION_MASK}`);

const redactHighEntropyTokens = (value: string) =>
  replaceWithCounter(value, HIGH_ENTROPY_TOKEN_REGEX, (token: string) =>
    shouldMaskAsHighEntropy(token) ? REDACTION_MASK : token,
  );

export const redactPreviewText = (value: string): RedactionResult => {
  let redactedValue = value;
  let redactedSegments = 0;

  const keyValueResult = redactSensitiveKeyValues(redactedValue);
  redactedValue = keyValueResult.value;
  redactedSegments += keyValueResult.replacements;

  const jwtResult = redactJwtTokens(redactedValue);
  redactedValue = jwtResult.value;
  redactedSegments += jwtResult.replacements;

  const bearerResult = redactBearerTokens(redactedValue);
  redactedValue = bearerResult.value;
  redactedSegments += bearerResult.replacements;

  const entropyResult = redactHighEntropyTokens(redactedValue);
  redactedValue = entropyResult.value;
  redactedSegments += entropyResult.replacements;

  return {
    value: redactedValue,
    metadata: buildRedactionMetadata(redactedSegments),
  };
};
