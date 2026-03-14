import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  Archive, 
  CheckCircle2, 
  Circle,
  CheckSquare,
  Square,
  ListTodo,
  Trash2, 
  Plus, 
  X,
  Clock,
  Copy,
  RotateCcw,
  Settings,
  AlertTriangle,
  Save,
  Upload,
  BookOpen,
  Hash,
  Edit2,
  Check,
  AlignLeft,
  Moon,
  Sun,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  MessageCircle,
  Send,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Utility Spells ---
const callGeminiAPI = async (prompt, isJson = false) => {
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const modelName = "gemini-2.5-flash";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };

  if (isJson) {
    payload.generationConfig = { responseMimeType: "application/json" };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.error) {
      console.error("Bisikan error dari Google:", data.error.message);
      return null;
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    console.error("Gagal menembus pembatas:", error);
    return null;
  }
};

const getDaysDifference = (d1, d2) => {
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  const diffTime = date2 - date1;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getProgress = (start, end) => {
  const today = getTodayString();
  const total = getDaysDifference(start, end);
  const passed = getDaysDifference(start, today);

  if (total <= 0) return passed >= 0 ? 100 : 0;
  if (passed <= 0) return 0;
  if (passed >= total) return 100;
  
  return Math.round((passed / total) * 100);
};

// LocalStorage Hook for Persistence
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error("Storage spell failed:", error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    setStoredValue(prev => {
      const valueToStore = value instanceof Function ? value(prev) : value;
      try {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.error("Storage spell failed:", error);
      }
      return valueToStore;
    });
  };

  return [storedValue, setValue];
}

const getTodayString = () => new Date().toLocaleDateString('en-CA');

