import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messagePrompt, setMessagePrompt] = useState('');
  const [wsState, setWsState] = useState('disconnected');
  
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  // 1. Fetch Conversations on Mount
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await fetch('http://localhost:8900/api/protected/conversations', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
          if (data.length > 0) setActiveChat(data[0]); // Auto-select the first chat
        } else if (res.status === 401) {
          handleLogout(); // Token expired or invalid
        }
      } catch (err) {
        console.error("Failed to fetch conversations", err);
      }
    };

    fetchConversations();
  }, [token]);

  // 2. Fetch Messages and connect WS when the Active Chat changes
  useEffect(() => {
    if (!activeChat) {
      setWsState('disconnected');
      return;
    }

    let socket = null;
    let reconnectTimer = null;
    let shouldReconnect = true;

    const connect = () => {
      setWsState('connecting');
      socket = new WebSocket(`ws://localhost:8900/api/ws/${activeChat.id}`);

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
      try {
        const res = await fetch(`http://localhost:8900/api/protected/conversations/${activeChat.id}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error("Failed to fetch messages", err);
      }
    };

    fetchMessages();
    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [activeChat, token]);

  const handleSendMessage = async () => {
    if (!messagePrompt.trim() || !activeChat) return;

    try {
      const res = await fetch(`http://localhost:8900/api/protected/conversations/${activeChat.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: messagePrompt })
      });

      if (res.ok) {
        const newMessage = await res.json();
        setMessages((prev) => [...prev, newMessage]);
        setMessagePrompt('');
      }
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-gray-50">
      
      {/* LEFT PANE: Sidebar & Conversation List */}
      <div className="flex flex-col w-80 bg-white border-r border-gray-200">
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Shared Inbox</h2>
          <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700">Logout</button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
             <div className="p-4 text-sm text-center text-gray-500">No open conversations.</div>
          ) : (
            conversations.map((chat) => (
              <div 
                key={chat.id}
                onClick={() => setActiveChat(chat)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${activeChat?.id === chat.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="text-sm font-semibold text-gray-900">{chat.customer_name}</h3>
                  <span className="text-xs text-gray-500 text-right">
                    {new Date(chat.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <p className="text-sm text-gray-600 truncate">{chat.preview}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MIDDLE PANE: Active Chat Area */}
      <div className="flex flex-col flex-1 bg-white">
        {activeChat ? (
          <>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 shadow-sm z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{activeChat.customer_name}</h2>
                <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full font-medium tracking-wide uppercase">
                  {activeChat.status}
                </span>
                <p className="mt-1 text-xs text-gray-500 capitalize">Realtime: {wsState}</p>
              </div>
            </div>

            <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-gray-50">
              {messages.map((msg) => {
                // Check if the sender is the customer attached to the conversation
                const isCustomer = msg.sender_id === activeChat.customer_id;
                
                return (
                  <div key={msg.id} className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}>
                    <span className="mb-1 ml-1 mr-1 text-xs text-gray-500">{msg.sender_name}</span>
                    <div className={`p-3 max-w-lg shadow-sm text-sm ${isCustomer ? 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tl-none' : 'bg-blue-600 text-white rounded-2xl rounded-tr-none'}`}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-end overflow-hidden transition-all border border-gray-300 rounded-lg bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                <textarea 
                  rows="2"
                  className="flex-1 p-3 text-sm bg-transparent outline-none resize-none"
                  placeholder="Type your reply here..."
                  value={messagePrompt}
                  onChange={(e) => setMessagePrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <button 
                  onClick={handleSendMessage}
                  className="px-4 py-2 m-2 font-medium text-white transition-colors bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1 text-gray-500">
            Select a conversation to start chatting.
          </div>
        )}
      </div>

      {/* RIGHT PANE: Details & AI Copilot Panel */}
      {activeChat && (
        <div className="flex flex-col border-l border-gray-200 w-72 bg-gray-50">
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-3 text-2xl font-bold text-blue-600 bg-blue-100 rounded-full">
              {activeChat.customer_name.charAt(0)}
            </div>
            <h3 className="font-bold text-center text-gray-900">{activeChat.customer_name}</h3>
            <p className="mb-4 text-sm text-center text-gray-500">Customer via Web Widget</p>
          </div>

          <div className="flex-1 p-5 bg-gradient-to-b from-purple-50 to-white">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-purple-600">✨</span>
              <h3 className="font-bold text-purple-900">AI Copilot</h3>
            </div>
            <div className="p-3 text-sm italic text-gray-700 bg-white border border-purple-100 rounded-lg shadow-sm">
              "I will generate suggested replies here once Gemini is integrated!"
            </div>
          </div>
        </div>
      )}
    </div>
  );
}