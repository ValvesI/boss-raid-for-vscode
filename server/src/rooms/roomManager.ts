// "import type" traz somente definições do TypeScript; não gera código no servidor.
import type { Player, RaidSettings, RaidState } from "../../../shared/protocol.js";
import {
  calculateDamage,
  type CodeProgress,
} from "../raids/damageCalculator.js";

type NewPlayer = Omit<Player, "damageDealt" | "isCompleted">;

const DEFAULT_SETTINGS: RaidSettings = {
  bossMaxHp: 1_000,
};
// Resultado devolvido depois que um evento de progresso afeta o boss.
export type DamageResult = {
  raid: RaidState;
  damage: number;
  bossDefeated: boolean;
};

// Esta classe concentra as regras de armazenamento e busca de salas.
export class RoomManager {
  // Map funciona como uma tabela: cada código de sala aponta para uma RaidState.
  private readonly rooms = new Map<string, RaidState>();

  createRoom(host: NewPlayer, settings: RaidSettings = DEFAULT_SETTINGS): RaidState {
    const roomCode = this.generateRoomCode();

    // O criador entra automaticamente como o primeiro participante.
    const raid: RaidState = {
      roomCode,
      bossMaxHp: settings.bossMaxHp,
      bossHp: settings.bossMaxHp,
      damagePerPlayer: settings.bossMaxHp,
      endsAt: settings.timeLimitSeconds
        ? Date.now() + settings.timeLimitSeconds * 1_000
        : undefined,
      outcome: "active",
      players: [{ ...host, damageDealt: 0, isCompleted: false }],
    };

    // Salva a raid usando o código como chave para que ela possa ser buscada depois.
    this.rooms.set(roomCode, raid);

    return raid;
  }

  joinRoom(roomCode: string, player: NewPlayer): RaidState | null {
    // get devolve undefined se não existir uma entrada com aquele código.
    const raid = this.rooms.get(roomCode);

    if (!raid) {
      return null;
    }

    // push adiciona o jogador no fim da lista de participantes.
    raid.players.push({ ...player, damageDealt: 0, isCompleted: false });
    this.updateDamageLimit(raid);

    return raid;
  }

  getRoom(roomCode: string): RaidState | null {
    // "?? null" converte o undefined do Map em null, nosso sinal de "não encontrada".
    return this.rooms.get(roomCode) ?? null;
  }

    /**
   * Remove um jogador da raid.
   * Se ele era o último participante, a sala inteira é removida da memória.
   */
  removePlayer(roomCode: string, playerId: string): RaidState | null {
    const raid = this.getRoom(roomCode);

    if (!raid) {
      return null;
    }

    // filter cria uma nova lista sem o jogador cujo id corresponde ao desconectado.
    raid.players = raid.players.filter((player) => player.id !== playerId);

    // Uma sala vazia não precisa continuar ocupando memória no servidor.
    if (raid.players.length === 0) {
      this.rooms.delete(roomCode);
      return null;
    }

    this.updateDamageLimit(raid);

    return raid;
  }

    /**
   * Aplica o progresso de código de um jogador à raid indicada.
   * Retorna null se a sala não existir.
   */
  applyCodeProgress(
    roomCode: string,
    playerId: string,
    progress: CodeProgress,
  ): DamageResult | null {
    const raid = this.getRoom(roomCode);

    if (!raid) {
      return null;
    }

    // Um boss já derrotado não recebe mais dano.
    if (raid.outcome !== "active") {
      return { raid, damage: 0, bossDefeated: false };
    }

    const player = raid.players.find((candidate) => candidate.id === playerId);
    if (!player) {
      return null;
    }

    this.updateDamageLimit(raid);

    // A calculadora informa o dano solicitado pelas linhas alteradas.
    const requestedDamage = calculateDamage(progress);

    // Cada pessoa só pode contribuir até o limite escolhido ao criar a raid.
    const remainingPlayerDamage = Math.max(0, raid.damagePerPlayer - player.damageDealt);

    // No golpe final, o dano real não pode ser maior que o HP que restava.
    const damage = Math.min(requestedDamage, remainingPlayerDamage, raid.bossHp);

    raid.bossHp -= damage;
    player.damageDealt += damage;

    // Só é uma derrota nova quando este ataque levou o HP até zero.
    const bossDefeated = raid.bossHp === 0;
    if (bossDefeated) {
      raid.outcome = "boss-defeated";
    }

    return { raid, damage, bossDefeated };
  }

  /** Marca o jogador como concluído e aplica toda a contribuição que faltava. */
  markPlayerCompleted(roomCode: string, playerId: string): DamageResult | null {
    const raid = this.getRoom(roomCode);
    const player = raid?.players.find((candidate) => candidate.id === playerId);

    if (!raid || !player || raid.outcome !== "active") {
      return raid ? { raid, damage: 0, bossDefeated: false } : null;
    }

    const remainingPlayerDamage = Math.max(0, raid.damagePerPlayer - player.damageDealt);
    const damage = Math.min(remainingPlayerDamage, raid.bossHp);
    player.damageDealt += damage;
    player.isCompleted = true;
    raid.bossHp -= damage;
    const bossDefeated = raid.bossHp === 0;
    if (bossDefeated) {
      raid.outcome = "boss-defeated";
    }

    return { raid, damage, bossDefeated };
  }

  /** O cronômetro acabou antes da derrota do boss. */
  markBossWon(roomCode: string): RaidState | null {
    const raid = this.getRoom(roomCode);
    if (!raid || raid.outcome !== "active") {
      return null;
    }

    raid.outcome = "boss-won";
    return raid;
  }

  private generateRoomCode(): string {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";

    // Repete seis vezes para formar um código curto, como KHJYJU.
    for (let index = 0; index < 6; index += 1) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      code += characters[randomIndex];
    }

    return code;
  }

  /** Divide a vida inicial entre as pessoas presentes; uma pessoa sozinha recebe 100%. */
  private updateDamageLimit(raid: RaidState): void {
    raid.damagePerPlayer = Math.ceil(raid.bossMaxHp / raid.players.length);
  }
}
