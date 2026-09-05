export type AttackResult = {
	damage: number;
	bossHp: number;
	isDefeated: boolean;
};

export class LocalRaid {
	public readonly bossMaxHp: number;
	private bossHp: number;

	constructor(bossMaxHp = 1000) {
		this.bossMaxHp = bossMaxHp;
		this.bossHp = bossMaxHp;
	}

	public start(): void {
		this.bossHp = this.bossMaxHp;
	}

	public attack(damage: number): AttackResult {
		if (damage <= 0 || this.isDefeated) {
			return { damage: 0, bossHp: this.bossHp, isDefeated: this.isDefeated };
		}

		const appliedDamage = Math.min(damage, this.bossHp);
		this.bossHp -= appliedDamage;

		return {
			damage: appliedDamage,
			bossHp: this.bossHp,
			isDefeated: this.isDefeated,
		};
	}

	public get currentBossHp(): number {
		return this.bossHp;
	}

	public get isDefeated(): boolean {
		return this.bossHp === 0;
	}
}
