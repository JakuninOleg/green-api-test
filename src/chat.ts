import type { TextMessage } from "./api/green-api.ts";

export type ChatMessage = TextMessage & { direction: "in" | "out" };

export type Chat = {
  chatId: string;
  title: string;
  messages: ChatMessage[];
};

export function messageTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
