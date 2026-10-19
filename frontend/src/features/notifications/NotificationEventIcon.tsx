/** Approved stroke illustrations; the adjacent event label carries meaning. */
export function NotificationEventIcon({ eventType }: { eventType: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <EventShape eventType={eventType} />
    </svg>
  );
}

function EventShape({ eventType }: { eventType: string }) {
  switch (eventType) {
    case 'REVISION_REQUIRED':
      return <path d="m15 4 5 5M4 20l4-1L21 6l-4-4L4 15Z" />;
    case 'ASSIGNMENT_DEADLINE_24H':
    case 'ASSIGNMENT_DEADLINE_4H':
      return <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>;
    case 'SUBMISSION_APPROVED':
      return <path d="m5 12 4 4L19 6" />;
    case 'REWARD_REDEMPTION_APPROVED':
    case 'REWARD_REDEMPTION_REJECTED':
      return <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v9h14v-9M12 8v13M12 8C5 8 5 2 8 3s4 5 4 5Zm0 0c7 0 7-6 4-5s-4 5-4 5Z" /></>;
    case 'ACCOUNT_SECURITY':
      return <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>;
    case 'SUBMISSION_VALIDATION_FAILED':
      return <><path d="m12 3 10 18H2Z M12 9v5" /><circle cx="12" cy="17" r=".5" /></>;
    default:
      return <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10 19h4" /></>;
  }
}
