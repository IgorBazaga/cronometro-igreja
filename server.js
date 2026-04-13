const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

let timerState = {
  duration: 300,
  remaining: 300,
  overtime: 0,
  running: false,
  mode: "countdown",
  displayMode: "timer",
  lastTick: null
};

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

setInterval(() => {
  if (!timerState.running || timerState.lastTick === null) return;

  const now = Date.now();
  const diffSeconds = Math.floor((now - timerState.lastTick) / 1000);

  if (diffSeconds <= 0) return;

  timerState.lastTick += diffSeconds * 1000;

  if (timerState.mode === "countdown") {
    timerState.remaining -= diffSeconds;

    if (timerState.remaining <= 0) {
      timerState.overtime = Math.abs(timerState.remaining);
      timerState.remaining = 0;
      timerState.mode = "overtime";
    }
  } else {
    timerState.overtime += diffSeconds;
  }

  emitState();
}, 200);

io.on("connection", (socket) => {
  emitState();

  socket.on("timer:start", () => {
    if (!timerState.running) {
      timerState.running = true;
      timerState.lastTick = Date.now();
      emitState();
    }
  });

  socket.on("timer:pause", () => {
    if (timerState.running) {
      timerState.running = false;
      timerState.lastTick = null;
      emitState();
    }
  });

  socket.on("timer:reset", () => {
    timerState.running = false;
    timerState.mode = "countdown";
    timerState.remaining = timerState.duration;
    timerState.overtime = 0;
    timerState.lastTick = null;
    emitState();
  });

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

  socket.on("timer:add", (seconds) => {
    const value = Number(seconds) || 0;

    if (timerState.mode === "countdown") {
      timerState.remaining = Math.max(0, timerState.remaining + value);
    } else {
      timerState.overtime = Math.max(0, timerState.overtime + value);
    }

    emitState();
  });

  socket.on("display:timer", () => {
    timerState.displayMode = "timer";
    emitState();
  });

  socket.on("display:clock", () => {
    timerState.displayMode = "clock";
    emitState();
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor rodando na porta " + PORT);
});