import React from 'react';
import { LegalScreen } from '@/components/legal/LegalScreen';
import { makeRouteErrorBoundary } from '@/components/ui/ErrorBoundary';

export default function PrivacyPolicyScreen() {
  return (
    <LegalScreen
      title="Privacy Policy"
      lastUpdated="2026-06-09"
      intro="Sphaer is a community-first platform for Berlin's creative scene. This Privacy Policy explains what we collect, how we use it, and the choices you have. We are committed to collecting only what we need to make the app work — no ad networks, no behavioural profiling, no selling your data."
      sections={[
        {
          heading: '1. Information we collect',
          body: [
            'When you create an account we collect:',
            {
              bullets: [
                'Email address and a password (or an OAuth identity from Google / Apple if you sign in that way).',
                'A display name, optional profile photo, tagline, About text, disciplines, and location (Berlin neighbourhood) — all provided by you during onboarding or editing your profile.',
                'Content you create: events, circles, posts, messages, saved items, and uploaded images.',
              ],
            },
            'When you use the app we may also collect:',
            {
              bullets: [
                'Your approximate device location (only if you enable the "Near me" filter). Coordinates are kept in memory; we never write your location to the server.',
                'Device-level diagnostics from the operating system if you opt into crash reporting (planned feature).',
              ],
            },
          ],
        },
        {
          heading: '2. How we use your information',
          body: [
            'We use the information you provide solely to:',
            {
              bullets: [
                'Authenticate you and keep your session secure.',
                'Render your profile, events, and messages to other Sphaer users you connect with.',
                'Send you notifications about activity on your account (new messages, follows, saved-event reminders) when you grant permission.',
                'Improve the product by reviewing aggregate, anonymised usage patterns.',
              ],
            },
            'We never sell your data, never share it with advertisers, and never use it to build behavioural advertising profiles.',
          ],
        },
        {
          heading: '3. Where your data lives',
          body: 'Your data is stored on Supabase, an open-source backend platform. Supabase hosts data in EU regions when possible. Profile images, event posters, and uploaded media are stored in Supabase Storage with public-read URLs for content you choose to share publicly.',
        },
        {
          heading: '4. Your rights',
          body: [
            'You have the right to:',
            {
              bullets: [
                'Access your data — visible at any time from your profile screen.',
                'Edit or update your data — from Edit Profile.',
                'Delete your account — tap Delete Account on your profile. We cascade-delete every row associated with you (events, messages, follows, circle memberships) within the same request.',
                'Export your data — email us at privacy@sphaer.app and we will return a JSON copy within 30 days.',
              ],
            },
            'These rights are enforceable under the GDPR for users in the EU/EEA and the equivalent statutes in other jurisdictions.',
          ],
        },
        {
          heading: '5. Cookies and tracking',
          body: 'Sphaer does not use tracking cookies or third-party analytics. The web app uses a single local-storage entry to persist your sign-in session. Mobile builds use the device keychain via expo-secure-store for the same purpose.',
        },
        {
          heading: '6. Children',
          body: 'Sphaer is intended for users aged 16 and older. We do not knowingly collect data from anyone under 16. If you believe we have inadvertently collected such data, please contact us and we will delete it.',
        },
        {
          heading: '7. Changes to this policy',
          body: 'We may update this policy as the product evolves. Material changes will be announced inside the app. The "Last updated" date at the top reflects the most recent revision.',
        },
        {
          heading: '8. Contact',
          body: 'Questions, requests, or concerns: privacy@sphaer.app. We aim to respond within 7 working days.',
        },
      ]}
    />
  );
}

export const ErrorBoundary = makeRouteErrorBoundary('legal-privacy');
