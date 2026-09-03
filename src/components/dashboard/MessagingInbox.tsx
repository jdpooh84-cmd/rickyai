import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send, Filter } from "lucide-react";

interface Message {
  id: string;
  contact_id: string | null;
  channel: string;
  direction: string;
  body: string | null;
  subject: string | null;
  status: string;
  created_at: string;
  contacts?: { first_name: string | null; last_name: string | null } | null;
}

interface Props { businessId: string | null; }

export default function MessagingInbox({ businessId }: Props) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState("all");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    if (!businessId) return;
    const query = supabase.from("messages").select("*, contacts(first_name, last_name)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (channelFilter !== "all") query.eq("channel", channelFilter);
    const { data } = await query;
    setMessages(data || []);
  };

  useEffect(() => { load(); }, [businessId, channelFilter]);

  const contacts = Array.from(new Map(
    messages.filter(m => m.contact_id).map(m => [m.contact_id, m.contacts])
  ).entries());

  const conversation = messages.filter(m => m.contact_id === selectedContact).reverse();

  const sendReply = async () => {
    if (!businessId || !selectedContact || !replyText) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      business_id: businessId,
      contact_id: selectedContact,
      channel: channelFilter === "all" ? "sms" : channelFilter,
      direction: "outbound",
      body: replyText,
      status: "queued",
    });
    setSending(false);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setReplyText("");
    load();
  };

  const STATUS_COLORS: Record<string, string> = {
    sent: "bg-green-500/10 text-green-400",
    delivered: "bg-primary/10 text-primary",
    queued: "bg-yellow-500/10 text-yellow-400",
    failed: "bg-destructive/10 text-destructive",
    bounced: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Messaging Inbox</h1>
          <p className="text-muted-foreground text-sm mt-1">SMS and email conversations</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
        {/* Contact list */}
        <div className="space-y-1 overflow-y-auto">
          {contacts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No messages yet. Messages you send to contacts will appear here.
            </div>
          )}
          {contacts.map(([cid, contact]) => {
            const lastMsg = messages.find(m => m.contact_id === cid);
            const unread = messages.filter(m => m.contact_id === cid && m.direction === "inbound" && m.status !== "read").length;
            return (
              <div
                key={cid}
                onClick={() => setSelectedContact(cid)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedContact === cid ? "bg-primary/10 border border-primary/20" : "hover:bg-secondary/30"}`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{contact?.first_name} {contact?.last_name}</p>
                  {unread > 0 && <Badge className="bg-primary text-primary-foreground text-xs">{unread}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{lastMsg?.body || "—"}</p>
                <p className="text-xs text-muted-foreground">{lastMsg ? new Date(lastMsg.created_at).toLocaleDateString() : ""}</p>
              </div>
            );
          })}
        </div>

        {/* Conversation */}
        <div className="md:col-span-2 flex flex-col glass rounded-xl">
          {!selectedContact ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Select a contact to view conversation</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {conversation.map(msg => (
                  <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-xs rounded-xl px-3 py-2 ${msg.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                      {msg.subject && <p className="text-xs font-semibold mb-1">{msg.subject}</p>}
                      <p className="text-sm">{msg.body}</p>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <p className="text-[10px] opacity-60">{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                        <Badge className={`text-[10px] ${STATUS_COLORS[msg.status] || "bg-muted text-muted-foreground"}`}>{msg.status}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-border flex gap-2">
                <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Type a message..." rows={1} className="flex-1 min-h-[40px]" />
                <Button onClick={sendReply} disabled={sending || !replyText} size="sm">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
