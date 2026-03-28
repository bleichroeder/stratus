import { LogoFull } from "@/components/ui/logo";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy – stratus",
};

export default function PolicyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-stone-950">
      <article className="max-w-3xl mx-auto px-4 py-12 md:px-8 md:py-16">
        <header className="mb-8">
          <Link href="/">
            <LogoFull size={28} />
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-stone-900 dark:text-stone-100 mb-2">
            Privacy Policy
          </h1>
          <p className="text-sm text-stone-400 dark:text-stone-500">
            Last updated March 28, 2026
          </p>
        </header>

        <div className="space-y-6 text-stone-700 dark:text-stone-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              1. Information We Collect
            </h2>
            <p>
              We collect information you provide directly when you create an account, including your
              email address and authentication credentials. When you use stratus, we collect the
              content you create and store within the application.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              2. How We Use Your Information
            </h2>
            <p>
              We use the information we collect to: provide, maintain, and improve the service;
              authenticate your identity and manage your account; enable real-time collaboration
              features; and communicate with you about the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              3. End-to-End Encryption
            </h2>
            <p>
              stratus supports end-to-end encryption for your notes. When encryption is enabled, your
              content is encrypted on your device before being transmitted to our servers. We do not
              have access to the encryption keys and cannot read encrypted content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              4. Data Storage
            </h2>
            <p>
              Your data is stored securely using industry-standard infrastructure. We implement
              appropriate technical and organizational measures to protect your personal information
              against unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              5. Third-Party Services
            </h2>
            <p>
              stratus integrates with third-party services such as Google for authentication and
              calendar access. When you connect these services, their respective privacy policies
              apply. We only access the minimum data necessary to provide the requested functionality.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              6. Data Sharing
            </h2>
            <p>
              We do not sell your personal information. We may share your information only in the
              following circumstances: with your consent; to comply with legal obligations; to protect
              our rights and safety; or with service providers who assist in operating the service,
              subject to confidentiality obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              7. Cookies and Analytics
            </h2>
            <p>
              We use essential cookies to maintain your session and preferences. We may use analytics
              to understand how the service is used and to improve it. We do not use cookies for
              advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              8. Your Rights
            </h2>
            <p>
              You have the right to: access the personal data we hold about you; request correction of
              inaccurate data; request deletion of your data; export your data; and withdraw consent
              for optional data processing at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              9. Data Retention
            </h2>
            <p>
              We retain your data for as long as your account is active or as needed to provide the
              service. If you delete your account, we will delete your personal data within 30 days,
              except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this privacy policy from time to time. We will notify you of material
              changes by posting the updated policy on this page. Your continued use of the service
              after changes are posted constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              11. Contact
            </h2>
            <p>
              If you have any questions about this privacy policy or our data practices, please
              contact us through the application.
            </p>
          </section>
        </div>
      </article>

      <footer className="border-t border-stone-200 dark:border-stone-800 py-6 text-center">
        <p className="text-xs text-stone-400 dark:text-stone-500">
          <Link href="/terms" className="hover:underline">
            Terms of Service
          </Link>
          {" · "}
          <span className="font-mono font-semibold">stratus</span>
        </p>
      </footer>
    </div>
  );
}
