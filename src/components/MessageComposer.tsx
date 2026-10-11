import type { SubmitEvent } from "react";
import styles from "./ChatApp.module.css";

type MessageComposerProps = {
  draft: string;
  error: string;
  isSending: boolean;
  disabled: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void;
};

export function MessageComposer({
  draft,
  error,
  isSending,
  disabled,
  onDraftChange,
  onSubmit,
}: MessageComposerProps) {
  return (
    <form className={styles.composer} onSubmit={onSubmit} aria-busy={isSending}>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.composerRow}>
        <label htmlFor="message" className={styles.srOnly}>Сообщение</label>
        <textarea
          id="message"
          placeholder="Сообщение"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          maxLength={4096}
          required
          disabled={disabled}
        />
        <button
          className={styles.sendButton}
          type="submit"
          aria-label={isSending ? "Отправляем…" : "Отправить"}
          disabled={!draft.trim() || disabled}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="m4 4 17 8-17 8 3-8-3-8ZM7 12h14" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </form>
  );
}
