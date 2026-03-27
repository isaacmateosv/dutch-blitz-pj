import { useEffect, useRef } from "react";

export default function ChatBox({ messages, playerScores, getUserColor }) {
  const chatRef = useRef(null);

  // Auto-scroll hacia abajo cuando llega un mensaje nuevo
  useEffect(() => { 
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); 
  }, [messages]);

  const renderMessage = (text) => {
    if (text.includes("HAS WON THE GAME")) {
      return <span className="text-amber-400 font-extrabold text-base tracking-wide drop-shadow-md">{text}</span>;
    }

    let userColor = "text-white";
    const players = Object.keys(playerScores);
    const sender = players.find(p => text.includes(p));
    
    if (sender) userColor = getUserColor(sender);

    if (text.includes(" | ")) {
      const parts = text.split(" | ");
      if (sender && parts[0].startsWith(sender)) {
         const actionText = parts[0].substring(sender.length).trim();
         return (
           <>
             <span className={`font-bold ${userColor}`}>{sender}</span>
             <span className="font-bold text-neutral-200 ml-1">{actionText}</span>
             <span className="font-mono text-neutral-500 text-[11px] ml-2">{parts[1]}</span>
           </>
         );
      }
      
      return (
        <>
          <span className={`font-bold ${userColor}`}>{parts[0]}</span>
          <span className="font-mono text-neutral-500 text-[11px] ml-2">{parts[1]}</span>
        </>
      );
    }
    return <span className={sender ? userColor : "text-neutral-300"}>{text}</span>;
  };

  return (
    <div ref={chatRef} className="bg-neutral-900 h-48 md:h-80 rounded-xl border border-neutral-800/60 p-4 overflow-y-auto shadow-inner flex flex-col gap-2">
      {messages.map((msg) => {
        const text = typeof msg === 'string' ? msg : msg.text;
        const key = typeof msg === 'string' ? Math.random() : msg.id;
        const count = typeof msg === 'string' ? 1 : (msg.count || 1);
        
        const isSystemEvent = text.includes("joined") || text.includes("left") || text.includes("restarted");

        if (isSystemEvent) {
          const cleanText = text.replace('🟢 ', '').replace('🔴 ', '');
          return (
            <div key={key} className="w-full flex justify-center my-1 opacity-80">
              <span className="text-xs text-neutral-400 bg-neutral-950 px-5 py-2 rounded-full border border-neutral-800/80 shadow-sm flex items-center">
                {cleanText} 
                {count > 1 && <span className="font-bold ml-2 bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded text-[10px]">x{count}</span>}
              </span>
            </div>
          );
        }

        return (
          <div key={key} className="p-3 rounded-xl w-fit max-w-[90%] md:max-w-[80%] text-sm md:text-base bg-neutral-800/50 border border-neutral-700/50 shadow-sm flex items-center">
            {renderMessage(text)}
            
            {count > 1 && (
              <span className="ml-2 bg-neutral-700 text-white font-bold text-[10px] px-1.5 py-0.5 rounded-full">
                x{count}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}