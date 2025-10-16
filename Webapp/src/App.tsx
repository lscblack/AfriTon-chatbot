import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Menu, Plus, Sun, Moon, Shield, Edit2, RefreshCw,
  ThumbsUp, ThumbsDown, X, Check, MessageSquare, Activity, Users,TrendingUp, Trash2, Download, 
  User,  Heart, Stethoscope, AlertTriangle
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  id: number;
  role: 'user' | 'assistant';
  message: string;
  score?: number;
  timestamp: string;
  flagged?: boolean;
}

interface Session {
  id: number;
  title: string;
  created_at: string;
  messages_count?: number;
  avg_reward?: number;
}

interface ChatResponse {
  answer: string;
  score?: number;
  source?: string;
  reward?: number;
  flagged?: boolean;
  session_id?: number;
}

interface Metrics {
  total_sessions: number;
  total_messages: number;
  avg_score?: number;
}

// ============================================================================
// API SERVICE
// ============================================================================

const API_BASE_URL = 'http://localhost:8000';

class ApiService {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      if (response.status === 422) {
        const errorData = await response.json();
        console.error('Validation Error:', errorData);
        throw new Error(`Validation Error: ${JSON.stringify(errorData.detail)}`);
      }
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }
    
    return response.json();
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${this.baseURL}${endpoint}`);
    if (params) {
      Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    }
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('NOT_FOUND');
      }
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }
    
    return response.json();
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }
    
    return response.json();
  }
}

const api = new ApiService(API_BASE_URL);

// ============================================================================
// HOOKS
// ============================================================================

const useLocalStorage = <T,>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
};

// ============================================================================
// UTILS
// ============================================================================

const getUserIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip.replace(/\./g, "");
  } catch (error) {
    console.warn('Failed to fetch IP, using fallback ID');
    return `user-${Math.floor(Math.random() * 10000)}`;
  }
};

// Improved message ID generation to avoid conflicts
const generateTempId = (): number => {
  return Date.now() + Math.floor(Math.random() * 1000);
};

const formatMessage = (text: string): React.ReactNode => {
  if (!text) return text;

  const lines = text.split('\n');
  
  return lines.map((line, index) => {
    if (line.trim().match(/^[-*•]\s/)) {
      return (
        <div key={index} className="flex items-start gap-2 py-0.5">
          <span className="text-amber-500 mt-1.5 flex-shrink-0">•</span>
          <span className="flex-1">{line.replace(/^[-*•]\s/, '')}</span>
        </div>
      );
    }
    
    if (line.trim().match(/^\d+\.\s/)) {
      return (
        <div key={index} className="flex items-start gap-2 py-0.5">
          <span className="text-amber-500 mt-1.5 flex-shrink-0 font-medium">
            {line.match(/^\d+/)?.[0]}.
          </span>
          <span className="flex-1">{line.replace(/^\d+\.\s/, '')}</span>
        </div>
      );
    }
    
    return (
      <div key={index} className="py-1.5">
        {line}
      </div>
    );
  });
};

// Suggested questions for empty state
const SUGGESTED_QUESTIONS = [
  "What are symptoms of depression?",
  "What foods help with digestion?",
  "What are the benefits of regular exercise?",
  "How to improve sleep quality?"
];

// ============================================================================
// COMPONENTS
// ============================================================================

const LoadingSpinner: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = "currentColor" }) => (
  <div className="flex items-center justify-center">
    <div 
      className="animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: size, height: size, borderColor: color, borderTopColor: 'transparent' }}
    />
  </div>
);

const Toast: React.FC<{ 
  message: string; 
  type: 'success' | 'error' | 'info'; 
  onClose: () => void;
  isDark: boolean;
}> = ({ message, type, onClose, isDark }) => {
  const getStyles = () => {
    const baseStyles = "fixed top-4 right-4 left-4 sm:left-auto sm:right-6 px-4 py-3 z-50 rounded-xl shadow-lg flex items-center gap-3 font-medium backdrop-blur-sm text-sm";
    
    if (isDark) {
      return `${baseStyles} ${
        type === 'success' ? 'bg-emerald-600 text-white' :
        type === 'error' ? 'bg-rose-600 text-white' :
        'bg-blue-600 text-white'
      }`;
    } else {
      return `${baseStyles} ${
        type === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
        type === 'error' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
        'bg-blue-100 text-blue-800 border border-blue-200'
      }`;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -100, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -100, scale: 0.9 }}
      className={getStyles()}
    >
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button 
        onClick={onClose} 
        className="ml-2 hover:opacity-70 transition-opacity p-1 rounded-full flex-shrink-0"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
};

const MessageBubble: React.FC<{
  message: Message;
  onEdit: (id: number, newText: string) => void;
  onResend: (id: number) => void;
  onFeedback: (id: number, rating: number) => void;
  isDark: boolean;
}> = ({ message, onEdit, onResend, onFeedback, isDark }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.message);
  const isUser = message.role === 'user';

  const handleSave = () => {
    onEdit(message.id, editText);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(message.message);
    setIsEditing(false);
  };

  const getMessageStyles = () => {
    const baseStyles = "px-4 py-3 sm:px-6 sm:py-4 rounded-2xl transition-all duration-300 shadow-sm max-w-full sm:max-w-2xl";
    
    if (isDark) {
      return `${baseStyles} ${
        isUser 
          ? 'bg-gradient-to-br from-amber-700 to-amber-800 text-white' 
          : 'bg-gray-800 text-gray-100 border border-gray-700'
      }`;
    } else {
      return `${baseStyles} ${
        isUser 
          ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' 
          : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
      }`;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 sm:mb-6 group px-2 sm:px-0`}
    >
      <div className={`max-w-full sm:max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div className="flex items-start gap-2 sm:gap-3 mb-1 sm:mb-2">
          {!isUser && (
            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              isDark ? 'bg-amber-600' : 'bg-amber-500'
            }`}>
              <Stethoscope size={12} className="text-white" />
            </div>
          )}
          <div className={getMessageStyles()}>
            {isEditing ? (
              <div className="space-y-2 sm:space-y-3">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className={`w-full px-3 py-2 text-sm outline-none rounded-lg ${
                    isDark 
                      ? 'bg-gray-700 text-white placeholder-gray-400' 
                      : 'bg-gray-100 text-gray-800 placeholder-gray-500'
                  }`}
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={handleSave}
                    className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 transition-colors text-white text-sm rounded-lg flex items-center gap-2"
                  >
                    <Check size={14} />
                    Save
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-3 py-2 bg-gray-500 hover:bg-gray-600 transition-colors text-white text-sm rounded-lg flex items-center gap-2"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="whitespace-pre-wrap leading-relaxed text-sm sm:text-[15px] break-words">
                {isUser ? message.message : formatMessage(message.message)}
              </div>
            )}
            
            {!isUser && message.score !== undefined && message.score !== null && (
              <div className={`mt-2 sm:mt-3 text-xs font-medium tracking-wide flex items-center gap-2 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <div className="w-full bg-gray-700 rounded-full h-1.5 flex-1">
                  <div 
                    className="bg-gradient-to-r from-amber-400 to-amber-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(message.score * 100, 100)}%` }}
                  />
                </div>
                <span className="flex-shrink-0">{(Math.min(message.score * 100, 100)).toFixed(0)}%</span>
              </div>
            )}
          </div>
          {isUser && (
            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              isDark ? 'bg-gray-700' : 'bg-gray-600'
            }`}>
              <User size={12} className="text-white" />
            </div>
          )}
        </div>
        
        <div className={`flex items-center gap-2 sm:gap-3 mt-1 px-1 sm:px-2 opacity-0 group-hover:opacity-100 transition-all duration-300 ${
          isUser ? 'justify-end' : 'justify-start'
        }`}>
          <span className={`text-xs tracking-wide whitespace-nowrap ${
            isDark ? 'text-gray-500' : 'text-gray-400'
          }`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          
          <div className="flex gap-1">
            {isUser && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className={`p-1 sm:p-1.5 rounded-lg transition-colors ${
                    isDark 
                      ? 'hover:bg-gray-800 text-gray-400' 
                      : 'hover:bg-gray-200 text-gray-500'
                  }`}
                  title="Edit"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={() => onResend(message.id)}
                  className={`p-1 sm:p-1.5 rounded-lg transition-colors ${
                    isDark 
                      ? 'hover:bg-gray-800 text-gray-400' 
                      : 'hover:bg-gray-200 text-gray-500'
                  }`}
                  title="Resend"
                >
                  <RefreshCw size={12} />
                </button>
              </>
            )}
            
            {!isUser && (
              <>
                <button
                  onClick={() => onFeedback(message.id, 1)}
                  className={`p-1 sm:p-1.5 rounded-lg transition-colors ${
                    isDark 
                      ? 'hover:bg-gray-800 text-green-400' 
                      : 'hover:bg-gray-200 text-green-500'
                  }`}
                  title="Good response"
                >
                  <ThumbsUp size={12} />
                </button>
                <button
                  onClick={() => onFeedback(message.id, -1)}
                  className={`p-1 sm:p-1.5 rounded-lg transition-colors ${
                    isDark 
                      ? 'hover:bg-gray-800 text-rose-400' 
                      : 'hover:bg-gray-200 text-rose-500'
                  }`}
                  title="Poor response"
                >
                  <ThumbsDown size={12} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ChatInput: React.FC<{
  onSend: (message: string) => void;
  disabled: boolean;
  isDark: boolean;
  hasActiveSession: boolean;
}> = ({ onSend, disabled, isDark, hasActiveSession }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (input.trim() && !disabled && hasActiveSession) {
      onSend(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const inputStyles = isDark 
    ? "bg-gray-800 text-gray-100 placeholder-gray-400 border-gray-700"
    : "bg-white text-gray-800 placeholder-gray-500 border-gray-200";

  return (
    <div className={`border-t ${isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-50'} p-4 sm:p-6`}>
      <div className="flex gap-2 sm:gap-3 items-end max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={hasActiveSession ? "Describe your symptoms or ask a health question..." : "Please start a new consultation to begin..."}
            disabled={disabled || !hasActiveSession}
            className={`w-full resize-none px-4 py-3 sm:px-5 sm:py-4 pr-12 outline-none rounded-2xl border transition-all duration-200 disabled:opacity-50 text-sm sm:text-[15px] leading-relaxed ${inputStyles}`}
            rows={1}
            style={{ maxHeight: '120px' }}
          />
          {!hasActiveSession && (
            <div className="absolute inset-0 bg-black/40 bg-opacity-50 rounded-2xl flex items-center justify-center">
              <span className="text-white text-sm font-medium">Start a new consultation to begin</span>
            </div>
          )}
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleSend}
          disabled={disabled || !input.trim() || !hasActiveSession}
          className={`p-3 sm:p-4 rounded-2xl text-white transition-all duration-300 flex-shrink-0 ${
            disabled || !input.trim() || !hasActiveSession
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-br from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-lg hover:shadow-xl'
          }`}
        >
          {disabled ? (
            <LoadingSpinner size={18} />
          ) : (
            <Send size={18} />
          )}
        </motion.button>
      </div>
    </div>
  );
};

