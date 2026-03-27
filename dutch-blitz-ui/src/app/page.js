"use client";

import { useState, useEffect, useRef } from "react";
import RoomSettings from "../components/RoomSettings";
import Lobby from "../components/Lobby";
import ScorePanel from "../components/ScorePanel";
import ChatBox from "../components/ChatBox";
import AiRecap from "../components/AiRecap";
import { dict } from "../locales/dictionary";

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

  const toggleLang = () => {
    const newLang = lang === "en" ? "es" : "en";
    setLang(newLang);
    localStorage.setItem("blitzLang", newLang);
  };

  const [rawUsername, setRawUsername] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("👾");
  const [recentRooms, setRecentRooms] = useState([]);

  const [isInRoom, setIsInRoom] = useState(false);
  const isInRoomRef = useRef(false);
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [myThought, setMyThought] = useState("");

  const [targetScore, setTargetScore] = useState(75);
  const targetScoreRef = useRef(75);
  const [aiEnabled, setAiEnabled] = useState(true);
  const aiEnabledRef = useRef(true);
  const [showSettings, setShowSettings] = useState(false);

  const [onlineCount, setOnlineCount] = useState(1);
  const [messages, setMessages] = useState([]);
  const [toasts, setToasts] = useState([]);

  const [lastActivity, setLastActivity] = useState(Date.now());
  const [inactivityAlert, setInactivityAlert] = useState("");
  const INACTIVITY_LIMIT = 25 * 60 * 1000;

  const [playerScores, setPlayerScores] = useState({});
  const playerScoresRef = useRef({});

  const [playerStatuses, setPlayerStatuses] = useState({});
  const playerStatusesRef = useRef({});

  const [playerReady, setPlayerReady] = useState({});
  const playerReadyRef = useRef({});

  const [winner, setWinner] = useState(null);
  const winnerRef = useRef(null);
  const winnerDeclared = useRef(false);

  const [isManualMath, setIsManualMath] = useState(true);
  const [manualScore, setManualScore] = useState("");
  const [blitzCards, setBlitzCards] = useState("");
  const [dutchCards, setDutchCards] = useState("");

  const [recap, setRecap] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const ws = useRef(null);

  useEffect(() => {
    const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    setSelectedEmoji(randomEmoji);
    const savedHistory = JSON.parse(localStorage.getItem("blitzRoomHistory") || "[]");
    setRecentRooms(savedHistory);
    
    const savedLang = localStorage.getItem("blitzLang");
    if (savedLang) setLang(savedLang);
  }, []);

  useEffect(() => {
    targetScoreRef.current = targetScore;
    playerScoresRef.current = playerScores;
    playerStatusesRef.current = playerStatuses;
    playerReadyRef.current = playerReady;
    winnerRef.current = winner;
    aiEnabledRef.current = aiEnabled;

    if (isInRoomRef.current) {
      sessionStorage.setItem("blitzScores", JSON.stringify(playerScores));
      sessionStorage.setItem("blitzStatuses", JSON.stringify(playerStatuses));
      sessionStorage.setItem("blitzReady", JSON.stringify(playerReady));
      sessionStorage.setItem("blitzRules", JSON.stringify({ targetScore }));
      sessionStorage.setItem("blitzMessages", JSON.stringify(messages));
      sessionStorage.setItem("blitzAiEnabled", JSON.stringify(aiEnabled));
      if (winner) sessionStorage.setItem("blitzWinner", winner);
      else sessionStorage.removeItem("blitzWinner");
    }
  }, [targetScore, playerScores, playerStatuses, playerReady, messages, winner, aiEnabled]);

  useEffect(() => {
    const savedUser = sessionStorage.getItem("blitzUsername");
    const savedRoom = sessionStorage.getItem("blitzRoomCode");
    const savedScores = sessionStorage.getItem("blitzScores");
    const savedStatuses = sessionStorage.getItem("blitzStatuses");
    const savedReady = sessionStorage.getItem("blitzReady");
    const savedRules = sessionStorage.getItem("blitzRules");
    const savedMessages = sessionStorage.getItem("blitzMessages");
    const savedWinner = sessionStorage.getItem("blitzWinner");
    const savedAiEnabled = sessionStorage.getItem("blitzAiEnabled");

    if (savedUser && savedRoom) {
      setUsername(savedUser);
      setRoomCode(savedRoom);

      if (savedAiEnabled) setAiEnabled(JSON.parse(savedAiEnabled));
      if (savedScores) setPlayerScores(JSON.parse(savedScores));
      if (savedReady) setPlayerReady(JSON.parse(savedReady));

      if (savedStatuses) {
        const parsedStatuses = JSON.parse(savedStatuses);
        setPlayerStatuses(parsedStatuses);
        if (parsedStatuses[savedUser]) setMyThought(parsedStatuses[savedUser]);
      }

      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        const formatted = parsed.map(m => typeof m === 'string' ? { id: Math.random().toString(), text: m, count: 1 } : { ...m, count: m.count || 1 });
        setMessages(formatted);
      }

      if (savedRules) {
        const rules = JSON.parse(savedRules);
        setTargetScore(rules.targetScore);
      }
      if (savedWinner) {
        setWinner(savedWinner);
        winnerDeclared.current = true;
      }
      setIsInRoom(true);
      isInRoomRef.current = true;
      connectWebSocket(savedRoom, savedUser);
    }
  }, []);

  useEffect(() => {
    if (!isInRoom) return;
    const timer = setTimeout(() => {
      leaveRoom();
      setInactivityAlert("timeout");
    }, INACTIVITY_LIMIT);
    return () => clearTimeout(timer);
  }, [lastActivity, isInRoom]);

  const playPopSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) { console.log("Audio not supported"); }
  };

  const showToast = (msg) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 4000);
  };

  const connectWebSocket = (currentRoom = roomCode, currentUser = username) => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://${window.location.hostname}:8000`;
    const socket = new WebSocket(`${wsUrl}/ws/${currentRoom}/${currentUser}`);
    let pingInterval;

    const appendMsg = (text, isTemporary = false) => {
      const id = Date.now().toString() + Math.random().toString();
      setMessages(prev => {
        const newMsgs = [...prev];
        const lastMsg = newMsgs[newMsgs.length - 1];
        if (lastMsg && lastMsg.text === text && isTemporary) {
          lastMsg.count = (lastMsg.count || 1) + 1;
          return newMsgs;
        }
        return [...newMsgs, { id, text, count: 1 }];
      });
      if (isTemporary) setTimeout(() => { setMessages(prev => prev.filter(m => m.id !== id)); }, 10000);
    };

    socket.onopen = () => {
      setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "request_settings" }));
          socket.send(JSON.stringify({ type: "score", username: currentUser, roundScore: 0, isManual: true, isSilent: true }));
          if (aiEnabledRef.current) socket.send(JSON.stringify({ type: "request_greeting", username: currentUser }));
        }
      }, 500);
      pingInterval = setInterval(() => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" })); }, 30000);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== "pong" && data.type !== "request_settings") setLastActivity(Date.now());

        if (data.type === "system") {
          const isJoinOrLeave = data.message.includes("joined") || data.message.includes("left");
          if (isJoinOrLeave) showToast(data.message.replace('🟢 ', '').replace('🔴 ', ''));
          else appendMsg(data.message);
          if (data.playerCount !== undefined) setOnlineCount(data.playerCount);
        }
        else if (data.type === "request_settings") {
          if (isInRoomRef.current && ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ 
              type: "settings", targetScore: targetScoreRef.current, aiEnabled: aiEnabledRef.current, 
              playerScores: playerScoresRef.current, playerStatuses: playerStatusesRef.current, 
              playerReady: playerReadyRef.current, winner: winnerRef.current 
            }));
          }
        }
        else if (data.type === "settings") {
          setTargetScore(data.targetScore);
          if (data.aiEnabled !== undefined) setAiEnabled(data.aiEnabled);
          if (data.playerScores) setPlayerScores(prev => ({ ...prev, ...data.playerScores }));
          if (data.playerStatuses) setPlayerStatuses(prev => ({ ...prev, ...data.playerStatuses }));
          if (data.playerReady) setPlayerReady(prev => ({ ...prev, ...data.playerReady }));
          setWinner(data.winner || null);
          winnerDeclared.current = !!data.winner;
        }
        else if (data.type === "pong") return;
        else if (data.type === "status_update") {
          setPlayerStatuses(prev => ({ ...prev, [data.username]: data.status }));
          if (data.username === currentUser) setMyThought(data.status);
        }
        else if (data.type === "kick_player") {
          setPlayerScores((prev) => { const n = { ...prev }; delete n[data.target]; return n; });
          setPlayerStatuses((prev) => { const n = { ...prev }; delete n[data.target]; return n; });
          setPlayerReady((prev) => { const n = { ...prev }; delete n[data.target]; return n; });
        }
        else if (data.type === "restart_game") {
          setPlayerScores((prev) => {
            const resetScores = {};
            Object.keys(prev).forEach(player => { resetScores[player] = 0; });
            return resetScores;
          });
          setPlayerReady({});
          setWinner(null);
          winnerDeclared.current = false;
          appendMsg(`🔄 ${data.username} restarted the game! All scores reset to 0.`);
          playPopSound();
        }
        else if (data.type === "score") {
          const currentScore = playerScoresRef.current[data.username] || 0;
          const newTotal = currentScore + data.roundScore;

          if (!data.isSilent) {
            playPopSound();
            if (data.isManual) appendMsg(`${data.username} scored ${data.roundScore} points! | (Manual Math)`);
            else appendMsg(`${data.username} scored ${data.roundScore} points! | (Dutch: ${data.dutch}, Blitz: ${data.blitz})`);
          }

          setPlayerScores(prev => ({ ...prev, [data.username]: newTotal }));

          if (newTotal >= targetScoreRef.current && !winnerDeclared.current) {
            winnerDeclared.current = true;
            setWinner(data.username);
            appendMsg(`🏆 ${data.username} HAS WON THE GAME WITH ${newTotal} POINTS! 🏆`);
            if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 800]);
          }
        }
        else if (data.type === "ai_recap_broadcast") {
          setIsGenerating(false);
          setRecap(data.message);
        }
      } catch (e) { appendMsg(event.data); }
    };

    socket.onclose = () => {
      clearInterval(pingInterval);
      if (isInRoomRef.current && !winnerDeclared.current) {
        appendMsg(`⚠️ Connection lost. Reconnecting...`);
        setTimeout(() => { connectWebSocket(currentRoom, currentUser); }, 3000);
      }
    };
    ws.current = socket;
  };

  const joinRoom = (codeToJoin = roomCode) => {
    const cleanName = rawUsername.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!cleanName || !codeToJoin) return;

    setInactivityAlert("");
    setLastActivity(Date.now());
    setPlayerScores({}); setPlayerStatuses({}); setPlayerReady({}); setWinner(null);
    winnerDeclared.current = false; setMessages([]); setRecap("");

    const fullUsername = `${selectedEmoji} ${cleanName}`;
    setUsername(fullUsername); setRoomCode(codeToJoin);

    const loadingSalute = aiEnabled ? "💭 Mmm..." : "Listo! 🃏";
    setMyThought(loadingSalute);

    setPlayerScores(prev => ({ ...prev, [fullUsername]: prev[fullUsername] || 0 }));
    setPlayerStatuses(prev => ({ ...prev, [fullUsername]: loadingSalute }));

    sessionStorage.setItem("blitzUsername", fullUsername);
    sessionStorage.setItem("blitzRoomCode", codeToJoin);

    const newHistory = [codeToJoin, ...recentRooms.filter(r => r !== codeToJoin)].slice(0, 3);
    setRecentRooms(newHistory);
    localStorage.setItem("blitzRoomHistory", JSON.stringify(newHistory));

    setIsInRoom(true); isInRoomRef.current = true;
    connectWebSocket(codeToJoin, fullUsername);
  };

  const leaveRoom = () => {
    sessionStorage.clear();
    setIsInRoom(false); isInRoomRef.current = false;
    if (ws.current) ws.current.close();
    setMessages([]); setPlayerScores({}); setPlayerStatuses({}); setPlayerReady({});
    setWinner(null); setRawUsername(""); winnerDeclared.current = false;
  };

  const handleStatusUpdate = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && myThought.trim() !== "") {
      ws.current.send(JSON.stringify({ type: "status_update", username, status: myThought }));
    }
  };

  const kickPlayer = (playerToKick) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "kick_player", target: playerToKick }));
    }
  };

  const broadcastNewSettings = (newScore, newAi) => {
    setTargetScore(newScore); setAiEnabled(newAi);
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: "settings", targetScore: newScore, aiEnabled: newAi,
        playerScores: playerScoresRef.current, playerStatuses: playerStatusesRef.current,
        playerReady: playerReadyRef.current, winner: winnerRef.current
      }));
      const aiMsg = newAi ? '🎙️ AI ON' : '🚫 AI OFF';
      ws.current.send(JSON.stringify({ type: "system", message: `⚙️ ${username} updated the room rules: [First to ${newScore}] | [${aiMsg}]` }));
    }
    setShowSettings(false);
  };

  const toggleReady = () => {
    const newState = !playerReady[username];
    const newObj = { ...playerReadyRef.current, [username]: newState };
    setPlayerReady(newObj);

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: "settings", targetScore: targetScoreRef.current, aiEnabled: aiEnabledRef.current,
        playerScores: playerScoresRef.current, playerStatuses: playerStatusesRef.current,
        playerReady: newObj, winner: winnerRef.current
      }));
      ws.current.send(JSON.stringify({ type: "system", message: newState ? `✅ ${username} ${t.ready.isReadyMsg}` : `⏳ ${username} ${t.ready.notReadyMsg}` }));
    }
  };

  const generateAIRecap = async () => {
    setIsGenerating(true);
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const formattedScores = Object.entries(playerScores).map(([name, score]) => ({ player_name: name, total_score: score, status: playerStatuses[name] || "concentrating" }));
      ws.current.send(JSON.stringify({ type: "request_ai_recap", scores: formattedScores }));
    } else {
      setRecap("Error: No estás conectado a la sala."); setIsGenerating(false);
    }
  };

  const restartGame = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ type: "restart_game", username: username }));
  };

  const submitScore = () => {
    let roundScore = 0;
    if (isManualMath) roundScore = parseInt(manualScore) || 0;
    else { roundScore = (parseInt(dutchCards) || 0) * 1 - (parseInt(blitzCards) || 0) * 2; }
    if (ws.current && ws.current.readyState === WebSocket.OPEN && !winner) {
      ws.current.send(JSON.stringify({ type: "score", username: username, roundScore: roundScore, isManual: isManualMath, dutch: isManualMath ? 0 : parseInt(dutchCards) || 0, blitz: isManualMath ? 0 : parseInt(blitzCards) || 0 }));
      setBlitzCards(""); setDutchCards(""); setManualScore("");
    }
  };

  if (!isInRoom) {
    return (
      <Lobby t={t} rawUsername={rawUsername} setRawUsername={setRawUsername} selectedEmoji={selectedEmoji} setSelectedEmoji={setSelectedEmoji} roomCode={roomCode} setRoomCode={setRoomCode} recentRooms={recentRooms} joinRoom={joinRoom} targetScore={targetScore} setTargetScore={setTargetScore} inactivityAlert={inactivityAlert} />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-4 md:p-8 text-white flex justify-center relative">

      {/* TOAST NOTIFICATIONS */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="bg-neutral-800/90 backdrop-blur-sm text-neutral-300 text-xs md:text-sm px-4 py-2 rounded-xl shadow-2xl border border-neutral-700/50 transition-all duration-300">
            {t.msg}
          </div>
        ))}
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-4">

        {/* HEADER REDISEÑADO (Estilo Mobile App) */}
        <div className="flex flex-col border-b border-neutral-800/60 pb-5 gap-4">
          <div className="flex justify-between items-start w-full">
            <button onClick={leaveRoom} className="text-red-400 font-bold flex items-center gap-1 text-sm bg-red-900/10 px-3 py-1.5 rounded-lg hover:bg-red-900/30 transition border border-red-900/30 mt-1">
              <span className="text-lg leading-none mb-0.5">‹</span> {t.header.exit.replace('🚪 ', '')}
            </button>

            <div className="flex flex-col items-center">
              <h2 className="text-xl md:text-2xl font-black tracking-wider uppercase text-white">
                {t.header.room} <span className="text-[#fbd304]">{roomCode}</span>
              </h2>
              <div className="flex items-center gap-2 mt-1 opacity-80">
                <p className="text-[10px] md:text-xs text-neutral-400 font-medium tracking-wide">{t.header.firstTo} {targetScore}</p>
                <span className="w-1 h-1 rounded-full bg-neutral-600"></span>
                <span className="text-[10px] md:text-xs text-blue-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> {onlineCount} {t.header.online}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <button onClick={toggleLang} className="bg-neutral-800 hover:bg-neutral-700 w-8 h-8 rounded-full transition flex items-center justify-center text-sm shadow-sm border border-neutral-700">
                {lang === 'en' ? '🇺🇸' : '🇪🇸'}
              </button>
              <button onClick={() => setShowSettings(!showSettings)} className="bg-neutral-800 hover:bg-neutral-700 w-8 h-8 rounded-full transition flex items-center justify-center shadow-sm border border-neutral-700" title={t.settings.title}>
                ⚙️
              </button>
            </div>
          </div>

          <div className="flex items-center bg-neutral-900 border border-neutral-700 rounded-full px-3 py-1.5 shadow-inner w-full mt-2">
            <span className="text-sm mr-2 opacity-70">💭</span>
            <input
              type="text"
              maxLength={40}
              placeholder={t.header.thoughtPlaceholder}
              className="bg-transparent text-sm focus:outline-none flex-grow text-purple-200 placeholder-neutral-600 w-full"
              value={myThought}
              onChange={(e) => setMyThought(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleStatusUpdate(); }}
            />
            <button onClick={handleStatusUpdate} className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 py-2 rounded-full font-bold transition ml-2 tracking-wide shadow-md">
              {t.header.setBtn}
            </button>
          </div>
        </div>

        {/* LEADERBOARD */}
        <div className="flex gap-4 flex-wrap mt-2 md:mt-4 justify-center md:justify-end w-full md:w-auto">
          {Object.entries(playerScores).map(([name, score]) => {
            const isMe = name === username;
            return (
              <div key={name} className={`relative flex flex-col items-center ${isMe ? 'scale-105' : 'opacity-90'}`}>
                {playerStatuses[name] && (
                  <div className="absolute bottom-full mb-1 w-max max-w-[140px] z-10">
                    <div className="text-[11px] text-neutral-800 bg-neutral-200 px-3 py-1.5 rounded-xl text-center break-words leading-tight shadow-md border border-neutral-400 font-medium">
                      {playerStatuses[name]}
                    </div>
                    <div className="w-2 h-2 bg-neutral-200 rotate-45 border-r border-b border-neutral-400 absolute -bottom-1 left-1/2 transform -translate-x-1/2"></div>
                  </div>
                )}
                <span className={`px-4 py-1.5 text-sm font-bold border shadow-md flex items-center gap-1 rounded-full ${isMe ? 'bg-neutral-800 border-neutral-400 ring-2 ring-neutral-400' : 'bg-neutral-900 border-neutral-700'}`}>
                  <span className={getUserColor(name)}>
                    {name} {isMe && <span className="text-[10px] text-[#fbd304] font-bold ml-1 tracking-widest uppercase">{t.header.you}</span>}
                  </span>: <span className={score >= 0 ? "text-white" : "text-red-400"}>{score}</span>
                </span>
              </div>
            );
          })}
        </div>

        {showSettings && (
          <RoomSettings
            t={t} currentTargetScore={targetScore} currentAiEnabled={aiEnabled} winner={winner}
            username={username} playerScores={playerScores} getUserColor={getUserColor}
            kickPlayer={kickPlayer} onClose={() => setShowSettings(false)} onSave={broadcastNewSettings}
          />
        )}

        <ChatBox messages={messages} playerScores={playerScores} getUserColor={getUserColor} />

        <ScorePanel 
          t={t} isManualMath={isManualMath} setIsManualMath={setIsManualMath}
          manualScore={manualScore} setManualScore={setManualScore}
          blitzCards={blitzCards} setBlitzCards={setBlitzCards} dutchCards={dutchCards} setDutchCards={setDutchCards}
          winner={winner} restartGame={restartGame} submitScore={submitScore}
          playerReady={playerReady} username={username} toggleReady={toggleReady} playerScores={playerScores}
        />

        <AiRecap t={t} aiEnabled={aiEnabled} isGenerating={isGenerating} generateAIRecap={generateAIRecap} recap={recap} />
      </div>
    </div>
  );
}