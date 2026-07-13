// Patch 10: penyamaan konstanta role/intent agent.js vanilla-main -> fork.
// Semua via replaceLine existing (String.raw = jaga backslash regex literal; nol
// backtick/${} di blok). Marker [zen-pack:10].
//   1. SCREENER_TOOLS: 11 tool -> 7 tool slim fork (+ komentar efficiency). Ini
//      SEKALIGUS menutup utang "exposure role 2 profile-tools" (get_time_profile +
//      get_narrative_profile) — sudah terdaftar runtime (patch 04b, FASE A.5).
//   2. INTENT_PATTERNS: 17 entri EN -> 17 entri BILINGUAL fork (blok penuh unik).
//   3. 4 regex intent: versi fork bilingual verbatim.
// CHAT_CONFIRM_TOOLS SENGAJA TIDAK disisipkan — konsumen tunggal runToolCall (5.4),
// konstanta tanpa konsumen = kode tidur (vonis FASE A.6). Menyusul patch 5.4.
const M = "zen-pack:10-agent-constants";

const SCREENER_OLD = String.raw`const SCREENER_TOOLS = new Set(["deploy_position", "get_active_bin", "get_top_candidates", "check_smart_wallets_on_pool", "get_token_holders", "get_token_narrative", "get_token_info", "search_pools", "get_pool_memory", "get_wallet_balance", "get_my_positions"]);`;

const SCREENER_NEW = String.raw`// [zen-pack:10] SCREENER schema slim (fork) — tutup utang exposure 2 profile-tools.
// The SCREENER's offered schema deliberately OMITS get_active_bin, check_smart_wallets_on_pool,
// get_token_holders, get_token_narrative, get_token_info, get_pool_memory — because their data
// is already pre-loaded into every candidate block in runScreeningCycle (index.js: active_bin /
// audit / smart_wallets / narrative_untrusted / memory_untrusted). Not offering them means the
// model can't burn extra ~8k-token multi-step round-trips re-fetching data it already sees. The
// tool impls remain wired for GENERAL/manual use; only the SCREENER schema is slimmed.
const SCREENER_TOOLS = new Set(["deploy_position", "get_top_candidates", "search_pools", "get_time_profile", "get_narrative_profile", "get_wallet_balance", "get_my_positions"]);`;

const INTENT_OLD = String.raw`const INTENT_PATTERNS = [
  { intent: "decisions",   re: /\b(why did you|why'd you|why was (?:this|that|it)|what made you|what was the reason|why no deploy|why didn't you deploy|why did you close|why did you deploy|why did you skip)\b/i },
  { intent: "deploy",      re: /\b(deploy|open|add liquidity|lp into|invest in)\b/i },
  { intent: "close",       re: /\b(close|exit|withdraw|remove liquidity|shut down)\b/i },
  { intent: "claim",       re: /\b(claim|harvest|collect)\b.*\bfee/i },
  { intent: "swap",        re: /\b(swap|convert|sell|exchange)\b/i },
  { intent: "selfupdate",  re: /\b(self.?update|git pull|pull latest|update (the )?bot|update (the )?agent|update yourself)\b/i },
  { intent: "blocklist",   re: /\b(blacklist|block|unblock|blocklist|blocked deployer|rugger|block dev|block deployer)\b/i },
  { intent: "config",      re: /\b(config|setting|threshold|update|set |change)\b/i },
  { intent: "balance",     re: /\b(balance|wallet|sol|how much)\b/i },
  { intent: "positions",   re: /\b(position|portfolio|open|pnl|yield|range)\b/i },
  { intent: "strategy",    re: /\b(strategy|strategies)\b/i },
  { intent: "screen",      re: /\b(screen|candidate|find pool|search|research|token)\b/i },
  { intent: "memory",      re: /\b(memory|pool history|note|remember)\b/i },
  { intent: "smartwallet", re: /\b(smart wallet|kol|whale|watch.?list|add wallet|remove wallet|list wallet|tracked wallet|check pool|who.?s in|wallets in|add to (smart|watch|kol))\b/i },
  { intent: "study",       re: /\b(study top|top lpers?|best lpers?|who.?s lping|lp behavior|lpers?)\b/i },
  { intent: "performance", re: /\b(performance|history|how.?s the bot|how.?s it doing|stats|report)\b/i },
  { intent: "lessons",     re: /\b(lesson|learned|teach|pin|unpin|clear lesson|what did you learn)\b/i },
];`;

