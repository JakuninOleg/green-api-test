import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkAccount,
  connectInstance,
  deleteNotification,
  parseIncomingMessage,
  phoneDigits,
  receiveNotification,
  sendMessage,
} from "../src/api/green-api.ts";

const apiUrl = "https://4100.api.green-api.com/";
const credentials = { idInstance: "4100000000", apiTokenInstance: "test-token" };
const incomingBody = {
  typeWebhook: "incomingMessageReceived",
  idMessage: "incoming-1",
  timestamp: 1763115112,
  senderData: { chatId: "79991234567@c.us" },
  messageData: {
    typeMessage: "textMessage",
    textMessageData: { textMessage: "Привет!" },
  },
};

test("вызывает GetStateInstance один раз и принимает authorized", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ stateInstance: "authorized" }),
  );

  await connectInstance(apiUrl, credentials);

  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(
    fetchMock.mock.calls[0].arguments[0],
    "https://4100.api.green-api.com/waInstance4100000000/getStateInstance/test-token",
  );
});

test("не подключается к инстансу без authorized", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ stateInstance: "notAuthorized" }),
  );

  await assert.rejects(connectInstance(apiUrl, credentials), /статус: notAuthorized/);
});

// тело ответа с токеном — в UI его быть не должно
test("обрабатывает HTTP-ошибку без вывода тела ответа и повторов", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    new Response(credentials.apiTokenInstance, { status: 401 }),
  );

  await assert.rejects(connectInstance(apiUrl, credentials), {
    message: "Не удалось подключиться. Проверьте idInstance и apiTokenInstance.",
  });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("обрабатывает сетевую ошибку без утечки токена", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError(`Failed to fetch ${apiUrl}/${credentials.apiTokenInstance}`);
  });

  await assert.rejects(connectInstance(apiUrl, credentials), {
    message: "Не удалось получить ответ от GREEN-API. Проверьте соединение.",
  });
});

test("нормализует телефон и отклоняет пустой номер", () => {
  assert.equal(phoneDigits("+7 (999) 123-45-67"), "79991234567");
  assert.throws(() => phoneDigits("---"), /Введите номер/);
});

test("SendMessage отправляет POST с chatId и message и возвращает idMessage", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ idMessage: "outgoing-1" }),
  );
  const signal = new AbortController().signal;

  assert.equal(
    await sendMessage(apiUrl, credentials, "79991234567@c.us", "Привет!", signal),
    "outgoing-1",
  );
  assert.equal(fetchMock.mock.callCount(), 1);
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, "https://4100.api.green-api.com/waInstance4100000000/sendMessage/test-token");
  assert.equal(options.method, "POST");
  assert.equal(options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(options.body), { chatId: "79991234567@c.us", message: "Привет!" });
  assert.equal(options.signal, signal);
});

test("SendMessage отклоняет HTTP-ошибку без утечки токена и автоматического повтора", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    new Response(credentials.apiTokenInstance, { status: 400 }),
  );

  await assert.rejects(sendMessage(apiUrl, credentials, "79991234567@c.us", "Привет!"), {
    message: "Не удалось отправить сообщение. Проверьте номер и повторите попытку.",
  });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("пустое сообщение не отправляется, ответ без idMessage не считается успехом", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json({}));

  await assert.rejects(sendMessage(apiUrl, credentials, "79991234567@c.us", "  "), /Введите текст/);
  assert.equal(fetchMock.mock.callCount(), 0);
  await assert.rejects(sendMessage(apiUrl, credentials, "79991234567@c.us", "Привет!"), /не подтвердил/);
});

test("парсит входящий textMessage и сохраняет chatId из API", () => {
  assert.deepEqual(parseIncomingMessage(incomingBody), {
    idMessage: "incoming-1", chatId: "79991234567@c.us", text: "Привет!", timestamp: 1763115112,
  });
});

// в preview ссылки есть title — нам нужен только text
test("парсит extendedTextMessage без отображения метаданных ссылки", () => {
  assert.equal(parseIncomingMessage({
    ...incomingBody,
    messageData: {
      typeMessage: "extendedTextMessage",
      extendedTextMessageData: { text: "https://example.com", title: "Заголовок" },
    },
  }).text, "https://example.com");
});

