import { supabase } from "./supabase";

export interface CategoryDef {
  id: number;
  name: string;
  color: string;
  subcategories: string[];
}

// Seeded to match the migration's built-in colors exactly, plus three extras
// (indigo/lime/terracotta) for categories created beyond the original 8, so
// every new custom category still gets a distinguishable color instead of
// falling back to flat gray.
const PALETTE = [
  "#3d9eff",
  "#52b788",
  "#f59e0b",
  "#c084fc",
  "#f472b6",
  "#ef4444",
  "#22d3ee",
  "#818cf8",
  "#a3e635",
  "#e07856",
];

const DEFAULT_COLOR = "#8b9cb3";

function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// A sub-category has no data of its own beyond its name — no stored color
// (those are always shades derived from the parent category's color) and no
// existence independent of a transaction (creating one always immediately
// assigns it, see addSubcategory in App.tsx). So instead of a dedicated
// table, "known sub-categories per category" is just the distinct
// transactions.subcategory values seen for each category.
async function getSubcategoriesByCategory(): Promise<Map<string, string[]>> {
  const byCategory = new Map<string, string[]>();
  if (!supabase) return byCategory;

  const { data, error } = await supabase
    .from("transactions")
    .select("category, subcategory")
    .eq("deleted", false)
    .not("subcategory", "is", null);
  if (error || !data) return byCategory;

  for (const row of data) {
    if (typeof row.category !== "string" || !row.category.trim()) continue;
    if (typeof row.subcategory !== "string" || !row.subcategory.trim()) continue;

    const key = row.category.toLowerCase();
    const existing = byCategory.get(key) ?? [];
    if (!existing.some((name) => name.toLowerCase() === row.subcategory.toLowerCase())) {
      existing.push(row.subcategory);
    }
    byCategory.set(key, existing);
  }

  for (const [key, names] of byCategory) {
    byCategory.set(key, names.sort((a, b) => a.localeCompare(b)));
  }

  return byCategory;
}

export async function getCategories(): Promise<CategoryDef[]> {
  if (!supabase) return [];

  const [categoriesResult, subcategoriesByCategory] = await Promise.all([
    supabase.from("categories").select("id, name, color").order("id", { ascending: true }),
    getSubcategoriesByCategory(),
  ]);

  if (categoriesResult.error || !categoriesResult.data) return [];

  return categoriesResult.data.map((row) => ({
    id: row.id,
    name: row.name ?? "",
    color: typeof row.color === "string" && row.color ? row.color : DEFAULT_COLOR,
    subcategories: subcategoriesByCategory.get((row.name ?? "").toLowerCase()) ?? [],
  }));
}

// existingCount should be the caller's already-loaded categories.length, so a
// brand-new category gets the next color in rotation without an extra round
// trip (and without racing a concurrent count query against this insert).
export async function createCategory(name: string, existingCount: number): Promise<CategoryDef | null> {
  if (!supabase) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  const { data: existing } = await supabase
    .from("categories")
    .select("id, name, color")
    .ilike("name", escapeIlike(trimmed))
    .maybeSingle();
  if (existing) {
    const subcategoriesByCategory = await getSubcategoriesByCategory();
    return {
      id: existing.id,
      name: existing.name,
      color: typeof existing.color === "string" && existing.color ? existing.color : DEFAULT_COLOR,
      subcategories: subcategoriesByCategory.get(existing.name.toLowerCase()) ?? [],
    };
  }

  const color = PALETTE[existingCount % PALETTE.length] ?? DEFAULT_COLOR;
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: trimmed, color })
    .select("id, name, color")
    .single();
  if (error || !data) return null;

  return { id: data.id, name: data.name, color: data.color, subcategories: [] };
}

// Renaming keeps transactions.category (plain text, no FK) in sync: every
// transaction currently holding the old name is bulk-updated to the new one,
// so historical rows don't silently fall out of sync with the taxonomy.
export async function renameCategory(category: CategoryDef, newName: string): Promise<CategoryDef | null> {
  if (!supabase) return null;
  const trimmed = newName.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === category.name.toLowerCase()) return { ...category, name: trimmed };

  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .neq("id", category.id)
    .ilike("name", escapeIlike(trimmed))
    .maybeSingle();
  if (existing) return null;

  const { error } = await supabase.from("categories").update({ name: trimmed }).eq("id", category.id);
  if (error) return null;

  await supabase.from("transactions").update({ category: trimmed }).eq("category", category.name);

  return { ...category, name: trimmed };
}

// Deleting a category clears it (and whatever sub-category was scoped under
// it) from any transactions that referenced it by name, back to null — the
// same state as a transaction that was never explicitly categorized, so it
// falls back to inferCategory's guess rather than pointing at a taxonomy
// entry that no longer exists.
export async function deleteCategory(category: CategoryDef): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase.from("categories").delete().eq("id", category.id);
  if (error) return false;

  await supabase
    .from("transactions")
    .update({ category: null, subcategory: null })
    .eq("category", category.name);

  return true;
}

// Bulk-renames every transaction under `category` currently holding
// `oldName` as its sub-category. There's no separate row to update — the
// text on transactions is the only place a sub-category "lives".
export async function renameSubcategory(
  category: CategoryDef,
  oldName: string,
  newName: string,
): Promise<string | null> {
  if (!supabase) return null;
  const trimmed = newName.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === oldName.toLowerCase()) return trimmed;

  const { error } = await supabase
    .from("transactions")
    .update({ subcategory: trimmed })
    .eq("category", category.name)
    .eq("subcategory", oldName);
  if (error) return null;

  return trimmed;
}

export async function deleteSubcategory(category: CategoryDef, name: string): Promise<boolean> {
  if (!supabase) return false;

  const { error } = await supabase
    .from("transactions")
    .update({ subcategory: null })
    .eq("category", category.name)
    .eq("subcategory", name);

  return !error;
}