const INTENT_NEW = String.raw`const INTENT_PATTERNS = [ // [zen-pack:10] bilingual EN+ID (fork)
  { intent: "decisions",   re: /\b(why did you|why'd you|why was (?:this|that|it)|what made you|what was the reason|why no deploy|why didn't you deploy|why did you close|why did you deploy|why did you skip|kenapa kamu|kenapa kau|kenapa tidak|kenapa nggak|kenapa gak|mengapa kamu|apa alasan|apa yang membuat)\b/i },
  { intent: "deploy",      re: /\b(deploy|open|add liquidity|lp into|invest in|buka posisi|tambah likuiditas|lp ke)\b/i },
  { intent: "close",       re: /\b(close|exit|withdraw|remove liquidity|shut down|tutup|tarik|cabut|hentikan|keluar dari)\b/i },
  { intent: "claim",       re: /\b(claim|harvest|collect|klaim|panen|ambil)\b.*\b(fee|biaya|imbal)/i },
  { intent: "swap",        re: /\b(swap|convert|sell|exchange|tukar|jual|konversi)\b/i },
  { intent: "selfupdate",  re: /\b(self.?update|git pull|pull latest|update (the )?bot|update (the )?agent|update yourself|perbarui bot|perbarui agent|perbarui diri)\b/i },
  { intent: "blocklist",   re: /\b(blacklist|block|unblock|blocklist|blocked deployer|rugger|block dev|block deployer|blokir|buka blokir|daftar hitam)\b/i },
  { intent: "config",      re: /\b(config|konfigurasi|setting|setelan|threshold|ambang|update|set |change|ubah|ganti|atur|setel|enable|disable|turn (on|off)|switch (on|off)|activate|deactivate|toggle|matikan|nyalakan|hidupkan|aktifkan|non-?aktifkan|jalankan|hentikan)\b/i },
  { intent: "balance",     re: /\b(balance|wallet|sol|how much|saldo|dompet|berapa)\b/i },
  { intent: "positions",   re: /\b(position|portfolio|open|pnl|yield|range|posisi|portofolio)\b/i },
  { intent: "strategy",    re: /\b(strategy|strategies|strategi)\b/i },
  { intent: "screen",      re: /\b(screen|candidate|find pool|search|research|token|cari pool|cari token|kandidat|riset|telusuri)\b/i },
  { intent: "memory",      re: /\b(memory|pool history|note|remember|memori|riwayat pool|catatan|ingat)\b/i },
  { intent: "smartwallet", re: /\b(smart wallet|kol|whale|watch.?list|add wallet|remove wallet|list wallet|tracked wallet|check pool|who.?s in|wallets in|add to (smart|watch|kol)|dompet pintar|pantau wallet|tambah wallet|hapus wallet|daftar wallet)\b/i },
  { intent: "study",       re: /\b(study top|top lpers?|best lpers?|who.?s lping|lp behavior|lpers?|pelajari lper|lper terbaik)\b/i },
  { intent: "performance", re: /\b(performance|history|how.?s the bot|how.?s it doing|stats|report|performa|kinerja|riwayat|laporan|statistik|gimana)\b/i },
  { intent: "lessons",     re: /\b(lesson|learned|teach|pin|unpin|clear lesson|what did you learn|pelajaran|ajari|sematkan|lepas sematan)\b/i },
];`;

