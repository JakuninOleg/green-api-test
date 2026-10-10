import { Fragment, useCallback, useEffect, useRef, useState, type SubmitEvent } from "react";
import {
  checkAccount,
  sendMessage,
  type GreenApiCredentials,
  type TextMessage,
} from "../api/green-api.ts";
import { useNotificationPoll } from "../hooks/useNotificationPoll.ts";
import { PhoneInput } from "./PhoneInput.tsx";
import styles from "./ChatApp.module.css";

type ChatMessage = TextMessage & { direction: "in" | "out" };
type Chat = {
  chatId: string;
  title: string;
  messages: ChatMessage[];
};
type ChatAppProps = {
  credentials: GreenApiCredentials;
  onDisconnect: () => void;
};

function messageTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function messageDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ChatApp({ credentials, onDisconnect }: ChatAppProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [search, setSearch] = useState("");
  const [isConversationOpen, setIsConversationOpen] = useState(false);
  const sendController = useRef<AbortController | null>(null);
  const createController = useRef<AbortController | null>(null);
  const newChatDialog = useRef<HTMLDialogElement>(null);
  const messageList = useRef<HTMLDivElement>(null);
  const activeChat = chats.find((chat) => chat.chatId === activeChatId);
  const messageCount = activeChat?.messages.length ?? 0;
  const busy = isSending || isCreatingChat;
  const visibleChats = chats.filter((chat) => chat.title.includes(search.trim()));

  const appendMessage = useCallback((message: ChatMessage) => {
    setChats((currentChats) => {
      const existingChat = currentChats.find((chat) => chat.chatId === message.chatId);

      if (!existingChat) {
        return [
          ...currentChats,
          {
            chatId: message.chatId,
            title: message.chatId.endsWith("@c.us")
              ? `+${message.chatId.replace("@c.us", "")}`
              : message.chatId,
            messages: [message],
          },
        ];
      }

      // webhook иногда прилетает повторно — по id не дублируем
      if (existingChat.messages.some((item) => item.idMessage === message.idMessage)) {
        return currentChats;
      }

      return currentChats.map((chat) => {
        if (chat.chatId === message.chatId) {
          return { ...chat, messages: [...chat.messages, message] };
        }

        return chat;
      });
    });
    setActiveChatId((currentId) => currentId ?? message.chatId);
  }, []);

  const handleIncomingMessage = useCallback(
    (message: TextMessage) => {
      appendMessage({ ...message, direction: "in" });
    },
    [appendMessage],
  );

  const pollError = useNotificationPoll(credentials, handleIncomingMessage);

  useEffect(() => {
    const list = messageList.current;

    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [activeChatId, messageCount]);

  useEffect(
    () => () => {
      sendController.current?.abort();
      createController.current?.abort();
    },
    [],
  );

  function selectChat(chatId: string) {
    if (chatId !== activeChatId) {
      setDraft("");
    }

    setActiveChatId(chatId);
    setIsConversationOpen(true);
    setSendError("");
  }

  async function handleNewChat(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) {
      return;
    }

    const controller = new AbortController();
    createController.current = controller;
    setIsCreatingChat(true);
    setPhoneError("");

    try {
      // сразу берём telegram chatId, а не phone@c.us — иначе ответы часто уезжают в другой чат
      const account = await checkAccount(
        import.meta.env.VITE_GREEN_API_URL,
        credentials,
        phone,
        controller.signal,
      );

      if (controller.signal.aborted) {
        return;
      }

      const title = `+${account.phoneNumber}`;

      setChats((currentChats) => {
        const existing = currentChats.find((chat) => chat.chatId === account.chatId);

        if (existing) {
          return currentChats.map((chat) =>
            chat.chatId === account.chatId ? { ...chat, title } : chat,
          );
        }

        return [...currentChats, { chatId: account.chatId, title, messages: [] }];
      });
      selectChat(account.chatId);
      setPhone("");
      newChatDialog.current?.close();
    } catch (error) {
      if (!controller.signal.aborted) {
        setPhoneError(error instanceof Error ? error.message : "Проверьте номер телефона.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsCreatingChat(false);
      }
    }
  }

  async function handleSend(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();

    if (!activeChatId || !text || busy) {
      return;
    }

    const chatId = activeChatId;
    const controller = new AbortController();
    sendController.current = controller;
    setIsSending(true);
    setSendError("");

    try {
      const idMessage = await sendMessage(
        import.meta.env.VITE_GREEN_API_URL,
        credentials,
        chatId,
        text,
        controller.signal,
      );

      if (controller.signal.aborted) {
        return;
      }

      appendMessage({
        idMessage,
        chatId,
        text,
        timestamp: Date.now() / 1000,
        direction: "out",
      });
      setDraft("");
    } catch (error) {
      if (!controller.signal.aborted) {
        setSendError(error instanceof Error ? error.message : "Не удалось отправить сообщение.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSending(false);
      }
    }
  }

  return (
    <main className={styles.app} data-view={isConversationOpen ? "conversation" : "chats"}>
      <nav className={styles.rail} aria-label="Навигация">
        <button className={styles.railChats} type="button" onClick={() => setIsConversationOpen(false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M20 11.5a8 8 0 0 1-8 8H5l-3 2v-10a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
            <path d="M7 9h8M7 13h5" />
          </svg>
          <span>Чаты</span>
        </button>
        <button className={styles.railDisconnect} type="button" onClick={onDisconnect} title="Отключиться">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M13 8l4 4-4 4M8 12h13" />
          </svg>
          <span>Выйти</span>
        </button>
      </nav>

      <aside className={styles.sidebar} aria-label="Чаты">
        <header className={styles.sidebarHeader}>
          <h1>Чаты</h1>
          <button
            className={styles.newChatButton}
            type="button"
            aria-label="Новый чат"
            disabled={busy}
            onClick={() => {
              setPhoneError("");
              newChatDialog.current?.showModal();
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </header>
        <div className={styles.search}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" />
          </svg>
          <label htmlFor="chat-search" className={styles.srOnly}>Поиск по номеру</label>
          <input
            id="chat-search"
            type="search"
            placeholder="Поиск"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <nav className={styles.chatList} aria-label="Список чатов">
          {visibleChats.length === 0 && (
            <p className={styles.emptyList}>{search ? "Чаты не найдены" : "Начните новый чат"}</p>
          )}
          {visibleChats.map((chat) => {
            const lastMessage = chat.messages.at(-1);

            return (
              <button
                key={chat.chatId}
                type="button"
                className={`${styles.chatItem} ${chat.chatId === activeChatId ? styles.activeChat : ""}`}
                aria-current={chat.chatId === activeChatId ? "true" : undefined}
                onClick={() => selectChat(chat.chatId)}
                disabled={busy}
              >
                <span className={styles.avatar} aria-hidden="true">{chat.title.slice(-2)}</span>
                <span className={styles.chatDetails}>
                  <span className={styles.chatTitle}>{chat.title}</span>
                  <span className={styles.preview}>{lastMessage?.text ?? "Напишите первое сообщение"}</span>
                </span>
                {lastMessage && <span className={styles.chatTime}>{messageTime(lastMessage.timestamp)}</span>}
              </button>
            );
          })}
        </nav>
        <footer className={styles.account}>
          <span>GREEN-API {credentials.idInstance}</span>
          <button className={styles.mobileDisconnect} type="button" onClick={onDisconnect}>Выйти</button>
        </footer>
      </aside>

      <section className={styles.conversation} aria-label="Переписка" data-empty={!activeChat}>
        {activeChat && (
          <header className={styles.conversationHeader}>
            <button
              className={styles.backButton}
              type="button"
              aria-label="Назад к чатам"
              onClick={() => setIsConversationOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="m14 5-7 7 7 7M7 12h14" />
              </svg>
            </button>
            <span className={styles.headerAvatar} aria-hidden="true">{activeChat.title.slice(-2)}</span>
            <h2>{activeChat.title}</h2>
          </header>
        )}
        {pollError && <p className={styles.pollError} role="alert">{pollError}</p>}
        <div className={styles.messages} ref={messageList} role="log" aria-label="Сообщения" aria-live="polite">
          {messageCount === 0 && (
            <div className={styles.emptyConversation}>
              <h3>{activeChat ? "Начните разговор" : "Выберите чат"}</h3>
              <p>{activeChat ? "Напишите первое сообщение" : "Или создайте новый по номеру телефона"}</p>
            </div>
          )}
          {activeChat?.messages.map((message, index) => {
            const date = messageDate(message.timestamp);
            const previousMessage = activeChat.messages[index - 1];
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
        {activeChat && (
          <form className={styles.composer} onSubmit={handleSend} aria-busy={isSending}>
            {sendError && <p className={styles.error} role="alert">{sendError}</p>}
            <div className={styles.composerRow}>
              <label htmlFor="message" className={styles.srOnly}>Сообщение</label>
              <textarea
                id="message"
                placeholder="Сообщение"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={1}
                maxLength={4096}
                required
                disabled={busy}
              />
              <button
                className={styles.sendButton}
                type="submit"
                aria-label={isSending ? "Отправляем…" : "Отправить"}
                disabled={!draft.trim() || busy}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="m4 4 17 8-17 8 3-8-3-8ZM7 12h14" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </form>
        )}
      </section>

      <dialog
        className={styles.newChatDialog}
        ref={newChatDialog}
        aria-labelledby="new-chat-title"
        onClose={() => {
          createController.current?.abort();
          setIsCreatingChat(false);
        }}
      >
        <header className={styles.dialogHeader}>
          <h2 id="new-chat-title">Новый чат</h2>
          <button type="button" aria-label="Закрыть" onClick={() => newChatDialog.current?.close()}>×</button>
        </header>
        <form className={styles.newChat} onSubmit={handleNewChat} aria-busy={isCreatingChat}>
          <label htmlFor="phone">Номер телефона</label>
          <PhoneInput
            value={phone}
            onChange={setPhone}
            invalid={Boolean(phoneError)}
            disabled={isCreatingChat}
          />
          <p id="phone-help" className={styles.hint}>С кодом страны</p>
          {phoneError && <p className={styles.error} role="alert">{phoneError}</p>}
          <button className={styles.primaryButton} type="submit" disabled={isCreatingChat}>
            {isCreatingChat ? "Проверяем…" : "Начать"}
          </button>
        </form>
      </dialog>
    </main>
  );
}
