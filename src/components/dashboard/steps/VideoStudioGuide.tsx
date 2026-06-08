import { useState } from "react";
import { ChevronDown, ChevronUp, BookOpen, Download, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    num: 1,
    title: "Fill Out Your Business Profile (Step 2)",
    desc: "Enter your business name, niche, target audience, brand tone, and social media links. RickyAI uses this to personalize every video idea, script, and prompt specifically for YOUR business.",
    tip: "The more detail you add, the better RickyAI's output. Include competitors and content goals for best results."
  },
  {
    num: 2,
    title: "Hit 'Generate' on Video Studio",
    desc: "RickyAI's AI analyzes your business profile and creates a full video production plan: strategy overview, 3+ video ideas with complete scripts, and ready-to-paste prompts for all 11 video tools.",
    tip: "Generation takes 15-30 seconds. You can regenerate anytime for fresh ideas."
  },
  {
    num: 3,
    title: "Choose Your Tool",
    desc: "Select from platform tabs: Free Tools (CapCut, phone), Canva, InVideo, Detail, ElevenLabs, Nvidia, PixelBin, EaseMate, or Virbo. Each tab shows a customized prompt for that platform.",
    tip: "Start with Free Tools if you're on a budget. CapCut and your phone camera can produce professional results."
  },
  {
    num: 4,
    title: "Copy the Prompt",
    desc: "Click 'Copy Prompt' next to any video idea. This copies the exact, ready-to-paste prompt that RickyAI created for your chosen tool — complete with your business name, tone, and script.",
    tip: "Each tool gets a different prompt format optimized for how that platform works."
  },
  {
    num: 5,
    title: "Paste into Your Tool & Create",
    desc: "Open your chosen video tool (e.g., CapCut, InVideo), paste the prompt, and follow the tool's workflow. The prompt tells the tool exactly what to create for your business.",
    tip: "Most AI tools generate your video in under 5 minutes. Free tools like CapCut require manual editing but give you full creative control."
  },
  {
    num: 6,
    title: "Download, Share & Post",
    desc: "Export your finished video and use RickyAI's Export step (Step 10) for platform-specific posting schedules, hashtag strategies, and distribution plans.",
    tip: "RickyAI's posting time suggestions are based on your location and audience — results may vary by niche and region."
  }
];

const toolTiers = [
  { tier: "🆓 Free", tools: "CapCut, Phone Camera, DaVinci Resolve, Clipchamp", note: "No cost. You edit manually using RickyAI's step-by-step guides." },
  { tier: "💰 Budget ($5-15/mo)", tools: "Canva Pro, ElevenLabs Starter", note: "Templates + AI voice. Great for consistent branded content." },
  { tier: "🚀 Pro ($20-30/mo)", tools: "InVideo, Virbo, EaseMate", note: "Full AI video generation. Paste prompt → get video. Most hands-off." },
  { tier: "⚙️ Advanced", tools: "PixelBin, Nvidia Broadcast, Detail", note: "API pipelines, AI recording enhancement, screen capture." },
];

interface Props {
  onDownloadGuide?: () => void;
}

const VideoStudioGuide = ({ onDownloadGuide }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="glass rounded-2xl overflow-hidden mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-foreground">📖 How It Works — Step-by-Step Guide</h3>
            <p className="text-xs text-muted-foreground">Learn how RickyAI creates personalized videos for your business</p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-5 space-y-5">
          {/* How it works steps */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Your Video Creation Workflow</h4>
            {steps.map((s) => (
              <div key={s.num} className="flex gap-3 p-3 rounded-xl bg-secondary/30">
                <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  {s.num}
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-foreground">{s.title}</h5>
                  <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
                  <p className="text-[10px] text-primary/80 mt-1 italic">💡 {s.tip}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tool tiers */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Which Tool Should I Use?</h4>
            {toolTiers.map((t, i) => (
              <div key={i} className="p-3 rounded-lg bg-secondary/20 border border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">{t.tier}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t.tools}</p>
                <p className="text-[10px] text-secondary-foreground mt-1">{t.note}</p>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 space-y-2">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-bold text-primary">Common Questions</h4>
            </div>
            <div className="space-y-2 text-xs">
              <div>
                <p className="font-semibold text-foreground">Do I need to pay for a video tool?</p>
                <p className="text-muted-foreground">No! The "Free Tools" tab gives you everything you need using CapCut and your phone camera.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Does RickyAI actually make the video?</p>
                <p className="text-muted-foreground">RickyAI does all the research, scripting, and prompt creation. You paste the prompt into your chosen tool to produce the final video.</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Can I regenerate for new ideas?</p>
                <p className="text-muted-foreground">Yes! Hit "Regenerate" anytime for fresh video ideas, scripts, and prompts.</p>
              </div>
            </div>
          </div>

          {/* Download button */}
          {onDownloadGuide && (
            <Button variant="outline" size="sm" onClick={onDownloadGuide} className="w-full gap-2">
              <Download className="w-4 h-4" />
              Download Full Guide (PDF)
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoStudioGuide;
