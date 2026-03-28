"use client";
import { useState, useEffect, useRef } from "react";
import { useToast } from "../contexts/ToastContext";
import confetti from "canvas-confetti";

export function useGameEngine(
    username, setUsername,
    roomCode, setRoomCode,
    isInRoom, setIsInRoom,
    setMyThought,
    recentRooms, setRecentRooms,
    fetchHistory, setInactivityAlert,
    INACTIVITY_LIMIT = 15 * 60 * 1000
) {
    const { showToast } = useToast();
    const ws = useRef(null);

    // ✅ FIXED: Moved missing states and refs from page.js into the Engine
    const [targetScore, setTargetScore] = useState(75);
    const targetScoreRef = useRef(75);
    const [aiEnabled, setAiEnabled] = useState(true);
    const aiEnabledRef = useRef(true);
    const isInRoomRef = useRef(false);

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
    const [onlineCount, setOnlineCount] = useState(1);
    const [messages, setMessages] = useState([]);
    const [lastActivity, setLastActivity] = useState(Date.now());

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

        if (savedUser && savedRoom) {
            setUsername(savedUser);
            setRoomCode(savedRoom);

            const savedAiEnabled = sessionStorage.getItem("blitzAiEnabled");
            if (savedAiEnabled) setAiEnabled(JSON.parse(savedAiEnabled));

            const savedScores = sessionStorage.getItem("blitzScores");
            if (savedScores) setPlayerScores(JSON.parse(savedScores));

            const savedReady = sessionStorage.getItem("blitzReady");
            if (savedReady) setPlayerReady(JSON.parse(savedReady));

            const savedStatuses = sessionStorage.getItem("blitzStatuses");
            if (savedStatuses) {
                const parsedStatuses = JSON.parse(savedStatuses);
                setPlayerStatuses(parsedStatuses);
                if (parsedStatuses[savedUser]) setMyThought(parsedStatuses[savedUser]);
            }

            const savedMessages = sessionStorage.getItem("blitzMessages");
            if (savedMessages) {
                const parsed = JSON.parse(savedMessages);
                setMessages(parsed.map(m => typeof m === 'string' ? { id: Math.random().toString(), text: m, count: 1 } : { ...m, count: m.count || 1 }));
            }

            const savedRules = sessionStorage.getItem("blitzRules");
            if (savedRules) setTargetScore(JSON.parse(savedRules).targetScore);

            const savedWinner = sessionStorage.getItem("blitzWinner");
            if (savedWinner) {
                setWinner(savedWinner);
                winnerDeclared.current = true;
            }

            setIsInRoom(true);
            isInRoomRef.current = true;
            connectWebSocket(savedRoom, savedUser);
        }
    }, []);

    const playPopSound = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) { console.log("Audio not supported"); }
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
                    if (data.message.includes("joined") || data.message.includes("left")) showToast(data.message.replace('🟢 ', '').replace('🔴 ', ''));
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
                    setPlayerScores(prev => { const n = { ...prev }; delete n[data.target]; return n; });
                    setPlayerStatuses(prev => { const n = { ...prev }; delete n[data.target]; return n; });
                    setPlayerReady(prev => { const n = { ...prev }; delete n[data.target]; return n; });
                }
                else if (data.type === "room_deleted") {
                    showToast("🚨 The room was permanently deleted!");
                    leaveRoom();
                }
                else if (data.type === "restart_game") {
                    setPlayerScores(prev => {
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
                        appendMsg(`${data.username} scored ${data.roundScore} points! | ${data.isManual ? '(Manual Math)' : `(Dutch: ${data.dutch}, Blitz: ${data.blitz})`}`);
                    }

                    setPlayerScores(prev => ({ ...prev, [data.username]: newTotal }));

                    if (newTotal >= targetScoreRef.current && !winnerDeclared.current) {
                        winnerDeclared.current = true;
                        setWinner(data.username);
                        appendMsg(`🏆 ${data.username} HAS WON THE GAME WITH ${newTotal} POINTS! 🏆`);
                        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 800]);

                        // 🔥 NUEVO: EXPLOSIÓN DE CONFETI PREMIUM CON LOS COLORES DE TU APP
                        confetti({
                            particleCount: 150,
                            spread: 80,
                            origin: { y: 0.6 },
                            colors: ['#4ade80', '#fbd304', '#005ba1', '#d22730']
                        });
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

    // ✅ FIXED: Brought joinRoom and leaveRoom into the engine so they can control the socket
    const joinRoom = (rawUsername, selectedEmoji, codeToJoin = roomCode) => {
        const cleanName = rawUsername.trim().replace(/\s+/g, ' ').toLowerCase();
        if (!cleanName || !codeToJoin) return;

        setInactivityAlert("");
        setLastActivity(Date.now());
        setPlayerScores({}); setPlayerStatuses({}); setPlayerReady({}); setWinner(null);
        winnerDeclared.current = false; setMessages([]); setRecap("");

        const fullUsername = `${selectedEmoji} ${cleanName}`;
        setUsername(fullUsername);
        setRoomCode(codeToJoin);

        const loadingSalute = aiEnabledRef.current ? "💭 Mmm..." : "Listo! 🃏";
        setMyThought(loadingSalute);

        setPlayerScores(prev => ({ ...prev, [fullUsername]: prev[fullUsername] || 0 }));
        setPlayerStatuses(prev => ({ ...prev, [fullUsername]: loadingSalute }));

        sessionStorage.setItem("blitzUsername", fullUsername);
        sessionStorage.setItem("blitzRoomCode", codeToJoin);

        const newHistory = [codeToJoin, ...recentRooms.filter(r => r !== codeToJoin)].slice(0, 3);
        setRecentRooms(newHistory);
        localStorage.setItem("blitzRoomHistory", JSON.stringify(newHistory));

        setIsInRoom(true);
        isInRoomRef.current = true;
        connectWebSocket(codeToJoin, fullUsername);
        fetchHistory(codeToJoin);
    };

    const leaveRoom = () => {
        sessionStorage.clear();
        setIsInRoom(false);
        isInRoomRef.current = false;
        if (ws.current) ws.current.close();
        setMessages([]); setPlayerScores({}); setPlayerStatuses({}); setPlayerReady({});
        setWinner(null); winnerDeclared.current = false;
    };

    // ✅ FIXED: We pass the exact thought as an argument now to avoid scope issues
    const handleStatusUpdate = (thoughtText) => {
        setLastActivity(Date.now());
        if (ws.current && ws.current.readyState === WebSocket.OPEN && thoughtText.trim() !== "") {
            ws.current.send(JSON.stringify({ type: "status_update", username, status: thoughtText }));
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
    };

    const toggleReady = (readyMsg, notReadyMsg) => {
        setLastActivity(Date.now());
        const newState = !playerReady[username];
        const newObj = { ...playerReadyRef.current, [username]: newState };
        setPlayerReady(newObj);

        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: "settings", targetScore: targetScoreRef.current, aiEnabled: aiEnabledRef.current,
                playerScores: playerScoresRef.current, playerStatuses: playerStatusesRef.current,
                playerReady: newObj, winner: winnerRef.current
            }));
            ws.current.send(JSON.stringify({ type: "system", message: newState ? `✅ ${username} ${readyMsg}` : `⏳ ${username} ${notReadyMsg}` }));
        }
    };

    const generateAIRecap = async () => {
        setLastActivity(Date.now());
        setIsGenerating(true);

        const formattedScores = Object.entries(playerScores).map(([name, score]) => ({
            player_name: name,
            total_score: score,
            status: playerStatuses[name] || "concentrating"
        }));

        try {
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || `http://localhost:8000`;
            const response = await fetch(`${apiBaseUrl}/game/recap/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ room_code: roomCode, scores: formattedScores })
            });
            fetchHistory();
        } catch (error) { console.error("🚨 DB save failed, but game continues:", error); }

        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: "request_ai_recap", scores: formattedScores }));
        } else {
            setRecap("Error: You are not connected to the room anymore.");
            setIsGenerating(false);
        }
    };

    const restartGame = () => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ type: "restart_game", username: username }));
    };

    const submitScore = () => {
        setLastActivity(Date.now());
        let roundScore = isManualMath ? parseInt(manualScore) || 0 : (parseInt(dutchCards) || 0) * 1 - (parseInt(blitzCards) || 0) * 2;
        if (ws.current && ws.current.readyState === WebSocket.OPEN && !winner) {
            ws.current.send(JSON.stringify({ type: "score", username: username, roundScore: roundScore, isManual: isManualMath, dutch: isManualMath ? 0 : parseInt(dutchCards) || 0, blitz: isManualMath ? 0 : parseInt(blitzCards) || 0 }));
            setBlitzCards(""); setDutchCards(""); setManualScore("");
        }
    };

    const destroyRoom = async () => {
        if (!confirm("Are you sure? This will permanently delete the room and all its history for everyone.")) return;

        try {
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || `http://localhost:8000`;
            await fetch(`${apiBaseUrl}/rooms/${roomCode}`, { method: "DELETE" });

            // Avisamos a todos los demás conectados que la sala murió
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({ type: "room_deleted" }));
            }
            leaveRoom(); // Nos salimos nosotros mismos
        } catch (error) { console.error("Failed to delete room:", error); }
    };

    return {
        playerScores, playerStatuses, playerReady, winner,
        isManualMath, setIsManualMath, manualScore, setManualScore,
        blitzCards, setBlitzCards, dutchCards, setDutchCards,
        targetScore, setTargetScore, aiEnabled, setAiEnabled,
        recap, isGenerating, onlineCount, messages,
        lastActivity,
        joinRoom, leaveRoom, handleStatusUpdate, kickPlayer, destroyRoom,
        broadcastNewSettings, toggleReady, generateAIRecap, restartGame, submitScore
    };
}