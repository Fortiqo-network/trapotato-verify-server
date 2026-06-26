// Subscription plan catalogue + support contact — shared by server pages & logic.

import type { Plan } from './types';

export interface PlanInfo {
  key: Exclude<Plan, 'none'>;
  label: string;
  price: string;
  /** Validity in days; null = never expires (lifetime). */
  days: number | null;
}

export const PLANS: Record<Exclude<Plan, 'none'>, PlanInfo> = {
  monthly: { key: 'monthly', label: 'Monthly', price: '$50 USD', days: 30 },
  quarterly: { key: 'quarterly', label: '3 Months', price: '$120 USD', days: 90 },
  annual: { key: 'annual', label: 'Annual (12 Months)', price: '$400 USD', days: 365 },
  // 'lifetime' is retained only as a legacy value for old rows; it is not offered.
  lifetime: { key: 'lifetime', label: 'Lifetime (legacy)', price: '—', days: null },
  // 'trial' = the automatic 10-minute free trial granted at registration.
  trial: { key: 'trial', label: 'Free Trial (10 min)', price: 'Free', days: null },
};

/** The subscription plans offered to users (lifetime removed). */
export const PLAN_LIST: PlanInfo[] = [PLANS.monthly, PLANS.quarterly, PLANS.annual];

/** Validity (days) for each plan; null = never expires. */
export const PLAN_DAYS: Record<Plan, number | null> = {
  none: null,
  trial: null, // trial expiry is set in minutes at registration, not days
  monthly: 30,
  quarterly: 90,
  annual: 365,
  lifetime: null,
};

export function planLabel(plan: Plan): string {
  if (plan === 'none') return '—';
  return PLANS[plan].label;
}

export const SUPPORT_EMAIL = 'balraj.fortiqo@gmail.com';
export const SUPPORT_WHATSAPP = '+91 7000695135';
