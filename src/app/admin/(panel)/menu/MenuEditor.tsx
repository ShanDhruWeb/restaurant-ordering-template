"use client";

import { type FormEvent, useState } from "react";
import { VegMark } from "@/components/VegMark";
import { adminStrings } from "@/content/adminStrings";
import { adminApi } from "@/lib/client/adminApi";
import { formatRupees, paiseToRupeeString, parseRupeesToPaise } from "@/lib/money";
import type { getAdminMenu } from "@/server/admin/menu";

type Category = Awaited<ReturnType<typeof getAdminMenu>>[number];
type Item = Category["items"][number];
const t = adminStrings.menu;

export function MenuEditor({ initial }: { initial: Category[] }) {
  const [categories, setCategories] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // item id, "new:<categoryId>" or "cat:<id>"
  const [newCategory, setNewCategory] = useState("");

  /** Send one change; the server returns the whole fresh menu. */
  const change = async (body: Record<string, unknown>): Promise<boolean> => {
    setSaving(true);
    setError(null);
    const res = await adminApi<{ categories: Category[] }>("/api/admin/menu", { method: "POST", body });
    setSaving(false);
    if (!res.ok) {
      setError(res.data.error ?? adminStrings.board.actionFailed);
      return false;
    }
    setCategories(res.data.categories);
    return true;
  };

  const toggleAvailability = (item: Item) => {
    // Instant feedback; the server response confirms it.
    setCategories((cs) =>
      cs.map((c) => ({
        ...c,
        items: c.items.map((i) => (i.id === item.id ? { ...i, isAvailable: !i.isAvailable } : i)),
      })),
    );
    void change({ action: "update_item", id: item.id, isAvailable: !item.isAvailable });
  };

  const addCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (newCategory.trim() && (await change({ action: "create_category", name: newCategory })))
      setNewCategory("");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        {saving && (
          <span className="text-sm text-muted" role="status">
            …
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-card bg-danger px-3 py-2 font-semibold text-surface">
          {error}
        </p>
      )}

      {categories.length === 0 && <p className="mt-6 text-muted">{t.empty}</p>}

      {categories.map((cat, ci) => (
        <section key={cat.id} className="mt-6 rounded-card border border-line bg-surface">
          <header className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            {editing === `cat:${cat.id}` ? (
              <RenameCategory
                category={cat}
                onCancel={() => setEditing(null)}
                onSave={async (name) => {
                  if (await change({ action: "update_category", id: cat.id, name })) setEditing(null);
                }}
              />
            ) : (
              <>
                <h2 className={`flex-1 text-xl font-bold ${cat.isActive ? "" : "text-muted line-through"}`}>
                  {cat.name}
                </h2>
                <IconButton
                  label={t.moveUp(cat.name)}
                  disabled={ci === 0}
                  onClick={() => change({ action: "move_category", id: cat.id, direction: "up" })}
                >
                  ↑
                </IconButton>
                <IconButton
                  label={t.moveDown(cat.name)}
                  disabled={ci === categories.length - 1}
                  onClick={() => change({ action: "move_category", id: cat.id, direction: "down" })}
                >
                  ↓
                </IconButton>
                <SmallButton
                  onClick={() => change({ action: "update_category", id: cat.id, isActive: !cat.isActive })}
                >
                  {cat.isActive ? t.visible : t.hidden}
                </SmallButton>
                <SmallButton onClick={() => setEditing(`cat:${cat.id}`)}>{t.edit}</SmallButton>
                <SmallButton
                  danger
                  onClick={() =>
                    window.confirm(t.confirmDeleteCategory(cat.name)) &&
                    change({ action: "delete_category", id: cat.id })
                  }
                >
                  {t.delete}
                </SmallButton>
              </>
            )}
          </header>

          <ul className="divide-y divide-line">
            {cat.items.map((item, ii) =>
              editing === item.id ? (
                <li key={item.id} className="p-3">
                  <ItemForm
                    item={item}
                    categories={categories}
                    onCancel={() => setEditing(null)}
                    onSave={async (data) => {
                      if (await change({ action: "update_item", id: item.id, ...data })) setEditing(null);
                    }}
                  />
                </li>
              ) : (
                <li key={item.id} className="flex flex-wrap items-center gap-2 p-3">
                  <div className="min-w-40 flex-1">
                    <p className="flex items-center gap-2 font-semibold">
                      <VegMark isVeg={item.isVeg} /> {item.name}
                    </p>
                    <p className="text-sm text-muted">{formatRupees(item.pricePaise)}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.isAvailable}
                    aria-label={`${item.name}: ${item.isAvailable ? t.available : t.soldOut}`}
                    onClick={() => toggleAvailability(item)}
                    className={`h-12 min-w-32 rounded-card px-3 font-bold ${
                      item.isAvailable
                        ? "bg-success text-surface"
                        : "border-2 border-danger bg-surface text-danger"
                    }`}
                  >
                    {item.isAvailable ? t.available : t.soldOut}
                  </button>
                  <IconButton
                    label={t.moveUp(item.name)}
                    disabled={ii === 0}
                    onClick={() => change({ action: "move_item", id: item.id, direction: "up" })}
                  >
                    ↑
                  </IconButton>
                  <IconButton
                    label={t.moveDown(item.name)}
                    disabled={ii === cat.items.length - 1}
                    onClick={() => change({ action: "move_item", id: item.id, direction: "down" })}
                  >
                    ↓
                  </IconButton>
                  <SmallButton onClick={() => setEditing(item.id)}>{t.edit}</SmallButton>
                  <SmallButton
                    danger
                    onClick={() =>
                      window.confirm(t.confirmDeleteItem(item.name)) &&
                      change({ action: "delete_item", id: item.id })
                    }
                  >
                    {t.delete}
                  </SmallButton>
                </li>
              ),
            )}
            <li className="p-3">
              {editing === `new:${cat.id}` ? (
                <ItemForm
                  categories={categories}
                  defaultCategoryId={cat.id}
                  onCancel={() => setEditing(null)}
                  onSave={async (data) => {
                    if (await change({ action: "create_item", ...data })) setEditing(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(`new:${cat.id}`)}
                  className="h-12 rounded-card border-2 border-dashed border-line px-4 font-semibold"
                >
                  + {t.addItem}
                </button>
              )}
            </li>
          </ul>
        </section>
      ))}

      <form onSubmit={addCategory} className="mt-6 flex gap-2">
        <label className="flex-1">
          <span className="sr-only">{t.categoryName}</span>
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            maxLength={60}
            placeholder={t.categoryName}
            className="h-12 w-full rounded-card border border-line bg-surface px-3"
          />
        </label>
        <button type="submit" className="h-12 rounded-card bg-primary px-4 font-bold text-on-primary">
          + {t.addCategory}
        </button>
      </form>
    </div>
  );
}

