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

// Women + men. PROFILES deliberately stays women-only: the onboarding swipe
// demo and the practice tutorial walk it by index and must not deal a man to
// someone who never asked for one. The deck is the only thing that should see
// the whole library, and it filters by the "practice with" preference itself.
const ALL_PROFILES = GIRL_PROFILES.concat(typeof MAN_PROFILES !== 'undefined' ? MAN_PROFILES : []);

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

// Placeholder names for the two chat reply-timing modes (internal keys
// stay "training"/"realistic" — only the user-facing short label is
// unresolved). Hardcoded here so renaming later is a one-line change.
const CHAT_TIMING_LABELS = {
  training:  "Now",
  realistic: "Real"
};

// Reply-mode pills shown on the swipe card, before a match happens.
// The "Cold" mode was removed 2026-10-22: it was the only paid-only entry
// (`free: false`) and its gate, isColdAvailable(), was reachable only from
// code that was already dead, so it never actually locked anything.
// NOTE: nothing reads CARD_MODES itself — only CARD_MODE_DEFAULT below is
// used (at the chat creation site). The pills are not rendered anywhere yet.
const CARD_MODES = [
  { key: "open",    label: "Open",    desc: "Open — easy to talk to, warm",  free: true },
  { key: "neutral", label: "Neutral", desc: "Neutral — realistic, balanced", free: true }
];
const CARD_MODE_DEFAULT = "neutral";

// Free vs paid limits.
const FREE_LIMITS = {
  scansPerDay:     10,  // shared daily cap: Scan + AI feedback together
  historyDays:     7,
  maxMatches:      3,
  trialDays:       3
};

// ================================================================
// REPLY STYLES — eligibility depends only on Situation + Goal (the "Who"
// answer shapes tone/voice in the prompt, never which styles are shown).
// Each list is in priority order — first entry is the initial
// auto-generated card. getEligibleStyles() (script.js) is the only thing
// that should read this table; it also enforces the hard safety rule
// (no Funny/Bolder for Argument/Toxic Relationship) in code, not just here.
// ================================================================

const STYLE_LABELS = {
  smooth: "Smooth",
  direct: "Direct",
  shorter: "Shorter",
  funny: "Funny",
  warmer: "Warmer",
  bolder: "Bold",
  longer: "Longer",
  // Demo-only style (DEMO_SCAN_STYLES in script.js) — not in STYLE_ELIGIBILITY,
  // so it never appears from a real scan, only the scripted screen-recording one.
  playful: "Playful"
};

// Per-style color theme for the reply carousel — soft background tint +
// a fuller-saturation accent for the label/icon. Kept as a single small
// palette here so every card treatment (center + peeks) reads from the
// same source.
// accent/bg sampled directly from the reference icon-palette image
// (assets/icons/_source/icon-palette.png) so the card border/gradient/badge
// theming matches the real per-style icons. WARMER was corrected from amber
// (#f5a524) to the rose/pink its heart icon actually is (#f36fa6).
const STYLE_COLORS = {
  smooth:  { bg: "#fdf3f6", accent: "#f470a7" },
  funny:   { bg: "#f9f6fd", accent: "#885cea" },
  bolder:  { bg: "#fef7f3", accent: "#fe8e36" },
  direct:  { bg: "#f4f7fd", accent: "#4488f6" },
  warmer:  { bg: "#fcf2f6", accent: "#f36fa6" },
  shorter: { bg: "#f4f9f5", accent: "#48cba2" },
  longer:  { bg: "#f4f2fc", accent: "#936cec" },
  playful: { bg: "#fefaf0", accent: "#f5b400" }
};

