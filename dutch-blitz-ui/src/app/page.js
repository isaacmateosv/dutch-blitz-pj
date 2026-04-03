"use client";

import { useState, useEffect } from "react";
import RoomSettings from "../components/RoomSettings";
import Lobby from "../components/Lobby";
import ScorePanel from "../components/ScorePanel";
import ChatBox from "../components/ChatBox";
import AiRecap from "../components/AiRecap";
import MatchHistory from "../components/MatchHistory";
import GameHeader from "../components/GameHeader";
import Leaderboard from "../components/Leaderboard";
import { useGameEngine } from "../hooks/useGameEngine";
import { dict } from "../locales/dictionary";

const EMOJIS = ["👾", "🦊", "🐶", "🐱", "🐰", "🐼", "🐯", "🐸", "🦄", "👽", "👻", "🤖", "🤡", "👹", "👑", "🔥", "🐳", "🫍", "💯", "💩", "💀", "🐢", "🐺", "🦖", "🐝"];

const getUserColor = (name) => {
  const colors = ['text-[#fbd304]', 'text-[#005ba1]', 'text-[#d22730]', 'text-[#4ade80]'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export default function Home() {
  // 1. DUMB UI STATES (Only related to rendering visual elements)
  const [lang, setLang] = useState("en");
  const t = dict[lang] || dict["en"];
  const [showSettings, setShowSettings] = useState(false);
  const [matchHistory, setMatchHistory] = useState([]);
  const [rawUsername, setRawUsername] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("👾");
  const [recentRooms, setRecentRooms] = useState([]);
  const [myThought, setMyThought] = useState("");
  const [inactivityAlert, setInactivityAlert] = useState("");

  // 2. SHARED STATES (Passed into the engine)
  const [isInRoom, setIsInRoom] = useState(false);
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    setSelectedEmoji(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
    setRecentRooms(JSON.parse(localStorage.getItem("blitzRoomHistory") || "[]"));
    const savedLang = localStorage.getItem("blitzLang");
    if (savedLang) setLang(savedLang);
  }, []);

  const toggleLang = () => {
    const newLang = lang === "en" ? "es" : "en";
    setLang(newLang);
    localStorage.setItem("blitzLang", newLang);
  };

  const fetchHistory = async (code = roomCode) => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || `http://localhost:8000`;
      const response = await fetch(`${apiBaseUrl}/rooms/${code}/history/`);
      if (response.ok) setMatchHistory(await response.json());
    } catch (error) { console.error("Failed to load history"); }
  };

  // 🚀 3. THE GAME ENGINE (Handles all logic, WebSockets, and heavy state)
  const engine = useGameEngine(
    username, setUsername,
    roomCode, setRoomCode,
    isInRoom, setIsInRoom,
    setMyThought,
    recentRooms, setRecentRooms,
    fetchHistory, setInactivityAlert,
    15 * 60 * 1000
  );

  // Grab the auth state from the engine
  const authUser = engine.authUser;

  // ⏳ Timeout Watcher
  useEffect(() => {
    if (!isInRoom) return;
    const timer = setTimeout(() => {
      engine.leaveRoom();
      setInactivityAlert("timeout");
    }, 25 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [engine.lastActivity, isInRoom, engine]);

  if (!isInRoom) {
    return (
      <Lobby
        t={t} rawUsername={rawUsername} setRawUsername={setRawUsername}
        selectedEmoji={selectedEmoji} setSelectedEmoji={setSelectedEmoji}
        roomCode={roomCode} setRoomCode={setRoomCode} recentRooms={recentRooms}
        joinRoom={(code) => engine.joinRoom(rawUsername, selectedEmoji, code)}
        targetScore={engine.targetScore} setTargetScore={engine.setTargetScore}
        inactivityAlert={inactivityAlert}
        authUser={authUser}
      />
    );
  }

  // 🔥 NUEVO: Chequeamos si al menos un jugador tiene un puntaje diferente de 0
  const hasScores = Object.values(engine.playerScores).some(score => score !== 0);

  return (
    <div className="min-h-screen bg-neutral-950 p-4 md:p-8 text-white flex justify-center relative">
      <div className="w-full max-w-2xl flex flex-col gap-5">

        {/* 1. HEADER (Limpio, solo información) */}
        <div className="flex flex-col border-b border-neutral-800/60 pb-4 gap-4">
          <GameHeader
            t={t} roomCode={roomCode} targetScore={engine.targetScore} onlineCount={engine.onlineCount}
            lang={lang} toggleLang={toggleLang} setShowSettings={setShowSettings} showSettings={showSettings}
            leaveRoom={engine.leaveRoom}
            authUser={authUser}
          />
        </div>

        {/* 2. LEADERBOARD (Los avatares y puntajes actuales) */}
        <Leaderboard playerScores={engine.playerScores} playerStatuses={engine.playerStatuses} username={username} getUserColor={getUserColor} t={t} />

        {/* 3. INPUT DE PENSAMIENTO (Anclado visualmente al Leaderboard) */}
        <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-full px-4 py-2 shadow-inner w-full mb-2">
          <span className="text-sm mr-3 opacity-70">💭</span>
          <input
            type="text" maxLength={40}
            placeholder={engine.suggestedThought || t.header.thoughtPlaceholder}
            className="bg-transparent text-sm focus:outline-none flex-grow text-purple-200 placeholder-purple-400/40 w-full"
            value={myThought} onChange={(e) => setMyThought(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const textToSend = myThought.trim() !== "" ? myThought : engine.suggestedThought;
                if (textToSend) {
                  engine.handleStatusUpdate(textToSend);
                  setMyThought("");
                  engine.setSuggestedThought("");
                }
              }
            }}
          />
          <button
            onClick={() => {
              const textToSend = myThought.trim() !== "" ? myThought : engine.suggestedThought;
              if (textToSend) {
                engine.handleStatusUpdate(textToSend);
                setMyThought("");
                engine.setSuggestedThought("");
              }
            }}
            className="bg-purple-600/80 hover:bg-purple-500 text-purple-100 text-xs px-4 py-1.5 rounded-full font-bold transition ml-2 tracking-wide shadow-md border border-purple-500/50"
          >
            {t.header.setBtn}
          </button>
        </div>

        {/* MODAL DE AJUSTES */}
        {showSettings && (
          <RoomSettings
            t={t} currentTargetScore={engine.targetScore} currentAiEnabled={engine.aiEnabled} winner={engine.winner}
            username={username} playerScores={engine.playerScores} getUserColor={getUserColor}
            kickPlayer={engine.kickPlayer} onClose={() => setShowSettings(false)}
            onSave={(newScore, newAi) => { engine.broadcastNewSettings(newScore, newAi); setShowSettings(false); }}
            destroyRoom={engine.destroyRoom}
          />
        )}

        {/* 🔥 4. CHATBOX (Aparece SOLO si hay mensajes, y va ARRIBA de los controles) */}
        {engine.messages.length > 0 && (
          <ChatBox messages={engine.messages} playerScores={engine.playerScores} getUserColor={getUserColor} />
        )}

        {/* 🔥 5. SCORE PANEL (El "teclado" del juego, va ABAJO de los mensajes) */}
        <ScorePanel
          t={t} isManualMath={engine.isManualMath} setIsManualMath={engine.setIsManualMath}
          mentalScore={engine.mentalScore} setMentalScore={engine.setMentalScore}
          blitzCards={engine.blitzCards} setBlitzCards={engine.setBlitzCards} dutchCards={engine.dutchCards} setDutchCards={engine.setDutchCards}
          winner={engine.winner} restartGame={engine.restartGame} submitScore={engine.submitScore}
          playerReady={engine.playerReady} username={username} toggleReady={() => engine.toggleReady(t.ready.isReadyMsg, t.ready.notReadyMsg)} playerScores={engine.playerScores}
          lastSubmittedScore={engine.lastSubmittedScore}
          undoScore={engine.undoScore}
        />

        {/* 6. AI RECAP & MATCH HISTORY */}
        {hasScores && (
          <AiRecap t={t} lang={lang} aiEnabled={engine.aiEnabled} isGenerating={engine.isGenerating} generateAIRecap={engine.generateAIRecap} recap={engine.recap} />
        )}

        <MatchHistory t={t} history={matchHistory} getUserColor={getUserColor} />
      </div>
    </div>
  );
}