function ItemForm(props: {
  item?: Item;
  categories: Category[];
  defaultCategoryId?: string;
  onCancel: () => void;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const { item } = props;
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item ? paiseToRupeeString(item.pricePaise).replace(/\.00$/, "") : "");
  const [isVeg, setIsVeg] = useState(item?.isVeg ?? true);
  const [imagePath, setImagePath] = useState(item?.imagePath ?? "");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? props.defaultCategoryId ?? "");
  const [priceError, setPriceError] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const pricePaise = parseRupeesToPaise(price);
    if (pricePaise === null || pricePaise < 100) return setPriceError(true);
    props.onSave({ name, description, pricePaise, isVeg, imagePath, categoryId });
  };
  const field = "mt-1 h-12 w-full rounded-card border border-line bg-surface px-3";

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="text-sm font-semibold">{t.itemName}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
          className={field}
        />
      </label>
      <label className="sm:col-span-2">
        <span className="text-sm font-semibold">{t.description}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          rows={2}
          className="mt-1 w-full rounded-card border border-line bg-surface p-3"
        />
      </label>
      <label>
        <span className="text-sm font-semibold">{t.price}</span>
        <input
          value={price}
          onChange={(e) => {
            setPrice(e.target.value);
            setPriceError(false);
          }}
          inputMode="decimal"
          required
          className={field}
          aria-invalid={priceError}
        />
        {priceError && <span className="text-sm text-danger">{t.invalidPrice}</span>}
      </label>
      <label>
        <span className="text-sm font-semibold">{t.category}</span>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
          {props.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex h-12 items-center gap-3">
        <input
          type="checkbox"
          checked={isVeg}
          onChange={(e) => setIsVeg(e.target.checked)}
          className="h-6 w-6"
        />
        <span className="font-semibold">{t.veg}</span>
      </label>
      <label>
        <span className="text-sm font-semibold">{t.image}</span>
        <input
          value={imagePath}
          onChange={(e) => setImagePath(e.target.value)}
          maxLength={200}
          className={field}
        />
        <span className="text-xs text-muted">{t.imageHint}</span>
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="h-12 flex-1 rounded-card bg-primary font-bold text-on-primary">
          {t.save}
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          className="h-12 flex-1 rounded-card border border-line font-bold"
        >
          {t.cancel}
        </button>
      </div>
    </form>
  );
}

function RenameCategory(props: { category: Category; onCancel: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(props.category.name);
  return (
    <form
      className="flex flex-1 gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        props.onSave(name);
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={60}
        aria-label={t.categoryName}
        className="h-12 flex-1 rounded-card border border-line bg-surface px-3"
      />
      <SmallButton type="submit">{t.save}</SmallButton>
      <SmallButton onClick={props.onCancel}>{t.cancel}</SmallButton>
    </form>
  );
}

function SmallButton(props: {
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      className={`h-12 rounded-card border px-3 text-sm font-semibold ${props.danger ? "border-danger text-danger" : "border-line"}`}
    >
      {props.children}
    </button>
  );
}

function IconButton(props: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className="h-12 w-12 rounded-card border border-line text-lg font-bold disabled:opacity-30"
    >
      {props.children}
    </button>
  );
}
