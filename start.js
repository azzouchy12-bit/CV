/* eslint-disable @typescript-eslint/no-require-imports */
const net = require("net");
const { spawn } = require("child_process");

const primaryPort = parseInt(process.env.PORT || "8080", 10);
const secondaryPort = primaryPort === 3000 ? 8080 : 3000;

const nextBin = require.resolve("next/dist/bin/next");

// Start Next.js on the primary port (0.0.0.0:PORT)
const nextApp = spawn(process.execPath, [nextBin, "start", "-H", "0.0.0.0", "-p", primaryPort.toString()], {
  stdio: "inherit",
  env: process.env,
});

nextApp.on("exit", (code) => {
  process.exit(code || 0);
});

// Also open a TCP bridge on the secondary port (covers both 3000 and 8080)
// This guarantees Railway proxy connects regardless of whether domain targets 3000 or 8080
const bridge = net.createServer((socket) => {
  const upstream = net.connect(primaryPort, "127.0.0.1", () => {
    socket.pipe(upstream);
    upstream.pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

bridge.listen(secondaryPort, "0.0.0.0", () => {
  console.log(`Port bridge active: listening on 0.0.0.0:${secondaryPort} -> forwarding to :${primaryPort}`);
});

bridge.on("error", (err) => {
  console.log(`Secondary port ${secondaryPort} notice: ${err.message}`);
});

process.on("SIGTERM", () => nextApp.kill("SIGTERM"));
process.on("SIGINT", () => nextApp.kill("SIGINT"));
