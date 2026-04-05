"use client";
import { useState, useEffect, useRef } from "react";
import { useToast } from "../contexts/ToastContext";
import confetti from "canvas-confetti";
import { supabase } from "../lib/supabase";

export function useGameEngine(
    username, setUsername,
    roomCode, setRoomCode,
    isInRoom, setIsInRoom,
    setMyThought,
    recentRooms, setRecentRooms,
    fetchHistory, setInactivityAlert,
    INACTIVITY_LIMIT = 15 * 60 * 1000,
    t
) {
    const { showToast } = useToast();
    const ws = useRef(null);

    const [targetScore, setTargetScore] = useState(75);
    const [authUser, setAuthUser] = useState(null);

    const [suggestedThought, setSuggestedThought] = useState("");

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
    const [mentalScore, setMentalScore] = useState("");
    const [blitzCards, setBlitzCards] = useState("");
    const [dutchCards, setDutchCards] = useState("");
    const [recap, setRecap] = useState("");
    const [lastSubmittedScore, setLastSubmittedScore] = useState(null);
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
                parsedStatuses[savedUser] = t?.system?.contacting || "...";
                setPlayerStatuses(parsedStatuses);
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

            setMyThought("");
            setSuggestedThought(t?.system?.contacting || "...");

            connectWebSocket(savedRoom, savedUser);
            fetchHistory(savedRoom);
        }
    }, []);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setAuthUser(session?.user || null);
        };

        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setAuthUser(session?.user || null);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        let wakeLock = null;
        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    wakeLock = await navigator.wakeLock.request('screen');
                }
            } catch (err) {
                console.log("Wake Lock error:", err.message);
            }
        };

        if (isInRoom) {
            requestWakeLock();
        }

        const handleVisibilityChange = () => {
            if (wakeLock !== null && document.visibilityState === 'visible' && isInRoom) {
                requestWakeLock();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (wakeLock !== null) wakeLock.release();
        };
    }, [isInRoom]);

    const playSound = (score) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (score >= 0) {
                osc.type = "sine";
                osc.frequency.setValueAtTime(600, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.1);
            } else {
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(200, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.3);
            }
        } catch (e) { console.log("Audio not supported"); }
    };

    const playPartyHorn = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;

            const playBlast = (time, duration) => {
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const gain = ctx.createGain();

                osc1.type = "sawtooth";
                osc1.frequency.value = 350;
                osc2.type = "square";
                osc2.frequency.value = 355;

                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(ctx.destination);

                gain.gain.setValueAtTime(0, time);
                gain.gain.linearRampToValueAtTime(0.15, time + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

                osc1.start(time);
                osc2.start(time);
                osc1.stop(time + duration);
                osc2.stop(time + duration);
            };

            playBlast(now, 0.2);
            playBlast(now + 0.25, 0.2);
            playBlast(now + 0.5, 0.8);
        } catch (e) { console.log("Audio not supported"); }
    };

    const playRoundStartSound = () => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();

            const playDing = (delay) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.type = "sine";
                osc.frequency.setValueAtTime(850, ctx.currentTime + delay);
                osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + delay + 0.6);

                gain.gain.setValueAtTime(0, ctx.currentTime + delay);
                gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + delay + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.6);

                osc.start(ctx.currentTime + delay);
                osc.stop(ctx.currentTime + delay + 0.6);
            };

            playDing(0);
            playDing(0.15);
        } catch (e) { console.log("Audio not supported"); }
    };

    const connectWebSocket = (currentRoom = roomCode, currentUser = username) => {
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://${window.location.hostname}:8000`;
        const emailQuery = authUser?.email ? `?email=${encodeURIComponent(authUser.email)}` : "";
        const socket = new WebSocket(`${wsUrl}/ws/${currentRoom}/${currentUser}${emailQuery}`);

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

                if (data.type !== "pong" && data.type !== "request_settings") {
                    setLastActivity(Date.now());
                }

                if (data.type === "ai_suggestion") {
                    if (data.username === currentUser) {
                        setSuggestedThought(data.suggestion);
                        setPlayerStatuses(prev => ({ ...prev, [currentUser]: data.suggestion }));
                    }
                }
                else if (data.type === "system") {
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
                    // 🔥 FIX: Eliminado el setMyThought que forzaba el input a llenarse
                    setPlayerStatuses(prev => ({ ...prev, [data.username]: data.status }));
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

                    // 🔥 FIX: Le borramos la memoria al botón para que 
                    // sea IMPOSIBLE deshacer un puntaje de la partida anterior.
                    setLastSubmittedScore(null);

                    appendMsg(`🔄 ${data.username} restarted the game! All scores reset to 0.`);
                    playRoundStartSound();
                }

                else if (data.type === "score") {
                    const currentScore = playerScoresRef.current[data.username] || 0;
                    const newTotal = currentScore + data.roundScore;

                    if (!data.isSilent) {
                        playSound(data.roundScore);
                        appendMsg(`${data.username} scored ${data.roundScore} points! | ${data.isManual ? '(Mental Math)' : `(Dutch: ${data.dutch}, Blitz: ${data.blitz})`}`);
                    }

                    setPlayerScores(prev => ({ ...prev, [data.username]: newTotal }));

                    if (newTotal >= targetScoreRef.current && !winnerDeclared.current) {
                        winnerDeclared.current = true;
                        setWinner(data.username);
                        appendMsg(`🏆 ${data.username} HAS WON THE GAME WITH ${newTotal} POINTS! 🏆`);
                        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 800]);

                        confetti({
                            particleCount: 150,
                            spread: 80,
                            origin: { y: 0.6 },
                            colors: ['#4ade80', '#fbd304', '#005ba1', '#d22730']
                        });
                    }
                }
                else if (data.type === "undo_score") {
                    const currentScore = playerScoresRef.current[data.username] || 0;
                    const newTotal = currentScore - data.undoneScore;

                    appendMsg(`⏪ ${data.username} undid their last score (${data.undoneScore} pts)`);
                    setPlayerScores(prev => ({ ...prev, [data.username]: newTotal }));

                    if (winnerRef.current === data.username && newTotal < targetScoreRef.current) {
                        setWinner(null);
                        winnerDeclared.current = false;
                        appendMsg(`⚠️ The win has been revoked! Game continues.`);
                    }
                }
                else if (data.type === "ai_recap_broadcast") {
                    setIsGenerating(false);
                    setRecap(data.message);
                    playPartyHorn();
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

        setMyThought("");
        setSuggestedThought(t?.system?.contacting || "...");

        setPlayerScores(prev => ({ ...prev, [fullUsername]: prev[fullUsername] || 0 }));
        setPlayerStatuses(prev => ({
            ...prev,
            [fullUsername]: t?.system?.contacting || "..."
        }));

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
        } catch (error) {
            console.warn("Aviso silencioso: Error de guardado de Recap, pero el juego sigue.");
        }

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
        let roundScore = isManualMath ? parseInt(mentalScore) || 0 : (parseInt(dutchCards) || 0) * 1 - (parseInt(blitzCards) || 0) * 2;
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: "score", username: username, roundScore: roundScore, isManual: isManualMath, dutch: isManualMath ? 0 : parseInt(dutchCards) || 0, blitz: isManualMath ? 0 : parseInt(blitzCards) || 0 }));
            setLastSubmittedScore(roundScore);
            setBlitzCards(""); setDutchCards(""); setMentalScore("");
        }
    };

    const undoScore = () => {
        if (lastSubmittedScore === null) return;
        setLastActivity(Date.now());
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: "undo_score", username: username, undoneScore: lastSubmittedScore }));
            setLastSubmittedScore(null);
        }
    };

    const destroyRoom = () => {
        if (!confirm("Are you sure? This will permanently delete the room and all its history for everyone.")) return;

        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: "room_deleted" }));
        }

        leaveRoom();

        try {
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || `http://localhost:8000`;
            fetch(`${apiBaseUrl}/rooms/${roomCode}`, { method: "DELETE" });
        } catch (error) {
            console.error("Failed to delete room:", error);
        }
    };

    return {
        playerScores, playerStatuses, playerReady, winner,
        isManualMath, setIsManualMath, mentalScore, setMentalScore,
        blitzCards, setBlitzCards, dutchCards, setDutchCards,
        targetScore, setTargetScore, aiEnabled, setAiEnabled,
        recap, isGenerating, onlineCount, messages,
        lastActivity,
        lastSubmittedScore, undoScore,
        joinRoom, leaveRoom, handleStatusUpdate, kickPlayer, destroyRoom,
        broadcastNewSettings, toggleReady, generateAIRecap, restartGame, submitScore,
        suggestedThought, setSuggestedThought,
        authUser
    };
}