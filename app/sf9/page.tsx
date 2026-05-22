'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Printer, RefreshCw, ChevronLeft, ChevronRight,
  GraduationCap, Users, Edit3, Save, X, Plus, Mail,
  CheckCircle, AlertCircle, Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useActiveSection } from '../../lib/useActiveSection';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const JHS_SUBJECTS = [
  'Filipino', 'English', 'Mathematics', 'Science',
  'Araling Panlipunan (AP)', 'Edukasyon sa Pagpapakatao (EsP)',
  'Edukasyong Pantahanan at Pangkabuhayan (EPP)',
];
const MAPEH_COMPONENTS = ['MAPEH - Music', 'MAPEH - Arts', 'MAPEH - Physical Education', 'MAPEH - Health'];
const ALL_SUBJECTS     = [...JHS_SUBJECTS, ...MAPEH_COMPONENTS];

const CORE_VALUES = [
  { value: '1. Maka-Diyos', behaviors: [
    "Expresses one's spiritual beliefs while respecting the spiritual beliefs of others.",
    'Shows adherence to ethical principles by upholding truth in all undertakings.',
  ]},
  { value: '2. Makatao', behaviors: [
    'Is sensitive to individual, social, and cultural differences.',
    'Demonstrates contributions towards solidarity.',
  ]},
  { value: '3. Makakalikasan', behaviors: [
    'Cares for the environment and utilizes resources wisely, judiciously, and economically.',
  ]},
  { value: '4. Makabansa', behaviors: [
    'Demonstrates pride in being a Filipino; exercises the rights and responsibilities of a Filipino citizen.',
    'Demonstrates appropriate behavior in carrying out activities in school, community, and country.',
  ]},
];

const CONDUCT_LABELS: Record<string,string> = {
  AO:'Always Observed', SO:'Sometimes Observed', RO:'Rarely Observed', NO:'Not Observed',
};

const TRANSMUTATION = [
  {min:99.50,max:100,trans:100},{min:97.50,max:99.49,trans:99},{min:96.00,max:97.49,trans:98},
  {min:95.00,max:95.99,trans:97},{min:94.00,max:94.99,trans:96},{min:93.00,max:93.99,trans:95},
  {min:92.00,max:92.99,trans:94},{min:91.00,max:91.99,trans:93},{min:90.00,max:90.99,trans:92},
  {min:89.00,max:89.99,trans:91},{min:88.00,max:88.99,trans:90},{min:87.00,max:87.99,trans:89},
  {min:86.00,max:86.99,trans:88},{min:85.00,max:85.99,trans:87},{min:84.00,max:84.99,trans:86},
  {min:83.00,max:83.99,trans:85},{min:82.00,max:82.99,trans:84},{min:81.00,max:81.99,trans:83},
  {min:80.00,max:80.99,trans:82},{min:79.00,max:79.99,trans:81},{min:78.00,max:78.99,trans:80},
  {min:77.00,max:77.99,trans:79},{min:76.00,max:76.99,trans:78},{min:75.00,max:75.99,trans:77},
  {min:73.00,max:74.99,trans:76},{min:70.00,max:72.99,trans:75},{min:68.00,max:69.99,trans:74},
  {min:66.00,max:67.99,trans:73},{min:64.00,max:65.99,trans:72},{min:62.00,max:63.99,trans:71},
  {min:60.00,max:61.99,trans:70},{min:58.00,max:59.99,trans:69},{min:56.00,max:57.99,trans:68},
  {min:54.00,max:55.99,trans:67},{min:52.00,max:53.99,trans:66},{min:50.00,max:51.99,trans:65},
  {min:48.00,max:49.99,trans:64},{min:46.00,max:47.99,trans:63},{min:43.00,max:45.99,trans:62},
  {min:40.00,max:42.99,trans:61},{min:0,max:39.99,trans:60},
];

