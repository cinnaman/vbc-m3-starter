export const LOCATIONS = ["Minneapolis", "Chicago", "Denver", "Austin"];
export const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
export const STATUSES = ["New", "In Progress", "Complete"];
export const MAX_DESCRIPTION_LENGTH = 500;

const FIELD_LABELS = {
  requester_name: "Requester name",
  location: "Location",
  description: "Description",
  priority: "Priority",
};

// Joins a list as "A, B, C, or D" for readable error messages.
function listOptions(options) {
  return options.slice(0, -1).join(", ") + ", or " + options[options.length - 1];
}

// Validates a new-request body on the server.
// Returns { error } with a plain-English message naming the field,
// or { value } holding the trimmed, cleaned fields ready to save.
export function validateNewRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "The request must include requester name, location, description, and priority." };
  }

  const value = {};

  // 1. Every field is required, must be text, and can't be blank after trimming.
  for (const [field, label] of Object.entries(FIELD_LABELS)) {
    const raw = body[field];

    if (raw === undefined || raw === null) {
      return { error: `${label} is required.` };
    }
    if (typeof raw !== "string") {
      return { error: `${label} must be text.` };
    }

    const trimmed = raw.trim();
    if (trimmed === "") {
      return { error: `${label} is required.` };
    }
    value[field] = trimmed;
  }

  // 2. Location and priority must match the allowed values exactly.
  if (!LOCATIONS.includes(value.location)) {
    return { error: `Location must be ${listOptions(LOCATIONS)}.` };
  }
  if (!PRIORITIES.includes(value.priority)) {
    return { error: `Priority must be ${listOptions(PRIORITIES)}.` };
  }

  // 3. Description length is measured after trimming surrounding whitespace.
  if (value.description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer (it is currently ${value.description.length}).`,
    };
  }

  return { value };
}
