'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Printer, RefreshCw, Trash2, Award, AlertTriangle, CheckCircle, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useActiveSection } from '../../lib/useActiveSection';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────








const BEHAVIOR_TYPES = ['Positive', 'Negative', 'Incident', 'Note'] as const;
type BehaviorType = typeof BEHAVIOR_TYPES[number];

const CATEGORIES = [
  'Academic', 'Attendance', 'Social', 'Emotional',
  'Conduct', 'Extracurricular', 'Other',
];

// DepEd Core Values for conduct rating (SF9)
const CORE_VALUES = [
  {
    value: 'Maka-Diyos',
    behaviors: [
      'Expresses one\'s spiritual beliefs while respecting the spiritual beliefs of others.',
      'Shows adherence to ethical principles by upholding truth in all undertakings.',
    ],
  },
  {
    value: 'Makatao',
    behaviors: [
      'Is sensitive to individual, social, and cultural differences.',
      'Demonstrates contributions towards solidarity.',
    ],
  },
  {
    value: 'Makakalikasan',
    behaviors: [
      'Cares for the environment and utilizes resources wisely, judiciously, and economically.',
    ],
  },
  {
    value: 'Makabansa',
    behaviors: [
      'Demonstrates pride in being a Filipino; exercises the rights and responsibilities of a Filipino citizen.',
      'Demonstrates appropriate behavior in carrying out activities in school, community, and country.',
    ],
  },
];

const CONDUCT_RATINGS = ['AO', 'SO', 'RO', 'NO'] as const;
type ConductRating = typeof CONDUCT_RATINGS[number];
const CONDUCT_LABELS: Record<ConductRating, string> = {
  AO: 'Always Observed',
  SO: 'Sometimes Observed',
  RO: 'Rarely Observed',
  NO: 'Not Observed',
};
const CONDUCT_COLORS: Record<ConductRating, string> = {
  AO: 'bg-emerald-600 text-white',
  SO: 'bg-blue-600 text-white',
  RO: 'bg-yellow-500 text-black',
  NO: 'bg-red-600 text-white',
};

