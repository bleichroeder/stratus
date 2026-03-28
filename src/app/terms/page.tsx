import { LogoFull } from "@/components/ui/logo";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service – stratus",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-stone-950">
      <article className="max-w-3xl mx-auto px-4 py-12 md:px-8 md:py-16">
        <header className="mb-8">
          <Link href="/">
            <LogoFull size={28} />
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-stone-900 dark:text-stone-100 mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-stone-400 dark:text-stone-500">
            Last updated March 28, 2026
          </p>
        </header>

        <div className="space-y-6 text-stone-700 dark:text-stone-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using stratus, you agree to be bound by these Terms of Service. If you
              do not agree to these terms, please do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              2. Description of Service
            </h2>
            <p>
              stratus is a developer-focused note-taking tool that provides features including
              real-time collaboration, end-to-end encryption, and calendar integration. We reserve the
              right to modify, suspend, or discontinue any part of the service at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              3. User Accounts
            </h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and
              for all activity that occurs under your account. You agree to notify us immediately of
              any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              4. User Content
            </h2>
            <p>
              You retain ownership of all content you create using stratus. By using the service, you
              grant us a limited license to store, process, and transmit your content solely for the
              purpose of providing the service to you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              5. Acceptable Use
            </h2>
            <p>
              You agree not to use stratus to: violate any applicable laws or regulations; infringe
              upon the rights of others; transmit malicious code or attempt to interfere with the
              service; or use the service for any purpose that is unlawful or prohibited by these
              terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              6. Intellectual Property
            </h2>
            <p>
              The stratus name, logo, and all related trademarks, service marks, and trade names are
              the property of stratus. The service and its original content, features, and
              functionality are owned by stratus and are protected by copyright, trademark, and other
              intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              7. Termination
            </h2>
            <p>
              We may terminate or suspend your access to the service at any time, without prior notice
              or liability, for any reason, including if you breach these terms. Upon termination, your
              right to use the service will immediately cease.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              8. Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by law, stratus shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, or any loss of profits or
              revenue, whether incurred directly or indirectly, or any loss of data, use, goodwill, or
              other intangible losses resulting from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              9. Changes to Terms
            </h2>
            <p>
              We reserve the right to modify these terms at any time. We will notify users of any
              material changes by posting the updated terms on this page. Your continued use of the
              service after changes are posted constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
              10. Contact
            </h2>
            <p>
              If you have any questions about these terms, please contact us through the application.
            </p>
          </section>
        </div>
      </article>

      <footer className="border-t border-stone-200 dark:border-stone-800 py-6 text-center">
        <p className="text-xs text-stone-400 dark:text-stone-500">
          <Link href="/policy" className="hover:underline">
            Privacy Policy
          </Link>
          {" · "}
          <span className="font-mono font-semibold">stratus</span>
        </p>
      </footer>
    </div>
  );
}
