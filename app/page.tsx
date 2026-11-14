"use client";

import { GAME } from "@/util/Game_Interface";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/* ───────────── Steam palette ───────────── */
const C = {
  bg: "#1b2838",
  header: "#171a21",
  panel: "#16202d",
  panelAlt: "#2a475e",
  text: "#c7d5e0",
  muted: "#8f98a0",
  blue: "#66c0f4",
  green: "#a4d007",
  greenBg: "#4c6b22",
  lowGreen: "#beee11",
};

// route that handles the DELETE request (body: { app_id }). Change if yours differs.
const DELETE_ENDPOINT = "/api/remove-game";

/* ───────────── helpers ───────────── */
const toNum = (s?: string) => {
  const n = parseFloat(String(s ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const symbolOf = (s?: string) => String(s ?? "").replace(/[A-Za-z0-9.,\s]/g, "").trim();
const fmt = (n: number, sym: string) =>
  n === 0 ? "Free" : `${sym}${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtTick = (ts: number, span: number) =>
  new Date(ts).toLocaleDateString(
    "en-IN",
    span < 150 * 86400000 ? { day: "numeric", month: "short" } : { month: "short", year: "2-digit" }
  );

// unix s/ms, ISO, or dd/mm/yyyy · dd-mm-yyyy · dd.mm.yyyy (optional time)
const parseDate = (d: string | number): number => {
  const str = String(d ?? "").trim();
  if (/^\d{9,13}$/.test(str)) {
    const n = Number(str);
    return n < 1e11 ? n * 1000 : n;
  }
  const m = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, dd, mm, yy, hh = "0", mi = "0", ss = "0"] = m;
    return new Date(+yy, +mm - 1, +dd, +hh, +mi, +ss).getTime();
  }
  return new Date(str).getTime();
};

/**
 * Prices are only stored when they change, so the last stored price is the
 * current price. We add a point at "now" so the chart runs to the present.
 * prices[].price and original_price are in paise (÷100); price_required is in rupees.
 */
function analyze(game: GAME) {
  const sym = symbolOf(game.price_required) || "₹";
  const history = [...(game.prices ?? [])]
    .map((p) => ({ ts: parseDate(p.date), price: toNum(p.price) / 100 }))
    .filter((p) => Number.isFinite(p.ts))
    .sort((a, b) => a.ts - b.ts);

  // price_required = the price you want (rupees); current = latest stored price
  const required = toNum(game.price_required);
  const original = toNum(game.original_price) / 100;
  const current = history.at(-1)?.price ?? original;
  const discount = original > current && original > 0 ? Math.round((1 - current / original) * 100) : 0;

  const chart = [...history];
  const now = Date.now();
  if (chart.length === 0) chart.push({ ts: now, price: current });
  else if (chart.at(-1)!.ts < now) chart.push({ ts: now, price: current });
  if (chart.length === 1) chart.unshift({ ts: chart[0].ts - 86400000, price: chart[0].price });

  return { sym, current, original, required, discount, reached: required > 0 && current <= required, chart };
}

/* ───────────── pieces ───────────── */
function MetaRow({ sym, current, original, required, discount, reached }: ReturnType<typeof analyze>) {
  return (
    <div className="flex flex-wrap items-stretch justify-between gap-x-3 gap-y-2">
      {/* Steam-style price block */}
      <div className="flex items-stretch overflow-hidden rounded-sm" style={{ background: "#00000066" }}>
        {discount > 0 && (
          <div className="flex items-center px-2.5" style={{ background: C.greenBg }}>
            <span className="whitespace-nowrap text-lg font-bold" style={{ color: C.lowGreen }}>
              -{discount}%
            </span>
          </div>
        )}
        <div className="flex flex-col justify-center px-3 py-1 leading-tight">
          {discount > 0 && (
            <span className="whitespace-nowrap text-xs line-through" style={{ color: "#738895" }}>
              {fmt(original, sym)}
            </span>
          )}
          <span
            className="whitespace-nowrap text-base font-semibold"
            style={{ color: discount > 0 ? C.lowGreen : C.text }}
          >
            {fmt(current, sym)}
          </span>
        </div>
      </div>

      <div className="flex flex-col justify-center text-right leading-tight">
        <span className="whitespace-nowrap text-xs" style={{ color: C.muted }}>
          Required price
        </span>
        <span className="whitespace-nowrap text-base font-semibold" style={{ color: reached ? C.lowGreen : C.blue }}>
          {required > 0 ? fmt(required, sym) : "—"}
        </span>
      </div>
    </div>
  );
}

function PriceTooltip({ active, payload, sym }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div
      className="rounded-sm px-3 py-2 text-sm shadow-lg"
      style={{ background: C.header, border: `1px solid ${C.panelAlt}`, color: C.text }}
    >
      <div style={{ color: C.muted }}>{fmtDate(p.ts)}</div>
      <div className="font-semibold" style={{ color: C.blue }}>
        {fmt(p.price, sym)}
      </div>
    </div>
  );
}

/* ───────────── game card (chart always visible) ───────────── */
function GameCard({ game, onDelete }: { game: GAME; onDelete: () => void }) {
  const s = useMemo(() => analyze(game), [game]);

  const t0 = s.chart[0].ts;
  const t1 = s.chart[s.chart.length - 1].ts;
  const span = t1 - t0;
  const ticks = Array.from({ length: 4 }, (_, i) => Math.round(t0 + (span * i) / 3)).filter(
    (t, i, arr) => i === 0 || fmtTick(t, span) !== fmtTick(arr[i - 1], span)
  );

  const prices = [...s.chart.map((p) => p.price), ...(s.required > 0 ? [s.required] : [])];
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const pad = (hi - lo) * 0.25 || hi * 0.2 || 1;
  const yDomain: [number, number] = [Math.max(0, Math.floor(lo - pad)), Math.ceil(hi + pad)];

  return (
    <article
      className="overflow-hidden rounded-sm"
      style={{ background: C.panel, border: `1px solid ${C.panelAlt}55` }}
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.image}
          alt={game.name}
          loading="lazy"
          className="aspect-[460/215] w-full object-cover"
          style={{ background: C.header }}
        />
        {s.reached && (
          <span
            className="absolute left-2 top-2 rounded-sm px-2 py-0.5 text-xs font-semibold"
            style={{ background: C.lowGreen, color: "#1b2838" }}
          >
            Required price reached
          </span>
        )}
        <button
          onClick={onDelete}
          aria-label={`Remove ${game.name}`}
          title="Remove"
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-sm transition-colors hover:bg-[#c6403a] focus:outline-none focus-visible:ring-2"
          style={{ background: "#000000aa", color: C.text, ["--tw-ring-color" as any]: C.blue }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </button>
      </div>

      <div className="space-y-3 p-3">
        <h3 className="line-clamp-2 text-base font-medium leading-snug text-white">{game.name}</h3>
        <MetaRow {...s} />

        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={s.chart} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`g-${game.app_id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.blue} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C.blue} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.panelAlt} strokeOpacity={0.4} vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={[t0, t1]}
                ticks={ticks}
                tickFormatter={(v) => fmtTick(v, span)}
                tick={{ fill: C.muted, fontSize: 11 }}
                stroke={C.panelAlt}
                height={28}
                padding={{ left: 10, right: 10 }}
              />
              <YAxis
                domain={yDomain}
                tickCount={4}
                tickFormatter={(v) => `${s.sym}${Math.round(v)}`}
                tick={{ fill: C.muted, fontSize: 11 }}
                stroke={C.panelAlt}
                width={52}
              />
              <Tooltip content={<PriceTooltip sym={s.sym} />} cursor={{ stroke: C.blue, strokeOpacity: 0.4 }} />
              {s.required > 0 && (
                <ReferenceLine
                  y={s.required}
                  stroke={C.green}
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  label={{
                    value: `Required ${fmt(s.required, s.sym)}`,
                    position: "insideTopRight",
                    fill: C.green,
                    fontSize: 11,
                  }}
                />
              )}
              <Area
                type="stepAfter"
                dataKey="price"
                stroke={C.blue}
                strokeWidth={2}
                fill={`url(#g-${game.app_id})`}
                dot={{ r: 3, fill: C.blue, stroke: C.panel }}
                activeDot={{ r: 5, fill: C.blue }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </article>
  );
}

