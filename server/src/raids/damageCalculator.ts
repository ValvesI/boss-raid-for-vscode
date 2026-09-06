// Representa o progresso recebido de uma extensão em um único evento.
export type CodeProgress = {
  charactersAdded: number;
  linesAdded: number;
  linesRemoved: number;
};

// Estas constantes definem as regras atuais de balanceamento do jogo.
// Mais tarde poderemos movê-las para uma configuração por dificuldade.
const DAMAGE_PER_ADDED_LINE = 4;
const DAMAGE_PER_REMOVED_LINE = 1;
const CHARACTERS_PER_DAMAGE = 5;
const DAMAGE_PER_CHARACTER_BATCH = 1;
const MAX_DAMAGE_PER_EVENT = 200;

/**
 * Converte alterações de código em dano ao boss.
 *
 * Linhas adicionadas valem mais que linhas removidas.
 * O limite por evento impede que um único envio cause dano exagerado.
 */
export function calculateDamage(progress: CodeProgress): number {
  // Math.max impede que números negativos virem dano.
  // Math.floor remove casas decimais: 4.8 linhas passa a contar como 4.
  const addedLines = Math.max(0, Math.floor(progress.linesAdded));
  const removedLines = Math.max(0, Math.floor(progress.linesRemoved));
  const charactersAdded = Math.max(0, Math.floor(progress.charactersAdded));
  const characterDamage =
    Math.floor(charactersAdded / CHARACTERS_PER_DAMAGE) * DAMAGE_PER_CHARACTER_BATCH;

  const rawDamage =
    addedLines * DAMAGE_PER_ADDED_LINE +
    removedLines * DAMAGE_PER_REMOVED_LINE +
    characterDamage;

  // Math.min aplica o teto de dano por mensagem enviada ao servidor.
  return Math.min(rawDamage, MAX_DAMAGE_PER_EVENT);
}