const WEIGHTS: Record<string,{ww:number;pt:number;ta:number}> = {
  'Filipino':{ww:0.25,pt:0.50,ta:0.25},'English':{ww:0.25,pt:0.50,ta:0.25},
  'Mathematics':{ww:0.25,pt:0.50,ta:0.25},'Science':{ww:0.25,pt:0.50,ta:0.25},
  'Araling Panlipunan (AP)':{ww:0.25,pt:0.50,ta:0.25},
  'Edukasyon sa Pagpapakatao (EsP)':{ww:0.25,pt:0.50,ta:0.25},
  'Edukasyong Pantahanan at Pangkabuhayan (EPP)':{ww:0.20,pt:0.60,ta:0.20},
  'MAPEH - Music':{ww:0.20,pt:0.60,ta:0.20},'MAPEH - Arts':{ww:0.20,pt:0.60,ta:0.20},
  'MAPEH - Physical Education':{ww:0.20,pt:0.60,ta:0.20},'MAPEH - Health':{ww:0.20,pt:0.60,ta:0.20},
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const transmute = (v:number) => TRANSMUTATION.find(t=>v>=t.min&&v<=t.max)?.trans??60;
const descriptor = (g:number) => {
  if(g>=90) return 'Outstanding';
  if(g>=85) return 'Very Satisfactory';
  if(g>=80) return 'Satisfactory';
  if(g>=75) return 'Fairly Satisfactory';
  return 'Did Not Meet Expectations';
};
const calcAvg = (s:number[],h:number[]) => {
  // Only count slots where highest > 0 AND score > 0 (actual data entered)
  let t=0,c=0;
  s.forEach((v,i)=>{ if(h[i]>0 && v>0){t+=(v/h[i])*100;c++;} });
  return c>0?t/c:0;
};
function computeFromClassRecord(row:any, subject:string): number {
  if (!row) return 0;
  const w  = WEIGHTS[subject]??{ww:0.25,pt:0.50,ta:0.25};
  const ww = Array.from({length:5},(_,i)=>row.written_scores?.[i]??0);
  const pt = Array.from({length:3},(_,i)=>row.pt_scores?.[i]??0);
  const st = Array.from({length:2},(_,i)=>row.st_scores?.[i]??0);
  const te = row.te_score??0;

  // If ALL scores are zero → no data encoded yet → return 0, not transmuted minimum
  const hasWW = ww.some(v => v > 0);
  const hasPT = pt.some(v => v > 0);
  const hasST = st.some(v => v > 0) || te > 0;
  if (!hasWW && !hasPT && !hasST) return 0;

  // Compute averages per component
  const avgWW = calcAvg(ww, row.highest_ww??[100,100,100,100,100]);
  const avgPT = calcAvg(pt, row.highest_pt??[100,100,100]);
  const avgTA = calcAvg([...st,te],[...(row.highest_st??[50,50]),row.highest_te??100]);

  // Redistribute weights among components that actually have data
  // Prevents WW-only entry being penalized by empty PT/TA slots
  const activeComponents: {avg:number; weight:number}[] = [];
  if (hasWW) activeComponents.push({avg:avgWW, weight:w.ww});
  if (hasPT) activeComponents.push({avg:avgPT, weight:w.pt});
  if (hasST) activeComponents.push({avg:avgTA, weight:w.ta});
  const totalWeight = activeComponents.reduce((s,comp)=>s+comp.weight, 0);
  const initial = totalWeight > 0
    ? activeComponents.reduce((s,comp)=>s+(comp.avg*(comp.weight/totalWeight)), 0)
    : 0;
  return initial > 0 ? transmute(initial) : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Student { id:string; lrn:string; full_name:string; sex:string; birthdate?:string; middle_name?:string; }
interface Collaborator { id:string; email:string; subjects:string[]; status:string; role:string; }

// Grade source: 'class_record' | 'manual' | 'none'
interface GradeCell { value: number; source: 'class_record'|'manual'|'none'; }

interface LearnerSF9 {
  student:     Student;
  grades:      Record<string, GradeCell[]>;  // subject -> [t1,t2,t3]
  mapeh:       GradeCell[];
  finalGrades: Record<string, number>;
  mapehFinal:  number;
  genAverage:  number;
  attendance:  {days:number; present:number; absent:number}[];
  conduct:     Record<string,string>;
  promoted:    boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL GRADE ENTRY PANEL
// ─────────────────────────────────────────────────────────────────────────────

function ManualGradePanel({
  students, sectionId, onClose, onSaved,
}: { students:Student[]; sectionId:string; onClose:()=>void; onSaved:()=>void }) {
  const [manualGrades, setManualGrades] = useState<Record<string,Record<string,number[]>>>({});
  const [saving,       setSaving]       = useState(false);
  const [loaded,       setLoaded]       = useState(false);
  const [filterSubj,   setFilterSubj]   = useState(ALL_SUBJECTS[0]);

  // Load existing manual grades
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('manual_grades')
        .select('*')
        .eq('section_id', sectionId);

      const map: Record<string,Record<string,number[]>> = {};
      students.forEach(s => {
        map[s.id] = {};
        ALL_SUBJECTS.forEach(subj => { map[s.id][subj] = [0,0,0]; });
      });
      data?.forEach((r:any) => {
        if (!map[r.student_id]) return;
        if (!map[r.student_id][r.subject]) map[r.student_id][r.subject] = [0,0,0];
        map[r.student_id][r.subject][r.term - 1] = r.grade;
      });
      setManualGrades(map);
      setLoaded(true);
    })();
  }, [sectionId, students]);

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

  const saveAll = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const rows: any[] = [];

    students.forEach(student => {
      ALL_SUBJECTS.forEach(subj => {
        const grades = manualGrades[student.id]?.[subj] ?? [0,0,0];
        grades.forEach((grade, i) => {
          if (grade >= 60) {
            rows.push({
              section_id: sectionId,
              student_id: student.id,
              subject:    subj,
              term:       i + 1,
              grade,
              encoded_by: user?.id,
            });
          }
        });
      });
    });

    if (rows.length > 0) {
      // Batch in chunks of 50
      for (let i = 0; i < rows.length; i += 50) {
        await supabase.from('manual_grades').upsert(
          rows.slice(i, i+50),
          { onConflict: 'section_id,student_id,subject,term' }
        );
      }
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const subjectGroups = [
    { label: 'Core Subjects', subjects: JHS_SUBJECTS },
    { label: 'MAPEH Components', subjects: MAPEH_COMPONENTS },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-6xl border border-gray-700 shadow-2xl flex flex-col" style={{maxHeight:'90vh'}}>
        {/* Header */}
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

        {/* Subject filter tabs */}
        <div className="flex gap-1 px-5 pt-4 flex-shrink-0 flex-wrap">
          {ALL_SUBJECTS.map(subj => (
            <button key={subj} onClick={() => setFilterSubj(subj)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                filterSubj===subj
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}>
              {subj.replace('Araling Panlipunan (AP)','AP')
                   .replace('Edukasyon sa Pagpapakatao (EsP)','EsP')
                   .replace('Edukasyong Pantahanan at Pangkabuhayan (EPP)','EPP')
                   .replace('MAPEH - ','')}
            </button>
          ))}
        </div>

        {/* Table */}
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
                    Subject: <span className="text-white font-semibold">{filterSubj}</span>
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
                            onChange={e => setGrade(student.id, filterSubj, ti, e.target.value)}
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

        {/* Footer */}
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
  sectionId, onClose,
}: { sectionId:string; onClose:()=>void }) {
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
    const { data, error } = await supabase.from('section_collaborators').upsert({
      section_id:  sectionId,
      email:       inviteEmail.trim().toLowerCase(),
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

  const subjectLabel = (s:string) => s
    .replace('Araling Panlipunan (AP)','AP')
    .replace('Edukasyon sa Pagpapakatao (EsP)','EsP')
    .replace('Edukasyong Pantahanan at Pangkabuhayan (EPP)','EPP')
    .replace('MAPEH - ','');

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
          {/* How it works */}
          <div className="bg-blue-950/40 border border-blue-800 rounded-2xl p-4 text-sm text-blue-300">
            <div className="font-semibold mb-2">📋 How it works:</div>
            <ol className="space-y-1 text-xs list-decimal list-inside text-blue-200">
              <li>Enter the subject teacher's email and select their subjects below</li>
              <li>They register/login to TeacherHub PH using that same email</li>
              <li>The section appears in their sidebar — they encode grades for their subjects only</li>
              <li>SF9 automatically uses their Class Record data for those subjects</li>
            </ol>
          </div>

          {/* Invite form */}
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
                {ALL_SUBJECTS.map(subj => (
                  <button key={subj} onClick={() => toggleSubject(subj)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                      inviteSubjects.includes(subj)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}>
                    {subjectLabel(subj)}
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

          {/* Collaborator list */}
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
                          {c.status === 'active' ? '✓ Active' : '⏳ Pending login'}
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
// SF9 CARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function SF9Card({ data, section }: { data:LearnerSF9; section:any }) {
  // Name parsing: full_name is stored as "LAST, FIRST MIDDLE"
  // middle_name column stores the full middle name (e.g. "PEDRO" not "P.")
  const nameParts  = data.student.full_name.split(',').map((s:string) => s.trim());
  const lastName   = nameParts[0] ?? '';
  const middleName = (data.student.middle_name ?? '').trim().toUpperCase();
  // First name = everything after comma, minus the middle name suffix if present
  const rawFirst   = (nameParts[1] ?? '').trim();
  const firstName  = middleName && rawFirst.toUpperCase().endsWith(middleName)
    ? rawFirst.slice(0, rawFirst.length - middleName.length).trim()
    : rawFirst;
  const schoolHead = (section?.school_head ?? '').toUpperCase();
  const adviserName= (section?.adviser     ?? '').toUpperCase();

  // ── Consistent column widths (A4 landscape = 277mm usable after 10mm margins)
  // Page 1: LEFT=105mm | divider=1px | RIGHT=172mm  (total≈277mm)
  // Page 2: LEFT=172mm | divider=1px | RIGHT=105mm  (mirrored — inner spread)
  // These must match exactly so columns align when folded

  // EXACT 50/50 split so vertical divider aligns on both pages when folded
  // A4 landscape 297mm - 2×8mm margin - 2×1px borders = ~280mm / 2 = 140mm each
  const HALF_W = '138mm';

  const cellStyle = (bg='white'): React.CSSProperties => ({
    border:'1px solid black', textAlign:'center', padding:'1px 2px',
    fontSize:'8pt', background: bg,
  });

  const gradeCell = (cell: GradeCell, key: string|number) => (
    <td key={key} style={cellStyle(cell.value>0&&cell.value<75?'#fee2e2':'white')}>
      {cell.value||''}
    </td>
  );

  // One-liner signature block — name stays on ONE line using nowrap
  const SigLine = ({ name, title, marginTop='10mm' }: { name:string; title:string; marginTop?:string }) => (
    <div style={{textAlign:'center', marginTop}}>
      <div style={{
        borderTop:'1px solid black',
        paddingTop:'2px',
        fontSize:'7.5pt',
        whiteSpace:'nowrap',       // ← prevents name from wrapping
        overflow:'hidden',
        textOverflow:'ellipsis',
        maxWidth:'100%',
        fontWeight:'bold',
      }}>
        {name || '\u00a0'}
      </div>
      <div style={{fontSize:'7pt', fontStyle:'italic', marginTop:'1px'}}>{title}</div>
    </div>
  );

  return (
    <div className="sf9-card" style={{
      width:'278mm',            // A4 landscape: 297mm - 8mm margins each side - borders
      margin:'0 auto',
      fontFamily:'Arial, sans-serif',
      fontSize:'9pt',
      color:'black',
      background:'white',
      boxSizing:'border-box' as const,
    }}>

      {/* ══════════════════════════════════════════════════════
          PAGE 1  —  BACK (left) + FRONT/COVER (right)
          When folded: BACK is the outer-left, FRONT is outer-right
          ══════════════════════════════════════════════════════ */}
      <div style={{
        display:'flex',
        width:'100%',
        border:'1px solid black',
        pageBreakAfter:'always',
        minHeight:'190mm',
      }}>

        {/* ── BACK PAGE: Attendance + Certificate of Transfer ── */}
        <div style={{
          width: HALF_W,
          flexShrink:0,
          borderRight:'1px solid black',
          padding:'4mm',
          fontSize:'8pt',
          boxSizing:'border-box' as const,
        }}>
          {/* Attendance Table */}
          <div style={{fontWeight:'bold', textAlign:'center', marginBottom:'3mm', fontSize:'8.5pt'}}>
            REPORT ON ATTENDANCE
          </div>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'7.5pt', marginBottom:'5mm'}}>
            <thead>
              <tr>
                <td style={{border:'1px solid black', padding:'1px 2px', width:'42%'}}></td>
                {['Term 1','Term 2','Term 3','Total'].map(h=>(
                  <td key={h} style={{border:'1px solid black', padding:'1px 2px', textAlign:'center', fontWeight:'bold'}}>{h}</td>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                {label:'No. of School Days',  key:'days'},
                {label:'No. of Days Present', key:'present'},
                {label:'No. of Days Absent',  key:'absent'},
              ].map(row=>(
                <tr key={row.key}>
                  <td style={{border:'1px solid black', padding:'1px 3px', fontSize:'7pt'}}>{row.label}</td>
                  {data.attendance.map((att,i)=>(
                    <td key={i} style={{border:'1px solid black', textAlign:'center', padding:'1px'}}>
                      {(att as any)[row.key]||''}
                    </td>
                  ))}
                  <td style={{border:'1px solid black', textAlign:'center', fontWeight:'bold', padding:'1px'}}>
                    {data.attendance.reduce((s,a)=>s+((a as any)[row.key]||0),0)||''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Parent signatures */}
          <div style={{fontWeight:'bold', marginBottom:'3mm'}}>PARENT / GUARDIAN&apos;S SIGNATURE</div>
          {['1st Quarter (Term 1)','2nd Quarter (Term 2)','3rd Quarter (Term 3)'].map(t=>(
            <div key={t} style={{display:'flex', alignItems:'flex-end', marginBottom:'7mm', gap:'2mm'}}>
              <span style={{fontSize:'7.5pt', whiteSpace:'nowrap', minWidth:'95px'}}>{t}</span>
              <div style={{flex:1, borderBottom:'1px solid black', marginBottom:'1px'}}></div>
            </div>
          ))}

          {/* Certificate of Transfer */}
          <div style={{fontSize:'7.5pt', marginTop:'3mm', borderTop:'1px solid #ccc', paddingTop:'3mm'}}>
            <div style={{fontWeight:'bold', textAlign:'center', marginBottom:'3mm', fontSize:'8pt'}}>Certificate of Transfer</div>
            <div style={{marginBottom:'4mm'}}>Admitted to Grade: ______ Section: _______________</div>
            <div style={{marginBottom:'4mm'}}>Eligibility for Admission to Grade: _____________</div>
            <div style={{display:'flex', justifyContent:'space-between', gap:'4mm', marginBottom:'4mm'}}>
              <SigLine name={schoolHead} title="School Head" marginTop="8mm"/>
              <SigLine name={adviserName} title="Adviser"    marginTop="8mm"/>
            </div>
            <div style={{fontWeight:'bold', textAlign:'center', marginBottom:'3mm', fontSize:'8pt'}}>
              Cancellation of Eligibility to Transfer
            </div>
            <div style={{marginBottom:'3mm'}}>Admitted in: ________________________</div>
            <div style={{marginBottom:'3mm'}}>Date: _______________________________</div>
            <SigLine name={schoolHead} title="School Head" marginTop="6mm"/>
          </div>
        </div>

        {/* ── FRONT/COVER PAGE ── */}
        <div style={{
          width: HALF_W,
          flexShrink:0,
          padding:'5mm',
          fontSize:'8pt',
          boxSizing:'border-box' as const,
          display:'flex',
          flexDirection:'column',
        }}>
          {/* DepEd Header */}
          <div style={{textAlign:'center', marginBottom:'3mm'}}>
            <div style={{fontSize:'7.5pt'}}>Republic of the Philippines</div>
            <div style={{fontWeight:'bold', fontSize:'9pt'}}>DEPARTMENT OF EDUCATION</div>
            <div style={{fontSize:'7.5pt'}}>
              {section?.region ?? 'Region XI'} &mdash; {section?.division ?? ''}
            </div>
            <div style={{
              fontWeight:'bold', textDecoration:'underline',
              fontSize:'9.5pt', marginTop:'2mm', marginBottom:'1mm',
              textTransform:'uppercase',
            }}>
              {section?.school_name ?? ''}
            </div>
            <div style={{fontSize:'7pt', fontStyle:'italic'}}>School</div>
          </div>

          {/* LRN */}
          <div style={{display:'flex', justifyContent:'flex-end', marginBottom:'2mm', fontSize:'7.5pt'}}>
            <span style={{fontWeight:'bold'}}>LRN:&nbsp;</span>
            <span style={{
              borderBottom:'1px solid black',
              minWidth:'88px', textAlign:'center',
              display:'inline-block', paddingBottom:'1px',
            }}>{data.student.lrn}</span>
          </div>

          {/* Name fields */}
          <div style={{marginBottom:'2mm'}}>
            <div style={{display:'flex', alignItems:'flex-end', gap:'2mm', marginBottom:'1px'}}>
              <span style={{fontWeight:'bold', whiteSpace:'nowrap', fontSize:'8pt'}}>Name:</span>
              <div style={{flex:1, borderBottom:'1px solid black', textAlign:'center', fontWeight:'bold', paddingBottom:'1px', fontSize:'8pt'}}>{lastName}</div>
              <div style={{flex:1.5, borderBottom:'1px solid black', textAlign:'center', fontWeight:'bold', paddingBottom:'1px', fontSize:'8pt'}}>{firstName}</div>
              <div style={{flex:0.7, borderBottom:'1px solid black', textAlign:'center', fontWeight:'bold', paddingBottom:'1px', fontSize:'8pt'}}>{middleName}</div>
            </div>
            <div style={{display:'flex', fontSize:'6.5pt', color:'#555', marginBottom:'2mm'}}>
              <div style={{flex:'none', width:'30px'}}></div>
              <div style={{flex:1, textAlign:'center'}}>Last Name</div>
              <div style={{flex:1.5, textAlign:'center'}}>First Name</div>
              <div style={{flex:0.7, textAlign:'center'}}>Middle Name</div>
            </div>
          </div>

          {/* Student info grid */}
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8pt', marginBottom:'3mm'}}>
            <tbody>
              <tr>
                <td style={{padding:'1px 2px', whiteSpace:'nowrap'}}>Age:</td>
                <td style={{borderBottom:'1px solid black', padding:'1px 4px', fontWeight:'bold'}}></td>
                <td style={{padding:'1px 2px', whiteSpace:'nowrap'}}>Sex:</td>
                <td style={{borderBottom:'1px solid black', padding:'1px 4px', fontWeight:'bold'}}>{data.student.sex==='M'?'Male':'Female'}</td>
              </tr>
              <tr>
                <td style={{padding:'1px 2px', whiteSpace:'nowrap'}}>Grade:</td>
                <td style={{borderBottom:'1px solid black', padding:'1px 4px', fontWeight:'bold'}}>{section?.grade_level??''}</td>
                <td style={{padding:'1px 2px', whiteSpace:'nowrap'}}>Section:</td>
                <td style={{borderBottom:'1px solid black', padding:'1px 4px', fontWeight:'bold'}}>{section?.name??''}</td>
              </tr>
              <tr>
                <td style={{padding:'1px 2px', whiteSpace:'nowrap', fontSize:'7.5pt'}}>Curriculum:</td>
                <td colSpan={3} style={{borderBottom:'1px solid black', padding:'1px 4px', fontWeight:'bold', fontSize:'7.5pt'}}>K to 12 Basic Education Curriculum</td>
              </tr>
              <tr>
                <td style={{padding:'1px 2px', whiteSpace:'nowrap', fontSize:'7.5pt'}}>School Year:</td>
                <td colSpan={3} style={{borderBottom:'1px solid black', padding:'1px 4px', fontWeight:'bold'}}>{section?.school_year??''}</td>
              </tr>
            </tbody>
          </table>

          {/* Dear Parent letter */}
          <div style={{fontSize:'7.5pt', fontStyle:'italic', lineHeight:'1.5', marginBottom:'4mm', flex:1}}>
            <p style={{marginBottom:'2mm'}}>Dear Parent/Guardian,</p>
            <p style={{marginBottom:'2mm', textIndent:'5mm'}}>
              This report card shows the ability and progress your child has made in the different
              learning areas as well as his/her core values.
            </p>
            <p style={{textIndent:'5mm'}}>
              The school welcomes you should you desire to know more about your child&apos;s progress.
            </p>
          </div>

          {/* Signatures — adviser above, principal below */}
          <div style={{marginTop:'auto'}}>
            <SigLine name={adviserName} title="Adviser" marginTop="10mm"/>
            <SigLine name={schoolHead || ''}  title="Principal / School Head" marginTop="10mm"/>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          PAGE 2  —  INNER SPREAD
          LEFT = grades table (172mm) | RIGHT = core values (105mm)
          Note: widths are SWAPPED vs page 1 so they align when folded
          ══════════════════════════════════════════════════════ */}
      <div style={{
        display:'flex',
        width:'100%',
        border:'1px solid black',
        minHeight:'190mm',
      }}>

        {/* ── LEFT INNER: Grades Table ── */}
        <div style={{
          width: HALF_W,
          flexShrink:0,
          borderRight:'1px solid black',
          padding:'4mm',
          fontSize:'8pt',
          boxSizing:'border-box' as const,
        }}>
          <div style={{fontWeight:'bold', textAlign:'center', marginBottom:'3mm', fontSize:'8.5pt'}}>
            REPORT ON LEARNING PROGRESS AND ACHIEVEMENT
          </div>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'8pt'}}>
            <thead>
              <tr style={{background:'#f3f4f6'}}>
                <th style={{border:'1px solid black', padding:'2px 3px', textAlign:'left', width:'34%'}}>Learning Areas</th>
                <th style={{border:'1px solid black', padding:'2px', textAlign:'center', width:'12%'}}>Term 1</th>
                <th style={{border:'1px solid black', padding:'2px', textAlign:'center', width:'12%'}}>Term 2</th>
                <th style={{border:'1px solid black', padding:'2px', textAlign:'center', width:'12%'}}>Term 3</th>
                <th style={{border:'1px solid black', padding:'2px', textAlign:'center', width:'14%'}}>Final Rating</th>
                <th style={{border:'1px solid black', padding:'2px', textAlign:'center', width:'16%'}}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {JHS_SUBJECTS.map(subj => {
                const cells = data.grades[subj] ?? [{value:0,source:'none'},{value:0,source:'none'},{value:0,source:'none'}];
                const final = data.finalGrades[subj] ?? 0;
                const failed = final>0&&final<75;
                return (
                  <tr key={subj}>
                    <td style={{border:'1px solid black', padding:'2px 3px'}}>{subj}</td>
                    {cells.map((cell,i)=>gradeCell(cell,i))}
                    <td style={cellStyle(failed?'#fee2e2':'white')}><b>{final||''}</b></td>
                    <td style={{border:'1px solid black', textAlign:'center', padding:'2px',
                      fontSize:'7.5pt', color:failed?'red':'inherit'}}>
                      {final>0?(failed?'Failed':'Passed'):''}
                    </td>
                  </tr>
                );
              })}

              {/* MAPEH header row */}
              <tr>
                <td style={{border:'1px solid black', padding:'2px 3px', fontWeight:'bold'}}>MAPEH</td>
                {data.mapeh.map((cell,i)=>gradeCell(cell,i))}
                <td style={cellStyle(data.mapehFinal>0&&data.mapehFinal<75?'#fee2e2':'white')}>
                  <b>{data.mapehFinal||''}</b>
                </td>
                <td style={{border:'1px solid black', textAlign:'center', padding:'2px',
                  fontSize:'7.5pt', color:data.mapehFinal>0&&data.mapehFinal<75?'red':'inherit'}}>
                  {data.mapehFinal>0?(data.mapehFinal<75?'Failed':'Passed'):''}
                </td>
              </tr>

              {/* MAPEH sub-components */}
              {MAPEH_COMPONENTS.map(comp=>{
                const cells = data.grades[comp]??[{value:0,source:'none'},{value:0,source:'none'},{value:0,source:'none'}];
                const final = data.finalGrades[comp]??0;
                return (
                  <tr key={comp}>
                    <td style={{border:'1px solid black', padding:'2px 3px 2px 10px', fontSize:'7.5pt', color:'#555'}}>
                      {comp.replace('MAPEH - ','')}
                    </td>
                    {cells.map((cell,i)=>(
                      <td key={i} style={{border:'1px solid black', textAlign:'center',
                        padding:'2px', fontSize:'7.5pt', color:'#666'}}>
                        {cell.value||''}
                      </td>
                    ))}
                    <td style={{border:'1px solid black', textAlign:'center', padding:'2px',
                      fontSize:'7.5pt', color:'#666'}}>{final||''}</td>
                    <td style={{border:'1px solid black'}}></td>
                  </tr>
                );
              })}

              {/* General Average */}
              <tr style={{background:'#f0fdf4'}}>
                <td colSpan={4} style={{border:'1px solid black', padding:'2px 4px',
                  fontWeight:'bold', textAlign:'right', fontSize:'8.5pt'}}>
                  General Average
                </td>
                <td style={{border:'1px solid black', textAlign:'center', fontWeight:'bold',
                  fontSize:'11pt', padding:'2px',
                  background:data.genAverage>0&&data.genAverage<75?'#fee2e2':'#dcfce7'}}>
                  {data.genAverage||''}
                </td>
                <td style={{border:'1px solid black', textAlign:'center', fontWeight:'bold',
                  color:data.genAverage>=75?'#166534':'red', fontSize:'7.5pt', padding:'2px'}}>
                  {data.genAverage>0?(data.genAverage>=75?'PROMOTED':'FOR REVIEW'):''}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Descriptor legend */}
          <div style={{marginTop:'3mm', fontSize:'7pt'}}>
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'#f3f4f6'}}>
                  <th style={{border:'1px solid black', padding:'1px 3px', textAlign:'left'}}>Descriptors</th>
                  <th style={{border:'1px solid black', padding:'1px 3px'}}>Grading Scale</th>
                  <th style={{border:'1px solid black', padding:'1px 3px'}}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['ADVANCING',            '90–100','Passed'],
                  ['BENCHMARKING',         '80–89', 'Passed'],
                  ['CONNECTING',           '75–79', 'Passed'],
                  ['DEVELOPING',           '65–74', 'Failed'],
                  ['EMERGING',             'Below 64','Failed'],
                ].map(([d,s,r])=>(
                  <tr key={d}>
                    <td style={{border:'1px solid black', padding:'1px 3px'}}>{d}</td>
                    <td style={{border:'1px solid black', padding:'1px 3px', textAlign:'center'}}>{s}</td>
                    <td style={{border:'1px solid black', padding:'1px 3px', textAlign:'center'}}>{r}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── RIGHT INNER: Core Values ── */}
        <div style={{
          width: HALF_W,
          flexShrink:0,
          padding:'4mm',
          fontSize:'8pt',
          boxSizing:'border-box' as const,
        }}>
          <div style={{fontWeight:'bold', textAlign:'center', marginBottom:'3mm', fontSize:'8.5pt'}}>
            REPORT ON LEARNER&apos;S OBSERVED VALUES
          </div>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'7pt', marginBottom:'4mm'}}>
            <thead>
              <tr style={{background:'#f3f4f6'}}>
                <th style={{border:'1px solid black', padding:'2px', width:'26%', textAlign:'center'}}>Core Values</th>
                <th style={{border:'1px solid black', padding:'2px', textAlign:'left', width:'40%'}}>Behavior Statements</th>
                <th style={{border:'1px solid black', padding:'2px', textAlign:'center', width:'11%'}}>T1</th>
                <th style={{border:'1px solid black', padding:'2px', textAlign:'center', width:'11%'}}>T2</th>
                <th style={{border:'1px solid black', padding:'2px', textAlign:'center', width:'11%'}}>T3</th>
              </tr>
            </thead>
            <tbody>
              {CORE_VALUES.map(cv=>cv.behaviors.map((b,bi)=>(
                <tr key={b}>
                  {bi===0&&(
                    <td style={{border:'1px solid black', padding:'2px', fontWeight:'bold',
                      verticalAlign:'middle', textAlign:'center', fontSize:'7pt'}}
                      rowSpan={cv.behaviors.length}>
                      {cv.value}
                    </td>
                  )}
                  <td style={{border:'1px solid black', padding:'2px', fontSize:'6.5pt', lineHeight:'1.3'}}>
                    {b}
                  </td>
                  {[1,2,3].map(term=>(
                    <td key={term} style={{border:'1px solid black', textAlign:'center',
                      fontWeight:'bold', padding:'2px', fontSize:'9pt'}}>
                      {data.conduct[`${b}_${term}`]??''}
                    </td>
                  ))}
                </tr>
              )))}
            </tbody>
          </table>

          {/* Conduct legend */}
          <div style={{fontSize:'7pt', marginBottom:'4mm'}}>
            <div style={{fontWeight:'bold', marginBottom:'2px'}}>Non-Numerical Rating:</div>
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <tbody>
                {Object.entries(CONDUCT_LABELS).map(([k,v])=>(
                  <tr key={k}>
                    <td style={{border:'1px solid black', padding:'1px 3px', fontWeight:'bold', width:'25px', textAlign:'center'}}>{k}</td>
                    <td style={{border:'1px solid black', padding:'1px 3px'}}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  const { sectionId, sectionName, gradeLevel, schoolYear, activeSection } = sectionCtx;

  const [students,      setStudents]      = useState<Student[]>([]);
  const [sf9Data,       setSF9Data]       = useState<LearnerSF9[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [selected,      setSelected]      = useState(0);
  const [printAll,      setPrintAll]      = useState(false);
  const [showManual,    setShowManual]    = useState(false);
  const [showCollab,    setShowCollab]    = useState(false);
  const [gradeSource,   setGradeSource]   = useState<Record<string,string>>({});  // per subject → source label
  const [dataVersion,   setDataVersion]   = useState(0);  // bump to reload

  const loadData = useCallback(async () => {
    if (!sectionId || sectionId === 'default-section') { setLoading(false); return; }
    setLoading(true);

    const { data: studs } = await supabase
      .from('students').select('*').eq('section_id', sectionId).order('full_name');
    const studentList: Student[] = studs ?? [];
    setStudents(studentList);
    if (!studentList.length) { setLoading(false); return; }

    // Load class record grades
    const { data: gradesRaw } = await supabase
      .from('grades').select('*').in('term',[1,2,3]).in('subject', ALL_SUBJECTS);

    // Load manual grades (adviser-typed)
    const { data: manualRaw } = await supabase
      .from('manual_grades').select('*').eq('section_id', sectionId);

    // Load conduct
    const { data: conductRaw } = await supabase
      .from('conduct_records').select('*').in('term',[1,2,3]);

    // Load attendance
    const { data: attendRaw } = await supabase
      .from('attendance').select('date,student_id,status').eq('section_id', sectionId);

    // ── Build per-student data ──────────────────────────────────────────────
    const TERM_MONTHS: Record<number,string[]> = {
      1: ['2026-06','2026-07','2026-08','2026-09'],
      2: ['2026-10','2026-11','2026-12'],
      3: ['2027-01','2027-02','2027-03'],
    };

    const sourceMap: Record<string,string> = {};

    const result: LearnerSF9[] = studentList.map(student => {
      const grades:  Record<string, GradeCell[]> = {};
      const finalGrades: Record<string, number>  = {};

      ALL_SUBJECTS.forEach(subj => {
        const termCells = [1,2,3].map(t => {
          // Priority 1: Class Record
          const crRow = gradesRaw?.find(g =>
            g.student_id === student.id && g.subject === subj && g.term === t
          );
          if (crRow) {
            const v = computeFromClassRecord(crRow, subj);
            if (v > 0) {
              sourceMap[subj] = 'Class Record';
              return { value: v, source: 'class_record' } as GradeCell;
            }
          }
          // Priority 2: Manual grade
          const manRow = manualRaw?.find(g =>
            g.student_id === student.id && g.subject === subj && g.term === t
          );
          if (manRow && manRow.grade >= 60) {
            if (!sourceMap[subj]) sourceMap[subj] = 'Manual Entry';
            return { value: manRow.grade, source: 'manual' } as GradeCell;
          }
          return { value: 0, source: 'none' } as GradeCell;
        });

        grades[subj] = termCells;
        const recorded = termCells.filter(c => c.value > 0);
        finalGrades[subj] = recorded.length
          ? Math.round(recorded.reduce((a,c)=>a+c.value,0)/recorded.length) : 0;
      });

      // MAPEH per term
      const mapeh = [0,1,2].map(ti => {
        const scores = MAPEH_COMPONENTS.map(k => grades[k][ti].value).filter(v=>v>0);
        return { value: scores.length ? Math.round(scores.reduce((a,b)=>a+b)/scores.length) : 0, source: 'none' } as GradeCell;
      });
      const mapehFinalScores = mapeh.filter(c=>c.value>0);
      const mapehFinal = mapehFinalScores.length
        ? Math.round(mapehFinalScores.reduce((a,c)=>a+c.value,0)/mapehFinalScores.length) : 0;

      // General average
      const gaSubjects = JHS_SUBJECTS;
      const gaScores = [...gaSubjects.map(s=>finalGrades[s]), mapehFinal].filter(v=>v>0);
      const genAverage = gaScores.length
        ? Math.round(gaScores.reduce((a,b)=>a+b)/gaScores.length) : 0;

      // Attendance per term
      const attendance = [1,2,3].map(term => {
        const months = TERM_MONTHS[term];
        const termAtt = (attendRaw??[]).filter(a =>
          a.student_id===student.id && months.some(m=>a.date?.startsWith(m))
        );
        const absent = termAtt.filter(a=>a.status==='A').length;
        return { days: termAtt.length, present: termAtt.length-absent, absent };
      });

      // Conduct
      const conduct: Record<string,string> = {};
      [1,2,3].forEach(term => {
        const rec = conductRaw?.find(c=>c.student_id===student.id&&c.term===term);
        if (rec?.ratings) {
          CORE_VALUES.forEach(cv=>cv.behaviors.forEach(b=>{
            if (rec.ratings[b]) conduct[`${b}_${term}`]=rec.ratings[b];
          }));
        }
      });

      return { student, grades, mapeh, finalGrades, mapehFinal, genAverage, attendance, conduct, promoted: genAverage>=75 };
    });

    setSF9Data(result);
    setGradeSource(sourceMap);
    setLoading(false);
  }, [sectionId, dataVersion]);

  useEffect(() => { loadData(); }, [loadData]);

  const current = sf9Data[selected];

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; }
          @page { size: A4 landscape; margin: 6mm; }
          .sf9-card { page-break-after: always; }
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
              <p className="text-gray-400 text-sm">{sectionName} · {gradeLevel} · {schoolYear} · Tri-Term</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            {/* Grade source legend */}
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

            {/* Manual grade entry button */}
            <button onClick={()=>setShowManual(true)}
              className="flex items-center gap-2 bg-amber-700 hover:bg-amber-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Edit3 size={16}/> Manual Grade Entry
            </button>

            {/* Collaboration button */}
            <button onClick={()=>setShowCollab(true)}
              className="flex items-center gap-2 bg-purple-700 hover:bg-purple-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Users size={16}/> Subject Teachers
            </button>

            {/* Learner navigation */}
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
                  <div className="text-2xl font-bold text-emerald-400">{sf9Data.filter(d=>d.promoted).length}</div>
                  <div className="text-gray-400 text-xs">Promoted</div>
                </div>
                <div className="bg-gray-900 border border-red-800 rounded-2xl px-5 py-3">
                  <div className="text-2xl font-bold text-red-400">{sf9Data.filter(d=>!d.promoted&&d.genAverage>0).length}</div>
                  <div className="text-gray-400 text-xs">For Review</div>
                </div>
                <div className="bg-gray-900 border border-yellow-800 rounded-2xl px-5 py-3">
                  <div className="text-2xl font-bold text-yellow-300">
                    {sf9Data.filter(d=>d.genAverage>0).length>0
                      ? (sf9Data.filter(d=>d.genAverage>0).reduce((s,d)=>s+d.genAverage,0)/sf9Data.filter(d=>d.genAverage>0).length).toFixed(1)
                      : '—'}
                  </div>
                  <div className="text-gray-400 text-xs">Class Average</div>
                </div>

                {/* Grade sources breakdown */}
                {Object.keys(gradeSource).length > 0 && (
                  <div className="bg-gray-900 border border-gray-700 rounded-2xl px-5 py-3 ml-auto">
                    <div className="text-xs text-gray-500 font-semibold mb-1">Grade Sources</div>
                    <div className="space-y-1">
                      {Object.entries(gradeSource).map(([subj, src]) => (
                        <div key={subj} className="flex items-center gap-2 text-xs">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${src==='Class Record'?'bg-emerald-500':'bg-amber-500'}`}/>
                          <span className="text-gray-400 truncate max-w-[120px]">{subj}</span>
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
                  <SF9Card data={current} section={activeSection}/>
                </div>
              )}
            </div>

            {/* Print area */}
            <div className="hidden print:block">
              {printAll
                ? sf9Data.map(d=><SF9Card key={d.student.id} data={d} section={activeSection}/>)
                : current && <SF9Card data={current} section={activeSection}/>
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
          onClose={() => setShowManual(false)}
          onSaved={() => setDataVersion(v => v+1)}
        />
      )}
      {showCollab && (
        <CollabPanel
          sectionId={sectionId}
          onClose={() => setShowCollab(false)}
        />
      )}
    </>
  );
}