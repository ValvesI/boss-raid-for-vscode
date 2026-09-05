// Este arquivo simula duas extensões para testar a raid sem abrir o VS Code.
import { io } from "socket.io-client";
import type { RaidState } from "../../shared/protocol.js";

const SERVER_URL = "http://localhost:3000";

type DamageAppliedEvent = {
  playerId: string;
  damage: number;
  bossHp: number;
};

// autoConnect: false permite conectar Ana e Bruno em momentos diferentes.
const host = io(SERVER_URL, { autoConnect: false });
const guest = io(SERVER_URL, { autoConnect: false });

let roomCode: string | undefined;
let hostReceivedDamage = false;
let guestReceivedDamage = false;
let progressSent = false;

/**
 * O teste só é concluído quando os dois jogadores receberam o mesmo evento de dano.
 * Isso prova que a sincronização foi enviada para a sala inteira.
 */
function finishTestIfReady(): void {
  if (!hostReceivedDamage || !guestReceivedDamage) {
    return;
  }

  console.log("Teste concluído: os dois jogadores receberam o dano.");
  host.disconnect();
  guest.disconnect();
}

host.on("connect", () => {
  console.log("Ana conectou e vai criar uma raid.");
  host.emit("CREATE_RAID", { playerName: "Ana" });
});

host.on("RAID_STATE", ({ raid }: { raid: RaidState }) => {
  console.log(
    `Ana recebeu a raid ${raid.roomCode} com ${raid.players.length} jogador(es).`,
  );

  // Na primeira atualização, somente Ana está na sala.
  if (raid.players.length === 1) {
    roomCode = raid.roomCode;
    guest.connect();
    return;
  }

  // Quando Bruno entra, Ana envia progresso: 10 linhas x 4 de dano = 40 de dano.
  if (raid.players.length === 2) {
    progressSent = true;
    console.log("Ana enviou 10 linhas adicionadas para atacar o boss.");
    host.emit("CODE_PROGRESS", {
      linesAdded: 10,
      linesRemoved: 0,
    });
  }
});

guest.on("connect", () => {
  if (!roomCode) {
    console.error("Não foi possível entrar: código da sala ausente.");
    return;
  }

  console.log(`Bruno conectou e vai entrar na sala ${roomCode}.`);
  guest.emit("JOIN_RAID", {
    roomCode,
    playerName: "Bruno",
  });
});

host.on("DAMAGE_APPLIED", (event: DamageAppliedEvent) => {
  console.log(
    `Ana viu ${event.damage} de dano. HP restante: ${event.bossHp}.`,
  );

  hostReceivedDamage = true;
  finishTestIfReady();
});

guest.on("DAMAGE_APPLIED", (event: DamageAppliedEvent) => {
  console.log(
    `Bruno viu ${event.damage} de dano. HP restante: ${event.bossHp}.`,
  );

  guestReceivedDamage = true;
  finishTestIfReady();
});

host.on("ERROR", ({ message }: { message: string }) => {
  console.error(`Erro recebido por Ana: ${message}`);
});

guest.on("ERROR", ({ message }: { message: string }) => {
  console.error(`Erro recebido por Bruno: ${message}`);
});

// Inicia o fluxo do teste conectando Ana.
host.connect();