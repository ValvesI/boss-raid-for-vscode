// Este arquivo não é a extensão: ele cria dois clientes falsos para testar o servidor.
import { io } from "socket.io-client";
import type { RaidState } from "../../shared/protocol.js";

const SERVER_URL = "http://localhost:3000";

// autoConnect: false nos dá controle sobre o momento em que cada jogador conecta.
const host = io(SERVER_URL, { autoConnect: false });
const guest = io(SERVER_URL, { autoConnect: false });

// O código só existe depois que Ana cria a sala; por isso ele pode ser undefined no início.
let roomCode: string | undefined;

// Ao conectar, Ana envia o evento que o servidor escuta em index.ts.
host.on("connect", () => {
  console.log("Ana conectou e vai criar uma raid.");
  host.emit("CREATE_RAID", { playerName: "Ana" });
});

// Ana recebe uma vez a sala com 1 jogador e outra após Bruno entrar.
host.on("RAID_STATE", ({ raid }: { raid: RaidState }) => {
  console.log(
    `Ana recebeu a raid ${raid.roomCode} com ${raid.players.length} jogador(es).`,
  );

  if (raid.players.length === 1) {
    roomCode = raid.roomCode;
    // Bruno só conecta após termos o código correto da sala.
    guest.connect();
    return;
  }

  if (raid.players.length === 2) {
    console.log("Teste concluído: os dois jogadores estão na mesma raid.");
    host.disconnect();
    guest.disconnect();
  }
});

// Quando Bruno conecta, ele usa o código guardado para entrar na raid de Ana.
guest.on("connect", () => {
  if (!roomCode) {
    console.error("Não foi possível entrar: código da sala ausente.");
    return;
  }

  console.log(`Bruno conectou e vai entrar na sala ${roomCode}.`);
  guest.emit("JOIN_RAID", {
    roomCode,
    playerName: "Bruno",
  });
});

guest.on("RAID_STATE", ({ raid }: { raid: RaidState }) => {
  console.log(
    `Bruno recebeu a raid ${raid.roomCode} com ${raid.players.length} jogador(es).`,
  );
});

host.on("ERROR", ({ message }: { message: string }) => {
  console.error(`Erro recebido por Ana: ${message}`);
});

guest.on("ERROR", ({ message }: { message: string }) => {
  console.error(`Erro recebido por Bruno: ${message}`);
});

// Inicia o fluxo do teste conectando o primeiro jogador.
host.connect();
