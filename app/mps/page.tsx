'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Printer, RefreshCw, Trash2, BarChart2, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useActiveSection } from '../../lib/useActiveSection';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────








const SUBJECTS_JHS = [
  'Filipino','English','Mathematics','Science',
  'Araling Panlipunan (AP)','Edukasyon sa Pagpapakatao (EsP)',
  'Edukasyong Pantahanan at Pangkabuhayan (EPP)',
  'MAPEH - Music','MAPEH - Arts','MAPEH - Physical Education','MAPEH - Health',
];
const SUBJECTS_SHS = [
  'SHS Core Subject','SHS Applied Track','SHS Specialized Subject',
  'SHS Work Immersion','SHS Research / Capstone',
];
const ALL_SUBJECTS = [...SUBJECTS_JHS, ...SUBJECTS_SHS];

const MASTERY_LEVELS = [
  { min: 96, max: 100, label: 'Mastered',                        color: 'bg-emerald-500', text: 'text-emerald-400' },
  { min: 86, max: 95,  label: 'Closely Approximating Mastery',   color: 'bg-green-500',   text: 'text-green-400'   },
  { min: 66, max: 85,  label: 'Moving Towards Mastery',          color: 'bg-blue-500',    text: 'text-blue-400'    },
  { min: 35, max: 65,  label: 'Average',                         color: 'bg-yellow-500',  text: 'text-yellow-400'  },
  { min: 16, max: 34,  label: 'Low',                             color: 'bg-orange-500',  text: 'text-orange-400'  },
  { min: 0,  max: 15,  label: 'Very Low',                        color: 'bg-red-500',     text: 'text-red-400'     },
];

