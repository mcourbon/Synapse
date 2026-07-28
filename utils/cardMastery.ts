// utils/cardMastery.ts
export const MASTERY_COLORS: Record<string, string> = {
  nouveau: '#8E8E93',
  apprentissage: '#3B82F6',
  consolidation: '#F59E0B',
  révision: '#8B5CF6',
  maîtrisé: '#10B981',
  difficile: '#EF4444',
};

export const MASTERY_LABELS: Record<string, string> = {
  nouveau: 'Nouveau',
  apprentissage: 'En apprentissage',
  consolidation: 'Consolidation',
  révision: 'En révision',
  maîtrisé: 'Maîtrisé',
  difficile: 'Difficile',
};

export function formatNextReview(nextReview: string | null | undefined): string {
  if (!nextReview) return 'Nouveau';
  const today = new Date();
  const reviewDate = new Date(nextReview);
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const reviewOnly = new Date(reviewDate.getFullYear(), reviewDate.getMonth(), reviewDate.getDate());
  const diffDays = Math.round((reviewOnly.getTime() - todayOnly.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Demain';
  if (diffDays < 7) return `Dans ${diffDays}j`;
  if (diffDays < 30) return `Dans ${Math.round(diffDays / 7)}sem`;
  return `Dans ${Math.round(diffDays / 30)}mois`;
}
