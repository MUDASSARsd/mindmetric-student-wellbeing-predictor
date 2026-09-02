"use strict";



const PREDICT_URL = "https://mindmetric-student-wellbeing-predictor.onrender.com/predict";


const SCORE_SCALE_MAX = 10;

const COUNTRY_OPTIONS = [
  "Afghanistan", "Argentina", "Australia", "Austria", "Bangladesh", "Belgium",
  "Brazil", "Canada", "Chile", "China", "Colombia", "Egypt", "Finland",
  "France", "Germany", "Ghana", "Greece", "India", "Indonesia", "Ireland",
  "Israel", "Italy", "Japan", "Kenya", "Malaysia", "Mexico", "Morocco",
  "Nepal", "Netherlands", "New Zealand", "Nigeria", "Norway", "Pakistan",
  "Peru", "Philippines", "Poland", "Portugal", "Russia", "Saudi Arabia",
  "Singapore", "South Africa", "South Korea", "Spain", "Sri Lanka",
  "Sweden", "Switzerland", "Thailand", "Turkey", "Ukraine",
  "United Arab Emirates", "United Kingdom", "United States", "Vietnam"
];



const form = document.getElementById("assessment-form");
const submitButton = document.getElementById("submit-button");
const resetButton = document.getElementById("reset-button");
const errorBanner = document.getElementById("error-banner");
const resultCard = document.getElementById("result-card");
const scoreValueEl = document.getElementById("score-value");
const gaugeFillEl = document.getElementById("gauge-fill");
const interpretationEl = document.getElementById("result-interpretation");
const editAnswersButton = document.getElementById("edit-answers-button");
const countryList = document.getElementById("country-list");
const progressItems = Array.from(document.querySelectorAll(".progress-item"));

const FIELD_CONFIG = {
  age: { type: "int", min: 10, max: 100 },
  gender: { type: "string" },
  country: { type: "string" },
  academic_level: { type: "string" },
  most_used_platform: { type: "string" },
  purpose_of_use: { type: "string" },
  avg_daily_usage_hours: { type: "float", min: 0, max: 24 },
  daily_unlocks: { type: "int", min: 0 },
  study_hours: { type: "float", min: 0, max: 24 },
  physical_activity_hours: { type: "float", min: 0, max: 24 },
  sleep_hours_per_night: { type: "float", min: 0, max: 24 },
  stress_level: { type: "string" },
};

let isSubmitting = false;


function init() {
  populateCountryList();
  attachValidationListeners();
  observeSections();

  form.addEventListener("submit", handleSubmit);
  resetButton.addEventListener("click", handleReset);
  editAnswersButton.addEventListener("click", handleEditAnswers);
}

function populateCountryList() {
  const fragment = document.createDocumentFragment();
  COUNTRY_OPTIONS.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    fragment.appendChild(option);
  });
  countryList.appendChild(fragment);
}


function observeSections() {
  const sections = Array.from(document.querySelectorAll(".form-section"));
  if (!("IntersectionObserver" in window) || sections.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setCurrentSection(entry.target.dataset.section);
        }
      });
    },
    { rootMargin: "-30% 0px -55% 0px", threshold: 0 }
  );

  sections.forEach((section) => observer.observe(section));
}

function setCurrentSection(sectionName) {
  const order = ["about", "digital", "routine"];
  const currentIndex = order.indexOf(sectionName);

  progressItems.forEach((item) => {
    const itemIndex = order.indexOf(item.dataset.section);
    item.classList.remove("is-current", "is-complete");
    if (itemIndex === currentIndex) {
      item.classList.add("is-current");
    } else if (itemIndex < currentIndex) {
      item.classList.add("is-complete");
    }
  });
}


function attachValidationListeners() {
  Object.keys(FIELD_CONFIG).forEach((name) => {
    const field = form.elements[name];
    if (!field) return;

    const eventName = field.tagName === "SELECT" ? "change" : "input";
    field.addEventListener(eventName, () => {
      if (fieldHasError(field)) {
        validateField(name);
      }
    });
    field.addEventListener("blur", () => validateField(name));
  });
}

function fieldHasError(field) {
  const wrapper = field.closest(".field");
  return wrapper ? wrapper.classList.contains("has-error") : false;
}


