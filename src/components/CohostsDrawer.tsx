import { useState } from 'react';
import { Check, Copy, Link2, LogOut, Mail, MessageSquare, RefreshCw, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { Button, Drawer, InfoTip, Pill, cx, inputBase } from './ui';

/** Invite people to plan the party with you: they sign in and can edit everything. */
export default function CohostsDrawer() {
  const { s, cloud, close, toast, saveDeviceEventsToAccount, deleteEvent, go } = useStore();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null); // uid being removed, or 'leave'
  const [copied, setCopied] = useState(false);
  const meta = cloud.metas.find((m) => m.id === s.eventId);
  const me = cloud.user;
  const isHost = !!meta && !!me && meta.ownerId === me.uid;
  const link = meta?.inviteCode ? `${location.origin}${location.pathname}?join=${meta.id}.${meta.inviteCode}&n=${encodeURIComponent(s.event.name)}` : '';
  const message = `Help me plan ${s.event.name}! Open this link and sign in with Google to co-host it with me on Mood2Party: ${link}`;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };
  const turnOn = () => run(async () => {
    try {
      await cloud.setInvite(s.eventId!, true);
    } catch {
      toast({ title: "Couldn't create the link", detail: 'Check your connection and try again.', tone: 'warn' });
    }
  });
  const turnOff = () => run(async () => {
    try {
      await cloud.setInvite(s.eventId!, false);
      toast({ title: 'Invite link turned off', detail: 'The old link no longer works. Co-hosts who already joined stay.', tone: 'info' });
    } catch {
      toast({ title: "Couldn't turn the link off", tone: 'warn' });
    }
  });
  const renew = () => run(async () => {
    try {
      await cloud.setInvite(s.eventId!, true);
      toast({ title: 'New invite link ready', detail: 'The old link no longer works.', tone: 'success' });
    } catch {
      toast({ title: "Couldn't make a new link", tone: 'warn' });
    }
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Select the link and copy it', tone: 'info' });
    }
  };
  const remove = (uid: string, name: string) => run(async () => {
    const ok = await cloud.removeMember(s.eventId!, uid);
    setConfirm(null);
    toast(ok ? { title: `${name} removed`, detail: 'They can no longer open this party.', tone: 'info' } : { title: `Couldn't remove ${name}`, tone: 'warn' });
  });
  const leave = () => {
    const id = s.eventId!;
    deleteEvent(id); // for a co-host this leaves the party
    close();
    go('welcome');
    toast({ title: `You left ${s.event.name}`, detail: 'The host can invite you again.', tone: 'info' });
  };

  const footer = <Button variant="ghost" onClick={close}>Done</Button>;
  const title = 'Co-hosts';
  const subtitle = <span className="inline-flex items-center gap-1">Plan this party together
    <InfoTip label="Co-hosts and organizers">Co-hosts sign in with Google and can edit everything: guests, shopping, budget and tasks. Changes show up for everyone within seconds. Only the host can invite or remove co-hosts and delete the party. Organizers on the Tasks page are just names you give work to; they don't need an account.</InfoTip></span>;

  // Not signed in, or this party isn't in the account yet
  if (!me) {
    return (
      <Drawer title={title} subtitle={subtitle} onClose={close} footer={footer}>
        <p className="text-[15px]">Sign in with Google to save this party to your account and invite co-hosts.</p>
        <Button className="mt-4" onClick={() => cloud.signIn()}>Sign In with Google</Button>
      </Drawer>
    );
  }
  if (!meta) {
    return (
      <Drawer title={title} subtitle={subtitle} onClose={close} footer={footer}>
        <p className="text-[15px]">This party is only on this device. Save it to your account first, then you can invite co-hosts.</p>
        <Button className="mt-4" disabled={busy} onClick={() => run(async () => { const n = await saveDeviceEventsToAccount(); toast({ title: n ? 'Saved to your account' : 'Saving…', tone: 'success' }); })}>Save to My Account</Button>
      </Drawer>
    );
  }

  return (
    <Drawer title={title} subtitle={subtitle} onClose={close} footer={footer}>
      <section aria-labelledby="ch-people">
        <h3 id="ch-people" className="text-sm font-semibold">People with access <span className="tnum font-normal text-muted">{meta.members.length}</span></h3>
        <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-paper">
          {meta.members.map((m) => {
            const you = m.uid === me.uid;
            const host = m.uid === meta.ownerId;
            if (confirm === m.uid) {
              return (
                <li key={m.uid} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <p className="min-w-0 flex-1 text-[14px]">Remove <b>{m.name}</b>? They'll lose access to this party.</p>
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => remove(m.uid, m.name)}>Remove</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
                </li>
              );
            }
            return (
              <li key={m.uid} className="flex items-center gap-3 px-3 py-2.5">
                <span className={cx('grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold', host ? 'm2p-grad' : 'bg-sage-soft text-forest')} aria-hidden="true">
                  {m.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{m.name}{you && <span className="font-normal text-muted"> (you)</span>}</span>
                  <span className="block truncate text-[13px] text-muted">{m.email}</span>
                </span>
                <Pill tone={host ? 'coral' : 'sage'}>{host ? 'Host' : 'Co-host'}</Pill>
                {isHost && !host && (
                  <button type="button" onClick={() => setConfirm(m.uid)} aria-label={`Remove ${m.name}`} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger">
                    <X className="size-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {isHost ? (
        <section aria-labelledby="ch-invite" className="mt-6">
          <h3 id="ch-invite" className="flex items-center gap-1 text-sm font-semibold">
            Invite link
            <InfoTip label="About the invite link">Anyone with the link can join as a co-host after signing in, so only send it to people you trust. Make a new link any time; the old one stops working.</InfoTip>
          </h3>
          {link ? (
            <>
              <div className="mt-2 flex gap-2">
                <label htmlFor="ch-link" className="sr-only">Invite link</label>
                <input id="ch-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={cx(inputBase, 'min-w-0 flex-1 text-[13px] text-muted')} />
                <Button variant="secondary" onClick={copy} aria-label="Copy invite link">{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy'}</Button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <a href={`sms:?&body=${encodeURIComponent(message)}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line-strong px-4 font-display text-sm font-semibold text-ink hover:bg-cream">
                  <MessageSquare className="size-4" aria-hidden="true" /> Text It
                </a>
                <a href={`mailto:?subject=${encodeURIComponent(`Co-host ${s.event.name} with me`)}&body=${encodeURIComponent(message)}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line-strong px-4 font-display text-sm font-semibold text-ink hover:bg-cream">
                  <Mail className="size-4" aria-hidden="true" /> Email It
                </a>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                <button type="button" disabled={busy} onClick={renew} className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-semibold text-forest hover:underline">
                  <RefreshCw className="size-3.5" aria-hidden="true" /> Make a New Link
                </button>
                <button type="button" disabled={busy} onClick={turnOff} className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-danger hover:underline">
                  <X className="size-3.5" aria-hidden="true" /> Turn Off Link
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-[14px] text-muted">Send a link to the people planning with you. They sign in with Google and the party shows up in their account.</p>
              <Button className="mt-3" disabled={busy} onClick={turnOn}><Link2 className="size-4" /> Create Invite Link</Button>
            </>
          )}
        </section>
      ) : (
        <section className="mt-6">
          <p className="text-[14px] text-muted">Only the host can invite or remove co-hosts.</p>
          {confirm === 'leave' ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-[14px]">Leave <b>{s.event.name}</b>? It disappears from your account.</p>
              <Button size="sm" variant="danger" onClick={leave}>Leave</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="ghost" className="mt-3" onClick={() => setConfirm('leave')}><LogOut className="size-4" /> Leave This Party</Button>
          )}
        </section>
      )}
    </Drawer>
  );
}
