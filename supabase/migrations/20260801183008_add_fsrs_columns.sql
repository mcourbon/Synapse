-- Ajoute les colonnes utilisées par le nouvel algorithme FSRS (stabilité, difficulté).
-- Nullable : les cartes existantes n'ont pas d'historique FSRS ("repartir à zéro" a été
-- choisi plutôt qu'une migration approximative depuis les champs SM-2 existants) — elles
-- seront traitées comme neuves par utils/fsrs.ts à leur prochaine révision.
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS stability double precision,
  ADD COLUMN IF NOT EXISTS difficulty double precision;
