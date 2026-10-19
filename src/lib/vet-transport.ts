type RouteResult = {
  durationSeconds: number;
  distanceMiles: number;
};

export type VetTransportSchedule = {
  pickupAt: string;
  appointmentAt: string;
  outboundDriveMinutes: number;
  outboundDistanceMiles: number;
  returnPickupAt: string | null;
  returnArrivalAt: string | null;
  returnDriveMinutes: number | null;
};

function parseDurationSeconds(value: unknown) {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?s$/.test(value)) {
    throw new Error("Google Maps returned an invalid drive-time estimate.");
  }
  return Math.ceil(Number.parseFloat(value.slice(0, -1)));
}

async function getDrivingRoute(
  origin: string,
  destination: string,
  departureTime: string
): Promise<RouteResult> {
  const apiKey = process.env.GOOGLE_MAPS_ROUTES_API_KEY;
  if (!apiKey) {
    throw new Error("Traffic-aware drive estimates are not set up yet.");
  }

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
    },
    body: JSON.stringify({
      origin: { address: origin },
      destination: { address: destination },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      departureTime,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("We couldn’t calculate a drive time for that route. Check the addresses or contact us.");
  }

  const data = await response.json();
  const route = data?.routes?.[0];
  if (!route || !Number.isFinite(Number(route.distanceMeters))) {
    throw new Error("We couldn’t find a driving route between those addresses.");
  }

  return {
    durationSeconds: parseDurationSeconds(route.duration),
    distanceMiles: Number(route.distanceMeters) / 1609.344,
  };
}

export async function calculateVetTransportSchedule(input: {
  pickupAddress: string;
  vetAddress: string;
  appointmentAt: string;
  returnPickupAt?: string | null;
}): Promise<VetTransportSchedule> {
  const appointmentAt = new Date(input.appointmentAt);
  if (!Number.isFinite(appointmentAt.getTime()) || appointmentAt <= new Date()) {
    throw new Error("Choose a future vet appointment date and time.");
  }

  const pickupAddress = input.pickupAddress.trim();
  const vetAddress = input.vetAddress.trim();
  if (!pickupAddress || !vetAddress) {
    throw new Error("Enter both the home pickup address and vet address.");
  }
  if (pickupAddress.length > 300 || vetAddress.length > 300) {
    throw new Error("Please use shorter addresses for the route estimate.");
  }

  const appointmentIso = appointmentAt.toISOString();
  let candidatePickup = new Date(Math.max(Date.now() + 60000, appointmentAt.getTime() - 45 * 60000));
  let outboundRoute: RouteResult | null = null;

  // Refine the departure estimate using traffic at the estimated pickup time.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    outboundRoute = await getDrivingRoute(
      pickupAddress,
      vetAddress,
      candidatePickup.toISOString()
    );
    if (outboundRoute.distanceMiles > 15) {
      throw new Error("The vet must be within 15 driving miles of the home pickup address for online scheduling.");
    }
    candidatePickup = new Date(
      appointmentAt.getTime() - outboundRoute.durationSeconds * 1000 - 15 * 60000
    );
  }

  if (!outboundRoute) throw new Error("We couldn’t calculate the drive time.");
  if (candidatePickup <= new Date()) {
    throw new Error("That appointment is too soon to schedule online. Please contact us for help.");
  }

  let returnPickupAt: string | null = null;
  let returnArrivalAt: string | null = null;
  let returnDriveMinutes: number | null = null;

  if (input.returnPickupAt) {
    const returnPickup = new Date(input.returnPickupAt);
    if (!Number.isFinite(returnPickup.getTime()) || returnPickup <= appointmentAt) {
      throw new Error("Choose a return pickup time after the vet appointment begins.");
    }
    const returnRoute = await getDrivingRoute(
      vetAddress,
      pickupAddress,
      returnPickup.toISOString()
    );
    if (returnRoute.distanceMiles > 15) {
      throw new Error("The vet must be within 15 driving miles of the home pickup address for online scheduling.");
    }
    returnPickupAt = returnPickup.toISOString();
    returnDriveMinutes = Math.ceil(returnRoute.durationSeconds / 60);
    returnArrivalAt = new Date(returnPickup.getTime() + returnRoute.durationSeconds * 1000).toISOString();
  }

  return {
    pickupAt: candidatePickup.toISOString(),
    appointmentAt: appointmentIso,
    outboundDriveMinutes: Math.ceil(outboundRoute.durationSeconds / 60),
    outboundDistanceMiles: Math.round(outboundRoute.distanceMiles * 10) / 10,
    returnPickupAt,
    returnArrivalAt,
    returnDriveMinutes,
  };
}
