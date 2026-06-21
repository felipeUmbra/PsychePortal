/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Lock, X } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SessionTimeoutToast() {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handleSessionTimeout = () => {
            setVisible(true);
        };
        window.addEventListener('session-timeout', handleSessionTimeout);
        return () => {
            window.removeEventListener('session-timeout', handleSessionTimeout);
        };
    }, []);

    if (!visible) return null;

    return (
        <div className="fixed top-4 right-4 z-[100] bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-4 max-w-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                    <Lock className="w-4 h-4" />
                </div>
                <div className="flex-1">
                    <h4 className="font-medium text-amber-800 text-[13px]">{t('settings.session_timeout_toast_title')}</h4>
                    <p className="text-[12px] text-amber-700 mt-1">
                        {t('settings.session_timeout_toast_message')}
                    </p>
                </div>
                <button
                    onClick={() => setVisible(false)}
                    className="p-1 hover:bg-amber-100 rounded-lg text-amber-600 shrink-0"
                    aria-label={t('common.close', 'Close')}
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
