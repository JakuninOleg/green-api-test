import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deletePhoneDigits,
  formatPhoneInput,
  normalizePhoneInput,
  phoneCaretPosition,
  phoneDigitsBefore,
} from "../src/utils/phone-mask.ts";

test("форматирует российский номер и принимает 8 или 9 без кода страны", () => {
  for (const input of ["+7 (999) 123-45-67", "8 999 123 45 67", "9991234567"]) {
    const value = normalizePhoneInput(input);
    assert.equal(value, "79991234567");
    assert.equal(formatPhoneInput(value), "+7 (999) 123-45-67");
  }
  assert.equal(formatPhoneInput("799"), "+7 (99");
});

test("сохраняет международный код, введённый с плюсом", () => {
  for (const input of ["+44 7911 123456", "+84 901 234 567", "+90 532 123 45 67"]) {
    const value = normalizePhoneInput(input);
    assert.equal(formatPhoneInput(value), input.replace(/\s/g, ""));
  }
  assert.equal(formatPhoneInput(normalizePhoneInput("+")), "+");
  assert.equal(formatPhoneInput(normalizePhoneInput("")), "");
});

test("Backspace и Delete удаляют цифры через разделители", () => {
  const value = "79991234567";
  const formatted = formatPhoneInput(value);
  const afterBracket = formatted.indexOf(")") + 2;
  const beforeHyphen = formatted.indexOf("-");
  const back = phoneDigitsBefore(formatted, afterBracket);
  const forward = phoneDigitsBefore(formatted, beforeHyphen);

  assert.deepEqual(deletePhoneDigits(value, back, back, true), {
    value: "7991234567", caretDigits: 3,
  });
  assert.deepEqual(deletePhoneDigits(value, forward, forward, false), {
    value: "7999123567", caretDigits: 7,
  });
  assert.equal(phoneCaretPosition(formatted, 4), formatted.indexOf(")"));
});

test("удаляет выделенные цифры и сохраняет российский префикс", () => {
  assert.deepEqual(deletePhoneDigits("79991234567", 1, 4, true), {
    value: "71234567", caretDigits: 1,
  });
  assert.deepEqual(deletePhoneDigits("7", 1, 1, true), {
    value: "7", caretDigits: 1,
  });
  assert.deepEqual(deletePhoneDigits("79991234567", 0, 11, true), {
    value: "7", caretDigits: 1,
  });
  assert.equal(phoneCaretPosition("+7 (", 1), 4);
});