function getMastery(pct: number) {
  return MASTERY_LEVELS.find(l => pct >= l.min && pct <= l.max) ?? MASTERY_LEVELS[5];
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Student  { id: string; full_name: string; }
interface Item     { id: string; no: number; competency: string; }
interface ItemScore { student_id: string; item_id: string; score: number; } // 1 or 0

interface MPSRecord {
  id: string;
  subject: string;
  term: number;
  assessment_type: string; // 'Written Work' | 'Performance Task' | 'Term Assessment'
  items: Item[];
  scores: ItemScore[];
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function computeMPS(items: Item[], scores: ItemScore[], students: Student[]) {
  const n = students.length;
  const total = items.length;
  if (!n || !total) return { mps: 0, itemStats: [] };

  const itemStats = items.map(item => {
    const correct = scores.filter(s => s.item_id === item.id && s.score === 1).length;
    const pct     = n > 0 ? (correct / n) * 100 : 0;
    return { item, correct, pct, mastery: getMastery(pct) };
  });

  const totalCorrect = scores.filter(s => s.score === 1).length;
  const mps = (n * total) > 0 ? (totalCorrect / (n * total)) * 100 : 0;

  return { mps, itemStats };
}

// ─────────────────────────────────────────────────────────────────────────────
// BAR CHART COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 bg-gray-700 rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-300 w-10 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function MPSPage() {
  const { sectionId, sectionName, gradeLevel, schoolName, schoolId, schoolYear, division, region, adviser } = useActiveSection();

  const [subject,  setSubject]  = useState('Filipino');
  const [term,     setTerm]     = useState(1);
  const [assessType, setAssessType] = useState('Written Work');
  const [students, setStudents] = useState<Student[]>([]);
  const [items,    setItems]    = useState<Item[]>([]);
  const [scores,   setScores]   = useState<ItemScore[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [newComp,  setNewComp]  = useState('');
  const [view,     setView]     = useState<'encode'|'analysis'>('encode');

  // ── Load students ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('students').select('id,full_name').eq('section_id', sectionId).order('full_name');
      setStudents(data ?? []);
      setLoading(false);
    })();
  }, []);

  // ── Load MPS record for current filter ────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('mps_records')
        .select('*')
        .eq('subject', subject)
        .eq('term', term)
        .eq('assessment_type', assessType)
        .eq('section_id', sectionId)
        .maybeSingle();

      if (data) {
        setRecordId(data.id);
        setItems(data.items ?? []);
        setScores(data.scores ?? []);
      } else {
        setRecordId(null);
        setItems([]);
        setScores([]);
      }
      setLoading(false);
    })();
  }, [subject, term, assessType]);

  // ── Save full record ───────────────────────────────────────────────────────
  const save = async (newItems: Item[], newScores: ItemScore[]) => {
    setSaving(true);
    const payload = {
      section_id: sectionId, subject, term, assessment_type: assessType,
      items: newItems, scores: newScores,
    };
    if (recordId) {
      await supabase.from('mps_records').update(payload).eq('id', recordId);
    } else {
      const { data } = await supabase.from('mps_records').insert({ ...payload }).select().single();
      if (data) setRecordId(data.id);
    }
    setSaving(false);
  };

  // ── Add item / competency ──────────────────────────────────────────────────
  const addItem = async () => {
    if (!newComp.trim()) return;
    const item: Item = {
      id: crypto.randomUUID(),
      no: items.length + 1,
      competency: newComp.trim(),
    };
    const next = [...items, item];
    setItems(next);
    setNewComp('');
    await save(next, scores);
  };

  // ── Remove item ────────────────────────────────────────────────────────────
  const removeItem = async (itemId: string) => {
    const next = items.filter(i => i.id !== itemId).map((i, idx) => ({ ...i, no: idx + 1 }));
    const nextScores = scores.filter(s => s.item_id !== itemId);
    setItems(next);
    setScores(nextScores);
    await save(next, nextScores);
  };

  // ── Toggle score (1/0 per student per item) ────────────────────────────────
  const toggleScore = async (studentId: string, itemId: string) => {
    const existing = scores.find(s => s.student_id === studentId && s.item_id === itemId);
    let nextScores: ItemScore[];
    if (!existing) {
      nextScores = [...scores, { student_id: studentId, item_id: itemId, score: 1 }];
    } else if (existing.score === 1) {
      nextScores = scores.map(s => s.student_id === studentId && s.item_id === itemId ? { ...s, score: 0 } : s);
    } else {
      nextScores = scores.map(s => s.student_id === studentId && s.item_id === itemId ? { ...s, score: 1 } : s);
    }
    setScores(nextScores);
    await save(items, nextScores);
  };

  const getScore = (studentId: string, itemId: string) =>
    scores.find(s => s.student_id === studentId && s.item_id === itemId)?.score ?? 0;

  const getStudentTotal = (sid: string) => items.reduce((sum, item) => sum + getScore(sid, item.id), 0);

  const { mps, itemStats } = computeMPS(items, scores, students);

  const leastMastered = [...itemStats].sort((a, b) => a.pct - b.pct).slice(0, 5);
  const mostMastered  = [...itemStats].sort((a, b) => b.pct - a.pct).slice(0, 5);

  // ─────────────────────────────────────────────────────────────────────────
  // PRINT VIEW
  // ─────────────────────────────────────────────────────────────────────────
  const PrintView = () => (
    <div className="bg-white text-black p-6 text-xs" style={{ minWidth: '900px' }}>
      <div className="text-center mb-3">
        <div className="font-bold text-base">ITEM ANALYSIS / MEAN PERCENTAGE SCORE (MPS)</div>
        <div>{schoolName} · {schoolYear} · {gradeLevel} - {sectionName}</div>
        <div>Subject: <strong>{subject}</strong> · Term: <strong>{term}</strong> · Assessment: <strong>{assessType}</strong></div>
      </div>

      {/* MPS summary */}
      <div className="flex gap-4 mb-4 justify-center">
        <div className="border border-black px-6 py-2 text-center">
          <div className="font-bold text-2xl">{mps.toFixed(2)}%</div>
          <div className="text-xs">Mean Percentage Score (MPS)</div>
          <div className="font-semibold mt-1">{getMastery(mps).label}</div>
        </div>
        <div className="border border-black px-6 py-2 text-center">
          <div className="font-bold text-2xl">{students.length}</div>
          <div className="text-xs">No. of Learners</div>
        </div>
        <div className="border border-black px-6 py-2 text-center">
          <div className="font-bold text-2xl">{items.length}</div>
          <div className="text-xs">No. of Items</div>
        </div>
      </div>

      {/* Item analysis table */}
      <table className="w-full border-collapse mb-4" style={{ fontSize: '9px' }}>
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-black px-1 py-1">Item No.</th>
            <th className="border border-black px-1 py-1 text-left">Learning Competency</th>
            <th className="border border-black px-1 py-1">No. Correct</th>
            <th className="border border-black px-1 py-1">% Correct</th>
            <th className="border border-black px-1 py-1">Mastery Level</th>
          </tr>
        </thead>
        <tbody>
          {itemStats.map(({ item, correct, pct, mastery }) => (
            <tr key={item.id}>
              <td className="border border-black px-1 py-0.5 text-center">{item.no}</td>
              <td className="border border-black px-1 py-0.5">{item.competency}</td>
              <td className="border border-black px-1 py-0.5 text-center">{correct}/{students.length}</td>
              <td className="border border-black px-1 py-0.5 text-center font-bold">{pct.toFixed(2)}%</td>
              <td className="border border-black px-1 py-0.5 text-center">{mastery.label}</td>
            </tr>
          ))}
          <tr className="bg-gray-100 font-bold">
            <td colSpan={3} className="border border-black px-1 py-1 text-right">MPS =</td>
            <td className="border border-black px-1 py-1 text-center">{mps.toFixed(2)}%</td>
            <td className="border border-black px-1 py-1 text-center">{getMastery(mps).label}</td>
          </tr>
        </tbody>
      </table>

      {/* Least / Most mastered */}
      <div className="flex gap-4">
        <div className="flex-1 border border-black p-2">
          <div className="font-bold mb-1">LEAST MASTERED COMPETENCIES (Bottom 5)</div>
          {leastMastered.map((s, i) => (
            <div key={s.item.id} className="flex justify-between py-0.5 border-b border-gray-200">
              <span>{i+1}. {s.item.competency}</span>
              <span className="font-bold ml-2">{s.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <div className="flex-1 border border-black p-2">
          <div className="font-bold mb-1">MOST MASTERED COMPETENCIES (Top 5)</div>
          {mostMastered.map((s, i) => (
            <div key={s.item.id} className="flex justify-between py-0.5 border-b border-gray-200">
              <span>{i+1}. {s.item.competency}</span>
              <span className="font-bold ml-2">{s.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between mt-6 text-xs">
        <div className="text-center"><div className="border-t border-black mt-8 pt-1" style={{minWidth:'180px'}}>{sectionName} Adviser</div></div>
        <div className="text-center"><div className="border-t border-black mt-8 pt-1" style={{minWidth:'180px'}}>Department Head</div></div>
        <div className="text-center"><div className="border-t border-black mt-8 pt-1" style={{minWidth:'180px'}}>School Head</div></div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`@media print{.no-print{display:none!important}body{background:white!important}@page{margin:10mm}}`}</style>
      <div className="min-h-screen bg-gray-950 text-white">

        {/* Header */}
        <div className="no-print bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => window.history.back()} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-800 transition text-blue-400">
              <ArrowLeft size={22}/>
            </button>
            <div>
              <h1 className="text-2xl font-bold">MPS & Item Analysis</h1>
              <p className="text-gray-400 text-sm">Term {term} · {subject} · {assessType}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {saving && <div className="flex items-center gap-2 text-blue-400 text-sm"><RefreshCw size={14} className="animate-spin"/>Saving…</div>}
            <div className="flex rounded-xl overflow-hidden border border-gray-700">
              <button onClick={() => setView('encode')} className={`px-4 py-2 text-sm font-medium transition ${view==='encode'?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>📝 Encode</button>
              <button onClick={() => setView('analysis')} className={`px-4 py-2 text-sm font-medium transition ${view==='analysis'?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>📊 Analysis</button>
            </div>
            <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Printer size={16}/>Print
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="no-print px-6 py-4 flex flex-wrap gap-3 items-center bg-gray-900/50 border-b border-gray-800">
          <select value={subject} onChange={e => setSubject(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500">
            <optgroup label="Junior High School">{SUBJECTS_JHS.map(s => <option key={s}>{s}</option>)}</optgroup>
            <optgroup label="Senior High School">{SUBJECTS_SHS.map(s => <option key={s}>{s}</option>)}</optgroup>
          </select>

          <div className="flex rounded-xl overflow-hidden border border-gray-700">
            {[1,2,3].map(t => (
              <button key={t} onClick={() => setTerm(t)}
                className={`px-5 py-2.5 text-sm font-medium transition ${term===t?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                Term {t}
              </button>
            ))}
          </div>

          <div className="flex rounded-xl overflow-hidden border border-gray-700">
            {['Written Work','Performance Task','Term Assessment'].map(a => (
              <button key={a} onClick={() => setAssessType(a)}
                className={`px-4 py-2.5 text-sm font-medium transition ${assessType===a?'bg-purple-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                {a}
              </button>
            ))}
          </div>

          {/* MPS badge */}
          {items.length > 0 && (
            <div className={`ml-auto px-5 py-2 rounded-xl font-bold text-sm ${getMastery(mps).color} text-white`}>
              MPS: {mps.toFixed(2)}% — {getMastery(mps).label}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <RefreshCw size={20} className="animate-spin"/>Loading…
          </div>
        ) : (
          <div className="px-6 py-6">

            {/* ── ENCODE VIEW ── */}
            {view === 'encode' && (
              <div>
                {/* Add competency */}
                <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 mb-6 flex gap-3">
                  <input value={newComp} onChange={e => setNewComp(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addItem()}
                    placeholder="Type learning competency / item description then press Enter…"
                    className="flex-1 bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"/>
                  <button onClick={addItem} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-xl text-sm font-semibold transition">
                    <Plus size={16}/>Add Item
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <BarChart2 size={48} className="mx-auto mb-4 opacity-30"/>
                    <p>No items yet. Add learning competencies above to start the item analysis.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-separate border-spacing-0" style={{ minWidth: `${220 + items.length * 48}px` }}>
                      <thead>
                        <tr>
                          <th className="bg-gray-800 text-left px-3 py-3 rounded-tl-xl min-w-[200px] sticky left-0 z-10">Learner's Name</th>
                          {items.map(item => (
                            <th key={item.id} className="bg-gray-800 text-center px-1 py-2 min-w-[44px] group">
                              <div className="text-gray-300 font-bold">{item.no}</div>
                              <div className="text-gray-500 text-xs truncate max-w-[40px] mx-auto" title={item.competency}>
                                {item.competency.substring(0, 8)}…
                              </div>
                              <button onClick={() => removeItem(item.id)} title={`Remove: ${item.competency}`}
                                className="opacity-0 group-hover:opacity-100 transition mt-1 text-red-400 hover:text-red-300">
                                <Trash2 size={12}/>
                              </button>
                            </th>
                          ))}
                          <th className="bg-blue-900 text-center px-3 py-3 rounded-tr-xl">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map(student => {
                          const total = getStudentTotal(student.id);
                          const pct   = items.length > 0 ? (total / items.length) * 100 : 0;
                          return (
                            <tr key={student.id} className="border-t border-gray-800 hover:bg-gray-900/40">
                              <td className="px-3 py-2 font-medium sticky left-0 bg-gray-950 border-r border-gray-800 z-10">{student.full_name}</td>
                              {items.map(item => {
                                const s = getScore(student.id, item.id);
                                return (
                                  <td key={item.id} className="text-center p-1 border-l border-gray-800">
                                    <button onClick={() => toggleScore(student.id, item.id)}
                                      className={`w-8 h-8 rounded-lg font-bold text-sm transition hover:scale-110 active:scale-95
                                        ${s === 1 ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}>
                                      {s === 1 ? '1' : '0'}
                                    </button>
                                  </td>
                                );
                              })}
                              <td className="text-center px-3 py-2 border-l border-gray-800">
                                <span className={`font-bold ${pct >= 75 ? 'text-emerald-400' : 'text-red-400'}`}>{total}/{items.length}</span>
                                <div className="text-xs text-gray-500">{pct.toFixed(0)}%</div>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Item totals row */}
                        <tr className="border-t-2 border-gray-600 bg-gray-900">
                          <td className="px-3 py-2 font-bold text-gray-400 text-xs sticky left-0 bg-gray-900">No. Correct</td>
                          {items.map(item => {
                            const correct = scores.filter(s => s.item_id === item.id && s.score === 1).length;
                            return <td key={item.id} className="text-center py-2 border-l border-gray-700 font-bold text-blue-300">{correct}</td>;
                          })}
                          <td className="border-l border-gray-700"></td>
                        </tr>
                        <tr className="bg-gray-900">
                          <td className="px-3 py-2 font-bold text-gray-400 text-xs sticky left-0 bg-gray-900">% Correct</td>
                          {items.map(item => {
                            const correct = scores.filter(s => s.item_id === item.id && s.score === 1).length;
                            const pct     = students.length > 0 ? (correct / students.length) * 100 : 0;
                            const m       = getMastery(pct);
                            return (
                              <td key={item.id} className={`text-center py-2 border-l border-gray-700 font-bold text-xs ${m.text}`}>
                                {pct.toFixed(0)}%
                              </td>
                            );
                          })}
                          <td className="border-l border-gray-700"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── ANALYSIS VIEW ── */}
            {view === 'analysis' && (
              <div className="space-y-6">
                {/* MPS Hero */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={`${getMastery(mps).color} rounded-2xl p-6 text-white text-center shadow-lg`}>
                    <div className="text-5xl font-black">{mps.toFixed(2)}%</div>
                    <div className="text-sm opacity-80 mt-1">Mean Percentage Score</div>
                    <div className="font-bold text-lg mt-1">{getMastery(mps).label}</div>
                  </div>
                  <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 text-center">
                    <div className="text-4xl font-bold text-white">{students.length}</div>
                    <div className="text-gray-400 text-sm mt-1">Learners</div>
                  </div>
                  <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 text-center">
                    <div className="text-4xl font-bold text-white">{items.length}</div>
                    <div className="text-gray-400 text-sm mt-1">Test Items</div>
                  </div>
                </div>

                {/* Mastery distribution */}
                <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
                  <h3 className="font-bold text-white mb-4">Mastery Level Distribution</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {MASTERY_LEVELS.map(level => {
                      const count = itemStats.filter(s => s.mastery.label === level.label).length;
                      const pct   = items.length > 0 ? (count / items.length) * 100 : 0;
                      return (
                        <div key={level.label} className="bg-gray-800 rounded-xl p-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className={`text-xs font-medium ${level.text}`}>{level.label}</span>
                            <span className="text-white font-bold">{count}</span>
                          </div>
                          <MiniBar pct={pct} color={level.color}/>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Item-by-item bar chart */}
                {itemStats.length > 0 && (
                  <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
                    <h3 className="font-bold text-white mb-4">Item Analysis — % Correct per Competency</h3>
                    <div className="space-y-2">
                      {itemStats.map(({ item, correct, pct, mastery }) => (
                        <div key={item.id} className="flex items-center gap-3">
                          <div className="w-8 text-center text-xs text-gray-500 font-mono">{item.no}</div>
                          <div className="w-56 text-xs text-gray-300 truncate" title={item.competency}>{item.competency}</div>
                          <div className="flex-1">
                            <MiniBar pct={pct} color={mastery.color}/>
                          </div>
                          <div className="w-20 text-xs text-right">
                            <span className={mastery.text}>{mastery.label.split(' ')[0]}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Least / Most mastered */}
                {itemStats.length >= 2 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-red-950/30 border border-red-800/50 rounded-2xl p-6">
                      <h3 className="font-bold text-red-400 mb-3">🔴 Least Mastered Competencies</h3>
                      <div className="space-y-2">
                        {leastMastered.map((s, i) => (
                          <div key={s.item.id} className="flex items-center gap-2">
                            <span className="text-red-500 font-bold text-sm w-5">{i+1}.</span>
                            <span className="text-sm text-gray-300 flex-1">{s.item.competency}</span>
                            <span className="text-red-400 font-bold text-sm">{s.pct.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-2xl p-6">
                      <h3 className="font-bold text-emerald-400 mb-3">🟢 Most Mastered Competencies</h3>
                      <div className="space-y-2">
                        {mostMastered.map((s, i) => (
                          <div key={s.item.id} className="flex items-center gap-2">
                            <span className="text-emerald-500 font-bold text-sm w-5">{i+1}.</span>
                            <span className="text-sm text-gray-300 flex-1">{s.item.competency}</span>
                            <span className="text-emerald-400 font-bold text-sm">{s.pct.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Print-only view */}
        <div className="hidden print:block">
          <PrintView/>
        </div>
      </div>
    </>
  );
}