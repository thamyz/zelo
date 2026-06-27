// ================================================================
// data.js — All mock data for ChatPractice
// Characters, difficulty configs, reply pools, opening messages
// ================================================================


// ================================================================
// CHARACTER POOL
// 10 realistic fictional profiles. A random one is picked each
// time the user starts a new session.
// ================================================================

const CHARACTERS = [
  {
    name: "Zoe Carter",
    age: 24,
    occupation: "UX Designer",
    interests: ["Rock climbing", "Specialty coffee", "Reality TV", "Thrifting"],
    bio: "Addicted to good coffee and bad TV. On a mission to visit every rooftop bar in the city. Will talk your ear off about design — you've been warned.",
    initial: "Z",
    color: "#6366f1"
  },
  {
    name: "Natalie Kim",
    age: 26,
    occupation: "Registered Nurse",
    interests: ["Cooking", "Running", "K-dramas", "Yoga"],
    bio: "ER nurse by day, amateur chef by night. Looking for someone who can keep up with my chaotic schedule and still make me laugh.",
    initial: "N",
    color: "#ec4899"
  },
  {
    name: "Lily Torres",
    age: 25,
    occupation: "Content Creator",
    interests: ["Film photography", "Books", "Hiking", "Art galleries"],
    bio: "Moved here two years ago and still finding my favorite spots. Big fan of slow mornings, film photography, and people who actually read.",
    initial: "L",
    color: "#a855f7"
  },
  {
    name: "Grace Bennett",
    age: 28,
    occupation: "Marketing Director",
    interests: ["Cycling", "Wine", "Travel", "Podcasts"],
    bio: "I've somehow convinced brands to pay me to be online all day. In real life I'm more outdoorsy and introverted than my job suggests.",
    initial: "G",
    color: "#0ea5e9"
  },
  {
    name: "Maya Patel",
    age: 27,
    occupation: "Startup Founder",
    interests: ["Entrepreneurship", "Yoga", "Matcha", "Rock climbing"],
    bio: "Building something from scratch is the hardest and best thing I've ever done. Off-duty I'm a yoga person obsessive about good matcha.",
    initial: "M",
    color: "#f59e0b"
  },
  {
    name: "Chloe Anderson",
    age: 23,
    occupation: "Psychology PhD Student",
    interests: ["Live music", "Board games", "Running", "Documentaries"],
    bio: "PhD student who will absolutely analyze your attachment style — don't say I didn't warn you. Love anything live: music, sports, comedy.",
    initial: "C",
    color: "#10b981"
  },
  {
    name: "Rachel Monroe",
    age: 29,
    occupation: "Architect",
    interests: ["Travel", "Cooking", "Reading", "Interior design"],
    bio: "I spend my days designing spaces people live in, then come home to my chaotic apartment and a half-read novel. Classic.",
    initial: "R",
    color: "#ef4444"
  },
  {
    name: "Ava Collins",
    age: 25,
    occupation: "Physical Therapist",
    interests: ["Hiking", "Fitness", "Nutrition", "Podcasts"],
    bio: "I help people move better for a living. Outside work I'm either on a trail, in a gym, or aggressively napping. Sometimes all three.",
    initial: "A",
    color: "#f97316"
  },
  {
    name: "Priya Sharma",
    age: 26,
    occupation: "Journalist",
    interests: ["Writing", "Boxing", "Coffee", "Politics"],
    bio: "I write about things that matter. Ask me about the last great article I read and I'll talk for an hour. Short-form content is a crime.",
    initial: "P",
    color: "#14b8a6"
  },
  {
    name: "Sara Mitchell",
    age: 27,
    occupation: "Art Director",
    interests: ["Art", "Indie music", "Vintage clothing", "Photography"],
    bio: "Former art student, current overthinker. I believe in good design, slow mornings, and never going to a bar without a good playlist.",
    initial: "S",
    color: "#8b5cf6"
  }
];


// ================================================================
// DIFFICULTY CONFIG
// Controls behavior, labels, traits, colors, and reply timing.
// ================================================================

