import type { ClientMessage, ServerMessage } from "./types";
export function connectGame(
  onMessage: (message: ServerMessage) => void,
  onConnection: (connected: boolean) => void,
  onError: (message: string) => void,
) {
  let socket: WebSocket;
  let timer: ReturnType<typeof setTimeout>;
  let stopped = false;
  let attempts = 0;
  const read = (key: string) =>
    localStorage.getItem(`cidade-dorme:${key}`) || undefined;
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
      socket.send(JSON.stringify({ type: "hello", adminToken, playerToken }));
    };
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "identity") {
        try {
          localStorage.setItem(
            `cidade-dorme:${message.kind}Token`,
            message.token,
          );
          if (message.name)
            localStorage.setItem("cidade-dorme:name", message.name);
        } catch {
          onError(
            "Não foi possível salvar sua identificação. Evite atualizar a página.",
          );
        }
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
