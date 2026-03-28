export default function ScorePanel({
  t,
  isManualMath, setIsManualMath,
  manualScore, setManualScore,
  blitzCards, setBlitzCards,
  dutchCards, setDutchCards,
  winner,
  restartGame,
  submitScore,
  playerReady,   // <-- Recibimos props
  username,      // <-- Recibimos props
  toggleReady,   // <-- Recibimos props
  playerScores   // <-- Recibimos props
}) {

  // Lógica de validación
  const players = Object.keys(playerScores);
  const isEveryoneReady = players.length > 0 && players.every(p => playerReady[p]);
  const amIReady = playerReady[username];

  // SI NO ESTÁN TODOS LISTOS (Y NADIE HA GANADO AÚN), MOSTRAMOS LA SALA DE ESPERA
  if (!isEveryoneReady && !winner) {
    return (
      <div className="bg-neutral-900 p-6 rounded-xl border border-blue-900/50 shadow-lg flex flex-col items-center justify-center gap-4 text-center">
        <h3 className="text-xl font-bold text-blue-400">{t.ready.waiting}</h3>

        <div className="flex gap-3 flex-wrap justify-center my-2">
          {players.map(p => (
            <span key={p} className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm transition-all ${playerReady[p] ? 'bg-green-900/40 text-green-400 border border-green-800/50' : 'bg-neutral-800 text-neutral-500 border border-neutral-700'}`}>
              {playerReady[p] ? '✅' : '⏳'} {p}
            </span>
          ))}
        </div>

        <button
          onClick={toggleReady}
          className={`mt-2 px-8 py-3 rounded-xl font-extrabold transition-all shadow-lg border ${amIReady ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border-neutral-700' : 'bg-[#005ba1] hover:bg-blue-500 text-white border-blue-400/30 animate-pulse'}`}
        >
          {amIReady ? t.ready.cancel : t.ready.imReady}
        </button>
      </div>
    );
  }

  // SI TODOS ESTÁN LISTOS, RETORNAMOS EL PANEL DE PUNTAJES NORMAL:
  return (
    <div className={`flex flex-col gap-4 w-full bg-neutral-900 p-4 rounded-xl border transition ${winner ? 'border-amber-500/50 shadow-lg shadow-amber-900/20' : 'border-neutral-800/60'}`}>
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-1">
        <span className="text-sm font-bold text-neutral-400">{t.score.inputMethod}</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" className="sr-only peer" checked={isManualMath} onChange={(e) => setIsManualMath(e.target.checked)} disabled={!!winner} />
          <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2a7a40]"></div>
          <span className="ml-3 text-sm font-medium text-neutral-300">{isManualMath ? t.score.manualMath : t.score.autoMath}</span>
        </label>
      </div>

      {/* 🔥 FIX: Changed to flex-row and items-end to keep everything on one horizontal line */}
      <div className="flex flex-row items-end gap-2 w-full">
        {!isManualMath ? (
          <>
            <div className="flex-1">
              <label className="block text-[10px] md:text-xs text-neutral-400 mb-1 truncate">{t.score.blitzLeft}</label>
              <input
                type="number"
                className="w-full p-3 bg-neutral-950 rounded-lg border border-red-900/50 focus:border-red-500 text-red-400 font-bold disabled:opacity-50"
                value={blitzCards}
                onChange={(e) => setBlitzCards(e.target.value)}
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '.'].includes(e.key)) e.preventDefault();
                  if (e.key === 'Enter') submitScore(); // 🔥 FIX: Enter key triggers submit
                }}
                placeholder="0"
                disabled={!!winner}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] md:text-xs text-neutral-400 mb-1 truncate">{t.score.dutchPlayed}</label>
              <input
                type="number"
                className="w-full p-3 bg-neutral-950 rounded-lg border border-emerald-900/50 focus:border-emerald-500 text-emerald-400 font-bold disabled:opacity-50"
                value={dutchCards}
                onChange={(e) => setDutchCards(e.target.value)}
                onKeyDown={(e) => {
                  if (['e', 'E', '+', '.'].includes(e.key)) e.preventDefault();
                  if (e.key === 'Enter') submitScore(); // 🔥 FIX: Enter key triggers submit
                }}
                placeholder="0"
                disabled={!!winner}
              />
            </div>
          </>
        ) : (
          <div className="flex-1">
            <label className="block text-[10px] md:text-xs text-neutral-400 mb-1">{t.score.totalRound}</label>
            <input
              type="number"
              className="w-full p-3 bg-neutral-950 rounded-lg border border-emerald-900/50 focus:border-emerald-500 text-emerald-400 font-bold disabled:opacity-50"
              value={manualScore}
              onChange={(e) => setManualScore(e.target.value)}
              onKeyDown={(e) => {
                if (['e', 'E', '+', '.'].includes(e.key)) e.preventDefault();
                if (e.key === 'Enter') submitScore(); // 🔥 FIX: Enter key triggers submit
              }}
              placeholder="e.g. 14 or -4"
              disabled={!!winner}
            />
          </div>
        )}

        {/* 🔥 FIX: Button is now a fixed width on the right side */}
        <div className="shrink-0 w-24 md:w-32">
          {winner ? (
            <button className="w-full p-3 h-[50px] rounded-lg font-bold transition shadow-lg bg-[#005ba1] hover:bg-blue-500 text-white text-xs md:text-sm" onClick={restartGame}>
              {t.score.rematchBtn}
            </button>
          ) : (
            <button className="w-full p-3 h-[50px] rounded-lg font-bold transition shadow-lg bg-[#4ade80] hover:bg-green-400 text-black text-xs md:text-sm" onClick={submitScore} disabled={!!winner}>
              {t.score.submitBtn}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}