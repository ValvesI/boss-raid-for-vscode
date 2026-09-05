import * as vscode from "vscode";
import { ChangeTracker } from "./editor/changeTracker";
import { LocalRaid } from "./raid/localRaid";

const DAMAGE_PER_ATTACK = 100;
const LINES_PER_ATTACK = 10;

export function activate(context: vscode.ExtensionContext) {
	const raid = new LocalRaid();
	let pendingLines = 0;
	const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );

	function updateBossUi() {
		statusBar.text = `$(flame) Boss: ${raid.currentBossHp} / ${raid.bossMaxHp} HP`;
    statusBar.tooltip = "Boss Raid";
    statusBar.show();
	}

	function applyDamage(damage: number, message: string) {
		const result = raid.attack(damage);
		updateBossUi();

		if (result.damage === 0) {
			vscode.window.showInformationMessage("O boss já foi derrotado!");
		} else if (result.isDefeated) {
			vscode.window.showInformationMessage("Boss derrotado! 🎉");
		} else {
			vscode.window.showInformationMessage(message);
		}
	}

	const startRaid = vscode.commands.registerCommand("boss-raid.start", () => {
		raid.start();
		pendingLines = 0;
    updateBossUi();
    vscode.window.showInformationMessage("A raid local começou!");
  });

	const attackBoss = vscode.commands.registerCommand("boss-raid.attack", () => {
		applyDamage(DAMAGE_PER_ATTACK, `Você causou ${DAMAGE_PER_ATTACK} de dano.`);
  });

	const resetBoss = vscode.commands.registerCommand("boss-raid.reset", () => {
		raid.start();
		pendingLines = 0;
    updateBossUi();
    vscode.window.showInformationMessage("Boss reiniciado.");
	});

	const changeTracker = new ChangeTracker();
	const trackerDisposable = changeTracker.start((linesAdded) => {
		if (raid.isDefeated) {
			return;
		}

		pendingLines += linesAdded;
		while (pendingLines >= LINES_PER_ATTACK && !raid.isDefeated) {
			pendingLines -= LINES_PER_ATTACK;
			applyDamage(
				DAMAGE_PER_ATTACK,
				`${LINES_PER_ATTACK} linhas escritas: ${DAMAGE_PER_ATTACK} de dano!`,
			);
		}
	});

	updateBossUi();
	context.subscriptions.push(
		statusBar,
		startRaid,
		attackBoss,
		resetBoss,
		trackerDisposable,
	);
}

export function deactivate() {}
