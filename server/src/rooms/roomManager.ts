// "import type" traz somente definições do TypeScript; não gera código no servidor.
import type { Player, RaidState } from "../../../shared/protocol.js";
import {
  calculateDamage,
  type CodeProgress,
} from "../raids/damageCalculator.js";

const BOSS_MAX_HP = 1_000;
// Resultado devolvido depois que um evento de progresso afeta o boss.
export type DamageResult = {
  raid: RaidState;
  damage: number;
};

// Esta classe concentra as regras de armazenamento e busca de salas.
export class RoomManager {
  // Map funciona como uma tabela: cada código de sala aponta para uma RaidState.
  private readonly rooms = new Map<string, RaidState>();

  createRoom(host: Player): RaidState {
    const roomCode = this.generateRoomCode();

    // O criador entra automaticamente como o primeiro participante.
    const raid: RaidState = {
      roomCode,
      bossHp: BOSS_MAX_HP,
      bossMaxHp: BOSS_MAX_HP,
      players: [host],
    };

    // Salva a raid usando o código como chave para que ela possa ser buscada depois.
    this.rooms.set(roomCode, raid);

    return raid;
  }

  joinRoom(roomCode: string, player: Player): RaidState | null {
    // get devolve undefined se não existir uma entrada com aquele código.
    const raid = this.rooms.get(roomCode);

    if (!raid) {
      return null;
    }

    // push adiciona o jogador no fim da lista de participantes.
    raid.players.push(player);

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

    return raid;
  }

    /**
   * Aplica o progresso de código de um jogador à raid indicada.
   * Retorna null se a sala não existir.
   */
  applyCodeProgress(
    roomCode: string,
    progress: CodeProgress,
  ): DamageResult | null {
    const raid = this.getRoom(roomCode);

    if (!raid) {
      return null;
    }

    // Um boss já derrotado não recebe mais dano.
    if (raid.bossHp === 0) {
      return { raid, damage: 0 };
    }

    // A calculadora informa o dano solicitado pelas linhas alteradas.
    const requestedDamage = calculateDamage(progress);

    // No golpe final, o dano real não pode ser maior que o HP que restava.
    const damage = Math.min(requestedDamage, raid.bossHp);

    raid.bossHp -= damage;

    return { raid, damage };
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
}
