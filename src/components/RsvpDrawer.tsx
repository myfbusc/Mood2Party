import { useState } from 'react';
import { ArrowLeft, Check, Copy, ExternalLink, Eye, Link2, Mail, MessageSquare, RefreshCw, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { applyRsvpReply } from '../lib/actions';
import { rsvpPageFrom } from '../lib/cloud/useCloud';
import { dateLabel, plural, timeLabel } from '../lib/format';
import { Button, Drawer, InfoTip, Note, cx, inputBase } from './ui';
import { RsvpDetails, RsvpForm, type RsvpAnswer } from './Rsvp';

/** Send guests a link where they reply themselves; replies land in the guest list. */
export default function RsvpDrawer() {
  const { s, cloud, close, toast, update, saveDeviceEventsToAccount } = useStore();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const meta = cloud.metas.find((m) => m.id === s.eventId);
  const code = meta?.rsvpCode ?? null;
  const link = code ? `${location.origin}${location.pathname}?rsvp=${code}` : '';
  const when = `${dateLabel(s.event.date)}${s.event.startTime ? ` at ${timeLabel(s.event.startTime)}` : ''}`;
  const message = `You're invited to ${s.event.name} on ${when}! Please let me know if you can come${s.event.rsvpDeadline ? ` by ${dateLabel(s.event.rsvpDeadline)}` : ''}: ${link}`;
  const replies = Object.values(cloud.replies);
  const hostName = meta?.members.find((m) => m.uid === meta.ownerId)?.name.split(/\s+/)[0] ?? cloud.user?.name.split(/\s+/)[0] ?? '';

  const run = async (fn: () => Promise<unknown>, fail: string) => {
    setBusy(true);
    try { await fn(); } catch { toast({ title: fail, detail: 'Check your connection and try again.', tone: 'warn' }); } finally { setBusy(false); }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Select the link and copy it', tone: 'info' });
    }
  };
  // Preview: replies go straight into this guest list, so the flow can be tried without accounts
  const previewSubmit = async (a: RsvpAnswer) => {
    const id = `preview-${Date.now().toString(36)}`;
    update((p) => applyRsvpReply(p, id, { ...a, at: Date.now() }).state);
    toast({ title: `${a.name} replied`, detail: 'Added to your guest list (preview).', tone: 'success' });
    setPreview(false);
  };

  const title = 'Send RSVP Link';
  const subtitle = <span className="inline-flex items-center gap-1">Guests reply themselves
    <InfoTip label="How the RSVP link works">Guests open the link, see the date, time and place, and say whether they can come, how many adults and kids, and any dietary needs or allergies. They don't need an account and can change their reply later. Replies show up in your guest list right away: a group already on your list is updated when the name matches, otherwise a new group is added.</InfoTip></span>;

  if (preview) {
    return (
      <Drawer title="What Guests See" subtitle="Try it: your reply is added to this guest list" onClose={close} footer={<Button variant="ghost" onClick={() => setPreview(false)}><ArrowLeft className="size-4" /> Back</Button>}>
        <div className="rounded-3xl border border-line bg-paper p-5">
          <RsvpDetails page={rsvpPageFrom(s, hostName || 'You')} />
          <div className="mt-5 border-t border-line pt-5"><RsvpForm onSubmit={previewSubmit} /></div>
        </div>
      </Drawer>
    );
  }

  const previewButton = <Button variant="ghost" onClick={() => setPreview(true)}><Eye className="size-4" /> See What Guests See</Button>;
  const footer = <div className="flex w-full flex-wrap items-center gap-2"><Button variant="ghost" onClick={close}>Done</Button></div>;

  // Inside claude.ai, or with no account set up: links need the published site
  if (!cloud.available) {
    return (
      <Drawer title={title} subtitle={subtitle} onClose={close} footer={footer}>
        <Note>RSVP links work on your published site, where parties are saved to a Google account. Here you can see the page guests get, and replies you send from it are added to this guest list.</Note>
        <div className="mt-4">{previewButton}</div>
      </Drawer>
    );
  }
  if (!cloud.user || !meta) {
    return (
      <Drawer title={title} subtitle={subtitle} onClose={close} footer={footer}>
        <p className="text-[15px]">{cloud.user ? 'This party is only on this device. Save it to your account first, then you can send an RSVP link.' : 'Sign in with Google to save this party to your account and send an RSVP link.'}</p>
        <Button className="mt-4" disabled={busy} onClick={() => (cloud.user ? run(async () => { await saveDeviceEventsToAccount(); }, "Couldn't save") : cloud.signIn())}>{cloud.user ? 'Save to My Account' : 'Sign In with Google'}</Button>
        <div className="mt-3">{previewButton}</div>
      </Drawer>
    );
  }

  return (
    <Drawer title={title} subtitle={subtitle} onClose={close} footer={footer}>
      {link ? (
        <>
          <div className="flex gap-2">
            <label htmlFor="rsvp-link" className="sr-only">RSVP link</label>
            <input id="rsvp-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={cx(inputBase, 'min-w-0 flex-1 text-[13px] text-muted')} />
            <Button variant="secondary" onClick={copy} aria-label="Copy RSVP link">{copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy'}</Button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <a href={`sms:?&body=${encodeURIComponent(message)}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line-strong px-4 font-display text-sm font-semibold text-ink hover:bg-cream">
              <MessageSquare className="size-4" aria-hidden="true" /> Text It
            </a>
            <a href={`mailto:?subject=${encodeURIComponent(`You're invited: ${s.event.name}`)}&body=${encodeURIComponent(message)}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-line-strong px-4 font-display text-sm font-semibold text-ink hover:bg-cream">
              <Mail className="size-4" aria-hidden="true" /> Email It
            </a>
          </div>
          <section aria-labelledby="rsvp-msg" className="mt-5">
            <h3 id="rsvp-msg" className="text-sm font-semibold">The message</h3>
            <p className="mt-1.5 rounded-2xl border border-line bg-cream/50 p-3 text-[14px] text-ink">{message}</p>
          </section>
          <p className="mt-4 text-[14px] text-muted">
            <b className="text-ink">{plural(replies.length, 'reply', 'replies')}</b> so far{replies.length ? ` (${replies.filter((r) => r.status === 'yes').length} coming)` : ''}. They show up in your guest list as they arrive.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-semibold text-forest hover:underline">
              <ExternalLink className="size-3.5" aria-hidden="true" /> Open the Guest Page
            </a>
            <button type="button" disabled={busy} onClick={() => run(async () => { await cloud.setRsvp(true); toast({ title: 'New RSVP link ready', detail: 'The old link no longer works. Replies already in stay.', tone: 'success' }); }, "Couldn't make a new link")} className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-semibold text-forest hover:underline">
              <RefreshCw className="size-3.5" aria-hidden="true" /> Make a New Link
            </button>
            <button type="button" disabled={busy} onClick={() => run(async () => { await cloud.setRsvp(false); toast({ title: 'RSVP link turned off', detail: 'Guests can no longer reply with it. Replies already in stay.', tone: 'info' }); }, "Couldn't turn the link off")} className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-danger hover:underline">
              <X className="size-3.5" aria-hidden="true" /> Turn Off Link
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[15px] text-muted">Send one link to everyone you invite. Each guest group replies with how many are coming and any dietary needs, and your guest list fills in by itself.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => run(() => cloud.setRsvp(true), "Couldn't create the link")}><Link2 className="size-4" /> Create RSVP Link</Button>
            {previewButton}
          </div>
        </>
      )}
    </Drawer>
  );
}
