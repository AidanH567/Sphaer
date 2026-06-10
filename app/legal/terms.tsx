import React from 'react';
import { LegalScreen } from '@/components/legal/LegalScreen';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function TermsScreen() {
  return (
    <LegalScreen
      title="Terms of Service"
      lastUpdated="2026-06-09"
      intro="By creating an account or otherwise using Sphaer, you agree to these Terms of Service. Please read them carefully. If you do not agree, please do not use the app."
      sections={[
        {
          heading: '1. Eligibility',
          body: 'You must be at least 16 years old to use Sphaer. By signing up you confirm that you meet this requirement and that the information you provide is accurate.',
        },
        {
          heading: '2. Your account',
          body: [
            'You are responsible for keeping your password (or OAuth identity) secure. You may not share your account with anyone else or use it for an automated agent.',
            'You can delete your account at any time from the profile screen — this irreversibly removes your profile, events, messages, follows, circle memberships, saved items, and uploaded images.',
          ],
        },
        {
          heading: '3. Content you post',
          body: [
            'You retain ownership of everything you post on Sphaer — your events, profile content, posters, messages, and any other material.',
            'By posting content you grant Sphaer a worldwide, non-exclusive, royalty-free licence to display, distribute, and host that content for the purpose of operating the service. This licence ends when you delete the content or your account.',
            'You may not post content that:',
            {
              bullets: [
                'Infringes the rights of others (copyright, trademark, privacy, publicity).',
                'Is illegal, defamatory, harassing, hateful, or threatens violence.',
                'Promotes a commercial product or service outside the spirit of the Berlin creative scene (community-first — no spam, no engagement-driven ranking, no paid promotion).',
                'Contains malware, phishing, or anything designed to disrupt the service.',
              ],
            },
          ],
        },
        {
          heading: '4. Acceptable use',
          body: [
            'Sphaer exists for Berlin artists, communities, and audiences. Use the service in good faith. Do not:',
            {
              bullets: [
                'Scrape, crawl, or automate access to the platform.',
                'Reverse-engineer, decompile, or attempt to extract source code.',
                'Misrepresent your identity or impersonate another person, artist, venue, or circle.',
                'Use Sphaer to harvest contact information for unsolicited outreach.',
              ],
            },
          ],
        },
        {
          heading: '5. Events and tickets',
          body: 'Sphaer surfaces events posted by users and circles. We do not verify event accuracy, host events ourselves, or guarantee attendance, performance, or refunds. When you tap a ticket link, you are interacting with the event organiser or a third-party ticketing platform directly.',
        },
        {
          heading: '6. Termination',
          body: 'We may suspend or terminate your account if you violate these Terms or post content that puts other users at risk. You will receive notice and an opportunity to respond, except where immediate action is required to protect others.',
        },
        {
          heading: '7. Disclaimer of warranties',
          body: 'Sphaer is provided "as is" without warranties of any kind, express or implied. We do not warrant that the service will be uninterrupted, error-free, or secure against unauthorised access.',
        },
        {
          heading: '8. Limitation of liability',
          body: 'To the maximum extent permitted by law, Sphaer is not liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service. Our total liability for any claim is limited to the amount you have paid us in the previous 12 months (which, for the free tier, is zero).',
        },
        {
          heading: '9. Changes to these Terms',
          body: 'We may revise these Terms over time. Material changes will be announced inside the app. The "Last updated" date at the top reflects the most recent revision. Continued use of Sphaer after a revision constitutes acceptance.',
        },
        {
          heading: '10. Governing law',
          body: 'These Terms are governed by the laws of Germany. Disputes that cannot be resolved informally will be brought before the courts of Berlin.',
        },
        {
          heading: '11. Contact',
          body: 'Questions about these Terms: hello@sphaer.app.',
        },
      ]}
    />
  );
}

export const ErrorBoundary = makeRouteErrorBoundary('legal-terms');
