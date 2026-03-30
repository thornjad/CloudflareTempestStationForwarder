import { fetchConditions } from './tempest.js';
import { updatePWSWeather } from './destinations/pwsweather.js';
import { updateCWOP } from './destinations/cwop.js';
import { updateWunderground } from './destinations/wunderground.js';
import { updateWindy } from './destinations/windy.js';

export default {
  async scheduled(_event, env, _ctx) {
    const conditions = await fetchConditions(env);
    if (!conditions) {
      console.error('Failed to fetch conditions from Tempest — aborting update cycle');
      return;
    }

    const tasks = [];

    if (env.ENABLE_PWSWEATHER === 'true') {
      tasks.push(
        updatePWSWeather(conditions, env)
          .catch((err) => console.error('PWSWeather error:', err.message))
      );
    }

    if (env.ENABLE_CWOP === 'true') {
      tasks.push(
        updateCWOP(conditions, env)
          .catch((err) => console.error('CWOP error:', err.message))
      );
    }

    if (env.ENABLE_WUNDERGROUND === 'true') {
      tasks.push(
        updateWunderground(conditions, env)
          .catch((err) => console.error('Wunderground error:', err.message))
      );
    }

    if (env.ENABLE_WINDY === 'true') {
      tasks.push(
        updateWindy(conditions, env)
          .catch((err) => console.error('Windy error:', err.message))
      );
    }

    await Promise.allSettled(tasks);
    console.log('Update cycle complete');
  },

  async fetch(_request, _env, _ctx) {
    return new Response('Weather Station Forwarder is running.');
  },
};
