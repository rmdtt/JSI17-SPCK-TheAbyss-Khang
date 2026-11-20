(() => {
  const $ = (id) => document.getElementById(id);
  const aquarium = $("aquarium");
  const bubbleLayer = $("bubble-layer");

  let lastFrame = performance.now();
  let bubbleTimer = 0;

  function createBubble() {
    const state = AbyssGame.getState();
    if (state.paused || !state.lightOn) return;

    const bubble = document.createElement("span");
    bubble.className = "bubble";
    const size = 3 + Math.random() * 7;
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${5 + Math.random() * 90}%`;
    bubble.style.animationDuration = `${4 + Math.random() * 5}s`;
    bubbleLayer.appendChild(bubble);
    window.setTimeout(() => bubble.remove(), 9500);
  }

  function render() {
    const s = AbyssGame.getState();

    $("game-clock").textContent = `Day ${s.day} · ${s.clock}`;
    $("day-phase").textContent = s.phase;
    $("health-value").textContent = `${Math.round(s.health)}%`;
    $("hunger-value").textContent = `${Math.round(s.hunger)}%`;
    $("clean-value").textContent = `${Math.round(s.cleanliness)}%`;
    $("mood-value").textContent = `${Math.round(s.mood)}%`;
    $("mood-text").textContent = s.moodLabel;
    $("mood-icon").textContent = s.moodIcon;
    $("notice").textContent = s.lastNotice;
    $("temperature-value").textContent = `${s.temperature.toFixed(1)}°C`;
    $("temp-hint").textContent = `Target ${s.targetTemperature.toFixed(1)}°C · ${s.phase.toLowerCase()} variation simulated`;

    $("health-meter").style.width = `${s.health}%`;
    $("hunger-meter").style.width = `${s.hunger}%`;
    $("clean-meter").style.width = `${s.cleanliness}%`;
    $("mood-meter").style.width = `${s.mood}%`;
    $("temp-indicator").style.left = `${((s.targetTemperature - 10) / 25) * 100}%`;

    aquarium.classList.toggle("light-off", !s.lightOn);
    $("light-label").textContent = `Light: ${s.lightOn ? "On" : "Off"}`;
    $("toy-label").textContent = `Toy: ${s.toyActive ? "On" : "Off"}`;
    $("toy-button").classList.toggle("active", s.toyActive);
    $("light-button").classList.toggle("active", s.lightOn);
    $("pause-button").textContent = s.paused ? "▶" : "Ⅱ";
    $("pause-button").title = s.paused ? "Resume simulation" : "Pause simulation";
  }

  function frame(now) {
    const delta = Math.min((now - lastFrame) / 1000, 0.25);
    lastFrame = now;
    AbyssGame.step(delta);
    render();
    requestAnimationFrame(frame);
  }

  $("feed-button").addEventListener("click", () => { AbyssGame.feed(); render(); });
  $("clean-button").addEventListener("click", () => { AbyssGame.cleanTank(); render(); });
  $("toy-button").addEventListener("click", () => { AbyssGame.toggleToy(); render(); });
  $("light-button").addEventListener("click", () => { AbyssGame.toggleLight(); render(); });
  $("temp-down").addEventListener("click", () => { AbyssGame.adjustTemperature(-0.5); render(); });
  $("temp-up").addEventListener("click", () => { AbyssGame.adjustTemperature(0.5); render(); });
  $("pause-button").addEventListener("click", () => { AbyssGame.togglePause(); render(); });
  $("speed-select").addEventListener("change", (event) => AbyssGame.setSpeed(event.target.value));
  $("save-button").addEventListener("click", () => { AbyssGame.save(); render(); });
  $("reset-button").addEventListener("click", () => {
    if (confirm("Start a new aquarium simulation? Your current in-memory progress will be reset.")) {
      AbyssGame.reset();
      localStorage.removeItem("theAbyssAquariumSave_v1");
      render();
    }
  });

  // Load a previous save if one exists.
  AbyssGame.load();
  render();
  window.setInterval(createBubble, 650);
  requestAnimationFrame(frame);
})();