const STYLE_ELIGIBILITY = {
  "First Conversation": {
    "Get a Reply":       ["smooth", "direct", "shorter"],
    "Keep Things Going": ["smooth", "funny", "warmer"],
    "Ask Them Out":      ["smooth", "bolder", "direct"],
    "Fix Things":        ["direct", "shorter"],
    "Be Funny":          ["funny", "smooth"],
    "Be Direct":         ["direct", "shorter"]
  },
  "Getting to Know Each Other": {
    "Get a Reply":       ["smooth", "warmer", "shorter"],
    "Keep Things Going": ["warmer", "funny", "smooth"],
    "Ask Them Out":      ["bolder", "smooth", "direct"],
    "Fix Things":        ["direct", "shorter"],
    "Be Funny":          ["funny", "warmer"],
    "Be Direct":         ["direct", "smooth"]
  },
  "Planning Something": {
    "Get a Reply":       ["direct", "shorter", "smooth"],
    "Keep Things Going": ["warmer", "direct", "longer"],
    "Ask Them Out":      ["bolder", "direct", "smooth"],
    "Fix Things":        ["direct", "shorter"],
    "Be Funny":          ["funny", "direct"],
    "Be Direct":         ["direct", "shorter"]
  },
  "Flirting": {
    "Get a Reply":       ["smooth", "warmer", "shorter"],
    "Keep Things Going": ["smooth", "funny", "bolder"],
    "Ask Them Out":      ["bolder", "smooth", "direct"],
    "Fix Things":        ["direct", "shorter"],
    "Be Funny":          ["funny", "smooth"],
    "Be Direct":         ["direct", "bolder"]
  },
  "Awkward Silence": {
    "Get a Reply":       ["funny", "smooth", "shorter"],
    "Keep Things Going": ["funny", "smooth", "warmer"],
    "Ask Them Out":      ["bolder", "direct", "smooth"],
    "Fix Things":        ["warmer", "direct"],
    "Be Funny":          ["funny", "smooth"],
    "Be Direct":         ["direct", "shorter"]
  },
  "Argument": {
    "Get a Reply":       ["direct", "shorter"],
    "Keep Things Going": ["warmer", "direct"],
    "Ask Them Out":      ["warmer", "direct"],
    "Fix Things":        ["warmer", "direct", "shorter", "longer"],
    "Be Funny":          [],   // not offered — see hard safety rule in getEligibleStyles()
    "Be Direct":         ["direct", "shorter"],
    "Set a Boundary":    ["direct", "warmer", "shorter"]
  },
  "Toxic Relationship": {
    "Get a Reply":       ["direct", "shorter"],
    "Keep Things Going": ["warmer", "direct"],
    "Ask Them Out":      ["warmer", "direct"],
    "Fix Things":        ["warmer", "direct", "longer"],
    "Be Funny":          [],   // not offered — see hard safety rule in getEligibleStyles()
    "Be Direct":         ["direct", "shorter"],
    "Set a Boundary":    ["direct", "shorter", "warmer"],
    "Let Them Down Easy": ["warmer", "direct", "shorter"]
  },
  "Dry Replies": {
    "Keep Things Going":  ["funny", "warmer", "smooth"],
    "Get a Reply":        ["smooth", "funny", "shorter"],
    "Be Funny":           ["funny", "smooth"],
    "Be Direct":          ["direct", "shorter"],
    "Let Them Down Easy": ["warmer", "direct", "shorter"]
  },
  "Gone Quiet": {
    "Get a Reply":        ["funny", "smooth", "shorter"],
    "Be Funny":           ["funny", "smooth"],
    "Be Direct":          ["direct", "shorter", "warmer"]
  },
  "After a Date": {
    "Keep Things Going":  ["warmer", "smooth", "funny"],
    "Ask Them Out":       ["smooth", "bolder", "direct"],
    "Be Direct":          ["direct", "warmer"],
    "Be Funny":           ["funny", "warmer"],
    "Let Them Down Easy": ["warmer", "direct", "shorter"]
  },
  "Mixed Signals": {
    "Define Things":      ["direct", "warmer", "shorter"],
    "Be Direct":          ["direct", "shorter"],
    "Get a Reply":        ["direct", "smooth", "shorter"],
    "Keep Things Going":  ["smooth", "warmer", "funny"]
  },
  "I Messed Up": {
    "Fix Things":         ["warmer", "direct", "longer", "shorter"],
    "Get a Reply":        ["warmer", "direct", "shorter"],
    "Be Direct":          ["direct", "warmer"]
  }
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

// Leaderboard data. Empty until there is a real ranking source (each entry: { rank, name, score }). The screens
// show an honest empty state instead of made-up people.
const LEADERBOARD_DATA = {
  streak:   { weekly: [], monthly: [], alltime: [] },
  messages: { weekly: [], monthly: [], alltime: [] },
  level:    { weekly: [], monthly: [], alltime: [] },
};


// ================================================================
// MILESTONES  (Achievement badge system)
// 10 categories x 5 badges = 50 achievement badges. Separate from the
// Streak page's own 12-milestone streak progression (Your Journey /
// script.js) — that system is NOT counted here, per spec.
//
// All progress is seeded at 0 for now — visual system + data
// architecture first, real per-category metric wiring comes later
// (see MILESTONE_BADGES comment below). isBadgeUnlocked()/
// getCategoryUnlockedCount()/getTotalUnlockedCount() (script.js) are
// what the UI actually reads, so plugging in real numbers later never
// requires touching the screens themselves.
// ================================================================

const MILESTONE_CATEGORIES = [
  {
    id: 'streak', name: 'Streak', icon: 'flame',
    accent: '#ec4899', bgTint: '#fdf2f8',
    description: 'Keep your streak alive. Every day counts!',
  },
  {
    id: 'conversation', name: 'Conversation', icon: 'chat',
    accent: '#8b5cf6', bgTint: '#f5f3ff',
    description: 'Every convo counts. Build deeper connections!',
  },
  {
    id: 'progress', name: 'Progress', icon: 'trending-up',
    accent: '#22c55e', bgTint: '#f0fdf4',
    description: 'Level up your rizz. See the results.',
  },
  {
    id: 'explorer', name: 'Explorer', icon: 'compass',
    accent: '#06b6d4', bgTint: '#ecfeff',
    description: 'Explore more. Discover everything.',
  },
  {
    id: 'comeback', name: 'Comeback', icon: 'refresh',
    accent: '#ec4899', bgTint: '#fdf2f8',
    description: 'Every setback is a setup for a comeback.',
  },
  {
    id: 'social', name: 'Social', icon: 'people',
    accent: '#8b5cf6', bgTint: '#f5f3ff',
    description: 'Refer friends. Grow your circle.',
  },
  {
    id: 'special', name: 'Special', icon: 'crown',
    accent: '#f59e0b', bgTint: '#fffbeb',
    description: 'Exclusive milestones for dedicated users.',
  },
  {
    id: 'texting', name: 'Texting', icon: 'chat-dots',
    accent: '#ec4899', bgTint: '#fdf2f8',
    description: 'Master the chat. Keep the vibe alive.',
  }
];

// Every badge starts progress:0 — real metrics (streak length, scan
// count, message count, etc.) get wired in category-by-category later.
// `binary:true` badges (checklist/rank-threshold requirements with no
// natural running number) skip the numeric progress bar and just show
// locked/unlocked off `progress >= target`.
const MILESTONE_BADGES = [
  // ---- Streak ---- (thresholds match the 1/7/14/30/100 art on the badges)
  { id: 'first-spark',  category: 'streak', name: 'First Spark',  description: 'Keep a streak for 1 day',    requirement: '1 day',    target: 1,   progress: 0, icon: 'streak-1' },
  { id: 'on-fire',      category: 'streak', name: 'On Fire',      description: 'Keep a streak for 7 days',   requirement: '7 days',   target: 7,   progress: 0, icon: 'streak-2' },
  { id: 'week-warrior', category: 'streak', name: 'Week Warrior', description: 'Keep a streak for 14 days',  requirement: '14 days',  target: 14,  progress: 0, icon: 'streak-3' },
  { id: 'hot-streak',   category: 'streak', name: 'Hot Streak',   description: 'Keep a streak for 30 days',  requirement: '30 days',  target: 30,  progress: 0, icon: 'streak-4' },
  { id: 'century',      category: 'streak', name: 'Century',      description: 'Keep a streak for 100 days', requirement: '100 days', target: 100, progress: 0, icon: 'streak-5' },

  // ---- Conversation ---- (Long Haul/Conversation Pro are measured within
  // a single conversation/thread, never summed across separate ones)
  { id: 'first-chat',       category: 'conversation', name: 'First Chat',       description: 'Start your first conversation',       requirement: '1 conversation',   target: 1,   progress: 0, icon: 'conversation-1' },
  { id: 'smooth-talker',    category: 'conversation', name: 'Smooth Talker',    description: 'Have 10 conversations',                requirement: '10 conversations', target: 10,  progress: 0, icon: 'conversation-2' },
  { id: 'deep-connector',   category: 'conversation', name: 'Deep Connector',   description: 'Reach 50 messages',                    requirement: '50 messages',      target: 50,  progress: 0, icon: 'conversation-3' },
  { id: 'long-haul',        category: 'conversation', name: 'Long Haul',        description: 'Reach 100 messages in a conversation', requirement: '100 messages',     target: 100, progress: 0, icon: 'conversation-4' },
  { id: 'conversation-pro', category: 'conversation', name: 'Conversation Pro', description: 'Reach 250 messages in a conversation', requirement: '250 messages',     target: 250, progress: 0, icon: 'conversation-5' },

  // ---- Progress ---- (reads the same centralized level used elsewhere
  // in Zelo — never a separate score invented just for badges)
  { id: 'rising-star',     category: 'progress', name: 'Rising Star',     description: 'Reach Level 2',  requirement: 'Level 2',  target: 2,  progress: 0, icon: 'progress-1' },
  { id: 'improving',       category: 'progress', name: 'Improving',       description: 'Reach Level 5',  requirement: 'Level 5',  target: 5,  progress: 0, icon: 'progress-2' },
  { id: 'rizz-master',     category: 'progress', name: 'Rizz Master',     description: 'Reach Level 10', requirement: 'Level 10', target: 10, progress: 0, icon: 'progress-3' },
  { id: 'top-performer',   category: 'progress', name: 'Top Performer',   description: 'Reach Level 15', requirement: 'Level 15', target: 15, progress: 0, icon: 'progress-4' },
  { id: 'elite-performer', category: 'progress', name: 'Elite Performer', description: 'Reach Level 20', requirement: 'Level 20', target: 20, progress: 0, icon: 'progress-5' },

  // ---- Explorer ---- ("Everything" only unlocks off the real defined
  // feature checklist, never just from opening the app)
  { id: 'first-scan', category: 'explorer', name: 'First Scan', description: 'Complete your first scan', requirement: '1 scan',    target: 1,   progress: 0, icon: 'explorer-1' },
  { id: 'scanner',    category: 'explorer', name: 'Scanner',    description: 'Complete 10 scans',        requirement: '10 scans',  target: 10,  progress: 0, icon: 'explorer-2' },
  { id: 'explorer',   category: 'explorer', name: 'Explorer',   description: 'Complete 50 scans',        requirement: '50 scans',  target: 50,  progress: 0, icon: 'explorer-3' },
  { id: 'adventurer', category: 'explorer', name: 'Adventurer', description: 'Complete 100 scans',       requirement: '100 scans', target: 100, progress: 0, icon: 'explorer-4' },
  { id: 'everything', category: 'explorer', name: 'Everything', description: 'Try all major Zelo features', requirement: 'All features', target: 1, progress: 0, binary: true, icon: 'explorer-5' },

  // ---- Comeback ---- ("break" is defined centrally — see COMEBACK_
  // BREAK_DAYS below, so no other part of the app invents its own definition)
  { id: 'back-in-action', category: 'comeback', name: 'Back in Action', description: 'Return after a break',  requirement: '1 comeback',   target: 1,  progress: 0, binary: true, icon: 'comeback-1' },
  { id: 'never-quit',     category: 'comeback', name: 'Never Quit',     description: 'Complete 2 comebacks',  requirement: '2 comebacks',  target: 2,  progress: 0, icon: 'comeback-2' },
  { id: 'resilient',      category: 'comeback', name: 'Resilient',      description: 'Complete 5 comebacks',  requirement: '5 comebacks',  target: 5,  progress: 0, icon: 'comeback-3' },
  { id: 'comeback-king',  category: 'comeback', name: 'Comeback King',  description: 'Complete 10 comebacks', requirement: '10 comebacks', target: 10, progress: 0, icon: 'comeback-4' },
  { id: 'unbreakable',    category: 'comeback', name: 'Unbreakable',    description: 'Complete 25 comebacks', requirement: '25 comebacks', target: 25, progress: 0, icon: 'comeback-5' },

  // ---- Social ---- (backed by the real Refer Friends feature —
  // openReferFriends() in script.js — progress:0 until referral counts
  // are actually tracked server-side)
  { id: 'social-starter', category: 'social', name: 'Social Starter', description: 'Refer 1 friend',   requirement: '1 friend',   target: 1,  progress: 0, icon: 'social-1' },
  { id: 'friendly',       category: 'social', name: 'Friendly',       description: 'Refer 5 friends',  requirement: '5 friends',  target: 5,  progress: 0, icon: 'social-2' },
  { id: 'popular',        category: 'social', name: 'Popular',        description: 'Refer 10 friends', requirement: '10 friends', target: 10, progress: 0, icon: 'social-3' },
  { id: 'influential',    category: 'social', name: 'Influential',    description: 'Refer 25 friends', requirement: '25 friends', target: 25, progress: 0, icon: 'social-4' },
  { id: 'legendary',      category: 'social', name: 'Legendary',      description: 'Refer 50 friends', requirement: '50 friends', target: 50, progress: 0, icon: 'social-5' },

  // ---- Special ---- ("Zelo Legend" depends dynamically on the real
  // total-unlocked count — see isBadgeUnlocked() in script.js, not a
  // static progress/target comparison like every other badge here)
  { id: 'early-bird',  category: 'special', name: 'Early Bird',  description: 'Joined early',         requirement: 'Joined early',  target: 1,  progress: 0, binary: true, icon: 'special-1' },
  { id: 'zelo-fan',    category: 'special', name: 'Zelo Fan',    description: 'Use Zelo for 7 days',  requirement: '7 days',        target: 7,  progress: 0, icon: 'special-2' },
  { id: 'vip',         category: 'special', name: 'VIP',         description: 'Use Zelo for 30 days', requirement: '30 days',       target: 30, progress: 0, icon: 'special-3' },
  { id: 'day-one',     category: 'special', name: 'Day One',     description: 'Active since launch',  requirement: 'Since launch',  target: 1,  progress: 0, binary: true, icon: 'special-4' },
  { id: 'zelo-legend', category: 'special', name: 'Zelo Legend', description: 'Unlock every achievement badge', requirement: 'All badges', target: 1, progress: 0, binary: true, dynamic: 'all-badges', icon: 'special-5' },

  // ---- Texting ---- ("successful conversation" definition is centralized
  // — not yet wired to a real metric, seeded at 0 like everything else)
  { id: 'first-reply',         category: 'texting', name: 'First Reply',         description: 'Send your first Zelo-generated reply', requirement: '1 reply',    target: 1,  progress: 0, icon: 'texting-1' },
  { id: 'quick-thinker',       category: 'texting', name: 'Quick Thinker',       description: 'Generate 10 replies',                  requirement: '10 replies', target: 10, progress: 0, icon: 'texting-2' },
  { id: 'smooth-operator',     category: 'texting', name: 'Smooth Operator',     description: 'Send 50 improved replies',             requirement: '50 replies', target: 50, progress: 0, icon: 'texting-3' },
  { id: 'conversation-keeper', category: 'texting', name: 'Conversation Keeper', description: 'Keep 10 conversations going',          requirement: '10 convos',  target: 10, progress: 0, icon: 'texting-4' },
  { id: 'natural-rizz',        category: 'texting', name: 'Natural Rizz',        description: 'Complete 25 successful conversations', requirement: '25 convos',  target: 25, progress: 0, icon: 'texting-5' }
];
