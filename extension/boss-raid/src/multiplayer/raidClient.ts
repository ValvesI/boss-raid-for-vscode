import { io, type Socket } from "socket.io-client";

// These types mirror shared/protocol.ts. The extension compiles independently,
// so it cannot import TypeScript source outside its own src directory yet.
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

type DamageAppliedEvent = {
	playerId: string;
	damage: number;
	bossHp: number;
};

type BossDefeatedEvent = {
	roomCode: string;
	defeatedBy: string;
};

// Callbacks keep VS Code UI code separate from the network connection code.
export type RaidClientHandlers = {
	onConnectionChanged: (connected: boolean) => void;
	onRaidState: (raid: RaidState) => void;
	onDamageApplied: (event: DamageAppliedEvent) => void;
	onBossDefeated: (event: BossDefeatedEvent) => void;
	onError: (message: string) => void;
};

/** Handles the Socket.IO protocol used by the VS Code extension and the raid server. */
export class RaidClient {
	private readonly socket: Socket;

	public constructor(serverUrl: string, private readonly handlers: RaidClientHandlers) {
		// autoConnect lets the extension wait until a user creates or joins a raid.
		this.socket = io(serverUrl, { autoConnect: false });
		this.registerServerEvents();
	}

	public createRaid(playerName: string): void {
		this.emitWhenConnected("CREATE_RAID", { playerName });
	}

	public joinRaid(roomCode: string, playerName: string): void {
		this.emitWhenConnected("JOIN_RAID", { roomCode, playerName });
	}

	public sendCodeProgress(
		linesAdded: number,
		linesRemoved: number,
		charactersAdded: number,
	): void {
		this.emitWhenConnected("CODE_PROGRESS", {
			charactersAdded,
			linesAdded,
			linesRemoved,
		});
	}

	public dispose(): void {
		this.socket.disconnect();
		this.socket.removeAllListeners();
	}

	private emitWhenConnected(event: string, payload: object): void {
		const emit = () => this.socket.emit(event, payload);

		if (this.socket.connected) {
			emit();
			return;
		}

		// Socket.IO queues one action until the server confirms the connection.
		this.socket.once("connect", emit);
		this.socket.connect();
	}

	private registerServerEvents(): void {
		this.socket.on("connect", () => this.handlers.onConnectionChanged(true));
		this.socket.on("disconnect", () => this.handlers.onConnectionChanged(false));

		this.socket.on("RAID_STATE", ({ raid }: { raid: RaidState }) => {
			this.handlers.onRaidState(raid);
		});

		this.socket.on("DAMAGE_APPLIED", (event: DamageAppliedEvent) => {
			this.handlers.onDamageApplied(event);
		});

		this.socket.on("BOSS_DEFEATED", (event: BossDefeatedEvent) => {
			this.handlers.onBossDefeated(event);
		});

		this.socket.on("ERROR", ({ message }: { message: string }) => {
			this.handlers.onError(message);
		});

		this.socket.on("connect_error", () => {
			this.handlers.onError("Não foi possível conectar ao servidor da raid.");
		});
	}
}