const DIFFICULTY_CONFIG = {
  easy: {
    label:       "Easy",
    badge:       "Beginner",
    color:       "#22c55e",
    description: "Interested and engaged. She helps carry the conversation.",
    traits:      ["Responsive", "Asks questions", "Enthusiastic"],
    // How long before status changes from Delivered → Seen
    // and how long the typing indicator shows (ms)
    training: { seenDelay: 800,  typingMin: 900,  typingMax: 1600 },
    realistic: { seenMin: 3000,  seenMax: 10000,  typingMin: 8000,  typingMax: 20000 }
  },
  medium: {
    label:       "Medium",
    badge:       "Intermediate",
    color:       "#f59e0b",
    description: "Neutral. Some effort required to keep things going.",
    traits:      ["Selective", "Moderate interest", "Mixed effort"],
    training: { seenDelay: 800,  typingMin: 900,  typingMax: 1600 },
    realistic: { seenMin: 8000,  seenMax: 20000,  typingMin: 12000, typingMax: 30000 }
  },
  hard: {
    label:       "Hard",
    badge:       "Advanced",
    color:       "#f97316",
    description: "Reserved. Short replies. Requires stronger conversation skills.",
    traits:      ["Brief replies", "Low effort", "Hard to read"],
    training: { seenDelay: 800,  typingMin: 900,  typingMax: 1600 },
    realistic: { seenMin: 15000, seenMax: 35000,  typingMin: 15000, typingMax: 40000 }
  },
  expert: {
    label:       "Expert",
    badge:       "Pro",
    color:       "#ef4444",
    description: "Busy, distracted, easily loses interest. Very hard to engage.",
    traits:      ["Minimal replies", "Distracted", "Very selective"],
    training: { seenDelay: 800,  typingMin: 900,  typingMax: 1600 },
    realistic: { seenMin: 20000, seenMax: 50000,  typingMin: 20000, typingMax: 55000 }
  }
};


// ================================================================
// OPENING MESSAGES
// First message the character sends, per difficulty level.
// ================================================================

const OPENINGS = {
  easy:    "Hey! I was hoping you'd message first 😊 how's your day going?",
  medium:  "Hey! What's up?",
  hard:    "hey",
  expert:  "oh hey"
};


// ================================================================
// REPLY POOLS
// Pre-written replies per difficulty. The app cycles through them
// in order to avoid immediate repeats. Designed to feel like real
// text messages, not chatbot responses.
// ================================================================

const REPLIES = {

  // Easy: Enthusiastic, engaged, keeps conversation moving, asks questions
  easy: [
    "haha okay that actually made me laugh 😂",
    "wait no way, you have to tell me more about that",
    "omg how did that even happen??",
    "okay I literally do the exact same thing",
    "haha stop I'm crying 😭 that's hilarious",
    "okay you're actually pretty funny",
    "wait really?? how long have you been doing that?",
    "okay that's kind of impressive ngl",
    "I love that! have you always been into it?",
    "no way, I was literally just thinking about that the other day",
    "okay we might actually have the same taste in things lol",
    "this conversation is going better than expected tbh",
    "that's lowkey the best thing I've heard all week",
    "yes!! okay I need to know everything",
    "wait okay that's actually a really interesting take",
    "I feel like we could talk about this forever",
    "haha you're too much 😂",
    "okay next question and it's a good one —",
    "I can already tell you're one of those people who's interesting to talk to",
    "okay that earned you a follow-up question"
  ],

  // Medium: Neutral to positive, responds but doesn't go overboard
  medium: [
    "haha yeah that's pretty funny",
    "oh nice, how'd that go?",
    "lol okay I can see that",
    "that's actually kind of interesting",
    "never really thought about it that way",
    "haha fair enough",
    "yeah I get what you mean",
    "oh interesting, tell me more",
    "lol yeah same honestly",
    "okay that's not what I expected you to say",
    "I mean I can see it",
    "haha okay that's a decent answer",
    "kind of funny yeah",
    "I've heard worse lol",
    "lol maybe",
    "not bad",
    "okay yeah I can get behind that",
    "feel like I'd need more context lol",
    "hm yeah that makes sense",
    "lol okay sure I'll give you that"
  ],

  // Hard: Short replies, reserved, rarely asks questions back
  hard: [
    "haha",
    "lol",
    "that's funny",
    "oh nice",
    "yeah",
    "kinda",
    "idk lol",
    "sure",
    "maybe",
    "I guess",
    "honestly yeah",
    "lol not really",
    "mm",
    "that's a lot",
    "okay",
    "fair",
    "makes sense",
    "right",
    "not really tbh",
    "lol okay"
  ],

  // Expert: Terse, distracted, disengaged, one-word or near one-word replies
  expert: [
    "lol",
    "ya",
    "kinda",
    "idk tbh",
    "not really",
    "sure lol",
    "oh weird",
    "haha",
    "wait what",
    "k lol",
    "mhm",
    "lmao",
    "nah",
    "rly?",
    "ok",
    "hmm",
    "I mean",
    "busy but",
    "lowkey same",
    "I guess"
  ]

};


