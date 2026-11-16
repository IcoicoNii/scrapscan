import type { Metadata } from "next";
import { ProsePage, PublicShell } from "@/components/public-shell";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <PublicShell>
      <ProsePage title="Privacy notice" updated="Draft for the barangay pilot">
        <Notice>This is a plain-language draft. The barangay will confirm the final wording before the program launches.</Notice>
        <section>
          <h2>What we collect</h2>
          <ul>
            <li>Your name, and the email address or mobile number you sign up with.</li>
            <li>
              Your household’s name, address and purok, entered by you when you register your household (or by the barangay
              office). The barangay office checks them before your collections count.
            </li>
            <li>Which accounts belong to your household (up to five family members can join with its sign-up code).</li>
            <li>For each collection: the date and time, which collector recorded it, and whether each bin was sorted correctly.</li>
            <li>Your points and any rewards you request.</li>
          </ul>
        </section>
        <section>
          <h2>What your QR code contains</h2>
          <p>
            Only a random code. It has no name, address or other personal details. Someone who scans it sees nothing about you.
          </p>
        </section>
        <section>
          <h2>How we use it</h2>
          <ul>
            <li>To give your household the right points and show you your history.</li>
            <li>To let the barangay manage households, rewards and collectors.</li>
            <li>To produce totals and trends for the whole barangay, without naming households.</li>
          </ul>
        </section>
        <section>
          <h2>Who can see it</h2>
          <p>
            You and the family members in your household see your household’s information and points. Collectors see only what
            they need to record a collection. Barangay
            admins can see household records to run the program. We don’t sell your information.
          </p>
        </section>
        <section>
          <h2>What’s kept on collectors’ phones</h2>
          <p>
            So collections can be recorded where there’s no signal, a collector’s phone keeps a short list of households:
            the household number, household name and purok, plus a scrambled fingerprint of each QR code (not the code
            itself). It never includes addresses, residents’ names or contact details. The list is deleted when the
            collector logs out, and automatically if it hasn’t been updated for 7 days. Collections recorded offline stay
            on the phone only until they’re sent.
          </p>
        </section>
        <section>
          <h2>Your choices</h2>
          <p>
            You can ask your barangay office to correct your details or close your account. This follows the Data Privacy
            Act of 2012 (Republic Act No. 10173).
          </p>
        </section>
      </ProsePage>
    </PublicShell>
  );
}
