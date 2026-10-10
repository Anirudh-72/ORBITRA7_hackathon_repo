const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface RouteRequest {
  origin: [number, number];
  destination: [number, number];
  scenario_id: string;
}

export const fetchFacilities = async (lat?: number, lon?: number) => {
  try {
    const query = lat !== undefined && lon !== undefined ? `?lat=${lat}&lon=${lon}` : '';
    const res = await fetch(`${API_BASE_URL}/facilities${query}`);
    if (!res.ok) throw new Error('Failed to fetch facilities');
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const fetchRoads = async (lat?: number, lon?: number) => {
  try {
    const query = lat !== undefined && lon !== undefined ? `?lat=${lat}&lon=${lon}` : '';
    const res = await fetch(`${API_BASE_URL}/layers/roads${query}`);
    if (!res.ok) throw new Error('Failed to fetch roads');
    return await res.json();
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const fetchFlood = async (lat?: number, lon?: number) => {
  try {
    const query = lat !== undefined && lon !== undefined ? `?lat=${lat}&lon=${lon}` : '';
    const res = await fetch(`${API_BASE_URL}/layers/flood${query}`);
    if (!res.ok) {
      if (res.status === 400) {
          const errData = await res.json();
          throw new Error(errData.detail || 'Flood monitoring restricted to India.');
      }
      throw new Error('Failed to fetch flood layer');
    }
    return await res.json();
  } catch (err) {
    console.error(err);
    return { error: (err as Error).message };
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

export const fetchLiveWeather = async (lat: number, lon: number) => {
  try {
    const res = await fetch(`${API_BASE_URL}/live/weather?lat=${lat}&lon=${lon}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
};

export const fetchHazards = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/hazards`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
};

export const reportHazard = async (lat: number, lon: number, type: string, description: string) => {
  try {
    const res = await fetch(`${API_BASE_URL}/hazards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon, type, description })
    });
    if (!res.ok) throw new Error('Failed to report');
    return await res.json();
  } catch (err) {
    return null;
  }
};
