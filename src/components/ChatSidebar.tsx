import { messageTime, type Chat } from "../chat.ts";
import styles from "./ChatApp.module.css";

type ChatSidebarProps = {
  chats: Chat[];
  activeChatId: string | null;
  search: string;
  idInstance: string;
  disabled: boolean;
  onSearchChange: (value: string) => void;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDisconnect: () => void;
};

export function ChatSidebar({
  chats,
  activeChatId,
  search,
  idInstance,
  disabled,
  onSearchChange,
  onSelectChat,
  onNewChat,
  onDisconnect,
}: ChatSidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label="Чаты">
      <header className={styles.sidebarHeader}>
        <h1>Чаты</h1>
        <button
          className={styles.newChatButton}
          type="button"
          aria-label="Новый чат"
          disabled={disabled}
          onClick={onNewChat}
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
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <nav className={styles.chatList} aria-label="Список чатов">
        {chats.length === 0 && (
          <p className={styles.emptyList}>{search ? "Чаты не найдены" : "Начните новый чат"}</p>
        )}
        {chats.map((chat) => {
          const lastMessage = chat.messages.at(-1);

          return (
            <button
              key={chat.chatId}
              type="button"
              className={`${styles.chatItem} ${chat.chatId === activeChatId ? styles.activeChat : ""}`}
              aria-current={chat.chatId === activeChatId ? "true" : undefined}
              onClick={() => onSelectChat(chat.chatId)}
              disabled={disabled}
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
        <span>GREEN-API {idInstance}</span>
        <button className={styles.mobileDisconnect} type="button" onClick={onDisconnect}>Выйти</button>
      </footer>
    </aside>
  );
}
