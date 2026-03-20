import { useEffect, useRef, useState } from 'react';

export default function Widget() {
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState(null); // { token, conversationId }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [userForm, setUserForm] = useState({ name: '', email: '' });
  const [wsState, setWsState] = useState('disconnected');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!session?.conversationId) return;

    let socket = null;
    let reconnectTimer = null;
    let shouldReconnect = true;

    const connect = () => {
      setWsState('connecting');
      socket = new WebSocket(`ws://localhost:8900/api/ws/${session.conversationId}`);

      socket.onopen = () => {
        setWsState('connected');
      };

      socket.onmessage = (event) => {
        const newMsg = JSON.parse(event.data);
        setMessages((prev) => {
          if (prev.find((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      };

      socket.onclose = () => {
        if (!shouldReconnect) {
          setWsState('disconnected');
          return;
        }
        setWsState('reconnecting');
        reconnectTimer = setTimeout(connect, 1500);
      };

      socket.onerror = () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };
    };

    const fetchMessages = async () => {
      const res = await fetch(`http://localhost:8900/api/protected/conversations/${session.conversationId}/messages`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.ok) setMessages(await res.json());
    };

    fetchMessages();
    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [session]);

  const handleStartChat = async (e) => {
    e.preventDefault();

    const res = await fetch('http://localhost:8900/api/widget/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userForm),
    });

    if (res.ok) {
      const data = await res.json();
      const nextSession = {
        token: data.token,
        conversationId: data.conversation_id,
      };
      setSession(nextSession);
      sessionStorage.setItem('widget_session', JSON.stringify(nextSession));
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !session) return;

    const res = await fetch(`http://localhost:8900/api/protected/conversations/${session.conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ content: input }),
    });

    if (res.ok) {
      const newMsg = await res.json();
      setMessages((prev) => [...prev, newMsg]);
      setInput('');
    }
  };

  useEffect(() => {
    const raw = sessionStorage.getItem('widget_session');
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (parsed?.token && parsed?.conversationId) {
        setSession(parsed);
      }
    } catch {
      sessionStorage.removeItem('widget_session');
    }
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {isOpen && (
        <div className="w-80 h-96 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-4 border border-gray-200 transition-all duration-300 transform origin-bottom-right">
          <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
            <div>
              <h3 className="font-bold">Support Chat</h3>
              {session && (
                <p className="text-[11px] text-blue-100 capitalize">{wsState}</p>
              )}
            </div>
            <button onClick={() => setIsOpen(false)} className="text-blue-100 hover:text-white">x</button>
          </div>

          {!session ? (
            <div className="flex-1 p-6 bg-gray-50 flex flex-col justify-center">
              <p className="text-gray-600 mb-4 text-sm text-center">Hi there! To start a chat, please introduce yourself.</p>
              <form onSubmit={handleStartChat} className="space-y-3">
                <input
                  required
                  type="text"
                  placeholder="Name"
                  className="w-full p-2 border rounded-md text-sm outline-none focus:border-blue-500"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                />
                <input
                  required
                  type="email"
                  placeholder="Email"
                  className="w-full p-2 border rounded-md text-sm outline-none focus:border-blue-500"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                />
                <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded-md font-medium hover:bg-blue-700 transition">Start Chat</button>
              </form>
            </div>
          ) : (
            <>
              <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-3">
                {messages.length === 0 && <p className="text-center text-xs text-gray-400 mt-4">Send a message to start...</p>}
                {messages.map((msg) => {
                  const isCustomer = msg.sender_name !== 'Agent';
                  return (
                    <div key={msg.id} className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}>
                      <div className={`p-2 px-3 text-sm max-w-[85%] shadow-sm ${isCustomer ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none' : 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tl-none'}`}>
                        {msg.content}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSend} className="p-3 bg-white border-t flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 p-2 bg-gray-100 rounded-full text-sm outline-none px-4"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button type="submit" className="bg-blue-600 text-white p-2 rounded-full w-9 h-9 flex items-center justify-center hover:bg-blue-700">{'->'}</button>
              </form>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 ${isOpen ? 'bg-gray-800' : 'bg-blue-600'}`}
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>
    </div>
  );
}
