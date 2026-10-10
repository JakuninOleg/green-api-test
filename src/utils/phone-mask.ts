export function normalizePhoneInput(input: string): string {
  let digits = input.replace(/\D/g, "");

  if (!digits) {
    return input.trim() === "+" ? "+" : "";
  }

  if (!input.trimStart().startsWith("+")) {
    if (digits.startsWith("8")) {
      digits = `7${digits.slice(1)}`;
    } else if (digits.startsWith("9")) {
      digits = `7${digits}`;
    }
  }

  return digits.slice(0, digits.startsWith("7") ? 11 : 15);
}

export function formatPhoneInput(value: string): string {
  if (!value || value === "+") {
    return value;
  }

  if (!value.startsWith("7")) {
    return `+${value}`;
  }

  let formatted = `+7 (${value.slice(1, 4)}`;

  if (value.length > 4) formatted += `) ${value.slice(4, 7)}`;
  if (value.length > 7) formatted += `-${value.slice(7, 9)}`;
  if (value.length > 9) formatted += `-${value.slice(9, 11)}`;

  return formatted;
}

export function phoneDigitsBefore(input: string, caret: number): number {
  return input.slice(0, caret).replace(/\D/g, "").length;
}

export function phoneCaretPosition(input: string, digitsBefore: number): number {
  if (input.startsWith("+7 (") && digitsBefore <= 1) {
    return 4;
  }

  if (digitsBefore === 0) {
    return Math.min(1, input.length);
  }

  let count = 0;

  for (let index = 0; index < input.length; index++) {
    if (/\d/.test(input[index]!)) {
      count++;
      if (count === digitsBefore) return index + 1;
    }
  }

  return input.length;
}

export function deletePhoneDigits(
  value: string,
  from: number,
  to: number,
  backward: boolean,
): { value: string; caretDigits: number } {
  const minimum = value.startsWith("7") ? 1 : 0;

  if (from !== to) {
    from = Math.max(minimum, from);
    to = Math.max(from, to);
  } else {
    if (backward) from--;
    to = from + 1;
  }

  if (from < minimum || from >= value.length) {
    return { value, caretDigits: Math.max(minimum, from) };
  }

  return { value: value.slice(0, from) + value.slice(to), caretDigits: from };
}
