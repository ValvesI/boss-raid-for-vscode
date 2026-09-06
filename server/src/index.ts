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
    // Guardamos a sala na própria conexão para não confiar em um código enviado a cada dano.
    socket.data.roomCode = raid.roomCode;
    socket.emit("RAID_STATE", { raid });

    console.log(`${player.name} criou a sala ${raid.roomCode}`);
  });

  // Outro jogador usa o código da sala para participar da mesma raid.
  socket.on("JOIN_RAID", (data: { roomCode: string; playerName: string }) => {
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
    // A partir daqui, esta conexão está associada à raid informada.
    socket.data.roomCode = roomCode;
    // Envia o estado atualizado para todos do grupo, inclusive quem acabou de entrar.
    io.to(roomCode).emit("RAID_STATE", { raid });

    console.log(`${player.name} entrou na sala ${roomCode}`);
  });

  // A extensão envia este evento sempre que detectar alterações válidas de código.
  socket.on(
    "CODE_PROGRESS",
    (data: {
      charactersAdded: number;
      linesAdded: number;
      linesRemoved: number;
    }) => {
      // A sala vem da sessão atual, não da mensagem. Isso reduz erros e abusos.
      const roomCode = socket.data.roomCode as string | undefined;

      if (!roomCode) {
        socket.emit("ERROR", {
          message: "Entre em uma raid antes de enviar progresso.",
        });
        return;
      }

      // Mesmo com TypeScript, mensagens pela rede precisam ser validadas em tempo real.
      if (
        !Number.isFinite(data.charactersAdded) ||
        !Number.isFinite(data.linesAdded) ||
        !Number.isFinite(data.linesRemoved)
      ) {
        socket.emit("ERROR", {
          message: "O progresso enviado é inválido.",
        });
        return;
      }

      const result = roomManager.applyCodeProgress(roomCode, data);

      if (!result) {
        socket.emit("ERROR", { message: "Raid não encontrada." });
        return;
      }

      // Informa a todos da sala qual jogador causou o dano e qual é o HP atual.
      io.to(roomCode).emit("DAMAGE_APPLIED", {
        playerId: socket.id,
        damage: result.damage,
        bossHp: result.raid.bossHp,
      });

      // Envia também o estado completo para manter todos sincronizados.
      io.to(roomCode).emit("RAID_STATE", { raid: result.raid });

        // Este evento acontece uma única vez: no golpe que derrota o boss.
      if (result.bossDefeated) {
        io.to(roomCode).emit("BOSS_DEFEATED", {
          roomCode,
          defeatedBy: socket.id,
        });

        console.log(`Boss da sala ${roomCode} foi derrotado.`);
      }

      console.log(
        `${socket.id} causou ${result.damage} de dano na sala ${roomCode}.`,
      );
    },
  );

    socket.on("disconnect", () => {
    // O código foi guardado quando o jogador criou ou entrou na sala.
    const roomCode = socket.data.roomCode as string | undefined;

    if (!roomCode) {
      console.log(`Jogador desconectado: ${socket.id}`);
      return;
    }

    const raid = roomManager.removePlayer(roomCode, socket.id);

    if (raid) {
      // Só os jogadores que continuaram conectados recebem o estado atualizado.
      io.to(roomCode).emit("RAID_STATE", { raid });
      console.log(`Jogador saiu da sala ${roomCode}: ${socket.id}`);
      return;
    }

    console.log(`Sala ${roomCode} foi encerrada porque ficou vazia.`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor da raid ativo em http://localhost:${PORT}`);
});
