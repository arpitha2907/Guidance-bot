// safety.js
// DETERMINISTIC crisis-detection gate. This runs BEFORE any RAG retrieval or
// LLM call. It is intentionally NOT AI-based: we match against explicit
// keyword/phrase patterns so behaviour is predictable, auditable, and testable.
// A model's judgement could silently miss a crisis signal; a pattern list
// cannot drift.
//
// Flow: every incoming message is screened. If a pattern matches, we return a
// crisis response with the right resources and the normal flow is halted by
// the caller (server.js). We never resume questioning after a trigger.
//
// Scope note on "legal": pure legal questions (contracts, tenancy) are NOT
// crises and are out of MVP scope. What we DO catch under this banner are
// legal situations that are really SAFETY emergencies -- threats, abuse,
// domestic violence -- which route to emergency services + abuse support.

// --- Verified resources (India) ---
// Vandrevala Foundation 24/7 mental health helpline: +91 9999 666 555
// Tele-MANAS (Govt of India 24/7 mental health): 14416
// National emergency number: 112
const RESOURCES = {
  emergency: { label: "Emergency Services (India)", contact: "112" },
  vandrevala: {
    label: "Vandrevala Foundation (24/7 mental health)",
    contact: "+91 9999 666 555",
  },
  telemanas: {
    label: "Tele-MANAS (Govt of India, 24/7 mental health)",
    contact: "14416",
  },
};

// Each category: a set of lowercase patterns and the response to show.
// Patterns are matched as substrings against the normalised message.
// Order matters: we check the most acute categories first.
//
// This is a safety NET, not a guarantee (see docs/Technical_Summary.md
// section 9). Pattern lists were expanded from the MVP baseline to cover
// more real-world phrasing per category; a model-based second check remains
// a documented future-work item rather than something implemented here, to
// keep this gate deterministic and auditable.
const CATEGORIES = [
  {
    type: "self_harm",
    patterns: [
      "kill myself", "killing myself", "end my life", "ending my life",
      "want to die", "wanna die", "suicide", "suicidal", "self harm",
      "self-harm", "hurt myself", "harming myself", "no reason to live",
      "better off dead", "take my own life", "cut myself", "overdose",
      "don't want to be alive", "dont want to be alive", "not worth living",
      "can't go on", "cant go on", "want to disappear forever",
      "planning to end it", "thinking about suicide", "self harming",
      "cutting myself", "hurting myself on purpose", "no point in living",
      "ready to die", "tired of living", "want it to be over",
      "self injury", "self-injury", "ending it all", "can't take this anymore",
      "cant take this anymore", "life isn't worth living",
    ],
    message:
      "It sounds like you may be going through something extremely painful, and I'm concerned for your safety. I'm not able to help with this myself, but please reach out right now to people who can:",
    resources: ["emergency", "vandrevala", "telemanas"],
  },
  {
    type: "abuse_violence",
    patterns: [
      "being abused", "abusing me", "domestic violence", "hits me", "hitting me",
      "beats me", "beating me", "being beaten", "someone is threatening",
      "threatening to kill", "threatening me", "going to hurt me", "hurts me",
      "afraid for my life", "afraid of him", "afraid of her", "being assaulted",
      "sexual assault", "raped", "being stalked", "trafficking",
      "held against my will", "won't let me leave", "locked me",
      "husband hits me", "wife hits me", "partner hits me", "being controlled by",
      "won't let me out", "wont let me out", "forced me to", "forced marriage",
      "scared he will hurt me", "scared she will hurt me", "being harassed",
      "child abuse", "being groomed", "human trafficking", "coercive control",
      "isolated me from", "monitors everything i do", "took my phone away",
      "won't let me see my family", "wont let me see my family",
    ],
    message:
      "What you're describing sounds dangerous, and your safety matters most. If you are in immediate danger, please contact emergency services. Support is also available:",
    resources: ["emergency", "vandrevala"],
  },
  {
    type: "medical_emergency",
    patterns: [
      "chest pain", "can't breathe", "cannot breathe", "difficulty breathing",
      "struggling to breathe", "severe bleeding", "bleeding heavily",
      "unconscious", "passed out", "not breathing", "stroke", "heart attack",
      "seizure", "choking", "severe allergic", "anaphylaxis", "poisoned",
      "overdosed", "slurred speech", "face drooping", "sudden numbness",
      "sudden weakness on one side", "can't feel my", "cant feel my",
      "severe abdominal pain", "convulsions", "anaphylactic",
      "severe burn", "compound fracture", "coughing blood", "vomiting blood",
      "unresponsive", "not waking up", "turning blue", "cant feel my legs",
      "can't feel my legs",
    ],
    message:
      "This may be a medical emergency. Please contact emergency services or go to the nearest hospital right away. Do not wait for online guidance:",
    resources: ["emergency"],
  },
];

// Normalise for matching: lowercase, collapse whitespace.
function normalise(text) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

// Returns null if no crisis detected, otherwise a crisis response object.
export function screenForCrisis(message) {
  if (!message || typeof message !== "string") return null;
  const text = normalise(message);

  for (const category of CATEGORIES) {
    const hit = category.patterns.find((p) => text.includes(p));
    if (hit) {
      return {
        crisis: true,
        type: category.type,
        message: category.message,
        resources: category.resources.map((key) => RESOURCES[key]),
      };
    }
  }
  return null;
}

// Exported for testing / documentation.
export const SAFETY_CATEGORIES = CATEGORIES.map((c) => c.type);
