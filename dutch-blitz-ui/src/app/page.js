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
import HistoricalGallery from "../components/HistoricalGallery";

const EMOJIS = ["👾", "🦊", "🐶", "🐱", "🐰", "🐼", "🐯", "🐸", "🦄", "👽", "👻", "🤖", "🤡", "👹", "👑", "🔥", "🐳", "🫍", "💯", "💩", "💀", "🐢", "🐺", "🦖", "🐝"];

const getUserColor = (name) => {
  const colors = ['text-[#fbd304]', 'text-[#005ba1]', 'text-[#d22730]', 'text-[#4ade80]'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export default function Home() {
  const [lang, setLang] = useState("en");
  const t = dict[lang] || dict["en"];
  const [showSettings, setShowSettings] = useState(false);
  const [matchHistory, setMatchHistory] = useState([]);
  const [rawUsername, setRawUsername] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("👾");
  const [recentRooms, setRecentRooms] = useState([]);
  const [myThought, setMyThought] = useState("");
  const [inactivityAlert, setInactivityAlert] = useState("");

  const [isInRoom, setIsInRoom] = useState(false);
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    setSelectedEmoji(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
    setRecentRooms(JSON.parse(localStorage.getItem("blitzRoomHistory") || "[]"));
    const savedLang = localStorage.getItem("blitzLang");
    if (savedLang) setLang(savedLang);

    // 🔥 FIX: Capturamos el link mágico (ej. /?room=SVA)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const roomFromUrl = urlParams.get('room');
      if (roomFromUrl) {
        setRoomCode(roomFromUrl.toUpperCase());
      }
    }
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
    } catch (error) {
      // Silenciado intencionalmente para evitar logs en rojo cuando la DB es nueva
    }
  };

  const engine = useGameEngine(
    username, setUsername,
    roomCode, setRoomCode,
    isInRoom, setIsInRoom,
    setMyThought,
    recentRooms, setRecentRooms,
    fetchHistory, setInactivityAlert,
    15 * 60 * 1000,
    t // 🔥 Aseguramos pasarle el diccionario al engine
  );

  const authUser = engine.authUser;

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

  const playersList = Object.keys(engine.playerScores);
  const isEveryoneReady = playersList.length > 0 && playersList.every(p => engine.playerReady[p]);

  // 🔥 FIX: El Recap (dibujar la partida) solo se muestra si hay un ganador.
  const showRecap = engine.winner !== null;

  return (
    <div className="min-h-screen bg-neutral-950 p-4 md:p-8 text-white flex justify-center relative">
      <div className="w-full max-w-2xl flex flex-col gap-5">

        <div className="flex flex-col border-b border-neutral-800/60 pb-4 gap-4">
          <GameHeader
            t={t} roomCode={roomCode} targetScore={engine.targetScore} onlineCount={engine.onlineCount}
            lang={lang} toggleLang={toggleLang} setShowSettings={setShowSettings} showSettings={showSettings}
            leaveRoom={engine.leaveRoom}
            authUser={authUser}
          />
        </div>

        <Leaderboard playerScores={engine.playerScores} playerStatuses={engine.playerStatuses} username={username} getUserColor={getUserColor} t={t} />

        {/* 🔥 FIX: La caja de pensamiento solo sale si TODOS están listos y el juego NO ha terminado */}
        {(isEveryoneReady && !showRecap) && (
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-full px-4 py-2 shadow-inner w-full mb-2">
            <span className="text-sm mr-3 opacity-70">💭</span>
            <input
              type="text" maxLength={40}
              placeholder={engine.suggestedThought || t.header.thoughtPlaceholder}
              className="bg-transparent text-sm focus:outline-none flex-grow text-purple-200 placeholder-purple-400/40 w-full"
              value={myThought}
              onChange={(e) => setMyThought(e.target.value)}
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
              disabled={myThought.trim() === "" && engine.suggestedThought === ""}
              className={`text-xs px-4 py-1.5 rounded-full font-bold transition ml-2 tracking-wide shadow-md border ${(myThought.trim() === "" && engine.suggestedThought === "")
                ? 'bg-neutral-800 text-neutral-500 border-neutral-700 cursor-not-allowed opacity-70'
                : 'bg-purple-600/80 hover:bg-purple-500 text-purple-100 border-purple-500/50'
                }`}
            >
              {t.header.setBtn}
            </button>
          </div>
        )}

        {showSettings && (
          <RoomSettings
            t={t} currentTargetScore={engine.targetScore} currentAiEnabled={engine.aiEnabled} winner={engine.winner}
            username={username} playerScores={engine.playerScores} getUserColor={getUserColor}
            kickPlayer={engine.kickPlayer} onClose={() => setShowSettings(false)}
            onSave={(newScore, newAi) => { engine.broadcastNewSettings(newScore, newAi); setShowSettings(false); }}
            destroyRoom={engine.destroyRoom}
          />
        )}

        {engine.messages.length > 0 && (
          <ChatBox messages={engine.messages} playerScores={engine.playerScores} getUserColor={getUserColor} />
        )}

        <ScorePanel
          t={t} isManualMath={engine.isManualMath} setIsManualMath={engine.setIsManualMath}
          mentalScore={engine.mentalScore} setMentalScore={engine.setMentalScore}
          blitzCards={engine.blitzCards} setBlitzCards={engine.setBlitzCards} dutchCards={engine.dutchCards} setDutchCards={engine.setDutchCards}
          winner={engine.winner} restartGame={engine.restartGame} submitScore={engine.submitScore}
          playerReady={engine.playerReady} username={username} toggleReady={() => engine.toggleReady(t.ready.isReadyMsg, t.ready.notReadyMsg)} playerScores={engine.playerScores}
          lastSubmittedScore={engine.lastSubmittedScore}
          undoScore={engine.undoScore}
        />

        {/* 🔥 FIX: El generador de IA ahora SOLO aparece al finalizar la partida */}
        {showRecap && (
          <AiRecap
            t={t} lang={lang} aiEnabled={engine.aiEnabled}
            isGenerating={engine.isGenerating} generateAIRecap={engine.generateAIRecap}
            recap={engine.recap}
            roomCode={roomCode}
          />
        )}

        <MatchHistory t={t} history={matchHistory} getUserColor={getUserColor} />

        <HistoricalGallery
          t={t}
          roomCode={roomCode}
          username={username}
          playerScores={engine.playerScores}
          lang={lang}
        />

      </div>
    </div>
  );
}