// Which screen HiderSeekerPage shows for a getMatch body: the lobby while
// the match is in LOBBY, the turn UI for a hider bound to the match, and a
// short message for anyone else.
export type PageMode = "LOBBY" | "PLAY" | "NOT_A_HIDER";

export function pageMode(match: any, account: string): PageMode {
  if (match.phase === "LOBBY") {
    return "LOBBY";
  }
  
  // Check if the account is in the hiders list
  for (const hider of match.hiders) {
    if (hider.account === account) {
      return "PLAY";
    }
  }
  
  return "NOT_A_HIDER";
}