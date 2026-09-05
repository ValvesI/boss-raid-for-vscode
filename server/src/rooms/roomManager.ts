// "import type" traz somente definições do TypeScript; não gera código no servidor.
import type { Player, RaidState } from "../../../shared/protocol.js";

const BOSS_MAX_HP = 1_000;

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
