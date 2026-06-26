// Base URL for the Flask API backend
// Change this URL when deploying the backend (e.g. to Render or Railway)
const BASE_URL = "http://localhost:5000";

// DOM Elements
const appContainer = document.getElementById("app-container");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const loadingContainer = document.getElementById("loading-container");
const errorContainer = document.getElementById("error-container");
const errorMessage = document.getElementById("error-message");
const errorCloseBtn = document.getElementById("error-close-btn");
const resultsPanel = document.getElementById("results-panel");
const roadmapFlowchart = document.getElementById("roadmap-flowchart");
const papersList = document.getElementById("papers-list");
const logoText = document.getElementById("logo-text");

// Event Listeners
searchForm.addEventListener("submit", handleSearchSubmit);
errorCloseBtn.addEventListener("click", hideError);

// Allow clicking on the logo header to return to the search screen
logoText.addEventListener("click", () => {
  if (appContainer.classList.contains("results-view")) {
    appContainer.className = "initial-view";
    resultsPanel.classList.add("hidden");
    hideError();
    searchInput.value = "";
    searchInput.focus();
  }
});

// Hide error message box
function hideError() {
  errorContainer.classList.add("hidden");
}

// Show error message box
function showError(message) {
  errorMessage.textContent = message;
  errorContainer.classList.remove("hidden");
}

