import type { HouseholdStatus } from "@prisma/client";
import { Notice } from "./ui";

// What a resident sees about their household's status. Nothing while it's active.
export function HouseholdStatusNotice({ status, statusNote }: { status: HouseholdStatus; statusNote: string | null }) {
  if (status === "ACTIVE") return null;
  if (status === "PENDING") {
    return (
      <Notice>
        <strong className="font-bold">Waiting for barangay approval.</strong> The barangay office checks new households before
        collections count. You can print your QR code and put it on your bins now.
      </Notice>
    );
  }
  return (
    <Notice tone="warn">
      {statusNote ? (
        <>
          <strong className="font-bold">Your household wasn’t approved.</strong> Note from the barangay office: “{statusNote}”
        </>
      ) : (
        <>
          <strong className="font-bold">Your household is turned off.</strong> Collections can’t be recorded. Ask the barangay office
          for help.
        </>
      )}
    </Notice>
  );
}
