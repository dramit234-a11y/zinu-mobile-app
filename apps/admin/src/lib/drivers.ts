export const STATUS_LABELS: Record<string, string> = {
  NOT_SUBMITTED: 'Not submitted',
  PROFILE_SUBMITTED: 'Profile submitted',
  DOCUMENTS_UNDER_REVIEW: 'Under review',
  ADDITIONAL_INFO_REQUIRED: 'Info required',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};

export const statusClass = (s: string) =>
  s === 'APPROVED' || s === 'VERIFIED' ? 'pill' : s === 'REJECTED' || s === 'SUSPENDED' || s === 'EXPIRED' ? 'pill danger' : s === 'NOT_SUBMITTED' ? 'pill grey' : 'pill warn';

export interface DocVersion {
  id: string;
  docType: string;
  documentNumber: string | null;
  expiresOn: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  rejectionReason: string | null;
  fileIds: string[];
  createdAt: string;
  superseded?: boolean;
}

export interface DriverDetail {
  id: string;
  phone: string | null;
  language: string;
  accountStatus: string;
  status: string;
  statusReason: string | null;
  city: { id: string; name: string } | null;
  submittedAt: string | null;
  approvedAt: string | null;
  personal: { fullName: string | null; dateOfBirth: string | null; address: string | null };
  vehicle: null | {
    registrationNumber: string;
    vehicleType: string;
    fuelType: string;
    ownershipType: string;
    fleetPartnerName?: string;
    make?: string;
    model?: string;
    colour?: string;
    status: string;
  };
  documents: {
    type: { code: string; label: string; required: boolean; requiresExpiry: boolean };
    current: DocVersion | null;
    inForce: DocVersion | null;
    versions: DocVersion[];
  }[];
  payout: null | { id: string; method: string; holderName: string; maskedLabel: string; status: string };
  emergencyContacts: { name: string; phone: string; relation: string | null }[];
  checklist: Record<string, boolean>;
  eligibility: { canGoOnline: boolean; reasons: { code: string; message: string }[] };
  history: { id: number; action: string; actorType: string; after: Record<string, unknown> | null; createdAt: string }[];
}
