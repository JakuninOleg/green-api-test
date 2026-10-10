import { useEffect, useState } from "react";
import {
  deleteNotification,
  parseIncomingMessage,
  receiveNotification,
  type GreenApiCredentials,
  type TextMessage,
} from "../api/green-api.ts";

export function useNotificationPoll(
  credentials: GreenApiCredentials,
  onMessage: (message: TextMessage) => void,
): string {
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      while (!signal.aborted) {
        try {
          const notification = await receiveNotification(
            import.meta.env.VITE_GREEN_API_URL, credentials, signal,
          );

          if (signal.aborted) {
            return;
          }

          if (notification) {
            try {
              const message = parseIncomingMessage(notification.body);

              if (message) {
                onMessage(message);
              }
            } finally {
              // без delete очередь стоит на месте, даже если тип webhook нам не нужен
              await deleteNotification(
                import.meta.env.VITE_GREEN_API_URL, credentials, notification.receiptId, signal,
              );
            }
          }

          setError("");
        } catch (error) {
          if (signal.aborted) {
            return;
          }

          const message = error instanceof Error ? error.message : "Не удалось получить сообщения.";
          setError(`${message} Повторяем через 2 секунды.`);
          await new Promise<void>((resolve) => {
            retryTimer = setTimeout(resolve, 2000);
          });
        }
      }
    }

    void poll();

    return () => {
      controller.abort();
      clearTimeout(retryTimer);
    };
  }, [credentials, onMessage]);

  return error;
}
