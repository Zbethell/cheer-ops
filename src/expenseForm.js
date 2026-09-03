// ─── Expense form schema ──────────────────────────────────────────────────────
// Single source of truth for what the public expense form (/expenses) contains
// and which parts an admin may change from Expenses → Form Settings.
//
// Both the form itself and the settings editor import from here, so a field can
// never exist in one and be missing from the other. The saved config lives as
// expense-config.json in SharePoint; everything here is the fallback shape it is
// merged onto, which is what lets an old saved config keep working after a new
// field is added.
//
// The two API copies (api/expense-config.js, server.cjs) keep their own smaller
// DEFAULT_CONFIG. That is deliberate and safe: they are only used when the
// SharePoint file is missing, and mergeExpenseConfig() below re-applies these
// richer defaults on the client for any key the server leaves out.

export const DEFAULT_EXPENSE_CONFIG = {
  formTitle: "Expense Report",
  formSubtitle: "Submit your expenses for reimbursement. You'll receive a link to track their status.",

  categories: ["Meal", "Gas", "Office Supplies", "Mileage"],
  expenseCompanies: ["Pro", "Pro Gym Services", "EVO"],
  approvers: ["Doug", "Frank", "Steph", "Nic"],

  mileageRate: 0.70,
  // Which category switches a line item into mileage mode (addresses + KM ×
  // rate instead of a typed amount). Stored by name rather than hardcoded so
  // renaming the category in settings doesn't silently kill the mileage UI.
  // Empty string disables mileage entirely.
  mileageCategory: "Mileage",
  // Whether a dollar figure is worked out from the distance at submission time.
  // Turn off when the rate varies: staff then submit the distance only, no
  // amount is shown to them or quoted anywhere, and the line arrives at $0.00
  // for accounting to price. Mileage rows awaiting a price are flagged in the
  // admin list so they can't be paid at zero by accident.
  mileageCalculatesAmount: true,
  // Which companies make the Event picker appear and required. Was hardcoded
  // to "EVO"; now a list so another company can require an event too.
  eventCompanies: ["EVO"],

  // Per-field control. `enabled` hides the field everywhere (form, validation
  // and payload) when false; `required` blocks submission when empty.
  fields: {
    name:          { enabled: true, required: true,  label: "Your Name",        placeholder: "Full name",       hint: "" },
    email:         { enabled: true, required: true,  label: "Email Address",    placeholder: "you@example.com", hint: "" },
    company:       { enabled: true, required: true,  label: "Company",          placeholder: "",                hint: "" },
    approvedBy:    { enabled: true, required: true,  label: "Approved By",      placeholder: "",                hint: "" },
    event:         { enabled: true, required: true,  label: "Event",            placeholder: "",                hint: "" },
    category:      { enabled: true, required: true,  label: "Category",         placeholder: "",                hint: "" },
    date:          { enabled: true, required: true,  label: "Date of Expense",  placeholder: "",                hint: "" },
    amount:        { enabled: true, required: true,  label: "Amount ($)",       placeholder: "0.00",            hint: "" },
    description:   { enabled: true, required: false, label: "Description",      placeholder: "Brief description of the expense", hint: "" },
    receipt:       { enabled: true, required: false, label: "Receipt Photo",    placeholder: "", hint: "Optional — attach a photo or PDF of your receipt" },
    startLocation: { enabled: true, required: true,  label: "Start Location",   placeholder: "Start typing a start address…", hint: "" },
    endLocation:   { enabled: true, required: true,  label: "End Location",     placeholder: "Start typing an end address…",  hint: "" },
    totalKMs:      { enabled: true, required: true,  label: "Total KMs",        placeholder: "0.0", hint: "" },
  },

  // Static wording outside of field labels.
  text: {
    submitterSection: "Your Information",
    lineItemLabel: "Expense",
    addItem: "+ Add Another Expense",
    totalLabel: "Report Total",
    submitButton: "Submit",
    successTitle: "Expenses Submitted",
    successBody: "Your expense report has been received. Bookmark the link below to check your reimbursement status.",
    copyLink: "Copy Status Link",
    submitAnother: "Submit Another Expense Report",
  },
};

