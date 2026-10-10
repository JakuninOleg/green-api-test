import { useState, type SubmitEvent } from "react";
import { connectInstance, type GreenApiCredentials } from "../api/green-api.ts";
import styles from "./ConnectionForm.module.css";

type ConnectionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

type ConnectionFormProps = {
  onConnect: (credentials: GreenApiCredentials) => void;
};

export function ConnectionForm({ onConnect }: ConnectionFormProps) {
  const [state, setState] = useState<ConnectionState>({ status: "idle" });
  const isSubmitting = state.status === "submitting";

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    // после await currentTarget уже null — берём форму заранее
    const form = event.currentTarget;
    const data = new FormData(form);
    const idInstance = data.get("idInstance");
    const apiTokenInstance = data.get("apiTokenInstance");

    if (typeof idInstance !== "string" || typeof apiTokenInstance !== "string") {
      setState({ status: "error", message: "Заполните данные инстанса GREEN-API." });
      return;
    }

    const credentials = {
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
    };
    setState({ status: "submitting" });

    try {
      await connectInstance(import.meta.env.VITE_GREEN_API_URL, credentials);
      form.reset();
      onConnect(credentials);
    } catch (error) {
      let message = "Не удалось подключиться. Попробуйте ещё раз.";

      if (error instanceof Error) {
        message = error.message;
      }

      setState({ status: "error", message });
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="connection-title">
      <a
        className={styles.brand}
        href="https://green-api.com/"
        target="_blank"
        rel="noreferrer"
      >
        <img
          className={styles.logo}
          src="/green-api-logo.svg"
          alt="GREEN-API"
          width={220}
          height={48}
        />
      </a>

      <h1 id="connection-title" className={styles.title}>Чат Telegram</h1>
      <p className={styles.description}>Введите данные инстанса из кабинета GREEN-API.</p>

      <form method="post" onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <div className={styles.fields}>
          <label className={styles.field}>
            idInstance
            <input
              className={styles.input}
              name="idInstance"
              type="text"
              inputMode="numeric"
              pattern="[0-9]+"
              autoComplete="off"
              spellCheck={false}
              required
              disabled={isSubmitting}
            />
          </label>

          <label className={styles.field}>
            apiTokenInstance
            <input
              className={styles.input}
              name="apiTokenInstance"
              type="password"
              autoComplete="off"
              required
              disabled={isSubmitting}
            />
          </label>
        </div>

        <button className={styles.button} type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Подключаемся…" : "Подключиться"}
        </button>

        {state.status === "error" && (
          <p className={styles.error} role="alert">{state.message}</p>
        )}
      </form>
    </section>
  );
}