const Sidebar: React.FC<{
  sessions: Session[];
  currentSessionId: number | null;
  onNewChat: () => void;
  onSelectSession: (id: number) => void;
  onToggleTheme: () => void;
  onAdminLogin: () => void;
  isDark: boolean;
  isAdmin: boolean;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ sessions, currentSessionId, onNewChat, onSelectSession, onToggleTheme, onAdminLogin, isDark, isAdmin, isOpen, onToggle }) => {
  // Ensure sessions is always an array
  const safeSessions = Array.isArray(sessions) ? sessions : [];
  
  const sidebarStyles = isDark 
    ? "bg-gray-900 text-white border-r border-gray-800"
    : "bg-white text-gray-800 border-r border-gray-200";

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 bg-opacity-50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onToggle}
        />
      )}
      
      <motion.div
        initial={false}
        animate={{ x: isOpen ? 0 : -340 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed lg:static top-0 left-0 h-full w-[280px] sm:w-[340px] z-50 flex flex-col ${sidebarStyles}`}
      >
        <div className="p-4 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-amber-700 to-amber-800 rounded-xl flex items-center justify-center shadow-lg">
              <Heart size={18} className="text-white" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-br from-amber-600 to-amber-800 bg-clip-text text-transparent">
              My Doctor
            </h1>
          </div>
          <button 
            onClick={onToggle} 
            className="lg:hidden transition-colors p-1 sm:p-2 rounded-lg hover:bg-gray-800"
          >
            <X size={18} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
          </button>
        </div>

        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 sm:gap-3 px-4 py-3 sm:px-5 sm:py-4 bg-gradient-to-br from-amber-600 to-amber-700 text-white hover:from-amber-700 hover:to-amber-800 transition-all duration-300 font-medium tracking-wide rounded-2xl shadow-lg text-sm sm:text-base"
          >
            <Plus size={18} />
            NEW CONSULTATION
          </motion.button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 space-y-1">
          <h2 className={`text-xs font-bold uppercase tracking-widest mb-3 sm:mb-4 ${
            isDark ? 'text-gray-500' : 'text-gray-400'
          }`}>
            Recent Consultations
          </h2>
          {safeSessions.length === 0 ? (
            <div className={`text-center py-8 ${
              isDark ? 'text-gray-500' : 'text-gray-400'
            }`}>
              <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No consultations yet</p>
            </div>
          ) : (
            safeSessions.map((session) => (
              <motion.button
                key={session.id}
                whileHover={{ x: 2 }}
                onClick={() => onSelectSession(session.id)}
                className={`w-full text-left px-3 py-2 sm:px-4 sm:py-3 transition-all duration-200 rounded-xl ${
                  currentSessionId === session.id
                    ? 'bg-amber-600 bg-opacity-10 border-opacity-20 text-white'
                    : `hover:bg-opacity-50 ${
                        isDark 
                          ? 'hover:bg-gray-800 text-gray-300' 
                          : 'hover:bg-gray-100 text-gray-600'
                      }`
                }`}
              >
                <div className="font-medium truncate tracking-wide text-xs sm:text-sm">{session.title}</div>
                <div className={`text-xs mt-0.5 `}>
                  {new Date(session.created_at).toLocaleDateString()}
                </div>
              </motion.button>
            ))
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-2">
          <button
            onClick={onToggleTheme}
            className={`w-full flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-3 transition-all duration-200 rounded-xl text-sm sm:text-base ${
              isDark 
                ? 'hover:bg-gray-800 text-gray-300' 
                : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            <span className="font-medium tracking-wide">{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          
          <button
            onClick={onAdminLogin}
            className={`w-full flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-3 transition-all duration-200 rounded-xl text-sm sm:text-base ${
              isDark 
                ? 'hover:bg-gray-800 text-gray-300' 
                : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <Shield size={16} />
            <span className="font-medium tracking-wide">{isAdmin ? 'Exit Admin' : 'Admin Login'}</span>
          </button>
        </div>
      </motion.div>
    </>
  );
};

const AdminDashboard: React.FC<{
  onClose: () => void;
  metrics: Metrics;
  sessions: Session[];
  isDark: boolean;
}> = ({ onClose, metrics, sessions, isDark }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'train'>('overview');
  const [isTraining, setIsTraining] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleTrain = async () => {
    setShowConfirm(false);
    setIsTraining(true);
    try {
      await api.post('/api/train/reinforce', {});
      showToast('Training started successfully', 'success');
    } catch (error) {
      showToast('Training failed', 'error');
    } finally {
      setIsTraining(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const dashboardStyles = isDark 
    ? 'bg-gray-900 text-white'
    : 'bg-white text-gray-800';

  const cardStyles = isDark 
    ? 'bg-gray-800 border-gray-700'
    : 'bg-white border-gray-200';

  return (
    <div className="fixed inset-0 bg-black/40 bg-opacity-80 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={`${dashboardStyles} w-full max-w-full sm:max-w-6xl md:max-w-7xl h-[95vh] sm:h-[90vh] flex flex-col rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl`}
      >
        <div className={`p-4 sm:p-6 md:p-8 ${isDark ? 'bg-gray-800' : 'bg-gray-50'} border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-br from-amber-600 to-amber-700 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                <Shield className="text-white" size={20} />
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
                Admin Control
              </h2>
            </div>
            <button
              onClick={onClose}
              className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-colors ${
                isDark 
                  ? 'hover:bg-gray-700 text-gray-400' 
                  : 'hover:bg-gray-200 text-gray-500'
              }`}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className={`flex gap-1 px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 ${isDark ? 'bg-gray-800' : 'bg-gray-50'} overflow-x-auto`}>
          {(['overview', 'sessions', 'train'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 sm:px-6 sm:py-4 md:px-8 uppercase tracking-widest text-xs sm:text-sm font-bold transition-all duration-300 rounded-t-lg sm:rounded-t-xl whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-lg'
                  : `${
                      isDark 
                        ? 'text-gray-400 hover:text-white hover:bg-gray-700' 
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'
                    }`
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className={`flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="bg-gradient-to-br from-amber-600 to-amber-700 p-4 sm:p-6 md:p-8 text-white rounded-xl sm:rounded-2xl shadow-lg">
                <Users size={32} className="mb-3 sm:mb-4 opacity-80" />
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2">{metrics.total_sessions}</div>
                <div className="text-amber-100 uppercase tracking-widest text-xs sm:text-sm font-medium">Total Consultations</div>
              </div>
              
              <div className={`p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl shadow-lg ${cardStyles} border`}>
                <MessageSquare size={32} className="mb-3 sm:mb-4 opacity-80" />
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2">{metrics.total_messages}</div>
                <div className={`uppercase tracking-widest text-xs sm:text-sm font-medium ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>Total Messages</div>
              </div>
              
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 sm:p-6 md:p-8 text-white rounded-xl sm:rounded-2xl shadow-lg">
                <TrendingUp size={32} className="mb-3 sm:mb-4 opacity-80" />
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-1 sm:mb-2">{((metrics.avg_score || 0) * 100).toFixed(1)}%</div>
                <div className="text-emerald-100 uppercase tracking-widest text-xs sm:text-sm font-medium">Avg Confidence</div>
              </div>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="space-y-4 sm:space-y-6">
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold uppercase tracking-wide mb-4 sm:mb-6">
                Recent Consultations
              </h3>
              <div className={`rounded-xl sm:rounded-2xl overflow-hidden shadow-lg ${cardStyles} border overflow-x-auto`}>
                <table className="w-full min-w-[600px]">
                  <thead className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                    <tr>
                      <th className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-left text-xs font-bold uppercase tracking-widest">
                        Session ID
                      </th>
                      <th className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-left text-xs font-bold uppercase tracking-widest">
                        Title
                      </th>
                      <th className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-left text-xs font-bold uppercase tracking-widest">
                        Created
                      </th>
                      <th className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-left text-xs font-bold uppercase tracking-widest">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session, idx) => (
                      <tr
                        key={session.id}
                        className={idx % 2 === 0 ? (isDark ? 'bg-gray-900' : 'bg-white') : (isDark ? 'bg-gray-800' : 'bg-gray-50')}
                      >
                        <td className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-sm font-mono">
                          {session.id}
                        </td>
                        <td className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-sm">
                          {session.title}
                        </td>
                        <td className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-sm font-mono">
                          {new Date(session.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 text-sm flex gap-2 sm:gap-4">
                          <button className="text-amber-500 hover:text-amber-400 transition-colors p-1 sm:p-2 rounded-lg hover:bg-amber-500 hover:bg-opacity-10">
                            <Download size={14} />
                          </button>
                          <button className="text-rose-500 hover:text-rose-400 transition-colors p-1 sm:p-2 rounded-lg hover:bg-rose-500 hover:bg-opacity-10">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'train' && (
            <div className="max-w-full sm:max-w-3xl mx-auto text-center space-y-6 sm:space-y-8">
              <div className="bg-gradient-to-br from-amber-600 to-amber-700 p-6 sm:p-8 md:p-12 rounded-xl sm:rounded-2xl shadow-lg">
                <Activity className="mx-auto text-white mb-4 sm:mb-6 opacity-80" size={48} />
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 sm:mb-4 uppercase tracking-wide">
                  Reinforcement Training
                </h3>
                <p className="text-amber-100 mb-6 sm:mb-8 text-sm sm:text-base md:text-lg leading-relaxed">
                  Trigger a background reinforcement learning job to improve the medical model based on
                  recent feedback and interactions.
                </p>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowConfirm(true)}
                  disabled={isTraining}
                  className="px-6 py-3 sm:px-8 sm:py-4 md:px-12 md:py-5 bg-white text-amber-600 hover:bg-amber-50 disabled:opacity-40 font-bold text-sm sm:text-base md:text-lg uppercase tracking-widest transition-colors duration-300 rounded-xl sm:rounded-2xl shadow-lg"
                >
                  {isTraining ? <LoadingSpinner size={20} /> : 'Trigger Training'}
                </motion.button>
              </div>

              <AnimatePresence>
                {showConfirm && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/40 bg-opacity-90 flex items-center justify-center z-50 p-4"
                  >
                    <div className={`p-6 sm:p-8 md:p-10 max-w-full sm:max-w-lg rounded-xl sm:rounded-2xl shadow-2xl ${cardStyles} border w-full`}>
                      <h4 className="text-lg sm:text-xl md:text-2xl font-bold mb-4 sm:mb-6 uppercase tracking-wide">
                        Confirm Training
                      </h4>
                      <p className={`mb-6 sm:mb-8 text-sm sm:text-base md:text-lg leading-relaxed ${
                        isDark ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        Are you sure you want to start reinforcement training? This may take several minutes.
                      </p>
                      <div className="flex gap-3 sm:gap-4 flex-col sm:flex-row">
                        <button
                          onClick={handleTrain}
                          className="flex-1 px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-br from-amber-600 to-amber-700 text-white hover:from-amber-700 hover:to-amber-800 uppercase font-bold tracking-wide transition-all duration-300 rounded-xl text-sm sm:text-base"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setShowConfirm(false)}
                          className={`flex-1 px-4 py-3 sm:px-6 sm:py-4 uppercase font-bold tracking-wide transition-all duration-300 rounded-xl text-sm sm:text-base ${
                            isDark 
                              ? 'bg-gray-700 text-white hover:bg-gray-600' 
                              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                          }`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
            isDark={isDark}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const DisclaimerModal: React.FC<{
  isOpen: boolean;
  onAccept: () => void;
  isDark: boolean;
}> = ({ isOpen, onAccept, isDark }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 bg-opacity-90 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className={`max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden ${
          isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-800'
        }`}
      >
        <div className={`p-6 sm:p-8 text-center ${
          isDark ? 'bg-amber-600' : 'bg-amber-500'
        }`}>
          <div className="w-16 h-16 mx-auto mb-4 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <AlertTriangle className="text-white" size={32} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Important Medical Disclaimer
          </h2>
          <p className="text-amber-100 text-lg">
            Please read this carefully before using My Doctor
          </p>
        </div>

        <div className={`p-6 sm:p-8 max-h-96 overflow-y-auto ${
          isDark ? 'bg-gray-800' : 'bg-gray-50'
        }`}>
          <div className="space-y-4 text-sm sm:text-base leading-relaxed">
            <div className={`p-4 rounded-xl border ${
              isDark ? 'bg-amber-900 bg-opacity-20 border-amber-700' : 'bg-amber-50 border-amber-200'
            }`}>
              <p className="font-semibold text-amber-600 mb-2">⚠️ AI Assistant Notice</p>
              <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                My Doctor is an AI-powered assistant and may sometimes provide inaccurate or incomplete information. 
                It is not a substitute for professional medical advice, diagnosis, or treatment.
              </p>
            </div>

            <div className="space-y-3">
              <p className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                By using this service, you acknowledge and agree that:
              </p>
              
              <ul className={`space-y-2 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 mt-1 flex-shrink-0">•</span>
                  <span>This is an AI assistant and not a licensed healthcare professional</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 mt-1 flex-shrink-0">•</span>
                  <span>Always consult with qualified healthcare providers for medical advice</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 mt-1 flex-shrink-0">•</span>
                  <span>Do not disregard professional medical advice or delay seeking it because of information provided here</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 mt-1 flex-shrink-0">•</span>
                  <span>In case of emergency, contact your local emergency services immediately</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 mt-1 flex-shrink-0">•</span>
                  <span>The information provided should be verified with healthcare professionals</span>
                </li>
              </ul>
            </div>

            <div className={`mt-6 p-4 rounded-xl border ${
              isDark ? 'bg-blue-900 bg-opacity-20 border-blue-700' : 'bg-blue-50 border-blue-200'
            }`}>
              <p className="text-sm font-medium text-blue-600">
                Developed by lscblack • Always seek professional medical advice before taking any actions
              </p>
            </div>
          </div>
        </div>

        <div className={`p-6 sm:p-8 border-t ${
          isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'
        }`}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAccept}
            className="w-full py-4 bg-gradient-to-br from-amber-600 to-amber-700 text-white font-bold text-lg rounded-xl shadow-lg hover:from-amber-700 hover:to-amber-800 transition-all duration-300"
          >
            I Understand - Continue to My Doctor
          </motion.button>
          <p className={`text-center mt-4 text-sm ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            You must accept these terms to use the application
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  const [isDark, setIsDark] = useLocalStorage('theme', true);
  const [userId, setUserId] = useState<string>('');
  const [currentSessionId, setCurrentSessionId] = useLocalStorage<number | null>('current_session_id', null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useLocalStorage('sidebar_open', true);
  const [metrics, setMetrics] = useState<Metrics>({ total_sessions: 0, total_messages: 0, avg_score: 0 });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [showThinking, setShowThinking] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize user ID from IP address
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const userIP = await getUserIP();
        setUserId(userIP);
        console.log('User ID set to:', userIP);
      } catch (error) {
        console.error('Failed to initialize user:', error);
        const fallbackId = `user-${Math.floor(Math.random() * 10000)}`;
        setUserId(fallbackId);
      }
    };

    initializeUser();
  }, []);

  // Load initial data once user ID is set and disclaimer is accepted
  useEffect(() => {
    if (userId && !showDisclaimer && !hasInitialized) {
      const initializeApp = async () => {
        setIsLoading(true);
        try {
          // Load sessions and metrics first
          await Promise.all([loadSessions(), loadMetrics()]);
          
          // If no current session exists, create one
          if (!currentSessionId) {
            await handleNewChat();
          } else {
            // Load history for existing session
            await loadHistory(currentSessionId);
          }
          
          setHasInitialized(true);
        } catch (error) {
          console.error('Failed to initialize app:', error);
          showToast('Failed to initialize application', 'error');
        } finally {
          setIsLoading(false);
        }
      };

      initializeApp();
    }
  }, [userId, showDisclaimer, hasInitialized]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSessions = async () => {
    if (!userId) return;
    
    try {
      const data = await api.get<Session[]>('/api/chat/sessions', { user_id: userId });
      console.log('Loaded sessions:', data);
      // Ensure data is always an array
      setSessions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      showToast('Failed to load sessions', 'error');
      // Set to empty array on error
      setSessions([]);
    }
  };

  const loadHistory = async (sessionId: number) => {
    if (!userId) return;
    
    try {
      const data = await api.get<Message[]>('/api/chat/history', { session_id: sessionId });
      console.log('Loaded history:', data);
      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load chat history:', error);
      showToast('Failed to load chat history', 'error');
      setMessages([]);
    }
  };

  const loadMetrics = async () => {
    try {
      const data = await api.get<Metrics>('/api/metrics');
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleNewChat = async (): Promise<number | null> => {
    if (!userId) {
      showToast('User not initialized', 'error');
      return null;
    }

    setIsCreatingSession(true);
    try {
      // Create a new session using GET endpoint with query parameters
      const response = await api.get<Session>('/api/chat/session', { 
        user_id: userId,
        title: 'New Consultation'
      });
      
      setCurrentSessionId(response.id);
      await loadSessions(); // Reload sessions to include the new one
      
      showToast('New consultation started', 'success');
      
      return response.id;
    } catch (error) {
      console.error('Failed to start new chat:', error);
      showToast('Failed to start consultation', 'error');
      return null;
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!userId) {
      showToast('User not initialized', 'error');
      return;
    }

    // If no session exists, create one first
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await handleNewChat();
      if (!sessionId) {
        showToast('Failed to create consultation', 'error');
        return;
      }
    }

    // Create temporary message for immediate UI feedback
    const tempUserMessage: Message = {
      id: generateTempId(),
      role: 'user',
      message: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, tempUserMessage]);
    setIsSending(true);
    setShowThinking(true);

    try {
      const response = await api.post<ChatResponse>('/api/chat', {
        user_id: userId,
        message: text,
        session_id: sessionId
      });

      // Replace temporary message with actual response using proper IDs
      setMessages(prev => {
        const filtered = prev.filter(msg => msg.id !== tempUserMessage.id);
        
        // Use server-provided IDs if available, otherwise generate new ones
        const actualUserMessage: Message = {
          id: response.session_id ? response.session_id * 1000 + filtered.length : generateTempId(),
          role: 'user',
          message: text,
          timestamp: new Date().toISOString()
        };
        
        const assistantMessage: Message = {
          id: response.session_id ? response.session_id * 1000 + filtered.length + 1 : generateTempId(),
          role: 'assistant',
          message: response.answer,
          score: response.score,
          timestamp: new Date().toISOString(),
          flagged: response.flagged
        };

        return [...filtered, actualUserMessage, assistantMessage];
      });

      // Reload sessions to update counts
      await loadSessions();

    } catch (error: any) {
      console.error('Failed to send message:', error);
      
      // Handle 404 by creating a new session and retrying
      if (error.message === 'NOT_FOUND' || error.message.includes('404')) {
        showToast('Session not found, creating new consultation...', 'info');
        const newSessionId = await handleNewChat();
        if (newSessionId) {
          // Retry the message with the new session
          await handleSendMessage(text);
          return;
        }
      } else {
        showToast('Failed to send message', 'error');
      }
      
      // Remove temporary message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id));
    } finally {
      setIsSending(false);
      setShowThinking(false);
    }
  };

  const handleEditMessage = async (messageId: number, newText: string) => {
    if (!userId || !currentSessionId) {
      showToast('No active session', 'error');
      return;
    }

    try {
      const response = await api.put<ChatResponse>(`/api/chat/edit/${messageId}`, { 
        new_message: newText
      });
      
      // Update the message locally
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, message: newText } : msg
      ));

      // Add the regenerated response with proper ID
      const assistantMessage: Message = {
        id: generateTempId(),
        role: 'assistant',
        message: response.answer,
        score: response.score,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
      showToast('Message edited and regenerated', 'success');

    } catch (error: any) {
      console.error('Failed to edit message:', error);
      
      // Handle 404 by creating a new session
      if (error.message === 'NOT_FOUND' || error.message.includes('404')) {
        showToast('Session not found, please start a new consultation', 'error');
        await handleNewChat();
      } else {
        showToast('Failed to edit message', 'error');
      }
    }
  };

  const handleResendMessage = async (messageId: number) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      await handleSendMessage(message.message);
    }
  };

  const handleFeedback = async (messageId: number, rating: number) => {
    if (!userId) {
      showToast('User not initialized', 'error');
      return;
    }

    try {
      await api.post('/api/feedback', {
        user_id: userId,
        message_id: messageId,
        rating: rating
      });
      showToast(rating > 0 ? 'Feedback sent - Thank you!' : 'Feedback noted - We\'ll improve!', 'success');
    } catch (error) {
      console.error('Failed to send feedback:', error);
      showToast('Failed to send feedback', 'error');
    }
  };

  const handleAdminLogin = () => {
    if (isAdmin) {
      setIsAdmin(false);
      setShowAdminDashboard(false);
      showToast('Logged out of admin', 'success');
    } else {
      setShowAdminLogin(true);
    }
  };

  const handleAdminSubmit = () => {
    const ADMIN_PASSWORD = 'admin123';
    
    if (adminPassword === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setAdminPassword('');
      showToast('Admin access granted', 'success');
    } else {
      showToast('Invalid password', 'error');
      setAdminPassword('');
    }
  };

  const handleSelectSession = async (sessionId: number) => {
    setCurrentSessionId(sessionId);
    // Load history for the selected session
    await loadHistory(sessionId);
  };

  const handleSuggestionClick = async (question: string) => {
    // Ensure we have a session before sending the message
    if (!currentSessionId) {
      const newSessionId = await handleNewChat();
      if (!newSessionId) {
        showToast('Failed to create consultation', 'error');
        return;
      }
    }
    await handleSendMessage(question);
  };

  // Safe session find for the header
  const currentSession = Array.isArray(sessions) ? sessions.find(s => s.id === currentSessionId) : null;

  const appStyles = isDark 
    ? 'bg-gray-900 text-white'
    : 'bg-gray-50 text-gray-800';

  // Don't show the main app until disclaimer is accepted
  if (showDisclaimer) {
    return (
      <DisclaimerModal 
        isOpen={showDisclaimer}
        onAccept={() => setShowDisclaimer(false)}
        isDark={isDark}
      />
    );
  }

  if (isLoading || !userId || !hasInitialized) {
    return (
      <div className={`flex items-center justify-center h-screen ${appStyles} transition-colors duration-300`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-amber-700 to-amber-800 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 mx-auto shadow-lg">
            <Heart className="text-white" size={28} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 bg-gradient-to-br from-amber-600 to-amber-800 bg-clip-text text-transparent">
            My Doctor
          </h1>
          <LoadingSpinner size={28} />
          <p className="mt-3 sm:mt-4 text-gray-500 text-sm sm:text-base">
            {!userId ? 'Initializing...' : 'Setting up your consultation...'}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen transition-colors duration-300 ${appStyles}`}>
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
        onToggleTheme={() => setIsDark(!isDark)}
        onAdminLogin={handleAdminLogin}
        isDark={isDark}
        isAdmin={isAdmin}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? 'lg:ml-0' : ''}`}>
        <div className={`px-4 py-4 sm:px-6 sm:py-5 flex items-center justify-between border-b ${
          isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white'
        } transition-colors duration-300`}>
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 rounded-xl transition-colors flex-shrink-0 ${
                isDark 
                  ? 'hover:bg-gray-800 text-gray-400' 
                  : 'hover:bg-gray-200 text-gray-500'
              }`}
            >
              <Menu size={18} />
            </button>
            <h2 className="text-lg sm:text-xl font-bold tracking-wide truncate">
              {currentSession?.title || 'New Consultation'}
            </h2>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
            {isAdmin && (
              <>
                <span className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold uppercase tracking-widest flex items-center gap-1.5 sm:gap-2 rounded-xl ${
                  isDark 
                    ? 'bg-amber-500 bg-opacity-20 text-amber-400' 
                    : 'bg-amber-100 text-amber-600'
                }`}>
                  <Shield size={12} />
                  <span className="hidden sm:inline">Admin</span>
                </span>
                <button
                  onClick={() => setShowAdminDashboard(true)}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 font-medium uppercase tracking-wide flex items-center gap-1.5 sm:gap-2 rounded-xl transition-all duration-300 text-xs sm:text-sm ${
                    isDark
                      ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white hover:from-amber-700 hover:to-amber-800'
                      : 'bg-gradient-to-br from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700'
                  }`}
                >
                  <Activity size={12} />
                  <span className="hidden sm:inline">Dashboard</span>
                </button>
              </>
            )}
            
            <div className={`hidden sm:flex items-center gap-4 sm:gap-6 text-sm font-medium ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>
              <div className="flex items-center gap-2">
                <MessageSquare size={14} />
                <span>{messages.length}</span>
              </div>
              {messages.length > 0 && (
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} />
                  <span>
                    {messages.filter(m => m.score !== undefined && m.score !== null).length > 0 
                      ? ((messages.filter(m => m.score !== undefined && m.score !== null)
                          .reduce((acc, m) => acc + (m.score || 0), 0) / 
                          messages.filter(m => m.score !== undefined && m.score !== null).length * 100) || 0).toFixed(0) + '%'
                      : '0%'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto px-2 sm:px-4 md:px-8 py-4 sm:py-6 md:py-10 transition-colors duration-300 ${
          isDark ? 'bg-gray-900' : 'bg-gray-100'
        }`}>
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full text-center py-8 sm:py-12 md:py-20 px-4"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-amber-700 to-amber-800 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 shadow-lg">
                  <Stethoscope size={28} className="text-white" />
                </div>
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4 bg-gradient-to-br from-amber-600 to-amber-800 bg-clip-text text-transparent">
                  How can I help you today?
                </h3>
                <p className={`max-w-xl text-sm sm:text-base md:text-lg leading-relaxed mb-6 sm:mb-8 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  I'm here to provide medical guidance, answer health questions, and help you understand your symptoms. Remember, I'm an AI assistant and not a substitute for professional medical advice.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-2xl w-full">
                  {SUGGESTED_QUESTIONS.map((question, index) => (
                    <motion.button
                      key={index}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSuggestionClick(question)}
                      className={`p-4 text-left rounded-xl transition-all duration-300 ${
                        isDark
                          ? 'bg-gray-800 hover:bg-gray-700 border border-gray-700'
                          : 'bg-white hover:bg-gray-50 border border-gray-200 shadow-sm'
                      }`}
                    >
                      <span className="text-sm font-medium">{question}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <>
                <AnimatePresence>
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      onEdit={handleEditMessage}
                      onResend={handleResendMessage}
                      onFeedback={handleFeedback}
                      isDark={isDark}
                    />
                  ))}
                </AnimatePresence>

                {showThinking && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start mb-6 px-2 sm:px-0"
                  >
                    <div className="max-w-full sm:max-w-[85%]">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isDark ? 'bg-amber-600' : 'bg-amber-500'
                        }`}>
                          <Stethoscope size={14} className="text-white" />
                        </div>
                        <div className={`px-6 py-4 rounded-2xl ${
                          isDark ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600'
                        } border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                          <div className="flex items-center gap-2">
                            <LoadingSpinner size={16} />
                            <span className="text-sm font-medium">My Doctor is thinking...</span>
                          </div>
                          <p className="text-xs mt-2 text-gray-500">
                            Please note: I am an AI assistant. Always consult with healthcare professionals for medical decisions.
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </>
            )}
          </div>
        </div>

        <ChatInput 
          onSend={handleSendMessage} 
          disabled={isSending || isCreatingSession} 
          isDark={isDark}
          hasActiveSession={!!currentSessionId}
        />
      </div>

      <AnimatePresence>
        {showAdminLogin && (
          <div className="fixed inset-0 bg-black/40 bg-opacity-90 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className={`p-6 sm:p-8 max-w-full sm:max-w-md w-full rounded-xl sm:rounded-2xl shadow-2xl ${
                isDark ? 'bg-gray-900' : 'bg-white'
              }`}
            >
              <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-600 to-amber-700 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg">
                  <Shield className="text-white" size={20} />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold">Admin Login</h3>
              </div>
              
              <p className={`mb-4 sm:mb-6 text-sm leading-relaxed ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Enter the admin password to access the dashboard and training controls.
              </p>

              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminSubmit()}
                placeholder="Admin password"
                className={`w-full px-4 py-3 sm:px-5 sm:py-4 mb-4 sm:mb-6 outline-none rounded-xl transition-colors duration-200 text-sm sm:text-base ${
                  isDark 
                    ? 'bg-gray-800 text-white placeholder-gray-400 focus:bg-gray-700' 
                    : 'bg-gray-100 text-gray-800 placeholder-gray-500 focus:bg-white focus:border-amber-300 border'
                }`}
                autoFocus
              />

              <div className="flex gap-3 sm:gap-4 flex-col sm:flex-row">
                <button
                  onClick={handleAdminSubmit}
                  className="flex-1 px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-br from-amber-600 to-amber-700 text-white hover:from-amber-700 hover:to-amber-800 font-bold uppercase tracking-wide transition-all duration-300 rounded-xl shadow-lg text-sm sm:text-base"
                >
                  Login
                </button>
                <button
                  onClick={() => {
                    setShowAdminLogin(false);
                    setAdminPassword('');
                  }}
                  className={`flex-1 px-4 py-3 sm:px-6 sm:py-4 font-bold uppercase tracking-wide transition-all duration-300 rounded-xl text-sm sm:text-base ${
                    isDark 
                      ? 'bg-gray-700 text-white hover:bg-gray-600' 
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
              </div>

              <p className={`mt-4 sm:mt-6 text-xs leading-relaxed ${
                isDark ? 'text-gray-500' : 'text-gray-400'
              }`}>
                Note: This is a client-side MVP authentication. For production, integrate with server-side authentication.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdminDashboard && isAdmin && (
          <AdminDashboard
            onClose={() => setShowAdminDashboard(false)}
            metrics={metrics}
            sessions={sessions}
            isDark={isDark}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
            isDark={isDark}
          />
        )}
      </AnimatePresence>
    </div>
  );
}