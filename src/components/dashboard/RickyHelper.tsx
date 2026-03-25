import { useState } from "react";
import { X, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const RickyHelper = () => {
  const [isOpen, setIsOpen] = useState(false);

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
          <div className="p-4 max-h-72 overflow-y-auto">
            <div className="bg-secondary/50 rounded-xl p-3 mb-3">
              <p className="text-sm text-secondary-foreground leading-relaxed">
                Hey! I'm Ricky, your proactive growth guide. Connect your AI provider to activate me fully.
                I'll guide you through every step and help you build a killer local strategy. 🚀
              </p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Connect Claude, Gemini, or ChatGPT to unlock live guidance
            </p>
          </div>
          <div className="p-3 border-t border-border">
            <input
              type="text"
              placeholder="Ask Ricky anything..."
              className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              disabled
            />
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-gradient-hero flex items-center justify-center shadow-glow animate-pulse-glow hover:scale-110 transition-transform"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-primary-foreground" />
        ) : (
          <MessageCircle className="w-6 h-6 text-primary-foreground" />
        )}
      </button>
    </div>
  );
};

export default RickyHelper;
