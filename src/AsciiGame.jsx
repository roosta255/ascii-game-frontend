import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const BACKEND_URL = "http://your-home-ip-or-domain:port"; // Change to your actual backend

export default function AsciiGame() {
  const [matchId, setMatchId] = useState("");
  const [output, setOutput] = useState("");
  const [command, setCommand] = useState("");
  const [viewState, setViewState] = useState("initial");

  const createMatch = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/match`, { method: "POST" });
      const id = await res.text(); // or .json() if you return JSON
      setMatchId(id);
      setViewState("game");
      await refreshView(id);
    } catch {
      setOutput("Failed to create match.");
    }
  };

  const joinMatch = async () => {
    if (!matchId) return;
    setViewState("game");
    await refreshView(matchId);
  };

  const refreshView = async (id) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/match/${id}`);
      const text = await res.text();
      setOutput(text);
    } catch {
      setOutput("Failed to fetch match.");
    }
  };

  const parseAndSendCommand = async () => {
    if (!command) return;
    const [action, ...args] = command.trim().split(/\s+/);

    let endpoint = null;
    let payload = {};

    switch (action) {
      case "move":
        endpoint = "move_character";
        payload = { characterId: args[0], direction: args[1] };
        break;
      case "activate_character":
        endpoint = "activate_character";
        payload = { characterId: args[0] };
        break;
      case "activate_lock":
        endpoint = "activate_lock";
        payload = { doorId: args[0] };
        break;
      case "end":
        endpoint = "end_turn";
        break;
      default:
        setOutput(`Unknown command: ${command}`);
        return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/match/${matchId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.text();
      setOutput(result);
      setCommand("");
    } catch {
      setOutput("Command failed.");
    }
  };

  if (viewState === "initial") {
    return (
      <div className="p-4 max-w-xl mx-auto space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            <h1 className="text-xl font-bold">ASCII Game</h1>
            <Button onClick={createMatch}>Create New Match</Button>
            <div className="flex gap-2">
              <Input
                placeholder="Enter Match ID"
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
              />
              <Button onClick={joinMatch}>Join Match</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <Card>
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold mb-2">Match ID: {matchId}</h2>
          <pre className="whitespace-pre-wrap font-mono text-sm bg-black text-green-400 p-4 rounded">
            {output}
          </pre>
          <div className="mt-4 flex gap-2">
            <Input
              className="flex-1"
              placeholder="Command (e.g. move C1 north)"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && parseAndSendCommand()}
            />
            <Button onClick={parseAndSendCommand}>Send</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
