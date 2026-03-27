import { useState } from "react";

export default function RoomSettings({
    t, // <--- RECIBE LA TRADUCCIÓN
    currentTargetScore, currentAiEnabled,
    winner, username, playerScores,
    getUserColor, kickPlayer,
    onClose, onSave
}) {
    const [draftScore, setDraftScore] = useState(currentTargetScore);
    const [draftAi, setDraftAi] = useState(currentAiEnabled);

    return (
        <div className="bg-neutral-900 border border-neutral-700 p-4 rounded-xl flex flex-col gap-4 shadow-lg">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                <h3 className="font-bold text-white flex items-center gap-2">{t.settings.title}</h3>
                <button onClick={onClose} className="bg-neutral-800 hover:bg-red-900/50 text-neutral-400 hover:text-red-400 rounded-full w-8 h-8 flex items-center justify-center transition" title="Close Settings">
                    ✕
                </button>
            </div>

            <div className="flex flex-col gap-3 border-b border-neutral-800 pb-4">

                <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-neutral-300">{t.settings.aiFeatures}</label>
                    <input type="checkbox" className="w-5 h-5 accent-purple-500 rounded cursor-pointer" checked={draftAi} onChange={(e) => setDraftAi(e.target.checked)} disabled={!!winner} />
                </div>

                <div className="flex flex-col gap-1 mt-2">
                    <label className="text-xs text-neutral-500 uppercase tracking-wider">{t.lobby.targetScore}</label>
                    <input
                        type="number"
                        min="75"
                        className="p-2 bg-neutral-950 rounded focus:outline-none focus:ring-1 focus:ring-[#4ade80] transition text-sm font-bold"
                        value={draftScore}
                        onChange={(e) => setDraftScore(e.target.value === "" ? "" : parseInt(e.target.value))}
                        onBlur={() => { if (draftScore === "" || draftScore < 75) setDraftScore(75); }}
                        onKeyDown={(e) => { if (['e', 'E', '+', '.', '-'].includes(e.key)) e.preventDefault(); }}
                        disabled={!!winner}
                    />
                </div>

                <div className="bg-amber-900/30 border border-amber-500/50 text-amber-200 p-2 rounded text-xs text-center mt-2">
                    {t.settings.warning}
                </div>

                <button
                    className="bg-neutral-800 hover:bg-[#4ade80] hover:text-black text-white text-sm font-bold p-2 rounded transition mt-1"
                    onClick={() => onSave(draftScore, draftAi)}
                    disabled={!!winner}
                >
                    {t.settings.saveBtn}
                </button>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-xs text-neutral-500 uppercase tracking-wider">{t.settings.managePlayers}</label>
                <div className="bg-neutral-950 p-2 rounded-lg border border-neutral-800 flex flex-col gap-1 max-h-32 overflow-y-auto">
                    {Object.keys(playerScores).length === 0 ? (
                        <span className="text-xs text-neutral-600 italic">{t.settings.noPlayers}</span>
                    ) : (
                        Object.keys(playerScores).map(player => (
                            <div key={player} className="flex justify-between items-center bg-neutral-900 px-3 py-1.5 rounded">
                                <span className={`text-sm ${getUserColor(player)}`}>{player}</span>
                                {player !== username ? (
                                    <button onClick={() => kickPlayer(player)} className="text-xs bg-red-900/40 hover:bg-red-600 text-red-200 px-2 py-1 rounded transition border border-red-900/50">
                                        {t.settings.kickBtn}
                                    </button>
                                ) : (
                                    <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">{t.header.you}</span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}