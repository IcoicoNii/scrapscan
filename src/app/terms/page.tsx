import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, PublicShell } from "@/components/public-shell";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <PublicShell>
      <ProsePage title="Terms of use" updated="Draft for the barangay pilot">
        <Notice>This is a plain-language draft. The barangay will confirm the final wording before the program launches.</Notice>
        <section>
          <h2>What ScrapScan is</h2>
          <p>
            ScrapScan is a pilot program run by the barangay to encourage proper waste segregation. Households earn points
            when their waste is sorted correctly at collection, and can exchange those points for rewards the barangay offers.
          </p>
        </section>
        <section>
          <h2>Your account</h2>
          <ul>
            <li>Sign up only with the household code your barangay gave you, for your own household.</li>
            <li>Keep your password private. You are responsible for activity on your account.</li>
            <li>The barangay may deactivate accounts that are misused or no longer needed.</li>
          </ul>
        </section>
        <section>
          <h2>Points and rewards</h2>
          <ul>
            <li>Points are given by the system based on what the collector records for each bin. They have no cash value.</li>
            <li>The barangay may correct points that were given by mistake. Corrections are recorded, never hidden.</li>
            <li>Rewards, their point costs and availability are set by the barangay and can change.</li>
          </ul>
        </section>
        <section>
          <h2>Your QR code</h2>
          <p>
            Your household QR code only identifies your household for collection. Don’t share or copy it for another household.
            If it is lost or misused, ask your barangay admin to issue a new one.
          </p>
        </section>
        <section>
          <h2>Questions</h2>
          <p>
            Contact your barangay office. See also our <Link href="/privacy" className="font-semibold underline underline-offset-4">privacy notice</Link>.
          </p>
        </section>
      </ProsePage>
    </PublicShell>
  );
}
