/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { isTokenExpiringSoon, getTokenTimeRemaining } from "../lib/token-expiration";

export function TokenExpirationToast() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const checkExpiration = () => {
            if (isTokenExpiringSoon()) {
                setVisible(true);
            }
        };

        checkExpiration();
        const interval = setInterval(checkExpiration, 60000);

        return () => clearInterval(interval);
    }, []);

    if (!visible) return null;

    const timeRemaining = getTokenTimeRemaining();
    const minutesRemaining = Math.ceil(timeRemaining / 60000);
    const timeText = minutesRemaining === 1 ? "minute" : "minutes";

    return (
        <div className="fixed top-4 right-4 z-50 bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-4 max-w-sm">
            <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                    <h4 className="font-medium text-amber-800">Session Expiring Soon</h4>
                    <p className="text-sm text-amber-700 mt-1">
                        Your session will expire in approximately {minutesRemaining} {timeText}. Please save your work to avoid data loss.
                    </p>
                </div>
            </div>
        </div>
    );


}