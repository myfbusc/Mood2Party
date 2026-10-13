import type { AppState, GuestEstimate, GuestGroup, Headcount, PlanningBasis, TurnoutWeights } from './types';

export interface StatusCount {
  groups: number;
  adults: number;
  children: number;
  total: number;
}

export interface Attendance {
  source: 'rsvp' | 'estimate';
  min: Headcount;
  expected: Headcount;
  max: Headcount;
  byStatus: Record<GuestGroup['status'], StatusCount>;
  invited: number;
  followUps: number; // groups that are not sure yet
}

const zero = (): StatusCount => ({ groups: 0, adults: 0, children: 0, total: 0 });

/** Attendance scenarios. RSVPs drive them once any guest is entered; before that, the setup estimate does. */
export function calcAttendance(guests: GuestGroup[], estimate: GuestEstimate, w: TurnoutWeights): Attendance {
  const byStatus = { confirmed: zero(), maybe: zero(), unresponsive: zero(), declined: zero() };
  for (const g of guests) {
    // "Maybe" and "No reply" are one status now ("Not sure yet"); older plans may still have the second one.
    const s = byStatus[g.status === 'unresponsive' ? 'maybe' : g.status];
    const a = Math.max(0, Math.round(g.adults) || 0) + Math.max(0, Math.round(g.plusOnes ?? 0) || 0);
    const c = Math.max(0, Math.round(g.children) || 0);
    s.groups++;
    s.adults += a;
    s.children += c;
    s.total += a + c;
  }
  const { confirmed: C, maybe: M, unresponsive: U, declined: D } = byStatus;

  if (guests.length === 0) {
    const split = (t: number): Headcount => {
      const children = Math.min(t, typeof estimate.children === 'number' ? Math.round(estimate.children * (estimate.expected ? t / estimate.expected : 1)) : Math.round((t * estimate.childPct) / 100));
      return { total: t, adults: t - children, children };
    };
    return {
      source: 'estimate',
      min: split(estimate.min),
      expected: split(estimate.expected),
      max: split(estimate.max),
      byStatus,
      invited: 0,
      followUps: 0,
    };
  }

  const expAdults = Math.round(C.adults + M.adults * w.maybe);
  const expChildren = Math.round(C.children + M.children * w.maybe);
  return {
    source: 'rsvp',
    min: { total: C.total, adults: C.adults, children: C.children },
    expected: { total: expAdults + expChildren, adults: expAdults, children: expChildren },
    max: {
      total: C.total + M.total + U.total,
      adults: C.adults + M.adults + U.adults,
      children: C.children + M.children + U.children,
    },
    byStatus,
    invited: C.total + M.total + U.total + D.total,
    followUps: M.groups + U.groups,
  };
}

export function planningHeadcount(att: Attendance, basis: PlanningBasis, customCount: number): Headcount {
  if (basis === 'custom') {
    const total = Math.max(0, Math.round(customCount) || 0);
    const ref = att.expected.total || att.max.total || 1;
    const childShare = (att.expected.total ? att.expected.children : att.max.children) / ref;
    const children = Math.round(total * childShare);
    return { total, adults: total - children, children };
  }
  return att[basis];
}

export function stateAttendance(s: AppState): Attendance {
  return calcAttendance(s.guests, s.estimate, s.weights);
}

export function stateHeadcount(s: AppState): Headcount {
  return planningHeadcount(stateAttendance(s), s.basis, s.customCount);
}

export type Risk = { level: 'shortage' | 'balanced' | 'waste'; title: string; detail: string };

export function evaluateRisk(planning: number, att: Attendance): Risk {
  if (planning < att.expected.total) {
    const gap = att.expected.total - planning;
    return {
      level: 'shortage',
      title: 'Shortage risk',
      detail: `You are planning for ${gap} fewer ${gap === 1 ? 'person' : 'people'} than the expected turnout of ${att.expected.total}.`,
    };
  }
  if (planning <= att.max.total) {
    return {
      level: 'balanced',
      title: 'Balanced plan',
      detail:
        `This covers the most likely turnout (${att.expected.total})${planning > att.expected.total ? ` plus ${planning - att.expected.total} extra` : ''}. ` +
        (planning < att.max.total
          ? `If everyone who has not declined comes (${att.max.total}), you would be ${att.max.total - planning} short.`
          : 'It also covers everyone who might come.'),
    };
  }
  return {
    level: 'waste',
    title: 'Waste risk',
    detail: `You are planning for ${planning - att.max.total} more ${planning - att.max.total === 1 ? 'person' : 'people'} than could possibly come (${att.max.total}).`,
  };
}

export const BASIS_LABEL: Record<PlanningBasis, string> = {
  min: 'Confirmed only',
  expected: 'Expected',
  max: 'Maximum',
  custom: 'My own number',
};
