import { useState, useRef, useEffect } from "react";
import { Send, Loader2, FileText, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };

interface Props {
  businessId: string | null;
  locationId: string | null;
  onComplete?: () => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/grant-consultant`;

const GrantConsultantStep = ({ businessId, locationId, onComplete }: Props) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const streamChat = async (allMessages: Msg[]) => {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: allMessages }),
    });

    if (resp.status === 429) { toast.error("Rate limit exceeded. Try again shortly."); return; }
    if (resp.status === 402) { toast.error("AI credits exhausted. Please add funds."); return; }
    if (!resp.ok || !resp.body) { toast.error("Failed to connect to consultant."); return; }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantSoFar = "";
    let streamDone = false;

    while (!streamDone) {
      const { done, value } = await reader.read();
      if (done) break;
      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") { streamDone = true; break; }
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantSoFar += content;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
              }
              return [...prev, { role: "assistant", content: assistantSoFar }];
            });
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantSoFar += content;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === "assistant") {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
              }
              return [...prev, { role: "assistant", content: assistantSoFar }];
            });
          }
        } catch { /* ignore */ }
      }
    }
  };

  const handleStart = async () => {
    setStarted(true);
    setIsLoading(true);
    try {
      // Send an initial message to trigger the consultant's intro
      const initMsg: Msg = { role: "user", content: "I'd like help finding and applying for grants or government contracts for my business. Please introduce yourself and start the intake process." };
      setMessages([initMsg]);
      await streamChat([initMsg]);
    } catch (err: any) {
      toast.error("Connection failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    try {
      await streamChat(newMessages);
    } catch (err: any) {
      toast.error("Failed to get response. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setStarted(false);
    setInput("");
  };

  if (!started) {
    return (
      <div className="max-w-3xl mx-auto pb-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-display text-foreground mb-2">📋 Grant & Contract Consultant</h1>
          <p className="text-muted-foreground">Your AI-powered grant writer and government contract proposal manager</p>
        </div>

        <Card className="border-primary/20">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Start Your Grant & Contract Consultation</h2>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                This consultant will walk you through a structured interview to determine whether you should pursue a grant, government contract, or both — then help you build the full proposal package.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-lg mx-auto">
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-xs font-semibold text-foreground mb-1">🎯 Path Selection</p>
                <p className="text-xs text-muted-foreground">Grant vs contract vs both</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-xs font-semibold text-foreground mb-1">📝 Readiness Audit</p>
                <p className="text-xs text-muted-foreground">Registrations, compliance, capacity</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/30">
                <p className="text-xs font-semibold text-foreground mb-1">📄 Full Proposal</p>
                <p className="text-xs text-muted-foreground">Narratives, budgets, volumes</p>
              </div>
            </div>

            <Button onClick={handleStart} size="lg" className="gap-2">
              <FileText className="w-4 h-4" />
              Start Consultation
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-12 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">📋 Grant & Contract Consultant</h1>
          <p className="text-xs text-muted-foreground">Multi-turn consultation — answer questions to build your proposal</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} className="gap-1">
          <RotateCcw className="w-3 h-3" /> New Session
        </Button>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border"
            }`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert text-foreground">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Answer the consultant's questions..."
          rows={2}
          className="resize-none flex-1"
          disabled={isLoading}
        />
        <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="icon" className="h-12 w-12">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};

export default GrantConsultantStep;
