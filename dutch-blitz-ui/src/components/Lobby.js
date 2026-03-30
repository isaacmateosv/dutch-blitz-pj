"use client";
import { supabase } from "../lib/supabase";
import { useState } from "react";

const EMOJIS = ["👾", "🦊", "🐶", "🐱", "🐰", "🐼", "🐯", "🐸", "🦄", "👽", "👻", "🤖", "🤡", "👹", "👑", "🔥", "🐳", "🫍", "💯", "💩", "💀", "🐢", "🐺", "🦖", "🐝"];

export default function Lobby({
    t,
    rawUsername, setRawUsername,
    selectedEmoji, setSelectedEmoji,
    roomCode, setRoomCode,
    recentRooms,
    joinRoom,
    targetScore, setTargetScore,
    inactivityAlert,
    authUser
}) {
    const [isLoginMode, setIsLoginMode] = useState(false);
    const [authAction, setAuthAction] = useState('login');
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState("");

    const handleAuth = async (e) => {
        e.preventDefault();
        setAuthLoading(true);
        setAuthError("");

        // Prevent typos during registration
        if (authAction === 'register' && password !== confirmPassword) {
            setAuthError("Passwords do not match!");
            setAuthLoading(false);
            return;
        }

        try {
            let result;
            if (authAction === 'login') {
                result = await supabase.auth.signInWithPassword({ email, password });
            } else {
                result = await supabase.auth.signUp({ email, password });
            }

            if (result.error) throw result.error;

            if (authAction === 'register') {
                setAuthError("Success! Check your email to confirm.");
            } else {
                // Clear fields on successful login
                setEmail(""); setPassword(""); setConfirmPassword("");
            }
        } catch (error) {
            // Clean up common ugly Supabase errors
            if (error.message.includes("invalid format")) setAuthError("Please enter a valid email address.");
            else if (error.message.includes("Invalid login")) setAuthError("Incorrect email or password.");
            else setAuthError(error.message);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white p-4">

            <h1 className="text-4xl font-black tracking-widest text-center mb-6 text-[#4ade80] drop-shadow-lg">
                BLITZ<span className="text-white">ROOM</span>
            </h1>

            {inactivityAlert && (
                <div className="bg-red-900/40 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm text-center font-medium shadow-lg mb-6 w-full max-w-sm animate-pulse">
                    {inactivityAlert === "timeout" ? t.lobby.inactivity : inactivityAlert}
                </div>
            )}

            <div className="bg-neutral-900 p-6 md:p-8 rounded-2xl shadow-2xl border border-neutral-800 w-full max-w-sm relative overflow-hidden">
                <h2 className="text-2xl font-black mb-6 uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                    {t.lobby.join}
                </h2>

                {/* AUTHENTICATION SECTION */}
                <div className="mb-6 p-4 bg-neutral-950 rounded-xl border border-neutral-800">
                    {authUser ? (
                        <div className="flex flex-col gap-2 items-center">
                            <span className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                                ✓ Logged in
                            </span>
                            <span className="text-xs text-neutral-500">{authUser.email}</span>
                            <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300 underline mt-1">Logout</button>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Account</span>
                                <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-[10px] text-blue-400 hover:text-blue-300 underline">
                                    {isLoginMode ? "Play as Guest" : "Login"}
                                </button>
                            </div>

                            {isLoginMode && (
                                <form onSubmit={handleAuth} className="flex flex-col gap-3 animate-fade-in mt-2">
                                    <input type="email" placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full p-3 bg-neutral-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm border border-neutral-800" />
                                    <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full p-3 bg-neutral-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm border border-neutral-800" />

                                    {/* Conditionally show Confirm Password */}
                                    {authAction === 'register' && (
                                        <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="w-full p-3 bg-neutral-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm border border-neutral-800" />
                                    )}

                                    {authError && (
                                        <span className={`text-xs text-center font-bold ${authError.includes('Success') ? 'text-emerald-400' : 'text-amber-400'}`}>
                                            {authError}
                                        </span>
                                    )}

                                    <button type="submit" disabled={authLoading} className="w-full mt-1 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-bold py-3 rounded-xl transition disabled:opacity-50">
                                        {authAction === 'login' ? 'Log In' : 'Create Account'}
                                    </button>

                                    {/* Toggle between Login and Register */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAuthAction(authAction === 'login' ? 'register' : 'login');
                                            setAuthError("");
                                        }}
                                        className="text-xs text-neutral-500 hover:text-neutral-300 mt-1 transition"
                                    >
                                        {authAction === 'login' ? "Don't have an account? Register here." : "Already have an account? Log in."}
                                    </button>
                                </form>
                            )}
                        </>
                    )}
                </div>

                {/* GAME INPUTS SECTION */}
                <div className="flex flex-col gap-4">

                    {/* Username Input */}
                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">{t.lobby.nickname}</label>
                        <div className="flex items-center gap-2">
                            <select
                                className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#fbd304] text-xl cursor-pointer"
                                value={selectedEmoji}
                                onChange={(e) => setSelectedEmoji(e.target.value)}
                            >
                                {EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                            <input
                                className="flex-1 p-3 bg-neutral-950 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#fbd304] transition placeholder-neutral-600 font-bold"
                                placeholder="Player Name"
                                value={rawUsername}
                                onChange={(e) => setRawUsername(e.target.value)}
                                maxLength={12}
                            />
                        </div>
                    </div>

                    {/* Room Code Input */}
                    <div className="flex flex-col gap-1 mt-2">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">{t.lobby.room}</label>
                        <input
                            className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#fbd304] transition placeholder-neutral-600 font-bold"
                            placeholder="Enter Code"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value.toLowerCase())}
                            autoCapitalize="none" autoCorrect="off" spellCheck="false"
                        />

                        {/* Recent Rooms */}
                        {recentRooms.length > 0 && (
                            <div className="flex gap-2 mt-2 flex-wrap">
                                {recentRooms.map(room => (
                                    <button
                                        key={room}
                                        onClick={() => joinRoom(roomCode)}
                                        className="bg-neutral-950 hover:bg-neutral-800 text-xs text-neutral-400 px-3 py-1.5 rounded-full transition border border-neutral-800 hover:border-[#005ba1]/50"
                                    >
                                        🕒 {room}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Target Score Input */}
                    <div className="flex flex-col gap-1 mt-2">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest pl-1">{t.lobby.targetScore}</label>
                        <input
                            type="number"
                            min="75"
                            className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#d22730] transition font-bold"
                            value={targetScore}
                            onChange={(e) => setTargetScore(e.target.value === "" ? "" : parseInt(e.target.value))}
                            onBlur={() => { if (targetScore === "" || targetScore < 75) setTargetScore(75); }}
                            onKeyDown={(e) => { if (['e', 'E', '+', '.', '-'].includes(e.key)) e.preventDefault(); }}
                        />
                    </div>

                    {/* Join Button */}
                    <button
                        className="w-full p-4 mt-4 bg-[#005ba1] hover:bg-blue-500 rounded-xl font-black tracking-widest uppercase transition shadow-lg text-white"
                        onClick={() => joinRoom(roomCode)}
                    >
                        {t.lobby.joinBtn}
                    </button>

                </div>
            </div>
        </div>
    );
}