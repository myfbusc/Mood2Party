import { useMemo, useState } from 'react';
import { Check, ChevronDown, House, Info, ShoppingCart, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { CATEGORIES, CATEGORY_LABEL, CHANNEL_LABEL, RETAILERS, storeName } from '../lib/catalog';
import { computeLine, optionFor, round2 } from '../lib/plan';
import { costChange, money, plural } from '../lib/format';
import { markPurchased, patchItem, setItemQuantity } from '../lib/actions';
import { applySpend, costFnFor, hasLevels, itemAtTier, levelText, TIER_LABEL, TIER_SIGN, TIERS } from '../lib/tiers';
import { Button, Drawer, Field, OptionalToggle, PaidInput, Segmented, cx, inputCls } from './ui';
import type { Category, Channel, PlanItem, RetailerId, RetailerOption, Tier } from '../lib/types';

type Status = 'need' | 'bought' | 'have';
const STATUS: { key: Status; label: string; icon: typeof Check }[] = [
  { key: 'need', label: 'Need to buy', icon: ShoppingCart },
  { key: 'bought', label: 'Bought', icon: Check },
  { key: 'have', label: 'Already have', icon: House },
];
const num = (v: string, min = 0) => Math.max(min, Number(v) || 0);

/** One short form to edit everything about an item. Changes apply when you save. */
export default function ItemDrawer({ id }: { id: string }) {
  const { s, head, update, close, toast, markDid } = useStore();
  const item = s.items.find((x) => x.id === id);
  const people = ['You', ...s.event.helpers];
  const line = useMemo(() => (item ? computeLine(item, head, s.event, s.appliedFactors) : null), [item, head, s.event, s.appliedFactors]);

  const initialStatus: Status = !line ? 'need' : line.status === 'owned' ? 'have' : line.status === 'purchased' || line.status === 'buy-more' ? 'bought' : 'need';
  const [f, setF] = useState(() => ({
    name: item?.name ?? '',
    category: (item?.category ?? 'supplies') as Category,
    qty: String(line?.need ?? 0),
    unit: item?.unit ?? '',
    retailer: (item?.retailer ?? 'costco') as RetailerId,
    buyer: item?.buyer ?? '',
    optional: item?.priority === 'optional',
    notes: item?.notes ?? '',
    status: initialStatus,
    paid: item?.paidAmount as number | undefined,
    level: (item?.tierPinned && item.tier ? String(item.tier) : 'follow') as 'follow' | '1' | '2' | '3',
    // Price per pack for each store, editable
    prices: Object.fromEntries((item?.options ?? []).map((o) => [o.retailer, { packQty: String(o.packQty), packPrice: String(o.packPrice), supplier: o.supplier ?? '', channel: o.channel ?? 'in-store' }])) as Record<string, { packQty: string; packPrice: string; supplier: string; channel: Channel }>,
  }));
  const [compareOpen, setCompareOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const setPrice = (r: string, k: 'packQty' | 'packPrice' | 'supplier' | 'channel', v: string) =>
    setF((p) => ({ ...p, prices: { ...p.prices, [r]: { ...(p.prices[r] ?? { packQty: '1', packPrice: '', supplier: '', channel: 'in-store' }), [k]: v } } }));

  if (!item || !line) return null;

  // Price level: the item's own, or its category's from Budget
  const levels = hasLevels(item) && item.purchasedPkgs === 0;
  const catLevel = s.event.spend?.[f.category] ?? 2;
  // Following the category: where the category's level (or mix) places this item
  const followed = () => applySpend(s.items.map((x) => (x.id === item.id ? { ...x, category: f.category, tierPinned: undefined } : x)), s.event, costFnFor(s.event, s.appliedFactors, head)).find((x) => x.id === item.id) ?? item;
  const levelled = !levels ? item : f.level === 'follow' ? { ...followed(), category: item.category } : itemAtTier(item, Number(f.level) as Tier, true);
  const pickLevel = (v: typeof f.level) => {
    const next = !levels ? item : v === 'follow' ? followed() : itemAtTier(item, Number(v) as Tier, true);
    setF((p) => ({
      ...p,
      level: v,
      retailer: p.retailer === 'own' || next.options.some((o) => o.retailer === p.retailer) ? p.retailer : next.retailer,
      prices: {
        ...Object.fromEntries(next.options.filter((o) => o.retailer !== 'own').map((o) => [o.retailer, { packQty: String(o.packQty), packPrice: String(o.packPrice), supplier: '', channel: 'in-store' as Channel }])),
        ...(p.prices.own ? { own: p.prices.own } : {}),
      },
    }));
  };

  const qty = Math.round(num(f.qty));
  const options: RetailerOption[] = Object.entries(f.prices).map(([r, v]) => {
    const base = levelled.options.find((o) => o.retailer === r);
    const packQty = Math.max(1, Math.round(num(v.packQty, 1)));
    return {
      retailer: r as RetailerId,
      product: base?.product ?? f.name,
      packLabel: base && base.packQty === packQty ? base.packLabel : packQty === 1 ? '1 item' : `${packQty}-pack`,
      packQty,
      packPrice: round2(num(v.packPrice)),
      ...(r === 'own' ? { supplier: v.supplier.trim() || 'My own store', channel: v.channel } : {}),
    };
  });
  const draft: PlanItem = {
    ...item,
    name: f.name.trim() || item.name,
    category: f.category,
    unit: f.unit.trim() || item.unit,
    retailer: f.retailer,
    options,
    qtyOverride: qty === line.rec ? null : qty,
    ownedQty: f.status === 'have' ? qty : f.status === 'need' && line.status === 'owned' ? 0 : item.ownedQty,
    removed: item.removed,
    purchasedPkgs: 0,
  };
  const fresh = computeLine(draft, head, s.event, s.appliedFactors);
  const boughtPkgs = f.status === 'bought' ? Math.max(fresh.pkgs, item.purchasedPkgs, 1) : 0;
  const preview = computeLine({ ...draft, purchasedPkgs: boughtPkgs, paidAmount: f.status === 'bought' ? f.paid : undefined }, head, s.event, s.appliedFactors);
  const opt = preview.opt;
  const diff = round2(preview.cost - line.cost);
  const priceChanged = levelled.options.some((o) => { const n = options.find((x) => x.retailer === o.retailer); return n && (n.packPrice !== o.packPrice || n.packQty !== o.packQty); });

  const save = () => {
    update((p) => {
      let n = setItemQuantity(p, id, qty === line.rec ? null : qty);
      n = patchItem(n, id, {
        name: draft.name, category: draft.category, unit: draft.unit, retailer: draft.retailer, options,
        buyer: f.buyer, priority: f.optional ? 'optional' : 'essential', notes: f.notes.trim() || undefined,
        ownedQty: draft.ownedQty, removed: draft.removed,
        removedReason: item.removedReason,
        coveredBy: draft.removed ? item.coveredBy : undefined,
        ...(priceChanged ? { priceNote: 'Your price.' } : {}),
        ...(levels ? { tier: levelled.tier, tierPinned: levelled.tierPinned, stdOptions: levelled.stdOptions } : {}),
      });
      if (f.status === 'bought') {
        if (item.purchasedPkgs === 0) n = markPurchased(n, id, true);
        n = patchItem(n, id, { paidAmount: f.paid });
      } else if (item.purchasedPkgs > 0) {
        n = markPurchased(n, id, false);
      }
      return n;
    });
    if (f.buyer && f.buyer !== item.buyer) markDid('buyer');
    if (f.status === 'bought' && initialStatus !== 'bought') markDid('purchased');
    close();
    toast({ title: `${draft.name} saved`, detail: Math.abs(diff) >= 0.005 ? `${costChange(diff)} than before. Budget and shopping list are updated.` : undefined, tone: 'success' });
  };

  const remove = () => {
    const index = s.items.findIndex((x) => x.id === id);
    const saved = item;
    update((p) => ({ ...p, items: p.items.filter((x) => x.id !== id) }));
    close();
    toast({
      title: `${item.name} deleted`,
      detail: line.cost ? `${money(line.cost)} less to spend.` : undefined,
      tone: 'info',
      action: {
        label: 'Undo',
        run: () => {
          update((p) => (p.items.some((x) => x.id === saved.id) ? p : { ...p, items: [...p.items.slice(0, index), saved, ...p.items.slice(index)] }));
        },
      },
    });
  };

  const priceRow = (r: string) => f.prices[r] ?? { packQty: '1', packPrice: '', supplier: '', channel: 'in-store' as Channel };
  const sel = priceRow(f.retailer);
  const hasOwn = !!f.prices.own;

  return (
    <Drawer
      title="Edit Item"
      subtitle={item.priceNote ?? 'Sample prices for concept testing'}
      onClose={close}
      footer={
        confirmDelete ? (
          <div className="flex w-full items-center gap-2">
            <p className="min-w-0 flex-1 text-sm">Delete <b>{item.name}</b> from the list?</p>
            <Button variant="danger" onClick={remove}><Trash2 className="size-4" /> Delete</Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        ) : (
          <div className="flex w-full items-center gap-2">
            <Button onClick={save} disabled={!f.name.trim()}><Check className="size-4" /> Save</Button>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button variant="danger" className="ml-auto" onClick={() => setConfirmDelete(true)} aria-label={`Delete ${item.name}`}><Trash2 className="size-4" /> <span className="max-sm:sr-only">Delete</span></Button>
          </div>
        )
      }
    >
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {/* Status */}
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Status</legend>
          <div className="grid grid-cols-3 gap-2">
            {STATUS.map(({ key, label, icon: Icon }) => (
              <label key={key} className={cx('flex min-h-11 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-1.5 text-center text-[13px] font-semibold', f.status === key ? 'border-forest bg-sage-soft text-forest' : 'border-line bg-paper text-ink hover:border-forest/50')}>
                <input type="radio" name="it-status" className="sr-only" checked={f.status === key} onChange={() => set('status', key)} />
                <Icon className="size-4 max-sm:hidden" aria-hidden="true" /> {label}
              </label>
            ))}
          </div>
          {f.status === 'bought' && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <PaidInput id="it-paid" label={`Amount paid for ${f.name}`} value={f.paid} estimate={round2(boughtPkgs * opt.packPrice)} onSave={(n) => set('paid', n)} />
              <span className="text-[13px] text-muted">{typeof f.paid === 'number' ? 'Actual amount, used in the budget.' : 'Leave empty to use the estimate.'}</span>
            </div>
          )}
          {item.removed && <p className="mt-2 text-[13px] text-muted">Off the list{item.removedReason === 'venue' ? ': already provided (venue or someone else)' : item.removedReason === 'vendor' ? `: covered by ${item.coveredBy || 'a vendor'}` : ''}. Use Bring Back under "Off the List" to add it again.</p>}
        </fieldset>

        {/* What it is */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" htmlFor="it-name" className="col-span-2"><input id="it-name" className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Amount" htmlFor="it-qty">
            <input id="it-qty" type="number" min={0} inputMode="numeric" className={inputCls} value={f.qty} onChange={(e) => set('qty', e.target.value)} />
          </Field>
          <Field label="Unit" htmlFor="it-unit"><input id="it-unit" className={inputCls} value={f.unit} onChange={(e) => set('unit', e.target.value)} /></Field>
          <Field label="Category" htmlFor="it-cat">
            <select id="it-cat" className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </Field>
          <Field label="Who buys it" htmlFor="it-buyer">
            <select id="it-buyer" className={inputCls} value={f.buyer} onChange={(e) => set('buyer', e.target.value)}>
              <option value="">No one yet</option>
              {[...new Set([...people, ...(item.buyer ? [item.buyer] : [])])].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>
        <p className="-mt-1 flex gap-1.5 text-[13px] text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Suggested {line.rec} {item.unit} for {head.total} guests: {item.ruleText.charAt(0).toLowerCase() + item.ruleText.slice(1)}.
            {qty !== line.rec && <> <button type="button" className="font-semibold text-forest underline underline-offset-2" onClick={() => set('qty', String(line.rec))}>Use suggested ({line.rec})</button></>}
          </span>
        </p>

        {/* Where and how much */}
        <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
          {levels && (
            <div className="col-span-2">
              <p className="mb-1.5 text-sm font-semibold">Price level</p>
              <Segmented
                label="Price level"
                size="sm"
                value={f.level}
                onChange={pickLevel}
                options={[
                  { value: 'follow', label: `Like ${CATEGORY_LABEL[f.category].toLowerCase()} (${levelText(catLevel)})` },
                  ...TIERS.map((t) => ({ value: String(t) as '1' | '2' | '3', label: <span title={TIER_LABEL[t]}>{TIER_SIGN[t]}<span className="sr-only"> {TIER_LABEL[t]}</span></span> })),
                ]}
              />
              <p className="mt-1.5 text-[13px] text-muted">{optionFor(levelled, f.retailer === 'own' ? undefined : f.retailer).product}</p>
            </div>
          )}
          <Field label="Where to buy" htmlFor="it-store" className="col-span-2">
            <select id="it-store" className={inputCls} value={f.retailer} onChange={(e) => {
              const r = e.target.value as RetailerId;
              if (r === 'own' && !f.prices.own) setPrice('own', 'packPrice', '');
              set('retailer', r);
            }}>
              {levelled.options.filter((o) => o.retailer !== 'own').map((o) => <option key={o.retailer} value={o.retailer}>{RETAILERS[o.retailer].name}</option>)}
              <option value="own">{hasOwn ? priceRow('own').supplier || 'My own store' : 'My own store or supplier…'}</option>
            </select>
          </Field>
          {f.retailer === 'own' && (
            <>
              <Field label="Store name" htmlFor="it-sup"><input id="it-sup" className={inputCls} value={sel.supplier} onChange={(e) => setPrice('own', 'supplier', e.target.value)} placeholder="Party City, a friend…" /></Field>
              <Field label="How you'll buy it" htmlFor="it-chan">
                <select id="it-chan" className={inputCls} value={sel.channel} onChange={(e) => setPrice('own', 'channel', e.target.value)}>
                  {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
                </select>
              </Field>
            </>
          )}
          <Field label={`${(f.unit || "Units").charAt(0).toUpperCase()}${(f.unit || "Units").slice(1)} per pack`} htmlFor="it-pack"><input id="it-pack" type="number" min={1} className={inputCls} value={sel.packQty} onChange={(e) => setPrice(f.retailer, 'packQty', e.target.value)} /></Field>
          <Field label="Price per pack ($)" htmlFor="it-price"><input id="it-price" type="number" min={0} step={0.01} className={inputCls} value={sel.packPrice} onChange={(e) => setPrice(f.retailer, 'packPrice', e.target.value)} placeholder="0.00" /></Field>
          <p className="tnum col-span-2 text-[13px] text-muted">
            {f.status === 'have' ? 'You have it, so nothing to buy.' : preview.pkgs ? <>{plural(preview.pkgs, 'pack')} × {money(opt.packPrice)} = <b className="text-ink">{money(preview.pkgs * opt.packPrice)}</b>{preview.leftover > 0 && <> · {preview.leftover} {f.unit} left over</>}</> : 'Nothing to buy.'}
            {!item.removed && Math.abs(diff) >= 0.005 && <span className={cx('ml-1 font-semibold', diff > 0 ? 'text-danger' : 'text-ok')}>({costChange(diff)} than before)</span>}
          </p>
        </div>

        <OptionalToggle id="it-opt" checked={f.optional} onChange={(on) => set('optional', on)} />
        <Field label="Notes" htmlFor="it-notes"><textarea id="it-notes" rows={2} className={cx(inputCls, 'py-2')} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Brand, size, color, where to pick it up…" /></Field>

        {/* Compare stores for this item */}
        {levelled.options.filter((o) => o.retailer !== 'own').length > 1 && f.status !== 'have' && (
          <section className="rounded-2xl border border-line">
            <button type="button" onClick={() => setCompareOpen((v) => !v)} aria-expanded={compareOpen} className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-sm font-semibold text-forest">
              Compare Stores for This Item <ChevronDown className={cx('size-4 transition-transform', compareOpen && 'rotate-180')} />
            </button>
            {compareOpen && (
              <ul className="grid gap-1.5 border-t border-line p-2">
                {options.map((o) => {
                  const need = Math.max(0, qty - (f.status === 'have' ? qty : draft.ownedQty));
                  const pk = need ? Math.ceil(need / o.packQty) : 0;
                  const total = round2(pk * o.packPrice);
                  const cheapest = Math.min(...options.map((x) => round2((need ? Math.ceil(need / x.packQty) : 0) * x.packPrice))) === total;
                  const on = f.retailer === o.retailer;
                  return (
                    <li key={o.retailer}>
                      <button type="button" onClick={() => set('retailer', o.retailer)} aria-pressed={on} className={cx('flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm', on ? 'border-forest bg-sage-soft' : 'border-transparent hover:bg-cream')}>
                        <span className="min-w-0">
                          <span className="font-semibold">{storeName(o)}</span>
                          <span className="tnum block text-[12px] text-muted">{pk} × {money(o.packPrice)} ({o.packLabel}){o.retailer !== 'own' && RETAILERS[o.retailer].fee ? ` + ${money(RETAILERS[o.retailer].fee)} delivery` : ''}</span>
                        </span>
                        <span className="tnum shrink-0 text-right font-semibold">{money(total)}{cheapest && options.length > 1 && <span className="block text-[11px] font-semibold text-ok">Lowest</span>}</span>
                      </button>
                    </li>
                  );
                })}
                {!hasOwn && (
                  <li>
                    <button type="button" onClick={() => { setPrice('own', 'packPrice', ''); set('retailer', 'own'); }} className="flex min-h-10 w-full items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-forest hover:bg-cream">
                      <Plus className="size-4" /> Add my own store and price
                    </button>
                  </li>
                )}
              </ul>
            )}
          </section>
        )}
      </form>
    </Drawer>
  );
}
