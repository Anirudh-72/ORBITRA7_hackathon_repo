const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface RouteRequest {
  origin: [number, number];
  destination: [number, number];
  scenario_id: string;
}

export const fetchFacilities = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/facilities`);
    if (!res.ok) throw new Error('Failed to fetch facilities');
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const fetchRoads = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/layers/roads`);
    if (!res.ok) throw new Error('Failed to fetch roads');
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const fetchFlood = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/layers/flood`);
    if (!res.ok) throw new Error('Failed to fetch flood layer');
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const calculateRoute = async (request: RouteRequest) => {
  try {
    const res = await fetch(`${API_BASE_URL}/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    if (!res.ok) throw new Error('Failed to calculate route');
    return await res.json();
  } catch (err) {
    console.error(err);
    return { status: 'ERROR', error: (err as Error).message };
  }
};