// ================================================================
// PROFILES — alias to GIRL_PROFILES (personas.js loads first)
// ================================================================

const PROFILES = GIRL_PROFILES;

// ================================================================
// ASSISTANT REPLY SETS
// Each set has one reply per style: safe, funny, flirty, confident.
// A random set is picked each time the user hits Generate.
// Future: replace with Claude API call using actual input text.
// ================================================================

const ASSISTANT_REPLIES = [
  {
    smooth:     "Haha that's actually pretty true. What made you think of that?",
    funny:      "Okay I was NOT ready for that 😂 you can't just say things like that",
    flirty:     "See now you've got my full attention 😏 what else you got?",
    confident:  "That's one way to put it. I can work with that."
  },
  {
    smooth:     "Yeah I totally get that. How long have you felt that way?",
    funny:      "Lmaooo okay you are NOT wrong about that 💀 carry on",
    flirty:     "You keep saying things like that and this is gonna get interesting 😌",
    confident:  "Interesting. I respect that take."
  },
  {
    smooth:     "Ha, fair point honestly. I'd probably do the same thing.",
    funny:      "Wait okay that got me 😂 you're funnier than I expected",
    flirty:     "Okay okay I see you 👀 don't stop there",
    confident:  "That's actually a solid answer. Not many people say that."
  },
  {
    smooth:     "Haha yeah I was thinking the same thing. What do you usually do?",
    funny:      "The fact that you just said that out loud 💀😂 no but actually...",
    flirty:     "Careful with lines like that — I might actually like you 😏",
    confident:  "Bold. I can work with bold."
  },
  {
    smooth:     "That's a good point, I hadn't thought about it that way before.",
    funny:      "Okay but WHY is that so relatable though 😭 same honestly",
    flirty:     "You're making it very hard to play it cool right now 😌",
    confident:  "Real answer. I appreciate that more than you know."
  }
];


// ================================================================
// NEW FEATURE-DECISION CONSTANTS
// ================================================================

// Onboarding: pre-filled example so first-time users see Generate
// already active without typing anything themselves.
const EXAMPLE_SCAN_MESSAGE = "haha yeah I guess, idk what do you wanna do";

// Placeholder names for the two chat reply-timing modes (internal keys
// stay "training"/"realistic" — only the user-facing short label is
// unresolved). Hardcoded here so renaming later is a one-line change.
const CHAT_TIMING_LABELS = {
  training:  "Now",
  realistic: "Real"
};

// Reply-mode pills shown on the swipe card, before a match happens.
// `free: false` = paid-only outside the trial window.
const CARD_MODES = [
  { key: "open",    label: "Open",    desc: "Open — easy to talk to, warm",        free: true  },
  { key: "neutral", label: "Neutral", desc: "Neutral — realistic, balanced",       free: true  },
  { key: "cold",    label: "Cold",    desc: "Cold — takes real effort to open up", free: false }
];
const CARD_MODE_DEFAULT = "neutral";

