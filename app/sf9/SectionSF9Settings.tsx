'use client';

import { useState, useEffect } from 'react';
import { Save, X, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getHeaderScope, getGradeBand, SHS_TRACK_CONFIG, type SHSTrack } from '../../lib/sf9/sf9GradeBands';

interface SectionSF9SettingsProps {
  sectionId: string;
  gradeLevel: number;
  onClose: () => void;
  onSaved: () => void;
}

interface SectionSettingsForm {
  school_address: string;
  region: string;
  division: string;
  header_scope_type: 'district' | 'cluster';
  header_scope_name: string;
  school_id: string;
  shs_track: SHSTrack | '';
  elective_subjects: string[];
}

const EMPTY_FORM: SectionSettingsForm = {
  school_address: '',
  region: '',
  division: '',
  header_scope_type: 'district',
  header_scope_name: '',
  school_id: '',
  shs_track: '',
  elective_subjects: [],
};

export default function SectionSF9Settings({
  sectionId, gradeLevel, onClose, onSaved,
}: SectionSF9SettingsProps) {
  const [form,    setForm]    = useState<SectionSettingsForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const isSHS = gradeLevel === 11 || gradeLevel === 12;
  const band  = getGradeBand(gradeLevel);
  const trackCfg = form.shs_track ? SHS_TRACK_CONFIG[form.shs_track] : null;

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('sections')
        .select('school_address, region, division, header_scope_type, header_scope_name, school_id, shs_track, elective_subjects')
        .eq('id', sectionId)
        .single();

      setForm({
        school_address:     data?.school_address ?? '',
        region:             data?.region ?? '',
        division:           data?.division ?? '',
        header_scope_type:  data?.header_scope_type ?? getHeaderScope(gradeLevel),
        header_scope_name:  data?.header_scope_name ?? '',
        school_id:          data?.school_id ?? '',
        shs_track:          data?.shs_track ?? '',
        elective_subjects:  data?.elective_subjects ?? [],
      });
      setLoading(false);
    })();
  }, [sectionId, gradeLevel]);

  const setField = <K extends keyof SectionSettingsForm>(key: K, value: SectionSettingsForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const setElective = (idx: number, value: string) => {
    setForm(prev => {
      const next = [...prev.elective_subjects];
      next[idx] = value;
      return { ...prev, elective_subjects: next };
    });
  };

  const addElective = () => {
    setForm(prev => {
      if (trackCfg && prev.elective_subjects.length >= trackCfg.maxElectives) return prev;
      return { ...prev, elective_subjects: [...prev.elective_subjects, ''] };
    });
  };

  const removeElective = (idx: number) => {
    setForm(prev => ({
      ...prev,
      elective_subjects: prev.elective_subjects.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    if (isSHS && !form.shs_track) {
      setError('Select whether this is an Academic or TechPro Track section.');
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('sections')
      .update({
        school_address:     form.school_address || null,
        region:             form.region || null,
        division:           form.division || null,
        header_scope_type:  form.header_scope_type,
        header_scope_name:  form.header_scope_name || null,
        school_id:          form.school_id || null,
        shs_track:          isSHS ? (form.shs_track || null) : null,
        elective_subjects:  isSHS ? form.elective_subjects.filter(e => e.trim()) : [],
      })
      .eq('id', sectionId);

    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    onSaved();
    onClose();
  };

  const scopeLabel = form.header_scope_type === 'district' ? 'District' : 'Cluster';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto text-gray-900">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            SF9 Section Settings{band ? ` — ${band.label}` : ''}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading…</div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-xs text-gray-500">
              Fill this in once per section — every student&apos;s SF9 header pulls from here,
              so you won&apos;t re-enter it per learner.
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">School Address</label>
              <input
                type="text" value={form.school_address}
                onChange={e => setField('school_address', e.target.value)}
                placeholder="e.g. Sta. Ana, Davao City"
                className="w-full border rounded px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Region</label>
                <input
                  type="text" value={form.region}
                  onChange={e => setField('region', e.target.value)}
                  placeholder="e.g. Region XI"
                  className="w-full border rounded px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Division</label>
                <input
                  type="text" value={form.division}
                  onChange={e => setField('division', e.target.value)}
                  placeholder="e.g. Division of Davao City"
                  className="w-full border rounded px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Header Scope</label>
                <select
                  value={form.header_scope_type}
                  onChange={e => setField('header_scope_type', e.target.value as 'district' | 'cluster')}
                  className="w-full border rounded px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400"
                >
                  <option value="district">District (Grade ≤6)</option>
                  <option value="cluster">Cluster (Grade 7-12)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{scopeLabel} Name</label>
                <input
                  type="text" value={form.header_scope_name}
                  onChange={e => setField('header_scope_name', e.target.value)}
                  placeholder={form.header_scope_type === 'district' ? 'e.g. Sta. Ana District' : 'e.g. Cluster 1'}
                  className="w-full border rounded px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">School ID</label>
              <input
                type="text" value={form.school_id}
                onChange={e => setField('school_id', e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm max-w-[160px] text-gray-900 bg-white placeholder:text-gray-400"
              />
            </div>

            {isSHS && (
              <div className="border-t pt-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Track</label>
                  <select
                    value={form.shs_track}
                    onChange={e => setField('shs_track', e.target.value as SHSTrack)}
                    className="w-full border rounded px-3 py-2 text-sm text-gray-900 bg-white placeholder:text-gray-400"
                  >
                    <option value="">Select track…</option>
                    <option value="academic">Academic Track</option>
                    <option value="techpro">TechPro Track</option>
                  </select>
                </div>

                {trackCfg && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-gray-700">
                        {trackCfg.electivePrefix} Subjects
                      </label>
                      <span className="text-xs text-gray-400">
                        {form.elective_subjects.length}/{trackCfg.maxElectives}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {form.elective_subjects.map((name, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-16 shrink-0">
                            {trackCfg.electivePrefix} {idx + 1}
                          </span>
                          <input
                            type="text" value={name}
                            onChange={e => setElective(idx, e.target.value)}
                            placeholder="Subject name"
                            className="flex-1 border rounded px-3 py-1.5 text-sm text-gray-900 bg-white placeholder:text-gray-400"
                          />
                          <button onClick={() => removeElective(idx)} className="text-gray-400 hover:text-red-500">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {form.elective_subjects.length < trackCfg.maxElectives && (
                      <button
                        onClick={addElective}
                        className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        <Plus size={14} /> Add elective
                      </button>
                    )}
                    {form.elective_subjects.length > trackCfg.frontPageElectiveSlots && (
                      <p className="mt-2 text-xs text-amber-600">
                        Electives {trackCfg.frontPageElectiveSlots + 1}–{form.elective_subjects.length}
                        {trackCfg.hasWorkImmersion ? ' (plus Work Immersion)' : ''} will print on a continuation page.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 px-5 py-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
