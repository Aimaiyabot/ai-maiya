"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import dynamic from "next/dynamic";
import emojiData from "@emoji-mart/data";
import DownloadButton from "@/app/api/components/DownloadButton";
import { useRouter } from "next/navigation";

const Picker = dynamic(() => import("@emoji-mart/react").then((mod) => mod.default), { ssr: false });

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const router = useRouter(); // ✅ FIXED: moved inside function component

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedDate, setSelectedDate] = useState("Today");
  const [savedDates, setSavedDates] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [userName, setUserName] = useState("");
  const [userNiche, setUserNiche] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [isProfileSaved, setIsProfileSaved] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const imagePromptRef = useRef(false);

  const getTodayKey = () => new Date().toISOString().split("T")[0];

  const loadHistory = async (key: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("chats").select("messages").eq("date_key", key).eq("user_id", user.id).single();
    setMessages(data?.messages || []);
  };

  const saveHistory = async (msgs: Message[]) => {
    const todayKey = getTodayKey();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("chats").upsert({ user_id: user.id, date_key: todayKey, messages: msgs });
    if (!savedDates.includes(todayKey)) {
      setSavedDates([...savedDates, todayKey]);
    }
  };

  const generateAndSaveSummary = async (chatMessages: Message[]) => {
    const todayKey = getTodayKey();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      const res = await fetch("/api/maiyabot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatMessages,
          name: userName,
          niche: userNiche,
          summarize: true,
        }),
      });

      if (!res.ok) throw new Error("Failed to summarize");

      const data = await res.json();
      const summary = data.summary || data.reply;

      await supabase.from("summaries").upsert({ user_id: user.id, date_key: todayKey, summary });
    } catch (err) {
      console.error("Failed to save summary:", err);
    }
  };

  const loadUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
  
    if (!user) {
      router.push("/auth");
      return;
    }
  
    setUserEmail(user.email || "");
  
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
  
    if (data) {
      setUserName(data.name || "");
      setUserNiche(data.niche || "");
  
      // 💖 Trigger shimmer animation
      setShowWelcome(true);
      setTimeout(() => setShowWelcome(false), 3000);
    }
  };   

  const saveUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
  
    await supabase.from("profiles").upsert({
      id: user.id,
      name: userName,
      niche: userNiche
    });
  
    setEditMode(false);
    setIsProfileSaved(true); // ✅ this triggers the full chat screen
  };  

  const sendMessage = async (customInput?: string) => {
    const content = customInput || input;
    if (!content.trim()) return;

    const userMessage: Message = { role: "user", content };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsTyping(true);
    setShowEmojiPicker(false);
    await saveHistory(updatedMessages);

    try {
      if (content.toLowerCase().includes("generate image")) {
        const promptMsg: Message = {
          role: "assistant",
          content: "What kind of image would you like me to create for you, babe? 🎨✨",
        };
        const final = [...updatedMessages, promptMsg];
        setMessages(final);
        await saveHistory(final);
        imagePromptRef.current = true;
        return;
      }

      const lastWasImagePrompt = imagePromptRef.current;
      const isImageDescription = lastWasImagePrompt;

      const keywordsForCode = ["infographic", "branding", "journal", "ebook", "layout", "dashboard", "steps", "guide", "template"];
      const shouldUseVisualCode = keywordsForCode.some(word => content.toLowerCase().includes(word));

      const res = await fetch(
        isImageDescription
          ? shouldUseVisualCode
            ? "/api/generate-visual-code"
            : "/api/generate-image"
          : "/api/maiyabot",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages,
            name: userName,
            niche: userNiche,
            prompt: content,
          }),
        }
      );

      if (!res.ok) throw new Error("Network response was not ok.");

      const data = await res.json();

      const assistantMessage: Message = isImageDescription
        ? shouldUseVisualCode
          ? { role: "assistant", content: data.html }
          : data.fallback
            ? { role: "assistant", content: data.message }
            : {
                role: "assistant",
                content: `<img src="${data.imageUrl}" alt="Generated Image" class="rounded-md mt-2 max-w-xs shadow-lg" />`,
              }
        : { role: "assistant", content: data.reply };

      imagePromptRef.current = false;
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      await saveHistory(finalMessages);
      await generateAndSaveSummary(finalMessages);

      if (!isMuted && audioRef.current) {
        audioRef.current.play();
      }
    } catch (err) {
      imagePromptRef.current = false;
      const fallback: Message[] = [...updatedMessages, {
        role: "assistant",
        content: "Oops! I hit a glitch 💔 Can you try again, babe?"
      }];
      setMessages(fallback);
      await saveHistory(fallback);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    setInput((prev) => prev + emoji.native);
  };

  const getMoodColorClass = (text: string) => {
    const funWords = ["lol", "party", "haha", "yay", "fun", "cute", "style", "vibe"];
    const bizWords = ["marketing", "business", "brand", "sales", "launch", "offer", "strategy"];
    const lower = text.toLowerCase();

    if (bizWords.some((word) => lower.includes(word))) return "bg-blue-100 text-blue-800";
    if (funWords.some((word) => lower.includes(word))) return "bg-pink-100 text-pink-700";
    return "bg-white text-gray-800";
  };

  useEffect(() => {
    const todayKey = getTodayKey();
    const init = async () => {
      await loadHistory(todayKey);
      await loadUserProfile();
      const { data } = await supabase.from("chats").select("date_key");
      setSavedDates(data ? [...new Set(data.map((entry) => entry.date_key))] : [todayKey]);
      setSelectedDate(todayKey);
    };
    init();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  if ((!userName || !userNiche) && !isProfileSaved) {
    return (
      <div className="min-h-screen bg-pink-50 flex items-center justify-center px-4">
        <div className="bg-white p-6 rounded-xl shadow-xl text-center w-full max-w-sm">
          <h2 className="text-xl font-semibold text-pink-500 mb-2">Babe, tell me your name and biz vibe 💖</h2>
          <p className="text-sm mb-4 text-gray-600">So I can give you the best advice ✨</p>
  
          <input
            className="w-full border border-gray-300 rounded-md p-2 mb-2 text-sm"
            placeholder="Your name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <input
            className="w-full border border-gray-300 rounded-md p-2 mb-4 text-sm"
            placeholder="Your biz vibe / niche"
            value={userNiche}
            onChange={(e) => setUserNiche(e.target.value)}
          />
          
          <button
            onClick={saveUserProfile}
            className="bg-pink-500 hover:bg-pink-600 text-white text-sm px-4 py-2 rounded-md shadow mb-2 w-full"
          >
            Save & Start Chatting
          </button>
        </div>
      </div>
    );
  }  

  {showWelcome && (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-white border border-pink-200 px-6 py-3 rounded-full shadow-lg flex items-center gap-3 animate-shimmer">
      <img src="/maiya.png" alt="Maiya" className="w-10 h-10 rounded-full animate-bounce" />
      <span className="text-pink-600 text-sm font-medium">Hey babe, welcome back! 💕</span>
    </div>
  )}
  
  return (
    <div className="min-h-screen bg-pink-50 flex flex-col md:flex-row">
      {/* Mobile Dropdown Menu */}
      <div className="md:hidden absolute top-4 right-4 z-50">
        <button onClick={() => setShowDropdown(!showDropdown)} className="text-3xl text-pink-500">☰</button>
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-md p-4">
            {!editMode ? (
              <>
                {userEmail && (
                  <p className="text-xs text-gray-400 italic truncate mb-2">{userEmail}</p>
                )}
                <button className="text-xs text-pink-500 underline block w-full text-left mb-2" onClick={() => setEditMode(true)}>
                  Edit Profile
                </button>
                <button
                  className="text-xs text-red-500 underline block w-full text-left mb-2"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = "/auth";
                  }}
                >
                  Logout
                </button>
                <label className="block text-xs font-semibold mt-2">Chat History</label>
                <select
                  className="w-full border border-gray-300 rounded-md p-2 text-xs mt-1"
                  value={selectedDate}
                  onChange={(e) => {
                    const date = e.target.value;
                    setSelectedDate(date);
                    loadHistory(date);
                  }}
                >
                  {savedDates.map((date) => (
                    <option key={date} value={date}>
                      {date === getTodayKey() ? "Today" : date}
                    </option>
                  ))}
                </select>
                <button
                  onClick={async () => {
                    await supabase.from("chats").delete().eq("date_key", selectedDate);
                    setMessages([]);
                  }}
                  className="text-xs text-pink-500 underline mt-2"
                >
                  Clear Chat
                </button>
              </>
            ) : (
              <div className="mt-2 space-y-2 text-left">
                <input
                  className="w-full border border-gray-300 rounded-md p-2 text-xs"
                  placeholder="Your name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
                <input
                  className="w-full border border-gray-300 rounded-md p-2 text-xs"
                  placeholder="Your niche"
                  value={userNiche}
                  onChange={(e) => setUserNiche(e.target.value)}
                />
                <div className="flex gap-2 mt-1">
                  <button className="text-xs bg-pink-500 text-white px-3 py-1 rounded" onClick={saveUserProfile}>
                    Save
                  </button>
                  <button className="text-xs text-gray-500 underline" onClick={() => setEditMode(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
  
      {/* Sidebar Desktop Only */}
      <div className="hidden md:flex w-64 p-6 bg-white shadow-lg flex-col items-center text-center gap-3">
        <img src="/maiya.png" alt="Maiya" className="w-24 h-24 rounded-full shadow-md" />
        <h1 className="text-2xl font-bold text-pink-600">Hi, I'm Maiya 💖</h1>
        <p className="text-sm mt-2">Your cute AI business bestie. Ask me anything about digital marketing, passive income, or branding!</p>
        {!editMode ? (
          <>
            {userName && userNiche && (
              <p className="text-xs mt-4 text-pink-400">
                Welcome back {userName}! Ready to grow your {userNiche} biz? 💼💅
              </p>
            )}
            {userEmail && (
              <p className="text-xs mt-1 text-gray-400 italic truncate">{userEmail}</p>
            )}
            <div className="flex flex-col items-center gap-1 mt-2">
              <button className="text-xs text-pink-500 underline" onClick={() => setEditMode(true)}>
                Edit Profile
              </button>
              <button
                className="text-xs text-red-500 underline"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = "/auth";
                }}
              >
                Logout
              </button>
            </div>
          </>
        ) : (
          <div className="w-full mt-4 space-y-2 text-left">
            <input
              className="w-full border border-gray-300 rounded-md p-2 text-xs"
              placeholder="Your name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
            <input
              className="w-full border border-gray-300 rounded-md p-2 text-xs"
              placeholder="Your niche"
              value={userNiche}
              onChange={(e) => setUserNiche(e.target.value)}
            />
            <div className="flex gap-2 mt-1">
              <button className="text-xs bg-pink-500 text-white px-3 py-1 rounded" onClick={saveUserProfile}>
                Save
              </button>
              <button className="text-xs text-gray-500 underline" onClick={() => setEditMode(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        <div className="w-full mt-6">
          <label className="block text-sm font-semibold mb-2">Chat History</label>
          <select
            className="w-full border border-gray-300 rounded-md p-2 text-sm"
            value={selectedDate}
            onChange={(e) => {
              const date = e.target.value;
              setSelectedDate(date);
              loadHistory(date);
            }}
          >
            {savedDates.map((date) => (
              <option key={date} value={date}>
                {date === getTodayKey() ? "Today" : date}
              </option>
            ))}
          </select>
          <button
            onClick={async () => {
              await supabase.from("chats").delete().eq("date_key", selectedDate);
              setMessages([]);
            }}
            className="text-sm text-pink-500 underline mt-4"
          >
            Clear Chat
          </button>
        </div>
      </div>
  
      {/* Chat UI */}
      <div className="flex-1 w-full flex flex-col justify-between items-center px-2 md:px-6 py-6 relative">
        <div className="text-center md:hidden mb-4">
          <img src="/maiya.png" alt="Maiya" className="w-20 h-20 rounded-full mx-auto shadow-md" />
          <h1 className="text-xl font-bold text-pink-600">Hi, I'm Maiya 💖</h1>
          <p className="text-sm mt-2 px-4">Ask me anything about digital marketing, passive income, or branding!</p>
          <hr className="border-pink-300 mt-4 w-24 mx-auto" />
        </div>
  
        <div
  className="w-full max-w-4xl overflow-y-auto px-1"
  style={{
    maxHeight: "calc(100vh - 240px)", // dynamically fits the screen height
    paddingBottom: "12rem",           // space for input + helper text
  }}
>
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex items-start gap-2 mb-4 ${msg.role === "user" ? "justify-end flex-row-reverse" : "justify-start"}`}>
              <img src={msg.role === "user" ? "/user-avatar.png" : "/maiya.png"} alt={msg.role === "user" ? "You" : "Maiya"} className="w-8 h-8 rounded-full shadow-md" />
              <div className={`rounded-xl px-4 py-3 w-full max-w-2xl whitespace-pre-line text-sm ${msg.role === "user" ? "bg-pink-100 text-pink-700 self-end" : `${getMoodColorClass(msg.content)} shadow-md self-start`}`}>
                <strong>{msg.role === "user" ? "You" : "Maiya"}:</strong>{" "}
                {msg.role === "assistant" && msg.content.includes("<img") ? (
                  <div className="flex flex-col items-start">
                    <div className="inline-block border border-pink-200 rounded-xl overflow-hidden shadow-md">
                      <img
                        src={msg.content.match(/src=\"([^\"]+)\"/)?.[1] || ""}
                        alt="Generated Image"
                        className="w-full h-auto block"
                      />
                    </div>
                    <div className="mt-2">
                      <DownloadButton url={msg.content.match(/src=\"([^\"]+)\"/)?.[1] || ""} />
                    </div>
                  </div>
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: msg.content }} />
                )}
              </div>
            </div>
          ))}
  
          {isTyping && (
            <div className="flex items-center gap-2 mb-4 animate-pulse">
              <img src="/maiya.png" alt="Maiya" className="w-8 h-8 rounded-full shadow-md" />
              <div className="bg-white px-4 py-2 rounded-xl shadow text-sm text-gray-600">Maiya is thinking...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
  
        <div className="fixed bottom-8 w-full max-w-4xl px-3 bg-pink-60 pt-2 pb-10 md:pb-5 z-30">
  <div className="flex flex-wrap justify-center gap-4 md:gap-4 mb-4">
    {[{ icon: "💌", label: "Write an email" }, { icon: "📈", label: "Digital marketing tips" }, { icon: "💰", label: "Passive income ideas" }, { icon: "🎨", label: "Generate image" }, { icon: "✍️", label: "Write a story" }].map(({ icon, label }) => (
      <button
        key={label}
        onClick={() => sendMessage(label)}
        className="bg-pink-100 hover:bg-pink-200 text-xs md:text-sm text-pink-700 px-3 py-1 rounded-full shadow-sm flex items-center gap-1"
      >
        <span>{icon}</span> <span>{label}</span>
      </button>
    ))}
  </div>
  
          <div className="flex bg-white border border-pink-300 rounded-full shadow-lg p-2 items-center relative">
            <button onClick={() => setShowEmojiPicker((prev) => !prev)} className="text-lg px-3">😊</button>
            <textarea
              rows={1}
              placeholder="Ask Maiya something..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-2 py-2 text-sm border-none focus:outline-none resize-none bg-transparent"
            />
            <button onClick={() => setIsMuted(!isMuted)} className="mr-2 text-sm text-pink-500" title={isMuted ? "Unmute sound" : "Mute sound"}>
              {isMuted ? "🔇" : "🔔"}
            </button>
            <button onClick={() => sendMessage()} className="bg-pink-500 hover:bg-pink-600 text-white rounded-full w-10 h-10 flex items-center justify-center">
              ➤
            </button>
  
            {showEmojiPicker && (
              <div className="absolute bottom-14 left-0 z-50">
                <Picker data={emojiData} onEmojiSelect={handleEmojiSelect} />
              </div>
            )}
          </div>
          <div className="message-bottom-text text-xs text-center mt-3 text-gray-600">⚡ Maiya gives her best advice, but babe, always double-check important info!</div>
        </div>
      </div>
  
      <audio ref={audioRef} src="/maiya-chime/sound.wav" preload="auto" />
    </div>
  );
  }
  