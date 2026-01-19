import axios from "axios";
import env from "../lib/env";
import logger from "../lib/logger";

interface LatLng {
  lat: number;
  lng: number;
}

interface AddressComponents {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

interface PlacePrediction {
  description: string;
  placeId: string;
}

interface LocationSearchResult {
  formattedAddress: string;
  coordinates: LatLng;
  components: AddressComponents;
}

interface DistanceMatrixResponse {
  rows: {
    elements: {
      distance: { text: string; value: number };
      duration: { text: string; value: number };
      status: string;
    }[];
  }[];
  status: string;
}

interface GeocodeApiResponse {
  status: string;
  results: {
    formatted_address: string;
    geometry: {
      location: { lat: number; lng: number };
      location_type: string;
      viewport: {
        northeast: { lat: number; lng: number };
        southwest: { lat: number; lng: number };
      };
    };
    address_components: {
      long_name: string;
      short_name: string;
      types: string[];
    }[];
    place_id: string;
    types: string[];
  }[];
}

const API_KEY = env.GOOGLE_MAPS_API_KEY;

// --- API Response Types ---
interface AutocompleteApiResponse {
  status: string;
  predictions?: {
    description: string;
    place_id: string;
  }[];
}

interface PlaceDetailsApiResponse {
  status: string;
  result?: {
    formatted_address: string;
    geometry: {
      location: { lat: number; lng: number };
    };
    address_components: {
      long_name: string;
      types: string[];
    }[];
  };
}

export async function getPlacePredictions(
  query: string
): Promise<PlacePrediction[]> {
  const AUTOCOMPLETE_URL = `https://maps.googleapis.com/maps/api/place/autocomplete/json`;

  try {
    const { data } = await axios.get<AutocompleteApiResponse>(
      AUTOCOMPLETE_URL,
      {
        params: { input: query, key: API_KEY, types: "address" },
      }
    );
    if (data.status !== "OK" || !data.predictions) {
      logger.info(`Autocomplete API Error: ${data.status}`);
      return [];
    }

    return data.predictions.map((p) => ({
      description: p.description,
      placeId: p.place_id,
    }));
  } catch (error) {
    logger.error(`Prediction fetch failed: ${error}`);
    return [];
  }
}

export async function getPlaceDetails(
  placeId: string
): Promise<LocationSearchResult | null> {
  const DETAILS_URL = `https://maps.googleapis.com/maps/api/place/details/json`;

  try {
    const { data } = await axios.get<PlaceDetailsApiResponse>(DETAILS_URL, {
      params: {
        place_id: placeId,
        fields: "formatted_address,geometry,address_components",
        key: API_KEY,
      },
    });

    if (data.status !== "OK" || !data.result) {
      logger.error(`Place Details API Error: ${data.status}`);
      return null;
    }

    const result = data.result;

    const components: AddressComponents = {
      street: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
    };

    for (const comp of result.address_components) {
      if (comp.types.includes("route")) components.street = comp.long_name;
      if (comp.types.includes("locality")) components.city = comp.long_name;
      if (comp.types.includes("administrative_area_level_1"))
        components.state = comp.long_name;
      if (comp.types.includes("country")) components.country = comp.long_name;
      if (comp.types.includes("postal_code"))
        components.postalCode = comp.long_name;
    }

    return {
      formattedAddress: result.formatted_address,
      coordinates: {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
      },
      components,
    };
  } catch (error) {
    logger.error(`Details fetch failed: ${error}`);
    return null;
  }
}

export async function getAddressFromCoords(
  lat: number,
  lng: number
): Promise<LocationSearchResult | null> {
  const GEOCODE_URL = `https://maps.googleapis.com/maps/api/geocode/json`;

  try {
    const { data } = await axios.get<GeocodeApiResponse>(GEOCODE_URL, {
      params: { latlng: `${lat},${lng}`, key: API_KEY },
    });

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      logger.error(`Geocode API Error: ${data.status}`);
      return null;
    }

    // Take the **first result**
    const result = data.results[0];
    if (!result) return null;
    const components: AddressComponents = {
      street: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
    };

    for (const comp of result.address_components) {
      components.street = result.formatted_address;
      if (comp.types.includes("locality")) components.city = comp.long_name;
      if (comp.types.includes("administrative_area_level_1"))
        components.state = comp.long_name;
      if (comp.types.includes("country")) components.country = comp.long_name;
      if (comp.types.includes("postal_code"))
        components.postalCode = comp.long_name;
    }

    return {
      formattedAddress: result.formatted_address,
      coordinates: {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
      },
      components,
    };
  } catch (error) {
    logger.error(`Geocode fetch failed: ${error}`);
    return null;
  }
}

export async function getDistance(
  origin: string,
  destination: string
): Promise<{ distance: string; distanceValue: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json`;
  logger.info("Calculating distance between:" + origin + "and" + destination);
  try {
    const { data } = await axios.get<DistanceMatrixResponse>(url, {
      params: {
        origins: origin,
        destinations: destination,
        key: API_KEY,
        mode: "driving",
        units: "metric",
      },
    });

    if (data.status !== "OK") return null;

    const element = data?.rows[0]?.elements[0];

    if (element?.status !== "OK") return null;

    return {
      distance: element.distance.text,
      distanceValue: element.distance.value / 1000, // in km
    };
  } catch (error) {
    console.error("Distance API error:", error);
    return null;
  }
}

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const GEOCODE_URL = `https://maps.googleapis.com/maps/api/geocode/json`;

  try {
    const { data } = await axios.get<GeocodeApiResponse>(GEOCODE_URL, {
      params: { address, key: API_KEY },
    });

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      logger.error(`Geocode API Error for address "${address}": ${data.status}`);
      return null;
    }

    const firstResult = data.results?.[0];
    if (!firstResult?.geometry?.location) {
      logger.error(`Geocode Result Error: geometry.location missing for address "${address}"`);
      return null;
    }

    const { lat, lng } = firstResult.geometry.location;
    return { lat, lng };
  } catch (error) {
    logger.error(`Geocoding failed for address "${address}": ${error}`);
    return null;
  }
}
