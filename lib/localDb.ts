// lib/localDb.ts
// Mini moteur de requêtes façon PostgREST, utilisé uniquement en mode invité (démo locale).
// Couvre exactement les opérations utilisées dans l'app sur les tables decks/cards/user_stats,
// stockées dans AsyncStorage — aucune donnée ne part vers Supabase.
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LocalTableName = 'decks' | 'cards' | 'user_stats';

type FilterOp = 'eq' | 'not_is_null' | 'in' | 'gte' | 'gt';
interface Filter {
  col: string;
  op: FilterOp;
  val: any;
}

const STORAGE_PREFIX = 'localdb_';

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readTable(table: LocalTableName): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_PREFIX + table);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeTable(table: LocalTableName, rows: any[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(rows));
}

/** Vide toutes les données locales (utilisé quand on quitte le mode invité, si demandé). */
export async function resetLocalData(): Promise<void> {
  await AsyncStorage.multiRemove([
    STORAGE_PREFIX + 'decks',
    STORAGE_PREFIX + 'cards',
    STORAGE_PREFIX + 'user_stats',
  ]);
}

class LocalQueryBuilder implements PromiseLike<{ data: any; error: any; count?: number }> {
  private filters: Filter[] = [];
  private selectCols = '*';
  private wantCount: 'exact' | null = null;
  private wantHead = false;
  private wantSingle = false;
  private orderCol: string | null = null;
  private orderAsc = true;
  private mutation:
    | { kind: 'select' }
    | { kind: 'insert'; rows: any[] }
    | { kind: 'update'; values: any }
    | { kind: 'delete' } = { kind: 'select' };
  private wantSelectAfterMutation = false;

  constructor(private table: LocalTableName) {}

  select(cols: string = '*', opts?: { count?: 'exact'; head?: boolean }) {
    this.selectCols = cols;
    if (opts?.count) this.wantCount = opts.count;
    if (opts?.head) this.wantHead = true;
    if (this.mutation.kind !== 'select') this.wantSelectAfterMutation = true;
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push({ col, op: 'eq', val });
    return this;
  }

  not(col: string, _operator: string, _val: any) {
    this.filters.push({ col, op: 'not_is_null', val: null });
    return this;
  }

  in(col: string, vals: any[]) {
    this.filters.push({ col, op: 'in', val: vals });
    return this;
  }

  gte(col: string, val: any) {
    this.filters.push({ col, op: 'gte', val });
    return this;
  }

  gt(col: string, val: any) {
    this.filters.push({ col, op: 'gt', val });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }

  single() {
    this.wantSingle = true;
    return this;
  }

  insert(rows: any[] | any) {
    this.mutation = { kind: 'insert', rows: Array.isArray(rows) ? rows : [rows] };
    return this;
  }

  update(values: any) {
    this.mutation = { kind: 'update', values };
    return this;
  }

  delete() {
    this.mutation = { kind: 'delete' };
    return this;
  }

  then<TResult1 = { data: any; error: any; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }

  private async loadDecksMap(): Promise<Map<string, any>> {
    const decks = await readTable('decks');
    return new Map(decks.map(d => [d.id, d]));
  }

  private matchesFilters(row: any, decksMap: Map<string, any> | null): boolean {
    return this.filters.every(f => {
      let value: any;
      if (f.col.startsWith('decks.')) {
        const deck = decksMap?.get(row.deck_id);
        value = deck ? deck[f.col.slice('decks.'.length)] : undefined;
      } else {
        value = row[f.col];
      }
      switch (f.op) {
        case 'eq':
          return value === f.val;
        case 'not_is_null':
          return value !== null && value !== undefined;
        case 'in':
          return Array.isArray(f.val) && f.val.includes(value);
        case 'gte':
          return value !== undefined && value !== null && value >= f.val;
        case 'gt':
          return value !== undefined && value !== null && value > f.val;
        default:
          return true;
      }
    });
  }

  private async execute(): Promise<{ data: any; error: any; count?: number }> {
    try {
      const decksMap = this.table === 'cards' ? await this.loadDecksMap() : null;

      if (this.mutation.kind === 'insert') {
        const all = await readTable(this.table);
        const now = new Date().toISOString();
        const inserted = this.mutation.rows.map(r => ({
          created_at: now,
          ...r,
          id: r.id ?? generateId(),
        }));
        await writeTable(this.table, [...all, ...inserted]);
        return { data: this.wantSelectAfterMutation ? inserted : null, error: null };
      }

      if (this.mutation.kind === 'update') {
        const all = await readTable(this.table);
        const decksMapForUpdate = this.table === 'cards' ? decksMap : null;
        const updated: any[] = [];
        const next = all.map(row => {
          if (this.matchesFilters(row, decksMapForUpdate)) {
            const merged = { ...row, ...this.mutation.kind === 'update' ? this.mutation.values : {} };
            updated.push(merged);
            return merged;
          }
          return row;
        });
        await writeTable(this.table, next);
        return { data: this.wantSelectAfterMutation ? updated : null, error: null };
      }

      if (this.mutation.kind === 'delete') {
        const all = await readTable(this.table);
        const remaining = all.filter(row => !this.matchesFilters(row, decksMap));
        await writeTable(this.table, remaining);
        return { data: null, error: null };
      }

      // select
      let rows = await readTable(this.table);
      rows = rows.filter(row => this.matchesFilters(row, decksMap));

      // Relations "embarquées" : cards(count) sur decks, decks!inner(...) sur cards
      if (this.table === 'decks' && this.selectCols.includes('cards(')) {
        const allCards = await readTable('cards');
        rows = rows.map(deck => ({
          ...deck,
          cards: [{ count: allCards.filter(c => c.deck_id === deck.id).length }],
        }));
      }
      if (this.table === 'cards' && (this.selectCols.includes('decks!inner') || this.selectCols.includes('decks('))) {
        rows = rows.map(card => ({
          ...card,
          decks: decksMap?.get(card.deck_id) ?? null,
        }));
      }

      if (this.orderCol) {
        const col = this.orderCol;
        rows = [...rows].sort((a, b) => {
          const av = a[col];
          const bv = b[col];
          if (av === bv) return 0;
          const cmp = av < bv ? -1 : 1;
          return this.orderAsc ? cmp : -cmp;
        });
      }

      if (this.wantCount) {
        return { data: this.wantHead ? null : rows, error: null, count: rows.length };
      }

      if (this.wantSingle) {
        if (rows.length === 0) {
          return { data: null, error: { code: 'PGRST116', message: 'Aucune ligne trouvée' } };
        }
        return { data: rows[0], error: null };
      }

      return { data: rows, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err?.message || 'Erreur de stockage local' } };
    }
  }
}

export function createLocalTable(table: LocalTableName): LocalQueryBuilder {
  return new LocalQueryBuilder(table);
}
