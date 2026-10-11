import { Fragment, useEffect, useRef } from "react";
import { messageTime, type Chat } from "../chat.ts";
import styles from "./ChatApp.module.css";

type MessageListProps = {
  chat: Chat | undefined;
};

function messageDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function MessageList({ chat }: MessageListProps) {
  const messageList = useRef<HTMLDivElement>(null);
  const chatId = chat?.chatId;
  const messageCount = chat?.messages.length ?? 0;

  useEffect(() => {
    const list = messageList.current;

    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [chatId, messageCount]);

  return (
    <div className={styles.messages} ref={messageList} role="log" aria-label="Сообщения" aria-live="polite">
      {messageCount === 0 && (
        <div className={styles.emptyConversation}>
          <h3>{chat ? "Начните разговор" : "Выберите чат"}</h3>
          <p>{chat ? "Напишите первое сообщение" : "Или создайте новый по номеру телефона"}</p>
        </div>
      )}
      {chat?.messages.map((message, index) => {
        const date = messageDate(message.timestamp);
        const previousMessage = chat.messages[index - 1];
        const showDate = !previousMessage || messageDate(previousMessage.timestamp) !== date;

        return (
          <Fragment key={message.idMessage}>
            {showDate && <div className={styles.date}><span>{date}</span></div>}
            <div className={`${styles.messageRow} ${message.direction === "out" ? styles.outgoing : ""}`}>
              <div className={styles.bubble}>
                <span className={styles.srOnly}>{message.direction === "out" ? "Вы: " : "Собеседник: "}</span>
                <p>{message.text}</p>
                <time className={styles.messageTime} dateTime={new Date(message.timestamp * 1000).toISOString()}>
                  {messageTime(message.timestamp)}
                </time>
              </div>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