// реальный кейс: телефон в приватности выключен, API отдаёт 0
test("не подменяет Telegram chatId при скрытом или открытом телефоне", () => {
  const withPhone = {
    ...incomingBody,
    senderData: { chatId: "10000000", senderPhoneNumber: 79991234567 },
  };
  const hiddenPhone = {
    ...incomingBody,
    senderData: { chatId: "10000000", senderPhoneNumber: 0 },
  };

  assert.equal(parseIncomingMessage(withPhone).chatId, "10000000");
  assert.equal(parseIncomingMessage(hiddenPhone).chatId, "10000000");
});

test("CheckAccount резолвит номер в Telegram chatId", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      exist: true,
      chatId: "10000000",
      phoneNumber: 79991234567,
      fromCache: true,
    }),
  );

  assert.deepEqual(await checkAccount(apiUrl, credentials, "+7 (999) 123-45-67"), {
    chatId: "10000000",
    phoneNumber: "79991234567",
  });
  assert.equal(
    fetchMock.mock.calls[0].arguments[0],
    "https://4100.api.green-api.com/waInstance4100000000/checkAccount/test-token",
  );
  assert.deepEqual(JSON.parse(fetchMock.mock.calls[0].arguments[1].body), {
    phoneNumber: 79991234567,
  });
});

test("CheckAccount отклоняет номер без Telegram", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ exist: false, chatId: "", phoneNumber: 79991234567 }),
  );
  await assert.rejects(checkAccount(apiUrl, credentials, "79991234567"), /не найден.*приватности/);
  assert.equal(phoneDigits("+7 999 123-45-67"), "79991234567");
});

// у них иногда status:false вместо exist — разные причины, разные тексты
test("CheckAccount различает ограничение Telegram, состояние инстанса и некорректный ответ", async (t) => {
  const cases = [
    [{ status: false, data: { reason: "rate_limit_exceeded" } }, /ограничил проверку/],
    [{ status: false, reason: "instance is starting or not authorized" }, /не авторизован/],
    [{ status: false, reason: "unknown error" }, /Не удалось проверить/],
    [{ exist: true, chatId: null }, /некорректный ответ/],
  ];
  let response;
  t.mock.method(globalThis, "fetch", async () => Response.json(response));

  for (const [body, error] of cases) {
    response = body;
    await assert.rejects(checkAccount(apiUrl, credentials, "79991234567"), error);
  }
});

// статусы доставки и картинки в UI не показываем, но из очереди их всё равно надо снять
test("игнорирует статусы, медиа и некорректные тела уведомлений", () => {
  for (const body of [
    null,
    {},
    { ...incomingBody, senderData: null },
    { ...incomingBody, typeWebhook: "outgoingMessageStatus" },
    { ...incomingBody, messageData: { typeMessage: "imageMessage" } },
  ]) {
    assert.equal(parseIncomingMessage(body), null);
  }
});

test("ReceiveNotification передаёт receiveTimeout=5 и signal, возвращает receiptId и body", async (t) => {
  const notification = { receiptId: 12345, body: incomingBody };
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json(notification));
  const signal = new AbortController().signal;

  assert.deepEqual(await receiveNotification(apiUrl, credentials, signal), notification);
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, "https://4100.api.green-api.com/waInstance4100000000/receiveNotification/test-token?receiveTimeout=5");
  assert.equal(options.signal, signal);
});

test("ReceiveNotification принимает пустое тело и JSON null как пустую очередь", async (t) => {
  const responses = [new Response(""), Response.json(null)];
  t.mock.method(globalThis, "fetch", async () => responses.shift());

  assert.equal(await receiveNotification(apiUrl, credentials), null);
  assert.equal(await receiveNotification(apiUrl, credentials), null);
});

test("DeleteNotification вызывает DELETE по receiptId и проверяет подтверждение", async (t) => {
  const responses = [Response.json({ result: true }), Response.json({ result: false })];
  const fetchMock = t.mock.method(globalThis, "fetch", async () => responses.shift());
  const signal = new AbortController().signal;

  await deleteNotification(apiUrl, credentials, 12345, signal);
  const [url, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(url, "https://4100.api.green-api.com/waInstance4100000000/deleteNotification/test-token/12345");
  assert.equal(options.method, "DELETE");
  assert.equal(options.signal, signal);
  await assert.rejects(deleteNotification(apiUrl, credentials, 12345), /не подтвердил удаление/);
});
