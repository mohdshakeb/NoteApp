export const metadata = {
  title: 'Privacy Policy — Bits & Bobs',
  description: 'How Bits & Bobs collects, uses, stores, and protects your data.',
};

export default function PrivacyPolicy() {
  return (
    <main className="h-dvh overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-16 text-foreground">
      <h1 className="text-2xl font-semibold mb-1">Privacy Policy for Bits & Bobs</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: September 15, 2026</p>

      <p className="mb-8">
        Bits &amp; Bobs (&quot;the app&quot;, &quot;we&quot;, &quot;our&quot;) is a note-taking app,
        available as an Android app and as a companion web app. Both share the same account and
        data, so this policy covers both. It explains what information is collected, how
        it&apos;s used, how it&apos;s protected, and how you can control or delete it.
      </p>

      <Section title="Information We Collect">
        <p>
          <strong>Account information.</strong> If you choose to sign in, we collect the email
          address associated with your Google account (via Google Sign-In) or the email address
          you provide directly (via magic-link email sign-in). We use this solely to identify
          your account and to send you the magic-link sign-in email when you request one.
        </p>
        <p>
          <strong>Your notes.</strong> The content you write in the app. If you use the app
          without signing in (&quot;guest mode&quot;), your notes stay only on your device and are
          never sent to our servers. If you sign in, your notes are stored on our servers so they
          can sync across your devices and the Bits &amp; Bobs web app.
        </p>
        <p>
          <strong>We do not collect:</strong> location data, contacts, photos, device identifiers
          for advertising, analytics/usage data, or any information beyond what&apos;s described
          above.
        </p>
      </Section>

      <Section title="How We Use Your Information">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Your email is used only for authentication and identifying which notes belong to your account.</li>
          <li>Your notes are stored and synced so you can access them across devices when signed in.</li>
          <li>We do not sell, rent, or share your information with third parties for advertising or marketing purposes.</li>
          <li>We do not use your data to train any AI/ML models.</li>
        </ul>
      </Section>

      <Section title="Data Storage & Security">
        <p>
          Account and note data is stored using Supabase (a hosted Postgres database provider),
          shared by this app and the Bits &amp; Bobs Android app. Local, on-device storage is
          used to cache your notes for offline access and, in guest mode, as the only copy of
          your notes.
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>In transit:</strong> encrypted via HTTPS/TLS between the app and our servers.</li>
          <li><strong>At rest:</strong> encrypted at the infrastructure level by our hosting provider.</li>
          <li>
            <strong>Not end-to-end encrypted:</strong> your note content is not encrypted in a way
            that hides it from us. It is stored in a form that our infrastructure provider
            (Supabase) and authorized administrators of this project could technically access. We
            do not read, review, or use your note content for any purpose other than providing
            the app&apos;s storage and sync functionality.
          </li>
          <li>
            <strong>Other users can&apos;t access your notes.</strong> Database-level access
            controls (Row Level Security) restrict every request to the signed-in user making it,
            so other people using the app or website cannot read or modify your notes.
          </li>
          <li>
            <strong>If something goes wrong.</strong> If we become aware of a security incident
            affecting your data, we will take reasonable steps to address it and notify affected
            users as required by applicable law.
          </li>
        </ul>
      </Section>

      <Section title="Third-Party Service Providers">
        <p>
          We use a small number of service providers to operate the app. We do not sell or share
          your data with anyone beyond what&apos;s needed for them to provide these services:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Supabase</strong> — hosts our database and handles authentication. Processes your email address and note content to provide storage, sync, and sign-in.</li>
          <li><strong>Google</strong> — if you sign in with Google, Google processes that sign-in under its own privacy policy; we only receive your email address from that flow.</li>
        </ul>
      </Section>

      <Section title="Data Retention">
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Signed-in accounts:</strong> your notes and account information are retained until you delete an individual note, delete your account, or request deletion. Deleting your account removes your notes from our servers immediately and cannot be undone.</li>
          <li><strong>Guest mode:</strong> your notes exist only on your device and are retained for as long as you keep the app installed and don&apos;t delete them yourself. We never receive a copy.</li>
        </ul>
      </Section>

      <Section title="Your Rights and Choices">
        <ul className="list-disc pl-5 space-y-1.5">
          <li><strong>Guest mode.</strong> You can use the app fully without creating an account or providing any personal information. Guest notes never leave your device.</li>
          <li><strong>Access and correct your notes.</strong> Your notes are always visible and editable directly in the app.</li>
          <li><strong>Sign out.</strong> You can sign out at any time from within the app.</li>
          <li><strong>Delete individual notes.</strong> Long-press any note to delete it.</li>
          <li><strong>Delete your account.</strong> You can permanently delete your account and all associated notes from within the app (Account menu → Delete Account). This removes your notes from our servers and cannot be undone.</li>
          <li><strong>Request a copy of your data.</strong> The app doesn&apos;t currently have a self-serve export/download button. If you&apos;d like a copy of your account data, email us at the address below and we&apos;ll provide it.</li>
        </ul>
      </Section>

      <Section title="Children's Privacy">
        <p>
          Bits &amp; Bobs is not directed at children under 13, and we do not knowingly collect
          personal information from children under 13.
        </p>
      </Section>

      <Section title="Changes to This Policy">
        <p>
          We may update this policy from time to time. Material changes will be reflected by
          updating the &quot;Last updated&quot; date above.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          For privacy questions, data requests, or anything else related to this policy:{' '}
          <a href="mailto:reachshakeb@gmail.com" className="underline">reachshakeb@gmail.com</a>
        </p>
      </Section>
      </div>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}
