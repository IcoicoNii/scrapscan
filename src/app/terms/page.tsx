import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage, PublicShell } from "@/components/public-shell";
import { Notice } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Terms of use" };

// Prose pages keep one full text per language (easier to review than hundreds of dictionary keys).
export default async function TermsPage() {
  const { locale } = await getI18n();
  return <PublicShell>{locale === "fil" ? <Filipino /> : <English />}</PublicShell>;
}

const privacyLink = "font-semibold underline underline-offset-4";

function English() {
  return (
    <ProsePage title="Terms of use" updated="Draft for the barangay pilot">
      <Notice>This is a plain-language draft. The barangay will confirm the final wording before the program launches.</Notice>
      <section>
        <h2>What ScrapScan is</h2>
        <p>
          ScrapScan is a pilot program run by the barangay to encourage proper waste segregation. Households earn points when
          their waste is sorted correctly at collection, and can exchange those points for rewards the barangay offers.
        </p>
      </section>
      <section>
        <h2>Your account</h2>
        <ul>
          <li>Register only your own household, with its real name and address. The barangay checks new households before they earn points.</li>
          <li>To join your family’s household, use the sign-up code from a family member or the barangay. Share that code only with your household.</li>
          <li>Keep your password private. You are responsible for activity on your account.</li>
          <li>The barangay may deactivate accounts or households that are misused, duplicated or no longer needed.</li>
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
          Your household QR code only identifies your household for collection. Don’t share or copy it for another household. If
          it is lost or misused, ask your barangay admin to issue a new one.
        </p>
      </section>
      <section>
        <h2>Questions</h2>
        <p>
          Contact your barangay office. See also our <Link href="/privacy" className={privacyLink}>privacy notice</Link>.
        </p>
      </section>
    </ProsePage>
  );
}

function Filipino() {
  return (
    <ProsePage title="Mga tuntunin ng paggamit" updated="Draft para sa pilot ng barangay">
      <Notice>Isa itong draft sa simpleng salita. Kukumpirmahin ng barangay ang huling bersyon bago magsimula ang programa.</Notice>
      <section>
        <h2>Ano ang ScrapScan</h2>
        <p>
          Ang ScrapScan ay isang pilot na programa ng barangay para hikayatin ang tamang paghihiwalay ng basura. Nagkakaroon ng
          points ang mga household kapag tama ang paghihiwalay sa koleksyon, at puwede itong ipalit sa rewards ng barangay.
        </p>
      </section>
      <section>
        <h2>Ang account mo</h2>
        <ul>
          <li>Sariling household lang ang i-register, gamit ang tunay na pangalan at address. Sinusuri ng barangay ang mga bagong household bago sila magkaroon ng points.</li>
          <li>Para sumali sa household ng pamilya mo, gamitin ang sign-up code mula sa kapamilya o sa barangay. Sa household mo lang ibahagi ang code na iyon.</li>
          <li>Panatilihing pribado ang password mo. Ikaw ang may pananagutan sa mga gawain sa account mo.</li>
          <li>Puwedeng i-off ng barangay ang mga account o household na ginagamit sa mali, doble, o hindi na kailangan.</li>
        </ul>
      </section>
      <section>
        <h2>Points at rewards</h2>
        <ul>
          <li>Ang sistema ang nagbibigay ng points batay sa itinala ng kolektor sa bawat lalagyan. Walang katumbas na pera ang points.</li>
          <li>Puwedeng itama ng barangay ang points na naibigay nang mali. Nakatala ang bawat pagtatama, hindi itinatago.</li>
          <li>Ang barangay ang nagtatakda ng rewards, ng halaga nito sa points at kung available ito, at puwede itong magbago.</li>
        </ul>
      </section>
      <section>
        <h2>Ang QR code mo</h2>
        <p>
          Ang QR code ng household mo ay para lang makilala ang household mo sa koleksyon. Huwag itong ibahagi o kopyahin para sa
          ibang household. Kapag nawala o ginamit sa mali, humingi ng bago sa admin ng barangay.
        </p>
      </section>
      <section>
        <h2>Mga tanong</h2>
        <p>
          Makipag-ugnayan sa barangay. Tingnan din ang aming <Link href="/privacy" className={privacyLink}>privacy notice</Link>.
        </p>
      </section>
    </ProsePage>
  );
}
