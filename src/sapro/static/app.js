(function () {
  "use strict";

  const MIN_DIM = 1;
  const MAX_DIM = 20;

  const EXAMPLES = {
    readme: {
      label: "Basic bounded maximization",
      optimization: "max",
      numVars: 2,
      numConstraints: 3,
      objective: [1, 2],
      constraints: [
        { coefficients: [1, 1], operator: "<=", rhs: 4 },
        { coefficients: [-2, 1], operator: "<=", rhs: 1 },
        { coefficients: [1, 0], operator: "<=", rhs: 3 },
      ],
    },
    minimization: {
      label: "Minimization",
      optimization: "min",
      numVars: 2,
      numConstraints: 1,
      objective: [1, 1],
      constraints: [{ coefficients: [1, 1], operator: ">=", rhs: 4 }],
    },
    ge: {
      label: "Greater-than-or-equal constraint",
      optimization: "max",
      numVars: 1,
      numConstraints: 2,
      objective: [1],
      constraints: [
        { coefficients: [1], operator: ">=", rhs: 1 },
        { coefficients: [1], operator: "<=", rhs: 5 },
      ],
    },
    equality: {
      label: "Equality constraint",
      optimization: "max",
      numVars: 2,
      numConstraints: 1,
      objective: [1, 1],
      constraints: [{ coefficients: [1, 1], operator: "==", rhs: 4 }],
    },
    mixed: {
      label: "Mixed operators",
      optimization: "max",
      numVars: 2,
      numConstraints: 3,
      objective: [1, 2],
      constraints: [
        { coefficients: [1, 0], operator: "<=", rhs: 4 },
        { coefficients: [0, 1], operator: ">=", rhs: 1 },
        { coefficients: [1, 1], operator: "==", rhs: 3 },
      ],
    },
    negative_rhs: {
      label: "Negative RHS",
      optimization: "max",
      numVars: 1,
      numConstraints: 2,
      objective: [1],
      constraints: [
        { coefficients: [1], operator: ">=", rhs: -5 },
        { coefficients: [1], operator: "<=", rhs: 3 },
      ],
    },
    infeasible: {
      label: "Infeasible problem",
      optimization: "max",
      numVars: 2,
      numConstraints: 3,
      objective: [1, 1],
      constraints: [
        { coefficients: [1, 0], operator: ">=", rhs: 5 },
        { coefficients: [0, 1], operator: ">=", rhs: 5 },
        { coefficients: [1, 1], operator: "<=", rhs: 1 },
      ],
    },
    unbounded: {
      label: "Unbounded problem",
      optimization: "max",
      numVars: 2,
      numConstraints: 2,
      objective: [1, 1],
      constraints: [
        { coefficients: [1, 0], operator: ">=", rhs: 1 },
        { coefficients: [0, 1], operator: ">=", rhs: 2 },
      ],
    },
    decimal: {
      label: "Decimal coefficients",
      optimization: "max",
      numVars: 2,
      numConstraints: 2,
      objective: [2.5, 1.5],
      constraints: [
        { coefficients: [1.5, 1], operator: "<=", rhs: 4 },
        { coefficients: [1, 0], operator: "<=", rhs: 2 },
      ],
    },
  };

  const els = {
    numVars: document.getElementById("num-vars"),
    numConstraints: document.getElementById("num-constraints"),
    objectiveGrid: document.getElementById("objective-grid"),
    constraintGrid: document.getElementById("constraint-grid"),
    statusBox: document.getElementById("status-box"),
    resultSummary: document.getElementById("result-summary"),
    stepsContainer: document.getElementById("steps-container"),
    exampleSelect: document.getElementById("example-select"),
    solveBtn: document.getElementById("solve-btn"),
    clearBtn: document.getElementById("clear-btn"),
    loadExampleBtn: document.getElementById("load-example-btn"),
  };

  function clampDimension(value) {
    const parsed = Number.parseInt(String(value), 10);
    if (Number.isNaN(parsed)) {
      return MIN_DIM;
    }
    return Math.min(MAX_DIM, Math.max(MIN_DIM, parsed));
  }

  function getOptimization() {
    const selected = document.querySelector('input[name="optimization"]:checked');
    return selected ? selected.value : "max";
  }

  function setOptimization(value) {
    const input = document.querySelector(`input[name="optimization"][value="${value}"]`);
    if (input) {
      input.checked = true;
    }
  }

  function makeNumberInput(value) {
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.value = value;
    return input;
  }

  function renderObjectiveGrid(numVars, values) {
    els.objectiveGrid.innerHTML = "";
    const table = document.createElement("table");
    table.className = "coeff-grid";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.appendChild(document.createElement("th"));
    for (let j = 0; j < numVars; j += 1) {
      const th = document.createElement("th");
      th.textContent = `x${j + 1}`;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const row = document.createElement("tr");
    const label = document.createElement("td");
    label.className = "row-label";
    label.textContent = "Objective";
    row.appendChild(label);
    for (let j = 0; j < numVars; j += 1) {
      const cell = document.createElement("td");
      cell.appendChild(makeNumberInput(values ? values[j] : 0));
      cell.querySelector("input").dataset.objectiveIndex = String(j);
      row.appendChild(cell);
    }
    tbody.appendChild(row);
    table.appendChild(tbody);
    els.objectiveGrid.appendChild(table);
  }

  function renderConstraintGrid(numVars, numConstraints, rows) {
    els.constraintGrid.innerHTML = "";
    const table = document.createElement("table");
    table.className = "coeff-grid";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.appendChild(document.createElement("th"));
    for (let j = 0; j < numVars; j += 1) {
      const th = document.createElement("th");
      th.textContent = `x${j + 1}`;
      headRow.appendChild(th);
    }
    ["Operator", "RHS"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (let i = 0; i < numConstraints; i += 1) {
      const rowData = rows ? rows[i] : null;
      const tr = document.createElement("tr");
      const label = document.createElement("td");
      label.className = "row-label";
      label.textContent = `C${i + 1}`;
      tr.appendChild(label);

      for (let j = 0; j < numVars; j += 1) {
        const cell = document.createElement("td");
        const coef = rowData ? rowData.coefficients[j] : 0;
        cell.appendChild(makeNumberInput(coef));
        cell.querySelector("input").dataset.constraintIndex = String(i);
        cell.querySelector("input").dataset.varIndex = String(j);
        tr.appendChild(cell);
      }

      const opCell = document.createElement("td");
      const opSelect = document.createElement("select");
      ["<=", ">=", "=="].forEach((op) => {
        const option = document.createElement("option");
        option.value = op;
        option.textContent = op;
        opSelect.appendChild(option);
      });
      opSelect.value = rowData ? rowData.operator : "<=";
      opSelect.dataset.constraintIndex = String(i);
      opSelect.dataset.role = "operator";
      opCell.appendChild(opSelect);
      tr.appendChild(opCell);

      const rhsCell = document.createElement("td");
      const rhsValue = rowData ? rowData.rhs : 0;
      rhsCell.appendChild(makeNumberInput(rhsValue));
      rhsCell.querySelector("input").dataset.constraintIndex = String(i);
      rhsCell.querySelector("input").dataset.role = "rhs";
      tr.appendChild(rhsCell);

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    els.constraintGrid.appendChild(table);
  }

  function rebuildGrids() {
    const numVars = clampDimension(els.numVars.value);
    const numConstraints = clampDimension(els.numConstraints.value);
    els.numVars.value = String(numVars);
    els.numConstraints.value = String(numConstraints);
    renderObjectiveGrid(numVars);
    renderConstraintGrid(numVars, numConstraints);
  }

  function collectPayload() {
    const numVars = clampDimension(els.numVars.value);
    const numConstraints = clampDimension(els.numConstraints.value);
    const objective = [];
    for (let j = 0; j < numVars; j += 1) {
      const input = els.objectiveGrid.querySelector(`input[data-objective-index="${j}"]`);
      objective.push(Number.parseFloat(input.value));
    }

    const constraints = [];
    for (let i = 0; i < numConstraints; i += 1) {
      const coefficients = [];
      for (let j = 0; j < numVars; j += 1) {
        const input = els.constraintGrid.querySelector(
          `input[data-constraint-index="${i}"][data-var-index="${j}"]`
        );
        coefficients.push(Number.parseFloat(input.value));
      }
      const operator = els.constraintGrid.querySelector(
        `select[data-constraint-index="${i}"][data-role="operator"]`
      ).value;
      const rhsInput = els.constraintGrid.querySelector(
        `input[data-constraint-index="${i}"][data-role="rhs"]`
      );
      constraints.push({
        coefficients,
        operator,
        rhs: Number.parseFloat(rhsInput.value),
      });
    }

    return {
      optimization: getOptimization(),
      objective,
      constraints,
    };
  }

  function loadExample(key) {
    const example = EXAMPLES[key];
    if (!example) {
      return;
    }
    setOptimization(example.optimization);
    els.numVars.value = String(example.numVars);
    els.numConstraints.value = String(example.numConstraints);
    renderObjectiveGrid(example.numVars, example.objective);
    renderConstraintGrid(example.numVars, example.numConstraints, example.constraints);
  }

  function clearForm() {
    setOptimization("max");
    els.numVars.value = "2";
    els.numConstraints.value = "2";
    rebuildGrids();
    clearResults("Form cleared.");
  }

  function clearResults(message) {
    els.statusBox.textContent = message || "";
    els.statusBox.className = "";
    els.resultSummary.innerHTML = '<p class="empty-state">No results yet.</p>';
    els.stepsContainer.innerHTML = "";
  }

  function formatNumber(value) {
    if (Number.isInteger(value)) {
      return String(value);
    }
    return Number(value).toFixed(6).replace(/\.?0+$/, "");
  }

  function renderTableau(tableau) {
    if (!tableau || !tableau.length) {
      return "<p class=\"empty-state\">No tableau data.</p>";
    }
    const headers = tableau[0];
    const bodyRows = tableau.slice(1, -1);
    const footer = tableau[tableau.length - 1];
    let html = '<table class="tableau"><thead><tr>';
    headers.forEach((header) => {
      html += `<th>${header}</th>`;
    });
    html += "</tr></thead><tbody>";
    bodyRows.forEach((row) => {
      html += "<tr>";
      row.forEach((cell) => {
        html += `<td>${cell}</td>`;
      });
      html += "</tr>";
    });
    html += "<tr>";
    footer.forEach((cell) => {
      html += `<td>${cell}</td>`;
    });
    html += "</tr></tbody></table>";
    return html;
  }

  function renderResult(data) {
    if (!data.ok) {
      els.statusBox.textContent = data.message || "Request failed.";
      els.statusBox.className = "error";
      els.resultSummary.innerHTML = `
        <p><strong>Status:</strong> ${data.status || "error"}</p>
        <p><strong>Type:</strong> ${data.error_type || "Error"}</p>
        <p>${data.message || "Unknown error."}</p>
      `;
      els.stepsContainer.innerHTML = "";
      return;
    }

    els.statusBox.textContent = data.status_label || "Optimal solution found.";
    els.statusBox.className = "ok";

    const vars = Object.entries(data.variable_values || {})
      .map(([name, value]) => `${name} = ${formatNumber(value)}`)
      .join(", ");

    els.resultSummary.innerHTML = `
      <p><strong>Status:</strong> ${data.status_label}</p>
      <p><strong>Objective (Z):</strong> ${formatNumber(data.objective_value)}</p>
      <p><strong>Decision variables:</strong> ${vars || "None"}</p>
      <p><strong>Steps yielded:</strong> ${data.step_count || 0}</p>
    `;

    els.stepsContainer.innerHTML = "";
    (data.steps || []).forEach((step) => {
      const details = document.createElement("details");
      details.className = "step-panel";
      const summary = document.createElement("summary");
      summary.textContent = `Step ${step.index}: ${step.enter || "none"} enters, ${step.leave || "none"} leaves`;
      details.appendChild(summary);
      const body = document.createElement("div");
      body.className = "step-body";
      body.innerHTML = renderTableau(step.tableau);
      details.appendChild(body);
      els.stepsContainer.appendChild(details);
    });
  }

  async function solve() {
    clearResults("Solving...");
    els.statusBox.className = "";
    const payload = collectPayload();
    try {
      const response = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      renderResult(data);
    } catch (error) {
      els.statusBox.textContent = "Could not reach the local solver.";
      els.statusBox.className = "error";
      els.resultSummary.innerHTML = `<p>${error.message}</p>`;
    }
  }

  function populateExampleSelect() {
    Object.entries(EXAMPLES).forEach(([key, example]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = example.label;
      els.exampleSelect.appendChild(option);
    });
  }

  els.numVars.addEventListener("change", rebuildGrids);
  els.numConstraints.addEventListener("change", rebuildGrids);
  els.solveBtn.addEventListener("click", solve);
  els.clearBtn.addEventListener("click", clearForm);
  els.loadExampleBtn.addEventListener("click", () => {
    loadExample(els.exampleSelect.value);
  });

  populateExampleSelect();
  loadExample("readme");
})();
