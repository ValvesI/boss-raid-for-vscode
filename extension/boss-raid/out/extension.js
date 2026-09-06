"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const changeTracker_1 = require("./editor/changeTracker");
const raidClient_1 = require("./multiplayer/raidClient");
const LINES_PER_ATTACK = 10;
const CHARACTERS_PER_DAMAGE = 5;
function activate(context) {
    let pendingLines = 0;
    let pendingCharacters = 0;
    let currentRaid;
    let isConnected = false;
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    function updateBossUi() {
        if (currentRaid) {
            statusBar.text = `$(flame) Boss [${currentRaid.roomCode}]: ${currentRaid.bossHp} / ${currentRaid.bossMaxHp} HP | $(person) ${currentRaid.players.length} | $(edit) ${pendingLines}/${LINES_PER_ATTACK} linhas | $(symbol-string) ${pendingCharacters}/${CHARACTERS_PER_DAMAGE} caracteres`;
            statusBar.tooltip = `Raid ${currentRaid.roomCode}`;
        }
        else if (isConnected) {
            statusBar.text = "$(radio-tower) Boss Raid: conectado — crie ou entre em uma raid";
            statusBar.tooltip = "Conectado ao servidor da raid";
        }
        else {
            statusBar.text = "$(debug-disconnect) Boss Raid: desconectado";
            statusBar.tooltip = "Inicie ou entre em uma raid para conectar";
        }
        statusBar.show();
    }
    const serverUrl = vscode.workspace
        .getConfiguration("bossRaid")
        .get("serverUrl", "http://localhost:3000");
    // The server is authoritative: this extension only displays state it receives.
    const raidClient = new raidClient_1.RaidClient(serverUrl, {
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
    async function askForPlayerName() {
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
    const changeTracker = new changeTracker_1.ChangeTracker();
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
    context.subscriptions.push(statusBar, startRaid, joinRaid, attackBoss, trackerDisposable, { dispose: () => raidClient.dispose() });
}
function deactivate() { }
//# sourceMappingURL=extension.js.map