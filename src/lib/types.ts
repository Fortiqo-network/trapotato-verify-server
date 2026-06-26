// Shared domain types for the licensing system.

export type LicenseStatus = 'active' | 'disabled' | 'expired' | 'banned';

export interface License {
  id: string;
  product_key: string;
  customer_name: string;
  email: string;
  status: LicenseStatus;
  max_activations: number;
  activation_date: string | null;
  expiry_date: string | null;
  last_verification_time: string | null;
  last_ip: string | null;
  notes: string;
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
  active: number;
  disabled: number;
  expired: number;
  banned: number;
  onlineClients: number;
}

/** Result returned by the public /api/license/verify endpoint. */
export interface VerifyResult {
  valid: boolean;
  status: LicenseStatus | 'invalid';
  reason: string;
  expiryDate?: string | null;
  customerName?: string;
  /** Seconds the client should wait before the next verification (informational). */
  recheckSeconds?: number;
}
