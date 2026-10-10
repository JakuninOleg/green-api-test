export type GreenApiCredentials = {
  idInstance: string;
  apiTokenInstance: string;
};

export type GreenApiNotification = {
  receiptId: number;
  body: unknown;
};

export type TextMessage = {
  idMessage: string;
  chatId: string;
  text: string;
  timestamp: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function instanceUrl(
  apiUrl: string | undefined,
  { idInstance, apiTokenInstance }: GreenApiCredentials,
  method: string,
): string {
  if (!apiUrl) {
    throw new Error("Укажите адрес GREEN-API в VITE_GREEN_API_URL.");
  }

  if (!/^\d+$/.test(idInstance) || !apiTokenInstance.trim()) {
    throw new Error("Заполните данные инстанса GREEN-API.");
  }

  return `${apiUrl.replace(/\/$/, "")}/waInstance${idInstance}/${method}/${encodeURIComponent(apiTokenInstance)}`;
}

async function request(
  url: string,
  options: RequestInit,
  errorMessage: string,
): Promise<unknown> {
  let response: Response;
  let data: unknown = null;

  try {
    response = await fetch(url, { ...options, cache: "no-store" });

    if (response.ok) {
      // пустое тело у receiveNotification = очередь пуста, не ошибка
      const text = await response.text();
      data = text.trim() ? JSON.parse(text) : null;
    }
  } catch {
    if (options.signal?.aborted) {
      throw new DOMException("Запрос отменён.", "AbortError");
    }

    // текст сетевой ошибки часто содержит URL с токеном — наружу не отдаём
    throw new Error("Не удалось получить ответ от GREEN-API. Проверьте соединение.");
  }

  if (!response.ok) {
    throw new Error(errorMessage);
  }

  return data;
}

export async function connectInstance(
  apiUrl: string | undefined,
  credentials: GreenApiCredentials,
): Promise<void> {
  const data = await request(
    instanceUrl(apiUrl, credentials, "getStateInstance"),
    {},
    "Не удалось подключиться. Проверьте idInstance и apiTokenInstance.",
  );

  if (!isRecord(data) || typeof data.stateInstance !== "string") {
    throw new Error("GREEN-API вернул некорректное состояние инстанса.");
  }

  if (data.stateInstance !== "authorized") {
    const hints: Record<string, string> = {
      notAuthorized: "Авторизуйте инстанс в кабинете (QR или код из Telegram).",
      starting: "Инстанс запускается — подождите до 5 минут и попробуйте снова.",
      pendingPassword: "Нужен пароль 2FA — завершите авторизацию в кабинете GREEN-API.",
      blocked: "Инстанс заблокирован. Проверьте аккаунт в кабинете GREEN-API.",
      suspended: "На аккаунте временные ограничения. Проверьте кабинет GREEN-API.",
    };
    const hint = hints[data.stateInstance] ?? "Проверьте инстанс в кабинете GREEN-API.";
    throw new Error(`Инстанс не готов (статус: ${data.stateInstance}). ${hint}`);
  }
}

export function phoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (!/^[1-9]\d{6,14}$/.test(digits)) {
    throw new Error("Введите номер с кодом страны: от 7 до 15 цифр.");
  }

  return digits;
}

export type CheckedAccount = {
  chatId: string;
  phoneNumber: string;
};

// без этого входящие часто приходят с telegram id, а не с phone@c.us —
// и при скрытом номере (senderPhoneNumber: 0) чат разъезжается на два
export async function checkAccount(
  apiUrl: string | undefined,
  credentials: GreenApiCredentials,
  phone: string,
  signal?: AbortSignal,
): Promise<CheckedAccount> {
  const digits = phoneDigits(phone);
  const data = await request(
    instanceUrl(apiUrl, credentials, "checkAccount"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: Number(digits) }),
      signal,
    },
    "Не удалось проверить номер в Telegram. Попробуйте ещё раз.",
  );

  if (isRecord(data) && data.status === false) {
    if (isRecord(data.data) && data.data.reason === "rate_limit_exceeded") {
      throw new Error("Telegram временно ограничил проверку номеров. Попробуйте позже.");
    }

    if (data.reason === "instance is starting or not authorized") {
      throw new Error("Инстанс запускается или не авторизован. Проверьте кабинет GREEN-API.");
    }

    throw new Error("Не удалось проверить номер в Telegram. Попробуйте позже.");
  }

  if (isRecord(data) && data.exist === false) {
    throw new Error("Номер не найден в Telegram или скрыт настройками приватности.");
  }

  if (
    !isRecord(data) ||
    data.exist !== true ||
    typeof data.chatId !== "string" ||
    !/^\d+$/.test(data.chatId)
  ) {
    throw new Error("GREEN-API вернул некорректный ответ при проверке номера.");
  }

  return { chatId: data.chatId, phoneNumber: digits };
}

