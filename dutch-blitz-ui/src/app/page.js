"use client";

import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [isInRoom, setIsInRoom] = useState(false);
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const [messages, setMessages] = useState([]);
  const [blitzCards, setBlitzCards] = useState("");
  const [dutchCards, setDutchCards] = useState("");

  const [recap, setRecap] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const ws = useRef(null);
  const chatRef = useRef(null);

  const joinRoom = () => {
    if (!username || !roomCode) return;

    ws.current = new WebSocket(`ws://localhost:8000/ws/${roomCode}/${username}`);

    ws.current.onmessage = (event) => {
      setMessages((prev) => [...prev, event.data]);
    };

    setIsInRoom(true);
  };

  useEffect(() => {
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  // auto scroll chat
  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [messages]);

  const generateAIRecap = async () => {
    setIsGenerating(true);
    setRecap("");

    try {
      const finalScores = {
        room_code: roomCode,
        scores: [
          { player_name: username, total_score: 24, blitz_cards_left: 0 },
          { player_name: "The Slowpoke", total_score: -4, blitz_cards_left: 5 },
        ],
      };

      const response = await fetch("http://localhost:8000/generate-recap/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalScores),
      });

      const data = await response.json();
      setRecap(data.recap);
    } catch (error) {
      console.error("AI Error:", error);
      setRecap("Connection lost to the AI Announcer.");
    }

    setIsGenerating(false);
  };

  const submitScore = () => {
    const blitz = parseInt(blitzCards) || 0;
    const dutch = parseInt(dutchCards) || 0;

    const roundScore = dutch * 1 - blitz * 2;

    if (ws.current) {
      const message = `scored ${roundScore} points! (Dutch: ${dutch}, Blitz: ${blitz})`;
      ws.current.send(message);

      setBlitzCards("");
      setDutchCards("");
    }
  };

  if (!isInRoom) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
        <div className="flex flex-col gap-4 bg-neutral-900 p-8 rounded-xl shadow-2xl border border-neutral-800/60 w-96">

          <h1 className="text-3xl font-bold tracking-wider text-center mb-4">
            BLITZ<span className="text-emerald-500">ROOM</span>
          </h1>

          <input
            className="p-3 bg-neutral-800 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            className="p-3 bg-neutral-800 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            placeholder="Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
          />

          <button
            className="p-3 bg-emerald-600 hover:bg-emerald-500 rounded-md font-bold tracking-wide transition shadow-lg shadow-emerald-900/30"
            onClick={joinRoom}
          >
            JOIN LOBBY
          </button>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-8 text-white flex justify-center">

      <div className="w-full max-w-2xl flex flex-col gap-4">

        {/* Header */}
        <div className="flex justify-between items-center border-b border-neutral-800/60 pb-4">
          <h2 className="text-2xl font-bold">
            Room: <span className="text-emerald-500">{roomCode}</span>
          </h2>

          <span className="bg-neutral-800 px-4 py-1 rounded-full text-sm">
            Playing as {username}
          </span>
        </div>

        {/* Chat */}
        <div
          ref={chatRef}
          className="bg-neutral-900 h-96 rounded-xl border border-neutral-800/60 p-4 overflow-y-auto shadow-inner flex flex-col gap-2"
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className="bg-neutral-800/80 p-3 rounded-md w-fit max-w-[80%]"
            >
              {msg}
            </div>
          ))}
        </div>

        {/* Score Panel */}
        <div className="flex gap-4 w-full bg-neutral-900 p-4 rounded-xl border border-neutral-800/60 transition hover:border-neutral-700">

          <div className="flex-1">
            <label className="block text-sm text-neutral-400 mb-1">
              Blitz Cards Left (-2 pts)
            </label>

            <input
              type="number"
              className="w-full p-3 bg-neutral-950 rounded-lg border border-red-900/50 focus:border-red-500 transition text-red-400 font-bold"
              value={blitzCards}
              onChange={(e) => setBlitzCards(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="flex-1">
            <label className="block text-sm text-neutral-400 mb-1">
              Dutch Cards Played (+1 pt)
            </label>

            <input
              type="number"
              className="w-full p-3 bg-neutral-950 rounded-lg border border-emerald-900/50 focus:border-emerald-500 transition text-emerald-400 font-bold"
              value={dutchCards}
              onChange={(e) => setDutchCards(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="flex items-end">
            <button
              className="p-3 px-8 h-[50px] bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold transition shadow-lg shadow-emerald-900/30"
              onClick={submitScore}
            >
              SUBMIT
            </button>
          </div>

        </div>

        {/* AI Recap Section */}
        <div className="bg-neutral-900 p-4 rounded-xl border border-purple-900/40 flex flex-col gap-3 shadow-lg shadow-purple-900/20 transition hover:border-purple-700">

          <button
            className={`p-3 rounded-lg font-bold transition-all duration-200 w-full shadow-lg shadow-purple-900/30 ${
              isGenerating
                ? "bg-purple-800 animate-pulse"
                : "bg-purple-600 hover:bg-purple-500"
            }`}
            onClick={generateAIRecap}
            disabled={isGenerating}
          >
            {isGenerating
              ? "🎙️ AI is analyzing the match..."
              : "🎙️ Generate AI Match Recap"}
          </button>

          {recap && (
            <div className="p-4 bg-neutral-950 rounded-lg border border-purple-500/40 text-purple-200 italic shadow-inner">
              "{recap}"
            </div>
          )}
        </div>

      </div>
    </div>
  );
}