const MUT_OLD = String.raw`const MUTATING_TOOL_INTENTS = /\b(deploy|open position|add liquidity|lp into|invest in|close|exit|withdraw|remove liquidity|claim|harvest|collect|swap|convert|sell|exchange|block|unblock|blacklist|add smart wallet|remove smart wallet|add wallet|remove wallet|pin|unpin|clear lesson|add lesson|set active strategy|remove strategy|add strategy|set |change |update |self.?update|pull latest|git pull|update yourself)\b/i;`;
const MUT_NEW = String.raw`const MUTATING_TOOL_INTENTS = /\b(deploy|open position|add liquidity|lp into|invest in|close|exit|withdraw|remove liquidity|claim|harvest|collect|swap|convert|sell|exchange|block|unblock|blacklist|add smart wallet|remove smart wallet|add wallet|remove wallet|pin|unpin|clear lesson|add lesson|set active strategy|remove strategy|add strategy|set |change |update |self.?update|pull latest|git pull|update yourself|enable|disable|turn (on|off)|switch (on|off)|activate|deactivate|toggle|matikan|nyalakan|hidupkan|aktifkan|non-?aktifkan|buka posisi|tambah likuiditas|tutup|tarik|cabut|hentikan|klaim|panen|tukar|jual|konversi|blokir|buka blokir|ubah|ganti|atur|setel|sematkan|lepas sematan|perbarui|tambah wallet|hapus wallet|tambah strategi|hapus strategi)\b/i; // [zen-pack:10]`;

const LIVE_OLD = String.raw`const LIVE_DATA_TOOL_INTENTS = /\b(balance|wallet|position|portfolio|pnl|yield|range|show positions|open positions|screen|candidate|find pool|search|research|analyze|check pool|token holders|narrative|study top|top lpers?|lp behavior|who.?s lping|performance|history|stats|report|list smart wallets|list blacklist|list blocked deployers|list lessons)\b/i;`;
const LIVE_NEW = String.raw`const LIVE_DATA_TOOL_INTENTS = /\b(balance|wallet|position|portfolio|pnl|yield|range|show positions|open positions|screen|candidate|find pool|search|research|analyze|check pool|token holders|narrative|study top|top lpers?|lp behavior|who.?s lping|performance|history|stats|report|list smart wallets|list blacklist|list blocked deployers|list lessons|saldo|dompet|posisi|portofolio|cari pool|kandidat|riset|performa|kinerja|riwayat|laporan|statistik|daftar)\b/i; // [zen-pack:10]`;

const CFG_OLD = String.raw`const CONFIG_READ_ONLY_INTENTS = /\b(check|show|what(?:'s| is)?|review|inspect|see)\b.*\b(config|settings?|thresholds?)\b/i;`;
const CFG_NEW = String.raw`const CONFIG_READ_ONLY_INTENTS = /\b(check|show|what(?:'s| is)?|review|inspect|see|cek|lihat|tampilkan|tunjukkan|periksa)\b.*\b(config|konfigurasi|settings?|setelan|thresholds?|ambang)\b/i; // [zen-pack:10]`;

const DEC_OLD = String.raw`const DECISION_EXPLANATION_INTENTS = /\b(why did you|why'd you|why was (?:this|that|it)|what made you|what was the reason|why no deploy|why didn't you deploy|why did you close|why did you deploy|why did you skip)\b/i;`;
const DEC_NEW = String.raw`const DECISION_EXPLANATION_INTENTS = /\b(why did you|why'd you|why was (?:this|that|it)|what made you|what was the reason|why no deploy|why didn't you deploy|why did you close|why did you deploy|why did you skip|kenapa kamu|kenapa kau|kenapa tidak|kenapa nggak|kenapa gak|mengapa kamu|apa alasan|apa yang membuat)\b/i; // [zen-pack:10]`;

export default [
  { file: "agent.js", marker: M, replaces: [
    { old: SCREENER_OLD, new: SCREENER_NEW },
    { old: INTENT_OLD,   new: INTENT_NEW },
    { old: MUT_OLD,      new: MUT_NEW },
    { old: LIVE_OLD,     new: LIVE_NEW },
    { old: CFG_OLD,      new: CFG_NEW },
    { old: DEC_OLD,      new: DEC_NEW },
  ]},
];
