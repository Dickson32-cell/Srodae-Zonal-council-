// Permission tiers — the single source of truth for what each admin level can do.
// Primary admin (username 'admin', adminLevel FULL): everything, including
// managing staff accounts, promoting admins, deleting records + users.
// EDITOR admin: full register powers (create/edit/pay/delete records,
// Excel export) but NO staff management, NO admin promotion.
// VIEWER admin: read-only register + export; cannot create/edit/pay/delete.

export type Perms = {
  canCreateRecords: boolean;
  canEditRecords: boolean; // directly (else requires approval workflow)
  canDeleteRecords: boolean;
  canRecordPayments: boolean;
  canExport: boolean;
  canManageUsers: boolean; // staff approve/reject/delete
  canReviewEdits: boolean;
  canReviewPasswords: boolean;
  canSetAdminLevels: boolean; // only primary
};

export const ADMIN_LEVELS = ["FULL", "EDITOR", "VIEWER"] as const;
export type AdminLevel = (typeof ADMIN_LEVELS)[number];

export const ADMIN_LEVEL_LABELS: Record<string, string> = {
  FULL: "Full Administrator",
  EDITOR: "Editor Administrator",
  VIEWER: "Viewer Administrator",
};

export function permsFor(role: string, adminLevel: string | null): Perms {
  if (role === "ADMIN") {
    if (adminLevel === "VIEWER") {
      return {
        canCreateRecords: false,
        canEditRecords: false,
        canDeleteRecords: false,
        canRecordPayments: false,
        canExport: true,
        canManageUsers: false,
        canReviewEdits: false,
        canReviewPasswords: false,
        canSetAdminLevels: false,
      };
    }
    if (adminLevel === "EDITOR") {
      return {
        canCreateRecords: true,
        canEditRecords: true,
        canDeleteRecords: true,
        canRecordPayments: true,
        canExport: true,
        canManageUsers: false,
        canReviewEdits: true,
        canReviewPasswords: true,
        canSetAdminLevels: false,
      };
    }
    // FULL (primary or promoted full admin)
    return {
      canCreateRecords: true,
      canEditRecords: true,
      canDeleteRecords: true,
      canRecordPayments: true,
      canExport: true,
      canManageUsers: true,
      canReviewEdits: true,
      canReviewPasswords: true,
      canSetAdminLevels: true,
    };
  }
  // STAFF
  return {
    canCreateRecords: true,
    canEditRecords: false, // staff edits go through approval
    canDeleteRecords: false,
    canRecordPayments: true,
    canExport: true,
    canManageUsers: false,
    canReviewEdits: false,
    canReviewPasswords: false,
    canSetAdminLevels: false,
  };
}