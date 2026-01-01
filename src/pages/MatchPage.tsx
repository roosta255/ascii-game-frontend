import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import MatchRenderer from "../MatchRenderer";
import { useAuth } from "../AuthContext";
import { TimeRef, updateTimeRef } from "../types/TimeRef";

export default function MatchPage() {
  const { id } = useParams<{ id: string }>();
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewedRoomId, setViewedRoomId] = useState<number | null>(null);
  const { account: currentAccount } = useAuth();

  const timeRef = useRef<TimeRef>({
    serverToClientOffset: 0,
    lastServerTime: 0,
    lastClientTime: 0,
    fetchTime: 0,
  });

  function findRoomIdForOffset(match: any, offset: number): number | null {
    for (let i = 0; i < match.dungeon.rooms.length; i++) {
      const room = match.dungeon.rooms[i];
      
      if (room.floorCells?.some((cell: any) => cell.offset === offset)) return i;
      if (room.walls?.some((wall: any) => wall.cell?.offset === offset)) return i;
    }
    return null;
  }

  // Initial load: get match and initialize viewed room
  useEffect(() => {
    if (!id) return;

    fetch(`/api/match/${id}`)
      .then(res => res.json())
      .then(rawString => {
        const data = JSON.parse(rawString);
        setMatch(data);

        updateTimeRef(timeRef.current, data.serverTime);

        const builder = data.builders.find((b: any) => b.player.account === currentAccount);
        if (!builder) {
          console.error(`❌ Builder with account "${currentAccount}" not found.`);
          setViewedRoomId(null);
          return;
        }

        if (!builder.character) {
          console.error(`❌ Builder "${currentAccount}" has no character assigned. Match likely not started.`);
          setViewedRoomId(null);
          return;
        }

        const offset = builder.character.offset;
        const roomId = findRoomIdForOffset(data, offset);

        if (roomId != null) {
          console.log(`🎯 Initial viewed room: ${roomId}`);
          setViewedRoomId(roomId);
        } else {
          console.error(`❌ Character offset ${offset} not found in any room.`);
          setViewedRoomId(null);
        }
      })
      .catch(err => {
        console.error("Failed to load match", err);
        setMatch(null);
        setViewedRoomId(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Poll for match updates, but do not auto-change viewedRoomId
  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    async function fetchUpdates() {
      try {
        const res = await fetch(`/api/match/${id}`);
        if (!res.ok) throw new Error(`Failed to fetch match ${id}`);

        const raw = await res.json();           // First parse: gives a string
        const data = JSON.parse(raw);           // Second parse: gives actual match object

        if (isMounted) setMatch(data);          // ✅ match is now an object
        updateTimeRef(timeRef.current, data.serverTime);
      } catch (err) {
        console.error("Polling update failed:", err);
      }
    }

    const interval = setInterval(fetchUpdates, 600);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [id]);

  if (loading) return <div>Loading match...</div>;
  if (!match || viewedRoomId == null) return <div>Match not found or no room visible.</div>;

  return (
    <div>
      <MatchRenderer
        match={match}
        viewedRoomId={viewedRoomId}
        setViewedRoomId={setViewedRoomId}
        timeRef={timeRef}
      />
  
      {match.turners.includes(currentAccount) && (
        <button
          onClick={async () => {
            try {
              await fetch(`/api/match/${match.filename}/end_turn`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ account: currentAccount })
              });
              // Your polling will pick up updated state automatically.
            } catch (error) {
              console.error("Failed to end turn:", error);
            }
          }}
        >
          End Turn
        </button>
      )}
    </div>
  );  
}
