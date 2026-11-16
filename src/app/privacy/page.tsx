import type { Metadata } from "next";
import { ProsePage, PublicShell } from "@/components/public-shell";
import { Notice } from "@/components/ui";
import { getI18n } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Privacy notice" };

// Prose pages keep one full text per language (easier to review than hundreds of dictionary keys).
export default async function PrivacyPage() {
  const { locale } = await getI18n();
  return <PublicShell>{locale === "fil" ? <Filipino /> : <English />}</PublicShell>;
}

function English() {
  return (
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
        <p>Only a random code. It has no name, address or other personal details. Someone who scans it sees nothing about you.</p>
      </section>
      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To give your household the right points and show you your history.</li>
          <li>To let the barangay manage households, rewards and collectors.</li>
          <li>To produce totals and trends for the whole barangay, without naming households.</li>
          <li>To email you a link to reset your password, only when you ask for one. We don’t send other email.</li>
        </ul>
      </section>
      <section>
        <h2>Who can see it</h2>
        <p>
          You and the family members in your household see your household’s information and points. Collectors see only what
          they need to record a collection. Barangay admins can see household records to run the program. We don’t sell your
          information.
        </p>
      </section>
      <section>
        <h2>What’s kept on collectors’ phones</h2>
        <p>
          So collections can be recorded where there’s no signal, a collector’s phone keeps a short list of households: the
          household number, household name and purok, plus a scrambled fingerprint of each QR code (not the code itself). It
          never includes addresses, residents’ names or contact details. The list is deleted when the collector logs out, and
          automatically if it hasn’t been updated for 7 days. Collections recorded offline stay on the phone only until they’re
          sent.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          You can ask your barangay office to correct your details or close your account. This follows the Data Privacy Act of
          2012 (Republic Act No. 10173).
        </p>
      </section>
    </ProsePage>
  );
}

function Filipino() {
  return (
    <ProsePage title="Privacy notice" updated="Draft para sa pilot ng barangay">
      <Notice>Isa itong draft sa simpleng salita. Kukumpirmahin ng barangay ang huling bersyon bago magsimula ang programa.</Notice>
      <section>
        <h2>Ano ang kinokolekta namin</h2>
        <ul>
          <li>Ang pangalan mo, at ang email address o mobile number na ginamit mo sa pag-sign up.</li>
          <li>
            Ang pangalan, address at purok ng household mo, na ikaw ang naglagay nang i-register mo ang household (o ang
            barangay). Sinusuri ito ng barangay bago mabilang ang mga koleksyon mo.
          </li>
          <li>Kung aling mga account ang kasama sa household mo (hanggang limang kapamilya ang puwedeng sumali gamit ang sign-up code).</li>
          <li>Sa bawat koleksyon: ang petsa at oras, kung sinong kolektor ang nagtala, at kung tama ang paghihiwalay sa bawat lalagyan.</li>
          <li>Ang points mo at ang mga reward na hiniling mo.</li>
        </ul>
      </section>
      <section>
        <h2>Ano ang laman ng QR code mo</h2>
        <p>Isang random na code lang. Walang pangalan, address o iba pang personal na detalye. Walang makikita tungkol sa iyo ang sinumang mag-scan nito.</p>
      </section>
      <section>
        <h2>Paano namin ito ginagamit</h2>
        <ul>
          <li>Para maibigay ang tamang points sa household mo at maipakita ang kasaysayan mo.</li>
          <li>Para mapamahalaan ng barangay ang mga household, rewards at kolektor.</li>
          <li>Para makagawa ng kabuuan at trends para sa buong barangay, nang hindi pinapangalanan ang mga household.</li>
          <li>Para padalhan ka ng link sa email para i-reset ang password mo, kapag ikaw lang ang humiling. Wala kaming ibang ipapadalang email.</li>
        </ul>
      </section>
      <section>
        <h2>Sino ang nakakakita nito</h2>
        <p>
          Ikaw at ang mga kapamilya sa household mo ang nakakakita ng impormasyon at points ng household. Ang nakikita lang ng
          mga kolektor ay ang kailangan para maitala ang koleksyon. Nakikita ng mga admin ng barangay ang mga record ng household
          para mapatakbo ang programa. Hindi namin ibinebenta ang impormasyon mo.
        </p>
      </section>
      <section>
        <h2>Ano ang naka-save sa phone ng mga kolektor</h2>
        <p>
          Para maitala ang koleksyon kahit walang signal, may maikling listahan ng mga household sa phone ng kolektor: ang
          household number, pangalan ng household at purok, at isang ginulong “fingerprint” ng bawat QR code (hindi ang code
          mismo). Hindi kasama ang address, pangalan ng residente o contact details. Nabubura ang listahan kapag nag-log out ang
          kolektor, at kusa kung hindi ito na-update nang 7 araw. Nasa phone lang ang mga koleksyong naitala offline hanggang
          maipadala ang mga ito.
        </p>
      </section>
      <section>
        <h2>Ang mga karapatan mo</h2>
        <p>
          Puwede mong hilingin sa barangay na itama ang detalye mo o isara ang account mo. Alinsunod ito sa Data Privacy Act of
          2012 (Republic Act No. 10173).
        </p>
      </section>
    </ProsePage>
  );
}
