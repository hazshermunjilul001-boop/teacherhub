'use client';

import { useState, useRef } from 'react';
import {
  ArrowLeft, Plus, Trash2, Edit3, Upload, Users, CheckCircle,
  AlertTriangle, RefreshCw, BookOpen, X, Save,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { parseSF1, type SF1ParseResult } from '../../lib/parseSF1';
import { useSection, type Section } from '../../context/SectionContext';
import * as XLSX from 'xlsx';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// BLANK SECTION FORM
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BLANK: Partial<Section> = {
  name:        '',
  grade_level: '',
  grade_number: 7,
  school_year: '2025 - 2026',
  school_name: '',
  school_id:   '',
  district:    '',
  division:    '',
  region:      'Region XI',
  adviser:     '',
  school_head: '',
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SF1 IMPORT MODAL
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ImportModal({
  onClose, onImported,
}: { onClose: () => void; onImported: (section: Section) => void }) {
  const [stage,    setStage]    = useState<'upload'|'preview'|'saving'>('upload');
  const [result,   setResult]   = useState<SF1ParseResult | null>(null);
  const [adviser,  setAdviser]  = useState('');
  const [schoolHead, setSchoolHead] = useState('');
  const [editSch,  setEditSch]  = useState({ name:'', id:'', section:'', grade:'', sy:'', region:'', division:'', district:'', school_head:'' });
  const [progress, setProgress] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStage('preview');
    const buf = await file.arrayBuffer();
    const parsed = parseSF1(buf);
    setResult(parsed);
    setEditSch({
      name:       parsed.school.school_name,
      id:         parsed.school.school_id,
      section:    parsed.school.section,
      grade:      parsed.school.grade_level,
      sy:         parsed.school.school_year,
      region:     parsed.school.region,
      division:   parsed.school.division,
      district:   '',
      school_head:'',
    });
  };

  const handleSave = async () => {
    if (!result) return;
    setStage('saving');
    setProgress('Getting user accountâ€¦');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('Not logged in.'); setStage('preview'); return; }

    // Build section record
    const sectionData = {
      teacher_id:   user.id,
      name:         editSch.section || result.school.section,
      grade_level:  editSch.grade   || result.school.grade_level,
      grade_number: result.school.grade_number,
      school_year:  editSch.sy      || result.school.school_year,
      school_name:  editSch.name    || result.school.school_name,
      school_id:    editSch.id      || result.school.school_id,
      division:     editSch.division|| result.school.division,
      region:       editSch.region  || result.school.region,
      adviser:      (adviser ?? '').trim(),
      school_head:  (schoolHead ?? '').trim(),
      district:     (editSch.district ?? '').trim(),
    };

    setProgress('Creating sectionâ€¦');
    const { data: newSection, error: secErr } = await supabase
      .from('sections')
      .insert(sectionData)
      .select()
      .single();

    if (secErr || !newSection) {
      alert('Error creating section: ' + secErr?.message);
      setStage('preview');
      return;
    }

    // Insert students
    setProgress(`Importing ${result.students.length} studentsâ€¦`);
    const studentRows = result.students.map(s => ({
      id:         crypto.randomUUID(),
      section_id: newSection.id,
      lrn:        s.lrn,
      full_name:  s.full_name,
      sex:        s.sex,
      birthdate:  s.birthdate,
    }));

    // Batch insert in chunks of 50
    for (let i = 0; i < studentRows.length; i += 50) {
      const chunk = studentRows.slice(i, i + 50);
      const { error } = await supabase.from('students').insert(chunk);
      if (error) {
        console.error('Student insert error:', error);
      }
      setProgress(`Imported ${Math.min(i + 50, studentRows.length)} of ${studentRows.length} studentsâ€¦`);
    }

    setProgress('Done!');
    onImported({ ...newSection, student_count: result.students.length });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-2xl border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Upload size={20} className="text-blue-400"/> Import SF1 from LIS
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition"><X size={20}/></button>
        </div>

        <div className="p-6">
          {/* UPLOAD STAGE */}
          {stage === 'upload' && (
            <div>
              <p className="text-gray-400 text-sm mb-6">
                Upload the SF1 Excel file you downloaded from the DepEd LIS website.
                The app will automatically read the school info and student list.
              </p>
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-600 hover:border-blue-500 rounded-2xl p-12 text-center cursor-pointer transition-all group">
                <Upload size={40} className="mx-auto mb-3 text-gray-500 group-hover:text-blue-400 transition"/>
                <p className="text-white font-semibold">Click to upload SF1 Excel file</p>
                <p className="text-gray-500 text-sm mt-1">Supports .xls and .xlsx from LIS</p>
                <input ref={fileRef} type="file" accept=".xls,.xlsx" onChange={handleFile} className="hidden"/>
              </div>
            </div>
          )}

          {/* PREVIEW STAGE */}
          {stage === 'preview' && result && (
            <div className="space-y-5">
              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="bg-yellow-950/40 border border-yellow-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-yellow-400 font-semibold mb-2">
                    <AlertTriangle size={16}/> Some fields need review:
                  </div>
                  {result.errors.map((e, i) => <p key={i} className="text-yellow-300 text-sm">{e}</p>)}
                </div>
              )}

              {/* School info â€” editable */}
              <div>
                <h4 className="font-semibold text-white mb-3">ðŸ“ School Information <span className="text-gray-500 text-xs font-normal">(edit if incorrect)</span></h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label:'School Name',  key:'name',     full: true },
                    { label:'School ID',    key:'id',       full: false },
                    { label:'Section',      key:'section',  full: false },
                    { label:'Grade Level',  key:'grade',    full: false },
                    { label:'School Year',  key:'sy',       full: false },
                    { label:'Region',       key:'region',   full: false },
                    { label:'Division',     key:'division', full: false },
                    { label:'District',     key:'district', full: false },
                  ].map(f => (
                    <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                      <label className="block text-xs text-gray-400 mb-1">{f.label}</label>
                      <input
                        value={(editSch as any)[f.key]}
                        onChange={e => setEditSch(prev => ({ ...prev, [f.key]: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"/>
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">Adviser / Teacher Name</label>
                    <input
                      value={adviser}
                      onChange={e => setAdviser(e.target.value)}
                      placeholder="e.g. HAZSHER MUNJILUL"
                      className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"/>
                  </div>
                </div>
              </div>

              {/* School Head field */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">School Head / Principal Name</label>
                <input
                  value={schoolHead}
                  onChange={e => setSchoolHead(e.target.value)}
                  placeholder="e.g. REUEL ALIPIO ALVAREZ"
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"/>
              </div>

              {/* Student preview */}
              <div>
                <h4 className="font-semibold text-white mb-3">
                  ðŸ‘¥ Students Found: <span className="text-blue-400">{result.students.length}</span>
                  <span className="text-gray-500 text-xs font-normal ml-2">
                    ({result.students.filter(s=>s.sex==='M').length}M Â· {result.students.filter(s=>s.sex==='F').length}F)
                  </span>
                </h4>
                <div className="bg-gray-800 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-700">
                      <tr>
                        <th className="text-left px-3 py-2">#</th>
                        <th className="text-left px-3 py-2">LRN</th>
                        <th className="text-left px-3 py-2">Full Name</th>
                        <th className="text-center px-3 py-2">Sex</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.students.map((s, i) => (
                        <tr key={s.lrn} className="border-t border-gray-700 hover:bg-gray-700/50">
                          <td className="px-3 py-1.5 text-gray-500">{i+1}</td>
                          <td className="px-3 py-1.5 font-mono text-gray-300">{s.lrn}</td>
                          <td className="px-3 py-1.5 text-white font-medium">{s.full_name}</td>
                          <td className="px-3 py-1.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${s.sex==='M'?'bg-blue-900 text-blue-300':'bg-pink-900 text-pink-300'}`}>
                              {s.sex}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => { setStage('upload'); setResult(null); }}
                  className="flex-1 py-3 rounded-xl border border-gray-600 hover:bg-gray-800 transition text-sm">
                  â† Upload Different File
                </button>
                <button onClick={handleSave}
                  className="flex-2 flex-grow-[2] py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold transition text-sm flex items-center justify-center gap-2">
                  <Save size={16}/> Create Section & Import {result.students.length} Students
                </button>
              </div>
            </div>
          )}

          {/* SAVING STAGE */}
          {stage === 'saving' && (
            <div className="text-center py-12">
              <RefreshCw size={40} className="animate-spin text-blue-400 mx-auto mb-4"/>
              <p className="text-white font-semibold text-lg">{progress}</p>
              <p className="text-gray-400 text-sm mt-2">Please wait, do not close this windowâ€¦</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CREATE MANUAL SECTION MODAL
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CreateManualModal({
  onClose, onCreated,
}: { onClose: () => void; onCreated: (s: Section) => void }) {
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string | number) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.name || !form.grade_level) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from('sections').insert({
      teacher_id:   user.id,
      name:         form.name,
      grade_level:  form.grade_level,
      grade_number: form.grade_number,
      school_year:  form.school_year,
      school_name:  form.school_name,
      school_id:    form.school_id,
      division:     form.division,
      region:       form.region,
      adviser:      form.adviser,
      school_head:  form.school_head,
      district:     form.district,
    }).select().single();

    if (!error && data) { onCreated(data); onClose(); }
    else alert('Error: ' + error?.message);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-lg border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h3 className="text-xl font-bold">Create Section Manually</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition"><X size={20}/></button>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label:'Section Name*',  key:'name',        ph:'e.g. STARGAZER' },
            { label:'Grade Level*',   key:'grade_level', ph:'e.g. Grade 7 (Year I)' },
            { label:'School Year',    key:'school_year', ph:'2025 - 2026' },
            { label:'School Name',    key:'school_name', ph:'Sta. Ana National High School' },
            { label:'School ID',      key:'school_id',   ph:'304393' },
            { label:'Division',       key:'division',    ph:'Davao City' },
            { label:'Region',         key:'region',      ph:'Region XI' },
            { label:'Adviser',        key:'adviser',     ph:'Your full name' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm text-gray-400 mb-1">{f.label}</label>
              <input value={(form as any)[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                placeholder={f.ph}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"/>
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-600 hover:bg-gray-800 transition text-sm">Cancel</button>
            <button onClick={save} disabled={saving || !form.name || !form.grade_level}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold transition text-sm disabled:opacity-60">
              {saving ? 'Creatingâ€¦' : 'Create Section'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// EDIT SECTION MODAL
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EditSectionModal({
  section, onClose, onUpdated,
}: { section: Section; onClose: () => void; onUpdated: (s: Section) => void }) {
  const [form, setForm] = useState({
    name:        section.name,
    grade_level: section.grade_level,
    school_year: section.school_year,
    school_name: section.school_name,
    school_id:   section.school_id,
    division:    section.division,
    region:      section.region,
    district:    section.district ?? '',
    adviser:     section.adviser,
    school_head: section.school_head ?? '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase
      .from('sections')
      .update(form)
      .eq('id', section.id)
      .select()
      .single();
    if (!error && data) { onUpdated(data); onClose(); }
    else alert('Error: ' + error?.message);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-lg border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h3 className="text-xl font-bold">Edit Section</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">âœ•</button>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: 'Section Name*',        key: 'name',        ph: 'e.g. STARGAZER' },
            { label: 'Grade Level*',          key: 'grade_level', ph: 'e.g. Grade 7 (Year I)' },
            { label: 'School Year',           key: 'school_year', ph: '2026 - 2027' },
            { label: 'School Name',           key: 'school_name', ph: 'School name' },
            { label: 'School ID',             key: 'school_id',   ph: '6-digit school ID' },
            { label: 'Division',              key: 'division',    ph: 'e.g. Davao City' },
            { label: 'District',              key: 'district',    ph: 'e.g. Sta. Ana' },
            { label: 'Region',               key: 'region',      ph: 'e.g. Region XI' },
            { label: 'Adviser Name',          key: 'adviser',     ph: 'Your full name' },
            { label: "School Head / Principal", key: "school_head", ph: "Principal's full name" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm text-gray-400 mb-1">{f.label}</label>
              <input value={(form as any)[f.key] || ''} onChange={e => set(f.key, e.target.value)}
                placeholder={f.ph}
                className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"/>
            </div>
          ))}

          {/* School head highlight */}
          <div className="bg-amber-950/30 border border-amber-800 rounded-xl p-3 text-xs text-amber-300">
            ðŸ’¡ The <strong>School Head / Principal</strong> name appears on SF2, SF8, SF5, and SF9 signature lines.
            Make sure to fill this in before printing any school forms.
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-600 hover:bg-gray-800 transition text-sm">
              Cancel
            </button>
            <button onClick={save} disabled={saving || !form.name || !form.grade_level}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 font-semibold transition text-sm disabled:opacity-60">
              {saving ? 'Savingâ€¦' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MAIN PAGE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function SectionsPage() {
  const { sections, activeSection, setActiveSection, loadSections } = useSection();
  const [showImport, setShowImport]   = useState(false);
  const [showManual, setShowManual]   = useState(false);
  const [showEdit,   setShowEdit]     = useState(false);
  const [editTarget, setEditTarget]   = useState<Section | null>(null);
  const [deleting,   setDeleting]     = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete section "${name}"? This will also delete all students, grades, and attendance data for this section. This cannot be undone.`)) return;
    setDeleting(id);
    // Delete students first (cascade should handle grades/attendance, but let's be explicit)
    await supabase.from('students').delete().eq('section_id', id);
    await supabase.from('grades').delete().eq('section_id', id);
    await supabase.from('attendance').delete().eq('section_id', id);
    await supabase.from('mps_records').delete().eq('section_id', id);
    await supabase.from('sections').delete().eq('id', id);
    await loadSections();
    setDeleting(null);
  };

  const handleImported = async (section: Section) => {
    await loadSections();
    setActiveSection(section);
    setShowImport(false);
  };

  const handleCreated = async (section: Section) => {
    await loadSections();
    setActiveSection(section);
    setShowManual(false);
  };

  const handleUpdated = async (section: Section) => {
    await loadSections();
    if (activeSection?.id === section.id) setActiveSection(section);
    setShowEdit(false);
    setEditTarget(null);
  };

  return (
    <>
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => window.history.back()}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-800 transition text-blue-400">
              <ArrowLeft size={22}/>
            </button>
            <div>
              <h1 className="text-2xl font-bold">My Sections</h1>
              <p className="text-gray-400 text-sm">Manage your class sections and student rosters</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowManual(true)}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Plus size={16}/> Create Manually
            </button>
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl text-sm font-semibold transition">
              <Upload size={16}/> Import SF1 from LIS
            </button>
          </div>
        </div>

        <div className="p-6">
          {sections.length === 0 ? (
            /* Empty state */
            <div className="text-center py-20">
              <BookOpen size={56} className="mx-auto mb-4 text-gray-700"/>
              <h2 className="text-2xl font-bold text-white mb-2">No sections yet</h2>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                Add your first class section by importing your SF1 Excel file from the DepEd LIS website,
                or create one manually.
              </p>
              <div className="flex gap-4 justify-center">
                <button onClick={() => setShowManual(true)}
                  className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-2xl font-semibold transition">
                  <Plus size={18}/> Create Manually
                </button>
                <button onClick={() => setShowImport(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-2xl font-semibold transition">
                  <Upload size={18}/> Import SF1 from LIS
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-400 text-sm mb-6">
                Click a section card to make it the <strong className="text-white">active section</strong> â€” all modules will use that section's data.
                Currently active: <span className="text-blue-400 font-semibold">{activeSection?.name ?? 'None'}</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sections.map(section => {
                  const isActive = activeSection?.id === section.id;
                  return (
                    <div key={section.id}
                      className={`relative rounded-2xl border p-5 transition-all cursor-pointer group
                        ${isActive
                          ? 'bg-blue-900/30 border-blue-500 shadow-xl shadow-blue-900/20'
                          : 'bg-gray-900 border-gray-700 hover:border-gray-500 hover:shadow-lg'}`}
                      onClick={() => setActiveSection(section)}>

                      {/* Active badge */}
                      {isActive && (
                        <div className="absolute top-4 right-4 flex items-center gap-1 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                          <CheckCircle size={12}/> Active
                        </div>
                      )}

                      {/* Grade badge */}
                      <div className="w-12 h-12 bg-blue-900/50 rounded-2xl flex items-center justify-center mb-3 text-2xl font-black text-blue-400">
                        {section.grade_number}
                      </div>

                      <h3 className="text-xl font-bold text-white">{section.name}</h3>
                      <p className="text-blue-400 text-sm font-medium">{section.grade_level}</p>
                      <p className="text-gray-500 text-xs mt-1">SY {section.school_year}</p>

                      <div className="mt-4 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Users size={12}/> {section.student_count ?? 'â€”'} students
                        </div>
                        {section.school_name && (
                          <div className="text-xs text-gray-500 truncate">{section.school_name}</div>
                        )}
                        {section.adviser && (
                          <div className="text-xs text-gray-500">{section.adviser}</div>
                        )}
                        {section.school_head && (
                          <div className="text-xs text-gray-500">ðŸ« {section.school_head}</div>
                        )}
                      </div>

                      {/* Edit + Delete buttons */}
                      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); setEditTarget(section); setShowEdit(true); }}
                          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 hover:bg-blue-900/40 hover:text-blue-400 transition">
                          <Edit3 size={14}/>
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(section.id, section.name); }}
                          disabled={deleting === section.id}
                          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-600 hover:bg-red-900/40 hover:text-red-400 transition">
                          {deleting === section.id ? <RefreshCw size={14} className="animate-spin"/> : <Trash2 size={14}/>}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Add more card */}
                <button onClick={() => setShowImport(true)}
                  className="rounded-2xl border-2 border-dashed border-gray-700 hover:border-blue-600 p-5 flex flex-col items-center justify-center gap-3 text-gray-500 hover:text-blue-400 transition-all min-h-[180px]">
                  <Upload size={28}/>
                  <span className="text-sm font-medium">Import Another SF1</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={handleImported}/>}
      {showManual && <CreateManualModal onClose={() => setShowManual(false)} onCreated={handleCreated}/>}
      {showEdit && editTarget && (
        <EditSectionModal
          section={editTarget}
          onClose={() => { setShowEdit(false); setEditTarget(null); }}
          onUpdated={handleUpdated}
        />
      )}
    </>
  );
}
