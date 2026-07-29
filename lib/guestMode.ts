// lib/guestMode.ts
// Simple flag, mis à jour par AuthContext, lu de façon synchrone par lib/supabase.ts
// pour savoir s'il faut router les requêtes vers le stockage local (mode invité) ou vers Supabase.
let guestMode = false;

export function setGuestMode(value: boolean): void {
  guestMode = value;
}

export function isGuestMode(): boolean {
  return guestMode;
}
