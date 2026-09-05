export type Player = {
  id: string;
  name: string;
};

export type RaidState = {
  roomCode: string;
  bossHp: number;
  bossMaxHp: number;
  players: Player[];
};

export type ClientMessage =
  | { type: "CREATE_RAID"; playerName: string }
  | { type: "JOIN_RAID"; roomCode: string; playerName: string }
  | { type: "CODE_PROGRESS"; linesAdded: number; linesRemoved: number };

export type ServerMessage =
  | { type: "RAID_STATE"; raid: RaidState }
  | {
      type: "DAMAGE_APPLIED";
      playerId: string;
      damage: number;
      bossHp: number;
    }
  | { type: "ERROR"; message: string };