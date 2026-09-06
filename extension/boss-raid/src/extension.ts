import * as vscode from "vscode";
import { ChangeTracker } from "./editor/changeTracker";
import { RaidClient, type RaidState } from "./multiplayer/raidClient";

const LINES_PER_ATTACK = 10;
const CHARACTERS_PER_DAMAGE = 5;

export function activate(context: vscode.ExtensionContext) {
	let pendingLines = 0;
	let pendingCharacters = 0;
	let currentRaid: RaidState | undefined;
	let isConnected = false;
	const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );

	function updateBossUi() {
		if (currentRaid) {
			statusBar.text = `$(flame) Boss [${currentRaid.roomCode}]: ${currentRaid.bossHp} / ${currentRaid.bossMaxHp} HP | $(person) ${currentRaid.players.length} | $(edit) ${pendingLines}/${LINES_PER_ATTACK} linhas | $(symbol-string) ${pendingCharacters}/${CHARACTERS_PER_DAMAGE} caracteres`;
			statusBar.tooltip = `Raid ${currentRaid.roomCode}`;
		} else if (isConnected) {
			statusBar.text = "$(radio-tower) Boss Raid: conectado — crie ou entre em uma raid";
			statusBar.tooltip = "Conectado ao servidor da raid";
		} else {
			statusBar.text = "$(debug-disconnect) Boss Raid: desconectado";
			statusBar.tooltip = "Inicie ou entre em uma raid para conectar";
		}

		statusBar.show();
	}

	const serverUrl = vscode.workspace
		.getConfiguration("bossRaid")
		.get<string>("serverUrl", "http://localhost:3000");

	// The server is authoritative: this extension only displays state it receives.
	const raidClient = new RaidClient(serverUrl, {
		onConnectionChanged: (connected) => {
			isConnected = connected;
			updateBossUi();
		},
		onRaidState: (raid) => {
			currentRaid = raid;
			updateBossUi();
		},
		onDamageApplied: () => updateBossUi(),
		onBossDefeated: () => {
			// The server currently identifies the winner by a technical socket ID.
			// The extension shows a friendly victory message until player profiles exist.
			vscode.window.showInformationMessage("Boss derrotado! 🎉");
		},
		onError: (message) => vscode.window.showErrorMessage(message),
	});

	async function askForPlayerName(): Promise<string | undefined> {
		return vscode.window.showInputBox({
			prompt: "Qual é o seu nome na raid?",
			placeHolder: "Ex.: Ana",
			ignoreFocusOut: true,
		});
	}

	const startRaid = vscode.commands.registerCommand("boss-raid.start", async () => {
		const playerName = await askForPlayerName();
		if (!playerName?.trim()) {
			return;
		}

		pendingLines = 0;
		pendingCharacters = 0;
		raidClient.createRaid(playerName.trim());
	});

	const joinRaid = vscode.commands.registerCommand("boss-raid.join", async () => {
		const playerName = await askForPlayerName();
		if (!playerName?.trim()) {
			return;
		}

		const roomCode = await vscode.window.showInputBox({
			prompt: "Digite o código da raid",
			placeHolder: "Ex.: 85WZXH",
			ignoreFocusOut: true,
		});
		if (!roomCode?.trim()) {
			return;
		}

		pendingLines = 0;
		pendingCharacters = 0;
		raidClient.joinRaid(roomCode.trim().toUpperCase(), playerName.trim());
	});

	const attackBoss = vscode.commands.registerCommand("boss-raid.attack", () => {
		if (!currentRaid) {
			vscode.window.showWarningMessage("Crie ou entre em uma raid primeiro.");
			return;
		}

		// A test attack helps validate the multiplayer connection before editing code.
		raidClient.sendCodeProgress(LINES_PER_ATTACK, 0, 0);
	});

	const changeTracker = new ChangeTracker();
	const trackerDisposable = changeTracker.start((progress) => {
		if (!currentRaid || currentRaid.bossHp === 0) {
			return;
		}

		pendingCharacters += progress.charactersAdded;
		while (pendingCharacters >= CHARACTERS_PER_DAMAGE) {
			pendingCharacters -= CHARACTERS_PER_DAMAGE;
			raidClient.sendCodeProgress(0, 0, CHARACTERS_PER_DAMAGE);
		}

		pendingLines += progress.linesAdded;
		while (pendingLines >= LINES_PER_ATTACK && currentRaid.bossHp > 0) {
			pendingLines -= LINES_PER_ATTACK;
			raidClient.sendCodeProgress(LINES_PER_ATTACK, 0, 0);
		}

		// Removals can contribute too, even if the player has not added ten new lines.
		if (progress.linesRemoved > 0) {
			raidClient.sendCodeProgress(0, progress.linesRemoved, 0);
		}

		updateBossUi();
	});

	updateBossUi();
	context.subscriptions.push(
		statusBar,
		startRaid,
		joinRaid,
		attackBoss,
		trackerDisposable,
		{ dispose: () => raidClient.dispose() },
	);
}

export function deactivate() {}
