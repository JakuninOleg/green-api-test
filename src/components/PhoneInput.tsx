import type { ChangeEvent, KeyboardEvent } from "react";
import {
  deletePhoneDigits,
  formatPhoneInput,
  normalizePhoneInput,
  phoneCaretPosition,
  phoneDigitsBefore,
} from "../utils/phone-mask.ts";

type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  invalid: boolean;
};

export function PhoneInput({ value, onChange, disabled, invalid }: PhoneInputProps) {
  function update(input: HTMLInputElement, nextValue: string, caretDigits: number) {
    const formatted = formatPhoneInput(nextValue);
    // При удалении разделителя значение может не измениться; всё равно восстанавливаем поле и курсор.
    input.value = formatted;
    const caret = phoneCaretPosition(formatted, caretDigits);
    input.setSelectionRange(caret, caret);
    onChange(nextValue);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const caret = input.selectionStart ?? input.value.length;
    const count = phoneDigitsBefore(input.value, caret);
    const nextValue = normalizePhoneInput(input.value);
    const inputType = (event.nativeEvent as InputEvent).inputType;

    // Мобильная клавиатура может удалять символ без события keydown.
    if (nextValue === value && inputType?.startsWith("deleteContent")) {
      const next = deletePhoneDigits(value, count, count, inputType.endsWith("Backward"));
      update(input, next.value, next.caretDigits);
      return;
    }

    const caretDigits = caret === input.value.length ? nextValue.length : count;
    update(input, nextValue, caretDigits);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!value || value === "+" || event.ctrlKey || event.metaKey || (event.key !== "Backspace" && event.key !== "Delete")) {
      return;
    }

    event.preventDefault();
    const input = event.currentTarget;
    const from = phoneDigitsBefore(input.value, input.selectionStart ?? 0);
    const to = phoneDigitsBefore(input.value, input.selectionEnd ?? 0);
    const next = deletePhoneDigits(value, from, to, event.key === "Backspace");
    update(input, next.value, next.caretDigits);
  }

  return (
    <input
      id="phone"
      type="tel"
      inputMode="tel"
      placeholder="+7 (___) ___-__-__"
      autoComplete="tel"
      autoFocus
      value={formatPhoneInput(value)}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={(event) => {
        if (!value) update(event.currentTarget, "7", 1);
      }}
      onBlur={() => {
        if (value === "7" || value === "+") onChange("");
      }}
      onPaste={(event) => {
        event.preventDefault();
        const input = event.currentTarget;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? start;
        const pasted = event.clipboardData.getData("text");

        if (!value || value === "7" || value === "+" || (start === 0 && end === input.value.length)) {
          const nextValue = normalizePhoneInput(pasted);
          update(input, nextValue, nextValue.length);
          return;
        }

        const combined = input.value.slice(0, start) + pasted + input.value.slice(end);
        update(input, normalizePhoneInput(combined), phoneDigitsBefore(combined, start + pasted.length));
      }}
      pattern={value.startsWith("7")
        ? "\\+7 \\([0-9]{3}\\) [0-9]{3}-[0-9]{2}-[0-9]{2}"
        : "\\+[1-9][0-9]{6,14}"}
      maxLength={18}
      aria-invalid={invalid}
      aria-describedby="phone-help"
      required
      disabled={disabled}
    />
  );
}
