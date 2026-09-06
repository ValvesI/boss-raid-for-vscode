// Testa a regra central cooperativa: uma pessoa não pode fornecer todo o dano.
import assert from "node:assert/strict";
import { RoomManager } from "./rooms/roomManager.js";

const roomManager = new RoomManager();
const raid = roomManager.createRoom(
  { id: "ana", name: "Ana" },
  { bossMaxHp: 1_000 },
);
roomManager.joinRoom(raid.roomCode, { id: "bruno", name: "Bruno" });
assert.equal(raid.damagePerPlayer, 500);

// Cada evento pede 200 de dano, mas Ana só pode somar 500 em toda a raid.
roomManager.applyCodeProgress(raid.roomCode, "ana", { charactersAdded: 0, linesAdded: 50, linesRemoved: 0 });
roomManager.applyCodeProgress(raid.roomCode, "ana", { charactersAdded: 0, linesAdded: 50, linesRemoved: 0 });
const cappedHit = roomManager.applyCodeProgress(raid.roomCode, "ana", { charactersAdded: 0, linesAdded: 50, linesRemoved: 0 });

assert.equal(cappedHit?.damage, 100);
assert.equal(raid.players[0]?.damageDealt, 500);
assert.equal(raid.bossHp, 500);
console.log("Ana atingiu o limite individual de 500 de dano.");

const completedHit = roomManager.markPlayerCompleted(raid.roomCode, "bruno");
assert.equal(completedHit?.damage, 500);
assert.equal(completedHit?.bossDefeated, true);
assert.equal(raid.players[1]?.isCompleted, true);
assert.equal(raid.bossHp, 0);
console.log("Bruno marcou como concluído e aplicou os 500 de dano restantes.");