/* ───────────── add game modal ───────────── */
const inputStyle = { background: "#316282", color: "#fff", ["--tw-ring-color" as any]: C.blue };

function AddGameModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const urlOk = /^https?:\/\/store\.steampowered\.com\/app\/\d+/i.test(url.trim());
  const priceOk = /^\d+(\.\d+)?$/.test(price.trim());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!urlOk || !priceOk || busy) return;
    setBusy(true);
    setErr("");
    try {
      const resp = await fetch("/api/put-in-redis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_url: url.trim(), price: price.trim() }),
      });
      if (!resp.ok) {
        let msg = `Request failed (${resp.status})`;
        try {
          const data = await resp.json();
          msg = data?.error || data?.message || msg;
        } catch {}
        throw new Error(msg);
      }
      onAdded();
    } catch (e: any) {
      setErr(e?.message ?? "Could not add the game.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-6"
      onClick={() => !busy && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Add a game"
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-t-md p-5 sm:rounded-sm"
        style={{ background: C.bg, border: `1px solid ${C.panelAlt}` }}
      >
        <div>
          <h2 className="text-xl font-semibold text-white">Add a game</h2>
          <p className="text-sm" style={{ color: C.muted }}>
            Paste a Steam store link and the price to start tracking it.
          </p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm">Steam store link</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://store.steampowered.com/app/2406770/Bodycam/"
            className="w-full rounded-sm px-3 py-2 text-sm outline-none focus:ring-2"
            style={inputStyle}
            autoFocus
            inputMode="url"
          />
          {url && !urlOk && (
            <span className="text-xs" style={{ color: "#e5736b" }}>
              Use a link like store.steampowered.com/app/2406770/…
            </span>
          )}
        </label>

        <label className="block space-y-1">
          <span className="text-sm">Price</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="2000"
            className="w-full rounded-sm px-3 py-2 text-sm outline-none focus:ring-2"
            style={inputStyle}
            inputMode="decimal"
          />
          {price && !priceOk && (
            <span className="text-xs" style={{ color: "#e5736b" }}>
              Enter a number, like 2000.
            </span>
          )}
        </label>

        {err && (
          <p className="rounded-sm px-3 py-2 text-sm" style={{ background: "#3b1f1f", color: "#f0a8a2" }}>
            {err}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-sm px-4 py-2 text-sm disabled:opacity-50"
            style={{ background: "#ffffff1a", color: C.text }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!urlOk || !priceOk || busy}
            className="rounded-sm px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "linear-gradient(to right, #75b022 5%, #588a1b 95%)" }}
          >
            {busy ? "Adding…" : "Add game"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ───────────── remove confirmation ───────────── */
function ConfirmRemoveModal({
  name,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  name: string;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, busy]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-6"
      onClick={() => !busy && onCancel()}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="remove-title"
      aria-describedby="remove-desc"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-t-md p-5 sm:rounded-sm"
        style={{ background: C.bg, border: `1px solid ${C.panelAlt}` }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: "#3b1f1f", color: "#e5736b" }}
            aria-hidden="true"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </div>
          <div>
            <h2 id="remove-title" className="text-lg font-semibold leading-snug text-white">
              Remove {name}?
            </h2>
            <p id="remove-desc" className="mt-1 text-sm" style={{ color: C.muted }}>
              It will stop being tracked and its price history will be deleted. This can’t be undone.
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-sm px-3 py-2 text-sm" style={{ background: "#3b1f1f", color: "#f0a8a2" }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            autoFocus
            className="rounded-sm px-4 py-2 text-sm disabled:opacity-50"
            style={{ background: "#ffffff1a", color: C.text }}
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-sm px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "#c6403a" }}
          >
            {busy ? "Removing…" : "Remove game"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── page ───────────── */
export default function Home() {
  const [all_games, setAllGames] = useState<GAME[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState("");
  const [toRemove, setToRemove] = useState<GAME | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeErr, setRemoveErr] = useState("");

  const loadGames = useCallback(async () => {
    try {
      const resp = await fetch("/api/fetch-redis-games", { cache: "no-store" });
      if (!resp.ok) throw new Error(`Request failed (${resp.status})`);
      const games = await resp.json();
      setAllGames(games.all_games_data ?? []);
      setError("");
    } catch (e: any) {
      setError(e?.message ?? "Could not load games.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const handleAdded = () => {
    setAdding(false);
    showToast("Game added. It may take a moment to show up.");
    loadGames();
  };

  const handleRemove = async () => {
    if (!toRemove || removing) return;
    setRemoving(true);
    setRemoveErr("");
    try {
      const resp = await fetch(DELETE_ENDPOINT, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: toRemove.app_id }),
      });
      if (!resp.ok) {
        let msg = `Request failed (${resp.status})`;
        try {
          const data = await resp.json();
          msg = data?.error || data?.message || msg;
        } catch {}
        throw new Error(msg);
      }
      setAllGames((prev) => prev.filter((g) => g.app_id !== toRemove.app_id));
      showToast(`${toRemove.name} removed`);
      setToRemove(null);
    } catch (e: any) {
      setRemoveErr(e?.message ?? "Could not remove the game.");
    } finally {
      setRemoving(false);
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all_games.filter((g) => !q || g.name.toLowerCase().includes(q));
  }, [all_games, query]);

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>
      <header className="sticky top-0 z-40 border-b" style={{ background: C.header, borderColor: "#000" }}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
          <h1 className="text-lg font-semibold text-white">Price tracker</h1>
          <button
            onClick={() => setAdding(true)}
            className="ml-auto rounded-sm px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 sm:order-3 sm:ml-0"
            style={{
              background: "linear-gradient(to right, #75b022 5%, #588a1b 95%)",
              ["--tw-ring-color" as any]: C.blue,
            }}
          >
            Add game
          </button>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracked games"
            className="order-last w-full rounded-sm px-3 py-1.5 text-sm outline-none focus:ring-2 sm:order-2 sm:ml-auto sm:w-64"
            style={inputStyle}
          />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {loading && (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-96 animate-pulse rounded-sm" style={{ background: C.panel }} />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-sm p-4" style={{ background: C.panel, border: "1px solid #7a2e2e" }}>
            <p className="font-medium text-white">Couldn’t load your games</p>
            <p className="text-sm" style={{ color: C.muted }}>
              {error}
            </p>
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <p style={{ color: C.muted }}>
            {all_games.length === 0 ? "No games are being tracked yet." : "No games match your search."}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visible.map((g) => (
            <GameCard
              key={g.app_id}
              game={g}
              onDelete={() => {
                setRemoveErr("");
                setToRemove(g);
              }}
            />
          ))}
        </div>
      </main>

      {adding && <AddGameModal onClose={() => setAdding(false)} onAdded={handleAdded} />}

      {toRemove && (
        <ConfirmRemoveModal
          name={toRemove.name}
          busy={removing}
          error={removeErr}
          onCancel={() => setToRemove(null)}
          onConfirm={handleRemove}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-sm px-4 py-2 text-sm shadow-lg"
          style={{ background: C.greenBg, color: "#fff" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}