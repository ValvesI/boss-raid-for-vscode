// Testa se o servidor envia BOSS_DEFEATED quando o HP chega a zero.
import assert from "node:assert/strict";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", { autoConnect: false });

type RaidStateEvent = {
  raid: {
    roomCode: string;
    bossHp: number;
    players: { id: string; name: string }[];
  };
};

type DamageAppliedEvent = {
  damage: number;
  bossHp: number;
};

type BossDefeatedEvent = {
  roomCode: string;
  defeatedBy: string;
};

let roomCode: string | undefined;
let attacksSent = 0;

function attackBoss(): void {
  attacksSent += 1;

  // Cada ataque tem 50 linhas: 50 × 4 = 200 de dano.
  socket.emit("CODE_PROGRESS", {
    charactersAdded: 0,
    linesAdded: 50,
    linesRemoved: 0,
  });
}

socket.on("connect", () => {
  console.log("Jogador conectou e vai criar uma raid.");
  // Este teste é solo, então seu limite individual precisa cobrir a vida toda do boss.
  socket.emit("CREATE_RAID", {
    playerName: "Testador",
    settings: { bossMaxHp: 1_000, damagePerPlayer: 1_000 },
  });
});

socket.on("RAID_STATE", ({ raid }: RaidStateEvent) => {
  // A primeira atualização confirma que a raid foi criada.
  if (attacksSent === 0 && raid.players.length === 1) {
    roomCode = raid.roomCode;
    console.log(`Raid ${roomCode} criada. Iniciando ataques.`);
    attackBoss();
  }
});

socket.on("DAMAGE_APPLIED", (event: DamageAppliedEvent) => {
  console.log(`Dano: ${event.damage}. HP restante: ${event.bossHp}.`);

  // Continua atacando até o boss ficar sem HP.
  if (event.bossHp > 0) {
    attackBoss();
  }
});

socket.on("BOSS_DEFEATED", (event: BossDefeatedEvent) => {
  assert.equal(event.roomCode, roomCode);
  assert.equal(attacksSent, 5);

  console.log(
    `Teste concluído: boss derrotado por ${event.defeatedBy} após ${attacksSent} ataques.`,
  );

  socket.disconnect();
});

socket.on("ERROR", ({ message }: { message: string }) => {
  throw new Error(`Erro do servidor: ${message}`);
});

socket.connect();
