'use client';

import { useState } from 'react';
import { Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { LearnerSF9 } from '../../lib/sf9/useSF9Data';

interface Props {
  sectionId: string;
  learner: LearnerSF9;
  onClose: () => void;
  onSaved: () => void;
}

export default function SF9CommentsEditor({ sectionId, learner, onClose, onSaved }: Props) {
  const [comments, setComments] = useState<Record<string, string>>({ ...learner.comments });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const { error: deleteError } = await supabase
      .from('sf9_comments').delete()
      .eq('section_id', sectionId).eq('student_id', learner.student.id);
    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }
    const rows = [1, 2, 3]
      .map(term => ({
        section_id: sectionId,
        student_id: learner.student.id,
        term,
        comment: (comments[String(term)] ?? '').trim(),
      }))
      .filter(row => row.comment.length > 0);
    if (rows.length) {
      const { error: insertError } = await supabase.from('sf9_comments').insert(rows);
      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-900 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Teacher&apos;s Comments / Remarks</h3>
            <p className="mt-1 text-xs text-gray-400">{learner.student.full_name} · enter a separate comment for each term</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="space-y-4 p-5">
          {[1, 2, 3].map(term => (
            <label key={term} className="block">
              <span className="mb-1 block text-sm font-semibold text-blue-300">Term {term}</span>
              <textarea
                value={comments[String(term)] ?? ''}
                onChange={event => setComments(prev => ({ ...prev, [String(term)]: event.target.value }))}
                rows={3}
                maxLength={500}
                placeholder={`Enter the learner's Term ${term} comment or remark…`}
                className="w-full resize-y rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
            </label>
          ))}
          {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">Could not save comments: {error}</p>}
        </div>
        <div className="flex gap-3 border-t border-gray-800 p-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-gray-700 py-2.5 text-sm hover:bg-gray-800">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50">
            <Save size={16} className="mr-2 inline" />{saving ? 'Saving…' : 'Save Comments'}
          </button>
        </div>
      </div>
    </div>
  );
}
