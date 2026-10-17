"use client";

import {
  savePendingCall,
  showPostCallNotification,
} from "@/lib/crm/call-tracking";

/**
 * Drop-in replacement for <a href="tel:...">. Behaves exactly like a normal
 * call link, but first remembers which lead was called so the post-call
 * popup can open when the user returns to the app.
 */
export function CallLink({
  leadId,
  name,
  phone,
  className,
  children,
}: {
  leadId: string;
  name: string;
  phone: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={"tel:" + phone}
      className={className}
      onClick={() => {
        const call = {
          leadId,
          name,
          phone,
          startedAt: Date.now(),
          left: false,
        };
        savePendingCall(call);
        void showPostCallNotification(call);
      }}
    >
      {children}
    </a>
  );
}
