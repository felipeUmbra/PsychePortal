import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <button 
          onClick={() => navigate(-1)} 
          className="flex items-center gap-2 text-text-muted hover:text-text-main transition-colors mb-8 font-bold text-[14px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface rounded-3xl border border-border-custom p-10 shadow-sm"
        >
          <h1 className="text-3xl font-bold text-text-main mb-6">Terms of Service</h1>
          <div className="space-y-4 text-[14px] text-text-muted leading-relaxed">
            <p>
              Welcome to PsychePortal. This is a placeholder for the Terms of Service.
              By using our service, you agree to comply with our conditions. 
            </p>
            <p>
              Content will be updated pending legal review.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