// Free vs paid limits.
const FREE_LIMITS = {
  scansPerDay:     10,  // shared daily cap: Scan + AI feedback together
  bonusScansPerAd: 3,
  maxAdsPerDay:    1,
  historyDays:     7,
  freeTones:       ["smooth", "funny"],
  maxMatches:      3,
  trialDays:       7
};


// ================================================================
// MOCK CHATS
// Pre-existing conversations shown in the Chats tab.
// ================================================================

const MOCK_CHATS = [
  {
    id: "mock_1",
    profile: PROFILES[0],
    difficulty: "easy",
    mode: "training",
    messages: [
      { sender: "ai",   text: "Hey! I was hoping you'd message first \u{1F60A} how's your day going?" },
      { sender: "user", text: "Hey! Pretty good day so far. How about yours?" },
      { sender: "ai",   text: "haha okay that actually made me laugh \u{1F602}" }
    ],
    lastMessage: "haha okay that actually made me laugh \u{1F602}",
    lastActive: "2m ago",
    unread: 1
  },
  {
    id: "mock_2",
    profile: PROFILES[3],
    difficulty: "medium",
    mode: "training",
    messages: [
      { sender: "ai",   text: "Hey! What's up?" },
      { sender: "user", text: "Not much, just saw your profile. You cycle?" },
      { sender: "ai",   text: "oh nice, how'd that go?" },
      { sender: "user", text: "Great actually, did 30 miles this weekend" },
      { sender: "ai",   text: "that's actually kind of interesting" }
    ],
    lastMessage: "that's actually kind of interesting",
    lastActive: "1h ago",
    unread: 0
  },
  {
    id: "mock_3",
    profile: PROFILES[5],
    difficulty: "medium",
    mode: "training",
    messages: [
      { sender: "ai",   text: "Hey! What's up?" },
      { sender: "user", text: "Hey! Your bio cracked me up. Do you actually analyze people?" }
    ],
    lastMessage: "Your bio cracked me up...",
    lastActive: "3h ago",
    unread: 0
  }
];

// Feature 9 — Leaderboard mock data (100 entries per category/filter)
const _mkEntries = (scores) => scores.map((s, i) => ({ rank: i + 1, name: s[0], score: s[1] }));

// 90 extra names for ranks 11-100 (shared across all datasets)
const _LB_EXTRA = [
  "Owen K.","Lucas T.","Ryan B.","Caleb M.","Hunter S.","Dylan W.","Carter L.","Brayden H.","Austin J.","Chase P.",
  "Blake N.","Gavin R.","Adrian C.","Eli T.","Connor M.","Easton B.","Nolan W.","Bryce S.","Zachary L.","Colton K.",
  "Wyatt H.","Dominic R.","Hudson C.","Parker M.","Xavier B.","Landon W.","Jordan S.","Cameron L.","Tristan S.","Nathan H.",
  "Isaiah R.","Brandon C.","Jaxon M.","Elijah B.","Marcus W.","Derek L.","Spencer K.","Brendan H.","Miles R.","Ian C.",
  "Patrick M.","Vincent B.","Julian W.","Marco S.","Derrick L.","Travis K.","Shane H.","Kyle R.","Curtis C.","Warren M.",
  "Damon B.","Felix W.","Santos S.","Emilio L.","Cyrus K.","Lance H.","Nate R.","Drew C.","Quinn M.","Rex B.",
  "Abel W.","Finn S.","Gage L.","Heath K.","Ivan H.","Jay R.","Kade C.","Levi M.","Max B.","Nash W.",
  "Omar S.","Pace L.","Rio K.","Slade H.","Tanner R.","Vance M.","Wade B.","Xander W.","Yuri S.","Zack L.",
  "Ace K.","Blaine H.","Cruz R.","Dane C.","Earl M.","Ford B.","Grey W.","Holt S.","Ike R.","Joel C."
];

