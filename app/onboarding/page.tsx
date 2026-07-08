import { redirect } from 'next/navigation';

/** Legacy route — platform connections live in Settings. */
export default function OnboardingPage() {
  redirect('/settings?welcome=1');
}