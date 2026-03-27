export default function ScorePanel({
  isManualMath, setIsManualMath,
  manualScore, setManualScore,
  blitzCards, setBlitzCards,
  dutchCards, setDutchCards,
  winner,
  restartGame,
  submitScore
}) {
  return (
    <div className={`flex flex-col gap-4 w-full bg-neutral-900 p-4 rounded-xl border transition ${winner ? 'border-amber-500/50 shadow-lg shadow-amber-900/20' : 'border-neutral-800/60'}`}>
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-1">
        <span className="text-sm font-bold text-neutral-400">Score Input Method</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={isManualMath} onChange={(e) => setIsManualMath(e.target.checked)} disabled={!!winner} />
          <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2a7a40]"></div>
          <span className="ml-3 text-sm font-medium text-neutral-300">{isManualMath ? "Manual Math" : "Calculate for me"}</span>
        </label>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {!isManualMath ? (
          <>
            <div className="flex-1 w-full">
              <label className="block text-sm text-neutral-400 mb-1">Blitz Cards Left (-2)</label>
              <input 
                type="number" 
                className="w-full p-3 bg-neutral-950 rounded-lg border border-red-900/50 focus:border-red-500 text-red-400 font-bold disabled:opacity-50" 
                value={blitzCards} 
                onChange={(e) => setBlitzCards(e.target.value)} 
                onKeyDown={(e) => { if (['e', 'E', '+', '.'].includes(e.key)) e.preventDefault(); }}
                placeholder="0" 
                disabled={!!winner} 
              />
            </div>
            <div className="flex-1 w-full">
              <label className="block text-sm text-neutral-400 mb-1">Dutch Cards Played (+1)</label>
              <input 
                type="number" 
                className="w-full p-3 bg-neutral-950 rounded-lg border border-emerald-900/50 focus:border-emerald-500 text-emerald-400 font-bold disabled:opacity-50" 
                value={dutchCards} 
                onChange={(e) => setDutchCards(e.target.value)} 
                onKeyDown={(e) => { if (['e', 'E', '+', '.'].includes(e.key)) e.preventDefault(); }}
                placeholder="0" 
                disabled={!!winner} 
              />
            </div>
          </>
        ) : (
          <div className="flex-1 w-full">
            <label className="block text-sm text-neutral-400 mb-1">Total Round Score</label>
            <input 
              type="number" 
              className="w-full p-3 bg-neutral-950 rounded-lg border border-emerald-900/50 focus:border-emerald-500 text-emerald-400 font-bold disabled:opacity-50" 
              value={manualScore} 
              onChange={(e) => setManualScore(e.target.value)} 
              onKeyDown={(e) => { if (['e', 'E', '+', '.'].includes(e.key)) e.preventDefault(); }}
              placeholder="e.g. 14 or -4" 
              disabled={!!winner} 
            />
          </div>
        )}

        <div className="flex items-end w-full md:w-auto mt-2 md:mt-0 gap-2">
          {winner && (
            <button className="w-full md:w-auto p-3 px-6 h-[50px] rounded-lg font-bold transition shadow-lg bg-[#005ba1] hover:bg-blue-500 text-white" onClick={restartGame}>
              🔄 REMATCH
            </button>
          )}
          <button className={`w-full md:w-auto p-3 px-8 h-[50px] rounded-lg font-bold transition shadow-lg ${winner ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed border border-neutral-700' : 'bg-[#4ade80] hover:bg-green-400 text-black'}`} onClick={submitScore} disabled={!!winner}>
            {winner ? "GAME OVER" : "SUBMIT"}
          </button>
        </div>
      </div>
    </div>
  );
}