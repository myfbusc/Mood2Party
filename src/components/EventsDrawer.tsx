import { useState } from 'react';
import { CalendarDays, Cloud, Copy, Laptop, Plus, Trash2, Upload } from 'lucide-react';
import { useStore } from '../lib/store';
import { dateLabel, plural } from '../lib/format';
import { Button, Drawer, Note, Pill, cx } from './ui';

/** "Your Events": every plan made in this browser. Open, copy as a template, or delete. */
export default function EventsDrawer() {
  const { s, events, switchEvent, duplicateEvent, deleteEvent, close, go, toast, cloud, saveDeviceEventsToAccount } = useStore();
  const [saving, setSaving] = useState(false);
  const deviceOnly = cloud.user ? events.filter((e) => cloud.deviceOnlyIds.includes(e.id)) : [];
  const [confirming, setConfirming] = useState<string | null>(null);
  return (
    <Drawer
      title="Your Events"
      subtitle={cloud.user ? `Signed in as ${cloud.user.email || cloud.user.name}` : events.length ? `${plural(events.length, 'event')} saved in this browser` : 'Plans you make are saved here'}
      onClose={close}
      footer={
        <>
          <Button onClick={() => { close(); go('setup'); }}><Plus className="size-4" /> New Event</Button>
          <Button variant="ghost" onClick={close}>Close</Button>
        </>
      }
    >
      {s.isDemo && <Note className="mb-4">You are looking at the sample party. It is not saved as one of your events.</Note>}
      {cloud.available && !cloud.user && (
        <Note className="mb-4" icon={<Cloud className="size-4" />}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>These events are only in this browser. Sign in with Google to keep them in your account and open them on any device.</span>
            <Button size="sm" variant="secondary" className="shrink-0 bg-paper" onClick={() => cloud.signIn()}>Sign In</Button>
          </div>
        </Note>
      )}
      {deviceOnly.length > 0 && (
        <Note tone="gold" className="mb-4" icon={<Upload className="size-4" />}>
          <div className="grid gap-2">
            <span><b>{plural(deviceOnly.length, 'event is', 'events are')} only on this device:</b> {deviceOnly.map((e) => e.name).join(', ')}. Save {deviceOnly.length === 1 ? 'it' : 'them'} to your account?</span>
            <Button
              size="sm"
              className="self-start"
              disabled={saving}
              onClick={async () => { setSaving(true); const n = await saveDeviceEventsToAccount(); setSaving(false); toast({ title: `${plural(n, 'event')} saved to your account`, tone: 'success' }); }}
            >
              <Upload className="size-4" /> {saving ? 'Saving…' : 'Save to my account'}
            </Button>
          </div>
        </Note>
      )}
      {events.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-5 text-[15px] text-muted">
          You have not made an event yet. Choose <b>New event</b> to plan your first one.
        </p>
      ) : (
        <ul className="grid gap-3">
          {events.map((e) => {
            const current = e.id === s.eventId;

            return (
              <li key={e.id} className={cx('rounded-2xl border bg-paper p-4', current ? 'border-forest/50' : 'border-line')}>
                {confirming === e.id ? (
                  <div className="grid gap-3">
                    <p className="text-[15px]">Delete <b>{e.name}</b>? Its guests, shopping, tasks and budget are removed{e.where === 'cloud' ? ' from your account and every device' : ' from this browser'}.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="danger" size="sm" onClick={() => { deleteEvent(e.id); setConfirming(null); toast({ title: `${e.name} deleted`, tone: 'info' }); if (current) { close(); go('welcome'); } }}>
                        <Trash2 className="size-4" /> Delete Event
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>Keep It</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-display text-[18px] font-semibold leading-tight">{e.name}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
                          <CalendarDays className="size-3.5" aria-hidden="true" />
                          {dateLabel(e.date)} · {e.tasksDone} of {e.tasksTotal} tasks done
                        </p>
                      </div>
                      <span className="flex flex-wrap gap-1.5">
                        {current && <Pill tone="sage">Open now</Pill>}
                        {cloud.user && (e.where === 'cloud'
                          ? <Pill tone="green" icon={<Cloud className="size-3" aria-hidden="true" />}>{e.isOwner ? 'In your account' : `Shared with you · ${e.role === 'cohost' ? 'co-host' : 'helper'}`}</Pill>
                          : <Pill tone="gold" icon={<Laptop className="size-3" aria-hidden="true" />}>This device only</Pill>)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {!current && (
                        <Button size="sm" onClick={async () => { const ok = await switchEvent(e.id); toast(ok ? { title: `Switched to ${e.name}`, tone: 'success' } : { title: `Could not open ${e.name}`, detail: 'Check your connection and try again.', tone: 'warn' }); }} aria-label={`Open ${e.name}`}>Open</Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`Copy ${e.name} as a new event`}
                        onClick={() => { duplicateEvent(e.id); toast({ title: `Copied ${e.name}`, detail: 'Nothing is bought, done or answered yet. Give the copy a name and date.', tone: 'success' }); }}
                      >
                        <Copy className="size-4" /> Copy as New Event
                      </Button>
                      {e.isOwner && (
                        <Button size="sm" variant="ghost" aria-label={`Delete ${e.name}`} onClick={() => setConfirming(e.id)}>
                          <Trash2 className="size-4" /> Delete
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
