import { useState, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import rickyMascot from "@/assets/ricky-mascot-nobg.png";

interface RickyHelperProps {
  currentStep?: number;
  businessId?: string | null;
}

const QUESTION_LIMIT = 25;

const RickyHelper = ({ currentStep = 1, businessId }: RickyHelperProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ricky"; text: string }[]>([
    { role: "ricky", text: "Hey! I'm Ricky, your app & marketing guide. Ask me about any feature in Ricky.AI or your business strategy! 🚀" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [limitReached, setLimitReached] = useState(false);

  // Load initial count from profile
  useEffect(() => {
    const loadCount = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("ricky_question_count, ricky_limit_reached")
        .eq("user_id", session.user.id)
        .single();
      if (data) {
        setQuestionCount(data.ricky_question_count ?? 0);
        setLimitReached(data.ricky_limit_reached ?? false);
      }
    };
    loadCount();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    if (limitReached) {
      setMessages(prev => [...prev,
        { role: "user", text: input.trim() },
        { role: "ricky", text: "You've reached Ricky's 25-question limit for now. You can still use all the tools in the app, and we'll refresh Ricky's questions again soon! 🙌" },
      ]);
      setInput("");
      return;
    }

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      const response = await supabase.functions.invoke("ricky-chat", {
        body: { message: userMsg, businessId, currentStep },
      });

      if (response.error) throw new Error(response.error.message);

      const data = response.data;
      setMessages(prev => [...prev, { role: "ricky", text: data.reply }]);

      if (data.questionCount !== undefined) setQuestionCount(data.questionCount);
      if (data.limitReached !== undefined) setLimitReached(data.limitReached);
    } catch {
      setMessages(prev => [...prev, { role: "ricky", text: "Ricky is taking a quick break while our AI service reconnects. Please try again later, or use the sidebar to keep working! 🔧" }]);
    } finally {
      setLoading(false);
    }
  };

  const remaining = Math.max(0, QUESTION_LIMIT - questionCount);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="mb-4 w-80 glass rounded-2xl shadow-glow overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-hero flex items-center justify-center">
                <img src={rickyMascot} alt="Ricky" className="w-8 h-8 object-cover object-top" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Ricky</p>
                <p className="text-[10px] text-muted-foreground">App & Marketing Guide</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{remaining}/{QUESTION_LIMIT}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
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
            {limitReached ? (
              <p className="text-[11px] text-muted-foreground text-center py-1">
                Ricky's 25 questions used. You can still use all tools in the app!
              </p>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Ask about the app or your business..."
                  className="flex-1 bg-secondary/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button size="icon" className="h-9 w-9" onClick={sendMessage} disabled={loading}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-gradient-hero flex items-center justify-center shadow-glow animate-pulse-glow hover:scale-110 transition-transform overflow-hidden"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-primary-foreground" />
        ) : (
          <img src={rickyMascot} alt="Ricky AI" className="w-12 h-12 object-cover object-top" />
        )}
      </button>
    </div>
  );
};

export default RickyHelper;
