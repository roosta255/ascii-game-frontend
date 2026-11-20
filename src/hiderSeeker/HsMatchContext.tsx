import { createContext, useContext, useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { createHsClient, isStaleRevision, HsResponse } from "./hsApi";
import { pageMode } from "./pageMode";
import { describeMoveResult } from "./turnPreview";

const client = createHsClient(API_BASE, (url, init) => fetch(url, init), () => crypto.randomUUID());
const POLL_MS = 3000;

interface HsMatchContextType {
  matchId: string | null;
  account: string | null;
  match: any;
  view: any;
  publicView: any;
  mode: string | null;
  error: string | null;
  resultLines: string[];
  resultFrom: string | null;
  run: (request: () => Promise<HsResponse>, from: string) => void;
  client: any;
}

const HsMatchContext = createContext<HsMatchContextType | undefined>(undefined);

export function useHsMatch() {
  const context = useContext(HsMatchContext);
  if (!context) {
    throw new Error("useHsMatch must be used within a HsMatchProvider");
  }
  return context;
}

export function HsMatchProvider({ children }: { children: React.ReactNode }) {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId || null;
  const { account } = useAuth();
  const [match, setMatch] = useState<any>(null);
  const [view, setView] = useState<any>(null);
  const [publicView, setPublicView] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultLines, setResultLines] = useState<string[]>([]);
  const [resultFrom, setResultFrom] = useState<string | null>(null);
  const etag = useRef<string | null>(null);
  const publicEtag = useRef<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);

  const refresh = async () => {
    if (!matchId || !account) {
      return;
    }

    try {
      const response = await client.getMatch(matchId);
      
      if (response.status !== 200) {
        setError(response.body?.message ?? `Match not found (${response.status})`);
        return;
      }
      
      setMatch(response.body);
      setMode(pageMode(response.body, account));
      
      // Only fetch view if we're in PLAY mode
      if (pageMode(response.body, account) === "PLAY") {
        const viewResponse = await client.getHiderView(matchId, account, etag.current);
        
        if (viewResponse.status === 200) {
          etag.current = viewResponse.etag;
          setView(viewResponse.body);
        } else if (viewResponse.status !== 304) {
          // For any other error status, we don't update the view
        }
      } else {
        // A spectator polls the public view the same way.
        if (pageMode(response.body, account) === "NOT_A_HIDER") {
          const publicResponse = await client.getPublicView(matchId, publicEtag.current);
          if (publicResponse.status === 200) {
            publicEtag.current = publicResponse.etag;
            setPublicView(publicResponse.body);
          }
        }
      }
    } catch (err) {
      setError(`Error loading match data: ${err}`);
    }
  };

  const handle = async (response: HsResponse) => {
    if (response.status === 200) {
      setError(null);
      
      // If the response has a status field, it's likely a move or cancel result
      if (response.body && response.body.status) {
        setResultLines(describeMoveResult(response.body));
      } else {
        setResultLines([]);
      }
    } else if (isStaleRevision(response)) {
      setError(`The match moved on to revision ${response.body.revision}. Check the new state and resubmit.`);
    } else {
      setError(response.body?.message ?? `Request failed (${response.status})`);
    }
    
    await refresh();
  };

  const run = async (request: () => Promise<HsResponse>, from: string) => {
    setResultFrom(from);
    const response = await request();
    await handle(response);
  };

  useEffect(() => {
    if (!matchId || !account) {
      return;
    }

    refresh();
    const interval = setInterval(refresh, POLL_MS);
    
    return () => {
      clearInterval(interval);
    };
  }, [matchId, account]);

  const value = {
    matchId,
    account,
    match,
    view,
    publicView,
    mode,
    error,
    resultLines,
    resultFrom,
    run,
    client
  };

  return (
    <HsMatchContext.Provider value={value}>
      {children}
    </HsMatchContext.Provider>
  );
}