// Submit Form Handler
async function handleSearchSubmit(event) {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  hideError();
  resultsPanel.classList.add("hidden");
  loadingContainer.classList.remove("hidden");
  
  // Disable form input during API fetch
  searchInput.disabled = true;
  searchBtn.disabled = true;

  try {
    const response = await fetch(`${BASE_URL}/api/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt: query })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    renderResults(data);
  } catch (error) {
    console.error("Fetch error:", error);
    showError(error.message || "Unable to connect to the backend server. Make sure it is running.");
  } finally {
    // Re-enable form controls
    loadingContainer.classList.add("hidden");
    searchInput.disabled = false;
    searchBtn.disabled = false;
  }
}

// Render papers and parsed roadmap flowchart in the layout
function renderResults(data) {
  // Clear previous outputs
  roadmapFlowchart.innerHTML = "";
  papersList.innerHTML = "";

  const papers = data.papers || [];
  const roadmapRaw = data.roadmap || "";

  // 1. Render Papers on the Right (65% column)
  if (papers.length === 0) {
    papersList.innerHTML = `
      <div style="padding: 20px; font-style: italic; color: var(--text-muted);">
        No papers found matching your query on arXiv.
      </div>
    `;
  } else {
    papers.forEach(paper => {
      const card = document.createElement("div");
      card.className = "paper-card";
      
      const snippet = paper.abstract && paper.abstract.length > 300 
        ? paper.abstract.substring(0, 300) + "..." 
        : paper.abstract || "No abstract available.";

      card.innerHTML = `
        <h3 class="paper-title">${escapeHTML(paper.title)}</h3>
        <div class="paper-meta">
          <span class="paper-authors">By: ${escapeHTML(paper.authors)}</span>
          <span class="paper-published">Published: ${escapeHTML(paper.published)}</span>
        </div>
        <p class="paper-abstract">${escapeHTML(snippet)}</p>
        <a href="${escapeHTML(paper.link)}" target="_blank" rel="noopener noreferrer" class="paper-link-btn">Read on arXiv</a>
      `;
      papersList.appendChild(card);
    });
  }

  // 2. Parse & Render Roadmap on the Left (35% column)
  const roadmapSteps = parseRoadmap(roadmapRaw);
  if (roadmapSteps.length === 0) {
    roadmapFlowchart.innerHTML = `
      <div style="padding: 20px; font-style: italic; color: var(--text-muted);">
        Could not compile a reading roadmap.
      </div>
    `;
  } else {
    roadmapSteps.forEach(step => {
      const card = document.createElement("div");
      card.className = "roadmap-card";

      card.innerHTML = `
        <div class="roadmap-card-node"></div>
        <div class="step-number">Step ${step.stepNum}</div>
        <div class="step-title-ref">${escapeHTML(step.paperTitle)}</div>
        <div class="step-concept"><span class="step-concept-label">Focus:</span> ${escapeHTML(step.concept)}</div>
        <div class="step-reason"><span class="step-reason-label">Why:</span> ${escapeHTML(step.reason)}</div>
      `;
      roadmapFlowchart.appendChild(card);
    });
  }

  // Transition UI into results view mode
  appContainer.className = "results-view";
  resultsPanel.classList.remove("hidden");
}

// Parses raw Gemini response text line by line into structured roadmap steps
function parseRoadmap(text) {
  const lines = text.split("\n");
  const stepBlocks = [];
  let currentStep = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Check if line starts with a number step (e.g. "1. ", "2) ", etc.)
    const stepMatch = trimmed.match(/^(\d+)[.\s)]+(.*)/);
    if (stepMatch) {
      if (currentStep) {
        stepBlocks.push(currentStep);
      }
      currentStep = {
        stepNum: stepMatch[1],
        content: stepMatch[2].trim()
      };
    } else {
      if (currentStep) {
        // Append subsequent lines to the current step content
        currentStep.content += "\n" + trimmed;
      }
    }
  });

  if (currentStep) {
    stepBlocks.push(currentStep);
  }

  // Parse each accumulated step block
  return stepBlocks.map(block => parseStepBlock(block.stepNum, block.content));
}

// Extract card fields from a single step block content
function parseStepBlock(stepNum, blockText) {
  // Strip double asterisks first
  const cleanText = blockText.replace(/\*\*/g, "").trim();
  
  let paperTitle = "";
  let concept = "";
  let reason = "";

  // Helper patterns to search for specific field labels
  const paperRegex = /(?:paper|read|title):\s*(.*?)(?=(?:focus|concept|why|reason):|$)/i;
  const focusRegex = /(?:focus|concept):\s*(.*?)(?=(?:paper|read|title|why|reason):|$)/i;
  const whyRegex = /(?:why|reason):\s*(.*?)(?=(?:paper|read|title|focus|concept):|$)/i;

  // Normalize newlines and bullets into simple spaces for matching
  const normalizedText = cleanText
    .replace(/[\n\r\t]/g, " ")
    .replace(/\*\s+/g, " ")
    .replace(/-\s+/g, " ")
    .replace(/\s+/g, " ");

  const paperMatch = normalizedText.match(paperRegex);
  const focusMatch = normalizedText.match(focusRegex);
  const whyMatch = normalizedText.match(whyRegex);

  // If we found field markers, extract them
  if (paperMatch || focusMatch || whyMatch) {
    if (paperMatch) paperTitle = paperMatch[1].trim();
    if (focusMatch) concept = focusMatch[1].trim();
    if (whyMatch) reason = whyMatch[1].trim();
  }

  // If structured fields are missing, try prose parser
  if (!paperTitle || !concept || !reason) {
    let rest = normalizedText;

    // Check if there are quotes for paper title
    const quoteMatch = rest.match(/["'“«](.*?)["'”»]/);
    if (quoteMatch) {
      if (!paperTitle) paperTitle = quoteMatch[1];
      rest = rest.replace(quoteMatch[0], "").trim();
    } else if (!paperTitle) {
      // Split by colon or dash
      const colonIndex = rest.indexOf(':');
      const dashIndex = rest.indexOf(' - ');
      if (colonIndex !== -1) {
        paperTitle = rest.substring(0, colonIndex).trim();
        rest = rest.substring(colonIndex + 1).trim();
      } else if (dashIndex !== -1) {
        paperTitle = rest.substring(0, dashIndex).trim();
        rest = rest.substring(dashIndex + 3).trim();
      }
    }

    // Split remaining by common conjunctions (because, since, why, to, so that)
    const becauseRegex = /\s(because|since|as\sits?|so\sthat|to\sunderstand|why|in\sorder\sto)\s/i;
    const becauseMatch = rest.match(becauseRegex);

    if (becauseMatch) {
      const splitIndex = rest.search(becauseRegex);
      if (!concept) concept = rest.substring(0, splitIndex).trim();
      if (!reason) reason = rest.substring(splitIndex).trim();
      reason = reason.replace(/^(because|since|as|so|to|why|in\sorder\sto)\s+/i, "");
    } else {
      if (!concept) concept = rest;
      if (!reason) reason = "Provides foundational context for the next step.";
    }
  }

  // Fallbacks for empty fields
  if (!paperTitle) {
    const words = concept.split(" ");
    paperTitle = words.slice(0, 4).join(" ") + "...";
    concept = concept.split(" ").slice(4).join(" ") || "General concepts and design";
  }

  // Clean paper title
  paperTitle = paperTitle.replace(/^(Read|Read the paper|Start with|Next read|Review|Study|Paper\s*\d*:?)\s+/i, "").trim();
  paperTitle = paperTitle.replace(/^["'“«]+|["'”»:,\s-]+$/g, "").trim();

  // Clean focus concept
  concept = concept.replace(/^(focuses?\s+on|focus\s+on|focusing\s+on|to\sread|read)\s+/i, "").trim();
  concept = concept.replace(/^["'“«]+|["'”»:,\s-]+$/g, "").trim();
  if (concept) {
    concept = concept.charAt(0).toUpperCase() + concept.slice(1);
  } else {
    concept = "Key methodologies and framework details";
  }

  // Clean reason
  reason = reason.replace(/^["'“«]+|["'”»:,\s-]+$/g, "").trim();
  if (reason) {
    reason = reason.charAt(0).toUpperCase() + reason.slice(1);
  } else {
    reason = "Provides essential context for subsequent work.";
  }

  return {
    stepNum: stepNum,
    paperTitle: paperTitle,
    concept: concept,
    reason: reason
  };
}

// Simple HTML escaping helper for security
function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
