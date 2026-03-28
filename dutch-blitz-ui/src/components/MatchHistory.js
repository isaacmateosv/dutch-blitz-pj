export default function MatchHistory({ t, history, getUserColor }) {
    if (!history || history.length === 0) return null;

    return (
        <div className="mt-6 bg-neutral-900/40 rounded-xl border border-neutral-800 p-5 shadow-inner">
            <h3 className="text-sm font-black text-neutral-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <span>📜</span> {t.history?.title || "Match History"}
            </h3>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {history.map((entry, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-neutral-950/50 p-3 rounded-lg border border-neutral-800/50">
                        <div className="flex flex-col">
                            <span className={`text-sm font-bold ${getUserColor(entry.player_name)}`}>
                                {entry.player_name}
                            </span>
                            <span className="text-[10px] text-neutral-600 uppercase">Round {entry.round_number}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-emerald-400 font-black text-lg">{entry.total_score}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}