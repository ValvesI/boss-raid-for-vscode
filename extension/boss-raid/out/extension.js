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
const localRaid_1 = require("./raid/localRaid");
const DAMAGE_PER_ATTACK = 100;
const LINES_PER_ATTACK = 10;
function activate(context) {
    const raid = new localRaid_1.LocalRaid();
    let pendingLines = 0;
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    function updateBossUi() {
        statusBar.text = `$(flame) Boss: ${raid.currentBossHp} / ${raid.bossMaxHp} HP`;
        statusBar.tooltip = "Boss Raid";
        statusBar.show();
    }
    function applyDamage(damage, message) {
        const result = raid.attack(damage);
        updateBossUi();
        if (result.damage === 0) {
            vscode.window.showInformationMessage("O boss já foi derrotado!");
        }
        else if (result.isDefeated) {
            vscode.window.showInformationMessage("Boss derrotado! 🎉");
        }
        else {
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
    const changeTracker = new changeTracker_1.ChangeTracker();
    const trackerDisposable = changeTracker.start((linesAdded) => {
        if (raid.isDefeated) {
            return;
        }
        pendingLines += linesAdded;
        while (pendingLines >= LINES_PER_ATTACK && !raid.isDefeated) {
            pendingLines -= LINES_PER_ATTACK;
            applyDamage(DAMAGE_PER_ATTACK, `${LINES_PER_ATTACK} linhas escritas: ${DAMAGE_PER_ATTACK} de dano!`);
        }
    });
    updateBossUi();
    context.subscriptions.push(statusBar, startRaid, attackBoss, resetBoss, trackerDisposable);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map