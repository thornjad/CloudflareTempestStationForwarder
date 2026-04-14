import { fetchConditions } from './tempest.js';
import { updatePWSWeather } from './destinations/pwsweather.js';
import { updateCWOP } from './destinations/cwop.js';
import { updateWunderground } from './destinations/wunderground.js';
import { updateWindy } from './destinations/windy.js';
import { updateOpenWeatherMap } from './destinations/openweathermap.js';
import { updateWeathercloud } from './destinations/weathercloud.js';

export default {
  async scheduled(event, env, _ctx) {
    const conditions = await fetchConditions(env);
    if (!conditions) {
      console.error('Failed to fetch conditions from Tempest — aborting update cycle');
      return;
    }

    const tasks = [];

    if (env.PWSWEATHER_STATION_ID && env.PWSWEATHER_API_KEY) {
      tasks.push(
        updatePWSWeather(conditions, env)
          .catch((err) => console.error('PWSWeather error:', err.message))
      );
    }

    if (env.CWOP_STATION_ID) {
      tasks.push(
        updateCWOP(conditions, env)
          .catch((err) => console.error('CWOP error:', err.message))
      );
    }

    if (env.WUNDERGROUND_STATION_ID && env.WUNDERGROUND_STATION_KEY) {
      tasks.push(
        updateWunderground(conditions, env)
          .catch((err) => console.error('Wunderground error:', err.message))
      );
    }

    if (env.WINDY_STATION_ID && env.WINDY_STATION_PASSWORD) {
      tasks.push(
        updateWindy(conditions, env)
          .catch((err) => console.error('Windy error:', err.message))
      );
    }

    if (env.OWM_STATION_ID && env.OWM_API_KEY) {
      tasks.push(
        updateOpenWeatherMap(conditions, env)
          .catch((err) => console.error('OpenWeatherMap error:', err.message))
      );
    }

    if (env.WEATHERCLOUD_ID && env.WEATHERCLOUD_KEY) {
      tasks.push(
        updateWeathercloud(conditions, env, event.scheduledTime)
          .catch((err) => console.error('WeatherCloud error:', err.message))
      );
    }

    await Promise.allSettled(tasks);
    console.log('Update cycle complete');
  },

  async fetch(_request, _env, _ctx) {
    return new Response('Weather Station Forwarder is running.');
  },
};
