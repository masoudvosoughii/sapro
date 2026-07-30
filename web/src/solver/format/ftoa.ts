import { DEFAULT_FRACTION_LIMIT } from '../constants.ts';

interface FractionParts {
  numerator: number;
  denominator: number;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }
  return x;
}

/** Approximate a float as a reduced fraction with bounded denominator. */
export function limitDenominator(
  value: number,
  maxDenominator: number = DEFAULT_FRACTION_LIMIT,
): FractionParts {
  if (!Number.isFinite(value)) {
    throw new Error('cannot convert non-finite number to fraction');
  }
  if (value === 0 || Object.is(value, -0)) {
    return { numerator: 0, denominator: 1 };
  }

  let bestNumerator = 0;
  let bestDenominator = 1;
  let bestError = Math.abs(value);

  for (let denominator = 1; denominator <= maxDenominator; denominator += 1) {
    const numerator = Math.round(value * denominator);
    const error = Math.abs(value - numerator / denominator);
    if (error < bestError) {
      bestError = error;
      bestNumerator = numerator;
      bestDenominator = denominator;
      if (error === 0) {
        break;
      }
    }
  }

  const divisor = gcd(bestNumerator, bestDenominator);
  return {
    numerator: bestNumerator / divisor,
    denominator: bestDenominator / divisor,
  };
}

function formatFraction(value: number): string {
  const { numerator, denominator } = limitDenominator(value);
  if (denominator === 1) {
    return String(numerator);
  }
  if (numerator < 0) {
    return `-${String(Math.abs(numerator))}/${String(denominator)}`;
  }
  return `${String(numerator)}/${String(denominator)}`;
}

function formatGeneral(value: number, precision: number): string {
  if (value === 0 || Object.is(value, -0)) {
    return '0';
  }

  const abs = Math.abs(value);
  const exponent = Math.floor(Math.log10(abs));
  const useScientific = exponent < -1 || exponent >= precision;

  if (useScientific) {
    const digits = Math.max(0, precision - 1);
    const [mantissaRaw, exponentPart] = value.toExponential(digits).split('e');
    const mantissa =
      mantissaRaw?.replace(/\.0$/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') ?? '0';
    const sign = exponentPart?.startsWith('-') ? '-' : '+';
    const expDigits = exponentPart?.slice(1) ?? '0';
    const padded = expDigits.padStart(2, '0');
    return `${mantissa}e${sign}${padded}`;
  }

  const formatted = value.toPrecision(precision);
  if (!formatted.includes('.')) {
    return formatted;
  }
  return formatted.replace(/\.?0+$/, '');
}

/**
 * Format a floating-point number for tableau display.
 * Matches Python ``ftoa`` behavior.
 */
export function ftoa(
  value: number,
  precision: number | null,
  plusSign = false,
): string {
  const normalized = Object.is(value, -0) ? 0 : value;

  if (precision !== null && precision >= 0) {
    const formatted = formatGeneral(normalized, precision);
    if (plusSign && normalized >= 0) {
      return `+${formatted}`;
    }
    return formatted;
  }

  const fraction = formatFraction(normalized);
  if (normalized >= 0 && plusSign) {
    return `+${fraction}`;
  }
  return fraction;
}
