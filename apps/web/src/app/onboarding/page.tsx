import { Suspense } from "react";
import { OnboardingWizard } from "./onboarding-wizard";

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingWizard />
    </Suspense>
  );
}

function OnboardingFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <p className="text-sm font-medium text-slate-500">Preparando sua configuracao...</p>
    </main>
  );
}
