// Este teste verifica as regras de dano sem precisar iniciar Socket.IO.
import assert from "node:assert/strict";
import { RoomManager } from "./rooms/roomManager.js";

const roomManager = new RoomManager();

const raid = roomManager.createRoom({
  id: "test-player",
  name: "Jogador de teste",
});

console.log(`Boss criado com ${raid.bossHp} HP.`);

// Quatro ataques de 50 linhas: 50 × 4 = 200 de dano por ataque.
// Após quatro ataques, o boss deve ter 200 HP.
for (let index = 0; index < 4; index += 1) {
  roomManager.applyCodeProgress(raid.roomCode, {
    linesAdded: 50,
    linesRemoved: 0,
  });
}

assert.equal(raid.bossHp, 200);
console.log(`Após quatro ataques, o boss ficou com ${raid.bossHp} HP.`);

// 30 linhas adicionadas causam 120 de dano, deixando o boss com 80 HP.
roomManager.applyCodeProgress(raid.roomCode, {
  linesAdded: 30,
  linesRemoved: 0,
});

assert.equal(raid.bossHp, 80);

// Este ataque pediria 200 de dano, mas só 80 podem ser aplicados.
const finalHit = roomManager.applyCodeProgress(raid.roomCode, {
  linesAdded: 100,
  linesRemoved: 0,
});

assert.equal(finalHit?.damage, 80);
assert.equal(finalHit?.bossDefeated, true);
assert.equal(raid.bossHp, 0);
console.log(`Golpe final aplicou ${finalHit?.damage} de dano. Boss derrotado.`);

// Depois de derrotado, o boss não deve receber dano adicional.
const extraHit = roomManager.applyCodeProgress(raid.roomCode, {
  linesAdded: 100,
  linesRemoved: 0,
});

assert.equal(extraHit?.damage, 0);
assert.equal(extraHit?.bossDefeated, false);
assert.equal(raid.bossHp, 0);

console.log("Teste concluído: o boss não recebeu dano após ser derrotado.");