export type Player = {
  id: string;
  name: string;
  // O servidor registra a contribuição, para que ela não possa ser burlada pelo cliente.
  damageDealt: number;
  isCompleted: boolean;
};

export type RaidSettings = {
  bossMaxHp: number;
  /** Ausente significa que a raid não possui cronômetro. */
  timeLimitSeconds?: number | undefined;
};

export type RaidOutcome = "active" | "boss-defeated" | "boss-won";

export type RaidState = {
  roomCode: string;
  bossHp: number;
  bossMaxHp: number;
  damagePerPlayer: number;
  endsAt?: number | undefined;
  outcome: RaidOutcome;
  players: Player[];
};

export type ClientMessage =
  | { type: "CREATE_RAID"; playerName: string; settings?: RaidSettings }
  | { type: "JOIN_RAID"; roomCode: string; playerName: string }
  | {
    type: "CODE_PROGRESS";
    charactersAdded: number;
    linesAdded: number;
    linesRemoved: number;
  }
  | { type: "MARK_COMPLETED" }
  | { type: "LEAVE_RAID" };

export type ServerMessage =
  | { type: "RAID_STATE"; raid: RaidState }
  | {
      type: "DAMAGE_APPLIED";
      playerId: string;
      damage: number;
      bossHp: number;
    }
  | { type: "ERROR"; message: string }
  | {
    type: "BOSS_DEFEATED";
    roomCode: string;
    defeatedBy: string;
  }
  | { type: "RAID_LOST"; roomCode: string }
  | { type: "RAID_LEFT" };
