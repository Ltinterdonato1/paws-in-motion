
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CompleteJobButtonProps = {
  bookingId: string;
  isDayCare?: boolean;
  isBoarding?: boolean;
  serviceItemId?: string;
  allowLatePickupReport?: boolean;
  onCompleted?: () => void;
};

export default function CompleteJobButton({
  bookingId,
  isDayCare = false,
  isBoarding = false,
  serviceItemId,
  allowLatePickupReport = false,
  onCompleted,
}: CompleteJobButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [latePickupFee, setLatePickupFee] = useState<0 | 10 | 40 | 55 | 90>(0);
  const feeDescription = latePickupFee === 90
    ? "with a $90 daytime boarding fee confirmed with the customer"
    : latePickupFee > 0
      ? `with a $${latePickupFee} day-care late-pickup fee`
      : "";

  async function completeJob() {
    const confirmed = window.confirm(
      serviceItemId
        ? "Mark this vet transportation leg complete? The invoice will be created after the final scheduled trip."
        : `Are you sure this service has been completed? This will create an invoice for the customer${feeDescription ? ` ${feeDescription}` : ""}.`
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(
        `/api/services/${bookingId}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ latePickupFee, serviceItemId }),
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.message ||
            "We couldn't complete this job. Please try again."
        );
      }

      setMessage(
        result.message ||
          "Job completed successfully and the invoice was created."
      );

      // Reload the server-rendered booking details and its new status.
      if (onCompleted) {
        onCompleted();
      } else {
        router.refresh();
      }
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function reportLatePickup() {
    setLoading(true);
    setMessage("");
    setIsError(false);
    try {
      const response = await fetch(`/api/services/${bookingId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportLatePickup: true }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "The admin alert could not be sent.");
      }
      setMessage(result.message);
      onCompleted?.();
      if (!onCompleted) router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "The admin alert could not be sent.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {!serviceItemId && (isDayCare || isBoarding) && (
        <label className="mb-3 flex flex-col gap-2 text-sm text-[#5d6f63]">
          <span>{isBoarding ? "Daytime boarding fee, if confirmed with customer" : "Late-pickup fee, if applicable"}</span>
          <select
            value={latePickupFee}
            onChange={(event) => setLatePickupFee(Number(event.target.value) as 0 | 10 | 40 | 55 | 90)}
            disabled={loading}
            className="rounded-lg border border-[#d8ded3] bg-white px-3 py-2"
          >
            <option value={0}>No late fee</option>
            {isDayCare && <>
              <option value={10}>$10 — pickup from 6:01–7:00 PM</option>
              <option value={40}>$40 — after 7:00 PM without notice, standard overnight boarding</option>
              <option value={55}>$55 — after 7:00 PM without notice, solo overnight boarding</option>
            </>}
            {isBoarding && <option value={90}>$90 — daytime boarding after 8:00 AM, confirmed with customer</option>}
          </select>
        </label>
      )}
      <button
        type="button"
        onClick={completeJob}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-xl bg-[#193d30] px-5 py-3 font-semibold text-white transition hover:bg-[#315846] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Updating..." : serviceItemId ? "Mark This Vet Trip Complete" : "Complete Job & Create Invoice"}
      </button>

      {allowLatePickupReport && !serviceItemId && (
        <button
          type="button"
          onClick={reportLatePickup}
          disabled={loading}
          className="ml-3 mt-2 inline-flex items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Alert Admin: Late Pickup
        </button>
      )}

      {message && (
        <p
          role={isError ? "alert" : "status"}
          className={`mt-3 text-sm ${
            isError ? "text-red-700" : "text-green-800"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
