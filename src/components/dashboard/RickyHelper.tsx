import { useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import rickyMascot from "@/assets/ricky-mascot-nobg.png";

interface RickyHelperProps {
  currentStep?: number;
  businessId?: string | null;
}

const RickyHelper = ({ currentStep = 1, businessId }: RickyHelperProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ricky"; text: string }[]>([
    { role: "ricky", text: "Hey! I'm Ricky, your proactive growth guide. I'll help you through every step. Ask me anything! 🚀" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      const response = await supabase.functions.invoke("ricky-chat", {
        body: { message: userMsg, businessId, currentStep },
      });

      if (response.error) throw new Error(response.error.message);
      setMessages(prev => [...prev, { role: "ricky", text: response.data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "ricky", text: "Sorry, I'm having trouble right now. Try again in a moment! 🔧" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="mb-4 w-80 glass rounded-2xl shadow-glow overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-hero flex items-center justify-center">
                <span className="text-xs font-bold text-primary-foreground">R</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Ricky</p>
                <p className="text-[10px] text-muted-foreground">AI Growth Guide</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-4 max-h-72 overflow-y-auto space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`${msg.role === "ricky" ? "bg-secondary/50 rounded-xl p-3" : "bg-primary/10 rounded-xl p-3 ml-6"}`}>
                <p className="text-sm text-secondary-foreground leading-relaxed">{msg.text}</p>
              </div>
            ))}
            {loading && (
              <div className="bg-secondary/50 rounded-xl p-3">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Ask Ricky anything..."
                className="flex-1 bg-secondary/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <Button size="icon" className="h-9 w-9" onClick={sendMessage} disabled={loading}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-gradient-hero flex items-center justify-center shadow-glow animate-pulse-glow hover:scale-110 transition-transform"
      >
        {isOpen ? <X className="w-6 h-6 text-primary-foreground" /> : <MessageCircle className="w-6 h-6 text-primary-foreground" />}
      </button>
    </div>
  );
};

export default RickyHelper;
