// Shared domain types for the licensing system.

export type LicenseStatus = 'pending' | 'active' | 'disabled' | 'expired' | 'banned';
export type Plan = 'none' | 'monthly' | 'quarterly' | 'annual' | 'lifetime';

export interface License {
  id: string;
  product_key: string;
  customer_name: string;
  email: string;
  whatsapp: string;
  status: LicenseStatus;
  /** The currently active plan (set on activation). */
  plan: Plan;
  /** The plan the user said they want to buy (captured at registration). */
  requested_plan: Plan;
  /** Legacy column, retained for back-compat. Device limits are now plan-driven. */
  max_activations: number;
  activation_date: string | null;
  expiry_date: string | null;
  last_verification_time: string | null;
  last_ip: string | null;
  notes: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Machine {
  id: string;
  license_id: string;
  machine_id: string;
  os: string;
  device_name: string;
  ip_address: string;
  activation_date: string;
  last_seen: string;
}

export interface VerificationLog {
  id: string;
  license_id: string | null;
  product_key: string | null;
  machine_id: string | null;
  ip_address: string | null;
  success: boolean;
  reason: string | null;
  created_at: string;
}

export interface Stats {
  total: number;
  pending: number;
  active: number;
  disabled: number;
  expired: number;
  banned: number;
  deleted: number;
  onlineClients: number;
}

/** Result returned by the public /api/license/verify endpoint. */
export interface VerifyResult {
  valid: boolean;
  status: LicenseStatus | 'invalid';
  reason: string;
  plan?: Plan;
  expiryDate?: string | null;
  /** Days left for time-based plans; null = unlimited (lifetime); undefined = n/a. */
  remainingDays?: number | null;
  customerName?: string;
  recheckSeconds?: number;
}