const TYPE_COLORS: Record<BehaviorType, string> = {
  Positive:  'bg-emerald-900/40 border-emerald-700 text-emerald-400',
  Negative:  'bg-red-900/40 border-red-700 text-red-400',
  Incident:  'bg-orange-900/40 border-orange-700 text-orange-400',
  Note:      'bg-blue-900/40 border-blue-700 text-blue-400',
};
const TYPE_BADGE: Record<BehaviorType, string> = {
  Positive:  'bg-emerald-600 text-white',
  Negative:  'bg-red-600 text-white',
  Incident:  'bg-orange-500 text-white',
  Note:      'bg-blue-600 text-white',
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Student { id: string; lrn: string; full_name: string; sex: string; }
interface BehaviorRecord {
  id: string;
  student_id: string;
  date: string;
  term: number;
  type: BehaviorType;
  category: string;
  description: string;
  action_taken: string;
  created_at: string;
}
interface ConductRecord {
  student_id: string;
  term: number;
  ratings: Record<string, ConductRating>; // key = behaviorStatement
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD RECORD MODAL
// ─────────────────────────────────────────────────────────────────────────────

function AddRecordModal({
  students, term, onClose, onAdd,
}: {
  students: Student[];
  term: number;
  onClose: () => void;
  onAdd: (r: BehaviorRecord) => void;
}) {
  const [studentId,   setStudentId]   = useState(students[0]?.id ?? '');
  const [date,        setDate]        = useState(new Date().toISOString().split('T')[0]);
  const [type,        setType]        = useState<BehaviorType>('Positive');
  const [category,    setCategory]    = useState('Academic');
  const [description, setDescription] = useState('');
  const [action,      setAction]      = useState('');
  const [saving,      setSaving]      = useState(false);

  const save = async () => {
    if (!description.trim()) return;
    setSaving(true);
    const rec: Omit<BehaviorRecord,'created_at'> = {
      id: crypto.randomUUID(),
      student_id: studentId,
      date, term, type, category,
      description: description.trim(),
      action_taken: action.trim(),
    };
    const { error } = await supabase.from('behavior_records').insert({
      ...rec, recorded_by: (await supabase.auth.getUser()).data.user?.id,
    });
    if (!error) {
      onAdd({ ...rec, created_at: new Date().toISOString() });
      onClose();
    } else {
      alert('Error saving: ' + error.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-xl border border-gray-700 shadow-2xl">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Award size={20} className="text-blue-400"/> Log Behavior Record
        </h3>
        <div className="space-y-4">
          {/* Student */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Learner</label>
            <select value={studentId} onChange={e => setStudentId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
              {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </div>

          {/* Date + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"/>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type</label>
              <select value={type} onChange={e => setType(e.target.value as BehaviorType)}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                {BEHAVIOR_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${category===c?'bg-blue-600 text-white':'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description / Observation</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Describe the behavior or incident in detail…"/>
          </div>

          {/* Action */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Action Taken</label>
            <textarea value={action} onChange={e => setAction(e.target.value)} rows={2}
              className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              placeholder="What was done in response? (counseling, parent call, commendation…)"/>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-600 hover:bg-gray-800 transition text-sm">Cancel</button>
          <button onClick={save} disabled={saving || !description.trim()}
            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold transition text-sm disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Record'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function BehaviorPage() {
  const { sectionId, sectionName, gradeLevel, schoolName, schoolId, schoolYear, division, region, adviser } = useActiveSection();

  const [term,        setTerm]        = useState(1);
  const [students,    setStudents]    = useState<Student[]>([]);
  const [records,     setRecords]     = useState<BehaviorRecord[]>([]);
  const [conduct,     setConduct]     = useState<Record<string, ConductRecord>>({});
  const [loading,     setLoading]     = useState(true);
  const [showAdd,     setShowAdd]     = useState(false);
  const [activeTab,   setActiveTab]   = useState<'log'|'conduct'|'summary'>('log');
  const [filterType,  setFilterType]  = useState<BehaviorType|'All'>('All');
  const [filterSt,    setFilterSt]    = useState('');
  const [search,      setSearch]      = useState('');
  const [selectedSt,  setSelectedSt]  = useState<string|null>(null);

  // ── Load students ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sectionId) return;
    (async () => {
      const { data } = await supabase
        .from('students').select('*').eq('section_id', sectionId).order('full_name');
      const sorted = (data ?? []).sort((a: Student, b: Student) => {
        const sa = a.sex === 'M' ? 0 : 1, sb = b.sex === 'M' ? 0 : 1;
        if (sa !== sb) return sa - sb;
        return a.full_name.localeCompare(b.full_name);
      });
      setStudents(sorted);
    })();
  }, [sectionId]);

  // ── Load records + conduct ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: recs } = await supabase
        .from('behavior_records')
        .select('*')
        .eq('term', term)
        .order('date', { ascending: false });
      setRecords(recs ?? []);

      const { data: cond } = await supabase
        .from('conduct_records')
        .select('*')
        .eq('term', term);
      const map: Record<string, ConductRecord> = {};
      cond?.forEach((r: any) => { map[r.student_id] = r; });
      setConduct(map);

      setLoading(false);
    })();
  }, [term]);

  // ── Update conduct rating ──────────────────────────────────────────────────
  const updateConduct = async (studentId: string, behavior: string, rating: ConductRating) => {
    const existing = conduct[studentId];
    const updated: ConductRecord = {
      student_id: studentId,
      term,
      ratings: { ...(existing?.ratings ?? {}), [behavior]: rating },
    };
    setConduct(prev => ({ ...prev, [studentId]: updated }));

    await supabase.from('conduct_records').upsert(
      { student_id: studentId, term, ratings: updated.ratings },
      { onConflict: 'student_id,term' }
    );
  };

  // ── Delete record ──────────────────────────────────────────────────────────
  const deleteRecord = async (id: string) => {
    if (!confirm('Delete this record?')) return;
    await supabase.from('behavior_records').delete().eq('id', id);
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  // ── Filtered records ───────────────────────────────────────────────────────
  const filtered = records.filter(r => {
    const typeMatch = filterType === 'All' || r.type === filterType;
    const stMatch   = !filterSt || r.student_id === filterSt;
    const searchMatch = !search || r.description.toLowerCase().includes(search.toLowerCase());
    return typeMatch && stMatch && searchMatch;
  });

  const getStudentName = (id: string) => students.find(s => s.id === id)?.full_name ?? 'Unknown';

  // Stats per student
  const getStats = (sid: string) => ({
    positive: records.filter(r => r.student_id === sid && r.type === 'Positive').length,
    negative: records.filter(r => r.student_id === sid && r.type === 'Negative').length,
    incident: records.filter(r => r.student_id === sid && r.type === 'Incident').length,
    total:    records.filter(r => r.student_id === sid).length,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PRINT VIEW — individual student behavior report
  // ─────────────────────────────────────────────────────────────────────────
  const PrintReport = ({ sid }: { sid: string }) => {
    const student  = students.find(s => s.id === sid);
    const stRecs   = records.filter(r => r.student_id === sid).sort((a,b) => a.date.localeCompare(b.date));
    const stConduct = conduct[sid];
    if (!student) return null;

    return (
      <div className="bg-white text-black p-6 text-xs" style={{minWidth:'700px'}}>
        <div className="text-center mb-4">
          <div className="font-bold text-sm">BEHAVIOR RECORD</div>
          <div>{schoolName} · SY {schoolYear} · Term {term}</div>
          <div>{gradeLevel} - {sectionName}</div>
        </div>

        <div className="border border-black p-2 mb-3">
          <div><strong>Learner:</strong> {student.full_name}</div>
          <div><strong>LRN:</strong> {student.lrn} &nbsp;&nbsp; <strong>Sex:</strong> {student.sex === 'M' ? 'Male' : 'Female'}</div>
        </div>

        {/* Conduct Ratings */}
        <div className="font-bold mb-1">REPORT ON LEARNER'S OBSERVED VALUES (Conduct)</div>
        <table className="w-full border-collapse mb-3" style={{fontSize:'9px'}}>
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black px-1 py-0.5">Core Value</th>
              <th className="border border-black px-1 py-0.5 text-left">Behavior Statement</th>
              <th className="border border-black px-1 py-0.5 text-center">Rating</th>
              <th className="border border-black px-1 py-0.5 text-center">Meaning</th>
            </tr>
          </thead>
          <tbody>
            {CORE_VALUES.map(cv => cv.behaviors.map((b, bi) => (
              <tr key={b}>
                {bi === 0 && <td className="border border-black px-1 py-0.5 font-bold align-top" rowSpan={cv.behaviors.length}>{cv.value}</td>}
                <td className="border border-black px-1 py-0.5">{b}</td>
                <td className="border border-black px-1 py-0.5 text-center font-bold">
                  {stConduct?.ratings?.[b] ?? '—'}
                </td>
                <td className="border border-black px-1 py-0.5 text-center">
                  {stConduct?.ratings?.[b] ? CONDUCT_LABELS[stConduct.ratings[b]] : ''}
                </td>
              </tr>
            )))}
          </tbody>
        </table>

        {/* Behavior log */}
        <div className="font-bold mb-1">BEHAVIOR LOG</div>
        {stRecs.length === 0
          ? <div className="border border-black p-2 text-gray-500 italic">No behavior records for this term.</div>
          : (
            <table className="w-full border-collapse" style={{fontSize:'9px'}}>
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black px-1 py-0.5">Date</th>
                  <th className="border border-black px-1 py-0.5">Type</th>
                  <th className="border border-black px-1 py-0.5">Category</th>
                  <th className="border border-black px-1 py-0.5 text-left">Description</th>
                  <th className="border border-black px-1 py-0.5 text-left">Action Taken</th>
                </tr>
              </thead>
              <tbody>
                {stRecs.map(r => (
                  <tr key={r.id}>
                    <td className="border border-black px-1 py-0.5 whitespace-nowrap">{r.date}</td>
                    <td className="border border-black px-1 py-0.5 font-bold">{r.type}</td>
                    <td className="border border-black px-1 py-0.5">{r.category}</td>
                    <td className="border border-black px-1 py-0.5">{r.description}</td>
                    <td className="border border-black px-1 py-0.5">{r.action_taken || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }

        <div className="flex justify-between mt-6">
          <div className="text-center">
            <div className="border-t border-black mt-8 pt-1" style={{minWidth:'180px'}}>{adviser}<br/>Adviser</div>
          </div>
          <div className="text-center">
            <div className="border-t border-black mt-8 pt-1" style={{minWidth:'180px'}}>Parent/Guardian Signature</div>
          </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
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
              <h1 className="text-2xl font-bold">Behavior Record</h1>
              <p className="text-gray-400 text-sm">{sectionName} · {gradeLevel} · Term {term}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Term selector */}
            <div className="flex rounded-xl overflow-hidden border border-gray-700">
              {[1,2,3].map(t => (
                <button key={t} onClick={() => setTerm(t)}
                  className={`px-5 py-2 text-sm font-medium transition ${term===t?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                  Term {t}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Plus size={16}/>Log Behavior
            </button>
            {selectedSt && (
              <button onClick={() => window.print()}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
                <Printer size={16}/>Print Report
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="no-print flex border-b border-gray-800 bg-gray-900/50">
          {[
            { key:'log',     label:'📋 Behavior Log'     },
            { key:'conduct', label:'⭐ Conduct Ratings'   },
            { key:'summary', label:'📊 Summary'           },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition ${activeTab===tab.key?'border-blue-500 text-blue-400':'border-transparent text-gray-400 hover:text-white'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <RefreshCw size={20} className="animate-spin"/>Loading…
          </div>
        ) : (
          <div className="p-6">

            {/* ── BEHAVIOR LOG TAB ── */}
            {activeTab === 'log' && (
              <div>
                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-6">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-3 text-gray-500"/>
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Search description…"
                      className="pl-8 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"/>
                  </div>
                  <select value={filterSt} onChange={e => setFilterSt(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">All Learners</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                  </select>
                  <div className="flex rounded-xl overflow-hidden border border-gray-700">
                    {(['All', ...BEHAVIOR_TYPES] as const).map(t => (
                      <button key={t} onClick={() => setFilterType(t as any)}
                        className={`px-3 py-2 text-xs font-medium transition ${filterType===t?'bg-blue-600 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="ml-auto text-sm text-gray-400">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</div>
                </div>

                {filtered.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <Award size={48} className="mx-auto mb-4 opacity-30"/>
                    <p>No behavior records yet for Term {term}.</p>
                    <p className="text-sm mt-1">Click "Log Behavior" to add the first entry.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filtered.map(rec => (
                      <div key={rec.id} className={`border rounded-2xl p-4 ${TYPE_COLORS[rec.type]}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${TYPE_BADGE[rec.type]}`}>{rec.type}</span>
                            <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded-lg text-xs">{rec.category}</span>
                            <span className="text-gray-400 text-xs">{rec.date}</span>
                            <span className="font-semibold text-white text-sm">{getStudentName(rec.student_id)}</span>
                          </div>
                          <button onClick={() => deleteRecord(rec.id)} className="text-gray-600 hover:text-red-400 transition flex-shrink-0">
                            <Trash2 size={15}/>
                          </button>
                        </div>
                        <p className="text-sm mt-2 text-gray-200">{rec.description}</p>
                        {rec.action_taken && (
                          <p className="text-xs mt-1 text-gray-400">
                            <span className="font-semibold">Action: </span>{rec.action_taken}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── CONDUCT RATINGS TAB ── */}
            {activeTab === 'conduct' && (
              <div>
                <p className="text-gray-400 text-sm mb-4">
                  Rate each learner on DepEd Core Values behavior statements. These feed directly into the SF9 Report Card.
                  &nbsp;<strong className="text-white">AO</strong> = Always Observed &nbsp;
                  <strong className="text-white">SO</strong> = Sometimes Observed &nbsp;
                  <strong className="text-white">RO</strong> = Rarely Observed &nbsp;
                  <strong className="text-white">NO</strong> = Not Observed
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-separate border-spacing-0" style={{minWidth:'1200px'}}>
                    <thead>
                      {/* Row 1: Core Value group names */}
                      <tr>
                        <th className="bg-gray-800 text-left px-3 py-3 rounded-tl-xl sticky left-0 z-10 min-w-[200px]" rowSpan={2}>Learner</th>
                        {CORE_VALUES.map(cv => (
                          <th key={cv.value}
                            colSpan={cv.behaviors.length}
                            className="bg-blue-900/60 text-center px-2 py-2 border-l-2 border-gray-600 text-blue-300 font-bold text-sm">
                            {cv.value}
                          </th>
                        ))}
                      </tr>
                      {/* Row 2: Full behavior statements */}
                      <tr>
                        {CORE_VALUES.map(cv => cv.behaviors.map((b, bi) => (
                          <th key={b}
                            className={`bg-gray-800/80 text-center px-2 py-2 min-w-[180px] font-normal text-gray-200
                              ${bi === 0 ? 'border-l-2 border-gray-600' : 'border-l border-gray-700'}`}
                            style={{fontSize:'11px', lineHeight:'1.5', verticalAlign:'top', whiteSpace:'normal', wordBreak:'break-word'}}>
                            {b}
                          </th>
                        )))}
                      </tr>
                    </thead>
                    <tbody>
                      {(['M', 'F'] as const).map(sex => {
                        const group = students.filter(s => s.sex === sex);
                        if (group.length === 0) return null;
                        return (
                          <>
                            <tr key={`header-${sex}`}>
                              <td
                                colSpan={1 + CORE_VALUES.reduce((s, cv) => s + cv.behaviors.length, 0)}
                                className={`px-4 py-1.5 text-xs font-bold tracking-widest uppercase border-t border-gray-700
                                  ${sex === 'M' ? 'bg-blue-950/40 text-blue-300' : 'bg-pink-950/40 text-pink-300'}`}>
                                {sex === 'M' ? 'Male' : 'Female'} ({group.length})
                              </td>
                            </tr>
                            {group.map(student => (
                              <tr key={student.id} className="border-t border-gray-800 hover:bg-gray-900/30">
                                <td className="px-3 py-2 sticky left-0 bg-gray-950 border-r border-gray-800 z-10">
                                  <div className="font-medium text-white text-xs">{student.full_name}</div>
                                </td>
                                {CORE_VALUES.map(cv => cv.behaviors.map(b => {
                                  const current = conduct[student.id]?.ratings?.[b];
                                  return (
                                    <td key={b} className="p-1 text-center border-l border-gray-800">
                                      <select
                                        value={current ?? ''}
                                        onChange={e => updateConduct(student.id, b, e.target.value as ConductRating)}
                                        className={`rounded-lg px-1 py-1 text-xs font-bold border-0 focus:outline-none cursor-pointer
                                          ${current ? CONDUCT_COLORS[current] : 'bg-gray-800 text-gray-500'}`}>
                                        <option value="">—</option>
                                        {CONDUCT_RATINGS.map(r => (
                                          <option key={r} value={r} className="bg-gray-900 text-white">{r}</option>
                                        ))}
                                      </select>
                                    </td>
                                  );
                                }))}
                              </tr>
                            ))}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── SUMMARY TAB ── */}
            {activeTab === 'summary' && (
              <div>
                <p className="text-gray-400 text-sm mb-4">Click a learner to select them, then click Print Report for their individual behavior document.</p>
                <div className="space-y-6">
                  {(['M', 'F'] as const).map(sex => {
                    const group = students.filter(s => s.sex === sex);
                    if (group.length === 0) return null;
                    return (
                      <div key={sex}>
                        <div className={`text-xs font-bold tracking-widest uppercase px-1 mb-3
                          ${sex === 'M' ? 'text-blue-400' : 'text-pink-400'}`}>
                          {sex === 'M' ? '👦 Male' : '👧 Female'} ({group.length})
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {group.map(student => {
                            const stats = getStats(student.id);
                            const isSelected = selectedSt === student.id;
                            return (
                              <button key={student.id} onClick={() => setSelectedSt(isSelected ? null : student.id)}
                                className={`text-left rounded-2xl p-5 border transition-all
                                  ${isSelected
                                    ? 'bg-blue-900/30 border-blue-500 shadow-lg shadow-blue-900/20'
                                    : 'bg-gray-900 border-gray-700 hover:border-gray-600'}`}>
                                <div className="font-semibold text-white text-sm mb-3">{student.full_name}</div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="bg-emerald-900/40 rounded-xl p-2 text-center">
                                    <div className="text-emerald-400 font-bold text-lg">{stats.positive}</div>
                                    <div className="text-xs text-gray-400">Positive</div>
                                  </div>
                                  <div className="bg-red-900/40 rounded-xl p-2 text-center">
                                    <div className="text-red-400 font-bold text-lg">{stats.negative}</div>
                                    <div className="text-xs text-gray-400">Negative</div>
                                  </div>
                                  <div className="bg-orange-900/40 rounded-xl p-2 text-center">
                                    <div className="text-orange-400 font-bold text-lg">{stats.incident}</div>
                                    <div className="text-xs text-gray-400">Incident</div>
                                  </div>
                                </div>
                                {stats.total === 0 && (
                                  <div className="text-xs text-gray-600 mt-2 text-center">No records this term</div>
                                )}
                                {isSelected && (
                                  <div className="mt-3 text-xs text-blue-400 font-semibold text-center">✓ Selected — click Print Report above</div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Print-only: individual report */}
      {selectedSt && (
        <div className="hidden print:block">
          <PrintReport sid={selectedSt}/>
        </div>
      )}

      {showAdd && (
        <AddRecordModal
          students={students} term={term}
          onClose={() => setShowAdd(false)}
          onAdd={r => setRecords(prev => [r, ...prev])}
        />
      )}
    </>
  );
}