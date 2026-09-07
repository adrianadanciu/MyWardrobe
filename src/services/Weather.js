import * as Location from 'expo-location';
export async function getCurrentCoords(){
    let status;
    try{
        ({status} = await Location.requestForegroundPermissionsAsync());
    } 
    catch (e){
        return {latitude: null, longitude: null, error: 'permission-denied'};
    }
    if (status !== 'granted') 
        return {latitude: null, longitude: null, error: 'permission-denied'};
    try{
        const position = await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Low});
        return {latitude: position.coords.latitude, longitude: position.coords.longitude, error: null};
    } 
    catch (e){
        console.warn('Could not get a location fix', e);
        return {latitude: null, longitude: null, error: 'location-failed'};
    }
}
export async function fetchCurrentTemperature(preFetchedCoords = null){
    const {latitude, longitude, error} = preFetchedCoords || await getCurrentCoords();
    if (error) 
        return {temp: null, error};
    try{
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.current && typeof data.current.temperature_2m === 'number'){
            return {temp: Math.round(data.current.temperature_2m), error: null};
        }
        return {temp: null, error: 'network-failed'};
    }
    catch (e){
        console.warn('Could not fetch the temperature automatically', e);
        return {temp: null, error: 'network-failed'};
    }
}
export async function fetchForecast({latitude, longitude, days = 7}){
    try{
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min&forecast_days=${Math.min(days, 16)}&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data?.daily?.time) return {forecast: [], error: 'network-failed'};
        const forecast = data.daily.time.map((date, i) => ({
            date,
            temp: Math.round((data.daily.temperature_2m_max[i] + data.daily.temperature_2m_min[i]) / 2),
        }));
        return {forecast, error: null};
    } 
    catch (e){
        console.warn('Could not fetch the forecast', e);
        return {forecast: [], error: 'network-failed'};
    }
}
export async function fetchHourlyWindow({latitude, longitude, hours}){
    try{
        const days = hours > 24 ? 3 : 2;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m&forecast_days=${days}&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data?.hourly?.time) 
            return {min: null, max: null, error: 'network-failed'};
        const now = new Date();
        const endTime = new Date(now.getTime() + hours * 3600000);
        const temps = data.hourly.time
            .map((t, i) => ({time: new Date(t), temp: data.hourly.temperature_2m[i]}))
            .filter(({time}) => time >= now && time <= endTime)
            .map(({temp}) => temp);

        if (!temps.length) 
            return {min: null, max: null, error: 'network-failed'};
        return {min: Math.round(Math.min(...temps)), max: Math.round(Math.max(...temps)), error: null};
    } 
    catch (e){
        console.warn('Could not fetch the hourly forecast', e);
        return {min: null, max: null, error: 'network-failed'};
    }
}
export async function fetchDailyHourlyWindows({latitude, longitude, days, hoursOut, startHour}){
    try{
        const fetchDays = Math.min(days + 1, 16);
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m&forecast_days=${fetchDays}&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data?.hourly?.time) 
            return {windows: [], error: 'network-failed'};
        const times = data.hourly.time; 
        const temps = data.hourly.temperature_2m;
        const paddedHour = String(startHour).padStart(2, '0');
        const targetDates = [...new Set(times.map((t) => t.split('T')[0]))].sort().slice(0, days);
        const windows = [];
        for (const date of targetDates){
            const startIdx = times.findIndex((t) => t.startsWith(`${date}T${paddedHour}:`));
            if (startIdx === -1) 
                continue;
            const slice = temps.slice(startIdx, startIdx + hoursOut);
            if (!slice.length) 
                continue;
            windows.push({date, min: Math.round(Math.min(...slice)), max: Math.round(Math.max(...slice))});
        }
        if (!windows.length) 
            return {windows: [], error: 'network-failed'};
        return {windows, error: null};
    } 
    catch (e){
        console.warn('Could not fetch the daily hourly windows', e);
        return {windows: [], error: 'network-failed'};
    }
}
export async function geocodeCity(name) {
    if (!name || !name.trim()) 
        return null;
    try{
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name.trim())}&count=1`;
        const res = await fetch(url);
        const data = await res.json();
        const match = data?.results?.[0];
        if (!match) 
            return null;
        const parts = [match.name, match.admin1, match.country].filter(Boolean);
        return {latitude: match.latitude, longitude: match.longitude, displayName: parts.join(', ')};
    } 
    catch (e){
        console.warn('Could not look up that city', e);
        return null;
    }
}
