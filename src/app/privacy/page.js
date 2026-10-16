export const metadata = {
  title: 'Privacy Policy — Bits & Bobs',
  description: 'How Bits & Bobs collects, uses, stores, and protects your data.',
};

export default function PrivacyPolicy() {
  return (
    <main className="h-dvh overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-16 text-foreground">
      <h1 className="text-2xl font-semibold mb-1">Privacy Policy for Bits & Bobs</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: October 16, 2026</p>

      <p className="mb-8">
        Bits &amp; Bobs (&quot;the app&quot;, &quot;we&quot;, &quot;our&quot;) is a note-taking app,
        available as an Android app and as a companion web app. Both share the same account and
        data, so this policy covers both. It explains what information is collected, how
        it&apos;s used, how it&apos;s protected, and how you can control or delete it.
      </p>

      <Section title="Information We Collect">
        <p>
          <strong>Account information.</strong> If you choose to sign in, we collect your email
          address: either the one you enter for magic-link email sign-in, or the one linked to
          your Google account. If you sign in with Google, Google also shares your name and
          profile picture with us, and they&apos;re stored with your account. We use your email
          to identify your account and to send you a magic-link sign-in email when you ask for
          one. We use your name and profile picture only to show who&apos;s signed in, for
          example in the account menu.
        </p>
        <p>
          <strong>Your notes.</strong> The content you write in the app. If you use the app
          without signing in (&quot;guest mode&quot;), your notes stay only on your device and are
          never sent to our servers. If you sign in, your notes are stored on our servers so they
          can sync across your devices and the Bits &amp; Bobs web app.
        </p>
        <p>
          <strong>We do not collect:</strong> location data, contacts, photos or files from your
          device, device identifiers
          for advertising, analytics/usage data, or any information beyond what&apos;s described
          above.
        </p>
      </Section>

      <Section title="How We Use Your Information">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Your email is used only for authentication and identifying which notes belong to your account.</li>
          <li>If you sign in with Google, your name and profile picture are used only to show who&apos;s signed in.</li>
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
          <li><strong>Supabase</strong> — hosts our database and handles authentication. Processes your account information (your email address, plus your name and profile picture if you sign in with Google) and your note content to provide storage, sync, and sign-in.</li>
          <li><strong>Google</strong> — if you sign in with Google, Google handles that sign-in under its own privacy policy and shares your email address, name, and profile picture with us. In the web app, your profile picture is loaded from Google&apos;s servers.</li>
          <li><strong>Link preview icons</strong> — when a note contains a web link, the app shows a small preview with that website&apos;s icon. To get the icon, the Android app asks the linked website directly, and the web app asks Google&apos;s favicon service. The request includes the website&apos;s domain name (for example, example.com) but never your note&apos;s content. Like any web request, it also shows your IP address to that website or to Google.</li>
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
          <li>
            <strong>Delete your account.</strong> You can permanently delete your account and all
            associated notes from within the Android app or the web app at{' '}
            <a href="https://bnb.mostlyuseful.in" className="underline">bnb.mostlyuseful.in</a>{' '}
            (Account menu → Delete Account) — no reinstall required. This removes your notes from
            our servers and cannot be undone.
          </li>
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
          <a href="mailto:support@mostlyuseful.in" className="underline">support@mostlyuseful.in</a>
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
