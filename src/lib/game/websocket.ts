import type { ClientMessage, ServerMessage } from "./types";
import { roomStorageKey } from "./rooms";
export function connectGame(
  roomCode: string | undefined,
  onMessage: (message: ServerMessage) => void,
  onConnection: (connected: boolean) => void,
  onError: (message: string) => void,
) {
  let socket: WebSocket;
  let timer: ReturnType<typeof setTimeout>;
  let stopped = false;
  let attempts = 0;
  const read = (key: string) =>
    roomCode
      ? localStorage.getItem(roomStorageKey(roomCode, key)) || undefined
      : undefined;
  function connect() {
    let adminToken: string | undefined;
    let playerToken: string | undefined;
    try {
      adminToken = read("adminToken");
      playerToken = read("playerToken");
      localStorage.setItem("cidade-dorme:storage", "ok");
    } catch {
      onError(
        "Permita o armazenamento local neste navegador para entrar e manter sua identificação.",
      );
      return;
    }
    socket = new WebSocket(
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`,
    );
    socket.onopen = () => {
      attempts = 0;
      socket.send(
        JSON.stringify({ type: "hello", roomCode, adminToken, playerToken }),
      );
    };
    socket.onmessage = (event) => {
      if (stopped) return;
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "identity") {
        roomCode = message.roomCode;
        try {
          localStorage.setItem(
            roomStorageKey(roomCode, `${message.kind}Token`),
            message.token,
          );
          if (message.name)
            localStorage.setItem(
              roomStorageKey(roomCode, "name"),
              message.name,
            );
        } catch {
          onError(
            "Não foi possível salvar sua identificação. Evite atualizar a página.",
          );
        }
      }
      if (message.type === "identity-reset") {
        try {
          localStorage.removeItem(
            roomStorageKey(message.roomCode, `${message.kind}Token`),
          );
          if (message.kind === "player")
            localStorage.removeItem(roomStorageKey(message.roomCode, "name"));
        } catch {
          onError("Não foi possível apagar sua identificação neste navegador.");
        }
      }
      if (message.type === "room-closed") {
        try {
          localStorage.removeItem(roomStorageKey(message.roomCode, "adminToken"));
          localStorage.removeItem(roomStorageKey(message.roomCode, "playerToken"));
          localStorage.removeItem(roomStorageKey(message.roomCode, "name"));
        } catch {
          onError("Não foi possível apagar a identificação da sala fechada.");
        }
        stopped = true;
        clearTimeout(timer);
        socket.close();
      }
      if (message.type === "state") onConnection(true);
      onMessage(message);
    };
    socket.onclose = () => {
      onConnection(false);
      if (!stopped)
        timer = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 10000));
    };
    socket.onerror = () => socket.close();
  }
  connect();
  return {
    send(message: ClientMessage) {
      if (socket?.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify(message));
      else onError("Sem conexão. Aguarde a reconexão para continuar.");
    },
    close() {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
    },
  };
}