export async function sendMessage(
  apiUrl: string | undefined,
  credentials: GreenApiCredentials,
  chatId: string,
  message: string,
  signal?: AbortSignal,
): Promise<string> {
  if (!chatId || !message.trim() || message.length > 4096) {
    throw new Error("Введите текст сообщения: от 1 до 4096 символов.");
  }

  const data = await request(
    instanceUrl(apiUrl, credentials, "sendMessage"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
      signal,
    },
    "Не удалось отправить сообщение. Проверьте номер и повторите попытку.",
  );

  if (!isRecord(data) || typeof data.idMessage !== "string" || !data.idMessage) {
    throw new Error("GREEN-API не подтвердил отправку сообщения.");
  }

  return data.idMessage;
}

export async function receiveNotification(
  apiUrl: string | undefined,
  credentials: GreenApiCredentials,
  signal?: AbortSignal,
): Promise<GreenApiNotification | null> {
  // 5 сек — как в доке; long-poll, пока в очереди ничего нет
  const data = await request(
    `${instanceUrl(apiUrl, credentials, "receiveNotification")}?receiveTimeout=5`,
    { signal },
    "Не удалось получить сообщения. Проверьте настройки уведомлений в кабинете GREEN-API.",
  );

  if (data === null) {
    return null;
  }

  if (
    !isRecord(data) ||
    typeof data.receiptId !== "number" ||
    !Number.isSafeInteger(data.receiptId) ||
    data.receiptId < 0
  ) {
    throw new Error("GREEN-API вернул некорректное уведомление.");
  }

  return { receiptId: data.receiptId, body: data.body };
}

export async function deleteNotification(
  apiUrl: string | undefined,
  credentials: GreenApiCredentials,
  receiptId: number,
  signal?: AbortSignal,
): Promise<void> {
  const data = await request(
    `${instanceUrl(apiUrl, credentials, "deleteNotification")}/${receiptId}`,
    { method: "DELETE", signal },
    "Не удалось удалить уведомление. Приём будет повторён.",
  );

  if (!isRecord(data) || data.result !== true) {
    throw new Error("GREEN-API не подтвердил удаление уведомления. Приём будет повторён.");
  }
}

export function parseIncomingMessage(body: unknown): TextMessage | null {
  if (
    !isRecord(body) ||
    body.typeWebhook !== "incomingMessageReceived" ||
    typeof body.idMessage !== "string" ||
    !body.idMessage ||
    typeof body.timestamp !== "number" ||
    !Number.isFinite(body.timestamp) ||
    !isRecord(body.senderData) ||
    typeof body.senderData.chatId !== "string" ||
    !/^(?:\d+@c\.us|\d+)$/.test(body.senderData.chatId) ||
    !isRecord(body.messageData)
  ) {
    return null;
  }

  const { messageData } = body;
  let text: unknown;

  if (messageData.typeMessage === "textMessage" && isRecord(messageData.textMessageData)) {
    text = messageData.textMessageData.textMessage;
  } else if (
    messageData.typeMessage === "extendedTextMessage" &&
    isRecord(messageData.extendedTextMessageData)
  ) {
    text = messageData.extendedTextMessageData.text;
  }

  if (typeof text !== "string" || !text.trim()) {
    return null;
  }

  // id не трогаем: маппить на номер тут нельзя — у части аккаунтов телефон скрыт
  return {
    idMessage: body.idMessage,
    chatId: body.senderData.chatId,
    text,
    timestamp: body.timestamp,
  };
}
