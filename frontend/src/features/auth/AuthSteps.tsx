/** The form owns the step; this list only presents progress. */
export function AuthSteps({ label, steps, current }: {
  label: string;
  steps: readonly string[];
  current: number;
}) {
  return <ol className="auth-steps" aria-label={label}>
    {steps.map((step, index) => <li key={step} aria-current={index === current ? 'step' : undefined}>{index + 1} {step}</li>)}
  </ol>;
}
