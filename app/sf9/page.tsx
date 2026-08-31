'use client';

import { useState, useEffect } from 'react';

import {
  ArrowLeft, Printer, RefreshCw, ChevronLeft, ChevronRight,
  GraduationCap, Users, Edit3, Save, X, Plus, Mail,
  Settings, FileDown,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useActiveSection } from '../../lib/useActiveSection';

import { buildSubjectRows, type SF9SubjectRow, type SHSTrack } from '../../lib/sf9/sf9GradeBands';
import { useSF9Data, type Student, type Collaborator } from '../../lib/sf9/useSF9Data';
import { downloadSF9Docx, downloadAllSF9Docx } from '../../lib/sf9/generateSF9Docx';
import { downloadSF9Pdf } from '../../lib/sf9/generateSF9Pdf';
import SectionSF9Settings from './SectionSF9Settings';
import SF9Card from './SF9Card';

// ─────────────────────────────────────────────────────────────────────────────
// Flatten a section's subject rows into leaf-level {key,label} pairs — this is
// the actual encodable-grade unit (MAPEH's two components, not the computed
// "MAPEH" parent; same for SHS's Effective Communication/Mabisang Komunikasyon).
// Used by ManualGradePanel and CollabPanel for their subject tabs/checklists.
// ─────────────────────────────────────────────────────────────────────────────
function flattenLeafSubjects(rows: SF9SubjectRow[]): { key: string; label: string }[] {
  return rows.flatMap(r =>
    r.isComputed && r.subRows?.length
      ? r.subRows.map(sr => ({ key: sr.key, label: sr.label }))
      : [{ key: r.key, label: r.label }]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL GRADE ENTRY PANEL
// ─────────────────────────────────────────────────────────────────────────────

function ManualGradePanel({
  students, sectionId, subjects, onClose, onSaved,
}: { students:Student[]; sectionId:string; subjects:{key:string;label:string}[]; onClose:()=>void; onSaved:()=>void }) {
  const [manualGrades, setManualGrades] = useState<Record<string,Record<string,number[]>>>({});
  const [saving,       setSaving]       = useState(false);
  const [loaded,       setLoaded]       = useState(false);
  const [filterSubj,   setFilterSubj]   = useState(subjects[0]?.key ?? '');

  useEffect(() => {
    if (!subjects.find(s => s.key === filterSubj)) setFilterSubj(subjects[0]?.key ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects.map(s=>s.key).join(',')]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('manual_grades')
        .select('*')
        .eq('section_id', sectionId);

      const map: Record<string,Record<string,number[]>> = {};
      students.forEach(s => {
        map[s.id] = {};
        subjects.forEach(subj => { map[s.id][subj.key] = [0,0,0]; });
      });
      data?.forEach((r:any) => {
        if (!map[r.student_id]) return;
        if (!map[r.student_id][r.subject]) map[r.student_id][r.subject] = [0,0,0];
        map[r.student_id][r.subject][r.term - 1] = r.grade;
      });
      setManualGrades(map);
      setLoaded(true);
    })();
  }, [sectionId, students, subjects]);

  const setGrade = (sid:string, subj:string, termIdx:number, val:string) => {
    const v = Math.min(100, Math.max(0, parseInt(val) || 0));
    setManualGrades(prev => ({
      ...prev,
      [sid]: {
        ...prev[sid],
        [subj]: (prev[sid]?.[subj] ?? [0,0,0]).map((g,i) => i===termIdx ? v : g),
      },
    }));
  };

  // Enter moves down the selected term column, matching the class-record entry flow.
  const handleGradeEnter = (e: React.KeyboardEvent<HTMLInputElement>, sid: string, termIdx: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const column = Array.from(document.querySelectorAll<HTMLInputElement>(
      `input[data-manual-grade="${filterSubj}:${termIdx}"]`
    ));
    const current = column.findIndex(input => input.dataset.studentId === sid);
    const next = column[current + 1];
    if (next) {
      next.focus();
      next.select();
    }
  };

  const saveAll = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const rows: any[] = [];

    students.forEach(student => {
      subjects.forEach(subj => {
        const grades = manualGrades[student.id]?.[subj.key] ?? [0,0,0];
        grades.forEach((grade, i) => {
          if (grade >= 60) {
            rows.push({
              section_id: sectionId,
              student_id: student.id,
              subject:    subj.key,
              term:       i + 1,
              grade,
              encoded_by: user?.id,
            });
          }
        });
      });
    });

    // Reconcile the complete edit set: remove existing rows for these learners
    // and subjects first, so clearing a field really removes its stored grade.
    const studentIds = students.map(student => student.id);
    const subjectKeys = subjects.map(subject => subject.key);
    const { error: deleteError } = await supabase
      .from('manual_grades')
      .delete()
      .eq('section_id', sectionId)
      .in('student_id', studentIds)
      .in('subject', subjectKeys);
    if (deleteError) {
      setSaving(false);
      alert('Error clearing previous manual grades: ' + deleteError.message);
      return;
    }
    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += 50) {
        const { error: upsertError } = await supabase.from('manual_grades').upsert(
          rows.slice(i, i+50),
          { onConflict: 'section_id,student_id,subject,term' }
        );
        if (upsertError) {
          setSaving(false);
          alert('Error saving manual grades: ' + upsertError.message);
          return;
        }
      }
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-6xl border border-gray-700 shadow-2xl flex flex-col" style={{maxHeight:'90vh'}}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Edit3 size={20} className="text-blue-400"/> Manual Grade Entry
            </h3>
            <p className="text-gray-400 text-sm mt-0.5">
              Type grades directly. These fill in subjects where no Class Record data exists.
              <span className="text-blue-400 ml-1">Class Record grades always take priority.</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition"><X size={20}/></button>
        </div>

        <div className="flex gap-1 px-5 pt-4 flex-shrink-0 flex-wrap">
          {subjects.map(subj => (
            <button key={subj.key} onClick={() => setFilterSubj(subj.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                filterSubj===subj.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {subj.label}
            </button>
          ))}
        </div>

        <div className="overflow-auto flex-1 px-5 py-4">
          {!loaded ? (
            <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
              <RefreshCw size={18} className="animate-spin"/> Loading grades…
            </div>
          ) : (
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="bg-gray-800 text-left px-3 py-2.5 rounded-tl-xl sticky left-0 z-10 min-w-[200px]">
                    Learner's Name
                  </th>
                  <th className="bg-gray-800 text-center px-4 py-2.5 border-l border-gray-700 text-blue-300">Term 1</th>
                  <th className="bg-gray-800 text-center px-4 py-2.5 border-l border-gray-700 text-purple-300">Term 2</th>
                  <th className="bg-gray-800 text-center px-4 py-2.5 border-l border-gray-700 text-amber-300">Term 3</th>
                  <th className="bg-gray-800 text-center px-4 py-2.5 border-l border-gray-700 rounded-tr-xl text-gray-400">Final</th>
                </tr>
                <tr>
                  <td colSpan={5} className="px-3 py-1.5 text-xs text-gray-500 italic bg-gray-900 border-b border-gray-800">
                    Subject: <span className="text-white font-semibold">{subjects.find(s=>s.key===filterSubj)?.label ?? ''}</span>
                    <span className="ml-3 text-gray-600">• Enter grade 60–100. Leave 0 if not yet available.</span>
                  </td>
                </tr>
              </thead>
              <tbody>
                {students.map(student => {
                  const grades  = manualGrades[student.id]?.[filterSubj] ?? [0,0,0];
                  const recorded = grades.filter(g => g >= 60);
                  const final   = recorded.length > 0
                    ? Math.round(recorded.reduce((a,b)=>a+b,0)/recorded.length) : 0;
                  return (
                    <tr key={student.id} className="border-t border-gray-800 hover:bg-gray-900/40">
                      <td className="px-3 py-2 sticky left-0 bg-gray-950 border-r border-gray-800 z-10">
                        <div className="font-medium text-white text-sm">{student.full_name}</div>
                        <div className="text-xs text-gray-600">{student.lrn}</div>
                      </td>
                      {[0,1,2].map(ti => (
                        <td key={ti} className="px-2 py-1.5 border-l border-gray-800 text-center">
                          <input
                            type="number" min={0} max={100}
                            value={grades[ti] || ''}
                            data-manual-grade={`${filterSubj}:${ti}`}
                            data-student-id={student.id}
                            onChange={e => setGrade(student.id, filterSubj, ti, e.target.value)}
                            onKeyDown={e => handleGradeEnter(e, student.id, ti)}
                            placeholder="—"
                            className={`w-16 text-center rounded-xl py-2 text-white text-sm font-bold outline-none transition
                              bg-gray-800 border focus:border-blue-500
                              ${grades[ti] >= 75 ? 'border-gray-600' : grades[ti] >= 60 ? 'border-red-700' : 'border-gray-700'}`}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2 border-l border-gray-800 text-center">
                        <span className={`font-bold text-lg ${
                          final >= 75 ? 'text-white' : final >= 60 ? 'text-red-400' : 'text-gray-600'
                        }`}>
                          {final || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-5 border-t border-gray-800 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-gray-500">
            💡 Only grades ≥ 60 are saved. If a subject has Class Record data, that takes priority in SF9.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-600 hover:bg-gray-800 transition text-sm">
              Cancel
            </button>
            <button onClick={saveAll} disabled={saving || !loaded}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold transition text-sm disabled:opacity-60">
              {saving ? <RefreshCw size={16} className="animate-spin"/> : <Save size={16}/>}
              {saving ? 'Saving all grades…' : 'Save All Grades'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COLLABORATION PANEL — invite subject teachers
// ─────────────────────────────────────────────────────────────────────────────

function CollabPanel({
  sectionId, subjects, onClose,
}: { sectionId:string; subjects:{key:string;label:string}[]; onClose:()=>void }) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [inviteEmail,   setInviteEmail]   = useState('');
  const [inviteSubjects,setInviteSubjects]= useState<string[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('section_collaborators')
        .select('*')
        .eq('section_id', sectionId);
      setCollaborators(data ?? []);
      setLoading(false);
    })();
  }, [sectionId]);

  const invite = async () => {
    if (!inviteEmail.trim() || inviteSubjects.length === 0) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const email = inviteEmail.trim().toLowerCase();

    const { data, error } = await supabase.from('section_collaborators').upsert({
      section_id:  sectionId,
      email,
      subjects:    inviteSubjects,
      role:        'subject_teacher',
      status:      'pending',
      invited_by:  user?.id,
    }, { onConflict: 'section_id,email' }).select().single();

    if (!error && data) {
      setCollaborators(prev => [...prev.filter(c=>c.email!==data.email), data]);
      setInviteEmail('');
      setInviteSubjects([]);
    } else {
      alert('Error: ' + error?.message);
    }
    setSaving(false);
  };

  const remove = async (id:string) => {
    if (!confirm('Remove this teacher from this section?')) return;
    await supabase.from('section_collaborators').delete().eq('id', id);
    setCollaborators(prev => prev.filter(c => c.id !== id));
  };

  const toggleSubject = (subj:string) => {
    setInviteSubjects(prev =>
      prev.includes(subj) ? prev.filter(s=>s!==subj) : [...prev, subj]
    );
  };

  const subjectLabel = (key:string) => subjects.find(s=>s.key===key)?.label ?? key;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-xl border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Users size={20} className="text-purple-400"/> Subject Teacher Access
            </h3>
            <p className="text-gray-400 text-sm mt-0.5">
              Invite subject teachers to encode grades for their subjects in this section.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition"><X size={20}/></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-blue-950/40 border border-blue-800 rounded-2xl p-4 text-sm text-blue-300">
            <div className="font-semibold mb-2">📋 How it works:</div>
            <ol className="space-y-1 text-xs list-decimal list-inside text-blue-200">
              <li>Enter the subject teacher's email and select their subjects below</li>
              <li className="text-amber-400">The subject teacher must <strong>register or log in</strong> to TeacherHub PH using the same email — the section will appear automatically in their dashboard</li>
              <li>They register/login to TeacherHub PH using that same email</li>
              <li>The section appears in their sidebar — they encode grades for their subjects only</li>
              <li>SF9 automatically uses their Class Record data for those subjects</li>
            </ol>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Teacher's Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3 text-gray-500"/>
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="teacher@deped.gov.ph"
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-600 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"/>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Subjects They Teach in This Section</label>
              <div className="flex flex-wrap gap-2">
                {subjects.map(subj => (
                  <button key={subj.key} onClick={() => toggleSubject(subj.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                      inviteSubjects.includes(subj.key)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}>
                    {subj.label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={invite}
              disabled={saving || !inviteEmail.trim() || inviteSubjects.length === 0}
              className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold text-sm transition disabled:opacity-50">
              {saving ? <RefreshCw size={16} className="animate-spin"/> : <Plus size={16}/>}
              {saving ? 'Adding…' : 'Add Teacher'}
            </button>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-300 mb-3">
              Current Subject Teachers ({collaborators.length})
            </div>
            {loading ? (
              <div className="text-gray-500 text-sm text-center py-4">Loading…</div>
            ) : collaborators.length === 0 ? (
              <div className="text-gray-600 text-sm text-center py-4">
                No subject teachers added yet.
              </div>
            ) : (
              <div className="space-y-2">
                {collaborators.map(c => (
                  <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          c.status==='active' ? 'bg-emerald-400' : 'bg-yellow-400'
                        }`}/>
                        <span className="text-white text-sm font-medium">{c.email}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          c.status==='active'
                            ? 'bg-emerald-900/50 text-emerald-400'
                            : 'bg-yellow-900/50 text-yellow-400'
                        }`}>
                          {c.status === 'active' ? 'Active' : 'Pending — teacher must log in to TeacherHub PH to activate'}
                        </span>
                      </div>
                      <button onClick={() => remove(c.id)}
                        className="text-gray-600 hover:text-red-400 transition text-xs">
                        Remove
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(c.subjects ?? []).map(s => (
                        <span key={s} className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded-lg text-xs">
                          {subjectLabel(s)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-gray-800">
          <button onClick={onClose}
            className="w-full py-3 rounded-xl border border-gray-600 hover:bg-gray-800 transition text-sm font-medium">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SF9Page() {
  const sectionCtx = useActiveSection();
  // gradeLevel here is a display string like "Grade 9" — grade_number is the
  // actual integer field on Section, exposed by useActiveSection as gradeNumber.
  const { sectionId, sectionName, gradeLevel, gradeNumber, schoolYear, activeSection } = sectionCtx;

  // Prefer the editable Grade Level text because older section rows may have a
  // stale grade_number left over from before Manage Section persisted it.
  const numericGradeLevel = Number(gradeLevel.match(/\d+/)?.[0]) || Number(gradeNumber) || 0;
  const effectiveSection = activeSection
    ? { ...activeSection, grade_number: numericGradeLevel, grade_level: gradeLevel }
    : activeSection;
  const sectionExtra = effectiveSection as any; // Phase 1 columns not yet in the Section type — see note below
  const shsTrack: SHSTrack | null = (sectionExtra?.shs_track as SHSTrack) ?? null;
  const electiveSubjectNames: string[] = sectionExtra?.elective_subjects ?? [];

  const [selected,      setSelected]      = useState(0);
  const [printAll,      setPrintAll]      = useState(false);
  const [showManual,    setShowManual]    = useState(false);
  const [showCollab,    setShowCollab]    = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [bulkProgress,  setBulkProgress]  = useState<{done:number; total:number} | null>(null);
  const [dataVersion,   setDataVersion]   = useState(0);

  const {
    students, sf9Data, loading, gradeSource,
    frontPage, continuationPage, gaKeys, band,
  } = useSF9Data(sectionId, numericGradeLevel, shsTrack, electiveSubjectNames, schoolYear, dataVersion);

  const leafSubjects = flattenLeafSubjects([...frontPage, ...continuationPage]);
  const current = sf9Data[selected];

  const handleDownloadDocx = async () => {
    if (!current) return;
    setDownloadingId(current.student.id);
    try {
      const preview = document.querySelector<HTMLElement>('[data-sf9-card="true"]');
      if (!preview) throw new Error('SF9 preview is not available.');
      const safeName = current.student.full_name.replace(/[^a-z0-9]+/gi, '_');
      await downloadSF9Pdf(preview, `SF9_${safeName}.pdf`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadAllDocx = async () => {
    if (!sf9Data.length) return;
    setBulkProgress({ done: 0, total: sf9Data.length });
    try {
      await downloadAllSF9Docx({
        allData: sf9Data, section: effectiveSection, frontPage, continuationPage, gaKeys,
        onProgress: (done, total) => setBulkProgress({ done, total }),
      });
    } finally {
      setBulkProgress(null);
    }
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; }
          @page { size: A4 landscape; margin: 6mm; }
          .sf9-card { width: 278mm; height: 198mm; max-height: 198mm; overflow: visible; page-break-after: always; }
          .sf9-card:last-child { page-break-after: auto; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <div className="no-print bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={()=>window.history.back()}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-800 transition text-blue-400">
              <ArrowLeft size={22}/>
            </button>
            <div>
              <h1 className="text-2xl font-bold">SF9 Report Card</h1>
              <p className="text-gray-400 text-sm">
                {sectionName} · {gradeLevel} · {schoolYear} · Tri-Term
                {band ? ` · ${band.label}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            {Object.keys(gradeSource).length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-emerald-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"/> Class Record
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <div className="w-2 h-2 rounded-full bg-amber-500"/> Manual Entry
                </span>
              </div>
            )}

            <button onClick={()=>setShowSettings(true)}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Settings size={16}/> SF9 Settings
            </button>

            <button onClick={()=>setShowManual(true)}
              className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Edit3 size={16}/> Manual Grade Entry
            </button>

            <button onClick={()=>setShowCollab(true)}
              className="flex items-center gap-2 bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Users size={16}/> Subject Teachers
            </button>

            {sf9Data.length > 0 && (
              <div className="flex items-center gap-1 bg-gray-800 rounded-xl px-2 py-1">
                <button onClick={()=>setSelected(Math.max(0,selected-1))} disabled={selected===0}
                  className="text-gray-400 hover:text-white disabled:opacity-30 transition p-1">
                  <ChevronLeft size={18}/>
                </button>
                <select value={selected} onChange={e=>setSelected(Number(e.target.value))}
                  className="bg-transparent text-white text-sm font-semibold focus:outline-none max-w-[180px]">
                  {sf9Data.map((d,i)=>(
                    <option key={d.student.id} value={i} className="bg-gray-800">
                      {i+1}. {d.student.full_name}
                    </option>
                  ))}
                </select>
                <button onClick={()=>setSelected(Math.min(sf9Data.length-1,selected+1))} disabled={selected===sf9Data.length-1}
                  className="text-gray-400 hover:text-white disabled:opacity-30 transition p-1">
                  <ChevronRight size={18}/>
                </button>
                <span className="text-gray-500 text-xs ml-1">{selected+1}/{sf9Data.length}</span>
              </div>
            )}

            <button onClick={handleDownloadDocx} disabled={!current || downloadingId===current?.student.id}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50">
              {downloadingId===current?.student.id ? <RefreshCw size={16} className="animate-spin"/> : <FileDown size={16}/>}
              {downloadingId===current?.student.id ? 'Generating…' : 'Download PDF'}
            </button>

            <button onClick={handleDownloadAllDocx} disabled={!sf9Data.length || !!bulkProgress}
              title="Downloads one .docx per learner, bundled as a .zip"
              className="flex items-center gap-2 bg-emerald-800 hover:bg-emerald-700 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50">
              {bulkProgress ? <RefreshCw size={16} className="animate-spin"/> : <FileDown size={16}/>}
              {bulkProgress ? `Generating ${bulkProgress.done}/${bulkProgress.total}…` : `Download All (${sf9Data.length})`}
            </button>

            <button onClick={()=>{setPrintAll(false);setTimeout(()=>window.print(),100);}}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Printer size={16}/>Print This
            </button>
            <button onClick={()=>{setPrintAll(true);setTimeout(()=>window.print(),100);}}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Users size={16}/>Print All ({sf9Data.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
            <RefreshCw size={20} className="animate-spin"/>Loading report card data…
          </div>
        ) : sf9Data.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <GraduationCap size={48} className="mx-auto mb-4 opacity-30"/>
            <p className="text-lg">No learners found in this section.</p>
            <p className="text-sm mt-1">Import students via SF1 in the Sections page first.</p>
          </div>
        ) : (
          <>
            <div className="no-print p-6">
              {/* Stats */}
              <div className="flex gap-4 mb-6 flex-wrap">
                <div className="bg-gray-900 border border-gray-700 rounded-2xl px-5 py-3">
                  <div className="text-2xl font-bold">{sf9Data.length}</div>
                  <div className="text-gray-400 text-xs">Total Learners</div>
                </div>
                <div className="bg-gray-900 border border-emerald-800 rounded-2xl px-5 py-3">
                  <div className="text-2xl font-bold text-emerald-400">
                    {sf9Data.filter(d=>d.promotionRemark==='Promoted').length}
                  </div>
                  <div className="text-gray-400 text-xs">Promoted</div>
                </div>
                <div className="bg-gray-900 border border-amber-800 rounded-2xl px-5 py-3">
                  <div className="text-2xl font-bold text-amber-400">
                    {sf9Data.filter(d=>d.promotionRemark==='Conditionally Promoted').length}
                  </div>
                  <div className="text-gray-400 text-xs">Conditionally Promoted</div>
                </div>
                <div className="bg-gray-900 border border-red-800 rounded-2xl px-5 py-3">
                  <div className="text-2xl font-bold text-red-400">
                    {sf9Data.filter(d=>d.promotionRemark==='Failed').length}
                  </div>
                  <div className="text-gray-400 text-xs">Failed</div>
                </div>
                <div className="bg-gray-900 border border-yellow-800 rounded-2xl px-5 py-3">
                  <div className="text-2xl font-bold text-yellow-300">
                    {sf9Data.filter(d=>d.genAverage>0).length>0
                      ? (sf9Data.filter(d=>d.genAverage>0).reduce((s,d)=>s+d.genAverage,0)/sf9Data.filter(d=>d.genAverage>0).length).toFixed(1)
                      : '—'}
                  </div>
                  <div className="text-gray-400 text-xs">Class Average</div>
                </div>

                {Object.keys(gradeSource).length > 0 && (
                  <div className="bg-gray-900 border border-gray-700 rounded-2xl px-5 py-3 ml-auto">
                    <div className="text-xs text-gray-500 font-semibold mb-1">Grade Sources</div>
                    <div className="space-y-1">
                      {Object.entries(gradeSource).map(([subj, src]) => (
                        <div key={subj} className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${src==='Class Record'?'bg-emerald-500':'bg-amber-500'}`}/>
                          <span className="text-gray-400 truncate max-w-[120px]">
                            {leafSubjects.find(s=>s.key===subj)?.label ?? subj}
                          </span>
                          <span className={src==='Class Record'?'text-emerald-400':'text-amber-400'}>{src}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Preview */}
              {current && (
                <div className="bg-white rounded-2xl shadow-2xl overflow-auto">
                  <SF9Card data={current} section={effectiveSection} frontPage={frontPage} continuationPage={continuationPage}/>
                </div>
              )}
            </div>

            {/* Print area */}
            <div className="hidden print:block">
              {printAll
                ? sf9Data.map(d=>
                    <SF9Card key={d.student.id} data={d} section={effectiveSection} frontPage={frontPage} continuationPage={continuationPage}/>
                  )
                : current && <SF9Card data={current} section={effectiveSection} frontPage={frontPage} continuationPage={continuationPage}/>
              }
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showManual && (
        <ManualGradePanel
          students={students}
          sectionId={sectionId}
          subjects={leafSubjects}
          onClose={() => setShowManual(false)}
          onSaved={() => setDataVersion(v => v+1)}
        />
      )}
      {showCollab && (
        <CollabPanel
          sectionId={sectionId}
          subjects={leafSubjects}
          onClose={() => setShowCollab(false)}
        />
      )}
      {showSettings && (
        <SectionSF9Settings
sectionId={sectionId}
          gradeLevel={numericGradeLevel}
          onClose={() => setShowSettings(false)}
          onSaved={() => { setDataVersion(v => v+1); sectionCtx.refreshSections?.(); }}
        />
      )}
    </>
  );
}