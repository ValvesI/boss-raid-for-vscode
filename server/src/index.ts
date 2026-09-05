// Express atende requisições HTTP; Socket.IO mantém a conversa em tempo real
// entre o servidor e as extensões conectadas.
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { RoomManager } from "./rooms/roomManager.js";
import type { Player } from "../../shared/protocol.js";

// Uma aplicação Express é a base das rotas HTTP, como /health.
const app = express();
// Socket.IO precisa de um servidor HTTP para funcionar junto com o Express.
const httpServer = createServer(app);

// "io" é o servidor Socket.IO. CORS aberto é conveniente no desenvolvimento;
// antes de publicar, ele deve aceitar somente as origens confiáveis.
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

// Esta instância guarda as raids que existem enquanto o servidor está ligado.
const roomManager = new RoomManager();
const PORT = 3000;

// Rota simples para confirmar que o servidor HTTP está em execução.
app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

// Esta função é executada uma vez para cada nova extensão/jogador conectado.
io.on("connection", (socket) => {
  console.log(`Jogador conectado: ${socket.id}`);

  // "socket.on" registra uma reação a uma mensagem enviada por este jogador.
  socket.on("CREATE_RAID", (data: { playerName: string }) => {
    // trim remove espaços antes e depois do nome recebido.
    const playerName = data.playerName.trim();

    if (!playerName) {
      socket.emit("ERROR", { message: "O nome do jogador é obrigatório." });
      return;
    }

    // socket.id identifica esta conexão de forma única durante a sessão.
    const player: Player = {
      id: socket.id,
      name: playerName,
    };

    const raid = roomManager.createRoom(player);

    // Entrar no grupo permite enviar mensagens somente aos participantes da raid.
    socket.join(raid.roomCode);
    socket.emit("RAID_STATE", { raid });

    console.log(`${player.name} criou a sala ${raid.roomCode}`);
  });

  // Outro jogador usa o código da sala para participar da mesma raid.
  socket.on(
    "JOIN_RAID",
    (data: { roomCode: string; playerName: string }) => {
      const roomCode = data.roomCode.trim().toUpperCase();
      const playerName = data.playerName.trim();

      if (!playerName || !roomCode) {
        socket.emit("ERROR", {
          message: "O código da sala e o nome são obrigatórios.",
        });
        return;
      }

      const player: Player = {
        id: socket.id,
        name: playerName,
      };

      const raid = roomManager.joinRoom(roomCode, player);

      if (!raid) {
        socket.emit("ERROR", { message: "Sala não encontrada." });
        return;
      }

      socket.join(roomCode);
      // Envia o estado atualizado para todos do grupo, inclusive quem acabou de entrar.
      io.to(roomCode).emit("RAID_STATE", { raid });

      console.log(`${player.name} entrou na sala ${roomCode}`);
    },
  );

  socket.on("disconnect", () => {
    console.log(`Jogador desconectado: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor da raid ativo em http://localhost:${PORT}`);
});
