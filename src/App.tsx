import type { ReactNode } from 'react';
import { StoreProvider, useStore } from './lib/store';
import { Shell } from './components/Shell';
import Toasts from './components/Toasts';
import { PageGlow } from './components/ui';
import { IntroModal, Tour } from './components/Onboarding';
import ItemDrawer from './components/ItemDrawer';
import AddItemDrawer, { VendorDrawer } from './components/AddItemDrawer';
import OptimizeDrawer from './components/OptimizeDrawer';
import ImpactDrawer from './components/ImpactDrawer';
import EventsDrawer from './components/EventsDrawer';
import StoresDrawer from './components/StoresDrawer';
import CohostsDrawer from './components/CohostsDrawer';
import RsvpDrawer from './components/RsvpDrawer';
import { RsvpPageView } from './components/Rsvp';
import { AssignDrawer, SendDrawer } from './components/HelperDrawers';
import { EventDrawer, GuestDrawer, InspireDrawer, ResetDrawer, TaskDrawer } from './components/Drawers';
import Welcome from './pages/Welcome';
import Setup from './pages/Setup';
import Overview from './pages/Overview';
import Guests from './pages/Guests';
import Plan from './pages/Plan';
import Budget from './pages/Budget';
import Tasks from './pages/Tasks';
import WrapUp from './pages/WrapUp';

function Router() {
  const { page, drawer, s, tour } = useStore();
  const inApp = s.started && page !== 'welcome' && page !== 'setup';
  const body = {
    overview: <Overview />, guests: <Guests />, plan: <Plan />, budget: <Budget />, tasks: <Tasks />, wrapup: <WrapUp />,
  } as Record<string, ReactNode>;
  return (
    <>
      <PageGlow besideSidebar={inApp} />
      {page === 'welcome' || !s.started && page !== 'setup' ? <Welcome /> : page === 'setup' ? <Setup /> : inApp ? <Shell>{body[page]}</Shell> : <Welcome />}
      {drawer?.type === 'item' && <ItemDrawer key={drawer.id} id={drawer.id} />}
      {drawer?.type === 'add-item' && <AddItemDrawer key={`${drawer.category ?? ''}-${drawer.name ?? ''}`} category={drawer.category} name={drawer.name} unit={drawer.unit} />}
      {drawer?.type === 'vendor' && <VendorDrawer category={drawer.category} />}
      {drawer?.type === 'optimize' && <OptimizeDrawer />}
      {drawer?.type === 'impact' && <ImpactDrawer />}
      {drawer?.type === 'event' && <EventDrawer />}
      {drawer?.type === 'guest' && <GuestDrawer key={drawer.id ?? 'new'} id={drawer.id} />}
      {drawer?.type === 'task' && <TaskDrawer key={drawer.id ?? 'new'} id={drawer.id} />}
      {drawer?.type === 'inspire' && <InspireDrawer />}
      {drawer?.type === 'reset' && <ResetDrawer />}
      {drawer?.type === 'events' && <EventsDrawer />}
      {drawer?.type === 'stores' && <StoresDrawer />}
      {drawer?.type === 'cohosts' && <CohostsDrawer />}
      {drawer?.type === 'rsvp' && <RsvpDrawer />}
      {drawer?.type === 'assign' && <AssignDrawer key={drawer.person} person={drawer.person} />}
      {drawer?.type === 'send' && <SendDrawer key={drawer.person} person={drawer.person} />}
      {page === 'welcome' && !s.onboarding.introSeen && tour === null && <IntroModal />}
      <Tour />
      <Toasts />
    </>
  );
}

// A guest opening an RSVP link sees only the reply page: no app, no account
const rsvpCode = (() => {
  try {
    const c = new URLSearchParams(location.search).get('rsvp');
    return c && /^[a-z0-9]{6,40}$/i.test(c) ? c : null;
  } catch {
    return null;
  }
})();

export default function App() {
  if (rsvpCode) return <><PageGlow besideSidebar={false} /><RsvpPageView code={rsvpCode} /></>;
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  );
}
