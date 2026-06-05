// src/js/modules/logger.js
// Utility di log per la console e il pannello debug di sistema.

export function log(msg) {
  const time = new Date().toLocaleTimeString();
  const formatted = `[${time}] ${msg}`;
  console.log(formatted);

  const pre = document.getElementById("console-log-pre");
  if (pre) {
    if (pre.textContent === "CruciGen System Initialized. Waiting for action...") {
      pre.textContent = formatted;
    } else {
      pre.textContent += `\n${formatted}`;
    }
    const body = document.getElementById("console-body");
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }
}
