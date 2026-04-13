const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 🔥 SERVIR ARQUIVOS
app.use(express.static("public"));

// 🔥 ESTADO DO TIMER
let timerState = {
  duration: 300,
  remaining: 300,
  overtime: 0,
  running: false,
  mode: "countdown", // countdown | overtime
  displayMode: "timer", // timer | clock
  lastTick: null
};

// 🔄 EMITIR ESTADO
function emitState() {
  io.emit("timer:update", {
    duration: timerState.duration,
    remaining: timerState.remaining,
    overtime: timerState.overtime,
    running: timerState.running,
    mode: timerState.mode,
    displayMode: timerState.displayMode
  });
}

// ⏱ LOOP DO TIMER
setInterval(() => {
  if (!timerState.running || timerState.lastTick === null) return;

  const now = Date.now();
  const diffSeconds = Math.floor((now - timerState.lastTick) / 1000);

  if (diffSeconds <= 0) return;

  timerState.lastTick += diffSeconds * 1000;

  // 🔽 CONTAGEM REGRESSIVA
  if (timerState.mode === "countdown") {
    timerState.remaining -= diffSeconds;

    // 🔥 VIROU ZERO → COMEÇA O VERMELHO
    if (timerState.remaining <= 0) {
      timerState.overtime = Math.abs(timerState.remaining);
      timerState.remaining = 0;
      timerState.mode = "overtime";
    }
  }
  // 🔺 CONTAGEM PROGRESSIVA
  else {
    timerState.overtime += diffSeconds;
  }

  emitState();
}, 200);

// 🔌 CONEXÃO SOCKET
io.on("connection", (socket) => {
  emitState();

  // ▶ INICIAR
  socket.on("timer:start", () => {
    if (!timerState.running) {
      timerState.running = true;
      timerState.lastTick = Date.now();
      emitState();
    }
  });

  // ⏸ PAUSAR
  socket.on("timer:pause", () => {
    if (timerState.running) {
      timerState.running = false;
      timerState.lastTick = null;
      emitState();
    }
  });

  // ⏹ RESETAR
  socket.on("timer:reset", () => {
    timerState.running = false;
    timerState.mode = "countdown";
    timerState.remaining = timerState.duration;
    timerState.overtime = 0;
    timerState.lastTick = null;
    emitState();
  });

  // ⏱ DEFINIR TEMPO
  socket.on("timer:set", (seconds) => {
    const value = Math.max(0, Number(seconds) || 0);

    timerState.duration = value;
    timerState.remaining = value;
    timerState.overtime = 0;
    timerState.running = false;
    timerState.mode = "countdown";
    timerState.lastTick = null;

    emitState();
  });

  // ➕➖ AJUSTAR TEMPO
  socket.on("timer:add", (seconds) => {
    const value = Number(seconds) || 0;

    if (timerState.mode === "countdown") {
      timerState.remaining = Math.max(0, timerState.remaining + value);
    } else {
      timerState.overtime = Math.max(0, timerState.overtime + value);
    }

    emitState();
  });

  // 🖥 TROCAR EXIBIÇÃO
  socket.on("display:timer", () => {
    timerState.displayMode = "timer";
    emitState();
  });

  socket.on("display:clock", () => {
    timerState.displayMode = "clock";
    emitState();
  });
});

// 🔥 PORTA AUTOMÁTICA (RENDER)
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor rodando na porta " + PORT);
});