function validateField(name) {
  const config = FIELD_CONFIG[name];
  const field = form.elements[name];
  const errorEl = document.getElementById(`${name}-error`);
  const wrapper = field.closest(".field");

  const message = getFieldValidationMessage(name, config, field);

  if (message) {
    wrapper.classList.add("has-error");
    field.setAttribute("aria-invalid", "true");
    errorEl.textContent = message;
    errorEl.hidden = false;
    return false;
  }

  wrapper.classList.remove("has-error");
  field.removeAttribute("aria-invalid");
  errorEl.hidden = true;
  errorEl.textContent = "";
  return true;
}

function getFieldValidationMessage(name, config, field) {
  const rawValue = field.value;

  if (rawValue === null || rawValue.trim() === "") {
    return "This field is required.";
  }

  if (config.type === "string") {
    return null;
  }

  const numericValue = Number(rawValue);

  if (Number.isNaN(numericValue)) {
    return "Enter a valid number.";
  }

  if (config.type === "int" && !Number.isInteger(numericValue)) {
    return "Enter a whole number.";
  }

  if (typeof config.min === "number" && numericValue < config.min) {
    return `Enter a value of ${config.min} or more.`;
  }

  if (typeof config.max === "number" && numericValue > config.max) {
    return `Enter a value of ${config.max} or less.`;
  }

  return null;
}

function validateAllFields() {
  let firstInvalidField = null;
  let allValid = true;

  Object.keys(FIELD_CONFIG).forEach((name) => {
    const isValid = validateField(name);
    if (!isValid) {
      allValid = false;
      if (!firstInvalidField) {
        firstInvalidField = form.elements[name];
      }
    }
  });

  return { allValid, firstInvalidField };
}

function buildPayload() {
  const payload = {};

  Object.entries(FIELD_CONFIG).forEach(([name, config]) => {
    const field = form.elements[name];
    let value = field.value;

    if (config.type === "string") {
      value = name === "country" ? value.trim() : value;
    } else if (config.type === "int") {
      value = parseInt(value, 10);
    } else if (config.type === "float") {
      value = parseFloat(value);
    }

    payload[name] = value;
  });

  return payload;
}

