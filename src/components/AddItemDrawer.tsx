import { useMemo, useState } from 'react';
import { Plus, Store } from 'lucide-react';
import { useStore } from '../lib/store';
import { CATEGORIES, CATEGORY_LABEL, CHANNEL_LABEL, RETAILERS, RETAILER_IDS } from '../lib/catalog';
import { money, plural } from '../lib/format';
import { uid } from '../lib/tasks';
import { Button, Drawer, Field, Note, OptionalToggle, cx, inputCls } from './ui';
import type { Category, Channel, PlanItem, Priority, RetailerId } from '../lib/types';

const CHANNELS = Object.keys(CHANNEL_LABEL) as Channel[];

export default function AddItemDrawer({ category, name, unit }: { category?: Category; name?: string; unit?: string }) {
  const { s, head, update, close, toast, open } = useStore();
  const people = ['You', ...s.event.helpers];
  const [f, setF] = useState({
    name: name ?? '', category: category ?? ('decorations' as Category), priority: 'essential' as Priority, qty: '1', unit: unit ?? 'items',
    packQty: '1', packPrice: '', retailer: 'amazon' as RetailerId, supplier: '', channel: 'in-store' as Channel, owned: '0', buyer: '', scales: false,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const qty = Math.max(0, Math.round(Number(f.qty) || 0));
  const packQty = Math.max(1, Math.round(Number(f.packQty) || 1));
  const price = Math.max(0, Number(f.packPrice) || 0);
  const toBuy = Math.max(0, qty - (Number(f.owned) || 0));
  const pkgs = toBuy ? Math.ceil(toBuy / packQty) : 0;
  const own = f.retailer === 'own';
  const valid = f.name.trim() && qty > 0 && f.packPrice !== '' && (!own || f.supplier.trim());

  const add = () => {
    if (!valid) return;
    const perGuest = head.total > 0 ? qty / head.total : 0;
    const item: PlanItem = {
      id: uid('user'),
      name: f.name.trim(),
      category: f.category,
      priority: f.priority,
      unit: f.unit.trim() || 'items',
      rule: f.scales && perGuest > 0 ? { kind: 'per-guest', perAdult: perGuest, perChild: perGuest } : { kind: 'fixed', qty },
      ruleText: f.scales && perGuest > 0 ? `Added by you: ${qty} for ${head.total} guests, scaled with the guest count` : 'Added by you; this does not change with guest count',
      options: [{
        retailer: f.retailer, product: f.name.trim(), packQty, packLabel: packQty === 1 ? '1 item' : `${packQty}-pack`, packPrice: price,
        ...(own ? { supplier: f.supplier.trim(), channel: f.channel } : {}),
      }],
      retailer: f.retailer,
      qtyOverride: null,
      overrideAtRec: null,
      ownedQty: Math.max(0, Math.round(Number(f.owned) || 0)),
      removed: false,
      purchasedPkgs: 0,
      buyer: f.buyer,
      source: 'user',
      priceNote: 'Your own price.',
    };
    update((p) => ({ ...p, items: [...p.items, item] }));
    close();
    toast({ title: `${item.name} added to ${CATEGORY_LABEL[item.category]}`, detail: `${money(pkgs * price)} added to the estimate.`, tone: 'success' });
  };

  return (
    <Drawer
      title={category ? `Add to ${CATEGORY_LABEL[category]}` : 'Add an Item'}
      subtitle="Anything not on the list yet: vases, a guest book, a rental. Use your own store and price if you like."
      onClose={close}
      footer={
        <>
          <Button onClick={add} disabled={!valid}><Plus className="size-4" /> Add to List</Button>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          {valid && <span className="tnum ml-auto self-center text-sm text-muted">{pkgs} × {money(price)} = <b className="text-ink">{money(pkgs * price)}</b></span>}
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Field label="Item name" htmlFor="ai-name"><input id="ai-name" className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Flower vases" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" htmlFor="ai-cat" className="col-span-2">
            <select id="ai-cat" className={inputCls} value={f.category} onChange={(e) => set('category', e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </Field>
          <Field label="How many" htmlFor="ai-qty"><input id="ai-qty" type="number" min={1} className={inputCls} value={f.qty} onChange={(e) => set('qty', e.target.value)} /></Field>
          <Field label="Unit" htmlFor="ai-unit"><input id="ai-unit" className={inputCls} value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="vases" /></Field>
          <Field label="Where you'll get it" htmlFor="ai-ret" className="col-span-2">
            <select id="ai-ret" className={inputCls} value={f.retailer} onChange={(e) => set('retailer', e.target.value as RetailerId)}>
              {RETAILER_IDS.map((r) => <option key={r} value={r}>{RETAILERS[r].name}</option>)}
              <option value="own">My own store or supplier…</option>
            </select>
          </Field>
          {own && (
            <>
              <Field label="Store or supplier name" htmlFor="ai-sup"><input id="ai-sup" className={inputCls} value={f.supplier} onChange={(e) => set('supplier', e.target.value)} placeholder="Rosa's Bakery" /></Field>
              <Field label="How you'll buy it" htmlFor="ai-chan">
                <select id="ai-chan" className={inputCls} value={f.channel} onChange={(e) => set('channel', e.target.value as Channel)}>
                  {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
                </select>
              </Field>
            </>
          )}
          <Field label="Units per pack" htmlFor="ai-pack"><input id="ai-pack" type="number" min={1} className={inputCls} value={f.packQty} onChange={(e) => set('packQty', e.target.value)} /></Field>
          <Field label="Pack price ($)" htmlFor="ai-price" info="Your estimate. You can change it later."><input id="ai-price" type="number" min={0} step={0.01} className={inputCls} value={f.packPrice} onChange={(e) => set('packPrice', e.target.value)} placeholder="15.00" /></Field>
          <Field label="Already have" htmlFor="ai-owned"><input id="ai-owned" type="number" min={0} className={inputCls} value={f.owned} onChange={(e) => set('owned', e.target.value)} /></Field>
          <Field label="Who buys it" htmlFor="ai-buyer">
            <select id="ai-buyer" className={inputCls} value={f.buyer} onChange={(e) => set('buyer', e.target.value)}>
              <option value="">No buyer yet</option>
              {people.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>
        <OptionalToggle id="ai-opt" checked={f.priority === 'optional'} onChange={(on) => set('priority', on ? 'optional' : 'essential')} />
        <label className={cx('flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line bg-paper px-3 text-sm')}>
          <input type="checkbox" className="size-5 accent-forest" checked={f.scales} onChange={(e) => set('scales', e.target.checked)} />
          <span><b>Scale with guest count.</b> {f.scales ? `About ${(qty / Math.max(1, head.total)).toFixed(2)} per guest.` : 'Leave off for fixed items like a banner.'}</span>
        </label>
        <p className="text-sm text-muted">
          One supplier handling a whole category, like a caterer?{' '}
          <button type="button" className="font-semibold text-forest underline underline-offset-2" onClick={() => open({ type: 'vendor', category: f.category })}>Add a Vendor instead</button>
        </p>
      </form>
    </Drawer>
  );
}

/** One supplier for a whole category (a caterer, a decorator, a rental company), with no item list needed. */
export function VendorDrawer({ category }: { category?: Category }) {
  const { s, plan, update, close, toast } = useStore();
  const people = ['You', ...s.event.helpers];
  const [cat, setCat] = useState<Category>(category ?? 'food');
  const [vendor, setVendor] = useState('');
  const [what, setWhat] = useState('');
  const [price, setPrice] = useState('');
  const [channel, setChannel] = useState<Channel>('vendor');
  const [buyer, setBuyer] = useState('');
  const [covers, setCovers] = useState(true);

  // Items this vendor would replace: still to buy, from the plan, in this category
  const replaced = useMemo(
    () => plan.active.filter((l) => l.item.category === cat && l.item.tag !== 'vendor' && l.item.purchasedPkgs === 0 && l.status !== 'owned'),
    [plan.active, cat],
  );
  const replacedCost = replaced.reduce((a, l) => a + l.cost, 0);
  const total = Math.max(0, Number(price) || 0);
  const valid = vendor.trim() && price !== '';

  const save = () => {
    if (!valid) return;
    const name = vendor.trim();
    const desc = what.trim() || `${CATEGORY_LABEL[cat]} (whole category)`;
    const ids = new Set(covers ? replaced.map((l) => l.item.id) : []);
    const item: PlanItem = {
      id: uid('vendor'), name: `${name}: ${desc}`, category: cat, priority: 'essential', unit: 'order',
      rule: { kind: 'fixed', qty: 1 }, ruleText: 'One vendor price for the whole category; it does not change with guest count',
      options: [{ retailer: 'own', supplier: name, channel, product: desc, packQty: 1, packLabel: 'whole order', packPrice: total }],
      retailer: 'own', qtyOverride: null, overrideAtRec: null, ownedQty: 0, removed: false, purchasedPkgs: 0,
      buyer, source: 'user', priceNote: 'Vendor quote.', tag: 'vendor',
    };
    update((p) => ({
      ...p,
      items: [...p.items.map((it) => (ids.has(it.id) ? { ...it, removed: true, removedReason: 'vendor' as const, coveredBy: name } : it)), item],
    }));
    close();
    toast({
      title: `${name} added for ${CATEGORY_LABEL[cat].toLowerCase()}`,
      detail: ids.size ? `${plural(ids.size, 'item')} (${money(replacedCost)}) moved off the list. Bring any back from "Off the list".` : `${money(total)} added to the estimate.`,
      tone: 'success',
    });
  };

  return (
    <Drawer
      title="Add a Vendor"
      subtitle="One supplier for a whole category, like a caterer or a rental company. No item list needed."
      onClose={close}
      footer={
        <>
          <Button onClick={save} disabled={!valid}><Store className="size-4" /> Add Vendor</Button>
          <Button variant="ghost" onClick={close}>Cancel</Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="Category they handle" htmlFor="v-cat">
          <select id="v-cat" className={inputCls} value={cat} onChange={(e) => setCat(e.target.value as Category)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </Field>
        <Field label="Vendor name" htmlFor="v-name"><input id="v-name" className={inputCls} value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Joe's BBQ Catering" autoFocus /></Field>
        <Field label="What they provide (optional)" htmlFor="v-what"><input id="v-what" className={inputCls} value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Food and drinks for 50, with setup" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Total price ($)" htmlFor="v-price" info="Their quote or your estimate."><input id="v-price" type="number" min={0} step={0.01} className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="850" /></Field>
          <Field label="How you'll book it" htmlFor="v-chan">
            <select id="v-chan" className={inputCls} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
            </select>
          </Field>
          <Field label="Who books it" htmlFor="v-buyer" className="col-span-2">
            <select id="v-buyer" className={inputCls} value={buyer} onChange={(e) => setBuyer(e.target.value)}>
              <option value="">No one yet</option>
              {people.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
        </div>
        {replaced.length > 0 ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-paper p-3 text-sm">
            <input type="checkbox" className="mt-0.5 size-5 accent-forest" checked={covers} onChange={(e) => setCovers(e.target.checked)} />
            <span>
              <b>The vendor covers the current {CATEGORY_LABEL[cat].toLowerCase()} items.</b> Take {plural(replaced.length, 'item')} ({money(replacedCost)}) off the list.
              <span className="mt-1 block text-[13px] text-muted">{replaced.slice(0, 6).map((l) => l.item.name).join(', ')}{replaced.length > 6 ? `, and ${replaced.length - 6} more` : ''}</span>
            </span>
          </label>
        ) : (
          <Note>Nothing still to buy in {CATEGORY_LABEL[cat].toLowerCase()}, so no items will be taken off the list.</Note>
        )}
      </form>
    </Drawer>
  );
}
