import { Copy, ExternalLink } from 'lucide-react';
import { useStore } from '../lib/store';
import { CHANNEL_LABEL, RETAILERS, RETAILER_IDS } from '../lib/catalog';
import { copyText, storeSearchUrl } from '../lib/links';
import { money, plural } from '../lib/format';
import type { Line } from '../lib/plan';
import { Button, Drawer, Note } from './ui';

const STORE_HOME: Record<string, string> = {
  costco: 'https://www.costco.com/',
  target: 'https://www.target.com/',
  amazon: 'https://www.amazon.com/',
  instacart: 'https://www.instacart.com/',
};

/** Packages still to buy for a line (only the extra packs when some were already bought). */
const packsToBuy = (l: Line) => (l.status === 'buy-more' ? l.morePkgs : l.pkgs);

/** "Shop by Store": what is still needed, grouped by the store each item is set to, ready to copy or search. */
export default function StoresDrawer() {
  const { s, plan, close, toast } = useStore();
  const groups = RETAILER_IDS.map((r) => {
    const lines = plan.active.filter((l) => l.opt.retailer === r && (l.status === 'to-buy' || l.status === 'buy-more') && packsToBuy(l) > 0);
    const subtotal = lines.reduce((a, l) => a + packsToBuy(l) * l.opt.packPrice, 0);
    return { r, lines, subtotal };
  }).filter((g) => g.lines.length);
  const ownLines = plan.active.filter((l) => l.opt.retailer === 'own' && (l.status === 'to-buy' || l.status === 'buy-more') && packsToBuy(l) > 0);

  const listText = (g: (typeof groups)[number]) =>
    [
      `${RETAILERS[g.r].name} shopping list for ${s.event.name}`,
      ...g.lines.map((l) => `- ${l.opt.product}: ${packsToBuy(l)} × ${l.opt.packLabel}${l.item.buyer ? ` (${l.item.buyer === 'You' ? 'you' : l.item.buyer})` : ''}`),
      `About ${money(g.subtotal)}${RETAILERS[g.r].fee ? ` + ${money(RETAILERS[g.r].fee)} delivery` : ''} (sample prices)`,
    ].join('\n');

  return (
    <Drawer title="Shop by Store" subtitle="Everything still to buy, grouped by store" onClose={close} footer={<Button variant="ghost" onClick={close}>Close</Button>}>
      {groups.length === 0 && ownLines.length === 0 ? (
        <Note tone="green">Nothing is left to buy. Everything is bought or you already had it.</Note>
      ) : (
        <div className="grid gap-5">
          {groups.map((g) => (
            <section key={g.r} aria-labelledby={`store-${g.r}`} className="rounded-2xl border border-line bg-paper p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 id={`store-${g.r}`} className="font-display text-[19px] font-semibold">{RETAILERS[g.r].name}</h3>
                  <p className="text-[13px] text-muted">
                    {plural(g.lines.length, 'item')} · about {money(g.subtotal)}{RETAILERS[g.r].fee ? ` + ${money(RETAILERS[g.r].fee)} delivery` : ''} · {RETAILERS[g.r].timing}
                  </p>
                </div>
              </div>
              <ul className="mt-3 divide-y divide-line">
                {g.lines.map((l) => (
                  <li key={l.item.id} className="flex items-center justify-between gap-3 py-2 text-[14px]">
                    <span className="min-w-0">
                      <span className="font-semibold">{l.opt.product}</span>
                      <span className="text-muted"> · {packsToBuy(l)} × {l.opt.packLabel}{l.item.buyer ? ` · ${l.item.buyer}` : ''}</span>
                    </span>
                    <a href={storeSearchUrl(g.r, l.opt.product)} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-forest hover:bg-sage-soft" aria-label={`Find ${l.opt.product} at ${RETAILERS[g.r].short}`}>
                      Find <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const ok = await copyText(listText(g));
                    toast(ok ? { title: `${RETAILERS[g.r].short} list copied`, detail: 'Paste it into a note, a text or the store’s app.', tone: 'success' } : { title: 'Copying is blocked here', detail: 'Select the items above and copy them instead.', tone: 'warn' });
                  }}
                >
                  <Copy className="size-4" /> Copy List
                </Button>
                <a href={STORE_HOME[g.r]} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 font-display text-sm font-semibold text-ink hover:bg-cream">
                  Open {RETAILERS[g.r].short} <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            </section>
          ))}
          {ownLines.length > 0 && (
            <section aria-labelledby="store-own" className="rounded-2xl border border-line bg-paper p-4">
              <h3 id="store-own" className="font-display text-[19px] font-semibold">Your Own Suppliers and Vendors</h3>
              <ul className="mt-2 divide-y divide-line">
                {ownLines.map((l) => (
                  <li key={l.item.id} className="flex items-center justify-between gap-3 py-2 text-[14px]">
                    <span className="min-w-0">
                      <span className="font-semibold">{l.item.name}</span>
                      <span className="text-muted"> · {l.opt.supplier} · {CHANNEL_LABEL[l.opt.channel ?? 'in-store']}{l.item.buyer ? ` · ${l.item.buyer}` : ''}</span>
                    </span>
                    <span className="tnum shrink-0 font-semibold">{money(packsToBuy(l) * l.opt.packPrice)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="text-[13px] text-muted">Prices here are samples for concept testing. Check the store for real prices and stock. To change which store an item comes from, tap Compare options on the item, or use Compare stores for the whole list.</p>
        </div>
      )}
    </Drawer>
  );
}
