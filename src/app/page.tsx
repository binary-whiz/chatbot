"use client"
import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Plus } from 'lucide-react';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
}

export default function ChatBotUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pdfText, setPdfText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const pdfScriptLoaded = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedMessages = localStorage.getItem('chatMessages');
    if (savedMessages) setMessages(JSON.parse(savedMessages));
  }, []);

  useEffect(() => {
    localStorage.setItem('chatMessages', JSON.stringify(messages));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (!pdfScriptLoaded.current) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      script.onload = () => {
        const pdfjsLib = (window as any)['pdfjsLib'];
        if (pdfjsLib?.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        }
      };
      document.body.appendChild(script);
      pdfScriptLoaded.current = true;
    }
  }, []);

  const getTime = () =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async () => {
      const typedarray = new Uint8Array(reader.result as ArrayBuffer);
      const pdfjsLib = (window as any)['pdfjsLib'];
      if (!pdfjsLib) return;
      const pdf = await pdfjsLib.getDocument(typedarray).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        text += pageText + '\n';
      }
      setPdfText(text);
      console.log('Parsed PDF Text:', text);
    };
    reader.readAsArrayBuffer(file);
  };

  const streamBotMessage = async (fullText: string) => {
    const botReply: Message = {
      id: Date.now() + 1,
      text: '',
      sender: 'bot',
      timestamp: getTime(),
    };
    let index = 0;
    setMessages(prev => [...prev, botReply]);
    const interval = setInterval(() => {
      index++;
      setMessages(prev => {
        const updated = [...prev];
        const last = { ...updated[updated.length - 1] };
        last.text = fullText.slice(0, index);
        updated[updated.length - 1] = last;
        return updated;
      });
      if (index >= fullText.length) clearInterval(interval);
    }, 10);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      text: input,
      sender: 'user',
      timestamp: getTime(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyALKy2v11CUlwVrFcprMhdcbp0me_1mesY',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              ...messages.map((m: Message) => ({
                role: m.sender === 'user' ? 'user' : 'model',
                parts: [{ text: m.text }],
              })),
              {
                role: 'user',
                parts: [{ text: input + (pdfText ? `\n\n[Uploaded PDF Content]\n${pdfText}` : '') }],
              },
            ],
          }),
        }
      );

      const data = await response.json();
      console.log('API response:', data);

      const botText =
        data?.candidates?.[0]?.content?.parts?.map((p: { text: string }) => p.text).join('\n') ||
        'AI response not available.';

      await streamBotMessage(botText);
    } catch (error) {
      console.error('API error:', error);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 2,
          text: 'Error fetching response.',
          sender: 'bot',
          timestamp: getTime(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col max-w-md mx-auto p-4 h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-center">ChatBot UI H</h1>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => {
            localStorage.removeItem('chatMessages');
            setMessages([]);
            setPdfText('');
            setFileName(null);
          }}
        >
          Clear Chat
        </Button>
      </div>

      <ScrollArea className="flex-1 overflow-auto space-y-2 mb-2 pr-2">
        {messages.map(msg => (
          <div key={msg.id} className="flex flex-col">
            <Card
              className={`rounded-2xl w-fit max-w-[75%] px-3 py-2 ${
                msg.sender === 'user' ? 'ml-auto bg-blue-100' : 'mr-auto bg-white shadow-sm'
              }`}
            >
              <CardContent className="p-0 whitespace-pre-line flex gap-2 items-start">
                {msg.sender === 'bot' && (
                  <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs mt-1">🤖</div>
                )}
                <div>{msg.text}</div>
                {msg.sender === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-blue-300 flex items-center justify-center text-xs mt-1">🧑</div>
                )}
              </CardContent>
            </Card>
            <span className={`text-xs text-gray-500 ${msg.sender === 'user' ? 'text-right ml-auto' : 'text-left mr-auto'} mt-1`}>
              {msg.timestamp}
            </span>
          </div>
        ))}
        {loading && (
          <Card className="w-fit max-w-[75%] px-3 py-2 mr-auto bg-white shadow-sm">
            <CardContent className="p-0 italic text-gray-400">Typing...</CardContent>
          </Card>
        )}
        {fileName && (
          <div className="text-xs text-gray-500 text-center">📄 {fileName} uploaded</div>
        )}
        <div ref={chatEndRef}></div>
      </ScrollArea>

      <div className="flex gap-2 items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus className="w-4 h-4" />
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
        </Button>
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
          onKeyDown={e => {
            if (e.key === 'Enter') sendMessage();
          }}
        />
        <Button onClick={sendMessage} disabled={loading}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