// Field metadata for the settings editor. `locked: true` means the field cannot
// be hidden or made optional, because /api/submit-expense rejects the whole
// submission without it — hiding it from the settings screen would let an admin
// break every submission with one click and no error until someone tries to
// file an expense.
export const FIELD_DEFS = [
  { key: "name",          group: "submitter", locked: true,  placeholder: true  },
  { key: "email",         group: "submitter", locked: true,  placeholder: true  },
  { key: "company",       group: "submitter", locked: true,  placeholder: false },
  { key: "approvedBy",    group: "submitter", locked: false, placeholder: false },
  { key: "event",         group: "submitter", locked: false, placeholder: false, note: "Only appears for the companies marked \"needs event\" below." },
  { key: "category",      group: "lineItem",  locked: true,  placeholder: false },
  { key: "date",          group: "lineItem",  locked: true,  placeholder: false },
  { key: "amount",        group: "lineItem",  locked: true,  placeholder: true,  note: "Replaced by the calculated total on mileage expenses." },
  { key: "description",   group: "lineItem",  locked: false, placeholder: true  },
  { key: "receipt",       group: "lineItem",  locked: false, placeholder: false },
  { key: "startLocation", group: "mileage",   locked: false, placeholder: true,  note: "Turn off to have staff type the distance in by hand." },
  { key: "endLocation",   group: "mileage",   locked: false, placeholder: true  },
  { key: "totalKMs",      group: "mileage",   locked: true,  placeholder: true  },
];

export const FIELD_GROUPS = [
  { key: "submitter", title: "Your Information", blurb: "Collected once per report." },
  { key: "lineItem",  title: "Each Expense",     blurb: "Repeated for every expense on the report." },
  { key: "mileage",   title: "Mileage Expenses", blurb: "Only shown when the mileage category is picked." },
];

const LEGACY_LABEL_KEYS = [
  "name", "email", "amount", "date", "category", "company",
  "description", "receipt", "startLocation", "endLocation", "totalKMs",
];

// The flat `labels` object is still what an older cached copy of the form reads.
// Regenerating it on every save keeps such a client showing the right wording
// instead of reverting to the built-in defaults.
export function labelsFromFields(fields) {
  const labels = {};
  for (const key of LEGACY_LABEL_KEYS) {
    if (fields?.[key]?.label) labels[key] = fields[key].label;
  }
  return labels;
}

// Defaults carry the legacy flat labels too, so a client running older code
// against a freshly-saved config still has every key it expects.
DEFAULT_EXPENSE_CONFIG.labels = labelsFromFields(DEFAULT_EXPENSE_CONFIG.fields);

// Merge a saved config onto the defaults. Nested objects are merged key by key,
// not replaced, so a config saved before a field existed still picks up that
// field's defaults instead of dropping it.
export function mergeExpenseConfig(saved) {
  const d = DEFAULT_EXPENSE_CONFIG;
  const s = saved && typeof saved === "object" ? saved : {};

  // Older configs kept every label in a flat `labels` object. Seed the new
  // per-field labels from it so renames an admin made before this change survive.
  const legacy = s.labels || {};

  const fields = {};
  for (const key of Object.keys(d.fields)) {
    fields[key] = {
      ...d.fields[key],
      ...(legacy[key] ? { label: legacy[key] } : null),
      ...(s.fields?.[key] || null),
    };
  }

  return {
    ...d,
    ...s,
    fields,
    text: { ...d.text, ...(s.text || null) },
    labels: { ...d.labels, ...legacy },
  };
}

// A field is only live if it is switched on. Locked fields ignore the flag so a
// hand-edited config file can't disable something the backend requires.
export function isFieldOn(config, key) {
  const def = FIELD_DEFS.find((f) => f.key === key);
  if (def?.locked) return true;
  return config?.fields?.[key]?.enabled !== false;
}

export function isFieldRequired(config, key) {
  const def = FIELD_DEFS.find((f) => f.key === key);
  if (def?.locked) return true;
  if (!isFieldOn(config, key)) return false;
  return config?.fields?.[key]?.required === true;
}
