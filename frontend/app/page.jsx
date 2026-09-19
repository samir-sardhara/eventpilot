'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowUpRight, CalendarDays, CheckCircle2, CircleDollarSign, Clock3, LoaderCircle, Plus, Send, Sparkles, X } from 'lucide-react';
import { api, establishDemoSession } from '../lib/api';

const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };

function dateLabel(value, fallback = 'No date') {
  if (!value) return fallback;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(value));
}

function relativeDate(value) {
  if (!value) return 'No due date';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(value); due.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days}d`;
}

function MetricCard({ icon: Icon, label, value, tone, detail }) {
  return <article className={`metric-card ${tone}`}>
    <div className="metric-icon"><Icon size={19} /></div>
    <div><p>{label}</p><strong>{value}</strong><span>{detail}</span></div>
  </article>;
}

function RiskCard({ risk }) {
  return <article className="risk-card">
    <div className={`severity-dot ${risk.severity}`} />
    <div className="risk-copy">
      <div className="risk-heading"><h4>{risk.title}</h4><span className={`badge ${risk.severity}`}>{risk.severity}</span></div>
      <p>{risk.description}</p>
      {risk.action && <div className="risk-action"><ArrowUpRight size={14} /> {risk.action}</div>}
    </div>
  </article>;
}

function TaskRow({ task, onToggle }) {
  const done = task.status === 'done';
  return <div className={`task-row ${done ? 'is-done' : ''}`}>
    <button className={`task-check ${done ? 'checked' : ''}`} onClick={() => onToggle(task)} aria-label={`Mark ${task.title} ${done ? 'open' : 'done'}`}>
      {done && <CheckCircle2 size={16} />}
    </button>
    <div className="task-main"><strong>{task.title}</strong><span>{task.category} · {task.assignee || 'Unassigned'}{task.dependency ? ` · Depends on ${task.dependency}` : ''}</span></div>
    <span className={`priority ${task.priority}`}>{task.priority}</span>
    <span className={`due ${task.dueDate && new Date(task.dueDate) < new Date() && !done ? 'overdue' : ''}`}>{relativeDate(task.dueDate)}</span>
  </div>;
}

function ChatPanel({ onSend, sending }) {
  const [message, setMessage] = useState('');
  const submit = (event) => {
    event.preventDefault();
    if (!message.trim() || sending) return;
    onSend(message.trim());
    setMessage('');
  };
  const prompts = [
    'The photographer is unavailable for the Reception.',
    'Around 150 guests will need airport transfers and rooms.',
    'The décor vendor is confirmed.'
  ];
  return <aside className="chat-panel">
    <div className="chat-top"><div className="ai-orb"><Sparkles size={17} /></div><div><h3>EventPilot AI</h3><p><i /> Planning intelligence online</p></div></div>
    <div className="chat-intro"><span className="sparkle-line"><Sparkles size={17} /></span><h2>What changed?</h2><p>Tell me in plain language. I’ll update your plan, surface risks, and turn decisions into actions.</p></div>
    <div className="prompt-list">{prompts.map((prompt) => <button key={prompt} onClick={() => onSend(prompt)} disabled={sending}>{prompt}<ArrowUpRight size={15} /></button>)}</div>
    <form onSubmit={submit} className="chat-input"><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="e.g. Catering needs the final count a week before..." rows={3} /><button type="submit" disabled={sending || !message.trim()} aria-label="Send update">{sending ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}</button></form>
    <p className="chat-footnote">AI suggestions are saved as auditable tasks and risks.</p>
  </aside>;
}

function AddTaskModal({ onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const submit = (event) => { event.preventDefault(); if (title.trim()) onCreate({ title: title.trim(), priority, category: 'General', status: 'todo' }); };
  return <div className="modal-scrim" onMouseDown={onClose}><form className="modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}><button type="button" className="modal-close" onClick={onClose}><X size={19} /></button><p className="eyebrow">MANUAL ACTION</p><h2>Add a task</h2><label>Task title<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs to happen?" /></label><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><button className="primary-button" type="submit">Create task</button></form></div>;
}

export default function Home() {
  const [token, setToken] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [taskModal, setTaskModal] = useState(false);

  const load = useCallback(async (sessionToken, eventId) => {
    const data = await api.dashboard(eventId, sessionToken);
    setDashboard(data);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const sessionToken = await establishDemoSession();
        setToken(sessionToken);
        const wedding = await api.seedEvent(sessionToken, 'wedding');
        await api.seedEvent(sessionToken, 'corporate');
        const eventList = await api.events(sessionToken);
        setEvents(eventList.events);
        await load(sessionToken, wedding.event._id);
      } catch (error) { setNotice({ type: 'error', text: `${error.message} Check that the API and MongoDB are running.` }); }
      finally { setLoading(false); }
    })();
  }, [load]);

  const processUpdate = async (message) => {
    if (!dashboard || !token) return;
    setSending(true); setNotice(null);
    try {
      const result = await api.chat(dashboard.event._id, message, token);
      await load(token, dashboard.event._id);
      const changes = result.changes;
      setNotice({ type: 'success', text: `${result.reply} ${changes.suggestions?.[0] || ''}` });
    } catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setSending(false); }
  };

  const toggleTask = async (task) => {
    try { await api.updateTask(task._id, { status: task.status === 'done' ? 'todo' : 'done' }, token); await load(token, dashboard.event._id); }
    catch (error) { setNotice({ type: 'error', text: error.message }); }
  };

  const createTask = async (task) => {
    try { await api.createTask(dashboard.event._id, task, token); setTaskModal(false); await load(token, dashboard.event._id); }
    catch (error) { setNotice({ type: 'error', text: error.message }); }
  };

  const changeEvent = async (eventId) => {
    try { await load(token, eventId); setNotice(null); }
    catch (error) { setNotice({ type: 'error', text: error.message }); }
  };

  if (loading) return <main className="loading-page"><div className="loading-mark"><Sparkles /></div><p>Building your event command centre…</p></main>;
  if (!dashboard) return <main className="loading-page error-state"><AlertTriangle /><h1>Couldn’t load EventPilot</h1><p>{notice?.text}</p></main>;
  const { event, metrics, risks, tasks, milestones, attention } = dashboard;
  const progress = metrics.totalTasks ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100) : 0;
  const sortedTasks = [...tasks].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || (new Date(a.dueDate || '2100') - new Date(b.dueDate || '2100')));
  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="#top"><span><Sparkles size={18} /></span>EventPilot</a><label className="event-switcher"><span>EVENT</span><select aria-label="Choose event plan" value={event._id} onChange={(eventChange) => changeEvent(eventChange.target.value)}>{events.map((availableEvent) => <option key={availableEvent._id} value={availableEvent._id}>{availableEvent.name}</option>)}</select></label><div className="top-actions"><button className="icon-button" aria-label="Notifications"><AlertTriangle size={18} /><b>{metrics.openRisks}</b></button><div className="avatar">AE</div></div></header>
    <div className="workspace" id="top">
      <section className="content">
        <div className="event-hero"><div><p className="eyebrow">{event.type} · {event.city || 'Location pending'}</p><h1>{event.name}</h1><p className="event-meta"><CalendarDays size={16} /> {dateLabel(event.startDate)} – {dateLabel(event.endDate)} <span /> {event.guestCount.toLocaleString()} guests</p></div><div className="hero-status"><span className="status-dot" /> {event.status}</div></div>
        {notice && <div className={`notice ${notice.type}`}><span>{notice.type === 'error' ? <AlertTriangle size={17} /> : <Sparkles size={17} />}</span><p>{notice.text}</p><button onClick={() => setNotice(null)}><X size={16} /></button></div>}
        <section className="metrics-grid">
          <MetricCard icon={CheckCircle2} label="Plan progress" value={`${progress}%`} detail={`${metrics.completedTasks} of ${metrics.totalTasks} tasks complete`} tone="violet" />
          <MetricCard icon={AlertTriangle} label="Needs attention" value={attention.length} detail={metrics.blockedTasks ? `${metrics.blockedTasks} blocked action${metrics.blockedTasks > 1 ? 's' : ''}` : 'No blocked actions'} tone="coral" />
          <MetricCard icon={Clock3} label="Open risks" value={metrics.openRisks} detail={metrics.criticalRisks ? `${metrics.criticalRisks} critical` : 'No critical risks'} tone="amber" />
          <MetricCard icon={CircleDollarSign} label="Budget committed" value={`${metrics.budgetUsedPercent}%`} detail={`₹${(event.budget.committed / 100000).toFixed(1)}L of ₹${(event.budget.planned / 100000).toFixed(1)}L`} tone="blue" />
        </section>
        <section className="section-heading"><div><p className="eyebrow">DECISION SUPPORT</p><h2>Risks that need a call</h2></div><button className="text-button">View risk register <ArrowUpRight size={15} /></button></section>
        <section className="risk-grid">{risks.slice(0, 3).map((risk) => <RiskCard key={risk._id} risk={risk} />)}{!risks.length && <div className="empty-card">No open risks. Your plan is looking healthy.</div>}</section>
        <section className="plan-section"><div className="section-heading"><div><p className="eyebrow">EXECUTION BOARD</p><h2>Priority actions</h2></div><button className="add-task" onClick={() => setTaskModal(true)}><Plus size={16} /> Add task</button></div><div className="task-list">{sortedTasks.slice(0, 7).map((task) => <TaskRow key={task._id} task={task} onToggle={toggleTask} />)}</div></section>
        <section className="timeline-section"><div className="section-heading"><div><p className="eyebrow">RUN OF SHOW</p><h2>Key milestones</h2></div></div><div className="timeline">{milestones.map((milestone, index) => <div className="milestone" key={milestone._id || index}><div className={`timeline-point ${milestone.status}`} /><div><strong>{milestone.title}</strong><p>{dateLabel(milestone.date)}</p></div></div>)}</div></section>
      </section>
      <ChatPanel onSend={processUpdate} sending={sending} />
    </div>
    {taskModal && <AddTaskModal onClose={() => setTaskModal(false)} onCreate={createTask} />}
  </main>;
}