// Extends a top-10 _mkEntries array to 100 using a score generator (i = 0..89 → ranks 11-100)
function _ext100(top10arr, scoreFn) {
  const out = [...top10arr];
  for (let i = 0; i < 90; i++) out.push({ rank: 11 + i, name: _LB_EXTRA[i], score: scoreFn(i) });
  return out;
}

const LEADERBOARD_DATA = {
  streak: {
    weekly:  _ext100(_mkEntries([["Tyler M.", 12], ["Kai V.", 9], ["Jared S.", 8], ["Noah B.", 7], ["Ethan R.", 6], ["Liam P.", 5], ["Aiden C.", 4], ["Mason D.", 4], ["Logan F.", 3], ["Jackson H.", 2]]),
      i => i < 14 ? 1 : 0),
    monthly: _ext100(_mkEntries([["Kai V.", 31], ["Tyler M.", 28], ["Aiden C.", 24], ["Noah B.", 20], ["Liam P.", 18], ["Jared S.", 16], ["Ethan R.", 14], ["Mason D.", 12], ["Logan F.", 10], ["Jackson H.", 8]]),
      i => Math.max(0, Math.round(7 * Math.pow(0.91, i)))),
    alltime: _ext100(_mkEntries([["Aiden C.", 214], ["Kai V.", 198], ["Tyler M.", 177], ["Jared S.", 143], ["Ethan R.", 121], ["Noah B.", 110], ["Liam P.", 98], ["Mason D.", 87], ["Logan F.", 72], ["Jackson H.", 61]]),
      i => Math.max(1, Math.round(52 * Math.pow(0.95, i))))
  },
  messages: {
    weekly:  _ext100(_mkEntries([["Mason D.", 340], ["Liam P.", 290], ["Tyler M.", 260], ["Kai V.", 241], ["Ethan R.", 210], ["Aiden C.", 185], ["Jared S.", 160], ["Noah B.", 140], ["Logan F.", 110], ["Jackson H.", 80]]),
      i => Math.max(5, Math.round(72 * Math.pow(0.973, i)))),
    monthly: _ext100(_mkEntries([["Liam P.", 1240], ["Mason D.", 1100], ["Tyler M.", 980], ["Kai V.", 850], ["Ethan R.", 720], ["Jared S.", 600], ["Aiden C.", 540], ["Noah B.", 480], ["Logan F.", 390], ["Jackson H.", 300]]),
      i => Math.max(10, Math.round(265 * Math.pow(0.973, i)))),
    alltime: _ext100(_mkEntries([["Liam P.", 9800], ["Tyler M.", 8400], ["Mason D.", 7200], ["Kai V.", 6400], ["Ethan R.", 5100], ["Jared S.", 4400], ["Noah B.", 3700], ["Aiden C.", 3100], ["Logan F.", 2500], ["Jackson H.", 1900]]),
      i => Math.max(100, Math.round(1650 * Math.pow(0.973, i))))
  },
  cold: {
    weekly:  _ext100(_mkEntries([["Jared S.", 5], ["Ethan R.", 4], ["Noah B.", 3], ["Logan F.", 3], ["Tyler M.", 2], ["Kai V.", 2], ["Liam P.", 1], ["Mason D.", 1], ["Aiden C.", 1], ["Jackson H.", 0]]),
      _i => 0),
    monthly: _ext100(_mkEntries([["Noah B.", 18], ["Jared S.", 15], ["Ethan R.", 13], ["Logan F.", 11], ["Tyler M.", 9], ["Kai V.", 8], ["Aiden C.", 7], ["Liam P.", 6], ["Mason D.", 5], ["Jackson H.", 3]]),
      i => i < 8 ? 2 : i < 22 ? 1 : 0),
    alltime: _ext100(_mkEntries([["Ethan R.", 74], ["Noah B.", 68], ["Jared S.", 61], ["Tyler M.", 55], ["Logan F.", 48], ["Kai V.", 42], ["Liam P.", 37], ["Mason D.", 31], ["Aiden C.", 28], ["Jackson H.", 20]]),
      i => Math.max(1, Math.round(17 * Math.pow(0.94, i))))
  }
};