async function handleSubmit(event) {
  event.preventDefault();

  if (isSubmitting) return;

  hideErrorBanner();

  const { allValid, firstInvalidField } = validateAllFields();

  if (!allValid) {
    if (firstInvalidField) {
      firstInvalidField.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalidField.focus();
    }
    return;
  }

  const payload = buildPayload();
  setLoadingState(true);

  try {
    const response = await fetch(PREDICT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    await handleResponse(response);
  } catch (networkError) {
    showErrorBanner(
      "We couldn't reach the prediction service. Check that the backend is running at " +
      "http://127.0.0.1:8000 and try again."
    );
  } finally {
    setLoadingState(false);
  }
}

async function handleResponse(response) {
  let data = null;

  try {
    data = await response.json();
  } catch (parseError) {
    if (!response.ok) {
      showErrorBanner(`The server returned an error (status ${response.status}).`);
    } else {
      showErrorBanner("The server sent a response we couldn't understand.");
    }
    return;
  }

  if (response.status === 422) {
    handleValidationError(data);
    return;
  }

  if (!response.ok) {
    const message = extractGenericErrorMessage(data);
    showErrorBanner(message || `Something went wrong (status ${response.status}). Please try again.`);
    return;
  }

  if (!data || typeof data.predicted_mental_health_score !== "number" || Number.isNaN(data.predicted_mental_health_score)) {
    showErrorBanner("The server response didn't include a valid score. Please try again.");
    return;
  }

  showResult(data.predicted_mental_health_score);
}


function handleValidationError(data) {
  const details = data && Array.isArray(data.detail) ? data.detail : null;

  if (!details || details.length === 0) {
    showErrorBanner("The information you entered couldn't be validated. Please review your answers.");
    return;
  }

  const unmappedMessages = [];
  let firstMappedField = null;

  details.forEach((item) => {
    const loc = Array.isArray(item.loc) ? item.loc : [];
    const fieldName = loc.length > 0 ? String(loc[loc.length - 1]) : null;
    const readableMessage = item.msg ? capitalize(item.msg) : "This value is invalid.";

    if (fieldName && FIELD_CONFIG[fieldName]) {
      const errorEl = document.getElementById(`${fieldName}-error`);
      const field = form.elements[fieldName];
      const wrapper = field ? field.closest(".field") : null;

      if (errorEl && field && wrapper) {
        wrapper.classList.add("has-error");
        field.setAttribute("aria-invalid", "true");
        errorEl.textContent = readableMessage;
        errorEl.hidden = false;
        if (!firstMappedField) firstMappedField = field;
      }
    } else {
      unmappedMessages.push(readableMessage);
    }
  });

  if (unmappedMessages.length > 0) {
    showErrorBanner(unmappedMessages.join(" "));
  } else {
    hideErrorBanner();
  }

  if (firstMappedField) {
    firstMappedField.scrollIntoView({ behavior: "smooth", block: "center" });
    firstMappedField.focus();
  }
}

function extractGenericErrorMessage(data) {
  if (!data) return null;
  if (typeof data.detail === "string") return capitalize(data.detail);
  if (typeof data.message === "string") return capitalize(data.message);
  return null;
}

function capitalize(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function setLoadingState(isLoading) {
  isSubmitting = isLoading;
  submitButton.disabled = isLoading;
  submitButton.setAttribute("aria-busy", isLoading ? "true" : "false");
  form.setAttribute("aria-busy", isLoading ? "true" : "false");

  const label = submitButton.querySelector(".btn-label");
  label.textContent = isLoading ? "Analyzing your routine…" : "Predict my score";

  resetButton.disabled = isLoading;
}


function showErrorBanner(message) {
  errorBanner.textContent = message;
  errorBanner.hidden = false;
  errorBanner.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideErrorBanner() {
  errorBanner.hidden = true;
  errorBanner.textContent = "";
}


function showResult(score) {
  hideErrorBanner();

  const formatted = score.toFixed(2);
  scoreValueEl.textContent = formatted;

  const clampedForGauge = Math.max(0, Math.min(score, SCORE_SCALE_MAX));
  const fraction = clampedForGauge / SCORE_SCALE_MAX;

  const arcLength = 283;
  const offset = arcLength - fraction * arcLength;

  gaugeFillEl.style.strokeDashoffset = String(arcLength);
  gaugeFillEl.style.stroke = gaugeColorForFraction(fraction);

  requestAnimationFrame(() => {
    gaugeFillEl.style.strokeDashoffset = String(offset);
  });

  interpretationEl.textContent = interpretationForFraction(fraction);

  resultCard.hidden = false;
  resultCard.classList.remove("is-visible");
  void resultCard.offsetWidth;
  resultCard.classList.add("is-visible");

  resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function gaugeColorForFraction(fraction) {
  if (fraction < 0.4) return "#D97A5F";
  if (fraction < 0.7) return "#C79A4B";
  return "#4C7A72";
}

function interpretationForFraction(fraction) {
  if (fraction < 0.4) {
    return "This estimate sits toward the lower end of the scale. It may be worth looking at your sleep, stress, and screen time together, and talking to someone if things feel heavy.";
  }
  if (fraction < 0.7) {
    return "This estimate sits in a middle range. Your routine has a mix of supportive and strained factors worth paying attention to.";
  }
  return "This estimate sits toward the higher end of the scale, suggesting your current routine is generally supportive of your wellbeing.";
}



function handleReset() {
  window.setTimeout(() => {
    Object.keys(FIELD_CONFIG).forEach((name) => {
      const field = form.elements[name];
      const errorEl = document.getElementById(`${name}-error`);
      const wrapper = field ? field.closest(".field") : null;

      if (wrapper) wrapper.classList.remove("has-error");
      if (field) field.removeAttribute("aria-invalid");
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = "";
      }
    });

    hideErrorBanner();
    setLoadingState(false);
    resultCard.hidden = true;
    resultCard.classList.remove("is-visible");
    setCurrentSection("about");
  }, 0);
}

function handleEditAnswers() {
  resultCard.hidden = true;
  resultCard.classList.remove("is-visible");
  const firstField = form.elements["age"];
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  if (firstField) firstField.focus();
}


document.addEventListener("DOMContentLoaded", init);
