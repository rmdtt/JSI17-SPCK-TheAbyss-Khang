/* The Abyss - small simulation engine prototype.
   Game values are illustrative mechanics, not real animal-care advice. */

window.AbyssGame = (() => {
  const DAY_LENGTH_SECONDS = 180; // 3 real minutes = 1 simulated day
  const CYCLE_LENGTH_SECONDS = 90; // half day / half night
  const SAVE_KEY = "theAbyssAquariumSave_v1";

  const initialState = () => ({
    day: 1,
    daySeconds: 0, // elapsed simulation seconds; clock display begins at 08:00
    temperature: 24,
    targetTemperature: 24,
    health: 100,
    mood: 72,
    hunger: 20,
    cleanliness: 100,
    toyActive: false,
    lightOn: true,
    paused: false,
    speed: 1,
    ageDays: 0,
    lastNotice: "Everything looks calm.",
    diseaseRisk: 0
  });

  let state = initialState();

  function clamp(value, min = 0, max = 100) {
    return Math.min(max, Math.max(min, value));
  }

  function getPhase() {
    return (state.daySeconds % CYCLE_LENGTH_SECONDS) < (CYCLE_LENGTH_SECONDS / 2)
      ? "DAYLIGHT" : "NIGHT";
  }

  function getClock() {
    const fraction = (state.daySeconds % DAY_LENGTH_SECONDS) / DAY_LENGTH_SECONDS;
    const minutes = Math.floor(fraction * 24 * 60);
    const h = String(Math.floor(minutes / 60)).padStart(2, "0");
    const m = String(minutes % 60).padStart(2, "0");
    return `${h}:${m}`;
  }

  function step(realSeconds) {
    if (state.paused) return;

    const simSeconds = realSeconds * state.speed;
    const previousDay = state.day;

    state.daySeconds += simSeconds;
    state.day = Math.floor(state.daySeconds / DAY_LENGTH_SECONDS) + 1;
    state.ageDays = state.day - 1;

    const phase = getPhase();
    const ambientDelta = phase === "DAYLIGHT" ? 0.15 : -0.15;
    const target = state.targetTemperature + ambientDelta;

    // Temperature approaches its target gradually.
    state.temperature += (target - state.temperature) * Math.min(1, simSeconds * 0.025);

    // Slow simulated needs progression.
    state.hunger = clamp(state.hunger + simSeconds * 0.025);
    state.cleanliness = clamp(state.cleanliness - simSeconds * 0.012);

    // Mood responds to toy, food and cleanliness; gently drifts.
    let moodChange = -simSeconds * 0.006;
    if (state.toyActive) moodChange += simSeconds * 0.012;
    if (state.cleanliness < 45) moodChange -= simSeconds * 0.012;
    if (state.hunger > 75) moodChange -= simSeconds * 0.015;
    state.mood = clamp(state.mood + moodChange);

    // Health is a simplified game mechanic.
    let healthChange = 0;
    if (state.hunger > 85) healthChange -= simSeconds * 0.018;
    if (state.cleanliness < 25) healthChange -= simSeconds * 0.02;
    if (state.mood < 20) healthChange -= simSeconds * 0.006;
    if (Math.abs(state.temperature - 24) > 4) healthChange -= simSeconds * 0.012;
    if (state.hunger < 65 && state.cleanliness > 65 && state.mood > 45) healthChange += simSeconds * 0.002;
    state.health = clamp(state.health + healthChange);

    // Risk accumulates under poor conditions; illness system comes in a later phase.
    if (state.cleanliness < 35 || state.hunger > 90 || Math.abs(state.temperature - 24) > 5) {
      state.diseaseRisk = clamp(state.diseaseRisk + simSeconds * 0.008);
    } else {
      state.diseaseRisk = clamp(state.diseaseRisk - simSeconds * 0.003);
    }

    if (state.day > previousDay) {
      state.lastNotice = `A new simulated day begins. Day ${state.day}.`;
    }
  }

  function feed() {
    state.hunger = clamp(state.hunger - 35);
    state.mood = clamp(state.mood + 8);
    state.lastNotice = "A meal was served. Hunger eased and mood improved.";
  }

  function cleanTank() {
    state.cleanliness = clamp(state.cleanliness + 38);
    state.lastNotice = "The tank was cleaned. Water clarity improved.";
  }

  function toggleToy() {
    state.toyActive = !state.toyActive;
    state.lastNotice = state.toyActive
      ? "Enrichment toy added. Your creature can explore it."
      : "The enrichment toy was put away.";
  }

  function toggleLight() {
    state.lightOn = !state.lightOn;
    state.lastNotice = state.lightOn ? "Aquarium light switched on." : "Aquarium light switched off.";
  }

  function adjustTemperature(delta) {
    state.targetTemperature = clamp(state.targetTemperature + delta, 10, 35);
    state.lastNotice = `Target temperature set to ${state.targetTemperature.toFixed(1)}°C.`;
  }

  function togglePause() {
    state.paused = !state.paused;
  }

  function setSpeed(speed) {
    state.speed = [1, 2, 4].includes(Number(speed)) ? Number(speed) : 1;
  }

  function reset() {
    state = initialState();
  }

  function save() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    state.lastNotice = "Game saved in this browser.";
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const loaded = JSON.parse(raw);
      state = { ...initialState(), ...loaded };
      state.lastNotice = "Saved game loaded.";
      return true;
    } catch (error) {
      console.warn("Could not load save:", error);
      return false;
    }
  }

  function getMoodLabel() {
    if (state.mood >= 85) return "Happy";
    if (state.mood >= 65) return "Content";
    if (state.mood >= 40) return "Neutral";
    if (state.mood >= 20) return "Bored";
    return "Stressed";
  }

  function getMoodIcon() {
    const label = getMoodLabel();
    return ({ Happy: "☺", Content: "☺", Neutral: "◡", Bored: "◌", Stressed: "☹" })[label];
  }

  function getState() {
    return { ...state, phase: getPhase(), clock: getClock(), moodLabel: getMoodLabel(), moodIcon: getMoodIcon() };
  }

  return {
    step, feed, cleanTank, toggleToy, toggleLight, adjustTemperature,
    togglePause, setSpeed, reset, save, load, getState
  };
})();
