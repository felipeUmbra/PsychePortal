import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import MDEditor from '@uiw/react-md-editor';
import { Paperclip, X, Loader2 } from 'lucide-react';
import rehypeSanitize from 'rehype-sanitize';

interface SessionFormProps {
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  onUploadFile?: (file: File) => Promise<{ name: string; url: string; size: number }>;
  isUploading?: boolean;
  title: string;
  submitLabel: string;
}

export function SessionForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  onUploadFile, 
  isUploading = false,
  title,
  submitLabel
}: SessionFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    notes: '',
    type: 'individual',
    status: 'completed',
    attachments: [] as { name: string; url: string; size: number }[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        notes: initialData.notes || '',
        type: initialData.type || 'individual',
        status: initialData.status || 'completed',
        attachments: initialData.attachments || []
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadFile) return;

    try {
      const attachment = await onUploadFile(file);
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, attachment]
      }));
    } catch (error) {
      alert('Failed to upload file. ' + (error as Error).message);
    }
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card bg-white border border-border-custom"
    >
      <h3 className="text-[16px] font-bold text-text-main mb-6">{title}</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('patient_detail.session_type')}</label>
            <select 
              className="input-field text-[14px]"
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
            >
              <option value="individual">{t('patient_detail.types.individual')}</option>
              <option value="group">{t('patient_detail.types.group')}</option>
              <option value="family">{t('patient_detail.types.family')}</option>
              <option value="couple">{t('patient_detail.types.couple')}</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{t('common.status')}</label>
            <select 
              className="input-field text-[14px]"
              value={formData.status}
              onChange={(e) => setFormData({...formData, status: e.target.value})}
            >
              <option value="completed">{t('session_status.completed')}</option>
              <option value="no_show">{t('session_status.no_show')}</option>
              <option value="cancelled">{t('session_status.cancelled')}</option>
            </select>
          </div>
        </div>

        <div data-color-mode="light">
          <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
            {t('patient_detail.observations')}
          </label>
          <MDEditor
            value={formData.notes}
            onChange={(val) => setFormData({...formData, notes: val || ''})}
            preview="edit"
            height={300}
            className="border border-border-custom rounded-xl overflow-hidden"
            previewOptions={{
              rehypePlugins: [[rehypeSanitize]],
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Attachments (Max 40MB)</label>
          <div className="flex flex-wrap gap-3 mb-3">
            {formData.attachments.map((att, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border-custom rounded-lg text-[12px]">
                <Paperclip className="w-3.5 h-3.5 text-text-muted" />
                <span className="font-medium text-text-main truncate max-w-[150px]">{att.name}</span>
                <button 
                  type="button" 
                  onClick={() => removeAttachment(idx)}
                  className="ml-1 text-text-muted hover:text-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          {onUploadFile && (
            <div className="flex items-center gap-3">
              <label className="btn-secondary cursor-pointer flex items-center gap-2">
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                {isUploading ? 'Uploading...' : 'Add File'}
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileUpload}
                  disabled={isUploading || isSubmitting}
                />
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button 
            type="button"
            onClick={onCancel}
            className="btn-secondary text-[13px]"
            disabled={isUploading || isSubmitting}
          >
            {t('common.cancel')}
          </button>
          <button 
            type="submit" 
            className="btn-primary text-[13px] flex items-center justify-center gap-2" 
            disabled={isUploading || isSubmitting}
          >
            {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