// --- Sub-Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick, danger }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group ${
      active 
        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/50' 
        : danger 
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
          : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400'
    }`}
  >
    <Icon size={18} className={active ? 'animate-pulse' : 'group-hover:scale-110 transition-transform duration-300'} />
    <span className="font-semibold text-sm tracking-wide">{label}</span>
  </button>
);

// --- Smooth Animation Variants ---
const taskVariants = {
  hidden: { opacity: 0, height: 0, marginBottom: 0, scale: 0.95, overflow: 'hidden' },
  visible: { 
    opacity: 1, 
    height: 'auto', 
    marginBottom: 16,
    scale: 1,
    transitionEnd: { overflow: 'visible' },
    transition: { type: "spring", stiffness: 400, damping: 30 } 
  },
  exit: { 
    opacity: 0, 
    height: 0, 
    marginBottom: 0, 
    scale: 0.95, 
    overflow: 'hidden',
    transition: { opacity: { duration: 0.2 }, height: { duration: 0.25 } } 
  }
};

// --- Main Views ---

const ScheduleView = ({ schedules, setSchedules }) => {
  const [courseName, setCourseName] = useState("");
  const [session, setSession] = useState("");
  const [note, setNote] = useState("");
  const [startDate, setStartDate] = useState(getTodayString());
  const [endDate, setEndDate] = useState(getTodayString());
  const [sortOrder, setSortOrder] = useState('nearest');

  // State to track collapsed tasks
  const [collapsedTasks, setCollapsedTasks] = useState({});

  // Inline Edit State
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ courseName: '', session: '', note: '', startDate: '', endDate: '', subtasks: [] });
  const [newSubtask, setNewSubtask] = useState("");

  // State untuk loading AI
  const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false);
  const [isGeneratingTips, setIsGeneratingTips] = useState(false);

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!courseName.trim()) return;
    
    const newItem = {
      id: crypto.randomUUID(),
      courseName,
      session,
      note,
      startDate,
      endDate,
      completed: false,
      archived: false,
      subtasks: [],
    };
    
    setSchedules(prev => [newItem, ...prev]);
    setCourseName("");
    setSession("");
    setNote("");
  };

  const toggleComplete = (id) => {
    setSchedules(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const duplicateTask = (id) => {
    setSchedules(prev => {
      const idx = prev.findIndex(item => item.id === id);
      if (idx === -1) return prev;
      const copy = { 
        ...prev[idx], 
        id: crypto.randomUUID(), 
        completed: false, 
        archived: false,
        subtasks: prev[idx].subtasks ? prev[idx].subtasks.map(st => ({ ...st, id: crypto.randomUUID(), completed: false })) : []
      };
      const newSchedules = [...prev];
      newSchedules.splice(idx + 1, 0, copy);
      return newSchedules;
    });
  };

  const deleteTask = (id) => {
    setSchedules(prev => prev.filter(item => item.id !== id));
  };

  const startEditing = (task) => {
    setEditingId(task.id);
    setEditForm({
      courseName: task.courseName,
      session: task.session || "",
      note: task.note || "",
      startDate: task.startDate,
      endDate: task.endDate,
      subtasks: task.subtasks || []
    });
    setNewSubtask("");
    setCollapsedTasks(prev => ({ ...prev, [task.id]: false }));
  };

  const cancelEditing = () => setEditingId(null);

  const saveEditing = (id) => {
    if (!editForm.courseName.trim()) return;
    setSchedules(prev => prev.map(item => 
      item.id === id ? { ...item, ...editForm } : item
    ));
    setEditingId(null);
  };

  const toggleSubtask = (taskId, subtaskId) => {
    setSchedules(prev => prev.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          subtasks: task.subtasks.map(st =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
          )
        };
      }
      return task;
    }));
  };

  const handleAddSubtaskEdit = (e) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    setEditForm(prev => ({
      ...prev,
      subtasks: [...(prev.subtasks || []), { id: crypto.randomUUID(), text: newSubtask, completed: false }]
    }));
    setNewSubtask("");
  };

  const removeSubtaskEdit = (subtaskId, e) => {
    e.preventDefault();
    setEditForm(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter(st => st.id !== subtaskId)
    }));
  };

  // Fitur AI: Pecah tugas menjadi sub-task menggunakan Gemini
  const handleAIGenerateSubtasks = async (e) => {
    e.preventDefault();
    if (!editForm.courseName) return;
    setIsGeneratingSubtasks(true);
    const prompt = `Break down this academic task into 3 actionable subtasks. Task: "${editForm.courseName}". Notes: "${editForm.note}". Return ONLY a JSON array of strings.`;
    const result = await callGeminiAPI(prompt, true);
    if (result) {
      try {
        const subtasksArray = JSON.parse(result);
        const newSubtasks = subtasksArray.map(text => ({ id: crypto.randomUUID(), text, completed: false }));
        setEditForm(prev => ({ ...prev, subtasks: [...(prev.subtasks || []), ...newSubtasks] }));
      } catch (e) {
        console.error("Gagal memparsing JSON dari AI", e);
      }
    }
    setIsGeneratingSubtasks(false);
  };

  // Fitur AI: Buat panduan/tips belajar menggunakan Gemini
  const handleAIGenerateTips = async (e) => {
    e.preventDefault();
    if (!editForm.courseName) return;
    setIsGeneratingTips(true);
    
    const subtaskTexts = editForm.subtasks && editForm.subtasks.length > 0 
      ? editForm.subtasks.map(st => st.text).join(', ') 
      : '';
      
    const prompt = `Give me 2 very brief, high-level study tips or key concepts to focus on for an academic task named: "${editForm.courseName}". ${subtaskTexts ? `It includes these specific subtasks: ${subtaskTexts}.` : ''} Keep it concise and use plain text.`;
    
    const result = await callGeminiAPI(prompt, false);
    if (result) {
      setEditForm(prev => ({ 
        ...prev, 
        note: prev.note ? prev.note + "\n\n✦Cyrene Tips:\n" + result : "✦Cyrene Tips:\n" + result 
      }));
    }
    setIsGeneratingTips(false);
  };

  const toggleCollapse = (taskId, isCurrentlyCollapsed) => {
    setCollapsedTasks(prev => ({ ...prev, [taskId]: !isCurrentlyCollapsed }));
  };

  const activeSchedules = schedules.filter(s => !s.archived);

  // Sorting Logic
  const sortedSchedules = [...activeSchedules].sort((a, b) => {
    const diffA = getDaysDifference(getTodayString(), a.endDate);
    const diffB = getDaysDifference(getTodayString(), b.endDate);
    return sortOrder === 'nearest' ? diffA - diffB : diffB - diffA;
  });

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 pb-10">
      <header className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight leading-none">Active Schedule</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Structure your time to seek the truth efficiently.</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Sort by:</span>
          <select 
            value={sortOrder} 
            onChange={(e) => setSortOrder(e.target.value)}
            className="bg-transparent border-none outline-none text-sm font-bold text-indigo-600 dark:text-indigo-400 cursor-pointer"
          >
            <option value="nearest">Nearest Deadline</option>
            <option value="furthest">Furthest Deadline</option>
          </select>
        </div>
      </header>

      <form onSubmit={handleAddTask} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 space-y-4 transition-colors">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
            <BookOpen size={18} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Course Name"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-slate-800 dark:text-slate-100 w-full placeholder-slate-400 dark:placeholder-slate-500"
              required
            />
          </div>
          <div className="md:w-32 flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
            <Hash size={18} className="text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Session"
              value={session}
              onChange={(e) => setSession(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-slate-800 dark:text-slate-100 w-full placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
          <AlignLeft size={18} className="text-slate-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Additional Notes (Optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-slate-800 dark:text-slate-100 w-full placeholder-slate-400 dark:placeholder-slate-500"
          />
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 rounded-xl">
            <Calendar size={18} className="text-slate-400" />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-300 w-full cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
          <span className="text-slate-400 font-medium text-xs hidden md:block">to</span>
          <div className="flex-1 w-full flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 px-4 py-3 rounded-xl">
            <Clock size={18} className="text-slate-400" />
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-300 w-full cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
          <button type="submit" className="w-full md:w-auto bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-indigo-500/30 text-sm font-semibold flex items-center justify-center gap-2">
            <Plus size={18} /> Add
          </button>
        </div>
      </form>

      <div className="pt-4">
        <AnimatePresence initial={false}>
          {sortedSchedules.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="text-center py-10 text-sm text-slate-400 italic"
            >
              No active schedules. The boundary is quiet... for now.
            </motion.div>
          ) : (
            sortedSchedules.map(task => {
              // --- EDIT MODE ---
              if (editingId === task.id) {
                return (
                  <motion.div
                    layout
                    variants={taskVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    key={`edit-${task.id}`}
                    style={{ originY: 0 }}
                  >
                    <div className="flex flex-col gap-4 bg-indigo-50/50 dark:bg-indigo-900/20 p-5 rounded-2xl border border-indigo-200 dark:border-indigo-800 w-full shadow-inner">
                      <div className="flex gap-4">
                        <input 
                          type="text" 
                          value={editForm.courseName}
                          onChange={e => setEditForm({...editForm, courseName: e.target.value})}
                          className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors"
                          placeholder="Course Name"
                          autoFocus
                        />
                        <input 
                          type="text" 
                          value={editForm.session}
                          onChange={e => setEditForm({...editForm, session: e.target.value})}
                          className="w-24 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800 dark:text-slate-100 transition-colors"
                          placeholder="Session"
                        />
                      </div>
                      
                      <div className="relative">
                        <input 
                          type="text" 
                          value={editForm.note}
                          onChange={e => setEditForm({...editForm, note: e.target.value})}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 pr-28 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800 dark:text-slate-100 transition-colors"
                          placeholder="Notes (Optional)"
                        />
                        <button 
                          onClick={handleAIGenerateTips} 
                          disabled={isGeneratingTips || !editForm.courseName}
                          className="absolute right-1.5 top-1.5 bottom-1.5 flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
                          title="Generate Study Tips with Cyrene"
                        >
                          {isGeneratingTips ? <Loader2 size={14} className="animate-spin" /> : <span>✦</span>}
                          Cyrene Tips
                        </button>
                      </div>

                      {/* Subtasks Editor */}
                      <div className="flex flex-col gap-2.5 bg-white/50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                          <div className="flex items-center gap-2">
                            <ListTodo size={16} /> Sub-Tasks
                          </div>
                          <button 
                            onClick={handleAIGenerateSubtasks}
                            disabled={isGeneratingSubtasks || !editForm.courseName}
                            className="flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-md transition-colors hover:bg-indigo-200 dark:hover:bg-indigo-900/70 disabled:opacity-50"
                            title="Auto-generate subtasks with AI"
                          >
                            {isGeneratingSubtasks ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            Auto-Generate
                          </button>
                        </div>
                        {editForm.subtasks && editForm.subtasks.map(st => (
                          <div key={st.id} className="flex items-center justify-between bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                            <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{st.text}</span>
                            <button onClick={(e) => removeSubtaskEdit(st.id, e)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={16} /></button>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            value={newSubtask}
                            onChange={e => setNewSubtask(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAddSubtaskEdit(e); }}
                            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800 dark:text-slate-100 transition-colors"
                            placeholder="New item..."
                          />
                          <button onClick={handleAddSubtaskEdit} className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold text-sm rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors">
                            Add
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-3 items-center">
                        <input 
                          type="date" 
                          value={editForm.startDate}
                          onChange={e => setEditForm({...editForm, startDate: e.target.value})}
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-700 dark:text-slate-300 [color-scheme:light] dark:[color-scheme:dark]"
                        />
                        <span className="text-slate-400 font-medium text-sm">to</span>
                        <input 
                          type="date" 
                          value={editForm.endDate}
                          onChange={e => setEditForm({...editForm, endDate: e.target.value})}
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-700 dark:text-slate-300 [color-scheme:light] dark:[color-scheme:dark]"
                        />
                        <div className="flex-1 flex justify-end gap-2">
                          <button onClick={cancelEditing} className="px-4 py-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors font-medium flex items-center gap-1.5" title="Cancel">
                            <X size={16} /> Cancel
                          </button>
                          <button onClick={() => saveEditing(task.id)} className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all shadow-md flex items-center gap-1.5 text-sm font-semibold" title="Save Changes">
                            <Check size={16} /> Save
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              }
              
              // Tracking deadline progression & Collapse Logic
              const daysLeft = getDaysDifference(getTodayString(), task.endDate);
              const daysUntilStart = getDaysDifference(getTodayString(), task.startDate);
              const progress = getProgress(task.startDate, task.endDate);
              const isFuture = daysUntilStart > 0;
              const isUrgent = daysLeft <= 2 && !isFuture;
              const isOverdue = daysLeft < 0;

              const isCollapsed = collapsedTasks[task.id] !== undefined ? collapsedTasks[task.id] : isFuture;
              
              let statusText = `${daysLeft} days left!`;
              if (isFuture) statusText = `Starts in ${daysUntilStart} days`;
              else if (daysLeft === 0) statusText = "Due today!";
              else if (daysLeft === 1) statusText = "1 day left!";
              else if (isOverdue) statusText = `Overdue by ${Math.abs(daysLeft)} days!`;

              // --- VIEW MODE ---
              return (
                <motion.div
                  layout
                  variants={taskVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  key={task.id}
                  style={{ originY: 0 }}
                >
                  <div className={`flex items-start gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl border ${isUrgent ? 'border-red-200 dark:border-red-800/50 bg-red-50/30 dark:bg-red-900/10' : 'border-slate-100 dark:border-slate-700'} group transition-all duration-300 hover:shadow-lg dark:hover:shadow-slate-900/50 hover:border-indigo-100 dark:hover:border-indigo-900/50 relative overflow-hidden`}>
                    <button onClick={() => toggleComplete(task.id)} className={`flex-shrink-0 mt-0.5 transition-colors ${task.completed ? 'text-green-500' : isUrgent ? 'text-red-400 hover:text-red-500' : 'text-slate-300 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400'}`}>
                      {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <p className={`text-slate-800 dark:text-slate-100 font-bold text-lg truncate transition-all ${task.completed ? 'line-through opacity-50' : ''}`}>
                            {task.courseName}
                          </p>
                          {task.session && (
                            <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${isUrgent ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : isFuture ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'}`}>
                              Session {task.session}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="flex flex-row items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditing(task)} className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Edit">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => duplicateTask(task.id)} className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors" title="Duplicate">
                              <Copy size={16} />
                            </button>
                            <button onClick={() => deleteTask(task.id)} className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <button 
                            onClick={() => toggleCollapse(task.id, isCollapsed)}
                            className="p-1 text-slate-400 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                          >
                            {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar size={14} className="text-slate-400 dark:text-slate-500" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {task.startDate} <span className="mx-1 opacity-50">→</span> {task.endDate}
                        </p>
                        {isCollapsed && (
                          <span className={`ml-auto text-xs font-bold ${isUrgent ? 'text-red-500 dark:text-red-400' : isFuture ? 'text-slate-400 dark:text-slate-500' : 'text-indigo-500 dark:text-indigo-400'}`}>
                            {statusText}
                          </span>
                        )}
                      </div>

                      <AnimatePresence initial={false}>
                        {!isCollapsed && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            {task.note && (
                              <div className="mt-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex items-start gap-3">
                                <AlignLeft size={16} className="text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
                                  {task.note}
                                </p>
                              </div>
                            )}

                            {/* Subtasks Renderer */}
                            {task.subtasks && task.subtasks.length > 0 && (
                              <div className="mt-4 space-y-2 pl-2 border-l-2 border-indigo-100 dark:border-indigo-900/50 ml-1 py-1">
                                {task.subtasks.map(st => (
                                  <div key={st.id} className="flex items-start gap-3 group/subtask ml-2">
                                    <button
                                      onClick={() => toggleSubtask(task.id, st.id)}
                                      className={`mt-0.5 flex-shrink-0 transition-colors ${st.completed ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600 hover:text-indigo-400 dark:hover:text-indigo-400'}`}
                                    >
                                      {st.completed ? <CheckSquare size={18} /> : <Square size={18} />}
                                    </button>
                                    <span className={`text-sm leading-relaxed transition-all ${st.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                      {st.text}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Progress Bar & Deadline Tracker */}
                            <div className="mt-5 pr-2">
                              <div className="flex justify-between items-end mb-2">
                                <span className={`text-sm font-bold ${isUrgent ? 'text-red-500 dark:text-red-400' : isFuture ? 'text-slate-400 dark:text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                  {statusText}
                                </span>
                                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{progress}% elapsed</span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-700/50 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-700 ease-out ${isUrgent ? 'bg-red-500' : isFuture ? 'bg-slate-300 dark:bg-slate-600' : 'bg-indigo-500 dark:bg-indigo-400'}`}
                                  style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                                ></div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const ArchiveView = ({ schedules, setSchedules }) => {
  const archivedSchedules = schedules.filter(s => s.archived);

  const restoreTask = (id) => {
    setSchedules(prev => prev.map(item => 
      item.id === id ? { ...item, archived: false, completed: false } : item
    ));
  };

  const permanentDeleteTask = (id) => {
    setSchedules(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 pb-10">
      <header className="mb-4">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight leading-none">Archive</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Memories and completed tasks residing in the boundary of history.</p>
      </header>

      <div className="space-y-3 opacity-90">
        <AnimatePresence initial={false}>
          {archivedSchedules.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10 text-sm text-slate-400 italic">
              The archive is empty. History has yet to be written.
            </motion.div>
          ) : (
            archivedSchedules.map(task => (
              <motion.div
                layout
                variants={taskVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                key={task.id}
                style={{ originY: 0 }}
              >
                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 group transition-all hover:bg-white dark:hover:bg-slate-800 hover:shadow-md">
                  <div className="flex-shrink-0 text-slate-400 dark:text-slate-500">
                    {task.completed ? <CheckCircle2 size={24} /> : <Archive size={24} />}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-base text-slate-600 dark:text-slate-300 font-bold truncate line-through">
                        {task.courseName}
                      </p>
                      {task.session && (
                        <span className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-lg">
                          Session {task.session}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1.5">
                      Ended: {task.endDate}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => restoreTask(task.id)} className="flex items-center gap-1.5 px-4 py-2 text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors font-semibold">
                      <RotateCcw size={14} /> Restore
                    </button>
                    <button onClick={() => permanentDeleteTask(task.id)} className="flex items-center gap-1.5 px-4 py-2 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors font-semibold">
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// --- Cyrene Chatting View ---

const CyreneChatView = () => {
  const [messages, setMessages] = useLocalStorage('mh_cyrene_chat', []);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Mantra penerjemah untuk mengubah bintang (Markdown) menjadi teks tebal
  const formatMessage = (text) => {
    if (!text) return null;
    return text.split(/\*\*(.*?)\*\*/g).map((part, index) => 
      index % 2 === 1 ? <strong key={index} className="font-bold">{part}</strong> : part
    );
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const newUserMsg = { role: 'user', text: input, timestamp: Date.now() };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);

    const promptContext = updatedMessages.slice(-10).map(m => `${m.role === 'user' ? 'User' : 'Cyrene'}: ${m.text}`).join('\n');
    
    // Memaksa Cyrene untuk hanya menggunakan Kaomoji Jepang
    const prompt = `Act as Cyrene, a personal assistant character inspired by Honkai Star Rail. You are helpful, a bit playful, and personal to the user. Keep responses concise, engaging, and friendly. Respond in the same language the user uses.
    CRITICAL RULE: DO NOT use any standard Unicode emojis (like 🚀, 😅, 🌟). You MUST ONLY use Japanese Kaomoji (like (≧◡≦), (*^ω^*), (◕‿◕), (✧ω✧), etc.) to express your emotions.
    Conversation history:
    ${promptContext}
    Cyrene:`;

    const response = await callGeminiAPI(prompt);
    
    if (response) {
      const newAiMsg = { role: 'ai', text: response, timestamp: Date.now() };
      setMessages(prev => [...prev, newAiMsg]);
    } else {
      setMessages(prev => [...prev, { role: 'ai', text: "*Sigh* Boundary connection failed. Cyrene is currently unreachable. (T_T)", timestamp: Date.now() }]);
    }
    setIsTyping(false);
  };

  const clearHistory = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full max-w-6xl mx-auto pb-4">
      <header className="flex justify-between items-center mb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight leading-none">Cyrene Chatting</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">A secret boundary connection. Memory persists permanently.</p>
        </div>
        <button 
          onClick={clearHistory}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition-colors text-sm font-semibold"
          title="Clear Chat History"
        >
          <Trash2 size={16} /> Clear History
        </button>
      </header>

      <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col shadow-sm min-h-[60vh]">
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 space-y-3">
              <MessageCircle size={48} className="opacity-50" />
              <p className="text-sm italic">Say hello to Cyrene... (´• ω •`)</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] flex flex-col gap-1 rounded-2xl px-5 py-3 text-[14px] leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-sm shadow-md' 
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-sm shadow-sm'
                  }`}>
                    <span className="whitespace-pre-wrap">{formatMessage(msg.text)}</span>
                    <span className={`text-[10px] ${msg.role === 'user' ? 'text-indigo-200 text-right' : 'text-slate-400 dark:text-slate-400 text-left'}`}>
                      {timeStr}
                    </span>
                  </div>
                </motion.div>
              );
            })
          )}
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl rounded-bl-sm px-5 py-4 shadow-sm flex gap-1.5">
                <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Cyrene..."
              disabled={isTyping}
              className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800 dark:text-slate-100 transition-colors disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={isTyping || !input.trim()}
              className="bg-indigo-600 text-white px-5 py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-indigo-500/30 flex items-center justify-center disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Modals ---

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-slate-800 rounded-xl p-5 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-700"
      >
        <div className="flex items-center gap-2 text-red-500 dark:text-red-400 mb-3">
          <AlertTriangle size={20} />
          <h2 className="text-base font-bold text-slate-800 dark:text-white">{title}</h2>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold transition-colors">
            Cancel
          </button>
          <button onClick={() => { onConfirm(); onClose(); }} className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-semibold shadow-sm shadow-red-500/30 transition-colors">
            Purge Data
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [activeView, setActiveView] = useState('schedule');
  const [schedules, setSchedules] = useLocalStorage('mh_schedules_v3', []);
  const [isDarkMode, setIsDarkMode] = useLocalStorage('mh_theme_dark', false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Auto-Archive Logic Spell
  useEffect(() => {
    const today = getTodayString();
    let hasChanges = false;
    
    const updatedSchedules = schedules.map(task => {
      if (!task.archived) {
        if (task.completed || task.endDate < today) {
          hasChanges = true;
          return { ...task, archived: true };
        }
      }
      return task;
    });

    if (hasChanges) {
      const timer = setTimeout(() => {
        setSchedules(updatedSchedules);
      }, 500); 
      return () => clearTimeout(timer);
    }
  }, [schedules, setSchedules]);

  const handleSaveData = () => {
    const chatData = JSON.parse(window.localStorage.getItem('mh_cyrene_chat') || '[]');
    const backupData = {
      schedules: schedules,
      chat: chatData
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `cyrenes_grimoire_backup_${getTodayString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data)) {
          // Format lama: hanya memuat jadwal
          setSchedules(data);
        } else if (data.schedules) {
          // Format baru: memuat jadwal dan riwayat obrolan
          setSchedules(data.schedules);
          if (data.chat) {
            window.localStorage.setItem('mh_cyrene_chat', JSON.stringify(data.chat));
          }
        }
        // Memuat ulang realitas agar chat yang baru diunggah langsung terlihat
        window.location.reload(); 
      } catch (error) {
        console.error("Mantra pemulihan gagal. Segel Grimoire tidak valid:", error);
      }
    };
    reader.readAsText(file);
    // Mengosongkan input agar bisa mengunggah file yang sama lagi jika perlu
    event.target.value = '';
  };

  const handleClearAllData = () => {
    setSchedules([]);
    window.localStorage.removeItem('mh_schedules_v3');
    window.localStorage.removeItem('mh_cyrene_chat');
    window.location.reload(); 
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} min-h-screen w-full`}>
      <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900 transition-colors duration-500 flex flex-col md:flex-row font-sans text-slate-900 dark:text-slate-100 selection:bg-indigo-200 dark:selection:bg-indigo-900">
        
        {/* Mobile Top Header */}
        <div className="md:hidden flex items-center justify-between bg-white dark:bg-slate-800 p-3 border-b border-slate-200 dark:border-slate-700 z-30 relative shadow-sm transition-colors duration-500">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-indigo-200 dark:shadow-indigo-900/50 transition-all">
              C
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-800 dark:text-white leading-tight">Cyrene's Grimoire</h2>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Productivity</p>
            </div>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className={`
          ${isMobileMenuOpen ? 'flex absolute top-[57px] bottom-0 left-0 right-0 z-20' : 'hidden'}
          md:flex w-full md:w-52 md:relative bg-white dark:bg-slate-800 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 p-4 flex-col shrink-0 transition-colors duration-500
        `}>
          {/* Desktop Logo */}
          <div className="hidden md:flex items-center gap-2.5 mb-6 px-1">
            <img src="/faviconcy.jpg" alt="Cyrene Kesayangan Indra" className="w-8 h-8 md:w-9 md:h-9 rounded-lg object-cover shadow-sm shadow-indigo-200 dark:shadow-indigo-900/50 transition-all hover:rotate-12" />
            <div>
              <h2 className="font-bold text-sm text-slate-800 dark:text-white leading-tight">Cyrene's Grimoire</h2>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Productivity</p>
            </div>
          </div>

          <div className="flex flex-col gap-1 overflow-y-auto flex-1">
            <SidebarItem icon={Calendar} label="Active Schedule" active={activeView === 'schedule'} onClick={() => { setActiveView('schedule'); setIsMobileMenuOpen(false); }} />
            <SidebarItem icon={MessageCircle} label="Cyrene Chatting" active={activeView === 'chat'} onClick={() => { setActiveView('chat'); setIsMobileMenuOpen(false); }} />
            <SidebarItem icon={Archive} label="Archive" active={activeView === 'archive'} onClick={() => { setActiveView('archive'); setIsMobileMenuOpen(false); }} />
          </div>

          {/* Data Management Section */}
          <div className="mt-6 md:mt-auto pt-4 border-t border-slate-100 dark:border-slate-700 space-y-1">
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-2.5">Grimoire Seals</p>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all group"
            >
              <div className="flex items-center gap-2">
                {isDarkMode ? <Sun size={14} className="group-hover:rotate-90 transition-transform duration-500" /> : <Moon size={14} className="group-hover:-rotate-12 transition-transform duration-500" />}
                <span className="font-semibold text-[11px] tracking-wide">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </div>
            </button>
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              onChange={handleLoadData} 
              className="hidden" 
            />
            <SidebarItem icon={Upload} label="Load Backup" onClick={() => fileInputRef.current?.click()} />
            <SidebarItem icon={Save} label="Save Backup" onClick={handleSaveData} />
            <SidebarItem icon={Settings} label="Clear Data" danger onClick={() => setIsClearModalOpen(true)} />
          </div>
        </nav>

        {/* Main Content Area */}
        <main className={`flex-1 p-3 md:p-5 overflow-y-auto relative h-[calc(100vh-57px)] md:h-screen scroll-smooth flex-col ${isMobileMenuOpen ? 'hidden md:flex' : 'flex'}`}>
          {activeView === 'schedule' && <ScheduleView schedules={schedules} setSchedules={setSchedules} />}
          {activeView === 'chat' && <CyreneChatView />}
          {activeView === 'archive' && <ArchiveView schedules={schedules} setSchedules={setSchedules} />}
        </main>

        <ConfirmModal 
          isOpen={isClearModalOpen} 
          onClose={() => setIsClearModalOpen(false)}
          onConfirm={handleClearAllData}
          title="Sever the Boundary?"
          message="This spell will permanently delete all your academic schedules and chat history from LocalStorage. This action cannot be undone."
        />
        
      </div>
    </div>
  );
}