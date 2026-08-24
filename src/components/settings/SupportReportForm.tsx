import { useRef, useState } from 'react';
import { Bug, Paperclip, Send, X, Check, AlertCircle } from 'lucide-react';
import {
  SUPPORT_CATEGORIES,
  submitSupportReport,
  validateAttachment,
  ACCEPTED_ATTACHMENT_TYPES,
  type SupportCategory,
} from '../../services/supportReports';

/*
  Report a bug without leaving the app.

  Contact Us previously offered only an email address, which asks someone to
  switch to a mail client and describe from memory a screen they are no longer
  looking at. Most people simply do not, so problems went unreported rather
  than unfixed. This keeps the report next to the thing being reported, and
  takes a screenshot with it.
*/

export default function SupportReportForm() {
  const [category, setCategory] = useState<SupportCategory>('bug');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (selected: File | null) => {
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const problem = validateAttachment(selected);
    if (problem) {
      setError(problem);
      // Clear the input, or picking the same bad file again looks like
      // nothing happened.
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(selected);
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);
    try {
      await submitSupportReport({ category, subject, description, file });
      setSent(true);
      setSubject('');
      setDescription('');
      clearFile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = subject.trim().length > 0 && description.trim().length > 0 && !submitting;

  if (sent) {
    return (
      <div className="border border-blue-400/30 bg-blue-400/5 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-blue-400/20 rounded-lg flex items-center justify-center">
            <Check className="text-blue-400" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white mb-1">Report sent</h3>
            <p className="text-sm text-gray-400 mb-4">
              Thanks — we've got it, along with the page you were on. We'll reply by email
              if we need more detail.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              Report something else
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border border-white/10 bg-white/[0.02] rounded-xl p-6">
      <div className="flex items-start gap-4 mb-5">
        <div className="flex-shrink-0 w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
          <Bug className="text-blue-400" size={24} />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white mb-1">Report a bug or issue</h3>
          <p className="text-sm text-gray-400">
            Tell us what went wrong and attach a screenshot if it helps. We'll get the page
            you were on automatically.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">What kind of report is this?</label>
          <div className="grid grid-cols-2 gap-2">
            {SUPPORT_CATEGORIES.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setCategory(option.value)}
                className={`p-3 rounded-xl border text-left text-sm transition-all ${
                  category === option.value
                    ? 'bg-blue-400/10 border-blue-400/40 text-white'
                    : 'bg-white/[0.02] border-white/10 text-gray-400 hover:bg-white/5'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="support-subject" className="block text-xs font-medium text-gray-400 mb-2">
            Short summary
          </label>
          <input
            id="support-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={150}
            placeholder="Calendar shows the wrong week"
            className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-400/60 transition-colors"
          />
        </div>

        <div>
          <label htmlFor="support-description" className="block text-xs font-medium text-gray-400 mb-2">
            What happened?
          </label>
          <textarea
            id="support-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
            rows={5}
            placeholder="What you were doing, what you expected, and what happened instead."
            className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-400/60 transition-colors resize-y"
          />
          <p className="text-[10px] text-gray-500 mt-1">{description.length}/5000</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">
            Screenshot or file <span className="text-gray-600">(optional)</span>
          </label>

          {file ? (
            <div className="flex items-center gap-3 bg-[#111] border border-white/10 rounded-xl px-4 py-3">
              <Paperclip size={16} className="text-blue-400 flex-shrink-0" />
              <span className="text-sm text-white truncate flex-1">{file.name}</span>
              <span className="text-[10px] text-gray-500 flex-shrink-0">
                {(file.size / 1024).toFixed(0)} KB
              </span>
              <button
                type="button"
                onClick={clearFile}
                className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
                aria-label="Remove attachment"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 bg-[#111] border border-dashed border-white/15 hover:border-blue-400/40 rounded-xl px-4 py-4 text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              <Paperclip size={16} />
              Attach a screenshot
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_ATTACHMENT_TYPES.join(',')}
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <p className="text-[10px] text-gray-500 mt-1">PNG, JPG, WEBP, GIF or PDF, up to 5MB. Only our support team can open it.</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-gray-300 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <AlertCircle size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 disabled:bg-white/5 disabled:text-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-xl px-4 py-3 text-sm transition-colors"
        >
          <Send size={16} />
          {submitting ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </form>
  );
}
