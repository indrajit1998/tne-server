import axios from "axios";
import env from "../lib/env";

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
    const { data } = await axios.get<AutocompleteApiResponse>(AUTOCOMPLETE_URL, {
      params: { input: query, key: API_KEY, types: "address" },
    });

    console.log(data)
    if (data.status !== "OK" || !data.predictions) {
      console.error("Autocomplete API Error:", data.status);
      return [];
    }

    return data.predictions.map((p) => ({
      description: p.description,
      placeId: p.place_id,
    }));
  } catch (error) {
    console.error("Prediction fetch failed:", error);
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
      console.error("Place Details API Error:", data.status);
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
    console.error("Details fetch failed:", error);
    return null;
  }
}
